import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const { createSystemPromptFileController } = require(path.join(__dirname, '..', '..', 'cli', 'system-prompt-files.js'));

function hashContent(content) {
    return crypto.createHash('sha256').update(String(content || '')).digest('hex');
}

function createTestController(overrides = {}) {
    const tmpDir = overrides.tmpDir || path.join(os.tmpdir(), 'sys-prompt-test-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    fs.mkdirSync(tmpDir, { recursive: true });
    return {
        tmpDir,
        ctrl: createSystemPromptFileController({
            fs,
            path,
            os,
            crypto,
            buildLineDiff: overrides.buildLineDiff || function (before, after) {
                const beforeLines = before.split('\n');
                const afterLines = after.split('\n');
                if (beforeLines.length > 1 && beforeLines[beforeLines.length - 1] === '') beforeLines.pop();
                if (afterLines.length > 1 && afterLines[afterLines.length - 1] === '') afterLines.pop();
                const lines = [];
                const maxLen = Math.max(beforeLines.length, afterLines.length);
                let added = 0, removed = 0, unchanged = 0;
                for (let i = 0; i < maxLen; i++) {
                    if (beforeLines[i] !== afterLines[i]) {
                        if (beforeLines[i] !== undefined) { lines.push({ type: 'del', value: beforeLines[i] }); removed++; }
                        if (afterLines[i] !== undefined) { lines.push({ type: 'add', value: afterLines[i] }); added++; }
                    } else {
                        lines.push({ type: 'ctx', value: afterLines[i] });
                        unchanged++;
                    }
                }
                return { lines, stats: { added, removed, unchanged }, truncated: false };
            },
            CONFIG_DIR: tmpDir,
            PI_AGENT_DIR: path.join(tmpDir, 'agent'),
            ...overrides.controllerDeps
        })
    };
}

test('normalizeMode accepts "system" and "append"', () => {
    const { ctrl } = createTestController();
    assert.strictEqual(ctrl.normalizeMode('system'), 'system');
    assert.strictEqual(ctrl.normalizeMode('append'), 'append');
});

test('normalizeMode rejects invalid mode', () => {
    const { ctrl } = createTestController();
    assert.throws(() => ctrl.normalizeMode('invalid'), /Invalid system prompt mode/);
    assert.throws(() => ctrl.normalizeMode(''), /Invalid system prompt mode/);
});

test('normalizeScope accepts "global" and "project"', () => {
    const { ctrl } = createTestController();
    assert.strictEqual(ctrl.normalizeScope('global'), 'global');
    assert.strictEqual(ctrl.normalizeScope('project'), 'project');
});

test('normalizeScope rejects invalid scope', () => {
    const { ctrl } = createTestController();
    assert.throws(() => ctrl.normalizeScope('invalid'), /Invalid system prompt scope/);
});

test('readSystemPromptFile returns empty content for non-existent file', () => {
    const { ctrl } = createTestController();
    const result = ctrl.readSystemPromptFile({ scope: 'global', mode: 'append' });
    assert.strictEqual(result.scope, 'global');
    assert.strictEqual(result.mode, 'append');
    assert.strictEqual(result.filename, 'APPEND_SYSTEM.md');
    assert.strictEqual(result.exists, false);
    assert.strictEqual(result.content, '');
    assert.strictEqual(result.hash, hashContent(''));
});

test('readSystemPromptFile returns content for existing file', () => {
    const { tmpDir, ctrl } = createTestController();
    const filePath = path.join(tmpDir, 'agent', 'SYSTEM.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '# System Prompt\n', 'utf8');
    const result = ctrl.readSystemPromptFile({ scope: 'global', mode: 'system' });
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.content, '# System Prompt\n');
    assert.strictEqual(result.hash, hashContent('# System Prompt\n'));
    assert.strictEqual(result.replaceDefault, true);
});

test('readSystemPromptFile project scope resolves to project .pi dir', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'myproject');
    fs.mkdirSync(projectDir, { recursive: true });
    const filePath = path.join(projectDir, '.pi', 'APPEND_SYSTEM.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'project content', 'utf8');
    const result = ctrl.readSystemPromptFile({ scope: 'project', mode: 'append', cwd: projectDir });
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.content, 'project content');
    assert.ok(result.path.includes(path.join(projectDir, '.pi', 'APPEND_SYSTEM.md')));
    assert.strictEqual(result.replaceDefault, false);
});

test('readSystemPromptFile project scope uses process.cwd() when cwd not provided', () => {
    const { tmpDir, ctrl } = createTestController({ controllerDeps: {} });
    const result = ctrl.readSystemPromptFile({ scope: 'project', mode: 'append' });
    assert.strictEqual(result.exists, false);
    assert.ok(result.path.includes('.pi'));
});

