export function createProviderCacheMethods(options = {}) {
    const { api } = options;

    return {
        async openProviderCacheModal(options = {}) {
            this.showProviderCacheModal = true;
            if (options.forceRefresh === true || !this.providerCacheLoadedOnce) {
                await this.loadProviderCacheRecords({ forceRefresh: options.forceRefresh === true });
            }
        },

        closeProviderCacheModal() {
            this.showProviderCacheModal = false;
        },

        async openProviderCacheAnnouncementModal() {
            this.showProviderCacheAnnouncementModal = true;
            if (!this.providerCacheLoadedOnce) {
                await this.loadProviderCacheRecords();
            }
        },

        closeProviderCacheAnnouncementModal() {
            this.showProviderCacheAnnouncementModal = false;
        },

        async openProviderCacheDetailsFromAnnouncement() {
            this.showProviderCacheAnnouncementModal = false;
            await this.openProviderCacheModal({ forceRefresh: false });
        },

        async loadProviderCacheRecords(options = {}) {
            const forceRefresh = options && options.forceRefresh === true;
            const background = options && options.background === true;
            if (this.providerCacheLoading && !forceRefresh) return;
            const requestSeq = (Number(this.providerCacheRequestSeq) || 0) + 1;
            this.providerCacheRequestSeq = requestSeq;
            const isLatestRequest = () => requestSeq === Number(this.providerCacheRequestSeq || 0);
            if (!background) {
                this.providerCacheLoading = true;
            }
            this.providerCacheError = '';
            try {
                const res = await api('get-provider-cache-records');
                if (!isLatestRequest()) return;
                if (res && res.error) {
                    this.providerCacheError = res.error;
                    return;
                }
                this.providerCacheRecords = res && typeof res === 'object' ? res : { groups: [] };
                this.providerCacheLoadedOnce = true;
                this.providerCacheLoadedAt = this.providerCacheRecords.generatedAt || new Date().toISOString();
            } catch (e) {
                if (!isLatestRequest()) return;
                this.providerCacheError = e && e.message ? e.message : this.t('modal.providerCache.loadFailed');
            } finally {
                if (isLatestRequest() && !background) {
                    this.providerCacheLoading = false;
                }
            }
        },

        async syncProviderCacheRecords() {
            if (this.providerCacheSyncing) return;
            this.providerCacheSyncing = true;
            this.providerCacheError = '';
            this.providerCacheSyncMessage = '';
            try {
                const res = await api('sync-provider-cache-records');
                if (res && res.error) {
                    this.providerCacheError = res.errorKey ? this.t(res.errorKey) : res.error;
                    return;
                }
                const summary = res && res.summary && typeof res.summary === 'object' ? res.summary : {};
                const providerCount = Number(summary.providerCount || 0);
                const fileCount = Number(summary.fileCount || 0);
                this.providerCacheSyncMessage = this.t('modal.providerCache.syncSucceeded', { count: providerCount, fileCount });
                if (res && res.records && typeof res.records === 'object') {
                    this.providerCacheRecords = res.records;
                    this.providerCacheLoadedOnce = true;
                    this.providerCacheLoadedAt = this.providerCacheRecords.generatedAt || new Date().toISOString();
                }
                await this.loadProviderCacheRecords({ forceRefresh: true });
            } catch (e) {
                this.providerCacheError = e && e.message ? e.message : this.t('modal.providerCache.syncFailed');
            } finally {
                this.providerCacheSyncing = false;
            }
        },

        getProviderCacheGroups() {
            const records = this.providerCacheRecords && typeof this.providerCacheRecords === 'object'
                ? this.providerCacheRecords
                : {};
            return Array.isArray(records.groups) ? records.groups : [];
        },

        getProviderCacheAnnouncementSummary() {
            const groups = this.getProviderCacheGroups();
            let fileCount = 0;
            let providerCount = 0;
            for (const group of groups) {
                const files = this.getProviderCacheExistingFiles(group);
                fileCount += files.length;
                for (const file of files) {
                    const count = Number(file && file.providerCount);
                    if (Number.isFinite(count) && count > 0) {
                        providerCount += count;
                    } else {
                        providerCount += this.getProviderCacheFileProviders(file).length;
                    }
                }
            }
            return {
                groupCount: groups.length,
                fileCount,
                providerCount,
                loadedAt: this.providerCacheLoadedAt || (this.providerCacheRecords && this.providerCacheRecords.generatedAt) || ''
            };
        },

        getProviderCacheAnnouncementGroups() {
            return this.getProviderCacheGroups().map((group) => {
                const existingFiles = this.getProviderCacheExistingFiles(group);
                return {
                    key: group && group.key ? group.key : '',
                    label: group && group.label ? group.label : '',
                    existingCount: existingFiles.length,
                    providerCount: existingFiles.reduce((sum, file) => {
                        const count = Number(file && file.providerCount);
                        if (Number.isFinite(count) && count > 0) return sum + count;
                        return sum + this.getProviderCacheFileProviders(file).length;
                    }, 0)
                };
            });
        },

        getProviderCacheExistingFiles(group) {
            const files = group && Array.isArray(group.files) ? group.files : [];
            return files.filter((file) => file && file.exists);
        },

        hasProviderCacheExistingFiles(group) {
            return this.getProviderCacheExistingFiles(group).length > 0;
        },

        getProviderCacheFileKey(file) {
            if (!file) return '';
            return file.displayPath || file.path || file.name || '';
        },

        getProviderCacheFilePath(file) {
            if (!file) return '';
            return file.displayPath || file.path || file.name || '';
        },

        getProviderCacheFileSummary(file) {
            if (!file || !file.exists) return '';
            const count = Number(file.providerCount || 0);
            if (count > 0) return this.t('modal.providerCache.providerCount', { count });
            if (file.tooLarge) return this.t('modal.providerCache.tooLarge');
            if (file.ok === false) return this.t('modal.providerCache.parseFailed');
            return this.t('modal.providerCache.rawJsonOnly');
        },

        getProviderCacheFileProviders(file) {
            const providers = file && Array.isArray(file.providers) ? file.providers : [];
            return providers.filter((provider) => provider && typeof provider === 'object');
        },

        hasProviderCacheProviders(file) {
            return this.getProviderCacheFileProviders(file).length > 0;
        },

        getProviderCacheProviderMeta(provider) {
            if (!provider || typeof provider !== 'object') return [];
            const fields = [
                ['baseUrl', 'base_url'],
                ['wireApi', 'wire_api'],
                ['authMethod', 'auth'],
                ['model', 'model']
            ];
            return fields
                .map(([key, label]) => {
                    const value = provider[key];
                    if (value === undefined || value === null || value === '') return null;
                    return { label, value: String(value) };
                })
                .filter(Boolean);
        },

        getProviderCacheProviderText(provider) {
            if (!provider || typeof provider !== 'object') return '';
            try {
                return JSON.stringify(provider.data === undefined ? provider : provider.data, null, 2);
            } catch (_) {
                return String(provider.name || '');
            }
        },

        getProviderCacheRecordText(record) {
            if (!record || !record.exists) return '';
            if (record.ok === false) {
                return record.error || '';
            }
            try {
                return JSON.stringify(record.data === undefined ? null : record.data, null, 2);
            } catch (_) {
                return String(record.data || '');
            }
        },

        formatProviderCacheFileSize(size) {
            const bytes = Number(size);
            if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
            if (bytes < 1024) return `${Math.floor(bytes)} B`;
            const kib = bytes / 1024;
            if (kib < 1024) return `${kib.toFixed(kib >= 10 ? 0 : 1)} KiB`;
            const mib = kib / 1024;
            return `${mib.toFixed(mib >= 10 ? 1 : 2)} MiB`;
        }
    };
}
