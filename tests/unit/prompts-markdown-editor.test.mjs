import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { readBundledWebUiHtml, readBundledWebUiCss, readProjectFile, projectRoot } from './helpers/web-ui-source.mjs';
import {
    buildMarkdownPreviewHtml,
    escapeHtmlText,
    highlightMarkdownText
} from '../../web-ui/logic.markdown-editor.mjs';
import { createPromptsEditorMethods } from '../../web-ui/modules/app.methods.prompts-editor.mjs';
import { buildPromptsDiffAxis } from '../../web-ui/logic.prompts-change-axis.mjs';
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
        scrollHeight: 0,
        clientHeight: 0,
        focus() {},
        setSelectionRange(start, end) {
            this.selectionStart = start;
            this.selectionEnd = end;
        }
    };
    const sysTextarea = Object.assign(Object.create(null), textarea, { scrollTop: 0, scrollHeight: 0, clientHeight: 0 });
    const emptyAxis = () => ({ mode: 'edit', ticks: [], truncated: false, totalLines: 0, added: 0, removed: 0 });
    return {
        promptsPreviewEnabled: true,
        promptsPreviewCollapsed: true,
        promptsMobileView: 'edit',
        promptsPreviewLibsMissing: false,
        agentsContent: 'hello',
        agentsOriginalContent: 'hello',
        sysPromptContent: 'sys body',
        sysPromptOriginalContent: 'sys body',
        agentsHighlightHtml: '',
        sysPromptHighlightHtml: '',
        agentsPreviewHtml: '',
        sysPromptPreviewHtml: '',
        agentsChangeAxis: emptyAxis(),
        sysChangeAxis: emptyAxis(),
        agentsDiffVisible: false,
        sysPromptDiffVisible: false,
        agentsDiffLines: [],
        sysPromptDiffLines: [],
        agentsDiffStats: { added: 0, removed: 0, unchanged: 0 },
        sysPromptDiffStats: { added: 0, removed: 0, unchanged: 0 },
        persistCalls: [],
        persistWebUiPreferences(overrides) {
            this.persistCalls.push(overrides);
        },
        $refs: {
            promptsAgentsTextarea: textarea,
            promptsSysTextarea: sysTextarea,
            promptsAgentsHighlight: {},
            promptsSysHighlight: {},
            promptsAgentsDiffView: null,
            promptsSysDiffView: null
        },
        $nextTick(fn) {
            fn();
        }
    };
}





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



