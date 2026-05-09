import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const fs = require('fs');
const { createBuiltinProxyRuntimeController } = require('../../cli/builtin-proxy.js');
const test = typeof globalThis.test === 'function' ? globalThis.test : nodeTest;

function listen(server) {
    server.listen(0, '127.0.0.1');
    return once(server, 'listening').then(() => {
        const addr = server.address();
        return { port: addr.port, host: addr.address };
    });
}

async function closeServer(server, sockets = null) {
    if (!server || !server.listening) return;
    await new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
        };
        server.close(() => finish());
        const timer = setTimeout(() => {
            if (sockets && typeof sockets[Symbol.iterator] === 'function') {
                for (const socket of sockets) {
                    try { socket.destroy(); } catch (_) {}
                }
            }
            if (typeof server.closeIdleConnections === 'function') {
                try { server.closeIdleConnections(); } catch (_) {}
            }
            if (typeof server.closeAllConnections === 'function') {
                try { server.closeAllConnections(); } catch (_) {}
            }
            finish();
        }, 1000);
        if (typeof timer.unref === 'function') timer.unref();
    });
}

function requestText(url, { method = 'GET', headers = {}, body } = {}) {
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

function createTestController() {
    const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
    return createBuiltinProxyRuntimeController({
        fs,
        https,
        CONFIG_FILE: path.join(os.tmpdir(), 'codexmate-test-config.toml'),
        BUILTIN_PROXY_SETTINGS_FILE: path.join(os.tmpdir(), 'codexmate-test-proxy.json'),
        DEFAULT_BUILTIN_PROXY_SETTINGS: {
            enabled: true,
            host: '127.0.0.1',
            port: 0,
            provider: '',
            authSource: 'none',
            timeoutMs: 2000
        },
        BUILTIN_PROXY_PROVIDER_NAME: 'codexmate-proxy',
        CODEXMATE_MANAGED_MARKER: 'codexmate-managed',
        HTTP_KEEP_ALIVE_AGENT: new http.Agent({ keepAlive: false }),
        HTTPS_KEEP_ALIVE_AGENT: new https.Agent({ keepAlive: false }),
        readConfig: () => ({}),
        writeConfig: () => {},
        readConfigOrVirtualDefault: () => ({ config: {}, isVirtual: false }),
        resolveAuthTokenFromCurrentProfile: () => '',
        isPlainObject,
        isBuiltinManagedProvider: (name) => name === 'codexmate-proxy',
        findProviderSectionRanges: () => [],
        findProviderDescendantSectionRanges: () => [],
        normalizeLegacySegments: (segments) => (Array.isArray(segments) ? segments : []),
        buildLegacySegmentsKey: (segments) => (Array.isArray(segments) ? segments.join('.') : ''),
        formatHostForUrl: (host) => host
    });
}

async function startTestProxy(upstreamPort, options = {}) {
    const controller = createTestController();
    const runtime = await controller.createBuiltinProxyServer(
        { host: '127.0.0.1', port: 0, timeoutMs: options.timeoutMs || 2000 },
        {
            providerName: options.providerName || 'test',
            baseUrl: options.baseUrl || `http://127.0.0.1:${upstreamPort}/v1`,
            authHeader: options.authHeader || ''
        }
    );
    return runtime;
}

test('builtin-proxy /v1/responses falls back to chat-only upstream and returns Responses JSON', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'not found' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: 'chatcmpl_test',
                model: 'gpt-test',
                choices: [{ message: { role: 'assistant', content: 'hello-from-chat' } }],
                usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
            }));
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);
    let proxyRuntime = null;

    try {
        proxyRuntime = await startTestProxy(upstreamPort);
        const proxyPort = proxyRuntime.server.address().port;
        const resp = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { model: 'gpt-test', input: { type: 'input_text', text: 'ping' }, stream: false }
        });
        assert.equal(resp.status, 200);
        const parsed = JSON.parse(resp.text);
        assert.equal(parsed.object, 'response');
        assert.equal(parsed.model, 'gpt-test');
        assert.ok(Array.isArray(parsed.output));
        assert.equal(parsed.output[0].type, 'message');
        assert.equal(parsed.output[0].content[0].type, 'output_text');
        assert.equal(parsed.output[0].content[0].text, 'hello-from-chat');
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

