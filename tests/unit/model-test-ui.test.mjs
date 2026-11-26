import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { modelTestData, createModelTestMethods, modelTestMixin } from '../../web-ui/modules/model-test.mjs';
import { zh } from '../../web-ui/modules/i18n/locales/zh.mjs';
import { en } from '../../web-ui/modules/i18n/locales/en.mjs';
import { ja } from '../../web-ui/modules/i18n/locales/ja.mjs';
import { vi } from '../../web-ui/modules/i18n/locales/vi.mjs';
import { zhTw as tw } from '../../web-ui/modules/i18n/locales/zh-tw.mjs';

function fixture(request) {
    return { ...modelTestData(), ...createModelTestMethods({ request }), t: (key, params) => params?.seconds || key,
        currentProvider: 'saved', currentModel: 'a', modelTestCatalogs: {
            codex: [{ name: 'saved', models: ['a', 'b'] }], pi: [{ name: 'pi-saved', models: ['pi-a'] }]
        } };
}

test('source selection uses saved models and preserves manual content without touching agent configuration', () => {
    const vm = fixture(() => assert.fail('selection must not send requests'));
    vm.selectModelTestProvider(); assert.equal(vm.modelTestProvider, 'saved'); assert.equal(vm.modelTestModel, 'a');
    vm.modelTestPrompt = '用户的问题'; vm.setModelTestTarget('pi');
    assert.equal(vm.modelTestProvider, 'pi-saved'); assert.equal(vm.modelTestModel, 'pi-a');
    assert.equal(vm.modelTestPrompt, '用户的问题'); assert.equal(vm.currentProvider, 'saved');
});

test('a pending real test rejects double clicks and source changes, then shows the actual reply and seconds', async () => {
    let complete; const calls = [];
    const vm = fixture((...args) => { calls.push(args); return new Promise(resolve => { complete = resolve; }); });
    vm.selectModelTestProvider(); vm.modelTestPrompt = '你好';
    const pending = vm.runModelTest(); await vm.runModelTest(); vm.setModelTestTarget('pi');
    assert.equal(calls.length, 1); assert.equal(vm.modelTestTarget, 'codex');
    assert.deepEqual(calls[0][1], { target: 'codex', provider: 'saved', model: 'a', prompt: '你好' });
    assert.equal(calls[0].length, 2, 'real tests must not pass a response deadline');
    complete({ ok: true, text: '真实回答', durationMs: 1250, responseModel: 'actual-a' }); await pending;
    assert.equal(vm.modelTestResult.text, '真实回答'); assert.equal(vm.modelTestDuration(), '1.25');
    vm.setModelTestTarget('pi'); assert.equal(vm.modelTestResult.provider, 'saved', 'result identity must not follow new selection');
    assert.equal(vm.modelTestRunning, false);
});

test('empty messages never call the API and failures retain entered content', async () => {
    const vm = fixture(async () => { throw new Error('timeout'); }); vm.selectModelTestProvider();
    await vm.runModelTest(); assert.equal(vm.modelTestError, 'modelTest.required');
    vm.modelTestPrompt = '保留问题'; await vm.runModelTest();
    assert.equal(vm.modelTestPrompt, '保留问题'); assert.equal(vm.modelTestResult.ok, false);
    assert.equal(vm.modelTestResult.error, 'timeout'); assert.equal(vm.modelTestRunning, false);
    vm.modelTestPrompt = 'x'.repeat(8001); await vm.runModelTest(); assert.equal(vm.modelTestError, 'modelTest.required');
});

test('Markdown response rendering requires sanitization and falls back to escaped plain text without libraries', () => {
    const vm = fixture(); vm.modelTestResult = { text: '**答案**<script>bad()</script>' };
    assert.equal(vm.modelTestPreview().unavailable, true);
    const previous = [globalThis.marked, globalThis.DOMPurify];
    try {
        globalThis.marked = { parse: () => '<p>答案</p><script>bad()</script>' };
        globalThis.DOMPurify = { sanitize: html => html.replace(/<script>.*?<\/script>/g, '') };
        assert.equal(vm.modelTestPreview().html, '<p>答案</p>');
    } finally { [globalThis.marked, globalThis.DOMPurify] = previous; }
});

