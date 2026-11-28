import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSessionProjects } = require('../../lib/session-projects');
const { createSessionStories } = require('../../lib/session-stories');
const run = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

test('explicit stories survive restart, isolate worktrees, reject unknown commits and never write Git', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stories-'));
    const repo = path.join(root, 'repo'); const worktree = path.join(root, 'other/repo');
    fs.mkdirSync(repo); run(repo, ['init', '-q']); run(repo, ['config', 'user.name', 'Fixture']); run(repo, ['config', 'user.email', 'fixture@example.invalid']);
    fs.writeFileSync(path.join(repo, 'source.txt'), 'keep'); run(repo, ['add', 'source.txt']); run(repo, ['commit', '-qm', 'fixture']);
    run(repo, ['worktree', 'add', '-qb', 'other', worktree]);
    let sessions = [{ source: 'pi', sessionId: 'same', filePath: '/first', cwd: repo, title: 'first' },
        { source: 'pi', sessionId: 'same', filePath: '/second', cwd: worktree, title: 'second' }];
    const projects = createSessionProjects({ root, inventory: async source => source === 'pi' ? sessions : [], bookmarks: { list: () => ({ items: [] }) }, handoffs: () => [] });
    let api = createSessionStories({ root, projects });
    const sha = run(repo, ['rev-parse', 'HEAD']); const index = fs.readFileSync(path.join(repo, '.git/index')); const refs = run(repo, ['show-ref']);
    try {
        assert.equal((await api.list({ project: repo })).items.length, 0);
        let saved = await api.save({ project: repo, sha, session: sessions[0], note: 'why this changed', revision: '' });
        api = createSessionStories({ root, projects });
        let restored = await api.list({ project: repo }); assert.equal(restored.items[0].note, 'why this changed');
        assert.equal(restored.items[0].association, 'user-linked'); assert.equal(restored.items[0].available, true);
        saved = await api.save({ project: worktree, sha, session: sessions[1], note: 'separate', revision: saved.revision });
        assert.equal((await api.list({ project: repo })).items.length, 1); assert.equal((await api.list({ project: worktree })).items.length, 1);
        await assert.rejects(api.save({ project: repo, sha: 'a'.repeat(40), session: sessions[0], note: '', revision: saved.revision }), /commit-invalid/);
        await assert.rejects(api.save({ project: repo, sha, session: sessions[1], note: '', revision: saved.revision }), /session-unavailable/);
        await assert.rejects(api.save({ project: repo, sha, session: sessions[0], note: '', revision: '' }), /conflict/);
        const linkedId = restored.items[0].id;
        sessions = sessions.filter(session => session.cwd !== repo);
        restored = await api.list({ project: repo }); assert.equal(restored.items[0].available, false);
        const removed = await api.remove({ project: repo, id: linkedId, revision: saved.revision }); assert.equal(removed.items.length, 0);
        assert.equal((await api.list({ project: worktree })).items.length, 1);
        assert.deepEqual(fs.readFileSync(path.join(repo, '.git/index')), index); assert.equal(run(repo, ['show-ref']), refs);
        assert.equal(fs.readFileSync(path.join(repo, 'source.txt'), 'utf8'), 'keep');
        fs.writeFileSync(path.join(root, 'stories.json'), '{bad'); await assert.rejects(api.list({ project: worktree }));
        assert.equal(fs.readFileSync(path.join(root, 'stories.json'), 'utf8'), '{bad');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
