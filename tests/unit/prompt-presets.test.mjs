import assert from 'node:assert/strict';
import { createAgentsMethods } from '../../web-ui/modules/app.methods.agents.mjs';

function createVm(overrides = {}) {
    const apiCalls = [];
    const persisted = [];
    const messages = [];
    const confirms = [];
    const methods = createAgentsMethods({
        api: async (action, params = {}) => {
            apiCalls.push({ action, params });
            if (action === 'get-claude-md-file') {
                return { content: 'loaded claude', path: '/tmp/CLAUDE.md', exists: true, lineEnding: '\n' };
            }
            if (action === 'get-agents-file') {
                return { content: 'loaded agents', path: '/tmp/AGENTS.md', exists: true, lineEnding: '\n' };
            }
            return {};
        },
        apiWithMeta: async () => ({})
    });
    const vm = {
        ...methods,
        promptPresets: [],
        selectedPromptPresetId: '',
        promptPresetNameDraft: '',
        promptPresetRenameDraft: {},
        promptPresetSaving: false,
        agentsContent: '',
        agentsOriginalContent: '',
        agentsLoading: false,
        agentsSaving: false,
        agentsDiffVisible: false,
        agentsDiffLines: [],
        agentsLineEnding: '\n',
        agentsPath: '',
        agentsExists: false,
        agentsContext: 'codex',
        promptsSubTab: 'codex',
        projectClaudeMdPath: '',
        projectPathOptions: [],
        projectPathOptionsLoading: false,
        __skipNextPromptsSubTabLoad: false,
        $nextTick: async () => {},
        t(key, params = {}) {
            const templates = {
                'prompts.presets.confirm.addCurrentMessage': 'Add current editor content as {name}',
                'prompts.presets.defaultName.project': 'Project CLAUDE.md - {path}'
            };
            return Object.entries(params || {}).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), templates[key] || key);
        },
        showMessage(message, type) {
            messages.push({ message, type });
        },
        async persistWebUiPreferences(snapshot) {
            persisted.push(snapshot);
        },
        async requestConfirmDialog(options) {
            confirms.push(options);
            return true;
        },
        loadProjectPathOptions() {},
        ...overrides
    };
    return { vm, apiCalls, persisted, messages, confirms };
}

test('prompt presets reject empty name and empty content', async () => {
    const { vm, messages, persisted } = createVm({
        promptPresetNameDraft: '   ',
        agentsContent: 'usable content'
    });

    await vm.saveCurrentPromptAsPreset();
    assert.equal(messages.at(-1).message, 'prompts.presets.error.emptyName');
    assert.deepEqual(persisted, []);

    vm.promptPresetNameDraft = 'Preset';
    vm.agentsContent = '   ';
    await vm.saveCurrentPromptAsPreset();
    assert.equal(messages.at(-1).message, 'prompts.presets.error.emptyContent');
    assert.deepEqual(persisted, []);
});

test('prompt presets save new item and overwrite duplicate only after confirmation', async () => {
    const { vm, persisted, confirms } = createVm({
        promptPresetNameDraft: 'Base',
        agentsContent: 'first'
    });

    await vm.saveCurrentPromptAsPreset();
    assert.equal(vm.promptPresets.length, 1);
    assert.equal(vm.promptPresets[0].name, 'Base');
    assert.equal(vm.promptPresets[0].content, 'first');
    assert.equal(persisted.length, 1);

    vm.promptPresetNameDraft = 'Base';
    vm.agentsContent = 'second';
    await vm.saveCurrentPromptAsPreset();
    assert.equal(confirms.length, 1);
    assert.equal(confirms[0].title, 'prompts.presets.confirm.overwriteTitle');
    assert.equal(vm.promptPresets.length, 1);
    assert.equal(vm.promptPresets[0].content, 'second');
});

