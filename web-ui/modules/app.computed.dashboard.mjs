import { getProviderDisplayUrl, checkIsTransformProvider } from './provider-url-display.mjs';
import { getCodexModelCatalogForProvider, CODEX_PROVIDER_TEMPLATES } from '../logic.codex.mjs';
export function createDashboardComputed() {
    return {
        agentsDiffHasChanges() {
            if (this.agentsDiffTruncated) {
                return !!this.agentsDiffHasChangesValue;
            }
            const stats = this.agentsDiffStats || {};
            const added = Number(stats.added || 0);
            const removed = Number(stats.removed || 0);
            return added > 0 || removed > 0;
        },
        configTemplateDiffHasChanges() {
            const stats = this.configTemplateDiffStats || {};
            const added = Number(stats.added || 0);
            const removed = Number(stats.removed || 0);
            if (this.configTemplateDiffHasChangesValue !== undefined && this.configTemplateDiffHasChangesValue !== null) {
                return !!this.configTemplateDiffHasChangesValue;
            }
            return added > 0 || removed > 0;
        },
        claudeModelHasList() {
            return this.claudeModelOptions.length > 0;
        },
        claudeModelOptions() {
            const list = Array.isArray(this.claudeModels) ? [...this.claudeModels] : [];
            const current = (this.currentClaudeModel || '').trim();
            if (current && !list.includes(current)) {
                list.unshift(current);
            }
            return list;
        },
        activeProviderModel() {
            return (name) => {
                const target = String(name || '').trim();
                if (!target) return '';
                if (target === 'local') return '';
                const dict = this.currentModels && typeof this.currentModels === 'object' ? this.currentModels : {};
                const fromDict = typeof dict[target] === 'string' ? dict[target].trim() : '';
                if (fromDict) return fromDict;
                const activeName = String(this.currentProvider || '').trim();
                if (target === activeName) {
                    const top = typeof this.currentModel === 'string' ? this.currentModel.trim() : '';
                    if (top && top !== '未设置') return top;
                }
                return '';
            };
        },
        codexModelOptions() {
            const seen = new Set();
            const out = [];
            const push = (val) => {
                const s = typeof val === 'string' ? val.trim() : '';
                if (!s || seen.has(s)) return;
                seen.add(s);
                out.push(s);
            };
            const activeName = String(this.displayCurrentProvider || '').trim();
            const current = typeof this.currentModel === 'string' ? this.currentModel.trim() : '';
            if (current && current !== '未设置') push(current);
            const dict = this.currentModels && typeof this.currentModels === 'object' ? this.currentModels : {};
            if (activeName && typeof dict[activeName] === 'string') push(dict[activeName]);
            const remote = Array.isArray(this.models) ? this.models : [];
            for (const m of remote) push(m);
            const list = Array.isArray(this.providersList) ? this.providersList : [];
            const activeProvider = list.find((p) => p && p.name === activeName);
            if (activeProvider) {
                for (const m of getCodexModelCatalogForProvider(activeProvider)) push(m);
            }
            return out;
        },
        codexModelHasList() {
            return this.codexModelOptions.length > 0;
        },
        codexProviderTemplates() {
            return CODEX_PROVIDER_TEMPLATES;
        },
        displayCurrentProvider() {
            const switching = String(this.providerSwitchDisplayTarget || '').trim();
            if (switching) return switching;
            const current = String(this.currentProvider || '').trim();
            return current;
        },
        displayProvidersList() {
            const list = Array.isArray(this.providersList) ? [...this.providersList] : [];
            list.sort((a, b) => {
                if (a.name === 'local') return -1;
                if (b.name === 'local') return 1;
                return 0;
            });
            return list;
        },

        isLocalProviderDisabled() {
            return this.configMode === 'codex';
        },

        displayProviderUrl() {
            return (provider) => {
                if (provider && provider.name === 'local') return '';
                return getProviderDisplayUrl(provider);
            };
        },

        isTransformProvider() {
            return (provider) => checkIsTransformProvider(provider);
        },
        installTargetCards() {
            const targets = Array.isArray(this.installStatusTargets) && this.installStatusTargets.length
                ? this.installStatusTargets
                : [
                    {
                        id: 'claude',
                        name: 'Claude Code CLI',
                        packageName: '@anthropic-ai/claude-code',
                        installed: false,
                        bin: 'claude',
                        version: '',
                        commandPath: '',
                        error: ''
                    },
                    {
                        id: 'codebuddy',
                        name: 'CodeBuddy Code',
                        packageName: '@tencent-ai/codebuddy-code',
                        installed: false,
                        bin: 'codebuddy',
                        version: '',
                        commandPath: '',
                        error: ''
                    },
                    {
                        id: 'gemini',
                        name: 'Gemini CLI',
                        packageName: '@google/gemini-cli',
                        installed: false,
                        bin: 'gemini',
                        version: '',
                        commandPath: '',
                        error: ''
                    },
                    {
                        id: 'codex',
                        name: 'Codex CLI',
                        packageName: '@openai/codex',
                        installed: false,
                        bin: 'codex',
                        version: '',
                        commandPath: '',
                        error: ''
                    }
                ];
            const action = this.normalizeInstallAction(this.installCommandAction);
            return targets.map((target) => {
                const id = target && typeof target.id === 'string' ? target.id : '';
                const termuxCommand = id === 'codex'
                    ? this.getInstallCommand(id, action, 'termux')
                    : '';
                return {
                    ...target,
                    command: this.getInstallCommand(id, action),
                    termuxCommand
                };
            });
        },
        installRegistryPreview() {
            return this.resolveInstallRegistryUrl(this.installRegistryPreset, this.installRegistryCustom);
        },
        inspectorBusyStatus() {
            const tasks = [];
            if (this.loading) tasks.push(this.t('dashboard.busy.init'));
            if (this.sessionsLoading) tasks.push(this.t('dashboard.busy.sessions'));
            if (this.codexModelsLoading || this.claudeModelsLoading) tasks.push(this.t('dashboard.busy.models'));
            if (this.codexApplying || this.configTemplateApplying || this.openclawApplying) tasks.push(this.t('dashboard.busy.configApply'));
            if (this.agentsSaving) tasks.push(this.t('dashboard.busy.agents'));
            if (this.skillsLoading || this.skillsDeleting || this.skillsScanningImports || this.skillsImporting || this.skillsZipImporting || this.skillsExporting) tasks.push(this.t('dashboard.busy.skills'));
            if (this.taskOrchestration && (this.taskOrchestration.loading || this.taskOrchestration.planning || this.taskOrchestration.running || this.taskOrchestration.queueAdding || this.taskOrchestration.queueStarting || this.taskOrchestration.retrying || this.taskOrchestration.selectedRunLoading)) {
                tasks.push(this.t('dashboard.busy.tasks'));
            }
            return tasks.length ? tasks.join(' / ') : this.t('dashboard.busy.idle');
        },
        inspectorMessageSummary() {
            const value = typeof this.message === 'string' ? this.message.trim() : '';
            return value || this.t('dashboard.message.none');
        },
        inspectorSessionSourceLabel() {
            if (this.sessionFilterSource === 'codex') return this.t('dashboard.sessionSource.codex');
            if (this.sessionFilterSource === 'claude') return this.t('dashboard.sessionSource.claude');
            if (this.sessionFilterSource === 'gemini') return this.t('dashboard.sessionSource.gemini');
            if (this.sessionFilterSource === 'codebuddy') return this.t('dashboard.sessionSource.codebuddy');
            return this.t('dashboard.sessionSource.all');
        },
        inspectorSessionPathLabel() {
            const value = typeof this.sessionPathFilter === 'string' ? this.sessionPathFilter.trim() : '';
            return value || this.t('dashboard.sessionPath.all');
        },
        inspectorSessionQueryLabel() {
            if (!this.isSessionQueryEnabled) return this.t('dashboard.sessionQuery.unsupported');
            const value = typeof this.sessionQuery === 'string' ? this.sessionQuery.trim() : '';
            return value || this.t('dashboard.sessionQuery.unset');
        },
        inspectorHealthStatus() {
            if (this.initError) return this.t('dashboard.healthStatus.failRead');
            if (this.loading) return this.t('dashboard.healthStatus.initializing');
            return this.t('dashboard.healthStatus.ok');
        },
        inspectorHealthTone() {
            if (this.initError) return 'error';
            if (this.loading) return 'warn';
            return 'ok';
        },
        inspectorModelLoadStatus() {
            if (this.codexModelsLoading || this.claudeModelsLoading) {
                return this.t('dashboard.modelStatus.loading');
            }
            if (this.modelsSource === 'error' || this.claudeModelsSource === 'error') {
                return this.t('dashboard.modelStatus.error');
            }
            return this.t('dashboard.modelStatus.ok');
        },
        installTroubleshootingTips() {
            const platform = this.resolveInstallPlatform();
            if (platform === 'win32') {
                return [
                    this.t('docs.tip.win.1'),
                    this.t('docs.tip.win.2'),
                    this.t('docs.tip.win.3')
                ];
            }
            return [
                this.t('docs.tip.unix.1'),
                this.t('docs.tip.unix.2'),
                this.t('docs.tip.unix.3')
            ];
        },
        providersHealthSummary() {
            if (!this.providersHealthResult || !this.providersHealthResult.summary) {
                return { total: 0, green: 0, yellow: 0, red: 0 };
            }
            return this.providersHealthResult.summary;
        },
        providersHealthTone() {
            if (!this.providersHealthResult) return '';
            const s = this.providersHealthResult.summary;
            if (!s) return '';
            if (s.red > 0) return 'error';
            if (s.yellow > 0) return 'warn';
            return 'ok';
        }
    };
}
