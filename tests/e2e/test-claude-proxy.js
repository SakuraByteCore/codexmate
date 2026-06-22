const fs = require('fs');
const path = require('path');
const http = require('http');
const { assert, closeServer } = require('./helpers');

function requestRaw(port, pathname, options = {}) {
    return new Promise((resolve, reject) => {
        const body = options.body !== undefined ? JSON.stringify(options.body) : '';
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: pathname,
            method: options.method || (body ? 'POST' : 'GET'),
            headers: {
                ...(options.headers || {}),
                ...(body ? {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                } : {})
            }
        }, (res) => {
            let responseBody = '';
            res.setEncoding('utf-8');
            res.on('data', chunk => responseBody += chunk);
            res.on('end', () => resolve({
                statusCode: res.statusCode || 0,
                headers: res.headers,
                body: responseBody
            }));
        });
        req.on('error', reject);
        if (body) {
            req.write(body);
        }
        req.end();
    });
}

function startClaudeProxyUpstreamServer() {
    const requests = [];
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            let body = '';
            req.setEncoding('utf-8');
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                let parsedBody = null;
                if (body.trim()) {
                    try {
                        parsedBody = JSON.parse(body);
                    } catch (e) {
                        parsedBody = null;
                    }
                }
                requests.push({
                    method: req.method,
                    path: String(req.url || '').split('?')[0],
                    headers: req.headers,
                    body: parsedBody
                });

                const requestPath = String(req.url || '').split('?')[0];
                if (req.method === 'GET' && requestPath === '/v1/models') {
                    const payload = JSON.stringify({
                        data: [{ id: 'gpt-4.1' }, { id: 'gpt-4o-mini' }]
                    });
                    res.writeHead(200, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Content-Length': Buffer.byteLength(payload, 'utf-8')
                    });
                    res.end(payload, 'utf-8');
                    return;
                }

                if (req.method === 'POST' && requestPath === '/v1/responses') {
                    const isToolResponse = parsedBody
                        && Array.isArray(parsedBody.tools)
                        && parsedBody.tools.length > 0;
                    const payload = JSON.stringify({
                        id: 'resp_e2e_1',
                        model: parsedBody && parsedBody.model ? parsedBody.model : 'unknown-model',
                        output: isToolResponse
                            ? [
                                { type: 'message', content: [{ type: 'output_text', text: 'tool ready' }] },
                                { type: 'function_call', call_id: 'toolu_lookup', name: 'lookup', arguments: '{"city":"tokyo"}' }
                            ]
                            : [
                                { type: 'message', content: [{ type: 'output_text', text: 'proxy ok' }] }
                            ],
                        usage: {
                            input_tokens: 23,
                            output_tokens: 11
                        }
                    });
                    res.writeHead(200, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Content-Length': Buffer.byteLength(payload, 'utf-8')
                    });
                    res.end(payload, 'utf-8');
                    return;
                }

                if (req.method === 'POST' && requestPath === '/v1/chat/completions') {
                    if (parsedBody && parsedBody.model === 'error-model') {
                        const payload = JSON.stringify({ error: { message: 'chat upstream failed' } });
                        res.writeHead(502, {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Content-Length': Buffer.byteLength(payload, 'utf-8')
                        });
                        res.end(payload, 'utf-8');
                        return;
                    }
                    const isToolResponse = parsedBody
                        && Array.isArray(parsedBody.tools)
                        && parsedBody.tools.length > 0;
                    const payload = JSON.stringify({
                        id: 'chatcmpl_e2e_1',
                        model: parsedBody && parsedBody.model ? parsedBody.model : 'unknown-model',
                        choices: [{
                            finish_reason: isToolResponse ? 'tool_calls' : 'stop',
                            message: isToolResponse
                                ? {
                                    role: 'assistant',
                                    content: 'chat tool ready',
                                    tool_calls: [{
                                        id: 'call_lookup',
                                        type: 'function',
                                        function: { name: 'lookup', arguments: '{"city":"tokyo"}' }
                                    }]
                                }
                                : { role: 'assistant', content: 'chat proxy ok' }
                        }],
                        usage: {
                            prompt_tokens: 19,
                            completion_tokens: 8
                        }
                    });
                    res.writeHead(200, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Content-Length': Buffer.byteLength(payload, 'utf-8')
                    });
                    res.end(payload, 'utf-8');
                    return;
                }

                const notFound = JSON.stringify({ error: { message: 'not found' } });
                res.writeHead(404, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(notFound, 'utf-8')
                });
                res.end(notFound, 'utf-8');
            });
        });
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve({ server, port: address.port, requests });
        });
    });
}

