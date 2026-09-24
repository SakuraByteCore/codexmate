import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { readBundledWebUiHtml, readBundledWebUiCss, readProjectFile, projectRoot } from './helpers/web-ui-source.mjs';
import {
    applyMarkdownToolbarAction,
    buildMarkdownPreviewHtml,
    escapeHtmlText,
    highlightMarkdownText
} from '../../web-ui/logic.markdown-editor.mjs';
import { createPromptsEditorMethods } from '../../web-ui/modules/app.methods.prompts-editor.mjs';
import { DICT } from '../../web-ui/modules/i18n.dict.mjs';

const AMP = String.fromCharCode(38);

function loadUmdCommonJs(relativePath) {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
    const mod = { exports: {} };
    new Function('module', 'exports', 'window', 'self', 'globalThis', source)(
        mod, mod.exports, undefined, undefined, globalThis
    );
    return mod.exports;
}

function makeEditorContext() {
    const textarea = {
        readOnly: false,
        selectionStart: 0,
        selectionEnd: 0,
        scrollTop: 0,
        scrollLeft: 0,
        focus() {},
        setSelectionRange(start, end) {
            this.selectionStart = start;
            this.selectionEnd = end;
        }
    };
    return {
        promptsPreviewEnabled: true,
        promptsMobileView: 'edit',
        promptsPreviewLibsMissing: false,
        agentsContent: 'hello',
        sysPromptContent: 'sys body',
        agentsHighlightHtml: '',
        sysPromptHighlightHtml: '',
        agentsPreviewHtml: '',
        sysPromptPreviewHtml: '',
        $refs: {
            promptsAgentsTextarea: textarea,
            promptsAgentsHighlight: {}
        },
        $nextTick(fn) {
            fn();
        }
    };
}

test('markdown toolbar bold action wraps selection and restores caret', () => {
    const wrapped = applyMarkdownToolbarAction('hello world', 0, 5, 'bold');
    assert.strictEqual(wrapped.text, '**hello** world');
    assert.strictEqual(wrapped.selStart, 2);
    assert.strictEqual(wrapped.selEnd, 7);

    const empty = applyMarkdownToolbarAction('hello world', 6, 6, 'bold');
    assert.strictEqual(empty.text, 'hello ****world');
    assert.strictEqual(empty.selStart, 8);
    assert.strictEqual(empty.selEnd, 8);
});

test('markdown toolbar list action toggles line prefixes', () => {
    const added = applyMarkdownToolbarAction('a\nb\nc', 0, 5, 'list');
    assert.strictEqual(added.text, '- a\n- b\n- c');

    const removed = applyMarkdownToolbarAction('- a\n- b', 0, 6, 'list');
    assert.strictEqual(removed.text, 'a\nb');

    const mixed = applyMarkdownToolbarAction('- a\nb', 0, 5, 'list');
    assert.strictEqual(mixed.text, '- a\n- b');
});

test('markdown toolbar code action wraps selection in fences', () => {
    const wrapped = applyMarkdownToolbarAction('x=1', 0, 3, 'code');
    assert.strictEqual(wrapped.text, '```\nx=1\n```');
    assert.strictEqual(wrapped.selStart, 4);
    assert.strictEqual(wrapped.selEnd, 7);

    const empty = applyMarkdownToolbarAction('ab', 1, 1, 'code');
    assert.strictEqual(empty.text, 'a```\n\n```b');
    assert.strictEqual(empty.selStart, 5);
    assert.strictEqual(empty.selEnd, 5);
});

test('markdown toolbar clamps invalid selection and ignores unknown actions', () => {
    const clamped = applyMarkdownToolbarAction('abc', 99, 99, 'bold');
    assert.strictEqual(clamped.text, 'abc****');
    assert.strictEqual(clamped.selStart, 5);

    const ignored = applyMarkdownToolbarAction('abc', 1, 2, 'nope');
    assert.strictEqual(ignored.text, 'abc');
    assert.strictEqual(ignored.selStart, 1);
    assert.strictEqual(ignored.selEnd, 2);
});

test('escapeHtmlText produces HTML entities', () => {
    const escaped = escapeHtmlText('<b class="x">&</b>');
    assert.ok(escaped.indexOf(AMP + 'lt;b') >= 0, 'should escape <');
    assert.ok(escaped.indexOf(AMP + 'amp;') >= 0, 'should escape &');
    assert.ok(escaped.indexOf(AMP + 'quot;x' + AMP + 'quot;') >= 0, 'should escape "');
    assert.strictEqual(escapeHtmlText('plain'), 'plain');
});

