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
            return settings;
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
            this.piSaving = true;
            try {
                const id = (this.addingPiProviderId || '').trim();
                const providerId = id || `pi-provider-${Date.now()}`;
                const values = {
                    id: providerId,
                    name: this.addingPiProviderName || providerId,
                    baseUrl: this.addingPiProviderBaseUrl || '',
                    api: this.addingPiProviderApi || 'openai',
                    models: [],
                    apiKey: ''
                };

                await this.persistPiProvider(providerId, values);
                this.piProviders = { ...this.piProviders, [providerId]: values };
                this.piProviderIds = Object.keys(this.piProviders).sort();
                this.cancelAddPiProviderModal();
                this.message = '供应商已添加';
                this.messageType = 'success';
            } catch (e) {
                this.message = e && e.message ? e.message : '添加 Pi 供应商失败';
                this.messageType = 'error';
            } finally {
                this.piSaving = false;
            }
        },
        startAddPiProvider() {
            if (!this.isToolConfigWriteAllowed('pi') || this.piSaving) return;
            this.addingPiProviderId = '';
            this.addingPiProviderName = '';
            this.addingPiProviderBaseUrl = '';
            this.addingPiProviderApi = '';
            this.showAddPiProviderModal = true;
            this.editingPiProvider = null;
        },
        cancelAddPiProviderModal() {
            this.showAddPiProviderModal = false;
            this.addingPiProviderId = '';
            this.addingPiProviderName = '';
            this.addingPiProviderBaseUrl = '';
            this.addingPiProviderApi = '';
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
        addPiProviderModel() {
            if (!this.editingPiProvider) return;
            this.editingPiProvider.form.models.push({
                id: '',
                name: '',
                reasoning: false,
                contextWindow: 128000,
                maxTokens: 32000,
                input: ''
            });
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
            const existing = new Set((this.editingPiProvider && Array.isArray(this.editingPiProvider.form.models)
                ? this.editingPiProvider.form.models : []).map((m) => m.id).filter(Boolean));
            const query = (this.piModelSearch || '').trim().toLowerCase();
            return this.piRemoteModels.filter((id) => {
                if (existing.has(id)) return false;
                return !query || id.toLowerCase().includes(query);
            }).slice(0, 50);
        },
        addPiRemoteModel(modelId) {
            if (!this.isToolConfigWriteAllowed('pi') || !this.editingPiProvider) return;
            const list = this.editingPiProvider.form.models;
            if (!Array.isArray(list)) return;
            list.splice(0, list.length, {
                id: modelId,
                name: modelId,
                reasoning: false,
                contextWindow: 128000,
                maxTokens: 32000,
                input: ''
            });
        },
        async confirmDeletePiProvider() {
            if (!this.editingPiProvider) return;
            const providerId = this.editingPiProvider.id;
            if (!confirm(`确认删除 Pi 供应商：${providerId}？`)) return;
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