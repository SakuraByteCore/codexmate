const path = require('path');
const crypto = require('crypto');
const { readJsonArrayFile, writeJsonAtomic, ensureDir } = require('./cli-file-utils');

function generateId() {
    const date = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const datePart = [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join('');
    const hex = crypto.randomBytes(3).toString('hex');
    return `mem_${datePart}_${hex}`;
}

function resolveMemoryFilePath(projectDir) {
    return path.join(projectDir, '.codexmate', 'memories.json');
}

function loadMemories(projectDir) {
    const filePath = resolveMemoryFilePath(projectDir);
    return readJsonArrayFile(filePath, []);
}

function persistMemories(projectDir, memories) {
    const filePath = resolveMemoryFilePath(projectDir);
    ensureDir(path.dirname(filePath));
    writeJsonAtomic(filePath, memories);
}

function saveMemory(projectDir, entry) {
    if (!entry || typeof entry !== 'object') {
        return { error: 'Entry is required' };
    }
    const summary = typeof entry.summary === 'string' ? entry.summary.trim() : '';
    const content = typeof entry.content === 'string' ? entry.content.trim() : '';
    if (!summary) {
        return { error: 'summary is required' };
    }
    if (!content) {
        return { error: 'content is required' };
    }
    const tags = Array.isArray(entry.tags)
        ? entry.tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim())
        : [];
    const sourceSession = typeof entry.sourceSession === 'string' ? entry.sourceSession.trim() : '';

    const now = new Date().toISOString();
    const memory = {
        id: generateId(),
        tags,
        summary,
        content,
        sourceSession,
        createdAt: now,
        updatedAt: now
    };

    const memories = loadMemories(projectDir);
    memories.push(memory);
    persistMemories(projectDir, memories);
    return { success: true, memory };
}

function matchesQuery(entry, queryWords) {
    const haystack = [entry.summary, entry.content, ...(entry.tags || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    return queryWords.every((word) => haystack.includes(word));
}

function matchesTags(entry, tags) {
    if (!Array.isArray(tags) || tags.length === 0) return true;
    const entryTags = (entry.tags || []).map((t) => t.toLowerCase());
    return tags.some((tag) => entryTags.includes(tag.toLowerCase()));
}

function searchMemories(projectDir, options) {
    const opts = options || {};
    const query = typeof opts.query === 'string' ? opts.query.trim() : '';
    if (!query) {
        return { error: 'query is required' };
    }
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const limit = Number.isFinite(opts.limit) && opts.limit > 0 ? Math.min(opts.limit, 100) : 20;
    const tags = Array.isArray(opts.tags) ? opts.tags : [];

    const all = loadMemories(projectDir);
    const results = [];
    for (let i = all.length - 1; i >= 0; i--) {
        const entry = all[i];
        if (matchesTags(entry, tags) && matchesQuery(entry, queryWords)) {
            results.push(entry);
            if (results.length >= limit) break;
        }
    }
    return { success: true, memories: results, count: results.length };
}

function listMemories(projectDir, options) {
    const opts = options || {};
    const tags = Array.isArray(opts.tags) ? opts.tags : [];
    const limit = Number.isFinite(opts.limit) && opts.limit > 0 ? Math.min(opts.limit, 100) : 20;
    const offset = Number.isFinite(opts.offset) && opts.offset >= 0 ? opts.offset : 0;

    const all = loadMemories(projectDir);
    const filtered = tags.length > 0
        ? all.filter((entry) => matchesTags(entry, tags))
        : all;
    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);
    return { success: true, memories: items, total, offset, limit };
}

function updateMemory(projectDir, id, patch) {
    if (!id || typeof id !== 'string') {
        return { error: 'id is required' };
    }
    const memories = loadMemories(projectDir);
    const index = memories.findIndex((m) => m.id === id);
    if (index === -1) {
        return { error: 'Memory not found' };
    }

    const entry = memories[index];
    if (patch && typeof patch === 'object') {
        if (typeof patch.summary === 'string' && patch.summary.trim()) {
            entry.summary = patch.summary.trim();
        }
        if (typeof patch.content === 'string' && patch.content.trim()) {
            entry.content = patch.content.trim();
        }
        if (Array.isArray(patch.tags)) {
            entry.tags = patch.tags.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim());
        }
    }
    entry.updatedAt = new Date().toISOString();
    memories[index] = entry;
    persistMemories(projectDir, memories);
    return { success: true, memory: entry };
}

function deleteMemory(projectDir, id) {
    if (!id || typeof id !== 'string') {
        return { error: 'id is required' };
    }
    const memories = loadMemories(projectDir);
    const index = memories.findIndex((m) => m.id === id);
    if (index === -1) {
        return { error: 'Memory not found' };
    }
    memories.splice(index, 1);
    persistMemories(projectDir, memories);
    return { success: true, id };
}

module.exports = {
    resolveMemoryFilePath,
    loadMemories,
    saveMemory,
    searchMemories,
    listMemories,
    updateMemory,
    deleteMemory
};
