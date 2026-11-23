import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { api, setConfigChangeHandler } from '../../web-ui/modules/api.mjs';
import { createConfigChangeMethods, configChangeMixin } from '../../web-ui/modules/app.methods.config-changes.mjs';
import { CONFIG_CHANGE_ACTIONS } from '../../web-ui/modules/config-change-actions.mjs';
import { DICT } from '../../web-ui/modules/i18n.dict.mjs';
import { readBundledWebUiHtml, readProjectFile } from './helpers/web-ui-source.mjs';

const require = createRequire(import.meta.url);
const { createConfigChanges, buildPreviewFile, PREVIEW_TTL_MS } = require('../../lib/config-changes');
const { fs: stagedFs, snapshot, stageConfigWrites } = require('../../lib/config-change-fs');
const { writeJsonAtomic } = require('../../lib/cli-file-utils');

async function fixture(fn, overrides = {}) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-changes-'));
    const file = path.join(dir, 'config.json');
    const second = path.join(dir, 'settings.json');
    const original = Buffer.from('\uFEFF{ "model": "old", "apiKey": "private-test-value", "unknown": true }\r\n');
    fs.writeFileSync(file, original, { mode: 0o640 });
    fs.chmodSync(file, 0o640);
    let allowed = true;
    let clock = 1000;
    const options = {
        journalPath: path.join(dir, 'journal.json'), now: () => clock,
        getTarget: action => action === 'save' ? 'codex' : '',
        isTarget: target => target === 'codex', isAllowed: () => allowed,
        isPathAllowed: target => target.startsWith(dir + path.sep),
        execute: (_action, params) => {
            writeJsonAtomic(file, { model: params.model || 'new', apiKey: 'private-test-value', unknown: true });
            if (params.second) stagedFs.writeFileSync(second, '{"model":"new"}');
            return { success: true };
        },
        ...overrides
    };
    const manager = createConfigChanges(options);
    try { await fn({ dir, file, second, original, manager, options, deny: () => { allowed = false; }, expire: () => { clock += PREVIEW_TTL_MS; } }); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

test('configuration preview is read-only, masks credentials, preserves unknown fields and undoes exact bytes after restart', async () => {
    await fixture(async ({ dir, file, second, original, manager, options }) => {
        const names = fs.readdirSync(dir);
        const preview = await manager.preview({ action: 'save', params: { second: true } });
        assert(!preview.error, JSON.stringify(preview));
        assert.strictEqual(preview.files.length, 2);
        assert(!JSON.stringify(preview).includes('private-test-value'));
        assert(JSON.stringify(preview).includes('unknown'));
        assert.deepStrictEqual(fs.readFileSync(file), original);
        assert.deepStrictEqual(fs.readdirSync(dir), names);
        const applied = await manager.apply({ previewId: preview.previewId });
        assert(!applied.error, JSON.stringify(applied));
        assert.strictEqual(fs.statSync(file).mode & 0o777, 0o640);
        assert.strictEqual(fs.statSync(second).mode & 0o777, 0o600);
        assert(!fs.readFileSync(options.journalPath, 'utf8').includes('private-test-value'));
        const restarted = createConfigChanges(options);
        assert.strictEqual(restarted.last({ target: 'codex' }).change.id, applied.change.id);
        const undone = await restarted.undo({ target: 'codex', changeId: applied.change.id });
        assert(!undone.error, JSON.stringify(undone));
        assert.deepStrictEqual(fs.readFileSync(file), original);
        assert.strictEqual(fs.statSync(file).mode & 0o777, 0o640);
        assert.strictEqual(fs.existsSync(second), false);
        assert.strictEqual(restarted.last({ target: 'codex' }).change, null);
        assert.strictEqual((await manager.apply({ previewId: preview.previewId })).errorCode, 'config-change-expired');
    });
});

test('preview also detects external edits made after the editor loaded', async () => {
    await fixture(async ({ file, manager }) => {
        const baseline = [{ path: file, ...snapshot(file) }];
        fs.writeFileSync(file, '{"model":"external"}');
        const preview = await manager.preview({ action: 'save', baseline });
        assert.strictEqual(preview.errorCode, 'config-change-conflict');
        assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"model":"external"}');
    });
});