test('saveSystemPromptFile rejects empty content', () => {
    const { ctrl } = createTestController();
    const result = ctrl.saveSystemPromptFile({ scope: 'global', mode: 'append', content: '   \n  ' });
    assert.ok(result.error);
    assert.match(result.error, /不能为空/);
});

test('saveSystemPromptFile rejects content over 2MB', () => {
    const { ctrl } = createTestController();
    const huge = 'x'.repeat(2 * 1024 * 1024 + 1);
    const result = ctrl.saveSystemPromptFile({ scope: 'global', mode: 'append', content: huge });
    assert.ok(result.error);
    assert.match(result.error, /过大/);
});

test('saveSystemPromptFile writes new file successfully', () => {
    const { tmpDir, ctrl } = createTestController();
    const result = ctrl.saveSystemPromptFile({ scope: 'global', mode: 'append', content: 'hello world' });
    assert.ok(!result.error, 'should not error: ' + (result.error || ''));
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.content, 'hello world\n');
    assert.strictEqual(result.hash, hashContent('hello world\n'));
    const filePath = path.join(tmpDir, 'agent', 'APPEND_SYSTEM.md');
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'hello world\n');
    const stat = fs.statSync(filePath);
    if (process.platform !== 'win32') {
        assert.strictEqual(stat.mode & 0o777, 0o600);
    }
});

test('saveSystemPromptFile appends trailing newline if missing', () => {
    const { ctrl } = createTestController();
    const result = ctrl.saveSystemPromptFile({ scope: 'global', mode: 'system', content: 'no newline' });
    assert.strictEqual(result.content, 'no newline\n');
});

test('saveSystemPromptFile preserves existing trailing newline', () => {
    const { ctrl } = createTestController();
    const result = ctrl.saveSystemPromptFile({ scope: 'global', mode: 'system', content: 'has newline\n' });
    assert.strictEqual(result.content, 'has newline\n');
});

test('saveSystemPromptFile detects optimistic lock conflict', () => {
    const { tmpDir, ctrl } = createTestController();
    const filePath = path.join(tmpDir, 'agent', 'APPEND_SYSTEM.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'original content\n', 'utf8');
    const current = ctrl.readSystemPromptFile({ scope: 'global', mode: 'append' });
    const staleHash = hashContent('different content');
    const result = ctrl.saveSystemPromptFile({
        scope: 'global',
        mode: 'append',
        content: 'new content',
        baseHash: staleHash
    });
    assert.ok(result.error);
    assert.match(result.error, /已被外部修改/);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'original content\n');
});

test('saveSystemPromptFile succeeds with correct baseHash', () => {
    const { tmpDir, ctrl } = createTestController();
    const filePath = path.join(tmpDir, 'agent', 'APPEND_SYSTEM.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'original\n', 'utf8');
    const current = ctrl.readSystemPromptFile({ scope: 'global', mode: 'append' });
    const result = ctrl.saveSystemPromptFile({
        scope: 'global',
        mode: 'append',
        content: 'updated\n',
        baseHash: current.hash
    });
    assert.ok(!result.error);
    assert.strictEqual(result.content, 'updated\n');
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'updated\n');
});

test('saveSystemPromptFile succeeds without baseHash (no lock check)', () => {
    const { tmpDir, ctrl } = createTestController();
    const filePath = path.join(tmpDir, 'agent', 'APPEND_SYSTEM.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'original\n', 'utf8');
    const result = ctrl.saveSystemPromptFile({
        scope: 'global',
        mode: 'append',
        content: 'overwrite\n'
    });
    assert.ok(!result.error);
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'overwrite\n');
});

test('saveSystemPromptFile in project scope creates .pi dir if needed', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'newproject');
    fs.mkdirSync(projectDir, { recursive: true });
    const result = ctrl.saveSystemPromptFile({
        scope: 'project',
        mode: 'system',
        content: 'project prompt',
        cwd: projectDir
    });
    assert.ok(!result.error);
    assert.strictEqual(result.exists, true);
    const filePath = path.join(projectDir, '.pi', 'SYSTEM.md');
    assert.strictEqual(fs.readFileSync(filePath, 'utf8'), 'project prompt\n');
});

test('buildSystemPromptDiff compares baseContent with new content', () => {
    const { ctrl } = createTestController();
    const result = ctrl.buildSystemPromptDiff({
        scope: 'global',
        mode: 'append',
        baseContent: 'line1\nline2\n',
        content: 'line1\nmodified\n'
    });
    assert.ok(!result.error);
    assert.ok(result.diff);
    assert.strictEqual(result.diff.hasChanges, true);
    assert.strictEqual(result.diff.stats.removed, 1);
    assert.strictEqual(result.diff.stats.added, 1);
    assert.strictEqual(result.scope, 'global');
    assert.strictEqual(result.mode, 'append');
});

