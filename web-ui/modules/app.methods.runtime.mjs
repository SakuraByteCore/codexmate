import {
    buildSpeedTestIssue,
    formatLatency
} from '../logic.mjs';

const UI_MESSAGE_KEY_BY_TEXT = Object.freeze({
    '操作成功': 'toast.operation.success',
    '操作失败': 'toast.operation.fail',
    '添加失败': 'toast.provider.addFail',
    '更新失败': 'toast.provider.updateFail',
    '删除失败': 'toast.delete.fail',
    '已删除': 'toast.delete.ok',
    '已复制': 'toast.copy.ok',
    '复制失败': 'toast.copy.fail',
    '剪贴板为空': 'toast.clipboardEmpty',
    '无法读取剪贴板': 'toast.clipboardReadFailed',
    '已粘贴': 'toast.pasted',
    '未检测到改动': 'toast.noChanges',
    '配置已应用': 'toast.apply.success',
    '应用配置失败': 'toast.apply.fail',
    '应用失败': 'toast.apply.fail',
    '配置已加载': 'toast.configLoaded',
    '配置就绪': 'toast.configReady',
    '加载配置失败': 'toast.loadConfigFailed',
    '读取配置失败': 'toast.readConfigFailed',
    '读取配置超时': 'toast.readConfigTimeout',
    '备份失败': 'toast.backupFailed',
    '备份成功，开始下载': 'toast.backupReadyDownload',
    '导入失败': 'toast.import.fail',
    '导入成功': 'toast.import.ok',
    '导入 skill 失败': 'toast.importSkillFailed',
    '导出失败': 'toast.export.fail',
    '保存失败': 'toast.save.fail',
    '加载文件失败': 'toast.load.fail',
    '请填写名称': 'toast.nameRequired',
    '请输入名称': 'toast.nameRequired',
    '名称已存在': 'toast.nameExists',
    '至少保留一项': 'toast.keepOneItem',
    '请输入模型': 'toast.modelRequired',
    '请选择提供商和模型': 'toast.providerModelRequired',
    '请先配置 API Key': 'toast.apiKeyRequired',
    '配置已存在': 'toast.configExists',
    '不支持此操作': 'toast.unsupportedOperation',
    '参数无效': 'toast.invalidParams',
    '不可分享': 'toast.notShareable',
    '已移入回收站': 'toast.movedToTrash',
    '生成命令失败': 'toast.commandGenerationFailed',
    '没有可复制内容': 'toast.copy.empty',
    '没有可导出内容': 'toast.export.empty',
    '会话已恢复': 'toast.sessionRestored',
    '恢复失败': 'toast.restoreFailed',
    '已彻底删除': 'toast.purged',
    '彻底删除失败': 'toast.purgeFailed',
    '回收站已清空': 'toast.trashCleared',
    '清空回收站失败': 'toast.trashClearFailed',
    '加载回收站失败': 'toast.trashLoadFailed',
    '加载回收站数量失败': 'toast.trashCountLoadFailed',
    '任务计划已更新': 'toast.taskPlanUpdated',
    '任务计划生成失败': 'toast.taskPlanFailed',
    '计划存在问题，请先修复再执行': 'toast.taskPlanHasIssues',
    '已发出取消请求': 'toast.cancelRequested',
    '取消任务失败': 'toast.cancelTaskFailed'
});

const UI_MESSAGE_PREFIX_ENTRIES = Object.freeze(
    Object.entries(UI_MESSAGE_KEY_BY_TEXT).sort((a, b) => b[0].length - a[0].length)
);

export function translateUiMessage(context, text) {
    if (!context || typeof context.t !== 'function' || typeof text !== 'string') return text;
    const translateKey = (key) => {
        const translated = context.t(key);
        return typeof translated === 'string' && translated && translated !== key ? translated : '';
    };
    const exactKey = UI_MESSAGE_KEY_BY_TEXT[text];
    if (exactKey) return translateKey(exactKey) || text;
    const prefixEntry = UI_MESSAGE_PREFIX_ENTRIES.find(([sourceText]) => {
        return text.length > sourceText.length && text.startsWith(sourceText);
    });
    if (!prefixEntry) return text;
    const [sourceText, key] = prefixEntry;
    const translatedPrefix = translateKey(key);
    if (!translatedPrefix) return text;
    return `${translatedPrefix}${text.slice(sourceText.length)}`;
}

function clearProgressResetTimer(context, timerKey) {
    if (!context || !timerKey || !context[timerKey]) {
        return;
    }
    clearTimeout(context[timerKey]);
    context[timerKey] = null;
}

function scheduleProgressResetTimer(context, timerKey, progressKey, delayMs = 800) {
    if (!context || !timerKey || !progressKey) {
        return;
    }
    clearProgressResetTimer(context, timerKey);
    context[timerKey] = setTimeout(() => {
        context[progressKey] = 0;
        context[timerKey] = null;
    }, delayMs);
}

