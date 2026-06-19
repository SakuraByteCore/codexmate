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

function createNestedNamespace(depth, leafTool) {
    let current = leafTool;
    for (let i = 0; i < depth; i += 1) {
        current = { type: 'namespace', tools: [current] };
    }
    return current;
}

test('builtin-proxy /v1/responses sends Codex client identity upstream', async () => {
    let capturedHeaders = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            capturedHeaders = req.headers;
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ id: 'resp_test', model: 'gpt-5', output: [] }));
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });

    let proxyRuntime;
    try {
        const { port: upstreamPort } = await listen(upstream);
        proxyRuntime = await startTestProxy(upstreamPort);
        const proxyPort = proxyRuntime.server.address().port;

        const resp = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Originator': 'codex-tui' },
            body: { model: 'gpt-5', input: 'hello', stream: false }
        });

        assert.equal(resp.status, 200);
        assert.ok(capturedHeaders, 'upstream should receive /v1/responses request');
        assert.match(capturedHeaders['user-agent'] || '', /^codex_cli_rs\//);
        assert.equal(capturedHeaders.version, '0.98.0');
        assert.equal(capturedHeaders['openai-beta'], 'responses=experimental');
        assert.equal(capturedHeaders.originator, 'codex_cli_rs');
        assert.equal(capturedHeaders['x-codexmate-proxy'], '1');
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

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

test('builtin-proxy /v1/responses restores Codex built-in tool calls from chat fallback', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: 'chatcmpl_tool_restore',
                model: 'gpt-tools',
                choices: [{
                    message: {
                        role: 'assistant',
                        content: null,
                        tool_calls: [
                            { id: 'call_patch', type: 'function', function: { name: 'apply_patch', arguments: '{"input":"*** Begin Patch\\n*** End Patch"}' } },
                            { id: 'call_shell', type: 'function', function: { name: 'local_shell', arguments: '{"cmd":"pwd"}' } },
                            { id: 'call_lookup', type: 'function', function: { name: 'lookup', arguments: '{"q":"codexmate"}' } }
                        ]
                    },
                    finish_reason: 'tool_calls'
                }]
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
            body: {
                model: 'gpt-tools',
                input: 'use tools',
                tools: [
                    { type: 'custom_tool', name: 'apply_patch' },
                    { type: 'local_shell', name: 'local_shell' },
                    { type: 'function', name: 'lookup', parameters: { type: 'object' } }
                ],
                stream: false
            }
        });
        assert.equal(resp.status, 200);
        const parsed = JSON.parse(resp.text);
        assert.deepStrictEqual(parsed.output, [
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
                action: { cmd: 'pwd' }
            },
            {
                type: 'function_call',
                call_id: 'call_lookup',
                name: 'lookup',
                arguments: '{"q":"codexmate"}'
            }
        ]);
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