test('apply blocks changed content, changed mode and an externally created file without overwriting', async () => {
    for (const mutation of ['content', 'mode', 'create']) await fixture(async ({ file, second, manager }) => {
        const preview = await manager.preview({ action: 'save', params: { second: true } });
        if (mutation === 'content') fs.writeFileSync(file, '{"model":"external"}');
        if (mutation === 'mode') fs.chmodSync(file, 0o600);
        if (mutation === 'create') fs.writeFileSync(second, '{"model":"external"}');
        const expected = fs.readFileSync(file);
        const result = await manager.apply({ previewId: preview.previewId });
        assert.strictEqual(result.errorCode, 'config-change-conflict', mutation);
        assert.deepStrictEqual(fs.readFileSync(file), expected);
    });
});

test('apply enforces expiry and permission again; malformed actions fail closed', async () => {
    await fixture(async ({ manager, deny, original, file }) => {
        const preview = await manager.preview({ action: 'save' });
        deny();
        assert.strictEqual((await manager.apply({ previewId: preview.previewId })).errorCode, 'tool-config-write-disabled');
        assert.deepStrictEqual(fs.readFileSync(file), original);
        assert.strictEqual((await manager.preview({ action: 'constructor' })).errorCode, 'config-change-unsupported');
    });
    await fixture(async ({ manager, expire }) => {
        const preview = await manager.preview({ action: 'save' });
        expire();
        assert.strictEqual((await manager.apply({ previewId: preview.previewId })).errorCode, 'config-change-expired');
    });
});

test('multi-file write failure rolls back all prior writes and leaves no undo record', async () => {
    await fixture(async ({ manager, file, second, original }) => {
        const preview = await manager.preview({ action: 'save', params: { second: true } });
        const nativeWrite = fs.writeFileSync;
        fs.writeFileSync = (target, ...args) => {
            if (String(target).startsWith(second + '.tmp-')) throw new Error('injected second write failure');
            return nativeWrite(target, ...args);
        };
        let result;
        try { result = await manager.apply({ previewId: preview.previewId }); }
        finally { fs.writeFileSync = nativeWrite; }
        assert.strictEqual(result.errorCode, 'config-change-write-failed');
        assert.strictEqual(result.rolledBack, true);
        assert.deepStrictEqual(fs.readFileSync(file), original);
        assert.strictEqual(fs.existsSync(second), false);
        assert.strictEqual(manager.last({ target: 'codex' }).change, null);
    });
});

test('undo rejects external modifications and corrupt backups before restoring any file', async () => {
    for (const corruption of ['external', 'backup']) await fixture(async ({ file, manager, options }) => {
        const preview = await manager.preview({ action: 'save' });
        const applied = await manager.apply({ previewId: preview.previewId });
        if (corruption === 'external') fs.writeFileSync(file, '{"model":"external"}');
        else {
            const record = JSON.parse(fs.readFileSync(options.journalPath, 'utf8'));
            fs.writeFileSync(record.changes.codex.files[0].backupPath, 'corrupt backup');
        }
        const expected = fs.readFileSync(file);
        const result = await manager.undo({ target: 'codex', changeId: applied.change.id });
        assert(result.error, corruption);
        assert.deepStrictEqual(fs.readFileSync(file), expected);
        assert.strictEqual(manager.last({ target: 'codex' }).change.id, applied.change.id);
    });
});

test('journal failure rolls configuration back and runtime failure preserves old configuration', async () => {
    await fixture(async ({ manager, file, original, options }) => {
        const preview = await manager.preview({ action: 'save' });
        const nativeWrite = fs.writeFileSync;
        fs.writeFileSync = (target, ...args) => {
            if (String(target).startsWith(options.journalPath + '.tmp-')) throw new Error('journal failure');
            return nativeWrite(target, ...args);
        };
        try {
            const result = await manager.apply({ previewId: preview.previewId });
            assert(result.error);
            assert.strictEqual(result.rolledBack, true);
        } finally { fs.writeFileSync = nativeWrite; }
        assert.deepStrictEqual(fs.readFileSync(file), original);
    });
    const calls = [];
    await fixture(async ({ manager, original, file }) => {
        const preview = await manager.preview({ action: 'save' });
        const result = await manager.apply({ previewId: preview.previewId });
        assert(result.error);
        assert.deepStrictEqual(fs.readFileSync(file), original);
        assert.deepStrictEqual(calls, [false, true]);
    }, { reconcileRuntime: async (_plan, rollback) => { calls.push(rollback); if (!rollback) throw new Error('runtime failure'); } });
});

