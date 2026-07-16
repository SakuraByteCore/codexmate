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
    assert.match(html, /id="kilocode-base-url"[^>]*@blur="autoSaveKilocodeConfig"/);
    assert.match(html, /id="kilocode-model"[^>]*@blur="autoSaveKilocodeConfig"/);
    assert.match(html, /id="kilocode-api-key"[^>]*@blur="autoSaveKilocodeConfig"/);
    assert.doesNotMatch(html, /@click="loadKilocodeConfig\(\{ toast: true \}\)"/);
    assert.doesNotMatch(html, /@click="saveKilocodeConfig"/);
    assert.doesNotMatch(html, /@click="startKilocode\(true\)"/);
    assert.doesNotMatch(html, /@click="startKilocode\(false\)"/);
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

test('KiloCode backend source preserves existing API key for blank Web auto-sync', () => {
    const cli = readProjectFile('cli.js');
    assert.match(cli, /const existingKey = typeof existingOptions\.apiKey === 'string'/);
    assert.match(cli, /const key = incomingKey \|\| existingKey/);
});
