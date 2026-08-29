import assert from 'assert';
import { createWebUiPreferencesMethods } from '../../web-ui/modules/app.methods.web-ui-preferences.mjs';
import { createSessionActionMethods } from '../../web-ui/modules/app.methods.session-actions.mjs';
import { createSessionTrashMethods } from '../../web-ui/modules/app.methods.session-trash.mjs';
import { createNavigationMethods } from '../../web-ui/modules/app.methods.navigation.mjs';
import { readProjectFile } from './helpers/web-ui-source.mjs';

function createMemoryStorage() {
    const data = new Map();
    return {
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) { data.set(key, String(value)); },
        removeItem(key) { data.delete(key); },
        dump() { return Object.fromEntries(data.entries()); }
    };
}

function createContext(apiCalls = [], storage = null, backendPreferences = null) {
    const preferences = backendPreferences || {
        shareCommandPrefix: 'codexmate',
        sessionTrashEnabled: false,
        sessionTrashRetentionDays: 9,
        sessionTimelineStyle: 'bar',
        configTemplateDiffConfirmEnabled: false,
        sessionsUsageTimeRange: '30d',
        promptsSubTab: 'claude-project',
        projectClaudeMdPath: '/tmp/project',
        sidebarCollapsed: true,
        navigation: {
            mainTab: 'settings',
            configMode: 'claude',
            settingsTab: 'data',
            skillsTargetApp: 'claude',
            promptTemplatesMode: 'manage'
        }
    };
    const webPreferenceMethods = createWebUiPreferencesMethods({
        storage,
        api: async (action, params = {}) => {
            apiCalls.push({ action, params });
            if (action === 'get-web-ui-preferences') {
                return { preferences };
            }
            return { success: true };
        }
    });
    const sessionActionMethods = createSessionActionMethods({ api: async () => ({}), apiBase: 'http://127.0.0.1' });
    const sessionTrashMethods = createSessionTrashMethods({ api: async () => ({}), sessionTrashListLimit: 20, sessionTrashPageSize: 20 });
    const navigationMethods = createNavigationMethods({
        configModeSet: new Set(['codex', 'claude', 'openclaw', 'opencode']),
        switchMainTabHelper: () => {},
        loadMoreSessionMessagesHelper: () => {}
    });
    return {
        switchMainTabCalls: [],
        shareCommandPrefix: 'npm start',
        sessionTrashEnabled: true,
        sessionTrashRetentionDays: 30,
        sessionTimelineStyle: 'dots',
        configTemplateDiffConfirmEnabled: true,
        sessionsUsageTimeRange: '7d',
        promptsSubTab: 'codex',
        projectClaudeMdPath: '',
        sidebarCollapsed: false,
        starPrompted: false,
        taskOrchestrationTabEnabled: true,
        sessionLoadNativeDialog: false,
        lang: 'zh',
        sessionFilterSource: 'all',
        sessionPathFilter: '',
        sessionQuery: '',
        sessionRoleFilter: 'all',
        sessionTimePreset: 'all',
        sessionSortMode: 'time',
        sessionPinnedMap: {},
        claudeConfigs: {},
        currentClaudeConfig: '',
        openclawConfigs: {},
        toolConfigPermissions: { codex: false, claude: false, opencode: false, kilocode: false },
        deletedClaudeSettingsImports: [],
        mainTab: 'dashboard',
        configMode: 'codex',
        settingsTab: 'general',
        skillsTargetApp: 'codex',
        promptTemplatesMode: 'compose',
        normalizeStoredClaudeConfigs() {
            let changed = false;
            for (const config of Object.values(this.claudeConfigs || {})) {
                if (!config || typeof config !== 'object') continue;
                if (typeof config.apiKey === 'string' && config.apiKey.includes('****')) {
                    config.apiKey = '';
                    config.hasKey = false;
                    changed = true;
                }
                if (config.targetApi === 'chat-completions') {
                    config.targetApi = 'chat_completions';
                    changed = true;
                }
            }
            return changed;
        },
        setLang(lang) {
            this.lang = lang;
        },
        ...sessionActionMethods,
        ...sessionTrashMethods,
        ...navigationMethods,
        switchMainTab(tab) {
            this.switchMainTabCalls.push(tab);
            this.mainTab = tab;
        },
        ...webPreferenceMethods
    };
}

