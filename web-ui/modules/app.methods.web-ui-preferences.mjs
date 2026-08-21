const LEGACY_WEB_UI_PREFERENCE_KEYS = Object.freeze([
    'codexmateShareCommandPrefix',
    'codexmateSessionTrashEnabled',
    'codexmateSessionTrashRetentionDays',
    'codexmateSessionTimelineStyle',
    'codexmateConfigTemplateDiffConfirmEnabled',
    'sessionsUsageTimeRange',
    'codexmate_prompts_sub_tab',
    'codexmate_project_claude_md_path',
    'codexmateNavState.v1',
    'codexmateSessionLoadNativeDialog',
    'codexmateSessionFilterSource',
    'codexmateSessionPathFilter',
    'codexmateSessionQuery',
    'codexmateSessionRoleFilter',
    'codexmateSessionTimePreset',
    'codexmateSessionSortMode',
    'codexmateSessionPinnedMap',
    'claudeConfigs',
    'currentClaudeConfig',
    'openclawConfigs',
    'toolConfigPermissions',
    'deletedClaudeSettingsImports',
    'codexmateLang',
    'codexmateSidebarCollapsed',
    'codexmateStarPrompted'
]);

function hasOwn(source, key) {
    return !!source && Object.prototype.hasOwnProperty.call(source, key);
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonValue(raw, fallback) {
    if (typeof raw !== 'string' || !raw.trim()) return fallback;
    try {
        const parsed = JSON.parse(raw);
        return parsed === undefined ? fallback : parsed;
    } catch (_) {
        return fallback;
    }
}

function normalizeBoolean(value, defaultValue = true) {
    if (value === true) return true;
    if (value === false) return false;
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') return true;
    if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') return false;
    return defaultValue !== false;
}

function normalizeUsageTimeRange(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'all' || normalized === '30d') return normalized;
    return '7d';
}

function normalizePromptsSubTab(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'claude-project') return normalized;
    if (normalized === 'system') return normalized;
    return 'codex';
}

function normalizeSysPromptScope(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'project') return normalized;
    return 'global';
}

function normalizeSysPromptMode(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return normalized === 'append' ? 'append' : 'system';
}

function normalizePromptPresets(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
        .filter(item => item && typeof item === 'object')
        .map((item, index) => {
            const id = typeof item.id === 'string' && item.id.trim()
                ? item.id.trim()
                : `preset-${Date.now()}-${index}`;
            const name = typeof item.name === 'string' ? item.name.trim() : '';
            const content = typeof item.content === 'string' ? item.content : '';
            const updatedAt = typeof item.updatedAt === 'string' && item.updatedAt.trim()
                ? item.updatedAt.trim()
                : new Date(0).toISOString();
            return { id, name, content, updatedAt };
        })
        .filter(item => item.id && item.name && !seen.has(item.id) && (seen.add(item.id), true));
}

function normalizeSessionSortMode(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return normalized === 'hot' ? 'hot' : 'time';
}

function normalizeNavigationSnapshot(vm, source = {}) {
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
}

function normalizeSessionFiltersSnapshot(vm, source = {}) {
    const incoming = isPlainObject(source) ? source : {};
    const normalizeRole = typeof vm.normalizeSessionRoleFilter === 'function'
        ? vm.normalizeSessionRoleFilter.bind(vm)
        : ((value) => {
            const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
            return ['user', 'assistant', 'system', 'tool'].includes(normalized) ? normalized : 'all';
        });
    const normalizeTime = typeof vm.normalizeSessionTimePreset === 'function'
        ? vm.normalizeSessionTimePreset.bind(vm)
        : ((value) => {
            const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
            return ['24h', '7d', '30d'].includes(normalized) ? normalized : 'all';
        });
    return {
        source: typeof incoming.source === 'string' ? incoming.source : vm.sessionFilterSource,
        pathFilter: typeof incoming.pathFilter === 'string' ? incoming.pathFilter : (vm.sessionPathFilter || ''),
        query: typeof incoming.query === 'string' ? incoming.query : (vm.sessionQuery || ''),
        roleFilter: normalizeRole(hasOwn(incoming, 'roleFilter') ? incoming.roleFilter : vm.sessionRoleFilter),
        timePreset: normalizeTime(hasOwn(incoming, 'timePreset') ? incoming.timePreset : vm.sessionTimePreset),
        sortMode: typeof vm.normalizeSessionSortMode === 'function'
            ? vm.normalizeSessionSortMode(hasOwn(incoming, 'sortMode') ? incoming.sortMode : vm.sessionSortMode)
            : normalizeSessionSortMode(hasOwn(incoming, 'sortMode') ? incoming.sortMode : vm.sessionSortMode)
    };
}

