import assert from 'node:assert/strict';
import {
    PROMPT_PATH_REFERENCE_TEMPLATE,
    buildPromptPathReferenceSentence,
    insertPromptPathReferenceText,
    buildPromptPathReferenceOptions
} from '../../web-ui/logic.prompts-path-reference.mjs';
import { createPromptsEditorMethods } from '../../web-ui/modules/app.methods.prompts-editor.mjs';

function makeT() {
    return (key, params = null) => {
        const table = {
            'prompts.pathReference.codex': 'AGENTS.md (Codex)',
            'prompts.pathReference.opencode': 'AGENTS.md (OpenCode)',
            'prompts.pathReference.claudeGlobal': 'CLAUDE.md（全局）',
            'prompts.pathReference.claudeProject': 'CLAUDE.md（当前项目）',
            'prompts.pathReference.system': '{file}（Pi System Prompt）',
            'prompts.pathReference.projectMissing': '未选择项目路径',
            'prompts.pathReference.notLoaded': '路径加载中…',
            'common.notExistsWillCreateOnSave': '不存在，保存时创建'
        };
        let raw = table[key] || key;
        if (params) {
            raw = raw.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ''));
        }
        return raw;
    };
}

const PATHS = {
    codex: { path: '/home/u/.codex/AGENTS.md', exists: true },
    opencode: { path: '/home/u/.config/opencode/AGENTS.md', exists: true },
    claudeGlobal: { path: '/home/u/.claude/CLAUDE.md', exists: true },
    claudeProject: { path: '/proj/CLAUDE.md', exists: true },
    system: { path: '/home/u/.pi/agent/SYSTEM.md', exists: true }
};

test('sentence template is the fixed English contract with backticked path', () => {
    assert.equal(PROMPT_PATH_REFERENCE_TEMPLATE, 'Always follow the rules defined in `{path}`.');
    assert.equal(
        buildPromptPathReferenceSentence('/home/u/.codex/AGENTS.md'),
        'Always follow the rules defined in `/home/u/.codex/AGENTS.md`.'
    );
    assert.equal(buildPromptPathReferenceSentence('  '), '');
    assert.equal(buildPromptPathReferenceSentence(null), '');
    assert.equal(buildPromptPathReferenceSentence(42), '');
});

test('insertPromptPathReferenceText splices at head, middle, selection and clamps', () => {
    const text = 'X';
    const head = insertPromptPathReferenceText('ab', 0, 0, text);
    assert.deepEqual(head, { content: 'Xab', caret: 1 });

    const mid = insertPromptPathReferenceText('ab', 1, 1, text);
    assert.deepEqual(mid, { content: 'aXb', caret: 2 });

    const selection = insertPromptPathReferenceText('aZZb', 1, 3, text);
    assert.deepEqual(selection, { content: 'aXb', caret: 2 });

    const clamped = insertPromptPathReferenceText('ab', 99, 99, text);
    assert.deepEqual(clamped, { content: 'abX', caret: 3 });

    const invalid = insertPromptPathReferenceText('ab', 'nope', undefined, text);
    assert.deepEqual(invalid, { content: 'abX', caret: 3 });

    const empty = insertPromptPathReferenceText(null, 0, 0, text);
    assert.deepEqual(empty, { content: 'X', caret: 1 });
});

test('options exclude the current tab and keep entry order', () => {
    const idsFor = (tab) => buildPromptPathReferenceOptions({ currentTab: tab, paths: PATHS, t: makeT() }).map((o) => o.id);
    assert.deepEqual(idsFor('codex'), ['opencode', 'claudeGlobal', 'claudeProject', 'system']);
    assert.deepEqual(idsFor('opencode'), ['codex', 'claudeGlobal', 'claudeProject', 'system']);
    assert.deepEqual(idsFor('claude-project'), ['codex', 'opencode', 'claudeGlobal', 'system']);
    assert.deepEqual(idsFor('system'), ['codex', 'opencode', 'claudeGlobal', 'claudeProject']);
    assert.deepEqual(idsFor('unknown-tab'), idsFor('codex'));
    assert.deepEqual(idsFor(undefined), idsFor('codex'));
});

