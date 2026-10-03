import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { withGlobalOverrides } from './helpers/web-ui-app-options.mjs';
import { DICT } from '../../web-ui/modules/i18n.dict.mjs';
import {
    compressTextToSingleLine,
    textTools,
    DEFAULT_TEXT_TOOL_ID
} from '../../plugins/text-tools/index.mjs';
import { loadTextToolsOverview } from '../../plugins/text-tools/overview.mjs';
import { createTextToolsMethods } from '../../plugins/text-tools/methods.mjs';
import { createTextToolsComputed } from '../../plugins/text-tools/computed.mjs';
import { createNavigationMethods } from '../../web-ui/modules/app.methods.navigation.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..', '..');
const require = createRequire(import.meta.url);

test('compressTextToSingleLine collapses newlines and whitespace (semantics B)', () => {
    assert.strictEqual(compressTextToSingleLine('hello\nworld'), 'hello world');
    assert.strictEqual(compressTextToSingleLine('a\r\nb\rc\nd'), 'a b c d');
    assert.strictEqual(compressTextToSingleLine('a    b\t\tc'), 'a b c');
    assert.strictEqual(compressTextToSingleLine('  \n  first line\n\n second line  \n'), 'first line second line');
    assert.strictEqual(compressTextToSingleLine(''), '');
    assert.strictEqual(compressTextToSingleLine('   '), '');
    assert.strictEqual(compressTextToSingleLine('单行\n\n文本  压缩\t测试'), '单行 文本 压缩 测试');
    assert.strictEqual(compressTextToSingleLine(null), '');
    assert.strictEqual(compressTextToSingleLine(undefined), '');
    assert.strictEqual(compressTextToSingleLine(123), '');
});

test('textTools tool list contract', () => {
    assert.strictEqual(DEFAULT_TEXT_TOOL_ID, 'compress');
    assert.ok(Array.isArray(textTools) && textTools.length >= 1, 'textTools must be a non-empty array');
    const compress = textTools.find((tool) => tool.id === 'compress');
    assert.ok(compress, 'compress tool must exist');
    assert.strictEqual(compress.labelKey, 'plugins.textTools.tools.compress');
    assert.strictEqual(compress.run, compressTextToSingleLine);
    for (const tool of textTools) {
        assert.strictEqual(typeof tool.id, 'string', 'tool id must be a string');
        assert.strictEqual(typeof tool.labelKey, 'string', 'tool labelKey must be a string');
        assert.strictEqual(typeof tool.run, 'function', 'tool run must be a function');
    }
});

test('loadTextToolsOverview normalizes state on the context object', async () => {
    const ctx = {};
    assert.strictEqual(await loadTextToolsOverview(ctx), true);
    assert.strictEqual(ctx.textToolsActiveToolId, 'compress');
    assert.strictEqual(ctx.textToolsInput, '');

    const ctx2 = { textToolsActiveToolId: '  compress  ', textToolsInput: 'keep me' };
    await loadTextToolsOverview(ctx2);
    assert.strictEqual(ctx2.textToolsActiveToolId, 'compress');
    assert.strictEqual(ctx2.textToolsInput, 'keep me');

    const ctx3 = { textToolsActiveToolId: 'nonexistent', textToolsInput: 42 };
    await loadTextToolsOverview(ctx3);
    assert.strictEqual(ctx3.textToolsActiveToolId, 'compress');
    assert.strictEqual(ctx3.textToolsInput, '');

    const ctx4 = null;
    assert.strictEqual(await loadTextToolsOverview(ctx4), true);
});

test('createTextToolsComputed exposes localized list and live output', () => {
    const computed = createTextToolsComputed();
    assert.strictEqual(typeof computed.textToolsList, 'function');
    assert.strictEqual(typeof computed.textToolsOutput, 'function');

    const seen = [];
    const fakeThis = {
        t: (key) => {
            seen.push(key);
            return `#${key}`;
        },
        textToolsActiveToolId: 'compress',
        textToolsInput: 'first\nsecond'
    };
    const list = computed.textToolsList.call(fakeThis);
    assert.strictEqual(list.length, textTools.length);
    assert.strictEqual(list[0].id, 'compress');
    assert.strictEqual(list[0].labelKey, 'plugins.textTools.tools.compress');
    assert.strictEqual(list[0].label, '#plugins.textTools.tools.compress');
    assert.ok(seen.includes('plugins.textTools.tools.compress'));

    assert.strictEqual(computed.textToolsOutput.call(fakeThis), 'first second');

    // invalid active tool falls back to the default tool
    const fallbackThis = { t: null, textToolsActiveToolId: 'bogus', textToolsInput: 'a\nb' };
    assert.strictEqual(computed.textToolsOutput.call(fallbackThis), 'a b');

    // non-string input is treated as empty
    const emptyThis = { t: null, textToolsActiveToolId: 'compress', textToolsInput: null };
    assert.strictEqual(computed.textToolsOutput.call(emptyThis), '');
});

