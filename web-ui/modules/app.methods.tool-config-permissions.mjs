export function createToolConfigPermissionMethods(options = {}) {
    const { api } = options;

    function normalizeTarget(value) {
        const target = typeof value === 'string' ? value.trim().toLowerCase() : '';
        return target === 'codex' || target === 'claude' ? target : '';
    }

    function normalizePermissions(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        return {
            codex: source.codex === true,
            claude: source.claude === true
        };
    }

    return {
        isToolConfigWriteAllowed(target) {
            const normalizedTarget = normalizeTarget(target);
            if (!normalizedTarget) return false;
            return normalizePermissions(this.toolConfigPermissions)[normalizedTarget] === true;
        },

        toolConfigPermissionStatusLabel(target) {
            return this.isToolConfigWriteAllowed(target)
                ? this.t('toolConfig.allow')
                : this.t('toolConfig.viewOnly');
        },

        async setToolConfigPermission(target, allowWrite) {
            const normalizedTarget = normalizeTarget(target);
            if (!normalizedTarget || this.toolConfigPermissionSaving[normalizedTarget]) return;

            const nextAllowWrite = allowWrite === true;
            const previous = normalizePermissions(this.toolConfigPermissions);
            if (previous[normalizedTarget] === nextAllowWrite) return;

            if (nextAllowWrite) {
                const confirmed = await this.requestConfirmDialog({
                    title: this.t('toolConfig.confirmTitle'),
                    message: this.t(`toolConfig.${normalizedTarget}.confirmMessage`),
                    confirmText: this.t('toolConfig.confirmAllow'),
                    cancelText: this.t('confirm.cancel'),
                    danger: true
                });
                if (!confirmed) {
                    this.toolConfigPermissions = { ...previous };
                    return;
                }
            }

            this.toolConfigPermissionSaving = {
                ...this.toolConfigPermissionSaving,
                [normalizedTarget]: true
            };
            try {
                const res = await api('set-tool-config-permission', {
                    target: normalizedTarget,
                    allowWrite: nextAllowWrite
                });
                if (res && res.error) {
                    this.toolConfigPermissions = { ...previous };
                    this.showMessage(res.error, 'error');
                    return;
                }
                this.toolConfigPermissions = normalizePermissions(res && res.permissions);
                try {
                    localStorage.setItem('toolConfigPermissions', JSON.stringify(this.toolConfigPermissions));
                } catch (_) {}
                this.showMessage(
                    nextAllowWrite
                        ? this.t('toolConfig.allowToast')
                        : this.t('toolConfig.viewOnlyToast'),
                    'success'
                );
                try {
                    await this.loadAll({ preserveLoading: true });
                } catch (_) {}
            } catch (_) {
                this.toolConfigPermissions = { ...previous };
                this.showMessage(this.t('toolConfig.saveFailed'), 'error');
            } finally {
                this.toolConfigPermissionSaving = {
                    ...this.toolConfigPermissionSaving,
                    [normalizedTarget]: false
                };
            }
        }
    };
}
