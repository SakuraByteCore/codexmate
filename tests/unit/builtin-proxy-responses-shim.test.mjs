import nodeTest from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
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

async function closeServer(server) {
    if (!server || !server.listening) return;
    await new Promise((resolve) => server.close(resolve));
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
        CONFIG_FILE: '/tmp/codexmate-test-config.toml',
        BUILTIN_PROXY_SETTINGS_FILE: '/tmp/codexmate-test-proxy.json',
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
        HTTP_KEEP_ALIVE_AGENT: new http.Agent({ keepAlive: true }),
        HTTPS_KEEP_ALIVE_AGENT: new https.Agent({ keepAlive: true }),
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
        { host: '127.0.0.1', port: 0, timeoutMs: 2000 },
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
            await closeServer(proxyRuntime.server);
            for (const socket of proxyRuntime.connections) socket.destroy();
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
            await closeServer(proxyRuntime.server);
            for (const socket of proxyRuntime.connections) socket.destroy();
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
                top_logprops: null,
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
            stream_options: null,
            temperature: 1,
            top_p: 1,
            tools: null,
            tool_choice: 'none',
            logprobs: false,
            top_logprops: null,
            kbs: [],
            is_online: false,
            max_tokens: 2048
        });
    } finally {
        if (proxyRuntime) {
            await closeServer(proxyRuntime.server);
            for (const socket of proxyRuntime.connections) socket.destroy();
        }
        await closeServer(upstream);
    }
});
