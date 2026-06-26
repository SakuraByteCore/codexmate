import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { createAgentsMethods } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.methods.agents.mjs'))
);
const { createCodexConfigMethods } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.methods.codex-config.mjs'))
);
const { createI18nMethods } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'i18n.mjs'))
);
const { createRuntimeMethods } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.methods.runtime.mjs'))
);
const { buildSpeedTestIssue } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'logic.runtime.mjs'))
);

test('closeConfigTemplateModal ignores user close attempts while template apply is busy', () => {
    const methods = createCodexConfigMethods({
        api: async () => ({}),
        getProviderConfigModeMeta() {
            return null;
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        showConfigTemplateModal: true,
        configTemplateApplying: true,
        configTemplateContent: 'draft-template'
    };

    methods.closeConfigTemplateModal.call(context);

    assert.strictEqual(context.showConfigTemplateModal, true);
    assert.strictEqual(context.configTemplateContent, 'draft-template');
});

test('applyConfigTemplate force closes the modal after a successful apply', async () => {
    let loadAllCalls = 0;
    const methods = createCodexConfigMethods({
        api: async (action) => {
            if (action === 'preview-config-template-diff') {
                return {
                    diff: {
                        lines: [{ type: 'add', value: 'model = "qwen-plus"' }],
                        stats: { added: 1, removed: 0, unchanged: 0 },
                        hasChanges: true
                    }
                };
            }
            return { success: true };
        },
        getProviderConfigModeMeta() {
            return null;
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        showConfigTemplateModal: true,
        configTemplateApplying: false,
        configTemplateContent: 'draft-template',
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        async loadAll() {
            loadAllCalls += 1;
        }
    };

    await methods.applyConfigTemplate.call(context);

    assert.strictEqual(context.showConfigTemplateModal, true);
    assert.strictEqual(context.configTemplateDiffVisible, true);
    assert.strictEqual(context.configTemplateApplying, false);
    assert.strictEqual(loadAllCalls, 0);

    await methods.applyConfigTemplate.call(context);

    assert.strictEqual(context.showConfigTemplateModal, false);
    assert.strictEqual(context.configTemplateContent, '');
    assert.strictEqual(context.configTemplateApplying, false);
    assert.strictEqual(loadAllCalls, 1);
    assert.deepStrictEqual(context.shownMessages, [{
        message: '模板已应用',
        type: 'success'
    }]);
});

test('applyConfigTemplate keeps the successful apply result when only the refresh fails', async () => {
    const methods = createCodexConfigMethods({
        api: async (action) => {
            if (action === 'preview-config-template-diff') {
                return {
                    diff: {
                        lines: [{ type: 'add', value: 'model = "qwen-plus"' }],
                        stats: { added: 1, removed: 0, unchanged: 0 },
                        hasChanges: true
                    }
                };
            }
            return { success: true };
        },
        getProviderConfigModeMeta() {
            return null;
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        showConfigTemplateModal: true,
        configTemplateApplying: false,
        configTemplateContent: 'draft-template',
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        async loadAll() {
            throw new Error('refresh failed');
        }
    };

    await methods.applyConfigTemplate.call(context);

    assert.strictEqual(context.showConfigTemplateModal, true);
    assert.strictEqual(context.configTemplateDiffVisible, true);

    await methods.applyConfigTemplate.call(context);

    assert.strictEqual(context.showConfigTemplateModal, false);
    assert.strictEqual(context.configTemplateContent, '');
    assert.strictEqual(context.configTemplateApplying, false);
    assert.deepStrictEqual(context.shownMessages, [{
        message: '模板已应用',
        type: 'success'
    }, {
        message: '模板已应用，但界面刷新失败，请手动刷新',
        type: 'error'
    }]);
});

test('applyConfigTemplate applies immediately when diff confirm is disabled', async () => {
    let previewCalls = 0;
    let applyCalls = 0;
    const methods = createCodexConfigMethods({
        api: async (action) => {
            if (action === 'preview-config-template-diff') {
                previewCalls += 1;
                return {
                    diff: {
                        lines: [{ type: 'add', value: 'model = "qwen-plus"' }],
                        stats: { added: 1, removed: 0, unchanged: 0 },
                        hasChanges: true
                    }
                };
            }
            if (action === 'apply-config-template') {
                applyCalls += 1;
                return { success: true };
            }
            return { success: true };
        },
        getProviderConfigModeMeta() {
            return null;
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        showConfigTemplateModal: true,
        configTemplateApplying: false,
        configTemplateContent: 'draft-template',
        configTemplateDiffConfirmEnabled: false,
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        async loadAll() {}
    };

    await methods.applyConfigTemplate.call(context);

    assert.strictEqual(previewCalls, 0);
    assert.strictEqual(applyCalls, 1);
    assert.strictEqual(context.showConfigTemplateModal, false);
    assert.deepStrictEqual(context.shownMessages, [{
        message: '模板已应用',
        type: 'success'
    }]);
});

test('runHealthCheck treats backend error payloads as failures', async () => {
    const methods = createCodexConfigMethods({
        api: async () => ({ error: 'health failed' }),
        getProviderConfigModeMeta() {
            return null;
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        providersList: ['alpha'],
        speedResults: {},
        speedLoading: {},
        healthCheckLoading: false,
        healthCheckResult: { ok: true },
        configMode: 'codex',
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        async runSpeedTest() {
            throw new Error('speed tests should be skipped when health check already failed');
        }
    };

    await methods.runHealthCheck.call(context);

    assert.strictEqual(context.healthCheckLoading, false);
    assert.strictEqual(context.healthCheckResult, null);
    assert.deepStrictEqual(context.shownMessages, [{
        message: 'health failed',
        type: 'error'
    }]);
});

test('runHealthCheck batches Claude speed tests and records per-config failures', async () => {
    const methods = createCodexConfigMethods({
        api: async (action) => {
            throw new Error(`Claude batch health check should not call backend action: ${action}`);
        },
        getProviderConfigModeMeta() {
            return null;
        }
    });
    const speedTestCalls = [];
    const runtimeMethods = createRuntimeMethods({
        api: async (action, payload) => {
            assert.strictEqual(action, 'speed-test');
            speedTestCalls.push(payload);
            if (payload.targetApi === 'chat_completions') return { ok: false, error: 'timeout' };
            return { ok: true, durationMs: payload.targetApi === 'responses' ? 11 : 22, status: 200 };
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        ...runtimeMethods,
        lang: 'zh',
        providersList: ['codex-provider-should-not-run'],
        speedResults: {},
        speedLoading: {},
        claudeSpeedResults: {},
        claudeSpeedLoading: {},
        healthCheckLoading: false,
        healthCheckResult: { ok: true },
        healthCheckBatchTotal: 99,
        healthCheckBatchDone: 99,
        healthCheckBatchFailed: 99,
        configMode: 'claude',
        claudeConfigs: {
            anthropic: {
                baseUrl: 'https://anthropic.example.com/v1',
                apiKey: 'sk-anthropic',
                model: 'claude-sonnet-4-6',
                targetApi: 'responses'
            },
            chat: {
                baseUrl: 'https://openai.example.com/v1',
                apiKey: 'sk-chat',
                model: 'gpt-4.1',
                targetApi: 'chat_completions'
            },
            ollama: {
                baseUrl: 'http://127.0.0.1:11434',
                apiKey: '',
                model: 'llama3.1:8b',
                targetApi: 'ollama'
            }
        },
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        buildSpeedTestIssue
    };

    await methods.runHealthCheck.call(context);

    const callsByTarget = Object.fromEntries(speedTestCalls.map((payload) => [payload.targetApi, payload]));
    assert.strictEqual(context.healthCheckLoading, false);
    assert.strictEqual(context.healthCheckBatchTotal, 3);
    assert.strictEqual(context.healthCheckBatchDone, 3);
    assert.strictEqual(context.healthCheckBatchFailed, 1);
    assert.deepStrictEqual(speedTestCalls.map((payload) => payload.targetApi).sort(), ['chat_completions', 'ollama', 'responses']);
    assert.strictEqual(callsByTarget.responses.apiKey, 'sk-anthropic');
    assert.strictEqual(callsByTarget.chat_completions.apiKey, 'sk-chat');
    assert.strictEqual(callsByTarget.ollama.apiKey, '');
    assert.strictEqual(callsByTarget.ollama.model, 'llama3.1:8b');
    assert.strictEqual(context.claudeSpeedResults.ollama.ok, true);
    assert.strictEqual(context.healthCheckResult.ok, false);
    assert.deepStrictEqual(context.healthCheckResult.remote.speedTests, {
        anthropic: { ok: true, durationMs: 11, status: 200 },
        chat: { ok: false, error: 'timeout' },
        ollama: { ok: true, durationMs: 22, status: 200 }
    });
    assert.deepStrictEqual(context.healthCheckResult.issues, [{
        code: 'remote-speedtest-timeout',
        message: '提供商 chat 远程测速超时',
        suggestion: '检查网络或 base_url 是否可达'
    }]);
    assert.deepStrictEqual(context.shownMessages, []);
});

test('runHealthCheck checks Codex providers concurrently and exposes failed providers for deletion', async () => {
    const apiCalls = [];
    let configResolve;
    let providersResolve;
    const configPromise = new Promise((resolve) => { configResolve = resolve; });
    const providersPromise = new Promise((resolve) => { providersResolve = resolve; });
    const methods = createCodexConfigMethods({
        api: async (action, payload) => {
            apiCalls.push({ action, payload });
            if (action === 'config-health-check') return configPromise;
            if (action === 'providers-health') return providersPromise;
            throw new Error(`unexpected action: ${action}`);
        },
        getProviderConfigModeMeta() {
            return null;
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        providersList: [{ name: 'local' }, { name: 'bad' }, { name: 'system', nonDeletable: true }],
        currentProvider: 'local',
        speedResults: {},
        speedLoading: {},
        healthCheckLoading: false,
        healthCheckResult: null,
        healthCheckFailedProviderSelections: {},
        showHealthCheckModal: false,
        healthCheckBatchTotal: 99,
        healthCheckBatchDone: 99,
        healthCheckBatchFailed: 99,
        configMode: 'codex',
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        shouldShowProviderDelete(provider) {
            return !(provider && provider.nonDeletable);
        },
        isToolConfigWriteAllowed() {
            return true;
        },
        async runSpeedTest() {
            throw new Error('Codex settings health check must not run provider-card speed tests');
        },
        buildSpeedTestIssue() {
            throw new Error('speed test issues should not be built');
        },
        runProvidersHealthCheck() {
            throw new Error('runProvidersHealthCheck UI helper should not be used here');
        }
    };

    const runPromise = methods.runHealthCheck.call(context);
    await Promise.resolve();
    assert.deepStrictEqual(apiCalls, [
        { action: 'config-health-check', payload: { remote: false } },
        { action: 'providers-health', payload: { remote: true } }
    ]);

    providersResolve({
        ok: false,
        currentProvider: 'local',
        summary: { total: 3, green: 1, yellow: 1, red: 1 },
        providers: [
            { provider: 'local', status: 'green', issues: [], remote: { ok: true, statusCode: 200, message: 'ok' } },
            { provider: 'bad', status: 'red', issues: [{ code: 'remote-model-probe-http-error', message: 'bad HTTP 502' }], remote: { ok: false, statusCode: 502, message: 'bad' } },
            { provider: 'system', status: 'yellow', issues: [{ code: 'api-key-missing', message: 'system key missing' }], remote: null }
        ]
    });
    configResolve({ ok: true, issues: [], summary: { currentProvider: 'local', currentModel: 'e2e-model' }, remote: null });
    await runPromise;

    assert.strictEqual(context.healthCheckLoading, false);
    assert.strictEqual(context.showHealthCheckModal, true);
    assert.strictEqual(context.healthCheckBatchTotal, 3);
    assert.strictEqual(context.healthCheckBatchDone, 3);
    assert.strictEqual(context.healthCheckBatchFailed, 2);
    assert.strictEqual(context.healthCheckResult.ok, false);
    assert.strictEqual(context.healthCheckResult.remote.type, 'providers-health');
    assert.deepStrictEqual(context.healthCheckResult.issues.map((issue) => issue.provider), ['bad', 'system']);
    assert.deepStrictEqual(context.getHealthCheckFailedProviderItems().map((item) => ({
        name: item.name,
        status: item.status,
        deletable: item.deletable,
        detail: item.detail
    })), [
        { name: 'bad', status: 'red', deletable: true, detail: 'bad HTTP 502' },
        { name: 'system', status: 'yellow', deletable: false, detail: 'system key missing' }
    ]);
    assert.deepStrictEqual(context.getSelectableHealthCheckFailedProviderItems().map((item) => item.name), ['bad']);
    assert.strictEqual(context.areAllHealthCheckFailedProvidersSelected(), false);
    context.setAllHealthCheckFailedProviderSelections(true);
    assert.deepStrictEqual(context.healthCheckFailedProviderSelections, { 'codex:bad': true });
    assert.strictEqual(context.hasHealthCheckFailedProviderSelection(), true);
    assert.strictEqual(context.areAllHealthCheckFailedProvidersSelected(), true);
    context.setAllHealthCheckFailedProviderSelections(false);
    assert.deepStrictEqual(context.healthCheckFailedProviderSelections, { 'codex:bad': false });
    assert.strictEqual(context.hasHealthCheckFailedProviderSelection(), false);
    assert.deepStrictEqual(context.shownMessages, [{ message: '检查失败', type: 'error' }]);
});

test('deleteSelectedHealthCheckFailedProviders deletes only selected deletable failed providers', async () => {
    const deleted = [];
    const methods = createCodexConfigMethods({
        api: async (action, payload) => {
            if (action === 'delete-provider') {
                deleted.push(payload.name);
                return { success: true };
            }
            return { ok: true, issues: [], summary: {}, remote: null };
        },
        getProviderConfigModeMeta() {
            return null;
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        configMode: 'codex',
        providersList: [{ name: 'bad' }, { name: 'system', nonDeletable: true }, { name: 'ok' }],
        healthCheckFailedProviderSelections: {},
        healthCheckFailedProviderDeleting: false,
        healthCheckBatchTotal: 3,
        healthCheckBatchDone: 3,
        healthCheckBatchFailed: 2,
        healthCheckResult: {
            ok: false,
            issues: [
                { provider: 'bad', message: 'bad HTTP 502' },
                { provider: 'system', message: 'system key missing' }
            ],
            remote: {
                type: 'providers-health',
                currentProvider: 'ok',
                summary: { total: 3, green: 1, yellow: 1, red: 1 },
                providers: [
                    { provider: 'ok', status: 'green', issues: [] },
                    { provider: 'bad', status: 'red', issues: [{ message: 'bad HTTP 502' }] },
                    { provider: 'system', status: 'yellow', issues: [{ message: 'system key missing' }] }
                ]
            }
        },
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        shouldShowProviderDelete(provider) {
            return !(provider && provider.nonDeletable);
        },
        isToolConfigWriteAllowed() {
            return true;
        }
    };

    context.setAllHealthCheckFailedProviderSelections(true);
    assert.deepStrictEqual(context.healthCheckFailedProviderSelections, { 'codex:bad': true });
    assert.strictEqual(context.areAllHealthCheckFailedProvidersSelected(), true);

    await methods.deleteSelectedHealthCheckFailedProviders.call(context);

    assert.deepStrictEqual(deleted, ['bad']);
    assert.deepStrictEqual(context.healthCheckFailedProviderSelections, {});
    assert.deepStrictEqual(context.healthCheckResult.remote.providers.map((provider) => provider.provider), ['ok', 'system']);
    assert.deepStrictEqual(context.healthCheckResult.issues.map((issue) => issue.provider), ['system']);
    assert.strictEqual(context.healthCheckBatchTotal, 2);
    assert.strictEqual(context.healthCheckBatchFailed, 1);
    assert.deepStrictEqual(context.shownMessages, [{ message: '已删除 1 个失败提供商', type: 'success' }]);
});

test('deleteSelectedHealthCheckFailedProviders bulk-deletes Claude configs without per-item confirmation', async () => {
    const methods = createCodexConfigMethods({
        api: async () => {
            throw new Error('Codex delete-provider should not be called for Claude configs');
        },
        getProviderConfigModeMeta() {
            return null;
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        configMode: 'claude',
        claudeConfigs: {
            bad: { name: 'bad' },
            worse: { name: 'worse' },
            ok: { name: 'ok' }
        },
        currentClaudeConfig: 'bad',
        healthCheckFailedProviderSelections: {},
        healthCheckFailedProviderDeleting: false,
        healthCheckBatchTotal: 3,
        healthCheckBatchDone: 3,
        healthCheckBatchFailed: 2,
        healthCheckResult: {
            ok: false,
            issues: [
                { provider: 'bad', message: 'bad failed' },
                { provider: 'worse', message: 'worse failed' }
            ],
            remote: null
        },
        saved: 0,
        refreshed: 0,
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        isToolConfigWriteAllowed() {
            return true;
        },
        saveClaudeConfigs() {
            this.saved += 1;
        },
        refreshClaudeModelContext() {
            this.refreshed += 1;
        },
        async requestConfirmDialog() {
            throw new Error('bulk failed-provider cleanup must not request per-item confirmation');
        },
        async deleteClaudeConfig() {
            throw new Error('bulk failed-provider cleanup must not call deleteClaudeConfig');
        }
    };

    context.setAllHealthCheckFailedProviderSelections(true);
    assert.deepStrictEqual(context.healthCheckFailedProviderSelections, { 'claude:bad': true, 'claude:worse': true });

    await methods.deleteSelectedHealthCheckFailedProviders.call(context);

    assert.deepStrictEqual(Object.keys(context.claudeConfigs), ['ok']);
    assert.strictEqual(context.currentClaudeConfig, 'ok');
    assert.strictEqual(context.saved, 1);
    assert.strictEqual(context.refreshed, 1);
    assert.deepStrictEqual(context.healthCheckFailedProviderSelections, {});
    assert.deepStrictEqual(context.healthCheckResult.issues, []);
    assert.strictEqual(context.healthCheckResult.ok, true);
    assert.deepStrictEqual(context.shownMessages, [{ message: '已删除 2 个失败提供商', type: 'success' }]);
});

test('deleteSelectedHealthCheckFailedProviders requires an explicit selected provider', async () => {
    const methods = createCodexConfigMethods({
        api: async () => ({ ok: true, issues: [], summary: {}, remote: null }),
        getProviderConfigModeMeta() {
            return null;
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        configMode: 'codex',
        providersList: [{ name: 'bad' }],
        healthCheckFailedProviderSelections: {},
        healthCheckResult: {
            ok: false,
            issues: [{ provider: 'bad', message: 'bad HTTP 502' }],
            remote: {
                type: 'providers-health',
                providers: [
                    { provider: 'bad', status: 'red', issues: [{ message: 'bad HTTP 502' }] }
                ]
            }
        },
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        shouldShowProviderDelete() {
            return true;
        },
        isToolConfigWriteAllowed() {
            return true;
        },
        async deleteProvider() {
            throw new Error('delete should require explicit selection');
        }
    };

    await methods.deleteSelectedHealthCheckFailedProviders.call(context);

    assert.deepStrictEqual(context.shownMessages, [{ message: '请先选择至少一个失败提供商', type: 'info' }]);
});

test('applyCodexConfigDirect keeps the successful apply result when only the refresh fails', async () => {
    const apiCalls = [];
    const methods = createCodexConfigMethods({
        api: async (action) => {
            apiCalls.push(action);
            if (action === 'get-config-template') {
                return { template: 'template-body' };
            }
            if (action === 'apply-config-template') {
                return { success: true };
            }
            throw new Error(`Unexpected action: ${action}`);
        },
        getProviderConfigModeMeta() {
            return null;
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        codexApplying: false,
        _pendingCodexApplyOptions: null,
        currentProvider: 'alpha',
        currentModel: 'alpha-model',
        serviceTier: 'fast',
        modelReasoningEffort: 'high',
        modelContextWindowInput: '190000',
        modelAutoCompactTokenLimitInput: '185000',
        shownMessages: [],
        normalizePositiveIntegerInput(value, label, fallback = '') {
            const raw = value === undefined || value === null || value === ''
                ? String(fallback || '')
                : String(value);
            const numeric = Number.parseInt(String(raw).trim(), 10);
            if (!Number.isFinite(numeric) || numeric <= 0) {
                return { ok: false, error: `${label} invalid` };
            }
            return { ok: true, value: numeric, text: String(numeric) };
        },
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        async loadAll() {
            throw new Error('refresh failed');
        }
    };

    await methods.applyCodexConfigDirect.call(context);

    assert.strictEqual(context.codexApplying, false);
    assert.deepStrictEqual(apiCalls, ['get-config-template', 'apply-config-template']);
    assert.deepStrictEqual(context.shownMessages, [{
        message: '配置已应用',
        type: 'success'
    }, {
        message: '配置已应用，但界面刷新失败，请手动刷新',
        type: 'error'
    }]);
});

test('handleBeforeUnload keeps the agents unsaved-change guard active while saving', () => {
    const methods = createAgentsMethods();
    const context = {
        ...methods,
        showAgentsModal: true,
        agentsLoading: false,
        agentsSaving: true,
        agentsDiffVisible: false,
        agentsOriginalContent: 'before',
        agentsContent: 'after'
    };
    const event = {
        returnValue: undefined,
        preventDefaultCalled: false,
        preventDefault() {
            this.preventDefaultCalled = true;
        }
    };

    const result = methods.handleBeforeUnload.call(context, event);

    assert.strictEqual(methods.hasPendingAgentsDraft.call(context), true);
    assert.strictEqual(result, '');
    assert.strictEqual(event.preventDefaultCalled, true);
    assert.strictEqual(event.returnValue, '');
});

test('openOpenclawWorkspaceEditor rejects invalid workspace filenames before loading', async () => {
    let apiCalls = 0;
    const methods = createAgentsMethods({
        api: async () => {
            apiCalls += 1;
            return {};
        }
    });
    const context = {
        ...methods,
        openclawWorkspaceFileName: '../escape.md',
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        }
    };

    await methods.openOpenclawWorkspaceEditor.call(context);

    assert.strictEqual(apiCalls, 0);
    assert.strictEqual(context.agentsLoading, undefined);
    assert.deepStrictEqual(context.shownMessages, [{
        message: '仅支持 OpenClaw Workspace 内的 `.md` 文件',
        type: 'error'
    }]);
});

test('latest agents editor request keeps loading state until the newest response lands', async () => {
    const resolvers = [];
    const methods = createAgentsMethods({
        api: async (action) => new Promise((resolve) => {
            resolvers.push({ action, resolve });
        })
    });
    const context = {
        ...methods,
        shownMessages: [],
        resetCalls: 0,
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        resetAgentsDiffState() {
            this.resetCalls += 1;
        }
    };

    const firstOpen = methods.openAgentsEditor.call(context);
    const secondOpen = methods.openOpenclawAgentsEditor.call(context);

    assert.strictEqual(context.agentsLoading, true);
    assert.deepStrictEqual(
        resolvers.map((entry) => entry.action),
        ['get-agents-file', 'get-openclaw-agents-file']
    );

    resolvers[0].resolve({
        content: 'codex-agents',
        path: '/tmp/AGENTS.md',
        exists: true,
        lineEnding: '\n'
    });
    await firstOpen;

    assert.strictEqual(context.agentsLoading, true);
    assert.strictEqual(context.showAgentsModal, undefined);
    assert.strictEqual(context.agentsContent, undefined);
    assert.strictEqual(context.resetCalls, 0);

    resolvers[1].resolve({
        content: 'openclaw-agents',
        path: '/tmp/openclaw/AGENTS.md',
        exists: true,
        lineEnding: '\r\n'
    });
    await secondOpen;

    assert.strictEqual(context.agentsLoading, false);
    assert.strictEqual(context.showAgentsModal, true);
    assert.strictEqual(context.agentsContext, 'openclaw');
    assert.strictEqual(context.agentsContent, 'openclaw-agents');
    assert.strictEqual(context.agentsPath, '/tmp/openclaw/AGENTS.md');
    assert.strictEqual(context.agentsLineEnding, '\r\n');
    assert.strictEqual(context.resetCalls, 1);
    assert.deepStrictEqual(context.shownMessages, []);
});

test('closeAgentsModal invalidates pending open requests so late responses cannot reopen the modal', async () => {
    let resolveApi;
    const methods = createAgentsMethods({
        api: async () => await new Promise((resolve) => {
            resolveApi = resolve;
        })
    });
    const context = {
        ...methods,
        showAgentsModal: false,
        agentsContent: '',
        agentsOriginalContent: '',
        agentsPath: '',
        agentsExists: false,
        agentsLineEnding: '\n',
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        }
    };

    const pendingOpen = methods.openAgentsEditor.call(context);
    assert.strictEqual(context.agentsLoading, true);

    await methods.closeAgentsModal.call(context, { force: true });
    assert.strictEqual(context.agentsLoading, false);
    assert.strictEqual(context.showAgentsModal, false);

    resolveApi({
        content: 'late-agents',
        path: '/tmp/AGENTS.md',
        exists: true,
        lineEnding: '\n'
    });
    await pendingOpen;

    assert.strictEqual(context.agentsLoading, false);
    assert.strictEqual(context.showAgentsModal, false);
    assert.strictEqual(context.agentsContent, '');
    assert.strictEqual(context.agentsPath, '');
    assert.deepStrictEqual(context.shownMessages, []);
});

test('applyAgentsContent rejects invalid workspace filenames before save api', async () => {
    let apiCalls = 0;
    const methods = createAgentsMethods({
        api: async () => {
            apiCalls += 1;
            return { success: true };
        }
    });
    const context = {
        ...methods,
        agentsContext: 'openclaw-workspace',
        agentsWorkspaceFileName: '../escape.md',
        agentsDiffVisible: true,
        agentsDiffLoading: false,
        agentsDiffError: '',
        agentsDiffHasChanges: true,
        agentsDiffHasChangesValue: true,
        agentsDiffFingerprint: 'same',
        agentsContent: 'after',
        agentsOriginalContent: 'before',
        agentsLineEnding: '\n',
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        buildAgentsDiffFingerprint() {
            return 'same';
        }
    };

    await methods.applyAgentsContent.call(context);

    assert.strictEqual(apiCalls, 0);
    assert.strictEqual(context.agentsSaving, undefined);
    assert.deepStrictEqual(context.shownMessages, [{
        message: '仅支持 OpenClaw Workspace 内的 `.md` 文件',
        type: 'error'
    }]);
});

test('prepareAgentsDiff supports global CLAUDE.md from claude-project tab without baseDir', async () => {
    const previewCalls = [];
    const methods = createAgentsMethods({
        api: async () => ({ success: true }),
        apiWithMeta: async (action, params) => {
            previewCalls.push({ action, params });
            return {
                diff: {
                    lines: [{ type: 'add', value: 'after' }],
                    stats: { added: 1, removed: 0, unchanged: 0 },
                    hasChanges: true
                }
            };
        }
    });
    const context = {
        ...methods,
        agentsContext: 'claude-project',
        projectClaudeMdPath: '',
        agentsContent: 'after',
        agentsOriginalContent: 'before',
        agentsLineEnding: '\n'
    };

    await methods.prepareAgentsDiff.call(context);

    assert.deepStrictEqual(previewCalls, [{
        action: 'preview-agents-diff',
        params: {
            content: 'after',
            lineEnding: '\n',
            context: 'claude-project',
            baseContent: 'before'
        }
    }]);
    assert.strictEqual(context.agentsDiffError, '');
    assert.strictEqual(context.agentsDiffHasChangesValue, true);
});

test('loadPromptsContent auto-loads project path options for claude-project tab', async () => {
    const apiCalls = [];
    let pathLoadCalls = 0;
    const methods = createAgentsMethods({
        api: async (action, params) => {
            apiCalls.push({ action, params });
            return {
                content: 'global claude',
                path: '/home/user/.claude/CLAUDE.md',
                exists: true,
                lineEnding: '\n'
            };
        }
    });
    const context = {
        ...methods,
        promptsSubTab: 'claude-project',
        mainTab: 'prompts',
        projectClaudeMdPath: '',
        projectPathOptions: [],
        projectPathOptionsLoading: false,
        resetAgentsDiffState() {},
        showMessage() {},
        loadProjectPathOptions() {
            pathLoadCalls += 1;
        }
    };

    await methods.loadPromptsContent.call(context);

    assert.strictEqual(pathLoadCalls, 1);
    assert.deepStrictEqual(apiCalls, [{
        action: 'get-claude-md-file',
        params: {}
    }]);
    assert.strictEqual(context.agentsContent, 'global claude');
    assert.strictEqual(context.agentsContext, 'claude-project');
});

test('loadPromptsContent does not duplicate project path loading while already loading', async () => {
    let pathLoadCalls = 0;
    const methods = createAgentsMethods({
        api: async () => ({ content: '', path: '', exists: false, lineEnding: '\n' })
    });
    const context = {
        ...methods,
        promptsSubTab: 'claude-project',
        mainTab: 'prompts',
        projectClaudeMdPath: '',
        projectPathOptions: [],
        projectPathOptionsLoading: true,
        resetAgentsDiffState() {},
        showMessage() {},
        loadProjectPathOptions() {
            pathLoadCalls += 1;
        }
    };

    await methods.loadPromptsContent.call(context);

    assert.strictEqual(pathLoadCalls, 0);
});

test('applyAgentsContent saves global CLAUDE.md from claude-project tab without baseDir', async () => {
    const apiCalls = [];
    const methods = createAgentsMethods({
        api: async (action, params) => {
            apiCalls.push({ action, params });
            return { success: true };
        }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        agentsContext: 'claude-project',
        projectClaudeMdPath: '',
        agentsDiffVisible: true,
        agentsDiffLoading: false,
        agentsDiffError: '',
        agentsDiffHasChanges: true,
        agentsDiffHasChangesValue: true,
        agentsDiffFingerprint: 'same',
        agentsContent: 'after',
        agentsOriginalContent: 'before',
        agentsLineEnding: '\n',
        mainTab: 'sessions',
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        buildAgentsDiffFingerprint() {
            return 'same';
        },
        closeAgentsModal(options) {
            this.closeOptions = options;
        }
    };

    await methods.applyAgentsContent.call(context);

    assert.deepStrictEqual(apiCalls, [{
        action: 'apply-claude-md-file',
        params: {
            content: 'after',
            lineEnding: '\n'
        }
    }]);
    assert.deepStrictEqual(context.shownMessages, [{
        message: '项目 CLAUDE.md 已保存',
        type: 'success'
    }]);
    assert.deepStrictEqual(context.closeOptions, { force: true });
});

test('applyAgentsContent ignores duplicate save attempts while a save is already running', async () => {
    const resolvers = [];
    const apiCalls = [];
    const methods = createAgentsMethods({
        api: async (action, params) => {
            apiCalls.push({ action, params });
            return new Promise((resolve) => {
                resolvers.push(resolve);
            });
        }
    });
    const closeCalls = [];
    const context = {
        ...createI18nMethods(),
        ...methods,
        agentsContext: 'codex',
        agentsDiffVisible: true,
        agentsDiffLoading: false,
        agentsDiffError: '',
        agentsDiffHasChanges: true,
        agentsDiffHasChangesValue: true,
        agentsDiffFingerprint: 'same',
        agentsContent: 'after',
        agentsOriginalContent: 'before',
        agentsLineEnding: '\n',
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        buildAgentsDiffFingerprint() {
            return 'same';
        },
        closeAgentsModal(options) {
            closeCalls.push(options);
        }
    };

    const firstApply = methods.applyAgentsContent.call(context);
    assert.strictEqual(context.agentsSaving, true);

    const secondApply = methods.applyAgentsContent.call(context);
    assert.strictEqual(apiCalls.length, 1);

    resolvers[0]({ success: true });
    if (resolvers[1]) {
        resolvers[1]({ success: true });
    }

    await firstApply;
    await secondApply;

    assert.deepStrictEqual(apiCalls, [{
        action: 'apply-agents-file',
        params: {
            content: 'after',
            lineEnding: '\n'
        }
    }]);
    assert.strictEqual(context.agentsSaving, false);
    assert.deepStrictEqual(closeCalls, [{ force: true }]);
    assert.deepStrictEqual(context.shownMessages, [{
        message: 'AGENTS.md 已保存',
        type: 'success'
    }]);
});
