'use strict';
const { execFile } = require('child_process');
const path = require('path');
const MAX_COMMITS = 30;
const MAX_CHANGES = 50;
const TIME_WINDOW_MS = 24 * 60 * 60 * 1000;
const GIT_TIMEOUT_MS = 5000;
const MAX_OUTPUT_BYTES = 256 * 1024;
function git(cwd, args) {
    return new Promise((resolve, reject) => execFile('git', ['--no-optional-locks', '-C', cwd, ...args],
        { encoding: 'utf8', timeout: GIT_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES, windowsHide: true },
        (error, stdout, stderr) => { if (error) { error.stderr = stderr; reject(error); } else resolve(stdout); }));
}
function changesFromStatus(output) {
    const fields = output.split('\0');
    const changes = [];
    for (let index = 0; index < fields.length; index++) {
        const field = fields[index];
        if (!field) continue;
        const status = field.slice(0, 2);
        changes.push({ status, path: field.slice(3) });
        if (/[RC]/.test(status)) index++;
    }
    return { changes: changes.slice(0, MAX_CHANGES), changedFiles: changes.length, changesTruncated: changes.length > MAX_CHANGES };
}
async function readProjectGit({ cwd, sessions }) {
    const readAt = new Date().toISOString();
    if (!cwd || !path.isAbsolute(cwd)) return { status: 'path-unavailable', readAt };
    try {
        const root = (await git(cwd, ['rev-parse', '--show-toplevel'])).trim();
        const state = changesFromStatus(await git(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=normal']));
        const branch = (await git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']).catch(error => {
            if (error.code === 1) return ''; throw error;
        })).trim();
        const head = (await git(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD']).catch(error => {
            if (error.code === 1) return ''; throw error;
        })).trim();
        if (!head) return { status: 'unborn', root, branch, head, readAt, commits: [], ...state };
        const history = await git(cwd, ['log', `-${MAX_COMMITS + 1}`, '--format=%H%x00%cI%x00%s%x00']);
        const fields = history.split('\0');
        const commits = [];
        for (let index = 0; index + 2 < fields.length; index += 3) {
            const sha = fields[index].trim();
            if (!sha) continue;
            const timestamp = fields[index + 1];
            const time = Date.parse(timestamp);
            const candidates = sessions.filter(session => path.resolve(session.cwd || cwd) === path.resolve(cwd)
                && Number.isFinite(Date.parse(session.updatedAt || session.timestamp))
                && Math.abs(time - Date.parse(session.updatedAt || session.timestamp)) <= TIME_WINDOW_MS);
            commits.push({ sha, timestamp, subject: fields[index + 2], candidates });
        }
        return { status: 'ready', root, branch, head, readAt, ...state, commits: commits.slice(0, MAX_COMMITS),
            commitsTruncated: commits.length > MAX_COMMITS, association: 'session-update-within-24h', readOnly: true };
    } catch (error) {
        const status = error.code === 'ENOENT' ? 'git-unavailable' : /not a git repository/.test(error.stderr || '') ? 'not-repository'
            : /cannot change to/.test(error.stderr || '') ? 'path-unavailable' : error.killed ? 'read-timeout' : 'read-failed';
        return { status, readAt, readOnly: true };
    }
}
async function readCommitFiles({ cwd, sha }) {
    if (!/^[a-f0-9]{40,64}$/.test(sha || '')) throw new Error('project-git-commit-invalid');
    const output = await git(cwd, ['show', '--format=', '--stat', '--no-ext-diff', '--no-textconv', sha, '--']);
    return { sha, stat: output, readOnly: true, readAt: new Date().toISOString() };
}
module.exports = { readProjectGit, readCommitFiles };