test('builtin-proxy /v1/responses falls back to chat when upstream responses times out', async () => {
    const sockets = new Set();
    let capturedChatRequest = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            // Simulate gateways that accept /responses but never complete the request.
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => {
                capturedChatRequest = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: 'chatcmpl_after_timeout',
                    model: 'gpt-test',
                    choices: [{ message: { role: 'assistant', content: 'fallback-after-timeout' } }]
                }));
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    upstream.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });
    const { port: upstreamPort } = await listen(upstream);
    let proxyRuntime = null;

    try {
        proxyRuntime = await startTestProxy(upstreamPort, { timeoutMs: 1000 });
        const proxyPort = proxyRuntime.server.address().port;
        const resp = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { model: 'gpt-test', input: 'ping', stream: false }
        });
        assert.equal(resp.status, 200);
        assert.ok(capturedChatRequest, 'chat fallback should run after responses timeout');
        assert.equal(capturedChatRequest.stream, false);
        const parsed = JSON.parse(resp.text);
        assert.equal(parsed.output[0].content[0].text, 'fallback-after-timeout');
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream, sockets);
    }
});

test('builtin-proxy /v1/responses stream=true streams chat fallback as Responses SSE', async () => {
    let capturedChatRequest = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => {
                capturedChatRequest = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
                res.write('data: {"id":"chatcmpl_stream","model":"gpt-test","choices":[{"delta":{"role":"assistant"}}]}\n\n');
                res.write('data: {"id":"chatcmpl_stream","model":"gpt-test","choices":[{"delta":{"content":"hello"}}]}\n\n');
                res.write('data: {"id":"chatcmpl_stream","model":"gpt-test","choices":[{"delta":{"content":"-stream"}}]}\n\n');
                res.end('data: [DONE]\n\n');
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);
    let proxyRuntime = null;

    try {
        proxyRuntime = await startTestProxy(upstreamPort);
        const proxyPort = proxyRuntime.server.address().port;
        const sse = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { model: 'gpt-test', input: 'ping', stream: true }
        });
        assert.equal(sse.status, 200);
        assert.ok(capturedChatRequest, 'streaming chat fallback should be called');
        assert.equal(capturedChatRequest.stream, true);
        assert.match(sse.headers['content-type'], /text\/event-stream/i);
        assert.match(sse.text, /event: response\.created/);
        assert.match(sse.text, /event: response\.output_text\.delta/);
        assert.match(sse.text, /"delta":"hello"/);
        assert.match(sse.text, /"delta":"-stream"/);
        assert.match(sse.text, /event: response\.completed/);
        assert.match(sse.text, /data: \[DONE\]/);
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

test('builtin-proxy /v1/responses stream=true returns SSE wrapper with done sentinel', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method Not Allowed' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: 'chatcmpl_test',
                model: 'gpt-test',
                choices: [{ message: { role: 'assistant', content: 'hello-from-chat' } }]
            }));
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);
    let proxyRuntime = null;

    try {
        proxyRuntime = await startTestProxy(upstreamPort);
        const proxyPort = proxyRuntime.server.address().port;
        const sse = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { model: 'gpt-test', input: 'ping', stream: true }
        });
        assert.equal(sse.status, 200);
        assert.match(sse.headers['content-type'], /text\/event-stream/i);
        assert.match(sse.text, /event: response\.output_text\.delta/);
        assert.match(sse.text, /event: response\.completed/);
        assert.match(sse.text, /data: \[DONE\]/);
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