function normalizePinnedMap(vm, value) {
    if (typeof vm.normalizeSessionPinnedMap === 'function') {
        return vm.normalizeSessionPinnedMap(value);
    }
    const source = isPlainObject(value) ? value : {};
    const next = {};
    for (const [key, item] of Object.entries(source)) {
        if (!key) continue;
        const numeric = Number(item);
        if (!Number.isFinite(numeric) || numeric <= 0) continue;
        next[key] = Math.floor(numeric);
    }
    return next;
}

function readStorageValue(storage, key) {
    if (!storage || typeof storage.getItem !== 'function') return null;
    try {
        return storage.getItem(key);
    } catch (_) {
        return null;
    }
}

function collectLegacyLocalStoragePreferences(storage) {
    const read = (key) => readStorageValue(storage, key);
    const has = (key) => read(key) !== null;
    const preferences = {};
    let found = false;

    const assignString = (targetKey, storageKey) => {
        const value = read(storageKey);
        if (typeof value === 'string') {
            preferences[targetKey] = value;
            found = true;
        }
    };

    assignString('shareCommandPrefix', 'codexmateShareCommandPrefix');
    assignString('sessionTrashRetentionDays', 'codexmateSessionTrashRetentionDays');
    assignString('sessionTimelineStyle', 'codexmateSessionTimelineStyle');
    assignString('sessionsUsageTimeRange', 'sessionsUsageTimeRange');
    assignString('promptsSubTab', 'codexmate_prompts_sub_tab');
    assignString('projectClaudeMdPath', 'codexmate_project_claude_md_path');
    assignString('language', 'codexmateLang');
    assignString('currentClaudeConfig', 'currentClaudeConfig');

    if (has('codexmateSessionTrashEnabled')) {
        preferences.sessionTrashEnabled = normalizeBoolean(read('codexmateSessionTrashEnabled'), true);
        found = true;
    }
    if (has('codexmateConfigTemplateDiffConfirmEnabled')) {
        preferences.configTemplateDiffConfirmEnabled = normalizeBoolean(read('codexmateConfigTemplateDiffConfirmEnabled'), true);
        found = true;
    }
    if (has('codexmateSessionLoadNativeDialog')) {
        preferences.sessionLoadNativeDialog = normalizeBoolean(read('codexmateSessionLoadNativeDialog'), false);
        found = true;
    }
    if (has('codexmateSidebarCollapsed')) {
        preferences.sidebarCollapsed = normalizeBoolean(read('codexmateSidebarCollapsed'), false);
        found = true;
    }
    if (has('codexmateStarPrompted')) {
        preferences.starPrompted = normalizeBoolean(read('codexmateStarPrompted'), false);
        found = true;
    }
    if (has('codexmateNavState.v1')) {
        const nav = parseJsonValue(read('codexmateNavState.v1'), null);
        if (isPlainObject(nav)) {
            preferences.navigation = nav;
            found = true;
        }
    }
    const sessionFilters = {};
    const filterMap = {
        source: 'codexmateSessionFilterSource',
        pathFilter: 'codexmateSessionPathFilter',
        query: 'codexmateSessionQuery',
        roleFilter: 'codexmateSessionRoleFilter',
        timePreset: 'codexmateSessionTimePreset',
        sortMode: 'codexmateSessionSortMode'
    };
    for (const [targetKey, storageKey] of Object.entries(filterMap)) {
        const value = read(storageKey);
        if (typeof value === 'string') {
            sessionFilters[targetKey] = value;
            found = true;
        }
    }
    if (Object.keys(sessionFilters).length > 0) preferences.sessionFilters = sessionFilters;

    const pinnedMap = parseJsonValue(read('codexmateSessionPinnedMap'), null);
    if (isPlainObject(pinnedMap)) {
        preferences.sessionPinnedMap = pinnedMap;
        found = true;
    }
    const claudeConfigs = parseJsonValue(read('claudeConfigs'), null);
    if (isPlainObject(claudeConfigs)) {
        preferences.claudeConfigs = claudeConfigs;
        found = true;
    }
    const openclawConfigs = parseJsonValue(read('openclawConfigs'), null);
    if (isPlainObject(openclawConfigs)) {
        preferences.openclawConfigs = openclawConfigs;
        found = true;
    }
    const toolConfigPermissions = parseJsonValue(read('toolConfigPermissions'), null);
    if (isPlainObject(toolConfigPermissions)) {
        preferences.toolConfigPermissions = toolConfigPermissions;
        found = true;
    }
    const deletedClaudeSettingsImports = parseJsonValue(read('deletedClaudeSettingsImports'), null);
    if (Array.isArray(deletedClaudeSettingsImports)) {
        preferences.deletedClaudeSettingsImports = deletedClaudeSettingsImports;
        found = true;
    }

    return { preferences, found };
}

