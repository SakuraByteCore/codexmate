import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStartupAuth } = require('../../lib/web-startup-auth');
const test = globalThis.test || (await import('node:test')).test;

test('startup authentication protects loopback API, assets and bridge with no anonymous bypass', async () => {
    const auth = createStartupAuth();
    const restarted = createStartupAuth();
    assert.notEqual(auth.token, restarted.token);
    assert.equal(auth.token.length, 64);
    const server = http.createServer((req, res) => auth.middleware(req, res, () => { res.writeHead(200); res.end('protected'); }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    try {
        for (const route of ['/api', '/res/example.js', '/download/file']) {
            assert.equal((await fetch(origin + route)).status, 401, route);
        }
        const loginPage = await fetch(origin + '/');
        const html = await loginPage.text();
        assert.match(html, /输入启动访问令牌/);
        assert.ok(!html.includes(auth.token));
        assert.equal(loginPage.headers.get('referrer-policy'), 'no-referrer');
        assert.equal((await fetch(origin + '/api', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
        assert.equal((await fetch(origin + '/api', { headers: { Authorization: `Bearer ${auth.token}` } })).status, 200);
        const loggedIn = await fetch(origin + '/auth/login', { method: 'POST', headers: { Origin: origin, Authorization: `Bearer ${auth.token}` } });
        assert.equal(loggedIn.status, 204);
        const setCookie = loggedIn.headers.get('set-cookie');
        assert.match(setCookie, /HttpOnly; SameSite=Strict; Path=\//);
        const cookie = setCookie.split(';')[0];
        assert.equal((await fetch(origin + '/api', { headers: { Cookie: cookie } })).status, 200);
        assert.equal((await fetch(origin + '/bridge/local/v1/models', { headers: { Cookie: cookie } })).status, 200);
        assert.equal((await fetch(origin + '/api', { method: 'POST', headers: { Cookie: cookie, Origin: 'https://attacker.test' } })).status, 403);
        assert.equal(restarted.authorized({ url: '/api', headers: { cookie } }), false);
    } finally { await new Promise(resolve => server.close(resolve)); }
});
