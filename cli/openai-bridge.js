const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { StringDecoder } = require('string_decoder');
const { readJsonFile, writeJsonAtomic } = require('../lib/cli-file-utils');
const { isValidHttpUrl, normalizeBaseUrl, joinApiUrl } = require('../lib/cli-utils');

const DEFAULT_BRIDGE_TOKEN = crypto.randomBytes(16).toString('hex');
const SETTINGS_VERSION = 1;
// 推理模型 reasoning 阶段可能长时间无字节输出，需匹配 codex 的 stream_idle_timeout_ms=300000。
const STREAM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const RESPONSES_UNSUPPORTED_TTL_MS = 30 * 60 * 1000;

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeProviderName(value) {
    // Provider name validation is done elsewhere; keep this conservative.
    return normalizeText(value);
}

function normalizeOpenaiUpstreamBaseUrl(rawValue) {
    const normalized = normalizeBaseUrl(rawValue);
    if (!normalized) return '';
    try {
        const parsed = new URL(normalized);
        let pathname = String(parsed.pathname || '').replace(/\/+$/g, '');

        // If user accidentally pasted a full endpoint, strip it back to the base URL.
        // Keep direct provider routes (e.g. /project/ym) intact.
        pathname = pathname
            .replace(/\/v1\/chat\/completions$/i, '/v1')
            .replace(/\/chat\/completions$/i, '')
            .replace(/\/v1\/responses$/i, '/v1')
            .replace(/\/responses$/i, '')
            .replace(/\/v1\/models$/i, '/v1')
            .replace(/\/models$/i, '');

        // Normalize empty/root path.
        if (pathname === '/') pathname = '';

        const rebuilt = `${parsed.origin}${pathname}`;
        return normalizeBaseUrl(rebuilt);
    } catch (_) {
        return normalized;
    }
}

function normalizeUpstreamEntry(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
    }
    const baseUrl = normalizeOpenaiUpstreamBaseUrl(entry.baseUrl || entry.base_url || '');
    const apiKey = normalizeText(entry.apiKey || entry.api_key || entry.key || '');
    const headersRaw = entry.headers || entry.extraHeaders || entry.extra_headers || null;
    const headers = normalizeHeadersMap(headersRaw);
    if (!baseUrl || !isValidHttpUrl(baseUrl)) {
        return null;
    }
    return { baseUrl, apiKey, headers };
}

function normalizeHeadersMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const forbidden = new Set([
        'authorization',
        'host',
        'content-length',
        'connection',
        'transfer-encoding',
        'keep-alive',
        'proxy-authenticate',
        'proxy-authorization',
        'te',
        'trailer',
        'upgrade'
    ]);
    const result = {};
    for (const [rawKey, rawVal] of Object.entries(value)) {
        const key = typeof rawKey === 'string' ? rawKey.trim() : '';
        if (!key) continue;
        const lower = key.toLowerCase();
        if (forbidden.has(lower)) continue;
        if (typeof rawVal !== 'string') continue;
        result[key] = rawVal;
    }
    return result;
}

function readOpenaiBridgeSettings(filePath) {
    const parsed = readJsonFile(filePath, null);
    const providers = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed.providers
        : null;
    const providerMap = providers && typeof providers === 'object' && !Array.isArray(providers)
        ? providers
        : {};
    return {
        version: SETTINGS_VERSION,
        providers: providerMap
    };
}

function upsertOpenaiBridgeProvider(filePath, providerName, upstreamBaseUrl, apiKey, headers) {
    const name = normalizeProviderName(providerName);
    const baseUrl = normalizeOpenaiUpstreamBaseUrl(upstreamBaseUrl);
    const key = normalizeText(apiKey);
    const nextHeaders = normalizeHeadersMap(headers);

    if (!name) {
        return { error: 'Provider name is required' };
    }
    if (!baseUrl || !isValidHttpUrl(baseUrl)) {
        return { error: 'Upstream base URL is invalid' };
    }

    const settings = readOpenaiBridgeSettings(filePath);
    const existing = settings && settings.providers ? settings.providers[name] : null;
    const existingHeaders = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? normalizeHeadersMap(existing.headers || existing.extraHeaders || existing.extra_headers || null)
        : {};
    const next = {
        version: SETTINGS_VERSION,
        providers: {
            ...(settings.providers || {}),
            [name]: {
                baseUrl,
                apiKey: key,
                headers: Object.keys(nextHeaders).length ? nextHeaders : existingHeaders
            }
        }
    };
    writeJsonAtomic(filePath, next);
    return { success: true };
}

function resolveOpenaiBridgeUpstream(filePath, providerName) {
    const name = normalizeProviderName(providerName);
    if (!name) return { error: 'Provider name is required' };
    const settings = readOpenaiBridgeSettings(filePath);
    const entry = settings.providers ? settings.providers[name] : null;
    const normalized = normalizeUpstreamEntry(entry);
    if (!normalized) {
        return { error: `OpenAI 转换未配置: ${name}` };
    }
    return { provider: name, ...normalized };
}

function extractAuthorizationToken(req) {
    const header = typeof req.headers.authorization === 'string' ? req.headers.authorization.trim() : '';
    if (!header) return '';
    if (/^bearer\s+/i.test(header)) {
        return header.replace(/^bearer\s+/i, '').trim();
    }
    return header;
}

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