test('staged concurrent readers are isolated and unsupported mutation cannot reach disk', async () => {
    await fixture(async ({ file, original }) => {
        const results = await Promise.all(['a', 'b'].map(model => stageConfigWrites(async () => {
            stagedFs.writeFileSync(file, JSON.stringify({ model }));
            await Promise.resolve();
            return JSON.parse(stagedFs.readFileSync(file, 'utf8')).model;
        })));
        assert.deepStrictEqual(results.map(item => item.result), ['a', 'b']);
        assert.deepStrictEqual(fs.readFileSync(file), original);
        await assert.rejects(() => stageConfigWrites(() => stagedFs.appendFileSync(file, 'bad')), /不支持/);
        assert.deepStrictEqual(fs.readFileSync(file), original);
    });
});

test('redaction covers TOML, JSON5, URL credentials and secret-only changes without leaking parser text', () => {
    const before = Buffer.from('{apiKey:"old-hidden",url:"https://u:p@example.com/?token=url-hidden",note:"old-hidden",count:123}');
    const after = Buffer.from('{apiKey:"new-hidden",url:"https://u:p@example.com/?token=url-hidden",note:"new-hidden",count:123}');
    const preview = buildPreviewFile({ path: '/config.json', before: { exists: true, buffer: before }, after });
    for (const secret of ['old-hidden', 'new-hidden', 'url-hidden', 'https://u:p@']) assert(!JSON.stringify(preview).includes(secret), secret);
    assert.strictEqual(preview.maskedOnly, true);
    const tomlPreview = buildPreviewFile({ path: '/config.toml', before: { exists: false, buffer: null }, after: Buffer.from('model="new"\nmodel_auto_compact_token_limit=123\n[provider]\npreferred_auth_method="hidden-toml"\n') });
    assert(!JSON.stringify(tomlPreview).includes('hidden-toml'));
    assert(JSON.stringify(tomlPreview).includes('123'));
    const invalid = buildPreviewFile({ path: '/config', before: { exists: true, buffer: Buffer.from('secret incomplete "hidden"') }, after });
    assert(invalid.hidden);
    assert(!JSON.stringify(invalid).includes('secret incomplete'));
});

function response(payload) { return { headers: { get: () => 'application/json' }, json: async () => payload }; }
function vm() {
    return { ...createConfigChangeMethods(), configMode: 'codex', configChangePreview: null, configChangeBusy: false, configChangeApplying: false,
        configChangeError: '', lastConfigChange: null, t: key => DICT.zh[key] || key, $nextTick: () => {}, messages: [],
        showMessage(text, type) { this.messages.push({ text, type }); }, isToolConfigWriteAllowed: () => true,
        requestConfirmDialog: async () => true, loadAll: async () => {} };
}
async function withFetch(fn, callback) {
    const previous = globalThis.fetch;
    globalThis.fetch = fn;
    try { await callback(); } finally { globalThis.fetch = previous; setConfigChangeHandler(null); }
}

test('UI intercepts configuration writes, cancellation keeps drafts and confirmation writes only preview id', async () => {
    const calls = [];
    const view = vm();
    await withFetch(async (_url, options) => {
        const body = JSON.parse(options.body); calls.push(body);
        if (body.action === 'preview-config-change') return response({ previewId: 'preview', hasChanges: true, files: [] });
        if (body.action === 'apply-config-change') return response({ success: true });
        return response({ change: null });
    }, async () => {
        setConfigChangeHandler((action, params) => view.requestConfigChange(action, params));
        let pending = api('apply-config-template', { template: 'draft' });
        await new Promise(resolve => setImmediate(resolve));
        assert(view.configChangePreview);
        assert.strictEqual(calls.length, 1);
        view.closeConfigChangePreview();
        assert.strictEqual((await pending).canceled, true);
        assert(!calls.some(item => item.action === 'apply-config-change'));
        pending = api('apply-config-template', { template: 'draft' });
        await new Promise(resolve => setImmediate(resolve));
        await view.confirmConfigChange();
        assert.strictEqual((await pending).success, true);
        assert.deepStrictEqual(calls.find(item => item.action === 'apply-config-change').params, { previewId: 'preview' });
        assert.strictEqual(view.configChangePreview, null);
        assert.strictEqual(view.configChangeBusy, false);
    });
});

