import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createStartupAuth } = require('../../lib/web-startup-auth');
const test = globalThis.test || (await import('node:test')).test;

test('startup authentication requires an explicit token without login or cookie state', async () => {
    const auth = createStartupAuth();
    const restarted = createStartupAuth();
    assert.notEqual(auth.token, restarted.token);
    assert.equal(auth.token.length, 64);
    const server = http.createServer((req, res) => auth.middleware(req, res, () => { res.writeHead(200); res.end('protected'); }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    try {
        assert.equal((await fetch(origin + '/api')).status, 401);
        assert.equal((await fetch(origin + '/api', { headers: { Authorization: 'Bearer wrong' } })).status, 401);
        assert.equal((await fetch(origin + '/api', { headers: { Authorization: `Bearer ${auth.token}` } })).status, 200);
        assert.equal((await fetch(origin + `/?token=${auth.token}`)).status, 200);
        assert.equal((await fetch(origin + `/download/file?token=${auth.token}`)).status, 200);
        assert.equal((await fetch(origin + '/web-ui/app.js')).status, 200);
        assert.equal((await fetch(origin + '/res/vue.js')).status, 200);
        assert.equal(restarted.authorized({ url: `/?token=${auth.token}` }), false);
        const response = await fetch(origin + '/api', { headers: { Authorization: `Bearer ${auth.token}` } });
        const tokenModule = await import('../../web-ui/modules/access-token.mjs');
        assert.ok(!tokenModule.authorizationHeaders({ 'Content-Type': 'application/json' }).Authorization);
        assert.equal(tokenModule.withAccessToken('/download/file'), '/download/file');
        assert.equal(response.headers.get('set-cookie'), null);
    } finally { await new Promise(resolve => server.close(resolve)); }
});

test('startup authentication permits only token-authenticated top-level entry navigation across sites', () => {
    const auth = createStartupAuth();
    const entry = `/?token=${auth.token}`;
    const navigation = { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' };
    const cases = [
        ['entry navigation', 'GET', entry, navigation, 200],
        ['missing token', 'GET', '/', navigation, 401],
        ['wrong token', 'GET', '/?token=wrong', navigation, 401],
        ['stale token', 'GET', `/?token=${createStartupAuth().token}`, navigation, 401],
        ['API navigation', 'GET', `/api?token=${auth.token}`, navigation, 403],
        ['download navigation', 'GET', `/download/file?token=${auth.token}`, navigation, 403],
        ['iframe navigation', 'GET', entry, { ...navigation, 'sec-fetch-dest': 'iframe' }, 403],
        ['background request', 'GET', entry, { ...navigation, 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }, 403],
        ['missing mode', 'GET', entry, { 'sec-fetch-site': 'cross-site', 'sec-fetch-dest': 'document' }, 403],
        ['missing destination', 'GET', entry, { 'sec-fetch-site': 'cross-site', 'sec-fetch-mode': 'navigate' }, 403],
        ['cross-site write', 'POST', entry, navigation, 403],
        ['cross-site HEAD', 'HEAD', entry, navigation, 403],
        ['cross-site OPTIONS', 'OPTIONS', entry, navigation, 403],
        ['origin mismatch', 'POST', entry, { host: 'localhost', origin: 'http://other.example' }, 403]
    ];
    for (const [name, method, url, headers, expectedStatus] of cases) {
        let status, responseHeaders, body;
        const res = {
            writeHead(code, values) { status = code; responseHeaders = values; },
            end(value) { body = value; }
        };
        auth.middleware({ method, url, headers }, res, () => { status = 200; body = 'protected'; });
        assert.equal(status, expectedStatus, name);
        if (expectedStatus === 403) {
            assert.equal(responseHeaders['Content-Type'], 'text/plain; charset=utf-8', name);
            assert.equal(body, name === 'origin mismatch' ? '请求来源不匹配' : '跨站访问已拒绝', name);
        } else if (expectedStatus === 401) {
            assert.equal(responseHeaders['Content-Type'], 'application/json; charset=utf-8', name);
            assert.equal(responseHeaders['WWW-Authenticate'], 'Bearer realm="codexmate"', name);
            assert.deepEqual(JSON.parse(body), { error: 'Unauthorized' }, name);
        } else { assert.equal(body, 'protected', name); }
    }
});
