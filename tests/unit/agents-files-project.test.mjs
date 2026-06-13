import assert from 'assert';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import os from 'os';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const { createAgentsFileController } = require(path.join(__dirname, '..', '..', 'cli', 'agents-files.js'));

function noop() {}
function identity(x) { return x; }

function createTestController(overrides = {}) {
    const tmpDir = overrides.tmpDir || path.join(os.tmpdir(), 'agents-files-test-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    fs.mkdirSync(tmpDir, { recursive: true });
    return {
        tmpDir,
        ctrl: createAgentsFileController({
            fs: overrides.fs || fs,
            path: path,
            os: os,
            ensureDir: overrides.ensureDir || function (dir) { fs.mkdirSync(dir, { recursive: true }); },
            stripUtf8Bom: overrides.stripUtf8Bom || function (s) { return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s; },
            detectLineEnding: overrides.detectLineEnding || function (s) { return s.indexOf('\r\n') !== -1 ? '\r\n' : '\n'; },
            normalizeLineEnding: overrides.normalizeLineEnding || function (s, e) { return s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, e); },
            ensureUtf8Bom: overrides.ensureUtf8Bom || identity,
            buildLineDiff: overrides.buildLineDiff || function (a, b) { return { lines: [], stats: { added: 0, removed: 0, unchanged: 0 } }; },
            CONFIG_DIR: tmpDir,
            AGENTS_FILE_NAME: 'AGENTS.md',
            CLAUDE_DIR: tmpDir,
            CLAUDE_MD_FILE_NAME: 'CLAUDE.md',
            readOpenclawAgentsFile: overrides.readOpenclawAgentsFile || noop,
            readOpenclawWorkspaceFile: overrides.readOpenclawWorkspaceFile || noop
        })
    };
}

test('resolveClaudeMdFilePath without baseDir returns global path', () => {
    const { tmpDir, ctrl } = createTestController();
    const result = ctrl.resolveClaudeMdFilePath();
    assert.strictEqual(result.filePath, path.join(tmpDir, 'CLAUDE.md'));
    assert.strictEqual(result.isProject, false);
});

test('resolveClaudeMdFilePath with baseDir returns project path (root)', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'myproject');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), 'test', 'utf-8');

    const result = ctrl.resolveClaudeMdFilePath({ baseDir: projectDir });
    assert.strictEqual(result.filePath, path.join(projectDir, 'CLAUDE.md'));
    assert.strictEqual(result.isProject, true);
    assert.strictEqual(result.detectionSource, 'root');
    assert.strictEqual(result.projectPath, projectDir);
});

test('resolveClaudeMdFilePath with baseDir falls back to .claude/CLAUDE.md', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'myproject2');
    const dotClaudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(dotClaudeDir, { recursive: true });
    fs.writeFileSync(path.join(dotClaudeDir, 'CLAUDE.md'), 'dot-claude', 'utf-8');

    const result = ctrl.resolveClaudeMdFilePath({ baseDir: projectDir });
    assert.strictEqual(result.filePath, path.join(dotClaudeDir, 'CLAUDE.md'));
    assert.strictEqual(result.isProject, true);
    assert.strictEqual(result.detectionSource, 'dotdir');
});

test('resolveClaudeMdFilePath with baseDir defaults to root when neither exists', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'myproject3');
    fs.mkdirSync(projectDir, { recursive: true });

    const result = ctrl.resolveClaudeMdFilePath({ baseDir: projectDir });
    assert.strictEqual(result.filePath, path.join(projectDir, 'CLAUDE.md'));
    assert.strictEqual(result.isProject, true);
    assert.strictEqual(result.detectionSource, 'root');
});

test('resolveClaudeMdFilePath with empty baseDir falls back to global', () => {
    const { tmpDir, ctrl } = createTestController();
    const result = ctrl.resolveClaudeMdFilePath({ baseDir: '' });
    assert.strictEqual(result.isProject, false);
    assert.strictEqual(result.filePath, path.join(tmpDir, 'CLAUDE.md'));
});

test('detectProjectClaudeMdDir returns error for empty baseDir', () => {
    const { ctrl } = createTestController();
    const result = ctrl.detectProjectClaudeMdDir('');
    assert.ok(result.error);
});

