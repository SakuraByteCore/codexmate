import assert from 'assert';
import { createOpencodeConfigMethods } from '../../web-ui/modules/app.methods.opencode-config.mjs';
import { readBundledWebUiHtml, readProjectFile } from './helpers/web-ui-source.mjs';

function createVm(apiImpl = async () => ({})) {
    const methods = createOpencodeConfigMethods({
        api: apiImpl,
        modelCatalog: {
            anthropic: ['claude-4-sonnet'],
            openai: ['gpt-4.1']
        }
    });
    const vm = {
        ...methods,
        opencodeProvider: 'anthropic',
        opencodeModel: '',
        opencodeAgent: 'build',
        opencodeApiKey: '',
        opencodeProviders: [],
        opencodeAgents: [],
        opencodeLoading: false,
        opencodeSaving: false,
        opencodeApplying: false,
        opencodeContent: '{}',
        opencodeError: '',
        opencodeImportError: '',
        opencodeImportFileName: '',
        opencodeApplyToCoreAgents: true,
        opencodeAutoCompact: true,
        opencodeProviderDisabled: false,
        opencodeMaxTokens: '',
        opencodeReasoningEffort: '',
        toolConfigPermissions: { opencode: true },
        messages: [],
        showMessage(message, type) { this.messages.push({ message, type }); },
        isToolConfigWriteAllowed(target) { return this.toolConfigPermissions[target] === true; }
    };
    return vm;
}

test('opencode config panel exposes provider/model selection and import editor', () => {
    const html = readBundledWebUiHtml();
    assert.match(html, /id="side-tab-config-opencode"/);
    assert.match(html, /id="panel-config-opencode"/);
    assert.match(html, /v-model="opencodeProvider"/);
    assert.match(html, /v-model="opencodeModel"/);
    assert.match(html, /@change="handleOpencodeImportChange"/);
    assert.match(html, /v-model="opencodeContent"/);
});

test('opencode config methods parse imported JSON and reject invalid payloads', () => {
    const vm = createVm();
    const previousJson5 = globalThis.JSON5;
    globalThis.JSON5 = {
        parse: (value) => JSON.parse(value.replace(/\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'))
    };
    try {
        const ok = vm.parseOpencodeImportContent(`{
  // OpenCode supports JSONC
  "provider": {"anthropic": {"options": {"apiKey": "sk-test"}}},
  "agent": {"build": {"model": "anthropic/claude-4-sonnet"}},
}`, 'opencode.jsonc');
        assert.strictEqual(ok.fileName, 'opencode.jsonc');
        assert.match(ok.content, /"provider"/);
        assert.match(ok.content, /"agent"/);
        assert.match(ok.content, /"anthropic\/claude-4-sonnet"/);
    } finally {
        if (previousJson5 === undefined) {
            delete globalThis.JSON5;
        } else {
            globalThis.JSON5 = previousJson5;
        }
    }

    const bad = vm.parseOpencodeImportContent('["not", "object"]', 'opencode.jsonc');
    assert.match(bad.error, /must be a JSON\/JSONC object/);
});

test('opencode selection applies provider and model through guarded api action', async () => {
    const calls = [];
    const vm = createVm(async (action, params) => {
        calls.push({ action, params });
        return {
            targetPath: '/home/test/.config/opencode/opencode.jsonc',
            content: '{\n  "model": "anthropic/claude-4-sonnet",\n  "agent": {\n    "build": {\n      "model": "anthropic/claude-4-sonnet"\n    }\n  }\n}\n',
            providers: [{ name: 'anthropic', hasKey: true, apiKey: 'sk-...test', disabled: false }],
            agents: [{ name: 'build', provider: 'anthropic', model: 'claude-4-sonnet', modelRef: 'anthropic/claude-4-sonnet' }],
            currentAgent: 'build',
            currentProvider: 'anthropic',
            currentModel: 'claude-4-sonnet',
            autoCompact: true
        };
    });
    vm.opencodeProvider = 'anthropic';
    vm.opencodeModel = 'claude-4-sonnet';
    vm.opencodeApiKey = 'sk-test';
    await vm.applyOpencodeSelection();

    assert.strictEqual(calls[0].action, 'update-opencode-selection');
    assert.deepStrictEqual(calls[0].params, {
        provider: 'anthropic',
        model: 'claude-4-sonnet',
        apiKey: 'sk-test',
        agent: 'build',
        applyToCoreAgents: true,
        disabled: false,
        autoCompact: true,
        maxTokens: '',
        reasoningEffort: ''
    });
    assert.strictEqual(vm.opencodeConfigPath, '/home/test/.config/opencode/opencode.jsonc');
    assert.strictEqual(vm.opencodeApiKey, '');
    assert.strictEqual(vm.opencodeModel, 'claude-4-sonnet');
});

test('opencode backend actions are permission guarded in cli source', () => {
    const cli = readProjectFile('cli.js');
    assert.match(cli, /const OPENCODE_GLOBAL_JSONC_CONFIG_FILE = path\.join\(OPENCODE_CONFIG_DIR, 'opencode\.jsonc'\)/);
    assert.match(cli, /const OPENCODE_CONFIG_ENV_FILE = process\.env\.OPENCODE_CONFIG/);
    assert.match(cli, /const TOOL_CONFIG_PERMISSION_TARGETS = new Set\(\['codex', 'claude', 'opencode'\]\)/);
    assert.match(cli, /function applyOpencodeConfigRaw\(params = \{\}\) \{[\s\S]*assertToolConfigWriteAllowed\('opencode'\)/);
    assert.match(cli, /function updateOpencodeSelection\(params = \{\}\) \{[\s\S]*assertToolConfigWriteAllowed\('opencode'\)/);
    assert.match(cli, /case 'get-opencode-config':/);
    assert.match(cli, /case 'apply-opencode-config':/);
    assert.match(cli, /case 'update-opencode-selection':/);
    assert.match(cli, /const opencodeWriteActions = new Set\(\[/);
    assert.match(cli, /'apply-opencode-config'/);
    assert.match(cli, /'update-opencode-selection'/);
    assert.match(cli, /if \(opencodeWriteActions\.has\(name\)\) return 'opencode';/);
});


test('opencode backend source writes official config field names', () => {
    const cli = readProjectFile('cli.js');
    assert.match(cli, /config\.provider\[providerName\]/);
    assert.match(cli, /options\.apiKey/);
    assert.match(cli, /config\.agent\[name\]/);
    assert.match(cli, /model: modelRef/);
    assert.match(cli, /config\.compaction\.auto/);
    assert.doesNotMatch(cli, /config\.providers/);
    assert.doesNotMatch(cli, /config\.agents/);
    assert.doesNotMatch(cli, /config\.autoCompact/);
});
