import assert from 'assert';
import { mountContextHealth } from './helpers/context-health-render.mjs';
import {
    readBundledWebUiCss,
    readBundledWebUiHtml
} from './helpers/web-ui-source.mjs';

test('session preview actions use stable left and right groups', () => {
    const html = readBundledWebUiHtml();
    const styles = readBundledWebUiCss();

    assert.match(html, /class="session-actions session-preview-actions"/);
    assert.match(html, /class="session-secondary-actions"/);
    assert.match(html, /class="session-primary-actions"/);
    assert.match(html, /class="btn-session-export has-label"/);
    assert.match(html, /class="btn-session-delete has-label session-delete-text-button"/);

    const outer = styles.match(/#panel-sessions \.session-preview-actions\s*\{[^}]*\}/);
    const left = styles.match(/#panel-sessions \.session-secondary-actions\s*\{[^}]*\}/);
    const right = styles.match(/#panel-sessions \.session-primary-actions\s*\{[^}]*\}/);

    assert.ok(outer && left && right);
    assert.match(outer[0], /display:\s*flex;/);
    assert.match(outer[0], /justify-content:\s*space-between;/);
    assert.match(outer[0], /flex-wrap:\s*nowrap;/);
    assert.match(left[0], /min-width:\s*0;/);
    assert.match(left[0], /overflow:\s*hidden;/);
    assert.match(left[0], /gap:\s*8px;/);
    assert.match(right[0], /flex-shrink:\s*0;/);
    assert.match(right[0], /gap:\s*16px;/);
});

test('session preview action labels collapse inside narrow preview container', () => {
    const html = readBundledWebUiHtml();
    const styles = readBundledWebUiCss();

    assert.match(html, /session-action-optional-text/);
    assert.match(styles, /@container session-preview \(max-width:\s*620px\)/);
    assert.match(styles, /\.session-action-optional-text\s*\{\s*display:\s*none;/);
    assert.match(styles, /\.session-action-optional-label\s*\{[^}]*width:\s*32px;[^}]*padding:\s*0;/);
});


test('session icon actions hide visible labels and preserve click disabled and delete modes', async () => {
    const buttons = [...readBundledWebUiHtml().matchAll(/<button\b[^>]*data-icon-only="true"[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0]);
    assert.strictEqual(buttons.length, 4);
    const calls = [];
    const ui = mountContextHealth(buttons.join(''), {
        data: () => ({ activeSession: { sessionId: 'fixture' }, sessionDetailLoading: false, sessionsLoading: false,
            sessionExporting: {}, sessionDeleting: {}, sessionTrashEnabled: false }),
        methods: { t: (key) => key, getSessionExportKey: (session) => session.sessionId, getSessionFilePath: () => '/fixture.jsonl',
            isDeleteAvailable: () => true, loadActiveSessionDetail: () => calls.push('refresh'), copySessionPath: () => calls.push('path'),
            exportSession: () => calls.push('export'), deleteSession: () => calls.push('delete') }
    });
    try {
        await ui.flush();
        const controls = ui.find((node) => node.type === 'button');
        for (const control of controls) {
            assert.ok(control.props['aria-label'] && control.props.title);
            assert.ok(control.children.some((node) => node.type === 'svg' && node.props['aria-hidden'] === 'true'));
            assert.ok(control.children.filter((node) => node.type === 'span').every((node) => node.props.hidden !== undefined));
            control.props.onClick();
        }
        assert.deepStrictEqual(calls.sort(), ['delete', 'export', 'path', 'refresh']);
        const deletion = controls.find((node) => String(node.props.class).includes('btn-session-delete'));
        assert.strictEqual(deletion.props['aria-label'], 'sessions.preview.deleteHard');
        ui.vm.sessionTrashEnabled = true; ui.vm.sessionDeleting.fixture = true; ui.vm.sessionExporting.fixture = true; ui.vm.sessionDetailLoading = true;
        await ui.flush();
        assert.strictEqual(deletion.props.disabled, true);
        assert.strictEqual(deletion.props['aria-label'], 'sessions.preview.moving');
        assert.ok(controls.find((node) => String(node.props.class).includes('btn-session-export')).props.disabled);
        assert.ok(controls.find((node) => String(node.props.class).includes('btn-session-refresh')).props.disabled);
    } finally { ui.unmount(); }
});
