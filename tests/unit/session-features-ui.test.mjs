import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { sessionFeaturesMixin } from '../../web-ui/modules/session-features.mjs';
const require = createRequire(import.meta.url);
const Vue = require('vue');

test('message actions react independently of cached message rendering', async () => {
    const previous = globalThis.Vue; globalThis.Vue = Vue;
    const node = (type) => ({ type, props: {}, children: [], parent: null });
    const renderer = Vue.createRenderer({ createElement: node, createText: () => node('#text'), createComment: () => node('#comment'),
        insert(child, parent) { child.parent = parent; parent.children.push(child); }, remove() {},
        setText() {}, setElementText() {}, parentNode: (child) => child.parent, nextSibling: () => null,
        patchProp(child, key, _old, value) { child.props[key] = value; } });
    const root = node('root');
    const app = renderer.createApp({ mixins: [sessionFeaturesMixin],
        data: () => ({ activeSession: { source: 'pi', sessionId: 'fixture' }, handoffSessionKey: 'fixture',
            message: { text: 'same message', timestamp: '', roleLabel: 'User', normalizedRole: 'user', recordLineIndex: 1 } }),
        methods: { t: (key) => key },
        render() { return Vue.withMemo([this.message.text, this.message.timestamp, this.message.roleLabel, this.message.normalizedRole],
            () => Vue.h('div', [Vue.h(this.$options.components.SessionMessageActions, { message: this.message })]), this.$.renderCache, 0); } });
    try {
        const vm = app.mount(root);
        const find = (type) => { const pending = [root]; while (pending.length) { const child = pending.pop(); if (child.type === type) return child; pending.push(...child.children); } };
        assert.equal(find('button').props['aria-label'], 'features.bookmark');
        assert.equal(find('button').props.title, 'features.bookmark');
        assert.ok(find('svg'));
        assert.equal(find('input').props.checked, false);
        find('input').props.onChange(); await Vue.nextTick(); assert.equal(find('input').props.checked, true);
        vm.featureBusy = true; await Vue.nextTick(); assert.equal(find('button').props.disabled, true);
        vm.selectedContextIds = []; await Vue.nextTick(); assert.equal(find('input').props.checked, false);
    } finally { app.unmount(); if (previous === undefined) delete globalThis.Vue; else globalThis.Vue = previous; }
});

