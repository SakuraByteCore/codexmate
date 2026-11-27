import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const modulePath = require.resolve('../../lib/file-sharing-lan.js');
const id = 'a'.repeat(32);
const startTime = 1800000000000;
function fixture(options = {}) {
    let now = startTime;
    let serve;
    let sends = 0;
    const server = new EventEmitter();
    server.listen = (port, address, ready) => ready();
    server.address = () => ({ port: 4321 });
    server.close = done => done();
    const module = { exports: {} };
    vm.runInNewContext(fs.readFileSync(modulePath, 'utf8'), { module, Buffer, URLSearchParams, console,
        Date: { now: () => now }, process: { env: { CODEXMATE_ALLOWED_IPS: options.allowedIps || '' } },
        require: name => {
            if (name === 'http') return { STATUS_CODES: require('node:http').STATUS_CODES, createServer: (config, callback) => { serve = callback; return server; } };
            if (name === 'os') return { networkInterfaces: () => options.noInterface ? {} : {
                wlan: [{ internal: false, address: '10.2.3.4', cidr: '10.2.3.4/24' }] } };
            return createRequire(modulePath)(name);
        } });
    const downloads = module.exports.createLanDownloads(async (req, res, batch, index) => {
        sends++;
        assert.equal(batch, id);
        assert.equal(index, 0);
        res.writeHead(200);
        res.end('fixture');
    });
    return { downloads, server, advance: milliseconds => { now += milliseconds; }, sends: () => sends,
        request(url, options = {}) {
            const parsed = new URL(url);
            const res = { status: 0, writeHead(status) { this.status = status; }, end() {} };
            serve({ url: parsed.pathname + parsed.search, method: options.method || 'GET',
                headers: { host: options.host || parsed.host }, socket: { remoteAddress: options.peer || '10.2.3.8' } }, res);
            return res.status;
        } };
}

test('LAN links bind resource and expiry, use unique tokens and permit only GET/HEAD', async () => {
    const f = fixture();
    const first = await f.downloads.issue(id, 0, '10.2.3.4');
    const second = await f.downloads.issue(id, 0, '10.2.3.4');
    assert.equal(first.expiresAt, startTime + 3600000);
    assert.notEqual(first.url, second.url);
    assert.equal(f.request(first.url), 200);
    assert.equal(f.request(first.url, { method: 'HEAD' }), 200);
    assert.equal(f.request(first.url, { method: 'DELETE' }), 405);
    assert.equal(f.request(first.url, { peer: '192.168.1.8' }), 403);
    assert.equal(f.request(first.url, { host: 'evil.example' }), 404);
    assert.equal(f.request(first.url.replace('/0?', '/1?')), 403);
    const missing = new URL(first.url); missing.search = '';
    assert.equal(f.request(missing), 403);
    missing.searchParams.set('token', 'management-token');
    assert.equal(f.request(missing), 403);
    f.advance(3600000 - 1);
    assert.equal(f.request(first.url), 200);
    f.advance(1);
    assert.equal(f.request(first.url), 403);
    assert.equal(f.sends(), 3);
    await f.downloads.close();
});

test('LAN respects the additional IP allowlist and closes owned sockets', async () => {
    const f = fixture({ allowedIps: '10.2.3.9' });
    const link = await f.downloads.issue(id, 0, '10.2.3.4');
    assert.equal(f.request(link.url), 403);
    assert.equal(f.request(link.url, { peer: '10.2.3.9' }), 200);
    let destroyed = false;
    f.server.emit('connection', Object.assign(new EventEmitter(), { destroy: () => { destroyed = true; } }));
    await f.downloads.close();
    assert.equal(destroyed, true);
    const unavailable = fixture({ noInterface: true });
    assert.equal(await unavailable.downloads.issue(id, 0, ''), null);
    await unavailable.downloads.close();
});
