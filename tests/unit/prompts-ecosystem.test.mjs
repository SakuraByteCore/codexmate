import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { createPromptsComputed } from '../../web-ui/modules/app.computed.prompts.mjs';
import { createAgentsMethods } from '../../web-ui/modules/app.methods.agents.mjs';
import { createPromptEcosystemMethods } from '../../web-ui/modules/prompt-ecosystem.methods.mjs';
import { buildPromptTemplateSharePayload, createPromptTemplatesMethods } from '../../plugins/prompt-templates/methods.mjs';
import { DICT } from '../../web-ui/modules/i18n.dict.mjs';
import { readBundledWebUiHtml, readBundledWebUiScript, readProjectFile } from './helpers/web-ui-source.mjs';
import assert from 'assert';
import { createPromptInvocationMethods } from '../../plugins/prompt-templates/invocation.mjs';
import { parseTemplateVariables, renderTemplate } from '../../plugins/prompt-templates/computed.mjs';

test('prompt variables reuse the existing grammar without evaluating values', () => {
    const template = 'Project {{ project_path }}\n{{git_diff}}\n{{project_path}} {{file.name}}';
    assert.deepStrictEqual(parseTemplateVariables(template), ['file.name', 'git_diff', 'project_path']);
    assert.strictEqual(renderTemplate(template, { project_path: '/work/demo', git_diff: '+{{literal}}\n-$&', 'file.name': '文档.md' }),
        'Project /work/demo\n+{{literal}}\n-$&\n/work/demo 文档.md');
    assert.strictEqual(renderTemplate('{{missing}} {{constructor}} {{__proto__}}', {}), '{{missing}} {{constructor}} {{__proto__}}');
    assert.strictEqual(renderTemplate('{{value}}', { value: '' }), '{{value}}');
    assert.deepStrictEqual(parseTemplateVariables('{{bad name}} {{}}'), []);
});

test('template invocation requires values and clears them after confirm or cancellation', async () => {
    const ctx = Object.assign({ $nextTick(fn) { fn(); }, $refs: {}, t(key) { return key; } }, createPromptInvocationMethods());
    const pending = ctx.resolvePromptTemplateInvocation({ template: '{{project_path}}\n{{git_diff}}' });
    assert.strictEqual(ctx.promptInvocationVisible, true);
    ctx.finishPromptTemplateInvocation();
    assert.strictEqual(ctx.promptInvocationError, 'ecosystem.variablesRequired');
    assert.strictEqual(ctx.promptInvocationVisible, true);
    ctx.promptInvocationValues = { project_path: '/repo', git_diff: '+new\n-old' };
    ctx.finishPromptTemplateInvocation();
    assert.strictEqual(await pending, '/repo\n+new\n-old');
    assert.deepStrictEqual(ctx.promptInvocationValues, {});
    assert.strictEqual(ctx.promptInvocationVisible, false);
    const cancelled = ctx.resolvePromptTemplateInvocation({ template: '{{secret}}' });
    ctx.closePromptTemplateInvocation();
    assert.strictEqual(await cancelled, null);
    assert.deepStrictEqual(ctx.promptInvocationValues, {});
    assert.strictEqual(await ctx.resolvePromptTemplateInvocation({ template: '{{x}}', values: { x: 'ready' } }), 'ready');
});

const require = createRequire(import.meta.url);
const { createPluginConfigController } = require('../../cli/plugin-config');
const { createPromptHistoryController } = require('../../cli/prompt-history');
const { writeTextAtomicWithBackup } = require('../../lib/cli-config-engine');
const TEST_ROOT = fileURLToPath(new URL('../../.tmp/', import.meta.url));
const originalTemplate = { id: 'custom', name: '示例', template: '{{project_path}}', isBuiltin: false };
function fixture(options = {}) {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
    const dir = fs.mkdtempSync(path.join(TEST_ROOT, 'prompt-ecosystem-'));
    const disk = options.fs || fs;
    const history = createPromptHistoryController({ fs: disk, path, CONFIG_DIR: dir, now: () => Date.parse('2026-03-01T00:00:00Z') });
    const controller = createPluginConfigController({ fs: disk, path, CONFIG_DIR: dir,
        backupPromptBeforeWrite: options.backup || history.backupPromptBeforeWrite });
    return { dir, history, controller, file: path.join(dir, 'codexmate-plugin-config.json') };
}

