import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
    createOpenaiBridgeHttpHandler,
    convertResponsesRequestToChatCompletions,
    buildResponsesPayloadFromChatResult
} = require('../../cli/openai-bridge.js');

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

test('openai-bridge keeps streaming Codex requests on upstream Responses before chat fallback', async () => {
    let responsesHit = false;
    let chatHit = false;
    let capturedResponsesHeaders = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            responsesHit = true;
            capturedResponsesHeaders = req.headers;
            // A hanging Responses endpoint is not proof that Responses is unsupported.
            // Do not silently route Codex-only requests into chat/completions.
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            chatHit = true;
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
            res.end('data: [DONE]\n\n');
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

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate', streamTimeoutMs: 1000 });
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
            'Authorization': 'Bearer codexmate',
            'Originator': 'codex-tui'
        },
        body: {
            model: 'gpt-test',
            input: 'ping',
            stream: true
        }
    });
    assert.equal(sse.status, 502);
    assert.equal(responsesHit, true, 'streaming bridge should call upstream /responses first');
    assert.equal(chatHit, false, 'hanging Responses should not fall back to chat/completions');
    assert.match(capturedResponsesHeaders['user-agent'] || '', /^codex_cli_rs\//);
    assert.equal(capturedResponsesHeaders.version, '0.98.0');
    assert.equal(capturedResponsesHeaders['openai-beta'], 'responses=experimental');
    assert.equal(capturedResponsesHeaders.originator, 'codex_cli_rs');
    assert.match(sse.headers['content-type'], /application\/json/i);
    assert.match(sse.text, /timeout/);

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge streams upstream Responses SSE with Codex identity headers', async () => {
    let capturedResponsesHeaders = null;
    let chatHit = false;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            capturedResponsesHeaders = req.headers;
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
            res.write('event: response.created\n');
            res.write('data: {"type":"response.created","response":{"id":"resp_test","model":"gpt-test"}}\n\n');
            res.write('event: response.completed\n');
            res.write('data: {"type":"response.completed","response":{"id":"resp_test","model":"gpt-test","output":[]}}\n\n');
            res.end('data: [DONE]\n\n');
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            chatHit = true;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
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
            'Authorization': 'Bearer codexmate',
            'Originator': 'codex-tui'
        },
        body: { model: 'gpt-test', input: 'ping', stream: true }
    });

    assert.equal(sse.status, 200);
    assert.equal(chatHit, false, 'successful upstream Responses stream should not call chat/completions');
    assert.ok(capturedResponsesHeaders, 'upstream Responses request should be captured');
    assert.match(capturedResponsesHeaders['user-agent'] || '', /^codex_cli_rs\//);
    assert.equal(capturedResponsesHeaders.version, '0.98.0');
    assert.equal(capturedResponsesHeaders['openai-beta'], 'responses=experimental');
    assert.equal(capturedResponsesHeaders.originator, 'codex_cli_rs');
    assert.match(sse.headers['content-type'], /text\/event-stream/i);
    assert.match(sse.text, /response\.created/);
    assert.match(sse.text, /response\.completed/);

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge fails accepted upstream Responses SSE when stream goes idle', async () => {
    let responsesHit = false;
    let chatHit = false;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            responsesHit = true;
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
            if (typeof res.flushHeaders === 'function') res.flushHeaders();
            // Keep the connection open without data; the bridge must not hang forever.
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            chatHit = true;
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
            res.end('data: [DONE]\n\n');
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
            test: { baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: '***' }
        }
    }), 'utf-8');

    const handler = createOpenaiBridgeHttpHandler({ settingsFile, expectedToken: 'codexmate', streamTimeoutMs: 1000 });
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
        body: { model: 'gpt-test', input: 'ping', stream: true }
    });

    assert.equal(sse.status, 200);
    assert.equal(responsesHit, true, 'upstream Responses SSE should be attempted');
    assert.equal(chatHit, false, 'accepted but idle Responses SSE should not fall back to chat/completions');
    assert.match(sse.headers['content-type'], /text\/event-stream/i);
    assert.match(sse.text, /response\.failed/);
    assert.match(sse.text, /upstream stream idle timeout/);
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
    assert.match(sse.text, /event: response\.reasoning_summary_text\.delta/);
    assert.match(sse.text, /"delta":"thinking-"/);
    assert.match(sse.text, /"delta":"step"/);
    const outputTextLines = sse.text.split('\n').filter((line) => line.includes('response.output_text'));
    assert.equal(outputTextLines.some((line) => line.includes('thinking-') || line.includes('step')), false);
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