test('testing is the only surface; group management is absent and localized test states remain available', () => {
    const html = fs.readFileSync(new URL('../../web-ui/partials/index/panel-routing.html', import.meta.url), 'utf8');
    assert.match(html, /routing-model-test\.html/);
    assert.doesNotMatch(html, /routing-management|routing-groups|routingDraft/);
    const panel = fs.readFileSync(new URL('../../web-ui/partials/index/routing-model-test.html', import.meta.url), 'utf8');
    assert.match(panel, /maxlength="8000"/); assert.match(panel, /aria-live="polite"/);
    assert.match(panel, /v-html="modelTestRenderedResponse.html"/);
    for (const key of Object.keys(zh).filter(key => key.startsWith('modelTest.'))) {
        for (const locale of [en, ja, vi, tw]) assert.equal(typeof locale[key], 'string', key);
    }
});

test('entering the tab reads only the test catalog without requesting or mounting group settings', () => {
    const calls = [];
    modelTestMixin.watch.mainTab.call({ loadModelTestCatalog: () => calls.push('catalog'), loadRouting: () => assert.fail('group state must not be read') }, 'routing');
    assert.deepEqual(calls, ['catalog']);
    assert.equal(Object.keys(modelTestMixin.data()).some(key => key.startsWith('routing')), false);
    assert.equal(Object.keys(modelTestMixin.methods).some(key => /Routing|routing/.test(key)), false);
    modelTestMixin.watch.mainTab.call({ loadModelTestCatalog: () => assert.fail('other tabs must not load models') }, 'config');
    const panel = fs.readFileSync(new URL('../../web-ui/partials/index/routing-model-test.html', import.meta.url), 'utf8');
    assert.doesNotMatch(panel, /modelTest\.(initial|waiting|management|placeholder)|<h2>/);
    assert.doesNotMatch(panel, /modelTest\.hint/);
    assert.match(panel, /modelTest\.incomplete/);
});

test('choosing the source persists only the subtab and restoration does not write preferences', () => {
    const writes = [];
    const vm = fixture(); vm.persistWebUiPreferences = snapshot => writes.push(snapshot);
    vm.setModelTestTarget('pi');
    assert.deepEqual(writes, [{ navigation: { modelTestTarget: 'pi' } }]);
    vm.__webUiPreferencesApplying = true; vm.setModelTestTarget('codex');
    assert.equal(writes.length, 1); assert.equal(vm.modelTestTarget, 'codex');
});

test('all supported locales name the page model testing without a response timeout description', () => {
    for (const [locale, name] of [[zh, '模型测试'], [tw, '模型測試'], [en, 'Model test'], [ja, 'モデルテスト'], [vi, 'Kiểm thử mô hình']]) {
        assert.equal(locale['tab.routing'], name);
        assert.equal(locale['title.routing'], name);
        assert.equal(locale['modelTest.hint'], undefined, 'the quota description must not remain in any locale');
    }
});

test('the refresh control shares the first source row instead of adding top whitespace', () => {
    const panel = fs.readFileSync(new URL('../../web-ui/partials/index/routing-model-test.html', import.meta.url), 'utf8');
    assert.match(panel, /^\s*<div class="routing-test">\s*<form/);
    assert.match(panel, /<div class="routing-test-heading">\s*<div class="segmented-control"[\s\S]*@click="setModelTestTarget\(target\)"[\s\S]*<\/div>\s*<button[^>]*@click="loadModelTestCatalog"/);
    assert.equal((panel.match(/class="routing-test-heading"/g) || []).length, 1);
    const css = fs.readFileSync(new URL('../../web-ui/styles/routing.css', import.meta.url), 'utf8');
    assert.match(css, /#panel-routing \.routing-test-heading \{ flex-wrap: nowrap; margin-bottom: 16px; \}/);
    assert.match(css, /#panel-routing \.routing-test-heading \.segmented-control \{[^}]*min-width: 0; margin-bottom: 0;/);
    assert.match(css, /#panel-routing \.routing-test-heading \.segmented-control \{ flex-direction: row;/);
    assert.match(css, /#panel-routing \.routing-icon-btn \{[^}]*min-width: 44px;/);
});
