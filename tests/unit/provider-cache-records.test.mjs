import assert from 'assert';
import { createProviderCacheMethods } from '../../web-ui/modules/app.methods.provider-cache.mjs';
import {
    readBundledWebUiCss,
    readProjectFile
} from './helpers/web-ui-source.mjs';

function createContext(records = {}) {
    const methods = createProviderCacheMethods({
        api: async () => records
    });
    return {
        providerCacheRecords: records,
        providerCacheLoadedOnce: false,
        providerCacheLoadedAt: '',
        providerCacheLoading: false,
        providerCacheSyncing: false,
        providerCacheSyncMessage: '',
        providerCacheError: '',
        showProviderCacheModal: false,
        showProviderCacheAnnouncementModal: false,
        t(key, params = {}) {
            if (key === 'modal.providerCache.providerCount') return `${params.count} providers`;
            if (key === 'modal.providerCache.tooLarge') return 'too large';
            if (key === 'modal.providerCache.parseFailed') return 'parse failed';
            if (key === 'modal.providerCache.rawJsonOnly') return 'raw only';
            if (key === 'modal.providerCache.syncSucceeded') return `synced ${params.count}/${params.fileCount}`;
            if (key === 'modal.providerCache.syncFailed') return 'sync failed';
            return key;
        },
        ...methods
    };
}

test('provider cache methods expose provider summaries before raw JSON', () => {
    const context = createContext();
    const file = {
        name: 'codex-provider-cache.json',
        displayPath: '~/.codexmate/codex-provider-cache.json',
        exists: true,
        ok: true,
        size: 2048,
        providerCount: 2,
        providers: [
            {
                name: 'openai',
                baseUrl: 'https://api.openai.com/v1',
                wireApi: 'responses',
                authMethod: 'api-key',
                data: { name: 'openai', authorization: 'Bear…1234' }
            },
            {
                name: 'deepseek',
                baseUrl: 'https://api.deepseek.com/v1',
                wireApi: 'chat_completions',
                data: { name: 'deepseek' }
            }
        ],
        data: { providers: {} }
    };

    assert.strictEqual(context.getProviderCacheFileKey(file), '~/.codexmate/codex-provider-cache.json');
    assert.strictEqual(context.getProviderCacheFilePath(file), '~/.codexmate/codex-provider-cache.json');
    assert.strictEqual(context.getProviderCacheFileSummary(file), '2 providers');
    assert.strictEqual(context.hasProviderCacheProviders(file), true);
    assert.deepStrictEqual(context.getProviderCacheProviderMeta(file.providers[0]), [
        { label: 'base_url', value: 'https://api.openai.com/v1' },
        { label: 'wire_api', value: 'responses' },
        { label: 'auth', value: 'api-key' }
    ]);
    assert.match(context.getProviderCacheProviderText(file.providers[0]), /Bear…1234/);
});

test('provider cache announcement modal opens from sidebar and summarizes cache records', async () => {
    const calls = [];
    const records = {
        root: '~/.codexmate',
        generatedAt: 'summary-time',
        groups: [
            {
                key: 'codex',
                label: 'Codex',
                files: [
                    { exists: true, providerCount: 2, providers: [{ name: 'alpha' }, { name: 'beta' }] },
                    { exists: false, providerCount: 99, providers: [{ name: 'ignored' }] }
                ]
            },
            {
                key: 'claude',
                label: 'Claude',
                files: [
                    { exists: true, providers: [{ name: 'gamma' }] }
                ]
            }
        ]
    };
    const methods = createProviderCacheMethods({
        api: async (action) => {
            calls.push(action);
            return records;
        }
    });
    const context = {
        providerCacheRecords: { root: '', generatedAt: '', groups: [] },
        providerCacheLoadedOnce: false,
        providerCacheLoadedAt: '',
        providerCacheLoading: false,
        providerCacheError: '',
        showProviderCacheModal: false,
        showProviderCacheAnnouncementModal: false,
        t(key) { return key; },
        ...methods
    };

    await context.openProviderCacheAnnouncementModal();

    assert.deepStrictEqual(calls, ['get-provider-cache-records']);
    assert.strictEqual(context.showProviderCacheAnnouncementModal, true);
    assert.deepStrictEqual(context.getProviderCacheAnnouncementSummary(), {
        groupCount: 2,
        fileCount: 2,
        providerCount: 3,
        loadedAt: 'summary-time'
    });
    assert.deepStrictEqual(context.getProviderCacheAnnouncementGroups(), [
        { key: 'codex', label: 'Codex', existingCount: 1, providerCount: 2 },
        { key: 'claude', label: 'Claude', existingCount: 1, providerCount: 1 }
    ]);
});

