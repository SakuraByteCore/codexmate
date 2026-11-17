import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createWorkflowRunner } = require('../../lib/workflow-runner.js');

function setup(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-runner-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    return directory;
}
async function until(check) {
    for (let attempt = 0; attempt < 200; attempt += 1) {
        if (check()) return;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.fail('workflow did not settle');
}
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}
const definition = { steps: [{ id: 'read', tool: 'read', write: false }, { id: 'write', tool: 'write', write: true }] };

// Mirrors the engine callback contract without depending on parallel engine edits.
async function engine(def, input, options) {
    const steps = [...options.resumeSteps];
    for (const step of def.steps) {
        if (steps.some(log => log.id === step.id)) continue;
        if (options.shouldStop()) return { success: false, cancelled: true, steps, output: null };
        if (step.write && !options.allowWrite) return { success: false, waiting: true, steps, error: 'write permission required' };
        await options.onBeforeStep(step);
        const output = options.invokeTool ? await options.invokeTool(step.tool, input) : { input };
        const log = { id: step.id, status: 'success', output };
        steps.push(log);
        await options.onProgress(log);
    }
    return { success: true, steps, output: steps.at(-1)?.output ?? null };
}

test('submit is synchronous and persists detached snapshots before execution', async t => {
    const directory = setup(t);
    const runner = createWorkflowRunner({ directory, execute: engine });
    const input = { value: 3 };
    const run = runner.submit(definition, input, { allowWrite: true });
    assert.equal(run.status, 'queued');
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, `${run.id}.json`))).status, 'queued');
    input.value = 9;
    run.definition.steps.length = 0;
    await until(() => runner.get(run.id).status === 'completed');
    const saved = runner.get(run.id);
    assert.equal(saved.input.value, 3);
    assert.equal(saved.definition.steps.length, 2);
    assert.equal(saved.steps.length, 2);
    assert.equal(saved.logs.length, 2);
    assert.equal(saved.attempts, 1);
    assert.deepEqual(saved.stepAttempts, { read: 1, write: 1 });
    assert.deepEqual(saved.summary.result, { input: { value: 3 } });
    assert.equal(saved.summary.completed.length, 2);
    assert.deepEqual(saved.summary.unfinished, []);
    assert.equal(runner.list().length, 1);
    assert.equal(runner.get('missing'), null);
});

test('waiting requires explicit resume and never repeats successful steps', async t => {
    const calls = [];
    const runner = createWorkflowRunner({ directory: setup(t), execute: engine });
    const run = runner.submit(definition, {}, { invokeTool: async tool => { calls.push(tool); return { tool }; } });
    await until(() => runner.get(run.id).status === 'waiting');
    assert.equal(runner.get(run.id).summary.unfinished[0].id, 'write');
    runner.recover();
    assert.equal(runner.get(run.id).status, 'waiting');
    runner.resume(run.id, { allowWrite: true, input: { updated: true } });
    await until(() => runner.get(run.id).status === 'completed');
    assert.deepEqual(calls, ['read', 'write']);
    assert.equal(runner.get(run.id).attempts, 2);
    assert.deepEqual(runner.get(run.id).input, { updated: true });
    assert.throws(() => runner.resume(run.id), /not waiting/);
});

test('active step is on disk before invocation; cancel waits for real completion', async t => {
    const directory = setup(t);
    const gate = deferred();
    let invoked = false;
    let id;
    const runner = createWorkflowRunner({ directory, execute: engine });
    const run = runner.submit(definition, {}, { allowWrite: true, invokeTool: async () => {
        const disk = JSON.parse(fs.readFileSync(path.join(directory, `${id}.json`)));
        assert.equal(disk.activeStep.id, 'read');
        assert.equal(disk.stepAttempts.read, 1);
        invoked = true;
        await gate.promise;
        return { full: ['output'] };
    } });
    id = run.id;
    await until(() => invoked);
    assert.equal(runner.cancel(id).status, 'cancelling');
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(runner.get(id).status, 'cancelling');
    gate.resolve();
    await until(() => runner.get(id).status === 'cancelled');
    assert.deepEqual(runner.get(id).steps[0].output, { full: ['output'] });
    assert.equal(runner.get(id).steps.length, 1);
});

for (const write of [false, true]) {
    test(`recovery ${write ? 'blocks write' : 'replays read'} interruption`, async t => {
        const directory = setup(t);
        const first = createWorkflowRunner({ directory, execute: engine });
        const run = first.submit({ steps: [{ id: 'active', tool: 'tool', write }] });
        first.cancel(run.id);
        await until(() => first.get(run.id).status === 'cancelled');
        const file = path.join(directory, `${run.id}.json`);
        const disk = JSON.parse(fs.readFileSync(file));
        disk.status = 'running';
        disk.activeStep = disk.definition.steps[0];
        disk.attempts = 1;
        fs.writeFileSync(file, JSON.stringify(disk));
        let calls = 0;
        const restarted = createWorkflowRunner({ directory, execute: async (...args) => { calls += 1; return engine(...args); } });
        restarted.recover();
        restarted.recover();
        if (write) {
            assert.equal(restarted.get(run.id).status, 'waiting');
            assert.equal(calls, 0);
            restarted.resume(run.id, { allowWrite: true });
        }
        await until(() => restarted.get(run.id).status === 'completed');
        assert.equal(calls, 1);
        assert.equal(restarted.get(run.id).attempts, 2);
        assert.equal(fs.readdirSync(directory).some(file => file.endsWith('.tmp')), false);
    });
}

test('notification failure is isolated and persisted separately', async t => {
    const directory = setup(t);
    const runner = createWorkflowRunner({ directory, execute: engine, notify: async () => { throw new Error('offline'); } });
    const run = runner.submit({ steps: [definition.steps[0]] });
    await until(() => runner.get(run.id).notification.status === 'failed');
    const saved = runner.get(run.id);
    assert.equal(saved.status, 'completed');
    assert.equal(saved.notification.error, 'offline');
    assert.equal(saved.notification.attempts, 1);
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, `${run.id}.json`))).notification.status, 'failed');
});

test('engine failures and full execution output survive restart', async t => {
    const directory = setup(t);
    const execution = { success: false, error: 'bad tool', output: { nested: ['entire', 'payload'] }, steps: [{ id: 'read', status: 'failed', output: { error: 'bad tool' } }] };
    const runner = createWorkflowRunner({ directory, execute: async () => execution });
    const run = runner.submit(definition);
    await until(() => runner.get(run.id).status === 'failed');
    const restarted = createWorkflowRunner({ directory, execute: engine });
    restarted.recover();
    assert.deepEqual(restarted.get(run.id).execution, execution);
    assert.equal(restarted.get(run.id).summary.unfinished[0].reason, 'bad tool');
});

test('engine cancelled flag and queued cancellation prevent more work', async t => {
    let calls = 0;
    const runner = createWorkflowRunner({ directory: setup(t), execute: async () => { calls += 1; return { success: false, cancelled: true, steps: [], output: null }; } });
    const queued = runner.submit(definition);
    runner.cancel(queued.id);
    await until(() => runner.get(queued.id).status === 'cancelled');
    assert.equal(calls, 0);
    const run = runner.submit(definition);
    await until(() => runner.get(run.id).status === 'cancelled');
    assert.equal(calls, 1);
});