test('prompt presets save current editor with md-derived default name without writing file', async () => {
    const { vm, apiCalls, persisted, confirms } = createVm({
        agentsPath: '/tmp/work/AGENTS.md',
        agentsContent: 'agents body'
    });

    await vm.saveEditorPromptAsPreset();

    assert.equal(confirms.length, 1);
    assert.equal(confirms[0].title, 'prompts.presets.confirm.addCurrentTitle');
    assert.match(confirms[0].message, /AGENTS\.md/);
    assert.equal(vm.promptPresets.length, 1);
    assert.equal(vm.promptPresets[0].name, 'AGENTS.md');
    assert.equal(vm.promptPresets[0].content, 'agents body');
    assert.equal(vm.promptPresetNameDraft, '');
    assert.deepEqual(apiCalls, []);
    assert.equal(persisted.length, 1);

    vm.promptsSubTab = 'claude-project';
    vm.projectClaudeMdPath = '/repo/project';
    vm.agentsPath = '/repo/project/CLAUDE.md';
    vm.agentsContent = 'project claude body';
    await vm.saveEditorPromptAsPreset();

    assert.equal(vm.promptPresets[0].name, 'Project CLAUDE.md - /repo/project');
    assert.equal(vm.promptPresets[0].content, 'project claude body');
    assert.deepEqual(apiCalls, []);
});

test('prompt presets surface preference persistence failures before success', async () => {
    const { vm, messages } = createVm({
        promptPresetNameDraft: 'Broken persist',
        agentsContent: 'body',
        persistWebUiPreferences: async () => { throw new Error('persist failed'); }
    });

    await assert.rejects(() => vm.saveCurrentPromptAsPreset(), /persist failed/);
    assert.notEqual(messages.at(-1)?.message, 'prompts.presets.toast.saved');
});

test('prompt presets paste into current editor draft without target switch or file write', async () => {
    const { vm, apiCalls, confirms, messages } = createVm({
        promptPresets: [{ id: 'p1', name: 'Base', content: 'preset body', updatedAt: '2026-01-01T00:00:00.000Z' }],
        promptsSubTab: 'claude-project',
        agentsOriginalContent: 'original',
        agentsContent: 'dirty'
    });

    await vm.applyPromptPresetToEditor(vm.promptPresets[0]);

    assert.equal(confirms.length, 0);
    assert.equal(vm.promptsSubTab, 'claude-project');
    assert.equal(vm.agentsContent, 'preset body');
    assert.equal(vm.agentsOriginalContent, 'original');
    assert.equal(vm.selectedPromptPresetId, 'p1');
    assert.equal(messages.at(-1).message, 'prompts.presets.toast.pasted');
    assert.deepEqual(apiCalls, []);
});

test('prompt presets prevent rename conflicts and delete after confirmation', async () => {
    const { vm, persisted, messages, confirms } = createVm({
        promptPresets: [
            { id: 'p1', name: 'One', content: 'one', updatedAt: '2026-01-01T00:00:00.000Z' },
            { id: 'p2', name: 'Two', content: 'two', updatedAt: '2026-01-02T00:00:00.000Z' }
        ],
        selectedPromptPresetId: 'p1'
    });

    vm.setPromptPresetRenameDraft('p1', 'Two');
    await vm.renamePromptPreset(vm.promptPresets[0]);
    assert.equal(messages.at(-1).message, 'prompts.presets.error.duplicateName');
    assert.equal(vm.promptPresets[0].name, 'One');

    vm.setPromptPresetRenameDraft('p1', 'Renamed');
    await vm.renamePromptPreset(vm.promptPresets[0]);
    assert.equal(vm.promptPresets[0].name, 'Renamed');
    assert.equal(messages.at(-1).message, 'prompts.presets.toast.renamed');

    await vm.deletePromptPreset(vm.promptPresets[0]);
    assert.equal(confirms.at(-1).title, 'prompts.presets.confirm.deleteTitle');
    assert.deepEqual(vm.promptPresets.map(preset => preset.id), ['p2']);
    assert.equal(vm.selectedPromptPresetId, '');
    assert.equal(messages.at(-1).message, 'prompts.presets.toast.deleted');
    assert.ok(persisted.length >= 2);
});
