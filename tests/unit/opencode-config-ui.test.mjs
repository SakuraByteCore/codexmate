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
        opencodeAgent: 'coder',
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
    const ok = vm.parseOpencodeImportContent('{"providers":{"anthropic":{"apiKey":"sk-test"}},"agents":{"coder":{"model":"claude-4-sonnet"}}}', '.opencode.json');
    assert.strictEqual(ok.fileName, '.opencode.json');
    assert.match(ok.content, /"providers"/);
    assert.match(ok.content, /"claude-4-sonnet"/);

    const bad = vm.parseOpencodeImportContent('["not", "object"]', '.opencode.json');
    assert.match(bad.error, /must be a JSON object/);
});

test('opencode selection applies provider and model through guarded api action', async () => {
    const calls = [];
    const vm = createVm(async (action, params) => {
        calls.push({ action, params });
        return {
            targetPath: '/home/test/.opencode.json',
            content: '{\n  "agents": {\n    "coder": {\n      "model": "claude-4-sonnet"\n    }\n  }\n}\n',
            providers: [{ name: 'anthropic', hasKey: true, apiKey: 'sk-...test', disabled: false }],
            agents: [{ name: 'coder', model: 'claude-4-sonnet' }],
            currentAgent: 'coder',
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
        agent: 'coder',
        applyToCoreAgents: true,
        disabled: false,
        autoCompact: true,
        maxTokens: '',
        reasoningEffort: ''
    });
    assert.strictEqual(vm.opencodeConfigPath, '/home/test/.opencode.json');
    assert.strictEqual(vm.opencodeApiKey, '');
    assert.strictEqual(vm.opencodeModel, 'claude-4-sonnet');
});

test('opencode backend actions are permission guarded in cli source', () => {
    const cli = readProjectFile('cli.js');
    assert.match(cli, /const OPENCODE_HOME_CONFIG_FILE = path\.join\(os\.homedir\(\), '\.opencode\.json'\)/);
    assert.match(cli, /const TOOL_CONFIG_PERMISSION_TARGETS = new Set\(\['codex', 'claude', 'opencode'\]\)/);
    assert.match(cli, /function applyOpencodeConfigRaw\(params = \{\}\) \{[\s\S]*assertToolConfigWriteAllowed\('opencode'\)/);
    assert.match(cli, /function updateOpencodeSelection\(params = \{\}\) \{[\s\S]*assertToolConfigWriteAllowed\('opencode'\)/);
    assert.match(cli, /case 'get-opencode-config':/);
    assert.match(cli, /case 'apply-opencode-config':/);
    assert.match(cli, /case 'update-opencode-selection':/);
});