test('highlightMarkdownText uses vendored highlight.js markdown grammar and escapes HTML', () => {
    const hljs = loadUmdCommonJs('web-ui/res/highlight.min.js');
    assert.strictEqual(typeof hljs.highlight, 'function');
    assert.ok(hljs.getLanguage('markdown'), 'vendored common build must ship the markdown grammar');

    const out = highlightMarkdownText('# Title\n\n**bold** and `code`', hljs);
    assert.ok(out.indexOf('hljs-section') >= 0, 'headings should be highlighted');
    assert.ok(out.indexOf('hljs-strong') >= 0, 'bold should be highlighted');
    assert.ok(out.indexOf('hljs-code') >= 0, 'inline code should be highlighted');
    assert.ok(out.endsWith('\n'), 'backdrop layer must end with newline to align with textarea');

    const escaped = highlightMarkdownText('<img src=x onerror=alert(1)>', hljs);
    assert.ok(escaped.indexOf('<img') === -1, 'raw HTML must not survive');
    assert.ok(escaped.indexOf(AMP + 'lt;') >= 0, 'HTML must be escaped');
});

test('highlightMarkdownText degrades to escaped plain text without highlight.js', () => {
    const out = highlightMarkdownText('# hi <b>', null);
    assert.ok(out.indexOf('<b>') === -1);
    assert.ok(out.indexOf(AMP + 'lt;b') >= 0);
    assert.ok(out.endsWith('\n'));
});

test('buildMarkdownPreviewHtml reports empty, missing libs, and sanitized output', () => {
    assert.deepStrictEqual(buildMarkdownPreviewHtml('   ', {}, {}), { empty: true, html: '' });
    assert.deepStrictEqual(buildMarkdownPreviewHtml('**b**', null, null), { unavailable: true, html: '' });

    const marked = loadUmdCommonJs('web-ui/res/marked.min.js');
    assert.strictEqual(typeof marked.parse, 'function');

    const identityPurify = { sanitize: (html) => String(html) };
    const raw = buildMarkdownPreviewHtml('**bold** and <img src=x onerror=alert(1)>', marked, identityPurify);
    assert.ok(raw.html.indexOf('<strong>bold</strong>') >= 0);
    assert.ok(raw.html.indexOf('onerror=alert(1)') >= 0, 'marked keeps raw HTML, so sanitize must be mandatory downstream');

    const strippingPurify = { sanitize: () => '<strong>bold</strong> and <img src="x">' };
    const clean = buildMarkdownPreviewHtml('**bold** and <img src=x onerror=alert(1)>', marked, strippingPurify);
    assert.ok(clean.html.indexOf('onerror') === -1);
});

test('prompts editor methods apply toolbar actions and undo via refs', () => {
    const methods = createPromptsEditorMethods();
    const ctx = makeEditorContext();
    const bound = {};
    for (const [name, fn] of Object.entries(methods)) {
        bound[name] = fn.bind(ctx);
    }
    Object.assign(ctx, bound);

    ctx.$refs.promptsAgentsTextarea.setSelectionRange(0, 5);
    ctx.applyPromptsToolbarAction('agents', 'bold');
    assert.strictEqual(ctx.agentsContent, '**hello**');
    assert.strictEqual(ctx.$refs.promptsAgentsTextarea.selectionStart, 2);
    assert.strictEqual(ctx.$refs.promptsAgentsTextarea.selectionEnd, 7);
    assert.ok(ctx.agentsHighlightHtml.length > 0, 'highlight layer should refresh');

    ctx.promptsUndo('agents');
    assert.strictEqual(ctx.agentsContent, 'hello');
    assert.strictEqual(ctx.$refs.promptsAgentsTextarea.selectionStart, 0);

    ctx.promptsUndo('agents');
    assert.strictEqual(ctx.agentsContent, 'hello', 'undo stack should be empty now');
});

test('prompts editor methods skip toolbar actions when textarea is readonly', () => {
    const methods = createPromptsEditorMethods();
    const ctx = makeEditorContext();
    const bound = {};
    for (const [name, fn] of Object.entries(methods)) {
        bound[name] = fn.bind(ctx);
    }
    Object.assign(ctx, bound);
    ctx.$refs.promptsAgentsTextarea.readOnly = true;
    ctx.applyPromptsToolbarAction('agents', 'bold');
    assert.strictEqual(ctx.agentsContent, 'hello');
});

test('prompts editor methods expose explicit lib-missing and empty preview states', () => {
    const methods = createPromptsEditorMethods();
    const ctx = makeEditorContext();
    const bound = {};
    for (const [name, fn] of Object.entries(methods)) {
        bound[name] = fn.bind(ctx);
    }
    Object.assign(ctx, bound);
    // No window in Node: preview libs are missing and must surface, not fake success.
    ctx.refreshPromptsPreview('agents');
    assert.strictEqual(ctx.promptsPreviewLibsMissing, true);
    assert.strictEqual(ctx.agentsPreviewHtml, '');

    ctx.promptsPreviewEnabled = false;
    ctx.refreshPromptsPreview('agents');
    assert.strictEqual(ctx.agentsPreviewHtml, '', 'preview refresh is a no-op while disabled');
});