test('UI keeps failed preview open and prevents an underlying operation from reporting success', async () => {
    const view = vm();
    await withFetch(async (_url, options) => {
        const { action } = JSON.parse(options.body);
        return response(action === 'preview-config-change' ? { previewId: 'id', hasChanges: true, files: [] } : { error: 'conflict', errorCode: 'config-change-conflict' });
    }, async () => {
        setConfigChangeHandler((action, params) => view.requestConfigChange(action, params));
        const pending = api('apply-opencode-config', { content: 'draft' });
        await new Promise(resolve => setImmediate(resolve));
        await view.confirmConfigChange();
        assert(view.configChangePreview);
        assert.match(view.configChangeError, /已变更/);
        assert.strictEqual(view.configChangeApplying, false);
        view.closeConfigChangePreview();
        assert.strictEqual((await pending).canceled, true);
    });
});

test('existing preview-off setting still writes directly and KiloCode launch never bypasses preview', async () => {
    const calls = [];
    const view = vm(); view.configTemplateDiffConfirmEnabled = false;
    await withFetch(async (_url, options) => {
        const body = JSON.parse(options.body); calls.push(body);
        if (body.action === 'preview-config-change') return response({ previewId: 'id', hasChanges: true, files: [] });
        return response({ success: true, change: null });
    }, async () => {
        setConfigChangeHandler((action, params) => view.requestConfigChange(action, params));
        const result = await api('start-kilocode', { configure: true, provider: 'demo' });
        assert(result.success);
        assert.deepStrictEqual(calls.map(item => item.action), ['preview-config-change', 'apply-config-change', 'get-last-config-change', 'start-kilocode']);
        assert.strictEqual(calls[0].params.action, 'apply-kilocode-config');
        assert.strictEqual(calls[3].params.configure, false);
        assert.strictEqual(view.configChangePreview, null);
    });
});

test('configuration action contracts, locale keys and accessible HTML are synchronized', () => {
    const source = readProjectFile('cli.js');
    const block = source.match(/const CONFIG_CHANGE_ACTIONS = Object\.freeze\(\{([\s\S]*?)\}\);/)[1];
    const entries = Object.fromEntries([...block.matchAll(/'([^']+)': '([^']+)'/g)].map(match => [match[1], match[2]]));
    assert.deepStrictEqual(entries, CONFIG_CHANGE_ACTIONS);
    const keys = Object.keys(DICT.zh).filter(key => key.startsWith('changes.'));
    for (const [lang, dictionary] of Object.entries(DICT)) for (const key of keys) {
        assert(dictionary[key], `${lang}: ${key}`);
        assert.deepStrictEqual(dictionary[key].match(/\{[^}]+\}/g), DICT.zh[key].match(/\{[^}]+\}/g), `${lang}: ${key}`);
    }
    assert.deepStrictEqual(Object.keys(configChangeMixin.data()).sort(), ['configChangeApplying', 'configChangeBusy', 'configChangeError', 'configChangePreview', 'lastConfigChange']);
    assert.strictEqual(typeof configChangeMixin.methods.requestConfigChange, 'function');
    assert.strictEqual(typeof configChangeMixin.methods.undoLastConfigChange, 'function');
    assert.match(readProjectFile('web-ui/app.js'), /mixins: \[threadHandoffMixin, configChangeMixin\]/);
    const html = readBundledWebUiHtml();
    assert.match(html, /aria-labelledby="config-change-title"/);
    assert.match(html, /@keydown="handleConfigChangeKeydown"/);
    assert.match(html, /@click="undoLastConfigChange"/);
});

