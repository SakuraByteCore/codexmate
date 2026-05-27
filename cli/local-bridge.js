const fs = require('fs');
const http = require('http');
const https = require('https');
const { URL } = require('url');
const {
    readOpenaiBridgeSettings,
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
    shouldFallbackFromUpstreamResponses,
    isTransientNetworkError,
    isLoopbackAddress
} = require('./openai-bridge');
const { isValidHttpUrl, normalizeBaseUrl, joinApiUrl } = require('../lib/cli-utils');

const BUILTIN_PROXY_PROVIDER_NAME = 'codexmate-proxy';
const BUILTIN_LOCAL_PROVIDER_NAME = 'local';
const CLAUDE_LOCAL_PROVIDER_NAME = 'claude-local';
const CLAUDE_LOCAL_EXCLUDED_KEY = 'claudeLocalExcluded';
const CIRCUIT_BREAKER_THRESHOLD = 3;
const CIRCUIT_BREAKER_COOLDOWN_MS = 5 * 60 * 1000;

function buildUpstreamPool(readConfigFn, openaiBridgeFile, excludedProviders) {
    let config;
    try { config = readConfigFn(); } catch (e) { return { error: '读取配置失败' }; }
    const providers = (config && typeof config.model_providers === 'object' && !Array.isArray(config.model_providers))
        ? config.model_providers : {};
    const pool = [];
    const excludedSet = new Set(
        (Array.isArray(excludedProviders) ? excludedProviders : [])
            .filter(n => typeof n === 'string' && n.trim())
            .map(n => n.trim().toLowerCase())
    );
    for (const [name, p] of Object.entries(providers)) {
        if (!p || typeof p !== 'object') continue;
        const lower = name.toLowerCase();
        if (lower === BUILTIN_LOCAL_PROVIDER_NAME || lower === BUILTIN_PROXY_PROVIDER_NAME) continue;
        if (excludedSet.has(lower)) continue;
        const bridge = typeof p.codexmate_bridge === 'string' ? p.codexmate_bridge.trim() : '';
        if (bridge === 'local') continue; // avoid loop: local→local
        const baseUrl = typeof p.base_url === 'string' ? p.base_url.trim() : '';
        if (!isValidHttpUrl(normalizeBaseUrl(baseUrl))) continue;
        const authMethod = typeof p.preferred_auth_method === 'string' ? p.preferred_auth_method.trim() : '';
        pool.push({ name, baseUrl: normalizeBaseUrl(baseUrl), authMethod, requiresOpenaiAuth: !!p.requires_openai_auth });
    }
    if (pool.length === 0) return { error: '请先添加上游 provider' };
    return { pool };
}

function buildClaudeUpstreamPool(claudeProvidersFile, excludedProviders) {
    let raw;
    try {
        if (!fs.existsSync(claudeProvidersFile)) return { error: '暂无可用上游 provider，请先添加 Claude 提供商' };
        raw = JSON.parse(fs.readFileSync(claudeProvidersFile, 'utf-8'));
    } catch (e) { return { error: '读取 Claude 提供商配置失败' }; }
    const providers = (raw && typeof raw.providers === 'object' && !Array.isArray(raw.providers))
        ? raw.providers : {};
    const pool = [];
    const excludedSet = new Set(
        (Array.isArray(excludedProviders) ? excludedProviders : [])
            .filter(n => typeof n === 'string' && n.trim())
            .map(n => n.trim().toLowerCase())
    );
    for (const [name, p] of Object.entries(providers)) {
        if (!p || typeof p !== 'object') continue;
        if (excludedSet.has(name.toLowerCase())) continue;
        const baseUrl = typeof p.baseUrl === 'string' ? p.baseUrl.trim() : '';
        if (!baseUrl || !isValidHttpUrl(normalizeBaseUrl(baseUrl))) continue;
        pool.push({ name, baseUrl: normalizeBaseUrl(baseUrl), apiKey: typeof p.apiKey === 'string' ? p.apiKey : '', model: typeof p.model === 'string' ? p.model.trim() : '' });
    }
    if (pool.length === 0) return { error: '请先添加可用的 Claude 上游提供商' };
    return { pool };
}

