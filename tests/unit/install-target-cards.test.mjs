import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { createDashboardComputed } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.computed.dashboard.mjs')));
const { createInstallMethods } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.methods.install.mjs')));

const computed = createDashboardComputed();
const installMethods = createInstallMethods();

function createContext(overrides = {}) {
    return {
        ...installMethods,
        installPackageManager: 'npm',
        installCommandAction: 'install',
        installRegistryPreset: 'default',
        installRegistryCustom: '',
        installStatusTargets: null,
        quoteShellArg(value) {
            return `'${value.replace(/'/g, `'\\''`)}'`;
        },
        ...overrides
    };
}

test('installTargetCards falls back when install-status is missing', () => {
    const ctx = createContext();
    const cards = computed.installTargetCards.call(ctx);
    assert.strictEqual(cards.length, 4);
    const ids = cards.map((item) => item.id).sort();
    assert.deepStrictEqual(ids, ['claude', 'codebuddy', 'codex', 'gemini']);
    for (const card of cards) {
        assert.strictEqual(typeof card.command, 'string');
        assert(card.command.length > 0);
    }
    const codex = cards.find((item) => item.id === 'codex');
    assert(codex);
    assert.strictEqual(typeof codex.termuxCommand, 'string');
    assert(codex.termuxCommand.includes('@mmmbuto/codex-cli-termux'));
});

test('app update notice only appears when latest package version is newer', () => {
    const ctx = createContext({
        appVersion: '0.0.40',
        appLatestVersion: '0.0.41',
        appVersionStatusChecked: true,
        appVersionStatusLoading: false,
        appVersionStatusError: '',
        t(key, params = {}) {
            if (key === 'side.update.availableWithVersion') return `Update v${params.version}`;
            if (key === 'side.update.metaVersions') return `${params.current}->${params.latest}`;
            if (key === 'side.update.upToDate') return 'Up to date';
            return key;
        }
    });

    assert.strictEqual(ctx.isAppVersionStatusVisible(), true);
    assert.strictEqual(ctx.appVersionStatusKind(), 'available');
    assert.strictEqual(ctx.comparePackageVersions('0.0.40', '0.0.41'), -1);
    assert.strictEqual(ctx.comparePackageVersions('0.0.41', '0.0.40'), 1);
    assert.strictEqual(ctx.comparePackageVersions('v0.0.41', '0.0.41'), 0);
    assert.strictEqual(ctx.isAppUpdateAvailable(), true);
    assert.strictEqual(ctx.appUpdateNoticeText(), 'Update v0.0.41');
    assert.strictEqual(ctx.appUpdateNoticeMeta(), '0.0.40->0.0.41');

    ctx.appLatestVersion = '0.0.40';
    assert.strictEqual(ctx.isAppUpdateAvailable(), false);
    assert.strictEqual(ctx.appVersionStatusKind(), 'current');
    assert.strictEqual(ctx.appUpdateNoticeText(), 'Up to date');
});

test('app version status exposes loading and retry states in the side rail', () => {
    const ctx = createContext({
        appVersion: '0.0.40',
        appLatestVersion: '',
        appVersionStatusChecked: false,
        appVersionStatusLoading: true,
        appVersionStatusError: '',
        t(key, params = {}) {
            if (key === 'side.update.checking') return 'Checking';
            if (key === 'side.update.checkingMeta') return 'Contacting registry';
            if (key === 'side.update.retry') return 'Retry';
            if (key === 'side.update.currentOnly') return `Current ${params.current}`;
            return key;
        }
    });

    assert.strictEqual(ctx.isAppVersionStatusVisible(), true);
    assert.strictEqual(ctx.appVersionStatusKind(), 'loading');
    assert.strictEqual(ctx.appUpdateNoticeText(), 'Checking');
    assert.strictEqual(ctx.appUpdateNoticeMeta(), 'Contacting registry');

    ctx.appVersionStatusLoading = false;
    ctx.appVersionStatusError = 'network down';
    assert.strictEqual(ctx.appVersionStatusKind(), 'error');
    assert.strictEqual(ctx.appUpdateNoticeText(), 'Retry');
    assert.strictEqual(ctx.appUpdateNoticeMeta(), 'network down');
});

test('app version status click retries checks unless an update is available', () => {
    const calls = [];
    const ctx = createContext({
        appVersion: '0.0.40',
        appLatestVersion: '0.0.40',
        loadAppVersionStatus(options) { calls.push(['load', options]); },
        openAppUpdateDocs() { calls.push(['docs']); }
    });

    ctx.handleAppVersionStatusClick();
    assert.deepStrictEqual(calls, [['load', { silent: false, force: true }]]);

    calls.length = 0;
    ctx.appLatestVersion = '0.0.41';
    ctx.handleAppVersionStatusClick();
    assert.deepStrictEqual(calls, [['docs']]);
});

test('loadAppVersionStatus passes force refresh through to the API', async () => {
    const calls = [];
    const forcedMethods = createInstallMethods({
        api(action, params) {
            calls.push([action, params]);
            return Promise.resolve({
                currentVersion: '0.0.40',
                latestVersion: '0.0.41',
                source: 'npm',
                checkedAt: '1970-01-01T00:00:00.000Z'
            });
        }
    });
    const ctx = {
        ...forcedMethods,
        appVersion: '',
        appLatestVersion: '',
        appVersionStatusLoading: false,
        appVersionStatusError: '',
        appVersionStatusChecked: false,
        appVersionStatusCheckedAt: '',
        appVersionStatusSource: '',
        showMessage() {},
        t(key) { return key; }
    };

    const ok = await ctx.loadAppVersionStatus({ silent: true, force: true });

    assert.strictEqual(ok, true);
    assert.deepStrictEqual(calls, [['version-status', { force: true }]]);
    assert.strictEqual(ctx.appVersion, '0.0.40');
    assert.strictEqual(ctx.appLatestVersion, '0.0.41');
    assert.strictEqual(ctx.appVersionStatusSource, 'npm');
    assert.strictEqual(ctx.appVersionStatusChecked, true);
});

test('openAppUpdateDocs switches to docs update command without running update', () => {
    const calls = [];
    const ctx = createContext({
        installCommandAction: 'install',
        switchMainTab(tab) { calls.push(tab); }
    });

    ctx.openAppUpdateDocs();

    assert.strictEqual(ctx.installCommandAction, 'update');
    assert.deepStrictEqual(calls, ['docs']);
});
