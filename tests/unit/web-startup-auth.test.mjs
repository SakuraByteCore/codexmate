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