test('buildSystemPromptDiff detects no changes', () => {
    const { ctrl } = createTestController();
    const result = ctrl.buildSystemPromptDiff({
        scope: 'global',
        mode: 'system',
        baseContent: 'same\n',
        content: 'same\n'
    });
    assert.ok(!result.error);
    assert.strictEqual(result.diff.hasChanges, false);
});

test('buildSystemPromptDiff without baseContent uses file content as baseline', () => {
    const { tmpDir, ctrl } = createTestController();
    const filePath = path.join(tmpDir, 'agent', 'APPEND_SYSTEM.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'line1\nline2\n', 'utf8');
    const result = ctrl.buildSystemPromptDiff({
        scope: 'global',
        mode: 'append',
        content: 'line1\nline2\nline3\n'
    });
    assert.ok(!result.error);
    assert.strictEqual(result.diff.hasChanges, true);
    assert.strictEqual(result.diff.stats.added, 1);
    assert.strictEqual(result.exists, true);
});

test('buildSystemPromptDiff handles truncated diff as hasChanges when texts differ', () => {
    const { ctrl } = createTestController({
        buildLineDiff: () => ({ lines: [], stats: { added: 0, removed: 0, unchanged: 0 }, truncated: true })
    });
    const result = ctrl.buildSystemPromptDiff({
        scope: 'global',
        mode: 'append',
        baseContent: 'a',
        content: 'b'
    });
    assert.ok(!result.error);
    assert.strictEqual(result.diff.hasChanges, true);
    assert.strictEqual(result.diff.truncated, true);
});

test('buildSystemPromptDiff truncated with identical texts has no changes', () => {
    const { ctrl } = createTestController({
        buildLineDiff: () => ({ lines: [], stats: { added: 0, removed: 0, unchanged: 0 }, truncated: true })
    });
    const result = ctrl.buildSystemPromptDiff({
        scope: 'global',
        mode: 'append',
        baseContent: 'same',
        content: 'same'
    });
    assert.ok(!result.error);
    assert.strictEqual(result.diff.hasChanges, false);
});

test('readSystemPromptFile handles read error gracefully', () => {
    const tmpDir = path.join(os.tmpdir(), 'sys-prompt-read-error-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    const filePath = path.join(tmpDir, 'agent', 'APPEND_SYSTEM.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'content', 'utf8');
    const failingFs = Object.create(fs);
    failingFs.readFileSync = (targetPath, ...args) => {
        if (targetPath === filePath) throw new Error('simulated read failure');
        return fs.readFileSync(targetPath, ...args);
    };
    const { ctrl } = createTestController({
        tmpDir,
        controllerDeps: { fs: failingFs }
    });
    const result = ctrl.readSystemPromptFile({ scope: 'global', mode: 'append' });
    assert.strictEqual(result.exists, false);
    assert.strictEqual(result.content, '');
    assert.ok(result.error);
});

test('saveSystemPromptFile returns updated content and hash after write', () => {
    const { ctrl } = createTestController();
    const result = ctrl.saveSystemPromptFile({ scope: 'global', mode: 'system', content: 'test\n' });
    assert.ok(!result.error);
    assert.strictEqual(result.content, 'test\n');
    assert.strictEqual(result.hash, hashContent('test\n'));
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.replaceDefault, true);
});

