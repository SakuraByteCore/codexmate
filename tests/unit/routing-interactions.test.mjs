import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutingMethods, routingMixin } from '../../web-ui/modules/routing.mjs';
import { createToolConfigPermissionMethods } from '../../web-ui/modules/app.methods.tool-config-permissions.mjs';

function fixture(respond) {
    const calls = [], messages = [];
    const group = { id: 'daily', name: 'Daily', target: 'codex', strategy: 'order', members: [{ provider: 'alpha', model: 'a' }] };
    const state = { groups: [group], bindings: { codex: '', claude: '' }, catalogs: { codex: [{ name: 'alpha', model: 'a' }, { name: 'beta', model: 'b' }], claude: [{ name: 'claude', model: '' }] }, bridges: { codex: { active: false, enabled: false }, claude: { active: false, enabled: false } }, revision: 'one' };
    const vm = { ...routingMixin.data(), ...createRoutingMethods({ request: async (action, params) => {
        calls.push({ action, params });
        return respond ? respond(action, params, state) : state;
    } }), t: (key, params = {}) => key === 'routing.defaultName' ? `${params.target} group ${params.index}` : key + (params.message ? ': ' + params.message : ''),
    isToolConfigWriteAllowed: () => true, showMessage: (...args) => messages.push(args) };
    vm.applyRoutingState(state);
    return { vm, state, group, calls, messages };
}
test('new groups prefill configured models, unique names and unused providers without network calls', () => {
    const { vm, state, calls } = fixture();
    state.groups.push({ ...state.groups[0], id: 'existing', name: 'Codex group 1' });
    vm.currentModels = { alpha: 'local-a', beta: 'local-b' };
    vm.editRoutingGroup();
    assert.equal(vm.routingDraft.name, 'Codex group 2');
    assert.deepEqual(vm.routingDraft.members, [{ provider: 'alpha', model: 'local-a' }]);
    vm.addRoutingMember();
    assert.deepEqual(vm.routingDraft.members[1], { provider: 'beta', model: 'local-b' });
    vm.cancelRoutingEdit(); vm.setRoutingTarget('claude'); vm.editRoutingGroup();
    assert.equal(vm.routingDraft.members[0].model, '', 'unknown model ids must stay blank');
    assert.equal(calls.length, 0);
});
test('invalid drafts explain missing fields and duplicates without sending writes or losing input', async () => {
    const { vm, calls, messages } = fixture();
    vm.editRoutingGroup(); vm.routingDraft.name = '';
    await vm.saveRoutingGroup(); assert.equal(vm.routingError, 'routing.nameRequired');
    vm.routingDraft.name = 'New'; vm.routingDraft.members[0].model = '';
    await vm.saveRoutingGroup(); assert.equal(vm.routingError, 'routing.memberRequired');
    vm.routingDraft.members = [{ provider: 'missing', model: 'a' }];
    await vm.saveRoutingGroup(); assert.equal(vm.routingError, 'routing.memberMissing');
    vm.routingDraft.members = [{ provider: 'alpha', model: 'a' }, { provider: 'alpha', model: 'a' }];
    await vm.saveRoutingGroup(); assert.equal(vm.routingError, 'routing.memberDuplicate');
    assert.equal(vm.routingDraft.name, 'New'); assert.equal(calls.length, 0); assert.equal(messages.length, 0);
});
test('bind and enable is serial, confirmed by a readback and only then reports success', async () => {
    const { vm, group, calls, messages } = fixture((action, params, state) => {
        if (action === 'routing-bind') { state.bindings.codex = params.id; state.revision = 'two'; return state; }
        if (action === 'local-bridge-toggle') { state.bridges.codex = { active: true, enabled: true }; return { success: true }; }
        return state;
    });
    await vm.useRoutingGroup(group);
    assert.deepEqual(calls.map(call => call.action), ['routing-bind', 'local-bridge-toggle', 'routing-get']);
    assert.equal(vm.routingBindings.codex, 'daily'); assert.equal(vm.routingBridges.codex.active, true);
    assert.equal(messages[0][0], 'routing.groupActivated'); assert.equal(vm.routingPendingGroupId, '');
});
test('activation failure retains the confirmed binding and provides recovery without retry or false success', async () => {
    const { vm, group, calls, messages } = fixture((action, params, state) => {
        if (action === 'routing-bind') { state.bindings.codex = params.id; return state; }
        return { error: 'enable failed' };
    });
    await vm.useRoutingGroup(group);
    assert.equal(vm.routingBindings.codex, 'daily'); assert.equal(vm.routingBridges.codex.active, false);
    assert.match(vm.routingError, /activationUnconfirmed: enable failed/);
    assert.deepEqual(calls.map(call => call.action), ['routing-bind', 'local-bridge-toggle']);
    assert.equal(messages.length, 0); assert.equal(vm.routingSaving, false);
});
test('a failed binding never enables the bridge', async () => {
    const { vm, group, calls, messages } = fixture(() => ({ error: 'routing-conflict' }));
    await vm.useRoutingGroup(group);
    assert.deepEqual(calls.map(call => call.action), ['routing-bind']);
    assert.equal(vm.routingError, 'routing-conflict'); assert.equal(messages.length, 0);
});
test('active bridges only switch groups and restoring the original pool does not disable the bridge', async () => {
    const { vm, state, group, calls } = fixture((action, params, snapshot) => { snapshot.bindings.codex = params.id; return snapshot; });
    state.bridges.codex.active = true;
    await vm.useRoutingGroup(group); await vm.useRoutingGroup(group);
    assert.deepEqual(calls.map(call => call.action), ['routing-bind', 'routing-bind']);
    assert.equal(calls[1].params.id, ''); assert.equal(vm.routingBridges.codex.active, true);
});
test('double clicks and target changes cannot interleave a pending activation', async () => {
    let release;
    const wait = new Promise(resolve => { release = resolve; });
    const { vm, state, group, calls } = fixture(async (action, params, snapshot) => {
        if (action === 'routing-bind') { snapshot.bindings.codex = params.id; return snapshot; }
        if (action === 'local-bridge-toggle') { await wait; snapshot.bridges.codex.active = true; return { success: true }; }
        return snapshot;
    });
    const pending = vm.useRoutingGroup(group);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(vm.routingSaving, true); assert.equal(vm.routingPendingGroupId, 'daily');
    await vm.useRoutingGroup(group); vm.setRoutingTarget('claude');
    assert.equal(vm.routingTarget, 'codex'); assert.equal(calls.length, 2);
    release(); await pending;
    assert.equal(vm.routingSaving, false); assert.equal(state.bridges.codex.active, true);
});
test('inline write access retains the existing confirmation and cancellation sends no request', async () => {
    const calls = [];
    const vm = { ...createToolConfigPermissionMethods({ api: async (...args) => calls.push(args) }),
        toolConfigPermissions: { codex: false, claude: false }, toolConfigPermissionSaving: { codex: false, claude: false },
        t: key => key, requestConfirmDialog: async () => false };
    await vm.setToolConfigPermission('codex', true);
    assert.equal(vm.toolConfigPermissions.codex, false); assert.equal(calls.length, 0);
});
test('Claude activation uses only its own binding and bridge API', async () => {
    const { vm, group, calls } = fixture((action, params, state) => {
        if (action === 'routing-bind') { state.bindings.claude = params.id; return state; }
        if (action === 'claude-local-bridge-toggle') { state.bridges.claude.active = true; return { success: true }; }
        return state;
    });
    group.target = 'claude'; group.members = [{ provider: 'claude', model: 'c' }]; vm.routingTarget = 'claude';
    await vm.useRoutingGroup(group);
    assert.deepEqual(calls.map(call => call.action), ['routing-bind', 'claude-local-bridge-toggle', 'routing-get']);
    assert.equal(calls[0].params.target, 'claude'); assert.equal(vm.routingBridges.codex.active, false);
});
test('activation readback failure never promotes an unconfirmed bridge to success', async () => {
    const { vm, group, messages, calls } = fixture((action, params, state) => {
        if (action === 'routing-bind') return { ...state, bindings: { codex: params.id, claude: '' } };
        if (action === 'local-bridge-toggle') return { success: true };
        return { error: 'reload failed' };
    });
    await vm.useRoutingGroup(group);
    assert.equal(vm.routingBindings.codex, 'daily'); assert.equal(vm.routingBridges.codex.active, false);
    assert.match(vm.routingError, /activationUnconfirmed: reload failed/);
    assert.equal(messages.length, 0); assert.equal(calls.length, 3);
});
test('editing focuses the name field only after a user opens the editor', () => {
    const { vm } = fixture();
    const actions = [];
    vm.$refs = { routingNameInput: { focus: () => actions.push('focus'), select: () => actions.push('select') } };
    vm.$nextTick = callback => callback();
    vm.editRoutingGroup();
    assert.deepEqual(actions, ['focus', 'select']);
});
test('OpenAI activation only binds its API group and uses the shared provider write permission', async () => {
    const { vm, state, group, calls } = fixture((action, params, snapshot) => {
        snapshot.bindings['openai-chat'] = params.id;
        snapshot.bridges['openai-chat'] = { active: !!params.id, enabled: !!params.id };
        return snapshot;
    });
    group.target = 'openai-chat'; vm.routingTarget = 'openai-chat'; state.bridges['openai-chat'] = { active: false, enabled: false };
    state.catalogs['openai-chat'] = state.catalogs.codex;
    const permissions = []; vm.isToolConfigWriteAllowed = target => { permissions.push(target); return target === 'codex'; };
    await vm.useRoutingGroup(group);
    assert.deepEqual(calls.map(call => call.action), ['routing-bind']); assert.equal(calls[0].params.target, 'openai-chat');
    assert.ok(permissions.every(target => target === 'codex')); assert.equal(vm.routingBridges.codex.active, false); assert.equal(vm.routingBridges.claude.active, false);
    await vm.toggleRoutingBridge(); assert.equal(vm.routingBindings['openai-chat'], '');
    assert.deepEqual(calls.map(call => call.action), ['routing-bind', 'routing-bind']);
});
test('OpenAI access fields contain only client URL and alias, never credentials', () => {
    const methods = createRoutingMethods({ origin: () => 'http://127.0.0.1:3344' });
    const vm = { ...routingMixin.data(), ...methods }; vm.routingTarget = 'openai-chat';
    assert.equal(vm.routingTargetName(), 'OpenAI Chat'); assert.equal(vm.routingPermissionTarget(), 'codex');
    assert.equal(vm.routingPermissionTarget('claude'), 'claude'); assert.equal(vm.routingOpenaiBaseUrl(), 'http://127.0.0.1:3344/bridge/openai-chat/v1');
    assert.equal(vm.routingOpenaiAccess.model, 'routing');
});
