import assert from 'assert';
import test from 'node:test';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const {
    resolveMemoryFilePath,
    loadMemories,
    saveMemory,
    searchMemories,
    listMemories,
    updateMemory,
    deleteMemory
} = require(path.join(__dirname, '..', '..', 'lib', 'memory-store.js'));

function makeTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'memory-store-test-'));
}

function cleanupTmpDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

test('resolveMemoryFilePath returns project-level path', () => {
    const result = resolveMemoryFilePath('/tmp/myproject');
    assert.strictEqual(result, path.join('/tmp/myproject', '.codexmate', 'memories.json'));
});

test('loadMemories returns empty array for missing file', () => {
    const dir = makeTmpDir();
    try {
        const result = loadMemories(dir);
        assert.deepStrictEqual(result, []);
    } finally {
        cleanupTmpDir(dir);
    }
});

test('saveMemory creates file and returns entry with id/timestamps', () => {
    const dir = makeTmpDir();
    try {
        const result = saveMemory(dir, { summary: 'test summary', content: 'test content', tags: ['a', 'b'] });
        assert.strictEqual(result.success, true);
        assert.ok(result.memory.id.startsWith('mem_'));
        assert.strictEqual(result.memory.summary, 'test summary');
        assert.strictEqual(result.memory.content, 'test content');
        assert.deepStrictEqual(result.memory.tags, ['a', 'b']);
        assert.ok(result.memory.createdAt);
        assert.ok(result.memory.updatedAt);

        const file = resolveMemoryFilePath(dir);
        assert.ok(fs.existsSync(file));
        const loaded = JSON.parse(fs.readFileSync(file, 'utf-8'));
        assert.strictEqual(loaded.length, 1);
        assert.strictEqual(loaded[0].id, result.memory.id);
    } finally {
        cleanupTmpDir(dir);
    }
});

test('saveMemory rejects missing summary', () => {
    const dir = makeTmpDir();
    try {
        const result = saveMemory(dir, { content: 'only content' });
        assert.ok(result.error);
        assert.ok(result.error.includes('summary'));
    } finally {
        cleanupTmpDir(dir);
    }
});

test('saveMemory rejects missing content', () => {
    const dir = makeTmpDir();
    try {
        const result = saveMemory(dir, { summary: 'only summary' });
        assert.ok(result.error);
        assert.ok(result.error.includes('content'));
    } finally {
        cleanupTmpDir(dir);
    }
});

test('searchMemories matches case-insensitive substring', () => {
    const dir = makeTmpDir();
    try {
        saveMemory(dir, { summary: 'JWT Auth Bug', content: 'fixed race condition', tags: ['auth'] });
        saveMemory(dir, { summary: 'UI Layout', content: 'flexbox changes', tags: ['ui'] });

        const r1 = searchMemories(dir, { query: 'jwt' });
        assert.strictEqual(r1.count, 1);
        assert.strictEqual(r1.memories[0].summary, 'JWT Auth Bug');

        const r2 = searchMemories(dir, { query: 'flexbox' });
        assert.strictEqual(r2.count, 1);
        assert.strictEqual(r2.memories[0].summary, 'UI Layout');

        const r3 = searchMemories(dir, { query: 'nonexistent' });
        assert.strictEqual(r3.count, 0);
    } finally {
        cleanupTmpDir(dir);
    }
});

test('searchMemories supports multi-word AND logic', () => {
    const dir = makeTmpDir();
    try {
        saveMemory(dir, { summary: 'JWT refresh token fix', content: 'added mutex', tags: [] });
        saveMemory(dir, { summary: 'JWT auth setup', content: 'new provider config', tags: [] });

        const r = searchMemories(dir, { query: 'jwt refresh' });
        assert.strictEqual(r.count, 1);
        assert.strictEqual(r.memories[0].summary, 'JWT refresh token fix');
    } finally {
        cleanupTmpDir(dir);
    }
});

test('searchMemories supports tag filter', () => {
    const dir = makeTmpDir();
    try {
        saveMemory(dir, { summary: 'entry one', content: 'content', tags: ['auth', 'backend'] });
        saveMemory(dir, { summary: 'entry two', content: 'content', tags: ['ui'] });

        const r = searchMemories(dir, { query: 'entry', tags: ['auth'] });
        assert.strictEqual(r.count, 1);
        assert.strictEqual(r.memories[0].summary, 'entry one');
    } finally {
        cleanupTmpDir(dir);
    }
});

test('searchMemories requires query', () => {
    const dir = makeTmpDir();
    try {
        const r = searchMemories(dir, {});
        assert.ok(r.error);
    } finally {
        cleanupTmpDir(dir);
    }
});