test('options mark not-exists, missing project path and load errors', () => {
    const options = buildPromptPathReferenceOptions({
        currentTab: 'system',
        paths: {
            ...PATHS,
            claudeGlobal: { path: '/home/u/.claude/CLAUDE.md', exists: false },
            claudeProject: { path: '', exists: false, error: '' },
            opencode: { path: '', exists: false, error: '目标目录不存在' }
        },
        t: makeT()
    });
    const byId = Object.fromEntries(options.map((opt) => [opt.id, opt]));

    assert.ok(byId.claudeGlobal.label.includes('不存在，保存时创建'), 'suffix for exists=false');
    assert.equal(byId.claudeGlobal.disabled, false);

    assert.equal(byId.claudeProject.disabled, true);
    assert.equal(byId.claudeProject.disabledReason, '未选择项目路径');

    assert.equal(byId.opencode.disabled, true);
    assert.equal(byId.opencode.disabledReason, '目标目录不存在');

    const partial = buildPromptPathReferenceOptions({
        currentTab: 'codex',
        paths: { codex: PATHS.codex },
        t: makeT()
    });
    const partialById = Object.fromEntries(partial.map((opt) => [opt.id, opt]));
    assert.equal(partialById.opencode.disabled, true);
    assert.equal(partialById.opencode.disabledReason, '路径加载中…');
    assert.equal(partial.length, 4);
});

test('options render the system entry with the current mode file name', () => {
    const options = buildPromptPathReferenceOptions({
        currentTab: 'codex',
        paths: PATHS,
        t: makeT(),
        systemFile: 'APPEND_SYSTEM.md'
    });
    const systemOption = options.find((opt) => opt.id === 'system');
    assert.equal(systemOption.label, 'APPEND_SYSTEM.md（Pi System Prompt）');

    const defaults = buildPromptPathReferenceOptions({ currentTab: 'codex', paths: PATHS, t: makeT() });
    assert.equal(defaults.find((opt) => opt.id === 'system').label, 'SYSTEM.md（Pi System Prompt）');
});

function createPathRefVm(overrides = {}) {
    const apiCalls = [];
    const messages = [];
    const api = async (action, params = {}) => {
        apiCalls.push({ action, params });
        if (action === 'get-agents-file') return { path: '/home/u/.codex/AGENTS.md', exists: true, content: '', lineEnding: '\n' };
        if (action === 'get-opencode-agents-file') return { path: '/home/u/.config/opencode/AGENTS.md', exists: true, content: '', lineEnding: '\n' };
        if (action === 'get-claude-md-file') {
            return params && params.baseDir
                ? { path: '/proj/CLAUDE.md', exists: true, content: '', lineEnding: '\n' }
                : { path: '/home/u/.claude/CLAUDE.md', exists: true, content: '', lineEnding: '\n' };
        }
        if (action === 'get-system-prompt') {
            return { path: '/home/u/.pi/agent/' + (params.mode === 'append' ? 'APPEND_SYSTEM.md' : 'SYSTEM.md'), exists: true, content: '', hash: 'h' };
        }
        return {};
    };
    const methods = createPromptsEditorMethods({ api });
    const textareaState = { selectionStart: 2, selectionEnd: 2, focusCalled: 0 };
    const vm = {
        ...methods,
        promptsSubTab: 'system',
        projectClaudeMdPath: '',
        sysPromptScope: 'global',
        sysPromptMode: 'system',
        promptsPathReferencePaths: {},
        promptsPathReferenceLoading: false,
        promptsPathReferenceCacheKey: '',
        sysPromptContent: 'hello world',
        sysPromptLoading: false,
        sysPromptSaving: false,
        sysPromptDiffVisible: false,
        sysPromptPreviewHtml: '',
        sysChangeAxis: { mode: 'edit', ticks: [], truncated: false, totalLines: 0, added: 0, removed: 0 },
        promptsPreviewEnabled: false,
        $refs: {
            promptsSysTextarea: {
                selectionStart: textareaState.selectionStart,
                selectionEnd: textareaState.selectionEnd,
                setSelectionRange(start, end) {
                    textareaState.selectionStart = start;
                    textareaState.selectionEnd = end;
                },
                focus() {
                    textareaState.focusCalled += 1;
                }
            }
        },
        $nextTick(fn) {
            fn();
        },
        t(key, params = null) {
            return makeT()(key, params);
        },
        showMessage(message, type) {
            messages.push({ message, type });
        },
        ...overrides
    };
    return { vm, apiCalls, messages, textareaState };
}

