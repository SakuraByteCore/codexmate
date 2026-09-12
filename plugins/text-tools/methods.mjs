import { findTextTool } from './tools.mjs';
import {
    persistTextToolsInputToStorage,
    clearTextToolsStorage
} from './storage.mjs';

function showMessage(app, text, type) {
    if (app && typeof app.showMessage === 'function') {
        app.showMessage(text, type || 'info');
    }
}

function translate(app, key, fallback) {
    const t = app && typeof app.t === 'function' ? app.t : null;
    if (!t) return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
}

export function createPluginsMethods() {
    return {
        onTextToolsInput() {
            persistTextToolsInputToStorage(this.textToolsInput, localStorage);
        },

        applyTextTool(id) {
            const tool = findTextTool(id);
            if (!tool || typeof tool.run !== 'function') {
                showMessage(this, translate(this, 'plugins.textTools.error.unknownTool', 'Unknown tool'), 'error');
                return;
            }
            const input = typeof this.textToolsInput === 'string' ? this.textToolsInput : '';
            try {
                this.textToolsOutput = tool.run(input);
            } catch (e) {
                showMessage(this, translate(this, 'plugins.textTools.error.invalidInput', 'Invalid input'), 'error');
            }
        },

        async copyTextToolsOutput() {
            const text = typeof this.textToolsOutput === 'string' ? this.textToolsOutput : '';
            if (!text) {
                showMessage(this, translate(this, 'toast.copy.empty', 'Nothing to copy'), 'info');
                return;
            }
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(text);
                    showMessage(this, translate(this, 'toast.copy.ok', 'Copied'), 'success');
                    return;
                }
            } catch (_) {}
            const ok = typeof this.fallbackCopyText === 'function' ? this.fallbackCopyText(text) : false;
            if (ok) {
                showMessage(this, translate(this, 'toast.copy.ok', 'Copied'), 'success');
                return;
            }
            showMessage(this, translate(this, 'toast.copy.fail', 'Copy failed'), 'error');
        },

        clearTextTools() {
            this.textToolsInput = '';
            this.textToolsOutput = '';
            clearTextToolsStorage(localStorage);
        },

        swapTextTools() {
            const currentOutput = typeof this.textToolsOutput === 'string' ? this.textToolsOutput : '';
            this.textToolsOutput = typeof this.textToolsInput === 'string' ? this.textToolsInput : '';
            this.textToolsInput = currentOutput;
            persistTextToolsInputToStorage(this.textToolsInput, localStorage);
        }
    };
}