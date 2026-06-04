export function createInstallMethods(options = {}) {
    const { api } = options;
    return {
        normalizeInstallPackageManager(value) {
            const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
            if (normalized === 'pnpm' || normalized === 'bun' || normalized === 'npm') {
                return normalized;
            }
            return 'npm';
        },

        normalizeInstallAction(value) {
            const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
            if (normalized === 'update' || normalized === 'uninstall' || normalized === 'install') {
                return normalized;
            }
            return 'install';
        },

        normalizePackageVersion(value) {
            const normalized = typeof value === 'string' ? value.trim().replace(/^v/i, '') : '';
            return /^\d+(?:\.\d+){0,2}(?:[-+][0-9A-Za-z.-]+)?$/.test(normalized) ? normalized : '';
        },

        comparePackageVersions(left, right) {
            const normalizeParts = (value) => {
                const normalized = this.normalizePackageVersion(value);
                if (!normalized) return null;
                return normalized.split(/[+-]/)[0].split('.').map((part) => Number.parseInt(part, 10) || 0);
            };
            const a = normalizeParts(left);
            const b = normalizeParts(right);
            if (!a || !b) return 0;
            for (let i = 0; i < 3; i += 1) {
                const diff = (a[i] || 0) - (b[i] || 0);
                if (diff < 0) return -1;
                if (diff > 0) return 1;
            }
            return 0;
        },

        isAppUpdateAvailable() {
            const current = this.normalizePackageVersion(this.appVersion);
            const latest = this.normalizePackageVersion(this.appLatestVersion);
            if (!current || !latest) return false;
            return this.comparePackageVersions(current, latest) < 0;
        },

        isAppVersionStatusVisible() {
            return !!(this.appVersion || this.appLatestVersion || this.appVersionStatusLoading || this.appVersionStatusChecked || this.appVersionStatusError);
        },

        appVersionStatusKind() {
            if (this.appVersionStatusLoading) return 'loading';
            if (this.appVersionStatusError) return 'error';
            if (this.isAppUpdateAvailable()) return 'available';
            if (this.appVersionStatusChecked) return 'current';
            return 'idle';
        },

        appUpdateNoticeText() {
            if (this.appVersionStatusLoading) return this.t('side.update.checking');
            if (this.appVersionStatusError) return this.t('side.update.retry');
            const latest = this.normalizePackageVersion(this.appLatestVersion);
            if (this.isAppUpdateAvailable()) return latest
                ? this.t('side.update.availableWithVersion', { version: latest })
                : this.t('side.update.available');
            if (this.appVersionStatusChecked) return this.t('side.update.upToDate');
            return this.t('side.update.check');
        },

        appUpdateNoticeMeta() {
            if (this.appVersionStatusLoading) return this.t('side.update.checkingMeta');
            if (this.appVersionStatusError) return this.appVersionStatusError;
            const current = this.normalizePackageVersion(this.appVersion);
            const latest = this.normalizePackageVersion(this.appLatestVersion);
            if (current && latest) {
                return this.t('side.update.metaVersions', { current, latest });
            }
            if (current) {
                return this.t('side.update.currentOnly', { current });
            }
            return this.t('side.update.meta');
        },

        appVersionStatusTitle() {
            const source = typeof this.appVersionStatusSource === 'string' ? this.appVersionStatusSource.trim() : '';
            const checkedAt = typeof this.appVersionStatusCheckedAt === 'string' ? this.appVersionStatusCheckedAt.trim() : '';
            const suffix = [source, checkedAt].filter(Boolean).join(' · ');
            const meta = this.appUpdateNoticeMeta();
            return suffix ? `${meta} · ${suffix}` : meta;
        },

        handleAppVersionStatusClick() {
            if (this.isAppUpdateAvailable()) {
                this.openAppUpdateDocs();
                return;
            }
            void this.loadAppVersionStatus({ silent: false, force: true });
        },

        async loadAppVersionStatus(options = {}) {
            if (typeof api !== 'function') return false;
            if (this.appVersionStatusLoading) return false;
            this.appVersionStatusLoading = true;
            this.appVersionStatusError = '';
            try {
                const res = await api('version-status', options.force ? { force: true } : {});
                if (res && res.currentVersion && !this.appVersion) {
                    this.appVersion = this.normalizePackageVersion(res.currentVersion) || String(res.currentVersion || '');
                }
                if (res && res.latestVersion) {
                    this.appLatestVersion = this.normalizePackageVersion(res.latestVersion) || String(res.latestVersion || '');
                }
                if (res && typeof res.source === 'string') {
                    this.appVersionStatusSource = res.source;
                }
                if (res && typeof res.checkedAt === 'string') {
                    this.appVersionStatusCheckedAt = res.checkedAt;
                }
                if (res && res.error) {
                    this.appVersionStatusError = res.error;
                    this.appVersionStatusChecked = true;
                    if (!options.silent) this.showMessage(res.error, 'error');
                    return false;
                }
                this.appVersionStatusChecked = true;
                return true;
            } catch (e) {
                const message = e && e.message ? e.message : this.t('side.update.checkFailed');
                this.appVersionStatusError = message;
                this.appVersionStatusChecked = true;
                if (!options.silent) this.showMessage(message, 'error');
                return false;
            } finally {
                this.appVersionStatusLoading = false;
            }
        },

        openAppUpdateDocs() {
            this.installCommandAction = 'update';
            if (typeof this.switchMainTab === 'function') {
                this.switchMainTab('docs');
            }
        },

        normalizeInstallRegistryPreset(value) {
            const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
            if (normalized === 'default' || normalized === 'npmmirror' || normalized === 'tencent' || normalized === 'custom') {
                return normalized;
            }
            return 'default';
        },

        normalizeInstallRegistryUrl(value) {
            const normalized = typeof value === 'string' ? value.trim() : '';
            if (!normalized) return '';
            if (!/^https?:\/\//i.test(normalized)) {
                return '';
            }
            const afterScheme = normalized.replace(/^https?:\/\//i, '');
            if (!afterScheme || /^[/?#]/.test(afterScheme)) {
                return '';
            }
            const trimmed = normalized.replace(/\/+$/, '');
            try {
                const parsed = new URL(trimmed);
                if (!/^https?:$/i.test(parsed.protocol) || !parsed.hostname) {
                    return '';
                }
            } catch {
                return '';
            }
            return trimmed;
        },

        resolveInstallRegistryUrl(presetValue, customValue) {
            const preset = this.normalizeInstallRegistryPreset(presetValue);
            if (preset === 'npmmirror') {
                return 'https://registry.npmmirror.com';
            }
            if (preset === 'tencent') {
                return 'https://mirrors.cloud.tencent.com/npm';
            }
            if (preset === 'custom') {
                return this.normalizeInstallRegistryUrl(customValue);
            }
            return '';
        },

        appendInstallRegistryOption(command, actionName) {
            const base = typeof command === 'string' ? command.trim() : '';
            if (!base) return '';
            const action = this.normalizeInstallAction(actionName);
            if (action === 'uninstall') {
                return base;
            }
            const registry = this.resolveInstallRegistryUrl(this.installRegistryPreset, this.installRegistryCustom);
            if (!registry) {
                return base;
            }
            const quoteArg = typeof this.quoteShellArg === 'function'
                ? this.quoteShellArg(registry)
                : `'${registry.replace(/'/g, `'\\''`)}'`;
            return `${base} --registry=${quoteArg}`;
        },

        resolveInstallPlatform() {
            const navUserAgent = typeof navigator !== 'undefined' && typeof navigator.userAgent === 'string'
                ? navigator.userAgent.trim().toLowerCase()
                : '';
            // Termux runs on Android; Codex CLI needs a Termux-friendly build.
            if (navUserAgent.includes('termux') || navUserAgent.includes('android')) {
                return 'termux';
            }
            const navPlatform = typeof navigator !== 'undefined' && typeof navigator.platform === 'string'
                ? navigator.platform.trim().toLowerCase()
                : '';
            if (navPlatform.includes('win')) return 'win32';
            if (navPlatform.includes('mac')) return 'darwin';
            return 'linux';
        },

        buildInstallCommandMatrix(packageManager, platformOverride = '') {
            const manager = this.normalizeInstallPackageManager(packageManager);
            const platform = platformOverride ? String(platformOverride).trim().toLowerCase() : this.resolveInstallPlatform();
            const codexPackage = platform === 'termux' ? '@mmmbuto/codex-cli-termux' : '@openai/codex';
            const codexInstallPackage = platform === 'termux' ? '@mmmbuto/codex-cli-termux@latest' : '@openai/codex';
            const matrix = {
                claude: {
                    install: '',
                    update: '',
                    uninstall: ''
                },
                codebuddy: {
                    install: '',
                    update: '',
                    uninstall: ''
                },
                gemini: {
                    install: '',
                    update: '',
                    uninstall: ''
                },
                codex: {
                    install: '',
                    update: '',
                    uninstall: ''
                }
            };
            if (manager === 'pnpm') {
                matrix.claude.install = 'pnpm add -g @anthropic-ai/claude-code';
                matrix.claude.update = 'pnpm up -g @anthropic-ai/claude-code';
                matrix.claude.uninstall = 'pnpm remove -g @anthropic-ai/claude-code';
                matrix.codebuddy.install = 'pnpm add -g @tencent-ai/codebuddy-code';
                matrix.codebuddy.update = 'pnpm up -g @tencent-ai/codebuddy-code';
                matrix.codebuddy.uninstall = 'pnpm remove -g @tencent-ai/codebuddy-code';
                matrix.gemini.install = 'pnpm add -g @google/gemini-cli';
                matrix.gemini.update = 'pnpm up -g @google/gemini-cli';
                matrix.gemini.uninstall = 'pnpm remove -g @google/gemini-cli';
                matrix.codex.install = `pnpm add -g ${codexInstallPackage}`;
                matrix.codex.update = `pnpm up -g ${codexPackage}`;
                matrix.codex.uninstall = `pnpm remove -g ${codexPackage}`;
                return matrix;
            }
            if (manager === 'bun') {
                matrix.claude.install = 'bun add -g @anthropic-ai/claude-code';
                matrix.claude.update = 'bun update -g @anthropic-ai/claude-code';
                matrix.claude.uninstall = 'bun remove -g @anthropic-ai/claude-code';
                matrix.codebuddy.install = 'bun add -g @tencent-ai/codebuddy-code';
                matrix.codebuddy.update = 'bun update -g @tencent-ai/codebuddy-code';
                matrix.codebuddy.uninstall = 'bun remove -g @tencent-ai/codebuddy-code';
                matrix.gemini.install = 'bun add -g @google/gemini-cli';
                matrix.gemini.update = 'bun update -g @google/gemini-cli';
                matrix.gemini.uninstall = 'bun remove -g @google/gemini-cli';
                matrix.codex.install = `bun add -g ${codexInstallPackage}`;
                matrix.codex.update = `bun update -g ${codexPackage}`;
                matrix.codex.uninstall = `bun remove -g ${codexPackage}`;
                return matrix;
            }
            matrix.claude.install = 'npm install -g @anthropic-ai/claude-code';
            matrix.claude.update = 'npm update -g @anthropic-ai/claude-code';
            matrix.claude.uninstall = 'npm uninstall -g @anthropic-ai/claude-code';
            matrix.codebuddy.install = 'npm install -g @tencent-ai/codebuddy-code';
            matrix.codebuddy.update = 'npm update -g @tencent-ai/codebuddy-code';
            matrix.codebuddy.uninstall = 'npm uninstall -g @tencent-ai/codebuddy-code';
            matrix.gemini.install = 'npm install -g @google/gemini-cli';
            matrix.gemini.update = 'npm update -g @google/gemini-cli';
            matrix.gemini.uninstall = 'npm uninstall -g @google/gemini-cli';
            matrix.codex.install = `npm install -g ${codexInstallPackage}`;
            matrix.codex.update = platform === 'termux'
                ? `npm install -g ${codexInstallPackage}`
                : `npm update -g ${codexPackage}`;
            matrix.codex.uninstall = `npm uninstall -g ${codexPackage}`;
            return matrix;
        },

        getInstallCommand(targetId, actionName, platformOverride = '') {
            const targetKey = typeof targetId === 'string' ? targetId.trim() : '';
            if (!targetKey) return '';
            const action = this.normalizeInstallAction(actionName);
            const currentMap = this.buildInstallCommandMatrix(this.installPackageManager, platformOverride);
            const current = currentMap[targetKey] && typeof currentMap[targetKey][action] === 'string'
                ? currentMap[targetKey][action]
                : '';
            return this.appendInstallRegistryOption(current, action);
        },

        setInstallCommandAction(actionName) {
            this.installCommandAction = this.normalizeInstallAction(actionName);
        },

        setInstallRegistryPreset(presetName) {
            this.installRegistryPreset = this.normalizeInstallRegistryPreset(presetName);
        },

        getInstallStatusTarget(targetId) {
            const key = typeof targetId === 'string' ? targetId.trim() : '';
            if (!key) return null;
            const list = Array.isArray(this.installStatusTargets) ? this.installStatusTargets : [];
            return list.find((item) => item && item.id === key) || null;
        },

        isInstallTargetInstalled(targetId) {
            const target = this.getInstallStatusTarget(targetId);
            return !!(target && target.installed === true);
        },

        shouldShowCliInstallPlaceholder(targetId) {
            return Array.isArray(this.installStatusTargets) && !this.isInstallTargetInstalled(targetId);
        }
    };
}
