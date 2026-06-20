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
        providerCacheError: '',
        showProviderCacheModal: false,
        t(key, params = {}) {
            if (key === 'modal.providerCache.providerCount') return `${params.count} providers`;
            if (key === 'modal.providerCache.tooLarge') return 'too large';
            if (key === 'modal.providerCache.parseFailed') return 'parse failed';
            if (key === 'modal.providerCache.rawJsonOnly') return 'raw only';
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
    assert.match(html, /getProviderCacheFileProviders\(file\)/);
    assert.match(html, /getProviderCacheProviderMeta\(provider\)/);
    assert.match(html, /modal\.providerCache\.rawJson/);
    assert.match(html, /provider-cache-footer/);

    assert.match(css, /\.provider-cache-body/);
    assert.match(css, /\.provider-cache-provider-list/);
    assert.match(css, /\.provider-cache-json-compact/);
    assert.match(css, /\.provider-cache-footer/);
});

test('provider cache backend avoids absolute path response and readConfig restore side effect', () => {
    const cli = readProjectFile('cli.js');
    const readConfigStart = cli.indexOf('function readConfig()');
    const readConfigEnd = cli.indexOf('function writeConfig', readConfigStart);
    const readConfigSource = cli.slice(readConfigStart, readConfigEnd);

    assert.ok(readConfigStart >= 0, 'readConfig must exist');
    assert.doesNotMatch(readConfigSource, /appendMissingCachedCodexProviders/);
    assert.doesNotMatch(readConfigSource, /writeConfig\(/);
    assert.match(cli, /const PROVIDER_CACHE_MAX_FILE_BYTES = 256 \* 1024/);
    assert.match(cli, /function getProviderCacheDisplayPath\(fileName\)/);
    assert.match(cli, /root: '~\/\.codexmate'/);
    assert.doesNotMatch(cli, /root: CODEXMATE_DIR/);
    assert.match(cli, /secretQueryPattern/);
    assert.match(cli, /extractProviderCacheSummaries/);
});
