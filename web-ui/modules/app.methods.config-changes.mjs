import { CONFIG_CHANGE_ACTIONS } from './config-change-actions.mjs';
import { api, setConfigChangeHandler, getConfigChangeBaseline } from './api.mjs';

export const configChangeMixin = {
    methods: createConfigChangeMethods(),
    data() {
        return { configChangePreview: null, configChangeBusy: false, configChangeApplying: false, configChangeError: '', lastConfigChange: null };
    }
};

export function createConfigChangeMethods() {
    return {
        installConfigChangePreview() {
            this._configChangeApiHandler = (action, params) => this.requestConfigChange(action, params);
            setConfigChangeHandler(this._configChangeApiHandler);
            this.refreshLastConfigChange();
        },
        uninstallConfigChangePreview() {
            setConfigChangeHandler(null, this._configChangeApiHandler);
            this.closeConfigChangePreview({ force: true });
        },
        async requestConfigChange(action, params) {
            if (this.configChangePreview || this.configChangeBusy) return { error: this.t('changes.busy'), success: false };
            this.configChangeBusy = true;
            try {
                const preview = await api('preview-config-change', { action, params, baseline: getConfigChangeBaseline(CONFIG_CHANGE_ACTIONS[action]) });
                if (preview.error) return { ...preview, error: this.configChangeErrorText(preview) };
                if (!preview.hasChanges || this.configTemplateDiffConfirmEnabled === false) {
                    const result = await api('apply-config-change', { previewId: preview.previewId });
                    if (!result.error) await this.refreshLastConfigChange();
                    return result.error ? { ...result, error: this.configChangeErrorText(result) } : result;
                }
                this._configChangeReturnFocus = typeof document !== 'undefined' ? document.activeElement : null;
                this.configChangePreview = preview;
                this.configChangeError = '';
                const pending = new Promise(resolve => { this._configChangeResolve = resolve; });
                if (typeof this.$nextTick === 'function') this.$nextTick(() => this.$refs.configChangeCancel && this.$refs.configChangeCancel.focus());
                return await pending;
            } finally { this.configChangeBusy = false; }
        },
        configChangeErrorText(result) {
            const key = `changes.error.${result.errorCode || ''}`;
            const translated = this.t(key);
            return translated === key ? this.t('changes.failed') : translated;
        },
        closeConfigChangePreview({ force = false } = {}) {
            if (this.configChangeApplying && !force) return;
            const resolve = this._configChangeResolve;
            this._configChangeResolve = null;
            this.configChangePreview = null;
            this.configChangeError = '';
            if (resolve) resolve({ canceled: true, success: false, error: this.t('changes.cancelled') });
            const focus = this._configChangeReturnFocus;
            this._configChangeReturnFocus = null;
            if (focus && typeof focus.focus === 'function') focus.focus();
        },
        async confirmConfigChange() {
            if (!this.configChangePreview || this.configChangeApplying) return;
            this.configChangeApplying = true;
            try {
                const result = await api('apply-config-change', { previewId: this.configChangePreview.previewId });
                if (result.error) {
                    this.configChangeError = this.configChangeErrorText(result);
                    if (result.rollbackFailed && result.rollbackFailed.length) this.configChangeError += ' ' + this.t('changes.restoreFailed', { paths: result.rollbackFailed.join(', ') });
                    return;
                }
                const resolve = this._configChangeResolve;
                this._configChangeResolve = null;
                this.closeConfigChangePreview({ force: true });
                if (resolve) resolve(result);
                await this.refreshLastConfigChange();
            } catch (_) {
                this.configChangeError = this.t('changes.failed');
            } finally { this.configChangeApplying = false; }
        },
        async refreshLastConfigChange() {
            const target = this.configMode;
            try {
                const result = await api('get-last-config-change', { target });
                if (this.configMode === target) this.lastConfigChange = result.change || null;
            } catch (_) {
                if (this.configMode === target) this.lastConfigChange = null;
            }
        },
        async undoLastConfigChange() {
            const change = this.lastConfigChange;
            if (!change || this.configChangeBusy || this.configChangeApplying || !this.isToolConfigWriteAllowed(change.target)) return;
            const confirmed = await this.requestConfirmDialog({
                title: this.t('changes.undo'), message: this.t('changes.undoConfirm', { paths: change.files.map(file => file.path).join('\n') }),
                confirmText: this.t('changes.undo'), cancelText: this.t('common.cancel'), danger: true
            });
            if (!confirmed) return;
            this.configChangeBusy = true;
            try {
                const result = await api('undo-config-change', { target: change.target, changeId: change.id });
                if (result.error) {
                    let message = this.configChangeErrorText(result);
                    if (result.rollbackFailed && result.rollbackFailed.length) message += ' ' + this.t('changes.restoreFailed', { paths: result.rollbackFailed.join(', ') });
                    this.showMessage(message, 'error');
                    return;
                }
                this.showMessage(this.t('changes.undone'), 'success');
                await this.refreshLastConfigChange();
                if (change.target === 'codex' || change.target === 'claude') await this.loadAll();
                if (change.target === 'claude') this._lastAppliedClaudeKey = '';
                if (change.target === 'openclaw') await this.syncDefaultOpenclawConfigEntry();
                if (change.target === 'opencode') await this.loadOpencodeConfig();
                if (change.target === 'kilocode') await this.loadKilocodeConfig();
                if (change.target === 'pi') await this.loadPiSources();
            } catch (_) { this.showMessage(this.t('changes.refreshFailed'), 'error'); }
            finally { this.configChangeBusy = false; }
        },
        handleConfigChangeKeydown(event) {
            if (event.key === 'Escape') { event.stopPropagation(); this.closeConfigChangePreview(); return; }
            if (event.key !== 'Tab') return;
            event.stopPropagation();
            const items = [...event.currentTarget.querySelectorAll('button:not(:disabled), [tabindex="0"]')];
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    };
}
