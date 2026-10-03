export function createTextToolsMethods() {
    return {
        async copyTextToolsOutput() {
            const text = typeof this.textToolsOutput === 'string' ? this.textToolsOutput.trim() : '';
            if (!text) {
                this.showMessage(typeof this.t === 'function' ? this.t('toast.copy.empty') : 'Nothing to copy', 'info');
                return;
            }
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    this.showMessage(typeof this.t === 'function' ? this.t('toast.copy.ok') : 'Copied', 'success');
                    return;
                }
            } catch (_) {}
            const ok = typeof this.fallbackCopyText === 'function' ? this.fallbackCopyText(text) : false;
            if (ok) {
                this.showMessage(typeof this.t === 'function' ? this.t('toast.copy.ok') : 'Copied', 'success');
                return;
            }
            this.showMessage(typeof this.t === 'function' ? this.t('toast.copy.fail') : 'Copy failed', 'error');
        }
    };
}
