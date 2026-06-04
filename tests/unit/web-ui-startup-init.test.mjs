import assert from 'assert';
import {
    captureCurrentBundledAppOptions,
    withGlobalOverrides
} from './helpers/web-ui-app-options.mjs';

test('mounted defers initial loadAll until after window load and a short timer', async () => {
    const appOptions = await captureCurrentBundledAppOptions();
    const registeredListeners = [];
    const removedListeners = [];
    const rafCallbacks = [];
    const timeoutCallbacks = [];
    let refreshClaudeSelectionCalls = 0;
    let syncDefaultOpenclawCalls = 0;
    const context = {
        sessionResumeWithYolo: true,
        claudeConfigs: {},
        openclawConfigs: {
            '默认配置': {
                content: ''
            }
        },
        currentOpenclawConfig: '',
        initSessionStandalone() {},
        updateCompactLayoutMode() {},
        restoreSessionFilterCache() {},
        restoreSessionPinnedMap() {},
        normalizeShareCommandPrefix(value) {
            return value || 'npm start';
        },
        normalizeSessionTrashEnabled(value) {
            return value !== '0' && value !== 'false';
        },
        normalizeSessionTrashRetentionDays(value) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric) || numeric < 1) return 30;
            return Math.min(365, Math.max(1, Math.floor(numeric)));
        },
        onWindowResize() {},
        handleGlobalKeydown() {},
        handleBeforeUnload() {},
        refreshClaudeSelectionFromSettings() {
            refreshClaudeSelectionCalls += 1;
            return Promise.resolve();
        },
        syncDefaultOpenclawConfigEntry() {
            syncDefaultOpenclawCalls += 1;
            return Promise.resolve();
        },
        loadAllCalls: 0,
        loadAll() {
            this.loadAllCalls += 1;
            return Promise.resolve(true);
        }
    };

    await withGlobalOverrides({
        document: {
            readyState: 'interactive'
        },
        localStorage: {
            getItem() {
                return null;
            },
            setItem() {},
            removeItem() {}
        },
        window: {
            addEventListener(name, handler, options) {
                registeredListeners.push({ name, handler, options });
            },
            removeEventListener(name, handler) {
                removedListeners.push({ name, handler });
            }
        },
        requestAnimationFrame(callback) {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        },
        cancelAnimationFrame() {},
        setTimeout(callback, ms) {
            timeoutCallbacks.push({ callback, ms });
            return timeoutCallbacks.length;
        },
        clearTimeout() {}
    }, async () => {
        appOptions.mounted.call(context);
        assert.strictEqual(context.loadAllCalls, 0);
        assert.strictEqual(refreshClaudeSelectionCalls, 0);
        assert.strictEqual(syncDefaultOpenclawCalls, 0);
        const loadListener = registeredListeners.find((entry) => entry.name === 'load');
        assert.ok(loadListener, 'mounted should wait for window load before first loadAll');

        loadListener.handler();
        assert.strictEqual(context.loadAllCalls, 0);
        assert.strictEqual(rafCallbacks.length, 1);

        rafCallbacks[0]();
        assert.strictEqual(context.loadAllCalls, 0);
        assert.strictEqual(timeoutCallbacks.length, 1);
        assert.strictEqual(timeoutCallbacks[0].ms, 120);

        await timeoutCallbacks[0].callback();
        assert.strictEqual(context.loadAllCalls, 1);
        assert.strictEqual(refreshClaudeSelectionCalls, 1);
        assert.strictEqual(syncDefaultOpenclawCalls, 1);
        assert.ok(
            removedListeners.some((entry) => entry.name === 'load' && entry.handler === loadListener.handler),
            'mounted should clean up the one-shot load listener after scheduling the initial refresh'
        );
    });
});

test('mounted skips auxiliary startup requests when loadAll fails', async () => {
    const appOptions = await captureCurrentBundledAppOptions();
    const registeredListeners = [];
    const rafCallbacks = [];
    const timeoutCallbacks = [];
    let refreshClaudeSelectionCalls = 0;
    let syncDefaultOpenclawCalls = 0;
    const context = {
        sessionResumeWithYolo: true,
        claudeConfigs: {},
        openclawConfigs: {
            '默认配置': {
                content: ''
            }
        },
        currentOpenclawConfig: '',
        initSessionStandalone() {},
        updateCompactLayoutMode() {},
        restoreSessionFilterCache() {},
        restoreSessionPinnedMap() {},
        normalizeShareCommandPrefix(value) {
            return value || 'npm start';
        },
        normalizeSessionTrashEnabled(value) {
            return value !== '0' && value !== 'false';
        },
        normalizeSessionTrashRetentionDays(value) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric) || numeric < 1) return 30;
            return Math.min(365, Math.max(1, Math.floor(numeric)));
        },
        onWindowResize() {},
        handleGlobalKeydown() {},
        handleBeforeUnload() {},
        refreshClaudeSelectionFromSettings() {
            refreshClaudeSelectionCalls += 1;
            return Promise.resolve();
        },
        syncDefaultOpenclawConfigEntry() {
            syncDefaultOpenclawCalls += 1;
            return Promise.resolve();
        },
        loadAllCalls: 0,
        loadAll() {
            this.loadAllCalls += 1;
            return Promise.resolve(false);
        }
    };

    await withGlobalOverrides({
        document: {
            readyState: 'interactive'
        },
        localStorage: {
            getItem() {
                return null;
            },
            setItem() {},
            removeItem() {}
        },
        window: {
            addEventListener(name, handler, options) {
                registeredListeners.push({ name, handler, options });
            },
            removeEventListener() {}
        },
        requestAnimationFrame(callback) {
            rafCallbacks.push(callback);
            return rafCallbacks.length;
        },
        cancelAnimationFrame() {},
        setTimeout(callback, ms) {
            timeoutCallbacks.push({ callback, ms });
            return timeoutCallbacks.length;
        },
        clearTimeout() {}
    }, async () => {
        appOptions.mounted.call(context);
        const loadListener = registeredListeners.find((entry) => entry.name === 'load');
        assert.ok(loadListener, 'mounted should wait for window load before first loadAll');

        loadListener.handler();
        assert.strictEqual(rafCallbacks.length, 1);
        rafCallbacks[0]();
        assert.strictEqual(timeoutCallbacks.length, 1);
        await timeoutCallbacks[0].callback();

        assert.strictEqual(context.loadAllCalls, 1);
        assert.strictEqual(refreshClaudeSelectionCalls, 0);
        assert.strictEqual(syncDefaultOpenclawCalls, 0);
    });
});

