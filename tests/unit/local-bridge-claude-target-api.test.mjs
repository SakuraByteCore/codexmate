import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const test = globalThis.test || (await import('node:test')).default;
const { createLocalBridgeHttpHandler } = require('../../cli/local-bridge.js');

function listen(server) {
    server.listen(0, '127.0.0.1');
    return once(server, 'listening').then(() => {
        const addr = server.address();
        return { port: addr.port, host: addr.address };
    });
}

function closeServer(server) {
    return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
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
            res.on('data', (chunk) => chunks.push(chunk));
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

async function callHandlerText(handler, path, { method = 'GET', headers = {}, body, remoteAddress = '127.0.0.1' } = {}) {
    return new Promise((resolve, reject) => {
        const req = new PassThrough();
        req.method = method;
        req.url = path;
        req.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
        req.socket = { remoteAddress };
        const chunks = [];
        const res = {
            statusCode: 200,
            headers: {},
            headersSent: false,
            writeHead(statusCode, responseHeaders = {}) {
                this.statusCode = statusCode;
                this.headers = { ...this.headers, ...responseHeaders };
                this.headersSent = true;
            },
            write(chunk) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
            },
            end(chunk) {
                if (chunk !== undefined) this.write(chunk);
                resolve({ status: this.statusCode, headers: this.headers, text: Buffer.concat(chunks).toString('utf-8') });
            }
        };
        try {
            if (!handler(req, res)) {
                resolve({ status: 404, headers: {}, text: 'not handled' });
                return;
            }
            process.nextTick(() => {
                if (body !== undefined) req.end(typeof body === 'string' ? body : JSON.stringify(body));
                else req.end();
            });
        } catch (err) {
            reject(err);
        }
    });
}

async function createClaudeBridge({ provider }) {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'codexmate-claude-local-bridge-'));
    const claudeProvidersFile = path.join(tmpDir, 'claude-providers.json');
    await writeFile(claudeProvidersFile, JSON.stringify({
        providers: { test: provider },
        excludedProviders: []
    }), 'utf-8');

    const handler = createLocalBridgeHttpHandler({
        readConfigFn: () => ({ model_providers: {} }),
        claudeProvidersFile,
        expectedToken: 'codexmate',
        maxBodySize: 1024 * 1024,
        maxUpstreamBytes: 1024 * 1024
    });
    const bridge = http.createServer((req, res) => {
        if (!handler(req, res)) {
            res.statusCode = 404;
            res.end('not handled');
        }
    });
    const { port } = await listen(bridge);
    return { tmpDir, bridge, handler, baseUrl: `http://127.0.0.1:${port}` };
}

test('claude local bridge keeps responses providers on Anthropic /v1/messages without double v1', async () => {
    let captured = null;
    const upstream = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            captured = {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: Buffer.concat(chunks).toString('utf-8')
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: 'msg_native',
                type: 'message',
                role: 'assistant',
                model: 'native-model',
                content: [{ type: 'text', text: 'native ok' }],
                stop_reason: 'end_turn',
                usage: { input_tokens: 1, output_tokens: 2 }
            }));
        });
    });
    const { port: upstreamPort } = await listen(upstream);
    const bridge = await createClaudeBridge({
        provider: {
            baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
            apiKey: 'sk-native',
            model: 'native-model',
            targetApi: 'responses'
        }
    });

    try {
        const resp = await requestText(`${bridge.baseUrl}/bridge/claude-local/v1/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { model: 'claude-from-client', messages: [{ role: 'user', content: 'ping' }] }
        });

        assert.equal(resp.status, 200);
        assert.equal(captured.url, '/v1/messages');
        assert.equal(captured.method, 'POST');
        assert.equal(captured.headers['x-api-key'], 'sk-native');
        assert.equal(captured.headers['anthropic-version'], '2023-06-01');
        assert.equal(JSON.parse(captured.body).model, 'native-model');
        assert.equal(JSON.parse(resp.text).id, 'msg_native');
    } finally {
        await closeServer(bridge.bridge);
        await closeServer(upstream);
        await rm(bridge.tmpDir, { recursive: true, force: true });
    }
});

test('claude local bridge native passthrough does not synthesize a body for empty GET requests', async () => {
    let captured = null;
    const upstream = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            captured = {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: Buffer.concat(chunks).toString('utf-8')
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ data: [{ id: 'native-model' }] }));
        });
    });
    const { port: upstreamPort } = await listen(upstream);
    const bridge = await createClaudeBridge({
        provider: {
            baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
            apiKey: 'sk-native',
            model: 'native-model',
            targetApi: 'responses'
        }
    });

    try {
        const resp = await requestText(`${bridge.baseUrl}/bridge/claude-local/v1/models`, { method: 'GET' });

        assert.equal(resp.status, 200);
        assert.equal(captured.method, 'GET');
        assert.equal(captured.url, '/v1/models');
        assert.equal(captured.body, '');
        assert.equal(captured.headers['content-length'], undefined);
        assert.equal(captured.headers['x-api-key'], 'sk-native');
    } finally {
        await closeServer(bridge.bridge);
        await closeServer(upstream);
        await rm(bridge.tmpDir, { recursive: true, force: true });
    }
});

test('claude local bridge native passthrough returns 400 for invalid JSON bodies', async () => {
    let upstreamCalled = false;
    const upstream = http.createServer((req, res) => {
        upstreamCalled = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
    });
    const { port: upstreamPort } = await listen(upstream);
    const bridge = await createClaudeBridge({
        provider: {
            baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
            apiKey: 'sk-native',
            model: 'native-model',
            targetApi: 'responses'
        }
    });

    try {
        const resp = await requestText(`${bridge.baseUrl}/bridge/claude-local/v1/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{bad json'
        });

        assert.equal(resp.status, 400);
        assert.equal(upstreamCalled, false);
        assert.match(JSON.parse(resp.text).error, /JSON|Unexpected|invalid/i);
    } finally {
        await closeServer(bridge.bridge);
        await closeServer(upstream);
        await rm(bridge.tmpDir, { recursive: true, force: true });
    }
});