function clearLegacyLocalStoragePreferences(storage) {
    if (!storage || typeof storage.removeItem !== 'function') return;
    for (const key of LEGACY_WEB_UI_PREFERENCE_KEYS) {
        try { storage.removeItem(key); } catch (_) {}
    }
}

function mergePreferenceOverrides(current = {}, incoming = {}) {
    const base = isPlainObject(current) ? current : {};
    const next = isPlainObject(incoming) ? incoming : {};
    return {
        ...base,
        ...next,
        ...(isPlainObject(base.navigation) || isPlainObject(next.navigation) ? {
            navigation: {
                ...(isPlainObject(base.navigation) ? base.navigation : {}),
                ...(isPlainObject(next.navigation) ? next.navigation : {})
            }
        } : {}),
        ...(isPlainObject(base.sessionFilters) || isPlainObject(next.sessionFilters) ? {
            sessionFilters: {
                ...(isPlainObject(base.sessionFilters) ? base.sessionFilters : {}),
                ...(isPlainObject(next.sessionFilters) ? next.sessionFilters : {})
            }
        } : {}),
        ...(isPlainObject(base.toolConfigPermissions) || isPlainObject(next.toolConfigPermissions) ? {
            toolConfigPermissions: {
                ...(isPlainObject(base.toolConfigPermissions) ? base.toolConfigPermissions : {}),
                ...(isPlainObject(next.toolConfigPermissions) ? next.toolConfigPermissions : {})
            }
        } : {})
    };
}

