import assert from 'assert';
import fs from 'fs';
import { createContextHealthMethods } from '../../web-ui/modules/context-health.methods.mjs';
import { createContextAnalyzer, contextHealthLevel } from '../../web-ui/logic.context-health.mjs';
import { mountContextHealth } from './helpers/context-health-render.mjs';

// 保留旧交互断言，使用本次 UI 裁剪前的完整模板验证兼容方法。
function fixture(api, templatePath = './fixtures/context-health-legacy.html') {
    const analyzer = createContextAnalyzer();
    ['system', 'user', 'assistant', 'tools', 'code'].forEach((category, index) => analyzer.add({
        id: `record-${index}`, recordLineIndex: index, role: category, parts: [{ category, text: 'a'.repeat(16) }]
    }));
    const report = analyzer.finish();
    const template = fs.readFileSync(new URL(templatePath, import.meta.url), 'utf8');
    const calls = [];
    const mounted = mountContextHealth(template, {
        data: () => ({ mainTab: 'sessions', activeSession: { source: 'codex', sessionId: 'fixture', filePath: '/fixture.jsonl' },
            sessionDetailRequestSeq: 1, sessionContextHealth: null, sessionContextHealthStamp: '',
            sessionContextHealthLoading: false, sessionContextHealthError: '', sessionContextHealthExpanded: false,
            sessionContextHealthPinned: false, sessionContextHealthFocusedNode: null, sessionContextHealthNodeLoading: false,
            activeSessionMessages: [], sessionPreviewRenderEnabled: true, sessionPreviewVisibleCount: 20, sessionMessageRefMap: {} }),
        methods: { ...createContextHealthMethods({ api: async (action, params) => {
            calls.push({ action, params });
            return api ? api(action, params, report) : report;
        } }), t: (key) => key, getSessionExportKey: (session) => session.sessionId,
        getRecordRenderKey: (_record, index) => String(index) }
    });
    return { ...mounted, calls, report };
}

test('context health renders five weighted segments and the exact health thresholds', async () => {
    for (const [tokens, level] of [[0, 'healthy'], [31999, 'healthy'], [32000, 'heavy'], [64000, 'heavy'], [64001, 'bloated']]) {
        assert.strictEqual(contextHealthLevel(tokens), level);
    }
    const ui = fixture();
    try {
        await ui.flush();
        const segments = ui.find((node) => String(node.props.class).includes('context-health-segment'));
        assert.strictEqual(segments.length, 5);
        assert.ok(segments.every((node) => node.props.style.flexGrow === 4));
        assert.strictEqual(ui.calls.filter((call) => call.action === 'session-context-health').length, 1);
        assert.ok(ui.find((node) => String(node.props.class).includes('context-health-rating healthy')).length);
        assert.ok(!ui.vm.sessionContextHealthLoading);
    } finally { ui.unmount(); }
});

test('context health hover, click, and focus reveal details without repeated scanning', async () => {
    const ui = fixture();
    try {
        await ui.flush();
        const section = ui.find((node) => node.type === 'section')[0];
        section.props.onMouseenter(); await ui.flush();
        assert.strictEqual(ui.vm.sessionContextHealthExpanded, true);
        assert.strictEqual(ui.find((node) => node.props.id === 'context-health-details').length, 1);
        section.props.onMouseleave(); await ui.flush();
        assert.strictEqual(ui.vm.sessionContextHealthExpanded, false);
        const toggle = ui.find((node) => String(node.props.class).includes('context-health-toggle'))[0];
        toggle.props.onClick(); await ui.flush();
        section.props.onMouseleave(); await ui.flush();
        assert.strictEqual(ui.vm.sessionContextHealthExpanded, true);
        assert.strictEqual(toggle.props['aria-expanded'], true);
        toggle.props.onClick(); await ui.flush();
        section.props.onFocusin(); await ui.flush();
        assert.strictEqual(ui.vm.sessionContextHealthExpanded, true);
        assert.strictEqual(ui.calls.length, 1);
    } finally { ui.unmount(); }
});

test('context health Top 5 loads and focuses an unpaged message without changing existing messages', async () => {
    const ui = fixture((action, params, report) => action === 'session-context-node'
        ? { node: { id: params.nodeId, recordLineIndex: 40, text: '<script>fixture</script> large tool result' } } : report);
    try {
        await ui.flush();
        ui.vm.toggleContextHealthDetails(); await ui.flush();
        const list = ui.find((node) => String(node.props.class).includes('context-health-top'))[0];
        const button = list.children.find((node) => node.type === 'li').children.find((node) => node.type === 'button');
        await button.props.onClick(); await ui.flush();
        assert.ok(ui.calls.some((call) => call.action === 'session-context-node'));
        const target = ui.find((node) => node.props['data-context-node-id'])[0];
        assert.ok(target);
        assert.strictEqual(ui.getFocused(), target);
        assert.strictEqual(ui.scrolled[0].target, target);
        assert.deepStrictEqual(ui.vm.activeSessionMessages, []);
        assert.ok(ui.find((node) => node.type === 'pre' && node.text.includes('<script>fixture</script>')).length);
        assert.strictEqual(ui.find((node) => node.type === 'script').length, 0);
    } finally { ui.unmount(); }
});

