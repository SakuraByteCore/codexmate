'use strict';

const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const randomUUID = () => randomBytes(16).toString('hex');
const { executeWorkflowDefinition } = require('./workflow-engine');

const TERMINAL = new Set(['completed', 'failed', 'cancelled']);
const clone = value => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();
const message = error => error instanceof Error ? error.message : String(error);

function createWorkflowRunner({ directory, execute = executeWorkflowDefinition, notify } = {}) {
    if (!directory) throw new TypeError('directory is required');
    if (typeof execute !== 'function') throw new TypeError('execute must be a function');
    fs.mkdirSync(directory, { recursive: true });
    const runs = new Map();
    const live = new Set();
    const notifying = new Set();
    const adapters = new Map();

    function save(run) {
        run.updatedAt = now();
        const destination = path.join(directory, `${run.id}.json`);
        const temporary = `${destination}.${randomUUID()}.tmp`;
        try {
            fs.writeFileSync(temporary, JSON.stringify(run, null, 2), { flag: 'wx', mode: 0o600 });
            fs.renameSync(temporary, destination);
        } finally {
            if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        }
    }

    for (const file of fs.readdirSync(directory)) {
        if (!file.endsWith('.json')) continue;
        const run = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
        if (file !== `${run.id}.json`) throw new Error(`Invalid workflow run file: ${file}`);
        runs.set(run.id, run);
    }

    function requireRun(id) {
        const run = runs.get(id);
        if (!run) throw new Error(`Unknown workflow run: ${id}`);
        return run;
    }

    function summarize(run) {
        const completed = run.steps.filter(step => step.status === 'success');
        const done = new Set(run.steps.filter(step => ['success', 'skipped'].includes(step.status)).map(step => step.id));
        return {
            completed: clone(completed),
            result: run.status === 'completed' ? clone(run.output) : null,
            unfinished: (run.definition.steps || []).filter(step => !done.has(step.id)).map(step => ({
                id: step.id,
                reason: run.reason || run.error || run.status
            }))
        };
    }

    function notifyLater(run) {
        if (typeof notify !== 'function' || notifying.has(run.id)) return;
        if (!['pending', 'sending'].includes(run.notification.status)) return;
        notifying.add(run.id);
        Promise.resolve().then(async () => {
            run.notification.status = 'sending';
            run.notification.attempts += 1;
            save(run);
            try {
                const delivery = await notify(clone(run));
                if (delivery && delivery.ok === false && !delivery.skipped) throw new Error(delivery.error || 'notification failed');
                run.notification.status = delivery && delivery.skipped ? 'skipped' : 'sent';
                run.notification.error = '';
            } catch (error) {
                run.notification.status = 'failed';
                run.notification.error = message(error);
            }
            run.notification.endedAt = now();
            save(run);
        }).finally(() => notifying.delete(run.id)).catch(error => {
            run.notification.status = 'failed';
            run.notification.error = message(error);
        });
    }

    function finish(run, status, reason = '') {
        run.status = status;
        run.reason = reason;
        run.activeStep = null;
        run.endedAt = TERMINAL.has(status) ? now() : null;
        run.summary = summarize(run);
        run.notification = {
            status: typeof notify === 'function' ? 'pending' : 'disabled',
            attempts: 0,
            error: ''
        };
        save(run);
        notifyLater(run);
    }

    function record(run, log) {
        const saved = clone(log);
        const index = run.steps.findIndex(item => item.id === saved.id);
        if (index < 0) run.steps.push(saved);
        else run.steps[index] = saved;
        run.logs.push(saved);
        if (!run.activeStep || run.activeStep.id === saved.id) run.activeStep = null;
        save(run);
    }

    async function advance(run) {
        const options = adapters.get(run.id) || {};
        if (run.status === 'cancelling') {
            finish(run, 'cancelled', 'cancelled by user');
            return;
        }
        run.status = 'running';
        run.attempts += 1;
        run.startedAt = run.startedAt || now();
        run.endedAt = null;
        save(run);
        const resumeSteps = run.steps.filter(step => ['success', 'skipped'].includes(step.status));
        try {
            const execution = await execute(clone(run.definition), clone(run.input), {
                ...options,
                allowWrite: run.options.allowWrite,
                dryRun: run.options.dryRun,
                resumeSteps: clone(resumeSteps),
                shouldStop: () => run.status === 'cancelling',
                onBeforeStep: async step => {
                    if (run.status === 'cancelling') throw new Error('cancelled by user');
                    run.activeStep = clone(step);
                    run.stepAttempts[step.id] = (run.stepAttempts[step.id] || 0) + 1;
                    save(run);
                    if (options.onBeforeStep) await options.onBeforeStep(clone(step));
                },
                onProgress: async log => {
                    record(run, log);
                    if (options.onProgress) await options.onProgress(clone(log));
                }
            });
            run.execution = clone(execution);
            run.output = execution.output === undefined ? null : clone(execution.output);
            for (const log of execution.steps || []) {
                const previous = run.steps.find(item => item.id === log.id);
                if (!previous || JSON.stringify(previous) !== JSON.stringify(log)) record(run, log);
            }
            run.error = execution.error || '';
            if (run.status === 'cancelling' || execution.cancelled) finish(run, 'cancelled', run.error || 'cancelled by user');
            else if (execution.waiting) finish(run, 'waiting', run.error || execution.reason || 'execution requires explicit resume');
            else finish(run, execution.success ? 'completed' : 'failed', run.error);
        } catch (error) {
            run.error = message(error);
            // A rejected engine may leave a side effect in flight or unacknowledged.
            // Keep the active step for recovery instead of assuming it completed.
            if (run.activeStep) {
                const activeStep = run.activeStep;
                finish(run, 'waiting', run.error);
                run.activeStep = activeStep;
                save(run);
            } else {
                finish(run, run.status === 'cancelling' ? 'cancelled' : 'failed', run.error);
            }
        }
    }

    function schedule(run) {
        if (live.has(run.id)) return;
        live.add(run.id);
        Promise.resolve().then(() => advance(run)).finally(() => live.delete(run.id)).catch(error => {
            // Persistence errors must stop execution, never trigger another attempt.
            run.error = message(error);
            run.status = 'waiting';
        });
    }

    function submit(definition, input = {}, options = {}) {
        const run = {
            id: randomUUID(),
            definition: clone(definition),
            input: clone(input),
            options: { allowWrite: options.allowWrite === true, dryRun: options.dryRun === true },
            status: 'queued',
            createdAt: now(),
            updatedAt: now(),
            startedAt: null,
            endedAt: null,
            attempts: 0,
            stepAttempts: {},
            steps: clone(options.resumeSteps || []),
            logs: [],
            activeStep: null,
            execution: null,
            output: null,
            error: '',
            reason: '',
            summary: null,
            notification: { status: 'idle', attempts: 0, error: '' }
        };
        save(run);
        runs.set(run.id, run);
        adapters.set(run.id, options);
        schedule(run);
        return clone(run);
    }

    function resume(id, options = {}) {
        const run = requireRun(id);
        if (live.has(id) || run.status !== 'waiting') throw new Error(`Run is not waiting: ${id}`);
        if (Object.prototype.hasOwnProperty.call(options, 'input')) run.input = clone(options.input);
        if (Object.prototype.hasOwnProperty.call(options, 'allowWrite')) run.options.allowWrite = options.allowWrite === true;
        run.status = 'queued';
        run.reason = '';
        run.error = '';
        run.activeStep = null;
        save(run);
        schedule(run);
        return clone(run);
    }

    function cancel(id) {
        const run = requireRun(id);
        if (TERMINAL.has(run.status)) return clone(run);
        if (live.has(id)) {
            run.status = 'cancelling';
            save(run);
        } else finish(run, 'cancelled', 'cancelled by user');
        return clone(run);
    }

    function recover() {
        for (const run of runs.values()) {
            if (live.has(run.id)) continue;
            if (TERMINAL.has(run.status) || run.status === 'waiting') {
                notifyLater(run);
                continue;
            }
            if (run.status === 'cancelling') {
                if (run.activeStep) finish(run, 'waiting', 'interrupted cancellation requires explicit resume');
                else finish(run, 'cancelled', 'cancelled by user');
                continue;
            }
            if (run.activeStep) {
                const step = (run.definition.steps || []).find(item => item.id === run.activeStep.id);
                // Only an explicitly read-only definition is safe to replay.
                if (!step || step.write !== false) {
                    finish(run, 'waiting', 'interrupted write or unclassified step requires explicit resume');
                    continue;
                }
            }
            schedule(run);
        }
        return list();
    }

    function list() { return Array.from(runs.values(), run => clone(run)); }
    function get(id) { return runs.has(id) ? clone(runs.get(id)) : null; }
    return { submit, list, get, resume, cancel, recover };
}

module.exports = { createWorkflowRunner };
