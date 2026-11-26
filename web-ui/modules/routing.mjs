import { api } from './api.mjs';

const MAX_MEMBERS = 16;
export function createRoutingMethods({ request = api, origin = () => globalThis.location.origin } = {}) {
    return {
        applyRoutingState(state) {
            this.routingGroups = state.groups;
            this.routingBindings = { 'openai-chat': '', ...state.bindings };
            this.routingCatalogs = { 'openai-chat': [], ...state.catalogs };
            this.routingBridges = { 'openai-chat': { active: false, enabled: false }, ...state.bridges };
            this.routingRevision = state.revision;
            if (state.openaiChat) this.routingOpenaiAccess = state.openaiChat;
            this.routingLoaded = true;
        },
        async loadRouting() {
            if (this.routingLoading || this.routingSaving) return;
            this.routingLoading = true;
            this.routingError = '';
            try {
                const state = await request('routing-get');
                if (state.error) throw new Error(typeof state.error === 'string' ? state.error : state.error.message);
                this.applyRoutingState(state);
            } catch (error) {
                this.routingError = error.message || this.t('routing.failed');
            } finally { this.routingLoading = false; }
        },
        routingTargetName(target = this.routingTarget) {
            return { codex: 'Codex', claude: 'Claude', 'openai-chat': 'OpenAI Chat' }[target];
        },
        routingPermissionTarget(target = this.routingTarget) {
            return target === 'openai-chat' ? 'codex' : target;
        },
        routingOpenaiBaseUrl() {
            return origin() + this.routingOpenaiAccess.basePath;
        },
        routingGroupsForTarget() {
            return this.routingGroups.filter(group => group.target === this.routingTarget);
        },
        routingCatalog() {
            return this.routingCatalogs[this.routingTarget] || [];
        },
        routingStateLabel() {
            const bridge = this.routingBridges[this.routingTarget];
            if (bridge.active) {
                const id = this.routingBindings[this.routingTarget];
                if (!id) return this.t('routing.state.legacy');
                const group = this.routingGroups.find(item => item.id === id);
                return this.t(this.routingTarget === 'openai-chat' ? 'routing.openai.active' : 'routing.state.group', { name: group.name });
            }
            return this.t(this.routingTarget === 'openai-chat' ? 'routing.openai.off' : bridge.enabled ? 'routing.state.pending' : 'routing.state.off');
        },
        routingMemberRole(index, strategy) {
            if (strategy === 'rotate') return this.t('routing.role.member', { index: index + 1 });
            return this.t(index === 0 ? 'routing.role.primary' : 'routing.role.backup', { index });
        },
        setRoutingTarget(target) {
            if (this.routingDraft || this.routingSaving) return;
            this.routingTarget = target;
        },
        routingMemberModel(providerName) {
            if (this.routingPermissionTarget() === 'codex') {
                const model = this.currentModels?.[providerName] || (this.currentProvider === providerName ? this.currentModel : '');
                if (typeof model === 'string' && model.trim()) return model.trim();
            }
            return this.routingCatalog().find(entry => entry.name === providerName)?.model || '';
        },
        routingDefaultMember() {
            const used = new Set((this.routingDraft?.members || []).map(member => member.provider));
            const provider = this.routingCatalog().find(entry => !used.has(entry.name));
            return provider ? { provider: provider.name, model: this.routingMemberModel(provider.name) } : { provider: '', model: '' };
        },
        editRoutingGroup(group = null) {
            this.routingError = '';
            if (group) this.routingDraft = { ...group, members: group.members.map(member => ({ ...member })), revision: this.routingRevision };
            else {
                const names = new Set(this.routingGroupsForTarget().map(item => item.name));
                let index = 1;
                const target = this.routingTargetName();
                let name = this.t('routing.defaultName', { target, index });
                while (names.has(name)) name = this.t('routing.defaultName', { target, index: ++index });
                this.routingDraft = { name, target: this.routingTarget, strategy: 'order', members: [this.routingDefaultMember()], revision: this.routingRevision };
            }
            if (typeof this.$nextTick === 'function') this.$nextTick(() => {
                const input = this.$refs.routingNameInput;
                if (input) { input.focus(); input.select(); }
            });
        },
        cancelRoutingEdit() {
            if (!this.routingSaving) this.routingDraft = null;
        },
        addRoutingMember() {
            if (this.routingDraft.members.length < MAX_MEMBERS) this.routingDraft.members.push(this.routingDefaultMember());
        },
        setRoutingMemberProvider(index) {
            const member = this.routingDraft.members[index];
            member.model = this.routingMemberModel(member.provider);
        },
        moveRoutingMember(index, offset) {
            const members = this.routingDraft.members;
            const destination = index + offset;
            if (destination < 0 || destination >= members.length) return;
            const [member] = members.splice(index, 1);
            members.splice(destination, 0, member);
        },
        routingDraftError() {
            const draft = this.routingDraft;
            if (!draft || !draft.name.trim()) return this.t('routing.nameRequired');
            const pairs = new Set();
            for (const [index, member] of draft.members.entries()) {
                if (!member.provider.trim() || !member.model.trim()) return this.t('routing.memberRequired', { index: index + 1 });
                if (!this.routingCatalog().some(entry => entry.name === member.provider)) return this.t('routing.memberMissing', { index: index + 1 });
                const pair = JSON.stringify([member.provider.trim(), member.model.trim()]);
                if (pairs.has(pair)) return this.t('routing.memberDuplicate', { index: index + 1 });
                pairs.add(pair);
            }
            return '';
        },
        async writeRouting(action, params, options = {}) {
            if (this.routingSaving || this.routingLoading || !this.isToolConfigWriteAllowed(this.routingPermissionTarget())) return false;
            const target = this.routingTarget;
            let bindingConfirmed = false;
            this.routingSaving = true;
            this.routingError = '';
            try {
                const result = await request(action, params);
                if (result.error) throw new Error(typeof result.error === 'string' ? result.error : result.error.message);
                let state = result.groups ? result : await request('routing-get');
                if (state.error) throw new Error(typeof state.error === 'string' ? state.error : state.error.message);
                if (options.activate) {
                    if (state.bindings[target] !== params.id) throw new Error(this.t('routing.notActive'));
                    bindingConfirmed = true;
                    if (!state.bridges[target].active) {
                        this.applyRoutingState(state);
                        const toggle = target === 'claude' ? 'claude-local-bridge-toggle' : 'local-bridge-toggle';
                        const bridge = await request(toggle, { enable: true });
                        if (bridge.error) throw new Error(typeof bridge.error === 'string' ? bridge.error : bridge.error.message);
                        state = await request('routing-get');
                        if (state.error) throw new Error(typeof state.error === 'string' ? state.error : state.error.message);
                    }
                    if (!state.bridges[target].active || state.bindings[target] !== params.id) throw new Error(this.t('routing.notActive'));
                }
                this.applyRoutingState(state);
                this.showMessage(this.t(options.activate ? 'routing.groupActivated' : 'routing.updated', { name: options.name }), 'success');
                return true;
            } catch (error) {
                const message = error.message || this.t('routing.failed');
                this.routingError = bindingConfirmed ? this.t('routing.activationUnconfirmed', { message }) : message;
                return false;
            } finally { this.routingSaving = false; }
        },
        async saveRoutingGroup() {
            if (this.routingSaving || this.routingLoading || !this.isToolConfigWriteAllowed(this.routingPermissionTarget())) return;
            const error = this.routingDraftError();
            if (error) { this.routingError = error; return; }
            if (await this.writeRouting('routing-save', this.routingDraft)) this.routingDraft = null;
        },
        async bindRoutingGroup(id) {
            await this.writeRouting('routing-bind', { target: this.routingTarget, id, revision: this.routingRevision });
        },
        async useRoutingGroup(group) {
            if (this.routingSaving || this.routingLoading || !this.isToolConfigWriteAllowed(this.routingPermissionTarget())) return;
            this.routingPendingGroupId = group.id;
            try {
                if (this.routingBindings[this.routingTarget] === group.id && this.routingBridges[this.routingTarget].active) {
                    await this.bindRoutingGroup('');
                    return;
                }
                await this.writeRouting('routing-bind', { target: this.routingTarget, id: group.id, revision: this.routingRevision }, { activate: true, name: group.name });
            } finally { this.routingPendingGroupId = ''; }
        },
        async deleteRoutingGroup(group) {
            if (this.routingBindings[group.target] === group.id || !this.isToolConfigWriteAllowed(this.routingPermissionTarget(group.target))) return;
            const revision = this.routingRevision;
            const confirmed = await this.requestConfirmDialog({
                title: this.t('routing.delete'), message: this.t('routing.deleteConfirm', { name: group.name }),
                confirmText: this.t('routing.delete'), cancelText: this.t('common.cancel'), danger: true
            });
            if (confirmed) await this.writeRouting('routing-delete', { id: group.id, revision });
        },
        async toggleRoutingBridge() {
            if (this.routingTarget === 'openai-chat') { await this.bindRoutingGroup(''); return; }
            const action = this.routingTarget === 'claude' ? 'claude-local-bridge-toggle' : 'local-bridge-toggle';
            await this.writeRouting(action, { enable: !this.routingBridges[this.routingTarget].active });
        }
    };
}
export const routingMixin = {
    data() {
        return {
            routingTarget: 'codex', routingGroups: [], routingBindings: { codex: '', claude: '', 'openai-chat': '' },
            routingCatalogs: { codex: [], claude: [], 'openai-chat': [] },
            routingBridges: { codex: { enabled: false, active: false }, claude: { enabled: false, active: false }, 'openai-chat': { enabled: false, active: false } },
            routingOpenaiAccess: { basePath: '/bridge/openai-chat/v1', model: 'routing', requiresToken: false },
            routingRevision: '', routingDraft: null, routingLoading: false, routingSaving: false, routingPendingGroupId: '',
            routingLoaded: false, routingError: ''
        };
    },
    watch: {
        mainTab(tab) { if (tab === 'routing') this.loadRouting(); }
    },
    methods: createRoutingMethods()
};