test('builtin-proxy /v1/responses preserves explicit function tools named apply_patch', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: 'chatcmpl_apply_patch_function',
                model: 'gpt-tools',
                choices: [{
                    message: {
                        role: 'assistant',
                        content: null,
                        tool_calls: [
                            { id: 'call_patch_fn', type: 'function', function: { name: 'apply_patch', arguments: '{"diff":"*** Begin Patch\\n*** End Patch"}' } }
                        ]
                    },
                    finish_reason: 'tool_calls'
                }]
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
            body: {
                model: 'gpt-tools',
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
                ],
                stream: false
            }
        });
        assert.equal(resp.status, 200);
        const parsed = JSON.parse(resp.text);
        assert.deepStrictEqual(parsed.output, [
            {
                type: 'function_call',
                call_id: 'call_patch_fn',
                name: 'apply_patch',
                arguments: '{"diff":"*** Begin Patch\\n*** End Patch"}'
            }
        ]);
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
    let capturedChatHeaders = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            capturedChatHeaders = req.headers;
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
        assert.match(capturedChatHeaders['user-agent'] || '', /^codex_cli_rs\//);
        assert.equal(capturedChatHeaders.version, '0.98.0');
        assert.equal(capturedChatHeaders['openai-beta'], 'responses=experimental');
        assert.equal(capturedChatHeaders.originator, 'codex_cli_rs');
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

test('builtin-proxy /v1/responses stream=true does not fallback to chat when upstream Responses hangs', async () => {
    let responsesHit = false;
    let chatHit = false;
    let capturedResponsesHeaders = null;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            responsesHit = true;
            capturedResponsesHeaders = req.headers;
            // A hanging Responses endpoint is not proof that Responses is unsupported.
            // Falling back to chat/completions can route through non-Codex client paths
            // and break Codex-only upstream groups.
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
    let proxyRuntime = null;

    try {
        proxyRuntime = await startTestProxy(upstreamPort, { timeoutMs: 1000 });
        const proxyPort = proxyRuntime.server.address().port;
        const started = Date.now();
        const sse = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream'
            },
            body: {
                model: 'gpt-test',
                instructions: 'You are Codex. Be concise.',
                input: [
                    { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'follow repo rules' }] },
                    { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'do a normal task' }] }
                ],
                max_output_tokens: 512,
                temperature: 0.2,
                stream: true
            }
        });
        const elapsedMs = Date.now() - started;

        assert.equal(sse.status, 502);
        assert.equal(responsesHit, true, 'streaming Codex tasks should probe upstream /responses first');
        assert.match(capturedResponsesHeaders['user-agent'] || '', /^codex_cli_rs\//);
        assert.equal(capturedResponsesHeaders.version, '0.98.0');
        assert.equal(capturedResponsesHeaders['openai-beta'], 'responses=experimental');
        assert.equal(capturedResponsesHeaders.originator, 'codex_cli_rs');
        assert.equal(chatHit, false, 'hanging Responses must not fallback to chat/completions');
        assert.ok(elapsedMs >= 900, `proxy should wait for the upstream Responses timeout; took ${elapsedMs}ms`);
        assert.match(sse.headers['content-type'], /application\/json/i);
        assert.match(sse.text, /timeout/);
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

test('builtin-proxy /v1/responses uses metapi-style Responses to chat fallback conversion', async () => {
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
                    id: 'chatcmpl_metapi_conversion',
                    model: 'gpt-metapi',
                    choices: [{ message: { role: 'assistant', content: 'converted' } }],
                    usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 }
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
                model: 'gpt-metapi',
                input: [
                    { type: 'function_call_output', call_id: 'call_orphan', output: 'drop-me' },
                    { role: 'developer', content: [{ type: 'input_text', text: 'dev rules' }] },
                    { type: 'reasoning', summary: [{ type: 'summary_text', text: 'hidden chain summary' }], encrypted_content: 'enc_sig' },
                    {
                        type: 'message',
                        role: 'user',
                        content: [
                            { type: 'input_text', text: 'use both tools' },
                            { type: 'input_image', url: 'https://example.com/cat.png' },
                            { type: 'input_file', file_id: 'file_123', filename: 'notes.txt' }
                        ]
                    },
                    { type: 'function_call', call_id: 'call_a', name: 'lookup', arguments: { q: 'codexmate' } },
                    { type: 'custom_tool_call', call_id: 'call_b', name: 'shell', input: 'pwd' },
                    { type: 'function_call_output', call_id: 'call_a', output: { ok: true } },
                    { type: 'custom_tool_call_output', call_id: 'call_b', output: 'done' }
                ],
                tools: [
                    { type: 'function', name: 'lookup', description: 'Lookup data', parameters: { type: 'object' } },
                    { type: 'custom', name: 'shell', description: 'Run raw shell input' },
                    { type: 'local_shell', name: 'local_shell' },
                    { type: 'image_generation', name: 'image_generation' },
                    {
                        type: 'namespace',
                        tools: [{ type: 'function', name: 'nested_lookup', parameters: { type: 'object' } }]
                    },
                    createNestedNamespace(6, { type: 'function', name: 'too_deep', parameters: { type: 'object' } })
                ],
                tool_choice: { type: 'tool', name: 'lookup' },
                text: { format: { type: 'json_object' }, verbosity: 'low' },
                parallel_tool_calls: false,
                stream: false
            }
        });

        assert.equal(resp.status, 200);
        assert.ok(capturedChatRequest, 'chat fallback should be captured');
        assert.deepStrictEqual(capturedChatRequest.messages, [
            { role: 'system', content: [{ type: 'text', text: 'dev rules' }] },
            {
                role: 'assistant',
                content: [{ type: 'text', text: 'hidden chain summary' }],
                reasoning_signature: 'enc_sig'
            },
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'use both tools' },
                    { type: 'image_url', image_url: { url: 'https://example.com/cat.png' } },
                    { type: 'file', file: { file_id: 'file_123', filename: 'notes.txt' } }
                ]
            },
            {
                role: 'assistant',
                content: null,
                tool_calls: [
                    { id: 'call_a', type: 'function', function: { name: 'lookup', arguments: '{"q":"codexmate"}' } },
                    { id: 'call_b', type: 'function', function: { name: 'shell', arguments: '{"input":"pwd"}' } }
                ]
            },
            { role: 'tool', tool_call_id: 'call_a', content: '{"ok":true}' },
            { role: 'tool', tool_call_id: 'call_b', content: 'done' }
        ]);
        assert.deepStrictEqual(capturedChatRequest.tools, [
            {
                type: 'function',
                function: { name: 'lookup', description: 'Lookup data', parameters: { type: 'object' } }
            },
            {
                type: 'function',
                function: {
                    name: 'shell',
                    description: 'Run raw shell input',
                    parameters: {
                        type: 'object',
                        properties: { input: { type: 'string', description: 'Raw tool input.' } },
                        required: ['input'],
                        additionalProperties: false
                    }
                }
            },
            {
                type: 'function',
                function: {
                    name: 'local_shell',
                    description: 'Run a local shell command and return its output.',
                    parameters: {
                        type: 'object',
                        properties: {
                            cmd: { type: 'string', description: 'Shell command to execute.' },
                            yield_time_ms: { type: 'number', description: 'Milliseconds to wait before yielding partial output.' },
                            max_output_tokens: { type: 'number', description: 'Maximum output tokens to return.' }
                        },
                        required: ['cmd'],
                        additionalProperties: true
                    }
                }
            },
            {
                type: 'function',
                function: { name: 'nested_lookup', parameters: { type: 'object' } }
            }
        ]);
        assert.deepStrictEqual(capturedChatRequest.tool_choice, { type: 'function', function: { name: 'lookup' } });
        assert.equal(capturedChatRequest.tools.some((tool) => tool.function?.name === 'too_deep'), false);
        assert.equal(capturedChatRequest.parallel_tool_calls, false);
        assert.deepStrictEqual(capturedChatRequest.response_format, { type: 'json_object' });
        assert.equal(capturedChatRequest.verbosity, 'low');

        const parsed = JSON.parse(resp.text);
        assert.equal(parsed.output[0].content[0].text, 'converted');
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