async function waitForApiCall(apiCalls, action, timeoutMs = 1000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const call = apiCalls.find((item) => item.action === action);
        if (call) return call;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return apiCalls.find((item) => item.action === action) || null;
}

test('web UI preferences load from local backend without writing localStorage fallback', async () => {
    const storage = createMemoryStorage();
    const apiCalls = [];
    const context = createContext(apiCalls, storage);
    await context.loadWebUiPreferences();

    assert.strictEqual(context.shareCommandPrefix, 'codexmate');
    assert.strictEqual(context.sessionTrashEnabled, false);
    assert.strictEqual(context.sessionTrashRetentionDays, 9);
    assert.strictEqual(context.sessionTimelineStyle, 'bar');
    assert.strictEqual(context.configTemplateDiffConfirmEnabled, false);
    assert.strictEqual(context.sessionsUsageTimeRange, '30d');
    assert.strictEqual(context.promptsSubTab, 'claude-project');
    assert.strictEqual(context.projectClaudeMdPath, '/tmp/project');
    assert.strictEqual(context.sidebarCollapsed, true);
    assert.strictEqual(context.mainTab, 'settings');
    assert.deepStrictEqual(context.switchMainTabCalls, ['settings']);
    assert.strictEqual(context.settingsTab, 'data');
    assert.deepStrictEqual(storage.dump(), {});
    assert.deepStrictEqual(apiCalls.map((call) => call.action), ['get-web-ui-preferences']);
});

test('web UI preferences migrate legacy localStorage once and clear migrated keys', async () => {
    const storage = createMemoryStorage();
    storage.setItem('codexmateShareCommandPrefix', 'codexmate');
    storage.setItem('codexmateSidebarCollapsed', 'true');
    storage.setItem('codexmateNavState.v1', JSON.stringify({ mainTab: 'usage', configMode: 'codex', settingsTab: 'general' }));
    storage.setItem('codexmateSessionPinnedMap', JSON.stringify({ 'codex:abc': 123 }));
    storage.setItem('claudeConfigs', JSON.stringify({ migrated: { apiKey: 'sk-****', hasKey: true, targetApi: 'chat-completions' } }));
    storage.setItem('currentClaudeConfig', 'migrated');
    const apiCalls = [];
    const context = createContext(apiCalls, storage, {
        shareCommandPrefix: 'npm start',
        sidebarCollapsed: false,
        navigation: { mainTab: 'dashboard', configMode: 'codex', settingsTab: 'general' }
    });

    await context.loadWebUiPreferences();

    const writeCall = apiCalls.find((call) => call.action === 'set-web-ui-preferences');
    assert.ok(writeCall, 'legacy preferences must be migrated into the backend preference file');
    assert.strictEqual(writeCall.params.preferences.shareCommandPrefix, 'codexmate');
    assert.strictEqual(writeCall.params.preferences.sidebarCollapsed, true);
    assert.strictEqual(writeCall.params.preferences.navigation.mainTab, 'usage');
    assert.deepStrictEqual(writeCall.params.preferences.sessionPinnedMap, { 'codex:abc': 123 });
    assert.deepStrictEqual(writeCall.params.preferences.claudeConfigs, {
        migrated: { apiKey: '', hasKey: false, targetApi: 'chat_completions' }
    });
    assert.strictEqual(writeCall.params.preferences.currentClaudeConfig, 'migrated');
    assert.strictEqual(context.mainTab, 'usage');
    assert.deepStrictEqual(storage.dump(), {});
});

test('web UI setters persist preferences to local backend', async () => {
    const apiCalls = [];
    const context = createContext(apiCalls, createMemoryStorage());
    context.setShareCommandPrefix('codexmate');

    const writeCall = await waitForApiCall(apiCalls, 'set-web-ui-preferences');
    assert.ok(writeCall, 'setter must persist web UI preferences');
    assert.strictEqual(writeCall.params.preferences.shareCommandPrefix, 'codexmate');
    assert.strictEqual(writeCall.params.preferences.sessionTrashRetentionDays, 30);
    assert.strictEqual(writeCall.params.preferences.navigation.settingsTab, 'general');
});

