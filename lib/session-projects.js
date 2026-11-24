'use strict';
const fs = require('fs');
const path = require('path');
const { createLocalFeatureStore } = require('./local-feature-store');
const { projectKey } = require('./session-bookmarks');
const { SOURCES } = require('./session-search-index');
const PROJECT_DISCOVERY_LIMIT = 3000;
const PROJECT_SESSION_LIMIT = 100;

function createSessionProjects({ root, inventory, bookmarks, handoffs }) {
    const store = createLocalFeatureStore(path.join(root, 'projects.json'), { version: 1, mappings: {} });
    function resolveProject(cwd, mappings) {
        let key = projectKey(cwd);
        const visited = new Set();
        while (mappings[key]) {
            if (visited.has(key)) throw new Error('project-mapping-invalid');
            visited.add(key); key = mappings[key];
        }
        return key;
    }
    function map(params) {
        if (typeof params.from !== 'string' || typeof params.to !== 'string' || !path.isAbsolute(params.from)
            || (params.to && !path.isAbsolute(params.to))) throw new Error('project-mapping-invalid');
        const snapshot = store.read();
        if (snapshot.revision !== params.revision) throw new Error('feature-store-conflict');
        const from = projectKey(params.from);
        if (params.to) snapshot.value.mappings[from] = projectKey(params.to);
        else delete snapshot.value.mappings[from];
        resolveProject(from, snapshot.value.mappings);
        return store.write(snapshot.value, snapshot.revision);
    }
    async function list(params = {}) {
        const snapshot = store.read();
        const groups = new Map();
        const failures = [];
        for (const source of SOURCES) {
            let sessions;
            try { sessions = await inventory(source, PROJECT_DISCOVERY_LIMIT); }
            catch (_) { failures.push({ source, code: 'index-source-unavailable' }); continue; }
            for (const session of sessions) {
                const key = resolveProject(session.cwd || '', snapshot.value.mappings);
                if (!groups.has(key)) groups.set(key, { key, cwd: key, sessions: [], sources: [], updatedAt: '' });
                const group = groups.get(key);
                const timestamp = session.updatedAt || session.timestamp || '';
                group.sessions.push({ source, sessionId: session.sessionId || '', filePath: session.filePath || '',
                    cwd: session.cwd || '', title: session.title || '', timestamp, updatedAt: timestamp });
                if (!group.sources.includes(source)) group.sources.push(source);
                if (timestamp > group.updatedAt) group.updatedAt = timestamp;
            }
        }
        const projects = [...groups.values()].map((group) => ({ key: group.key, cwd: group.cwd,
            sources: group.sources, sessionCount: group.sessions.length, updatedAt: group.updatedAt }));
        const key = params.project === undefined ? null : resolveProject(params.project, snapshot.value.mappings);
        const group = key === null ? null : groups.get(key);
        let detail = null;
        if (group) {
            const sessions = group.sessions.sort((left, right) => String(right.timestamp).localeCompare(String(left.timestamp))).slice(0, PROJECT_SESSION_LIMIT);
            const prompts = group.cwd ? ['AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md'].map((name) => path.join(group.cwd, name))
                .filter((file) => { try { return fs.lstatSync(file).isFile(); } catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false; throw error; } }) : [];
            detail = { ...group, sessions, truncated: group.sessions.length > PROJECT_SESSION_LIMIT, prompts,
                bookmarks: bookmarks.list().items.filter((item) => resolveProject(item.cwd, snapshot.value.mappings) === key),
                handoffs: sessions.flatMap((session) => session.sessionId ? handoffs(session.sessionId).map((record) => ({ ...record, source: session.source })) : []) };
        }
        return { projects, detail, failures, mappings: snapshot.value.mappings, revision: snapshot.revision,
            readAt: new Date().toISOString(), scope: 'discovered-candidates', discoveryLimit: PROJECT_DISCOVERY_LIMIT };
    }
    function prompt(params) {
        if (!['AGENTS.md', 'CLAUDE.md', '.claude/CLAUDE.md'].includes(params.name) || !params.project) throw new Error('project-mapping-invalid');
        const file = path.join(projectKey(params.project), params.name);
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw new Error('feature-read-failed');
        return { filePath: file, content: fs.readFileSync(file, 'utf8'), readOnly: true };
    }
    return { list, map, prompt };
}
module.exports = { createSessionProjects };
