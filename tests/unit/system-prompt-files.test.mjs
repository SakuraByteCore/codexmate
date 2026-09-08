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
    assert.strictEqual(stat.mode & 0o777, 0o600);
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
    const { tmpDir, ctrl } = createTestController();
    const filePath = path.join(tmpDir, 'agent', 'APPEND_SYSTEM.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, 'content', 'utf8');
    fs.chmodSync(filePath, 0o000);
    const result = ctrl.readSystemPromptFile({ scope: 'global', mode: 'append' });
    fs.chmodSync(filePath, 0o644);
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