test('provider cache sync method calls sync API then refreshes redacted records', async () => {
    const calls = [];
    const syncedRecords = { root: '~/.codexmate', generatedAt: 'sync-time', groups: [] };
    const refreshedRecords = { root: '~/.codexmate', generatedAt: 'refresh-time', groups: [] };
    const methods = createProviderCacheMethods({
        api: async (action) => {
            calls.push(action);
            if (action === 'sync-provider-cache-records') {
                return { success: true, summary: { providerCount: 2, fileCount: 5 }, records: syncedRecords };
            }
            if (action === 'get-provider-cache-records') {
                return refreshedRecords;
            }
            throw new Error(`unexpected action: ${action}`);
        }
    });
    const context = {
        providerCacheRecords: {},
        providerCacheLoadedOnce: false,
        providerCacheLoadedAt: '',
        providerCacheLoading: false,
        providerCacheSyncing: false,
        providerCacheSyncMessage: '',
        providerCacheError: '',
        showProviderCacheModal: false,
        showProviderCacheAnnouncementModal: false,
        t(key, params = {}) {
            if (key === 'modal.providerCache.syncSucceeded') return `synced ${params.count}/${params.fileCount}`;
            return key;
        },
        ...methods
    };

    await context.syncProviderCacheRecords();

    assert.deepStrictEqual(calls, ['sync-provider-cache-records', 'get-provider-cache-records']);
    assert.strictEqual(context.providerCacheSyncing, false);
    assert.strictEqual(context.providerCacheSyncMessage, 'synced 2/5');
    assert.strictEqual(context.providerCacheError, '');
    assert.strictEqual(context.providerCacheLoadedOnce, true);
    assert.strictEqual(context.providerCacheLoadedAt, 'refresh-time');
    assert.deepStrictEqual(context.providerCacheRecords, refreshedRecords);
});

test('provider cache sync method uses localized fallback on thrown errors', async () => {
    const methods = createProviderCacheMethods({
        api: async () => {
            throw new Error('');
        }
    });
    const context = {
        providerCacheRecords: {},
        providerCacheLoadedOnce: false,
        providerCacheLoadedAt: '',
        providerCacheLoading: false,
        providerCacheSyncing: false,
        providerCacheSyncMessage: '',
        providerCacheError: '',
        showProviderCacheModal: false,
        showProviderCacheAnnouncementModal: false,
        t(key) {
            assert.strictEqual(key, 'modal.providerCache.syncFailed');
            return 'localized sync failed';
        },
        ...methods
    };

    await context.syncProviderCacheRecords();

    assert.strictEqual(context.providerCacheError, 'localized sync failed');
    assert.strictEqual(context.providerCacheSyncing, false);
});

