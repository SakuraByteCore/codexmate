import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSessionEvidenceCollections } = require('../../lib/session-evidence-collections');
const { digest } = require('../../lib/local-feature-store');

test('collections persist only references, recheck restored sources and reject changed saves', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'collections-'));
    let text = 'selected original'; let missing = false;
    const deps = { root, readNode: async () => missing ? { error: 'unavailable' } : { node: { text } } };
    const reference = source => ({ session: { source, sessionId: 'same', filePath: '/same', cwd: '/repo', title: source }, nodeId: 'record-1', textHash: digest(text), snippet: text });
    try {
        let api = createSessionEvidenceCollections(deps);
        assert.equal(api.list().revision, ''); assert.equal(fs.existsSync(path.join(root, 'collections.json')), false);
        const first = await api.save({ name: 'First', goal: 'reuse', references: [reference('codex'), reference('pi'), reference('pi')], revision: '' });
        assert.equal(first.item.references.length, 2); assert.equal(JSON.stringify(first).includes('selected original'), false);
        const second = await api.save({ name: 'Second', goal: '', references: [reference('pi')], revision: first.revision });
        api = createSessionEvidenceCollections(deps);
        assert.equal(api.list().items.length, 2); assert.equal((await api.open({ id: first.item.id })).complete, true);
        text = 'changed'; const changed = await api.open({ id: first.item.id });
        assert.equal(changed.complete, false); assert.equal(changed.items[0].state, 'changed');
        await assert.rejects(api.save({ ...first.item, revision: second.revision }), /source-unavailable/);
        missing = true; assert.equal((await api.open({ id: first.item.id })).items[0].state, 'unavailable');
        assert.equal(api.list().items[1].references[0].textHash, first.item.references[0].textHash);
        assert.throws(() => api.remove({ id: first.item.id, revision: '' }), /conflict/);
        const removed = api.remove({ id: first.item.id, revision: second.revision }); assert.deepEqual(removed.items.map(item => item.id), [second.item.id]);
        fs.writeFileSync(path.join(root, 'collections.json'), '{bad'); assert.throws(() => api.list());
        assert.equal(fs.readFileSync(path.join(root, 'collections.json'), 'utf8'), '{bad');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('collection writes reject empty/oversized inputs and changes during asynchronous verification', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'collection-conflict-'));
    const reference = { session: { source: 'pi', sessionId: 'id', filePath: '', cwd: '', title: '' }, nodeId: 'record-1', textHash: digest('one') };
    let finish;
    const api = createSessionEvidenceCollections({ root, readNode: () => new Promise(resolve => { finish = resolve; }) });
    try {
        await assert.rejects(api.save({ name: '', goal: '', references: [reference], revision: '' }), /input-invalid/);
        await assert.rejects(api.save({ name: 'name', goal: '', references: Array(101).fill(reference), revision: '' }), /input-invalid/);
        const pending = api.save({ name: 'name', goal: '', references: [reference], revision: '' });
        fs.writeFileSync(path.join(root, 'collections.json'), JSON.stringify({ version: 1, items: [] }));
        finish({ node: { text: 'one' } }); await assert.rejects(pending, /conflict/);
        assert.deepEqual(api.list().items, []);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
