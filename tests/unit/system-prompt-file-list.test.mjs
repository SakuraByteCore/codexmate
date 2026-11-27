import assert from 'node:assert/strict';
import test from 'node:test';
import { createSystemPromptMethods } from '../../web-ui/modules/app.methods.system-prompt.mjs';
import { createAgentsMethods } from '../../web-ui/modules/app.methods.agents.mjs';

function context(api) {
    return Object.assign({
        sysPromptScope: 'global', sysPromptMode: 'system', sysPromptFileName: '',
        sysPromptFiles: [], sysPromptFilesLoading: false, sysPromptFilesError: '',
        sysPromptFileMissing: false, sysPromptLoading: false, sysPromptSaving: false,
        sysPromptContent: 'original', sysPromptOriginalContent: 'original', sysPromptHash: 'hash',
        messages: [], downloads: [], t: key => key,
        showMessage(message) { this.messages.push(message); },
        downloadTextFile(...args) { this.downloads.push(args); }
    }, createSystemPromptMethods({ api, apiWithMeta: api }));
}

const files = names => ({ files: names.map(filename => ({ filename, exists: true, path: '/pi/' + filename })) });

test('Pi list refresh discovers additions without replacing dirty editor content', async () => {
    let names = ['SYSTEM.md'];
    const vm = context(async action => { assert.equal(action, 'list-system-prompt-files'); return files(names); });
    vm.sysPromptContent = 'unsaved';
    await vm.loadSystemPromptFiles();
    names = ['SYSTEM.md', 'new.md'];
    await vm.loadSystemPromptFiles();
    assert.deepEqual(vm.sysPromptFiles.map(file => file.filename), names);
    assert.equal(vm.sysPromptContent, 'unsaved');
    assert.equal(vm.sysPromptOriginalContent, 'original');
    assert.equal(vm.sysPromptFilesLoading, false);
});

test('Pi file selection blocks dirty changes and preserves the native select value', () => {
    const vm = context(async () => ({}));
    vm.sysPromptFiles = files(['SYSTEM.md', 'extra.md']).files;
    vm.sysPromptContent = 'unsaved';
    const event = { target: { value: 'extra.md' } };
    vm.switchSysPromptFileName('extra.md', event);
    assert.equal(vm.currentSysPromptFileName(), 'SYSTEM.md');
    assert.equal(event.target.value, 'SYSTEM.md');
    assert.equal(vm.sysPromptContent, 'unsaved');
    assert.deepEqual(vm.messages, ['sysPrompt.fileUnsaved']);
    vm.switchSysPromptScope('project');
    assert.equal(vm.sysPromptScope, 'global');
});

test('Pi file read diff save and export carry the same selected filename', async () => {
    const calls = [];
    const vm = context(async (action, params) => {
        calls.push({ action, params });
        if (action === 'preview-system-prompt-diff') return { diff: {
            lines: [{ type: 'add', value: 'updated' }], stats: { added: 1, removed: 0, unchanged: 0 }, hasChanges: true
        } };
        return { filename: params.fileName, path: '/pi/extra.md', exists: true, content: 'original', hash: 'hash', historyBucket: 'extra' };
    });
    vm.sysPromptFileName = 'extra.md';
    await vm.loadSystemPrompt();
    assert.equal(vm.isSysPromptCustomFile(), true);
    vm.sysPromptContent = 'updated';
    const originalFingerprint = vm.buildSysPromptDiffFingerprint();
    await vm.applySystemPrompt();
    assert.equal(calls.at(-1).action, 'preview-system-prompt-diff');
    assert.ok(!calls.some(call => call.action === 'apply-system-prompt'));
    await vm.applySystemPrompt();
    const save = calls.find(call => call.action === 'apply-system-prompt');
    assert.equal(save.params.content, 'updated');
    assert.equal(save.params.baseHash, 'hash');
    assert.ok(calls.every(call => call.params.fileName === 'extra.md'));
    vm.exportSysPromptContent();
    assert.equal(vm.downloads[0][0], 'extra.md');
    vm.sysPromptFileName = 'other.md';
    assert.notEqual(vm.buildSysPromptDiffFingerprint(), originalFingerprint);
});

test('Pi stale content and list responses cannot replace a new file or scope', async () => {
    const requests = [];
    const vm = context((action, params) => new Promise(resolve => requests.push({ action, params, resolve })));
    vm.sysPromptFileName = 'one.md';
    const first = vm.loadSystemPrompt();
    vm.sysPromptFileName = 'two.md';
    const second = vm.loadSystemPrompt();
    requests[1].resolve({ exists: true, filename: 'two.md', content: 'two', historyBucket: 'two' });
    await second;
    requests[0].resolve({ exists: true, filename: 'one.md', content: 'one' });
    await first;
    assert.equal(vm.sysPromptContent, 'two');
    assert.equal(vm.sysHistoryBucket, 'two');
    const pending = vm.loadSystemPromptFiles();
    vm.sysPromptScope = 'project';
    requests[2].resolve(files(['global.md']));
    await pending;
    assert.deepEqual(vm.sysPromptFiles, []);
    assert.equal(vm.sysPromptFilesLoading, false);
});

