import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createRoutingBridgeHttpHandler } = require('../../cli/routing-bridge');
const { createOpenaiChatRoutingHandler } = require('../../cli/openai-chat-routing');

async function listen(t, instance) {
    instance.listen(0, '127.0.0.1'); await once(instance, 'listening');
    t.after(() => new Promise(resolve => instance.close(resolve)));
    return instance.address().port;
}
function request(url, payload, { method = 'POST', token = 'client-token' } = {}) {
    return new Promise((resolve, reject) => {
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const req = http.request(url, { method, headers }, res => {
            let text = ''; res.on('data', chunk => { text += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, text, headers: res.headers })); res.on('error', reject);
        });
        req.setTimeout(2000, () => req.destroy(new Error('request timeout'))); req.on('error', reject);
        req.end(payload ? JSON.stringify(payload) : '');
    });
}
const message = { model: 'routing', messages: [{ role: 'user', content: 'hello' }] };
async function fixture(t, { strategy = 'order', failure = 429, holdStream = false } = {}) {
    const calls = [];
    const members = [];
    let activeStream; let resolveClosed;
    const sourceClosed = new Promise(resolve => { resolveClosed = resolve; });
    for (const name of ['alpha', 'beta']) {
        const port = await listen(t, http.createServer((req, res) => {
            let text = ''; req.on('data', chunk => { text += chunk; }); req.on('end', () => {
                const payload = JSON.parse(text); calls.push({ name, payload, url: req.url, authorization: req.headers.authorization });
                if (name === 'alpha' && failure) { res.writeHead(failure, { 'Content-Type': 'application/json' }); res.end('{"error":{"message":"busy"}}'); return; }
                if (payload.stream) {
                    res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.write('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n');
                    if (holdStream) { activeStream = res; res.once('close', resolveClosed); return; }
                    res.end('data: [DONE]\n\n'); return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ object: 'chat.completion', model: payload.model, choices: [{ message: { role: 'assistant', content: 'hello' } }] }));
            });
        }));
        members.push({ name, baseUrl: `http://127.0.0.1:${port}/v1`, model: `${name}-model` });
    }
    let bound = true;
    const handler = createRoutingBridgeHttpHandler({ expectedToken: 'client-token', maxBodySize: 4096,
        groups: { resolve: target => target === 'openai-chat' && bound ? { id: 'chat', target, strategy, members } : null },
        createHandler: (_, member) => createOpenaiChatRoutingHandler({ member, authorization: `Bearer server-${member.name}` }) });
    const port = await listen(t, http.createServer((req, res) => { if (!handler(req, res)) { res.writeHead(418); res.end('legacy'); } }));
    return { port, calls, unbind: () => { bound = false; }, sourceClosed, stopStream: () => activeStream.destroy() };
}
test('OpenAI Chat preserves payload and server credentials while failing over within its group', async t => {
    const { port, calls } = await fixture(t);
    const tools = [{ type: 'function', function: { name: 'lookup', parameters: { type: 'object' } } }];
    const result = await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/chat/completions`, { ...message, tools, temperature: 0.2 });
    assert.equal(result.status, 200); assert.equal(JSON.parse(result.text).object, 'chat.completion');
    assert.deepEqual(calls.map(call => call.name), ['alpha', 'beta']);
    assert.equal(calls[1].payload.model, 'beta-model'); assert.deepEqual(calls[1].payload.tools, tools);
    assert.equal(calls[1].payload.temperature, 0.2); assert.equal(calls[1].url, '/v1/chat/completions');
    assert.equal(calls[1].authorization, 'Bearer server-beta'); assert.equal(result.text.includes('server-beta'), false);
});
test('OpenAI model discovery does not spend a rotation and invalid requests never reach upstream', async t => {
    const { port, calls, unbind } = await fixture(t, { strategy: 'rotate', failure: 0 });
    const models = await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/models`, null, { method: 'GET' });
    assert.equal(models.status, 200); assert.equal(JSON.parse(models.text).data[0].id, 'routing'); assert.equal(calls.length, 0);
    assert.equal((await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/chat/completions`, { ...message, model: 'unknown' })).status, 400);
    assert.equal((await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/chat/completions`, { ...message, messages: [] })).status, 400);
    assert.equal((await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/responses`, message)).status, 404);
    assert.equal((await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/models`, message)).status, 405);
    assert.equal(calls.length, 0);
    await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/chat/completions`, message); await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/chat/completions`, message);
    assert.deepEqual(calls.map(call => call.name), ['alpha', 'beta']);
    unbind(); const stopped = await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/chat/completions`, message);
    assert.equal(stopped.status, 503); assert.equal(typeof JSON.parse(stopped.text).error.message, 'string'); assert.equal(calls.length, 2);
});
test('OpenAI Chat streams real SSE and caller errors never try another member', async t => {
    const streaming = await fixture(t, { failure: 0 });
    const result = await request(`http://127.0.0.1:${streaming.port}/bridge/openai-chat/v1/chat/completions`, { ...message, stream: true, stream_options: { include_usage: true } });
    assert.equal(result.status, 200); assert.match(result.headers['content-type'], /text\/event-stream/); assert.match(result.text, /data: \[DONE\]/);
    assert.equal(streaming.calls.length, 1); assert.equal(streaming.calls[0].payload.stream_options.include_usage, true);
    const rejected = await fixture(t, { failure: 401 });
    assert.equal((await request(`http://127.0.0.1:${rejected.port}/bridge/openai-chat/v1/chat/completions`, message)).status, 401);
    assert.equal(rejected.calls.length, 1);
});
test('OpenAI access token is required even on loopback when configured', async t => {
    const { port, calls } = await fixture(t);
    for (const token of ['', 'wrong']) assert.equal((await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/chat/completions`, message, { token })).status, 401);
    assert.equal(calls.length, 0);
    const statuses = [];
    const invoke = (expectedToken, token) => createRoutingBridgeHttpHandler({ expectedToken,
        groups: { resolve: () => null }, createHandler: () => null })({ url: '/bridge/openai-chat/v1/models', method: 'GET', socket: { remoteAddress: '192.0.2.1' }, headers: { authorization: token ? `Bearer ${token}` : '' } },
        { writeHead: status => statuses.push(status), end: () => {} });
    invoke('', ''); invoke('client-token', 'wrong'); invoke('client-token', 'client-token');
    assert.deepEqual(statuses, [403, 401, 503]);
});
test('real OpenAI API binding uses existing providers without enabling or editing either native tool', { timeout: 25000 }, async t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-chat-api-'));
    const upstreamCalls = [];
    const upstreamPort = await listen(t, http.createServer((req, res) => {
        let text = ''; req.on('data', chunk => { text += chunk; }); req.on('end', () => {
            const payload = JSON.parse(text); upstreamCalls.push({ payload, authorization: req.headers.authorization, extra: req.headers['x-upstream-test'] });
            if (payload.stream) { res.writeHead(200, { 'Content-Type': 'text/event-stream' }); res.end('data: [DONE]\n\n'); return; }
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ object: 'chat.completion', choices: [{ message: { content: 'ok' } }] }));
        });
    }));
    const reserve = http.createServer(); reserve.listen(0, '127.0.0.1'); await once(reserve, 'listening'); const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
    fs.mkdirSync(path.join(home, '.codex'));
    const config = `model_provider = "alpha"\nmodel = "original"\n[model_providers.alpha]\nbase_url = "http://127.0.0.1:${upstreamPort}/v1"\nexperimental_bearer_token = "mock-upstream-key"\n[model_providers.beta]\nbase_url = "http://127.0.0.1:${port}/bridge/openai/beta/v1"\ncodexmate_bridge = "openai"\n`;
    const configPath = path.join(home, '.codex/config.toml'); fs.writeFileSync(configPath, config);
    fs.writeFileSync(path.join(home, '.codex/codexmate-openai-bridge.json'), JSON.stringify({ providers: { beta: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'mock-transformed-key', headers: { 'X-Upstream-Test': 'preserved' } } } }));
    const output = fs.createWriteStream(path.join(home, 'server.log'));
    const child = spawn(process.execPath, [path.resolve('cli.js'), 'run'], { cwd: process.cwd(),
        env: { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: '', CLAUDE_HOME: '', CLAUDE_CONFIG_DIR: '', XDG_CONFIG_HOME: '', PI_HOME: '', XDG_DATA_HOME: path.join(home, '.local/share'), CODEXMATE_PORT: String(port), CODEXMATE_NO_BROWSER: '1', CODEXMATE_HTTP_TOKEN: 'client-token' }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(output); child.stderr.pipe(output, { end: false });
    t.after(async () => { if (child.exitCode === null) { const closed = once(child, 'close'); child.kill('SIGTERM'); await closed; } output.end(); fs.rmSync(home, { recursive: true, force: true }); });
    const api = async (action, params = {}) => JSON.parse((await request(`http://127.0.0.1:${port}/api`, { action, params })).text);
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) { if (child.exitCode !== null) throw new Error(fs.readFileSync(path.join(home, 'server.log'), 'utf8')); try { ready = (await api('health-check')).ok === true; } catch (_) {} if (ready) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.equal(ready, true);
    let state = await api('routing-get'); assert.equal(JSON.stringify(state).includes('mock-upstream-key'), false);
    assert.equal(state.openaiChat.basePath, '/bridge/openai-chat/v1'); assert.equal(state.openaiChat.requiresToken, true);
    const draft = { target: 'openai-chat', name: 'API group', strategy: 'order', members: [{ provider: 'alpha', model: 'chosen-model' }] };
    assert.equal((await api('routing-save', { ...draft, revision: state.revision })).errorCode, 'tool-config-write-disabled');
    await api('set-tool-config-permission', { target: 'codex', allowWrite: true });
    state = await api('routing-save', { ...draft, revision: state.revision }); const id = state.groups[0].id;
    state = await api('routing-bind', { target: 'openai-chat', id, revision: state.revision });
    assert.equal(state.bridges['openai-chat'].active, true); assert.equal(state.bridges.codex.active, false); assert.equal(state.bridges.claude.active, false);
    const result = await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/chat/completions`, message);
    assert.equal(result.status, 200); assert.equal(upstreamCalls[0].payload.model, 'chosen-model'); assert.equal(upstreamCalls[0].authorization, 'Bearer mock-upstream-key');
    assert.equal(fs.readFileSync(configPath, 'utf8'), config); assert.equal(JSON.stringify(state).includes('mock-upstream-key'), false);
    state = await api('routing-save', { ...draft, id, members: [{ provider: 'beta', model: 'transformed-model' }], revision: state.revision });
    const streamed = await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/chat/completions`, { ...message, stream: true });
    assert.equal(streamed.status, 200); assert.match(streamed.headers['content-type'], /text\/event-stream/); assert.match(streamed.text, /\[DONE\]/);
    assert.equal(upstreamCalls.at(-1).authorization, 'Bearer mock-transformed-key'); assert.equal(upstreamCalls.at(-1).extra, 'preserved');
    assert.equal(fs.readFileSync(configPath, 'utf8'), config);
    state = await api('routing-bind', { target: 'openai-chat', id: '', revision: state.revision });
    assert.equal((await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/chat/completions`, message)).status, 503);
    assert.equal(fs.readFileSync(configPath, 'utf8'), config);
});

function beginStream(port) {
    return new Promise((resolve, reject) => {
        const client = http.request({ hostname: '127.0.0.1', port, path: '/bridge/openai-chat/v1/chat/completions', method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer client-token' } }, response => resolve({ client, response }));
        client.on('error', reject); client.end(JSON.stringify({ ...message, stream: true }));
    });
}
test('an upstream stream failure after its first chunk never replays another model', { timeout: 4000 }, async t => {
    const { port, calls, stopStream } = await fixture(t, { failure: 0, holdStream: true });
    const { response } = await beginStream(port);
    const [chunk] = await once(response, 'data'); assert.match(chunk.toString(), /hello/);
    const closed = once(response, 'close'); stopStream();
    await assert.rejects(closed, { code: 'ECONNRESET' });
    assert.deepEqual(calls.map(call => call.name), ['alpha']);
});
test('client cancellation closes the upstream stream without trying a backup', { timeout: 4000 }, async t => {
    const { port, calls, sourceClosed } = await fixture(t, { failure: 0, holdStream: true });
    const { client, response } = await beginStream(port);
    await once(response, 'data'); const closed = once(response, 'close'); client.destroy();
    await closed.catch(error => assert.equal(error.code, 'ECONNRESET')); await sourceClosed;
    assert.deepEqual(calls.map(call => call.name), ['alpha']);
});

test('unbound native bridge requests still delegate without changing legacy authentication', () => {
    const handler = createRoutingBridgeHttpHandler({ groups: { resolve: () => null }, createHandler: () => null });
    assert.equal(handler({ url: '/bridge/local/v1/responses', socket: { remoteAddress: '192.0.2.1' }, headers: {} },
        { writeHead: () => assert.fail('unbound native request must remain with legacy handler') }), false);
});

test('self-referencing OpenAI routes stop before a second group resolution', async t => {
    let port; let resolutions = 0;
    const handler = createRoutingBridgeHttpHandler({ maxBodySize: 4096,
        groups: { resolve: () => ++resolutions > 2 ? null : { id: 'self', target: 'openai-chat', strategy: 'order',
            members: [{ name: 'self', model: 'routing', baseUrl: `http://127.0.0.1:${port}/bridge/openai-chat/v1` }] } },
        createHandler: (_, member) => createOpenaiChatRoutingHandler({ member }) });
    port = await listen(t, http.createServer(handler));
    const result = await request(`http://127.0.0.1:${port}/bridge/openai-chat/v1/chat/completions`, message);
    assert.equal(result.status, 508); assert.equal(resolutions, 1);
    assert.match(JSON.parse(result.text).error.message, /Nested OpenAI routing/);
});
test('legacy OpenAI provider paths are never intercepted by the new API namespace', () => {
    const handler = createRoutingBridgeHttpHandler({ groups: { resolve: () => assert.fail('legacy path must not resolve a routing group') }, createHandler: () => null });
    assert.equal(handler({ url: '/bridge/openai/v1/v1/responses', method: 'POST', headers: {}, socket: { remoteAddress: '127.0.0.1' } },
        { writeHead: () => assert.fail('legacy provider v1 must remain available') }), false);
});