test('builtin-proxy /v1/responses preserves Voyage chat-completions fields through fallback', async () => {
    let capturedChatRequest = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/voyage/api/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/voyage/api/chat/completions' && req.method === 'POST') {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => {
                capturedChatRequest = {
                    authorization: req.headers.authorization,
                    contentType: req.headers['content-type'],
                    proxyHeader: req.headers['x-codexmate-proxy'],
                    body: JSON.parse(Buffer.concat(chunks).toString('utf-8'))
                };
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: 'chatcmpl_voyage_test',
                    model: 'DeepSeek-V4-pro',
                    choices: [{ message: { role: 'assistant', content: 'voyage-ok' } }],
                    usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 }
                }));
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);
    let proxyRuntime = null;

    try {
        proxyRuntime = await startTestProxy(upstreamPort, {
            providerName: 'voyage',
            baseUrl: `http://127.0.0.1:${upstreamPort}/voyage/api`,
            authHeader: 'Bearer test-voyage-key'
        });
        const proxyPort = proxyRuntime.server.address().port;
        const resp = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
                input: [
                    { content: 'You are a helpful assistant', role: 'system' },
                    { content: 'Hi', role: 'user' }
                ],
                model: 'DeepSeek-V4-pro',
                frequency_penalty: 0,
                max_output_tokens: 2048,
                presence_penalty: 0,
                response_format: { type: 'text' },
                stop: null,
                stream: false,
                stream_options: null,
                temperature: 1,
                top_p: 1,
                tools: null,
                tool_choice: 'none',
                logprobs: false,
                top_logprobs: 3,
                kbs: [],
                is_online: false
            }
        });

        assert.equal(resp.status, 200);
        const parsed = JSON.parse(resp.text);
        assert.equal(parsed.object, 'response');
        assert.equal(parsed.model, 'DeepSeek-V4-pro');
        assert.equal(parsed.output[0].content[0].text, 'voyage-ok');

        assert.ok(capturedChatRequest, 'upstream chat completions request should be captured');
        assert.equal(capturedChatRequest.authorization, 'Bearer test-voyage-key');
        assert.equal(capturedChatRequest.proxyHeader, '1');
        assert.match(capturedChatRequest.contentType, /application\/json/i);
        assert.deepStrictEqual(capturedChatRequest.body, {
            model: 'DeepSeek-V4-pro',
            messages: [
                { role: 'system', content: 'You are a helpful assistant' },
                { role: 'user', content: 'Hi' }
            ],
            stream: false,
            frequency_penalty: 0,
            presence_penalty: 0,
            response_format: { type: 'text' },
            stop: null,
            temperature: 1,
            top_p: 1,
            tools: null,
            tool_choice: 'none',
            logprobs: false,
            top_logprobs: 3,
            kbs: [],
            is_online: false,
            max_tokens: 2048
        });
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

