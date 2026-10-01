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
import {
    buildPromptsChangeAxis,
    buildPromptsDiffAxis,
    computePromptsAxisScrollTop
} from '../../web-ui/logic.prompts-change-axis.mjs';
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
    // Change axis wiring (edit pane + diff frame) for both editors.
    assert.match(template, /prompts-change-axis/);
    assert.match(template, /prompts-diff-frame/);
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
        'prompts.editor.changeAxisTick',
        'prompts.editor.changeAxisTruncated'
    ];
    for (const code of ['zh', 'zh-tw', 'en', 'ja', 'vi']) {
        for (const key of keys) {
            assert.strictEqual(typeof DICT[code][key], 'string', `${code} should define ${key}`);
            assert.ok(DICT[code][key].trim(), `${code} ${key} should not be empty`);
        }
    }
});

test('buildPromptsChangeAxis groups diff hunks into positioned ticks', () => {
    const base = ['a', 'b', 'c', 'd', 'e'].join('\n');
    const current = ['a', 'B', 'c', 'd', 'e', 'f'].join('\n');
    const axis = buildPromptsChangeAxis(base, current);
    assert.strictEqual(axis.totalLines, 6);
    assert.strictEqual(axis.truncated, false);
    assert.strictEqual(axis.ticks.length, 2, 'one modify hunk plus one append hunk');
    const [modifyTick, appendTick] = axis.ticks;
    assert.strictEqual(modifyTick.kind, 'mixed');
    assert.strictEqual(modifyTick.startLine, 2);
    assert.strictEqual(modifyTick.added, 1);
    assert.strictEqual(modifyTick.removed, 1);
    assert.ok(modifyTick.top >= 0 && modifyTick.top <= 100, 'tick position must be a percentage');
    assert.ok(modifyTick.height >= 1.2, 'tick height must respect the visibility minimum');
    assert.strictEqual(appendTick.kind, 'add');
    assert.strictEqual(appendTick.startLine, 6);
    assert.strictEqual(axis.stats.added, 2);
    assert.strictEqual(axis.stats.removed, 1);
});

