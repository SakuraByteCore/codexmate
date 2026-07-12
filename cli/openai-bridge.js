const http = require('http');
const crypto = require('crypto');
const { readJsonFile, writeJsonAtomic } = require('../lib/cli-file-utils');
const { isValidHttpUrl, normalizeBaseUrl, joinApiUrl } = require('../lib/cli-utils');

const DEFAULT_BRIDGE_TOKEN = crypto.randomBytes(16).toString('hex');
const SETTINGS_VERSION = 1;
// 推理模型 reasoning 阶段可能长时间无字节输出，需匹配 codex 的 stream_idle_timeout_ms=300000。
const STREAM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
const RESPONSES_UNSUPPORTED_TTL_MS = 30 * 60 * 1000;
const DEFAULT_CODEX_VERSION = '0.98.0';
const DEFAULT_CODEX_USER_AGENT = 'codex_cli_rs/0.98.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464';
const DEFAULT_CODEX_ORIGINATOR = 'codex_cli_rs';
const DEFAULT_OPENAI_BETA = 'responses=experimental';

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeProviderName(value) {
    // Provider name validation is done elsewhere; keep this conservative.
    return normalizeText(value);
}

function firstHeaderValue(req, name) {
    if (!req || !req.headers || typeof req.headers !== 'object') return '';
    const value = req.headers[String(name || '').toLowerCase()];
    if (Array.isArray(value)) return typeof value[0] === 'string' ? value[0] : '';
    return typeof value === 'string' ? value : '';
}

function resolveCodexUserAgent(req) {
    const incoming = firstHeaderValue(req, 'user-agent').trim();
    if (/^(codex_cli_rs|codex-cli)\//i.test(incoming)) return incoming;
    return DEFAULT_CODEX_USER_AGENT;
}

function resolveCodexOriginator() {
    // Some Codex-only upstreams validate Originator separately from User-Agent.
    // The local TUI may send values such as `codex-tui`, but upstream Codex
    // gates commonly expect the official Rust CLI originator token.
    return DEFAULT_CODEX_ORIGINATOR;
}

function buildCodexBridgeHeaders(req, upstream, authHeader) {
    const upstreamHeaders = upstream && upstream.headers && typeof upstream.headers === 'object' && !Array.isArray(upstream.headers)
        ? upstream.headers
        : {};
    const version = firstHeaderValue(req, 'version').trim() || DEFAULT_CODEX_VERSION;
    const openaiBeta = firstHeaderValue(req, 'openai-beta').trim() || DEFAULT_OPENAI_BETA;
    return {
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...upstreamHeaders,
        'User-Agent': resolveCodexUserAgent(req),
        'Version': version,
        'OpenAI-Beta': openaiBeta,
        'Originator': resolveCodexOriginator()
    };
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

const {
    parseJsonOrError,
    extractChatCompletionResult,
    convertResponsesRequestToChatCompletions,
    buildResponsesPayloadFromChatResult,
    ensureResponseMetadata,
    sendResponsesSse,
    extractResponsesOutputText,
    normalizeResponsesPayloadForUpstream,
    toUpstreamNonStreamingResponsesPayload,
    shouldFallbackFromUpstreamResponses,
    isResponsesEndpointUnsupported,
    retryTransientRequest,
    isTransientNetworkError,
    isLoopbackAddress,
    streamChatCompletionsAsResponsesSse,
    streamResponsesSse,
    proxyRequestJson
} = require('./openai-bridge-runtime');
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

function upsertOpenaiBridgeProvider(filePath, providerName, upstreamBaseUrl, apiKey, headers, options = {}) {
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
                headers: Object.keys(nextHeaders).length ? nextHeaders : existingHeaders,
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
    const streamTimeoutMs = Number.isFinite(options.streamTimeoutMs) && options.streamTimeoutMs > 0
        ? Math.floor(options.streamTimeoutMs)
        : STREAM_IDLE_TIMEOUT_MS;

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
            const codexHeaders = buildCodexBridgeHeaders(req, upstream, authHeader);

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

            const converted = convertResponsesRequestToChatCompletions(responsesRequest);
            if (converted.error) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: converted.error }));
                return;
            }

            if (streamRequested && wantsSse) {
                const upstreamUrl = joinApiUrl(upstream.baseUrl, 'chat/completions');
                const chatBody = { ...converted.chat, stream: true };
                const streamed = await retryTransientRequest(() => streamChatCompletionsAsResponsesSse(upstreamUrl, {
                    method: 'POST',
                    body: chatBody,
                    headers: codexHeaders,
                    timeoutMs: streamTimeoutMs,
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

            const upstreamUrl = joinApiUrl(upstream.baseUrl, 'chat/completions');
            const upstreamResult = await retryTransientRequest(() => proxyRequestJson(upstreamUrl, {
                method: 'POST',
                body: converted.chat,
                headers: codexHeaders,
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
                if (res.writableEnded || res.destroyed) {
                    return;
                }
                const message = e && e.message ? e.message : 'Internal Error';
                if (res.headersSent) {
                    try {
                        res.end();
                    } catch (_) {
                        // Headers are already committed. Close the socket instead of leaving the client waiting forever.
                        if (!res.destroyed && typeof res.destroy === 'function') {
                            res.destroy(e);
                        }
                    }
                    return;
                }
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: message }));
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