test('provider cache sync method localizes backend error keys', async () => {
    const methods = createProviderCacheMethods({
        api: async () => ({ errorKey: 'modal.providerCache.noSyncableProviders', error: 'No syncable providers' })
    });
    const context = {
        providerCacheRecords: {},
        providerCacheLoadedOnce: false,
        providerCacheLoadedAt: '',
        providerCacheLoading: false,
        providerCacheSyncing: false,
        providerCacheSyncMessage: '',
        providerCacheError: '',
        showProviderCacheModal: false,
        showProviderCacheAnnouncementModal: false,
        t(key) {
            assert.strictEqual(key, 'modal.providerCache.noSyncableProviders');
            return 'localized no providers';
        },
        ...methods
    };

    await context.syncProviderCacheRecords();

    assert.strictEqual(context.providerCacheError, 'localized no providers');
    assert.strictEqual(context.providerCacheSyncMessage, '');
    assert.strictEqual(context.providerCacheSyncing, false);
});

test('provider cache force refresh ignores stale in-flight loads', async () => {
    let resolveFirst;
    const firstLoad = new Promise((resolve) => {
        resolveFirst = resolve;
    });
    const calls = [];
    const methods = createProviderCacheMethods({
        api: async (action) => {
            calls.push(action);
            if (calls.length === 1) return firstLoad;
            return { root: '~/.codexmate', generatedAt: 'fresh-time', groups: [{ key: 'codex', files: [] }] };
        }
    });
    const context = {
        providerCacheRecords: {},
        providerCacheLoadedOnce: false,
        providerCacheLoadedAt: '',
        providerCacheLoading: false,
        providerCacheRequestSeq: 0,
        providerCacheError: '',
        t(key) { return key; },
        ...methods
    };

    const stalePromise = context.loadProviderCacheRecords();
    const freshPromise = context.loadProviderCacheRecords({ forceRefresh: true });
    await freshPromise;
    resolveFirst({ root: '~/.codexmate', generatedAt: 'stale-time', groups: [] });
    await stalePromise;

    assert.deepStrictEqual(calls, ['get-provider-cache-records', 'get-provider-cache-records']);
    assert.strictEqual(context.providerCacheLoadedAt, 'fresh-time');
    assert.strictEqual(context.providerCacheLoading, false);
    assert.deepStrictEqual(context.providerCacheRecords.groups, [{ key: 'codex', files: [] }]);
});

test('provider cache load fallback uses localized error text', async () => {
    const methods = createProviderCacheMethods({
        api: async () => {
            throw new Error('');
        }
    });
    const context = {
        providerCacheRecords: {},
        providerCacheLoadedOnce: false,
        providerCacheLoadedAt: '',
        providerCacheLoading: false,
        providerCacheError: '',
        showProviderCacheModal: false,
        showProviderCacheAnnouncementModal: false,
        t(key) {
            assert.strictEqual(key, 'modal.providerCache.loadFailed');
            return 'localized load failed';
        },
        ...methods
    };

    await context.loadProviderCacheRecords();

    assert.strictEqual(context.providerCacheError, 'localized load failed');
    assert.strictEqual(context.providerCacheLoading, false);
});

