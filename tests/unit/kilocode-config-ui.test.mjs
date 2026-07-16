import assert from 'assert';
import { createKilocodeConfigMethods } from '../../web-ui/modules/app.methods.kilocode-config.mjs';
import { readBundledWebUiHtml, readProjectFile } from './helpers/web-ui-source.mjs';

function createVm(apiImpl = async () => ({})) {
    const methods = createKilocodeConfigMethods({ api: apiImpl });
    return {
        ...methods,
        kilocodeConfigPath: '',
        kilocodeConfigExists: false,
        kilocodeContent: '{}\n',
        kilocodeLoading: false,
        kilocodeSaving: false,
        kilocodeStarting: false,
        kilocodeError: '',
        kilocodeProviders: [{ name: 'codexmate', hasKey: true, api: 'https://old.example.com/v1', models: ['old-model'] }],
        kilocodeProvider: 'codexmate',
        kilocodeBaseUrl: 'https://new.example.com/v1',
        kilocodeModel: 'new-model',
        kilocodeApiKey: '',
        kilocodeAutoSaveSignature: '',
        messages: [],
        t(key) { return key; },
        showMessage(message, type) { this.messages.push({ message, type }); },
        isToolConfigWriteAllowed(target) { return target === 'kilocode'; }
    };
}

test('KiloCode panel auto-syncs on blur without Web UI launch buttons', () => {
    const html = readBundledWebUiHtml();
    assert.match(html, /id="kilocode-provider"[^>]*@blur="autoSaveKilocodeConfig"/);
    assert.match(html, /kilocode\.summary\.title/);
    assert.match(html, /id="kilocode-base-url"[^>]*@blur="autoSaveKilocodeConfig"/);
    assert.match(html, /id="kilocode-model"[^>]*@blur="autoSaveKilocodeConfig"/);
    assert.match(html, /id="kilocode-api-key"[^>]*@blur="autoSaveKilocodeConfig"/);
    assert.match(html, /@click="kilocodeShowKey = !kilocodeShowKey"/);
    assert.match(html, /:aria-label="kilocodeShowKey \? t\('common\.hide'\) : t\('common\.show'\)"/);
    assert.match(html, /<svg v-if="!kilocodeShowKey"/);
    assert.match(html, /<svg v-else viewBox="0 0 20 20"/);
    assert.doesNotMatch(html, /kilocodeShowKey \? t\('common\.hide'\) : t\('common\.show'\) \}\}<\/button>/);
    assert.match(html, /@dblclick="selectKilocodeProvider\(provider\)"/);
    assert.match(html, /role="button"/);
    assert.match(html, /<textarea class="template-textarea" :value="kilocodeContent" spellcheck="false" readonly aria-readonly="true"><\/textarea>/);
    assert.doesNotMatch(html, /<textarea class="template-textarea" v-model="kilocodeContent"/);
    assert.doesNotMatch(html, /@click="loadKilocodeConfig\(\{ toast: true \}\)"/);
    assert.doesNotMatch(html, /@click="saveKilocodeConfig"/);
    assert.doesNotMatch(html, /@click="startKilocode\(true\)"/);
    assert.doesNotMatch(html, /@click="startKilocode\(false\)"/);
});

test('KiloCode provider summary double-click selects and persists stored provider', async () => {
    const calls = [];
    const vm = createVm(async (action, params) => {
        calls.push({ action, params });
        return {
            targetPath: '/tmp/kilo.jsonc',
            exists: true,
            content: '{}\n',
            currentProvider: params.provider,
            currentModel: params.model,
            providers: [{ name: params.provider, hasKey: true, api: params.url, models: [params.model] }]
        };
    });
    vm.kilocodeProviders = [
        { name: 'codexmate', hasKey: true, api: 'https://old.example.com/v1', models: ['old-model'] },
        { name: 'other', hasKey: true, baseURL: 'https://other.example.com/v1', models: ['other-model'] }
    ];

    const selected = await vm.selectKilocodeProvider(vm.kilocodeProviders[1]);

    assert.strictEqual(selected, true);
    assert.strictEqual(vm.kilocodeProvider, 'other');
    assert.strictEqual(vm.kilocodeBaseUrl, 'https://other.example.com/v1');
    assert.strictEqual(vm.kilocodeModel, 'other-model');
    assert.deepStrictEqual(calls[0].params, {
        provider: 'other',
        url: 'https://other.example.com/v1',
        model: 'other-model',
        apiKey: ''
    });
});

test('KiloCode config tab reloads stored config when the tab is restored or re-entered', () => {
    const navigation = readProjectFile('web-ui/modules/app.methods.navigation.mjs');
    const loadCalls = navigation.match(/loadKilocodeConfig/g) || [];
    assert(loadCalls.length >= 4);
    assert.match(navigation, /targetTab === 'config' && this\.configMode === 'kilocode'/);
    assert.match(navigation, /pendingTarget === 'config' && this\.configMode === 'kilocode'/);
});

test('KiloCode auto-save reuses stored API key when the key field is blank', async () => {
    const calls = [];
    const vm = createVm(async (action, params) => {
        calls.push({ action, params });
        assert.strictEqual(action, 'apply-kilocode-config');
        return {
            targetPath: '/tmp/kilo.jsonc',
            exists: true,
            content: '{}\n',
            currentProvider: params.provider,
            currentModel: params.model,
            providers: [{ name: params.provider, hasKey: true, api: params.url, models: [params.model] }]
        };
    });

    const saved = await vm.autoSaveKilocodeConfig();

    assert.strictEqual(saved, true);
    assert.deepStrictEqual(calls[0].params, {
        provider: 'codexmate',
        url: 'https://new.example.com/v1',
        model: 'new-model',
        apiKey: ''
    });
    assert.strictEqual(vm.kilocodeConfigPath, '/tmp/kilo.jsonc');
    assert.strictEqual(vm.kilocodeAutoSaveSignature.includes('key:<stored>'), true);
    assert.deepStrictEqual(vm.messages.at(-1), { message: 'kilocode.autoSaved', type: 'success' });
});

test('KiloCode auto-save defaults provider and model when only URL and key are filled', async () => {
    const calls = [];
    const vm = createVm(async (action, params) => {
        calls.push({ action, params });
        assert.strictEqual(action, 'apply-kilocode-config');
        return {
            targetPath: '/tmp/kilo.jsonc',
            exists: true,
            content: '{}\n',
            currentProvider: params.provider,
            currentModel: params.model,
            providers: [{ name: params.provider, hasKey: true, api: params.url, models: [params.model] }]
        };
    });
    vm.kilocodeProvider = '';
    vm.kilocodeModel = '';
    vm.kilocodeApiKey = 'sk-test';

    const saved = await vm.autoSaveKilocodeConfig();

    assert.strictEqual(saved, true);
    assert.deepStrictEqual(calls[0].params, {
        provider: 'codexmate',
        url: 'https://new.example.com/v1',
        model: 'gpt-5.3',
        apiKey: 'sk-test'
    });
    assert.strictEqual(vm.kilocodeProvider, 'codexmate');
    assert.strictEqual(vm.kilocodeModel, 'gpt-5.3');
});

test('KiloCode backend source preserves existing API key for blank Web auto-sync', () => {
    const cli = readProjectFile('cli.js');
    assert.match(cli, /const existingKey = typeof existingOptions\.apiKey === 'string'/);
    assert.match(cli, /const key = incomingKey \|\| existingKey/);
});
