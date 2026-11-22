import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { createHandoff, listHandoffs, fallbackHandoff, acknowledgeHandoff } = require('../../lib/thread-handoff');
const { nativeWrite, discoverServers } = require('../../lib/handoff-mcp');
const register = globalThis.test || (await import('node:test')).test;
const card = { goal: '交接测试', completed: ['完成路由'], blockers: [], nextSteps: ['验证读取'], files: ['lib/thread-handoff.js'] };
function fixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-handoff-'));
    return { cwd: dir, home: dir, root: path.join(dir, 'threads'), timeoutMs: 1000 };
}
function configure(options, server) {
    fs.writeFileSync(path.join(options.cwd, '.mcp.json'), JSON.stringify({ mcpServers: { 'shared-context-mcp': server } }));
}
register('handoff defaults to a visible file route, validates cards and records explicit fallback and read evidence', async () => {
    const options = fixture();
    const params = { threadId: '../thread-a', target: 'claude', card };
    await assert.rejects(createHandoff({ ...params, card: {} }, options), /goal/);
    const result = await createHandoff(params, options);
    assert.equal(result.record.route, 'file');
    assert.match(result.message, /文件级路径/);
    assert.ok(result.record.filePath.startsWith(options.root));
    const input = { threadId: params.threadId, handoffId: result.record.id };
    assert.throws(() => acknowledgeHandoff({ ...input, agent: 'codex', evidence: 'session-1' }, options), /不匹配/);
    assert.throws(() => acknowledgeHandoff({ ...input, agent: 'claude' }, options), /证据/);
    const fallback = fallbackHandoff(input, options);
    assert.equal(JSON.parse(fallback.text).card.goal, card.goal);
    assert.equal(fallback.record.readConfirmation, null);
    acknowledgeHandoff({ ...input, agent: 'claude', evidence: 'session-1 retrieval-2' }, options);
    assert.equal(listHandoffs(params.threadId, options)[0].status, 'read_confirmed');
    const lines = fs.readFileSync(path.join(path.dirname(result.record.filePath), 'handoffs.jsonl'), 'utf8').trim().split('\n');
    assert.equal(lines.length, 4);
});
register('handoff stdio initializes, writes once, waits for target read, and closes the process', async () => {
    const options = fixture();
    const server = path.join(options.cwd, 'server.cjs');
    const log = path.join(options.cwd, 'calls.jsonl');
    fs.writeFileSync(server, `const fs=require('fs');require('readline').createInterface({input:process.stdin}).on('line', line=>{
        const r=JSON.parse(line);fs.appendFileSync(${JSON.stringify(log)},line+'\\n');if(!r.id)return;
        const result=r.method==='initialize'?{protocolVersion:'2025-03-26'}:r.method==='tools/list'?{tools:[{name:'memory_write',inputSchema:{type:'object',properties:{content:{type:'string'},kind:{type:'string',default:'fact'},tags:{anyOf:[{type:'array',items:{type:'string'}},{type:'null'}]}},required:['content']}}]}:{content:[{type:'text',text:'ok'}]};
        process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,result})+'\\n');});`);
    configure(options, { command: process.execPath, args: [server] });
    const result = await createHandoff({ threadId: 'thread-stdio', target: 'claude', card }, options);
    assert.equal(result.record.route, 'mcp', result.message);
    assert.equal(result.record.status, 'awaiting_read');
    assert.equal(result.record.readConfirmation, null);
    assert.equal(result.record.mcp.tool, 'memory_write');
    const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(calls.map(call => call.method), ['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
    const written = JSON.parse(calls[3].params.arguments.content);
    assert.equal(written.id, result.record.id);
    assert.match(written.acknowledgement.instruction, /实际读取/);
    assert.equal(written.target, 'claude');
    assert.deepEqual(calls[3].params.arguments.tags, ['handoff', 'thread-stdio', 'claude']);
    const acknowledged = acknowledgeHandoff({ threadId: 'thread-stdio', handoffId: result.record.id, agent: 'claude', evidence: 'target-session:retrieval-1' }, options).record;
    assert.equal(acknowledged.route, 'mcp');
    assert.equal(acknowledged.status, 'read_confirmed');
    const fallback = fallbackHandoff({ threadId: 'thread-stdio', handoffId: result.record.id }, options).record;
    assert.equal(fallback.status, 'read_confirmed');
    assert.equal(fallback.writeResult, 'written');
    assert.equal(fallback.readConfirmation.source, 'target_reported');
    const cardFile = path.join(options.cwd, 'cli-card.json');
    fs.writeFileSync(cardFile, JSON.stringify(card));
    const cliRun = spawnSync(process.execPath, [path.resolve('cli.js'), 'thread', 'handoff', 'mcp-cli-thread', '--card', cardFile, '--target', 'claude'], {
        cwd: options.cwd, env: { ...process.env, HOME: options.home, USERPROFILE: options.home }, encoding: 'utf8', timeout: 5000
    });
    assert.equal(cliRun.status, 0, cliRun.stderr);
    assert.equal(JSON.parse(cliRun.stdout).record.route, 'mcp');

});
register('handoff HTTP session writes once, reports failure without retries and deletes session', async () => {
    for (const mode of ['ok', 'error', 'schema']) {
        const options = fixture();
        let writes = 0;
        let deleted = false;
        const server = http.createServer((req, res) => {
            if (req.method === 'DELETE') { deleted = true; res.writeHead(204); res.end(); return; }
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                const request = JSON.parse(body);
                if (request.method === 'notifications/initialized') { res.writeHead(202); res.end(); return; }
                if (request.method === 'initialize') res.setHeader('Mcp-Session-Id', 'test-session');
                else assert.equal(req.headers['mcp-session-id'], 'test-session');
                let result = { protocolVersion: '2025-03-26' };
                if (request.method === 'tools/list') result = { tools: [{ name: 'set_memory', inputSchema: { properties: { key: { type: 'string' }, value: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: mode === 'schema' ? ['unknown_required'] : ['key', 'value'] } }] };
                if (request.method === 'tools/call') { assert.equal(request.params.name, 'set_memory'); assert.equal(request.params.arguments.key, `handoff:${JSON.parse(request.params.arguments.value).id}`); writes++; result = mode === 'error' ? { isError: true, content: [{ type: 'text', text: 'secret-not-to-persist' }] } : { content: [] }; }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
            });
        });
        await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
        configure(options, { url: `http://127.0.0.1:${server.address().port}/mcp` });
        try {
            const result = await createHandoff({ threadId: `http-${mode}`, target: 'codex', card }, options);
            assert.equal(result.record.route, mode === 'ok' ? 'mcp' : 'file');
            assert.equal(writes, mode === 'schema' ? 0 : 1);
            assert.equal(deleted, true);
            assert.equal(result.record.fallback, mode !== 'ok');
            assert.ok(!JSON.stringify(result).includes('secret-not-to-persist'));
        } finally { await new Promise(resolve => server.close(resolve)); }
    }
});
register('handoff command runs file fallback and lists audit through actual CLI without bootstrap', () => {
    const options = fixture();
    const cardFile = path.join(options.cwd, 'card.json');
    fs.writeFileSync(cardFile, JSON.stringify(card));
    const cli = path.resolve('cli.js');
    const env = { ...process.env, HOME: options.home, USERPROFILE: options.home };
    const run = args => spawnSync(process.execPath, [cli, 'thread', ...args], { cwd: options.cwd, env, encoding: 'utf8', timeout: 5000 });
    const result = run(['handoff', 'cli-thread', '--card', cardFile, '--target', 'claude']);
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(result.stdout);
    assert.equal(payload.record.route, 'file');
    assert.match(payload.message, /文件级路径/);
    const listed = run(['list', 'cli-thread']);
    assert.equal(JSON.parse(listed.stdout).records[0].id, payload.record.id);
});
register('handoff discovers project UAC, skips malformed configs and honors disabled servers', async () => {
    const options = fixture();
    fs.writeFileSync(path.join(options.cwd, '.mcp.json'), '{invalid');
    fs.mkdirSync(path.join(options.cwd, '.codex'));
    fs.writeFileSync(path.join(options.cwd, '.codex', 'config.toml'), '[mcp_servers.uac]\ncommand="uac"\nargs=["serve"]\n');
    const warnings = [];
    assert.equal(discoverServers(options, warnings)[0].name, 'uac');
    assert.equal(warnings.length, 1);
    fs.writeFileSync(path.join(options.cwd, '.claude.json'), JSON.stringify({
        mcpServers: { memory: { command: 'memory' } }, disabledMcpServers: ['memory']
    }));
    assert.deepEqual(discoverServers(options).map(server => server.name), ['uac']);
    fs.writeFileSync(path.join(options.cwd, '.codex', 'config.toml'), '[mcp_servers.uac]\nenabled=false\ncommand="uac"\n');
    const result = await createHandoff({ threadId: 'malformed', target: 'claude', card }, options);
    assert.equal(result.record.route, 'file');
    assert.match(result.message, /文件级路径/);
    assert.equal(result.record.discoveryWarnings.length, 1);
    assert.match(result.message, /配置读取或解析失败/);
    assert.equal(listHandoffs('malformed', options)[0].stage, 'discovery');
});
register('handoff rejects HTTP error status even with a successful-looking SSE write result', async () => {
    const options = fixture();
    let writes = 0;
    const server = http.createServer((req, res) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const request = JSON.parse(body);
            if (!request.id) { res.writeHead(202).end(); return; }
            if (request.method === 'tools/call') {
                writes++;
                res.writeHead(503, { 'Content-Type': 'text/event-stream' });
                res.end(`data: ${JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { content: [] } })}\n\n`);
                return;
            }
            const result = request.method === 'initialize' ? { protocolVersion: '2025-03-26' }
                : { tools: [{ name: 'memory_write', inputSchema: { properties: { content: { type: 'string' } }, required: ['content'] } }] };
            res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }));
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    configure(options, { url: `http://127.0.0.1:${server.address().port}/mcp` });
    try {
        const result = await createHandoff({ threadId: 'http-error-sse', target: 'claude', card }, options);
        assert.equal(result.record.route, 'file');
        assert.equal(result.record.writeResult, 'failed_or_unconfirmed');
        assert.equal(writes, 1);
        assert.match(result.message, /文件级路径/);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
register('handoff uses the selected session project instead of the web server working directory', async () => {
    const options = fixture();
    const project = path.join(options.cwd, 'session-project');
    fs.mkdirSync(project);
    fs.writeFileSync(path.join(project, '.mcp.json'), JSON.stringify({ mcpServers: {
        'shared-context-project': { command: process.execPath, args: ['-e', 'process.exit(0)'] }
    } }));
    const result = await createHandoff({ threadId: 'project-cwd', target: 'claude', card, cwd: project }, options);
    assert.equal(result.record.mcp.server, 'shared-context-project');
    assert.equal(result.record.stage, 'initialize');
});
register('handoff refuses unsupported required native fields rather than inventing parameters', () => {
    assert.equal(nativeWrite({ name: 'store_memory', inputSchema: { properties: { content: { type: 'string' } }, required: ['session_token'] } }, {}), null);
});
register('handoff timeout falls back without retry, even if another memory server exists', async () => {
    const options = fixture();
    const script = path.join(options.cwd, 'timeout.cjs');
    const log = path.join(options.cwd, 'timeout-calls.jsonl');
    fs.writeFileSync(script, `const fs=require('fs');require('readline').createInterface({input:process.stdin}).on('line',line=>{const r=JSON.parse(line);fs.appendFileSync(${JSON.stringify(log)},line+String.fromCharCode(10));if(!r.id||r.method==='tools/call')return;const result=r.method==='initialize'?{protocolVersion:'2025-03-26'}:{tools:[{name:'memory_write',inputSchema:{properties:{content:{type:'string'}},required:['content']}}]};process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,result})+String.fromCharCode(10));});`);
    fs.writeFileSync(path.join(options.cwd, '.mcp.json'), JSON.stringify({ mcpServers: {
        'shared-context-first': { command: process.execPath, args: [script] },
        'shared-context-second': { command: process.execPath, args: [script] }
    } }));
    const result = await createHandoff({ threadId: 'timeout', target: 'claude', card }, options);
    assert.equal(result.record.route, 'file');
    assert.equal(result.record.writeResult, 'failed_or_unconfirmed');
    assert.equal(result.record.reason, 'MCP 请求超时');
    assert.ok(result.record.writeDurationMs >= options.timeoutMs);
    const calls = fs.readFileSync(log, 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(calls.filter(item => item.method === 'initialize').length, 1);
    assert.equal(calls.filter(item => item.method === 'tools/call').length, 1);
});
register('handoff UI loads route and only confirms copy, never target consumption', async () => {
    const { threadHandoffMixin } = await import('../../web-ui/modules/thread-handoff.mjs');
    const oldFetch = globalThis.fetch;
    const oldNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    const calls = [];
    const record = { id: 'ui-record', route: 'mcp', status: 'awaiting_read' };
    globalThis.fetch = async (_url, request) => {
        const body = JSON.parse(request.body); calls.push(body);
        return { ok: true, status: 200, headers: { get: () => 'application/json' }, json: async () => body.action === 'thread-handoff-list'
            ? { records: [record] } : { record: { ...record, route: 'file' }, text: '{"card":"test"}' } };
    };
    let copied = '';
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { writeText: async text => { copied = text; } } } });
    try {
        const vm = { ...threadHandoffMixin.data(), handoffExpanded: true, activeSession: { sessionId: 'ui-thread' } };
        for (const [name, method] of Object.entries(threadHandoffMixin.methods)) vm[name] = method.bind(vm);
        await vm.loadThreadHandoffs();
        assert.equal(vm.handoffRecords[0].route, 'mcp');
        await vm.copyThreadHandoff(record);
        assert.equal(copied, '{"card":"test"}');
        assert.match(vm.handoffNotice, /未发送给目标/);
        assert.equal(vm.handoffRecords[0].status, 'awaiting_read');
        assert.deepEqual(calls.map(item => item.action), ['thread-handoff-list', 'thread-handoff-fallback']);
        assert.equal(calls[1].params.threadId, 'ui-thread');
    } finally {
        globalThis.fetch = oldFetch;
        if (oldNavigator) Object.defineProperty(globalThis, 'navigator', oldNavigator);
        else delete globalThis.navigator;
    }
});
register('handoff UI restores memory drafts by source and session without loading collapsed history', async () => {
    const { threadHandoffMixin: mixin } = await import('../../web-ui/modules/thread-handoff.mjs');
    const vm = { ...mixin.data(), activeSession: null };
    for (const [name, method] of Object.entries(mixin.methods)) vm[name] = method.bind(vm);
    const select = (source, sessionId) => {
        const previousKey = mixin.computed.handoffSessionKey.call(vm);
        vm.activeSession = sessionId ? { source, sessionId } : null;
        mixin.watch.handoffSessionKey.handler.call(vm, mixin.computed.handoffSessionKey.call(vm), previousKey);
    };
    const oldFetch = globalThis.fetch;
    const calls = [];
    globalThis.fetch = async (_url, request) => {
        calls.push(JSON.parse(request.body));
        return { headers: { get: () => 'application/json' }, json: async () => ({ records: [] }) };
    };
    try {
        select('codex', 'same-id');
        Object.assign(vm.handoffDraft, { target: 'claude', goal: '继续任务', completed: '已定位', blockers: '待确认', nextSteps: '验证', files: 'a.mjs' });
        const draft = { ...vm.handoffDraft };
        select('claude', 'same-id');
        assert.equal(vm.handoffDraft.goal, '');
        vm.handoffDraft.goal = '另一来源';
        select('codex', 'other-id');
        assert.equal(vm.handoffDraft.goal, '');
        select('codex', 'same-id');
        assert.deepEqual(vm.handoffDraft, draft);
        select('claude', 'same-id');
        assert.equal(vm.handoffDraft.goal, '另一来源');
        select('', '');
        select('codex', 'same-id');
        assert.deepEqual(vm.handoffDraft, draft);
        assert.equal(vm.handoffExpanded, false);
        await vm.loadThreadHandoffs();
        assert.equal(calls.length, 0);
        const details = { open: true };
        vm.toggleThreadHandoff({ target: details, currentTarget: details });
        await new Promise(resolve => setTimeout(resolve, 0));
        assert.equal(vm.handoffExpanded, true);
        assert.deepEqual(calls, [{ action: 'thread-handoff-list', params: { threadId: 'same-id' } }]);
        vm.toggleThreadHandoff({ target: { open: true }, currentTarget: details });
        assert.equal(calls.length, 1);
        select('codex', 'other-id');
        assert.equal(vm.handoffExpanded, false);
        assert.equal(calls.length, 1);
        assert.equal(mixin.data().handoffDrafts.size, 0);
    } finally { globalThis.fetch = oldFetch; }
});
