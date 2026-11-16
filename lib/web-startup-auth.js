'use strict';
const crypto = require('crypto');
const COOKIE_NAME = 'codexmate_session';
const TOKEN_BYTES = 32;

function equalToken(actual, expected) {
    const digest = value => crypto.createHash('sha256').update(value).digest();
    return typeof actual === 'string' && crypto.timingSafeEqual(digest(actual), digest(expected));
}

function createStartupAuth(configuredToken = '') {
    const token = configuredToken.trim() || crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const session = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    function respond(res, status, body, headers = {}) {
        res.writeHead(status, { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff', ...headers });
        res.end(body);
    }
    function authorized(req) {
        const headers = req.headers || {};
        const bearer = /^Bearer\s+(.+)$/i.exec(headers.authorization || '');
        if (bearer && equalToken(bearer[1], token)) return true;
        if (String(req.url).startsWith('/bridge/')) return true;
        const cookie = String(headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE_NAME + '='));
        return cookie ? equalToken(cookie.slice(COOKIE_NAME.length + 1), session) : false;
    }
    function middleware(req, res, next) {
        const pathname = String(req.url || '/').split('?')[0];
        const headers = req.headers || {};
        if (headers['sec-fetch-site'] === 'cross-site') {
            respond(res, 403, '跨站访问已拒绝');
            return;
        }
        if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && headers.origin) {
            const expectedOrigin = `http://${headers.host}`;
            if (headers.origin !== expectedOrigin) { respond(res, 403, '请求来源不匹配'); return; }
        }
        if (pathname === '/auth/login' && req.method === 'POST') {
            const bearer = /^Bearer\s+(.+)$/i.exec(headers.authorization || '');
            if (!bearer || !equalToken(bearer[1], token)) { respond(res, 401, '访问令牌无效'); return; }
            respond(res, 204, '', { 'Set-Cookie': `${COOKIE_NAME}=${session}; HttpOnly; SameSite=Strict; Path=/` });
            return;
        }
        if (authorized(req)) { next(); return; }
        if (['/', '/session', '/web-ui/index.html'].includes(pathname) && req.method === 'GET') {
            const nonce = crypto.randomBytes(16).toString('hex');
            respond(res, 200, `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>CodexMate 登录</title><body><h1>输入启动访问令牌</h1><form id="login"><input id="token" type="password" autocomplete="off" required aria-label="访问令牌"><button>登录</button></form><p id="status" role="status"></p><script nonce="${nonce}">
const params=new URLSearchParams(location.hash.slice(1));const initial=params.get('token');
if(initial)history.replaceState(null,'',location.pathname+location.search);
async function login(token){const response=await fetch('/auth/login',{method:'POST',headers:{Authorization:'Bearer '+token}});if(response.ok){location.reload()}else{document.getElementById('status').textContent='登录失败，请核对启动令牌'}}
document.getElementById('login').addEventListener('submit',event=>{event.preventDefault();login(document.getElementById('token').value).catch(()=>document.getElementById('status').textContent='登录请求失败')});
if(initial)login(initial).catch(()=>document.getElementById('status').textContent='登录请求失败');
</script></body></html>`, { 'Content-Type': 'text/html; charset=utf-8',
                'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'` });
            return;
        }
        respond(res, 401, JSON.stringify({ error: 'Unauthorized' }), {
            'Content-Type': 'application/json; charset=utf-8', 'WWW-Authenticate': 'Bearer realm="codexmate"' });
    }
    return { token, middleware, authorized };
}
module.exports = { createStartupAuth };
