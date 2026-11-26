import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createRoutingGroups, createRoutingScheduler } = require('../../lib/routing-groups');

function fixture(t) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-routing-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const filePath = path.join(directory, 'groups.json');
    const entries = [{ name: 'alpha', secret: 'not-persisted' }, { name: 'beta' }];
    const allowed = { codex: true, claude: true };
    const options = { filePath, catalog: () => entries, assertAllowed: target => {
        if (!allowed[target]) throw new Error('write-disabled');
    } };
    const store = createRoutingGroups(options);
    const draft = { target: 'codex', name: 'Daily', strategy: 'order', members: [{ provider: 'alpha', model: 'model-a' }, { provider: 'beta', model: 'model-b' }] };
    return { store, draft, entries, allowed, filePath, options };
}
test('routing groups persist edits, ordered members and bindings without credentials', t => {
    const { store, draft, filePath, options } = fixture(t);
    let state = store.save({ ...draft, revision: store.read().revision });
    const id = state.groups[0].id;
    state = store.save({ ...draft, id, name: 'Work', strategy: 'rotate', members: [...draft.members].reverse(), revision: state.revision });
    state = store.bind({ target: 'codex', id, revision: state.revision });
    const reopened = createRoutingGroups(options);
    assert.equal(reopened.resolve('codex').members[0].name, 'beta');
    assert.equal(reopened.read().groups[0].strategy, 'rotate');
    assert.equal(reopened.resolve('claude'), null);
    assert.equal(fs.readFileSync(filePath, 'utf8').includes('not-persisted'), false);
    assert.throws(() => store.remove({ id, revision: state.revision }), { code: 'routing-in-use' });
    state = store.bind({ target: 'codex', id: '', revision: state.revision });
    state = store.remove({ id, revision: state.revision });
    assert.deepEqual(state.groups, []);
});
test('routing writes reject stale revisions, duplicate members, missing providers and disabled permissions', t => {
    const { store, draft, allowed } = fixture(t);
    const old = store.read().revision;
    const saved = store.save({ ...draft, revision: old });
    assert.throws(() => store.save({ ...draft, revision: old }), { code: 'routing-conflict' });
    assert.throws(() => store.save({ ...draft, members: [draft.members[0], draft.members[0]], revision: saved.revision }), { code: 'routing-invalid' });
    assert.throws(() => store.save({ ...draft, members: [{ provider: 'missing', model: 'm' }], revision: saved.revision }), { code: 'routing-provider-missing' });
    assert.throws(() => store.bind({ target: 'claude', id: saved.groups[0].id, revision: saved.revision }), { code: 'routing-not-found' });
    allowed.codex = false;
    assert.throws(() => store.remove({ id: saved.groups[0].id, revision: saved.revision }), /write-disabled/);
    assert.throws(() => store.bind({ target: 'codex', id: saved.groups[0].id, revision: saved.revision }), /write-disabled/);
});
test('a bound group never falls back outside its members and malformed storage fails closed', t => {
    const { store, draft, entries, filePath } = fixture(t);
    let state = store.save({ ...draft, revision: store.read().revision });
    state = store.bind({ target: 'codex', id: state.groups[0].id, revision: state.revision });
    entries.splice(0, entries.length, { name: 'unrelated' });
    assert.throws(() => store.resolve('codex'), { code: 'routing-no-upstream' });
    fs.writeFileSync(filePath, JSON.stringify({ version: 1, groups: [], bindings: { codex: 'missing', claude: '' } }));
    assert.throws(() => store.read(), { code: 'routing-corrupt' });
});
test('rotate advances per request, isolates groups and resets after membership changes', () => {
    const schedule = createRoutingScheduler();
    const members = [{ name: 'alpha', model: 'a' }, { name: 'beta', model: 'b' }];
    const group = { id: 'first', strategy: 'rotate', members };
    assert.deepEqual(schedule(group).map(member => member.name), ['alpha', 'beta']);
    assert.deepEqual(schedule(group).map(member => member.name), ['beta', 'alpha']);
    assert.equal(schedule({ ...group, id: 'second' })[0].name, 'alpha');
    assert.equal(schedule({ ...group, members: [...members].reverse() })[0].name, 'beta');
    assert.deepEqual(schedule({ ...group, strategy: 'order' }), members);
});
test('legacy version-one groups remain readable without writes and OpenAI bindings stay independent', t => {
    const { store, allowed, filePath, draft } = fixture(t);
    const legacy = JSON.stringify({ version: 1, groups: [], bindings: { codex: '', claude: '' } });
    fs.writeFileSync(filePath, legacy);
    const initial = store.read();
    assert.equal(initial.bindings['openai-chat'], ''); assert.equal(fs.readFileSync(filePath, 'utf8'), legacy);
    allowed['openai-chat'] = true;
    let state = store.save({ ...draft, target: 'openai-chat', revision: initial.revision });
    state = store.bind({ target: 'openai-chat', id: state.groups[0].id, revision: state.revision });
    assert.equal(store.resolve('openai-chat').members[0].name, 'alpha'); assert.equal(store.resolve('codex'), null); assert.equal(store.resolve('claude'), null);
    state = store.bind({ target: 'openai-chat', id: '', revision: state.revision });
    store.remove({ id: state.groups[0].id, revision: state.revision });
    assert.equal(store.read().groups.length, 0);
});