function createStartupMountContext(overrides = {}) {
    return {
        mainTab: 'dashboard',
        configMode: 'codex',
        settingsTab: 'general',
        sessionResumeWithYolo: true,
        claudeConfigs: {},
        openclawConfigs: {
            '默认配置': {
                content: ''
            }
        },
        currentOpenclawConfig: '',
        switchedTabs: [],
        initSessionStandaloneCalls: [],
        initSessionStandalone() {
            this.initSessionStandaloneCalls.push(window.location.href);
        },
        switchMainTab(tab) {
            this.switchedTabs.push(tab);
            this.mainTab = tab;
        },
        updateCompactLayoutMode() {},
        restoreSessionFilterCache() {},
        restoreSessionPinnedMap() {},
        normalizeShareCommandPrefix(value) {
            return value || 'npm start';
        },
        normalizeSessionTrashEnabled(value) {
            return value !== '0' && value !== 'false';
        },
        normalizeSessionTrashRetentionDays(value) {
            const numeric = Number(value);
            if (!Number.isFinite(numeric) || numeric < 1) return 30;
            return Math.min(365, Math.max(1, Math.floor(numeric)));
        },
        onWindowResize() {},
        handleGlobalKeydown() {},
        handleBeforeUnload() {},
        refreshClaudeSelectionFromSettings() {
            return Promise.resolve();
        },
        syncDefaultOpenclawConfigEntry() {
            return Promise.resolve();
        },
        loadAll() {
            return Promise.resolve(true);
        },
        ...overrides
    };
}

function createMutableWindowLocation(initialHref) {
    const location = {
        href: '',
        origin: '',
        pathname: '',
        search: '',
        hash: '',
        replace(nextHref) {
            apply(nextHref);
        }
    };
    function apply(nextHref) {
        const url = new URL(nextHref, location.href || initialHref);
        location.href = url.href;
        location.origin = url.origin;
        location.pathname = url.pathname;
        location.search = url.search;
        location.hash = url.hash;
    }
    apply(initialHref);
    return { location, apply };
}

function createStartupMountGlobals(initialHref, replacements = []) {
    const mutable = createMutableWindowLocation(initialHref);
    return {
        document: {
            readyState: 'complete'
        },
        localStorage: {
            getItem() {
                return null;
            },
            setItem() {},
            removeItem() {}
        },
        window: {
            location: mutable.location,
            history: {
                replaceState(_state, _title, nextHref) {
                    replacements.push(String(nextHref));
                    mutable.apply(nextHref);
                }
            },
            addEventListener() {},
            removeEventListener() {}
        },
        requestAnimationFrame(callback) {
            return callback;
        },
        cancelAnimationFrame() {},
        setTimeout(callback) {
            return callback;
        },
        clearTimeout() {}
    };
}

test('mounted preserves standalone session query parameters before standalone initialization', async () => {
    const appOptions = await captureCurrentBundledAppOptions();
    const context = createStartupMountContext();
    const replacements = [];

    await withGlobalOverrides(
        createStartupMountGlobals('http://127.0.0.1:3737/session?source=codex&sessionId=pr187-browser-link', replacements),
        async () => {
            appOptions.mounted.call(context);
        }
    );

    assert.deepStrictEqual(replacements, []);
    assert.deepStrictEqual(context.initSessionStandaloneCalls, [
        'http://127.0.0.1:3737/session?source=codex&sessionId=pr187-browser-link'
    ]);
});

test('mounted consumes shareable sessions tab URLs before canonical cleanup', async () => {
    const appOptions = await captureCurrentBundledAppOptions();
    const context = createStartupMountContext();
    const replacements = [];

    await withGlobalOverrides(
        createStartupMountGlobals('http://127.0.0.1:3737/?tab=sessions', replacements),
        async () => {
            appOptions.mounted.call(context);
        }
    );

    assert.deepStrictEqual(replacements, []);
    assert.deepStrictEqual(context.switchedTabs, ['sessions']);
    assert.strictEqual(context.mainTab, 'sessions');
});