test('provider cache UI template renders provider cards and collapsible raw JSON', () => {
    const html = readProjectFile('web-ui/partials/index/modals-basic.html');
    const css = readBundledWebUiCss();

    assert.match(html, /provider-cache-provider-list/);
    assert.match(html, /showProviderCacheAnnouncementModal/);
    assert.match(html, /announcement\.project\.title/);
    assert.match(html, /announcement\.project\.feature\.config\.title/);
    assert.match(html, /announcement\.project\.cache\.title/);
    assert.match(html, /getProviderCacheAnnouncementSummary\(\)\.providerCount/);
    assert.match(html, /openProviderCacheDetailsFromAnnouncement/);
    assert.match(readProjectFile('web-ui/partials/index/layout-header.html'), /side-announcement-button/);
    assert.match(readProjectFile('web-ui/partials/index/layout-header.html'), /openProviderCacheAnnouncementModal/);
    assert.match(html, /syncProviderCacheRecords/);
    assert.match(html, /modal\.providerCache\.sync/);
    assert.match(readProjectFile('web-ui/partials/index/panel-settings.html'), /settings\.providerCache\.sync/);
    assert.match(readProjectFile('web-ui/app.js'), /providerCacheRequestSeq: 0/);
    assert.match(readProjectFile('web-ui/app.js'), /loadProviderCacheRecords\(\{ background: true \}\)/);
    assert.doesNotMatch(html, /v-else-if="providerCacheSyncMessage"/);
    assert.match(html, /\(provider, providerIndex\) in getProviderCacheFileProviders\(file\)/);
    assert.match(html, /getProviderCacheFileKey\(file\) \+ ':' \+ providerIndex/);
    assert.match(html, /getProviderCacheProviderMeta\(provider\)/);
    assert.match(html, /modal\.providerCache\.rawJson/);
    assert.match(html, /provider-cache-footer/);

    assert.match(css, /\.side-announcement-button/);
    assert.match(css, /\.provider-cache-announcement-modal/);
    assert.match(css, /\.project-announcement-feature-grid/);
    assert.match(css, /\.provider-cache-summary-grid/);
    assert.match(css, /\.provider-cache-body/);
    assert.match(css, /\.provider-cache-provider-list/);
    assert.match(css, /\.provider-cache-json-compact/);
    assert.match(css, /\.provider-cache-footer/);
});

test('provider cache backend avoids absolute path response and readConfig restore side effect', () => {
    const cli = readProjectFile('cli.js');
    const readConfigStart = cli.indexOf('function readConfig()');
    const readConfigEnd = cli.indexOf('function writeConfig', readConfigStart);

    assert.ok(readConfigStart >= 0, 'readConfig must exist');
    assert.ok(readConfigEnd > readConfigStart, 'writeConfig must exist after readConfig');
    const readConfigSource = cli.slice(readConfigStart, readConfigEnd);
    assert.doesNotMatch(readConfigSource, /appendMissingCachedCodexProviders/);
    assert.doesNotMatch(readConfigSource, /writeConfig\(/);
    assert.match(cli, /const PROVIDER_CACHE_MAX_FILE_BYTES = 256 \* 1024/);
    assert.match(cli, /function getProviderCacheDisplayPath\(fileName\)/);
    assert.match(cli, /function sanitizeProviderCacheErrorMessage\(message, fileName/);
    assert.match(cli, /function syncProviderCacheRecords\(\)/);
    assert.match(cli, /errorKey: 'modal\.providerCache\.noSyncableProviders'/);
    assert.doesNotMatch(cli, /没有可同步的 provider/);
    assert.match(cli, /case 'sync-provider-cache-records'/);
    assert.match(cli, /mergeProviderCacheFile\('codex-providers\.json'/);
    assert.match(cli, /mergeProviderCacheFile\('claude-providers\.json'/);
    assert.match(cli, /mergeProviderCacheFile\('opencode-providers\.json'/);
    assert.match(cli, /fs\.chmodSync\(filePath, 0o600\)/);
    assert.match(cli, /stat\.isFile\(\)/);
    assert.match(cli, /sanitizeProviderCacheErrorMessage\(e && e\.message/);
    assert.match(cli, /root: '~\/\.codexmate'/);
    assert.doesNotMatch(cli, /root: CODEXMATE_DIR/);
    assert.match(cli, /secretQueryPattern/);
    assert.match(cli, /extractProviderCacheSummaries/);
    assert.match(cli, /const authMethod = pickProviderCacheString\(provider, \['preferred_auth_method', 'authMethod', 'auth_method'\]\)/);
    assert.match(cli, /authMethod: authMethod \? redactProviderCacheValue\(authMethod\) : ''/);
    assert.doesNotMatch(cli, /'authMethod', 'auth_method', 'auth'/);
    assert.match(cli, /const redactSecretString = \(text\) => String\(text \|\| ''\) \? '\*\*\*' : ''/);
    assert.doesNotMatch(cli, /valueText\.slice\(0, 4\).*valueText\.slice\(-4\)/s);
});
