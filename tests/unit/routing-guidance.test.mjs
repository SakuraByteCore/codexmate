import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutingMethods, routingMixin } from '../../web-ui/modules/routing.mjs';
import { zh } from '../../web-ui/modules/i18n/locales/zh.mjs';
import { en } from '../../web-ui/modules/i18n/locales/en.mjs';
import { zhTw } from '../../web-ui/modules/i18n/locales/zh-tw.mjs';
import { ja } from '../../web-ui/modules/i18n/locales/ja.mjs';
import { vi } from '../../web-ui/modules/i18n/locales/vi.mjs';
import { readProjectFile } from './helpers/web-ui-source.mjs';

function context() {
    const calls = [];
    const methods = createRoutingMethods({ request: async (...args) => { calls.push(args); return {}; } });
    const vm = { ...routingMixin.data(), ...methods, t: (key, values = {}) => {
        const text = zh[key];
        assert.equal(typeof text, 'string', key);
        return text.replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
    } };
    return { vm, calls };
}
test('real-test page omits legacy group purpose, setup steps and bridge controls', () => {
    const html = readProjectFile('web-ui/partials/index/panel-routing.html');
    assert.match(html, /routing-model-test\.html/);
    assert.doesNotMatch(html, /routing-purpose[\s\S]*routing\.purpose[\s\S]*routing-toolbar/);
    assert.doesNotMatch(html, /routing-start-steps[\s\S]*routing\.start\.create[\s\S]*routing\.start\.save[\s\S]*routing\.start\.enable[\s\S]*routing\.start\.use/);
    assert.doesNotMatch(html, /<details class="routing-explainer">/);
    assert.doesNotMatch(html, /v-if="routingBridges\[routingTarget\]\.active \|\| routingBindings\[routingTarget\]"[^>]*@click="toggleRoutingBridge"/);
    assert.ok(zh['routing.start.create'].includes('备用可选'));
    assert.ok(zh['routing.start.use'].includes('重启所选工具'));
    assert.ok(zh['routing.help.scope'].includes('不执行任务'));
    assert.ok(zh['routing.help.scope'].includes('不让多个模型一起回答'));
    for (const status of ['408', '429', '5xx', '4xx']) assert.ok(zh['routing.help.errors'].includes(status));
    assert.ok(zh['routing.help.model'].includes('不是昵称'));
});
test('role labels explain ordering without changing requests or stored model assignments', () => {
    const { vm, calls } = context();
    vm.routingDraft = { name: '示例组', strategy: 'order', members: [{ provider: 'alpha', model: 'a' }] };
    const original = JSON.stringify(vm.routingDraft);
    assert.equal(vm.routingMemberRole(0, 'order'), '主力');
    assert.equal(vm.routingMemberRole(1, 'order'), '备用 1');
    assert.equal(vm.routingMemberRole(2, 'rotate'), '模型 3');
    assert.equal(JSON.stringify(vm.routingDraft), original);
    assert.equal(calls.length, 0);
    const html = readProjectFile('web-ui/partials/index/panel-routing.html');
    assert.doesNotMatch(html, /routingMemberRole\(index, routingDraft\.strategy\)/);
    assert.doesNotMatch(html, /routingMemberRole\(index, group\.strategy\)/);
});
test('configuration status names the selected group without claiming a successful model call', () => {
    const { vm, calls } = context();
    vm.routingGroups = [{ id: 'daily', name: '日常编程', target: 'codex', strategy: 'order', members: [{ provider: 'alpha', model: 'a' }] }];
    vm.routingBindings.codex = 'daily'; vm.routingBridges.codex.active = true;
    assert.equal(vm.routingStateLabel(), '工具配置已使用「日常编程」。');
    assert.ok(zh['routing.help.scope'].includes('真实请求结果'));
    assert.equal(calls.length, 0);
});
test('guidance and plain action labels exist in every supported locale', () => {
    const keys = ['routing.purpose', 'routing.help.title', 'routing.help.scope', 'routing.help.errors', 'routing.help.model',
        'routing.start.create', 'routing.start.save', 'routing.start.enable', 'routing.start.use',
        'routing.role.primary', 'routing.role.backup', 'routing.role.member', 'routing.editActive'];
    for (const locale of [zh, en, zhTw, ja, vi]) {
        for (const key of keys) assert.equal(typeof locale[key], 'string', key);
        for (const status of ['408', '429', '5xx', '4xx']) assert.ok(locale['routing.help.errors'].includes(status));
        assert.equal(locale['tab.routing'], locale['title.routing']);
        assert.equal(locale['routing.bindEnable'], locale['routing.useGroup']);
    }
});
