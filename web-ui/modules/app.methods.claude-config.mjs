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
                this.showMessage('请输入模型', 'error');
                return;
            }
            const existing = this.claudeConfigs[name] || {};
            this.currentClaudeModel = model;
            this.claudeCustomModelDraft = model;
            this.claudeConfigs[name] = this.mergeClaudeConfig(existing, { model });
            this.saveClaudeConfigs();
            this.updateClaudeModelsCurrent();
            if (!this.claudeConfigs[name].apiKey && !this.claudeConfigs[name].externalCredentialType) {
                this.showMessage('请先配置 API Key', 'error');
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

        async syncClaudeBridgeProviders() {
            try { await api('claude-local-bridge-sync-providers', { providers: this.claudeConfigs || {} }); } catch (_) {}
        },

        openCloneClaudeConfigModal(name, config) {
            this.newClaudeConfig = {
                name: '',
                apiKey: config.apiKey || '',
                baseUrl: config.baseUrl || '',
                model: config.model || ''
            };
            this.showClaudeConfigModal = true;
        },

        openEditConfigModal(name) {
            const config = this.claudeConfigs[name];
            this.editingConfig = {
                name: name,
                apiKey: config.apiKey || '',
                baseUrl: config.baseUrl || '',
                model: config.model || ''
            };
            this.showEditClaudeConfigKey = false;
            this.showEditConfigModal = true;
        },

        updateConfig() {
            const name = this.editingConfig.name;
            this.claudeConfigs[name] = this.mergeClaudeConfig(this.claudeConfigs[name], this.editingConfig);
            this.saveClaudeConfigs();
            this.showMessage('操作成功', 'success');
            this.closeEditConfigModal();
            if (name === this.currentClaudeConfig) {
                this.refreshClaudeModelContext();
            }
        },

        closeEditConfigModal() {
            this.showEditConfigModal = false;
            this.showEditClaudeConfigKey = false;
            this.editingConfig = { name: '', apiKey: '', baseUrl: '', model: '' };
        },

        toggleEditClaudeConfigKey() {
            this.showEditClaudeConfigKey = !this.showEditClaudeConfigKey;
        },

        async saveAndApplyConfig() {
            const name = this.editingConfig.name;
            this.claudeConfigs[name] = this.mergeClaudeConfig(this.claudeConfigs[name], this.editingConfig);
            this.saveClaudeConfigs();

            const config = this.claudeConfigs[name];
            if (!config.apiKey) {
                this.showMessage('已保存（未填写 API Key）', 'info');
                this.closeEditConfigModal();
                if (name === this.currentClaudeConfig) {
                    this.refreshClaudeModelContext();
                }
                return;
            }

            const _claudeKey = `${name}|${config.apiKey || ""}|${config.baseUrl || ""}|${config.model || ""}`;
            try {
                const res = await api('apply-claude-config', { config });
                if (res.error || res.success === false) {
                    this.showMessage(res.error || '应用配置失败', 'error');
                } else {
                    this.currentClaudeConfig = name;
                    if (this._lastAppliedClaudeKey !== _claudeKey) {
                        this.showMessage('Claude 配置已生效', 'success');
                        this._lastAppliedClaudeKey = _claudeKey;
                    }
                    this.closeEditConfigModal();
                    this.refreshClaudeModelContext();
                }
            } catch (_) {
                this.showMessage('应用配置失败', 'error');
            }
        },

        addClaudeConfig() {
            if (!this.newClaudeConfig.name || !this.newClaudeConfig.name.trim()) {
                return this.showMessage('请输入名称', 'error');
            }
            const name = this.newClaudeConfig.name.trim();
            if (this.claudeConfigs[name]) {
                return this.showMessage('名称已存在', 'error');
            }
            const duplicateName = this.findDuplicateClaudeConfigName(this.newClaudeConfig);
            if (duplicateName) {
                return this.showMessage('配置已存在', 'info');
            }

            this.claudeConfigs[name] = this.mergeClaudeConfig({}, this.newClaudeConfig);

            this.currentClaudeConfig = name;
            this.saveClaudeConfigs();
            this.showMessage('操作成功', 'success');
            this.closeClaudeConfigModal();
            this.refreshClaudeModelContext();
        },

        async deleteClaudeConfig(name) {
            if (Object.keys(this.claudeConfigs).length <= 1) {
                return this.showMessage('至少保留一项', 'error');
            }
            const confirmed = await this.requestConfirmDialog({
                title: '删除 Claude 配置',
                message: `确定删除配置 "${name}"?`,
                confirmText: '删除',
                cancelText: '取消',
                danger: true
            });
            if (!confirmed) return;

            delete this.claudeConfigs[name];
            if (this.currentClaudeConfig === name) {
                this.currentClaudeConfig = Object.keys(this.claudeConfigs)[0];
            }
            this.saveClaudeConfigs();
            this.showMessage('操作成功', 'success');
            this.refreshClaudeModelContext();
        },

        async applyClaudeConfig(name) {
            this.currentClaudeConfig = name;
            try { localStorage.setItem('currentClaudeConfig', name || ''); } catch (_) {}
            this.refreshClaudeModelContext();
            const config = this.claudeConfigs[name];

            if (!config.apiKey) {
                if (config.externalCredentialType) {
                    return this.showMessage('使用外部认证，无需 API Key', 'info');
                }
                return this.showMessage('请先配置 API Key', 'error');
            }

            const _claudeKey2 = `${name}|${config.apiKey || ""}|${config.baseUrl || ""}|${config.model || ""}`;
            try {
                const res = await api('apply-claude-config', { config });
                if (res.error || res.success === false) {
                    this.showMessage(res.error || '应用配置失败', 'error');
                } else {
                    if (this._lastAppliedClaudeKey !== _claudeKey2) {
                        this.showMessage('配置已应用', 'success');
                        this._lastAppliedClaudeKey = _claudeKey2;
                    }
                }
            } catch (_) {
                this.showMessage('应用配置失败', 'error');
            }
        },

        closeClaudeConfigModal() {
            this.showClaudeConfigModal = false;
            this.newClaudeConfig = {
                name: '',
                apiKey: '',
                baseUrl: '',
                model: ''
            };
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
                    this.showMessage('Claude 本地负载均衡已启用', 'success');
                } else {
                    this.showMessage('Claude 本地负载均衡已关闭', 'success');
                }
            } catch (e) {
                this.showMessage('操作失败', 'error');
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
                return this.showMessage('请先添加并配置至少一个 Claude 提供商', 'error');
            }

            try {
                const res = await api('claude-local-bridge-toggle', { enable: true });
                if (res.error) {
                    this.showMessage(res.error || '启用本地负载均衡失败', 'error');
                    return;
                }
                this.showMessage('Claude 本地负载均衡已启用', 'success');
            } catch (e) {
                this.showMessage('启用本地负载均衡失败', 'error');
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
                this.showMessage('加载 Claude settings 失败', 'error');
            }
        }
    };
}
