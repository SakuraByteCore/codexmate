import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createModelTestService, requestModel } = require('../../lib/model-test');

const provider = { name: 'saved', models: ['model-a'], api: 'responses', baseUrl: 'http://127.0.0.1/v1', apiKey: 'private-test-key' };
const params = { target: 'codex', provider: 'saved', model: 'model-a', prompt: '解释这段代码' };

test('catalogs expose configured models without credentials or upstream URLs; invalid input never calls upstream', async () => {
    let calls = 0;
    const service = createModelTestService({ providers: () => [provider], request: async () => { calls++; } });
    assert.deepEqual(service.catalog().pi, [{ name: 'saved', models: ['model-a'], supported: true }]);
    assert.doesNotMatch(JSON.stringify(service.catalog()), /private-test-key|127\.0\.0\.1/);
    for (const invalid of [{ target: 'claude' }, { provider: 'missing' }, { model: 'missing' }, { prompt: ' ' }, { prompt: 'x'.repeat(8001) }]) {
        assert.equal((await service.run({ ...params, ...invalid })).ok, false);
    }
    assert.equal(calls, 0);
});

test('real POST forwards the user message and configured key; response text and full elapsed time come from upstream', async t => {
    const calls = [];
    const upstream = http.createServer((req, res) => {
        let text = '';
        req.on('data', chunk => { text += chunk; });
        req.on('end', () => {
            calls.push({ path: req.url, authorization: req.headers.authorization, key: req.headers['x-api-key'], userAgent: req.headers['user-agent'], originator: req.headers.originator, body: JSON.parse(text) });
            setTimeout(() => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ model: 'actual-model', output: [{ type: 'message', content: [{ type: 'output_text', text: '**真实回复**\n\n- 一项说明' }] }] }));
            }, 25);
        });
    });
    upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
    t.after(() => new Promise(resolve => upstream.close(resolve)));
    const baseUrl = `http://127.0.0.1:${upstream.address().port}/v1`;
    const service = createModelTestService({ providers: () => [{ ...provider, baseUrl }] });
    const result = await service.run(params);
    assert.equal(result.ok, true); assert.equal(result.responseModel, 'actual-model');
    assert.match(result.text, /真实回复/); assert.ok(result.durationMs >= 25);
    assert.equal(calls.length, 1); assert.equal(calls[0].path, '/v1/responses');
    assert.deepEqual(calls[0].body.input, [{ role: 'user', content: [{ type: 'input_text', text: params.prompt }] }]); assert.equal(calls[0].body.stream, false);
    assert.equal(calls[0].authorization, 'Bearer private-test-key');
    assert.ok(calls[0].userAgent); assert.equal(calls[0].originator, 'codex_cli_rs');
    assert.equal(calls[0].body.store, false); assert.equal(calls[0].body.parallel_tool_calls, false);
    assert.doesNotMatch(JSON.stringify(result), /private-test-key/);
});

test('Pi model overrides select Messages or Chat API without changing the provider', async () => {
    const calls = [];
    const service = createModelTestService({ providers: () => [{ ...provider, modelOptions: { 'model-a': { api: 'anthropic-messages' } } }],
        request: async spec => { calls.push(spec); return { status: 200, body: JSON.stringify({ content: [{ type: 'text', text: '答案' }], stop_reason: 'max_tokens' }) }; } });
    const result = await service.run({ ...params, target: 'pi' });
    assert.equal(result.ok, true); assert.equal(result.incomplete, true);
    assert.match(calls[0].url, /\/v1\/messages$/); assert.equal(calls[0].headers['x-api-key'], provider.apiKey);
    assert.deepEqual(calls[0].body.messages, [{ role: 'user', content: params.prompt }]);
    assert.equal(provider.api, 'responses');
    const chat = createModelTestService({ providers: () => [{ ...provider, api: 'chat_completions' }], request: async spec => {
        assert.match(spec.url, /\/chat\/completions$/);
        return { status: 200, body: '{"choices":[{"message":{"content":"聊天回复"}}]}' };
    } });
    assert.equal((await chat.run({ ...params, target: 'pi' })).text, '聊天回复');
});

test('HTTP failures, invalid replies and unsupported protocols never become successful tests or trigger retries', async () => {
    for (const reply of [{ status: 401, body: 'secret' }, { status: 429, body: '{}' }, { status: 503, body: '{}' }, { status: 200, body: 'not json' }, { status: 200, body: '{}' }]) {
        let calls = 0;
        const service = createModelTestService({ providers: () => [provider], request: async () => { calls++; return reply; } });
        const result = await service.run(params);
        assert.equal(result.ok, false); assert.equal(calls, 1); assert.doesNotMatch(result.error, /secret/);
    }
    const service = createModelTestService({ providers: () => [{ ...provider, api: 'google' }], request: () => assert.fail('unsupported API must not be called') });
    assert.equal((await service.run(params)).ok, false);
});