test('openai-bridge skips /v1/responses probe after upstream marks it unsupported', async () => {
    let responsesHits = 0;
    let chatHits = 0;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            responsesHits += 1;
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'Unknown endpoint', code: 'unknown_endpoint' } }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            chatHits += 1;
            let body = '';
            req.on('data', (c) => (body += c));
            req.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: 'cc_x',
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
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer codexmate' };
    const body = { model: 'gpt-test', input: 'ping', stream: false };

    const first = await requestText(url, { method: 'POST', headers, body });
    assert.equal(first.status, 200);
    assert.equal(responsesHits, 1, 'first call should probe /v1/responses');
    assert.equal(chatHits, 1, 'first call should fall back to chat/completions');

    const second = await requestText(url, { method: 'POST', headers, body });
    assert.equal(second.status, 200);
    assert.equal(responsesHits, 1, 'second call should skip /v1/responses probe (cache hit)');
    assert.equal(chatHits, 2, 'second call should go directly to chat/completions');

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});

test('openai-bridge preserves multibyte UTF-8 deltas split across chunk boundaries', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
            const fullEvent = 'data: {"id":"x","model":"gpt-test","choices":[{"delta":{"content":"御坂"}}]}\n\n';
            const fullBytes = Buffer.from(fullEvent, 'utf-8');
            // 御 (U+5FA1) 占 3 字节，从偏移 67 起；故意在 68 处切——切到 "御" 中间。
            const splitAt = fullBytes.indexOf(Buffer.from('御', 'utf-8')) + 1;
            const firstHalf = fullBytes.slice(0, splitAt);
            const secondHalf = fullBytes.slice(splitAt);
            res.write(firstHalf);
            setTimeout(() => {
                res.write(secondHalf);
                res.end('data: [DONE]\n\n');
            }, 10);
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
        body: { model: 'gpt-test', input: 'ping', stream: true }
    });
    assert.equal(sse.status, 200);
    assert.match(sse.text, /"delta":"御坂"/);
    assert.doesNotMatch(sse.text, /�/);

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});


test('openai-bridge converts Codex Responses tool history for chat fallback', () => {
    const converted = convertResponsesRequestToChatCompletions({
        model: 'gpt-test',
        input: [
            { role: 'developer', content: [{ type: 'input_text', text: 'agent rules' }] },
            { role: 'user', content: [{ type: 'input_text', text: 'run a slow task' }] },
            { type: 'custom_tool_call', call_id: 'call_patch', name: 'apply_patch', input: '*** Begin Patch\n*** End Patch' },
            { type: 'custom_tool_call_output', call_id: 'call_patch', output: { ok: true } },
            { type: 'mcp_tool_call', call_id: 'call_lookup', server_label: 'lookup', arguments: { query: 'status' } },
            { type: 'mcp_tool_call_output', call_id: 'call_lookup', output: [{ text: 'green' }] },
            { type: 'local_shell_call', call_id: 'call_shell', action: { cmd: 'sleep 20 && echo done' } },
            { type: 'local_shell_call_output', call_id: 'call_shell', output: 'done\n' },
            { type: 'local_shell_call_output', call_id: 'orphaned', output: 'must be dropped' }
        ],
        tools: [
            { type: 'custom_tool', name: 'apply_patch' },
            { type: 'local_shell', name: 'local_shell' },
            { type: 'namespace', tools: [{ type: 'function', name: 'lookup', parameters: { type: 'object' } }] },
            { type: 'image_generation' }
        ],
        tool_choice: { type: 'local_shell', name: 'local_shell' },
        stream: true
    });

    assert.equal(converted.error, undefined);
    assert.equal(converted.streamRequested, true);
    assert.equal(converted.chat.messages[0].role, 'system');
    assert.match(converted.chat.messages[0].content, /agent rules/);
    const toolMessages = converted.chat.messages.filter((msg) => msg.role === 'tool');
    assert.deepStrictEqual(toolMessages.map((msg) => msg.tool_call_id), ['call_patch', 'call_lookup', 'call_shell']);
    assert.equal(toolMessages.some((msg) => /orphaned/.test(msg.content)), false);

    const assistantToolMessages = converted.chat.messages.filter((msg) => Array.isArray(msg.tool_calls));
    assert.equal(assistantToolMessages.length, 3);
    assert.deepStrictEqual(
        assistantToolMessages.flatMap((msg) => msg.tool_calls.map((call) => call.function.name)),
        ['apply_patch', 'lookup', 'local_shell']
    );
    assert.deepStrictEqual(converted.chat.tools.map((tool) => tool.function.name), ['apply_patch', 'local_shell', 'lookup']);
    assert.deepStrictEqual(converted.chat.tool_choice, { type: 'function', function: { name: 'local_shell' } });
});

