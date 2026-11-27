import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const route = '/api/file-sharing';
const modulePath = require.resolve('../../lib/file-sharing.js');
function uploadBody(files, bytes = Buffer.alloc(0), folder = '') {
    const manifest = Buffer.from(JSON.stringify({ folder, files }));
    const prefix = Buffer.alloc(4);
    prefix.writeUInt32BE(manifest.length);
    return Buffer.concat([prefix, manifest, bytes]);
}

async function fixture(t) {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sharing-unit-'));
    const module = { exports: {} };
    vm.runInNewContext(await fs.readFile(modulePath, 'utf8'), { module, Buffer, console, setTimeout, clearTimeout,
        require: name => name === 'os' ? { tmpdir: () => root } : createRequire(modulePath)(name) });
    const sharing = module.exports.createFileSharingRoutes();
    const server = http.createServer((req, res) => sharing.serve(req, res, req.url));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => {
        await new Promise(resolve => server.close(resolve));
        await sharing.dispose();
        assert.deepEqual(await fs.readdir(root), [], 'dispose must remove temporary payloads');
        await fs.rmdir(root);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    return { root, base, sharing, upload: body => fetch(base + route, {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body
    }), list: () => fetch(base + route).then(res => res.json()) };
}

test('sharing uploads, HEAD/downloads and removes only temporary copies', async t => {
    const f = await fixture(t);
    const source = path.join(f.root, 'source.txt');
    const bytes = Buffer.from('original bytes');
    await fs.writeFile(source, bytes);
    const response = await f.upload(uploadBody([{ name: 'メモ.txt', size: bytes.length }, { name: 'empty.txt', size: 0 }], bytes));
    assert.equal(response.status, 201);
    const { batch } = await response.json();
    assert.equal((await f.list()).batches.length, 1);
    const url = `${f.base}${route}/${batch.id}/0`;
    const head = await fetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), String(bytes.length));
    const download = await fetch(url);
    assert.match(download.headers.get('content-disposition'), /^attachment;/);
    assert.match(download.headers.get('content-security-policy'), /^sandbox/);
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), bytes);
    assert.equal((await fetch(`${f.base}${route}/${batch.id}/1`)).headers.get('content-length'), '0');
    assert.equal((await fetch(`${f.base}${route}/${batch.id}`, { method: 'DELETE' })).status, 200);
    assert.equal((await fetch(url)).status, 404);
    assert.deepEqual((await f.list()).batches, []);
    assert.deepEqual(await fs.readFile(source), bytes);
    await fs.unlink(source);
});

test('sharing rejects invalid manifests and incomplete uploads without committing batches', async t => {
    const f = await fixture(t);
    for (const body of [uploadBody([]), uploadBody([{ name: '../private', size: 0 }]),
        uploadBody([{ name: 'a', size: 0 }, { name: 'a', size: 0 }]),
        uploadBody([{ name: 'a', size: 3 }], Buffer.from('x')),
        uploadBody([{ name: 'wrong/a', size: 0 }], Buffer.alloc(0), 'folder')]) {
        assert.equal((await f.upload(body)).status, 400);
        assert.deepEqual((await f.list()).batches, []);
        for (const directory of await fs.readdir(f.root)) {
            assert.deepEqual(await fs.readdir(path.join(f.root, directory)), [], 'failed uploads must leave no payload');
        }
    }
    assert.equal((await fetch(f.base + route, { method: 'POST', body: 'invalid' })).status, 415);
});
