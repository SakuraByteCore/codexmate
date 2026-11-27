import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readBundledWebUiHtml } = require('../../web-ui/source-bundle.cjs');
const template = (name) => fs.readFileSync(new URL(`../../web-ui/partials/index/${name}.html`, import.meta.url), 'utf8');

test('web UI drops repeated descriptions while keeping navigation data', () => {
    const html = readBundledWebUiHtml();
    const removedKeys = [
        'side.overview.doctor.meta', 'side.docs.cliInstall.meta', 'side.sessions.browser.meta',
        'side.usage.meta', 'side.plugins.tools.meta', 'side.system.settings.meta',
        'settings.language.meta', 'settings.language.hint', 'settings.theme.meta', 'settings.theme.hint',
        'settings.sharePrefix.meta', 'settings.templateConfirm.meta', 'settings.timeline.style.meta',
        'settings.timeline.style.hint', 'settings.configTabs.meta', 'settings.backup.meta',
        'settings.providerCache.meta', 'settings.reset.meta', 'settings.trashConfig.meta',
        'workflow.tagline', 'workflow.emptyHint', 'prompts.presets.hint', 'plugins.promptTemplates.vars.hint',
        'pi.providers.addModal.subtitle', 'modal.skills.subtitle', 'modal.openclaw.quick.subtitle',
        'modal.openclaw.quick.modelNameHint', 'config.reasoningEffort.hint', 'config.contextWindow.hint',
        'config.autoCompact.hint', 'announcement.project.subtitle', 'announcement.project.cache.meta',
        ...['config', 'sessions', 'usage', 'tasks', 'skills', 'data'].map((section) => `announcement.project.feature.${section}.meta`),
        'plugins.sidebar.note', 'plugins.promptTemplates.compose.varsHint', 'plugins.promptTemplates.compose.outputHint',
        'features.bookmarkHint'
    ];
    for (const key of removedKeys) assert.ok(!html.includes(`t('${key}'`), key);
    assert.doesNotMatch(template('panel-plugins'), /pluginsActiveAttribution|plugins.meta.attribution/);
    assert.doesNotMatch(template('layout-header'), /\{\{ mainTabSubtitle \}\}/);
    assert.match(template('layout-header'), /:aria-description="t\('side\.prompts\.meta'\)"/);
    for (const mode of ['codex', 'claude', 'openclaw', 'opencode', 'kilocode', 'pi']) {
        const key = `side.config.${mode}.meta`;
        assert.ok(template('layout-header').includes(`:aria-description="t('${key}')"`), key);
        assert.ok(!template('layout-header').includes(`<span>{{ t('${key}') }}</span>`), key);
    }
    assert.doesNotMatch(template('layout-header'), /<span>\{\{ t\('side\.prompts\.meta'\) \}\}<\/span>/);
    for (const key of ['skills.counts', 'side.plugins.templatesCount', 'sessionTrashCount', 'skillsTargetLabel', 'inspectorHealthStatus']) {
        assert.ok(template('layout-header').includes(key), key);
    }
});

test('web UI keeps safety boundaries, errors, states and handoff recovery semantics', () => {
    const html = readBundledWebUiHtml();
    const requiredKeys = [
        'workflow.inputHint', 'workflow.description', 'workflow.empty',
        'settings.sharePrefix.hint', 'settings.templateConfirm.hint', 'settings.webhook.meta',
        'settings.providerCache.hint', 'settings.configTabs.hint', 'settings.reset.hint',
        'settings.trash.retentionHint', 'settings.trash.disabledHint', 'sessions.search.scopeHint',
        'sessions.export.truncated', 'features.indexScope', 'features.indexFailures', 'features.partial',
        'features.projectHistory', 'features.diagnosticScope', 'features.contextEstimate', 'features.draftReview',
        'changes.hint', 'changes.hidden', 'modal.agents.hint.twoStepSave', 'plugins.promptTemplates.preview.hint',
        'plugins.promptTemplates.compose.missingCount', 'plugins.promptTemplates.editor.builtinReadOnly',
        'modal.openclaw.structured.writeHint', 'modal.openclaw.quick.apiKeyHintKeep'
    ];
    for (const key of requiredKeys) assert.ok(html.includes(`t('${key}'`), key);
    for (const tool of ['codex', 'claude', 'openclaw', 'opencode', 'kilocode', 'pi']) {
        assert.ok(html.includes(`t('toolConfig.${tool}.lockedDesc')`), tool);
    }
    assert.match(template('panel-dashboard'), /aria-describedby="workflow-input-hint"/);
    assert.match(template('panel-dashboard'), /id="workflow-input-hint"/);
    assert.match(template('session-features'), /featureError[\s\S]*role="alert"/);
    assert.match(template('thread-handoff'), /草稿在切换会话后保留，刷新后清空。/);
    assert.match(template('thread-handoff'), /复制不会自动发送。/);
    assert.doesNotMatch(template('thread-handoff'), /交代目标，让下一位代理接着做。|生成后可复制到目标会话|已完成 \/ 阻塞 \/ 步骤 \/ 文件 · 可选/);
});

test('project prompts omit the duplicate editing-path hint but retain path controls', () => {
    const html = template('panel-prompts');
    assert.doesNotMatch(html, /prompts\.project\.detected|project-path-detected/);
    assert.match(html, /@change="selectProjectClaudeMdPath\(\$event\.target\.value\)"/);
    assert.match(html, /@change="setProjectClaudeMdPathManual\(\$event\.target\.value\)"/);
    assert.match(html, /:title="agentsPath"[\s\S]*<code>\{\{ agentsPath \}\}<\/code>/);
    for (const locale of ['zh', 'zh-tw', 'en', 'ja', 'vi']) assert.ok(!fs.readFileSync(new URL(`../../web-ui/modules/i18n/locales/${locale}.mjs`, import.meta.url), 'utf8').includes('prompts.project.detected'), locale);
});
