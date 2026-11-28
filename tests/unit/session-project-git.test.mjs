import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { sessionGitMixin } from '../../web-ui/modules/session-git.mjs';
const require = createRequire(import.meta.url);
const { readProjectGit, readCommitFiles } = require('../../lib/session-project-git');
const run = (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim();

test('Git snapshots are read-only, show file changes and label time-based candidates', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-git-'));
    try {
        run(root, ['init', '-q']); run(root, ['config', 'user.name', 'Fixture']); run(root, ['config', 'user.email', 'fixture@example.invalid']);
        fs.writeFileSync(path.join(root, 'source.txt'), 'one'); run(root, ['add', 'source.txt']); run(root, ['commit', '-qm', 'initial']);
        fs.writeFileSync(path.join(root, 'source.txt'), 'two');
        const index = fs.readFileSync(path.join(root, '.git/index'));
        const sessions = [{ source: 'pi', sessionId: 'near', cwd: root, updatedAt: new Date().toISOString() },
            { source: 'codex', sessionId: 'old', cwd: root, updatedAt: '2000-01-01' }, { source: 'pi', sessionId: 'other', cwd: root + '-other', updatedAt: new Date().toISOString() }];
        const report = await readProjectGit({ cwd: root, sessions });
        assert.equal(report.status, 'ready'); assert.equal(report.changedFiles, 1); assert.equal(report.association, 'session-update-within-24h');
        assert.deepEqual(report.commits[0].candidates.map(item => item.sessionId), ['near']); assert.equal(report.commits[0].subject, 'initial');
        assert.match((await readCommitFiles({ cwd: root, sha: report.head })).stat, /source.txt/);
        assert.deepEqual(fs.readFileSync(path.join(root, '.git/index')), index); assert.equal(fs.readFileSync(path.join(root, 'source.txt'), 'utf8'), 'two');
        await assert.rejects(readCommitFiles({ cwd: root, sha: '--bad' }), /invalid/);
        const worktree = root + '-worktree'; run(root, ['worktree', 'add', '-qb', 'fixture-branch', worktree]);
        const second = await readProjectGit({ cwd: worktree, sessions }); assert.equal(second.root, worktree); assert.equal(second.commits[0].candidates.length, 0);
        run(root, ['worktree', 'remove', worktree]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('empty repositories and non-repositories have distinct states', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-git-empty-'));
    try {
        assert.equal((await readProjectGit({ cwd: root, sessions: [] })).status, 'not-repository');
        run(root, ['init', '-q']); assert.equal((await readProjectGit({ cwd: root, sessions: [] })).status, 'unborn');
        assert.equal((await readProjectGit({ cwd: root + '/missing', sessions: [] })).status, 'path-unavailable');
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('switching projects invalidates late Git results', async () => {
    const vm = { ...sessionGitMixin.data(), ...sessionGitMixin.methods, projectSelected: '/one' };
    let resolve; vm.featureCall = () => new Promise(done => { resolve = done; });
    const pending = vm.loadProjectGit(); vm.projectSelected = '/two'; sessionGitMixin.watch.projectSelected.call(vm);
    resolve({ root: '/one' }); await pending; assert.equal(vm.projectGit, null); assert.equal(vm.projectGitBusy, false);
});