module.exports = async function testClaudeProxy(ctx) {
    const { api, tmpHome } = ctx;
    const upstream = await startClaudeProxyUpstreamServer();
    const proxyPort = 19000 + Math.floor(Math.random() * 1000);
    try {
        const upstreamUrl = `http://127.0.0.1:${upstream.port}`;
        const addProvider = await api('add-provider', {
            name: 'claude-proxy-e2e',
            url: upstreamUrl,
            key: 'sk-claude-upstream',
            model: 'claude-proxy-e2e-model'
        });
        assert(addProvider.success === true, 'add-provider(claude-proxy-e2e) failed');

        const startResult = await api('claude-proxy-start', {
            host: '127.0.0.1',
            port: proxyPort,
            provider: 'claude-proxy-e2e',
            authSource: 'provider',
            timeoutMs: 5000
        });
        assert(startResult.success === true, 'claude-proxy-start failed');
        assert(startResult.listenUrl === `http://127.0.0.1:${proxyPort}`, 'claude-proxy-start listenUrl mismatch');
        assert(startResult.mode === 'anthropic-to-responses', 'claude-proxy-start mode mismatch');

        const statusResult = await api('claude-proxy-status');
        assert(statusResult.running === true, 'claude-proxy-status should show running');
        assert(statusResult.runtime && statusResult.runtime.upstreamProvider === 'claude-proxy-e2e', 'claude-proxy-status upstream provider mismatch');

        const modelsResponse = await requestRaw(proxyPort, '/v1/models', {
            headers: {
                'x-api-key': 'sk-anthropic-client',
                'anthropic-version': '2023-06-01'
            }
        });
        assert(modelsResponse.statusCode === 200, 'claude proxy /v1/models should succeed');
        const modelsPayload = JSON.parse(modelsResponse.body);
        assert(Array.isArray(modelsPayload.data) && modelsPayload.data.length === 2, 'claude proxy /v1/models should return anthropic model list');
        assert(modelsPayload.data[0].id === 'gpt-4.1', 'claude proxy /v1/models first model mismatch');

        const messageResponse = await requestRaw(proxyPort, '/v1/messages', {
            headers: {
                'x-api-key': 'sk-anthropic-client',
                'anthropic-version': '2023-06-01'
            },
            body: {
                model: 'gpt-4.1',
                max_tokens: 128,
                system: 'system prompt',
                messages: [
                    { role: 'user', content: 'hello proxy' }
                ]
            }
        });
        assert(messageResponse.statusCode === 200, 'claude proxy /v1/messages should succeed');
        const messagePayload = JSON.parse(messageResponse.body);
        assert(messagePayload.type === 'message', 'claude proxy should return anthropic message payload');
        assert(messagePayload.content[0].text === 'proxy ok', 'claude proxy message text mismatch');
        assert(messagePayload.usage.input_tokens === 23, 'claude proxy message usage input mismatch');
        assert(messagePayload.usage.output_tokens === 11, 'claude proxy message usage output mismatch');

        const streamResponse = await requestRaw(proxyPort, '/v1/messages', {
            headers: {
                'x-api-key': 'sk-anthropic-client',
                'anthropic-version': '2023-06-01'
            },
            body: {
                model: 'gpt-4.1',
                max_tokens: 128,
                stream: true,
                messages: [
                    { role: 'user', content: 'call tool please' }
                ],
                tools: [
                    {
                        name: 'lookup',
                        description: 'Lookup city',
                        input_schema: { type: 'object', properties: { city: { type: 'string' } } }
                    }
                ],
                tool_choice: { type: 'tool', name: 'lookup' }
            }
        });
        assert(streamResponse.statusCode === 200, 'claude proxy streamed /v1/messages should succeed');
        assert(String(streamResponse.headers['content-type'] || '').includes('text/event-stream'), 'claude proxy stream should return SSE content type');
        assert(streamResponse.body.includes('event: content_block_delta'), 'claude proxy stream should emit content_block_delta');
        assert(streamResponse.body.includes('tool ready'), 'claude proxy stream should include assistant text delta');
        assert(streamResponse.body.includes('input_json_delta'), 'claude proxy stream should include tool json delta');

        const upstreamMessages = upstream.requests.filter((item) => item.path === '/v1/responses');
        assert(upstreamMessages.length >= 2, 'claude proxy should hit upstream /v1/responses');
        assert(upstreamMessages[0].headers.authorization === 'Bearer sk-claude-upstream', 'claude proxy should use provider auth for upstream');
        assert(upstreamMessages[0].body.instructions === 'system prompt', 'claude proxy should map system prompt to responses instructions');
        assert(upstreamMessages[0].body.max_output_tokens === 128, 'claude proxy should map max_tokens to max_output_tokens');
        assert(Array.isArray(upstreamMessages[0].body.input), 'claude proxy should map anthropic messages into responses input array');
        assert(upstreamMessages[1].body.tool_choice && upstreamMessages[1].body.tool_choice.name === 'lookup', 'claude proxy should map tool_choice to responses tool_choice');
        assert(Array.isArray(upstreamMessages[1].body.tools) && upstreamMessages[1].body.tools[0].type === 'function', 'claude proxy should map anthropic tools into responses tools');

        const stopResult = await api('claude-proxy-stop');
        assert(stopResult.success === true, 'claude-proxy-stop failed');

        const chatStartResult = await api('claude-proxy-start', {
            host: '127.0.0.1',
            port: proxyPort,
            provider: 'claude-proxy-e2e',
            authSource: 'provider',
            targetApi: 'chat_completions',
            timeoutMs: 5000
        });
        assert(chatStartResult.success === true, 'claude-proxy-start chat_completions failed');
        assert(chatStartResult.mode === 'anthropic-to-chat-completions', 'claude-proxy-start chat mode mismatch');

        const chatModelsResponse = await requestRaw(proxyPort, '/v1/models', {
            headers: {
                'x-api-key': 'sk-anthropic-client',
                'anthropic-version': '2023-06-01'
            }
        });
        assert(chatModelsResponse.statusCode === 200, 'claude proxy chat /v1/models should succeed');
        const chatModelsPayload = JSON.parse(chatModelsResponse.body);
        assert(Array.isArray(chatModelsPayload.data) && chatModelsPayload.data[0].id === 'gpt-4.1', 'claude proxy chat /v1/models model list mismatch');

        const chatMessageResponse = await requestRaw(proxyPort, '/v1/messages', {
            headers: {
                'x-api-key': 'sk-anthropic-client',
                'anthropic-version': '2023-06-01'
            },
            body: {
                model: 'DeepSeek-V4-pro',
                max_tokens: 128,
                system: 'system prompt',
                messages: [
                    { role: 'user', content: 'hello chat proxy' }
                ]
            }
        });
        assert(chatMessageResponse.statusCode === 200, 'claude proxy chat /v1/messages should succeed');
        const chatMessagePayload = JSON.parse(chatMessageResponse.body);
        assert(chatMessagePayload.content[0].text === 'chat proxy ok', 'claude proxy chat message text mismatch');
        assert(chatMessagePayload.usage.input_tokens === 19, 'claude proxy chat usage input mismatch');
        assert(chatMessagePayload.usage.output_tokens === 8, 'claude proxy chat usage output mismatch');

        const chatStreamResponse = await requestRaw(proxyPort, '/v1/messages', {
            headers: {
                'x-api-key': 'sk-anthropic-client',
                'anthropic-version': '2023-06-01'
            },
            body: {
                model: 'DeepSeek-V4-pro',
                max_tokens: 128,
                stream: true,
                messages: [{ role: 'user', content: 'call chat tool please' }],
                tools: [{ name: 'lookup', description: 'Lookup city', input_schema: { type: 'object', properties: { city: { type: 'string' } } } }],
                tool_choice: { type: 'tool', name: 'lookup' }
            }
        });
        assert(chatStreamResponse.statusCode === 200, 'claude proxy chat streamed /v1/messages should succeed');
        assert(String(chatStreamResponse.headers['content-type'] || '').includes('text/event-stream'), 'claude proxy chat stream should return SSE content type');
        assert(chatStreamResponse.body.includes('chat tool ready'), 'claude proxy chat stream should include assistant text delta');
        assert(chatStreamResponse.body.includes('input_json_delta'), 'claude proxy chat stream should include tool json delta');

        const chatErrorResponse = await requestRaw(proxyPort, '/v1/messages', {
            headers: {
                'x-api-key': 'sk-anthropic-client',
                'anthropic-version': '2023-06-01'
            },
            body: {
                model: 'error-model',
                max_tokens: 32,
                messages: [{ role: 'user', content: 'trigger upstream error' }]
            }
        });
        assert(chatErrorResponse.statusCode === 502, 'claude proxy chat should preserve upstream error status');
        const chatErrorPayload = JSON.parse(chatErrorResponse.body);
        assert(chatErrorPayload.error && chatErrorPayload.error.message === 'chat upstream failed', 'claude proxy chat should map upstream error message');

        const upstreamChatMessages = upstream.requests.filter((item) => item.path === '/v1/chat/completions');
        assert(upstreamChatMessages.length >= 2, 'claude proxy should hit upstream /v1/chat/completions');
        assert(upstreamChatMessages[0].headers.authorization === 'Bearer sk-claude-upstream', 'claude proxy chat should use provider auth for upstream');
        assert(upstreamChatMessages[0].body.messages[0].role === 'system', 'claude proxy chat should map system prompt to system message');
        assert(upstreamChatMessages[0].body.max_tokens === 128, 'claude proxy chat should map max_tokens to max_tokens');
        assert(upstreamChatMessages[0].body.stream === false, 'claude proxy chat should synthesize Anthropic streaming locally');
        assert(upstreamChatMessages[1].body.tool_choice.function.name === 'lookup', 'claude proxy chat should map tool_choice');

        const chatStopResult = await api('claude-proxy-stop');
        assert(chatStopResult.success === true, 'claude-proxy-stop chat failed');

        const addBridgeProvider = await api('add-provider', {
            name: 'claude-proxy-openai-bridge-e2e',
            url: upstreamUrl,
            key: 'sk-bridge-upstream',
            model: 'gpt-4.1',
            useTransform: true
        });
        assert(addBridgeProvider.success === true, 'add-provider(claude-proxy-openai-bridge-e2e) failed');

        const bridgeSettingsPath = path.join(tmpHome, '.codex', 'codexmate-openai-bridge.json');
        const savedBridgeSettings = fs.readFileSync(bridgeSettingsPath, 'utf-8');
        try {
            fs.writeFileSync(bridgeSettingsPath, JSON.stringify({ providers: {} }, null, 2), 'utf-8');
            const missingBridgeStartResult = await api('claude-proxy-start', {
                host: '127.0.0.1',
                port: proxyPort,
                provider: 'claude-proxy-openai-bridge-e2e',
                authSource: 'provider',
                targetApi: 'chat_completions',
                timeoutMs: 5000
            });
            assert(missingBridgeStartResult.error && missingBridgeStartResult.error.includes('OpenAI 转换未配置'), 'claude proxy should return an explicit error when OpenAI bridge upstream is missing');
            const missingBridgeStatus = await api('claude-proxy-status');
            assert(missingBridgeStatus.running === false, 'failed OpenAI bridge resolution must not start Claude proxy runtime');
        } finally {
            fs.writeFileSync(bridgeSettingsPath, savedBridgeSettings, 'utf-8');
        }

        const bridgeStartResult = await api('claude-proxy-start', {
            host: '127.0.0.1',
            port: proxyPort,
            provider: 'claude-proxy-openai-bridge-e2e',
            authSource: 'provider',
            targetApi: 'chat_completions',
            timeoutMs: 5000
        });
        assert(bridgeStartResult.success === true, 'claude-proxy-start chat_completions bridge failed');
        assert(bridgeStartResult.mode === 'anthropic-to-chat-completions', 'claude proxy bridge chat mode mismatch');

        const bridgeMessageResponse = await requestRaw(proxyPort, '/v1/messages', {
            headers: {
                'x-api-key': 'sk-anthropic-client',
                'anthropic-version': '2023-06-01'
            },
            body: {
                model: 'DeepSeek-V4-pro',
                max_tokens: 64,
                messages: [{ role: 'user', content: 'hello bridge chat proxy' }]
            }
        });
        assert(bridgeMessageResponse.statusCode === 200, 'claude proxy bridge chat /v1/messages should succeed');
        const bridgeMessagePayload = JSON.parse(bridgeMessageResponse.body);
        assert(bridgeMessagePayload.content[0].text === 'chat proxy ok', 'claude proxy bridge chat text mismatch');

        const upstreamBridgeChatMessages = upstream.requests.filter((item) => item.path === '/v1/chat/completions' && item.headers.authorization === 'Bearer sk-bridge-upstream');
        assert(upstreamBridgeChatMessages.length >= 1, 'claude proxy bridge chat should resolve direct OpenAI bridge upstream');

        const bridgeStopResult = await api('claude-proxy-stop');
        assert(bridgeStopResult.success === true, 'claude-proxy-stop bridge chat failed');
    } finally {
        try {
            await api('claude-proxy-stop');
        } catch (_) {}
        try {
            await api('delete-provider', { name: 'claude-proxy-e2e' });
        } catch (_) {}
        try {
            await api('delete-provider', { name: 'claude-proxy-openai-bridge-e2e', allowManaged: true });
        } catch (_) {}
        await closeServer(upstream.server);
    }
};