test('builtin-proxy /v1/responses drops hosted-only Responses tools for chat fallback', async () => {
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
                    id: 'chatcmpl_hosted_tools',
                    model: 'gpt-hosted-tools',
                    choices: [{ message: { role: 'assistant', content: 'hosted-dropped' } }]
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
                model: 'gpt-hosted-tools',
                input: 'draw later',
                tools: [
                    { type: 'image_generation', name: 'image_generation' },
                    { type: 'web_search_preview', name: 'web_search_preview' }
                ],
                tool_choice: { type: 'tool', name: 'image_generation' },
                stream: false
            }
        });

        assert.equal(resp.status, 200);
        assert.ok(capturedChatRequest, 'chat fallback should be captured');
        assert.equal(Object.prototype.hasOwnProperty.call(capturedChatRequest, 'tools'), false);
        assert.equal(Object.prototype.hasOwnProperty.call(capturedChatRequest, 'tool_choice'), false);
        const parsed = JSON.parse(resp.text);
        assert.equal(parsed.output[0].content[0].text, 'hosted-dropped');
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

test('builtin-proxy /v1/responses stream=true retries chat fallback up to three times before output', async () => {
    const sockets = new Set();
    let chatAttempts = 0;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            req.on('data', () => {});
            req.on('end', () => {
                chatAttempts += 1;
                res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
                if (typeof res.flushHeaders === 'function') res.flushHeaders();
                if (chatAttempts <= 3) {
                    setTimeout(() => {
                        try { req.socket.destroy(); } catch (_) {}
                    }, 30);
                    return;
                }
                res.write('data: {"id":"chatcmpl_retry","model":"gpt-test","choices":[{"delta":{"role":"assistant"}}]}\n\n');
                res.write('data: {"id":"chatcmpl_retry","model":"gpt-test","choices":[{"delta":{"content":"recovered-stream"}}]}\n\n');
                res.end('data: [DONE]\n\n');
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
        assert.equal(chatAttempts, 4, 'initial attempt plus three retries should be allowed before output');
        assert.match(sse.headers['content-type'], /text\/event-stream/i);
        assert.match(sse.text, /"delta":"recovered-stream"/);
        assert.match(sse.text, /event: response\.completed/);
        assert.doesNotMatch(sse.text, /event: response\.failed/);
        assert.equal((sse.text.match(/event: response\.created/g) || []).length, 1);
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream, sockets);
    }
});

