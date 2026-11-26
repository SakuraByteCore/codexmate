const http = require('http');
const https = require('https');
const { modelTestClientHeaders } = require('./model-test-client');
const { buildApiProbeUrlCandidates, extractModelResponseText } = require('./cli-models-utils');

const MAX_PROMPT_LENGTH = 8000;
const MAX_RESPONSE_BYTES = 256 * 1024;
const MAX_OUTPUT_TOKENS = 2048;
const SUPPORTED_APIS = new Set(['responses', 'chat_completions', 'completions', 'anthropic-messages']);
const PI_NON_STANDARD_PROVIDERS = new Set(['cerebras', 'xai', 'zai', 'opencode']);

function buildTestRequest(provider, model, prompt) {
    const api = provider.api;
    if (!SUPPORTED_APIS.has(api)) throw new Error('此配置的接口暂不支持真实测试');
    const paths = { responses: 'responses', chat_completions: 'chat/completions', completions: 'completions', 'anthropic-messages': 'messages' };
    const url = buildApiProbeUrlCandidates(provider.baseUrl, paths[api])[0];
    const key = (provider.apiKey || '').replace(/^Bearer\s+/i, '');
    const authentication = api === 'anthropic-messages'
        ? { 'anthropic-version': '2023-06-01', ...(key ? { 'x-api-key': key } : {}) }
        : key ? { authorization: `Bearer ${key}` } : {};
    const headers = Object.fromEntries([
        ...Object.entries(provider.clientHeaders || {}), ...Object.entries(authentication),
        ...Object.entries(provider.headers || {})
    ].map(([name, value]) => [name.toLowerCase(), value]));
    const maxTokens = Number.isFinite(provider.maxTokens) && provider.maxTokens > 0
        ? Math.min(provider.maxTokens, MAX_OUTPUT_TOKENS) : MAX_OUTPUT_TOKENS;
    let body;
    if (api === 'responses') {
        body = { model, input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }] }],
            store: false, max_output_tokens: maxTokens, stream: false };
        if (provider.target === 'codex') {
            body.instructions = '';
            body.parallel_tool_calls = false;
            if (provider.reasoningEffort) body.reasoning = { effort: provider.reasoningEffort };
            if (provider.reasoningSummary && provider.reasoningSummary !== 'none') {
                body.reasoning = { ...body.reasoning, summary: provider.reasoningSummary };
            }
            if (provider.verbosity) body.text = { verbosity: provider.verbosity };
        }
    } else if (api === 'completions') {
        body = { model, prompt, max_tokens: maxTokens, stream: false };
    } else {
        body = { model, messages: [{ role: 'user', content: prompt }], stream: false };
        const isPiChat = provider.target === 'pi' && api === 'chat_completions';
        const maxTokensField = isPiChat && provider.compat?.maxTokensField !== 'max_tokens' && !url.includes('chutes.ai')
            ? 'max_completion_tokens' : 'max_tokens';
        body[maxTokensField] = maxTokens;
        const isNonStandard = PI_NON_STANDARD_PROVIDERS.has(provider.name) || /cerebras\.ai|api\.x\.ai|chutes\.ai|deepseek\.com|api\.z\.ai|opencode\.ai/.test(url);
        if (isPiChat && (provider.compat?.supportsStore ?? !isNonStandard)) body.store = false;
    }
    return { url, headers, body };
}

function requestModel({ url, headers, body }, { timeoutMs = 0, maxBytes = MAX_RESPONSE_BYTES } = {}) {
    return new Promise((resolve, reject) => {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('供应商地址必须使用 HTTP 或 HTTPS');
        const payload = JSON.stringify(body);
        const transport = parsed.protocol === 'https:' ? https : http;
        // A single request, no probe fallback or retry: a test can incur usage charges.
        const request = transport.request(parsed, { method: 'POST', headers: {
            ...headers, 'Content-Type': 'application/json', Accept: 'application/json', 'Content-Length': Buffer.byteLength(payload)
        } }, response => {
            const chunks = [];
            let size = 0;
            response.on('data', chunk => {
                size += chunk.length;
                if (size > maxBytes) {
                    reject(new Error('回复超过 256 KiB，测试已停止'));
                    response.destroy(); request.destroy(); return;
                }
                chunks.push(chunk);
            });
            response.on('error', reject);
            response.on('aborted', () => reject(new Error('上游回复中断')));
            response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        });
        if (timeoutMs > 0) {
            const timer = setTimeout(() => {
                reject(new Error('测试等待超时'));
                request.destroy();
            }, timeoutMs);
            request.on('close', () => clearTimeout(timer));
        }
        request.on('error', error => reject(new Error(`连接失败：${error.code || 'network-error'}`)));
        request.end(payload);
    });
}

function createModelTestService({ providers, request = requestModel, clientHeaders = modelTestClientHeaders }) {
    function catalog() {
        return Object.fromEntries(['codex', 'pi'].map(target => [target, providers(target).map(provider => ({
            name: provider.name, models: provider.models, supported: SUPPORTED_APIS.has(provider.api)
        }))]));
    }
    async function run(params = {}) {
        const started = Date.now();
        const identity = { target: params.target, provider: params.provider, model: params.model };
        const elapsed = () => Date.now() - started;
        try {
            const { target, provider: name, model, prompt } = params;
            if (!['codex', 'pi'].includes(target)) throw new Error('测试仅支持 Codex 和 Pi');
            if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT_LENGTH) throw new Error('输入 1–8000 字符的测试内容');
            const provider = providers(target).find(entry => entry.name === name);
            if (!provider || !provider.models.includes(model)) throw new Error('请选择已有供应商与模型，刷新后重试');
            if (provider.error) throw new Error(provider.error);
            const selected = { ...provider, ...provider.modelOptions?.[model], target };
            selected.clientHeaders = clientHeaders(target, selected.api);
            const result = await request(buildTestRequest(selected, model, prompt.trim()));
            if (result.status < 200 || result.status >= 300) return { ...identity, ok: false, status: result.status, durationMs: elapsed(), error: `HTTP ${result.status}` };
            let payload;
            try { payload = JSON.parse(result.body); } catch (_) { throw new Error('上游未返回有效 JSON 回复'); }
            if (payload.error) throw new Error('上游返回错误，未生成回复');
            const text = extractModelResponseText(payload);
            if (!text) throw new Error('上游未返回可显示的回复内容');
            const incomplete = payload.status === 'incomplete' || payload.choices?.[0]?.finish_reason === 'length' || payload.stop_reason === 'max_tokens';
            return { ...identity, ok: true, status: result.status, durationMs: elapsed(), text, incomplete,
                responseModel: typeof payload.model === 'string' ? payload.model : model };
        } catch (error) {
            return { ...identity, ok: false, durationMs: elapsed(), error: error.message };
        }
    }
    return { catalog, run };
}

module.exports = { createModelTestService, buildTestRequest, requestModel };
