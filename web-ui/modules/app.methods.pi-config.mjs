import { api } from './api.mjs';

function isPiPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
}

export function createPiConfigMethods({ api: apiClient }) {
    return {
        async loadPiProviders() {
            const result = await apiClient('read-pi-models');
            const providers = isPiPlainObject(result && result.providers) ? result.providers : {};
            return providers;
        },
        async loadPiSettings() {
            const result = await apiClient('read-pi-settings');
            const settings = isPiPlainObject(result && result.settings) ? result.settings : {};
            this.piActiveProvider = typeof settings.defaultProvider === 'string' ? settings.defaultProvider : '';
            this.piActiveModel = typeof settings.defaultModel === 'string' ? settings.defaultModel : '';
            return settings;
        },
        async switchPiActiveProvider(providerId) {
            if (!this.isToolConfigWriteAllowed('pi') || this.piSaving) return;
            const provider = this.piProviders[providerId];
            if (!isPiPlainObject(provider)) return;
            const firstModel = Array.isArray(provider.models) && provider.models.length > 0
                ? (provider.models[0] && provider.models[0].id) || ''
                : '';
            const updates = { defaultProvider: providerId };
            if (firstModel) updates.defaultModel = firstModel;
            try {
                const result = await apiClient('write-pi-settings', updates);
                if (result && result.error) throw new Error(result.error);
                await this.loadPiSettings();
                this.message = '已切换为使用该供应商';
                this.messageType = 'success';
            } catch (e) {
                this.message = e && e.message ? e.message : '切换默认供应商失败';
                this.messageType = 'error';
            }
        },
        async savePiProviders(providers) {
            return apiClient('write-pi-models', { providers });
        },
        async removePiProvider(providerId) {
            const providers = await this.loadPiProviders();
            const existing = providers[providerId] || {};
            const updated = { ...providers };
            delete updated[providerId];
            await this.savePiProviders(updated);
            return { success: true, provider: existing };
        },
        async persistPiProvider(providerId, values) {
            const providers = await this.loadPiProviders();
            const existing = providers[providerId] || {};
            const current = isPiPlainObject(values) ? values : {};

            const updatedProvider = {
                ...existing,
                ...current
            };

            return this.savePiProviders({ ...providers, [providerId]: updatedProvider });
        },
        async loadPiSources() {
            this.piProviderLoading = true;
            try {
                const [providers] = await Promise.all([
                    this.loadPiProviders(),
                    this.loadPiSettings()
                ]);
                this.piProviders = providers || {};
                this.piProviderIds = Object.keys(this.piProviders || {}).sort();
            } catch (e) {
                this.message = e && e.message ? e.message : '读取 Pi 配置失败';
                this.messageType = 'error';
            } finally {
                this.piProviderLoading = false;
            }
        },
        async savePiProvider() {
            this.piSaving = true;
            try {
                const providerId = this.editingPiProvider.id;
                const values = this.editingPiProvider.form;
                const extras = this.editingPiProvider.extras || {};
                const provider = this.piProviders[providerId] || {};

                const merged = {
                    ...extras,
                    baseUrl: values.baseUrl,
                    api: values.api,
                    apiKey: values.apiKey || '',
                    models: (Array.isArray(values.models) ? values.models : []).map((model) => ({
                        ...model,
                        id: model.id || '',
                        name: model.id || ''
                    }))
                };
                if (isPiPlainObject(provider.headers)) merged.headers = provider.headers;
                if (typeof provider.title === 'string') merged.title = provider.title;
                else if (typeof provider.name === 'string') merged.name = provider.name;

                await this.persistPiProvider(providerId, merged);
                this.piProviders = { ...this.piProviders, [providerId]: merged };
                this.piProviderIds = Object.keys(this.piProviders).sort();
                this.resetPiProviderEditing();
                this.message = '配置已保存';
                this.messageType = 'success';
            } catch (e) {
                this.message = e && e.message ? e.message : '保存 Pi 配置失败';
                this.messageType = 'error';
            } finally {
                this.piSaving = false;
            }
        },
        async addPiProviderFromModal() {
            let createdId = null;
            this.piSaving = true;
            try {
                const baseUrl = (this.addingPiProviderBaseUrl || '').trim();
                if (!baseUrl) throw new Error('Base URL 不能为空');
                const providerId = this.derivePiProviderId(baseUrl);
                const modelId = (this.addingPiProviderModel || '').trim();
                const values = {
                    baseUrl,
                    api: this.addingPiProviderApi || 'openai-completions',
                    apiKey: (this.addingPiProviderApiKey || '').trim(),
                    models: modelId ? [{
                        id: modelId,
                        name: modelId,
                        reasoning: false,
                        contextWindow: 128000,
                        maxTokens: 32000,
                        input: ''
                    }] : []
                };

                await this.persistPiProvider(providerId, values);
                this.piProviders = { ...this.piProviders, [providerId]: values };
                this.piProviderIds = Object.keys(this.piProviders).sort();
                this.cancelAddPiProviderModal();
                this.message = '供应商已添加';
                this.messageType = 'success';
                createdId = providerId;
            } catch (e) {
                this.message = e && e.message ? e.message : '添加 Pi 供应商失败';
                this.messageType = 'error';
            } finally {
                this.piSaving = false;
                if (createdId) this.openEditPiProvider(createdId);
            }
        },
        derivePiProviderId(baseUrl) {
            let base = '';
            try {
                base = new URL(baseUrl).hostname.replace(/^www\./, '');
            } catch (_) {
                base = '';
            }
            const candidate = (base || 'pi-provider').replace(/[^a-zA-Z0-9-]/g, '-')
                .replace(/-+/g, '-').replace(/^-|-$/g, '') || 'pi-provider';
            if (!this.piProviders[candidate]) return candidate;
            let suffix = 2;
            while (this.piProviders[`${candidate}-${suffix}`]) suffix += 1;
            return `${candidate}-${suffix}`;
        },
        startAddPiProvider() {
            if (!this.isToolConfigWriteAllowed('pi') || this.piSaving) return;
            this.addingPiProviderId = '';
            this.addingPiProviderName = '';
            this.addingPiProviderBaseUrl = '';
            this.addingPiProviderApi = 'openai-completions';
            this.addingPiProviderApiKey = '';
            this.addingPiProviderModel = '';
            this.addingPiRemoteModels = [];
            this.addingPiRemoteLoading = false;
            this.addingPiRemoteError = '';
            this.showAddPiProviderModal = true;
            this.editingPiProvider = null;
        },
        cancelAddPiProviderModal() {
            this.showAddPiProviderModal = false;
            this.addingPiProviderId = '';
            this.addingPiProviderName = '';
            this.addingPiProviderBaseUrl = '';
            this.addingPiProviderApi = '';
            this.addingPiProviderApiKey = '';
            this.addingPiProviderModel = '';
            this.addingPiRemoteModels = [];
            this.addingPiRemoteLoading = false;
            this.addingPiRemoteError = '';
        },
        async fetchAddingPiRemoteModels() {
            const baseUrl = (this.addingPiProviderBaseUrl || '').trim();
            if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) {
                this.addingPiRemoteModels = [];
                this.addingPiRemoteError = '';
                return;
            }
            this.addingPiRemoteLoading = true;
            this.addingPiRemoteError = '';
            try {
                const result = await apiClient('fetch-pi-remote-models', {
                    baseUrl,
                    apiKey: (this.addingPiProviderApiKey || '').trim()
                });
                if (!this.showAddPiProviderModal) return;
                if (result && Array.isArray(result.models) && result.models.length > 0) {
                    this.addingPiRemoteModels = result.models;
                } else {
                    this.addingPiRemoteModels = [];
                    this.addingPiRemoteError = (result && result.error) || '未获取到可用模型';
                }
            } catch (e) {
                if (!this.showAddPiProviderModal) return;
                this.addingPiRemoteModels = [];
                this.addingPiRemoteError = e && e.message ? e.message : '模型列表获取失败';
            } finally {
                if (this.showAddPiProviderModal) this.addingPiRemoteLoading = false;
            }
        },
        onAddingPiEndpointChange() {
            if (this.addingPiRemoteDebounce) clearTimeout(this.addingPiRemoteDebounce);
            this.addingPiRemoteDebounce = setTimeout(() => {
                this.addingPiRemoteDebounce = null;
                this.fetchAddingPiRemoteModels();
            }, 600);
        },
        piFilteredAddingRemoteModels() {
            const query = (this.addingPiProviderModel || '').trim().toLowerCase();
            if (!query) return [];
            return this.addingPiRemoteModels.filter((id) => id.toLowerCase().includes(query)).slice(0, 50);
        },
        openEditPiProvider(providerId) {
            if (!this.isToolConfigWriteAllowed('pi') || this.piSaving) return;
            this.piRemoteModels = [];
            this.piRemoteModelError = '';
            this.piModelSearch = '';
            const provider = this.piProviders[providerId] || {};
            const knownKeys = ['id', 'name', 'title', 'baseUrl', 'api', 'apiKey', 'models', 'headers', 'configJson'];
            const extras = {};
            Object.keys(provider).forEach((key) => {
                if (!knownKeys.includes(key)) extras[key] = provider[key];
            });
            const form = {
                id: provider.id || providerId,
                baseUrl: provider.baseUrl || '',
                api: provider.api || '',
                apiKey: provider.apiKey || '',
                configJsonDraft: JSON.stringify(extras, null, 2),
                models: Array.isArray(provider.models) && provider.models.length
                    ? provider.models.map((model) => ({
                        id: model?.id || '',
                        name: model?.name || '',
                        reasoning: model?.reasoning || '',
                        contextWindow: model?.contextWindow ?? model?.context_window ?? '',
                        maxTokens: model?.maxTokens ?? model?.max_tokens ?? '',
                        input: model?.input || ''
                    }))
                    : []
            };
            this.editingPiProvider = {
                id: providerId,
                form,
                extras,
                original: provider
            };
            this.showAddPiProviderModal = false;
            this.fetchPiRemoteModels();
        },
        resetPiProviderEditing() {
            this.editingPiProvider = null;
            this.piRemoteModels = [];
            this.piRemoteModelError = '';
            this.piModelSearch = '';
        },
        removePiProviderModel(index) {
            if (!this.editingPiProvider) return;
            const list = this.editingPiProvider.form.models;
            if (Array.isArray(list)) list.splice(index, 1);
        },
        async fetchPiRemoteModels() {
            const provider = this.editingPiProvider;
            if (!provider) return;
            this.piRemoteModelsLoading = true;
            this.piRemoteModelError = '';
            try {
                const result = await apiClient('fetch-pi-remote-models', {
                    baseUrl: provider.form.baseUrl || '',
                    apiKey: provider.form.apiKey || ''
                });
                if (this.editingPiProvider !== provider) return;
                if (result && Array.isArray(result.models) && result.models.length > 0) {
                    this.piRemoteModels = result.models;
                } else {
                    this.piRemoteModels = [];
                    this.piRemoteModelError = (result && result.error) || '未获取到可用模型';
                }
            } catch (e) {
                if (this.editingPiProvider !== provider) return;
                this.piRemoteModels = [];
                this.piRemoteModelError = e && e.message ? e.message : '模型列表获取失败';
            } finally {
                if (this.editingPiProvider === provider) this.piRemoteModelsLoading = false;
            }
        },
        piFilteredRemoteModels() {
            const query = (this.piModelSearch || '').trim().toLowerCase();
            if (!query) return [];
            return this.piRemoteModels.filter((id) => id.toLowerCase().includes(query)).slice(0, 50);
        },
        addPiRemoteModel(modelId) {
            if (!this.isToolConfigWriteAllowed('pi') || !this.editingPiProvider) return;
            const trimmed = typeof modelId === 'string' ? modelId.trim() : '';
            if (!trimmed) return;
            const list = this.editingPiProvider.form.models;
            if (!Array.isArray(list)) return;
            list.splice(0, list.length, {
                id: trimmed,
                name: trimmed,
                reasoning: false,
                contextWindow: 128000,
                maxTokens: 32000,
                input: ''
            });
            this.piModelSearch = '';
        },
        async confirmDeletePiProvider() {
            if (!this.editingPiProvider) return;
            const providerId = this.editingPiProvider.id;
            const confirmed = await this.requestConfirmDialog({
                title: this.t('pi.providers.deleteTitle'),
                message: this.t('pi.providers.deleteMessage', { name: this.piProviderName(providerId) }),
                confirmText: this.t('confirm.ok'),
                cancelText: this.t('confirm.cancel'),
                danger: true
            });
            if (!confirmed) return;
            await this.removePiProvider(providerId);
            const updated = { ...this.piProviders };
            delete updated[providerId];
            this.piProviders = updated;
            this.piProviderIds = Object.keys(this.piProviders).sort();
            this.resetPiProviderEditing();
            this.message = '供应商已删除';
            this.messageType = 'success';
        },
        piProviderName(providerId) {
            const provider = this.piProviders[providerId] || {};
            if (provider.title || provider.name) return provider.title || provider.name;
            const urlTitle = this.piProviderUrlTitle(provider);
            return urlTitle || providerId;
        },
        piProviderUrlTitle(provider) {
            const baseUrl = provider && provider.baseUrl ? String(provider.baseUrl) : '';
            if (!baseUrl) return '';
            try {
                const hostname = new URL(baseUrl).hostname;
                return hostname.replace(/^www\./, '');
            } catch (e) {
                return '';
            }
        },
        piProviderSummary(providerId) {
            const provider = this.piProviders[providerId] || {};
            const baseUrl = provider.baseUrl || '';
            const api = provider.api || '';
            return [baseUrl, api].filter(Boolean).join(' • ') || 'Piper provider';
        }
    };
}