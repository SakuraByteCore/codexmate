import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutingMethods, routingMixin } from '../../web-ui/modules/routing.mjs';
import { createMainTabsComputed } from '../../web-ui/modules/app.computed.main-tabs.mjs';
import { readProjectFile, readBundledWebUiHtml, readBundledWebUiCss } from './helpers/web-ui-source.mjs';

function fixture(request) {
    const calls = [];
    const messages = [];
    const state = { groups: [{ id: 'daily', name: 'Daily', target: 'codex', strategy: 'order', members: [{ provider: 'alpha', model: 'a' }, { provider: 'beta', model: 'b' }] }],
        bindings: { codex: '', claude: '' }, catalogs: { codex: [{ name: 'alpha', model: 'a' }, { name: 'beta', model: 'b' }], claude: [] },
        bridges: { codex: { active: false, enabled: false }, claude: { active: false, enabled: false } }, revision: 'revision-one' };
    const vm = { ...routingMixin.data(), ...createRoutingMethods({ request: async (action, params) => {
        calls.push({ action, params });
        return request ? request(action, params) : state;
    } }), t: key => key, isToolConfigWriteAllowed: () => true, showMessage: (...args) => messages.push(args), requestConfirmDialog: async () => true };
    return { vm, calls, state, messages };
}
test('routing tab uses the existing navigation, headers, tokens and compiled panel include', () => {
    const html = readBundledWebUiHtml();
    const css = readBundledWebUiCss();
    assert.match(html, /id="tab-routing"[\s\S]*?aria-controls="panel-routing"/);
    assert.match(html, /id="side-tab-routing"[\s\S]*?:class="\['side-item'/);
    assert.match(html, /id="panel-routing"[^>]*role="tabpanel"[^>]*aria-labelledby="tab-routing"/);
    assert.doesNotMatch(html, /class="routing-toolbar"/);
    assert.match(html, /class="routing-test-heading"/);
    assert.doesNotMatch(css, /#panel-routing \.routing-toolbar\s*\{[^}]*margin: 0 0 12px;/);
    assert.match(css, /#panel-routing \.routing-test-heading \{[^}]*margin-bottom: 16px;/);
    assert.match(css, /#panel-routing \.btn-tool\s*\{ min-height: 44px;/);
    const localCss = readProjectFile('web-ui/styles/routing.css');
    assert.doesNotMatch(localCss, /#[\da-f]{3,8}\b|box-shadow:|linear-gradient/);
    assert.match(readProjectFile('web-ui/app.js'), /appOptions\.mixins\.push\(modelTestMixin\)/);
    const computed = createMainTabsComputed();
    for (const method of ['mainTabTitle', 'mainTabKicker', 'mainTabSubtitle']) {
        const value = computed[method].call({ mainTab: 'routing', t: key => key });
        if (method === 'mainTabTitle') assert.match(value, /routing/);
        else assert.equal(value, '', 'routing must not show obsolete group descriptions');
    }
});
test('entering routing only reads state and editing preserves the original group and revision', async () => {
    const { vm, calls, state } = fixture();
    await vm.loadRouting();
    assert.deepEqual(calls.map(call => call.action), ['routing-get']);
    vm.editRoutingGroup(state.groups[0]);
    vm.moveRoutingMember(1, -1);
    vm.routingDraft.name = 'Changed';
    assert.equal(state.groups[0].members[0].provider, 'alpha');
    assert.equal(state.groups[0].name, 'Daily');
    vm.applyRoutingState({ ...state, revision: 'revision-two' });
    assert.equal(vm.routingDraft.revision, 'revision-one', 'refresh must not erase the draft conflict baseline');
    vm.setRoutingTarget('claude');
    assert.equal(vm.routingTarget, 'codex', 'changing targets must not discard an open draft');
    vm.cancelRoutingEdit();
    vm.setRoutingTarget('claude');
    assert.equal(vm.routingGroupsForTarget().length, 0);
});
test('failed writes preserve the draft and cannot emit a success message', async () => {
    const { vm, state, messages, calls } = fixture(action => action === 'routing-get' ? state : { error: 'routing-conflict' });
    await vm.loadRouting();
    vm.editRoutingGroup(state.groups[0]);
    await vm.saveRoutingGroup();
    assert.equal(vm.routingDraft.id, 'daily');
    assert.equal(vm.routingError, 'routing-conflict');
    assert.equal(messages.length, 0);
    assert.equal(vm.routingSaving, false);
    vm.isToolConfigWriteAllowed = () => false;
    const count = calls.length;
    await vm.bindRoutingGroup('daily');
    assert.equal(calls.length, count, 'view-only controls must not send mutations');
});
test('successful binding does not enable a bridge and bound groups cannot be deleted', async () => {
    const { vm, calls, state } = fixture();
    await vm.loadRouting();
    await vm.bindRoutingGroup('daily');
    assert.equal(calls.at(-1).action, 'routing-bind');
    assert.equal(calls.some(call => call.action.includes('toggle')), false);
    vm.routingBindings.codex = 'daily';
    const count = calls.length;
    await vm.deleteRoutingGroup(state.groups[0]);
    assert.equal(calls.length, count);
    assert.equal(vm.routingStateLabel(), 'routing.state.off');
    vm.routingBridges.codex.active = true;
    assert.equal(vm.routingStateLabel(), 'routing.state.group');
    vm.routingBindings.codex = '';
    assert.equal(vm.routingStateLabel(), 'routing.state.legacy');
});

test('routing removes every group action and retains only real-test controls', () => {
    const html = readProjectFile('web-ui/partials/index/panel-routing.html') + readProjectFile('web-ui/partials/index/routing-model-test.html');
    const events = [...html.matchAll(/(@[\w.]+)="([^"]*)"/g)].map(match => [match[1], match[2]]).sort();
    const expected = [
        ['@change', 'setRoutingMemberProvider(index)'],
        ['@click', 'addRoutingMember'],
        ['@click', "bindRoutingGroup(routingBindings[routingTarget] === group.id ? '' : group.id)"],
        ['@click', 'cancelRoutingEdit'], ['@click', 'deleteRoutingGroup(group)'],
        ['@click', 'editRoutingGroup()'], ['@click', 'editRoutingGroup(group)'], ['@click', 'loadRouting'],
        ['@click', 'moveRoutingMember(index, -1)'], ['@click', 'moveRoutingMember(index, 1)'],
        ['@click', 'routingDraft.members.splice(index, 1)'], ['@click', 'setRoutingTarget(target)'],
        ['@click', 'switchConfigMode(routingPermissionTarget())'], ['@click', 'toggleRoutingBridge'],
        ['@click', 'setToolConfigPermission(routingPermissionTarget(), true)'], ['@click', 'useRoutingGroup(group)'],
        ['@focus', '$event.target.select()'], ['@focus', '$event.target.select()'],
        ['@submit.prevent', 'saveRoutingGroup']
    ].sort();
    for (const [event, action] of expected) assert.equal(events.some(entry => entry[0] === event && entry[1] === action), false, action);
    assert.deepEqual(events, [
        ['@change', 'selectModelTestProvider'], ['@click', 'loadModelTestCatalog'],
        ['@click', 'setModelTestTarget(target)'], ['@click', 'switchConfigMode(modelTestTarget)'],
        ['@submit.prevent', 'runModelTest']
    ].sort());
    assert.match(html, /:class="\['segment', \{ active: modelTestTarget === target \}\]"/);
    assert.doesNotMatch(html, /segmented-option/);
    assert.doesNotMatch(html, /<details class="routing-group-details" :open="routingBindings\[routingTarget\] === group.id">/);
    assert.doesNotMatch(html, /<summary>\{\{ t\('routing.memberCount'/);
    for (const action of ['routing.edit', 'routing.delete', 'common.cancel']) {
        assert.equal(html.includes(`:aria-label="t('${action}')" :title="t('${action}')"`), false, action);
    }
    assert.match(html, /<fieldset :disabled="modelTestRunning \|\| modelTestLoading">/);
    assert.doesNotMatch(html, /<fieldset :disabled="routingSaving \|\| routingLoading \|\| !isToolConfigWriteAllowed\(routingPermissionTarget\(\)\)">/);
});
test('routing controls remove inherited width limits and keep layouts and focus scoped', () => {
    const css = readProjectFile('web-ui/styles/routing.css');
    assert.match(css, /#panel-routing :is\([^}]+\) > \.btn-tool\s*\{[^}]*width: auto;/);
    assert.match(css, /#panel-routing :is\(\.form-input, \.model-select\)\s*\{[^}]*max-width: none;/);
    assert.doesNotMatch(css, /#panel-routing \.routing-member-actions \{ flex-wrap: nowrap;/);
    assert.match(css, /#panel-routing :is\(\.form-input, \.model-select\)\s*\{[^}]*height: 44px; padding-block: 8px;/);
    assert.doesNotMatch(css, /#panel-routing :is\(\.btn-tool, \.segment, summary\):focus-visible/);
    assert.match(css, /#panel-routing :is\(\.btn-tool, \.segment\):focus-visible/);
    assert.doesNotMatch(css, /@media \(max-width: 760px\)[\s\S]*#panel-routing \.routing-group-row \{ grid-template-columns: minmax\(0, 1fr\);/);
    assert.match(css, /@media \(max-width: 760px\)[\s\S]*#panel-routing \.routing-form-head \{ grid-template-columns: minmax\(0, 1fr\);/);
    assert.match(css, /#panel-routing \.routing-icon-btn svg \{[^}]*width: 16px; height: 16px;/);
});
