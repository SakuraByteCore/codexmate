import {
    DEFAULT_MODEL_AUTO_COMPACT_TOKEN_LIMIT,
    DEFAULT_MODEL_CONTEXT_WINDOW,
    DEFAULT_OPENCLAW_TEMPLATE,
    SESSION_TRASH_PAGE_SIZE
} from './modules/app.constants.mjs';
import { createAppComputed } from './modules/app.computed.index.mjs';
import { createAppMethods } from './modules/app.methods.index.mjs';
import { installWebUiUrlCanonicalization } from './modules/sessions-filters-url.mjs';

document.addEventListener('DOMContentLoaded', () => {
    installWebUiUrlCanonicalization();
    if (typeof Vue === 'undefined') {
        console.error('Vue 库未能在 DOMContentLoaded 触发前加载完成。');
        const fallbackTarget = document.querySelector('#app') || document.querySelector('[v-cloak]');
        if (fallbackTarget) {
            fallbackTarget.removeAttribute('v-cloak');
            fallbackTarget.classList.remove('v-cloak');
            fallbackTarget.innerHTML = '';
            const notice = document.createElement('div');
            notice.className = 'fallback-message';
            notice.textContent = 'Web UI 加载失败：Vue 未加载。请检查网络或刷新页面。';
            fallbackTarget.appendChild(notice);
        }
        return;
    }

    const { createApp } = Vue;
    const showFatalErrorOverlay = (label, message, stack, extra) => {
        try {
            const target = document.querySelector('#app') || document.body;
            const pre = document.createElement('pre');
            pre.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#900;color:#fff;padding:12px;white-space:pre-wrap;font-size:12px;z-index:9999;';
            pre.textContent = '[' + label + '] ' + (message || '') + '\n' + (stack || '') + (extra ? '\n' + extra : '');
            target.appendChild(pre);
        } catch (_) {}
    };
    window.addEventListener('error', (event) => {
        console.error('[window error]', event.message, event.filename, event.lineno, event.colno, event.error);
        try {
            const target = document.querySelector('#app') || document.body;
            const pre = document.createElement('pre');
            pre.style.cssText = 'position:fixed;bottom:60px;left:0;right:0;background:#b00;color:#fff;padding:12px;white-space:pre-wrap;font-size:12px;z-index:9999;';
            pre.textContent = '[window error] ' + (event.message || '') + '\n' + ((event.error && event.error.stack) || (event.filename + ':' + event.lineno + ':' + event.colno));
            target.appendChild(pre);
        } catch (_) {}
    });
    window.addEventListener('unhandledrejection', (event) => {
        console.error('[unhandled rejection]', event.reason);
        try {
            const target = document.querySelector('#app') || document.body;
            const pre = document.createElement('pre');
            pre.style.cssText = 'position:fixed;bottom:120px;left:0;right:0;background:#b00;color:#fff;padding:12px;white-space:pre-wrap;font-size:12px;z-index:9999;';
            pre.textContent = '[unhandled rejection] ' + (event.reason && event.reason.message ? event.reason.message : String(event.reason)) + '\n' + ((event.reason && event.reason.stack) || '');
            target.appendChild(pre);
        } catch (_) {}
    });

    const appOptions = {
        data() {
            return {
                lang: 'zh',
                appVersion: '',
                mainTab: 'dashboard',
                configMode: 'codex',
                currentProvider: '',
                currentModel: '',
                currentModels: {},
                serviceTier: 'fast',
                modelReasoningEffort: 'medium',
                modelContextWindowInput: String(DEFAULT_MODEL_CONTEXT_WINDOW),
                modelAutoCompactTokenLimitInput: String(DEFAULT_MODEL_AUTO_COMPACT_TOKEN_LIMIT),
                editingCodexBudgetField: '',
                providersList: [],
                localBridgeExcluded: [],
                claudeLocalBridgeExcluded: [],
                models: [],
                codexModelsLoading: false,
                modelsSource: 'remote',
                modelsHasCurrent: true,
                claudeModels: [],
                claudeModelsSource: 'idle',
                claudeModelsHasCurrent: true,
                claudeModelsLoading: false,
                codexModelsRequestSeq: 0,
                claudeModelsRequestSeq: 0,
                loading: true,
                initError: '',
                message: '',
                messageType: '',
                showAddModal: false,
                showEditModal: false,
                showAddProviderKey: false,
                showEditProviderKey: false,
                showModelModal: false,
                showModelListModal: false,
                showClaudeConfigModal: false,
                showEditConfigModal: false,
                showAddClaudeConfigKey: false,
                showEditClaudeConfigKey: false,
                showOpenclawConfigModal: false,
                showConfigTemplateModal: false,
                showAgentsModal: false,
                promptsSubTab: 'codex',
                projectClaudeMdPath: '',
                promptHistoryVisible: false,
                promptHistoryLoading: false,
                promptHistoryBucket: '',
                promptHistoryItems: [],
                promptHistoryPreviewId: '',
                promptHistoryPreviewContent: '',
                promptHistoryError: '',
                promptPresets: [],
                selectedPromptPresetId: '',
                promptPresetNameDraft: '',
                promptPresetRenameDraft: {},
                promptPresetSaving: false,
                __skipNextPromptsSubTabLoad: false,
                projectPathOptions: [],
                projectPathOptionsLoading: false,
                showSkillsModal: false,
                showHealthCheckModal: false,
                showProviderCacheModal: false,
                showProviderCacheAnnouncementModal: false,
                showCodexBridgePoolModal: false,
                showClaudeBridgePoolModal: false,
                showWebhookModal: false,
                piProviders: {},
                piProviderIds: [],
                editingPiProvider: null,
                addingPiProviderId: '',
                addingPiProviderName: '',
                addingPiProviderBaseUrl: '',
                addingPiProviderApi: '',
                showAddPiProviderModal: false,
                piProviderLoading: false,
                piSaving: false,
                piShowKey: false,
                // Plugins
                pluginsActiveId: 'prompt-templates',
                pluginsLoading: false,
                pluginsError: '',
                promptTemplatesListRaw: [],
                promptTemplatesLoadedOnce: false,
                promptTemplatesKeyword: '',
                promptTemplateSelectedId: '',
                promptTemplateDraftRaw: null,
                promptTemplateVarValuesRaw: {},
                promptTemplatesMode: 'compose',
                promptComposerCommand: '',
                promptComposerPickerVisible: false,
                promptComposerPickerKeyword: '',
                promptComposerSelectedTemplateId: '',
                promptComposerVarValuesRaw: {},
                showConfirmDialog: false,
                confirmDialogTitle: '',
                confirmDialogMessage: '',
                confirmDialogConfirmText: '确认',
                confirmDialogCancelText: '取消',
                confirmDialogDanger: false,
                confirmDialogConfirmDisabled: false,
                confirmDialogDisableWhen: null,
                confirmDialogResolver: null,
                configTemplateContent: '',
                configTemplateApplying: false,
                configTemplateContext: 'codex',
                configTemplateDiffVisible: false,
                configTemplateDiffLoading: false,
                configTemplateDiffError: '',
                configTemplateDiffLines: [],
                configTemplateDiffStats: {
                    added: 0,
                    removed: 0,
                    unchanged: 0
                },
                configTemplateDiffHasChangesValue: false,
                configTemplateDiffFingerprint: '',
                _configTemplateDiffPreviewRequestToken: null,
                configTemplateDiffConfirmEnabled: true,
                configModeVisibility: { codex: true, claude: true, openclaw: true, opencode: true, kilocode: true, pi: true },
                codexApplying: false,
                _pendingCodexApplyOptions: null,
                agentsContent: '',
                agentsPath: '',
                agentsExists: false,
                agentsLineEnding: '\n',
                agentsLoading: false,
                agentsSaving: false,
                agentsOriginalContent: '',
                agentsDiffVisible: false,
                agentsDiffLoading: false,
                agentsDiffError: '',
                agentsDiffLines: [],
                agentsDiffStats: {
                    added: 0,
                    removed: 0,
                    unchanged: 0
                },
                agentsDiffTruncated: false,
                agentsDiffHasChangesValue: false,
                agentsDiffFingerprint: '',
                agentsContext: 'codex',
                agentsModalTitle: 'AGENTS.md 编辑器',
                agentsModalHint: '保存后会写入目标 AGENTS.md（与 config.toml 同级）。',
                sysPromptScope: 'global',
                sysPromptMode: 'system',
                sysPromptContent: '',
                sysPromptOriginalContent: '',
                sysPromptPath: '',
                sysPromptExists: false,
                sysPromptHash: '',
                sysHistoryBucket: '',
                sysHistoryVisible: false,
                sysHistoryLoading: false,
                sysHistoryItems: [],
                sysHistoryPreviewId: '',
                sysHistoryPreviewContent: '',
                sysHistoryError: '',
                sysPromptLoading: false,
                sysPromptSaving: false,
                sysPromptDiffVisible: false,
                sysPromptDiffLoading: false,
                sysPromptDiffError: '',
                sysPromptDiffLines: [],
                sysPromptDiffStats: { added: 0, removed: 0, unchanged: 0 },
                sysPromptDiffTruncated: false,
                sysPromptDiffHasChangesValue: false,
                sysPromptDiffFingerprint: '',
                _sysPromptDiffPreviewRequestToken: null,
                _sysPromptOpenRequestToken: null,
                skillsTargetApp: 'codex',
                skillsRootPath: '',
                skillsList: [],
                skillsSelectedNames: [],
                skillsLoading: false,
                skillsDeleting: false,
                skillsKeyword: '',
                skillsStatusFilter: 'all',
                skillsImportList: [],
                skillsImportSelectedKeys: [],
                skillsScanningImports: false,
                skillsImporting: false,
                skillsZipImporting: false,
                skillsExporting: false,
                skillsMarketLoading: false,
                skillsMarketLocalLoadedOnce: false,
                skillsMarketImportLoadedOnce: false,
                sessionPinnedMap: {},
                __mainTabSwitchState: {
                    intent: '',
                    pendingTarget: '',
                    pendingConfigMode: '',
                    ticket: 0
                },
                sessionsViewMode: 'browser',
                sessionsUsageTimeRange: '7d',
                sessionsUsageList: [],
                sessionsUsageCompareEnabled: false,
                sessionsUsageSelectedDayKey: '',
                sessionsUsageLoadedOnce: false,
                sessionsUsageLoadedLimit: 0,
                sessionsUsageLoading: false,
                sessionsUsageError: '',
                sessionsList: [],
                sessionsLoadedOnce: false,
                sessionsLoading: false,
                sessionFilterSource: 'all',
                sessionPathFilter: '',
                sessionQuery: '',
                sessionRoleFilter: 'all',
                sessionTimePreset: 'all',
                sessionSortMode: 'time',
                sessionPathOptions: [],
                sessionPathOptionsLoading: false,
                sessionPathOptionsMap: {
                    all: [],
                    codex: [],
                    claude: [],
                    gemini: []
                },
                sessionPathOptionsLoadedMap: {
                    all: false,
                    codex: false,
                    claude: false,
                    gemini: false
                },
                sessionPathRequestSeqMap: {
                    all: 0,
                    codex: 0,
                    claude: 0,
                    gemini: 0
                },
                sessionExporting: {},
                sessionConverting: {},
                sessionImportingNative: {},
                sessionCloning: {},
                sessionDeleting: {},
                sessionDeletingSelected: false,
                sessionBatchSelectMode: false,
                sessionSelectedKeys: {},
                activeSession: null,
                activeSessionMessages: [],
                activeSessionDetailError: '',
                activeSessionDetailClipped: false,
                sessionDetailLoading: false,
                sessionDetailRequestSeq: 0,
                sessionDetailInitialMessageLimit: 300,
                sessionDetailFetchStep: 300,
                sessionDetailMessageLimit: 80,
                sessionDetailMessageLimitCap: 1000,
                sessionTimelineActiveKey: '',
                sessionTimelineRafId: 0,
                sessionTimelineLastSyncAt: 0,
                sessionTimelineLastScrollTop: 0,
                sessionTimelineLastAnchorY: 0,
                sessionTimelineLastDirection: 0,
                sessionTimelineEnabled: true,
                sessionTimelineStyle: 'dots',
                sessionMessageRefMap: Object.create(null),
                sessionMessageRefBinderMap: Object.create(null),
                sessionPreviewScrollEl: null,
                sessionPreviewContainerEl: null,
                sessionPreviewHeaderEl: null,
                sessionPreviewHeaderResizeObserver: null,
                sessionListRenderEnabled: false,
                preserveSessionRenderOnTabLeave: true,
                sessionListVisibleCount: 0,
                sessionListInitialBatchSize: 40,
                sessionListLoadStep: 80,
                sessionPreviewRenderEnabled: false,
                sessionTabRenderTicket: 0,
                sessionPreviewVisibleCount: 0,
                sessionPreviewInitialBatchSize: 12,
                sessionPreviewLoadStep: 24,
                sessionPreviewPendingVisibleCount: 0,
                sessionPreviewLoadingMore: false,
                sessionStandalone: false,
                sessionStandaloneError: '',
                sessionStandaloneText: '',
                sessionStandaloneTitle: '',
                sessionStandaloneSourceLabel: '',
                sessionStandaloneLoading: false,
                sessionStandaloneRequestSeq: 0,
                speedResults: {},
                speedLoading: {},
                claudeSpeedResults: {},
                claudeSpeedLoading: {},
                claudeShareLoading: {},
                providerShareLoading: {},
                shareCommandPrefix: 'npm start',
                providerSwitchInProgress: false,
                pendingProviderSwitch: '',
                providerSwitchDisplayTarget: '',
                healthCheckBatchTotal: 0,
                healthCheckBatchDone: 0,
                healthCheckBatchFailed: 0,
                healthCheckFailedProviderSelections: {},
                healthCheckFailedProviderDeleting: false,
                installPackageManager: 'npm',
                installCommandAction: 'install',
                installRegistryPreset: 'npmmirror',
                installRegistryCustom: '',
                installStatusTargets: null,
                appLatestVersion: '',
                appVersionStatusLoading: false,
                appVersionStatusError: '',
                appVersionStatusChecked: false,
                appVersionStatusCheckedAt: '',
                appVersionStatusSource: '',
                newProvider: { name: '', url: '', key: '', model: '', useTransform: false },
                resetConfigLoading: false,
                editingProvider: { name: '', url: '', key: '', readOnly: false, nonEditable: false, useTransform: false },
                newModelName: '',
                currentClaudeConfig: '',
                currentClaudeModel: '',
                claudeCustomModelDraft: '',
                editingConfig: { name: '', apiKey: '', baseUrl: '', model: '', targetApi: 'responses' },
                claudeConfigs: {
                    '智谱GLM': {
                        apiKey: '',
                        baseUrl: 'https://open.bigmodel.cn/api/anthropic',
                        model: 'glm-4.7',
                        targetApi: 'responses',
                        hasKey: false
                    }
                },
                newClaudeConfig: {
                    name: '',
                    apiKey: '',
                    baseUrl: '',
                    model: '',
                    targetApi: 'responses'
                },
                currentOpenclawConfig: '',
                openclawConfigs: {
                    '默认配置': {
                        content: DEFAULT_OPENCLAW_TEMPLATE,
                        isDefault: true
                    }
                },
                openclawEditing: { name: '', content: '', lockName: false },
                openclawEditorTitle: '添加 OpenClaw 配置',
                openclawConfigPath: '',
                openclawConfigExists: false,
                openclawLineEnding: '\n',
                openclawAuthProfilesByProvider: {},
                openclawPendingAuthProfileUpdates: {},
                openclawFileLoading: false,
                openclawSaving: false,
                openclawApplying: false,
                openclawWorkspaceFileName: 'SOUL.md',
                agentsWorkspaceFileName: '',
                openclawStructured: {
                    agentPrimary: '',
                    agentFallbacks: [],
                    workspace: '',
                    timeout: '',
                    contextTokens: '',
                    maxConcurrent: '',
                    envItems: [],
                    toolsProfile: 'default',
                    toolsAllow: [],
                    toolsDeny: []
                },
                openclawQuick: {
                    providerName: '',
                    baseUrl: '',
                    baseUrlReadOnly: false,
                    baseUrlDisplayKind: 'missing',
                    apiKey: '',
                    apiKeyReadOnly: false,
                    apiKeyDisplayKind: 'missing',
                    apiKeySourceKind: '',
                    apiKeySourceProfileId: '',
                    apiKeySourceWriteField: '',
                    apiKeySourceOriginalValue: '',
                    apiKeySourceCredentialType: '',
                    apiType: 'openai-responses',
                    modelId: '',
                    modelName: '',
                    contextWindow: '',
                    maxTokens: '',
                    setPrimary: true,
                    overrideProvider: true,
                    overrideModels: true,
                    showKey: false
                },
                openclawAccordionStep: 1,
                openclawValidation: {
                    providerName: { valid: true, message: '' },
                    modelId: { valid: true, message: '' }
                },
                openclawAgentsList: [],
                openclawProviders: [],
                openclawMissingProviders: [],
                healthCheckLoading: false,
                healthCheckResult: null,
                healthCheckRemote: false,
                providersHealthLoading: false,
                providersHealthResult: null,
                claudeDownloadLoading: false,
                claudeDownloadProgress: 0,
                claudeDownloadTimer: null,
                codexDownloadLoading: false,
                codexDownloadProgress: 0,
                codexDownloadTimer: null,
                providerCacheRecords: { root: '', generatedAt: '', groups: [] },
                providerCacheLoadedOnce: false,
                providerCacheLoadedAt: '',
                providerCacheLoading: false,
                providerCacheSyncing: false,
                providerCacheSyncMessage: '',
                providerCacheError: '',
                providerCacheRequestSeq: 0,
                settingsTab: 'general',
                toolConfigPermissions: { codex: false, claude: false, opencode: false, kilocode: false, openclaw: false, pi: false },
                toolConfigPermissionSaving: { codex: false, claude: false, opencode: false, kilocode: false, openclaw: false, pi: false },
                sessionTrashEnabled: true,
                sessionTrashItems: [],
                sessionTrashVisibleCount: SESSION_TRASH_PAGE_SIZE,
                sessionTrashTotalCount: 0,
                sessionTrashCountLoadedOnce: false,
                sessionTrashLoadedOnce: false,
                sessionTrashLastLoadFailed: false,
                sessionTrashCountRequestToken: 0,
                sessionTrashListRequestToken: 0,
                sessionTrashCountPendingOptions: null,
                sessionTrashPendingOptions: null,
                sessionTrashCountLoading: false,
                sessionTrashLoading: false,
                sessionTrashRestoring: {},
                sessionTrashPurging: {},
                sessionTrashClearing: false,
                sessionTrashRetentionDays: 30,
                claudeImportLoading: false,
                codexImportLoading: false,
                codexAuthProfiles: [],
                opencodeConfigPath: '',
                opencodeProviderStorePath: '',
                opencodeConfigExists: false,
                opencodeContent: '{}',
                opencodeLoading: false,
                opencodeSaving: false,
                opencodeApplying: false,
                opencodeError: '',
                opencodeImportError: '',
                opencodeImportFileName: '',
                opencodeProviders: [],
                opencodeAgents: [],
                opencodeProvider: 'anthropic',
                opencodeModel: '',
                opencodeApiKey: '',
                opencodeShowKey: false,
                opencodeProviderDisabled: false,
                opencodeAgent: 'build',
                opencodeApplyToCoreAgents: true,
                opencodeAutoCompact: true,
                opencodeMaxTokens: '',
                opencodeReasoningEffort: '',
                kilocodeConfigPath: '',
                kilocodeConfigExists: false,
                kilocodeContent: '{}\n',
                kilocodeLoading: false,
                kilocodeSaving: false,
                kilocodeStarting: false,
                kilocodeError: '',
                kilocodeProviders: [],
                kilocodeProvider: 'codexmate',
                kilocodeBaseUrl: '',
                kilocodeModel: 'gpt-5.3',
                kilocodeApiKey: '',
                kilocodeShowKey: false,
                kilocodeAutoSaveSignature: '',
                forceCompactLayout: false,
                sidebarCollapsed: false,
                sessionLoadNativeDialog: false,
                starPrompted: false,
                webhookConfig: { enabled: false, url: '', events: ['provider-switch', 'claude-md-edit'] },
                webhookEventOptions: ['provider-switch', 'claude-md-edit'],
                webhookSaving: false,
                webhookTestResult: null,
                webhookTesting: false,
            };
        },

        mounted() {
            // URL 规范化：将 /web-ui/* 重定向到根路径 /
            try {
                const pathname = window.location.pathname;
                if (pathname === '/web-ui' || pathname === '/web-ui/' || pathname === '/web-ui/index.html') {
                    const url = new URL(window.location.href);
                    url.pathname = '/';
                    // Preserve startup query/hash flags while normalizing the legacy web-ui path.
                    window.location.replace(url.toString());
                    return;
                }
                // Do not strip query/hash during startup: /session uses them to identify the
                // standalone session, and shareable tab/filter URLs are consumed below before
                // later runtime canonicalization can clean the address bar.
            } catch (_) {}

            if (typeof this.initI18n === 'function') {
                this.initI18n();
            }
            if (typeof this.loadWebhookSettings === 'function') {
                this.loadWebhookSettings();
            }
            if (typeof this.loadWebUiPreferences === 'function') {
                const applyPreferenceNavigation = (() => {
                    try {
                        const url = new URL(window.location.href);
                        if (url.pathname === '/session') return false;
                        return !String(url.searchParams.get('tab') || '').trim();
                    } catch (_) {
                        return true;
                    }
                })();
                void this.loadWebUiPreferences({ applyNavigation: applyPreferenceNavigation });
            }
            if (typeof this.t === 'function') {
                this.confirmDialogConfirmText = this.t('confirm.ok');
                this.confirmDialogCancelText = this.t('confirm.cancel');
                this.agentsModalTitle = this.t('modal.agents.title');
                this.agentsModalHint = this.t('modal.agents.hint');
            }
            {
                const mainTabSet = new Set(['dashboard', 'config', 'sessions', 'usage', 'market', 'plugins', 'docs', 'settings', 'trash', 'prompts']);
                let urlMainTab = '';
                try {
                    const url = new URL(window.location.href);
                    if (url.pathname !== '/session') {
                        urlMainTab = String(url.searchParams.get('tab') || '').trim().toLowerCase();
                    }
                } catch (_) {
                    urlMainTab = '';
                }
                let resolvedMainTab = urlMainTab && mainTabSet.has(urlMainTab) ? urlMainTab : '';
                if (typeof this.isMainTabDisabled === 'function' && this.isMainTabDisabled(resolvedMainTab)) {
                    resolvedMainTab = typeof this.getFirstSelectableMainTab === 'function'
                        ? this.getFirstSelectableMainTab()
                        : 'dashboard';
                }
                if (resolvedMainTab && mainTabSet.has(resolvedMainTab) && resolvedMainTab !== this.mainTab) {
                    this.__navStateRestoring = true;
                    try {
                        this.switchMainTab(resolvedMainTab);
                    } finally {
                        this.__navStateRestoring = false;
                    }
                }
            }
            this.initSessionStandalone();
            this.updateCompactLayoutMode();
            if (typeof this.isMainTabDisabled === 'function' && this.isMainTabDisabled(this.mainTab)) {
                const fallbackTab = typeof this.getFirstSelectableMainTab === 'function'
                    ? this.getFirstSelectableMainTab()
                    : 'dashboard';
                this.switchMainTab(fallbackTab);
            }
            this.restoreSessionFilterCache();
            this.restoreSessionPinnedMap();
            window.addEventListener('resize', this.onWindowResize);
            window.addEventListener('keydown', this.handleGlobalKeydown);
            window.addEventListener('beforeunload', this.handleBeforeUnload);
            if (typeof this.normalizeStoredClaudeConfigs === 'function') {
                const claudeConfigsChanged = this.normalizeStoredClaudeConfigs();
                if (claudeConfigsChanged && typeof this.persistWebUiPreferences === 'function') {
                    this.persistWebUiPreferences({
                        claudeConfigs: this.claudeConfigs,
                        currentClaudeConfig: this.currentClaudeConfig || ''
                    });
                }
            }
            if (!this.currentClaudeConfig) {
                const claudeConfigNames = Object.keys(this.claudeConfigs || {});
                if (claudeConfigNames.length > 0) {
                    this.currentClaudeConfig = claudeConfigNames[0];
                }
            }
            if (this.currentClaudeConfig && !this.currentClaudeModel) {
                const initialClaudeConfig = this.claudeConfigs[this.currentClaudeConfig];
                this.currentClaudeModel = initialClaudeConfig && initialClaudeConfig.model ? initialClaudeConfig.model : '';
            }
            const normalizeOpenclawConfigs = (configs) => {
                const source = configs && typeof configs === 'object' && !Array.isArray(configs)
                    ? configs
                    : {};
                const defaultEntry = source['默认配置']
                    && typeof source['默认配置'] === 'object'
                    && !Array.isArray(source['默认配置'])
                        ? source['默认配置']
                        : { content: DEFAULT_OPENCLAW_TEMPLATE };
                const normalized = {
                    '默认配置': {
                        content: typeof defaultEntry.content === 'string' ? defaultEntry.content : DEFAULT_OPENCLAW_TEMPLATE,
                        isDefault: true
                    }
                };
                for (const [name, value] of Object.entries(source)) {
                    if (name === '默认配置') continue;
                    normalized[name] = value;
                }
                return normalized;
            };
            this.openclawConfigs = normalizeOpenclawConfigs(this.openclawConfigs);
            const configNames = Object.keys(this.openclawConfigs);
            if (configNames.length > 0) {
                this.currentOpenclawConfig = this.openclawConfigs['默认配置'] ? '默认配置' : configNames[0];
            }
            const runInitialLoad = () => {
                const triggerLoad = async () => {
                    this._initialLoadTimer = 0;
                    const startupOk = await this.loadAll();
                    if (!startupOk) {
                        return;
                    }
                    if (this.mainTab === 'dashboard') {
                        if (!this.__doctorLoadedOnce) {
                            this.__doctorLoadedOnce = true;
                            if (typeof this.runHealthCheck === 'function') {
                                void this.runHealthCheck({ doctor: true, silent: true });
                            }
                            if (typeof this.runProvidersHealthCheck === 'function') {
                                void this.runProvidersHealthCheck({ remote: true });
                            }
                        }
                    }
                    if (typeof this.loadAppVersionStatus === 'function') {
                        void this.loadAppVersionStatus({ silent: true });
                    }
                    if (typeof this.hydrateClaudeConfigsFromProviderCache === 'function') {
                        await this.hydrateClaudeConfigsFromProviderCache({ silent: true });
                    }
                    void this.refreshClaudeSelectionFromSettings({ silent: true });
                    void this.syncDefaultOpenclawConfigEntry({ silent: true });
                    if (typeof this.loadProviderCacheRecords === 'function') {
                        void this.loadProviderCacheRecords({ background: true });
                    }
                };
                if (typeof requestAnimationFrame === 'function') {
                    this._initialLoadRafId = requestAnimationFrame(() => {
                        this._initialLoadRafId = 0;
                        if (typeof setTimeout === 'function') {
                            this._initialLoadTimer = setTimeout(triggerLoad, 120);
                            return;
                        }
                        triggerLoad();
                    });
                    return;
                }
                if (typeof setTimeout === 'function') {
                    this._initialLoadTimer = setTimeout(triggerLoad, 120);
                    return;
                }
                triggerLoad();
            };
            if (document.readyState === 'complete') {
                runInitialLoad();
            } else {
                this._initialLoadOnWindowLoad = () => {
                    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
                        window.removeEventListener('load', this._initialLoadOnWindowLoad);
                    }
                    this._initialLoadOnWindowLoad = null;
                    runInitialLoad();
                };
                window.addEventListener('load', this._initialLoadOnWindowLoad, { once: true });
            }
        },

        beforeUnmount() {
            this.teardownSessionTabRender();
            this.cancelScheduledSessionTabDeferredTeardown();
            this.disconnectSessionPreviewHeaderResizeObserver();
            if (this._initialLoadOnWindowLoad) {
                window.removeEventListener('load', this._initialLoadOnWindowLoad);
                this._initialLoadOnWindowLoad = null;
            }
            if (this._initialLoadRafId) {
                cancelAnimationFrame(this._initialLoadRafId);
                this._initialLoadRafId = 0;
            }
            if (this._initialLoadTimer) {
                clearTimeout(this._initialLoadTimer);
                this._initialLoadTimer = 0;
            }
            if (this.__webUiPreferencesPersistTimer) {
                if (typeof this.flushWebUiPreferences === 'function') {
                    this.flushWebUiPreferences();
                } else {
                    clearTimeout(this.__webUiPreferencesPersistTimer);
                    this.__webUiPreferencesPersistTimer = 0;
                }
            }
            window.removeEventListener('resize', this.onWindowResize);
            window.removeEventListener('keydown', this.handleGlobalKeydown);
            window.removeEventListener('beforeunload', this.handleBeforeUnload);
            this.applyCompactLayoutClass(false);
            this.sessionPreviewScrollEl = null;
            this.sessionPreviewContainerEl = null;
            this.sessionPreviewHeaderEl = null;
            this.clearSessionTimelineRefs();
        },

        watch: {
            mainTab(newTab) {
                if (typeof this.isMainTabDisabled === 'function' && this.isMainTabDisabled(newTab)) {
                    const fallbackTab = typeof this.getFirstSelectableMainTab === 'function'
                        ? this.getFirstSelectableMainTab()
                        : 'dashboard';
                    if (fallbackTab && fallbackTab !== newTab && typeof this.switchMainTab === 'function') {
                        this.switchMainTab(fallbackTab);
                    }
                    return;
                }
                if (newTab === 'prompts') {
                    if (this.promptsSubTab === 'claude-project' && !this.projectPathOptions.length && !this.projectPathOptionsLoading && typeof this.loadProjectPathOptions === 'function') {
                        this.loadProjectPathOptions();
                    }
                    if (this.promptsSubTab === 'system') {
                        if (typeof this.loadSystemPrompt === 'function') this.loadSystemPrompt();
                    } else if (typeof this.loadPromptsContent === 'function') {
                        this.loadPromptsContent();
                    }
                }
            },
            promptsSubTab(newVal) {
                if (typeof this.persistWebUiPreferences === 'function') {
                    this.persistWebUiPreferences({ promptsSubTab: newVal });
                }
                if (this.__skipNextPromptsSubTabLoad) {
                    this.__skipNextPromptsSubTabLoad = false;
                    return;
                }
                if (this.mainTab === 'prompts') {
                    if (this.promptsSubTab === 'system') {
                        if (typeof this.loadSystemPrompt === 'function') this.loadSystemPrompt();
                    } else if (typeof this.loadPromptsContent === 'function') {
                        this.loadPromptsContent();
                    }
                }
            },
            projectClaudeMdPath(newPath) {
                if (typeof this.persistWebUiPreferences === 'function') {
                    this.persistWebUiPreferences({ projectClaudeMdPath: newPath || '' });
                }
            },
            sysPromptScope(newVal) {
                if (typeof this.persistWebUiPreferences === 'function') {
                    this.persistWebUiPreferences({ sysPromptScope: newVal });
                }
            },
            sysPromptMode(newVal) {
                if (typeof this.persistWebUiPreferences === 'function') {
                    this.persistWebUiPreferences({ sysPromptMode: newVal });
                }
            }
        },

        watch: {
            configMode(newMode) {
                if (newMode === 'pi' && typeof this.loadPiSources === 'function') {
                    this.loadPiSources();
                }
            }
        },

        computed: createAppComputed(),
        methods: {
            ...createAppMethods(),
            ...(typeof createPiConfigMethods === 'function' ? createPiConfigMethods({ api }) : {})
        }
    };

    if (typeof window.__CODEXMATE_WEB_UI_RENDER__ === 'function') {
        appOptions.render = window.__CODEXMATE_WEB_UI_RENDER__;
    }

    const app = createApp(appOptions);
    app.config.errorHandler = (err, vm, info) => {
        console.error('[Vue error handler]', err, info);
        if (err && err.stack) console.error(err.stack);
        showFatalErrorOverlay('Vue error', err && err.message ? err.message : String(err), err && err.stack ? err.stack : '', info || '');
    };

    try {
        app.mount('#app');
    } catch (error) {
        console.error('Failed to mount Web UI:', error);
        const fallback = document.querySelector('#app');
        if (fallback) {
            fallback.innerHTML = '<pre style="color:red;white-space:pre-wrap;">Failed to mount Web UI\n' + (error && error.stack ? error.stack : String(error)) + '</pre>';
        }
    }
});
