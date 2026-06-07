function normalizeOpencodeProviderName(value) {
    const name = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return /^[a-z0-9_.-]+$/.test(name) ? name : '';
}

function normalizeOpencodeAgentName(value) {
    const name = typeof value === 'string' ? value.trim() : '';
    return /^[a-zA-Z0-9_.-]+$/.test(name) ? name : '';
}

function getOpencodeJsonParser() {
    const root = typeof globalThis !== 'undefined' ? globalThis : {};
    const json5 = root.JSON5 || (root.window && root.window.JSON5);
    if (json5 && typeof json5.parse === 'function') {
        return json5;
    }
    return JSON;
}

function summarizeOpencodeDraft(content) {
    const parsed = getOpencodeJsonParser().parse(content || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('OpenCode config must be a JSON/JSONC object');
    }
    return parsed;
}

export function createOpencodeConfigMethods(options = {}) {
    const { api, modelCatalog = {} } = options;

    return {
        opencodeProviderCatalog() {
            const configured = Array.isArray(this.opencodeProviders)
                ? this.opencodeProviders.map(item => item && item.name).filter(Boolean)
                : [];
            const builtin = Object.keys(modelCatalog || {});
            return [...new Set([...configured, ...builtin])].sort((a, b) => a.localeCompare(b));
        },

        opencodeModelCatalogForProvider(providerName = this.opencodeProvider) {
            const provider = normalizeOpencodeProviderName(providerName);
            const list = provider && Array.isArray(modelCatalog[provider]) ? modelCatalog[provider] : [];
            const configured = Array.isArray(this.opencodeAgents)
                ? this.opencodeAgents.map(item => item && item.model).filter(Boolean)
                : [];
            return [...new Set([...list, ...configured])];
        },

        fillOpencodeProvider(provider) {
            const name = normalizeOpencodeProviderName(provider);
            if (!name) return;
            this.opencodeProvider = name;
            const models = this.opencodeModelCatalogForProvider(name);
            if (!this.opencodeModel || !models.includes(this.opencodeModel)) {
                this.opencodeModel = models[0] || '';
            }
            const selectedProvider = Array.isArray(this.opencodeProviders)
                ? this.opencodeProviders.find(item => normalizeOpencodeProviderName(item && item.name) === name)
                : null;
            this.opencodeProviderDisabled = !!(selectedProvider && selectedProvider.disabled);
        },

        refreshOpencodeSelectionFromSummary(res = {}) {
            const providers = Array.isArray(res.providers) ? res.providers : [];
            const agents = Array.isArray(res.agents) ? res.agents : [];
            this.opencodeProviders = providers;
            this.opencodeAgents = agents;
            const currentAgent = normalizeOpencodeAgentName(res.currentAgent) || 'build';
            this.opencodeAgent = currentAgent;
            const currentModel = typeof res.currentModel === 'string' ? res.currentModel.trim() : '';
            this.opencodeModel = currentModel;
            if (typeof res.autoCompact === 'boolean') {
                this.opencodeAutoCompact = res.autoCompact;
            }
            const enabledProvider = providers.find(item => item && item.disabled !== true && item.hasKey);
            const firstProvider = providers.find(item => item && item.name);
            this.opencodeProvider = normalizeOpencodeProviderName(res.currentProvider)
                || normalizeOpencodeProviderName(enabledProvider && enabledProvider.name)
                || normalizeOpencodeProviderName(firstProvider && firstProvider.name)
                || normalizeOpencodeProviderName(this.opencodeProvider)
                || 'anthropic';
            const selectedProvider = providers.find(item => normalizeOpencodeProviderName(item && item.name) === this.opencodeProvider);
            this.opencodeProviderDisabled = !!(selectedProvider && selectedProvider.disabled);
            const models = this.opencodeModelCatalogForProvider(this.opencodeProvider);
            if (!this.opencodeModel || (models.length && !models.includes(this.opencodeModel))) {
                this.opencodeModel = models[0] || '';
            }
        },

        async loadOpencodeConfig(options = {}) {
            if (this.opencodeLoading) return;
            this.opencodeLoading = true;
            this.opencodeError = '';
            try {
                const res = await api('get-opencode-config');
                if (res && res.error) {
                    this.opencodeError = res.error;
                    return;
                }
                this.opencodeContent = typeof res.content === 'string' ? res.content : '{}';
                this.opencodeConfigPath = typeof res.targetPath === 'string' ? res.targetPath : '';
                this.opencodeProviderStorePath = typeof res.providerStorePath === 'string' ? res.providerStorePath : '';
                this.opencodeConfigExists = res.exists === true;
                this.refreshOpencodeSelectionFromSummary(res || {});
                if (options.toast === true) {
                    this.showMessage('OpenCode 配置已刷新', 'success');
                }
            } catch (e) {
                this.opencodeError = e && e.message ? e.message : '读取 OpenCode 配置失败';
            } finally {
                this.opencodeLoading = false;
            }
        },

        parseOpencodeImportContent(content, fileName = '') {
            const raw = typeof content === 'string' ? content : '';
            if (!raw.trim()) {
                return { error: '导入文件为空' };
            }
            try {
                const parsed = summarizeOpencodeDraft(raw);
                const pretty = JSON.stringify(parsed, null, 2) + '\n';
                return { content: pretty, fileName };
            } catch (e) {
                return { error: `OpenCode JSON/JSONC 解析失败: ${e.message}` };
            }
        },

        async handleOpencodeImportChange(event) {
            const input = event && event.target ? event.target : null;
            const file = input && input.files && input.files[0] ? input.files[0] : null;
            if (!file) return;
            this.opencodeImportError = '';
            try {
                const content = await file.text();
                const parsed = this.parseOpencodeImportContent(content, file.name || '');
                if (parsed.error) {
                    this.opencodeImportError = parsed.error;
                    this.showMessage(parsed.error, 'error');
                    return;
                }
                this.opencodeContent = parsed.content;
                this.opencodeImportFileName = parsed.fileName;
                this.showMessage('已解析 OpenCode 配置，确认后可保存', 'success');
            } catch (e) {
                this.opencodeImportError = e && e.message ? e.message : '读取导入文件失败';
                this.showMessage(this.opencodeImportError, 'error');
            } finally {
                if (input) input.value = '';
            }
        },

        async saveOpencodeConfig() {
            if (this.opencodeSaving) return;
            if (!this.isToolConfigWriteAllowed('opencode')) {
                this.showMessage('请先打开 OpenCode 写入开关', 'error');
                return;
            }
            this.opencodeSaving = true;
            this.opencodeError = '';
            try {
                const res = await api('apply-opencode-config', { content: this.opencodeContent });
                if (res && res.error) {
                    this.opencodeError = res.error;
                    this.showMessage(res.error, 'error');
                    return;
                }
                this.opencodeConfigExists = true;
                if (res && typeof res.targetPath === 'string') this.opencodeConfigPath = res.targetPath;
                if (res && typeof res.providerStorePath === 'string') this.opencodeProviderStorePath = res.providerStorePath;
                this.refreshOpencodeSelectionFromSummary(res || {});
                this.showMessage('OpenCode 配置已保存', 'success');
                await this.loadOpencodeConfig();
            } catch (e) {
                this.opencodeError = e && e.message ? e.message : '保存 OpenCode 配置失败';
                this.showMessage(this.opencodeError, 'error');
            } finally {
                this.opencodeSaving = false;
            }
        },

        async applyOpencodeSelection() {
            if (this.opencodeApplying) return;
            if (!this.isToolConfigWriteAllowed('opencode')) {
                this.showMessage('请先打开 OpenCode 写入开关', 'error');
                return;
            }
            const provider = normalizeOpencodeProviderName(this.opencodeProvider);
            const model = typeof this.opencodeModel === 'string' ? this.opencodeModel.trim() : '';
            if (!provider || !model) {
                this.showMessage('请选择 OpenCode provider 和 model', 'error');
                return;
            }
            this.opencodeApplying = true;
            this.opencodeError = '';
            try {
                const res = await api('update-opencode-selection', {
                    provider,
                    model,
                    apiKey: this.opencodeApiKey,
                    agent: this.opencodeAgent || 'build',
                    applyToCoreAgents: this.opencodeApplyToCoreAgents === true,
                    disabled: this.opencodeProviderDisabled === true,
                    autoCompact: this.opencodeAutoCompact !== false,
                    maxTokens: this.opencodeMaxTokens,
                    reasoningEffort: this.opencodeReasoningEffort
                });
                if (res && res.error) {
                    this.opencodeError = res.error;
                    this.showMessage(res.error, 'error');
                    return;
                }
                if (res && typeof res.content === 'string') this.opencodeContent = res.content;
                if (res && typeof res.targetPath === 'string') this.opencodeConfigPath = res.targetPath;
                if (res && typeof res.providerStorePath === 'string') this.opencodeProviderStorePath = res.providerStorePath;
                this.opencodeConfigExists = true;
                this.opencodeApiKey = '';
                this.refreshOpencodeSelectionFromSummary(res || {});
                this.showMessage('OpenCode provider/model 已应用', 'success');
            } catch (e) {
                this.opencodeError = e && e.message ? e.message : '应用 OpenCode 配置失败';
                this.showMessage(this.opencodeError, 'error');
            } finally {
                this.opencodeApplying = false;
            }
        }
    };
}