test('buildPromptsChangeAxis degrades to truncated summary beyond the tick cap', () => {
    const lines = [];
    for (let i = 0; i < 500; i += 1) {
        lines.push(i % 2 === 0 ? `changed-${i}` : `same-${i}`);
    }
    const base = lines.map((value, i) => (i % 2 === 0 ? `orig-${i}` : value)).join('\n');
    const current = lines.join('\n');
    const axis = buildPromptsChangeAxis(base, current);
    assert.strictEqual(axis.truncated, true, '250 separate hunks must trip the cap');
    assert.strictEqual(axis.ticks.length, 200);
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

test('computePromptsAxisScrollTop maps line indexes proportionally and clamps', () => {
    assert.strictEqual(computePromptsAxisScrollTop(500, 500, 10, 100), 0, 'no scrollable space means zero');
    assert.strictEqual(computePromptsAxisScrollTop(2000, 500, 51, 101), 750);
    assert.strictEqual(computePromptsAxisScrollTop(2000, 500, 1, 101), 0);
    assert.strictEqual(computePromptsAxisScrollTop(2000, 500, 999, 101), 1500, 'clamped to max scroll');
});

test('refreshPromptsChangeAxis builds edit-mode ticks only when content differs', () => {
    const methods = createPromptsEditorMethods();
    const ctx = makeEditorContext();
    const bound = {};
    for (const [name, fn] of Object.entries(methods)) {
        bound[name] = fn.bind(ctx);
    }
    Object.assign(ctx, bound);

    ctx.refreshPromptsChangeAxis('agents');
    assert.deepStrictEqual(ctx.agentsChangeAxis.ticks, [], 'no unsaved changes means no ticks');
    assert.strictEqual(ctx.agentsChangeAxis.mode, 'edit');

    ctx.agentsContent = 'hello\nworld';
    ctx.refreshPromptsChangeAxis('agents');
    assert.strictEqual(ctx.agentsChangeAxis.mode, 'edit');
    assert.strictEqual(ctx.agentsChangeAxis.ticks.length, 1);
    assert.strictEqual(ctx.agentsChangeAxis.ticks[0].kind, 'add');
    assert.strictEqual(ctx.agentsChangeAxis.totalLines, 2);
    assert.strictEqual(ctx.agentsChangeAxis.added, 1);
    assert.strictEqual(ctx.agentsChangeAxis.removed, 0);

    ctx.sysPromptContent = 'sys body\nnew tail';
    ctx.refreshPromptsChangeAxis('sys');
    assert.strictEqual(ctx.sysChangeAxis.ticks.length, 1, 'sys editor shares the axis implementation');
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

test('jumpToPromptsChangeTick opens the diff comparison and scrolls both views', () => {
    const methods = createPromptsEditorMethods();
    const ctx = makeEditorContext();
    const bound = {};
    for (const [name, fn] of Object.entries(methods)) {
        bound[name] = fn.bind(ctx);
    }
    Object.assign(ctx, bound);

    // Edit mode WITHOUT the diff flow wired: legacy proportional editor scroll.
    ctx.agentsChangeAxis = { mode: 'edit', ticks: [], truncated: false, totalLines: 101, added: 1, removed: 0 };
    const textarea = ctx.$refs.promptsAgentsTextarea;
    textarea.scrollHeight = 2000;
    textarea.clientHeight = 500;
    ctx.jumpToPromptsChangeTick('agents', { startLine: 51, added: 1, removed: 0 });
    assert.strictEqual(textarea.scrollTop, 750, 'fallback jump scrolls the textarea proportionally');
    assert.strictEqual(ctx.$refs.promptsAgentsHighlight.scrollTop, 750, 'backdrop overlay stays in sync after the fallback jump');

    // Edit mode WITH the diff flow wired: the tick click must open the
    // red/green comparison (same entry the save/eye button uses) instead of
    // only scrolling, so the user sees WHAT changed.
    const prepareCalls = [];
    ctx.prepareAgentsDiff = () => {
        prepareCalls.push('agents');
    };
    textarea.scrollTop = 0;
    ctx.jumpToPromptsChangeTick('agents', { startLine: 51, added: 1, removed: 0 });
    assert.deepStrictEqual(prepareCalls, ['agents'], 'edit-mode tick opens the diff preview flow');
    assert.deepStrictEqual(ctx._promptsAxisPendingJump, { key: 'agents', startLine: 51 }, 'the clicked hunk is remembered for the post-load jump');
    assert.strictEqual(textarea.scrollTop, 0, 'primary path does not scroll the editor');

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
});

test('consumePromptsAxisPendingJump centers the diff view on the clicked hunk', () => {
    const methods = createPromptsEditorMethods();
    const ctx = makeEditorContext();
    const bound = {};
    for (const [name, fn] of Object.entries(methods)) {
        bound[name] = fn.bind(ctx);
    }
    Object.assign(ctx, bound);

    const scrollCalls = [];
    ctx.$refs.promptsAgentsDiffView = {
        children: [
            {},
            { scrollIntoView(options) { scrollCalls.push(options); } },
            {}
        ]
    };
    ctx._promptsAxisPendingJump = { key: 'agents', startLine: 2 };
    ctx.agentsDiffVisible = true;
    ctx.agentsDiffStats = { added: 1, removed: 1, unchanged: 1 };
    ctx.agentsDiffLines = [
        { type: 'context', value: 'a', oldNumber: 1, newNumber: 1 },
        { type: 'del', value: 'b', oldNumber: 2, newNumber: null },
        { type: 'add', value: 'B', oldNumber: null, newNumber: 2 }
    ];
    ctx.refreshPromptsChangeAxis('agents');
    assert.strictEqual(scrollCalls.length, 1, 'refresh consumes the pending jump once diff ticks exist');
    assert.deepStrictEqual(scrollCalls[0], { block: 'center' });
    assert.strictEqual(ctx._promptsAxisPendingJump, null, 'pending jump is cleared after consumption');

    ctx._promptsAxisPendingJump = { key: 'sys', startLine: 2 };
    ctx.refreshPromptsChangeAxis('agents');
    assert.notStrictEqual(ctx._promptsAxisPendingJump, null, 'a pending jump keyed to another editor is not consumed');

    ctx._promptsAxisPendingJump = { key: 'agents', startLine: 2 };
    ctx.agentsDiffVisible = false;
    ctx.refreshPromptsChangeAxis('agents');
    assert.strictEqual(ctx._promptsAxisPendingJump, null, 'leaving diff mode clears the stale pending jump');
});
