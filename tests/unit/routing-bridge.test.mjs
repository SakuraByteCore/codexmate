import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createLocalBridgeHttpHandler } = require('../../cli/local-bridge');
const { createRoutingBridgeHttpHandler } = require('../../cli/routing-bridge');

async function server(t, listener) {
    const instance = http.createServer(listener);
    instance.listen(0, '127.0.0.1');
    await once(instance, 'listening');
    t.after(() => new Promise(resolve => instance.close(resolve)));
    return `http://127.0.0.1:${instance.address().port}`;
}
function request(url, payload) {
    return new Promise((resolve, reject) => {
        const req = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, res => {
            let text = '';
            res.on('data', chunk => { text += chunk; });
            res.on('end', () => resolve({ status: res.statusCode, text }));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.end(JSON.stringify(payload));
    });
}
async function setup(t, { target = 'codex', strategy = 'order', failure = 503 } = {}) {
    const calls = [];
    const members = [];
    for (const name of ['alpha', 'beta']) {
        const baseUrl = await server(t, (req, res) => {
            let text = '';
            req.on('data', chunk => { text += chunk; });
            req.on('end', () => {
                const payload = JSON.parse(text);
                calls.push({ name, payload, url: req.url });
                res.setHeader('Content-Type', 'application/json');
                if (name === 'alpha' && failure) {
                    res.statusCode = failure;
                    res.end(JSON.stringify({ error: 'upstream unavailable' }));
                    return;
                }
                res.end(JSON.stringify(target === 'claude'
                    ? { id: 'msg', type: 'message', model: payload.model, role: 'assistant', content: [{ type: 'text', text: name }], usage: {} }
                    : { id: 'resp', object: 'response', model: payload.model, output: [], status: 'completed' }));
            });
        });
        members.push({ name, baseUrl, model: `${name}-model`, targetApi: 'responses' });
    }
    let bound = true;
    const groups = { resolve: () => bound ? { id: 'daily', target, strategy, members } : null };
    const handler = createRoutingBridgeHttpHandler({
        groups, maxBodySize: 4096,
        createHandler: (agent, member) => createLocalBridgeHttpHandler({
            readConfigFn: () => ({ model_providers: { [member.name]: { base_url: member.baseUrl } } }),
            claudeProvidersFile: '/unused/routing-test',
            readClaudeProviders: () => ({ providers: { [member.name]: member } }),
            requestMaxRetries: 0, maxBodySize: 4096, maxUpstreamBytes: 4096
        })
    });
    const url = await server(t, (req, res) => {
        if (!handler(req, res)) { res.statusCode = 418; res.end('legacy route'); }
    });
    return { calls, url: url + (target === 'claude' ? '/bridge/claude-local/v1/messages' : '/bridge/local/v1/responses'), unbind: () => { bound = false; } };
}
test('order retries 503 on the next group member with its model and original tools', async t => {
    const { calls, url } = await setup(t);
    const result = await request(url, { model: 'original', input: 'hello', tools: [{ type: 'function', name: 'lookup', parameters: {} }] });
    assert.equal(result.status, 200);
    assert.deepEqual(calls.map(call => call.name), ['alpha', 'beta']);
    assert.deepEqual(calls.map(call => call.payload.model), ['alpha-model', 'beta-model']);
    assert.equal(calls[1].payload.tools[0].name, 'lookup');
});
test('rotate alternates members across requests and unbound traffic retains the legacy handler', async t => {
    const { calls, url, unbind } = await setup(t, { strategy: 'rotate', failure: 0 });
    await request(url, { model: 'original', input: 'hello' });
    await request(url, { model: 'original', input: 'hello' });
    assert.deepEqual(calls.map(call => call.name), ['alpha', 'beta']);
    unbind();
    assert.equal((await request(url, {})).status, 418);
});
test('caller errors are returned without replaying another member', async t => {
    const { calls, url } = await setup(t, { failure: 400 });
    assert.equal((await request(url, { model: 'original', input: 'hello' })).status, 400);
    assert.deepEqual(calls.map(call => call.name), ['alpha']);
});
test('Claude routing retries 429 and preserves the Messages contract', async t => {
    const { calls, url } = await setup(t, { target: 'claude', failure: 429 });
    const result = await request(url, { model: 'original', max_tokens: 16, messages: [{ role: 'user', content: 'hello' }] });
    assert.equal(result.status, 200);
    assert.equal(JSON.parse(result.text).model, 'beta-model');
    assert.deepEqual(calls.map(call => call.url), ['/v1/messages', '/v1/messages']);
});
test('a streamed reply is forwarded once without fallback after output starts', async t => {
    const calls = [];
    const handler = createRoutingBridgeHttpHandler({
        groups: { resolve: () => ({ id: 'stream', target: 'claude', strategy: 'order', members: [{ name: 'alpha' }, { name: 'beta' }] }) },
        maxBodySize: 4096,
        createHandler: (target, member) => (req, res) => {
            calls.push(member.name);
            req.resume();
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.flushHeaders();
            res.write('data: first\n\n');
            res.writeHead(503, {});
            res.end('data: failed\n\n');
            return true;
        }
    });
    const url = await server(t, handler);
    const result = await request(url + '/bridge/claude-local/v1/messages', { stream: true });
    assert.equal(result.status, 200);
    assert.match(result.text, /first/);
    assert.deepEqual(calls, ['alpha']);
});
