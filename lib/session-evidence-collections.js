'use strict';
const path = require('path');
const crypto = require('crypto');
const { createLocalFeatureStore, digest } = require('./local-feature-store');
const { SOURCES } = require('./session-search-index');
const MAX_SELECTIONS = 100;
const MAX_NAME_LENGTH = 160;
const MAX_GOAL_LENGTH = 500;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const referenceKey = item => JSON.stringify([item.session.source, item.session.sessionId, item.session.filePath, item.nodeId]);

function normalizeReferences(items) {
    if (!Array.isArray(items) || !items.length || items.length > MAX_SELECTIONS) throw new Error('collection-input-invalid');
    const references = new Map();
    for (const item of items) {
        const session = item?.session;
        if (!session || !SOURCES.includes(session.source) || typeof session.sessionId !== 'string'
            || typeof session.filePath !== 'string' || (!session.sessionId && !session.filePath)
            || typeof item.nodeId !== 'string' || !item.nodeId.startsWith('record-') || !HASH_PATTERN.test(item.textHash || '')
            || typeof session.cwd !== 'string' || typeof session.title !== 'string') throw new Error('collection-input-invalid');
        const reference = { session: { source: session.source, sessionId: session.sessionId, filePath: session.filePath,
            cwd: session.cwd, title: session.title.slice(0, MAX_NAME_LENGTH) }, nodeId: item.nodeId, textHash: item.textHash };
        references.set(referenceKey(reference), reference);
    }
    return [...references.values()];
}
function createSessionEvidenceCollections({ root, readNode }) {
    const store = createLocalFeatureStore(path.join(root, 'collections.json'), { version: 1, items: [] });
    function snapshot() {
        const current = store.read();
        if (!Array.isArray(current.value.items)) throw new Error('feature-store-invalid');
        for (const item of current.value.items) {
            if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.goal !== 'string') throw new Error('feature-store-invalid');
            try { normalizeReferences(item.references); } catch (_) { throw new Error('feature-store-invalid'); }
        }
        return current;
    }
    function list() {
        const current = snapshot();
        return { items: current.value.items, revision: current.revision };
    }
    async function inspect(references) {
        const items = [];
        for (const reference of references) {
            const result = await readNode({ ...reference.session, nodeId: reference.nodeId });
            const state = result.error ? 'unavailable' : digest(result.node.text) === reference.textHash ? 'ready' : 'changed';
            items.push({ ...reference, state });
        }
        return { items, complete: items.every(item => item.state === 'ready'), checkedAt: new Date().toISOString() };
    }
    async function open(params) {
        const current = snapshot();
        const item = current.value.items.find(entry => entry.id === params.id);
        if (!item) throw new Error('collection-not-found');
        return { item, revision: current.revision, ...await inspect(item.references) };
    }
    async function save(params) {
        const current = snapshot();
        if (current.revision !== params.revision) throw new Error('feature-store-conflict');
        if (typeof params.name !== 'string' || !params.name.trim() || params.name.length > MAX_NAME_LENGTH
            || typeof params.goal !== 'string' || params.goal.length > MAX_GOAL_LENGTH) throw new Error('collection-input-invalid');
        const references = normalizeReferences(params.references);
        const existing = params.id && current.value.items.find(item => item.id === params.id);
        if (params.id && !existing) throw new Error('collection-not-found');
        const report = await inspect(references);
        if (!report.complete) throw new Error('collection-source-unavailable');
        const now = new Date().toISOString();
        const item = { id: existing?.id || crypto.randomBytes(16).toString('hex'), name: params.name.trim(), goal: params.goal,
            references, createdAt: existing?.createdAt || now, updatedAt: now };
        if (existing) current.value.items[current.value.items.indexOf(existing)] = item;
        else current.value.items.unshift(item);
        store.write(current.value, current.revision);
        return { ...list(), item };
    }
    function remove(params) {
        const current = snapshot();
        if (current.revision !== params.revision) throw new Error('feature-store-conflict');
        if (!current.value.items.some(item => item.id === params.id)) throw new Error('collection-not-found');
        current.value.items = current.value.items.filter(item => item.id !== params.id);
        store.write(current.value, current.revision);
        return list();
    }
    return { list, open, save, remove };
}
module.exports = { createSessionEvidenceCollections };