function extractChatCompletionResult(payload) {
    if (!payload || typeof payload !== 'object') return { text: '', toolCalls: [] };
    const choice = Array.isArray(payload.choices) ? payload.choices[0] : null;
    const message = choice && typeof choice === 'object' ? choice.message : null;
    const toolCalls = message && typeof message === 'object' && Array.isArray(message.tool_calls)
        ? message.tool_calls
        : [];
    const content = message && typeof message === 'object' ? message.content : '';
    let text = '';
    if (typeof content === 'string') {
        text = content;
    } else if (Array.isArray(content)) {
        text = content
            .map((item) => {
                if (!item) return '';
                if (typeof item === 'string') return item;
                if (typeof item === 'object') {
                    if (typeof item.text === 'string') return item.text;
                    if (typeof item.content === 'string') return item.content;
                }
                return '';
            })
            .filter(Boolean)
            .join('');
    }
    return { text, toolCalls };
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

    const text = asTrimmedString(item.text || item.content);
    return text ? { type: 'text', text } : cloneJsonValue(item);
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
    const type = asTrimmedString(item.type).toLowerCase();
    const name = asTrimmedString(item.name)
        || asTrimmedString(item.server_label)
        || (type === 'local_shell_call' ? 'local_shell' : '');
    if (!name) return null;
    const rawArguments = item.arguments != null
        ? item.arguments
        : (item.input != null ? item.input : (item.action != null ? item.action : item.command));
    const args = (type === 'custom_tool_call' && item.arguments == null)
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
    // Keep the OpenAI bridge in lockstep with the builtin proxy's Responses → Chat shim.
    // Codex long-running tasks append richer Responses history (custom/local_shell/MCP calls)
    // back into `input`; dropping those items makes the next model turn lose tool state and stop early.
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
        if (RESPONSES_TOOL_CALL_INPUT_TYPES.has(itemType)) {
            const toolCall = toOpenAiToolCall(item, functionCallIndex);
            functionCallIndex += 1;
            if (toolCall) pendingToolCalls.push(toolCall);
            return;
        }

        if (RESPONSES_TOOL_CALL_OUTPUT_TYPES.has(itemType)) {
            flushPendingToolCalls();
            const toolCallId = asTrimmedString(item.call_id || item.id);
            if (!toolCallId || !emittedToolCallIds.has(toolCallId)) return;
            pushToolOutputMessage(toolCallId, item.output != null ? item.output : item.content);
            return;
        }

        if (itemType === 'reasoning') {
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

function normalizeResponsesToolsForResponsesApi(tools) {
    if (!Array.isArray(tools)) return tools;
    return tools
        .map((tool) => {
            const converted = normalizeFunctionToolForChat(tool);
            if (!converted || !converted.function) return null;
            const out = {
                type: 'function',
                name: converted.function.name
            };
            if (converted.function.description !== undefined) out.description = converted.function.description;
            if (converted.function.parameters !== undefined) out.parameters = converted.function.parameters;
            if (converted.function.strict !== undefined) out.strict = converted.function.strict;
            return out;
        })
        .filter(Boolean);
}

function mergeLeadingSystemMessages(messages, leadingInstructions) {
    const segments = [];
    const seen = new Set();
    const pushSegment = (text) => {
        const trimmed = typeof text === 'string' ? text.trim() : '';
        if (!trimmed || seen.has(trimmed)) return;
        seen.add(trimmed);
        segments.push(trimmed);
    };
    if (typeof leadingInstructions === 'string') {
        pushSegment(leadingInstructions);
    }
    const rest = [];
    for (const msg of messages) {
        if (msg && msg.role === 'system') {
            const content = msg.content;
            if (typeof content === 'string') {
                pushSegment(content);
            } else if (Array.isArray(content)) {
                for (const part of content) {
                    if (part && typeof part === 'object' && typeof part.text === 'string') {
                        pushSegment(part.text);
                    }
                }
            }
            continue;
        }
        rest.push(msg);
    }
    const out = [];
    if (segments.length) {
        out.push({ role: 'system', content: segments.join('\n\n---\n\n') });
    }
    for (const msg of rest) out.push(msg);
    return out;
}

function messageContentAsText(content) {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
        .map((item) => {
            if (typeof item === 'string') return item;
            if (!isRecord(item)) return '';
            if (typeof item.text === 'string') return item.text;
            if (typeof item.content === 'string') return item.content;
            return '';
        })
        .filter(Boolean)
        .join('\n');
}

function hasRunningCodexExecSession(messages) {
    if (!Array.isArray(messages)) return false;
    return messages.some((message) => {
        if (!isRecord(message) || message.role !== 'tool') return false;
        return /Process running with session ID\s+\d+/i.test(messageContentAsText(message.content));
    });
}

function appendChatFallbackRuntimeInstructions(baseInstructions, rawMessages) {
    const segments = [];
    const base = typeof baseInstructions === 'string' ? baseInstructions.trim() : '';
    if (base) segments.push(base);
    if (hasRunningCodexExecSession(rawMessages)) {
        segments.push('Codex tool output indicates a command is still running ("Process running with session ID ..."). You must call write_stdin with that numeric session_id and empty chars to poll/wait for completion before giving a final answer. Do not merely say that you are waiting.');
    }
    return segments.join('\n\n');
}

function convertResponsesRequestToChatCompletions(payload) {
    const body = payload && typeof payload === 'object' ? payload : {};
    const model = typeof body.model === 'string' ? body.model.trim() : '';
    if (!model) {
        return { error: 'responses 请求缺少 model' };
    }

    const rawMessages = normalizeResponsesInputToChatMessages(body.input);
    const leadingInstructions = appendChatFallbackRuntimeInstructions(body.instructions, rawMessages);
    // codex 同时下发 body.instructions（内置 prompt）与 input 内 developer/system 消息（AGENTS.md）。
    // 合流为一条领头 system，避免某些上游"只认第一条 system"导致 AGENTS.md 失效。
    const messages = mergeLeadingSystemMessages(rawMessages, leadingInstructions);
    if (!messages.length) {
        // codex sometimes sends empty input for probes; tolerate.
        messages.push({ role: 'user', content: '' });
    }

    const maxOutputTokens = Number.parseInt(String(body.max_output_tokens), 10);
    const stream = body.stream === true;

    const chat = {
        model,
        messages,
        stream: false,
        temperature: Number.isFinite(body.temperature) ? Number(body.temperature) : undefined,
        top_p: Number.isFinite(body.top_p) ? Number(body.top_p) : undefined,
        max_tokens: Number.isFinite(maxOutputTokens) && maxOutputTokens > 0 ? maxOutputTokens : undefined
    };
    if (Array.isArray(body.stop) && body.stop.length) {
        chat.stop = body.stop.filter((item) => typeof item === 'string' && item.trim());
    }
    if (Array.isArray(body.tools) && body.tools.length) {
        chat.tools = normalizeResponsesToolsToChatTools(body.tools);
    }
    if (body.tool_choice !== undefined) {
        chat.tool_choice = normalizeResponsesToolChoiceToChatToolChoice(body.tool_choice);
    }
    if (body.response_format !== undefined) {
        chat.response_format = body.response_format;
    }
    if (body.metadata !== undefined) {
        chat.metadata = body.metadata;
    }

    pruneInvalidChatToolChoice(chat);

    // Remove undefined keys
    Object.keys(chat).forEach((key) => chat[key] === undefined && delete chat[key]);

    return { chat, streamRequested: stream, toolTypesByName: collectResponsesToolTypesByName(body.tools) };
}

function buildResponsesPayloadFromChatResult(model, text, toolCalls, upstreamPayload, options = {}) {
    const responseId = `resp_${crypto.randomBytes(10).toString('hex')}`;
    const usage = upstreamPayload && upstreamPayload.usage && typeof upstreamPayload.usage === 'object'
        ? upstreamPayload.usage
        : null;
    const createdAt = Math.floor(Date.now() / 1000);
    const output = [];
    const trimmedText = typeof text === 'string' ? text : '';
    if (trimmedText) {
        output.push({
            id: `msg_${crypto.randomBytes(8).toString('hex')}`,
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: trimmedText }]
        });
    }

    // Convert chat.completions tool_calls back into the original Responses item type.
    // Treating every call as `function_call` makes Codex built-ins (custom/local_shell)
    // degrade into ordinary chat text instead of executable agent steps.
    if (Array.isArray(toolCalls)) {
        for (const call of toolCalls) {
            const item = buildResponsesToolCallItemFromChatToolCall(call, options.toolTypesByName || {});
            if (item) output.push(item);
        }
    }

    const payload = {
        id: responseId,
        object: 'response',
        model,
        created_at: createdAt,
        status: 'completed',
        output,
        output_text: trimmedText
    };

    if (usage) {
        // Map chat.completions usage -> responses usage shape when possible.
        const promptTokens = Number.isFinite(usage.prompt_tokens) ? Number(usage.prompt_tokens) : null;
        const completionTokens = Number.isFinite(usage.completion_tokens) ? Number(usage.completion_tokens) : null;
        const totalTokens = Number.isFinite(usage.total_tokens) ? Number(usage.total_tokens) : null;
        if (promptTokens !== null || completionTokens !== null || totalTokens !== null) {
            payload.usage = {
                input_tokens: promptTokens ?? undefined,
                output_tokens: completionTokens ?? undefined,
                total_tokens: totalTokens ?? undefined
            };
            Object.keys(payload.usage).forEach((key) => payload.usage[key] === undefined && delete payload.usage[key]);
        } else {
            payload.usage = usage;
        }
    }

    return payload;
}

