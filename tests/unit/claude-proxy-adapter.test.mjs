import assert from 'assert';
import http from 'http';
import net from 'net';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { Agent as HttpAgent } from 'http';
import { Agent as HttpsAgent } from 'https';

const require = createRequire(import.meta.url);
const {
    buildBuiltinClaudeResponsesRequest,
    buildBuiltinClaudeChatCompletionsRequest,
    buildBuiltinClaudeOllamaChatRequest,
    buildAnthropicMessageFromResponses,
    buildAnthropicMessageFromChatCompletion,
    buildAnthropicMessageFromOllamaChat,
    buildAnthropicStreamEvents,
    buildAnthropicModelsPayload,
    createBuiltinClaudeProxyRuntimeController
} = require('../../cli/claude-proxy');

test('buildBuiltinClaudeResponsesRequest maps anthropic messages/tools into responses payload', () => {
    const payload = buildBuiltinClaudeResponsesRequest({
        model: 'gpt-4.1',
        max_tokens: 256,
        system: [{ type: 'text', text: 'system prompt' }],
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'hello' },
                    { type: 'tool_result', tool_use_id: 'toolu_1', content: [{ type: 'text', text: 'tool ok' }] }
                ]
            },
            {
                role: 'assistant',
                content: [
                    { type: 'tool_use', id: 'toolu_1', name: 'lookup', input: { q: 'hi' } },
                    { type: 'text', text: 'done' }
                ]
            }
        ],
        tools: [
            {
                name: 'lookup',
                description: 'Lookup something',
                input_schema: { type: 'object', properties: { q: { type: 'string' } } }
            }
        ],
        tool_choice: { type: 'tool', name: 'lookup' },
        stop_sequences: ['END'],
        metadata: { source: 'e2e' }
    });

    assert.strictEqual(payload.model, 'gpt-4.1');
    assert.strictEqual(payload.instructions, 'system prompt');
    assert.strictEqual(payload.max_output_tokens, 256);
    assert.deepStrictEqual(payload.stop, ['END']);
    assert.deepStrictEqual(payload.metadata, { source: 'e2e' });
    assert.deepStrictEqual(payload.tool_choice, { type: 'function', name: 'lookup' });
    assert.deepStrictEqual(payload.tools, [{
        type: 'function',
        name: 'lookup',
        description: 'Lookup something',
        parameters: { type: 'object', properties: { q: { type: 'string' } } }
    }]);
    assert.deepStrictEqual(payload.input, [
        { role: 'user', content: [{ type: 'input_text', text: 'hello' }] },
        { type: 'function_call_output', call_id: 'toolu_1', output: 'tool ok' },
        { type: 'function_call', call_id: 'toolu_1', name: 'lookup', arguments: '{"q":"hi"}' },
        { role: 'assistant', content: [{ type: 'output_text', text: 'done' }] }
    ]);
});

test('buildBuiltinClaudeResponsesRequest preserves images and drops incompatible bridge-only blocks', () => {
    const payload = buildBuiltinClaudeResponsesRequest({
        model: 'gpt-4.1',
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: 'describe this' },
                { type: 'thinking', thinking: 'hidden chain' },
                { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aW1n' } },
                { type: 'document', source: { type: 'text', data: 'unsupported doc' } }
            ]
        }]
    });

    assert.deepStrictEqual(payload.input, [{
        role: 'user',
        content: [
            { type: 'input_text', text: 'describe this' },
            { type: 'input_image', image_url: 'data:image/png;base64,aW1n' }
        ]
    }]);
});

test('buildBuiltinClaudeChatCompletionsRequest maps anthropic messages/tools into chat completions payload', () => {
    const payload = buildBuiltinClaudeChatCompletionsRequest({
        model: 'DeepSeek-V4-pro',
        max_tokens: 128,
        system: [{ type: 'text', text: 'system prompt' }],
        messages: [
            { role: 'user', content: [{ type: 'text', text: 'hello' }] },
            { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'lookup', input: { q: 'hi' } }] },
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'tool ok' }] }
        ],
        tools: [{ name: 'lookup', description: 'Lookup', input_schema: { type: 'object', properties: { q: { type: 'string' } } } }],
        tool_choice: { type: 'tool', name: 'lookup' },
        stop_sequences: ['END']
    });

    assert.strictEqual(payload.model, 'DeepSeek-V4-pro');
    assert.strictEqual(payload.max_tokens, 128);
    assert.strictEqual(payload.stream, false);
    assert.deepStrictEqual(payload.stop, ['END']);
    assert.deepStrictEqual(payload.tool_choice, { type: 'function', function: { name: 'lookup' } });
    assert.deepStrictEqual(payload.tools, [{
        type: 'function',
        function: {
            name: 'lookup',
            description: 'Lookup',
            parameters: { type: 'object', properties: { q: { type: 'string' } } }
        }
    }]);
    assert.deepStrictEqual(payload.messages, [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'hello' },
        {
            role: 'assistant',
            content: null,
            tool_calls: [{ id: 'toolu_1', type: 'function', function: { name: 'lookup', arguments: '{"q":"hi"}' } }]
        },
        { role: 'tool', tool_call_id: 'toolu_1', content: 'tool ok' }
    ]);
});