test('Pi deleted file remains selected with draft preserved and save disabled', async () => {
    let writes = 0;
    const vm = context(async action => { if (action === 'apply-system-prompt') writes++; return files(['SYSTEM.md']); });
    vm.sysPromptFileName = 'deleted.md';
    vm.sysPromptContent = 'unsaved';
    await vm.loadSystemPromptFiles();
    await vm.applySystemPrompt();
    assert.equal(vm.currentSysPromptFileName(), 'deleted.md');
    assert.equal(vm.sysPromptContent, 'unsaved');
    assert.equal(vm.sysPromptFileMissing, true);
    assert.equal(vm.sysPromptFilesError, 'sysPrompt.fileMissing');
    assert.equal(writes, 0);
});

test('Pi failed content read blocks writes until a successful reload', async () => {
    const vm = context(async () => { throw new Error('read failed'); });
    vm.sysPromptFileName = 'extra.md';
    await vm.loadSystemPrompt();
    assert.equal(vm.sysPromptContent, 'original');
    assert.equal(vm.sysPromptFileMissing, true);
    assert.equal(vm.sysPromptFilesError, 'toast.load.fail');
    assert.equal(vm.sysPromptLoading, false);
});

test('re-entering the Pi tab refreshes files without reloading an unsaved editor', async () => {
    const calls = [];
    const vm = Object.assign(context(async action => { calls.push(action); return files(['SYSTEM.md', 'new.md']); }),
        createAgentsMethods({ api: async () => ({}) }));
    vm.promptsSubTab = 'system';
    vm.sysPromptContent = 'unsaved';
    vm.loadPromptsTabContent();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(calls, ['list-system-prompt-files']);
    assert.equal(vm.sysPromptContent, 'unsaved');
});

test('successful list refresh cannot unlock a file whose content failed to load', async () => {
    const vm = context(async action => {
        if (action === 'get-system-prompt') throw new Error('unreadable');
        return files(['extra.md']);
    });
    vm.sysPromptFileName = 'extra.md';
    await vm.loadSystemPrompt();
    await vm.loadSystemPromptFiles();
    assert.equal(vm.sysPromptFileMissing, true);
    assert.equal(vm.sysPromptFilesError, 'toast.load.fail');
    assert.equal(vm.sysPromptContent, 'original');
});


test('Pi clean missing selection falls back to the first listed file and loads its content', async () => {
    const vm = context(async (action, params) => action === 'list-system-prompt-files'
        ? files(['SYSTEM.md', 'extra.md']) : { filename: params.fileName, exists: true, content: 'first file' });
    vm.sysPromptFileName = 'removed.md';
    await vm.loadSystemPromptFiles();
    assert.equal(vm.currentSysPromptFileName(), 'SYSTEM.md');
    assert.equal(vm.sysPromptContent, 'first file');
    assert.equal(vm.sysPromptMode, 'system');
});

test('Pi scope switch retains a listed filename instead of resetting to a fixed file', async () => {
    const calls = [];
    const vm = context(async (action, params) => {
        calls.push({ action, params });
        return action === 'list-system-prompt-files' ? files(['SYSTEM.md', 'extra.md'])
            : { filename: params.fileName, exists: true, content: params.scope };
    });
    vm.sysPromptFileName = 'extra.md';
    await vm.switchSysPromptScope('project');
    assert.equal(vm.currentSysPromptFileName(), 'extra.md');
    assert.equal(vm.sysPromptContent, 'project');
    await vm.switchSysPromptScope('global');
    assert.equal(vm.currentSysPromptFileName(), 'extra.md');
    assert.equal(vm.sysPromptContent, 'global');
    assert.ok(calls.filter(call => call.action === 'get-system-prompt').every(call => call.params.fileName === 'extra.md'));
});


test('concurrent Pi tab entry waits for the same list before loading a missing cached file', async () => {
    let resolveList;
    const reads = [];
    const vm = Object.assign(context((action, params) => {
        if (action === 'list-system-prompt-files') return new Promise(resolve => { resolveList = resolve; });
        reads.push(params.fileName);
        return Promise.resolve({ filename: params.fileName, exists: true, content: 'first file' });
    }), createAgentsMethods({ api: async () => ({}) }));
    vm.promptsSubTab = 'system';
    vm.sysPromptFileName = 'removed.md';
    const first = vm.loadPromptsTabContent();
    const second = vm.loadPromptsTabContent();
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(reads, []);
    resolveList(files(['SYSTEM.md']));
    await Promise.all([first, second]);
    assert.deepEqual(reads, ['SYSTEM.md']);
    assert.equal(vm.sysPromptContent, 'first file');
});
