import { normalizePromptTemplateDraft } from '../../plugins/prompt-templates/methods.mjs';
import { persistPromptTemplatesToStorage } from '../../plugins/prompt-templates/storage.mjs';

export function createPromptEcosystemMethods({ api }) {
    return {
        promptHistoryTarget(kind) {
            if (kind === 'sys') return {
                key: `${this.sysPromptScope}:${this.sysPromptMode}:${this.sysHistoryPreviewId}`,
                busy: this.sysPromptLoading || this.sysPromptSaving || this.sysPromptDiffVisible,
                id: this.sysHistoryPreviewId, content: this.sysHistoryPreviewContent,
                action: 'apply-system-prompt', saving: 'sysPromptSaving',
                params: { scope: this.sysPromptScope, mode: this.sysPromptMode, baseHash: this.sysPromptHash },
                load: 'loadSystemPrompt', history: 'loadSysHistory', bucket: this.sysHistoryBucket
            };
            const context = this.agentsContext || 'codex';
            const action = { codex: 'apply-agents-file', opencode: 'apply-opencode-agents-file', 'claude-project': 'apply-claude-md-file' }[context];
            if (!action) return null;
            return {
                key: `${context}:${this.projectClaudeMdPath || ''}:${this.promptHistoryPreviewId}`,
                busy: this.agentsLoading || this.agentsSaving || this.agentsDiffVisible,
                id: this.promptHistoryPreviewId, content: this.promptHistoryPreviewContent,
                action, saving: 'agentsSaving',
                params: { baseContent: this.agentsOriginalContent, lineEnding: this.agentsLineEnding,
                    ...(context === 'claude-project' ? { baseDir: this.projectClaudeMdPath } : {}) },
                load: 'loadPromptsContent', history: 'loadPromptHistory', bucket: this.promptHistoryBucket
            };
        },
        async rollbackPromptHistory(kind = 'agents') {
            const target = this.promptHistoryTarget(kind);
            if (!target || target.busy || !target.id) return false;
            const confirmed = await this.requestConfirmDialog({ title: this.t('ecosystem.rollback'),
                message: this.t('ecosystem.rollbackConfirm'), confirmText: this.t('ecosystem.rollback'),
                cancelText: this.t('common.cancel'), danger: true });
            const latest = this.promptHistoryTarget(kind);
            if (!confirmed || !latest || latest.busy || latest.key !== target.key
                || latest.params.baseContent !== target.params.baseContent || latest.params.baseHash !== target.params.baseHash) return false;
            this[target.saving] = true;
            try {
                const result = await api(target.action, { ...target.params, content: target.content });
                if (result.error) throw new Error(result.error);
                await this[target.load]();
                await this[target.history](target.bucket);
                this.showMessage(this.t('toast.history.restored'), 'success');
                return true;
            } catch (error) { this.showMessage(error.message || this.t('toast.save.fail'), 'error'); return false; }
            finally { this[target.saving] = false; }
        },
        async loadPluginConfig() {
            try {
                const result = await api('get-plugin-config', {});
                if (result.error) throw new Error(result.error);
                this.pluginConfigHash = result.hash;
                this.pluginHistoryBucket = result.historyBucket;
                this.pluginConfigLoaded = true;
                if (result.exists) {
                    const builtins = this.promptTemplatesListRaw.filter((item) => item.isBuiltin === true);
                    this.promptTemplatesListRaw = [...builtins, ...result.templates];
                    if (!persistPromptTemplatesToStorage(this.promptTemplatesListRaw, localStorage)) {
                        this.showMessage(this.t('ecosystem.cacheFail'), 'error');
                    }
                }
                return true;
            } catch (error) { this.showMessage(error.message || this.t('toast.load.fail'), 'error'); return false; }
        },
        async persistPluginTemplates(list) {
            if (this.pluginConfigSaving) return false;
            if (!this.pluginConfigLoaded && !await this.loadPluginConfig()) return false;
            this.pluginConfigSaving = true;
            try {
                const result = await api('apply-plugin-config', { baseHash: this.pluginConfigHash,
                    templates: list.map(normalizePromptTemplateDraft),
                    legacyTemplates: this.promptTemplatesListRaw.map(normalizePromptTemplateDraft) });
                if (result.error) throw new Error(result.error);
                this.pluginConfigHash = result.hash;
                this.pluginHistoryBucket = result.historyBucket;
                return true;
            } catch (error) { this.showMessage(error.message || this.t('ecosystem.storageFail'), 'error'); return false; }
            finally { this.pluginConfigSaving = false; }
        },
        async openPluginHistory() {
            if (this.pluginHistoryLoading || this.pluginConfigSaving) return;
            if (!this.pluginConfigLoaded && !await this.loadPluginConfig()) return;
            this.pluginHistoryVisible = true;
            this.pluginHistorySelectedId = '';
            this.pluginHistoryError = '';
            this.pluginHistoryLoading = true;
            try {
                const result = await api('list-prompt-history', { bucket: this.pluginHistoryBucket });
                if (result.error) throw new Error(result.error);
                this.pluginHistoryItems = Array.isArray(result) ? result : [];
            } catch (error) { this.pluginHistoryError = error.message; }
            finally { this.pluginHistoryLoading = false; }
        },
        async viewPluginHistory(item) {
            if (this.pluginHistoryLoading || this.pluginConfigSaving) return;
            this.pluginHistoryLoading = true;
            this.pluginHistorySelectedId = '';
            this.pluginHistoryError = '';
            try {
                const result = await api('get-prompt-history', { bucket: this.pluginHistoryBucket, id: item.id });
                if (result.error) throw new Error(result.error);
                if (!this.pluginHistoryVisible) return;
                this.pluginHistoryContent = result.content;
                this.pluginHistorySelectedId = item.id;
            } catch (error) { this.pluginHistoryError = error.message; }
            finally { this.pluginHistoryLoading = false; }
        },
        async rollbackPluginConfig() {
            if (!this.pluginHistorySelectedId || this.pluginHistoryLoading || this.pluginConfigSaving) return false;
            const id = this.pluginHistorySelectedId;
            const content = this.pluginHistoryContent;
            const hash = this.pluginConfigHash;
            const confirmed = await this.requestConfirmDialog({ title: this.t('ecosystem.rollback'),
                message: this.t('ecosystem.rollbackConfirm'), confirmText: this.t('ecosystem.rollback'),
                cancelText: this.t('common.cancel'), danger: true });
            if (!confirmed || id !== this.pluginHistorySelectedId || hash !== this.pluginConfigHash || this.pluginConfigSaving) return false;
            try {
                const parsed = JSON.parse(content);
                if (parsed.version !== 1 || !Array.isArray(parsed.templates)) throw new Error(this.t('toast.import.invalidJson'));
                if (!await this.persistPluginTemplates(parsed.templates)) return false;
                const builtins = this.promptTemplatesListRaw.filter((item) => item.isBuiltin === true);
                this.promptTemplatesListRaw = [...builtins, ...parsed.templates];
                if (!persistPromptTemplatesToStorage(this.promptTemplatesListRaw, localStorage)) {
                    this.showMessage(this.t('ecosystem.cacheFail'), 'error');
                }
                this.promptTemplateDraftRaw = null;
                this.promptTemplateSelectedId = '';
                const first = this.promptTemplatesList[0];
                if (first) this.selectPromptTemplate(first.id);
                this.promptComposerSelectedTemplateId = first?.id || '';
                await this.openPluginHistory();
                return true;
            } catch (error) { this.pluginHistoryError = error.message; return false; }
        }
    };
}
