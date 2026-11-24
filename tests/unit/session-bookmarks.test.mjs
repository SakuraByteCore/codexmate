import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSessionBookmarks, projectKey } = require('../../lib/session-bookmarks');

test('bookmarks persist notes, filter tags, reject stale writes and preserve missing-source excerpts', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bookmarks-'));
    let text = '解决方案：保留原始记录';
    const readNode = async () => text ? { source: 'pi', node: { id: 'record-2', text } } : { error: 'gone' };
    try {
        const api = createSessionBookmarks({ root, readNode });
        const params = { source: 'pi', sessionId: 'fixture', nodeId: 'record-2', cwd: '/repo/甲', note: '排障', tags: ['fix', 'fix'], revision: '' };
        const saved = await api.save(params);
        assert.equal(saved.items.length, 1); assert.deepEqual(saved.item.tags, ['fix']);
        const restarted = createSessionBookmarks({ root, readNode });
        assert.equal(restarted.list({ tag: 'fix', project: '/repo/甲', query: '方案' }).items.length, 1);
        assert.equal(restarted.list({ project: '/repo/乙' }).items.length, 0);
        const duplicate = await restarted.save({ ...params, revision: saved.revision });
        assert.equal(duplicate.items.length, 1);
        await assert.rejects(restarted.save({ id: saved.item.id, note: '新备注', tags: [], revision: '' }), /conflict/);
        const edited = await restarted.save({ id: saved.item.id, note: '新备注', tags: ['important'], revision: saved.revision });
        assert.equal(edited.item.note, '新备注');
        assert.equal((await restarted.locate({ id: saved.item.id })).available, true);
        text = 'changed'; assert.equal((await restarted.locate({ id: saved.item.id })).available, false);
        text = ''; assert.equal(restarted.list().items[0].excerpt, '解决方案：保留原始记录');
        assert.equal(restarted.remove({ id: saved.item.id, revision: edited.revision }).items.length, 0);
        assert.notEqual(projectKey('/a/repo'), projectKey('/b/repo'));
        assert.equal(fs.statSync(path.join(root, 'bookmarks.json')).mode & 0o777, 0o600);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