test('createTextToolsMethods copyTextToolsOutput mirrors clipboard copy behavior', async () => {
    const methods = createTextToolsMethods();
    assert.strictEqual(typeof methods.copyTextToolsOutput, 'function');

    const makeContext = (output, fallback) => {
        const messages = [];
        return {
            context: {
                textToolsOutput: output,
                t: (key) => key,
                showMessage: (text, kind) => messages.push({ text, kind }),
                fallbackCopyText: fallback || (() => false)
            },
            messages
        };
    };

    const makeEnv = (secure, writeImpl) => {
        const clipboardWrites = [];
        const globals = {
            navigator: {
                clipboard: {
                    async writeText(text) {
                        if (writeImpl) return writeImpl(String(text));
                        clipboardWrites.push(String(text));
                    }
                }
            },
            window: { isSecureContext: secure }
        };
        return { globals, clipboardWrites };
    };

    // empty output -> info toast, no clipboard call
    const emptyCtx = makeContext('   ');
    const emptyEnv = makeEnv(false, () => { throw new Error('must not be called'); });
    await withGlobalOverrides(emptyEnv.globals, () => methods.copyTextToolsOutput.call(emptyCtx.context));
    assert.deepStrictEqual(emptyCtx.messages, [{ text: 'toast.copy.empty', kind: 'info' }]);
    assert.deepStrictEqual(emptyEnv.clipboardWrites, []);

    // secure-context clipboard path -> ok toast
    const okCtx = makeContext('compressed result');
    const okEnv = makeEnv(true);
    await withGlobalOverrides(okEnv.globals, () => methods.copyTextToolsOutput.call(okCtx.context));
    assert.deepStrictEqual(okEnv.clipboardWrites, ['compressed result']);
    assert.deepStrictEqual(okCtx.messages, [{ text: 'toast.copy.ok', kind: 'success' }]);

    // insecure path with fallback success -> ok toast
    const fallbackCtx = makeContext('compressed result', () => true);
    const fallbackEnv = makeEnv(false, () => { throw new Error('nope'); });
    await withGlobalOverrides(fallbackEnv.globals, () => methods.copyTextToolsOutput.call(fallbackCtx.context));
    assert.deepStrictEqual(fallbackCtx.messages, [{ text: 'toast.copy.ok', kind: 'success' }]);

    // insecure path with fallback failure -> error toast
    const failCtx = makeContext('compressed result', () => false);
    const failEnv = makeEnv(false, () => { throw new Error('nope'); });
    await withGlobalOverrides(failEnv.globals, () => methods.copyTextToolsOutput.call(failCtx.context));
    assert.deepStrictEqual(failCtx.messages, [{ text: 'toast.copy.fail', kind: 'error' }]);
});

test('panel-plugins template wires the text-tools branch', () => {
    const src = fs.readFileSync(path.join(root, 'web-ui', 'partials', 'index', 'panel-plugins.html'), 'utf8');
    assert.ok(src.includes("pluginsActiveId === 'text-tools'"), 'text-tools branch must exist');
    assert.ok(src.includes('v-model="textToolsInput"'), 'input textarea must bind textToolsInput');
    assert.ok(src.includes('@click="copyTextToolsOutput"'), 'copy button must call copyTextToolsOutput');
    assert.ok(src.includes(':value="textToolsOutput"'), 'output textarea must render textToolsOutput');
    assert.ok(src.includes('v-for="tool in textToolsList"'), 'tool bar must iterate textToolsList');
    assert.ok(src.includes("textToolsActiveToolId = tool.id"), 'tool buttons must set the active tool id');
    assert.ok(src.includes("t('plugins.textTools.title')"), 'panel title must be localized');
});

test('layout-header sidebar wires text-tools and prompt-templates plugin sub-tabs', () => {
    const src = fs.readFileSync(path.join(root, 'web-ui', 'partials', 'index', 'layout-header.html'), 'utf8');
    assert.ok(src.includes('id="side-tab-plugins-text-tools"'), 'text-tools sidebar entry must exist');
    assert.ok(src.includes('data-plugins-id="text-tools"'), 'text-tools entry must carry data-plugins-id');
    assert.ok(src.includes("onPluginsTabPointerDown('text-tools', $event)"), 'text-tools entry must bind pointerdown');
    assert.ok(src.includes("onPluginsTabClick('text-tools', $event)"), 'text-tools entry must bind click');
    assert.ok(src.includes("isPluginsIdNavActive('text-tools')"), 'text-tools entry must use per-plugin active state');
    assert.ok(src.includes("data-plugins-id=\"prompt-templates\""), 'generic plugins entry must bind prompt-templates');
    assert.ok(src.includes("onPluginsTabPointerDown('prompt-templates', $event)"), 'prompt-templates entry must bind pointerdown');
    assert.ok(src.includes("isPluginsIdNavActive('prompt-templates')"), 'prompt-templates entry must use per-plugin active state');
});