test('buildBuiltinClaudeChatCompletionsRequest preserves multimodal user content for OpenAI-compatible upstreams', () => {
    const payload = buildBuiltinClaudeChatCompletionsRequest({
        model: 'gpt-4o-mini',
        max_tokens: 64,
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: 'describe this' },
                { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aW1n' } }
            ]
        }]
    });

    assert.deepStrictEqual(payload.messages, [{
        role: 'user',
        content: [
            { type: 'text', text: 'describe this' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,aW1n' } }
        ]
    }]);
});

test('buildBuiltinClaudeChatCompletionsRequest drops incompatible bridge-only blocks instead of sending them as text', () => {
    const payload = buildBuiltinClaudeChatCompletionsRequest({
        model: 'gpt-4o-mini',
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: 'visible' },
                { type: 'thinking', thinking: 'hidden chain' },
                { type: 'document', source: { type: 'text', data: 'unsupported doc' } }
            ]
        }]
    });

    assert.deepStrictEqual(payload.messages, [{ role: 'user', content: 'visible' }]);
});

test('buildBuiltinClaudeOllamaChatRequest maps anthropic messages/tools into Ollama /api/chat payload', () => {
    const payload = buildBuiltinClaudeOllamaChatRequest({
        model: 'qwen2.5-coder:7b',
        max_tokens: 80,
        temperature: 0.2,
        top_p: 0.9,
        system: [{ type: 'text', text: 'system prompt' }],
        messages: [
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'hello' },
                    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aW1n' } }
                ]
            },
            { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'lookup', input: { q: 'hi' } }] },
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'tool ok' }] }
        ],
        tools: [{ name: 'lookup', description: 'Lookup', input_schema: { type: 'object', properties: { q: { type: 'string' } } } }],
        stop_sequences: ['END'],
        thinking: { type: 'disabled' }
    });

    assert.strictEqual(payload.model, 'qwen2.5-coder:7b');
    assert.strictEqual(payload.stream, false);
    assert.strictEqual(payload.think, false);
    assert.deepStrictEqual(payload.options, { num_predict: 80, temperature: 0.2, top_p: 0.9, stop: ['END'] });
    assert.deepStrictEqual(payload.messages, [
        { role: 'system', content: 'system prompt' },
        { role: 'user', content: 'hello', images: ['aW1n'] },
        { role: 'assistant', content: '', tool_calls: [{ function: { name: 'lookup', arguments: { q: 'hi' } } }] },
        { role: 'tool', content: 'tool ok', tool_call_id: 'toolu_1' }
    ]);
    assert.deepStrictEqual(payload.tools, [{
        type: 'function',
        function: {
            name: 'lookup',
            description: 'Lookup',
            parameters: { type: 'object', properties: { q: { type: 'string' } } }
        }
    }]);
});

test('buildBuiltinClaudeOllamaChatRequest drops incompatible bridge-only blocks and keeps base64 images', () => {
    const payload = buildBuiltinClaudeOllamaChatRequest({
        model: 'qwen2.5-coder:7b',
        messages: [{
            role: 'user',
            content: [
                { type: 'text', text: 'describe this' },
                { type: 'thinking', thinking: 'hidden chain' },
                { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'aW1n' } },
                { type: 'video', source: { type: 'url', url: 'https://example.com/demo.mp4' } },
                { type: 'document', source: { type: 'text', data: 'unsupported doc' } }
            ]
        }]
    });

    assert.deepStrictEqual(payload.messages, [{ role: 'user', content: 'describe this', images: ['aW1n'] }]);
});

