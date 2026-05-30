const PROVIDER_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const RESERVED_PROXY_PROVIDER_NAME = 'codexmate-proxy';
const RESERVED_LOCAL_PROVIDER_NAME = 'local';

function normalizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeProviderUrl(value) {
    return normalizeText(value).replace(/\/+$/g, '');
}

function isValidHttpUrl(value) {
    if (!value) return false;
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function isReservedProviderCreationNameInput(name) {
    const normalized = normalizeText(name).toLowerCase();
    return normalized === RESERVED_PROXY_PROVIDER_NAME || normalized === RESERVED_LOCAL_PROVIDER_NAME;
}

function isValidProviderNameInputValue(name) {
    return PROVIDER_NAME_PATTERN.test(normalizeText(name));
}

function isValidProviderUrlInputValue(url) {
    return isValidHttpUrl(normalizeProviderUrl(url));
}

function findProviderByName(list, name) {
    const target = normalizeText(name);
    if (!target) return null;
    return (Array.isArray(list) ? list : []).find((item) => item && normalizeText(item.name) === target) || null;
}

function normalizeProviderDraftState(target) {
    if (!target || typeof target !== 'object') return;
    if (typeof target.name === 'string') {
        target.name = target.name.trim();
    }
    if (typeof target.url === 'string') {
        target.url = normalizeProviderUrl(target.url);
    }
    if (typeof target.model === 'string') {
        target.model = target.model.trim();
    }
    if (typeof target.key === 'string') {
        target.key = target.key.trim();
    }
}

function maskKeyLocal(key) {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}

function maskKeyForEdit(key) {
    if (!key) return '';
    if (key.length <= 12) return key.substring(0, 4) + '...' + key.substring(key.length - 4);
    return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}

function getProviderValidationForContext(vm, mode = 'add') {
    const draft = mode === 'edit' ? vm.editingProvider : vm.newProvider;
    const editingName = mode === 'edit' ? normalizeText(draft && draft.name) : '';
    const name = normalizeText(draft && draft.name);
    const url = normalizeProviderUrl(draft && draft.url);
    const model = normalizeText(draft && draft.model);
    const key = normalizeText(draft && draft.key);
    const errors = {
        name: '',
        url: '',
        key: '',
        model: ''
    };

    if (mode === 'add') {
        if (!name) {
            errors.name = '名称不能为空';
        } else if (!isValidProviderNameInputValue(name)) {
            errors.name = '名称仅支持字母/数字/._-';
        } else if (isReservedProviderCreationNameInput(name)) {
            errors.name = 'codexmate-proxy 为保留名称，不可手动添加';
        } else if (findProviderByName(vm.providersList, name)) {
            errors.name = '名称已存在';
        }
    } else if (!editingName) {
        errors.name = '提供商名称不能为空';
    }

    if (!url) {
        errors.url = 'URL 必填';
    } else if (!isValidProviderUrlInputValue(url)) {
        errors.url = 'URL 仅支持 http/https';
    }

    if (mode === 'add' && !key) {
        errors.key = 'API Key 必填';
    }

    if (mode === 'add' && !model) {
        errors.model = '模型名称必填';
    }

    return {
        mode,
        name,
        url,
        key,
        model,
        errors,
        ok: !errors.name && !errors.url && !errors.key && !errors.model
    };
}

function canSubmitProviderForContext(vm, mode = 'add') {
    if (mode === 'edit' && vm.editingProvider && (vm.editingProvider.readOnly || vm.editingProvider.nonEditable)) {
        return false;
    }
    return getProviderValidationForContext(vm, mode).ok;
}

export function createProvidersMethods(options = {}) {
    const { api } = options;

    return {
        normalizeProviderDraft(mode = 'add') {
            normalizeProviderDraftState(mode === 'edit' ? this.editingProvider : this.newProvider);
        },

        isReservedProviderCreationName(name) {
            return isReservedProviderCreationNameInput(name);
        },

        isValidProviderNameInput(name) {
            return isValidProviderNameInputValue(name);
        },

        isValidProviderUrlInput(url) {
            return isValidProviderUrlInputValue(url);
        },

        findProviderByName(name) {
            return findProviderByName(this.providersList, name);
        },

        getProviderValidation(mode = 'add') {
            return getProviderValidationForContext(this, mode);
        },

        providerFieldError(mode, fieldName) {
            const validation = getProviderValidationForContext(this, mode);
            return validation && validation.errors && typeof validation.errors[fieldName] === 'string'
                ? validation.errors[fieldName]
                : '';
        },

        canSubmitProvider(mode = 'add') {
            return canSubmitProviderForContext(this, mode);
        },

        async addProvider() {
            normalizeProviderDraftState(this.newProvider);
            const validation = getProviderValidationForContext(this, 'add');
            if (!validation.ok) {
                return this.showMessage(validation.errors.name || validation.errors.url || validation.errors.key || validation.errors.model || '名称、URL、API Key 和模型名称必填', 'error');
            }

            try {
                const payload = {
                    name: validation.name,
                    url: validation.url,
                    key: validation.key,
                    model: validation.model
                };
                if (this.newProvider && this.newProvider.useTransform) {
                    payload.useTransform = true;
                }
                const suggestedModel = validation.model;
                const res = await api('add-provider', payload);
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }

                // 本地更新：构造新 provider 对象并追加到列表
                const newProvider = {
                    name: validation.name,
                    url: validation.url,
                    upstreamUrl: '',
                    codexmate_bridge: payload.useTransform ? 'openai' : '',
                    key: maskKeyLocal(payload.key),
                    hasKey: !!payload.key,
                    models: suggestedModel ? [{ id: suggestedModel, name: suggestedModel, cost: null, contextWindow: undefined, maxTokens: undefined }] : [],
                    current: false,
                    readOnly: false,
                    nonDeletable: false,
                    nonEditable: false
                };
                this.providersList = [...this.providersList, newProvider];

                this.showMessage('操作成功', 'success');
                this.closeAddModal();

                if (suggestedModel) {
                    if (!this.currentModels || typeof this.currentModels !== 'object') this.currentModels = {};
                    this.currentModels[validation.name] = suggestedModel;
                }
            } catch (e) {
                this.showMessage('添加失败', 'error');
            }
        },

        getCurrentCodexAuthProfile() {
            const list = Array.isArray(this.codexAuthProfiles) ? this.codexAuthProfiles : [];
            return list.find((item) => !!(item && item.current)) || null;
        },

        providerPillState(provider) {
            const configured = !!(provider && provider.hasKey);
            return {
                configured,
                text: configured ? '已配置' : '未配置'
            };
        },

        providerPillConfigured(provider) {
            return this.providerPillState(provider).configured;
        },

        providerPillText(provider) {
            return this.providerPillState(provider).text;
        },

        isReadOnlyProvider(providerOrName) {
            if (!providerOrName) return false;
            if (typeof providerOrName === 'object') {
                return !!providerOrName.readOnly;
            }
            const name = String(providerOrName).trim();
            if (!name) return false;
            const target = (this.providersList || []).find((item) => item && item.name === name);
            return !!(target && target.readOnly);
        },

        isNonDeletableProvider(providerOrName) {
            if (!providerOrName) return false;
            if (typeof providerOrName === 'object') {
                return !!providerOrName.nonDeletable;
            }
            const name = String(providerOrName).trim();
            if (!name) return false;
            const target = (this.providersList || []).find((item) => item && item.name === name);
            return !!(target && target.nonDeletable);
        },

        shouldShowProviderDelete(provider) {
            return !this.isReadOnlyProvider(provider) && !this.isNonDeletableProvider(provider);
        },

        shouldShowProviderEdit(provider) {
            return !this.isReadOnlyProvider(provider) && !this.isNonDeletableProvider(provider);
        },

        shouldAllowProviderShare(provider) {
            return !this.isReadOnlyProvider(provider);
        },

        async deleteProvider(name) {
            if (this.isNonDeletableProvider(name)) {
                this.showMessage('该 provider 为保留项，不可删除', 'info');
                return;
            }
            try {
                const res = await api('delete-provider', { name });
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }

                // 本地更新：从列表中移除
                this.providersList = this.providersList.filter(p => p.name !== name);

                // 清理 currentModels
                if (this.currentModels && this.currentModels[name]) {
                    delete this.currentModels[name];
                }

                if (res.switched && res.provider) {
                    this.currentProvider = res.provider;
                    if (res.model) this.currentModel = res.model;
                    // 更新 current 标记
                    this.providersList = this.providersList.map(p => ({
                        ...p,
                        current: p.name === res.provider
                    }));
                    this.showMessage(`已删除提供商，自动切换到 ${res.provider}${res.model ? ` / ${res.model}` : ''}`, 'success');
                } else {
                    this.showMessage('操作成功', 'success');
                }
            } catch (_) {
                this.showMessage('删除失败', 'error');
            }
        },

        openCloneProviderModal(provider) {
            const isTransform = !!(provider.codexmate_bridge || '').trim() || /\/bridge\/openai\//.test(provider.url || '');
            const cloneUrl = isTransform && provider.upstreamUrl
                ? normalizeProviderUrl(provider.upstreamUrl)
                : normalizeProviderUrl(provider.url || '');
            this.newProvider = {
                name: '',
                url: cloneUrl,
                key: '',
                model: '',
                useTransform: isTransform
            };
            this.showAddModal = true;
        },

        async openEditModal(provider) {
            const requestId = Symbol('openEditModal');
            this._openEditModalRequestId = requestId;
            if (!this.shouldShowProviderEdit(provider)) {
                this.showMessage('该 provider 为保留项，不可编辑', 'info');
                return;
            }
            const isTransformProvider = (() => {
                if (!provider || typeof provider !== 'object') return false;
                const bridge = typeof provider.codexmate_bridge === 'string' ? provider.codexmate_bridge.trim() : '';
                if (bridge === 'openai') return true;
                const url = String(provider.url || '');
                return url.includes('/bridge/openai/');
            })();
            this.editingProvider = {
                name: provider.name,
                url: normalizeProviderUrl(provider.url || ''),
                key: maskKeyForEdit(provider.key || ''),
                readOnly: !!provider.readOnly,
                nonEditable: typeof provider.nonEditable === 'boolean'
                    ? provider.nonEditable
                    : this.isNonDeletableProvider(provider),
                useTransform: isTransformProvider
            };
            this._editProviderOriginalKey = '';
            this._editProviderRealKeyLoaded = false;
            this.showEditProviderKey = false;
            this.showEditModal = true;

            // 后台加载真实密钥
            try {
                const res = await api('get-provider-key', { name: provider.name });
                if (
                    this._openEditModalRequestId === requestId
                    && this.showEditModal
                    && this.editingProvider
                    && this.editingProvider.name === provider.name
                    && res && !res.error
                ) {
                    this._editProviderOriginalKey = typeof res.key === 'string' ? res.key : '';
                    this._editProviderRealKeyLoaded = true;
                    // 如果用户未修改输入框，替换为真实密钥
                    if (this.editingProvider.key === maskKeyForEdit(provider.key || '')) {
                        this.editingProvider.key = this._editProviderOriginalKey;
                    }
                }
            } catch (_) {
                // ignore
            }

            if (isTransformProvider) {
                try {
                    const res = await api('openai-bridge-get-provider', { name: provider.name });
                    if (
                        this._openEditModalRequestId === requestId
                        && this.showEditModal
                        && this.editingProvider
                        && this.editingProvider.name === provider.name
                        && res && !res.error
                        && typeof res.baseUrl === 'string'
                        && res.baseUrl.trim()
                    ) {
                        this.editingProvider.url = normalizeProviderUrl(res.baseUrl);
                    }
                } catch (_) {
                    // ignore
                }
            }
        },

        async updateProvider() {
            if (this.editingProvider.readOnly || this.editingProvider.nonEditable) {
                this.showMessage('该 provider 为保留项，不可编辑', 'error');
                this.closeEditModal();
                return;
            }
            normalizeProviderDraftState(this.editingProvider);
            const validation = getProviderValidationForContext(this, 'edit');
            if (!validation.ok) {
                return this.showMessage(validation.errors.name || validation.errors.url || 'URL 必填', 'error');
            }

            const params = { name: validation.name, url: validation.url };
            if (this.editingProvider && this.editingProvider.useTransform) {
                params.useTransform = true;
            }
            if (this._editProviderRealKeyLoaded) {
                const currentKey = typeof this.editingProvider.key === 'string' ? this.editingProvider.key : '';
                const originalKey = typeof this._editProviderOriginalKey === 'string' ? this._editProviderOriginalKey : '';
                if (currentKey !== originalKey) {
                    params.key = currentKey;
                }
            }
            try {
                const res = await api('update-provider', params);
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }

                // 本地更新：更新列表中对应 provider 的 url 和 key
                this.providersList = this.providersList.map(p => {
                    if (p.name === validation.name) {
                        const keyUpdated = typeof params.key === 'string';
                        return {
                            ...p,
                            url: validation.url,
                            key: keyUpdated ? maskKeyLocal(params.key) : p.key,
                            hasKey: keyUpdated ? !!params.key : p.hasKey
                        };
                    }
                    return p;
                });

                this.closeEditModal();
                this.showMessage('操作成功', 'success');
            } catch (e) {
                this.showMessage('更新失败', 'error');
            }
        },

        closeEditModal() {
            this.showEditModal = false;
            this.showEditProviderKey = false;
            this._editProviderOriginalKey = '';
            this._editProviderRealKeyLoaded = false;
            this.editingProvider = { name: '', url: '', key: '', readOnly: false, nonEditable: false, useTransform: false };
        },

        toggleEditProviderKey() {
            this.showEditProviderKey = !this.showEditProviderKey;
        },

        async resetConfig() {
            if (this.resetConfigLoading) return;
            this.resetConfigLoading = true;
            try {
                const res = await api('reset-config');
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                const backup = res.backupFile ? `（已备份: ${res.backupFile}）` : '';
                this.showMessage(`配置已重装${backup}`, 'success');
                await this.loadAll();
            } catch (e) {
                this.showMessage('重装失败', 'error');
            } finally {
                this.resetConfigLoading = false;
            }
        },

        async addModel() {
            if (!this.newModelName || !this.newModelName.trim()) {
                return this.showMessage('请输入模型', 'error');
            }
            try {
                const modelName = this.newModelName.trim();
                const res = await api('add-model', { model: modelName });
                if (res.error) {
                    this.showMessage(res.error, 'error');
                } else {
                    // 本地更新：在当前 provider 的 models 中追加
                    this.providersList = this.providersList.map(p => {
                        if (p.name === this.currentProvider) {
                            const exists = p.models.some(m => m.id === modelName);
                            if (!exists) {
                                return {
                                    ...p,
                                    models: [...p.models, { id: modelName, name: modelName, cost: null, contextWindow: undefined, maxTokens: undefined }]
                                };
                            }
                        }
                        return p;
                    });
                    this.showMessage('操作成功', 'success');
                    this.closeModelModal();
                }
            } catch (_) {
                this.showMessage('新增模型失败', 'error');
            }
        },

        async removeModel(model) {
            try {
                const res = await api('delete-model', { model });
                if (res.error) {
                    this.showMessage(res.error, 'error');
                } else {
                    // 本地更新：从当前 provider 的 models 中移除
                    this.providersList = this.providersList.map(p => {
                        if (p.name === this.currentProvider) {
                            return {
                                ...p,
                                models: p.models.filter(m => m.id !== model)
                            };
                        }
                        return p;
                    });
                    this.showMessage('操作成功', 'success');
                }
            } catch (_) {
                this.showMessage('删除模型失败', 'error');
            }
        },

        closeAddModal() {
            this.showAddModal = false;
            this.newProvider = { name: '', url: '', key: '', model: '', useTransform: false };
        },

        closeModelModal() {
            this.showModelModal = false;
            this.newModelName = '';
        },

        formatKey(key) {
            if (!key) return '(未设置)';
            if (key.length > 10) {
                return key.substring(0, 3) + '****' + key.substring(key.length - 3);
            }
            return '****';
        },

        displayApiKey(configName) {
            const config = this.claudeConfigs && this.claudeConfigs[configName]
                ? this.claudeConfigs[configName]
                : null;
            const key = config ? config.apiKey : '';
            return this.formatKey(key);
        },

        async loadLocalBridgeExcluded() {
            try {
                const res = await api('local-bridge-get-excluded');
                if (res && Array.isArray(res.excludedProviders)) {
                    this.localBridgeExcluded = res.excludedProviders;
                }
            } catch (e) { /* ignore */ }
        },

        async toggleLocalBridgeExcluded(providerName) {
            const name = String(providerName || '').trim();
            if (!name) return;
            const idx = this.localBridgeExcluded.indexOf(name);
            const next = [...this.localBridgeExcluded];
            if (idx >= 0) {
                next.splice(idx, 1);
            } else {
                next.push(name);
            }
            try {
                const res = await api('local-bridge-set-excluded', { names: next });
                if (res && !res.error) {
                    this.localBridgeExcluded = next;
                }
            } catch (e) { /* ignore */ }
        },

        isLocalBridgeExcluded(providerName) {
            return this.localBridgeExcluded.indexOf(String(providerName || '').trim()) >= 0;
        },

        localBridgeCandidateProviders() {
            return (this.providersList || []).filter(p => p && p.name !== 'local' && p.name !== 'codexmate-proxy' && p.codexmate_bridge !== 'local');
        }
    };
}