test('real Vue runtime mounts configuration mixin and renders confirm/cancel without a runtime compiler', async () => {
    const { runInNewContext } = await import('vm');
    const { compile } = require('@vue/compiler-dom');
    const context = { console, setTimeout, clearTimeout };
    runInNewContext(readProjectFile('web-ui/res/vue.runtime.global.prod.js'), context);
    const Vue = context.Vue;
    const render = Function('Vue', compile(readProjectFile('web-ui/partials/index/config-changes.html'), { mode: 'function', prefixIdentifiers: true }).code)(Vue);
    const doc = { activeElement: null };
    const element = type => ({ type, text: '', children: [], props: {}, parent: null, focus() { doc.activeElement = this; } });
    const root = element('root');
    const body = element('body');
    const renderer = Vue.createRenderer({
        createElement: element, createText: text => ({ ...element('#text'), text }), createComment: text => ({ ...element('#comment'), text }),
        setText: (node, text) => { node.text = text; }, setElementText: (node, text) => { node.text = text; node.children = []; },
        patchProp: (node, key, _old, value) => { node.props[key] = value; },
        insert(node, parent, anchor = null) {
            if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1);
            const index = anchor ? parent.children.indexOf(anchor) : -1;
            parent.children.splice(index < 0 ? parent.children.length : index, 0, node); node.parent = parent;
        },
        remove(node) { if (node.parent) node.parent.children.splice(node.parent.children.indexOf(node), 1); node.parent = null; },
        parentNode: node => node.parent, nextSibling: node => node.parent && node.parent.children[node.parent.children.indexOf(node) + 1],
        querySelector: selector => selector === 'body' ? body : null
    });
    const allNodes = node => [node, ...node.children.flatMap(allNodes)];
    const oldDocument = globalThis.document;
    globalThis.document = doc;
    try {
        await withFetch(async (_url, options) => {
            const { action } = JSON.parse(options.body);
            if (action === 'preview-config-change') return response({ previewId: 'runtime-preview', hasChanges: true, files: [] });
            return response({ success: true, change: null });
        }, async () => {
            const app = renderer.createApp({ mixins: [configChangeMixin], render,
                data: () => ({ mainTab: 'config', configMode: 'codex', configTemplateDiffConfirmEnabled: true }),
                methods: { t: key => DICT.zh[key] || key, isToolConfigWriteAllowed: () => true },
                mounted() { this.installConfigChangePreview(); }, beforeUnmount() { this.uninstallConfigChangePreview(); }
            });
            const view = app.mount(root);
            const pending = api('apply-config-template', { template: 'draft' });
            await new Promise(resolve => setImmediate(resolve)); await Vue.nextTick();
            assert.strictEqual(view.configChangeBusy, true);
            assert(allNodes(body).some(node => node.props.id === 'config-change-title' && node.text === DICT.zh['changes.preview']));
            const confirm = allNodes(body).find(node => node.type === 'button' && node.text === DICT.zh['changes.apply']);
            assert(confirm && !confirm.props.disabled);
            await confirm.props.onClick();
            assert.strictEqual((await pending).success, true);
            await Vue.nextTick();
            assert.strictEqual(view.configChangePreview, null);
            assert(!allNodes(body).some(node => node.props.id === 'config-change-title'));
            app.unmount();
        });
    } finally {
        if (oldDocument === undefined) delete globalThis.document;
        else globalThis.document = oldDocument;
    }
});

test('existing readers retain large-file and symlink compatibility while previews stay bounded', async () => {
    await fixture(async ({ dir, file }) => {
        const large = ' '.repeat(4 * 1024 * 1024 + 1);
        fs.writeFileSync(file, large);
        await assert.rejects(() => stageConfigWrites(() => stagedFs.readFileSync(file)), /预览容量/);
        const read = await stageConfigWrites(() => stagedFs.readFileSync(file), { maxFileBytes: Infinity, allowSymlinks: true });
        assert.strictEqual(read.result.length, large.length);
        fs.writeFileSync(file, '{"model":"original"}');
        await assert.rejects(() => stageConfigWrites(() => stagedFs.writeFileSync(file, large)), /预览容量/);
        const link = path.join(dir, 'link.json');
        fs.symlinkSync(file, link);
        const linked = await stageConfigWrites(() => stagedFs.readFileSync(link, 'utf8'), { maxFileBytes: Infinity, allowSymlinks: true });
        assert.strictEqual(linked.result, '{"model":"original"}');
        await assert.rejects(() => stageConfigWrites(() => stagedFs.writeFileSync(link, '{}')), /普通文件/);
        assert.strictEqual(fs.readFileSync(file, 'utf8'), '{"model":"original"}');
        assert.strictEqual(fs.lstatSync(link).isSymbolicLink(), true);
    });
});