test('buildAnthropicMessageFromResponses maps responses output into anthropic message', () => {
    const message = buildAnthropicMessageFromResponses({
        id: 'resp_123',
        model: 'gpt-4.1',
        output: [
            {
                type: 'message',
                content: [{ type: 'output_text', text: 'proxy ok' }]
            },
            {
                type: 'function_call',
                call_id: 'toolu_9',
                name: 'lookup',
                arguments: '{"city":"tokyo"}'
            }
        ],
        usage: {
            input_tokens: 12,
            output_tokens: 7
        }
    }, {
        model: 'fallback-model'
    });

    assert.strictEqual(message.id, 'resp_123');
    assert.strictEqual(message.model, 'gpt-4.1');
    assert.strictEqual(message.role, 'assistant');
    assert.strictEqual(message.stop_reason, 'tool_use');
    assert.deepStrictEqual(message.usage, {
        input_tokens: 12,
        output_tokens: 7
    });
    assert.deepStrictEqual(message.content, [
        { type: 'text', text: 'proxy ok' },
        { type: 'tool_use', id: 'toolu_9', name: 'lookup', input: { city: 'tokyo' } }
    ]);
});

test('buildAnthropicMessageFromChatCompletion maps chat completion output into anthropic message', () => {
    const message = buildAnthropicMessageFromChatCompletion({
        id: 'chatcmpl_123',
        model: 'DeepSeek-V4-pro',
        choices: [{
            finish_reason: 'tool_calls',
            message: {
                role: 'assistant',
                content: 'proxy ok',
                tool_calls: [{
                    id: 'call_9',
                    type: 'function',
                    function: { name: 'lookup', arguments: '{"city":"tokyo"}' }
                }]
            }
        }],
        usage: { prompt_tokens: 11, completion_tokens: 5 }
    }, { model: 'fallback' });

    assert.strictEqual(message.id, 'chatcmpl_123');
    assert.strictEqual(message.model, 'DeepSeek-V4-pro');
    assert.strictEqual(message.stop_reason, 'tool_use');
    assert.deepStrictEqual(message.usage, { input_tokens: 11, output_tokens: 5 });
    assert.deepStrictEqual(message.content, [
        { type: 'text', text: 'proxy ok' },
        { type: 'tool_use', id: 'call_9', name: 'lookup', input: { city: 'tokyo' } }
    ]);
});


test('buildAnthropicMessageFromOllamaChat maps Ollama /api/chat output into anthropic message', () => {
    const message = buildAnthropicMessageFromOllamaChat({
        model: 'qwen2.5-coder:7b',
        message: {
            role: 'assistant',
            thinking: 'checking the tool result',
            content: 'proxy ok',
            tool_calls: [{ function: { name: 'lookup', arguments: { city: 'tokyo' } } }]
        },
        prompt_eval_count: 9,
        eval_count: 4
    }, { model: 'fallback' });

    assert.strictEqual(message.model, 'qwen2.5-coder:7b');
    assert.strictEqual(message.stop_reason, 'tool_use');
    assert.deepStrictEqual(message.usage, { input_tokens: 9, output_tokens: 4 });
    assert.deepStrictEqual(message.content, [
        { type: 'thinking', thinking: 'checking the tool result' },
        { type: 'text', text: 'proxy ok' },
        { type: 'tool_use', id: message.content[2].id, name: 'lookup', input: { city: 'tokyo' } }
    ]);
    assert(message.content[2].id.startsWith('toolu_'));
});

test('buildAnthropicStreamEvents emits anthropic-style SSE events', () => {
    const events = buildAnthropicStreamEvents({
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        model: 'gpt-4.1',
        content: [
            { type: 'thinking', thinking: 'brief hidden reasoning' },
            { type: 'text', text: 'hello stream' },
            { type: 'tool_use', id: 'toolu_stream', name: 'lookup', input: { city: 'tokyo' } }
        ],
        stop_reason: 'tool_use',
        stop_sequence: null,
        usage: {
            input_tokens: 10,
            output_tokens: 4
        }
    });

    assert.deepStrictEqual(events.map((item) => item.event), [
        'message_start',
        'content_block_start',
        'content_block_delta',
        'content_block_stop',
        'content_block_start',
        'content_block_delta',
        'content_block_stop',
        'content_block_start',
        'content_block_delta',
        'content_block_stop',
        'message_delta',
        'message_stop'
    ]);
    assert.strictEqual(events[2].data.delta.thinking, 'brief hidden reasoning');
    assert.strictEqual(events[5].data.delta.text, 'hello stream');
    assert.strictEqual(events[8].data.delta.partial_json, '{"city":"tokyo"}');
    assert.strictEqual(events[10].data.delta.stop_reason, 'tool_use');
    assert.strictEqual(events[10].data.usage.output_tokens, 4);
});

