'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const { createLocalFeatureStore, digest } = require('./local-feature-store');
const { projectKey } = require('./session-bookmarks');
const SOURCES = ['codex', 'claude', 'gemini', 'codebuddy', 'workbuddy', 'pi', 'opencode', 'zed'];
const DEFAULT_DISCOVERY_LIMIT = 3000;
const MAX_DISCOVERY_LIMIT = 10000;
const MAX_RESULTS = 100;
const SNIPPET_LENGTH = 1200;
const BLOOM_BYTES = 256;

async function fileRevision(session) {
    if (session.source === 'opencode' || session.source === 'zed') return null;
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(session.filePath)) hash.update(chunk);
    return hash.digest('hex');
}
async function* readShard(file) {
    const stream = fs.createReadStream(file, { encoding: 'utf8' });
    const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let failure;
    stream.on('error', (error) => { failure = error; lines.close(); });
    try {
        for await (const line of lines) if (line) yield JSON.parse(line);
        if (failure) throw failure;
    } finally { lines.close(); stream.destroy(); }
}
function createSessionSearchIndex({ root, inventory, nodes }) {
    const directory = path.join(root, 'index');
    const store = createLocalFeatureStore(path.join(directory, 'catalog.json'), { version: 1, items: [], failures: [], coverage: [] });
    let job = { status: 'idle', processed: 0, candidates: 0, failures: [] };
    let activePromise;
    let activeSearches = 0;
    function status() {
        const snapshot = store.read().value;
        return { job: { ...job, failures: [...job.failures] }, indexed: snapshot.items.length,
            failures: snapshot.failures, coverage: snapshot.coverage, updatedAt: snapshot.updatedAt || '' };
    }
    async function writeShard(session, before) {
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        const temporary = path.join(directory, `${crypto.randomBytes(16).toString('hex')}.tmp`);
        const output = await fs.promises.open(temporary, 'wx', 0o600);
        const hash = crypto.createHash('sha256');
        const bloom = Buffer.alloc(BLOOM_BYTES);
        let count = 0;
        let previous = '';
        let pending;
        async function emit(nextText) {
            const line = JSON.stringify({ ...pending, before: previous, after: nextText.slice(0, SNIPPET_LENGTH) }) + '\n';
            hash.update(line); await output.write(line); previous = pending.text.slice(-SNIPPET_LENGTH);
            const text = `${session.title || ''}\n${pending.text}`.toLowerCase();
            for (let index = 0; index + 1 < text.length; index++) {
                const bit = (text.charCodeAt(index) * 31 + text.charCodeAt(index + 1)) % (BLOOM_BYTES * 8);
                bloom[bit >> 3] |= 1 << (bit & 7);
            }
        }
        try {
            for await (const node of nodes(session)) {
                if (job.cancelled) throw new Error('index-cancelled');
                if (pending) await emit(node.text);
                pending = { id: node.id, role: node.role, text: node.text, textHash: digest(node.text), timestamp: node.timestamp };
                count++;
            }
            if (pending) await emit('');
            if (before !== null && await fileRevision(session) !== before) throw new Error('index-source-changed');
            await output.close();
            const shard = `${digest(JSON.stringify([session.source, session.sessionId, session.filePath, hash.digest('hex')]))}.jsonl`;
            await fs.promises.rename(temporary, path.join(directory, shard));
            await fs.promises.writeFile(path.join(directory, shard + '.bloom'), bloom, { mode: 0o600 });
            return { shard, count };
        } finally {
            await output.close();
            if (fs.existsSync(temporary)) await fs.promises.unlink(temporary);
        }
    }
    async function refresh(params) {
        let snapshot;
        try { snapshot = store.read(); }
        catch (error) {
            if (!params.rebuild) throw error;
            const catalog = path.join(directory, 'catalog.json');
            if (fs.lstatSync(catalog).isSymbolicLink()) throw new Error('feature-store-invalid');
            fs.renameSync(catalog, catalog + '.invalid-' + Date.now());
            snapshot = store.read();
            params = { ...params, source: 'all' };
        }
        const sources = !params.source || params.source === 'all' ? SOURCES : [params.source];
        if (sources.some((source) => !SOURCES.includes(source))) throw new Error('index-source-invalid');
        const limit = Math.min(MAX_DISCOVERY_LIMIT, Math.max(1, Number(params.limit) || DEFAULT_DISCOVERY_LIMIT));
        const entries = snapshot.value.items.filter((item) => !sources.includes(item.source));
        const failures = snapshot.value.failures.filter((item) => !sources.includes(item.source));
        const coverage = snapshot.value.coverage.filter((item) => !sources.includes(item.source));
        for (const source of sources) {
            if (job.cancelled) throw new Error('index-cancelled');
            let sessions;
            try { sessions = await inventory(source, limit); }
            catch (_) { failures.push({ source, code: 'index-source-unavailable' }); continue; }
            job.candidates += sessions.length;
            coverage.push({ source, candidates: sessions.length, discoveryLimit: limit, scope: 'discovered-candidates' });
            for (const session of sessions) {
                if (job.cancelled) throw new Error('index-cancelled');
                try {
                    const revision = await fileRevision(session);
                    const key = digest(JSON.stringify([source, session.sessionId, session.filePath]));
                    const old = snapshot.value.items.find((item) => item.key === key);
                    const cached = params.rebuild !== true && revision !== null && /^[a-f0-9]{64}\.jsonl$/.test(old?.shard || '') && old?.revision === revision && fs.existsSync(path.join(directory, old.shard));
                    const shard = cached ? { shard: old.shard, count: old.count } : await writeShard(session, revision);
                    entries.push({ key, source, sessionId: session.sessionId || '', filePath: session.filePath || '',
                        cwd: session.cwd || '', title: session.title || '', timestamp: session.updatedAt || session.timestamp || '', updatedAt: session.updatedAt || session.timestamp || '', revision, ...shard });
                } catch (_) { failures.push({ source, sessionId: session.sessionId || '', code: 'index-source-unavailable' }); }
                job.processed++; job.failures = failures;
            }
        }
        if (job.cancelled) throw new Error('index-cancelled');
        store.write({ version: 1, items: entries, failures, coverage, updatedAt: new Date().toISOString() }, snapshot.revision);
    }
    async function pruneShards() {
        if (activeSearches || !fs.existsSync(directory)) return;
        const keep = new Set(store.read().value.items.flatMap((item) => [item.shard, item.shard + '.bloom']));
        for (const name of await fs.promises.readdir(directory)) {
            if (/^[a-f0-9]{64}\.jsonl(?:\.bloom)?$/.test(name) && !keep.has(name)) await fs.promises.unlink(path.join(directory, name));
        }
    }
    function start(params = {}) {
        if (job.status === 'running') throw new Error('index-busy');
        if (params.rebuild !== undefined && typeof params.rebuild !== 'boolean') throw new Error('index-input-invalid');
        if (params.source && params.source !== 'all' && !SOURCES.includes(params.source)) throw new Error('index-source-invalid');
        if (params.limit !== undefined && (!Number.isSafeInteger(params.limit) || params.limit < 1 || params.limit > MAX_DISCOVERY_LIMIT)) throw new Error('index-input-invalid');
        job = { status: 'running', processed: 0, candidates: 0, failures: [], cancelled: false };
        activePromise = refresh(params).finally(pruneShards).then(() => { job.status = job.failures.length ? 'partial' : 'success'; }).catch((error) => { job.status = job.cancelled ? 'cancelled' : 'failed';
            job.errorCode = /^index-/.test(error.message) ? error.message : 'index-refresh-failed'; });
        return status();
    }
    function cancel() { if (job.status === 'running') job.cancelled = true; return status(); }
    async function search(params = {}) {
        const query = String(params.query || '').trim().toLowerCase();
        if (!query) throw new Error('index-query-empty');
        const tokens = query.split(/\s+/).filter(Boolean);
        const snapshot = store.read().value;
        const items = snapshot.items.filter((item) => (!params.source || params.source === 'all' || item.source === params.source)
            && (!params.project || projectKey(item.cwd) === projectKey(params.project)));
        const results = [];
        const failures = [...snapshot.failures];
        let scanned = 0;
        let truncated = false;
        activeSearches++;
        try {
        for (const session of items) {
            if (!/^[a-f0-9]{64}\.jsonl$/.test(session.shard)) throw new Error('feature-store-invalid');
            try {
                const bloomPath = path.join(directory, session.shard + '.bloom');
                if (fs.existsSync(bloomPath)) {
                    const bloom = await fs.promises.readFile(bloomPath);
                    const absent = (token) => {
                        for (let index = 0; index + 1 < token.length; index++) {
                            const bit = (token.charCodeAt(index) * 31 + token.charCodeAt(index + 1)) % (BLOOM_BYTES * 8);
                            if (!(bloom[bit >> 3] & (1 << (bit & 7)))) return true;
                        }
                        return false;
                    };
                    const skip = params.mode === 'any' ? tokens.every(absent) : tokens.some(absent);
                    if (bloom.length === BLOOM_BYTES && skip) { scanned++; continue; }
                }
                for await (const node of readShard(path.join(directory, session.shard))) {
                    if (params.role && params.role !== 'all' && node.role !== params.role) continue;
                    const text = `${params.scope === 'all' ? session.title : ''}\n${node.text}`.toLowerCase();
                    const hit = params.mode === 'any' ? tokens.some((token) => text.includes(token)) : tokens.every((token) => text.includes(token));
                    if (!hit) continue;
                    if (results.length >= MAX_RESULTS) { truncated = true; break; }
                    const position = node.text.toLowerCase().indexOf(tokens[0]);
                    results.push({ session, nodeId: node.id, textHash: node.textHash, role: node.role,
                        snippet: node.text.slice(Math.max(0, position - SNIPPET_LENGTH / 4), Math.max(0, position - SNIPPET_LENGTH / 4) + SNIPPET_LENGTH),
                        before: node.before, after: node.after });
                }
                scanned++;
            } catch (_) { failures.push({ source: session.source, sessionId: session.sessionId, code: 'index-shard-unavailable' }); }
            if (truncated) break;
        }
        } finally { activeSearches--; }
        return { results, truncated, scanned, candidates: items.length, failures, coverage: snapshot.coverage,
            complete: scanned === items.length && !failures.length && !truncated, scope: 'indexed-discovered-candidates' };
    }
    return { status, start, cancel, search, wait: () => activePromise };
}
module.exports = { createSessionSearchIndex, SOURCES };
