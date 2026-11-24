import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSessionSearchIndex, SOURCES } = require('../../lib/session-search-index');

test('index covers eight sources, old records, incremental updates, deletion and cancelled refresh', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'session-index-'));
    const filePath = path.join(root, 'source.jsonl'); fs.writeFileSync(filePath, 'initial');
    let value = '历史方案 旧消息'; let removed = false; let stop = false;
    const indexed = new Map(); let api;
    const deps = { root, inventory: async (source, limit) => { assert.ok(limit > 300);
        return removed ? [] : [{ source, sessionId: source, filePath, cwd: '/repo', title: '测试标题' }]; },
        nodes: async function* (session) { indexed.set(session.source, (indexed.get(session.source) || 0) + 1);
            if (stop) api.cancel(); yield { id: 'record-900', role: 'user', text: value }; } };
    try {
        api = createSessionSearchIndex(deps); api.start(); await api.wait();
        assert.equal(api.status().indexed, 8);
        const first = await api.search({ query: '历史方案', project: '/repo', role: 'user' });
        assert.equal(first.results.length, 8); assert.equal(first.complete, true);
        assert.equal(first.results[0].nodeId, 'record-900');
        assert.equal((await api.search({ query: '不存在' })).results.length, 0);
        api.start(); await api.wait();
        for (const source of SOURCES.filter((source) => !['opencode', 'zed'].includes(source))) assert.equal(indexed.get(source), 1);
        value = '更新方案'; fs.writeFileSync(filePath, 'changed'); api.start(); await api.wait();
        assert.equal((await api.search({ query: '历史方案' })).results.length, 0);
        assert.equal((await api.search({ query: '更新方案' })).results.length, 8);
        stop = true; fs.writeFileSync(filePath, 'cancel'); api.start(); await api.wait();
        assert.equal(api.status().job.status, 'cancelled');
        assert.equal((await api.search({ query: '更新方案' })).results.length, 8);
        stop = false;
        const catalog = path.join(root, 'index/catalog.json');
        fs.writeFileSync(catalog, '{broken');
        api.start({ rebuild: true }); await api.wait();
        assert.equal(api.status().indexed, 8);
        assert.ok(fs.readdirSync(path.dirname(catalog)).some((name) => name.startsWith('catalog.json.invalid-')));
        removed = true; api.start(); await api.wait();
        assert.equal(api.status().indexed, 0); assert.equal(fs.readFileSync(filePath, 'utf8'), 'cancel');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