test('builtin-proxy /v1/responses maps Responses tool items through chat fallback', async () => {
    let capturedChatRequest = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => {
                capturedChatRequest = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    id: 'chatcmpl_tool_test',
                    model: 'gpt-tool',
                    choices: [{
                        finish_reason: 'tool_calls',
                        message: {
                            role: 'assistant',
                            content: '',
                            tool_calls: [{
                                id: 'call_next',
                                type: 'function',
                                function: { name: 'next_step', arguments: '{"ok":true}' }
                            }]
                        }
                    }],
                    usage: {
                        prompt_tokens: 11,
                        completion_tokens: 5,
                        total_tokens: 16,
                        prompt_tokens_details: { cached_tokens: 2 }
                    }
                }));
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);
    let proxyRuntime = null;

    try {
        proxyRuntime = await startTestProxy(upstreamPort);
        const proxyPort = proxyRuntime.server.address().port;
        const resp = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
                model: 'gpt-tool',
                input: [
                    {
                        type: 'message',
                        role: 'user',
                        content: [{ type: 'input_text', text: 'call lookup' }]
                    },
                    {
                        type: 'function_call',
                        call_id: 'call_lookup',
                        name: 'lookup',
                        arguments: { query: 'codexmate' }
                    },
                    {
                        type: 'function_call_output',
                        call_id: 'call_lookup',
                        output: { result: 'found' }
                    }
                ],
                tools: [{
                    type: 'function',
                    name: 'lookup',
                    function: {
                        description: 'Look up data',
                        parameters: { type: 'object', properties: { query: { type: 'string' } } }
                    }
                }],
                tool_choice: { type: 'function', name: 'lookup' },
                max_output_tokens: 128,
                stream: false
            }
        });

        assert.equal(resp.status, 200);
        assert.deepStrictEqual(capturedChatRequest.messages, [
            { role: 'user', content: [{ type: 'text', text: 'call lookup' }] },
            {
                role: 'assistant',
                content: null,
                tool_calls: [{
                    id: 'call_lookup',
                    type: 'function',
                    function: { name: 'lookup', arguments: '{"query":"codexmate"}' }
                }]
            },
            { role: 'tool', tool_call_id: 'call_lookup', content: '{"result":"found"}' }
        ]);
        assert.deepStrictEqual(capturedChatRequest.tools, [{
            type: 'function',
            function: {
                name: 'lookup',
                description: 'Look up data',
                parameters: { type: 'object', properties: { query: { type: 'string' } } }
            }
        }]);
        assert.deepStrictEqual(capturedChatRequest.tool_choice, { type: 'function', function: { name: 'lookup' } });
        assert.equal(capturedChatRequest.max_tokens, 128);

        const parsed = JSON.parse(resp.text);
        assert.equal(parsed.status, 'completed');
        assert.deepStrictEqual(parsed.output, [{
            type: 'function_call',
            call_id: 'call_next',
            name: 'next_step',
            arguments: '{"ok":true}'
        }]);
        assert.deepStrictEqual(parsed.usage, {
            input_tokens: 11,
            output_tokens: 5,
            total_tokens: 16,
            input_tokens_details: { cached_tokens: 2 }
        });
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

test('builtin-proxy /v1/responses stream=true emits response.failed when upstream stream aborts mid-flight', async () => {
    const sockets = new Set();
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            const chunks = [];
            req.on('data', (chunk) => chunks.push(chunk));
            req.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
                res.write('data: {"id":"chatcmpl_partial","model":"gpt-test","choices":[{"delta":{"role":"assistant"}}]}\n\n');
                res.write('data: {"id":"chatcmpl_partial","model":"gpt-test","choices":[{"delta":{"content":"partial"}}]}\n\n');
                setTimeout(() => {
                    try { req.socket.destroy(); } catch (_) {}
                }, 30);
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    upstream.on('connection', (socket) => {
        sockets.add(socket);
        socket.on('close', () => sockets.delete(socket));
    });
    const { port: upstreamPort } = await listen(upstream);
    let proxyRuntime = null;

    try {
        proxyRuntime = await startTestProxy(upstreamPort);
        const proxyPort = proxyRuntime.server.address().port;
        const sse = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { model: 'gpt-test', input: 'ping', stream: true }
        });
        assert.equal(sse.status, 200);
        assert.match(sse.headers['content-type'], /text\/event-stream/i);
        assert.match(sse.text, /event: response\.created/);
        assert.match(sse.text, /"delta":"partial"/);
        assert.match(sse.text, /event: response\.failed/);
        assert.match(sse.text, /data: \[DONE\]/);
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream, sockets);
    }
});

test('builtin-proxy /v1/responses retries upstream after a transient connection reset', async () => {
    let connectionCount = 0;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            connectionCount += 1;
            if (connectionCount === 1) {
                try { req.socket.destroy(); } catch (_) {}
                return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: 'chatcmpl_after_reset',
                model: 'gpt-test',
                choices: [{ message: { role: 'assistant', content: 'recovered' } }]
            }));
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);
    let proxyRuntime = null;

    try {
        proxyRuntime = await startTestProxy(upstreamPort);
        const proxyPort = proxyRuntime.server.address().port;
        const resp = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { model: 'gpt-test', input: 'ping', stream: false }
        });
        assert.equal(resp.status, 200);
        assert.ok(connectionCount >= 2, 'transient reset should be retried');
        const parsed = JSON.parse(resp.text);
        assert.equal(parsed.output[0].content[0].text, 'recovered');
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});
