function normalizeKilocodeProviderName(value) {
    const name = typeof value === 'string' ? value.trim() : '';
    return /^[a-zA-Z0-9_.-]+$/.test(name) ? name : '';
}

export function createKilocodeConfigMethods(options = {}) {
    const { api } = options;
    return {
        refreshKilocodeSelectionFromSummary(res = {}) {
            const providers = Array.isArray(res.providers) ? res.providers : [];
            this.kilocodeProviders = providers;
            this.kilocodeConfigPath = typeof res.targetPath === 'string' ? res.targetPath : '';
            this.kilocodeConfigExists = res.exists === true;
            this.kilocodeContent = typeof res.content === 'string' ? res.content : '{}\n';
            const firstProvider = providers.find(item => item && item.name);
            this.kilocodeProvider = normalizeKilocodeProviderName(res.currentProvider)
                || normalizeKilocodeProviderName(firstProvider && firstProvider.name)
                || normalizeKilocodeProviderName(this.kilocodeProvider)
                || 'codexmate';
            const selected = providers.find(item => normalizeKilocodeProviderName(item && item.name) === this.kilocodeProvider);
            this.kilocodeBaseUrl = typeof (selected && (selected.baseURL || selected.api)) === 'string'
                ? (selected.baseURL || selected.api)
                : this.kilocodeBaseUrl;
            const model = typeof res.currentModel === 'string' ? res.currentModel.trim() : '';
            this.kilocodeModel = model || (selected && Array.isArray(selected.models) ? (selected.models[0] || '') : this.kilocodeModel);
        },

        async loadKilocodeConfig(options = {}) {
            if (this.kilocodeLoading) return;
            this.kilocodeLoading = true;
            this.kilocodeError = '';
            try {
                const res = await api('get-kilocode-config');
                if (res && res.error) {
                    this.kilocodeError = res.error;
                    return;
                }
                this.refreshKilocodeSelectionFromSummary(res || {});
                if (options.toast === true) this.showMessage('KiloCode 配置已刷新', 'success');
            } catch (e) {
                this.kilocodeError = e && e.message ? e.message : '读取 KiloCode 配置失败';
            } finally {
                this.kilocodeLoading = false;
            }
        },

        hasKilocodeStoredKey(provider) {
            const normalizedProvider = normalizeKilocodeProviderName(provider || this.kilocodeProvider);
            return (this.kilocodeProviders || []).some(item => normalizeKilocodeProviderName(item && item.name) === normalizedProvider && item.hasKey === true);
        },

        kilocodeConfigSignature(provider, url, model, apiKey) {
            const keyMarker = apiKey ? `key:${apiKey}` : (this.hasKilocodeStoredKey(provider) ? 'key:<stored>' : 'key:<empty>');
            return [provider, url, model, keyMarker].join('\u0000');
        },

        async autoSaveKilocodeConfig() {
            if (!this.isToolConfigWriteAllowed('kilocode') || this.kilocodeSaving || this.kilocodeLoading) return false;
            const provider = normalizeKilocodeProviderName(this.kilocodeProvider);
            const url = typeof this.kilocodeBaseUrl === 'string' ? this.kilocodeBaseUrl.trim() : '';
            const model = typeof this.kilocodeModel === 'string' ? this.kilocodeModel.trim() : '';
            const apiKey = typeof this.kilocodeApiKey === 'string' ? this.kilocodeApiKey.trim() : '';
            if (!provider || !url || !model || (!apiKey && !this.hasKilocodeStoredKey(provider))) return false;
            const signature = this.kilocodeConfigSignature(provider, url, model, apiKey);
            if (signature === this.kilocodeAutoSaveSignature) return false;
            return this.saveKilocodeConfig({ auto: true, signature });
        },

        async saveKilocodeConfig(options = {}) {
            if (this.kilocodeSaving) return false;
            const auto = options && options.auto === true;
            if (!this.isToolConfigWriteAllowed('kilocode')) {
                if (!auto) this.showMessage(this.t ? this.t('kilocode.writeRequired') : '请先打开 KiloCode 写入开关', 'error');
                return false;
            }
            const provider = normalizeKilocodeProviderName(this.kilocodeProvider);
            const url = typeof this.kilocodeBaseUrl === 'string' ? this.kilocodeBaseUrl.trim() : '';
            const model = typeof this.kilocodeModel === 'string' ? this.kilocodeModel.trim() : '';
            const apiKey = typeof this.kilocodeApiKey === 'string' ? this.kilocodeApiKey.trim() : '';
            if (!provider || !url || !model || (!apiKey && !this.hasKilocodeStoredKey(provider))) {
                if (!auto) this.showMessage(this.t ? this.t('kilocode.fillRequired') : '请填写 KiloCode provider、URL、API Key 和模型', 'error');
                return false;
            }
            this.kilocodeSaving = true;
            this.kilocodeError = '';
            try {
                const res = await api('apply-kilocode-config', { provider, url, model, apiKey });
                if (res && res.error) {
                    this.kilocodeError = res.error;
                    this.showMessage(res.error, 'error');
                    return false;
                }
                this.kilocodeApiKey = '';
                this.refreshKilocodeSelectionFromSummary(res || {});
                this.kilocodeAutoSaveSignature = options && options.signature ? options.signature : this.kilocodeConfigSignature(provider, url, model, '');
                this.showMessage(this.t ? this.t(auto ? 'kilocode.autoSaved' : 'kilocode.saved') : 'KiloCode 配置已保存', 'success');
                return true;
            } catch (e) {
                this.kilocodeError = e && e.message ? e.message : (this.t ? this.t('kilocode.saveFailed') : '保存 KiloCode 配置失败');
                this.showMessage(this.kilocodeError, 'error');
                return false;
            } finally {
                this.kilocodeSaving = false;
            }
        },

        async startKilocode(configure = false) {
            if (this.kilocodeStarting) return;
            if (!this.isToolConfigWriteAllowed('kilocode')) {
                this.showMessage('请先打开 KiloCode 写入开关', 'error');
                return;
            }
            this.kilocodeStarting = true;
            this.kilocodeError = '';
            try {
                const payload = configure ? {
                    configure: true,
                    provider: this.kilocodeProvider,
                    url: this.kilocodeBaseUrl,
                    model: this.kilocodeModel,
                    apiKey: this.kilocodeApiKey
                } : {};
                const res = await api('start-kilocode', payload);
                if (res && res.error) {
                    this.kilocodeError = res.error;
                    this.showMessage(res.error, 'error');
                    return;
                }
                this.kilocodeApiKey = '';
                this.showMessage(`KiloCode 已启动${res && res.pid ? `（PID ${res.pid}）` : ''}`, 'success');
                await this.loadKilocodeConfig();
            } catch (e) {
                this.kilocodeError = e && e.message ? e.message : '启动 KiloCode 失败';
                this.showMessage(this.kilocodeError, 'error');
            } finally {
                this.kilocodeStarting = false;
            }
        }
    };
}
