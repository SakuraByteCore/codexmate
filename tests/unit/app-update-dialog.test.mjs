import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { captureCurrentBundledAppOptions, withGlobalOverrides } from './helpers/web-ui-app-options.mjs';
const require = createRequire(import.meta.url);
const { readBundledWebUiHtml } = require('../../web-ui/source-bundle.cjs');
const appOptions = await captureCurrentBundledAppOptions();
const createUpdateContext = (overrides = {}) => ({ ...appOptions.data(), ...appOptions.methods,
    t: (key) => key, $nextTick: (callback) => callback(), ...overrides });

test('served app opens the update reminder without navigation or update execution and restores focus', async () => {
    const focused = [];
    const trigger = { focus: () => focused.push('trigger') };
    const ctx = createUpdateContext({ appVersion: '0.0.40', appLatestVersion: '0.0.41', mainTab: 'sessions',
        switchMainTab: () => assert.fail('must stay on the current page'),
        loadAppVersionStatus: () => assert.fail('opening the reminder must not call the API') });
    assert.equal(ctx.showAppUpdateModal, false);
    await withGlobalOverrides({ document: { activeElement: trigger, getElementById(id) {
        assert.equal(id, 'app-update-command');
        return { focus: () => focused.push('command') };
    } } }, () => {
        ctx.handleAppVersionStatusClick({ currentTarget: trigger });
        assert.equal(ctx.showAppUpdateModal, true);
        assert.equal(ctx.mainTab, 'sessions');
        assert.equal(ctx.installCommandAction, 'install');
        assert.equal(ctx.appUpdateCommand(), 'codexmate update');
        ctx.closeAppUpdateModal();
        assert.equal(ctx.showAppUpdateModal, false);
        assert.equal(ctx._appUpdateTrigger, null);
        assert.deepEqual(focused, ['command', 'trigger']);
    });
});

test('loading ignores clicks and errors retry even with an older cached update', () => {
    for (const state of [{ appVersionStatusLoading: true, expected: 0 },
        { appVersionStatusError: 'offline', expected: 1 }, { appLatestVersion: '0.0.40', expected: 1 }]) {
        const checks = [];
        const ctx = createUpdateContext({ appVersion: '0.0.40', appLatestVersion: '0.0.41', ...state,
            loadAppVersionStatus: (options) => checks.push(options),
            openAppUpdateModal: () => assert.fail('must not open an update reminder') });
        ctx.handleAppVersionStatusClick();
        assert.deepEqual(checks, state.expected ? [{ silent: false, force: true }] : []);
        assert.equal(ctx.showAppUpdateModal, false);
    }
});

test('update reminder handles Escape and Tab without overriding confirmation priority', () => {
    const calls = [];
    const ctx = createUpdateContext({ showAppUpdateModal: true, closeAppUpdateModal: () => calls.push('close'),
        trapModalFocus: () => calls.push('trap'), resolveConfirmDialog: (answer) => calls.push(answer) });
    const event = { key: 'Tab', preventDefault: () => calls.push('prevent'), stopPropagation: () => calls.push('stop') };
    ctx.handleGlobalKeydown(event);
    assert.deepEqual(calls.splice(0), ['trap']);
    ctx.handleGlobalKeydown({ ...event, key: 'Escape' });
    assert.deepEqual(calls.splice(0), ['prevent', 'stop', 'close']);
    ctx.showConfirmDialog = true;
    ctx.handleGlobalKeydown({ ...event, key: 'Escape' });
    assert.deepEqual(calls, ['prevent', 'stop', false]);
});

test('shared focus trap cycles within the update dialog', async () => {
    const focused = [];
    const first = { offsetParent: {}, focus: () => focused.push('first') };
    const last = { offsetParent: {}, focus: () => focused.push('last') };
    const modal = { querySelectorAll: () => [first, last], contains: () => true };
    const document = { activeElement: last, querySelectorAll: () => [modal] };
    const ctx = createUpdateContext({ showAppUpdateModal: true });
    await withGlobalOverrides({ document }, () => {
        ctx.handleGlobalKeydown({ key: 'Tab', preventDefault() {} });
        document.activeElement = first;
        ctx.handleGlobalKeydown({ key: 'Tab', shiftKey: true, preventDefault() {} });
        assert.deepEqual(focused, ['first', 'last']);
    });
});

test('command copy preserves exact text and reports clipboard and fallback outcomes', async () => {
    for (const mode of ['secure', 'insecure', 'denied', 'failed']) {
        const copied = [], messages = [];
        const ctx = createUpdateContext({ showMessage: (text, type) => messages.push([text, type]),
            fallbackCopyText: (text) => { copied.push(['fallback', text]); return mode !== 'failed'; } });
        await withGlobalOverrides({ window: { isSecureContext: mode !== 'insecure' }, navigator: { clipboard: {
            writeText: async (text) => { copied.push(['clipboard', text]); if (mode !== 'secure') throw Error('denied'); }
        } } }, () => ctx.copyInstallCommand(ctx.appUpdateCommand()));
        const paths = mode === 'secure' ? ['clipboard'] : mode === 'insecure' ? ['fallback'] : ['clipboard', 'fallback'];
        assert.deepEqual(copied, paths.map((path) => [path, 'codexmate update']));
        assert.deepEqual(messages, mode === 'failed' ? [['toast.copy.fail', 'error']] : [['toast.copy.ok', 'success']]);
    }
});

test('both version entrances share the handler and the dialog keeps manual copy and close controls', () => {
    const html = readBundledWebUiHtml();
    assert.equal((html.match(/@click="handleAppVersionStatusClick"/g) || []).length, 2);
    assert.match(html, /class="modal app-update-modal" role="dialog" aria-modal="true" aria-labelledby="app-update-title"/);
    assert.match(html, /id="app-update-command"[^>]*:value="appUpdateCommand\(\)" readonly[^>]*@focus="\$event.target.select\(\)"/);
    assert.match(html, /@click="copyInstallCommand\(appUpdateCommand\(\)\)"/);
    assert.match(html, /v-if="showAppUpdateModal"[^>]*@click.self="closeAppUpdateModal"/);
    assert.match(html, /@click="closeAppUpdateModal">\{\{ t\('common.close'\) \}\}/);
});
