export const usagePricingMixin = {
    data() { return { usagePricingOpen: false, usagePricing: null, usagePricingBusy: false, usagePricingError: '', usagePricingSequence: 0 }; },
    beforeUnmount() { this.usagePricingSequence++; },
    watch: { sessionsUsageTimeRange() { if (this.usagePricingOpen) void this.loadUsagePricing(); } },
    methods: {
        toggleUsagePricing(event) {
            if (event.target !== event.currentTarget) return;
            this.usagePricingOpen = event.currentTarget.open;
            if (this.usagePricingOpen) return this.loadUsagePricing();
        },
        async loadUsagePricing() {
            const sequence = ++this.usagePricingSequence;
            const range = this.sessionsUsageTimeRange;
            const today = new Date();
            const from = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (range === '30d' ? 29 : 6)));
            this.usagePricingBusy = true; this.usagePricingError = ''; this.usagePricing = null;
            try {
                const report = await this.featureCall('session-usage-pricing', { source: 'all', limit: range === 'all' ? 2000 : (range === '30d' ? 1200 : 600),
                    ...(range === 'all' ? {} : { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) }) });
                if (sequence === this.usagePricingSequence) this.usagePricing = report;
            } catch (error) { if (sequence === this.usagePricingSequence) this.usagePricingError = error.message; }
            finally { if (sequence === this.usagePricingSequence) this.usagePricingBusy = false; }
        },
        formatPriceUsd(value) { return value === null ? this.t('usage.records.unknown') : '$' + value.toFixed(6); },
        formatTokenRate(value) { return typeof value === 'number' ? (value * 1000000).toLocaleString('en-US', { maximumFractionDigits: 6 }) : this.t('usage.records.unknown'); },
        downloadUsagePricing() {
            if (this.usagePricing) this.downloadTextFile('codexmate-price-reference.json', JSON.stringify(this.usagePricing, null, 2), 'application/json;charset=utf-8');
        }
    }
};