export function createRuntimeMethods(options = {}) {
    const { api } = options;

    return {
        formatLatency,

        buildSpeedTestIssue(name, result) {
            return buildSpeedTestIssue(name, result);
        },

        async runSpeedTest(name, options = {}) {
            if (!name || this.speedLoading[name]) return null;
            const silent = !!options.silent;
            this.speedLoading[name] = true;
            try {
                const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1000, Number(options.timeoutMs)) : 0;
                const payload = { name };
                if (timeoutMs) {
                    payload.timeoutMs = timeoutMs;
                }
                const res = await api('speed-test', payload);
                if (res.error) {
                    this.speedResults[name] = { ok: false, error: res.error };
                    if (!silent) {
                        this.showMessage(res.error, 'error');
                    }
                    return { ok: false, error: res.error };
                }
                this.speedResults[name] = res;
                if (!silent) {
                    const status = res.status ? ` (${res.status})` : '';
                    this.showMessage(`Speed ${name}: ${this.formatLatency(res)}${status}`, 'success');
                }
                return res;
            } catch (e) {
                const message = e && e.message ? e.message : 'Speed test failed';
                this.speedResults[name] = { ok: false, error: message };
                if (!silent) {
                    this.showMessage(message, 'error');
                }
                return { ok: false, error: message };
            } finally {
                this.speedLoading[name] = false;
            }
        },

        async runClaudeSpeedTest(name, config) {
            if (!name || this.claudeSpeedLoading[name]) return null;
            const baseUrl = config && typeof config.baseUrl === 'string' ? config.baseUrl.trim() : '';
            const apiKey = config && typeof config.apiKey === 'string' ? config.apiKey.trim() : '';
            const model = config && typeof config.model === 'string' ? config.model.trim() : '';
            this.claudeSpeedLoading[name] = true;
            try {
                if (!baseUrl) {
                    const res = { ok: false, error: 'Missing base URL' };
                    this.claudeSpeedResults[name] = res;
                    return res;
                }
                if (!apiKey) {
                    const res = { ok: false, error: 'Missing API key' };
                    this.claudeSpeedResults[name] = res;
                    return res;
                }
                if (!model) {
                    const res = { ok: false, error: 'Missing model' };
                    this.claudeSpeedResults[name] = res;
                    return res;
                }
                const res = await api('speed-test', {
                    kind: 'claude',
                    url: baseUrl,
                    apiKey,
                    model
                });
                if (res.error) {
                    this.claudeSpeedResults[name] = { ok: false, error: res.error };
                    return { ok: false, error: res.error };
                }
                this.claudeSpeedResults[name] = res;
                return res;
            } catch (e) {
                const message = e && e.message ? e.message : 'Speed test failed';
                const res = { ok: false, error: message };
                this.claudeSpeedResults[name] = res;
                return res;
            } finally {
                this.claudeSpeedLoading[name] = false;
            }
        },

        async downloadClaudeDirectory() {
            if (this.claudeDownloadLoading) return;
            clearProgressResetTimer(this, '__claudeDownloadResetTimer');
            this.claudeDownloadLoading = true;
            this.claudeDownloadProgress = 5;
            this.claudeDownloadTimer = setInterval(() => {
                if (this.claudeDownloadProgress < 90) {
                    this.claudeDownloadProgress += 5;
                }
            }, 400);
            try {
                const res = await api('download-claude-dir');
                if (res && res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                if (!res || res.success !== true || !res.fileName) {
                    this.showMessage('备份失败', 'error');
                    return;
                }
                this.claudeDownloadProgress = 100;
                const downloadUrl = `/download/${encodeURIComponent(res.fileName)}`;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = res.fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.showMessage('备份成功，开始下载', 'success');
            } catch (e) {
                this.showMessage('备份失败：' + (e && e.message ? e.message : '未知错误'), 'error');
            } finally {
                if (this.claudeDownloadTimer) {
                    clearInterval(this.claudeDownloadTimer);
                    this.claudeDownloadTimer = null;
                }
                this.claudeDownloadLoading = false;
                scheduleProgressResetTimer(this, '__claudeDownloadResetTimer', 'claudeDownloadProgress');
            }
        },

        async downloadCodexDirectory() {
            if (this.codexDownloadLoading) return;
            clearProgressResetTimer(this, '__codexDownloadResetTimer');
            this.codexDownloadLoading = true;
            this.codexDownloadProgress = 5;
            this.codexDownloadTimer = setInterval(() => {
                if (this.codexDownloadProgress < 90) {
                    this.codexDownloadProgress += 5;
                }
            }, 400);
            try {
                const res = await api('download-codex-dir');
                if (res && res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                if (!res || res.success !== true || !res.fileName) {
                    this.showMessage('备份失败', 'error');
                    return;
                }
                this.codexDownloadProgress = 100;
                const downloadUrl = `/download/${encodeURIComponent(res.fileName)}`;
                const link = document.createElement('a');
                link.href = downloadUrl;
                link.download = res.fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                this.showMessage('备份成功，开始下载', 'success');
            } catch (e) {
                this.showMessage('备份失败：' + (e && e.message ? e.message : '未知错误'), 'error');
            } finally {
                if (this.codexDownloadTimer) {
                    clearInterval(this.codexDownloadTimer);
                    this.codexDownloadTimer = null;
                }
                this.codexDownloadLoading = false;
                scheduleProgressResetTimer(this, '__codexDownloadResetTimer', 'codexDownloadProgress');
            }
        },

        triggerClaudeImport() {
            const input = this.$refs.claudeImportInput;
            if (input) {
                input.value = '';
                input.click();
            }
        },

        triggerCodexImport() {
            const input = this.$refs.codexImportInput;
            if (input) {
                input.value = '';
                input.click();
            }
        },

        handleClaudeImportChange(event) {
            const file = event && event.target && event.target.files ? event.target.files[0] : null;
            if (file) {
                void this.importBackupFile('claude', file);
            }
        },

        handleCodexImportChange(event) {
            const file = event && event.target && event.target.files ? event.target.files[0] : null;
            if (file) {
                void this.importBackupFile('codex', file);
            }
        },

        async importBackupFile(type, file) {
            const maxSize = 200 * 1024 * 1024;
            const loadingKey = type === 'claude' ? 'claudeImportLoading' : 'codexImportLoading';
            if (this[loadingKey]) {
                this.resetImportInput(type);
                return;
            }
            if (file.size > maxSize) {
                this.showMessage('备份文件过大，限制 200MB', 'error');
                this.resetImportInput(type);
                return;
            }
            this[loadingKey] = true;
            try {
                const base64 = await this.readFileAsBase64(file);
                const action = type === 'claude' ? 'restore-claude-dir' : 'restore-codex-dir';
                const res = await api(action, {
                    fileName: file.name || `${type}-backup.zip`,
                    fileBase64: base64
                });
                if (res && res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                const backupTip = res && res.backupPath ? `，原配置已备份到临时文件：${res.backupPath}` : '';
                this.showMessage(`导入成功${backupTip}`, 'success');
                try {
                    if (type === 'claude') {
                        await this.refreshClaudeSelectionFromSettings({ silent: true });
                    } else {
                        await this.loadAll();
                    }
                } catch (_) {
                    this.showMessage('导入已完成，但界面刷新失败，请手动刷新', 'error');
                }
            } catch (e) {
                this.showMessage('导入失败：' + (e && e.message ? e.message : '未知错误'), 'error');
            } finally {
                this[loadingKey] = false;
                this.resetImportInput(type);
            }
        },

        readFileAsBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result;
                    if (result instanceof ArrayBuffer) {
                        resolve(this.arrayBufferToBase64(result));
                        return;
                    }
                    if (typeof result === 'string') {
                        const idx = result.indexOf('base64,');
                        resolve(idx >= 0 ? result.slice(idx + 7) : result);
                        return;
                    }
                    reject(new Error('不支持的文件读取结果'));
                };
                reader.onerror = () => reject(new Error('读取文件失败'));
                reader.readAsArrayBuffer(file);
            });
        },

        arrayBufferToBase64(buffer) {
            const bytes = new Uint8Array(buffer);
            const chunkSize = 0x8000;
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i += chunkSize) {
                binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
            }
            return btoa(binary);
        },

        resetImportInput(type) {
            const refName = type === 'claude' ? 'claudeImportInput' : 'codexImportInput';
            const el = this.$refs[refName];
            if (el) {
                el.value = '';
            }
        },

        async loadCodexAuthProfiles(options = {}) {
            const silent = !!options.silent;
            try {
                const res = await api('list-auth-profiles');
                if (res && res.error) {
                    if (!silent) {
                        this.showMessage(res.error, 'error');
                    }
                    return;
                }
                const list = Array.isArray(res && res.profiles) ? res.profiles : [];
                this.codexAuthProfiles = list.sort((a, b) => {
                    if (!!a.current !== !!b.current) {
                        return a.current ? -1 : 1;
                    }
                    return String(a.name || '').localeCompare(String(b.name || ''));
                });
            } catch (e) {
                if (!silent) {
                    this.showMessage('读取认证列表失败', 'error');
                }
            }
        },

        showMessage(text, type) {
            if (this._messageTimer) {
                clearTimeout(this._messageTimer);
            }
            this.message = translateUiMessage(this, text);
            this.messageType = type || 'info';
            this._messageTimer = setTimeout(() => {
                this.message = '';
                this._messageTimer = null;
            }, 3000);
        }
    };
}
