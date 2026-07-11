import assert from 'assert';

import { createProvidersMethods } from '../../web-ui/modules/app.methods.providers.mjs';
import { createClaudeConfigMethods } from '../../web-ui/modules/app.methods.claude-config.mjs';
import { createStartupClaudeMethods } from '../../web-ui/modules/app.methods.startup-claude.mjs';
import {
    nextClaudeConfigName,
    nextCodexProviderName,
    nextNumericProviderName
} from '../../web-ui/modules/provider-default-names.mjs';

test('nextNumericProviderName returns the first free positive numeric name', () => {
    assert.strictEqual(nextNumericProviderName(['1', '3', 'foo', '02', 'local']), '4');
    assert.strictEqual(nextNumericProviderName([{ name: '1' }, { name: '2' }, { name: 'custom' }]), '3');
    assert.strictEqual(nextNumericProviderName(['foo', 'local']), '1');
});

test('Codex add-provider modal defaults to an auto-increment numeric provider name', () => {
    const methods = createProvidersMethods({ api: async () => ({ success: true }) });
    const context = {
        providersList: [
            { name: 'local' },
            { name: '1' },
            { name: '2' },
            { name: 'custom' }
        ],
        newProvider: { name: 'stale', url: 'https://old.example.test', key: 'sk-old', model: 'old' },
        showAddProviderKey: true,
        showAddModal: false
    };

    methods.openAddProviderModal.call(context);

    assert.strictEqual(context.showAddModal, true);
    assert.strictEqual(context.showAddProviderKey, false);
    assert.deepStrictEqual(context.newProvider, {
        name: '3',
        url: '',
        key: '',
        model: '',
        useTransform: false,
        openaiBridgeMaxRetries: 2
    });

    context.providersList.push({ name: '3' });
    methods.closeAddModal.call(context);
    assert.strictEqual(context.showAddModal, false);
    assert.strictEqual(context.newProvider.name, '4');
});

test('Claude add-config modal defaults to an auto-increment numeric config name', () => {
    const startupMethods = createStartupClaudeMethods({ api: async () => ({}) });
    const claudeMethods = createClaudeConfigMethods({ api: async () => ({}) });
    const context = {
        claudeConfigs: {
            '智谱GLM': {},
            '1': {},
            '3': {},
            'custom': {}
        },
        newClaudeConfig: { name: 'stale', apiKey: 'sk-old', baseUrl: 'https://old.example.test', model: 'old' },
        showAddClaudeConfigKey: true,
        showClaudeConfigModal: false
    };

    startupMethods.openClaudeConfigModal.call(context);

    assert.strictEqual(context.showClaudeConfigModal, true);
    assert.strictEqual(context.showAddClaudeConfigKey, false);
    assert.deepStrictEqual(context.newClaudeConfig, {
        name: '2',
        apiKey: '',
        externalCredentialType: '',
        baseUrl: '',
        model: '',
        targetApi: 'responses'
    });

    context.claudeConfigs['2'] = {};
    claudeMethods.closeClaudeConfigModal.call(context);
    assert.strictEqual(context.showClaudeConfigModal, false);
    assert.strictEqual(context.newClaudeConfig.name, '4');
});

test('clone provider/config modals keep manual naming instead of auto-numbering', () => {
    const codexMethods = createProvidersMethods({ api: async () => ({ success: true }) });
    const claudeMethods = createClaudeConfigMethods({ api: async () => ({}) });

    const codexContext = {
        newProvider: {},
        showAddProviderKey: true,
        showAddModal: false
    };
    codexMethods.openCloneProviderModal.call(codexContext, {
        name: '1',
        url: 'https://codex.example.test/v1',
        upstreamUrl: '',
        codexmate_bridge: ''
    });
    assert.strictEqual(codexContext.showAddModal, true);
    assert.strictEqual(codexContext.newProvider.name, '');
    assert.strictEqual(codexContext.newProvider.url, 'https://codex.example.test/v1');

    const claudeContext = {
        claudeConfigs: { '1': {}, '2': {} },
        newClaudeConfig: {},
        showAddClaudeConfigKey: true,
        showClaudeConfigModal: false
    };
    claudeMethods.openCloneClaudeConfigModal.call(claudeContext, '1', {
        apiKey: 'sk-source',
        baseUrl: 'https://claude.example.test',
        model: 'claude-source',
        targetApi: 'responses'
    });
    assert.strictEqual(claudeContext.showClaudeConfigModal, true);
    assert.strictEqual(claudeContext.newClaudeConfig.name, '');
    assert.strictEqual(claudeContext.newClaudeConfig.baseUrl, 'https://claude.example.test');
});

test('provider default-name helpers read Codex provider lists and Claude config maps', () => {
    assert.strictEqual(nextCodexProviderName([{ name: '1' }, { name: '2' }]), '3');
    assert.strictEqual(nextClaudeConfigName({ '1': {}, '2': {}, named: {} }), '3');
});