test('plugin configuration migrates browser templates with history and rejects stale writes', () => {
    const ctx = fixture();
    try {
        const initial = ctx.controller.getPluginConfig();
        const edited = { ...originalTemplate, template: '{{project_path}}\n{{git_diff}}' };
        const saved = ctx.controller.applyPluginConfig({ baseHash: initial.hash, templates: [edited], legacyTemplates: [originalTemplate] });
        assert.strictEqual(saved.templates[0].template, edited.template);
        assert.strictEqual(fs.statSync(ctx.file).mode & 0o777, 0o600);
        const versions = ctx.history.listPromptHistory(saved.historyBucket);
        assert.strictEqual(versions.length, 1);
        const previous = ctx.history.readPromptHistory(saved.historyBucket, versions[0].id);
        assert.strictEqual(JSON.parse(previous.content).templates[0].template, originalTemplate.template);
        const stale = ctx.controller.applyPluginConfig({ baseHash: initial.hash, templates: [] });
        assert.ok(stale.error);
        assert.strictEqual(ctx.controller.getPluginConfig().templates[0].template, edited.template);
        const restored = ctx.controller.applyPluginConfig({ baseHash: saved.hash, templates: JSON.parse(previous.content).templates });
        assert.strictEqual(restored.templates[0].template, originalTemplate.template);
        assert.strictEqual(ctx.history.listPromptHistory(saved.historyBucket).length, 2);
        assert.notStrictEqual(ctx.history.listPromptHistory(saved.historyBucket)[0].id, versions[0].id);
        const rejected = ctx.controller.applyPluginConfig({ baseHash: restored.hash, templates: [{ id: 'bad' }] });
        assert.ok(rejected.error);
        assert.strictEqual(ctx.controller.getPluginConfig().hash, restored.hash);
    } finally { fs.rmSync(ctx.dir, { recursive: true, force: true }); }
});

test('backup errors and atomic rename errors preserve the current configuration', () => {
    let failBackup = false;
    const ctx = fixture({ backup() { return failBackup ? { error: 'backup failed' } : {}; } });
    try {
        const first = ctx.controller.applyPluginConfig({ baseHash: ctx.controller.getPluginConfig().hash, templates: [originalTemplate] });
        failBackup = true;
        assert.strictEqual(ctx.controller.applyPluginConfig({ baseHash: first.hash, templates: [] }).error, 'backup failed');
        assert.strictEqual(ctx.controller.getPluginConfig().hash, first.hash);
        let renames = 0;
        const failingFs = Object.assign({}, fs, { renameSync(from, to) {
            if (++renames === 1) throw new Error('rename failed');
            return fs.renameSync(from, to);
        } });
        assert.throws(() => writeTextAtomicWithBackup(ctx.file, 'plain text', { fs: failingFs }),
            (error) => error.code === 'CONFIG_WRITE_FAILED' && error.rolledBack === true);
        assert.strictEqual(ctx.controller.getPluginConfig().hash, first.hash);
        fs.writeFileSync(ctx.file, '{invalid', 'utf8');
        assert.ok(ctx.controller.applyPluginConfig({ baseHash: first.hash, templates: [] }).error);
        assert.strictEqual(fs.readFileSync(ctx.file, 'utf8'), '{invalid');
    } finally { fs.rmSync(ctx.dir, { recursive: true, force: true }); }
});

test('prompt history keeps distinct backups at an identical timestamp including empty content', () => {
    const ctx = fixture();
    try {
        fs.writeFileSync(ctx.file, '', 'utf8');
        ctx.history.backupPromptBeforeWrite('sample', ctx.file);
        fs.writeFileSync(ctx.file, 'next', 'utf8');
        ctx.history.backupPromptBeforeWrite('sample', ctx.file);
        const versions = ctx.history.listPromptHistory('sample');
        assert.strictEqual(versions.length, 2);
        assert.strictEqual(new Set(versions.map((item) => item.id)).size, 2);
        assert.deepStrictEqual(versions.map((item) => ctx.history.readPromptHistory('sample', item.id).content).sort(), ['', 'next']);
        assert.ok(ctx.history.readPromptHistory('sample', '../outside').error);
    } finally { fs.rmSync(ctx.dir, { recursive: true, force: true }); }
});

test('history comparisons use the selected version as baseline and ignore closed previews', async () => {
    const computed = createPromptsComputed();
    const comparison = computed.promptHistoryComparison.call({ promptHistoryPreviewContent: 'old\n', agentsContent: 'new\n' });
    assert.strictEqual(comparison.stats.added, 1);
    assert.strictEqual(comparison.stats.removed, 1);
    let resolve;
    const ctx = Object.assign({ promptHistoryVisible: true, promptHistoryBucket: 'codex_global', promptHistoryLoading: false },
        createAgentsMethods({ api: () => new Promise((done) => { resolve = done; }) }));
    const pending = ctx.viewPromptHistoryItem({ id: 'old' });
    assert.strictEqual(ctx.promptHistoryLoading, true);
    ctx.closePromptHistory();
    resolve({ content: 'stale' });
    await pending;
    assert.strictEqual(ctx.promptHistoryPreviewContent, '');
    assert.strictEqual(ctx.promptHistoryLoading, false);
});