test('claude local bridge converts chat_completions providers behind /v1/messages', async () => {
    let captured = null;
    const upstream = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            captured = {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: 'chatcmpl_test',
                model: 'gpt-test',
                choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'chat ok' } }],
                usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 }
            }));
        });
    });
    const { port: upstreamPort } = await listen(upstream);
    const bridge = await createClaudeBridge({
        provider: {
            baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
            apiKey: 'sk-chat',
            model: 'gpt-test',
            targetApi: 'chat_completions'
        }
    });

    try {
        const resp = await requestText(`${bridge.baseUrl}/bridge/claude-local/v1/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { model: 'claude-from-client', max_tokens: 32, messages: [{ role: 'user', content: 'ping' }] }
        });

        assert.equal(resp.status, 200);
        assert.equal(captured.url, '/v1/chat/completions');
        assert.equal(captured.headers.authorization, 'Bearer sk-chat');
        assert.equal(captured.body.model, 'gpt-test');
        assert.equal(captured.body.max_tokens, 32);
        assert.equal(captured.body.messages.at(-1).content, 'ping');
        const body = JSON.parse(resp.text);
        assert.equal(body.type, 'message');
        assert.equal(body.content[0].text, 'chat ok');
        assert.equal(body.usage.input_tokens, 3);
        assert.equal(body.usage.output_tokens, 4);
    } finally {
        await closeServer(bridge.bridge);
        await closeServer(upstream);
        await rm(bridge.tmpDir, { recursive: true, force: true });
    }
});

test('claude local bridge transform providers return 400 for empty message bodies', async () => {
    let upstreamCalled = false;
    const upstream = http.createServer((req, res) => {
        upstreamCalled = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
    });
    const { port: upstreamPort } = await listen(upstream);
    const bridge = await createClaudeBridge({
        provider: {
            baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
            apiKey: 'sk-chat',
            model: 'gpt-test',
            targetApi: 'chat_completions'
        }
    });

    try {
        const resp = await requestText(`${bridge.baseUrl}/bridge/claude-local/v1/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        assert.equal(resp.status, 400);
        assert.equal(upstreamCalled, false);
        assert.match(JSON.parse(resp.text).error, /empty body/i);
    } finally {
        await closeServer(bridge.bridge);
        await closeServer(upstream);
        await rm(bridge.tmpDir, { recursive: true, force: true });
    }
});

test('claude local bridge converts ollama providers to /api/chat without injecting /v1', async () => {
    let captured = null;
    const upstream = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            captured = {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                model: 'llama3.1:8b',
                message: { role: 'assistant', content: 'ollama ok' },
                done: true,
                prompt_eval_count: 5,
                eval_count: 6
            }));
        });
    });
    const { port: upstreamPort } = await listen(upstream);
    const bridge = await createClaudeBridge({
        provider: {
            baseUrl: `http://127.0.0.1:${upstreamPort}`,
            apiKey: '',
            model: 'llama3.1:8b',
            targetApi: 'ollama'
        }
    });

    try {
        const resp = await requestText(`${bridge.baseUrl}/bridge/claude-local/v1/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: { model: 'claude-from-client', messages: [{ role: 'user', content: 'ping' }] }
        });

        assert.equal(resp.status, 200);
        assert.equal(captured.url, '/api/chat');
        assert.equal(captured.headers.authorization, undefined);
        assert.equal(captured.body.model, 'llama3.1:8b');
        assert.equal(captured.body.messages.at(-1).content, 'ping');
        const body = JSON.parse(resp.text);
        assert.equal(body.type, 'message');
        assert.equal(body.content[0].text, 'ollama ok');
        assert.equal(body.usage.input_tokens, 5);
        assert.equal(body.usage.output_tokens, 6);
    } finally {
        await closeServer(bridge.bridge);
        await closeServer(upstream);
        await rm(bridge.tmpDir, { recursive: true, force: true });
    }
});

test('claude local bridge does not forward the bridge token as upstream auth', async () => {
    let captured = null;
    const upstream = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            captured = {
                method: req.method,
                url: req.url,
                headers: req.headers,
                body: JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}')
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                model: 'llama3.1:8b',
                message: { role: 'assistant', content: 'ollama ok' },
                done: true
            }));
        });
    });
    const { port: upstreamPort } = await listen(upstream);
    const bridge = await createClaudeBridge({
        provider: {
            baseUrl: `http://127.0.0.1:${upstreamPort}`,
            apiKey: '',
            model: 'llama3.1:8b',
            targetApi: 'ollama'
        }
    });

    try {
        const resp = await callHandlerText(bridge.handler, '/bridge/claude-local/v1/messages', {
            method: 'POST',
            remoteAddress: '203.0.113.10',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer codexmate' },
            body: { model: 'claude-from-client', messages: [{ role: 'user', content: 'ping' }] }
        });

        assert.equal(resp.status, 200);
        assert.equal(captured.url, '/api/chat');
        assert.equal(captured.headers.authorization, undefined);
        assert.equal(captured.body.model, 'llama3.1:8b');
    } finally {
        await closeServer(bridge.bridge);
        await closeServer(upstream);
        await rm(bridge.tmpDir, { recursive: true, force: true });
    }
});