function resolveUpstreamAuth(entry, openaiBridgeFile, reqAuthToken) {
    if (entry.authMethod === 'codexmate' || entry.requiresOpenaiAuth) {
        const token = reqAuthToken || '';
        return token ? (token.startsWith('sk-') ? `Bearer ${token}` : `Bearer ${token}`) : '';
    }
    if (entry.authMethod === 'openai-bridge') {
        const settings = readOpenaiBridgeSettings(openaiBridgeFile);
        const upstream = settings.providers ? settings.providers[entry.name] : null;
        if (upstream && upstream.apiKey) {
            return upstream.apiKey.startsWith('Bearer ') ? upstream.apiKey : `Bearer ${upstream.apiKey}`;
        }
    }
    return '';
}

function createLocalBridgeHttpHandler(options = {}) {
    const readConfigFn = options.readConfigFn;
    const openaiBridgeFile = options.openaiBridgeFile;
    const claudeProvidersFile = options.claudeProvidersFile || '';
    const expectedToken = typeof options.expectedToken === 'string' ? options.expectedToken.trim() : '';
    const maxBodySize = Number.isFinite(options.maxBodySize) ? options.maxBodySize : 0;
    const httpAgent = options.httpAgent;
    const httpsAgent = options.httpsAgent;
    const maxUpstreamBytes = Number.isFinite(options.maxUpstreamBytes) && options.maxUpstreamBytes > 0
        ? Math.floor(options.maxUpstreamBytes)
        : Math.max(16 * 1024 * 1024, maxBodySize > 0 ? maxBodySize * 4 : 0);

    if (typeof readConfigFn !== 'function') throw new Error('createLocalBridgeHttpHandler 缺少 readConfigFn');

    const circuitState = new Map(); // name → { failures, openUntil }
    let rrIndex = 0;

    function pickUpstream(pool) {
        const now = Date.now();
        for (let i = 0; i < pool.length; i++) {
            const idx = rrIndex++ % pool.length;
            const entry = pool[idx];
            const st = circuitState.get(entry.name);
            if (st && st.openUntil > now) continue; // circuit open
            return { entry, idx };
        }
        // all circuits open, reset and retry first
        circuitState.clear();
        return { entry: pool[0], idx: 0 };
    }

    function recordFailure(name) {
        let st = circuitState.get(name);
        if (!st) { st = { failures: 0, openUntil: 0 }; circuitState.set(name, st); }
        st.failures++;
        if (st.failures >= CIRCUIT_BREAKER_THRESHOLD) {
            st.openUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
        }
    }

    function recordSuccess(name) {
        circuitState.delete(name);
    }

    const localBridgeSettingsFile = options.localBridgeSettingsFile || '';

    function readExcludedProviders() {
        if (!localBridgeSettingsFile) return [];
        try {
            if (!fs.existsSync(localBridgeSettingsFile)) return [];
            const raw = JSON.parse(fs.readFileSync(localBridgeSettingsFile, 'utf-8'));
            const excluded = Array.isArray(raw.excludedProviders)
                ? raw.excludedProviders.filter(n => typeof n === 'string' && n.trim())
                : [];
            // 解二: auto-exclude lastActiveProvider
            const last = typeof raw.lastActiveProvider === 'string' ? raw.lastActiveProvider.trim() : '';
            if (last && !excluded.some(n => n.toLowerCase() === last.toLowerCase())) {
                excluded.push(last);
            }
            return excluded;
        } catch (e) { return []; }
    }

    function streamClaudeUpstream(targetUrl, options) {
        const parsed = new URL(targetUrl);
        const transport = parsed.protocol === 'https:' ? https : http;
        const bodyText = options.body || '';
        const headers = {
            'Accept': 'text/event-stream',
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        if (bodyText) {
            headers['Content-Length'] = Buffer.byteLength(bodyText, 'utf-8');
        }
        const maxBytes = Number.isFinite(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : 0;
        const res = options.res;

        return new Promise((resolve) => {
            let settled = false;
            let upstreamReq = null;
            const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
            const abortUpstream = () => { if (upstreamReq) try { upstreamReq.destroy(new Error('client aborted')); } catch (_) {} };
            if (res && typeof res.once === 'function') res.once('close', abortUpstream);

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
                if (status >= 400) {
                    const chunks = [];
                    let size = 0;
                    upstreamRes.on('data', (chunk) => {
                        if (!chunk) return;
                        if (maxBytes > 0) { size += chunk.length; if (size > maxBytes) { finish({ ok: false, status, error: 'response too large' }); return; } }
                        chunks.push(chunk);
                    });
                    upstreamRes.on('end', () => finish({ ok: false, status, error: chunks.length ? Buffer.concat(chunks).toString('utf-8') : 'Upstream error' }));
                    return;
                }
                // SSE: pipe directly to client
                if (!res.headersSent) {
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream; charset=utf-8',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive',
                        'X-Accel-Buffering': 'no'
                    });
                    if (typeof res.flushHeaders === 'function') res.flushHeaders();
                }
                upstreamRes.pipe(res);
                upstreamRes.on('end', () => finish({ ok: true, status }));
                upstreamRes.on('error', (err) => finish({ ok: false, status, error: err.message }));
            });
            upstreamReq.on('error', (err) => finish({ ok: false, error: err.message }));
            upstreamReq.setTimeout(5 * 60 * 1000, () => { try { upstreamReq.destroy(new Error('timeout')); } catch (_) {} });
            if (bodyText) upstreamReq.write(bodyText);
            upstreamReq.end();
        });
    }

    function readClaudeExcludedProviders() {
        if (!claudeProvidersFile) return [];
        try {
            if (!fs.existsSync(claudeProvidersFile)) return [];
            const raw = JSON.parse(fs.readFileSync(claudeProvidersFile, 'utf-8'));
            return Array.isArray(raw.excludedProviders)
                ? raw.excludedProviders.filter(n => typeof n === 'string' && n.trim())
                : [];
        } catch (e) { return []; }
    }

    async function handleClaudeLocalBridge(req, res, parsedUrl) {
        try {
            const token = extractAuthorizationToken(req);
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
            if (!isLoopback && token && token !== expectedToken) {
                res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }

            const poolResult = buildClaudeUpstreamPool(claudeProvidersFile, readClaudeExcludedProviders());
            if (poolResult.error) {
                res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: poolResult.error }));
                return;
            }
            const pool = poolResult.pool;
            const { entry } = pickUpstream(pool);

            const suffix = (parsedUrl.pathname || '').replace(/^\/bridge\/claude-local\/?/, '');
            if (!suffix) {
                if ((req.method || 'GET').toUpperCase() !== 'GET') {
                    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ object: 'codexmate.claude_local_bridge', provider: entry.name, model: entry.model || '', status: 'ok', pool: pool.map(p => p.name) }));
                return;
            }

            // Proxy Anthropic Messages API requests
            const bodyResult = await readRequestBody(req, maxBodySize);
            if (bodyResult.error) {
                res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: bodyResult.error }));
                return;
            }

            let parsedBody;
            try { parsedBody = bodyResult.body ? JSON.parse(bodyResult.body) : {}; } catch (_) { parsedBody = {}; }
            // Override model to match the selected upstream provider
            if (entry.model && parsedBody && typeof parsedBody === 'object') {
                parsedBody.model = entry.model;
            }
            const wantsStream = !!(parsedBody && parsedBody.stream);
            const bodyToForward = JSON.stringify(parsedBody);
            const upstreamUrl = joinApiUrl(entry.baseUrl.replace(/\/+$/, ''), suffix);
            const headers = { 'Content-Type': 'application/json' };
            if (entry.apiKey) {
                headers['x-api-key'] = entry.apiKey.startsWith('Bearer ') ? entry.apiKey.slice(7) : entry.apiKey;
            }
            if (token && !entry.apiKey) {
                headers['x-api-key'] = token.startsWith('Bearer ') ? token.slice(7) : token;
            }
            headers['anthropic-version'] = '2023-06-01';

            if (wantsStream) {
                // Streaming proxy: pipe upstream SSE directly to client
                const upstreamResult = await streamClaudeUpstream(upstreamUrl, {
                    method: req.method || 'POST',
                    body: bodyToForward,
                    headers,
                    maxBytes: maxUpstreamBytes,
                    httpAgent,
                    httpsAgent,
                    res
                });
                if (!upstreamResult.ok) {
                    recordFailure(entry.name);
                    if (!res.headersSent) {
                        res.writeHead(upstreamResult.status || 502, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error: upstreamResult.error || 'Upstream error' }));
                    }
                    return;
                }
                recordSuccess(entry.name);
                return;
            }

            // Non-streaming proxy
            const upstreamResult = await retryTransientRequest(() => proxyRequestJson(upstreamUrl, {
                method: req.method || 'POST',
                body: bodyToForward || null,
                headers,
                maxBytes: maxUpstreamBytes,
                httpAgent,
                httpsAgent
            }));

            if (!upstreamResult.ok) {
                recordFailure(entry.name);
                res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: `Upstream request failed: ${upstreamResult.error}` }));
                return;
            }

            recordSuccess(entry.name);
            const statusCode = Number.isFinite(upstreamResult.status) ? upstreamResult.status : 200;
            res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(upstreamResult.bodyText || '{}');
        } catch (e) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: e && e.message ? e.message : 'Internal Error' }));
        }
    }

    const handler = (req, res) => {
        let parsedUrl;
        try { parsedUrl = new URL(req.url || '/', 'http://localhost'); } catch (_) { return false; }
        const pathname = parsedUrl.pathname || '/';

        // Claude local bridge: /bridge/claude-local/v1/messages
        if (pathname.startsWith('/bridge/claude-local/')) {
            if (!claudeProvidersFile) return false;
            void handleClaudeLocalBridge(req, res, parsedUrl);
            return true;
        }

        // Codex local bridge: /bridge/local/v1
        if (!pathname.startsWith('/bridge/local/')) return false;
        const suffix = pathname.replace(/^\/bridge\/local\/?/, '');
        if (!suffix.startsWith('v1')) return false;

        void (async () => {
            try {
            const token = extractAuthorizationToken(req);
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
            if (!isLoopback && token && token !== expectedToken) {
                res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }

            const poolResult = buildUpstreamPool(readConfigFn, openaiBridgeFile, readExcludedProviders());
            if (poolResult.error) {
                res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: poolResult.error }));
                return;
            }
            const pool = poolResult.pool;

            const { entry, idx } = pickUpstream(pool);
            const authHeader = resolveUpstreamAuth(entry, openaiBridgeFile, token);

            const normalizedSuffix = suffix.replace(/^v1\/?/, '');
            const upstreamBase = entry.baseUrl.replace(/\/+$/, '');

            if (!normalizedSuffix) {
                if ((req.method || 'GET').toUpperCase() !== 'GET') {
                    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ object: 'codexmate.local_bridge', provider: entry.name, status: 'ok', pool: pool.map(p => p.name) }));
                return;
            }

            if (normalizedSuffix === 'responses' && (req.method || 'GET').toUpperCase() === 'POST') {
                const bodyResult = await readRequestBody(req, maxBodySize);
                if (bodyResult.error) {
                    res.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: bodyResult.error }));
                    return;
                }
                const parsed = parseJsonOrError(bodyResult.body);
                if (parsed.error) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: parsed.error }));
                    return;
                }
                const responsesRequest = parsed.value;
                const wantsSse = !!(responsesRequest && responsesRequest.stream);
                const upstreamResponsesUrl = joinApiUrl(upstreamBase, 'responses');
                const upstreamResponsesResult = await retryTransientRequest(() => proxyRequestJson(upstreamResponsesUrl, {
                    method: 'POST',
                    body: bodyResult.body,
                    headers: { ...(authHeader ? { Authorization: authHeader } : {}) },
                    maxBytes: maxUpstreamBytes,
                    httpAgent,
                    httpsAgent
                }));

                if (upstreamResponsesResult.ok && upstreamResponsesResult.status < 400) {
                    recordSuccess(entry.name);
                    const upstreamPayload = parseJsonOrError(upstreamResponsesResult.bodyText);
                    if (upstreamPayload.error) {
                        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error: `Upstream parse failed: ${upstreamPayload.error}` }));
                        return;
                    }
                    if (wantsSse) {
                        res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
                        if (typeof res.flushHeaders === 'function') res.flushHeaders();
                        sendResponsesSse(res, upstreamPayload.value);
                        res.end();
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify(ensureResponseMetadata(upstreamPayload.value)));
                    return;
                }

                if (upstreamResponsesResult.ok && upstreamResponsesResult.status >= 400 && !shouldFallbackFromUpstreamResponses(upstreamResponsesResult.status, upstreamResponsesResult.bodyText)) {
                    recordFailure(entry.name);
                    res.writeHead(upstreamResponsesResult.status, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(upstreamResponsesResult.bodyText || JSON.stringify({ error: 'Upstream error' }));
                    return;
                }

                if (!upstreamResponsesResult.ok) {
                    recordFailure(entry.name);
                    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: `Upstream request failed: ${upstreamResponsesResult.error}` }));
                    return;
                }

                // fallthrough to chat/completions conversion
                recordSuccess(entry.name);
                const converted = convertResponsesRequestToChatCompletions(responsesRequest);
                if (converted.error) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: converted.error }));
                    return;
                }
                const chatUrl = joinApiUrl(upstreamBase, 'chat/completions');
                const chatResult = await retryTransientRequest(() => proxyRequestJson(chatUrl, {
                    method: 'POST',
                    body: JSON.stringify(converted.chat),
                    headers: { ...(authHeader ? { Authorization: authHeader } : {}), 'Content-Type': 'application/json' },
                    maxBytes: maxUpstreamBytes,
                    httpAgent,
                    httpsAgent
                }));
                if (!chatResult.ok) {
                    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: `Upstream request failed: ${chatResult.error}` }));
                    return;
                }
                const chatJson = parseJsonOrError(chatResult.bodyText);
                if (chatResult.status >= 400) {
                    res.writeHead(chatResult.status, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(chatResult.bodyText || JSON.stringify({ error: 'Upstream error' }));
                    return;
                }
                if (chatJson.error) {
                    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: `Upstream parse failed: ${chatJson.error}` }));
                    return;
                }
                const extracted = extractChatCompletionResult(chatJson.value);
                const text = extracted && typeof extracted.text === 'string' ? extracted.text : '';
                const toolCalls = extracted && Array.isArray(extracted.toolCalls) ? extracted.toolCalls : [];
                const model = typeof converted.chat.model === 'string' ? converted.chat.model : '';
                const responsesPayload = buildResponsesPayloadFromChatResult(model, text, toolCalls, chatJson.value);
                if (wantsSse) {
                    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
                    if (typeof res.flushHeaders === 'function') res.flushHeaders();
                    sendResponsesSse(res, responsesPayload);
                    res.end();
                    return;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(ensureResponseMetadata(responsesPayload)));
                return;
            }

            // passthrough for other v1/* paths
            const upstreamUrl = joinApiUrl(upstreamBase, normalizedSuffix);
            const upstreamResult = await retryTransientRequest(() => proxyRequestJson(upstreamUrl, {
                method: req.method || 'GET',
                body: null,
                headers: { ...(authHeader ? { Authorization: authHeader } : {}) },
                maxBytes: maxUpstreamBytes,
                httpAgent,
                httpsAgent
            }));
            if (!upstreamResult.ok) {
                recordFailure(entry.name);
                res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: `Upstream request failed: ${upstreamResult.error}` }));
                return;
            }
            recordSuccess(entry.name);
            res.writeHead(upstreamResult.status, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(upstreamResult.bodyText);
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: e && e.message ? e.message : 'Internal Error' }));
            }
        })();
        return true;
    };

    return handler;
}

module.exports = { createLocalBridgeHttpHandler };