test('builtin-proxy /v1/responses stream=true retries JSON fallback when body aborts before SSE output', async () => {
    const sockets = new Set();
    let chatAttempts = 0;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            req.on('data', () => {});
            req.on('end', () => {
                chatAttempts += 1;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                if (chatAttempts === 1) {
                    res.write('{"id":"chatcmpl_json_retry","model":"gpt-test","choices":[');
                    setTimeout(() => {
                        try { req.socket.destroy(); } catch (_) {}
                    }, 30);
                    return;
                }
                res.end(JSON.stringify({
                    id: 'chatcmpl_json_retry',
                    model: 'gpt-test',
                    choices: [{ message: { role: 'assistant', content: 'json-recovered' } }]
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
        proxyRuntime = await startTestProxy(upstreamPort);
        const proxyPort = proxyRuntime.server.address().port;
        const sse = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { model: 'gpt-test', input: 'ping', stream: true }
        });
        assert.equal(sse.status, 200);
        assert.ok(chatAttempts >= 2, 'pre-output JSON fallback abort should be retried');
        assert.match(sse.headers['content-type'], /text\/event-stream/i);
        assert.match(sse.text, /"delta":"json-recovered"/);
        assert.match(sse.text, /event: response\.completed/);
        assert.doesNotMatch(sse.text, /event: response\.failed/);
        assert.equal((sse.text.match(/event: response\.created/g) || []).length, 1);
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream, sockets);
    }
});

test('builtin-proxy /v1/responses stream=true keeps downstream SSE open before first upstream event', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            req.on('data', () => {});
            req.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
                if (typeof res.flushHeaders === 'function') res.flushHeaders();
                setTimeout(() => {
                    res.write('data: {"id":"chatcmpl_idle","model":"gpt-test","choices":[{"delta":{"content":"after-idle"}}]}\n\n');
                    res.end('data: [DONE]\n\n');
                }, 1200);
            });
            return;
        }
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'not found' }));
    });
    const { port: upstreamPort } = await listen(upstream);
    let proxyRuntime = null;

    try {
        proxyRuntime = await startTestProxy(upstreamPort, { timeoutMs: 1000 });
        const proxyPort = proxyRuntime.server.address().port;
        const sse = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { model: 'gpt-test', input: 'ping', stream: true }
        });
        assert.equal(sse.status, 200);
        assert.match(sse.headers['content-type'], /text\/event-stream/i);
        assert.match(sse.text, /event: response\.created/);
        assert.match(sse.text, /"delta":"after-idle"/);
        assert.match(sse.text, /event: response\.completed/);
        assert.doesNotMatch(sse.text, /event: response\.failed/);
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

