'use strict';
const crypto = require('crypto');
const TOKEN_BYTES = 32;

function equalToken(actual, expected) {
    const digest = value => crypto.createHash('sha256').update(value).digest();
    return typeof actual === 'string' && crypto.timingSafeEqual(digest(actual), digest(expected));
}

function createStartupAuth(configuredToken = '') {
    const token = configuredToken.trim() || crypto.randomBytes(TOKEN_BYTES).toString('hex');
    function respond(res, status, body, headers = {}) {
        res.writeHead(status, { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff', ...headers });
        res.end(body);
    }
    function requestToken(req) {
        const headers = req.headers || {};
        const bearer = /^Bearer\s+(.+)$/i.exec(headers.authorization || '');
        if (bearer) return bearer[1].trim();
        try {
            return new URL(req.url || '/', 'http://localhost').searchParams.get('token') || '';
        } catch (_) {
            return '';
        }
    }
    function authorized(req) {
        const provided = requestToken(req);
        return !!provided && equalToken(provided, token);
    }
    function middleware(req, res, next) {
        const pathname = String(req.url || '/').split('?')[0];
        if (pathname.startsWith('/web-ui/') || pathname.startsWith('/res/') || pathname.startsWith('/bridge/')) { next(); return; }
        const headers = req.headers || {};
        if (headers['sec-fetch-site'] === 'cross-site') {
            respond(res, 403, '跨站访问已拒绝');
            return;
        }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && headers.origin) {
            const expectedOrigin = `http://${headers.host}`;
            if (headers.origin !== expectedOrigin) { respond(res, 403, '请求来源不匹配'); return; }
        }
        if (authorized(req)) { next(); return; }
        respond(res, 401, JSON.stringify({ error: 'Unauthorized' }), {
            'Content-Type': 'application/json; charset=utf-8', 'WWW-Authenticate': 'Bearer realm="codexmate"' });
    }
    return { token, middleware, authorized };
}
module.exports = { createStartupAuth };
