'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { randomBytes } = require('crypto');
const { Transform, pipeline } = require('stream');
const { promisify } = require('util');
const { createLanDownloads } = require('./file-sharing-lan');

const pipelineFiles = promisify(pipeline);
const ROUTE = '/api/file-sharing';
const MAX_MANIFEST = 512 * 1024;
const MAX_UPLOAD_MS = 10 * 60 * 1000;

function uploadError(status, code) {
    return Object.assign(new Error(code), { status, code });
}

function isSafeRelativeName(name) {
    return typeof name === 'string' && name.length <= 1024 && name.split('/').every(part =>
        part && part !== '.' && part !== '..' && !/[\\:\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069\uD800-\uDFFF]/u.test(part));
}

function parseManifest(manifestBytes, expectedSize) {
    let manifest;
    try { manifest = JSON.parse(manifestBytes.toString('utf8')); }
    catch (_) { throw uploadError(400, 'invalid'); }
    const { folder, files } = manifest || {};
    if (!Array.isArray(files) || !files.length) throw uploadError(400, 'emptyFolder');
    if (folder !== '' && (!isSafeRelativeName(folder) || folder.includes('/'))) throw uploadError(400, 'invalid');
    const names = new Set();
    let offset = 0;
    const entries = files.map(file => {
        const { name, size } = file || {};
        if (!isSafeRelativeName(name) || names.has(name)
            || (folder ? !name.startsWith(`${folder}/`) : name.includes('/'))
            || !Number.isSafeInteger(size) || size < 0) throw uploadError(400, 'invalid');
        if (size > expectedSize - offset) throw uploadError(400, 'invalid');
        names.add(name);
        const entry = { name, size, offset };
        offset += size;
        return entry;
    });
    if (offset !== expectedSize) throw uploadError(400, 'invalid');
    return { folder, entries };
}

function createUploadStream(length, acceptManifest) {
    const prefix = Buffer.alloc(4);
    let prefixRead = 0;
    let manifestBytes;
    let manifestRead = 0;
    let received = 0;
    return new Transform({
        transform(chunk, encoding, callback) {
            try {
                received += chunk.length;
                if (received > length) throw uploadError(400, 'invalid');
                if (prefixRead < prefix.length) {
                    const count = chunk.copy(prefix, prefixRead);
                    prefixRead += count;
                    chunk = chunk.subarray(count);
                    if (prefixRead < prefix.length) return callback();
                    const manifestSize = prefix.readUInt32BE();
                    if (!manifestSize || manifestSize > MAX_MANIFEST || manifestSize > length - prefix.length) {
                        throw uploadError(400, 'invalid');
                    }
                    manifestBytes = Buffer.alloc(manifestSize);
                }
                if (manifestRead < manifestBytes.length) {
                    const count = chunk.copy(manifestBytes, manifestRead);
                    manifestRead += count;
                    chunk = chunk.subarray(count);
                    if (manifestRead < manifestBytes.length) return callback();
                    acceptManifest(parseManifest(manifestBytes, length - prefix.length - manifestBytes.length));
                }
                callback(null, chunk);
            } catch (error) { callback(error); }
        },
        flush(callback) { callback(received === length ? null : uploadError(400, 'invalid')); }
    });
}

function sharingJson(res, status, payload, headers = {}) {
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers
    });
    res.end(JSON.stringify(payload));
}

