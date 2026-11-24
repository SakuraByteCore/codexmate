import { api } from './api.mjs';
import { contextWindowReference } from '../logic.context-window.mjs';
const SessionMessageActions = {
    props: { message: { type: Object, required: true } },
    render() {
        // A child render tracks shared action state independently of the message v-memo.
        const vm = this.$parent;
        return Vue.h('div', { class: 'session-feature-controls' }, [
            Vue.h('button', { type: 'button', class: 'btn-mini feature-icon-button', disabled: vm.featureBusy,
                title: vm.t('features.bookmark'), 'aria-label': vm.t('features.bookmark'),
                onClick: () => vm.bookmarkMessage(this.message) }, [
                Vue.h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none',
                    stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linejoin': 'round' }, [
                    Vue.h('path', { d: 'M6 3h12v18l-6-4-6 4V3Z' })
                ])
            ]),
            Vue.h('label', { class: 'feature-message-select' }, [Vue.h('input', { type: 'checkbox', checked: vm.selectedContextIds.includes(vm.contextSelectionKey(this.message)),
                'aria-label': vm.t('features.selectMessage'), onChange: () => vm.toggleHandoffMessage(this.message) })])
        ]);
    }
};
export const sessionFeaturesMixin = {
    components: { SessionMessageActions },
    data() {
        return { featureView: '', featureBusy: false, featureError: '', bookmarks: [], bookmarkRevision: '',
            bookmarkQuery: '', bookmarkTag: '', bookmarkProject: '', bookmarkEditor: null,
            selectedContextIds: [], featureFocus: null, featureRequestSeq: 0,
            indexReport: null, indexResults: null, indexQuery: '', indexTimer: null, handoffDraftEvidence: [], handoffUnverified: [], projectReport: null, projectSelected: '', projectAlias: '', projectPrompt: null, contextWindowInput: '', contextSelectedModel: '', contextFeatureSettings: null, contextSettingsRevision: '', diagnosticsReport: null, diagnosticsMarkdown: '', diagnosticsRemote: false,
            diagnosticsTargets: [], diagnosticsSelected: [], diagnosticsTimer: null };
    },
    computed: {
        contextPreferenceKey() {
            return `${this.handoffSessionKey}::${this.contextSelectedModel || this.sessionContextHealth?.models?.[0] || 'manual'}`;
        },
        contextReference() {
            try { return contextWindowReference(this.sessionContextHealth, { model: this.contextSelectedModel, window: this.contextWindowInput }); }
            catch (_) { return { status: 'invalid', source: 'manual' }; }
        },
        contextReminderDismissed() { return !!this.contextFeatureSettings?.dismissed?.[this.contextPreferenceKey]; }
    },
    beforeUnmount() { clearTimeout(this.indexTimer); clearTimeout(this.diagnosticsTimer); },
    watch: {
        sessionContextHealth(report) {
            if (!report) return;
            this.contextSelectedModel = report.models?.length === 1 ? report.models[0] : '';
            void this.loadContextPreferences();
        },
        contextSelectedModel() { if (this.sessionContextHealth) void this.loadContextPreferences(); },
        handoffSessionKey() { this.contextWindowInput = ''; this.contextSelectedModel = ''; this.selectedContextIds = []; this.handoffDraftEvidence = []; this.handoffUnverified = []; this.featureFocus = null; this.featureRequestSeq++; this.featureBusy = false; }
    },
    methods: {
        featureErrorText(error) {
            const key = `features.error.${error.message || error}`;
            const text = this.t(key);
            return text === key ? this.t('features.error.feature-read-failed') : text;
        },
        sessionNodeParams(msg) {
            const session = this.activeSession;
            const index = msg.recordLineIndex;
            if (!session) throw new Error('bookmark-source-unavailable');
            return { source: session.source, sessionId: session.sessionId, filePath: session.filePath,
                cwd: session.cwd || '', ...(msg.id && /^record-/.test(msg.id) ? { nodeId: msg.id } : (Number.isInteger(index) && index >= 0
                    ? { nodeId: `record-${index}` } : { messageText: msg.text })) };
        },
        async featureCall(action, params = {}) {
            const result = await api(action, params);
            if (result.error) throw new Error(result.error);
            return result;
        },
        async openFeatureView(view) {
            this.featureView = this.featureView === view ? '' : view;
            this.featureError = '';
            if (this.featureView === 'bookmarks') await this.loadBookmarks();
            if (this.featureView === 'search') await this.pollSessionIndex();
            if (this.featureView === 'projects') await this.loadProjectWorkspace();
        },
        async loadBookmarks() {
            const seq = ++this.featureRequestSeq;
            this.featureBusy = true; this.featureError = '';
            try {
                const result = await this.featureCall('session-bookmarks-list', { query: this.bookmarkQuery,
                    tag: this.bookmarkTag, project: this.bookmarkProject });
                if (seq !== this.featureRequestSeq) return;
                this.bookmarks = result.items; this.bookmarkRevision = result.revision;
            } catch (error) { if (seq === this.featureRequestSeq) this.featureError = this.featureErrorText(error); }
            finally { if (seq === this.featureRequestSeq) this.featureBusy = false; }
        },
        async bookmarkMessage(msg) {
            if (this.featureBusy) return;
            this.featureBusy = true; this.featureError = '';
            try {
                const params = this.sessionNodeParams(msg);
                const list = await this.featureCall('session-bookmarks-list');
                const result = await this.featureCall('session-bookmark-save', { ...params, note: '', tags: [], revision: list.revision });
                this.bookmarkEditor = { ...result.item, tagsText: result.item.tags.join(', ') };
                this.bookmarks = result.items; this.bookmarkRevision = result.revision; this.featureView = 'bookmarks';
            } catch (error) { this.featureError = this.featureErrorText(error); }
            finally { this.featureBusy = false; }
        },
        async saveBookmark() {
            if (!this.bookmarkEditor || this.featureBusy) return;
            this.featureBusy = true; this.featureError = '';
            try {
                const item = this.bookmarkEditor;
                const result = await this.featureCall('session-bookmark-save', { id: item.id, note: item.note,
                    tags: item.tagsText.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), revision: this.bookmarkRevision });
                this.bookmarks = result.items; this.bookmarkRevision = result.revision; this.bookmarkEditor = null;
            } catch (error) { this.featureError = this.featureErrorText(error); }
            finally { this.featureBusy = false; }
        },
        async removeBookmark(item) {
            if (this.featureBusy) return;
            this.featureBusy = true; this.featureError = '';
            try {
                const result = await this.featureCall('session-bookmark-remove', { id: item.id, revision: this.bookmarkRevision });
                this.bookmarks = result.items; this.bookmarkRevision = result.revision;
                if (this.bookmarkEditor?.id === item.id) this.bookmarkEditor = null;
            } catch (error) { this.featureError = this.featureErrorText(error); }
            finally { this.featureBusy = false; }
        },
        async locateBookmark(item) {
            this.featureError = '';
            try {
                const result = await this.featureCall('session-bookmark-locate', { id: item.id });
                if (!result.available) throw new Error('bookmark-source-unavailable');
                await this.selectSession({ ...item, title: item.excerpt.slice(0, 80) });
                this.featureFocus = result.node;
                await this.$nextTick(); this.$refs.featureFocus?.focus();
            } catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async pollSessionIndex() {
            clearTimeout(this.indexTimer);
            try {
                this.indexReport = await this.featureCall('session-index-status');
                if (this.indexReport.job.status === 'running') {
                    this.indexTimer = setTimeout(() => this.pollSessionIndex(), 1000);
                }
            } catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async refreshSessionIndex(rebuild = false) {
            this.featureError = '';
            try {
                await this.featureCall('session-index-refresh', { source: this.sessionFilterSource || 'all', rebuild: rebuild === true });
                await this.pollSessionIndex();
            } catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async cancelSessionIndex() {
            try { await this.featureCall('session-index-cancel'); await this.pollSessionIndex(); }
            catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async searchSessionIndex() {
            if (this.featureBusy) return;
            const seq = ++this.featureRequestSeq;
            this.featureBusy = true; this.featureError = ''; this.indexResults = null;
            try {
                const result = await this.featureCall('session-index-search', { query: this.indexQuery,
                    source: this.sessionFilterSource || 'all', project: this.sessionPathFilter, role: this.sessionRoleFilter, scope: 'all' });
                if (seq === this.featureRequestSeq) this.indexResults = result;
            } catch (error) { if (seq === this.featureRequestSeq) this.featureError = this.featureErrorText(error); }
            finally { if (seq === this.featureRequestSeq) this.featureBusy = false; }
        },
        async openIndexedMessage(result) {
            this.featureError = '';
            try {
                const found = await this.featureCall('session-index-node', { ...result.session, nodeId: result.nodeId, textHash: result.textHash });
                await this.selectSession(result.session);
                this.featureFocus = found.node;
                await this.$nextTick(); this.$refs.featureFocus?.focus();
            } catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async generateSelectedHandoff() {
            if (this.featureBusy || !this.activeSession) return;
            const seq = this.handoffRequestSeq;
            this.featureBusy = true; this.featureError = '';
            try {
                const result = await this.featureCall('session-handoff-draft', { ...this.activeSession,
                    selections: this.selectedContextIds, goal: this.handoffDraft.goal });
                if (seq !== this.handoffRequestSeq) return;
                this.handoffDraft = { ...this.handoffDraft, goal: result.card.goal,
                    ...Object.fromEntries(['completed', 'blockers', 'nextSteps', 'files'].map((key) => [key, result.card[key].join('\n')])) };
                this.handoffDraftEvidence = result.evidence; this.handoffUnverified = result.unverified;
                this.handoffExpanded = true;
            } catch (error) { if (seq === this.handoffRequestSeq) this.featureError = this.featureErrorText(error); }
            finally { this.featureBusy = false; }
        },
        async locateDraftEvidence(item) {
            await this.openIndexedMessage({ session: { source: item.source, sessionId: item.sessionId, filePath: item.filePath, cwd: item.cwd }, nodeId: item.nodeId, textHash: item.textHash });
        },
        async loadProjectWorkspace(project) {
            const seq = ++this.featureRequestSeq;
            this.featureBusy = true; this.featureError = '';
            try {
                const result = await this.featureCall('session-projects', project === undefined ? {} : { project });
                if (seq !== this.featureRequestSeq) return;
                this.projectReport = result; this.projectPrompt = null; this.projectSelected = project === undefined ? '' : project;
            } catch (error) { if (seq === this.featureRequestSeq) this.featureError = this.featureErrorText(error); }
            finally { if (seq === this.featureRequestSeq) this.featureBusy = false; }
        },
        async openProjectPrompt(file) {
            try {
                const project = this.projectReport.detail.cwd;
                const name = file.slice(project.length + 1).replace(/\\/g, '/');
                this.projectPrompt = await this.featureCall('session-project-prompt', { project, name });
            } catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async mapProjectWorkspace() {
            this.featureError = '';
            try {
                await this.featureCall('session-project-map', { from: this.projectSelected, to: this.projectAlias,
                    revision: this.projectReport.revision });
                await this.loadProjectWorkspace(this.projectAlias || this.projectSelected);
                this.projectAlias = '';
            } catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async loadContextPreferences() {
            const key = this.contextPreferenceKey;
            try {
                const result = await this.featureCall('session-feature-settings-get');
                if (key !== this.contextPreferenceKey) return;
                this.contextFeatureSettings = result.settings; this.contextSettingsRevision = result.revision;
                this.contextWindowInput = result.settings.windows[key] === undefined ? '' : String(result.settings.windows[key]);
            } catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async saveContextPreferences(dismissed = false) {
            try {
                if (this.contextReference?.status === 'invalid') throw new Error('context-window-invalid');
                const key = this.contextPreferenceKey;
                const result = await this.featureCall('session-feature-settings-save', { key,
                    window: this.contextWindowInput === '' ? '' : Number(this.contextWindowInput), dismissed,
                    revision: this.contextSettingsRevision });
                if (key !== this.contextPreferenceKey) return;
                this.contextFeatureSettings = result.settings; this.contextSettingsRevision = result.revision;
            } catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async loadDiagnosticTargets() {
            try {
                const result = await this.featureCall('session-diagnostics-targets', { cwd: this.activeSession?.cwd });
                this.diagnosticsTargets = result.names;
            } catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async startDiagnostics() {
            this.featureError = '';
            try {
                await this.featureCall('session-diagnostics-start', { remote: this.diagnosticsRemote,
                    mcpNames: this.diagnosticsSelected, cwd: this.activeSession?.cwd });
                await this.pollDiagnostics();
            } catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async pollDiagnostics() {
            clearTimeout(this.diagnosticsTimer);
            try {
                const result = await this.featureCall('session-diagnostics-status');
                this.diagnosticsReport = result.report; this.diagnosticsMarkdown = result.markdown;
                if (result.report.status === 'running') this.diagnosticsTimer = setTimeout(() => this.pollDiagnostics(), 1000);
            } catch (error) { this.featureError = this.featureErrorText(error); }
        },
        async cancelDiagnostics() {
            try { await this.featureCall('session-diagnostics-cancel'); await this.pollDiagnostics(); }
            catch (error) { this.featureError = this.featureErrorText(error); }
        },
        exportDiagnostics(format) {
            this.downloadTextFile(`codexmate-diagnostics.${format === 'json' ? 'json' : 'md'}`,
                format === 'json' ? JSON.stringify(this.diagnosticsReport, null, 2) : this.diagnosticsMarkdown,
                format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8');
        },
        contextSelectionKey(msg) {
            if (msg.id && /^record-/.test(msg.id)) return msg.id;
            return Number.isInteger(msg.recordLineIndex) && msg.recordLineIndex >= 0
                ? `record-${msg.recordLineIndex}` : `text:${msg.text}`;
        },
        toggleHandoffMessage(msg) {
            try {
                const nodeId = this.contextSelectionKey(msg);
                this.selectedContextIds = this.selectedContextIds.includes(nodeId)
                    ? this.selectedContextIds.filter((id) => id !== nodeId) : [...this.selectedContextIds, nodeId];
            } catch (error) { this.featureError = this.featureErrorText(error); }
        }
    }
};
