import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createOpenaiBridgeHttpHandler } = require('../../cli/openai-bridge.js');

function listen(server) {
    server.listen(0, '127.0.0.1');
    return once(server, 'listening').then(() => {
        const addr = server.address();
        return { port: addr.port, host: addr.address };
    });
}

async function requestText(url, { method = 'GET', headers = {}, body } = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: `${u.pathname}${u.search}`,
            method,
            headers
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve({
                status: res.statusCode || 0,
                headers: res.headers || {},
                text: Buffer.concat(chunks).toString('utf-8')
            }));
        });
        req.on('error', reject);
        if (body !== undefined) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

test('openai-bridge GET /v1 returns local bridge status without probing upstream models', async () => {
    let upstreamHit = false;
    const upstream = http.createServer((req, res) => {
        upstreamHit = true;
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ msg: 'Not Found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const resp = await requestText(`http://127.0.0.1:${bridgePort}/bridge/openai/test/v1`, {
        headers: { Authorization: 'Bearer codexmate' }
    });
    assert.equal(resp.status, 200);
    assert.deepStrictEqual(JSON.parse(resp.text), {
        object: 'codexmate.openai_bridge',
        provider: 'test',
        status: 'ok',
        endpoints: ['/v1/responses', '/v1/models']
    });
    assert.equal(upstreamHit, false);

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge streams chat/completions directly when Responses client requests SSE', async () => {
    let responsesHit = false;
    let capturedChatRequest = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            responsesHit = true;
            // Simulate gateways that accept /responses but never produce a usable response.
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
                capturedChatRequest = JSON.parse(body || '{}');
                res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
                res.write('data: {"id":"chatcmpl_stream","model":"gpt-test","choices":[{"delta":{"role":"assistant"}}]}\n\n');
                res.write('data: {"id":"chatcmpl_stream","model":"gpt-test","choices":[{"delta":{"content":"hello"}}]}\n\n');
                res.write('data: {"id":"chatcmpl_stream","model":"gpt-test","choices":[{"delta":{"content":"-bridge"}}]}\n\n');
                res.end('data: [DONE]\n\n');
            });
            return;
        }
        if (req.url === '/v1/models' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ object: 'list', data: [] }));
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const base = `http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`;
    const sse = await requestText(base, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': 'Bearer codexmate'
        },
        body: {
            model: 'gpt-test',
            input: 'ping',
            stream: true
        }
    });
    assert.equal(sse.status, 200);
    assert.equal(responsesHit, false, 'streaming bridge should not block on upstream /responses probe');
    assert.ok(capturedChatRequest, 'streaming bridge should call upstream chat/completions');
    assert.equal(capturedChatRequest.stream, true);
    assert.match(sse.headers['content-type'], /text\/event-stream/i);
    assert.match(sse.text, /response\.output_item\.added/);
    assert.match(sse.text, /response\.output_text\.delta/);
    assert.match(sse.text, /"delta":"hello"/);
    assert.match(sse.text, /"delta":"-bridge"/);
    assert.match(sse.text, /event: response\.completed/);
    assert.match(sse.text, /data: \[DONE\]/);

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge omits upstream reasoning_content from output_text deltas', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
                res.write('data: {"id":"r1","model":"deepseek-v4","choices":[{"delta":{"reasoning_content":"thinking-"}}]}\n\n');
                res.write('data: {"id":"r1","model":"deepseek-v4","choices":[{"delta":{"reasoning_content":"step"}}]}\n\n');
                res.write('data: {"id":"r1","model":"deepseek-v4","choices":[{"delta":{"content":"answer"}}]}\n\n');
                res.end('data: [DONE]\n\n');
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const base = `http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`;
    const sse = await requestText(base, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': 'Bearer codexmate'
        },
        body: { model: 'deepseek-v4', input: 'ping', stream: true }
    });
    assert.equal(sse.status, 200);
    assert.doesNotMatch(sse.text, /"delta":"thinking-"/);
    assert.doesNotMatch(sse.text, /"delta":"step"/);
    assert.match(sse.text, /"delta":"answer"/);
    assert.match(sse.text, /"text":"answer"/);
    assert.match(sse.text, /data: \[DONE\]/);

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge completes Responses SSE when upstream chat stream closes after finish_reason without DONE', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
            res.write('data: {"id":"chatcmpl_stream","model":"gpt-test","choices":[{"delta":{"content":"answer"}}]}\n\n');
            res.write('data: {"id":"chatcmpl_stream","model":"gpt-test","choices":[{"delta":{},"finish_reason":"stop"}]}\n\n');
            res.end();
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const sse = await requestText(`http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': 'Bearer codexmate'
        },
        body: {
            model: 'gpt-test',
            input: 'ping',
            stream: true
        }
    });
    assert.equal(sse.status, 200);
    assert.match(sse.text, /response\.output_text\.delta/);
    assert.match(sse.text, /event: response\.completed/);
    assert.match(sse.text, /"output_text":"answer"/);
    assert.doesNotMatch(sse.text, /event: response\.failed/);
    assert.match(sse.text, /data: \[DONE\]/);

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge reports failed Responses SSE when upstream chat stream ends before DONE', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
            res.write('data: {"id":"chatcmpl_stream","model":"gpt-test","choices":[{"delta":{"content":"partial"}}]}\n\n');
            res.end();
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const sse = await requestText(`http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': 'Bearer codexmate'
        },
        body: {
            model: 'gpt-test',
            input: 'ping',
            stream: true
        }
    });
    assert.equal(sse.status, 200);
    assert.match(sse.text, /response\.output_text\.delta/);
    assert.match(sse.text, /event: response\.failed/);
    assert.match(sse.text, /upstream stream ended before \[DONE\]/);
    assert.doesNotMatch(sse.text, /event: response\.completed/);

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge returns JSON when stream requested but client does not accept event-stream', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: 'resp_upstream',
                model: 'gpt-test',
                output: [{
                    type: 'message',
                    role: 'assistant',
                    content: [{ type: 'output_text', text: 'hello-from-upstream' }]
                }]
            }));
            return;
        }
        if (req.url === '/v1/models' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ object: 'list', data: [] }));
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const base = `http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`;
    const resp = await requestText(base, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer codexmate'
        },
        body: {
            model: 'gpt-test',
            input: 'ping',
            stream: true
        }
    });
    assert.equal(resp.status, 200);
    assert.match(resp.headers['content-type'], /application\/json/i);
    const parsed = JSON.parse(resp.text);
    assert.equal(parsed.object, 'response');
    assert.equal(parsed.model, 'gpt-test');

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge allows loopback clients to send arbitrary Authorization headers', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: 'resp_upstream',
                model: 'gpt-test',
                output: [{
                    type: 'message',
                    role: 'assistant',
                    content: [{ type: 'output_text', text: 'hello-from-upstream' }]
                }]
            }));
            return;
        }
        if (req.url === '/v1/models' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ object: 'list', data: [] }));
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const url = `http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`;
    const resp = await requestText(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // 故意提供一个与 expectedToken 不同的 token；loopback 也应放行
            'Authorization': 'Bearer not-codexmate'
        },
        body: { model: 'gpt-test', input: 'ping', stream: false }
    });
    assert.equal(resp.status, 200);
    const parsed = JSON.parse(resp.text);
    assert.equal(parsed.object, 'response');
    assert.equal(parsed.model, 'gpt-test');

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge normalizes mixed tool definitions before upstream /responses', async () => {
    let capturedResponsesRequest = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
                capturedResponsesRequest = JSON.parse(body || '{}');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ id: 'resp_tool_normalized', model: 'gpt-test', output: [] }));
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const resp = await requestText(`http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer codexmate' },
        body: {
            model: 'gpt-test',
            input: 'ping',
            tools: [{
                type: 'function',
                name: 'lookup',
                function: {
                    description: 'Look up data',
                    parameters: { type: 'object', properties: { query: { type: 'string' } } }
                }
            }, {
                type: 'web_search_preview'
            }, {
                type: 'function',
                function: { description: 'missing name should be dropped' }
            }],
            stream: false
        }
    });
    assert.equal(resp.status, 200);
    assert.deepStrictEqual(capturedResponsesRequest.tools, [{
        type: 'function',
        name: 'lookup',
        description: 'Look up data',
        parameters: { type: 'object', properties: { query: { type: 'string' } } }
    }]);

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge falls back to chat when upstream /responses rejects tool function name', async () => {
    let capturedChatRequest = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: "'name' is a required property - 'tools.0.function'",
                    type: 'invalid_request_error',
                    param: '',
                    code: null
                }
            }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
                capturedChatRequest = JSON.parse(body || '{}');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: 'chatcmpl_tool_error_fallback',
                    model: 'gpt-test',
                    choices: [{ message: { role: 'assistant', content: 'hello-from-chat' } }]
                }));
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const resp = await requestText(`http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer codexmate' },
        body: {
            model: 'gpt-test',
            input: 'ping',
            tools: [{
                type: 'function',
                name: 'lookup',
                function: {
                    description: 'Look up data',
                    parameters: { type: 'object', properties: { query: { type: 'string' } } }
                }
            }, {
                type: 'web_search_preview'
            }, {
                type: 'function',
                function: { description: 'missing name should be dropped' }
            }],
            stream: false
        }
    });
    assert.equal(resp.status, 200);
    assert.deepStrictEqual(capturedChatRequest.tools, [{
        type: 'function',
        function: {
            name: 'lookup',
            parameters: { type: 'object', properties: { query: { type: 'string' } } },
            description: 'Look up data'
        }
    }]);

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge falls back to upstream /chat/completions when /responses is not supported', async () => {
    let capturedChatRequest = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
                const parsed = JSON.parse(body || '{}');
                capturedChatRequest = parsed;
                // 确保 responses 的 object input 能被转换为 chat messages
                assert.equal(parsed.messages && parsed.messages[0] && parsed.messages[0].role, 'user');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: 'chatcmpl_x',
                    model: 'gpt-test',
                    choices: [{ message: { role: 'assistant', content: 'hello-from-chat' } }]
                }));
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const url = `http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`;
    const resp = await requestText(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer codexmate'
        },
        body: {
            model: 'gpt-test',
            input: { type: 'input_text', text: 'ping' },
            tools: [{
                type: 'function',
                name: 'lookup',
                function: {
                    description: 'Look up data',
                    parameters: { type: 'object', properties: { query: { type: 'string' } } }
                }
            }, {
                type: 'web_search_preview'
            }, {
                type: 'function',
                function: { description: 'missing name should be dropped' }
            }],
            tool_choice: { type: 'function', name: 'lookup' },
            stream: false
        }
    });
    assert.equal(resp.status, 200);
    const parsed = JSON.parse(resp.text);
    assert.equal(parsed.object, 'response');
    assert.equal(parsed.model, 'gpt-test');
    assert.ok(Array.isArray(parsed.output));
    assert.deepStrictEqual(capturedChatRequest.tools, [{
        type: 'function',
        function: {
            name: 'lookup',
            parameters: { type: 'object', properties: { query: { type: 'string' } } },
            description: 'Look up data'
        }
    }]);
    assert.deepStrictEqual(capturedChatRequest.tool_choice, { type: 'function', function: { name: 'lookup' } });

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge falls back to /chat/completions when upstream /responses returns 500 not implemented', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: 'not implemented (request id: test)',
                    type: 'new_api_error',
                    param: '',
                    code: 'convert_request_failed'
                }
            }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: 'chatcmpl_x',
                model: 'gpt-test',
                choices: [{ message: { role: 'assistant', content: 'hello-from-chat' } }]
            }));
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const url = `http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`;
    const resp = await requestText(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer codexmate'
        },
        body: {
            model: 'gpt-test',
            input: 'ping',
            stream: false
        }
    });
    assert.equal(resp.status, 200);
    const parsed = JSON.parse(resp.text);
    assert.equal(parsed.object, 'response');

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge falls back to /chat/completions when upstream /responses returns 400 unknown endpoint', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: {
                    message: 'Unknown endpoint: POST /v1/responses',
                    type: 'invalid_request_error',
                    code: 'unknown_endpoint'
                }
            }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: 'chatcmpl_x',
                model: 'gpt-test',
                choices: [{ message: { role: 'assistant', content: 'hello-from-chat' } }]
            }));
            return;
        }
        if (req.url === '/v1/models' && req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ object: 'list', data: [] }));
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const url = `http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`;
    const resp = await requestText(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer codexmate'
        },
        body: {
            model: 'gpt-test',
            input: 'ping',
            stream: false
        }
    });
    assert.equal(resp.status, 200);
    const parsed = JSON.parse(resp.text);
    assert.equal(parsed.object, 'response');
    assert.equal(parsed.model, 'gpt-test');
    assert.ok(Array.isArray(parsed.output));

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge merges codex developer-role AGENTS.md into a single leading system message', async () => {
    let capturedChatRequest = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses') {
            // 模拟上游接受 /responses 但不可用，强制走 fallback。
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'not implemented' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
                capturedChatRequest = JSON.parse(body || '{}');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: 'chatcmpl_dev',
                    model: 'gpt-test',
                    choices: [{ message: { role: 'assistant', content: 'ok' } }]
                }));
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const url = `http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`;
    const resp = await requestText(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer codexmate' },
        body: {
            model: 'gpt-test',
            instructions: 'codex-base-prompt',
            input: [
                { role: 'developer', content: [{ type: 'input_text', text: 'MISAKA_TOKEN_XYZ from AGENTS.md' }] },
                { role: 'user', content: [{ type: 'input_text', text: 'hi there' }] }
            ],
            stream: false
        }
    });

    assert.equal(resp.status, 200);
    assert.ok(capturedChatRequest, 'fallback should hit chat/completions');
    const msgs = capturedChatRequest.messages;
    assert.ok(Array.isArray(msgs) && msgs.length >= 2, 'should produce system + user');
    assert.equal(msgs[0].role, 'system', 'first message must be system');
    assert.match(msgs[0].content, /codex-base-prompt/);
    assert.match(msgs[0].content, /MISAKA_TOKEN_XYZ from AGENTS\.md/);
    const systemCount = msgs.filter((m) => m && m.role === 'system').length;
    assert.equal(systemCount, 1, 'multiple system sources must be merged into one');
    const devLeak = msgs.find((m) => m && m.role !== 'system' && typeof m.content === 'string' && /MISAKA_TOKEN_XYZ/.test(m.content));
    assert.equal(devLeak, undefined, 'AGENTS.md must not leak into user/assistant role');
    const userMsg = msgs.find((m) => m && m.role === 'user');
    assert.ok(userMsg, 'user message preserved');

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge SSE fast path also merges developer-role AGENTS.md into leading system', async () => {
    let capturedChatRequest = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
                capturedChatRequest = JSON.parse(body || '{}');
                res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
                res.write('data: {"id":"x","model":"gpt-test","choices":[{"delta":{"content":"ok"}}]}\n\n');
                res.end('data: [DONE]\n\n');
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);

    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-bridge-test-'));
    const settingsFile = path.join(tmpDir, 'bridge.json');
    await writeFile(settingsFile, JSON.stringify({
        version: 1,
        providers: {
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'sk-upstream' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate' });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port: bridgePort } = await listen(bridge);

    const url = `http://127.0.0.1:${bridgePort}/bridge/openai/test/v1/responses`;
    await requestText(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
            'Authorization': 'Bearer codexmate'
        },
        body: {
            model: 'gpt-test',
            instructions: 'codex-base-prompt',
            input: [
                { role: 'developer', content: [{ type: 'input_text', text: 'AGENTS_MARK_STREAM' }] },
                { role: 'user', content: [{ type: 'input_text', text: 'hi' }] }
            ],
            stream: true
        }
    });

    assert.ok(capturedChatRequest, 'fast path should call chat/completions');
    const msgs = capturedChatRequest.messages;
    assert.equal(msgs[0].role, 'system');
    assert.match(msgs[0].content, /codex-base-prompt/);
    assert.match(msgs[0].content, /AGENTS_MARK_STREAM/);
    const leak = msgs.find((m) => m && m.role !== 'system' && typeof m.content === 'string' && /AGENTS_MARK_STREAM/.test(m.content));
    assert.equal(leak, undefined, 'developer content must not leak into non-system role');

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});
