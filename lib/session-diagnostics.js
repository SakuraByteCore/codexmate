'use strict';
const ITEM_TIMEOUT_MS = 15000;
const TOTAL_TIMEOUT_MS = 60000;
function redactDiagnostic(value, options = {}) {
    const secrets = options.secrets || [];
    function text(input) {
        let output = String(input);
        for (const secret of secrets.filter((item) => typeof item === 'string' && item)) output = output.split(secret).join('[redacted]');
        if (options.home) output = output.split(options.home).join('~');
        if (options.project) output = output.split(options.project).join('[project]');
        return output.replace(/Bearer\s+[^\s"',;]+/gi, 'Bearer [redacted]')
            .replace(/((?:api[_-]?key|token|password|secret|authorization)\s*[=:]\s*)[^\s,;]+/gi, '$1[redacted]')
            .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
            .replace(/([?&](?:api[_-]?key|token|password|secret)=)[^&\s]+/gi, '$1[redacted]');
    }
    function clean(input) {
        if (typeof input === 'string') return text(input);
        if (Array.isArray(input)) return input.map(clean);
        if (!input || typeof input !== 'object') return input;
        return Object.fromEntries(Object.entries(input).map(([key, item]) => [key,
            /api[_-]?key|token|password|secret|authorization|headers|(?:^|_)env$/i.test(key) ? '[redacted]' : clean(item)]));
    }
    return clean(value);
}
function createSessionDiagnostics({ local, provider, mcp, mcpTargets, home, secrets }) {
    let job = { status: 'idle', items: [], cancelled: false };
    let running;
    const status = () => {
        const report = redactDiagnostic(job, { home, project: job.project, secrets: secrets ? secrets() : [] });
        const markdown = ['# Codex Mate diagnostics', `Status: ${report.status}`, ...report.items.map((item) =>
            `\n## ${item.id}\nStatus: ${item.status}\nChecked: ${item.checkedAt || ''}\n${JSON.stringify(item.evidence || {}, null, 2)}`)].join('\n');
        return { report, markdown };
    };
    async function check(item, execute, deadline) {
        if (job.cancelled) { item.status = 'cancelled'; return; }
        const activeJob = job;
        if (Date.now() >= deadline) { item.status = 'timeout'; return; }
        const started = Date.now();
        const timeout = Math.max(1, Math.min(ITEM_TIMEOUT_MS, deadline - started));
        item.status = 'running'; item.checkedAt = new Date().toISOString();
        let timer;
        try {
            const result = await Promise.race([execute({ timeoutMs: timeout, isCancelled: () => activeJob.cancelled }),
                new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('diagnostic-timeout')), timeout); })]);
            item.status = activeJob.cancelled ? 'cancelled' : result.ok === false ? 'failed' : 'passed';
            item.evidence = result;
        } catch (error) {
            item.status = activeJob.cancelled ? 'cancelled' : error.message === 'diagnostic-timeout' ? 'timeout' : 'failed';
            item.errorCode = error.message === 'diagnostic-timeout' ? 'diagnostic-timeout' : 'diagnostic-check-failed';
        } finally { clearTimeout(timer); item.durationMs = Date.now() - started; }
    }
    function start(params = {}) {
        if (job.status === 'running') throw new Error('diagnostic-busy');
        if (params.remote !== undefined && typeof params.remote !== 'boolean') throw new Error('diagnostic-input-invalid');
        const names = params.mcpNames || [];
        if (!Array.isArray(names) || names.some((name) => typeof name !== 'string' || !mcpTargets(params.cwd).includes(name))) throw new Error('diagnostic-input-invalid');
        job = { status: 'running', cancelled: false, startedAt: new Date().toISOString(), project: params.cwd || '',
            items: [{ id: 'local', status: 'pending' }, { id: 'provider', status: params.remote ? 'pending' : 'not_checked' },
                ...names.map((name) => ({ id: `mcp:${name}`, status: 'pending' }))] };
        running = (async () => {
            const deadline = Date.now() + TOTAL_TIMEOUT_MS;
            await check(job.items[0], local, deadline);
            if (params.remote) await check(job.items[1], provider, deadline);
            for (let index = 0; index < names.length; index++) {
                if (Date.now() >= deadline) { job.items[index + 2].status = 'timeout'; continue; }
                await check(job.items[index + 2], (options) => mcp(names[index], { ...options, cwd: params.cwd }), deadline);
            }
            job.status = job.cancelled ? 'cancelled' : job.items.some((item) => ['failed', 'timeout'].includes(item.status)) ? 'partial' : 'success';
            job.finishedAt = new Date().toISOString();
        })().catch(() => { job.status = 'failed'; });
        return status();
    }
    return { start, status, cancel() { job.cancelled = true; return status(); }, targets: (cwd) => ({ names: mcpTargets(cwd) }), wait: () => running };
}
module.exports = { createSessionDiagnostics, redactDiagnostic };