test('prompts panel template wires toolbar, overlay refs and split preview for both editors', () => {
    const template = readBundledWebUiHtml();
    assert.match(template, /prompts-md-toolbar/);
    assert.match(template, /ref="promptsAgentsTextarea"/);
    assert.match(template, /ref="promptsAgentsHighlight"/);
    assert.match(template, /ref="promptsSysTextarea"/);
    assert.match(template, /ref="promptsSysHighlight"/);
    assert.match(template, /v-html="agentsPreviewHtml"/);
    assert.match(template, /v-html="sysPromptPreviewHtml"/);
    assert.match(template, /v-html="agentsHighlightHtml"/);
    assert.match(template, /v-html="sysPromptHighlightHtml"/);
    assert.match(template, /applyPromptsToolbarAction\('agents', 'bold'\)/);
    assert.match(template, /applyPromptsToolbarAction\('sys', 'code'\)/);
    assert.match(template, /promptsUndo\('agents'\)/);
    assert.doesNotMatch(template, /togglePromptsPreview/, 'live preview toggle eye button was removed per user request');
    assert.match(template, /setPromptsMobileView\('preview'\)/);
    assert.match(template, /t\('prompts\.editor\.previewUnavailable'\)/);
    // Existing readonly contract must stay intact for the diff flow.
    assert.match(template, /:readonly="agentsLoading \|\| agentsSaving \|\| agentsDiffVisible"/);
    assert.match(template, /:readonly="sysPromptLoading \|\| sysPromptSaving \|\| sysPromptDiffVisible"/);
});

test('web ui entry loads vendored highlight.js, marked and DOMPurify from res/', () => {
    const indexHtml = readProjectFile('web-ui/index.html');
    assert.match(indexHtml, /<script src="\/res\/highlight\.min\.js"><\/script>/);
    assert.match(indexHtml, /<script src="\/res\/marked\.min\.js"><\/script>/);
    assert.match(indexHtml, /<script src="\/res\/purify\.min\.js"><\/script>/);

    for (const asset of ['web-ui/res/highlight.min.js', 'web-ui/res/marked.min.js', 'web-ui/res/purify.min.js']) {
        const size = fs.statSync(path.join(projectRoot, asset)).size;
        assert.ok(size > 10000, `${asset} should be the real vendored build`);
    }
});

test('prompts editor styles and app wiring are in place', () => {
    const css = readBundledWebUiCss();
    assert.match(css, /prompts-highlight-backdrop/);
    assert.match(css, /prompts-preview-body/);
    assert.match(css, /prompts-mobile-view-switch/);
    assert.match(css, /max-width: 767\.98px/);

    const appJs = readProjectFile('web-ui/app.js');
    assert.match(appJs, /promptsPreviewEnabled: true/);
    assert.match(appJs, /promptsMobileView: 'edit'/);
    assert.match(appJs, /agentsContent\(\) \{\s*\n\s*if \(typeof this\.schedulePromptsEditorRefresh === 'function'\) this\.schedulePromptsEditorRefresh\('agents'\);/);
    assert.match(appJs, /sysPromptContent\(\) \{\s*\n\s*if \(typeof this\.schedulePromptsEditorRefresh === 'function'\) this\.schedulePromptsEditorRefresh\('sys'\);/);

    const methodsIndex = readProjectFile('web-ui/modules/app.methods.index.mjs');
    assert.match(methodsIndex, /import \{ createPromptsEditorMethods \} from '\.\/app\.methods\.prompts-editor\.mjs';/);
    assert.match(methodsIndex, /\.\.\.createPromptsEditorMethods\(\),/);
});

test('prompts editor i18n keys are localized in every locale', () => {
    const keys = [
        'prompts.editor.toolbar',
        'prompts.editor.bold',
        'prompts.editor.list',
        'prompts.editor.code',
        'prompts.editor.undo',
        'prompts.editor.previewToggle',
        'prompts.editor.edit',
        'prompts.editor.preview',
        'prompts.editor.previewUnavailable',
        'prompts.editor.previewEmpty'
    ];
    for (const code of ['zh', 'zh-tw', 'en', 'ja', 'vi']) {
        for (const key of keys) {
            assert.strictEqual(typeof DICT[code][key], 'string', `${code} should define ${key}`);
            assert.ok(DICT[code][key].trim(), `${code} ${key} should not be empty`);
        }
    }
});
