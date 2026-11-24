import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSessionProjects } = require('../../lib/session-projects');

test('project view groups sources but separates same-name directories and worktrees without writes', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'projects-'));
    const first = path.join(root, 'a/repo'); const second = path.join(root, 'b/repo');
    fs.mkdirSync(first, { recursive: true }); fs.writeFileSync(path.join(first, 'AGENTS.md'), 'keep');
    const sessions = [{ cwd: first, sessionId: 'one', updatedAt: '2026-01-01' }, { cwd: second, sessionId: 'two' }, { cwd: '', sessionId: 'unknown' }];
    const api = createSessionProjects({ root, inventory: async (source) => source === 'pi' ? sessions : source === 'codex' ? [sessions[0]] : [],
        bookmarks: { list: () => ({ items: [{ cwd: first, id: 'star' }] }) }, handoffs: () => [] });
    try {
        const before = await api.list({ project: first });
        assert.equal(before.projects.length, 3); assert.equal(before.detail.sessions.length, 2);
        assert.deepEqual(before.detail.sources.sort(), ['codex', 'pi']); assert.equal(before.detail.bookmarks.length, 1);
        assert.equal(before.detail.prompts[0], path.join(first, 'AGENTS.md'));
        assert.equal(fs.existsSync(path.join(root, 'projects.json')), false);
        api.map({ from: second, to: first, revision: before.revision });
        const mapped = await api.list({ project: first }); assert.equal(mapped.detail.sessions.length, 3);
        assert.equal(mapped.detail.updatedAt, '2026-01-01');
        assert.equal(mapped.detail.sessions[0].updatedAt, '2026-01-01');
        assert.throws(() => api.map({ from: first, to: second, revision: mapped.revision }), /mapping-invalid/);
        assert.throws(() => api.map({ from: second, to: '', revision: '' }), /conflict/);
        assert.equal(fs.readFileSync(path.join(first, 'AGENTS.md'), 'utf8'), 'keep');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
