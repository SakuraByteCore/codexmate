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

function createContext(apiCalls = [], storage = null) {
    const webPreferenceMethods = createWebUiPreferencesMethods({
        storage,
        api: async (action, params = {}) => {
            apiCalls.push({ action, params });
            if (action === 'get-web-ui-preferences') {
                return {
                    preferences: {
                        shareCommandPrefix: 'codexmate',
                        sessionTrashEnabled: false,
                        sessionTrashRetentionDays: 9,
                        sessionTimelineStyle: 'bar',
                        configTemplateDiffConfirmEnabled: false,
                        sessionsUsageTimeRange: '30d',
                        promptsSubTab: 'claude-project',
                        projectClaudeMdPath: '/tmp/project',
                        navigation: {
                            mainTab: 'settings',
                            configMode: 'claude',
                            settingsTab: 'data',
                            skillsTargetApp: 'claude',
                            promptTemplatesMode: 'manage'
                        }
                    }
                };
            }
            return { success: true };
        }
    });
    const sessionActionMethods = createSessionActionMethods({ api: async () => ({}), apiBase: 'http://127.0.0.1' });
    const sessionTrashMethods = createSessionTrashMethods({ api: async () => ({}), sessionTrashListLimit: 20, sessionTrashPageSize: 20 });
    const navigationMethods = createNavigationMethods({
        configModeSet: new Set(['codex', 'claude', 'opencode']),
        switchMainTabHelper: () => {},
        loadMoreSessionMessagesHelper: () => {}
    });
    return {
        shareCommandPrefix: 'npm start',
        sessionTrashEnabled: true,
        sessionTrashRetentionDays: 30,
        sessionTimelineStyle: 'dots',
        configTemplateDiffConfirmEnabled: true,
        sessionsUsageTimeRange: '7d',
        promptsSubTab: 'codex',
        projectClaudeMdPath: '',
        mainTab: 'dashboard',
        configMode: 'codex',
        settingsTab: 'general',
        skillsTargetApp: 'codex',
        promptTemplatesMode: 'compose',
        ...sessionActionMethods,
        ...sessionTrashMethods,
        ...navigationMethods,
        ...webPreferenceMethods
    };
}

test('web UI preferences load from local backend and mirror into localStorage fallback', async () => {
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
    assert.strictEqual(context.mainTab, 'settings');
    assert.strictEqual(context.settingsTab, 'data');
    assert.strictEqual(storage.getItem('codexmateShareCommandPrefix'), 'codexmate');
    assert.strictEqual(storage.getItem('codexmateSessionTrashEnabled'), 'false');
    assert.strictEqual(storage.getItem('codexmateSessionTrashRetentionDays'), '9');
    assert.strictEqual(storage.getItem('codexmateSessionTimelineStyle'), 'bar');
    assert.strictEqual(storage.getItem('sessionsUsageTimeRange'), '30d');
    assert.deepStrictEqual(apiCalls.map((call) => call.action), ['get-web-ui-preferences']);
});

test('web UI setters persist preferences to local backend', async () => {
    const apiCalls = [];
    const context = createContext(apiCalls, createMemoryStorage());
    context.setShareCommandPrefix('codexmate');
    await new Promise((resolve) => setTimeout(resolve, 160));

    const writeCall = apiCalls.find((call) => call.action === 'set-web-ui-preferences');
    assert.ok(writeCall, 'setter must persist web UI preferences');
    assert.strictEqual(writeCall.params.preferences.shareCommandPrefix, 'codexmate');
    assert.strictEqual(writeCall.params.preferences.sessionTrashRetentionDays, 30);
    assert.strictEqual(writeCall.params.preferences.navigation.settingsTab, 'general');
});

test('web UI preferences backend actions and startup hook are wired', () => {
    const cli = readProjectFile('cli.js');
    const app = readProjectFile('web-ui/app.js');
    const index = readProjectFile('web-ui/modules/app.methods.index.mjs');

    assert.match(cli, /CODEXMATE_PREFERENCES_FILE/);
    assert.match(cli, /function normalizeWebUiPreferences/);
    assert.match(cli, /case 'get-web-ui-preferences'/);
    assert.match(cli, /case 'set-web-ui-preferences'/);
    assert.match(app, /loadWebUiPreferences/);
    assert.match(index, /createWebUiPreferencesMethods/);
});
