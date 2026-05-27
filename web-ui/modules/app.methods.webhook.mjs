import { api } from './api.mjs';

export function createWebhookMethods() {
    return {
        openWebhookModal() {
            this.showWebhookModal = true;
        },

        closeWebhookModal() {
            this.showWebhookModal = false;
        },

        async loadWebhookSettings() {
            try {
                const data = await api('get-webhook-config');
                if (data && typeof data === 'object' && !data.error) {
                    this.webhookConfig = {
                        enabled: !!data.enabled,
                        url: typeof data.url === 'string' ? data.url : '',
                        events: Array.isArray(data.events) && data.events.length
                            ? data.events.slice()
                            : this.webhookEventOptions.slice()
                    };
                }
            } catch (e) {
                this.webhookTestResult = { ok: false, error: e && e.message ? e.message : String(e) };
            }
        },

        async saveWebhookSettings() {
            this.webhookSaving = true;
            try {
                const cfg = {
                    enabled: !!this.webhookConfig.enabled,
                    url: typeof this.webhookConfig.url === 'string' ? this.webhookConfig.url.trim() : '',
                    events: Array.isArray(this.webhookConfig.events) ? this.webhookConfig.events.slice() : []
                };
                const saved = await api('set-webhook-config', { config: cfg });
                if (saved && typeof saved === 'object' && !saved.error) {
                    this.webhookConfig = {
                        enabled: !!saved.enabled,
                        url: typeof saved.url === 'string' ? saved.url : '',
                        events: Array.isArray(saved.events) ? saved.events.slice() : []
                    };
                    this.webhookTestResult = { ok: true, status: 'saved' };
                } else {
                    this.webhookTestResult = { ok: false, error: (saved && saved.error) || 'save failed' };
                }
            } catch (e) {
                this.webhookTestResult = { ok: false, error: e && e.message ? e.message : String(e) };
            } finally {
                this.webhookSaving = false;
            }
        },

        async testWebhook() {
            this.webhookTesting = true;
            try {
                const cfg = {
                    enabled: true,
                    url: typeof this.webhookConfig.url === 'string' ? this.webhookConfig.url.trim() : '',
                    events: Array.isArray(this.webhookConfig.events) && this.webhookConfig.events.length
                        ? this.webhookConfig.events.slice()
                        : this.webhookEventOptions.slice()
                };
                const r = await api('test-webhook', { config: cfg });
                this.webhookTestResult = r || { ok: false, error: 'no result' };
            } catch (e) {
                this.webhookTestResult = { ok: false, error: e && e.message ? e.message : String(e) };
            } finally {
                this.webhookTesting = false;
            }
        },

        toggleWebhookEvent(eventName) {
            if (!Array.isArray(this.webhookConfig.events)) {
                this.webhookConfig.events = [];
            }
            const idx = this.webhookConfig.events.indexOf(eventName);
            if (idx === -1) {
                this.webhookConfig.events.push(eventName);
            } else {
                this.webhookConfig.events.splice(idx, 1);
            }
        }
    };
}