test('Pi file list discovers new direct markdown files without scanning nested directories', () => {
    const { tmpDir, ctrl } = createTestController();
    const directory = path.join(tmpDir, 'agent');
    fs.mkdirSync(path.join(directory, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(directory, 'extra.md'), 'extra');
    fs.writeFileSync(path.join(directory, 'notes.txt'), 'not markdown');
    fs.writeFileSync(path.join(directory, 'nested', 'hidden.md'), 'nested');
    const initial = ctrl.listSystemPromptFiles({ scope: 'global' });
    assert.deepStrictEqual(initial.files.map(file => file.filename), ['SYSTEM.md', 'APPEND_SYSTEM.md', 'extra.md']);
    assert.strictEqual(initial.files[0].exists, false);
    fs.writeFileSync(path.join(directory, 'new.md'), 'new');
    assert.strictEqual(ctrl.listSystemPromptFiles({ scope: 'global' }).files.filter(file => file.filename === 'new.md').length, 1);
    assert.strictEqual(ctrl.readSystemPromptFile({ scope: 'global', fileName: 'extra.md' }).replaceDefault, false);
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Pi file lists preserve missing standard targets and isolate project scope', () => {
    const { tmpDir, ctrl } = createTestController();
    assert.deepStrictEqual(ctrl.listSystemPromptFiles({ scope: 'global' }).files.map(file => file.exists), [false, false]);
    const project = path.join(tmpDir, 'project');
    fs.mkdirSync(path.join(project, '.pi'), { recursive: true });
    fs.writeFileSync(path.join(project, '.pi', 'project.md'), 'project');
    const result = ctrl.listSystemPromptFiles({ scope: 'project', cwd: project });
    assert.strictEqual(result.directory, path.join(project, '.pi'));
    assert.strictEqual(result.files.at(-1).filename, 'project.md');
    assert.strictEqual(ctrl.readSystemPromptFile({ scope: 'project', cwd: project, fileName: 'project.md' }).content, 'project');
    assert.ok(!ctrl.listSystemPromptFiles({ scope: 'global' }).files.some(file => file.filename === 'project.md'));
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Pi custom file operations reject traversal symlinks and directory targets', () => {
    const { tmpDir, ctrl } = createTestController();
    const directory = path.join(tmpDir, 'agent');
    fs.mkdirSync(path.join(directory, 'directory.md'), { recursive: true });
    const outside = path.join(tmpDir, 'outside.md');
    fs.writeFileSync(outside, 'protected');
    fs.symlinkSync(outside, path.join(directory, 'link.md'));
    for (const fileName of ['../outside.md', '/outside.md', 'nested/x.md', 'nested\\x.md', 'bad\0.md', 'notes.txt', '']) {
        assert.throws(() => ctrl.readSystemPromptFile({ scope: 'global', fileName }), /Invalid system prompt filename/, fileName);
        assert.throws(() => ctrl.saveSystemPromptFile({ scope: 'global', fileName, content: 'changed' }), /Invalid system prompt filename/, fileName);
    }
    for (const fileName of ['link.md', 'directory.md']) {
        assert.ok(ctrl.readSystemPromptFile({ scope: 'global', fileName }).error, fileName);
        assert.ok(ctrl.saveSystemPromptFile({ scope: 'global', fileName, content: 'changed' }).error, fileName);
        assert.ok(ctrl.buildSystemPromptDiff({ scope: 'global', fileName, content: 'changed' }).error, fileName);
        assert.ok(!ctrl.listSystemPromptFiles({ scope: 'global' }).files.some(file => file.filename === fileName));
    }
    assert.strictEqual(fs.readFileSync(outside, 'utf8'), 'protected');
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Pi custom files keep independent histories and retain conflict and deletion protection', () => {
    const buckets = [];
    const { tmpDir, ctrl } = createTestController({ controllerDeps: {
        backupPromptBeforeWrite(bucket, file) { buckets.push({ bucket, file }); return {}; }
    } });
    const directory = path.join(tmpDir, 'agent');
    fs.mkdirSync(directory, { recursive: true });
    for (const fileName of ['one.md', 'two.md']) fs.writeFileSync(path.join(directory, fileName), 'original');
    const first = ctrl.readSystemPromptFile({ scope: 'global', fileName: 'one.md' });
    const diff = ctrl.buildSystemPromptDiff({ scope: 'global', fileName: 'one.md', content: 'changed' });
    assert.strictEqual(diff.filename, 'one.md');
    assert.strictEqual(diff.diff.hasChanges, true);
    const saved = ctrl.saveSystemPromptFile({ scope: 'global', fileName: 'one.md', content: 'changed', baseHash: first.hash });
    assert.strictEqual(saved.content, 'changed\n');
    assert.strictEqual(saved.historyBucket, first.historyBucket);
    ctrl.saveSystemPromptFile({ scope: 'global', fileName: 'two.md', content: 'second' });
    assert.notStrictEqual(buckets[0].bucket, buckets[1].bucket);
    assert.ok(ctrl.saveSystemPromptFile({ scope: 'global', fileName: 'one.md', content: 'stale', baseHash: first.hash }).error);
    fs.unlinkSync(path.join(directory, 'one.md'));
    assert.ok(ctrl.saveSystemPromptFile({ scope: 'global', fileName: 'one.md', content: 'recreate', baseHash: saved.hash }).error);
    assert.strictEqual(fs.existsSync(path.join(directory, 'one.md')), false);
    assert.strictEqual(ctrl.readSystemPromptFile({ scope: 'global', mode: 'system' }).historyBucket, 'system_global_global');
    assert.ok(ctrl.saveSystemPromptFile({ scope: 'global', fileName: 'two.md', content: '中'.repeat(1024 * 1024) }).error);
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('Pi standard modes retain their legacy character-size limit for non-ASCII content', () => {
    const { tmpDir, ctrl } = createTestController();
    const content = '中'.repeat(1024 * 1024);
    const saved = ctrl.saveSystemPromptFile({ scope: 'global', mode: 'system', content });
    assert.ok(!saved.error, saved.error);
    assert.strictEqual(ctrl.readSystemPromptFile({ scope: 'global', mode: 'system' }).content, content + '\n');
    fs.rmSync(tmpDir, { recursive: true, force: true });
});