test('web UI preference snapshots preserve unrelated navigation sub-state', async () => {
    const apiCalls = [];
    const context = createContext(apiCalls, createMemoryStorage());
    context.skillsTargetApp = 'claude';
    context.promptTemplatesMode = 'manage';
    context.setShareCommandPrefix('codexmate');

    const writeCall = await waitForApiCall(apiCalls, 'set-web-ui-preferences');
    assert.ok(writeCall, 'setter must persist web UI preferences');
    assert.strictEqual(writeCall.params.preferences.navigation.skillsTargetApp, 'claude');
    assert.strictEqual(writeCall.params.preferences.navigation.promptTemplatesMode, 'manage');
});

test('web UI preferences load applies the pi skills target from navigation', async () => {
    const apiCalls = [];
    const context = createContext(apiCalls, createMemoryStorage());
    context.skillsTargetApp = '';
    apiCalls.length = 0;
    const navigationMethods = createNavigationMethods({
        configModeSet: new Set(['codex', 'claude', 'openclaw', 'opencode']),
        switchMainTabHelper: () => {},
        loadMoreSessionMessagesHelper: () => {}
    });
    Object.assign(context, navigationMethods, {
        async showMessage() {}
    });
    context.loadWebUiPreferences = createWebUiPreferencesMethods({
        storage: createMemoryStorage(),
        api: async (action) => {
            if (action !== 'get-web-ui-preferences') return { success: true };
            return {
                preferences: {
                    navigation: { skillsTargetApp: 'pi' }
                }
            };
        }
    }).loadWebUiPreferences;
    await context.loadWebUiPreferences();

    assert.strictEqual(context.skillsTargetApp, 'pi');
});

test('web UI preference debounce preserves nested pending overrides', async () => {
    const apiCalls = [];
    const context = createContext(apiCalls, createMemoryStorage());

    context.persistWebUiPreferences({ navigation: { mainTab: 'settings' } });
    context.persistWebUiPreferences({ sessionFilters: { query: 'needle' } });
    context.flushWebUiPreferences();

    const writeCall = apiCalls.find((call) => call.action === 'set-web-ui-preferences');
    assert.ok(writeCall, 'flush must persist pending preferences');
    assert.strictEqual(writeCall.params.preferences.navigation.mainTab, 'settings');
    assert.strictEqual(writeCall.params.preferences.sessionFilters.query, 'needle');
});


test('web UI preferences preserve KiloCode write permission on reload', () => {
    const context = createContext([], createMemoryStorage());
    context.applyWebUiPreferences({
        toolConfigPermissions: { codex: false, claude: false, opencode: false, kilocode: true, openclaw: false, pi: false }
    }, { applyNavigation: false });

    assert.deepStrictEqual(context.toolConfigPermissions, {
        codex: false,
        claude: false,
        opencode: false,
        kilocode: true,
        openclaw: false,
        pi: false
    });
});

test('web UI preference navigation restore can be disabled for explicit routes', () => {
    const apiCalls = [];
    const context = createContext(apiCalls, createMemoryStorage());

    context.applyWebUiPreferences({
        navigation: {
            mainTab: 'settings',
            configMode: 'claude',
            settingsTab: 'data'
        }
    }, { applyNavigation: false });

    assert.strictEqual(context.mainTab, 'dashboard');
    assert.strictEqual(context.configMode, 'codex');
    assert.strictEqual(context.settingsTab, 'general');
    assert.deepStrictEqual(context.switchMainTabCalls, []);
});

test('web UI preferences backend actions and startup hook are wired', () => {
    const cli = readProjectFile('cli.js');
    const app = readProjectFile('web-ui/app.js');
    const index = readProjectFile('web-ui/modules/app.methods.index.mjs');

    assert.match(cli, /CODEXMATE_PREFERENCES_FILE/);
    assert.match(cli, /function normalizeWebUiPreferences/);
    assert.match(cli, /case 'get-web-ui-preferences'/);
    assert.match(cli, /case 'set-web-ui-preferences'/);
    assert.match(app, /loadWebUiPreferences\(\{ applyNavigation: applyPreferenceNavigation \}\)/);
    assert.match(app, /url\.pathname === '\/session'/);
    assert.match(app, /url\.searchParams\.get\('tab'\)/);
    assert.match(index, /createWebUiPreferencesMethods/);
    assert.match(readProjectFile('web-ui/modules/app.methods.startup-claude.mjs'), /kilocode: statusRes\.toolConfigPermissions\.kilocode === true/);
    assert.match(readProjectFile('web-ui/modules/app.methods.web-ui-preferences.mjs'), /kilocode: source\.toolConfigPermissions\.kilocode === true/);
});