test('workbench keeps task bindings while folding technical details and advanced fields', () => {
    const fs = require('fs');
    const { compile } = require('@vue/compiler-dom');
    const targets = ['session-features', 'session-diagnostics', 'context-window-reference'];
    const templates = targets.map((name) => fs.readFileSync(`web-ui/partials/index/${name}.html`, 'utf8'));
    for (const template of templates) assert.ok(compile(template, { mode: 'function', prefixIdentifiers: true }).code);
    const [workbench, diagnostics, window] = templates;
    for (const action of ['loadBookmarks', 'searchSessionIndex', 'mapProjectWorkspace', 'saveBookmark']) {
        assert.ok(workbench.includes(`@submit.prevent="${action}"`), action);
    }
    for (const field of ['bookmarkQuery', 'bookmarkTag', 'bookmarkProject', 'bookmarkEditor.note', 'bookmarkEditor.tagsText']) {
        assert.ok(workbench.includes(`v-model="${field}"`), field);
    }
    assert.match(workbench, /class="feature-tabs"/);
    assert.match(workbench, /<details[^>]*>[\s\S]*features.moreFilters/);
    assert.match(diagnostics, /<details class="feature-disclosure"><summary>.*features.technicalDetails/);
    assert.ok(diagnostics.includes('JSON.stringify(item.evidence || {}, null, 2)'));
    assert.doesNotMatch(workbench, /:open="!!bookmarkTag/);
    assert.doesNotMatch(window, /:open="contextReference/);
    assert.ok(window.includes('v-model="contextWindowInput"'));
    assert.ok(window.includes('@click="saveContextPreferences(false)"'));
    const css = fs.readFileSync('web-ui/styles/session-features.css', 'utf8');
    require('postcss').parse(css);
    assert.match(css, /@media \(max-width: 640px\)/);
    assert.match(css, /prefers-reduced-motion/);
    assert.match(css, /focus-visible/);
    assert.match(css, /min-height: 44px/);
    assert.doesNotMatch(css, /box-shadow|backdrop-filter|linear-gradient|border-left/);
});

test('new panel gutters follow neighboring session, context and settings controls', () => {
    const fs = require('fs');
    const css = fs.readFileSync('web-ui/styles/session-features.css', 'utf8');
    const sessions = fs.readFileSync('web-ui/styles/sessions-toolbar-trash.css', 'utf8');
    const context = fs.readFileSync('web-ui/styles/context-health.css', 'utf8');
    const settings = fs.readFileSync('web-ui/styles/settings-panel.css', 'utf8');
    assert.match(sessions, /\.session-selector-section\s*\{\s*padding: 0 10px 8px/);
    assert.match(css, /#panel-sessions \.session-features\s*\{[^}]*margin-inline: 1px; padding-inline: 10px/);
    assert.match(css, /#panel-sessions \.feature-tabs button\s*\{[^}]*padding-inline: 10px/);
    assert.match(context, /padding-inline: var\(--spacing-sm\)/);
    assert.match(css, /\.context-window-reference\s*\{[^}]*padding-inline: var\(--spacing-sm\)/);
    assert.match(settings, /padding: 20px 24px/);
    assert.match(css, /#panel-settings \.feature-diagnostics\s*\{[^}]*padding-inline: var\(--spacing-md\)/);
    assert.match(settings, /padding: 18px 20px/);
    assert.match(css, /@media \(max-width: 640px\)\s*\{\s*#panel-settings \.feature-diagnostics\s*\{ padding-inline: 20px/);
});

test('session top tools keep stable selection metrics and fit narrow screens', () => {
    const fs = require('fs');
    const stylesheet = require('postcss').parse(fs.readFileSync('web-ui/styles/session-features.css', 'utf8'));
    const rules = [];
    stylesheet.walkRules((rule) => rules.push(rule));
    const base = rules.find((rule) => rule.selector === '#panel-sessions .feature-tabs button' && rule.parent.type === 'root');
    const declarations = (rule) => Object.fromEntries(rule.nodes.map(({ prop, value }) => [prop, value]));
    const metrics = declarations(base);
    assert.equal(metrics['min-height'], '44px');
    assert.equal(metrics['min-width'], '44px');
    assert.equal(metrics['font-weight'], 'var(--font-weight-secondary)');
    assert.equal(metrics['font-size'], 'var(--font-size-body)');
    const selected = rules.find((rule) => rule.selector.includes('.feature-tabs button[aria-expanded="true"]'));
    assert.deepEqual(declarations(selected), { background: 'var(--color-brand-light)', color: 'var(--color-brand-dark)' });
    const focus = rules.find((rule) => rule.selector === '#panel-sessions .feature-tabs button:focus-visible');
    assert.equal(declarations(focus)['outline-offset'], '-4px');
    const mobile = rules.filter((rule) => rule.parent.type === 'atrule' && rule.parent.params === '(max-width: 640px)');
    const group = mobile.find((rule) => rule.selector === '#panel-sessions .feature-tabs');
    assert.equal(declarations(group)['grid-template-columns'], 'repeat(3, minmax(0, 1fr))');
    assert.equal(declarations(group).width, '100%');
    const labels = mobile.find((rule) => rule.selector === '#panel-sessions .feature-tabs button');
    assert.equal(declarations(labels)['white-space'], 'normal');
    assert.equal(declarations(labels)['overflow-wrap'], 'anywhere');
    const template = fs.readFileSync('web-ui/partials/index/session-features.html', 'utf8');
    const toolbar = template.slice(template.indexOf('<div class="feature-tabs"'), template.indexOf('</div>'));
    assert.equal((toolbar.match(/<button /g) || []).length, 3);
    for (const view of ['bookmarks', 'search', 'projects']) {
        assert.ok(toolbar.includes(`:aria-expanded="featureView === '${view}'"`), view);
        assert.ok(toolbar.includes(`@click="openFeatureView('${view}')"`), view);
    }
});

test('settings diagnostics use scoped settings typography, flat controls and a responsive option grid', () => {
    const fs = require('fs');
    const html = fs.readFileSync('web-ui/partials/index/session-diagnostics.html', 'utf8');
    for (const action of ['startDiagnostics', 'cancelDiagnostics', "exportDiagnostics('json')", "exportDiagnostics('md')"]) assert.ok(html.includes(`@click="${action}"`), action);
    for (const field of ['diagnosticsRemote', 'diagnosticsSelected']) assert.ok(html.includes(`v-model="${field}"`), field);
    assert.ok(html.includes('$event.target === $event.currentTarget && $event.currentTarget.open && loadDiagnosticTargets()'));
    assert.ok(html.includes("t('features.diagnosticScope')"));
    assert.equal((html.match(/class="feature-button /g) || []).length, 4);
    assert.doesNotMatch(html, /btn-mini/);
    assert.match(html, /<summary class="feature-diagnostics-heading">[\s\S]*feature-diagnostics-chevron/);
    const stylesheet = require('postcss').parse(fs.readFileSync('web-ui/styles/session-features.css', 'utf8'));
    const rules = []; stylesheet.walkRules(rule => rules.push(rule));
    const metrics = (selector) => Object.fromEntries(rules.find(rule => rule.selector === selector && rule.parent.type === 'root').nodes.map(({ prop, value }) => [prop, value]));
    assert.equal(metrics('#panel-settings .feature-diagnostics-heading')['font-size'], 'var(--font-size-body)');
    assert.equal(metrics('#panel-settings .feature-diagnostics-heading')['font-weight'], 'var(--font-weight-primary)');
    assert.equal(metrics('#panel-settings .feature-diagnostic-options')['grid-template-columns'], 'repeat(2, minmax(0, 1fr))');
    assert.equal(metrics('#panel-settings .feature-diagnostic-options span')['overflow-wrap'], 'anywhere');
    assert.equal(metrics('#panel-settings .feature-diagnostics .feature-button')['min-width'], '44px');
    assert.equal(metrics('#panel-settings .feature-diagnostics .feature-primary').background, 'var(--color-brand-light)');
    assert.equal(metrics('#panel-settings .feature-diagnostics .feature-button:disabled').cursor, 'not-allowed');
    const mobile = rules.find(rule => rule.selector === '#panel-settings .feature-diagnostic-options' && rule.parent.params === '(max-width: 640px)');
    assert.equal(mobile.nodes.find(node => node.prop === 'grid-template-columns').value, 'minmax(0, 1fr)');
    const reduced = rules.find(rule => rule.selector === '#panel-settings .feature-diagnostics-chevron' && rule.parent.params === '(prefers-reduced-motion: reduce)');
    assert.equal(reduced.nodes.find(node => node.prop === 'transition').value, 'none');
});
