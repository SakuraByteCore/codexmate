'use strict';
const path = require('path');
const { createLocalFeatureStore, digest } = require('./local-feature-store');
const MAX_NOTE_LENGTH = 4000;
const MAX_TAG_LENGTH = 80;
const MAX_TAGS = 20;
const MAX_EXCERPT_LENGTH = 50000;

function projectKey(cwd) {
    if (!cwd) return '';
    // Respect Windows path rules without merging same-named directories or worktrees.
    return process.platform === 'win32' ? path.resolve(cwd).toLowerCase() : path.resolve(cwd);
}
function createSessionBookmarks({ root, readNode }) {
    const store = createLocalFeatureStore(path.join(root, 'bookmarks.json'), { version: 1, items: [] });
    function list(params = {}) {
        const snapshot = store.read();
        if (!Array.isArray(snapshot.value.items)) throw new Error('feature-store-invalid');
        const query = String(params.query || '').toLowerCase();
        const items = snapshot.value.items.filter((item) => (!params.project || item.projectKey === projectKey(params.project))
            && (!params.tag || item.tags.includes(params.tag))
            && `${item.excerpt}\n${item.note}\n${item.tags.join(' ')}`.toLowerCase().includes(query));
        return { items, revision: snapshot.revision };
    }
    function edit(params) {
        if (typeof params.note !== 'string' || params.note.length > MAX_NOTE_LENGTH || !Array.isArray(params.tags)
            || params.tags.length > MAX_TAGS || params.tags.some((tag) => typeof tag !== 'string' || tag.length > MAX_TAG_LENGTH)) {
            throw new Error('bookmark-input-invalid');
        }
        return { note: params.note, tags: [...new Set(params.tags.map((tag) => tag.trim()).filter(Boolean))] };
    }
    async function save(params) {
        const snapshot = store.read();
        if (snapshot.revision !== params.revision) throw new Error('feature-store-conflict');
        const fields = edit(params);
        const existing = params.id && snapshot.value.items.find((item) => item.id === params.id);
        if (params.id && !existing) throw new Error('bookmark-not-found');
        let item = existing;
        if (!item) {
            const result = await readNode(params);
            if (result.error) throw new Error('bookmark-source-unavailable');
            const node = result.node;
            const id = digest(JSON.stringify([result.source, params.sessionId || params.filePath, node.id]));
            item = snapshot.value.items.find((entry) => entry.id === id);
            if (item) return { ...list(), item };
            if (node.text.length > MAX_EXCERPT_LENGTH) throw new Error('bookmark-excerpt-too-large');
            item = { id, source: result.source, sessionId: params.sessionId || '', filePath: params.filePath || '',
                nodeId: node.id, cwd: params.cwd || '', projectKey: projectKey(params.cwd), excerpt: node.text,
                textHash: digest(node.text), createdAt: new Date().toISOString() };
            snapshot.value.items.unshift(item);
        }
        Object.assign(item, fields, { updatedAt: new Date().toISOString() });
        store.write(snapshot.value, snapshot.revision);
        return { ...list(), item };
    }
    function remove(params) {
        const snapshot = store.read();
        if (snapshot.revision !== params.revision) throw new Error('feature-store-conflict');
        snapshot.value.items = snapshot.value.items.filter((item) => item.id !== params.id);
        store.write(snapshot.value, snapshot.revision);
        return list();
    }
    async function locate(params) {
        const item = store.read().value.items.find((entry) => entry.id === params.id);
        if (!item) throw new Error('bookmark-not-found');
        const result = await readNode({ ...item, nodeId: item.nodeId });
        if (result.error || digest(result.node.text) !== item.textHash) return { item, available: false };
        return { item, available: true, node: result.node };
    }
    return { list, save, remove, locate };
}
module.exports = { createSessionBookmarks, projectKey };
