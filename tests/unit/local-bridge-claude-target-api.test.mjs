import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
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
    return { tmpDir, bridge, baseUrl: `http://127.0.0.1:${port}` };
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