test('explicit transport deadlines and response size limits close the HTTP request', async t => {
    const upstream = http.createServer((req, res) => {
        if (req.url === '/large') res.end('x'.repeat(1024));
    });
    upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening');
    t.after(() => new Promise(resolve => upstream.close(resolve)));
    const url = `http://127.0.0.1:${upstream.address().port}`;
    await assert.rejects(requestModel({ url: url + '/wait', headers: {}, body: {} }, { timeoutMs: 30 }), /测试等待超时/);
    await assert.rejects(requestModel({ url: url + '/large', headers: {}, body: {} }, { maxBytes: 16 }), /256 KiB/);
});

test('model testing has no default response deadline', () => {
    assert.match(requestModel.toString(), /timeoutMs = 0/);
    assert.match(requestModel.toString(), /if \(timeoutMs > 0\)/);
});

test('Codex identity and configured reasoning parameters accompany the request without conflicting header casing', async () => {
    const calls = [];
    const service = createModelTestService({ providers: () => [{ ...provider, headers: { 'User-Agent': 'custom-codex/1', Originator: 'custom-origin', 'X-Route': 'native' },
        reasoningEffort: 'high', reasoningSummary: 'auto', verbosity: 'low' }],
        clientHeaders: target => { assert.equal(target, 'codex'); return { 'user-agent': 'codex_cli_rs/0.79.0', originator: 'codex_cli_rs' }; },
        request: async spec => { calls.push(spec); return { status: 200, body: '{"output_text":"ok"}' }; } });
    assert.equal((await service.run(params)).ok, true);
    const spec = calls[0];
    assert.equal(spec.headers['user-agent'], 'custom-codex/1'); assert.equal(spec.headers.originator, 'custom-origin');
    assert.equal(spec.headers['x-route'], 'native'); assert.equal(spec.headers.authorization, 'Bearer private-test-key');
    assert.equal(Object.keys(spec.headers).filter(name => name.toLowerCase() === 'user-agent').length, 1);
    assert.deepEqual(spec.body.reasoning, { effort: 'high', summary: 'auto' });
    assert.deepEqual(spec.body.text, { verbosity: 'low' }); assert.equal(spec.body.instructions, '');
    assert.equal(spec.body.store, false); assert.equal(spec.body.stream, false); assert.equal(calls.length, 1);
});

test('Pi follows SDK headers, model token limits and explicit Chat compatibility without Codex identity', async () => {
    const calls = [];
    const service = createModelTestService({ providers: () => [{ ...provider, api: 'chat_completions', modelOptions: {
        'model-a': { maxTokens: 512, compat: { maxTokensField: 'max_tokens', supportsStore: false }, headers: { 'user-agent': 'custom-pi/2' } }
    } }], clientHeaders: (target, api) => {
        assert.equal(target, 'pi'); assert.equal(api, 'chat_completions');
        return { 'user-agent': 'OpenAI/JS 7.19.0', 'x-stainless-package-version': '7.19.0', 'x-stainless-retry-count': '0' };
    }, request: async spec => { calls.push(spec); return { status: 200, body: '{"choices":[{"message":{"content":"ok"}}]}' }; } });
    assert.equal((await service.run({ ...params, target: 'pi' })).ok, true);
    const spec = calls[0]; assert.equal(spec.headers['user-agent'], 'custom-pi/2'); assert.equal(spec.headers['x-stainless-package-version'], '7.19.0');
    assert.equal(spec.headers.originator, undefined); assert.equal(spec.body.max_tokens, 512); assert.equal(spec.body.max_completion_tokens, undefined);
    assert.equal(spec.body.store, undefined); assert.equal(spec.body.stream, false); assert.equal(calls.length, 1);
});

test('standard Pi Chat uses max_completion_tokens and storage opt-out by default', async () => {
    const service = createModelTestService({ providers: () => [{ ...provider, api: 'chat_completions' }], clientHeaders: () => ({ 'user-agent': 'OpenAI/JS 7.19.0' }),
        request: async spec => { assert.equal(spec.body.max_completion_tokens, 2048); assert.equal(spec.body.max_tokens, undefined);
            assert.equal(spec.body.store, false); return { status: 200, body: '{"choices":[{"message":{"content":"ok"}}]}' }; } });
    assert.equal((await service.run({ ...params, target: 'pi' })).ok, true);
});
