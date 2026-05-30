const http = require('http');
const net = require('net');
const crypto = require('crypto');
const toml = require('@iarna/toml');
const { readJsonFile, writeJsonAtomic } = require('../lib/cli-file-utils');
const { isValidHttpUrl, normalizeBaseUrl, joinApiUrl } = require('../lib/cli-utils');
const { toIsoTime } = require('../lib/cli-session-utils');

function createBuiltinProxyRuntimeController(deps = {}) {
    const {
        fs,
        https,
        CONFIG_FILE,
        BUILTIN_PROXY_SETTINGS_FILE,
        DEFAULT_BUILTIN_PROXY_SETTINGS,
        BUILTIN_PROXY_PROVIDER_NAME,
        CODEXMATE_MANAGED_MARKER,
        HTTP_KEEP_ALIVE_AGENT,
        HTTPS_KEEP_ALIVE_AGENT,
        readConfig,
        writeConfig,
        readConfigOrVirtualDefault,
        resolveAuthTokenFromCurrentProfile,
        isPlainObject,
        isBuiltinManagedProvider,
        findProviderSectionRanges,
        findProviderDescendantSectionRanges,
        normalizeLegacySegments,
        buildLegacySegmentsKey,
        formatHostForUrl
    } = deps;

    if (!fs) throw new Error('createBuiltinProxyRuntimeController 缺少 fs');
    if (!https) throw new Error('createBuiltinProxyRuntimeController 缺少 https');
    if (!CONFIG_FILE) throw new Error('createBuiltinProxyRuntimeController 缺少 CONFIG_FILE');
    if (!BUILTIN_PROXY_SETTINGS_FILE) throw new Error('createBuiltinProxyRuntimeController 缺少 BUILTIN_PROXY_SETTINGS_FILE');
    if (!DEFAULT_BUILTIN_PROXY_SETTINGS || typeof DEFAULT_BUILTIN_PROXY_SETTINGS !== 'object') {
        throw new Error('createBuiltinProxyRuntimeController 缺少 DEFAULT_BUILTIN_PROXY_SETTINGS');
    }
    if (!BUILTIN_PROXY_PROVIDER_NAME) throw new Error('createBuiltinProxyRuntimeController 缺少 BUILTIN_PROXY_PROVIDER_NAME');
    if (typeof readConfig !== 'function') throw new Error('createBuiltinProxyRuntimeController 缺少 readConfig');
    if (typeof writeConfig !== 'function') throw new Error('createBuiltinProxyRuntimeController 缺少 writeConfig');
    if (typeof readConfigOrVirtualDefault !== 'function') {
        throw new Error('createBuiltinProxyRuntimeController 缺少 readConfigOrVirtualDefault');
    }
    if (typeof resolveAuthTokenFromCurrentProfile !== 'function') {
        throw new Error('createBuiltinProxyRuntimeController 缺少 resolveAuthTokenFromCurrentProfile');
    }
    if (typeof isPlainObject !== 'function') throw new Error('createBuiltinProxyRuntimeController 缺少 isPlainObject');
    if (typeof isBuiltinManagedProvider !== 'function') {
        throw new Error('createBuiltinProxyRuntimeController 缺少 isBuiltinManagedProvider');
    }
    if (typeof findProviderSectionRanges !== 'function') {
        throw new Error('createBuiltinProxyRuntimeController 缺少 findProviderSectionRanges');
    }
    if (typeof findProviderDescendantSectionRanges !== 'function') {
        throw new Error('createBuiltinProxyRuntimeController 缺少 findProviderDescendantSectionRanges');
    }
    if (typeof normalizeLegacySegments !== 'function') {
        throw new Error('createBuiltinProxyRuntimeController 缺少 normalizeLegacySegments');
    }
    if (typeof buildLegacySegmentsKey !== 'function') {
        throw new Error('createBuiltinProxyRuntimeController 缺少 buildLegacySegmentsKey');
    }
    if (typeof formatHostForUrl !== 'function') throw new Error('createBuiltinProxyRuntimeController 缺少 formatHostForUrl');

    let runtime = null;

    function readRequestBody(req, maxBytes) {
        return new Promise((resolve) => {
            let body = '';
            let size = 0;
            let aborted = false;
            req.on('data', (chunk) => {
                if (aborted) return;
                size += chunk.length;
                if (Number.isFinite(maxBytes) && maxBytes > 0 && size > maxBytes) {
                    aborted = true;
                    try { req.destroy(); } catch (_) {}
                    resolve({ error: '请求体过大' });
                    return;
                }
                body += chunk;
            });
            req.on('end', () => {
                if (aborted) return;
                resolve({ body });
            });
            req.on('error', (err) => resolve({ error: err && err.message ? err.message : 'request failed' }));
        });
    }

    function parseJsonOrError(text) {
        if (typeof text !== 'string' || !text.trim()) {
            return { value: null, error: 'empty body' };
        }
        try {
            return { value: JSON.parse(text), error: '' };
        } catch (e) {
            return { value: null, error: e && e.message ? e.message : 'invalid json' };
        }
    }

    function shouldFallbackFromUpstreamResponses(status, bodyText) {
        if (!Number.isFinite(status)) return false;
        if (status === 404 || status === 405 || status === 501) return true;
        const text = String(bodyText || '');
        if (!text) return false;
        if (/not implemented/i.test(text)) return true;
        if (/convert_request_failed/i.test(text)) return true;
        try {
            const parsed = JSON.parse(text);
            const code = parsed && parsed.error && typeof parsed.error.code === 'string' ? parsed.error.code : '';
            const msg = parsed && parsed.error && typeof parsed.error.message === 'string' ? parsed.error.message : '';
            if (code === 'convert_request_failed') return true;
            if (/not implemented/i.test(msg)) return true;
        } catch (_) {}
        return false;
    }

    function shouldFallbackFromUpstreamResponsesFailure(error) {
        const text = String(error || '').trim();
        if (!text) return false;
        if (/timeout/i.test(text)) return true;
        if (/socket hang up/i.test(text)) return true;
        if (/ECONNRESET/i.test(text)) return true;
        return false;
    }

    function isTransientNetworkError(error) {
        const text = String(error || '').trim();
        if (!text) return false;
        if (/socket hang up/i.test(text)) return true;
        if (/ECONNRESET|ECONNREFUSED|EPIPE|EPROTO|ETIMEDOUT/i.test(text)) return true;
        if (/EAI_AGAIN/i.test(text)) return true;
        if (/UND_ERR_SOCKET/i.test(text)) return true;
        if (/disconnected before|secure tls|tls handshake/i.test(text)) return true;
        return false;
    }

    const TRANSIENT_RETRY_DELAYS_MS = [200, 600, 1200];

    async function retryTransientRequest(executor) {
        let lastResult = null;
        for (let attempt = 0; attempt <= TRANSIENT_RETRY_DELAYS_MS.length; attempt += 1) {
            if (attempt > 0) {
                const delay = TRANSIENT_RETRY_DELAYS_MS[attempt - 1];
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => {
                    const t = setTimeout(r, delay);
                    if (typeof t.unref === 'function') t.unref();
                });
            }
            // eslint-disable-next-line no-await-in-loop
            const result = await executor(attempt);
            lastResult = result;
            if (!result) return result;
            if (result.ok) return result;
            if (result.retry) return result;
            if (result.status && result.status > 0) return result;
            if (!result.retryTransient && !isTransientNetworkError(result.error)) return result;
        }
        return lastResult;
    }

    function proxyRequestJson(targetUrl, options = {}) {
        const parsed = new URL(targetUrl);
        const transport = parsed.protocol === 'https:' ? https : http;
        const bodyText = options.body ? JSON.stringify(options.body) : '';
        const headers = {
            'Accept': 'application/json',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        };
        if (options.body) {
            headers['Content-Length'] = Buffer.byteLength(bodyText, 'utf-8');
        }
        const timeoutMs = Number.isFinite(options.timeoutMs)
            ? Math.max(1000, Number(options.timeoutMs))
            : 30000;

        return new Promise((resolve) => {
            let settled = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };
            const req = transport.request({
                protocol: parsed.protocol,
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                method: options.method || 'GET',
                path: `${parsed.pathname}${parsed.search}`,
                headers,
                agent: parsed.protocol === 'https:' ? HTTPS_KEEP_ALIVE_AGENT : HTTP_KEEP_ALIVE_AGENT
            }, (upstreamRes) => {
                const chunks = [];
                upstreamRes.on('data', (chunk) => chunk && chunks.push(chunk));
                upstreamRes.on('end', () => {
                    const text = chunks.length ? Buffer.concat(chunks).toString('utf-8') : '';
                    finish({
                        ok: true,
                        status: upstreamRes.statusCode || 0,
                        headers: upstreamRes.headers || {},
                        bodyText: text
                    });
                });
            });
            req.setTimeout(timeoutMs, () => {
                try { req.destroy(new Error('timeout')); } catch (_) {}
                finish({ ok: false, error: 'timeout' });
            });
            req.on('error', (err) => finish({ ok: false, error: err && err.message ? err.message : 'request failed' }));
            if (bodyText) {
                req.write(bodyText);
            }
            req.end();
        });
    }

    function buildUpstreamUrlCandidates(baseUrl, pathSuffix) {
        const safeSuffix = String(pathSuffix || '').replace(/^\/+/, '');
        const candidates = [];
        const push = (url) => {
            if (url && !candidates.includes(url)) {
                candidates.push(url);
            }
        };
        push(joinApiUrl(baseUrl, safeSuffix));
        const trimmed = normalizeBaseUrl(baseUrl);
        if (trimmed && safeSuffix) {
            push(`${trimmed}/${safeSuffix}`);
        }
        return candidates;
    }

    async function proxyRequestJsonWithFallbackUrls(baseUrl, pathSuffix, options = {}) {
        const urls = buildUpstreamUrlCandidates(baseUrl, pathSuffix);
        if (urls.length === 0) {
            return { ok: false, error: 'failed to build upstream URL' };
        }
        let lastResult = null;
        for (let index = 0; index < urls.length; index += 1) {
            const result = await retryTransientRequest(() => proxyRequestJson(urls[index], options));
            lastResult = result;
            if (!result.ok) {
                return result;
            }
            if (!(result.status === 404 || result.status === 405)) {
                return result;
            }
        }
        return lastResult || { ok: false, error: 'failed to build upstream URL' };
    }

    function stringifyJsonValue(value, fallback = '') {
        if (typeof value === 'string') return value;
        if (value == null) return fallback;
        try {
            return JSON.stringify(value);
        } catch (_) {
            return fallback;
        }
    }

    function parseJsonValueOrNull(value) {
        if (typeof value !== 'string') return null;
        const text = value.trim();
        if (!text) return null;
        try {
            return JSON.parse(text);
        } catch (_) {
            return null;
        }
    }

    function normalizeChatUsageToResponsesUsage(usage) {
        if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return undefined;
        const pickNumber = (...keys) => {
            for (const key of keys) {
                if (Number.isFinite(usage[key])) return usage[key];
            }
            return undefined;
        };
        const inputTokens = pickNumber('input_tokens', 'prompt_tokens');
        const outputTokens = pickNumber('output_tokens', 'completion_tokens');
        const totalTokens = pickNumber('total_tokens');
        const result = {};
        if (inputTokens != null) result.input_tokens = inputTokens;
        if (outputTokens != null) result.output_tokens = outputTokens;
        if (totalTokens != null) result.total_tokens = totalTokens;
        if (usage.input_tokens_details && typeof usage.input_tokens_details === 'object') {
            result.input_tokens_details = usage.input_tokens_details;
        } else if (usage.prompt_tokens_details && typeof usage.prompt_tokens_details === 'object') {
            result.input_tokens_details = usage.prompt_tokens_details;
        }
        if (usage.output_tokens_details && typeof usage.output_tokens_details === 'object') {
            result.output_tokens_details = usage.output_tokens_details;
        } else if (usage.completion_tokens_details && typeof usage.completion_tokens_details === 'object') {
            result.output_tokens_details = usage.completion_tokens_details;
        }
        return Object.keys(result).length > 0 ? result : usage;
    }

    function mapChatFinishReasonToResponses(choice) {
        const finishReason = choice && typeof choice === 'object' && typeof choice.finish_reason === 'string'
            ? choice.finish_reason
            : '';
        if (finishReason === 'length') {
            return { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } };
        }
        if (finishReason === 'content_filter') {
            return { status: 'incomplete', incomplete_details: { reason: 'content_filter' } };
        }
        return { status: 'completed' };
    }

    function normalizeChatMessageContentToResponsesContent(content, refusal = '') {
        const blocks = [];
        const pushText = (text) => {
            if (typeof text === 'string' && text) {
                blocks.push({ type: 'output_text', text });
            }
        };
        if (typeof content === 'string') {
            pushText(content);
        } else if (Array.isArray(content)) {
            for (const item of content) {
                if (!item) continue;
                if (typeof item === 'string') {
                    pushText(item);
                    continue;
                }
                if (typeof item !== 'object') continue;
                const type = typeof item.type === 'string' ? item.type : '';
                if ((type === 'text' || type === 'output_text') && typeof item.text === 'string') {
                    pushText(item.text);
                    continue;
                }
                if (typeof item.content === 'string') {
                    pushText(item.content);
                }
            }
        }
        if (typeof refusal === 'string' && refusal) {
            blocks.push({ type: 'refusal', refusal });
        }
        return blocks;
    }

    function buildResponsesPayloadFromChatCompletion(payload, fallbackModel = '', options = {}) {
        const base = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
        const choice = Array.isArray(base.choices) ? base.choices[0] : null;
        const message = choice && typeof choice === 'object' && choice.message && typeof choice.message === 'object'
            ? choice.message
            : {};
        const output = [];
        const messageContent = normalizeChatMessageContentToResponsesContent(message.content, message.refusal);
        if (messageContent.length > 0 || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
            output.push({
                type: 'message',
                role: 'assistant',
                content: messageContent.length > 0 ? messageContent : [{ type: 'output_text', text: '' }]
            });
        }
        if (Array.isArray(message.tool_calls)) {
            for (const toolCall of message.tool_calls) {
                const item = buildResponsesToolCallItemFromChatToolCall(toolCall, options.toolTypesByName || {});
                if (item) output.push(item);
            }
        }
        const finish = mapChatFinishReasonToResponses(choice);
        return ensureResponseMetadata({
            id: typeof base.id === 'string' ? base.id : undefined,
            model: typeof base.model === 'string' ? base.model : fallbackModel,
            status: finish.status,
            ...(finish.incomplete_details ? { incomplete_details: finish.incomplete_details } : {}),
            output,
            usage: normalizeChatUsageToResponsesUsage(base.usage)
        });
    }

    function isRecord(value) {
        return !!value && typeof value === 'object' && !Array.isArray(value);
    }

    function asTrimmedString(value) {
        return typeof value === 'string' ? value.trim() : '';
    }

    function cloneJsonValue(value) {
        if (Array.isArray(value)) return value.map((item) => cloneJsonValue(item));
        if (isRecord(value)) {
            return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneJsonValue(item)]));
        }
        return value;
    }

    function normalizeResponsesToolOutput(value) {
        if (typeof value === 'string') return value;
        if (value == null) return '';
        return stringifyJsonValue(value, '');
    }

    function normalizeOpenAiToolArguments(value) {
        if (typeof value === 'string') return value;
        if (value == null) return '{}';
        return stringifyJsonValue(value, '{}');
    }

    function normalizeInputFileBlock(item) {
        if (!isRecord(item)) return null;
        const file = isRecord(item.file) ? item.file : item;
        const out = {};
        const fileId = asTrimmedString(file.file_id || file.id);
        const filename = asTrimmedString(file.filename || file.name);
        const fileData = asTrimmedString(file.file_data || file.data);
        const mimeType = asTrimmedString(file.mime_type || file.media_type);
        if (fileId) out.file_id = fileId;
        if (filename) out.filename = filename;
        if (fileData) out.file_data = fileData;
        if (mimeType) out.mime_type = mimeType;
        return Object.keys(out).length > 0 ? out : null;
    }

    function normalizeResponsesContentBlockForChat(item) {
        if (typeof item === 'string') return item.trim() ? item : null;
        if (!isRecord(item)) return null;

        const type = asTrimmedString(item.type).toLowerCase();
        if (!type) {
            const text = asTrimmedString(item.text || item.content || item.output_text);
            return text ? { type: 'text', text } : null;
        }

        if (type === 'input_text' || type === 'output_text' || type === 'text' || type === 'summary_text' || type === 'reasoning_text') {
            const text = typeof item.text === 'string' ? item.text : asTrimmedString(item.content || item.output_text);
            return text ? { type: 'text', text } : null;
        }

        if (type === 'refusal' && typeof item.refusal === 'string') {
            return item.refusal ? { type: 'text', text: item.refusal } : null;
        }

        if (type === 'input_image') {
            const raw = item.image_url != null ? item.image_url : (item.url != null ? item.url : item.imageUrl);
            if (raw === undefined) return null;
            return {
                type: 'image_url',
                image_url: typeof raw === 'string' ? { url: raw } : cloneJsonValue(raw)
            };
        }

        if (type === 'image_url' && item.image_url !== undefined) {
            return { type: 'image_url', image_url: item.image_url };
        }

        if (type === 'input_audio') {
            if (item.input_audio !== undefined) return { type: 'input_audio', input_audio: item.input_audio };
            if (item.data !== undefined || item.format !== undefined) {
                return { type: 'input_audio', input_audio: { data: item.data, format: item.format } };
            }
            return null;
        }

        if (type === 'input_file' || type === 'file') {
            const file = normalizeInputFileBlock(item);
            return file ? { type: 'file', file } : null;
        }

        if (type === 'reasoning' || type === 'thinking' || type === 'redacted_reasoning') {
            const text = asTrimmedString(item.text || item.content);
            return text ? { type: 'text', text } : null;
        }

        return cloneJsonValue(item);
    }

    function toOpenAiMessageContent(content) {
        if (typeof content === 'string') return content;
        if (!Array.isArray(content)) {
            if (isRecord(content)) {
                const single = normalizeResponsesContentBlockForChat(content);
                if (!single) return '';
                return typeof single === 'string' ? single : [single];
            }
            return '';
        }

        const blocks = content
            .map((item) => normalizeResponsesContentBlockForChat(item))
            .filter((item) => !!item);

        if (blocks.length === 0) return '';
        if (blocks.length === 1 && typeof blocks[0] === 'string') return blocks[0];
        return blocks;
    }

    const RESPONSES_TOOL_CALL_INPUT_TYPES = new Set(['function_call', 'custom_tool_call', 'mcp_tool_call', 'local_shell_call']);
    const RESPONSES_TOOL_CALL_OUTPUT_TYPES = new Set(['function_call_output', 'custom_tool_call_output', 'mcp_tool_call_output', 'tool_search_output', 'local_shell_call_output']);

    function stripOrphanedResponsesToolOutputs(input) {
        if (!Array.isArray(input)) return input;
        const seenToolCallIds = new Set();
        const sanitized = [];
        for (const item of input) {
            if (!isRecord(item)) {
                sanitized.push(item);
                continue;
            }
            const type = asTrimmedString(item.type).toLowerCase();
            if (RESPONSES_TOOL_CALL_INPUT_TYPES.has(type)) {
                const callId = asTrimmedString(item.call_id || item.id);
                if (callId) seenToolCallIds.add(callId);
                sanitized.push(item);
                continue;
            }
            if (RESPONSES_TOOL_CALL_OUTPUT_TYPES.has(type)) {
                const callId = asTrimmedString(item.call_id || item.id);
                if (!callId || !seenToolCallIds.has(callId)) continue;
                sanitized.push(item);
                continue;
            }
            sanitized.push(item);
        }
        return sanitized;
    }

    function normalizeFreeformToolArguments(value) {
        if (typeof value === 'string') return stringifyJsonValue({ input: value }, '{"input":""}');
        if (value == null) return '{"input":""}';
        if (isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'input')) {
            return stringifyJsonValue(value, '{"input":""}');
        }
        return stringifyJsonValue({ input: normalizeResponsesToolOutput(value) }, '{"input":""}');
    }

    function toOpenAiToolCall(item, fallbackIndex) {
        if (!isRecord(item)) return null;
        const callId = asTrimmedString(item.call_id || item.id) || `call_${crypto.randomBytes(8).toString('hex')}_${fallbackIndex}`;
        const name = asTrimmedString(item.name) || asTrimmedString(item.server_label);
        if (!name) return null;
        const type = asTrimmedString(item.type).toLowerCase();
        const rawArguments = item.arguments != null ? item.arguments : item.input;
        const args = type === 'custom_tool_call' && item.arguments == null
            ? normalizeFreeformToolArguments(rawArguments)
            : normalizeOpenAiToolArguments(rawArguments);
        return {
            id: callId,
            type: 'function',
            function: {
                name,
                arguments: args
            }
        };
    }

    function hasOpenAiMessageContent(content) {
        return typeof content === 'string'
            ? content.trim().length > 0
            : Array.isArray(content) && content.length > 0;
    }

    function normalizeResponsesInputToChatMessages(input) {
        // 参考 metapi 的 Responses → Chat 桥接：聚合连续 tool calls、丢弃孤儿 tool outputs，
        // 并保留 reasoning / richer content blocks / developer-role compatibility。
        const messages = [];
        const normalizedInput = stripOrphanedResponsesToolOutputs(input);
        let functionCallIndex = 0;
        let pendingToolCalls = [];
        const emittedToolCallIds = new Set();

        const flushPendingToolCalls = () => {
            if (pendingToolCalls.length <= 0) return;
            for (const toolCall of pendingToolCalls) {
                const callId = asTrimmedString(toolCall.id);
                if (callId) emittedToolCallIds.add(callId);
            }
            messages.push({
                role: 'assistant',
                content: null,
                tool_calls: pendingToolCalls
            });
            pendingToolCalls = [];
        };

        const pushToolOutputMessage = (callIdRaw, outputRaw) => {
            const toolCallId = asTrimmedString(callIdRaw);
            if (!toolCallId) return;
            messages.push({
                role: 'tool',
                tool_call_id: toolCallId,
                content: normalizeResponsesToolOutput(outputRaw)
            });
        };

        const processInputItem = (item) => {
            if (typeof item === 'string') {
                flushPendingToolCalls();
                const text = item.trim();
                if (text) messages.push({ role: 'user', content: text });
                return;
            }
            if (!isRecord(item)) return;

            const itemType = asTrimmedString(item.type).toLowerCase();
            if (itemType === 'function_call' || itemType === 'custom_tool_call') {
                const toolCall = toOpenAiToolCall(item, functionCallIndex);
                functionCallIndex += 1;
                if (toolCall) pendingToolCalls.push(toolCall);
                return;
            }

            if (itemType === 'function_call_output' || itemType === 'custom_tool_call_output') {
                flushPendingToolCalls();
                const toolCallId = asTrimmedString(item.call_id || item.id);
                if (!toolCallId || !emittedToolCallIds.has(toolCallId)) return;
                pushToolOutputMessage(toolCallId, item.output != null ? item.output : item.content);
                return;
            }

            if (itemType === 'reasoning') {
                // Any non-tool-call item is a sequence boundary: keep only consecutive
                // tool calls in the same assistant `tool_calls` message.
                flushPendingToolCalls();
                const reasoningContent = toOpenAiMessageContent(item.summary != null ? item.summary : (item.content != null ? item.content : item));
                const reasoningSignature = asTrimmedString(item.encrypted_content || item.reasoning_signature);
                if (!hasOpenAiMessageContent(reasoningContent) && !reasoningSignature) return;
                const message = { role: 'assistant', content: reasoningContent };
                if (reasoningSignature) message.reasoning_signature = reasoningSignature;
                messages.push(message);
                return;
            }

            flushPendingToolCalls();
            const role = asTrimmedString(item.role).toLowerCase() || 'user';
            const normalizedRole = role === 'developer' ? 'system' : role;
            const content = toOpenAiMessageContent(item.content != null ? item.content : (item.input != null ? item.input : item));

            if (normalizedRole === 'tool') {
                const toolCallId = asTrimmedString(item.tool_call_id || item.call_id || item.id);
                if (!toolCallId || !emittedToolCallIds.has(toolCallId)) return;
                pushToolOutputMessage(toolCallId, item.content);
                return;
            }

            if (!hasOpenAiMessageContent(content)) return;
            const message = { role: normalizedRole, content };
            const phase = asTrimmedString(item.phase);
            if (phase) message.phase = phase;
            messages.push(message);
        };

        if (typeof normalizedInput === 'string') {
            const text = normalizedInput.trim();
            if (text) messages.push({ role: 'user', content: text });
        } else if (Array.isArray(normalizedInput)) {
            for (const item of normalizedInput) processInputItem(item);
        } else if (isRecord(normalizedInput)) {
            processInputItem(normalizedInput);
        }
        flushPendingToolCalls();
        return messages;
    }

    function normalizeFunctionToolForChat(tool) {
        if (!isRecord(tool)) return null;
        const sourceFn = isRecord(tool.function) ? tool.function : tool;
        const name = asTrimmedString(sourceFn.name) || asTrimmedString(tool.name);
        if (!name) return null;
        const fn = { name };
        const description = asTrimmedString(sourceFn.description) || asTrimmedString(tool.description);
        if (description) fn.description = description;
        if (sourceFn.parameters !== undefined) {
            fn.parameters = cloneJsonValue(sourceFn.parameters);
        } else if (tool.parameters !== undefined) {
            fn.parameters = cloneJsonValue(tool.parameters);
        }
        if (typeof sourceFn.strict === 'boolean') {
            fn.strict = sourceFn.strict;
        } else if (typeof tool.strict === 'boolean') {
            fn.strict = tool.strict;
        }
        return { type: 'function', function: fn };
    }

    function buildLocalShellToolForChat(tool) {
        return {
            type: 'function',
            function: {
                name: asTrimmedString(tool && tool.name) || 'local_shell',
                description: asTrimmedString(tool && tool.description) || 'Run a local shell command and return its output.',
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
        };
    }

    function buildFreeformToolForChat(tool, fallbackName = 'custom_tool') {
        return {
            type: 'function',
            function: {
                name: asTrimmedString(tool && tool.name) || fallbackName,
                description: asTrimmedString(tool && tool.description) || 'Pass raw freeform input to the local tool.',
                parameters: {
                    type: 'object',
                    properties: {
                        input: { type: 'string', description: 'Raw tool input.' }
                    },
                    required: ['input'],
                    additionalProperties: false
                }
            }
        };
    }

    const MAX_RESPONSES_TOOL_NAMESPACE_DEPTH = 5;

    function rememberResponsesToolType(tool, target, depth = 0) {
        if (!isRecord(tool) || !target || depth > MAX_RESPONSES_TOOL_NAMESPACE_DEPTH) return;
        const type = asTrimmedString(tool.type).toLowerCase();
        if (type === 'namespace' && Array.isArray(tool.tools)) {
            for (const inner of tool.tools) rememberResponsesToolType(inner, target, depth + 1);
            return;
        }
        const sourceFn = isRecord(tool.function) ? tool.function : tool;
        const name = asTrimmedString(sourceFn.name) || asTrimmedString(tool.name);
        if (!name) return;
        if (type === 'local_shell') {
            target[name] = 'local_shell_call';
            return;
        }
        if (type === 'custom' || type === 'custom_tool' || (!type && name === 'apply_patch')) {
            target[name] = 'custom_tool_call';
            return;
        }
        if (type === 'function') {
            target[name] = 'function_call';
        }
    }

    function collectResponsesToolTypesByName(tools) {
        const result = {};
        if (!Array.isArray(tools)) return result;
        for (const tool of tools) rememberResponsesToolType(tool, result);
        return result;
    }

    function extractFreeformInputFromChatArguments(argumentsText) {
        if (typeof argumentsText !== 'string') return '';
        const parsed = parseJsonValueOrNull(argumentsText);
        if (isRecord(parsed) && Object.prototype.hasOwnProperty.call(parsed, 'input')) {
            return typeof parsed.input === 'string' ? parsed.input : normalizeResponsesToolOutput(parsed.input);
        }
        return argumentsText;
    }

    function extractLocalShellActionFromChatArguments(argumentsText) {
        const parsed = parseJsonValueOrNull(argumentsText);
        if (isRecord(parsed)) return cloneJsonValue(parsed);
        return { cmd: typeof argumentsText === 'string' ? argumentsText : '' };
    }

    function buildResponsesToolCallItemFromChatToolCall(toolCall, toolTypesByName = {}) {
        if (!isRecord(toolCall)) return null;
        const fn = isRecord(toolCall.function) ? toolCall.function : {};
        const name = asTrimmedString(fn.name);
        if (!name) return null;
        const callId = asTrimmedString(toolCall.id) || `call_${crypto.randomBytes(8).toString('hex')}`;
        const argumentsText = typeof fn.arguments === 'string' ? fn.arguments : '';
        const responseType = toolTypesByName && toolTypesByName[name] ? toolTypesByName[name] : 'function_call';
        if (responseType === 'custom_tool_call') {
            return {
                type: 'custom_tool_call',
                call_id: callId,
                name,
                input: extractFreeformInputFromChatArguments(argumentsText)
            };
        }
        if (responseType === 'local_shell_call') {
            return {
                type: 'local_shell_call',
                call_id: callId,
                name,
                action: extractLocalShellActionFromChatArguments(argumentsText)
            };
        }
        return {
            type: 'function_call',
            call_id: callId,
            name,
            arguments: argumentsText
        };
    }

    function normalizeSingleResponsesToolToChatTools(tool, depth = 0) {
        if (!isRecord(tool) || depth > MAX_RESPONSES_TOOL_NAMESPACE_DEPTH) return [];
        const type = asTrimmedString(tool.type).toLowerCase();
        if (type === 'namespace' && Array.isArray(tool.tools)) {
            return tool.tools.flatMap((inner) => normalizeSingleResponsesToolToChatTools(inner, depth + 1));
        }
        if (type === 'function') {
            const converted = normalizeFunctionToolForChat(tool);
            return converted ? [converted] : [];
        }
        if (type === 'local_shell') {
            return [buildLocalShellToolForChat(tool)];
        }
        const name = asTrimmedString(tool.name);
        if (type === 'custom' || type === 'custom_tool' || (!type && name === 'apply_patch')) {
            return [buildFreeformToolForChat(tool, name || 'custom_tool')];
        }
        // Hosted Responses tools such as web_search/image_generation/computer_use
        // do not have a safe Chat Completions representation. Passing them through
        // as-is makes OpenAI-compatible chat gateways reject the request, so drop
        // them instead of pretending the shapes are compatible.
        return [];
    }

    function normalizeResponsesToolsToChatTools(tools) {
        if (!Array.isArray(tools)) return tools;
        return tools.flatMap((tool) => normalizeSingleResponsesToolToChatTools(tool));
    }

    function normalizeResponsesToolChoiceToChatToolChoice(toolChoice) {
        if (toolChoice === undefined) return undefined;
        if (typeof toolChoice === 'string') return toolChoice;
        if (!isRecord(toolChoice)) return toolChoice;

        const type = asTrimmedString(toolChoice.type).toLowerCase();
        if (type === 'tool' || type === 'function' || type === 'custom' || type === 'custom_tool' || type === 'local_shell') {
            if (isRecord(toolChoice.function) && asTrimmedString(toolChoice.function.name)) return cloneJsonValue(toolChoice);
            const name = asTrimmedString(toolChoice.name) || asTrimmedString(toolChoice.server_label);
            if (!name) return 'required';
            return { type: 'function', function: { name } };
        }
        if (type === 'auto' || type === 'none' || type === 'required') return type;
        return 'auto';
    }

    function getChatToolChoiceName(toolChoice) {
        if (!isRecord(toolChoice)) return '';
        if (isRecord(toolChoice.function)) return asTrimmedString(toolChoice.function.name);
        return '';
    }

    function pruneInvalidChatToolChoice(chatBody) {
        if (!isRecord(chatBody) || !Array.isArray(chatBody.tools)) return;
        if (chatBody.tools.length === 0) {
            delete chatBody.tools;
            delete chatBody.tool_choice;
            return;
        }
        const chosenName = getChatToolChoiceName(chatBody.tool_choice);
        if (!chosenName) return;
        const toolNames = new Set(chatBody.tools
            .map((tool) => isRecord(tool) && isRecord(tool.function) ? asTrimmedString(tool.function.name) : '')
            .filter(Boolean));
        if (!toolNames.has(chosenName)) {
            delete chatBody.tool_choice;
        }
    }

    function buildChatCompletionsBodyFromResponsesPayload(payload) {
        const source = isRecord(payload) ? payload : {};
        const messages = normalizeResponsesInputToChatMessages(source.input);
        const instructions = asTrimmedString(source.instructions);
        if (instructions) {
            messages.unshift({ role: 'system', content: instructions });
        }

        const chatBody = {
            model: typeof source.model === 'string' ? source.model : '',
            messages,
            stream: false
        };

        const passthroughKeys = [
            'frequency_penalty',
            'presence_penalty',
            'stop',
            'temperature',
            'top_p',
            'tools',
            'tool_choice',
            'parallel_tool_calls',
            'logprobs',
            'top_logprobs',
            'kbs',
            'is_online',
            'user',
            'seed',
            'n',
            'modalities',
            'audio',
            'reasoning',
            'reasoning_effort',
            'service_tier'
        ];
        for (const key of passthroughKeys) {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                if (key === 'tools') {
                    chatBody[key] = normalizeResponsesToolsToChatTools(source[key]);
                } else if (key === 'tool_choice') {
                    chatBody[key] = normalizeResponsesToolChoiceToChatToolChoice(source[key]);
                } else {
                    chatBody[key] = cloneJsonValue(source[key]);
                }
            }
        }

        if (Object.prototype.hasOwnProperty.call(source, 'response_format')) {
            chatBody.response_format = cloneJsonValue(source.response_format);
        } else if (isRecord(source.text) && source.text.format !== undefined) {
            chatBody.response_format = cloneJsonValue(source.text.format);
        }
        if (isRecord(source.text) && asTrimmedString(source.text.verbosity)) {
            chatBody.verbosity = asTrimmedString(source.text.verbosity);
        }

        pruneInvalidChatToolChoice(chatBody);

        if (Object.prototype.hasOwnProperty.call(source, 'max_tokens')) {
            chatBody.max_tokens = source.max_tokens;
        } else if (source.max_output_tokens != null) {
            chatBody.max_tokens = source.max_output_tokens;
        }

        return chatBody;
    }

    function ensureResponseMetadata(payload) {
        const base = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
        const id = typeof base.id === 'string' && base.id.trim()
            ? base.id.trim()
            : `resp_${crypto.randomBytes(10).toString('hex')}`;
        const model = typeof base.model === 'string' ? base.model : '';
        return {
            object: 'response',
            id,
            model,
            ...base
        };
    }

    function writeSse(res, eventName, dataObj) {
        if (eventName) {
            res.write(`event: ${eventName}\n`);
        }
        if (dataObj === '[DONE]') {
            res.write('data: [DONE]\n\n');
            return;
        }
        res.write(`data: ${JSON.stringify(dataObj)}\n\n`);
    }

    function sendResponsesSse(res, responsePayload) {
        const response = ensureResponseMetadata(responsePayload);
        const responseId = response.id;
        const model = response.model;
        let sequence = 0;
        const nextSeq = () => {
            sequence += 1;
            return sequence;
        };

        writeSse(res, 'response.created', {
            type: 'response.created',
            response: {
                id: responseId,
                model,
                created_at: response.created_at
            }
        });

        const output = Array.isArray(response.output) ? response.output : [];
        for (let outputIndex = 0; outputIndex < output.length; outputIndex += 1) {
            const item = output[outputIndex];
            if (!item || typeof item !== 'object') continue;
            const itemType = typeof item.type === 'string' ? item.type : '';
            const itemId = typeof item.id === 'string' && item.id.trim()
                ? item.id.trim()
                : `item_${crypto.randomBytes(8).toString('hex')}`;

            writeSse(res, 'response.output_item.added', {
                type: 'response.output_item.added',
                output_index: outputIndex,
                item: { ...item, id: itemId }
            });

            if (itemType === 'message') {
                const content = Array.isArray(item.content) ? item.content : [];
                for (let contentIndex = 0; contentIndex < content.length; contentIndex += 1) {
                    const block = content[contentIndex];
                    if (!block || typeof block !== 'object') continue;
                    if (block.type !== 'output_text') continue;
                    const text = typeof block.text === 'string' ? block.text : '';
                    if (text) {
                        writeSse(res, 'response.output_text.delta', {
                            type: 'response.output_text.delta',
                            item_id: itemId,
                            output_index: outputIndex,
                            content_index: contentIndex,
                            delta: text,
                            sequence_number: nextSeq()
                        });
                    }
                    writeSse(res, 'response.output_text.done', {
                        type: 'response.output_text.done',
                        item_id: itemId,
                        output_index: outputIndex,
                        content_index: contentIndex,
                        text,
                        sequence_number: nextSeq()
                    });
                }
            }

            writeSse(res, 'response.output_item.done', {
                type: 'response.output_item.done',
                output_index: outputIndex,
                item: { ...item, id: itemId },
                sequence_number: nextSeq()
            });
        }

        writeSse(res, 'response.completed', { type: 'response.completed', response });
        writeSse(res, 'done', '[DONE]');
    }

    function appendChatStreamToolCall(target, toolCall) {
        if (!toolCall || typeof toolCall !== 'object') return;
        const index = Number.isFinite(toolCall.index) ? toolCall.index : target.length;
        if (!target[index]) {
            target[index] = {
                id: '',
                type: 'function',
                function: { name: '', arguments: '' }
            };
        }
        const current = target[index];
        if (typeof toolCall.id === 'string' && toolCall.id) current.id = toolCall.id;
        if (typeof toolCall.type === 'string' && toolCall.type) current.type = toolCall.type;
        const fn = toolCall.function && typeof toolCall.function === 'object' ? toolCall.function : null;
        if (fn) {
            if (typeof fn.name === 'string' && fn.name) current.function.name = fn.name;
            if (typeof fn.arguments === 'string') current.function.arguments += fn.arguments;
        }
    }

    function writeChatCompletionChunkAsResponsesSse(state, chunk) {
        if (!chunk || typeof chunk !== 'object') return;
        if (typeof chunk.model === 'string' && chunk.model) {
            state.model = chunk.model;
        }
        const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
        for (const choice of choices) {
            const delta = choice && choice.delta && typeof choice.delta === 'object' ? choice.delta : null;
            if (!delta) continue;

            if (typeof delta.content === 'string' && delta.content) {
                if (!state.messageItem) {
                    state.messageItem = {
                        id: `msg_${crypto.randomBytes(8).toString('hex')}`,
                        type: 'message',
                        role: 'assistant',
                        content: [{ type: 'output_text', text: '' }]
                    };
                    state.output.push(state.messageItem);
                    state.outputStarted = true;
                    beginChatStreamResponsesSse(state);
                    writeSse(state.res, 'response.output_item.added', {
                        type: 'response.output_item.added',
                        output_index: state.output.length - 1,
                        item: state.messageItem
                    });
                }
                state.messageText += delta.content;
                state.messageItem.content[0].text = state.messageText;
                writeSse(state.res, 'response.output_text.delta', {
                    type: 'response.output_text.delta',
                    item_id: state.messageItem.id,
                    output_index: state.output.length - 1,
                    content_index: 0,
                    delta: delta.content,
                    sequence_number: state.nextSeq()
                });
            }

            if (Array.isArray(delta.tool_calls)) {
                for (const toolCall of delta.tool_calls) {
                    appendChatStreamToolCall(state.toolCalls, toolCall);
                }
            }
        }
    }

    function stopChatStreamHeartbeat(state) {
        if (!state || !state.heartbeatTimer) return;
        clearInterval(state.heartbeatTimer);
        state.heartbeatTimer = null;
    }

    function startChatStreamHeartbeat(state) {
        if (!state || state.heartbeatTimer) return;
        const timer = setInterval(() => {
            if (state.finished) {
                stopChatStreamHeartbeat(state);
                return;
            }
            const target = state.res;
            if (!target || target.writableEnded || target.destroyed) {
                stopChatStreamHeartbeat(state);
                return;
            }
            try { target.write(': keepalive\n\n'); } catch (_) {}
        }, 15000);
        if (typeof timer.unref === 'function') timer.unref();
        state.heartbeatTimer = timer;
    }

    function finishChatStreamResponsesSse(state) {
        if (state.finished) return;
        beginChatStreamResponsesSse(state);
        state.finished = true;
        stopChatStreamHeartbeat(state);

        if (state.messageItem) {
            const outputIndex = state.output.indexOf(state.messageItem);
            writeSse(state.res, 'response.output_text.done', {
                type: 'response.output_text.done',
                item_id: state.messageItem.id,
                output_index: outputIndex,
                content_index: 0,
                text: state.messageText,
                sequence_number: state.nextSeq()
            });
            writeSse(state.res, 'response.output_item.done', {
                type: 'response.output_item.done',
                output_index: outputIndex,
                item: state.messageItem,
                sequence_number: state.nextSeq()
            });
        }

        for (const toolCall of state.toolCalls) {
            if (!toolCall) continue;
            const item = buildResponsesToolCallItemFromChatToolCall(toolCall, state.toolTypesByName || {});
            if (!item) continue;
            const outputIndex = state.output.length;
            state.output.push(item);
            state.outputStarted = true;
            writeSse(state.res, 'response.output_item.added', {
                type: 'response.output_item.added',
                output_index: outputIndex,
                item
            });
            writeSse(state.res, 'response.output_item.done', {
                type: 'response.output_item.done',
                output_index: outputIndex,
                item,
                sequence_number: state.nextSeq()
            });
        }

        const response = ensureResponseMetadata({
            id: state.responseId,
            model: state.model,
            created_at: state.createdAt,
            status: 'completed',
            output: state.output
        });
        writeSse(state.res, 'response.completed', { type: 'response.completed', response });
        writeSse(state.res, 'done', '[DONE]');
        state.res.end();
    }

    function failResponsesSseRaw(res, message) {
        if (!res || res.writableEnded || res.destroyed) return;
        try {
            writeSse(res, 'response.failed', { type: 'response.failed', error: message || 'upstream stream failed' });
            writeSse(res, 'done', '[DONE]');
            res.end();
        } catch (_) {}
    }

    function beginChatStreamResponsesSse(state) {
        if (!state || state.started) return;
        state.started = true;
        const res = state.res;
        if (!res.headersSent) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no'
            });
        }
        startChatStreamHeartbeat(state);
        if (typeof res.on === 'function' && !state.closeListenerAttached) {
            state.closeListenerAttached = true;
            res.on('close', () => {
                stopChatStreamHeartbeat(state);
                if (!state.finished && state.upstreamReq) {
                    try { state.upstreamReq.destroy(new Error('client aborted')); } catch (_) {}
                }
            });
        }
        writeSse(res, 'response.created', {
            type: 'response.created',
            response: {
                id: state.responseId,
                model: state.model,
                created_at: state.createdAt
            }
        });
    }

    function failChatStreamResponsesSse(state, message) {
        if (!state || state.finished) return;
        beginChatStreamResponsesSse(state);
        state.finished = true;
        stopChatStreamHeartbeat(state);
        failResponsesSseRaw(state.res, message);
    }

    function createChatStreamResponsesSseState(res, model, options = {}) {
        let sequence = 0;
        return {
            res,
            upstreamReq: null,
            responseId: `resp_${crypto.randomBytes(10).toString('hex')}`,
            model: typeof model === 'string' ? model : '',
            createdAt: Math.floor(Date.now() / 1000),
            output: [],
            messageItem: null,
            messageText: '',
            toolCalls: [],
            toolTypesByName: options.toolTypesByName || {},
            finished: false,
            started: false,
            outputStarted: false,
            closeListenerAttached: false,
            nextSeq: () => {
                sequence += 1;
                return sequence;
            }
        };
    }

    function streamChatCompletionsAsResponsesSse(targetUrl, options = {}) {
        const parsed = new URL(targetUrl);
        const transport = parsed.protocol === 'https:' ? https : http;
        const bodyText = options.body ? JSON.stringify(options.body) : '';
        const headers = {
            'Accept': 'text/event-stream',
            ...(options.body ? { 'Content-Type': 'application/json' } : {}),
            ...(options.headers || {})
        };
        if (options.body) {
            headers['Content-Length'] = Buffer.byteLength(bodyText, 'utf-8');
        }
        const timeoutMs = Number.isFinite(options.timeoutMs)
            ? Math.max(1000, Number(options.timeoutMs))
            : 30000;
        const res = options.res;
        const model = typeof options.model === 'string' ? options.model : '';
        const sharedState = options.streamState || createChatStreamResponsesSseState(res, model, {
            toolTypesByName: options.toolTypesByName || {}
        });

        return new Promise((resolve) => {
            let settled = false;
            let streamAccepted = false;
            const finish = (value) => {
                if (settled) return;
                settled = true;
                resolve(value);
            };
            const req = transport.request({
                protocol: parsed.protocol,
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                method: options.method || 'POST',
                path: `${parsed.pathname}${parsed.search}`,
                headers,
                agent: parsed.protocol === 'https:' ? HTTPS_KEEP_ALIVE_AGENT : HTTP_KEEP_ALIVE_AGENT
            }, (upstreamRes) => {
                const status = upstreamRes.statusCode || 0;
                const chunks = [];
                const contentType = String(upstreamRes.headers && upstreamRes.headers['content-type'] || '');
                streamAccepted = status >= 200 && status < 300 && /text\/event-stream/i.test(contentType);
                if (streamAccepted) {
                    req.setTimeout(0);
                }
                let streamState = null;

                const handleAbort = (reason) => {
                    if (settled) return;
                    if (streamState) {
                        if (streamState.outputStarted) {
                            failChatStreamResponsesSse(streamState, reason);
                            finish({ ok: true });
                            return;
                        }
                        finish({ ok: false, retryTransient: true, error: reason || 'upstream stream failed' });
                        return;
                    }
                    if (res.headersSent) {
                        failResponsesSseRaw(res, reason);
                        finish({ ok: true });
                        return;
                    }
                    const bodyText = chunks.length ? Buffer.concat(chunks).toString('utf-8') : '';
                    const transient = isTransientNetworkError(reason) || /aborted|stream aborted/i.test(String(reason || ''));
                    finish({
                        ok: false,
                        ...(transient ? {} : { status }),
                        ...(transient ? { retryTransient: true } : {}),
                        error: reason,
                        bodyText
                    });
                };
                upstreamRes.on('error', (err) => handleAbort(err && err.message ? err.message : 'upstream stream failed'));
                upstreamRes.on('aborted', () => handleAbort('upstream stream aborted'));

                if (status === 404 || status === 405) {
                    upstreamRes.on('data', (chunk) => chunk && chunks.push(chunk));
                    upstreamRes.on('end', () => finish({ retry: true, status, bodyText: chunks.length ? Buffer.concat(chunks).toString('utf-8') : '' }));
                    return;
                }

                if (status >= 400) {
                    upstreamRes.on('data', (chunk) => chunk && chunks.push(chunk));
                    upstreamRes.on('end', () => finish({ ok: false, status, bodyText: chunks.length ? Buffer.concat(chunks).toString('utf-8') : '' }));
                    return;
                }

                if (!/text\/event-stream/i.test(contentType)) {
                    upstreamRes.on('data', (chunk) => chunk && chunks.push(chunk));
                    upstreamRes.on('end', () => {
                        const text = chunks.length ? Buffer.concat(chunks).toString('utf-8') : '';
                        const parsedJson = parseJsonOrError(text);
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream; charset=utf-8',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                            'X-Accel-Buffering': 'no'
                        });
                        if (parsedJson.error) {
                            writeSse(res, 'response.failed', { type: 'response.failed', error: `invalid upstream response: ${parsedJson.error}` });
                            writeSse(res, 'done', '[DONE]');
                            res.end();
                            finish({ ok: true });
                            return;
                        }
                        sendResponsesSse(res, buildResponsesPayloadFromChatCompletion(parsedJson.value, model, {
                            toolTypesByName: options.toolTypesByName || {}
                        }));
                        res.end();
                        finish({ ok: true });
                    });
                    return;
                }

                const state = sharedState;
                state.upstreamReq = req;
                if (!state.model && model) state.model = model;
                streamState = state;
                beginChatStreamResponsesSse(state);

                let buffer = '';
                const handleEventBlock = (block) => {
                    const dataLines = String(block || '')
                        .split(/\r?\n/)
                        .filter((line) => line.startsWith('data:'))
                        .map((line) => line.slice(5).trimStart());
                    if (dataLines.length === 0) return;
                    const data = dataLines.join('\n').trim();
                    if (!data) return;
                    if (data === '[DONE]') {
                        finishChatStreamResponsesSse(state);
                        finish({ ok: true });
                        return;
                    }
                    const parsedChunk = parseJsonOrError(data);
                    if (!parsedChunk.error) {
                        beginChatStreamResponsesSse(state);
                        writeChatCompletionChunkAsResponsesSse(state, parsedChunk.value);
                    }
                };

                upstreamRes.on('data', (chunk) => {
                    buffer += chunk.toString('utf-8');
                    let boundary = buffer.search(/\r?\n\r?\n/);
                    while (boundary >= 0) {
                        const block = buffer.slice(0, boundary);
                        const match = buffer.slice(boundary).match(/^\r?\n\r?\n/);
                        buffer = buffer.slice(boundary + (match ? match[0].length : 2));
                        handleEventBlock(block);
                        boundary = buffer.search(/\r?\n\r?\n/);
                    }
                });
                upstreamRes.on('end', () => {
                    if (buffer.trim()) handleEventBlock(buffer);
                    finishChatStreamResponsesSse(state);
                    finish({ ok: true });
                });
            });
            req.setTimeout(timeoutMs, () => {
                if (streamAccepted) return;
                try { req.destroy(new Error('timeout')); } catch (_) {}
                finish({ ok: false, error: 'timeout' });
            });
            req.on('error', (err) => finish({ ok: false, error: err && err.message ? err.message : 'request failed' }));
            if (bodyText) req.write(bodyText);
            req.end();
        });
    }

    async function streamChatCompletionsAsResponsesSseWithFallbackUrls(baseUrl, pathSuffix, options = {}) {
        const urls = buildUpstreamUrlCandidates(baseUrl, pathSuffix);
        if (urls.length === 0) {
            return { ok: false, error: 'failed to build upstream URL' };
        }
        let lastResult = null;
        const streamState = options.streamState || createChatStreamResponsesSseState(options.res, options.model, {
            toolTypesByName: options.toolTypesByName || {}
        });
        for (const url of urls) {
            const result = await retryTransientRequest(() => streamChatCompletionsAsResponsesSse(url, { ...options, streamState }));
            lastResult = result;
            if (result && result.retry) continue;
            return result;
        }
        return lastResult || { ok: false, error: 'failed to build upstream URL' };
    }

    function canListenPort(host, port) {
        return new Promise((resolve) => {
            const tester = net.createServer();
            tester.unref();
            tester.once('error', () => resolve(false));
            tester.once('listening', () => {
                tester.close(() => resolve(true));
            });
            tester.listen(port, host);
        });
    }

    async function findAvailablePort(host, startPort, maxAttempts = 20) {
        const start = parseInt(String(startPort), 10);
        if (!Number.isFinite(start) || start <= 0) {
            return 0;
        }
        const attempts = Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 20;
        for (let offset = 0; offset < attempts; offset += 1) {
            const candidate = start + offset;
            if (candidate > 65535) {
                break;
            }
            // eslint-disable-next-line no-await-in-loop
            const ok = await canListenPort(host, candidate);
            if (ok) {
                return candidate;
            }
        }
        return 0;
    }

    function resolveBuiltinProxyProviderName(rawProviderName, providers = {}, preferredProvider = '') {
        const providerMap = providers && isPlainObject(providers) ? providers : {};
        const providerNames = Object.keys(providerMap)
            .filter((name) => name && !isBuiltinManagedProvider(name));
        const requested = typeof rawProviderName === 'string' ? rawProviderName.trim() : '';
        if (requested && !isBuiltinManagedProvider(requested) && providerMap[requested]) {
            return requested;
        }
        const preferred = typeof preferredProvider === 'string' ? preferredProvider.trim() : '';
        if (preferred && !isBuiltinManagedProvider(preferred) && providerMap[preferred]) {
            return preferred;
        }
        return providerNames[0] || '';
    }

    function normalizeBuiltinProxySettings(raw) {
        const merged = {
            ...DEFAULT_BUILTIN_PROXY_SETTINGS,
            ...(isPlainObject(raw) ? raw : {})
        };
        const host = typeof merged.host === 'string' ? merged.host.trim() : '';
        const port = parseInt(String(merged.port), 10);
        const provider = typeof merged.provider === 'string' ? merged.provider.trim() : '';
        const authSourceRaw = typeof merged.authSource === 'string' ? merged.authSource.trim().toLowerCase() : '';
        const timeoutMs = parseInt(String(merged.timeoutMs), 10);
        const authSource = authSourceRaw === 'profile' || authSourceRaw === 'none' ? authSourceRaw : 'provider';

        return {
            enabled: merged.enabled !== false,
            host: host || DEFAULT_BUILTIN_PROXY_SETTINGS.host,
            port: Number.isFinite(port) && port > 0 && port <= 65535 ? port : DEFAULT_BUILTIN_PROXY_SETTINGS.port,
            provider,
            authSource,
            timeoutMs: Number.isFinite(timeoutMs) && timeoutMs >= 1000
                ? timeoutMs
                : DEFAULT_BUILTIN_PROXY_SETTINGS.timeoutMs
        };
    }

    function readBuiltinProxySettings() {
        const parsed = readJsonFile(BUILTIN_PROXY_SETTINGS_FILE, null);
        return normalizeBuiltinProxySettings(parsed);
    }

    function saveBuiltinProxySettings(payload = {}, options = {}) {
        const current = readBuiltinProxySettings();
        const merged = normalizeBuiltinProxySettings({
            ...current,
            ...(isPlainObject(payload) ? payload : {})
        });

        if (!merged.host) {
            return { error: '代理 host 不能为空' };
        }
        if (!Number.isFinite(merged.port) || merged.port <= 0 || merged.port > 65535) {
            return { error: '代理端口无效（1-65535）' };
        }

        const { config } = readConfigOrVirtualDefault();
        const providers = config && isPlainObject(config.model_providers) ? config.model_providers : {};
        const preferredProvider = typeof config.model_provider === 'string' ? config.model_provider.trim() : '';
        const finalProvider = resolveBuiltinProxyProviderName(merged.provider, providers, preferredProvider);

        const normalized = {
            ...merged,
            provider: finalProvider
        };

        if (!options.skipWrite) {
            writeJsonAtomic(BUILTIN_PROXY_SETTINGS_FILE, normalized);
        }

        return {
            success: true,
            settings: normalized
        };
    }

    function buildProxyListenUrl(settings) {
        const host = formatHostForUrl(settings.host || DEFAULT_BUILTIN_PROXY_SETTINGS.host);
        return `http://${host}:${settings.port}`;
    }

    function buildBuiltinProxyProviderBaseUrl(settings) {
        return `${buildProxyListenUrl(settings).replace(/\/+$/, '')}/v1`;
    }

    function removePersistedBuiltinProxyProviderFromConfig() {
        if (!fs.existsSync(CONFIG_FILE)) {
            return { success: true, removed: false };
        }

        let config;
        try {
            config = readConfig();
        } catch (e) {
            return { error: e.message || '读取 config.toml 失败' };
        }

        if (!config.model_providers || !config.model_providers[BUILTIN_PROXY_PROVIDER_NAME]) {
            return { success: true, removed: false };
        }

        const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
        const hasBom = content.charCodeAt(0) === 0xFEFF;
        const providerConfig = config.model_providers[BUILTIN_PROXY_PROVIDER_NAME];
        const providerSegments = providerConfig && Array.isArray(providerConfig.__codexmate_legacy_segments)
            ? providerConfig.__codexmate_legacy_segments
            : null;
        const providerSegmentVariants = (() => {
            const variants = [];
            const seen = new Set();
            const pushVariant = (segments) => {
                const normalized = normalizeLegacySegments(segments);
                const key = buildLegacySegmentsKey(normalized);
                if (!key || seen.has(key)) return;
                seen.add(key);
                variants.push(normalized);
            };
            if (providerConfig && Array.isArray(providerConfig.__codexmate_legacy_segments)) {
                pushVariant(providerConfig.__codexmate_legacy_segments);
            }
            if (providerConfig && Array.isArray(providerConfig.__codexmate_legacy_segment_variants)) {
                for (const segments of providerConfig.__codexmate_legacy_segment_variants) {
                    pushVariant(segments);
                }
            }
            if (providerSegments) {
                pushVariant(providerSegments);
            }
            if (variants.length === 0) {
                pushVariant(String(BUILTIN_PROXY_PROVIDER_NAME || '').split('.').filter((item) => item));
            }
            return variants;
        })();

        let updatedContent = null;
        const combinedRanges = [];
        for (const segments of providerSegmentVariants) {
            combinedRanges.push(...findProviderSectionRanges(content, BUILTIN_PROXY_PROVIDER_NAME, segments));
            combinedRanges.push(...findProviderDescendantSectionRanges(content, segments));
        }
        if (combinedRanges.length === 0) {
            combinedRanges.push(...findProviderSectionRanges(content, BUILTIN_PROXY_PROVIDER_NAME, providerSegments));
        }

        if (combinedRanges.length > 0) {
            const sorted = combinedRanges.sort((a, b) => b.start - a.start || b.end - a.end);
            const seen = new Set();
            let removedContent = content;
            for (const range of sorted) {
                const rangeKey = `${range.start}:${range.end}`;
                if (seen.has(rangeKey)) continue;
                seen.add(rangeKey);
                removedContent = removedContent.slice(0, range.start) + removedContent.slice(range.end);
            }
            updatedContent = removedContent.replace(/\n{3,}/g, lineEnding + lineEnding);
        }

        if (!updatedContent) {
            const rebuilt = JSON.parse(JSON.stringify(config));
            delete rebuilt.model_providers[BUILTIN_PROXY_PROVIDER_NAME];
            const hasMarker = content.includes(CODEXMATE_MANAGED_MARKER);
            let rebuiltToml = toml.stringify(rebuilt).trimEnd();
            rebuiltToml = rebuiltToml.replace(/\n/g, lineEnding);
            if (hasMarker && !rebuiltToml.includes(CODEXMATE_MANAGED_MARKER)) {
                rebuiltToml = `${CODEXMATE_MANAGED_MARKER}${lineEnding}${rebuiltToml}`;
            }
            updatedContent = rebuiltToml + lineEnding;
            if (hasBom && updatedContent.charCodeAt(0) !== 0xFEFF) {
                updatedContent = '\uFEFF' + updatedContent;
            }
        }

        try {
            writeConfig(updatedContent.trimEnd() + lineEnding);
        } catch (e) {
            return { error: e.message || '写入 config.toml 失败' };
        }

        return { success: true, removed: true };
    }

    function hasCodexConfigReadyForProxy() {
        const result = readConfigOrVirtualDefault();
        if (!result || result.isVirtual) {
            return false;
        }
        const config = result.config || {};
        if (!isPlainObject(config.model_providers)) {
            return false;
        }
        const providerNames = Object.keys(config.model_providers)
            .filter((name) => name && !isBuiltinManagedProvider(name));
        return providerNames.length > 0;
    }

    function resolveBuiltinProxyUpstream(settings) {
        const { config } = readConfigOrVirtualDefault();
        const providers = config && isPlainObject(config.model_providers) ? config.model_providers : {};
        const currentProvider = typeof config.model_provider === 'string' ? config.model_provider.trim() : '';
        const providerName = resolveBuiltinProxyProviderName(settings.provider, providers, currentProvider);
        if (!providerName) {
            return { error: '未找到可用的上游 provider，请先添加 provider' };
        }
        if (providerName === BUILTIN_PROXY_PROVIDER_NAME) {
            return { error: `上游 provider 不能是 ${BUILTIN_PROXY_PROVIDER_NAME}` };
        }
        const provider = providers[providerName];
        if (!provider || !isPlainObject(provider)) {
            return { error: `上游 provider 不存在: ${providerName}` };
        }

        const baseUrl = typeof provider.base_url === 'string' ? provider.base_url.trim() : '';
        if (!baseUrl || !isValidHttpUrl(baseUrl)) {
            return { error: `上游 provider base_url 无效: ${providerName}` };
        }

        let token = '';
        if (settings.authSource === 'profile') {
            token = resolveAuthTokenFromCurrentProfile();
        } else if (settings.authSource === 'provider') {
            token = typeof provider.preferred_auth_method === 'string' ? provider.preferred_auth_method.trim() : '';
            if (!token) {
                token = resolveAuthTokenFromCurrentProfile();
            }
        }

        let authHeader = '';
        if (token) {
            authHeader = /^bearer\s+/i.test(token) ? token : `Bearer ${token}`;
        }

        return {
            providerName,
            baseUrl: normalizeBaseUrl(baseUrl),
            authHeader
        };
    }

    function createBuiltinProxyServer(settings, upstream) {
        const connections = new Set();
        const timeoutMs = settings.timeoutMs;
        const server = http.createServer((req, res) => {
            let parsedIncoming;
            try {
                parsedIncoming = new URL(req.url || '/', 'http://localhost');
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'invalid request path' }));
                return;
            }

            const remoteAddr = req && req.socket ? req.socket.remoteAddress : '';
            const isLoopback = !remoteAddr
                || remoteAddr === '127.0.0.1'
                || remoteAddr === '::1'
                || remoteAddr === '::ffff:127.0.0.1';
            if (!isLoopback) {
                const expected = typeof process.env.CODEXMATE_HTTP_TOKEN === 'string'
                    ? process.env.CODEXMATE_HTTP_TOKEN.trim()
                    : '';
                if (!expected) {
                    const body = JSON.stringify({ error: 'Remote access is disabled (set CODEXMATE_HTTP_TOKEN)' });
                    res.writeHead(403, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Content-Length': Buffer.byteLength(body, 'utf-8')
                    });
                    res.end(body, 'utf-8');
                    return;
                }
                const headers = req && req.headers && typeof req.headers === 'object' ? req.headers : {};
                const rawAuth = typeof headers.authorization === 'string' ? headers.authorization.trim() : '';
                const match = rawAuth ? rawAuth.match(/^bearer\s+(.+)$/i) : null;
                const actual = match && match[1]
                    ? match[1].trim()
                    : (rawAuth ? rawAuth : (typeof headers['x-codexmate-token'] === 'string' ? String(headers['x-codexmate-token']).trim() : ''));
                if (!actual || actual !== expected) {
                    const body = JSON.stringify({ error: 'Unauthorized' });
                    res.writeHead(401, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Content-Length': Buffer.byteLength(body, 'utf-8')
                    });
                    res.end(body, 'utf-8');
                    return;
                }
            }

            const incomingPath = parsedIncoming.pathname || '/';
            if (incomingPath === '/health' || incomingPath === '/status') {
                const body = JSON.stringify({
                    ok: true,
                    upstreamProvider: upstream.providerName,
                    upstreamBaseUrl: upstream.baseUrl
                });
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body, 'utf-8')
                });
                res.end(body, 'utf-8');
                return;
            }

            if (!(incomingPath === '/v1' || incomingPath.startsWith('/v1/'))) {
                const body = JSON.stringify({ error: 'proxy only supports /v1/* paths' });
                res.writeHead(404, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body, 'utf-8')
                });
                res.end(body, 'utf-8');
                return;
            }

            // Responses shim：
            // - Codex CLI 默认走 /v1/responses（含 SSE）
            // - SSE/streaming 任务优先走 chat/completions fallback，避免卡在会接收但不产出 Responses 的兼容网关
            // - 非流式请求仍优先尝试 /v1/responses（stream=false），失败再转换到 chat/completions 并回包为 responses。
            if ((incomingPath === '/v1/responses' || incomingPath === '/v1/responses/') && (req.method || 'GET').toUpperCase() === 'POST') {
                void (async () => {
                    const { body, error } = await readRequestBody(req, 10 * 1024 * 1024);
                    if (error) {
                        res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error }));
                        return;
                    }
                    const parsed = parseJsonOrError(body);
                    if (parsed.error) {
                        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error: `invalid json: ${parsed.error}` }));
                        return;
                    }

                    const payload = parsed.value && typeof parsed.value === 'object' ? parsed.value : {};
                    const wantsStream = payload.stream === true;

                    const commonHeaders = {
                        ...(upstream.authHeader ? { 'Authorization': upstream.authHeader } : {}),
                        'X-Codexmate-Proxy': '1'
                    };

                    const model = typeof payload.model === 'string' ? payload.model : '';
                    const chatBody = buildChatCompletionsBodyFromResponsesPayload(payload);
                    const toolTypesByName = collectResponsesToolTypesByName(payload.tools);

                    if (wantsStream) {
                        const streamingChatBody = { ...chatBody, stream: true };
                        const streamed = await streamChatCompletionsAsResponsesSseWithFallbackUrls(upstream.baseUrl, 'chat/completions', {
                            method: 'POST',
                            headers: commonHeaders,
                            timeoutMs,
                            body: streamingChatBody,
                            res,
                            model,
                            toolTypesByName
                        });
                        if (!streamed.ok) {
                            if (!res.headersSent) {
                                res.writeHead(streamed.status && streamed.status >= 400 ? streamed.status : 502, { 'Content-Type': 'application/json; charset=utf-8' });
                                res.end(streamed.bodyText || JSON.stringify({ error: streamed.error || 'proxy request failed' }));
                            } else if (!res.writableEnded) {
                                writeSse(res, 'response.failed', { type: 'response.failed', error: streamed.error || streamed.bodyText || 'proxy request failed' });
                                writeSse(res, 'done', '[DONE]');
                                res.end();
                            }
                        }
                        return;
                    }

                    const upstreamResponses = await proxyRequestJsonWithFallbackUrls(upstream.baseUrl, 'responses', {
                        method: 'POST',
                        headers: commonHeaders,
                        timeoutMs,
                        body: { ...payload, stream: false }
                    });

                    // 优先走上游 /responses（如果支持）。若上游报错且不是“端点不支持”，则直接透传错误。
                    if (upstreamResponses.ok && upstreamResponses.status >= 200 && upstreamResponses.status < 300) {
                        const json = parseJsonOrError(upstreamResponses.bodyText);
                        if (json.error) {
                            res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ error: `Upstream JSON parse failed: ${json.error}` }));
                            return;
                        }
                        const responsesPayload = ensureResponseMetadata(json.value);
                        if (wantsStream) {
                            res.writeHead(200, {
                                'Content-Type': 'text/event-stream; charset=utf-8',
                                'Cache-Control': 'no-cache',
                                'Connection': 'keep-alive',
                                'X-Accel-Buffering': 'no'
                            });
                            sendResponsesSse(res, responsesPayload);
                            res.end();
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify(responsesPayload));
                        return;
                    }

                    if (upstreamResponses.ok && upstreamResponses.status >= 400) {
                        if (!shouldFallbackFromUpstreamResponses(upstreamResponses.status, upstreamResponses.bodyText)) {
                            res.writeHead(upstreamResponses.status, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(upstreamResponses.bodyText || JSON.stringify({ error: 'Upstream error' }));
                            return;
                        }
                        // fallthrough to chat/completions conversion
                    }

                    if (!upstreamResponses.ok) {
                        if (!shouldFallbackFromUpstreamResponsesFailure(upstreamResponses.error)) {
                            res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                            res.end(JSON.stringify({ error: upstreamResponses.error || 'Upstream request failed' }));
                            return;
                        }
                        // Some OpenAI-compatible gateways accept /responses but never complete it.
                        // Treat that as an unsupported Responses endpoint and try the chat fallback.
                    }

                    const upstreamChat = await proxyRequestJsonWithFallbackUrls(upstream.baseUrl, 'chat/completions', {
                        method: 'POST',
                        headers: commonHeaders,
                        timeoutMs,
                        body: chatBody
                    });
                    if (!upstreamChat.ok) {
                        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error: upstreamChat.error || 'proxy request failed' }));
                        return;
                    }

                    if (upstreamChat.status >= 400) {
                        res.writeHead(upstreamChat.status, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(upstreamChat.bodyText || JSON.stringify({ error: 'Upstream error' }));
                        return;
                    }

                    const chatJson = parseJsonOrError(upstreamChat.bodyText);
                    if (chatJson.error) {
                        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error: `invalid upstream response: ${chatJson.error}` }));
                        return;
                    }

                    const responsesPayload = buildResponsesPayloadFromChatCompletion(chatJson.value, model, { toolTypesByName });

                    if (wantsStream) {
                        res.writeHead(200, {
                            'Content-Type': 'text/event-stream; charset=utf-8',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                            'X-Accel-Buffering': 'no'
                        });
                        sendResponsesSse(res, responsesPayload);
                        res.end();
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify(responsesPayload));
                })();
                return;
            }

            const suffix = incomingPath === '/v1'
                ? ''
                : incomingPath.replace(/^\/v1\/?/, '');
            const targetBase = joinApiUrl(upstream.baseUrl, suffix);
            if (!targetBase) {
                const body = JSON.stringify({ error: 'failed to build upstream URL' });
                res.writeHead(500, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body, 'utf-8')
                });
                res.end(body, 'utf-8');
                return;
            }

            let targetUrl;
            try {
                targetUrl = new URL(targetBase);
                targetUrl.search = parsedIncoming.search || '';
            } catch (e) {
                const body = JSON.stringify({ error: `invalid upstream URL: ${e.message}` });
                res.writeHead(500, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body, 'utf-8')
                });
                res.end(body, 'utf-8');
                return;
            }

            const requestHeaders = { ...req.headers };
            delete requestHeaders.host;
            delete requestHeaders.connection;
            delete requestHeaders['content-length'];
            if (upstream.authHeader) {
                requestHeaders.authorization = upstream.authHeader;
            }
            requestHeaders['x-codexmate-proxy'] = '1';
            if (!requestHeaders['x-forwarded-for'] && req.socket && req.socket.remoteAddress) {
                requestHeaders['x-forwarded-for'] = req.socket.remoteAddress;
            }

            const transport = targetUrl.protocol === 'https:' ? https : http;
            const upstreamReq = transport.request({
                protocol: targetUrl.protocol,
                hostname: targetUrl.hostname,
                port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
                method: req.method || 'GET',
                path: `${targetUrl.pathname}${targetUrl.search}`,
                headers: requestHeaders,
                agent: targetUrl.protocol === 'https:' ? HTTPS_KEEP_ALIVE_AGENT : HTTP_KEEP_ALIVE_AGENT
            }, (upstreamRes) => {
                const responseHeaders = { ...upstreamRes.headers };
                delete responseHeaders.connection;
                res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
                upstreamRes.pipe(res);
            });

            upstreamReq.setTimeout(timeoutMs, () => {
                upstreamReq.destroy(new Error(`upstream timeout (${timeoutMs}ms)`));
            });

            upstreamReq.on('error', (err) => {
                if (res.headersSent) {
                    try { res.destroy(err); } catch (_) {}
                    return;
                }
                const body = JSON.stringify({ error: `proxy request failed: ${err.message}` });
                res.writeHead(502, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body, 'utf-8')
                });
                res.end(body, 'utf-8');
            });

            req.pipe(upstreamReq);
        });

        server.on('connection', (socket) => {
            connections.add(socket);
            socket.on('close', () => connections.delete(socket));
        });

        return new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(settings.port, settings.host, () => {
                server.removeListener('error', reject);
                resolve({
                    server,
                    connections,
                    settings,
                    upstream,
                    startedAt: toIsoTime(Date.now()),
                    listenUrl: buildProxyListenUrl(settings)
                });
            });
        });
    }

    async function startBuiltinProxyRuntime(payload = {}) {
        if (runtime) {
            return {
                error: '内建代理已在运行',
                runtime: {
                    listenUrl: runtime.listenUrl,
                    upstreamProvider: runtime.upstream.providerName
                }
            };
        }

        const saveResult = saveBuiltinProxySettings(payload);
        if (saveResult.error) {
            return { error: saveResult.error };
        }
        const settings = saveResult.settings;
        const upstream = resolveBuiltinProxyUpstream(settings);
        if (upstream.error) {
            return { error: upstream.error };
        }

        try {
            runtime = await createBuiltinProxyServer(settings, upstream);
            return {
                success: true,
                running: true,
                listenUrl: runtime.listenUrl,
                upstreamProvider: upstream.providerName,
                settings
            };
        } catch (e) {
            return { error: `启动内建代理失败: ${e.message}` };
        }
    }

    async function stopBuiltinProxyRuntime() {
        if (!runtime) {
            return { success: true, running: false };
        }
        const currentRuntime = runtime;
        runtime = null;

        await new Promise((resolve) => {
            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                resolve();
            };

            currentRuntime.server.close(() => finish());
            setTimeout(() => finish(), 1000);
        });

        for (const socket of currentRuntime.connections) {
            try { socket.destroy(); } catch (_) {}
        }
        currentRuntime.connections.clear();

        return {
            success: true,
            running: false
        };
    }

    function getBuiltinProxyStatus() {
        const settings = readBuiltinProxySettings();
        return {
            running: !!runtime,
            settings,
            runtime: runtime
                ? {
                    provider: BUILTIN_PROXY_PROVIDER_NAME,
                    startedAt: runtime.startedAt,
                    listenUrl: runtime.listenUrl,
                    upstreamProvider: runtime.upstream.providerName,
                    upstreamBaseUrl: runtime.upstream.baseUrl
                }
                : null
        };
    }

    return {
        canListenPort,
        findAvailablePort,
        normalizeBuiltinProxySettings,
        readBuiltinProxySettings,
        resolveBuiltinProxyProviderName,
        saveBuiltinProxySettings,
        buildProxyListenUrl,
        buildBuiltinProxyProviderBaseUrl,
        removePersistedBuiltinProxyProviderFromConfig,
        hasCodexConfigReadyForProxy,
        resolveBuiltinProxyUpstream,
        createBuiltinProxyServer,
        startBuiltinProxyRuntime,
        stopBuiltinProxyRuntime,
        getBuiltinProxyStatus
    };
}

module.exports = {
    createBuiltinProxyRuntimeController
};