test('sidebar plugin sub-tab handlers select the plugin and persist the cached id', () => {
    const persisted = [];
    const calls = [];
    const methods = createNavigationMethods({
        configModeSet: new Set(['codex', 'claude', 'openclaw', 'opencode']),
        switchMainTabHelper(tab) { calls.push(['helper', tab]); },
        loadMoreSessionMessagesHelper() {}
    });
    const context = {
        ...methods,
        mainTab: 'sessions',
        pluginsActiveId: 'prompt-templates',
        switchMainTab(tab) { this.mainTab = tab; },
        selectPlugin(id) { calls.push(['selectPlugin', id]); this.pluginsActiveId = id; },
        persistWebUiPreferences(payload) { persisted.push(payload); },
        setSessionPanelFastHidden() {}
    };

    assert.strictEqual(context.isPluginsIdNavActive('text-tools'), false, 'inactive before interaction');
    assert.strictEqual(context.isPluginsIdNavActive('prompt-templates'), false, 'plugins tab is not current yet');

    context.onPluginsTabPointerDown('text-tools', { button: 0, pointerType: 'mouse' });

    assert.strictEqual(persisted.length, 1, 'pointerdown must persist the nav state');
    assert.strictEqual(persisted[0].navigation.mainTab, 'plugins');
    assert.strictEqual(persisted[0].navigation.pluginsActiveId, 'text-tools');
    assert.ok(calls.some(([name, arg]) => name === 'selectPlugin' && arg === 'text-tools'), 'must select text-tools');
    assert.strictEqual(context.mainTab, 'plugins', 'must switch to the plugins tab');
    assert.strictEqual(context.pluginsActiveId, 'text-tools', 'active plugin must be cached in state');
    assert.strictEqual(context.isPluginsIdNavActive('text-tools'), true, 'text-tools entry must highlight');

    const callsBeforeClick = calls.length;
    context.onPluginsTabClick('text-tools');
    assert.strictEqual(calls.length, callsBeforeClick, 'click after pointer commit must not double-switch');

    context.onPluginsTabPointerDown('prompt-templates', { button: 0, pointerType: 'mouse' });
    context.onPluginsTabClick('prompt-templates');
    assert.strictEqual(context.pluginsActiveId, 'prompt-templates', 'clicking prompt-templates entry must switch back');
    assert.strictEqual(persisted[persisted.length - 1].navigation.pluginsActiveId, 'prompt-templates');
    assert.strictEqual(context.isPluginsIdNavActive('prompt-templates'), true, 'prompt-templates entry must highlight');
    assert.strictEqual(context.isPluginsIdNavActive('text-tools'), false, 'text-tools entry must stop highlighting');
});

test('app.js exposes textTools data fields', () => {
    const src = fs.readFileSync(path.join(root, 'web-ui', 'app.js'), 'utf8');
    assert.ok(/textToolsActiveToolId:\s*''/.test(src), 'textToolsActiveToolId must default to empty string');
    assert.ok(/textToolsInput:\s*''/.test(src), 'textToolsInput must default to empty string');
});

test('plugins registry matches generator output and includes text-tools', () => {
    const generator = require(path.join(root, 'tools', 'dev', 'generate-plugins-registry.js'));
    const actual = fs.readFileSync(path.join(root, 'plugins', 'registry.mjs'), 'utf8').replace(/^\uFEFF/u, '');
    const expected = String(generator.generatePluginsRegistrySource() || '').replace(/^\uFEFF/u, '');
    assert.strictEqual(actual, expected);
    assert.ok(actual.includes("textToolsPluginMeta"), 'registry must include the text-tools entry');
});

test('text-tools ownership contract', async () => {
    const { pluginOwnership } = await import('../../plugins/text-tools/ownership.mjs');
    assert.strictEqual(pluginOwnership.pluginId, 'text-tools');
    assert.strictEqual(pluginOwnership.pluginId, path.basename(path.join(root, 'plugins', 'text-tools')));
    assert.ok(typeof pluginOwnership.createdBy === 'string' && pluginOwnership.createdBy.trim(), 'createdBy must be non-empty');
    assert.ok(Array.isArray(pluginOwnership.maintainers) && pluginOwnership.maintainers.length > 0, 'maintainers must be non-empty');
    for (const handle of pluginOwnership.maintainers) {
        assert.ok(typeof handle === 'string' && handle.trim(), 'maintainer handles must be non-empty');
    }
});

test('text-tools i18n keys exist and are non-empty in every locale', () => {
    const keys = [
        'plugins.catalog.textTools.title',
        'plugins.catalog.textTools.description',
        'plugins.textTools.title',
        'plugins.textTools.tools.aria',
        'plugins.textTools.tools.compress',
        'plugins.textTools.compress.inputLabel',
        'plugins.textTools.compress.inputPlaceholder',
        'plugins.textTools.compress.inputAria',
        'plugins.textTools.compress.outputTitle',
        'plugins.textTools.compress.outputHint',
        'plugins.textTools.compress.outputAria',
        'plugins.textTools.compress.copy'
    ];
    for (const locale of Object.keys(DICT)) {
        const dict = DICT[locale];
        for (const key of keys) {
            assert.ok(Object.prototype.hasOwnProperty.call(dict, key), `${locale} must define ${key}`);
            assert.strictEqual(typeof dict[key], 'string', `${locale}.${key} must be a string`);
            assert.ok(dict[key].length > 0, `${locale}.${key} must be non-empty`);
        }
    }
});