test('builtin-proxy /v1/responses stream=true aborts upstream when client disconnects', async () => {
    let upstreamClosed = false;
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            req.on('close', () => { upstreamClosed = true; });
            req.on('data', () => {});
            req.on('end', () => {
                res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
                res.write('data: {"id":"chatcmpl_client_abort","model":"gpt-test","choices":[{"delta":{"role":"assistant"}}]}\n\n');
                // Keep stream open until the proxy destroys it after client disconnect.
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
        await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: '127.0.0.1',
                port: proxyPort,
                path: '/v1/responses',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, (res) => {
                let text = '';
                res.on('data', (chunk) => {
                    text += chunk.toString('utf-8');
                    if (text.includes('event: response.created')) {
                        req.destroy();
                        setTimeout(resolve, 100);
                    }
                });
                res.on('error', () => {});
            });
            req.on('error', (err) => {
                if (err && err.code === 'ECONNRESET') return;
                reject(err);
            });
            req.write(JSON.stringify({ model: 'gpt-test', input: 'ping', stream: true }));
            req.end();
        });
        assert.equal(upstreamClosed, true, 'client disconnect should close upstream request');
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

test('builtin-proxy /v1/responses adds encrypted reasoning include for upstream Responses', async () => {
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
    let proxyRuntime = null;

    try {
        proxyRuntime = await startTestProxy(upstreamPort);
        const proxyPort = proxyRuntime.server.address().port;
        const resp = await requestText(`http://127.0.0.1:${proxyPort}/v1/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

test('builtin-proxy /v1/responses maps reasoning effort, max_completion_tokens, and finish_reason length through chat fallback', async () => {
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
                    id: 'chatcmpl_length',
                    model: 'gpt-test',
                    choices: [{
                        finish_reason: 'length',
                        message: { role: 'assistant', content: '' }
                    }],
                    usage: { prompt_tokens: 2, completion_tokens: 4, total_tokens: 6 }
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
                model: 'gpt-test',
                input: 'short answer',
                reasoning: { effort: 'medium' },
                max_completion_tokens: 64,
                stream: false
            }
        });

        assert.equal(resp.status, 200);
        assert.ok(capturedChatRequest, 'chat fallback request should be captured');
        assert.equal(capturedChatRequest.reasoning_effort, 'medium');
        assert.equal(capturedChatRequest.max_tokens, 128);

        const parsed = JSON.parse(resp.text);
        assert.equal(parsed.status, 'incomplete');
        assert.deepStrictEqual(parsed.incomplete_details, { reason: 'max_output_tokens' });
        assert.equal(parsed.output[0].type, 'message');
        assert.equal(parsed.output[0].content[0].type, 'output_text');
        assert.equal(parsed.output[0].content[0].text, '');
        assert.deepStrictEqual(parsed.usage, { input_tokens: 2, output_tokens: 4, total_tokens: 6 });
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});

test('builtin-proxy /v1/responses stream=true emits reasoning and tool events from chat fallback', async () => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/v1/responses' && req.method === 'POST') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'responses endpoint unavailable' }));
            return;
        }
        if (req.url === '/v1/chat/completions' && req.method === 'POST') {
            res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8' });
            res.write('data: {"id":"chatcmpl_reason_tool","model":"gpt-test","choices":[{"delta":{"reasoning_content":"private "}}]}\n\n');
            res.write('data: {"id":"chatcmpl_reason_tool","model":"gpt-test","choices":[{"delta":{"reasoning_content":"thought"}}]}\n\n');
            res.write('data: {"id":"chatcmpl_reason_tool","model":"gpt-test","choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_lookup","type":"function","function":{"name":"lookup","arguments":"{\\\"q\\\":"}}]}}]}\n\n');
            res.write('data: {"id":"chatcmpl_reason_tool","model":"gpt-test","choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\\"codexmate\\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n');
            res.end('data: [DONE]\n\n');
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
            body: {
                model: 'gpt-test',
                input: 'use lookup',
                tools: [{ type: 'function', name: 'lookup', parameters: { type: 'object' } }],
                stream: true
            }
        });

        assert.equal(sse.status, 200);
        assert.match(sse.headers['content-type'], /text\/event-stream/i);
        assert.match(sse.text, /event: response\.reasoning_summary_text\.delta/);
        assert.match(sse.text, /"delta":"private "/);
        assert.match(sse.text, /"delta":"thought"/);
        assert.match(sse.text, /event: response\.reasoning_summary_text\.done/);
        assert.match(sse.text, /"text":"private thought"/);
        assert.match(sse.text, /event: response\.function_call_arguments\.delta/);
        assert.match(sse.text, /"delta":"\{\\"q\\":\\"codexmate\\"\}"/);
        assert.match(sse.text, /event: response\.function_call_arguments\.done/);
        assert.match(sse.text, /"arguments":"\{\\"q\\":\\"codexmate\\"\}"/);
        assert.match(sse.text, /"type":"reasoning"/);
        assert.match(sse.text, /"type":"function_call"/);
        assert.match(sse.text, /event: response\.completed/);
        assert.match(sse.text, /data: \[DONE\]/);
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server, proxyRuntime.connections);
        }
        await closeServer(upstream);
    }
});