test('buildAnthropicModelsPayload reshapes upstream models list', () => {
    const payload = buildAnthropicModelsPayload({
        data: [{ id: 'gpt-4.1' }, { id: 'gpt-4o-mini' }]
    });

    assert.strictEqual(payload.first_id, 'gpt-4.1');
    assert.strictEqual(payload.last_id, 'gpt-4o-mini');
    assert.strictEqual(payload.has_more, false);
    assert.deepStrictEqual(payload.data, [
        {
            type: 'model',
            id: 'gpt-4.1',
            display_name: 'gpt-4.1',
            created_at: '1970-01-01T00:00:00Z'
        },
        {
            type: 'model',
            id: 'gpt-4o-mini',
            display_name: 'gpt-4o-mini',
            created_at: '1970-01-01T00:00:00Z'
        }
    ]);
});

function listenForTest(server, host = '127.0.0.1', port = 0) {
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
            server.removeListener('error', reject);
            resolve(server.address());
        });
    });
}

function closeServerForTest(server) {
    return new Promise((resolve) => server.close(() => resolve()));
}

function findFreePortForTest() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
    });
}

async function startBuiltinClaudeProxyRuntimeForTest(controller, payload = {}, attempts = 4) {
    let lastResult = null;
    const payloadHasPort = Object.prototype.hasOwnProperty.call(payload, 'port');
    for (let i = 0; i < attempts; i += 1) {
        const nextPayload = payloadHasPort
            ? { ...payload }
            : { ...payload, port: await findFreePortForTest() };
        const result = await controller.startBuiltinClaudeProxyRuntime(nextPayload);
        if (result && result.success === true) {
            return result;
        }
        lastResult = result;
        const error = result && typeof result.error === 'string' ? result.error : '';
        if (payloadHasPort || !/EADDRINUSE|address already in use/i.test(error) || i === attempts - 1) {
            return result;
        }
        await new Promise((resolve) => setTimeout(resolve, 30 * (i + 1)));
    }
    return lastResult || { error: 'failed to start test Claude proxy' };
}