test('prompts editor methods toggle split preview collapse state', () => {
    const methods = createPromptsEditorMethods();
    const ctx = makeEditorContext();
    const bound = {};
    for (const [name, fn] of Object.entries(methods)) {
        bound[name] = fn.bind(ctx);
    }
    Object.assign(ctx, bound);

    assert.strictEqual(ctx.promptsPreviewCollapsed, true, 'split preview defaults to collapsed');
    ctx.togglePromptsPreviewCollapsed();
    assert.strictEqual(ctx.promptsPreviewCollapsed, false, 'first click expands the preview column');
    assert.deepStrictEqual(
        ctx.persistCalls,
        [{ promptsPreviewCollapsed: false }],
        'manual expand choice is persisted via web-ui preferences'
    );
    ctx.togglePromptsPreviewCollapsed();
    assert.strictEqual(ctx.promptsPreviewCollapsed, true, 'second click re-collapses the split view');
    assert.strictEqual(ctx.persistCalls.length, 2, 'every manual toggle persists');
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
    assert.doesNotMatch(template, /togglePromptsPreview\b/, 'live preview toggle eye button was removed per user request');
    assert.match(template, /setPromptsMobileView\('preview'\)/);
    assert.match(template, /t\('prompts\.editor\.previewUnavailable'\)/);
    // Existing readonly contract must stay intact for the diff flow.
    assert.match(template, /:readonly="agentsLoading \|\| agentsSaving \|\| agentsDiffVisible"/);
    assert.match(template, /:readonly="sysPromptLoading \|\| sysPromptSaving \|\| sysPromptDiffVisible"/);
    // Toolbar icon buttons (bold / list / code / undo) were removed per user request.
    assert.doesNotMatch(template, /prompts-md-btn/, 'toolbar icon buttons were removed per user request');
    assert.doesNotMatch(template, /applyPromptsToolbarAction/, 'toolbar action wiring was removed per user request');
    assert.doesNotMatch(template, /promptsUndo/, 'undo wiring was removed per user request');
    // Split preview collapse button sits at the column boundary; default expanded.
    assert.match(template, /prompts-split-collapse-btn/);
    assert.match(template, /togglePromptsPreviewCollapsed\(\)/);
    assert.match(template, /'prompts-editor-frame--preview-collapsed': promptsPreviewCollapsed/);
    assert.match(template, /t\('prompts\.editor\.collapsePreview'\)/);
    // Change axis wiring (diff preview frame only) for both editors; the
    // edit pane must no longer render an axis.
    assert.match(template, /prompts-change-axis/);
    assert.match(template, /prompts-diff-frame/);
    assert.doesNotMatch(template, /!agentsDiffVisible && agentsChangeAxis/, 'edit-mode axis must stay removed (agents)');
    assert.doesNotMatch(template, /!sysPromptDiffVisible && sysChangeAxis/, 'edit-mode axis must stay removed (sys)');
    assert.match(template, /jumpToPromptsChangeTick\('agents', tick\)/);
    assert.match(template, /jumpToPromptsChangeTick\('sys', tick\)/);
    assert.match(template, /ref="promptsAgentsDiffView"/);
    assert.match(template, /ref="promptsSysDiffView"/);
    assert.match(template, /t\('prompts\.editor\.changeAxis'\)/);
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
    assert.match(css, /prompts-split-collapse-btn/);
    assert.match(css, /prompts-editor-frame--preview-collapsed/);
    assert.match(css, /prompts-change-axis/);
    assert.match(css, /prompts-change-tick--add/);
    assert.match(css, /prompts-diff-frame/);
    assert.doesNotMatch(css, /\.prompts-change-axis\s*\{\s*display:\s*none/, 'change axis must stay visible on mobile (touch ticks instead)');
    assert.match(css, /max-width: 767\.98px/);

    const appJs = readProjectFile('web-ui/app.js');
    assert.match(appJs, /promptsPreviewEnabled: true/);
    assert.match(appJs, /promptsMobileView: 'edit'/);
    assert.match(appJs, /promptsPreviewCollapsed: true/);
    assert.match(appJs, /agentsChangeAxis: \{ mode: 'edit', ticks: \[\], truncated: false, totalLines: 0, added: 0, removed: 0 \}/);
    assert.match(appJs, /agentsOriginalContent\(\) \{\s*\n\s*if \(typeof this\.schedulePromptsChangeAxis === 'function'\) this\.schedulePromptsChangeAxis\('agents'\);/);
    assert.match(appJs, /agentsDiffVisible\(\) \{\s*\n\s*if \(typeof this\.refreshPromptsChangeAxis === 'function'\) this\.refreshPromptsChangeAxis\('agents'\);/);

    const preferencesModule = readProjectFile('web-ui/modules/app.methods.web-ui-preferences.mjs');
    assert.match(preferencesModule, /promptsPreviewCollapsed: normalizeBoolean\(hasOwn\(source, 'promptsPreviewCollapsed'\)/);
    const cliSource = readProjectFile('cli.js');
    assert.match(cliSource, /promptsPreviewCollapsed: normalizeBooleanPreference\(source\.promptsPreviewCollapsed, true\)/);
    assert.match(appJs, /agentsContent\(\) \{\s*\n\s*if \(typeof this\.schedulePromptsEditorRefresh === 'function'\) this\.schedulePromptsEditorRefresh\('agents'\);/);
    assert.match(appJs, /sysPromptContent\(\) \{\s*\n\s*if \(typeof this\.schedulePromptsEditorRefresh === 'function'\) this\.schedulePromptsEditorRefresh\('sys'\);/);

    const methodsIndex = readProjectFile('web-ui/modules/app.methods.index.mjs');
    assert.match(methodsIndex, /import \{ createPromptsEditorMethods \} from '\.\/app\.methods\.prompts-editor\.mjs';/);
    assert.match(methodsIndex, /\.\.\.createPromptsEditorMethods\(\{ api \}\),/);
});

test('prompts editor i18n keys are localized in every locale', () => {
    const keys = [
        'prompts.editor.toolbar',
        'prompts.editor.previewToggle',
        'prompts.editor.collapsePreview',
        'prompts.editor.expandPreview',
        'prompts.editor.edit',
        'prompts.editor.preview',
        'prompts.editor.previewUnavailable',
        'prompts.editor.previewEmpty',
        'prompts.editor.changeAxis',
        'prompts.editor.changeAxisTick'
    ];
    for (const code of ['zh', 'zh-tw', 'en', 'ja', 'vi']) {
        for (const key of keys) {
            assert.strictEqual(typeof DICT[code][key], 'string', `${code} should define ${key}`);
            assert.ok(DICT[code][key].trim(), `${code} ${key} should not be empty`);
        }
    }
});



test('buildPromptsDiffAxis maps ticks to rendered row indexes', () => {
    const rows = [
        { type: 'context', value: 'a', oldNumber: 1, newNumber: 1 },
        { type: 'del', value: 'b', oldNumber: 2, newNumber: null },
        { type: 'add', value: 'B', oldNumber: null, newNumber: 2 },
        { type: 'context', value: 'c', oldNumber: 3, newNumber: 3 }
    ];
    const axis = buildPromptsDiffAxis(rows);
    assert.strictEqual(axis.rowCount, 4);
    assert.strictEqual(axis.ticks.length, 1);
    assert.strictEqual(axis.ticks[0].rowIndex, 1);
    assert.strictEqual(axis.ticks[0].kind, 'mixed');
    assert.strictEqual(axis.ticks[0].startLine, 2);
    assert.strictEqual(axis.ticks[0].top, 25);
});


test('refreshPromptsChangeAxis keeps the axis empty in edit mode', () => {
    const methods = createPromptsEditorMethods();
    const ctx = makeEditorContext();
    const bound = {};
    for (const [name, fn] of Object.entries(methods)) {
        bound[name] = fn.bind(ctx);
    }
    Object.assign(ctx, bound);

    ctx.agentsContent = 'hello\nworld';
    ctx.sysPromptContent = 'sys body\nnew tail';
    ctx.refreshPromptsChangeAxis('agents');
    ctx.refreshPromptsChangeAxis('sys');
    assert.deepStrictEqual(ctx.agentsChangeAxis, { mode: 'edit', ticks: [], truncated: false, totalLines: 0, added: 0, removed: 0 }, 'edit mode renders no axis even with unsaved changes');
    assert.deepStrictEqual(ctx.sysChangeAxis, { mode: 'edit', ticks: [], truncated: false, totalLines: 0, added: 0, removed: 0 }, 'sys editor shares the empty-axis contract');
});

test('refreshPromptsChangeAxis switches to row-indexed diff ticks in diff mode', () => {
    const methods = createPromptsEditorMethods();
    const ctx = makeEditorContext();
    const bound = {};
    for (const [name, fn] of Object.entries(methods)) {
        bound[name] = fn.bind(ctx);
    }
    Object.assign(ctx, bound);

    ctx.agentsDiffVisible = true;
    ctx.agentsDiffStats = { added: 2, removed: 1, unchanged: 1 };
    ctx.agentsDiffLines = [
        { type: 'context', value: 'a', oldNumber: 1, newNumber: 1 },
        { type: 'del', value: 'b', oldNumber: 2, newNumber: null },
        { type: 'add', value: 'B', oldNumber: null, newNumber: 2 },
        { type: 'add', value: 'B2', oldNumber: null, newNumber: 3 }
    ];
    ctx.refreshPromptsChangeAxis('agents');
    assert.strictEqual(ctx.agentsChangeAxis.mode, 'diff');
    assert.strictEqual(ctx.agentsChangeAxis.totalLines, 4);
    assert.strictEqual(ctx.agentsChangeAxis.added, 2);
    assert.strictEqual(ctx.agentsChangeAxis.removed, 1);
    assert.strictEqual(ctx.agentsChangeAxis.ticks.length, 1);
    assert.strictEqual(ctx.agentsChangeAxis.ticks[0].rowIndex, 1);
    assert.strictEqual(ctx.agentsChangeAxis.ticks[0].kind, 'mixed');
});

test('jumpToPromptsChangeTick centers the diff row and no-ops in edit mode', () => {
    const methods = createPromptsEditorMethods();
    const ctx = makeEditorContext();
    const bound = {};
    for (const [name, fn] of Object.entries(methods)) {
        bound[name] = fn.bind(ctx);
    }
    Object.assign(ctx, bound);

    // Diff mode: clicking a tick centers the matching rendered row.
    const scrollCalls = [];
    ctx.agentsChangeAxis = { mode: 'diff', ticks: [], truncated: false, totalLines: 4, added: 2, removed: 1 };
    ctx.$refs.promptsAgentsDiffView = {
        children: [
            {},
            {},
            { scrollIntoView(options) { scrollCalls.push(options); } },
            {}
        ]
    };
    ctx.jumpToPromptsChangeTick('agents', { rowIndex: 2, startLine: 3, added: 1, removed: 0 });
    assert.deepStrictEqual(scrollCalls, [{ block: 'center' }], 'diff-mode jump centers the target row');

    ctx.$refs.promptsAgentsDiffView = null;
    ctx.jumpToPromptsChangeTick('agents', { rowIndex: 9, startLine: 3, added: 1, removed: 0 });
    ctx.jumpToPromptsChangeTick('agents', null);
    assert.strictEqual(scrollCalls.length, 1, 'missing refs or ticks must not throw');

    // Edit mode has no axis UI any more: a stray jump call must be a silent
    // no-op, never re-opening the diff flow or scrolling the editor.
    const prepareCalls = [];
    ctx.prepareAgentsDiff = () => {
        prepareCalls.push('agents');
    };
    const textarea = ctx.$refs.promptsAgentsTextarea;
    textarea.scrollTop = 0;
    ctx.agentsChangeAxis = { mode: 'edit', ticks: [], truncated: false, totalLines: 101, added: 1, removed: 0 };
    ctx.jumpToPromptsChangeTick('agents', { startLine: 51, added: 1, removed: 0 });
    assert.deepStrictEqual(prepareCalls, [], 'edit-mode jump must not open the diff flow');
    assert.strictEqual(textarea.scrollTop, 0, 'edit-mode jump must not scroll the editor');
});