test('openai-bridge prunes invalid tool_choice after dropping hosted-only Responses tools', () => {
    const converted = convertResponsesRequestToChatCompletions({
        model: 'gpt-test',
        input: 'draw a cat',
        tools: [{ type: 'image_generation', name: 'image_generation' }],
        tool_choice: { type: 'function', name: 'image_generation' },
        stream: false
    });

    assert.equal(converted.error, undefined);
    assert.equal(Object.prototype.hasOwnProperty.call(converted.chat, 'tools'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(converted.chat, 'tool_choice'), false);
});

test('openai-bridge restores Codex built-in tool call types from chat fallback results', () => {
    const converted = convertResponsesRequestToChatCompletions({
        model: 'gpt-test',
        input: 'use tools',
        tools: [
            { type: 'custom_tool', name: 'apply_patch' },
            { type: 'local_shell', name: 'local_shell' },
            { type: 'function', name: 'lookup', parameters: { type: 'object' } }
        ]
    });

    assert.equal(converted.error, undefined);
    const payload = buildResponsesPayloadFromChatResult('gpt-test', '', [
        { id: 'call_patch', type: 'function', function: { name: 'apply_patch', arguments: '{"input":"*** Begin Patch\\n*** End Patch"}' } },
        { id: 'call_shell', type: 'function', function: { name: 'local_shell', arguments: '{"cmd":"pwd","yield_time_ms":1000}' } },
        { id: 'call_lookup', type: 'function', function: { name: 'lookup', arguments: '{"q":"codexmate"}' } }
    ], { usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 } }, {
        toolTypesByName: converted.toolTypesByName
    });

    assert.deepStrictEqual(payload.output, [
        {
            type: 'custom_tool_call',
            call_id: 'call_patch',
            name: 'apply_patch',
            input: '*** Begin Patch\n*** End Patch'
        },
        {
            type: 'local_shell_call',
            call_id: 'call_shell',
            name: 'local_shell',
            action: { cmd: 'pwd', yield_time_ms: 1000 }
        },
        {
            type: 'function_call',
            call_id: 'call_lookup',
            name: 'lookup',
            arguments: '{"q":"codexmate"}'
        }
    ]);
});

test('openai-bridge preserves explicit function tools named apply_patch', () => {
    const converted = convertResponsesRequestToChatCompletions({
        model: 'gpt-test',
        input: 'call function apply_patch',
        tools: [
            {
                type: 'function',
                name: 'apply_patch',
                description: 'Apply a structured patch.',
                parameters: {
                    type: 'object',
                    properties: { diff: { type: 'string' } },
                    required: ['diff'],
                    additionalProperties: false
                }
            }
        ]
    });

    assert.equal(converted.error, undefined);
    assert.deepStrictEqual(converted.toolTypesByName, { apply_patch: 'function_call' });

    const payload = buildResponsesPayloadFromChatResult('gpt-test', '', [
        { id: 'call_patch_fn', type: 'function', function: { name: 'apply_patch', arguments: '{"diff":"*** Begin Patch\\n*** End Patch"}' } }
    ], {}, {
        toolTypesByName: converted.toolTypesByName
    });

    assert.deepStrictEqual(payload.output, [
        {
            type: 'function_call',
            call_id: 'call_patch_fn',
            name: 'apply_patch',
            arguments: '{"diff":"*** Begin Patch\\n*** End Patch"}'
        }
    ]);
});