export function createWebUiPreferencesMethods(options = {}) {
    const api = typeof options.api === 'function' ? options.api : async () => ({});
    const storageOverride = options.storage && typeof options.storage === 'object' ? options.storage : null;

    const getLocalStorage = () => {
        const storage = storageOverride || (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
        return storage && typeof storage.getItem === 'function' && typeof storage.removeItem === 'function'
            ? storage
            : null;
    };

    return {
        collectLegacyWebUiPreferencesForMigration() {
            return collectLegacyLocalStoragePreferences(getLocalStorage());
        },

        clearLegacyWebUiPreferencesAfterMigration() {
            clearLegacyLocalStoragePreferences(getLocalStorage());
        },

        buildWebUiPreferencesSnapshot(overrides = {}) {
            const source = overrides && typeof overrides === 'object' ? overrides : {};
            const navigationOverride = isPlainObject(source.navigation) ? source.navigation : null;
            const sessionFiltersOverride = isPlainObject(source.sessionFilters) ? source.sessionFilters : null;
            return {
                shareCommandPrefix: typeof this.normalizeShareCommandPrefix === 'function'
                    ? this.normalizeShareCommandPrefix(hasOwn(source, 'shareCommandPrefix') ? source.shareCommandPrefix : this.shareCommandPrefix)
                    : (this.shareCommandPrefix || 'npm start'),
                sessionTrashEnabled: typeof this.normalizeSessionTrashEnabled === 'function'
                    ? this.normalizeSessionTrashEnabled(hasOwn(source, 'sessionTrashEnabled') ? source.sessionTrashEnabled : this.sessionTrashEnabled)
                    : this.sessionTrashEnabled !== false,
                sessionTrashRetentionDays: typeof this.normalizeSessionTrashRetentionDays === 'function'
                    ? this.normalizeSessionTrashRetentionDays(hasOwn(source, 'sessionTrashRetentionDays') ? source.sessionTrashRetentionDays : this.sessionTrashRetentionDays)
                    : 30,
                sessionTimelineStyle: typeof this.normalizeSessionTimelineStyle === 'function'
                    ? this.normalizeSessionTimelineStyle(hasOwn(source, 'sessionTimelineStyle') ? source.sessionTimelineStyle : this.sessionTimelineStyle)
                    : (this.sessionTimelineStyle === 'bar' ? 'bar' : 'dots'),
                configTemplateDiffConfirmEnabled: typeof this.normalizeConfigTemplateDiffConfirmEnabled === 'function'
                    ? this.normalizeConfigTemplateDiffConfirmEnabled(hasOwn(source, 'configTemplateDiffConfirmEnabled') ? source.configTemplateDiffConfirmEnabled : this.configTemplateDiffConfirmEnabled)
                    : this.configTemplateDiffConfirmEnabled !== false,
                sessionsUsageTimeRange: normalizeUsageTimeRange(hasOwn(source, 'sessionsUsageTimeRange') ? source.sessionsUsageTimeRange : this.sessionsUsageTimeRange),
                promptsSubTab: normalizePromptsSubTab(hasOwn(source, 'promptsSubTab') ? source.promptsSubTab : this.promptsSubTab),
                sysPromptScope: normalizeSysPromptScope(hasOwn(source, 'sysPromptScope') ? source.sysPromptScope : this.sysPromptScope),
                sysPromptMode: normalizeSysPromptMode(hasOwn(source, 'sysPromptMode') ? source.sysPromptMode : this.sysPromptMode),
                promptPresets: normalizePromptPresets(hasOwn(source, 'promptPresets') ? source.promptPresets : this.promptPresets),
                projectClaudeMdPath: typeof source.projectClaudeMdPath === 'string'
                    ? source.projectClaudeMdPath
                    : (typeof this.projectClaudeMdPath === 'string' ? this.projectClaudeMdPath : ''),
                sidebarCollapsed: normalizeBoolean(hasOwn(source, 'sidebarCollapsed') ? source.sidebarCollapsed : this.sidebarCollapsed, false),
                configModeVisibility: typeof this.normalizeConfigModeVisibility === 'function'
                    ? this.normalizeConfigModeVisibility(hasOwn(source, 'configModeVisibility') ? source.configModeVisibility : this.configModeVisibility)
                    : { codex: true, claude: true, openclaw: true, opencode: true, kilocode: true },
                starPrompted: normalizeBoolean(hasOwn(source, 'starPrompted') ? source.starPrompted : this.starPrompted, false),
                sessionLoadNativeDialog: normalizeBoolean(hasOwn(source, 'sessionLoadNativeDialog') ? source.sessionLoadNativeDialog : this.sessionLoadNativeDialog, false),
                language: typeof source.language === 'string'
                    ? source.language
                    : (typeof this.lang === 'string' ? this.lang : ''),
                sessionFilters: normalizeSessionFiltersSnapshot(this, sessionFiltersOverride || {}),
                sessionPinnedMap: normalizePinnedMap(this, hasOwn(source, 'sessionPinnedMap') ? source.sessionPinnedMap : this.sessionPinnedMap),
                claudeConfigs: isPlainObject(source.claudeConfigs) ? source.claudeConfigs : (isPlainObject(this.claudeConfigs) ? this.claudeConfigs : {}),
                currentClaudeConfig: typeof source.currentClaudeConfig === 'string'
                    ? source.currentClaudeConfig
                    : (typeof this.currentClaudeConfig === 'string' ? this.currentClaudeConfig : ''),
                openclawConfigs: isPlainObject(source.openclawConfigs) ? source.openclawConfigs : (isPlainObject(this.openclawConfigs) ? this.openclawConfigs : {}),
                toolConfigPermissions: isPlainObject(source.toolConfigPermissions) ? source.toolConfigPermissions : (isPlainObject(this.toolConfigPermissions) ? this.toolConfigPermissions : {}),
                deletedClaudeSettingsImports: Array.isArray(source.deletedClaudeSettingsImports)
                    ? source.deletedClaudeSettingsImports
                    : (Array.isArray(this.deletedClaudeSettingsImports) ? this.deletedClaudeSettingsImports : []),
                navigation: normalizeNavigationSnapshot(this, navigationOverride || {})
            };
        },

        applyWebUiPreferences(preferences = {}, options = {}) {
            const source = preferences && typeof preferences === 'object' ? preferences : {};
            const shouldApplyNavigation = !(options && options.applyNavigation === false);
            let shouldPersistNormalizedClaudeConfigs = false;
            this.__webUiPreferencesApplying = true;
            try {
                if (typeof source.shareCommandPrefix === 'string' && typeof this.normalizeShareCommandPrefix === 'function') {
                    this.shareCommandPrefix = this.normalizeShareCommandPrefix(source.shareCommandPrefix);
                }
                if (hasOwn(source, 'sessionTrashEnabled') && typeof this.normalizeSessionTrashEnabled === 'function') {
                    this.sessionTrashEnabled = this.normalizeSessionTrashEnabled(source.sessionTrashEnabled);
                }
                if (hasOwn(source, 'sessionTrashRetentionDays') && typeof this.normalizeSessionTrashRetentionDays === 'function') {
                    this.sessionTrashRetentionDays = this.normalizeSessionTrashRetentionDays(source.sessionTrashRetentionDays);
                }
                if (typeof source.sessionTimelineStyle === 'string' && typeof this.normalizeSessionTimelineStyle === 'function') {
                    this.sessionTimelineStyle = this.normalizeSessionTimelineStyle(source.sessionTimelineStyle);
                }
                if (hasOwn(source, 'configTemplateDiffConfirmEnabled') && typeof this.normalizeConfigTemplateDiffConfirmEnabled === 'function') {
                    this.configTemplateDiffConfirmEnabled = this.normalizeConfigTemplateDiffConfirmEnabled(source.configTemplateDiffConfirmEnabled);
                }
                if (typeof source.sessionsUsageTimeRange === 'string') {
                    this.sessionsUsageTimeRange = normalizeUsageTimeRange(source.sessionsUsageTimeRange);
                }
                if (typeof source.promptsSubTab === 'string') {
                    this.promptsSubTab = normalizePromptsSubTab(source.promptsSubTab);
                }
                if (typeof source.sysPromptScope === 'string') {
                    this.sysPromptScope = normalizeSysPromptScope(source.sysPromptScope);
                }
                if (typeof source.sysPromptMode === 'string') {
                    this.sysPromptMode = normalizeSysPromptMode(source.sysPromptMode);
                }
                if (Array.isArray(source.promptPresets)) {
                    this.promptPresets = normalizePromptPresets(source.promptPresets);
                    if (this.selectedPromptPresetId && !this.promptPresets.some(preset => preset.id === this.selectedPromptPresetId)) {
                        this.selectedPromptPresetId = '';
                    }
                }
                if (typeof source.projectClaudeMdPath === 'string') {
                    this.projectClaudeMdPath = source.projectClaudeMdPath;
                }
                if (hasOwn(source, 'sidebarCollapsed')) {
                    this.sidebarCollapsed = normalizeBoolean(source.sidebarCollapsed, false);
                }
                if (hasOwn(source, 'configModeVisibility') && typeof this.normalizeConfigModeVisibility === 'function') {
                    this.configModeVisibility = this.normalizeConfigModeVisibility(source.configModeVisibility);
                }
                if (hasOwn(source, 'starPrompted')) {
                    this.starPrompted = normalizeBoolean(source.starPrompted, false);
                }
                if (hasOwn(source, 'sessionLoadNativeDialog')) {
                    this.sessionLoadNativeDialog = normalizeBoolean(source.sessionLoadNativeDialog, false);
                }
                if (typeof source.language === 'string' && source.language && typeof this.setLang === 'function') {
                    this.setLang(source.language, { persist: false });
                }
                if (isPlainObject(source.sessionFilters)) {
                    const filters = normalizeSessionFiltersSnapshot(this, source.sessionFilters);
                    this.sessionFilterSource = filters.source;
                    this.sessionPathFilter = filters.pathFilter;
                    this.sessionQuery = filters.query;
                    this.sessionRoleFilter = filters.roleFilter;
                    this.sessionTimePreset = filters.timePreset;
                    this.sessionSortMode = filters.sortMode;
                }
                if (isPlainObject(source.sessionPinnedMap)) {
                    this.sessionPinnedMap = normalizePinnedMap(this, source.sessionPinnedMap);
                }
                if (isPlainObject(source.claudeConfigs)) {
                    this.claudeConfigs = source.claudeConfigs;
                }
                if (typeof source.currentClaudeConfig === 'string') {
                    this.currentClaudeConfig = source.currentClaudeConfig;
                }
                if (isPlainObject(source.claudeConfigs) && typeof this.normalizeStoredClaudeConfigs === 'function') {
                    shouldPersistNormalizedClaudeConfigs = this.normalizeStoredClaudeConfigs() === true;
                }
                if (isPlainObject(source.openclawConfigs)) {
                    this.openclawConfigs = source.openclawConfigs;
                }
                if (isPlainObject(source.toolConfigPermissions)) {
                    this.toolConfigPermissions = {
                        codex: source.toolConfigPermissions.codex === true,
                        claude: source.toolConfigPermissions.claude === true,
                        opencode: source.toolConfigPermissions.opencode === true,
                        kilocode: source.toolConfigPermissions.kilocode === true,
                        openclaw: source.toolConfigPermissions.openclaw === true,
                        pi: source.toolConfigPermissions.pi === true
                    };
                }
                if (Array.isArray(source.deletedClaudeSettingsImports)) {
                    this.deletedClaudeSettingsImports = source.deletedClaudeSettingsImports;
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
            if (shouldPersistNormalizedClaudeConfigs && typeof this.persistWebUiPreferences === 'function') {
                this.persistWebUiPreferences({
                    claudeConfigs: this.claudeConfigs,
                    currentClaudeConfig: this.currentClaudeConfig || ''
                });
            }
        },

        async loadWebUiPreferences(options = {}) {
            const loadOptions = options && typeof options === 'object' ? options : {};
            const legacy = this.collectLegacyWebUiPreferencesForMigration();
            try {
                const res = await api('get-web-ui-preferences');
                const current = res && res.preferences && typeof res.preferences === 'object' ? res.preferences : {};
                const merged = legacy && legacy.found
                    ? this.buildWebUiPreferencesSnapshot({
                        ...current,
                        ...legacy.preferences,
                        navigation: {
                            ...(isPlainObject(current.navigation) ? current.navigation : {}),
                            ...(isPlainObject(legacy.preferences.navigation) ? legacy.preferences.navigation : {})
                        },
                        sessionFilters: {
                            ...(isPlainObject(current.sessionFilters) ? current.sessionFilters : {}),
                            ...(isPlainObject(legacy.preferences.sessionFilters) ? legacy.preferences.sessionFilters : {})
                        }
                    })
                    : current;
                if (merged && typeof merged === 'object') {
                    this.applyWebUiPreferences(merged, loadOptions);
                }
                if (legacy && legacy.found) {
                    await api('set-web-ui-preferences', { preferences: this.buildWebUiPreferencesSnapshot(merged) });
                    this.clearLegacyWebUiPreferencesAfterMigration();
                }
            } catch (_) {
                if (legacy && legacy.found) {
                    this.applyWebUiPreferences(legacy.preferences, loadOptions);
                }
            }
        },

        flushWebUiPreferences() {
            if (this.__webUiPreferencesPersistTimer) {
                clearTimeout(this.__webUiPreferencesPersistTimer);
                this.__webUiPreferencesPersistTimer = 0;
            }
            const pending = this.__webUiPreferencesPendingOverrides;
            if (!pending || typeof pending !== 'object') return;
            this.__webUiPreferencesPendingOverrides = null;
            const snapshot = this.buildWebUiPreferencesSnapshot(pending);
            api('set-web-ui-preferences', { preferences: snapshot }).catch(() => {});
        },

        persistWebUiPreferences(overrides = {}) {
            if (this.__webUiPreferencesApplying) return;
            this.__webUiPreferencesPendingOverrides = mergePreferenceOverrides(
                this.__webUiPreferencesPendingOverrides,
                overrides && typeof overrides === 'object' ? overrides : {}
            );
            if (this.__webUiPreferencesPersistTimer) {
                clearTimeout(this.__webUiPreferencesPersistTimer);
            }
            this.__webUiPreferencesPersistTimer = setTimeout(() => {
                this.flushWebUiPreferences();
            }, 120);
        }
    };
}