test('builtin Claude proxy sends Ollama traffic to /api paths without injecting /v1', async () => {
    const upstreamRequests = [];
    const upstream = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            upstreamRequests.push({ method: req.method, url: req.url, body: Buffer.concat(chunks).toString('utf8') });
            res.setHeader('content-type', 'application/json; charset=utf-8');
            if (req.method === 'GET' && req.url === '/api/tags') {
                res.end(JSON.stringify({ models: [{ name: 'qwen2.5-coder:7b' }] }));
                return;
            }
            if (req.method === 'POST' && req.url === '/api/chat') {
                res.end(JSON.stringify({
                    model: 'qwen2.5-coder:7b',
                    message: { role: 'assistant', thinking: 'short thought', content: 'proxy ok' },
                    done: true,
                    done_reason: 'stop',
                    prompt_eval_count: 3,
                    eval_count: 2
                }));
                return;
            }
            res.statusCode = 404;
            res.end(JSON.stringify({ error: `unexpected ${req.method} ${req.url}` }));
        });
    });

    const upstreamAddress = await listenForTest(upstream);
    const settingsFile = path.join(os.tmpdir(), `codexmate-claude-proxy-test-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
    const controller = createBuiltinClaudeProxyRuntimeController({
        BUILTIN_CLAUDE_PROXY_SETTINGS_FILE: settingsFile,
        DEFAULT_BUILTIN_CLAUDE_PROXY_SETTINGS: {
            enabled: true,
            host: '127.0.0.1',
            port: 1,
            provider: '',
            authSource: 'none',
            targetApi: 'ollama',
            timeoutMs: 30000
        },
        BUILTIN_PROXY_PROVIDER_NAME: 'codexmate-builtin-proxy',
        MAX_API_BODY_SIZE: 1024 * 1024,
        HTTP_KEEP_ALIVE_AGENT: new HttpAgent({ keepAlive: false }),
        HTTPS_KEEP_ALIVE_AGENT: new HttpsAgent({ keepAlive: false }),
        readConfigOrVirtualDefault: () => ({ config: { model_providers: {}, model_provider: '' } }),
        resolveBuiltinProxyProviderName: () => '',
        resolveAuthTokenFromCurrentProfile: () => '',
        OPENAI_BRIDGE_SETTINGS_FILE: '',
        resolveOpenaiBridgeUpstream: () => null
    });

    try {
        const start = await startBuiltinClaudeProxyRuntimeForTest(controller, {
            host: '127.0.0.1',
            authSource: 'none',
            targetApi: 'ollama',
            upstreamBaseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
            upstreamProviderName: 'ollama-test'
        });
        assert.strictEqual(start.success, true, JSON.stringify(start));

        const modelsRes = await fetch(`${start.listenUrl}/v1/models`);
        assert.strictEqual(modelsRes.status, 200);
        const models = await modelsRes.json();
        assert.deepStrictEqual(models.data.map((item) => item.id), ['qwen2.5-coder:7b']);

        const messageRes = await fetch(`${start.listenUrl}/v1/messages`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen2.5-coder:7b',
                thinking: { type: 'disabled' },
                messages: [{
                    role: 'user',
                    content: [
                        { type: 'text', text: 'hello' },
                        { type: 'video', source: { type: 'url', url: 'https://example.com/demo.mp4' } }
                    ]
                }]
            })
        });
        assert.strictEqual(messageRes.status, 200);
        const message = await messageRes.json();
        assert.deepStrictEqual(message.content, [
            { type: 'thinking', thinking: 'short thought' },
            { type: 'text', text: 'proxy ok' }
        ]);

        assert.deepStrictEqual(upstreamRequests.map((item) => `${item.method} ${item.url}`), [
            'GET /api/tags',
            'POST /api/chat'
        ]);
        const chatBody = JSON.parse(upstreamRequests[1].body);
        assert.strictEqual(chatBody.think, false);
        assert.deepStrictEqual(chatBody.messages, [{ role: 'user', content: 'hello' }]);
    } finally {
        await controller.stopBuiltinClaudeProxyRuntime();
        await closeServerForTest(upstream);
    }
});

test('builtin Claude proxy maps Ollama upstream errors into Anthropic errors', async () => {
    const upstream = http.createServer((req, res) => {
        req.resume();
        res.statusCode = 429;
        res.setHeader('content-type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
            StatusCode: 429,
            Status: '429 Too Many Requests',
            error: 'weekly usage limit reached'
        }));
    });

    const upstreamAddress = await listenForTest(upstream);
    const settingsFile = path.join(os.tmpdir(), `codexmate-claude-proxy-error-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
    const controller = createBuiltinClaudeProxyRuntimeController({
        BUILTIN_CLAUDE_PROXY_SETTINGS_FILE: settingsFile,
        DEFAULT_BUILTIN_CLAUDE_PROXY_SETTINGS: {
            enabled: true,
            host: '127.0.0.1',
            port: 1,
            provider: '',
            authSource: 'none',
            targetApi: 'ollama',
            timeoutMs: 30000
        },
        BUILTIN_PROXY_PROVIDER_NAME: 'codexmate-builtin-proxy',
        MAX_API_BODY_SIZE: 1024 * 1024,
        HTTP_KEEP_ALIVE_AGENT: new HttpAgent({ keepAlive: false }),
        HTTPS_KEEP_ALIVE_AGENT: new HttpsAgent({ keepAlive: false }),
        readConfigOrVirtualDefault: () => ({ config: { model_providers: {}, model_provider: '' } }),
        resolveBuiltinProxyProviderName: () => '',
        resolveAuthTokenFromCurrentProfile: () => '',
        OPENAI_BRIDGE_SETTINGS_FILE: '',
        resolveOpenaiBridgeUpstream: () => null
    });

    try {
        const start = await startBuiltinClaudeProxyRuntimeForTest(controller, {
            host: '127.0.0.1',
            authSource: 'none',
            targetApi: 'ollama',
            upstreamBaseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
            upstreamProviderName: 'ollama-error-test'
        });
        assert.strictEqual(start.success, true, JSON.stringify(start));

        const messageRes = await fetch(`${start.listenUrl}/v1/messages`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                model: 'gemma4:31b-cloud',
                messages: [{ role: 'user', content: 'hello' }]
            })
        });
        assert.strictEqual(messageRes.status, 429);
        const errorPayload = await messageRes.json();
        assert.deepStrictEqual(errorPayload, {
            type: 'error',
            error: { type: 'api_error', message: 'weekly usage limit reached' }
        });
    } finally {
        await controller.stopBuiltinClaudeProxyRuntime();
        await closeServerForTest(upstream);
        try { require('fs').rmSync(settingsFile, { force: true }); } catch (_) {}
    }
});