test('openai-bridge tells chat fallback to poll running Codex exec sessions', () => {
    const converted = convertResponsesRequestToChatCompletions({
        model: 'gpt-test',
        input: [
            { role: 'user', content: [{ type: 'input_text', text: 'run slow command' }] },
            { type: 'function_call', call_id: 'call_slow', name: 'exec_command', arguments: '{"cmd":"sleep 20"}' },
            {
                type: 'function_call_output',
                call_id: 'call_slow',
                output: 'Chunk ID: abc\nWall time: 1.001 seconds\nProcess running with session ID 78313\nOutput:\n'
            }
        ],
        tools: [
            { type: 'function', name: 'exec_command', parameters: { type: 'object' } },
            { type: 'function', name: 'write_stdin', parameters: { type: 'object' } }
        ],
        stream: true
    });

    assert.equal(converted.error, undefined);
    assert.equal(converted.chat.messages[0].role, 'system');
    assert.match(converted.chat.messages[0].content, /write_stdin/);
    assert.match(converted.chat.messages[0].content, /session_id/);
    assert.match(converted.chat.messages[0].content, /Do not merely say that you are waiting/);
});

test('openai-bridge converts empty probes, empty tool output, and reasoning effort for chat fallback', () => {
    const emptyProbe = convertResponsesRequestToChatCompletions({
        model: 'gpt-test',
        input: [],
        reasoning: { effort: 'high' },
        stream: false
    });

    assert.equal(emptyProbe.error, undefined);
    assert.deepStrictEqual(emptyProbe.chat.messages, [{ role: 'user', content: '' }]);
    assert.equal(emptyProbe.chat.reasoning_effort, 'high');

    const withEmptyToolOutput = convertResponsesRequestToChatCompletions({
        model: 'gpt-test',
        input: [
            { type: 'function_call', call_id: 'call_empty', name: 'lookup', arguments: {} },
            { type: 'function_call_output', call_id: 'call_empty', output: '' }
        ],
        reasoning_effort: 'medium',
        stream: false
    });

    assert.equal(withEmptyToolOutput.error, undefined);
    assert.equal(withEmptyToolOutput.chat.reasoning_effort, 'medium');
    assert.deepStrictEqual(withEmptyToolOutput.chat.messages, [
        {
            role: 'assistant',
            content: null,
            tool_calls: [{
                id: 'call_empty',
                type: 'function',
                function: { name: 'lookup', arguments: '{}' }
            }]
        },
        { role: 'tool', tool_call_id: 'call_empty', content: '(empty)' }
    ]);
});

test('openai-bridge marks finish_reason length as incomplete Responses payload', () => {
    const payload = buildResponsesPayloadFromChatResult('gpt-test', '', [], {
        choices: [{ finish_reason: 'length', message: { role: 'assistant', content: '' } }],
        usage: { prompt_tokens: 3, completion_tokens: 7, total_tokens: 10 }
    });

    assert.equal(payload.status, 'incomplete');
    assert.deepStrictEqual(payload.incomplete_details, { reason: 'max_output_tokens' });
    assert.deepStrictEqual(payload.output, []);
    assert.equal(payload.output_text, '');
    assert.deepStrictEqual(payload.usage, { input_tokens: 3, output_tokens: 7, total_tokens: 10 });
});

test('openai-bridge adds encrypted reasoning include when proxying upstream Responses', async () => {
    let capturedRequest = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => {
                capturedRequest = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ id: 'resp_reasoning', model: 'gpt-test', output: [] }));
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
            input: 'think privately',
            reasoning: { effort: 'high' },
            include: ['file_search_call.results'],
            stream: false
        }
    });

    assert.equal(resp.status, 200);
    assert.ok(capturedRequest, 'upstream Responses request should be captured');
    assert.equal(capturedRequest.stream, false);
    assert.deepStrictEqual(capturedRequest.reasoning, { effort: 'high' });
    assert.deepStrictEqual(capturedRequest.include, ['file_search_call.results', 'reasoning.encrypted_content']);

    await bridge.close();
    await upstream.close();
    await rm(tmpDir, { recursive: true, force: true });
});