function ensureResponseMetadata(response) {
    const payload = response && typeof response === 'object' ? response : {};
    if (typeof payload.object !== 'string' || !payload.object.trim()) {
        payload.object = 'response';
    }
    if (typeof payload.created_at !== 'number') {
        payload.created_at = Math.floor(Date.now() / 1000);
    }
    if (typeof payload.status !== 'string' || !payload.status.trim()) {
        payload.status = 'completed';
    }
    if (!Array.isArray(payload.output)) {
        payload.output = [];
    }
    return payload;
}

function sendResponsesSse(res, responsePayload) {
    const response = ensureResponseMetadata(responsePayload);
    const responseId = typeof response.id === 'string' && response.id.trim()
        ? response.id.trim()
        : `resp_${crypto.randomBytes(10).toString('hex')}`;
    const model = typeof response.model === 'string' ? response.model : '';

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
            : (typeof item.call_id === 'string' && item.call_id.trim() ? item.call_id.trim() : `item_${crypto.randomBytes(8).toString('hex')}`);

        // Emit item added so Codex can anchor subsequent deltas by output_index/content_index/item_id.
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

        // Emit item done for all item types (message/function_call/etc).
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

function extractResponsesOutputText(payload) {
    if (!payload || typeof payload !== 'object') return '';
    const output = Array.isArray(payload.output) ? payload.output : [];
    for (const item of output) {
        if (!item || typeof item !== 'object') continue;
        if (item.type !== 'message') continue;
        const content = Array.isArray(item.content) ? item.content : [];
        for (const block of content) {
            if (!block || typeof block !== 'object') continue;
            if (block.type !== 'output_text') continue;
            if (typeof block.text === 'string') return block.text;
        }
    }
    if (typeof payload.output_text === 'string') return payload.output_text;
    return '';
}

function toUpstreamNonStreamingResponsesPayload(payload) {
    const body = payload && typeof payload === 'object' ? payload : {};
    const normalized = { ...body, stream: false };
    if (Array.isArray(body.tools)) {
        normalized.tools = normalizeResponsesToolsForResponsesApi(body.tools);
    }
    return normalized;
}

function shouldFallbackFromUpstreamResponses(status, bodyText) {
    if (!Number.isFinite(status)) return false;
    // Common "unsupported" status codes for a route.
    if (status === 404 || status === 405 || status === 501) return true;

    // Some OpenAI-compatible gateways respond with 500 + "not implemented" (e.g. convert_request_failed)
    // instead of 404/405 for unsupported endpoints. In that case we can safely fallback to chat/completions.
    const text = String(bodyText || '');
    if (!text) return false;
    if (/not implemented/i.test(text)) return true;
    if (/convert_request_failed/i.test(text)) return true;
    if (/unknown (endpoint|route)/i.test(text)) return true;
    if (/unsupported.*\/?v1\/responses/i.test(text)) return true;
    if (/does not support.*responses/i.test(text)) return true;
    if (/name['"`]?\s+is a required property/i.test(text) && /tools/i.test(text) && /function/i.test(text)) return true;

    // Best-effort parse for structured error codes.
    try {
        const parsed = JSON.parse(text);
        const code = parsed && parsed.error && typeof parsed.error.code === 'string' ? parsed.error.code : '';
        const msg = parsed && parsed.error && typeof parsed.error.message === 'string' ? parsed.error.message : '';
        if (code === 'convert_request_failed') return true;
        if (/not implemented/i.test(msg)) return true;
        if (/unknown (endpoint|route)/i.test(msg)) return true;
        if (/unsupported.*\/?v1\/responses/i.test(msg)) return true;
        if (/does not support.*responses/i.test(msg)) return true;
        if (/name['"`]?\s+is a required property/i.test(msg) && /tools/i.test(msg) && /function/i.test(msg)) return true;
    } catch (_) {}

    return false;
}

// 仅识别"端点级别不支持"——可缓存，与 per-request 的 tool 格式错误区分。
function isResponsesEndpointUnsupported(status, bodyText) {
    if (!Number.isFinite(status)) return false;
    if (status === 404 || status === 405 || status === 501) return true;
    const text = String(bodyText || '');
    if (!text) return false;
    if (/not implemented/i.test(text)) return true;
    if (/convert_request_failed/i.test(text)) return true;
    if (/unknown (endpoint|route)/i.test(text)) return true;
    if (/unsupported.*\/?v1\/responses/i.test(text)) return true;
    if (/does not support.*responses/i.test(text)) return true;
    try {
        const parsed = JSON.parse(text);
        const code = parsed && parsed.error && typeof parsed.error.code === 'string' ? parsed.error.code : '';
        const msg = parsed && parsed.error && typeof parsed.error.message === 'string' ? parsed.error.message : '';
        if (code === 'convert_request_failed') return true;
        if (/not implemented/i.test(msg)) return true;
        if (/unknown (endpoint|route)/i.test(msg)) return true;
        if (/unsupported.*\/?v1\/responses/i.test(msg)) return true;
        if (/does not support.*responses/i.test(msg)) return true;
    } catch (_) {}
    return false;
}

function isLoopbackAddress(address) {
    if (!address) return false;
    const value = String(address);
    return value === '127.0.0.1' || value === '::1' || value === '::ffff:127.0.0.1';
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

const TRANSIENT_RETRY_DELAYS_MS = [200, 600];

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
        if (!isTransientNetworkError(result.error)) return result;
    }
    return lastResult;
}

function writeSse(res, eventName, dataObj) {
    if (!res || res.writableEnded || res.destroyed) return;
    if (eventName) {
        res.write(`event: ${eventName}\n`);
    }
    if (dataObj === '[DONE]') {
        res.write('data: [DONE]\n\n');
        return;
    }
    res.write(`data: ${JSON.stringify(dataObj)}\n\n`);
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

        const segments = [];
        // DeepSeek-style OpenAI-compatible streams may emit private reasoning in
        // `reasoning_content` before the final answer. Responses `output_text`
        // must stay user-visible answer text only; forwarding reasoning here
        // pollutes Codex output and breaks exact-answer prompts.
        if (typeof delta.content === 'string' && delta.content) {
            segments.push(delta.content);
        }
        for (const seg of segments) {
            if (!state.messageItem) {
                state.messageItem = {
                    id: `msg_${crypto.randomBytes(8).toString('hex')}`,
                    type: 'message',
                    role: 'assistant',
                    content: [{ type: 'output_text', text: '' }]
                };
                state.output.push(state.messageItem);
                writeSse(state.res, 'response.output_item.added', {
                    type: 'response.output_item.added',
                    output_index: state.output.length - 1,
                    item: state.messageItem
                });
            }
            state.messageText += seg;
            state.messageItem.content[0].text = state.messageText;
            writeSse(state.res, 'response.output_text.delta', {
                type: 'response.output_text.delta',
                item_id: state.messageItem.id,
                output_index: state.output.length - 1,
                content_index: 0,
                delta: seg,
                sequence_number: state.nextSeq()
            });
        }

        if (Array.isArray(delta.tool_calls)) {
            for (const toolCall of delta.tool_calls) {
                appendChatStreamToolCall(state.toolCalls, toolCall);
            }
        }

        if (typeof choice.finish_reason === 'string' && choice.finish_reason) {
            state.sawFinishReason = true;
        }
    }
}

function finishChatStreamResponsesSse(state) {
    if (!state || state.finished) return;
    state.finished = true;

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
        output: state.output,
        output_text: state.messageText
    });
    writeSse(state.res, 'response.completed', { type: 'response.completed', response });
    writeSse(state.res, 'done', '[DONE]');
    if (!state.res.writableEnded && !state.res.destroyed) {
        state.res.end();
    }
}

function failChatStreamResponsesSse(state, errorMessage) {
    if (!state || state.finished) return;
    state.finished = true;
    writeSse(state.res, 'response.failed', {
        type: 'response.failed',
        response: ensureResponseMetadata({
            id: state.responseId,
            model: state.model,
            created_at: state.createdAt,
            status: 'failed',
            output: state.output,
            output_text: state.messageText
        }),
        error: String(errorMessage || 'upstream stream failed')
    });
    writeSse(state.res, 'done', '[DONE]');
    if (!state.res.writableEnded && !state.res.destroyed) {
        state.res.end();
    }
}

function formatUpstreamStreamError(errorValue) {
    if (!errorValue) return 'upstream stream failed';
    if (typeof errorValue === 'string') return errorValue;
    if (typeof errorValue === 'object') {
        if (typeof errorValue.message === 'string' && errorValue.message) return errorValue.message;
        try { return JSON.stringify(errorValue); } catch (_) {}
    }
    return String(errorValue || 'upstream stream failed');
}

function streamChatCompletionsAsResponsesSse(targetUrl, options = {}) {
    const parsed = new URL(targetUrl);
    const transport = parsed.protocol === 'https:' ? https : http;
    const bodyText = options.body ? JSON.stringify(options.body) : '';
    const maxBytes = Number.isFinite(options.maxBytes) && options.maxBytes > 0
        ? Math.floor(options.maxBytes)
        : 0;
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
        : STREAM_IDLE_TIMEOUT_MS;
    const res = options.res;
    const fallbackModel = typeof options.model === 'string' ? options.model : '';

    return new Promise((resolve) => {
        let settled = false;
        let upstreamReq = null;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        const abortUpstream = () => {
            if (upstreamReq) {
                try { upstreamReq.destroy(new Error('client aborted')); } catch (_) {}
            }
        };
        if (res && typeof res.once === 'function') {
            res.once('close', abortUpstream);
        }

        upstreamReq = transport.request({
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            method: options.method || 'POST',
            path: `${parsed.pathname}${parsed.search}`,
            headers,
            agent: parsed.protocol === 'https:' ? options.httpsAgent : options.httpAgent
        }, (upstreamRes) => {
            const status = upstreamRes.statusCode || 0;
            const chunks = [];
            let size = 0;
            const contentType = String(upstreamRes.headers && upstreamRes.headers['content-type'] || '');

            const collectChunk = (chunk) => {
                if (!chunk) return true;
                if (maxBytes > 0) {
                    size += chunk.length;
                    if (size > maxBytes) {
                        chunks.length = 0;
                        try { upstreamRes.destroy(new Error('response too large')); } catch (_) {}
                        try { upstreamReq.destroy(new Error('response too large')); } catch (_) {}
                        finish({ ok: false, status, error: 'response too large' });
                        return false;
                    }
                }
                chunks.push(chunk);
                return true;
            };

            if (status >= 400) {
                upstreamRes.on('data', collectChunk);
                upstreamRes.on('end', () => finish({
                    ok: false,
                    status,
                    bodyText: chunks.length ? Buffer.concat(chunks).toString('utf-8') : ''
                }));
                return;
            }

            if (!res.headersSent) {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no'
                });
                if (typeof res.flushHeaders === 'function') res.flushHeaders();
            }

            if (!/text\/event-stream/i.test(contentType)) {
                upstreamRes.on('data', collectChunk);
                upstreamRes.on('end', () => {
                    const text = chunks.length ? Buffer.concat(chunks).toString('utf-8') : '';
                    const parsedJson = parseJsonOrError(text);
                    if (parsedJson.error) {
                        writeSse(res, 'response.failed', { type: 'response.failed', error: `invalid upstream response: ${parsedJson.error}` });
                        writeSse(res, 'done', '[DONE]');
                        if (!res.writableEnded && !res.destroyed) res.end();
                        finish({ ok: true });
                        return;
                    }
                    const extracted = extractChatCompletionResult(parsedJson.value);
                    sendResponsesSse(res, buildResponsesPayloadFromChatResult(fallbackModel, extracted.text, extracted.toolCalls, parsedJson.value, {
                        toolTypesByName: options.toolTypesByName || {}
                    }));
                    if (!res.writableEnded && !res.destroyed) res.end();
                    finish({ ok: true });
                });
                return;
            }

            let sequence = 0;
            const state = {
                res,
                responseId: `resp_${crypto.randomBytes(10).toString('hex')}`,
                model: fallbackModel,
                createdAt: Math.floor(Date.now() / 1000),
                output: [],
                messageItem: null,
                messageText: '',
                toolCalls: [],
                toolTypesByName: options.toolTypesByName || {},
                finished: false,
                sawDone: false,
                sawFinishReason: false,
                nextSeq: () => {
                    sequence += 1;
                    return sequence;
                }
            };
            writeSse(res, 'response.created', {
                type: 'response.created',
                response: {
                    id: state.responseId,
                    model: state.model,
                    created_at: state.createdAt
                }
            });

            let buffer = '';
            const utf8Decoder = new StringDecoder('utf8');
            const handleEventBlock = (block) => {
                const dataLines = String(block || '')
                    .split(/\r?\n/)
                    .filter((line) => line.startsWith('data:'))
                    .map((line) => line.slice(5).trimStart());
                if (dataLines.length === 0) return;
                const data = dataLines.join('\n').trim();
                if (!data) return;
                if (data === '[DONE]') {
                    state.sawDone = true;
                    finishChatStreamResponsesSse(state);
                    finish({ ok: true });
                    return;
                }
                const parsedChunk = parseJsonOrError(data);
                if (!parsedChunk.error) {
                    if (parsedChunk.value && typeof parsedChunk.value === 'object' && parsedChunk.value.error) {
                        failChatStreamResponsesSse(state, formatUpstreamStreamError(parsedChunk.value.error));
                        finish({ ok: true });
                        return;
                    }
                    writeChatCompletionChunkAsResponsesSse(state, parsedChunk.value);
                }
            };

            upstreamRes.on('data', (chunk) => {
                if (!chunk) return;
                buffer += utf8Decoder.write(chunk);
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
                buffer += utf8Decoder.end();
                if (buffer.trim()) handleEventBlock(buffer);
                if (!state.finished && !state.sawDone && !state.sawFinishReason) {
                    failChatStreamResponsesSse(state, 'upstream stream ended before [DONE]');
                    finish({ ok: true });
                    return;
                }
                finishChatStreamResponsesSse(state);
                finish({ ok: true });
            });
            upstreamRes.on('aborted', () => {
                failChatStreamResponsesSse(state, 'upstream stream aborted');
                finish({ ok: true });
            });
            upstreamRes.on('error', (err) => {
                failChatStreamResponsesSse(state, err && err.message ? err.message : 'upstream stream failed');
                finish({ ok: true });
            });
        });
        upstreamReq.setTimeout(timeoutMs, () => {
            try { upstreamReq.destroy(new Error('timeout')); } catch (_) {}
            finish({ ok: false, error: 'timeout' });
        });
        upstreamReq.on('error', (err) => finish({ ok: false, error: err && err.message ? err.message : 'request failed' }));
        if (bodyText) upstreamReq.write(bodyText);
        upstreamReq.end();
    });
}