function createFileSharingRoutes() {
    // User paths are display metadata only. Disk names come from server-generated IDs.
    const batches = new Map();
    let root;
    let activeUpload;
    const diskPath = id => path.join(root, id);
    const summary = ({ id, folder, entries }) => ({ id, folder, files: entries.map(({ name, size }) => ({ name, size })) });

    async function upload(req, res) {
        if (req.headers['content-type'] !== 'application/octet-stream') throw uploadError(415, 'invalid');
        const length = Number(req.headers['content-length']);
        if (!Number.isSafeInteger(length) || length <= 4) throw uploadError(400, 'invalid');
        const id = randomBytes(16).toString('hex');
        let manifest;
        let committed = false;
        let blobPath;
        try {
            if (!root) root = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codexmate-file-sharing-'));
            blobPath = diskPath(id);
            const stream = createUploadStream(length, parsed => {
                manifest = parsed;
            });
            const interruptUpload = () => stream.destroy(uploadError(400, 'invalid'));
            const closeUpload = () => { if (!req.complete) interruptUpload(); };
            const timeout = setTimeout(interruptUpload, MAX_UPLOAD_MS).unref();
            req.once('close', closeUpload);
            try {
                if (req.destroyed) throw uploadError(400, 'invalid');
                await pipelineFiles(req.pipe(stream), fs.createWriteStream(blobPath, { flags: 'wx', mode: 0o600 }));
            } finally {
                clearTimeout(timeout);
                req.removeListener('close', closeUpload);
            }
            batches.set(id, { id, ...manifest });
            committed = true;
            sharingJson(res, 201, { batch: summary(batches.get(id)) });
        } finally {
            if (blobPath && !committed) await fs.promises.rm(blobPath, { force: true });
        }
    }

    const lanDownloads = createLanDownloads((req, res, id, index) => sendFile(req, res, batches.get(id), index));

    async function serve(req, res, requestPath) {
        if (requestPath === ROUTE && req.method === 'GET') return sharingJson(res, 200, { batches: [...batches.values()].map(summary) });
        if (requestPath === ROUTE && req.method === 'POST') {
            if (activeUpload) throw uploadError(409, 'busy');
            activeUpload = upload(req, res);
            try { return await activeUpload; }
            finally { activeUpload = null; }
        }
        const match = /^\/api\/file-sharing\/([a-f0-9]{32})(?:\/(\d+)(\/link)?)?$/.exec(requestPath);
        const batch = match && batches.get(match[1]);
        if (!batch) throw uploadError(404, 'notFound');
        if (req.method === 'DELETE' && match[2] === undefined) {
            await fs.promises.rm(diskPath(batch.id), { force: true });
            batches.delete(batch.id);
            return sharingJson(res, 200, { removed: true });
        }
        const index = match[2] === undefined ? -1 : Number(match[2]);
        if (match[3]) {
            if (req.method !== 'POST') throw uploadError(405, 'invalid');
            if (!batch.entries[index]) throw uploadError(404, 'notFound');
            const link = await lanDownloads.issue(batch.id, index, req.socket.localAddress);
            if (!link) throw uploadError(503, 'lanUnavailable');
            if (!batches.has(batch.id)) throw uploadError(404, 'notFound');
            return sharingJson(res, 201, link);
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') throw uploadError(405, 'invalid');
        return sendFile(req, res, batch, index);
    }

    async function sendFile(req, res, batch, index) {
        const file = batch && batch.entries[index];
        if (!file) throw uploadError(404, 'notFound');
        const filename = file.name.split('/').pop();
        const encoded = encodeURIComponent(filename).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16)}`);
        res.writeHead(200, {
            'Content-Type': 'application/octet-stream', 'Content-Length': file.size,
            'Content-Disposition': `attachment; filename*=UTF-8''${encoded}`,
            'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
            'Content-Security-Policy': "sandbox; default-src 'none'", 'X-Content-Type-Options': 'nosniff'
        });
        if (!file.size || req.method === 'HEAD') return res.end();
        await pipelineFiles(fs.createReadStream(diskPath(batch.id), { start: file.offset, end: file.offset + file.size - 1 }), res);
    }

    return {
        match(requestPath) { return requestPath === ROUTE || requestPath.startsWith(`${ROUTE}/`); },
        serve(req, res, requestPath) {
            void serve(req, res, requestPath).catch(error => {
                if (res.headersSent || res.destroyed) return;
                sharingJson(res, error.status || 500, { error: error.status ? error.code : 'failed' },
                    req.method === 'POST' ? { Connection: 'close' } : {});
            });
        },
        async dispose() {
            // The server has stopped receiving requests. Wait for any interrupted write to release its file handle.
            await Promise.allSettled([activeUpload, lanDownloads.close()]);
            if (root) await fs.promises.rm(root, { recursive: true, force: true });
        }
    };
}

module.exports = { createFileSharingRoutes };
