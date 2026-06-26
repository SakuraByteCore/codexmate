import { nextClaudeConfigName } from './provider-default-names.mjs';

function normalizeClaudeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeClaudeBaseUrl(value) {
    return normalizeClaudeText(value).replace(/\/+$/g, '');
}

function isValidClaudeHttpUrl(value) {
    if (!value) return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function getClaudeConfigValidationForContext(vm, mode = 'add') {
    const draft = mode === 'edit' ? vm.editingConfig : vm.newClaudeConfig;
    const name = normalizeClaudeText(draft && draft.name);
    const apiKey = normalizeClaudeText(draft && draft.apiKey);
    const providerCacheRef = normalizeClaudeText(draft && draft.providerCacheRef);
    const externalCredentialType = normalizeClaudeText(draft && draft.externalCredentialType);
    const baseUrl = normalizeClaudeBaseUrl(draft && draft.baseUrl);
    const model = normalizeClaudeText(draft && draft.model);
    const targetApiRaw = normalizeClaudeText(draft && draft.targetApi).toLowerCase();
    const targetApi = targetApiRaw === 'chat_completions' || targetApiRaw === 'chat-completions' || targetApiRaw === 'chat/completions'
        ? 'chat_completions'
        : (targetApiRaw === 'ollama' ? 'ollama' : 'responses');
    const errors = {
        name: '',
        apiKey: '',
        baseUrl: '',
        model: ''
    };

    if (!name) {
        errors.name = vm.t('validation.claude.nameRequired');
    } else if (mode === 'add' && vm.claudeConfigs && vm.claudeConfigs[name]) {
        errors.name = vm.t('validation.claude.nameExists');
    }

    if (!apiKey && !externalCredentialType && !providerCacheRef && targetApi !== 'ollama') {
        errors.apiKey = vm.t('validation.claude.apiKeyRequired');
    }

    if (!baseUrl) {
        errors.baseUrl = vm.t('validation.claude.baseUrlRequired');
    } else if (!isValidClaudeHttpUrl(baseUrl)) {
        errors.baseUrl = vm.t('validation.claude.baseUrlHttpOnly');
    }

    if (!model) {
        errors.model = vm.t('validation.claude.modelRequired');
    }

    return {
        mode,
        name,
        apiKey,
        providerCacheRef,
        externalCredentialType,
        baseUrl,
        model,
        targetApi,
        errors,
        ok: !errors.name && !errors.apiKey && !errors.baseUrl && !errors.model
    };
}

export function createClaudeConfigMethods(options = {}) {
    const { api } = options;

    return {
        switchClaudeConfig(name) {
            this.currentClaudeConfig = name;
            try { localStorage.setItem('currentClaudeConfig', name || ''); } catch (_) {}
            this.refreshClaudeModelContext();
        },

        onClaudeModelChange() {
            const name = this.currentClaudeConfig;
            if (!name || name === 'claude-local') {
                return;
            }
            const model = (this.currentClaudeModel || '').trim();
            if (!model) {
                this.showMessage(this.t('toast.claude.modelRequired'), 'error');
                return;
            }
            const existing = this.claudeConfigs[name] || {};
            this.currentClaudeModel = model;
            this.claudeCustomModelDraft = model;
            this.claudeConfigs[name] = this.mergeClaudeConfig(existing, { model });
            this.saveClaudeConfigs();
            this.updateClaudeModelsCurrent();
            if (!this.claudeConfigs[name].apiKey && !this.claudeConfigs[name].externalCredentialType && this.claudeConfigs[name].targetApi !== 'ollama') {
                this.showMessage(this.t('toast.claude.apiKeyRequired'), 'error');
                return;
            }
            this.applyClaudeConfig(name);
        },

        onClaudeCustomModelSubmit() {
            this.onClaudeModelChange();
        },

        saveClaudeConfigs() {
            try { localStorage.setItem('claudeConfigs', JSON.stringify(this.claudeConfigs)); } catch (_) {}
            if (this.currentClaudeConfig) {
                try { localStorage.setItem('currentClaudeConfig', this.currentClaudeConfig); } catch (_) {}
            }
            this.syncClaudeBridgeProviders();
        },

        async hydrateClaudeConfigsFromProviderCache(options = {}) {
            const silent = options && options.silent === true;
            try {
                const res = await api('get-claude-provider-cache-configs');
                if (!res || res.error) {
                    if (!silent) this.showMessage((res && res.error) || this.t('toast.claude.loadSettingsFail'), 'error');
                    return false;
                }
                const providers = Array.isArray(res.providers) ? res.providers : [];
                const configs = this.claudeConfigs && typeof this.claudeConfigs === 'object' ? this.claudeConfigs : {};
                let changed = false;
                let firstCachedName = '';
                const liveCacheRefs = new Set();
                for (const provider of providers) {
                    if (!provider || typeof provider !== 'object') continue;
                    const name = normalizeClaudeText(provider.name);
                    const baseUrl = normalizeClaudeBaseUrl(provider.baseUrl);
                    const model = normalizeClaudeText(provider.model);
                    if (!name || !baseUrl || !model) continue;
                    if (!firstCachedName) firstCachedName = name;
                    const providerCacheRef = normalizeClaudeText(provider.providerCacheRef) || name;
                    liveCacheRefs.add(name);
                    liveCacheRefs.add(providerCacheRef);
                    const cachedConfig = {
                        apiKey: '',
                        baseUrl,
                        model,
                        hasKey: provider.hasKey === true,
                        providerCacheRef,
                        source: 'provider-cache',
                        targetApi: normalizeClaudeText(provider.targetApi) || 'responses'
                    };
                    const existing = configs[name];
                    if (existing && existing.source !== 'provider-cache' && existing.providerCacheRef !== cachedConfig.providerCacheRef) {
                        continue;
                    }
                    if (JSON.stringify(existing || {}) !== JSON.stringify(cachedConfig)) {
                        configs[name] = cachedConfig;
                        changed = true;
                    }
                }
                for (const [name, existing] of Object.entries(configs)) {
                    if (!existing || typeof existing !== 'object') continue;
                    const providerCacheRef = normalizeClaudeText(existing.providerCacheRef);
                    const source = normalizeClaudeText(existing.source);
                    const cacheBacked = source === 'provider-cache' || !!providerCacheRef;
                    if (!cacheBacked) continue;
                    const ref = providerCacheRef || normalizeClaudeText(name);
                    if (liveCacheRefs.has(ref) || liveCacheRefs.has(normalizeClaudeText(name))) continue;
                    delete configs[name];
                    changed = true;
                }
                this.claudeConfigs = configs;
                const current = normalizeClaudeText(this.currentClaudeConfig);
                if (current && !configs[current]) {
                    this.currentClaudeConfig = firstCachedName || Object.keys(configs)[0] || '';
                    try { localStorage.setItem('currentClaudeConfig', this.currentClaudeConfig); } catch (_) {}
                    changed = true;
                } else if (firstCachedName) {
                    let savedCurrent = '';
                    try { savedCurrent = localStorage.getItem('currentClaudeConfig') || ''; } catch (_) {}
                    const currentConfig = current && configs[current] ? configs[current] : null;
                    if (!savedCurrent && (!current || (currentConfig && currentConfig.hasKey === false && !currentConfig.providerCacheRef))) {
                        this.currentClaudeConfig = firstCachedName;
                        try { localStorage.setItem('currentClaudeConfig', firstCachedName); } catch (_) {}
                        changed = true;
                    }
                }
                if (changed) this.saveClaudeConfigs();
                return true;
            } catch (e) {
                if (!silent) this.showMessage(e && e.message ? e.message : this.t('toast.claude.loadSettingsFail'), 'error');
                return false;
            }
        },

        async syncClaudeBridgeProviders() {
            try { await api('claude-local-bridge-sync-providers', { providers: this.claudeConfigs || {} }); } catch (_) {}
        },

        openCloneClaudeConfigModal(name, config) {
            this.newClaudeConfig = {
                name: '',
                apiKey: config.apiKey || '',
                externalCredentialType: config.externalCredentialType || '',
                baseUrl: config.baseUrl || '',
                model: config.model || '',
                targetApi: config.targetApi || 'responses'
            };
            this.showAddClaudeConfigKey = false;
            this.showClaudeConfigModal = true;
        },

        getClaudeConfigValidation(mode = 'add') {
            return getClaudeConfigValidationForContext(this, mode);
        },

        claudeConfigFieldError(mode, fieldName) {
            const validation = getClaudeConfigValidationForContext(this, mode);
            return validation && validation.errors && typeof validation.errors[fieldName] === 'string'
                ? validation.errors[fieldName]
                : '';
        },

        canSubmitClaudeConfig(mode = 'add') {
            return getClaudeConfigValidationForContext(this, mode).ok;
        },

        openEditConfigModal(name) {
            const config = this.claudeConfigs[name];
            this.editingConfig = {
                name: name,
                apiKey: config.apiKey || '',
                externalCredentialType: config.externalCredentialType || '',
                baseUrl: config.baseUrl || '',
                model: config.model || '',
                targetApi: config.targetApi || 'responses'
            };
            if (config.providerCacheRef) this.editingConfig.providerCacheRef = config.providerCacheRef;
            this.showEditClaudeConfigKey = false;
            this.showEditConfigModal = true;
        },

        updateConfig() {
            const validation = getClaudeConfigValidationForContext(this, 'edit');
            if (!validation.ok) {
                return this.showMessage(validation.errors.name || validation.errors.apiKey || validation.errors.baseUrl || validation.errors.model || this.t('toast.claude.checkConfig'), 'error');
            }
            const name = validation.name;
            this.editingConfig.apiKey = validation.apiKey;
            if (validation.providerCacheRef) this.editingConfig.providerCacheRef = validation.providerCacheRef;
            else delete this.editingConfig.providerCacheRef;
            this.editingConfig.externalCredentialType = validation.externalCredentialType;
            this.editingConfig.baseUrl = validation.baseUrl;
            this.editingConfig.model = validation.model;
            this.editingConfig.targetApi = validation.targetApi;
            this.claudeConfigs[name] = this.mergeClaudeConfig(this.claudeConfigs[name], this.editingConfig);
            this.saveClaudeConfigs();
            this.showMessage(this.t('toast.operation.success'), 'success');
            this.closeEditConfigModal();
            if (name === this.currentClaudeConfig) {
                this.refreshClaudeModelContext();
            }
        },

        closeEditConfigModal() {
            this.showEditConfigModal = false;
            this.showEditClaudeConfigKey = false;
            this.editingConfig = { name: '', apiKey: '', externalCredentialType: '', baseUrl: '', model: '', targetApi: 'responses' };
        },

        toggleEditClaudeConfigKey() {
            this.showEditClaudeConfigKey = !this.showEditClaudeConfigKey;
        },

        async saveAndApplyConfig() {
            const validation = getClaudeConfigValidationForContext(this, 'edit');
            if (!validation.ok) {
                return this.showMessage(validation.errors.name || validation.errors.apiKey || validation.errors.baseUrl || validation.errors.model || this.t('toast.claude.checkConfig'), 'error');
            }
            const name = validation.name;
            this.editingConfig.apiKey = validation.apiKey;
            if (validation.providerCacheRef) this.editingConfig.providerCacheRef = validation.providerCacheRef;
            else delete this.editingConfig.providerCacheRef;
            this.editingConfig.externalCredentialType = validation.externalCredentialType;
            this.editingConfig.baseUrl = validation.baseUrl;
            this.editingConfig.model = validation.model;
            this.editingConfig.targetApi = validation.targetApi;
            this.claudeConfigs[name] = this.mergeClaudeConfig(this.claudeConfigs[name], this.editingConfig);
            this.saveClaudeConfigs();

            const config = this.claudeConfigs[name];
            if (!config.apiKey && !config.providerCacheRef && config.targetApi !== 'ollama') {
                this.showMessage(this.t('toast.claude.savedWithoutKey'), 'info');
                this.closeEditConfigModal();
                if (name === this.currentClaudeConfig) {
                    this.refreshClaudeModelContext();
                }
                return;
            }

            const _claudeKey = `${name}|${config.apiKey || ""}|${config.providerCacheRef || ""}|${config.baseUrl || ""}|${config.model || ""}|${config.targetApi || "responses"}`;
            try {
                const res = await api('apply-claude-config', { config: { ...config, name } });
                if (res.error || res.success === false) {
                    this.showMessage(res.error || this.t('toast.apply.fail'), 'error');
                } else {
                    this.currentClaudeConfig = name;
                    if (this._lastAppliedClaudeKey !== _claudeKey) {
                        this.showMessage(this.t('toast.claude.applied'), 'success');
                        this._lastAppliedClaudeKey = _claudeKey;
                    }
                    this.closeEditConfigModal();
                    this.refreshClaudeModelContext();
                }
            } catch (_) {
                this.showMessage(this.t('toast.apply.fail'), 'error');
            }
        },

        async addClaudeConfig() {
            const validation = getClaudeConfigValidationForContext(this, 'add');
            if (!validation.ok) {
                return this.showMessage(validation.errors.name || validation.errors.apiKey || validation.errors.baseUrl || validation.errors.model || this.t('toast.claude.checkConfig'), 'error');
            }
            this.newClaudeConfig.name = validation.name;
            this.newClaudeConfig.apiKey = validation.apiKey;
            if (validation.providerCacheRef) this.newClaudeConfig.providerCacheRef = validation.providerCacheRef;
            else delete this.newClaudeConfig.providerCacheRef;
            this.newClaudeConfig.externalCredentialType = validation.externalCredentialType;
            this.newClaudeConfig.baseUrl = validation.baseUrl;
            this.newClaudeConfig.model = validation.model;
            this.newClaudeConfig.targetApi = validation.targetApi;
            const name = validation.name;
            const duplicateName = this.findDuplicateClaudeConfigName(this.newClaudeConfig);
            if (duplicateName) {
                return this.showMessage(this.t('toast.claude.exists'), 'info');
            }

            this.claudeConfigs[name] = this.mergeClaudeConfig({}, this.newClaudeConfig);

            this.currentClaudeConfig = name;
            this.saveClaudeConfigs();
            this.closeClaudeConfigModal();
            await this.applyClaudeConfig(name);
        },

        async deleteClaudeProviderCacheRef(configOrName) {
            const config = configOrName && typeof configOrName === 'object'
                ? configOrName
                : (this.claudeConfigs && this.claudeConfigs[configOrName] ? this.claudeConfigs[configOrName] : null);
            const ref = normalizeClaudeText(config && config.providerCacheRef);
            const source = normalizeClaudeText(config && config.source);
            if (!ref && source !== 'provider-cache') return true;
            const name = ref || normalizeClaudeText(config && config.name) || normalizeClaudeText(configOrName);
            if (!name) return true;
            const res = await api('delete-provider-cache-record', { name, group: 'claude' });
            if (res && res.error) {
                this.showMessage(res.error, 'error');
                return false;
            }
            return true;
        },

        async deleteClaudeConfig(name) {
            if (Object.keys(this.claudeConfigs).length <= 1) {
                return this.showMessage(this.t('toast.claude.keepOne'), 'error');
            }
            const confirmed = await this.requestConfirmDialog({
                title: this.t('modal.claudeDelete.title'),
                message: this.t('modal.claudeDelete.message', { name }),
                confirmText: this.t('modal.claudeDelete.confirm'),
                cancelText: this.t('modal.claudeDelete.cancel'),
                danger: true
            });
            if (!confirmed) return;

            const config = this.claudeConfigs[name];
            const cacheDeleted = await this.deleteClaudeProviderCacheRef(config || name);
            if (!cacheDeleted) return;

            delete this.claudeConfigs[name];
            if (this.currentClaudeConfig === name) {
                this.currentClaudeConfig = Object.keys(this.claudeConfigs)[0];
            }
            this.saveClaudeConfigs();
            this.showMessage(this.t('toast.operation.success'), 'success');
            this.refreshClaudeModelContext();
        },

        async applyClaudeConfig(name) {
            this.currentClaudeConfig = name;
            try { localStorage.setItem('currentClaudeConfig', name || ''); } catch (_) {}
            this.refreshClaudeModelContext();
            const config = this.claudeConfigs[name];

            if (!config.apiKey && !config.providerCacheRef && config.targetApi !== 'ollama') {
                if (config.externalCredentialType) {
                    return this.showMessage(this.t('toast.claude.externalAuth'), 'info');
                }
                return this.showMessage(this.t('toast.claude.apiKeyRequired'), 'error');
            }

            const _claudeKey2 = `${name}|${config.apiKey || ""}|${config.providerCacheRef || ""}|${config.baseUrl || ""}|${config.model || ""}|${config.targetApi || "responses"}`;
            try {
                const res = await api('apply-claude-config', { config: { ...config, name } });
                if (res.error || res.success === false) {
                    this.showMessage(res.error || this.t('toast.apply.fail'), 'error');
                } else {
                    if (this._lastAppliedClaudeKey !== _claudeKey2) {
                        this.showMessage(this.t('toast.apply.success'), 'success');
                        this._lastAppliedClaudeKey = _claudeKey2;
                    }
                }
            } catch (_) {
                this.showMessage(this.t('toast.apply.fail'), 'error');
            }
        },

        closeClaudeConfigModal() {
            this.showClaudeConfigModal = false;
            this.showAddClaudeConfigKey = false;
            this.newClaudeConfig = {
                name: nextClaudeConfigName(this.claudeConfigs),
                apiKey: '',
                externalCredentialType: '',
                baseUrl: '',
                model: '',
                targetApi: 'responses'
            };
        },

        toggleAddClaudeConfigKey() {
            this.showAddClaudeConfigKey = !this.showAddClaudeConfigKey;
        },

        async loadClaudeLocalBridgeStatus() {
            try {
                const res = await api('claude-local-bridge-status');
                if (res && !res.error) {
                    if (Array.isArray(res.excludedProviders)) {
                        this.claudeLocalBridgeExcluded = res.excludedProviders;
                    }
                }
            } catch (e) { /* ignore */ }
        },

        async toggleClaudeLocalBridge(enable) {
            try {
                const res = await api('claude-local-bridge-toggle', { enable });
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                if (enable) {
                    this.showMessage(this.t('toast.claude.balanceEnabled'), 'success');
                } else {
                    this.showMessage(this.t('toast.claude.balanceDisabled'), 'success');
                }
            } catch (e) {
                this.showMessage(this.t('toast.operation.fail'), 'error');
            }
        },

        async toggleClaudeLocalBridgeExcluded(providerName) {
            const name = String(providerName || '').trim();
            if (!name) return;
            const idx = this.claudeLocalBridgeExcluded.indexOf(name);
            const next = [...this.claudeLocalBridgeExcluded];
            if (idx >= 0) {
                next.splice(idx, 1);
            } else {
                next.push(name);
            }
            try {
                const res = await api('claude-local-bridge-set-excluded', { names: next });
                if (res && !res.error) {
                    this.claudeLocalBridgeExcluded = next;
                }
            } catch (e) { /* ignore */ }
        },

        isClaudeLocalBridgeExcluded(providerName) {
            return this.claudeLocalBridgeExcluded.indexOf(String(providerName || '').trim()) >= 0;
        },

        claudeLocalBridgeCandidateProviders() {
            return Object.keys(this.claudeConfigs || {}).filter(name => name && !this.isClaudeLocalBridgeExcluded(name))
                .map(name => ({ name, ...this.claudeConfigs[name] }));
        },

        claudeLocalBridgeConfigured() {
            return this.claudeLocalBridgeCandidateProviders().some(p => p.hasKey);
        },

        isClaudeLocalBridgeDisabled() {
            return this.configMode === 'claude';
        },

        async applyClaudeLocalBridge() {
            this.currentClaudeConfig = 'claude-local';
            try { localStorage.setItem('currentClaudeConfig', 'claude-local'); } catch (_) {}
            this.refreshClaudeModelContext();

            const candidates = this.claudeLocalBridgeCandidateProviders();
            if (candidates.length === 0) {
                return this.showMessage(this.t('toast.claude.balanceRequireProvider'), 'error');
            }

            try {
                const res = await api('claude-local-bridge-toggle', { enable: true });
                if (res.error) {
                    this.showMessage(res.error || this.t('toast.claude.balanceEnableFail'), 'error');
                    return;
                }
                this.showMessage(this.t('toast.claude.balanceEnabled'), 'success');
            } catch (e) {
                this.showMessage(this.t('toast.claude.balanceEnableFail'), 'error');
            }
        },

        async openClaudeConfigTemplateEditor() {
            try {
                const res = await api('get-claude-settings-raw');
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                this.configTemplateContent = res.content || '{}';
                this.configTemplateContext = 'claude';
                this.showConfigTemplateModal = true;
            } catch (e) {
                this.showMessage(this.t('toast.claude.loadSettingsFail'), 'error');
            }
        }
    };
}
