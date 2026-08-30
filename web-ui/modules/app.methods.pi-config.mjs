import { api } from './api.mjs';
import { PI_PROVIDER_TEMPLATE_GROUPS } from './pi-provider-templates.mjs';

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
                    this.loadPiSettings(),
                    this.loadPiFileJsons()
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
                const { merged, ok, error } = this.piBuildMergedEditorRecord();
                if (!ok || !merged) {
                    this.piEditorJsonError = error || '配置 JSON 不合法';
                    this.message = this.piEditorJsonError;
                    this.messageType = 'error';
                    return;
                }

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
                    id: providerId,
                    name: providerId,
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
            let candidate = String(Date.now());
            while (this.piProviders[candidate]) candidate = String(Number(candidate) + 1);
            return candidate;
        },
        piProviderUrlTitle() {
            return '';
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
            this.piProviderPickerQuery = '';
            this.piSelectedProviderTemplate = '';
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
            this.piProviderPickerQuery = '';
            this.piSelectedProviderTemplate = '';
            this.piCatalogFillError = '';
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
        piProviderTemplateGroups() {
            const query = (this.piProviderPickerQuery || '').trim().toLowerCase();
            if (!query) return PI_PROVIDER_TEMPLATE_GROUPS;
            return PI_PROVIDER_TEMPLATE_GROUPS
                .map((group) => ({
                    id: group.id,
                    i18nKey: group.i18nKey,
                    templates: group.templates.filter((tpl) =>
                        tpl.name.toLowerCase().includes(query) || tpl.id.toLowerCase().includes(query))
                }))
                .filter((group) => group.templates.length > 0);
        },
        selectPiProviderTemplate(tplId) {
            if (!this.isToolConfigWriteAllowed('pi') || this.piSaving) return;
            const tpl = PI_PROVIDER_TEMPLATE_GROUPS
                .flatMap((group) => group.templates)
                .find((item) => item.id === tplId);
            if (!tpl) return;
            this.piSelectedProviderTemplate = tpl.id;
            this.addingPiProviderBaseUrl = tpl.baseUrl || '';
            this.addingPiProviderApi = tpl.api || 'openai-completions';
            this.addingPiProviderModel = '';
            if (tpl.baseUrl) this.onAddingPiEndpointChange();
        },
        resetPiProviderTemplateSelection() {
            this.piSelectedProviderTemplate = '';
        },
        piRemoteSelectableModels() {
            const base = Array.isArray(this.piRemoteModels) ? this.piRemoteModels : [];
            const form = this.editingPiProvider && this.editingPiProvider.form;
            const existing = Array.isArray(form && form.models) ? form.models : [];
            const added = new Set(existing.map((m) => String(m && m.id || '').trim().toLowerCase()));
            const q = (this.piModelSearch || '').trim().toLowerCase();
            return base
                .filter((id) => {
                    if (added.has(String(id).trim().toLowerCase())) return false;
                    return !q || String(id).toLowerCase().includes(q);
                })
                .slice(0, 50);
        },
        isPiRemoteChecked(id) {
            return !!this.piRemoteChecked[String(id)];
        },
        togglePiRemoteChecked(id) {
            const key = String(id);
            const next = { ...this.piRemoteChecked };
            if (next[key]) delete next[key];
            else next[key] = true;
            this.piRemoteChecked = next;
        },
        piCheckedRemoteCount() {
            return this.piRemoteSelectableModels().filter((id) => this.isPiRemoteChecked(id)).length;
        },
        piCreateModelRecord(id) {
            const t = String(id || '').trim();
            return {
                id: t,
                name: t,
                reasoning: false,
                contextWindow: 128000,
                maxTokens: 32000,
                input: ''
            };
        },
        addSelectedPiRemoteModels() {
            if (!this.isToolConfigWriteAllowed('pi') || !this.editingPiProvider) return;
            const form = this.editingPiProvider.form;
            if (!form || !Array.isArray(form.models)) return;
            const existing = new Set(form.models.map((m) => String(m && m.id || '').trim().toLowerCase()));
            for (const id of this.piRemoteSelectableModels()) {
                if (!this.isPiRemoteChecked(id)) continue;
                const key = String(id).trim().toLowerCase();
                if (existing.has(key)) continue;
                form.models.push(this.piCreateModelRecord(id));
                existing.add(key);
            }
            this.piRemoteChecked = {};
            this.piModelSearch = '';
        },
        async fillPiModelFromCatalog(index) {
            if (!this.isToolConfigWriteAllowed('pi') || !this.editingPiProvider) return;
            const models = this.editingPiProvider.form && this.editingPiProvider.form.models;
            const model = Array.isArray(models) ? models[index] : null;
            if (!model || !String(model.id || '').trim()) return;
            if (this.piCatalogFillIndex !== -1) return;
            this.piCatalogFillIndex = index;
            this.piCatalogFillError = '';
            try {
                const result = await apiClient('pi-models-catalog', {
                    modelId: String(model.id).trim(),
                    providerId: this.editingPiProvider.id,
                    baseUrl: this.editingPiProvider.form.baseUrl || ''
                });
                if (result && result.ok && isPiPlainObject(result.model)) {
                    const info = result.model;
                    if (model.name === '' && typeof info.name === 'string') model.name = info.name;
                    if (model.contextWindow === '' && Number.isFinite(info.contextWindow)) model.contextWindow = info.contextWindow;
                    if (model.maxTokens === '' && Number.isFinite(info.maxTokens)) model.maxTokens = info.maxTokens;
                    model.reasoning = !!info.reasoning;
                } else {
                    this.piCatalogFillError = (result && result.error) || 'models.dev 目录中未找到该模型';
                }
            } finally {
                this.piCatalogFillIndex = -1;
            }
        },
        openEditPiProvider(providerId) {
            if (!this.isToolConfigWriteAllowed('pi') || this.piSaving) return;
            this.piRemoteModels = [];
            this.piRemoteModelError = '';
            this.piRemoteChecked = {};
            this.piCatalogFillError = '';
            this.piCatalogFillIndex = -1;
            this.piModelSearch = '';
            this.piEditorJsonError = '';
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
            this.piRemoteChecked = {};
            this.piCatalogFillError = '';
            this.piCatalogFillIndex = -1;
            this.piModelSearch = '';
            this.piEditorJsonError = '';
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
                    this.piRemoteChecked = {};
                } else {
                    this.piRemoteModels = [];
                    this.piRemoteChecked = {};
                    this.piRemoteModelError = (result && result.error) || '未获取到可用模型';
                }
            } catch (e) {
                if (this.editingPiProvider !== provider) return;
                this.piRemoteModels = [];
                this.piRemoteChecked = {};
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
            const key = trimmed.toLowerCase();
            const duplicated = list.some((m) => String(m && m.id || '').trim().toLowerCase() === key);
            if (duplicated) return;
            list.push(this.piCreateModelRecord(trimmed));
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
            return String(providerId || '');
        },
        piProviderSummary(providerId) {
            const provider = this.piProviders[providerId] || {};
            const baseUrl = provider.baseUrl || '';
            const api = provider.api || '';
            return [baseUrl, api].filter(Boolean).join(' • ') || 'Piper provider';
        }
        ,
        piParseFileJsonDraft(draft, label) {
            const name = label || 'JSON';
            const text = String(draft || '').trim();
            if (!text) return { ok: false, value: null, error: name + ' 内容不能为空' };
            try {
                const parsed = JSON.parse(text);
                if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
                    return { ok: false, value: null, error: name + ' 必须是 JSON 对象' };
                }
                return { ok: true, value: parsed, error: '' };
            } catch (e) {
                return { ok: false, value: null, error: name + ' 解析失败：' + (e && e.message ? e.message : '') };
            }
        },
        async loadPiFileJsons() {
            const [modelsResult, settingsResult] = await Promise.all([
                apiClient('read-pi-models'),
                apiClient('read-pi-settings')
            ]);
            const modelsFile = isPiPlainObject(modelsResult && modelsResult.file) ? modelsResult.file : {};
            const settings = isPiPlainObject(settingsResult && settingsResult.settings) ? settingsResult.settings : {};
            this.piModelsJsonDraft = JSON.stringify(modelsFile, null, 2);
            this.piSettingsJsonDraft = JSON.stringify(settings, null, 2);
            this.piModelsJsonError = '';
            this.piSettingsJsonError = '';
        },
        piSettingsJsonInput() {
            const parsed = this.piParseFileJsonDraft(this.piSettingsJsonDraft, 'settings.json');
            this.piSettingsJsonError = parsed.ok ? '' : parsed.error;
        },
        piModelsJsonInput() {
            const parsed = this.piParseFileJsonDraft(this.piModelsJsonDraft, 'models.json');
            this.piModelsJsonError = parsed.ok ? '' : parsed.error;
        },
        async savePiSettingsJson() {
            if (!this.isToolConfigWriteAllowed('pi') || this.piSaving || this.piFileJsonSaving) return;
            const parsed = this.piParseFileJsonDraft(this.piSettingsJsonDraft, 'settings.json');
            if (!parsed.ok) {
                this.piSettingsJsonError = parsed.error;
                this.message = parsed.error;
                this.messageType = 'error';
                return;
            }
            this.piFileJsonSaving = true;
            try {
                const result = await apiClient('write-pi-settings', { settings: parsed.value });
                if (result && result.error) throw new Error(result.error);
                this.piSettingsJsonError = '';
                this.piSettingsJsonDraft = JSON.stringify(parsed.value, null, 2);
                await this.loadPiSettings();
                this.message = 'settings.json 已保存';
                this.messageType = 'success';
            } catch (e) {
                this.message = e && e.message ? e.message : '保存 settings.json 失败';
                this.messageType = 'error';
            } finally {
                this.piFileJsonSaving = false;
            }
        },
        async savePiModelsJson() {
            if (!this.isToolConfigWriteAllowed('pi') || this.piSaving || this.piFileJsonSaving) return;
            const parsed = this.piParseFileJsonDraft(this.piModelsJsonDraft, 'models.json');
            if (!parsed.ok) {
                this.piModelsJsonError = parsed.error;
                this.message = parsed.error;
                this.messageType = 'error';
                return;
            }
            this.piFileJsonSaving = true;
            try {
                const result = await apiClient('write-pi-models', { file: parsed.value });
                if (result && result.error) throw new Error(result.error);
                await this.loadPiSources();
                this.message = 'models.json 已保存';
                this.messageType = 'success';
            } catch (e) {
                this.message = e && e.message ? e.message : '保存 models.json 失败';
                this.messageType = 'error';
            } finally {
                this.piFileJsonSaving = false;
            }
        },
        piParseEditorJsonDraft() {
            const provider = this.editingPiProvider;
            const draft = provider && provider.form ? String(provider.form.configJsonDraft || '').trim() : '';
            if (!draft) return { ok: true, extras: {} };
            try {
                const parsed = JSON.parse(draft);
                if (parsed === null || Array.isArray(parsed) || typeof parsed !== 'object') {
                    return { ok: false, extras: {}, error: '配置 JSON 必须是对象' };
                }
                return { ok: true, extras: parsed };
            } catch (e) {
                return { ok: false, extras: {}, error: e && e.message ? '配置 JSON 解析失败：' + e.message : '配置 JSON 解析失败' };
            }
        },
        piBuildMergedEditorRecord() {
            const provider = this.editingPiProvider;
            if (!provider || !provider.form) return { merged: null, ok: false, error: '未在编辑供应商', extras: {} };
            const draft = this.piParseEditorJsonDraft();
            if (!draft.ok) return { merged: null, ok: false, error: draft.error, extras: {} };
            const values = provider.form || {};
            const extras = draft.extras || {};
            const orig = this.piProviders[provider.id] || {};
            const mapModels = (xs) => (Array.isArray(xs) ? xs : []).map((model) => ({
                ...model,
                id: (model && model.id) || '',
                name: (model && (model.name || model.id)) || ''
            }));
            const merged = { ...extras };
            if (merged.baseUrl === undefined) merged.baseUrl = values.baseUrl || '';
            if (merged.api === undefined) merged.api = values.api || '';
            if (merged.apiKey === undefined) merged.apiKey = values.apiKey || '';
            if (merged.models === undefined) merged.models = mapModels(values.models);
            if (isPiPlainObject(orig.headers)) merged.headers = orig.headers;
            if (typeof orig.title === 'string') merged.title = orig.title;
            else if (typeof orig.name === 'string') merged.name = orig.name;
            if (isPiPlainObject(orig.configJson)) merged.configJson = orig.configJson;
            return { merged, ok: true, error: '', extras };
        },
        piProviderPreviewJson() {
            const { merged, ok } = this.piBuildMergedEditorRecord();
            if (!ok || !merged) return '{}';
            try {
                return JSON.stringify(merged, null, 2);
            } catch (_) {
                return '{}';
            }
        },
        piEditorJsonDraftInput() {
            const draft = this.piParseEditorJsonDraft();
            this.piEditorJsonError = draft.ok ? '' : draft.error;
        },
        piHistoryBucketFor(target) {
            return target === 'settings' ? 'pi-settings' : 'pi-models';
        },
        async openPiConfigHistory(target) {
            if (this.piHistoryLoading) return;
            const tgt = target === 'settings' ? 'settings' : (target === 'models' ? 'models' : '');
            if (!tgt) return;
            this.piHistoryTarget = tgt;
            this.piHistoryItems = [];
            this.piHistoryPreviewId = '';
            this.piHistoryPreviewContent = '';
            this.piHistoryError = '';
            this.piHistoryLoading = true;
            try {
                const res = await api('list-prompt-history', { bucket: this.piHistoryBucketFor(tgt) });
                if (res && res.error) {
                    this.piHistoryError = res.error;
                    return;
                }
                this.piHistoryItems = Array.isArray(res) ? res : [];
            } catch (e) {
                this.piHistoryError = this.t('toast.load.fail');
            } finally {
                this.piHistoryLoading = false;
            }
        },
        closePiConfigHistory() {
            this.piHistoryTarget = '';
            this.piHistoryItems = [];
            this.piHistoryPreviewId = '';
            this.piHistoryPreviewContent = '';
            this.piHistoryError = '';
            this.piHistoryLoading = false;
        },
        async viewPiConfigHistoryItem(item) {
            if (!item || !item.id) return;
            if (this.piHistoryLoading) return;
            if (this.piHistoryPreviewId === item.id && this.piHistoryPreviewContent) return;
            this.piHistoryPreviewId = item.id;
            this.piHistoryPreviewContent = '';
            try {
                const res = await api('get-prompt-history', { bucket: this.piHistoryBucketFor(this.piHistoryTarget), id: item.id });
                if (res && res.error) {
                    this.piHistoryError = res.error;
                    this.piHistoryPreviewId = '';
                    return;
                }
                this.piHistoryPreviewContent = typeof res.content === 'string' ? res.content : '';
            } catch (e) {
                this.piHistoryError = this.t('toast.load.fail');
                this.piHistoryPreviewId = '';
            }
        },
        async applyPiConfigHistory() {
            if (this.piHistoryApplying || this.piHistoryLoading) return;
            if (!this.piHistoryTarget || !this.piHistoryPreviewId) return;
            const confirmed = await this.requestConfirmDialog({
                title: this.t('common.history'),
                message: this.t('pi.history.confirm'),
                confirmText: this.t('confirm.ok'),
                cancelText: this.t('confirm.cancel'),
                danger: true
            });
            if (!confirmed) return;
            this.piHistoryApplying = true;
            try {
                const res = await api('apply-pi-config-history', { target: this.piHistoryTarget, id: this.piHistoryPreviewId });
                if (res && res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                this.showMessage(this.t('pi.history.applied'), 'success');
                this.closePiConfigHistory();
                await this.loadPiSources();
            } catch (e) {
                this.showMessage(this.t('pi.history.applyFailed'), 'error');
            } finally {
                this.piHistoryApplying = false;
            }
        }
    };
}