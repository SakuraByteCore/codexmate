'use strict';
const { PassThrough, Writable } = require('stream');
const { readRequestBody, extractAuthorizationToken, isLoopbackAddress } = require('./openai-bridge');
const { createRoutingScheduler, OPENAI_CHAT_TARGET } = require('../lib/routing-groups');
const OPENAI_CHAT_BASE_PATH = '/bridge/openai-chat/v1';
const OPENAI_CHAT_MODEL = 'routing';

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const MAX_ERROR_BYTES = 1024 * 1024;
function isRetryStatus(status) {
    return status === 408 || status === 429 || (status >= 500 && status <= 599);
}
function sendError(res, status, message) {
    res.writeHead(status, JSON_HEADERS);
    res.end(JSON.stringify({ error: message }));
}
function sendChatError(res, status, message) {
    res.writeHead(status, { ...JSON_HEADERS, ...(status === 401 ? { 'WWW-Authenticate': 'Bearer' } : {}) });
    res.end(JSON.stringify({ error: { message, type: status < 500 ? 'invalid_request_error' : 'api_error', code: null, param: null } }));
}
function forwardAttempt({ handler, req, res, body }) {
    return new Promise((resolve, reject) => {
        let status = 200;
        let headers = {};
        let bytes = 0;
        const chunks = [];
        const replay = new PassThrough();
        Object.assign(replay, { method: req.method, url: req.url, headers: req.headers, socket: req.socket });
        const commit = () => { if (!res.headersSent) res.writeHead(status, headers); };
        const sink = new Writable({
            write(chunk, encoding, callback) {
                if (!res.headersSent && isRetryStatus(status)) {
                    bytes += chunk.length;
                    if (bytes <= MAX_ERROR_BYTES) chunks.push(Buffer.from(chunk));
                    callback();
                    return;
                }
                commit();
                res.write(chunk, encoding, callback);
            },
            final(callback) {
                if (res.headersSent || !isRetryStatus(status)) {
                    commit();
                    res.end();
                }
                callback();
            }
        });
        Object.defineProperty(sink, 'headersSent', { get: () => res.headersSent });
        sink.writeHead = (code, responseHeaders = {}) => { status = code; headers = responseHeaders; return sink; };
        sink.flushHeaders = () => { if (!isRetryStatus(status)) { commit(); if (res.flushHeaders) res.flushHeaders(); } };
        const cancel = () => { replay.destroy(); sink.destroy(); };
        res.once('close', cancel);
        sink.once('error', reject);
        sink.once('finish', () => {
            res.removeListener('close', cancel);
            resolve({ status, headers, body: Buffer.concat(chunks) });
        });
        sink.once('close', () => {
            res.removeListener('close', cancel);
            if (res.destroyed) resolve({ status, headers, body: Buffer.alloc(0) });
        });
        if (!handler(replay, sink)) { reject(new Error('Routing bridge path was not handled')); return; }
        replay.end(body);
    });
}

function createRoutingBridgeHttpHandler({ groups, createHandler, maxBodySize, expectedToken = '' }) {
    const schedule = createRoutingScheduler();
    async function serve(req, res, group) {
        const send = group.target === OPENAI_CHAT_TARGET ? sendChatError : sendError;
        const bodyResult = await readRequestBody(req, maxBodySize);
        if (bodyResult.error) { send(res, 413, bodyResult.error); return; }
        let payload;
        if (bodyResult.body && bodyResult.body.trim()) {
            try { payload = JSON.parse(bodyResult.body); }
            catch (_) { send(res, 400, 'Invalid JSON request'); return; }
            if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
                send(res, 400, 'Invalid request payload'); return;
            }
        }
        if (group.target === OPENAI_CHAT_TARGET && (!payload || payload.model !== OPENAI_CHAT_MODEL || !Array.isArray(payload.messages) || !payload.messages.length)) {
            send(res, 400, "Use model 'routing' and a non-empty messages array");
            return;
        }
        const members = schedule(group);
        for (const member of members) {
            if (res.destroyed || req.aborted) return;
            const body = payload ? JSON.stringify({ ...payload, model: member.model }) : bodyResult.body;
            const outcome = await forwardAttempt({ handler: createHandler(group.target, member), req, res, body });
            if (res.headersSent || res.destroyed) return;
            if (!isRetryStatus(outcome.status) || member === members[members.length - 1]) {
                res.writeHead(outcome.status, { ...outcome.headers, 'Content-Length': outcome.body.length });
                res.end(outcome.body);
                return;
            }
        }
    }
    return (req, res) => {
        const pathname = (req.url || '').split('?')[0];
        const isChat = pathname === OPENAI_CHAT_BASE_PATH || pathname.startsWith(OPENAI_CHAT_BASE_PATH + '/');
        const target = isChat ? OPENAI_CHAT_TARGET : pathname.startsWith('/bridge/claude-local/') ? 'claude'
            : pathname.startsWith('/bridge/local/v1') ? 'codex' : '';
        if (!target) return false;
        const fail = (status, message) => (isChat ? sendChatError : sendError)(res, status, message);
        const isLoopback = isLoopbackAddress(req.socket && req.socket.remoteAddress);
        const authorize = () => {
            if (!isLoopback && !expectedToken) { fail(403, 'Remote access is disabled'); return false; }
            const requiresToken = !isLoopback || isChat && !!expectedToken;
            if (requiresToken && extractAuthorizationToken(req) !== expectedToken) { fail(401, 'Unauthorized'); return false; }
            return true;
        };
        if (isChat && !authorize()) return true;
        if (isChat && req.headers['x-codexmate-routing-hop']) { fail(508, 'Nested OpenAI routing is not supported'); return true; }
        if (isChat) {
            const method = req.method || 'GET';
            if (pathname !== OPENAI_CHAT_BASE_PATH + '/models' && pathname !== OPENAI_CHAT_BASE_PATH + '/chat/completions') {
                fail(404, 'Unsupported OpenAI Chat path'); return true;
            }
            const allowedMethod = pathname.endsWith('/models') ? 'GET' : 'POST';
            if (method !== allowedMethod) { res.setHeader('Allow', allowedMethod); fail(405, 'Method Not Allowed'); return true; }
        }
        let group;
        try { group = groups.resolve(target); }
        catch (_) { fail(503, 'Routing group unavailable; check its providers and configuration'); return true; }
        if (!group) {
            if (isChat) { fail(503, 'Enable an OpenAI Chat group first'); return true; }
            return false;
        }
        if (!isChat && !authorize()) return true;
        if (isChat && pathname.endsWith('/models')) {
            res.writeHead(200, JSON_HEADERS);
            res.end(JSON.stringify({ object: 'list', data: [{ id: OPENAI_CHAT_MODEL, object: 'model', created: 0, owned_by: 'codexmate' }] }));
            return true;
        }
        void serve(req, res, group).catch(() => {
            if (res.headersSent) res.destroy();
            else if (!res.destroyed) fail(502, 'Routing upstream request failed');
        });
        return true;
    };
}
module.exports = { createRoutingBridgeHttpHandler, OPENAI_CHAT_BASE_PATH, OPENAI_CHAT_MODEL };
