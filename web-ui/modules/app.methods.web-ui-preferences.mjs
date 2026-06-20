export function createWebUiPreferencesMethods(options = {}) {
    const api = typeof options.api === 'function' ? options.api : async () => ({});
    const storageOverride = options.storage && typeof options.storage === 'object' ? options.storage : null;

    const getLocalStorage = () => {
        const storage = storageOverride || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
        return storage && typeof storage.setItem === 'function' && typeof storage.removeItem === 'function'
            ? storage
            : null;
    };

    const setLocalStorageValue = (key, value) => {
        const storage = getLocalStorage();
        if (!storage) return;
        try {
            if (value === null || value === undefined || value === '') {
                storage.removeItem(key);
            } else {
                storage.setItem(key, String(value));
            }
        } catch (_) {}
    };

    const normalizeUsageTimeRange = (value) => {
        const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
        if (normalized === 'all' || normalized === '30d') return normalized;
        return '7d';
    };

    const normalizePromptsSubTab = (value) => {
        const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
        return normalized === 'claude-project' ? 'claude-project' : 'codex';
    };

    const normalizeNavigationSnapshot = (vm, source = {}) => {
        const currentSkillsTargetApp = vm.skillsTargetApp === 'claude' ? 'claude' : 'codex';
        const currentPromptTemplatesMode = vm.promptTemplatesMode === 'manage' ? 'manage' : 'compose';
        return {
            mainTab: typeof source.mainTab === 'string' ? source.mainTab : vm.mainTab,
            configMode: typeof source.configMode === 'string' ? source.configMode : vm.configMode,
            settingsTab: typeof source.settingsTab === 'string' ? source.settingsTab : vm.settingsTab,
            skillsTargetApp: source.skillsTargetApp === 'claude' || source.skillsTargetApp === 'codex'
                ? source.skillsTargetApp
                : currentSkillsTargetApp,
            promptTemplatesMode: source.promptTemplatesMode === 'manage' || source.promptTemplatesMode === 'compose'
                ? source.promptTemplatesMode
                : currentPromptTemplatesMode
        };
    };

    return {
        buildWebUiPreferencesSnapshot(overrides = {}) {
            const navigationOverride = overrides && typeof overrides.navigation === 'object' && overrides.navigation
                ? overrides.navigation
                : null;
            return {
                shareCommandPrefix: typeof this.normalizeShareCommandPrefix === 'function'
                    ? this.normalizeShareCommandPrefix(overrides.shareCommandPrefix || this.shareCommandPrefix)
                    : (this.shareCommandPrefix || 'npm start'),
                sessionTrashEnabled: typeof this.normalizeSessionTrashEnabled === 'function'
                    ? this.normalizeSessionTrashEnabled(Object.prototype.hasOwnProperty.call(overrides, 'sessionTrashEnabled') ? overrides.sessionTrashEnabled : this.sessionTrashEnabled)
                    : this.sessionTrashEnabled !== false,
                sessionTrashRetentionDays: typeof this.normalizeSessionTrashRetentionDays === 'function'
                    ? this.normalizeSessionTrashRetentionDays(Object.prototype.hasOwnProperty.call(overrides, 'sessionTrashRetentionDays') ? overrides.sessionTrashRetentionDays : this.sessionTrashRetentionDays)
                    : 30,
                sessionTimelineStyle: typeof this.normalizeSessionTimelineStyle === 'function'
                    ? this.normalizeSessionTimelineStyle(overrides.sessionTimelineStyle || this.sessionTimelineStyle)
                    : (this.sessionTimelineStyle === 'bar' ? 'bar' : 'dots'),
                configTemplateDiffConfirmEnabled: typeof this.normalizeConfigTemplateDiffConfirmEnabled === 'function'
                    ? this.normalizeConfigTemplateDiffConfirmEnabled(Object.prototype.hasOwnProperty.call(overrides, 'configTemplateDiffConfirmEnabled') ? overrides.configTemplateDiffConfirmEnabled : this.configTemplateDiffConfirmEnabled)
                    : this.configTemplateDiffConfirmEnabled !== false,
                sessionsUsageTimeRange: normalizeUsageTimeRange(overrides.sessionsUsageTimeRange || this.sessionsUsageTimeRange),
                promptsSubTab: normalizePromptsSubTab(overrides.promptsSubTab || this.promptsSubTab),
                projectClaudeMdPath: typeof overrides.projectClaudeMdPath === 'string'
                    ? overrides.projectClaudeMdPath
                    : (typeof this.projectClaudeMdPath === 'string' ? this.projectClaudeMdPath : ''),
                navigation: normalizeNavigationSnapshot(this, navigationOverride || {})
            };
        },

        applyWebUiPreferences(preferences = {}, options = {}) {
            const source = preferences && typeof preferences === 'object' ? preferences : {};
            const shouldApplyNavigation = !(options && options.applyNavigation === false);
            this.__webUiPreferencesApplying = true;
            try {
                if (typeof source.shareCommandPrefix === 'string' && typeof this.normalizeShareCommandPrefix === 'function') {
                    this.shareCommandPrefix = this.normalizeShareCommandPrefix(source.shareCommandPrefix);
                    setLocalStorageValue('codexmateShareCommandPrefix', this.shareCommandPrefix);
                }
                if (Object.prototype.hasOwnProperty.call(source, 'sessionTrashEnabled') && typeof this.normalizeSessionTrashEnabled === 'function') {
                    this.sessionTrashEnabled = this.normalizeSessionTrashEnabled(source.sessionTrashEnabled);
                    setLocalStorageValue('codexmateSessionTrashEnabled', this.sessionTrashEnabled ? 'true' : 'false');
                }
                if (Object.prototype.hasOwnProperty.call(source, 'sessionTrashRetentionDays') && typeof this.normalizeSessionTrashRetentionDays === 'function') {
                    this.sessionTrashRetentionDays = this.normalizeSessionTrashRetentionDays(source.sessionTrashRetentionDays);
                    setLocalStorageValue('codexmateSessionTrashRetentionDays', this.sessionTrashRetentionDays);
                }
                if (typeof source.sessionTimelineStyle === 'string' && typeof this.normalizeSessionTimelineStyle === 'function') {
                    this.sessionTimelineStyle = this.normalizeSessionTimelineStyle(source.sessionTimelineStyle);
                    setLocalStorageValue('codexmateSessionTimelineStyle', this.sessionTimelineStyle);
                }
                if (Object.prototype.hasOwnProperty.call(source, 'configTemplateDiffConfirmEnabled') && typeof this.normalizeConfigTemplateDiffConfirmEnabled === 'function') {
                    this.configTemplateDiffConfirmEnabled = this.normalizeConfigTemplateDiffConfirmEnabled(source.configTemplateDiffConfirmEnabled);
                    setLocalStorageValue('codexmateConfigTemplateDiffConfirmEnabled', this.configTemplateDiffConfirmEnabled ? 'true' : 'false');
                }
                if (typeof source.sessionsUsageTimeRange === 'string') {
                    this.sessionsUsageTimeRange = normalizeUsageTimeRange(source.sessionsUsageTimeRange);
                    setLocalStorageValue('sessionsUsageTimeRange', this.sessionsUsageTimeRange);
                }
                if (typeof source.promptsSubTab === 'string') {
                    this.promptsSubTab = normalizePromptsSubTab(source.promptsSubTab);
                    setLocalStorageValue('codexmate_prompts_sub_tab', this.promptsSubTab);
                }
                if (typeof source.projectClaudeMdPath === 'string') {
                    this.projectClaudeMdPath = source.projectClaudeMdPath;
                    setLocalStorageValue('codexmate_project_claude_md_path', this.projectClaudeMdPath);
                }
                if (shouldApplyNavigation && source.navigation && typeof source.navigation === 'object') {
                    const nav = source.navigation;
                    if (typeof nav.settingsTab === 'string' && typeof this.normalizeSettingsTab === 'function') {
                        this.settingsTab = this.normalizeSettingsTab(nav.settingsTab);
                    }
                    if (typeof nav.configMode === 'string') this.configMode = nav.configMode;
                    if (typeof nav.mainTab === 'string') {
                        if (typeof this.switchMainTab === 'function') {
                            this.switchMainTab(nav.mainTab);
                        } else {
                            this.mainTab = nav.mainTab;
                        }
                    }
                    if (nav.skillsTargetApp === 'codex' || nav.skillsTargetApp === 'claude') this.skillsTargetApp = nav.skillsTargetApp;
                    if (nav.promptTemplatesMode === 'compose' || nav.promptTemplatesMode === 'manage') this.promptTemplatesMode = nav.promptTemplatesMode;
                    if (typeof this.saveNavState === 'function') this.saveNavState();
                }
            } finally {
                this.__webUiPreferencesApplying = false;
            }
        },

        async loadWebUiPreferences(options = {}) {
            try {
                const res = await api('get-web-ui-preferences');
                if (res && res.preferences && typeof res.preferences === 'object') {
                    this.applyWebUiPreferences(res.preferences, options && typeof options === 'object' ? options : {});
                }
            } catch (_) {}
        },

        persistWebUiPreferences(overrides = {}) {
            if (this.__webUiPreferencesApplying) return;
            const snapshot = this.buildWebUiPreferencesSnapshot(overrides && typeof overrides === 'object' ? overrides : {});
            if (this.__webUiPreferencesPersistTimer) {
                clearTimeout(this.__webUiPreferencesPersistTimer);
            }
            this.__webUiPreferencesPersistTimer = setTimeout(() => {
                this.__webUiPreferencesPersistTimer = 0;
                api('set-web-ui-preferences', { preferences: snapshot }).catch(() => {});
            }, 120);
        }
    };
}
