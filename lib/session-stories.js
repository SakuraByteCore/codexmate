'use strict';
const path = require('path');
const { createLocalFeatureStore, digest } = require('./local-feature-store');
const { projectKey } = require('./session-bookmarks');
const SHA_PATTERN = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const MAX_NOTE_LENGTH = 4000;
const sessionKey = session => JSON.stringify([session.source, session.sessionId, session.filePath]);

function createSessionStories({ root, projects }) {
    const store = createLocalFeatureStore(path.join(root, 'stories.json'), { version: 1, items: [] });
    function snapshot() {
        const current = store.read();
        if (!Array.isArray(current.value.items) || current.value.items.some(item => !item || typeof item.id !== 'string'
            || typeof item.project !== 'string' || !SHA_PATTERN.test(item.sha || '') || typeof item.note !== 'string'
            || !item.session || ['source', 'sessionId', 'filePath', 'cwd', 'title'].some(key => typeof item.session[key] !== 'string'))) {
            throw new Error('feature-store-invalid');
        }
        return current;
    }
    async function projectSessions(project) {
        if (typeof project !== 'string' || !path.isAbsolute(project)) throw new Error('story-input-invalid');
        const report = await projects.list({ project });
        if (report.detail && projectKey(report.detail.cwd) !== projectKey(project)) throw new Error('story-project-unavailable');
        return (report.detail?.sessions || []).filter(session => projectKey(session.cwd) === projectKey(project));
    }
    async function list(params) {
        const sessions = await projectSessions(params.project);
        const current = snapshot();
        const items = current.value.items.filter(item => item.project === projectKey(params.project)).map(item => ({ ...item,
            available: sessions.some(session => sessionKey(session) === sessionKey(item.session)), association: 'user-linked' }));
        return { items, sessions, revision: current.revision, scope: 'discovered-candidates', readAt: new Date().toISOString() };
    }
    async function save(params) {
        const current = snapshot();
        if (current.revision !== params.revision) throw new Error('feature-store-conflict');
        if (!SHA_PATTERN.test(params.sha || '') || typeof params.note !== 'string' || params.note.length > MAX_NOTE_LENGTH
            || !params.session) throw new Error('story-input-invalid');
        const sessions = await projectSessions(params.project);
        const session = sessions.find(entry => sessionKey(entry) === sessionKey(params.session));
        if (!session) throw new Error('story-session-unavailable');
        // Only bind commits actually offered by the existing read-only project view.
        const report = await projects.git({ project: params.project });
        if (!report.commits?.some(commit => commit.sha === params.sha)) throw new Error('project-git-commit-invalid');
        const project = projectKey(params.project);
        const id = digest(JSON.stringify([project, params.sha, sessionKey(session)]));
        const existing = current.value.items.find(item => item.id === id);
        const now = new Date().toISOString();
        const item = { id, project, sha: params.sha, session: { source: session.source, sessionId: session.sessionId,
            filePath: session.filePath, cwd: session.cwd, title: session.title }, note: params.note,
            createdAt: existing?.createdAt || now, updatedAt: now };
        if (existing) current.value.items[current.value.items.indexOf(existing)] = item;
        else current.value.items.unshift(item);
        store.write(current.value, current.revision);
        return { ...await list(params), item };
    }
    async function remove(params) {
        await projectSessions(params.project);
        const current = snapshot();
        if (current.revision !== params.revision) throw new Error('feature-store-conflict');
        if (!current.value.items.some(item => item.id === params.id && item.project === projectKey(params.project))) throw new Error('story-not-found');
        current.value.items = current.value.items.filter(item => item.id !== params.id);
        store.write(current.value, current.revision);
        return list(params);
    }
    return { list, save, remove };
}
module.exports = { createSessionStories };
