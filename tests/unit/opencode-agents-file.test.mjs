import assert from 'assert';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const { createAgentsFileController } = require(path.join(__dirname, '..', '..', 'cli', 'agents-files.js'));

function identity(x) { return x; }

function createTestController(overrides = {}) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-agents-'));
    const opencodeDir = overrides.opencodeDir || path.join(tmpDir, 'opencode');
    const backups = [];
    const ctrl = createAgentsFileController({
        fs,
        path,
        os,
        ensureDir: function (dir) { fs.mkdirSync(dir, { recursive: true }); },
        stripUtf8Bom: function (s) { return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; },
        detectLineEnding: function (s) { return s.indexOf('\r\n') !== -1 ? '\r\n' : '\n'; },
        normalizeLineEnding: function (s, e) { return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, e); },
        ensureUtf8Bom: identity,
        buildLineDiff: function (a, b) {
            const added = b.split('\n').filter((line) => !a.split('\n').includes(line)).length;
            return { lines: [], stats: { added, removed: 0, unchanged: 0 } };
        },
        CONFIG_DIR: tmpDir,
        AGENTS_FILE_NAME: 'AGENTS.md',
        CLAUDE_DIR: tmpDir,
        CLAUDE_MD_FILE_NAME: 'CLAUDE.md',
        readOpenclawAgentsFile: function () { return { exists: false }; },
        readOpenclawWorkspaceFile: function () { return { exists: false }; },
        OPENCODE_CONFIG_DIR: opencodeDir,
        backupPromptBeforeWrite: function (bucket, filePath) { backups.push({ bucket, filePath }); }
    });
    return { tmpDir, opencodeDir, ctrl, backups };
}

test('readOpencodeAgentsFile reports missing config dir without touching disk', () => {
    const { ctrl, opencodeDir } = createTestController();
    const result = ctrl.readOpencodeAgentsFile();

    assert.strictEqual(result.exists, false, 'AGENTS.md should not exist when config dir is absent');
    assert.strictEqual(result.baseDirMissing, true, 'baseDirMissing flag should be set');
    assert.strictEqual(result.path, path.join(opencodeDir, 'AGENTS.md'), 'path should point into opencode config dir');
    assert.strictEqual(result.content, '', 'missing file should yield empty content');
    assert.strictEqual(fs.existsSync(opencodeDir), false, 'read must not create the config dir');
});

test('applyOpencodeAgentsFile creates config dir and writes AGENTS.md', () => {
    const { ctrl, opencodeDir } = createTestController();
    const result = ctrl.applyOpencodeAgentsFile({ content: '# OpenCode\nline-one\n', lineEnding: '\n' });

    assert.strictEqual(result.success, true, 'apply should succeed');
    assert.strictEqual(result.path, path.join(opencodeDir, 'AGENTS.md'));
    assert.strictEqual(result.historyBucket, 'opencode_global', 'opencode writes use the dedicated history bucket');

    const read = ctrl.readOpencodeAgentsFile();
    assert.strictEqual(read.exists, true);
    assert.strictEqual(read.content, '# OpenCode\nline-one\n');
    assert.strictEqual(read.lineEnding, '\n');
});

test('applyOpencodeAgentsFile preserves CRLF line endings', () => {
    const { ctrl } = createTestController();
    ctrl.applyOpencodeAgentsFile({ content: 'alpha\r\nbeta\r\n', lineEnding: '\r\n' });

    const read = ctrl.readOpencodeAgentsFile();
    assert.strictEqual(read.content, 'alpha\r\nbeta\r\n');
    assert.strictEqual(read.lineEnding, '\r\n');
});

test('applyOpencodeAgentsFile rejects content over 2MB', () => {
    const { ctrl } = createTestController();
    const oversized = 'a'.repeat(2 * 1024 * 1024 + 1);
    const result = ctrl.applyOpencodeAgentsFile({ content: oversized, lineEnding: '\n' });

    assert.ok(result.error, 'oversized content should be rejected');
    assert.strictEqual(result.success, undefined);
});

test('applyAgentsFile honors explicit historyBucket override', () => {
    const { ctrl, backups } = createTestController();
    ctrl.applyAgentsFile({ content: 'plain\n', lineEnding: '\n', historyBucket: 'custom_bucket' });

    assert.deepStrictEqual(backups.map((entry) => entry.bucket), ['custom_bucket']);
});

test('applyAgentsFile falls back to codex_ bucket without explicit override', () => {
    const { ctrl, backups } = createTestController();
    ctrl.applyAgentsFile({ content: 'plain\n', lineEnding: '\n' });

    assert.strictEqual(backups.length, 1);
    assert.ok(/^codex_/.test(backups[0].bucket), 'default bucket should keep the codex_ prefix');
});

test('buildAgentsDiff dispatches opencode context to the opencode AGENTS.md', () => {
    const { ctrl, opencodeDir } = createTestController();
    ctrl.applyOpencodeAgentsFile({ content: 'base\n', lineEnding: '\n' });

    const diff = ctrl.buildAgentsDiff({ context: 'opencode', content: 'base\nadded\n' });
    assert.ok(!diff.error, diff.error);
    assert.strictEqual(diff.path, path.join(opencodeDir, 'AGENTS.md'));
    assert.strictEqual(diff.context, 'opencode');
    assert.strictEqual(diff.exists, true);
    assert.strictEqual(diff.diff.hasChanges, true);
});

test('buildAgentsDiff still rejects unknown contexts', () => {
    const { ctrl } = createTestController();
    const diff = ctrl.buildAgentsDiff({ context: 'not-a-real-context', content: 'x\n' });
    assert.ok(diff.error, 'unknown diff context should be rejected');
});

test('readOpencodeAgentsFile stays independent of the codex AGENTS.md', () => {
    const { ctrl, tmpDir, opencodeDir } = createTestController();
    ctrl.applyAgentsFile({ content: 'codex-only\n', lineEnding: '\n' });
    ctrl.applyOpencodeAgentsFile({ content: 'opencode-only\n', lineEnding: '\n' });

    const codexRead = ctrl.readAgentsFile({});
    const opencodeRead = ctrl.readOpencodeAgentsFile();

    assert.strictEqual(codexRead.path, path.join(tmpDir, 'AGENTS.md'));
    assert.strictEqual(codexRead.content, 'codex-only\n');
    assert.strictEqual(opencodeRead.path, path.join(opencodeDir, 'AGENTS.md'));
    assert.strictEqual(opencodeRead.content, 'opencode-only\n');
});