test('builtin Claude proxy can restart Ollama direct upstream from saved share import settings', async () => {
    const upstreamRequests = [];
    const upstream = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            upstreamRequests.push({ method: req.method, url: req.url, body: Buffer.concat(chunks).toString('utf8') });
            res.setHeader('content-type', 'application/json; charset=utf-8');
            if (req.method === 'POST' && req.url === '/api/chat') {
                res.end(JSON.stringify({
                    model: 'qwen2.5-coder:7b',
                    message: { role: 'assistant', content: 'restored ollama ok' },
                    done: true,
                    done_reason: 'stop'
                }));
                return;
            }
            res.statusCode = 404;
            res.end(JSON.stringify({ error: `unexpected ${req.method} ${req.url}` }));
        });
    });

    const upstreamAddress = await listenForTest(upstream);
    const settingsFile = path.join(os.tmpdir(), `codexmate-claude-proxy-restart-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
    const baseOptions = {
        BUILTIN_CLAUDE_PROXY_SETTINGS_FILE: settingsFile,
        DEFAULT_BUILTIN_CLAUDE_PROXY_SETTINGS: {
            enabled: true,
            host: '127.0.0.1',
            port: 1,
            provider: '',
            upstreamProviderName: '',
            upstreamBaseUrl: '',
            upstreamApiKey: '',
            authSource: 'none',
            targetApi: 'ollama',
            timeoutMs: 30000
        },
        BUILTIN_PROXY_PROVIDER_NAME: 'codexmate-builtin-proxy',
        MAX_API_BODY_SIZE: 1024 * 1024,
        HTTP_KEEP_ALIVE_AGENT: new HttpAgent({ keepAlive: false }),
        HTTPS_KEEP_ALIVE_AGENT: new HttpsAgent({ keepAlive: false }),
        readConfigOrVirtualDefault: () => ({ config: { model_providers: {}, model_provider: '' } }),
        resolveBuiltinProxyProviderName: () => '',
        resolveAuthTokenFromCurrentProfile: () => '',
        OPENAI_BRIDGE_SETTINGS_FILE: '',
        resolveOpenaiBridgeUpstream: () => null
    };

    const firstController = createBuiltinClaudeProxyRuntimeController(baseOptions);
    let secondController = null;
    try {
        const firstStart = await startBuiltinClaudeProxyRuntimeForTest(firstController, {
            host: '127.0.0.1',
            authSource: 'none',
            targetApi: 'ollama',
            upstreamBaseUrl: `http://127.0.0.1:${upstreamAddress.port}`,
            upstreamProviderName: 'ollama-share-import'
        });
        assert.strictEqual(firstStart.success, true, JSON.stringify(firstStart));
        await firstController.stopBuiltinClaudeProxyRuntime();

        const saved = JSON.parse(require('fs').readFileSync(settingsFile, 'utf-8'));
        assert.strictEqual(saved.targetApi, 'ollama');
        assert.strictEqual(saved.upstreamBaseUrl, `http://127.0.0.1:${upstreamAddress.port}`);
        assert.strictEqual(saved.upstreamProviderName, 'ollama-share-import');

        secondController = createBuiltinClaudeProxyRuntimeController(baseOptions);
        const restoredStart = await secondController.startBuiltinClaudeProxyRuntime({});
        assert.strictEqual(restoredStart.success, true, JSON.stringify(restoredStart));
        assert.strictEqual(restoredStart.upstreamProvider, 'ollama-share-import');
        assert.strictEqual(restoredStart.mode, 'anthropic-to-ollama');

        const messageRes = await fetch(`${restoredStart.listenUrl}/v1/messages`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen2.5-coder:7b',
                messages: [{ role: 'user', content: [{ type: 'text', text: 'hello' }] }]
            })
        });
        assert.strictEqual(messageRes.status, 200);
        const message = await messageRes.json();
        assert.deepStrictEqual(message.content, [{ type: 'text', text: 'restored ollama ok' }]);
        assert.deepStrictEqual(upstreamRequests.map((item) => `${item.method} ${item.url}`), ['POST /api/chat']);
    } finally {
        await firstController.stopBuiltinClaudeProxyRuntime();
        if (secondController) {
            await secondController.stopBuiltinClaudeProxyRuntime();
        }
        await closeServerForTest(upstream);
        try { require('fs').rmSync(settingsFile, { force: true }); } catch (_) {}
    }
});