test('context health ignores late reports after session replacement and shows actionable read failures', async () => {
    let resolve;
    const ui = fixture(() => new Promise((done) => { resolve = done; }));
    try {
        const oldSession = ui.vm.activeSession;
        ui.vm.activeSession = { ...oldSession, sessionId: 'replacement' };
        ui.vm.mainTab = 'config';
        resolve(ui.report); await ui.flush();
        assert.strictEqual(ui.vm.sessionContextHealth, null);
        ui.vm.mainTab = 'sessions';
        const pending = ui.vm.loadSessionContextHealth();
        resolve({ error: 'fixture read failure' });
        await pending; await ui.flush();
        assert.strictEqual(ui.vm.sessionContextHealthError, 'fixture read failure');
        assert.ok(ui.find((node) => node.props.role === 'alert').length);
    } finally { ui.unmount(); }
});


test('current context health shows all categories by default without rankings or expansion controls', async () => {
    const ui = fixture(undefined, '../../web-ui/partials/index/context-health.html');
    try {
        await ui.flush();
        assert.strictEqual(ui.vm.sessionContextHealthExpanded, false);
        assert.strictEqual(ui.find((node) => node.props.id === 'context-health-details').length, 1);
        assert.strictEqual(ui.find((node) => node.type === 'dt').length, 5);
        assert.strictEqual(ui.find((node) => node.type === 'dd').length, 5);
        assert.strictEqual(ui.find((node) => node.text.includes('contextHealth.estimateHint')).length, 0);
        const indicator = ui.find((node) => String(node.props.class).includes('context-health-rating'))[0];
        assert.strictEqual(indicator.type, 'span');
        assert.strictEqual(indicator.text, '');
        assert.strictEqual(indicator.props.role, 'img');
        assert.strictEqual(indicator.props['aria-label'], 'contextHealth.level.healthy');
        assert.strictEqual(indicator.parent.props.class, 'context-health-heading');
        assert.match(fs.readFileSync(new URL('../../web-ui/styles/context-health.css', import.meta.url), 'utf8'), /padding-inline:\s*var\(--spacing-sm\)/);
        assert.match(fs.readFileSync(new URL('../../web-ui/styles/context-health.css', import.meta.url), 'utf8'), /\.context-health\s*\+\s*\.session-export-feedback:empty\s*\{\s*display:\s*none;\s*\}/);
        assert.strictEqual(ui.find((node) => String(node.props.class).includes('context-health-top')).length, 0);
        assert.strictEqual(ui.find((node) => String(node.props.class).includes('context-health-hotspots')).length, 0);
        assert.strictEqual(ui.find((node) => String(node.props.class).includes('context-health-toggle')).length, 0);
        assert.strictEqual(ui.find((node) => node.props['aria-expanded'] !== undefined).length, 0);
        const section = ui.find((node) => node.type === 'section')[0];
        assert.strictEqual(section.props.onMouseleave, undefined);
        ui.vm.leaveContextHealthDetails(); await ui.flush();
        assert.strictEqual(ui.find((node) => node.props.id === 'context-health-details').length, 1);
        assert.strictEqual(ui.find((node) => node.type === 'button').length, 1);
        const refresh = ui.find((node) => node.type === 'button')[0];
        assert.strictEqual(refresh.props['aria-label'], 'common.refresh');
        await refresh.props.onClick(); await ui.flush();
        assert.strictEqual(ui.calls.length, 2);
    } finally { ui.unmount(); }
});

test('current context health reserves five loading rows and keeps loading accessible', async () => {
    let resolve;
    const ui = fixture(() => new Promise((done) => { resolve = done; }), '../../web-ui/partials/index/context-health.html');
    try {
        await ui.flush();
        assert.strictEqual(ui.find((node) => String(node.props.class) === 'context-health-loading-row').length, 5);
        assert.strictEqual(ui.find((node) => node.type === 'section')[0].props['aria-busy'], true);
        assert.strictEqual(ui.find((node) => node.type === 'button')[0].props.disabled, true);
        resolve(ui.report); await ui.flush(); await ui.flush();
        assert.strictEqual(ui.find((node) => node.props.id === 'context-health-details').length, 1);
        assert.strictEqual(ui.find((node) => node.type === 'section')[0].props['aria-busy'], false);
        assert.strictEqual(ui.find((node) => node.type === 'button')[0].props.disabled, false);
    } finally { ui.unmount(); }
});
