import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { createProvidersMethods } from '../../web-ui/modules/app.methods.providers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { createI18nMethods } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'i18n.mjs'))
);

function createContext(overrides = {}, apiImpl = async () => ({ success: true })) {
    const messages = [];
    const loadAllCalls = [];
    const methods = createProvidersMethods({ api: apiImpl });
    const context = {
        ...createI18nMethods(),
        lang: 'zh',
        providersList: [],
        codexAuthProfiles: [],
        showAddModal: true,
        showEditModal: false,
        resetConfigLoading: false,
        newProvider: { name: '', url: '', key: '', model: '', useTransform: false },
        editingProvider: { name: '', url: '', key: '', readOnly: false, nonEditable: false },
        claudeConfigs: {},
        showMessage(text, type) {
            messages.push({ text: String(text), type: type || 'info' });
        },
        async loadAll() {
            loadAllCalls.push('loadAll');
        },
        ...methods,
        ...overrides
    };
    return { context, messages, loadAllCalls };
}

test('provider validation rejects invalid add-provider fields before submit', async () => {
    const apiCalls = [];
    const { context, messages } = createContext({
        newProvider: {
            name: 'bad name',
            url: 'not-a-url',
            key: '',
            model: ''
        }
    }, async (action, params) => {
        apiCalls.push({ action, params });
        return { success: true };
    });

    assert.strictEqual(context.canSubmitProvider('add'), false);
    assert.strictEqual(context.providerFieldError('add', 'name'), '名称仅支持字母/数字/._-');
    assert.strictEqual(context.providerFieldError('add', 'url'), 'URL 仅支持 http/https');
    assert.strictEqual(context.providerFieldError('add', 'key'), 'API Key 必填');
    assert.strictEqual(context.providerFieldError('add', 'model'), '模型名称必填');

    await context.addProvider();

    assert.deepStrictEqual(apiCalls, []);
    assert.strictEqual(messages.length, 1);
    assert.deepStrictEqual(messages[0], {
        text: '名称仅支持字母/数字/._-',
        type: 'error'
    });
});

test('addProvider normalizes trimmed values and submits sanitized payload', async () => {
    const apiCalls = [];
    const { context, messages, loadAllCalls } = createContext({
        providersList: [{ name: 'alpha', url: 'https://alpha.example.com/v1', hasKey: true }],
        newProvider: {
            name: '  beta.provider  ',
            url: ' https://api.example.com/v1/ ',
            key: ' sk-live ',
            model: ' gpt-e2e '
        }
    }, async (action, params) => {
        apiCalls.push({ action, params });
        return { success: true };
    });

    await context.addProvider();

    assert.deepStrictEqual(apiCalls, [{
        action: 'add-provider',
        params: {
            name: 'beta.provider',
            url: 'https://api.example.com/v1',
            key: 'sk-live',
            model: 'gpt-e2e'
        }
    }]);
    assert.strictEqual(context.showAddModal, false);
    assert.deepStrictEqual(context.newProvider, { name: '', url: '', key: '', model: '', useTransform: false });
    // c3c9ee5：增删改不再触发 loadAll，改为本地 providersList 增量更新。
    assert.deepStrictEqual(loadAllCalls, []);
    assert.ok(
        context.providersList.some((p) => p && p.name === 'beta.provider' && p.url === 'https://api.example.com/v1'),
        'new provider should be appended to providersList locally'
    );
    assert.deepStrictEqual(context.currentModels, { 'beta.provider': 'gpt-e2e' });
    const appendedProvider = context.providersList.find((p) => p && p.name === 'beta.provider');
    assert.deepStrictEqual(appendedProvider.models.map((item) => item.id), ['gpt-e2e']);
    assert.strictEqual(messages.length, 1);
    assert.deepStrictEqual(messages[0], {
        text: '操作成功',
        type: 'success'
    });
});

test('provider validation requires API key and model when adding provider', async () => {
    const apiCalls = [];
    const { context, messages } = createContext({
        newProvider: {
            name: 'beta',
            url: 'https://api.example.com/v1',
            key: '   ',
            model: '   '
        }
    }, async (action, params) => {
        apiCalls.push({ action, params });
        return { success: true };
    });

    assert.strictEqual(context.canSubmitProvider('add'), false);
    assert.strictEqual(context.providerFieldError('add', 'model'), '模型名称必填');

    await context.addProvider();

    assert.deepStrictEqual(apiCalls, []);
    assert.deepStrictEqual(messages[0], {
        text: 'API Key 必填',
        type: 'error'
    });
});

test('updateProvider blocks invalid edit URL and skips api call', async () => {
    const apiCalls = [];
    const { context, messages } = createContext({
        editingProvider: {
            name: 'alpha',
            url: 'ftp://api.example.com',
            key: 'sk-test',
            readOnly: false,
            nonEditable: false
        }
    }, async (action, params) => {
        apiCalls.push({ action, params });
        return { success: true };
    });

    assert.strictEqual(context.canSubmitProvider('edit'), false);
    assert.strictEqual(context.providerFieldError('edit', 'url'), 'URL 仅支持 http/https');

    await context.updateProvider();

    assert.deepStrictEqual(apiCalls, []);
    assert.strictEqual(messages.length, 1);
    assert.deepStrictEqual(messages[0], {
        text: 'URL 仅支持 http/https',
        type: 'error'
    });
});



test('provider validation rejects reserved proxy name on add', () => {
    const { context } = createContext({
        newProvider: {
            name: 'codexmate-proxy',
            url: 'https://api.example.com/v1',
            key: 'sk-test',
            model: 'gpt-e2e'
        }
    });

    assert.strictEqual(context.providerFieldError('add', 'name'), 'codexmate-proxy 为保留名称，不可手动添加');
    assert.strictEqual(context.canSubmitProvider('add'), false);
});