test('detectProjectClaudeMdDir prefers root over dotdir', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'myproject4');
    const dotClaudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(dotClaudeDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), 'root', 'utf-8');
    fs.writeFileSync(path.join(dotClaudeDir, 'CLAUDE.md'), 'dot', 'utf-8');

    const result = ctrl.detectProjectClaudeMdDir(projectDir);
    assert.strictEqual(result.source, 'root');
    assert.strictEqual(result.path, path.join(projectDir, 'CLAUDE.md'));
});

test('validateClaudeMdBaseDir returns error for non-existent directory', () => {
    const { ctrl } = createTestController();
    const result = ctrl.validateClaudeMdBaseDir('/nonexistent/path/CLAUDE.md');
    assert.ok(result.error);
});

test('validateClaudeMdBaseDir succeeds for existing directory', () => {
    const { tmpDir, ctrl } = createTestController();
    const filePath = path.join(tmpDir, 'CLAUDE.md');
    const result = ctrl.validateClaudeMdBaseDir(filePath);
    assert.strictEqual(result.ok, true);
});

test('readClaudeMdFile with baseDir reads project file', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'readtest');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), 'project instructions', 'utf-8');

    const result = ctrl.readClaudeMdFile({ baseDir: projectDir });
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.content, 'project instructions');
    assert.strictEqual(result.projectPath, projectDir);
    assert.strictEqual(result.detectionSource, 'root');
});

test('readClaudeMdFile with baseDir returns non-existent when no file', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'emptyproject');
    fs.mkdirSync(projectDir, { recursive: true });

    const result = ctrl.readClaudeMdFile({ baseDir: projectDir });
    assert.strictEqual(result.exists, false);
    assert.strictEqual(result.content, '');
});

test('readClaudeMdFile with baseDir and metaOnly returns metadata without content', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'metatest');
    const dotClaudeDir = path.join(projectDir, '.claude');
    fs.mkdirSync(dotClaudeDir, { recursive: true });
    fs.writeFileSync(path.join(dotClaudeDir, 'CLAUDE.md'), 'should not be read', 'utf-8');

    const result = ctrl.readClaudeMdFile({ baseDir: projectDir, metaOnly: true });
    assert.strictEqual(result.exists, true);
    assert.strictEqual(result.content, '');
    assert.strictEqual(result.projectPath, projectDir);
    assert.strictEqual(result.detectionSource, 'dotdir');
    assert.ok(result.path.endsWith('.claude' + path.sep + 'CLAUDE.md'));
});

test('applyClaudeMdFile with baseDir writes to project path', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'writetest');
    fs.mkdirSync(projectDir, { recursive: true });

    const result = ctrl.applyClaudeMdFile({ baseDir: projectDir, content: 'hello world', lineEnding: '\n' });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.projectPath, projectDir);

    const written = fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf-8');
    assert.strictEqual(written, 'hello world');
});

test('applyClaudeMdFile with baseDir creates directory if needed', () => {
    const { tmpDir, ctrl } = createTestController();
    const nestedDir = path.join(tmpDir, 'deep', 'nested', 'project');

    const result = ctrl.applyClaudeMdFile({ baseDir: nestedDir, content: 'nested', lineEnding: '\n' });
    assert.strictEqual(result.success, true);
    assert.ok(fs.existsSync(path.join(nestedDir, 'CLAUDE.md')));
});

test('applyClaudeMdFile rejects content over 2MB', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'bigfile');
    fs.mkdirSync(projectDir, { recursive: true });

    const bigContent = 'x'.repeat(2 * 1024 * 1024 + 1);
    const result = ctrl.applyClaudeMdFile({ baseDir: projectDir, content: bigContent, lineEnding: '\n' });
    assert.ok(result.error);
    assert.match(result.error, /2MB/);
});

test('buildAgentsDiff with claude-project context dispatches correctly', () => {
    const { tmpDir, ctrl } = createTestController();
    const projectDir = path.join(tmpDir, 'difftest');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'CLAUDE.md'), 'old content', 'utf-8');

    const result = ctrl.buildAgentsDiff({
        context: 'claude-project',
        baseDir: projectDir,
        content: 'new content',
        lineEnding: '\n'
    });
    assert.strictEqual(result.context, 'claude-project');
    assert.ok(result.path);
    assert.strictEqual(result.exists, true);
});

test('buildAgentsDiff with claude-project but missing baseDir returns error', () => {
    const { ctrl } = createTestController();
    const result = ctrl.buildAgentsDiff({
        context: 'claude-project',
        content: 'test',
        lineEnding: '\n'
    });
    assert.ok(result.error);
    assert.match(result.error, /project path is required/);
});