test('listMemories returns all entries without filters', () => {
    const dir = makeTmpDir();
    try {
        saveMemory(dir, { summary: 'a', content: 'c1', tags: [] });
        saveMemory(dir, { summary: 'b', content: 'c2', tags: [] });
        saveMemory(dir, { summary: 'c', content: 'c3', tags: [] });

        const r = listMemories(dir, {});
        assert.strictEqual(r.total, 3);
        assert.strictEqual(r.memories.length, 3);
    } finally {
        cleanupTmpDir(dir);
    }
});

test('listMemories supports pagination', () => {
    const dir = makeTmpDir();
    try {
        for (let i = 0; i < 5; i++) {
            saveMemory(dir, { summary: `entry ${i}`, content: `content ${i}`, tags: [] });
        }

        const r1 = listMemories(dir, { limit: 2, offset: 0 });
        assert.strictEqual(r1.total, 5);
        assert.strictEqual(r1.memories.length, 2);

        const r2 = listMemories(dir, { limit: 2, offset: 4 });
        assert.strictEqual(r2.total, 5);
        assert.strictEqual(r2.memories.length, 1);
    } finally {
        cleanupTmpDir(dir);
    }
});

test('listMemories supports tag filter', () => {
    const dir = makeTmpDir();
    try {
        saveMemory(dir, { summary: 'a', content: 'c', tags: ['auth'] });
        saveMemory(dir, { summary: 'b', content: 'c', tags: ['ui'] });
        saveMemory(dir, { summary: 'c', content: 'c', tags: ['auth', 'ui'] });

        const r = listMemories(dir, { tags: ['auth'] });
        assert.strictEqual(r.total, 2);
    } finally {
        cleanupTmpDir(dir);
    }
});

test('updateMemory merges fields and updates updatedAt', () => {
    const dir = makeTmpDir();
    try {
        const saved = saveMemory(dir, { summary: 'original', content: 'original content', tags: ['a'] });
        const id = saved.memory.id;
        const originalUpdatedAt = saved.memory.updatedAt;

        const r = updateMemory(dir, id, { summary: 'updated', tags: ['b', 'c'] });
        assert.strictEqual(r.success, true);
        assert.strictEqual(r.memory.summary, 'updated');
        assert.strictEqual(r.memory.content, 'original content');
        assert.deepStrictEqual(r.memory.tags, ['b', 'c']);
        assert.ok(r.memory.updatedAt >= originalUpdatedAt);
    } finally {
        cleanupTmpDir(dir);
    }
});

test('updateMemory returns error for nonexistent id', () => {
    const dir = makeTmpDir();
    try {
        const r = updateMemory(dir, 'mem_nonexistent_000000', { summary: 'x' });
        assert.ok(r.error);
        assert.ok(r.error.includes('not found'));
    } finally {
        cleanupTmpDir(dir);
    }
});

test('deleteMemory removes entry and returns true', () => {
    const dir = makeTmpDir();
    try {
        const saved = saveMemory(dir, { summary: 'to delete', content: 'content', tags: [] });
        const id = saved.memory.id;

        const r = deleteMemory(dir, id);
        assert.strictEqual(r.success, true);
        assert.strictEqual(r.id, id);

        const remaining = loadMemories(dir);
        assert.strictEqual(remaining.length, 0);
    } finally {
        cleanupTmpDir(dir);
    }
});

test('deleteMemory returns error for nonexistent id', () => {
    const dir = makeTmpDir();
    try {
        const r = deleteMemory(dir, 'mem_nonexistent_000000');
        assert.ok(r.error);
        assert.ok(r.error.includes('not found'));
    } finally {
        cleanupTmpDir(dir);
    }
});

test('saveMemory handles empty tags gracefully', () => {
    const dir = makeTmpDir();
    try {
        const r = saveMemory(dir, { summary: 'no tags', content: 'content' });
        assert.strictEqual(r.success, true);
        assert.deepStrictEqual(r.memory.tags, []);
        assert.strictEqual(r.memory.sourceSession, '');
    } finally {
        cleanupTmpDir(dir);
    }
});

test('searchMemories searches in tags', () => {
    const dir = makeTmpDir();
    try {
        saveMemory(dir, { summary: 'entry', content: 'content', tags: ['jsonwebtoken'] });

        const r = searchMemories(dir, { query: 'jsonwebtoken' });
        assert.strictEqual(r.count, 1);
    } finally {
        cleanupTmpDir(dir);
    }
});