test('loadPromptsPathReferences fetches all five entries once per cache key', async () => {
    const { vm, apiCalls } = createPathRefVm();
    await vm.loadPromptsPathReferences();
    assert.equal(apiCalls.length, 4, 'no project path -> claudeProject entry skipped, 4 rpc calls');
    assert.deepEqual(
        apiCalls.map((call) => call.action),
        ['get-agents-file', 'get-opencode-agents-file', 'get-claude-md-file', 'get-system-prompt']
    );
    assert.ok(apiCalls.every((call) => call.action !== 'get-system-prompt' || (call.params.scope === 'global' && call.params.mode === 'system')));
    assert.equal(vm.promptsPathReferencePaths.codex.path, '/home/u/.codex/AGENTS.md');
    assert.equal(vm.promptsPathReferencePaths.claudeProject.path, '');
    assert.equal(vm.promptsPathReferencePaths.system.path, '/home/u/.pi/agent/SYSTEM.md');
    assert.equal(vm.promptsPathReferenceLoading, false);

    await vm.loadPromptsPathReferences();
    assert.equal(apiCalls.length, 4, 'same key -> cached, no extra calls');

    vm.projectClaudeMdPath = '/proj';
    await vm.loadPromptsPathReferences();
    assert.equal(apiCalls.length, 9, 'new key -> refetch, claudeProject now resolved');
    assert.equal(vm.promptsPathReferencePaths.claudeProject.path, '/proj/CLAUDE.md');
});

test('insertPromptPathReference splices the sentence at the caret and resets the select', async () => {
    const { vm, textareaState } = createPathRefVm();
    await vm.loadPromptsPathReferences();

    const selectValue = { value: 'codex' };
    vm.insertPromptPathReference('codex', 'sys', { target: selectValue });
    assert.equal(selectValue.value, '', 'select reset to placeholder');
    assert.equal(
        vm.sysPromptContent,
        'heAlways follow the rules defined in `/home/u/.codex/AGENTS.md`.llo world'
    );
    assert.equal(textareaState.selectionStart, 2 + 'Always follow the rules defined in `/home/u/.codex/AGENTS.md`.'.length);
    assert.ok(textareaState.focusCalled >= 1);
});

test('insertPromptPathReference guards loading, saving, diff and unknown ids', async () => {
    const { vm, messages } = createPathRefVm();
    await vm.loadPromptsPathReferences();
    const before = vm.sysPromptContent;

    vm.sysPromptSaving = true;
    vm.insertPromptPathReference('codex', 'sys', { target: { value: 'codex' } });
    assert.equal(vm.sysPromptContent, before, 'saving guard blocks insert');

    vm.sysPromptSaving = false;
    vm.sysPromptDiffVisible = true;
    vm.insertPromptPathReference('codex', 'sys', { target: { value: 'codex' } });
    assert.equal(vm.sysPromptContent, before, 'diff guard blocks insert');

    vm.sysPromptDiffVisible = false;
    vm.insertPromptPathReference('nope', 'sys', { target: { value: 'nope' } });
    assert.equal(vm.sysPromptContent, before, 'unknown id is a no-op');
    assert.equal(messages.length, 0, 'no toast for guarded/no-op inserts');
});

test('insert works for the agents editor meta as well', async () => {
    const { vm } = createPathRefVm({
        promptsSubTab: 'codex',
        agentsContent: 'abc',
        agentsLoading: false,
        agentsSaving: false,
        agentsDiffVisible: false,
        agentsPreviewHtml: '',
        agentsChangeAxis: { mode: 'edit', ticks: [], truncated: false, totalLines: 0, added: 0, removed: 0 },
        $refs: {
            promptsAgentsTextarea: {
                selectionStart: 3,
                selectionEnd: 3,
                setSelectionRange() {},
                focus() {}
            }
        }
    });
    await vm.loadPromptsPathReferences();
    vm.insertPromptPathReference('system', 'agents', { target: { value: 'system' } });
    assert.equal(
        vm.agentsContent,
        'abcAlways follow the rules defined in `/home/u/.pi/agent/SYSTEM.md`.'
    );
    const optionIds = vm.promptsPathReferenceOptionList().map((opt) => opt.id);
    assert.deepEqual(optionIds, ['opencode', 'claudeGlobal', 'claudeProject', 'system'], 'codex tab excludes its own entry');
});