test('one-click history rollback keeps unsaved editor content when the server rejects it', async () => {
    let calls = 0;
    const ctx = Object.assign({ agentsContext: 'codex', promptHistoryPreviewId: 'version',
        promptHistoryPreviewContent: 'old', agentsContent: 'unsaved', agentsOriginalContent: 'current',
        requestConfirmDialog: async () => true, t: (key) => key, showMessage() {} },
        createPromptEcosystemMethods({ api: async (action, params) => {
            calls++;
            assert.strictEqual(action, 'apply-agents-file');
            assert.strictEqual(params.baseContent, 'current');
            return { error: 'external modification' };
        } }));
    assert.strictEqual(await ctx.rollbackPromptHistory(), false);
    assert.strictEqual(ctx.agentsContent, 'unsaved');
    assert.strictEqual(calls, 1);
    assert.strictEqual(ctx.agentsSaving, false);
    ctx.requestConfirmDialog = async () => false;
    assert.strictEqual(await ctx.rollbackPromptHistory(), false);
    assert.strictEqual(calls, 1);
});

test('template sharing exports one raw template without filled variables and remains importable', () => {
    const payload = buildPromptTemplateSharePayload({ ...originalTemplate, varValues: { project_path: 'PRIVATE' }, rendered: 'PRIVATE' });
    assert.strictEqual(JSON.parse(payload).length, 1);
    assert.strictEqual(JSON.parse(payload)[0].template, '{{project_path}}');
    assert.ok(!payload.includes('PRIVATE'));
    assert.strictEqual(buildPromptTemplateSharePayload(null), '');
    assert.ok(typeof createPromptTemplatesMethods().sharePromptTemplate === 'function');
});

test('ecosystem UI exposes invocation dialog diff rollback and sharing with locale parity', () => {
    const html = readBundledWebUiHtml();
    assert.match(html, /ref="promptInvocationDialog"[^>]*role="dialog"[^>]*aria-modal="true"/);
    assert.match(html, /@keydown="onPromptInvocationKeydown"/);
    assert.match(html, /@click="rollbackPromptHistory\('agents'\)"/);
    assert.match(html, /@click="rollbackPromptHistory\('sys'\)"/);
    assert.match(html, /@click="rollbackPluginConfig"/);
    assert.match(html, /@click="sharePromptTemplate"/);
    assert.match(html, /pluginHistoryComparison\.lines/);
    assert.match(readProjectFile('cli.js'), /case 'get-plugin-config':[\s\S]*case 'apply-plugin-config':/);
    assert.ok(readBundledWebUiScript().includes('promptInvocationVisible'));
    for (const lang of ['zh', 'zh-tw', 'en', 'ja', 'vi']) {
        const dict = DICT[lang];
        assert.ok(dict, lang);
        for (const key of ['variablesTitle', 'variablesHint', 'variablesRequired', 'useTemplate', 'share', 'rollback', 'rollbackConfirm', 'historyCompare']) {
            assert.ok(typeof dict[`ecosystem.${key}`] === 'string', `${lang}: ${key}`);
        }
    }
});

test('Pi history rollback uses the selected file and rejects confirmation target drift', async () => {
    const writes = [];
    const ctx = Object.assign({ sysPromptScope: 'global', sysPromptMode: 'system', sysPromptFileName: 'one.md',
        sysHistoryPreviewId: 'version', sysHistoryPreviewContent: 'old', sysPromptHash: 'current',
        sysHistoryBucket: 'one', requestConfirmDialog: async () => true, t: key => key, showMessage() {},
        async loadSystemPrompt() {}, async loadSysHistory() {} },
        createPromptEcosystemMethods({ api: async (action, params) => { writes.push({ action, params }); return {}; } }));
    assert.strictEqual(await ctx.rollbackPromptHistory('sys'), true);
    assert.strictEqual(writes[0].action, 'apply-system-prompt');
    assert.strictEqual(writes[0].params.fileName, 'one.md');
    assert.strictEqual(writes[0].params.baseHash, 'current');
    ctx.requestConfirmDialog = async () => { ctx.sysPromptFileName = 'two.md'; return true; };
    assert.strictEqual(await ctx.rollbackPromptHistory('sys'), false);
    assert.strictEqual(writes.length, 1);
    ctx.sysPromptFileMissing = true;
    assert.strictEqual(await ctx.rollbackPromptHistory('sys'), false);
    assert.strictEqual(writes.length, 1);
});