async function proxyRequestJson(targetUrl, options = {}) {
    const parsed = new URL(targetUrl);
    const transport = parsed.protocol === 'https:' ? https : http;
    const bodyText = options.body ? JSON.stringify(options.body) : '';
    const maxBytes = Number.isFinite(options.maxBytes) && options.maxBytes > 0
        ? Math.floor(options.maxBytes)
        : 0;
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
        : REQUEST_TIMEOUT_MS;
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
            agent: parsed.protocol === 'https:' ? options.httpsAgent : options.httpAgent
        }, (upstreamRes) => {
            const chunks = [];
            let size = 0;
            upstreamRes.on('data', (chunk) => {
                if (!chunk) return;
                if (maxBytes > 0) {
                    size += chunk.length;
                    if (size > maxBytes) {
                        chunks.length = 0;
                        try { upstreamRes.destroy(new Error('response too large')); } catch (_) {}
                        try { req.destroy(new Error('response too large')); } catch (_) {}
                        finish({ ok: false, error: 'response too large' });
                        return;
                    }
                }
                chunks.push(chunk);
            });
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

function createOpenaiBridgeHttpHandler(options = {}) {
    const settingsFile = options.settingsFile;
    const expectedTokenRaw = typeof options.expectedToken === 'string' ? options.expectedToken.trim() : '';
    const expectedToken = Object.prototype.hasOwnProperty.call(options, 'expectedToken')
        ? expectedTokenRaw
        : (expectedTokenRaw || DEFAULT_BRIDGE_TOKEN);
    const maxBodySize = Number.isFinite(options.maxBodySize) ? options.maxBodySize : 0;
    const httpAgent = options.httpAgent;
    const httpsAgent = options.httpsAgent;
    const maxUpstreamBytes = Number.isFinite(options.maxUpstreamBytes) && options.maxUpstreamBytes > 0
        ? Math.floor(options.maxUpstreamBytes)
        : Math.max(16 * 1024 * 1024, maxBodySize > 0 ? maxBodySize * 4 : 0);

    if (!settingsFile) {
        throw new Error('createOpenaiBridgeHttpHandler 缺少 settingsFile');
    }

    // 端点不支持的缓存（per-baseUrl, TTL 30 分钟）：避免每次非流式请求重复探测 /v1/responses。
    const unsupportedResponses = new Map();
    const isResponsesKnownUnsupported = (baseUrl) => {
        if (!baseUrl) return false;
        const entry = unsupportedResponses.get(baseUrl);
        if (!entry) return false;
        if (entry.expiresAt <= Date.now()) {
            unsupportedResponses.delete(baseUrl);
            return false;
        }
        return true;
    };
    const markResponsesUnsupported = (baseUrl) => {
        if (!baseUrl) return;
        unsupportedResponses.set(baseUrl, { expiresAt: Date.now() + RESPONSES_UNSUPPORTED_TTL_MS });
    };
    const clearResponsesUnsupported = (baseUrl) => {
        if (!baseUrl) return;
        unsupportedResponses.delete(baseUrl);
    };

    const matchPath = (requestPath) => {
        const normalized = String(requestPath || '');
        const prefix = '/bridge/openai/';
        if (!normalized.startsWith(prefix)) return null;
        const rest = normalized.slice(prefix.length);
        const [provider, ...tail] = rest.split('/').filter((part) => part.length > 0);
        if (!provider) return null;
        const tailPath = '/' + tail.join('/');
        if (!tailPath.startsWith('/v1')) return null;
        const suffix = tailPath === '/v1' ? '' : tailPath.replace(/^\/v1\/?/, '');
        return { provider, suffix };
    };

    const handler = (req, res) => {
        let parsedUrl;
        try {
            parsedUrl = new URL(req.url || '/', 'http://localhost');
        } catch (_) {
            return false;
        }
        const match = matchPath(parsedUrl.pathname || '/');
        if (!match) return false;

        void (async () => {
            try {
            const token = extractAuthorizationToken(req);
            // 兼容：某些客户端在自定义 base_url 时可能不带 Authorization。
            // 为避免在 LAN 暴露无鉴权的代理，这里仅允许 loopback 连接缺省 token。
            const remoteAddr = req && req.socket ? req.socket.remoteAddress : '';
            const isLoopback = isLoopbackAddress(remoteAddr);
            if (!isLoopback && !expectedToken) {
                res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Remote access is disabled (set CODEXMATE_HTTP_TOKEN)' }));
                return;
            }
            if (!token && !isLoopback) {
                res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
            // loopback 上的本地代理：允许客户端携带任意 Authorization（例如 Codex 会附带 provider apiKey）。
            // 非 loopback 时仍强制校验 expectedToken，避免局域网被未授权调用。
            if (!isLoopback && token && token !== expectedToken) {
                res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }

            const upstream = resolveOpenaiBridgeUpstream(settingsFile, match.provider);
            if (upstream.error) {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: upstream.error }));
                return;
            }

            const suffix = match.suffix || '';
            const normalizedSuffix = suffix.replace(/^\/+/, '');

            const authHeader = upstream.apiKey
                ? (/^bearer\s+/i.test(upstream.apiKey) ? upstream.apiKey : `Bearer ${upstream.apiKey}`)
                : '';
            const upstreamHeaders = upstream && upstream.headers && typeof upstream.headers === 'object' && !Array.isArray(upstream.headers)
                ? upstream.headers
                : {};

            if (!normalizedSuffix) {
                if ((req.method || 'GET').toUpperCase() !== 'GET') {
                    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({
                    object: 'codexmate.openai_bridge',
                    provider: match.provider,
                    status: 'ok',
                    endpoints: ['/v1/responses', '/v1/models']
                }));
                return;
            }

            if (normalizedSuffix === 'models') {
                if ((req.method || 'GET').toUpperCase() !== 'GET') {
                    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
                    return;
                }

                const url = joinApiUrl(upstream.baseUrl, 'models');
                const result = await retryTransientRequest(() => proxyRequestJson(url, {
                    method: 'GET',
                    headers: {
                        ...(authHeader ? { Authorization: authHeader } : {}),
                        ...upstreamHeaders
                    },
                    maxBytes: maxUpstreamBytes,
                    httpAgent,
                    httpsAgent
                }));
                if (!result.ok) {
                    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: `Upstream request failed: ${result.error}` }));
                    return;
                }
                res.writeHead(result.status || 502, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(result.bodyText || '');
                return;
            }

            if (normalizedSuffix !== 'responses') {
                res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Not Found' }));
                return;
            }

            if ((req.method || 'GET').toUpperCase() !== 'POST') {
                res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Method Not Allowed' }));
                return;
            }

            const { body, error: bodyErr } = await readRequestBody(req, maxBodySize);
            if (bodyErr) {
                res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: bodyErr }));
                return;
            }
            const parsed = parseJsonOrError(body);
            if (parsed.error) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: `Invalid JSON: ${parsed.error}` }));
                return;
            }

            const responsesRequest = parsed.value;
            const streamRequested = !!(responsesRequest && typeof responsesRequest === 'object' && responsesRequest.stream === true);
            const acceptHeader = req && req.headers ? (req.headers.accept || req.headers.Accept || '') : '';
            const wantsSse = /text\/event-stream/i.test(String(acceptHeader || ''));

            if (streamRequested && wantsSse) {
                const converted = convertResponsesRequestToChatCompletions(responsesRequest);
                if (converted.error) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: converted.error }));
                    return;
                }
                const upstreamUrl = joinApiUrl(upstream.baseUrl, 'chat/completions');
                const chatBody = { ...converted.chat, stream: true };
                const streamed = await retryTransientRequest(() => streamChatCompletionsAsResponsesSse(upstreamUrl, {
                    method: 'POST',
                    body: chatBody,
                    headers: {
                        ...(authHeader ? { Authorization: authHeader } : {}),
                        ...upstreamHeaders
                    },
                    maxBytes: maxUpstreamBytes,
                    httpAgent,
                    httpsAgent,
                    res,
                    model: typeof chatBody.model === 'string' ? chatBody.model : '',
                    toolTypesByName: converted.toolTypesByName || {}
                }));
                if (!streamed.ok) {
                    if (res.writableEnded || res.destroyed) {
                        return;
                    }
                    if (!res.headersSent) {
                        res.writeHead(streamed.status && streamed.status >= 400 ? streamed.status : 502, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(streamed.bodyText || JSON.stringify({ error: streamed.error || 'Upstream request failed' }));
                    } else if (!res.writableEnded && !res.destroyed) {
                        writeSse(res, 'response.failed', { type: 'response.failed', error: streamed.error || streamed.bodyText || 'Upstream request failed' });
                        writeSse(res, 'done', '[DONE]');
                        res.end();
                    }
                }
                return;
            }

            // Maxx-style behavior: prefer upstream /responses if supported.
            // Fallback to /chat/completions conversion when upstream does not implement /responses (404/405).
            // 已知不支持的上游：直接跳过探测，节省一次 round-trip。
            const skipResponsesProbe = isResponsesKnownUnsupported(upstream.baseUrl);
            const upstreamResponsesUrl = joinApiUrl(upstream.baseUrl, 'responses');
            const upstreamResponsesResult = skipResponsesProbe
                ? { ok: true, status: 404, bodyText: '' }
                : await retryTransientRequest(() => proxyRequestJson(upstreamResponsesUrl, {
                    method: 'POST',
                    body: toUpstreamNonStreamingResponsesPayload(responsesRequest),
                    headers: {
                        ...(authHeader ? { Authorization: authHeader } : {}),
                        ...upstreamHeaders
                    },
                    maxBytes: maxUpstreamBytes,
                    httpAgent,
                    httpsAgent
                }));

            if (upstreamResponsesResult.ok && upstreamResponsesResult.status >= 200 && upstreamResponsesResult.status < 300) {
                clearResponsesUnsupported(upstream.baseUrl);
                const upstreamJson = parseJsonOrError(upstreamResponsesResult.bodyText);
                if (upstreamJson.error) {
                    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: `Upstream JSON parse failed: ${upstreamJson.error}` }));
                    return;
                }
                const upstreamPayload = upstreamJson.value;
                if (streamRequested && wantsSse) {
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream; charset=utf-8',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'X-Accel-Buffering': 'no'
                    });
                    if (typeof res.flushHeaders === 'function') res.flushHeaders();
                    sendResponsesSse(res, upstreamPayload);
                    res.end();
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(ensureResponseMetadata(upstreamPayload)));
                return;
            }

            if (upstreamResponsesResult.ok && upstreamResponsesResult.status >= 400) {
                if (!shouldFallbackFromUpstreamResponses(upstreamResponsesResult.status, upstreamResponsesResult.bodyText)) {
                    res.writeHead(upstreamResponsesResult.status, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(upstreamResponsesResult.bodyText || JSON.stringify({ error: 'Upstream error' }));
                    return;
                }
                if (!skipResponsesProbe && isResponsesEndpointUnsupported(upstreamResponsesResult.status, upstreamResponsesResult.bodyText)) {
                    markResponsesUnsupported(upstream.baseUrl);
                }
                // fallthrough to chat/completions conversion
            }

            if (!upstreamResponsesResult.ok) {
                res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: `Upstream request failed: ${upstreamResponsesResult.error}` }));
                return;
            }

            const converted = convertResponsesRequestToChatCompletions(responsesRequest);
            if (converted.error) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: converted.error }));
                return;
            }

            const upstreamUrl = joinApiUrl(upstream.baseUrl, 'chat/completions');
            const upstreamResult = await retryTransientRequest(() => proxyRequestJson(upstreamUrl, {
                method: 'POST',
                body: converted.chat,
                headers: {
                    ...(authHeader ? { Authorization: authHeader } : {}),
                    ...upstreamHeaders
                },
                maxBytes: maxUpstreamBytes,
                httpAgent,
                httpsAgent
            }));
            if (!upstreamResult.ok) {
                res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: `Upstream request failed: ${upstreamResult.error}` }));
                return;
            }

            const upstreamJson = parseJsonOrError(upstreamResult.bodyText);
            if (upstreamResult.status >= 400) {
                res.writeHead(upstreamResult.status, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(upstreamResult.bodyText || JSON.stringify({ error: 'Upstream error' }));
                return;
            }
            if (upstreamJson.error) {
                res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: `Upstream JSON parse failed: ${upstreamJson.error}` }));
                return;
            }

            const model = typeof converted.chat.model === 'string' ? converted.chat.model : '';
            const extracted = extractChatCompletionResult(upstreamJson.value);
            const text = extracted && typeof extracted.text === 'string' ? extracted.text : '';
            const toolCalls = extracted && Array.isArray(extracted.toolCalls) ? extracted.toolCalls : [];
            const responsesPayload = buildResponsesPayloadFromChatResult(model, text, toolCalls, upstreamJson.value, {
                toolTypesByName: converted.toolTypesByName || {}
            });

            if (converted.streamRequested && wantsSse) {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream; charset=utf-8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'X-Accel-Buffering': 'no'
                });
                if (typeof res.flushHeaders === 'function') res.flushHeaders();
                sendResponsesSse(res, responsesPayload);
                res.end();
                return;
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(ensureResponseMetadata(responsesPayload)));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: e && e.message ? e.message : 'Internal Error' }));
            }
        })();

        return true;
    };

    handler.matchPath = matchPath;
    return handler;
}

module.exports = {
    readOpenaiBridgeSettings,
    upsertOpenaiBridgeProvider,
    resolveOpenaiBridgeUpstream,
    createOpenaiBridgeHttpHandler,
    // exported for local-bridge reuse
    convertResponsesRequestToChatCompletions,
    streamChatCompletionsAsResponsesSse,
    proxyRequestJson,
    ensureResponseMetadata,
    sendResponsesSse,
    extractAuthorizationToken,
    readRequestBody,
    parseJsonOrError,
    extractChatCompletionResult,
    buildResponsesPayloadFromChatResult,
    retryTransientRequest,
    normalizeOpenaiUpstreamBaseUrl,
    extractResponsesOutputText,
    shouldFallbackFromUpstreamResponses,
    isTransientNetworkError,
    isLoopbackAddress
};
