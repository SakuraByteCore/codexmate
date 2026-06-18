import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { readBundledWebUiScript, readProjectFile } from './helpers/web-ui-source.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { createI18nMethods } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'i18n.mjs'))
);
const { createCodexConfigMethods } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.methods.codex-config.mjs'))
);
const {
    isLikelyBuiltinClaudeProxySettingsEnv,
    matchBuiltinClaudeProxyConfigFromSettings
} = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'logic.mjs'))
);

const appSource = readBundledWebUiScript();
const claudeConfigModuleSource = readProjectFile('web-ui/modules/app.methods.claude-config.mjs');
const cliSource = readProjectFile('cli.js');

function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatchingBraceRespectingSyntax(source, braceStart) {
    let depth = 0;
    const contexts = [];
    const topContext = () => contexts[contexts.length - 1];

    for (let i = braceStart; i < source.length; i += 1) {
        const ch = source[i];
        const next = source[i + 1];
        const ctx = topContext();

        if (!ctx) {
            if (ch === '\'') {
                contexts.push({ type: 'single', escape: false });
                continue;
            }
            if (ch === '"') {
                contexts.push({ type: 'double', escape: false });
                continue;
            }
            if (ch === '`') {
                contexts.push({ type: 'templateString', escape: false });
                continue;
            }
            if (ch === '/' && next === '/') {
                contexts.push({ type: 'lineComment' });
                i += 1;
                continue;
            }
            if (ch === '/' && next === '*') {
                contexts.push({ type: 'blockComment' });
                i += 1;
                continue;
            }
            if (ch === '{') {
                depth += 1;
                continue;
            }
            if (ch === '}') {
                depth -= 1;
                if (depth === 0) {
                    return i;
                }
            }
            continue;
        }

        if (ctx.type === 'single' || ctx.type === 'double') {
            if (ctx.escape) {
                ctx.escape = false;
                continue;
            }
            if (ch === '\\') {
                ctx.escape = true;
                continue;
            }
            const target = ctx.type === 'single' ? '\'' : '"';
            if (ch === target) {
                contexts.pop();
            }
            continue;
        }

        if (ctx.type === 'lineComment') {
            if (ch === '\n') {
                contexts.pop();
            }
            continue;
        }

        if (ctx.type === 'blockComment') {
            if (ch === '*' && next === '/') {
                contexts.pop();
                i += 1;
            }
            continue;
        }

        if (ctx.type === 'templateString') {
            if (ctx.escape) {
                ctx.escape = false;
                continue;
            }
            if (ch === '\\') {
                ctx.escape = true;
                continue;
            }
            if (ch === '`') {
                contexts.pop();
                continue;
            }
            if (ch === '$' && next === '{') {
                contexts.push({ type: 'templateExpr', depth: 1 });
                i += 1;
            }
            continue;
        }

        if (ctx.type === 'templateExpr') {
            if (ch === '\'') {
                contexts.push({ type: 'single', escape: false });
                continue;
            }
            if (ch === '"') {
                contexts.push({ type: 'double', escape: false });
                continue;
            }
            if (ch === '`') {
                contexts.push({ type: 'templateString', escape: false });
                continue;
            }
            if (ch === '/' && next === '/') {
                contexts.push({ type: 'lineComment' });
                i += 1;
                continue;
            }
            if (ch === '/' && next === '*') {
                contexts.push({ type: 'blockComment' });
                i += 1;
                continue;
            }
            if (ch === '{') {
                ctx.depth += 1;
                continue;
            }
            if (ch === '}') {
                ctx.depth -= 1;
                if (ctx.depth === 0) {
                    contexts.pop();
                }
            }
        }
    }

    throw new Error('Closing brace not found for method block');
}

function extractBlockByMethodName(source, methodName) {
    const name = String(methodName || '').trim();
    if (!name) {
        throw new Error('Method name is required');
    }

    const pattern = new RegExp(
        `(?:^|\\n)([\\t ]*(?:async\\s+)?${escapeRegExp(name)}\\s*\\([^)]*\\)\\s*\\{)`,
        'm'
    );
    const match = pattern.exec(source);
    if (!match) {
        throw new Error(`Method signature not found: ${name}`);
    }
    const signatureText = match[1];
    const startIndex = match.index + match[0].lastIndexOf(signatureText);
    const braceStart = startIndex + signatureText.lastIndexOf('{');
    if (braceStart < 0) {
        throw new Error(`Opening brace not found for: ${name}`);
    }

    const endIndex = findMatchingBraceRespectingSyntax(source, braceStart);
    return source.slice(startIndex, endIndex + 1);
}

function extractMethodAsFunction(source, methodName) {
    const methodBlock = extractBlockByMethodName(source, methodName).trim();
    if (!methodBlock.startsWith(`${methodName}(`) && !methodBlock.startsWith(`async ${methodName}(`)) {
        throw new Error(`Method mismatch for ${methodName}`);
    }
    if (methodBlock.startsWith(`async ${methodName}(`)) {
        return `async function ${methodBlock.slice('async '.length)}`;
    }
    return `function ${methodBlock}`;
}

function extractFunctionDeclaration(source, functionName) {
    const pattern = new RegExp(`(?:^|\\n)(function\\s+${escapeRegExp(functionName)}\\s*\\([^)]*\\)\\s*\\{)`, 'm');
    const match = pattern.exec(source);
    if (!match) {
        throw new Error(`Function declaration not found: ${functionName}`);
    }
    const startIndex = match.index + match[0].lastIndexOf(match[1]);
    const braceStart = startIndex + match[1].lastIndexOf('{');
    const endIndex = findMatchingBraceRespectingSyntax(source, braceStart);
    return source.slice(startIndex, endIndex + 1);
}

function claudeValidationSupportSource() {
    return [
        'normalizeClaudeText',
        'normalizeClaudeBaseUrl',
        'isValidClaudeHttpUrl',
        'getClaudeConfigValidationForContext'
    ].map((name) => extractFunctionDeclaration(claudeConfigModuleSource, name)).join('\n');
}

function extractClaudeMethodAsFunction(source, methodName) {
    return `${claudeValidationSupportSource()}\n${extractMethodAsFunction(claudeConfigModuleSource, methodName)}`;
}

function instantiateFunction(funcSource, funcName, bindings = {}) {
    const bindingNames = Object.keys(bindings);
    const bindingValues = Object.values(bindings);
    return Function(...bindingNames, `${funcSource}\nreturn ${funcName};`)(...bindingValues);
}

test('buildClaudeImportedConfigName derives host-based fallback name', () => {
    const source = extractMethodAsFunction(appSource, 'buildClaudeImportedConfigName');
    const buildClaudeImportedConfigName = instantiateFunction(source, 'buildClaudeImportedConfigName', { URL });
    const name = buildClaudeImportedConfigName('https://maxx-direct.cloverstd.com/project/ym/111');
    assert.strictEqual(name, '导入-maxx-direct.cloverstd.com');
});


test('addClaudeConfig requires a visible model value before saving', async () => {
    const source = extractClaudeMethodAsFunction(appSource, 'addClaudeConfig');
    const addClaudeConfig = instantiateFunction(source, 'addClaudeConfig');
    const messages = [];
    let saveCount = 0;
    const i18nMethods = createI18nMethods();
    const context = {
        ...i18nMethods,
        lang: 'zh',
        newClaudeConfig: {
            name: 'Claude Test',
            apiKey: 'sk-test',
            baseUrl: 'https://api.example.com/anthropic',
            model: '   '
        },
        claudeConfigs: {},
        currentClaudeConfig: '',
        showMessage(text, type) { messages.push({ text, type }); },
        findDuplicateClaudeConfigName: () => '',
        mergeClaudeConfig: (_, cfg) => ({ ...cfg }),
        saveClaudeConfigs() { saveCount += 1; },
        closeClaudeConfigModal() {},
        refreshClaudeModelContext() {}
    };

    await addClaudeConfig.call(context);

    assert.deepStrictEqual(messages, [{ text: '模型名称必填', type: 'error' }]);
    assert.deepStrictEqual(context.claudeConfigs, {});
    assert.strictEqual(saveCount, 0);
});

test('Claude config validation exposes inline add/edit field errors', () => {
    const support = claudeValidationSupportSource();
    const fieldErrorSource = `${support}
${extractMethodAsFunction(appSource, 'claudeConfigFieldError')}`;
    const canSubmitSource = `${support}
${extractMethodAsFunction(appSource, 'canSubmitClaudeConfig')}`;
    const claudeConfigFieldError = instantiateFunction(fieldErrorSource, 'claudeConfigFieldError');
    const canSubmitClaudeConfig = instantiateFunction(canSubmitSource, 'canSubmitClaudeConfig');
    const i18nMethods = createI18nMethods();
    const context = {
        ...i18nMethods,
        lang: 'zh',
        newClaudeConfig: {
            name: 'Existing',
            apiKey: '',
            baseUrl: 'ftp://bad.example.com',
            model: '   '
        },
        editingConfig: {
            name: 'Edit Me',
            apiKey: '',
            baseUrl: 'not-a-url',
            model: ''
        },
        claudeConfigs: {
            Existing: { model: 'claude-old' }
        }
    };

    assert.strictEqual(claudeConfigFieldError.call(context, 'add', 'name'), '名称已存在');
    assert.strictEqual(claudeConfigFieldError.call(context, 'add', 'apiKey'), 'API Key 必填');
    assert.strictEqual(claudeConfigFieldError.call(context, 'add', 'baseUrl'), 'Base URL 仅支持 http/https');
    assert.strictEqual(claudeConfigFieldError.call(context, 'add', 'model'), '模型名称必填');
    assert.strictEqual(canSubmitClaudeConfig.call(context, 'add'), false);
    assert.strictEqual(claudeConfigFieldError.call(context, 'edit', 'apiKey'), 'API Key 必填');
    assert.strictEqual(claudeConfigFieldError.call(context, 'edit', 'baseUrl'), 'Base URL 仅支持 http/https');
    assert.strictEqual(claudeConfigFieldError.call(context, 'edit', 'model'), '模型名称必填');
    assert.strictEqual(canSubmitClaudeConfig.call(context, 'edit'), false);

    context.newClaudeConfig = { name: 'Fresh', apiKey: 'sk-test', baseUrl: '   ', model: 'claude-sonnet-4' };
    assert.strictEqual(claudeConfigFieldError.call(context, 'add', 'baseUrl'), 'Base URL 必填');
    assert.strictEqual(canSubmitClaudeConfig.call(context, 'add'), false);
});

test('Claude edit validation allows external credential configs without api key', () => {
    const support = claudeValidationSupportSource();
    const fieldErrorSource = `${support}
${extractMethodAsFunction(appSource, 'claudeConfigFieldError')}`;
    const canSubmitSource = `${support}
${extractMethodAsFunction(appSource, 'canSubmitClaudeConfig')}`;
    const claudeConfigFieldError = instantiateFunction(fieldErrorSource, 'claudeConfigFieldError');
    const canSubmitClaudeConfig = instantiateFunction(canSubmitSource, 'canSubmitClaudeConfig');
    const i18nMethods = createI18nMethods();
    const context = {
        ...i18nMethods,
        lang: 'zh',
        newClaudeConfig: { name: '', apiKey: '', baseUrl: '', model: '' },
        editingConfig: {
            name: 'Imported Auth Token',
            apiKey: '',
            externalCredentialType: 'auth-token',
            baseUrl: 'https://api.anthropic.com',
            model: 'claude-opus-4-6'
        },
        claudeConfigs: {}
    };

    assert.strictEqual(claudeConfigFieldError.call(context, 'edit', 'apiKey'), '');
    assert.strictEqual(canSubmitClaudeConfig.call(context, 'edit'), true);
});

test('Claude validation allows Ollama target without api key', () => {
    const support = claudeValidationSupportSource();
    const fieldErrorSource = `${support}
${extractMethodAsFunction(appSource, 'claudeConfigFieldError')}`;
    const canSubmitSource = `${support}
${extractMethodAsFunction(appSource, 'canSubmitClaudeConfig')}`;
    const claudeConfigFieldError = instantiateFunction(fieldErrorSource, 'claudeConfigFieldError');
    const canSubmitClaudeConfig = instantiateFunction(canSubmitSource, 'canSubmitClaudeConfig');
    const context = {
        newClaudeConfig: {
            name: 'Local Ollama',
            apiKey: '',
            externalCredentialType: '',
            baseUrl: 'http://127.0.0.1:11434',
            model: 'deepseek-v4-pro:cloud',
            targetApi: 'ollama'
        },
        editingConfig: {
            name: 'Edit Ollama',
            apiKey: '',
            externalCredentialType: '',
            baseUrl: 'http://127.0.0.1:11434',
            model: 'deepseek-v4-pro:cloud',
            targetApi: 'ollama'
        },
        claudeConfigs: {}
    };

    assert.strictEqual(claudeConfigFieldError.call(context, 'add', 'apiKey'), '');
    assert.strictEqual(canSubmitClaudeConfig.call(context, 'add'), true);
    assert.strictEqual(claudeConfigFieldError.call(context, 'edit', 'apiKey'), '');
    assert.strictEqual(canSubmitClaudeConfig.call(context, 'edit'), true);
});

test('openEditConfigModal carries external credential metadata into edit validation state', () => {
    const source = extractMethodAsFunction(appSource, 'openEditConfigModal');
    const openEditConfigModal = instantiateFunction(source, 'openEditConfigModal');
    const context = {
        claudeConfigs: {
            imported: {
                apiKey: '',
                externalCredentialType: 'auth-token',
                baseUrl: 'https://api.anthropic.com',
                model: 'claude-opus-4-6'
            }
        },
        editingConfig: {},
        showEditClaudeConfigKey: true,
        showEditConfigModal: false
    };

    openEditConfigModal.call(context, 'imported');

    assert.deepStrictEqual(context.editingConfig, {
        name: 'imported',
        apiKey: '',
        externalCredentialType: 'auth-token',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-opus-4-6',
        targetApi: 'responses'
    });
    assert.strictEqual(context.showEditClaudeConfigKey, false);
    assert.strictEqual(context.showEditConfigModal, true);
});

test('addClaudeConfig trims, persists, and applies the entered model', async () => {
    const source = extractClaudeMethodAsFunction(appSource, 'addClaudeConfig');
    const addClaudeConfig = instantiateFunction(source, 'addClaudeConfig');
    const messages = [];
    let saveCount = 0;
    let closed = false;
    const applied = [];
    const i18nMethods = createI18nMethods();
    const context = {
        ...i18nMethods,
        lang: 'zh',
        newClaudeConfig: {
            name: 'Claude Test',
            apiKey: 'sk-test',
            baseUrl: 'https://api.example.com/anthropic',
            model: ' claude-test-model '
        },
        claudeConfigs: {},
        currentClaudeConfig: '',
        showMessage(text, type) { messages.push({ text, type }); },
        findDuplicateClaudeConfigName: () => '',
        mergeClaudeConfig: (_, cfg) => ({ ...cfg }),
        saveClaudeConfigs() { saveCount += 1; },
        closeClaudeConfigModal() { closed = true; },
        async applyClaudeConfig(name) { applied.push(name); }
    };

    await addClaudeConfig.call(context);

    assert.strictEqual(context.currentClaudeConfig, 'Claude Test');
    assert.strictEqual(context.claudeConfigs['Claude Test'].model, 'claude-test-model');
    assert.strictEqual(saveCount, 1);
    assert.strictEqual(closed, true);
    assert.deepStrictEqual(applied, ['Claude Test']);
    assert.deepStrictEqual(messages, []);
});

test('ensureClaudeConfigFromSettings creates imported config for unmatched Claude settings', () => {
    const source = extractMethodAsFunction(appSource, 'ensureClaudeConfigFromSettings');
    const ensureClaudeConfigFromSettings = instantiateFunction(source, 'ensureClaudeConfigFromSettings');

    let saveCount = 0;
    const context = {
        claudeConfigs: {
            '智谱GLM': {
                apiKey: '',
                baseUrl: 'https://open.bigmodel.cn/api/anthropic',
                model: 'glm-4.7',
                hasKey: false
            }
        },
        normalizeClaudeSettingsEnv: (env = {}) => ({
            apiKey: typeof env.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : '',
            baseUrl: typeof env.ANTHROPIC_BASE_URL === 'string' ? env.ANTHROPIC_BASE_URL.trim() : '',
            model: typeof env.ANTHROPIC_MODEL === 'string' ? env.ANTHROPIC_MODEL.trim() || 'glm-4.7' : 'glm-4.7',
            authToken: typeof env.ANTHROPIC_AUTH_TOKEN === 'string' ? env.ANTHROPIC_AUTH_TOKEN.trim() : '',
            useKey: typeof env.CLAUDE_CODE_USE_KEY === 'string' ? env.CLAUDE_CODE_USE_KEY.trim() : '',
            externalCredentialType: typeof env.ANTHROPIC_API_KEY === 'string' && env.ANTHROPIC_API_KEY.trim()
                ? ''
                : ((typeof env.ANTHROPIC_AUTH_TOKEN === 'string' && env.ANTHROPIC_AUTH_TOKEN.trim())
                    ? 'auth-token'
                    : ((typeof env.CLAUDE_CODE_USE_KEY === 'string' && env.CLAUDE_CODE_USE_KEY.trim()) ? 'claude-code-use-key' : ''))
        }),
        findDuplicateClaudeConfigName: () => '',
        buildClaudeImportedConfigName: () => '导入-maxx-direct.cloverstd.com',
        saveClaudeConfigs: () => {
            saveCount += 1;
        },
        mergeClaudeConfig: (_, normalized) => ({
            apiKey: normalized.apiKey,
            baseUrl: normalized.baseUrl,
            model: normalized.model || 'glm-4.7',
            hasKey: !!(normalized.apiKey || normalized.authToken || normalized.useKey),
            externalCredentialType: normalized.externalCredentialType || ''
        })
    };

    const result = ensureClaudeConfigFromSettings.call(context, {
        ANTHROPIC_API_KEY: 'maxx-key',
        ANTHROPIC_BASE_URL: 'https://maxx-direct.cloverstd.com/project/ym/111',
        ANTHROPIC_MODEL: 'claude-opus-4-6'
    });

    assert.strictEqual(result, '导入-maxx-direct.cloverstd.com');
    assert.strictEqual(saveCount, 1);
    assert.deepStrictEqual(context.claudeConfigs[result], {
        apiKey: 'maxx-key',
        baseUrl: 'https://maxx-direct.cloverstd.com/project/ym/111',
        model: 'claude-opus-4-6',
        hasKey: true,
        externalCredentialType: ''
    });
});

test('refreshClaudeSelectionFromSettings selects imported config when settings mismatch existing list', async () => {
    const source = extractMethodAsFunction(appSource, 'refreshClaudeSelectionFromSettings');
    const refreshClaudeSelectionFromSettings = instantiateFunction(source, 'refreshClaudeSelectionFromSettings', {
        api: async () => ({
            exists: true,
            env: {
                ANTHROPIC_API_KEY: 'maxx-key',
                ANTHROPIC_BASE_URL: 'https://maxx-direct.cloverstd.com/project/ym/111',
                ANTHROPIC_MODEL: 'claude-opus-4-6'
            }
        })
    });

    let refreshCount = 0;
    const messages = [];
    const context = {
        claudeConfigs: {
            '智谱GLM': {
                apiKey: '',
                baseUrl: 'https://open.bigmodel.cn/api/anthropic',
                model: 'glm-4.7',
                hasKey: false
            }
        },
        currentClaudeConfig: '',
        currentClaudeModel: '',
        matchClaudeConfigFromSettings: () => '',
        matchBuiltinClaudeProxyConfigFromSettings: () => '',
        shouldSuppressClaudeSettingsImport: () => false,
        ensureClaudeConfigFromSettings: function () {
            this.claudeConfigs['导入-maxx-direct.cloverstd.com'] = {
                apiKey: 'maxx-key',
                baseUrl: 'https://maxx-direct.cloverstd.com/project/ym/111',
                model: 'claude-opus-4-6',
                hasKey: true
            };
            return '导入-maxx-direct.cloverstd.com';
        },
        refreshClaudeModelContext: () => {
            refreshCount += 1;
        },
        resetClaudeModelsState: () => {
            throw new Error('should not reset when import succeeds');
        },
        showMessage: (msg, type) => messages.push({ msg, type })
    };

    await refreshClaudeSelectionFromSettings.call(context, { silent: true });
    assert.strictEqual(context.currentClaudeConfig, '导入-maxx-direct.cloverstd.com');
    assert.strictEqual(refreshCount, 1);
    assert.deepStrictEqual(messages, []);
});

test('refreshClaudeSelectionFromSettings keeps builtin Claude proxy selection without importing duplicate config', async () => {
    const source = extractMethodAsFunction(appSource, 'refreshClaudeSelectionFromSettings');
    const proxyEnv = {
        ANTHROPIC_API_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef',
        ANTHROPIC_BASE_URL: 'http://127.0.0.1:34567',
        ANTHROPIC_MODEL: 'deepseek-r1:8b'
    };
    const refreshClaudeSelectionFromSettings = instantiateFunction(source, 'refreshClaudeSelectionFromSettings', {
        api: async () => ({ exists: true, env: proxyEnv })
    });

    let refreshCount = 0;
    let ensureCount = 0;
    let saveCount = 0;
    const messages = [];
    const context = {
        claudeConfigs: {
            'Local Ollama': {
                apiKey: '',
                baseUrl: 'http://127.0.0.1:11434',
                model: 'deepseek-r1:8b',
                hasKey: false,
                externalCredentialType: '',
                targetApi: 'ollama'
            }
        },
        currentClaudeConfig: 'Local Ollama',
        currentClaudeModel: '',
        matchClaudeConfigFromSettings(env) {
            return '';
        },
        matchBuiltinClaudeProxyConfigFromSettings(env) {
            return matchBuiltinClaudeProxyConfigFromSettings(this.claudeConfigs, env, this.currentClaudeConfig);
        },
        shouldSuppressClaudeSettingsImport(env) {
            return isLikelyBuiltinClaudeProxySettingsEnv(env);
        },
        ensureClaudeConfigFromSettings() {
            ensureCount += 1;
            throw new Error('builtin proxy settings must not be imported as external config');
        },
        saveClaudeConfigs() {
            saveCount += 1;
        },
        refreshClaudeModelContext: () => {
            refreshCount += 1;
        },
        resetClaudeModelsState: () => {
            throw new Error('should not reset when builtin proxy selection matches current config');
        },
        showMessage: (msg, type) => messages.push({ msg, type })
    };

    await refreshClaudeSelectionFromSettings.call(context, { silent: true });

    assert.strictEqual(context.currentClaudeConfig, 'Local Ollama');
    assert.deepStrictEqual(Object.keys(context.claudeConfigs), ['Local Ollama']);
    assert.strictEqual(ensureCount, 0);
    assert.strictEqual(saveCount, 0);
    assert.strictEqual(refreshCount, 1);
    assert.deepStrictEqual(messages, []);
});

test('builtin Claude proxy settings detection requires loopback URL and generated proxy token shape', () => {
    assert.strictEqual(isLikelyBuiltinClaudeProxySettingsEnv({
        ANTHROPIC_API_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef',
        ANTHROPIC_BASE_URL: 'http://localhost:34567',
        ANTHROPIC_MODEL: 'deepseek-r1:8b'
    }), true);
    assert.strictEqual(isLikelyBuiltinClaudeProxySettingsEnv({
        ANTHROPIC_API_KEY: 'sk-real-provider-key',
        ANTHROPIC_BASE_URL: 'https://api.example.com/anthropic',
        ANTHROPIC_MODEL: 'claude-opus-4-6'
    }), false);
    assert.strictEqual(isLikelyBuiltinClaudeProxySettingsEnv({
        ANTHROPIC_API_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef',
        ANTHROPIC_BASE_URL: 'https://api.example.com/anthropic',
        ANTHROPIC_MODEL: 'claude-opus-4-6'
    }), false);
});

test('ensureClaudeConfigFromSettings imports external auth-token backed Claude settings', () => {
    const source = extractMethodAsFunction(appSource, 'ensureClaudeConfigFromSettings');
    const ensureClaudeConfigFromSettings = instantiateFunction(source, 'ensureClaudeConfigFromSettings');

    let saveCount = 0;
    const context = {
        claudeConfigs: {},
        normalizeClaudeSettingsEnv: (env = {}) => ({
            apiKey: typeof env.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY.trim() : '',
            baseUrl: typeof env.ANTHROPIC_BASE_URL === 'string' ? env.ANTHROPIC_BASE_URL.trim() : '',
            model: typeof env.ANTHROPIC_MODEL === 'string' ? env.ANTHROPIC_MODEL.trim() || 'glm-4.7' : 'glm-4.7',
            authToken: typeof env.ANTHROPIC_AUTH_TOKEN === 'string' ? env.ANTHROPIC_AUTH_TOKEN.trim() : '',
            useKey: typeof env.CLAUDE_CODE_USE_KEY === 'string' ? env.CLAUDE_CODE_USE_KEY.trim() : '',
            externalCredentialType: (typeof env.ANTHROPIC_AUTH_TOKEN === 'string' && env.ANTHROPIC_AUTH_TOKEN.trim())
                ? 'auth-token'
                : ((typeof env.CLAUDE_CODE_USE_KEY === 'string' && env.CLAUDE_CODE_USE_KEY.trim()) ? 'claude-code-use-key' : '')
        }),
        findDuplicateClaudeConfigName: () => '',
        buildClaudeImportedConfigName: () => '导入-api.anthropic.com',
        saveClaudeConfigs: () => {
            saveCount += 1;
        },
        mergeClaudeConfig: (_, normalized) => ({
            apiKey: normalized.apiKey,
            baseUrl: normalized.baseUrl,
            model: normalized.model || 'glm-4.7',
            hasKey: !!(normalized.apiKey || normalized.authToken || normalized.useKey),
            externalCredentialType: normalized.externalCredentialType || ''
        })
    };

    const result = ensureClaudeConfigFromSettings.call(context, {
        ANTHROPIC_AUTH_TOKEN: 'anth-token',
        ANTHROPIC_BASE_URL: 'https://api.anthropic.com',
        ANTHROPIC_MODEL: 'claude-3-7-sonnet'
    });

    assert.strictEqual(result, '导入-api.anthropic.com');
    assert.strictEqual(saveCount, 1);
    assert.deepStrictEqual(context.claudeConfigs[result], {
        apiKey: '',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-3-7-sonnet',
        hasKey: true,
        externalCredentialType: 'auth-token'
    });
});


test('saveAndApplyConfig writes the edited Claude model through apply api', async () => {
    const source = extractClaudeMethodAsFunction(appSource, 'saveAndApplyConfig');
    const applyCalls = [];
    const saveAndApplyConfig = instantiateFunction(source, 'saveAndApplyConfig', {
        api: async (action, params) => {
            applyCalls.push({ action, params });
            return { success: true };
        }
    });

    const messages = [];
    let saveCount = 0;
    let closed = false;
    let refreshCount = 0;
    const i18nMethods = createI18nMethods();
    const context = {
        ...i18nMethods,
        lang: 'zh',
        editingConfig: {
            name: 'UI Claude Use',
            apiKey: 'sk-test',
            baseUrl: 'https://api.example.com/anthropic',
            model: ' claude-model-from-edit '
        },
        claudeConfigs: {
            'UI Claude Use': {
                apiKey: 'old-key',
                baseUrl: 'https://old.example.com/anthropic',
                model: 'old-model'
            }
        },
        currentClaudeConfig: 'UI Claude Use',
        _lastAppliedClaudeKey: '',
        mergeClaudeConfig(existing, updates) {
            return { ...existing, ...updates };
        },
        saveClaudeConfigs() { saveCount += 1; },
        closeEditConfigModal() { closed = true; },
        refreshClaudeModelContext() { refreshCount += 1; },
        showMessage(msg, type) { messages.push({ msg, type }); }
    };

    await saveAndApplyConfig.call(context);

    assert.strictEqual(context.claudeConfigs['UI Claude Use'].model, 'claude-model-from-edit');
    assert.strictEqual(saveCount, 1);
    assert.strictEqual(closed, true);
    assert.strictEqual(refreshCount, 1);
    assert.deepStrictEqual(applyCalls, [{
        action: 'apply-claude-config',
        params: {
            config: {
                apiKey: 'sk-test',
                externalCredentialType: '',
                baseUrl: 'https://api.example.com/anthropic',
                model: 'claude-model-from-edit',
                targetApi: 'responses',
                name: 'UI Claude Use'
            }
        }
    }]);
    assert.deepStrictEqual(messages, [{ msg: 'Claude 配置已生效', type: 'success' }]);
});

test('saveAndApplyConfig saves external credential config without api key', async () => {
    const source = extractClaudeMethodAsFunction(appSource, 'saveAndApplyConfig');
    const applyCalls = [];
    const saveAndApplyConfig = instantiateFunction(source, 'saveAndApplyConfig', {
        api: async (action, params) => {
            applyCalls.push({ action, params });
            return { success: true };
        }
    });

    const messages = [];
    let saveCount = 0;
    let closed = false;
    let refreshCount = 0;
    const i18nMethods = createI18nMethods();
    const context = {
        ...i18nMethods,
        lang: 'zh',
        editingConfig: {
            name: 'Imported Auth Token',
            apiKey: '',
            externalCredentialType: 'auth-token',
            baseUrl: 'https://api.anthropic.com',
            model: 'claude-opus-4-6'
        },
        claudeConfigs: {
            'Imported Auth Token': {
                apiKey: '',
                externalCredentialType: 'auth-token',
                baseUrl: 'https://api.anthropic.com',
                model: 'claude-3-7-sonnet'
            }
        },
        currentClaudeConfig: 'Imported Auth Token',
        mergeClaudeConfig(existing, updates) {
            return { ...existing, ...updates };
        },
        saveClaudeConfigs() { saveCount += 1; },
        closeEditConfigModal() { closed = true; },
        refreshClaudeModelContext() { refreshCount += 1; },
        showMessage(msg, type) { messages.push({ msg, type }); }
    };

    await saveAndApplyConfig.call(context);

    assert.strictEqual(context.claudeConfigs['Imported Auth Token'].model, 'claude-opus-4-6');
    assert.strictEqual(context.claudeConfigs['Imported Auth Token'].externalCredentialType, 'auth-token');
    assert.strictEqual(saveCount, 1);
    assert.strictEqual(closed, true);
    assert.strictEqual(refreshCount, 1);
    assert.deepStrictEqual(applyCalls, []);
    assert.deepStrictEqual(messages, [{ msg: '已保存（未填写 API Key）', type: 'info' }]);
});

test('saveAndApplyConfig applies ollama config without api key through proxy', async () => {
    const source = extractClaudeMethodAsFunction(appSource, 'saveAndApplyConfig');
    const applyCalls = [];
    const saveAndApplyConfig = instantiateFunction(source, 'saveAndApplyConfig', {
        api: async (action, params) => {
            applyCalls.push({ action, params });
            return { success: true, mode: 'claude-proxy', targetApi: 'ollama' };
        }
    });

    const messages = [];
    let saveCount = 0;
    let closed = false;
    let refreshCount = 0;
    const i18nMethods = createI18nMethods();
    const context = {
        ...i18nMethods,
        lang: 'zh',
        editingConfig: {
            name: 'Local Ollama',
            apiKey: '',
            externalCredentialType: '',
            baseUrl: 'http://127.0.0.1:11434/',
            model: 'deepseek-v4-pro:cloud',
            targetApi: 'ollama'
        },
        claudeConfigs: {
            'Local Ollama': {
                apiKey: '',
                baseUrl: 'https://old.example.com/anthropic',
                model: 'old-model',
                targetApi: 'responses'
            }
        },
        currentClaudeConfig: 'Local Ollama',
        _lastAppliedClaudeKey: '',
        mergeClaudeConfig(existing, updates) {
            return { ...existing, ...updates };
        },
        saveClaudeConfigs() { saveCount += 1; },
        closeEditConfigModal() { closed = true; },
        refreshClaudeModelContext() { refreshCount += 1; },
        showMessage(msg, type) { messages.push({ msg, type }); }
    };

    await saveAndApplyConfig.call(context);

    assert.strictEqual(context.claudeConfigs['Local Ollama'].baseUrl, 'http://127.0.0.1:11434');
    assert.strictEqual(context.claudeConfigs['Local Ollama'].targetApi, 'ollama');
    assert.strictEqual(saveCount, 1);
    assert.strictEqual(closed, true);
    assert.strictEqual(refreshCount, 1);
    assert.deepStrictEqual(applyCalls, [{
        action: 'apply-claude-config',
        params: {
            config: {
                apiKey: '',
                externalCredentialType: '',
                baseUrl: 'http://127.0.0.1:11434',
                model: 'deepseek-v4-pro:cloud',
                targetApi: 'ollama',
                name: 'Local Ollama'
            }
        }
    }]);
    assert.deepStrictEqual(messages, [{ msg: 'Claude 配置已生效', type: 'success' }]);
});

test('applyClaudeConfig reports informative message for external credential only config', async () => {
    const source = extractMethodAsFunction(appSource, 'applyClaudeConfig');
    const applyClaudeConfig = instantiateFunction(source, 'applyClaudeConfig', {
        api: async () => {
            throw new Error('should not call apply api without apiKey');
        }
    });

    const messages = [];
    let refreshCount = 0;
    const i18nMethods = createI18nMethods();
    const context = {
        ...i18nMethods,
        lang: 'zh',
        claudeConfigs: {
            imported: {
                apiKey: '',
                baseUrl: 'https://api.anthropic.com',
                model: 'claude-3-7-sonnet',
                hasKey: true,
                externalCredentialType: 'auth-token'
            }
        },
        currentClaudeConfig: '',
        refreshClaudeModelContext: () => {
            refreshCount += 1;
        },
        showMessage: (msg, type) => {
            messages.push({ msg, type });
            return { msg, type };
        }
    };

    const result = await applyClaudeConfig.call(context, 'imported');
    assert.strictEqual(context.currentClaudeConfig, 'imported');
    assert.strictEqual(refreshCount, 1);
    assert.deepStrictEqual(messages, [{ msg: '使用外部认证，无需 API Key', type: 'info' }]);
    assert.deepStrictEqual(result, messages[0]);
});

test('applyClaudeConfig applies ollama config without api key', async () => {
    const source = extractMethodAsFunction(appSource, 'applyClaudeConfig');
    const applyCalls = [];
    const applyClaudeConfig = instantiateFunction(source, 'applyClaudeConfig', {
        api: async (action, params) => {
            applyCalls.push({ action, params });
            return { success: true, mode: 'claude-proxy', targetApi: 'ollama' };
        }
    });

    const messages = [];
    let refreshCount = 0;
    const i18nMethods = createI18nMethods();
    const context = {
        ...i18nMethods,
        lang: 'zh',
        claudeConfigs: {
            ollama: {
                apiKey: '',
                baseUrl: 'http://127.0.0.1:11434',
                model: 'deepseek-v4-pro:cloud',
                targetApi: 'ollama'
            }
        },
        currentClaudeConfig: '',
        _lastAppliedClaudeKey: '',
        refreshClaudeModelContext: () => {
            refreshCount += 1;
        },
        showMessage: (msg, type) => {
            messages.push({ msg, type });
            return { msg, type };
        }
    };

    await applyClaudeConfig.call(context, 'ollama');

    assert.strictEqual(context.currentClaudeConfig, 'ollama');
    assert.strictEqual(refreshCount, 1);
    assert.deepStrictEqual(applyCalls, [{
        action: 'apply-claude-config',
        params: {
            config: {
                apiKey: '',
                baseUrl: 'http://127.0.0.1:11434',
                model: 'deepseek-v4-pro:cloud',
                targetApi: 'ollama',
                name: 'ollama'
            }
        }
    }]);
    assert.deepStrictEqual(messages, [{ msg: '配置已应用', type: 'success' }]);
});

test('onClaudeModelChange applies external credential config without api key', () => {
    const source = extractMethodAsFunction(appSource, 'onClaudeModelChange');
    const onClaudeModelChange = instantiateFunction(source, 'onClaudeModelChange');

    let saveCount = 0;
    let updateCount = 0;
    const applyCalls = [];
    const messages = [];
    const i18nMethods = createI18nMethods();
    const context = {
        ...i18nMethods,
        lang: 'zh',
        currentClaudeConfig: 'imported',
        currentClaudeModel: ' claude-opus-4-6 ',
        claudeConfigs: {
            imported: {
                apiKey: '',
                baseUrl: 'https://api.anthropic.com',
                model: 'claude-3-7-sonnet',
                externalCredentialType: 'auth-token'
            }
        },
        mergeClaudeConfig(existing, updates) {
            return { ...existing, ...updates };
        },
        saveClaudeConfigs() {
            saveCount += 1;
        },
        updateClaudeModelsCurrent() {
            updateCount += 1;
        },
        applyClaudeConfig(name) {
            applyCalls.push(name);
        },
        showMessage(msg, type) {
            messages.push({ msg, type });
        }
    };

    onClaudeModelChange.call(context);

    assert.strictEqual(saveCount, 1);
    assert.strictEqual(updateCount, 1);
    assert.deepStrictEqual(applyCalls, ['imported']);
    assert.deepStrictEqual(messages, []);
    assert.strictEqual(context.currentClaudeModel, 'claude-opus-4-6');
    assert.strictEqual(context.claudeConfigs.imported.model, 'claude-opus-4-6');
});

test('onClaudeModelChange still requires api key when no external credential is present', () => {
    const source = extractMethodAsFunction(appSource, 'onClaudeModelChange');
    const onClaudeModelChange = instantiateFunction(source, 'onClaudeModelChange');

    let saveCount = 0;
    let updateCount = 0;
    const applyCalls = [];
    const messages = [];
    const i18nMethods = createI18nMethods();
    const context = {
        ...i18nMethods,
        lang: 'zh',
        currentClaudeConfig: 'local',
        currentClaudeModel: ' claude-opus-4-6 ',
        claudeConfigs: {
            local: {
                apiKey: '',
                baseUrl: 'https://api.anthropic.com',
                model: 'claude-3-7-sonnet',
                externalCredentialType: ''
            }
        },
        mergeClaudeConfig(existing, updates) {
            return { ...existing, ...updates };
        },
        saveClaudeConfigs() {
            saveCount += 1;
        },
        updateClaudeModelsCurrent() {
            updateCount += 1;
        },
        applyClaudeConfig(name) {
            applyCalls.push(name);
        },
        showMessage(msg, type) {
            messages.push({ msg, type });
        }
    };

    onClaudeModelChange.call(context);

    assert.strictEqual(saveCount, 1);
    assert.strictEqual(updateCount, 1);
    assert.deepStrictEqual(applyCalls, []);
    assert.deepStrictEqual(messages, [{ msg: '请先配置 API Key', type: 'error' }]);
    assert.strictEqual(context.currentClaudeModel, 'claude-opus-4-6');
    assert.strictEqual(context.claudeConfigs.local.model, 'claude-opus-4-6');
});

test('mergeClaudeConfig preserves externalCredentialType across edits without api key', () => {
    const source = extractMethodAsFunction(appSource, 'mergeClaudeConfig');
    const mergeClaudeConfig = instantiateFunction(source, 'mergeClaudeConfig');
    const context = {
        normalizeClaudeConfig: (config = {}) => ({
            apiKey: typeof config.apiKey === 'string' ? config.apiKey.trim() : '',
            baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl.trim() : '',
            model: typeof config.model === 'string' ? config.model.trim() : '',
            authToken: typeof config.authToken === 'string' ? config.authToken.trim() : '',
            useKey: typeof config.useKey === 'string' ? config.useKey.trim() : '',
            externalCredentialType: typeof config.externalCredentialType === 'string' ? config.externalCredentialType.trim() : '',
            targetApi: typeof config.targetApi === 'string' ? config.targetApi.trim() : 'responses'
        })
    };

    const merged = mergeClaudeConfig.call(context, {
        apiKey: '',
        baseUrl: 'https://api.anthropic.com',
        model: 'claude-3-7-sonnet',
        hasKey: true,
        externalCredentialType: 'auth-token'
    }, {
        baseUrl: 'https://api.anthropic.com/',
        model: ''
    });

    assert.deepStrictEqual(merged, {
        apiKey: '',
        baseUrl: 'https://api.anthropic.com/',
        model: 'claude-3-7-sonnet',
        hasKey: true,
        externalCredentialType: 'auth-token',
        targetApi: 'responses'
    });
});

test('refreshClaudeSelectionFromSettings forwards silent model-error flag', async () => {
    const source = extractMethodAsFunction(appSource, 'refreshClaudeSelectionFromSettings');
    const refreshClaudeSelectionFromSettings = instantiateFunction(source, 'refreshClaudeSelectionFromSettings', {
        api: async () => ({
            exists: true,
            env: {
                ANTHROPIC_API_KEY: 'maxx-key',
                ANTHROPIC_BASE_URL: 'https://maxx-direct.cloverstd.com/project/ym/111',
                ANTHROPIC_MODEL: 'claude-opus-4-6'
            }
        })
    });

    const refreshOptions = [];
    const context = {
        claudeConfigs: {},
        currentClaudeConfig: '',
        currentClaudeModel: '',
        matchClaudeConfigFromSettings: () => '导入-maxx-direct.cloverstd.com',
        ensureClaudeConfigFromSettings: () => '',
        refreshClaudeModelContext: (options) => {
            refreshOptions.push(options || {});
        },
        resetClaudeModelsState: () => {
            throw new Error('should not reset when match exists');
        },
        showMessage: () => {
            throw new Error('silent mode should not emit toast');
        }
    };

    await refreshClaudeSelectionFromSettings.call(context, { silent: true });
    assert.deepStrictEqual(refreshOptions, [{ silentError: true }]);
});

test('loadModelsForProvider keeps error state but suppresses toast in silent mode', async () => {
    const source = extractMethodAsFunction(appSource, 'loadModelsForProvider');
    const loadModelsForProvider = instantiateFunction(source, 'loadModelsForProvider', {
        api: async () => ({ error: 'Request failed: 401' })
    });

    const messages = [];
    const context = {
        codexModelsLoading: false,
        models: ['old-model'],
        modelsSource: 'remote',
        modelsHasCurrent: false,
        currentModel: 'gpt-5.2-codex',
        showMessage: (msg, type) => messages.push({ msg, type })
    };

    await loadModelsForProvider.call(context, 'c', { silentError: true });
    assert.strictEqual(context.codexModelsLoading, false);
    assert.deepStrictEqual(context.models, []);
    assert.strictEqual(context.modelsSource, 'error');
    assert.strictEqual(context.modelsHasCurrent, true);
    assert.deepStrictEqual(messages, []);
});

test('loadModelsForProvider ignores stale responses after provider selection changes', async () => {
    let resolveApi = null;
    const source = extractMethodAsFunction(appSource, 'loadModelsForProvider');
    const loadModelsForProvider = instantiateFunction(source, 'loadModelsForProvider', {
        api: async () => await new Promise((resolve) => {
            resolveApi = resolve;
        })
    });

    const context = {
        currentProvider: 'alpha',
        codexModelsRequestSeq: 0,
        codexModelsLoading: false,
        models: ['old-model'],
        modelsSource: 'remote',
        modelsHasCurrent: true,
        currentModel: 'old-model',
        showMessage() {
            throw new Error('stale response should not emit toast');
        }
    };

    const pending = loadModelsForProvider.call(context, 'alpha');
    context.currentProvider = 'beta';
    resolveApi({ models: ['alpha-model'], source: 'remote' });
    await pending;

    assert.strictEqual(context.codexModelsLoading, false);
    assert.deepStrictEqual(context.models, ['old-model']);
    assert.strictEqual(context.modelsSource, 'remote');
    assert.strictEqual(context.modelsHasCurrent, true);
});

test('loadModelsForProvider ignores stale failures after provider selection changes', async () => {
    let rejectApi = null;
    const source = extractMethodAsFunction(appSource, 'loadModelsForProvider');
    const loadModelsForProvider = instantiateFunction(source, 'loadModelsForProvider', {
        api: async () => await new Promise((_, reject) => {
            rejectApi = reject;
        })
    });

    const context = {
        currentProvider: 'alpha',
        codexModelsRequestSeq: 0,
        codexModelsLoading: false,
        models: ['old-model'],
        modelsSource: 'remote',
        modelsHasCurrent: true,
        currentModel: 'old-model',
        showMessage() {
            throw new Error('stale failure should not emit toast');
        }
    };

    const pending = loadModelsForProvider.call(context, 'alpha');
    context.currentProvider = 'beta';
    rejectApi(new Error('network failed'));
    await pending;

    assert.strictEqual(context.codexModelsLoading, false);
    assert.deepStrictEqual(context.models, ['old-model']);
    assert.strictEqual(context.modelsSource, 'remote');
    assert.strictEqual(context.modelsHasCurrent, true);
});

test('loadClaudeModels keeps error state but suppresses toast in silent mode', async () => {
    const source = extractMethodAsFunction(appSource, 'loadClaudeModels');
    const loadClaudeModels = instantiateFunction(source, 'loadClaudeModels', {
        api: async () => ({ error: 'Request failed: 401' }),
        getClaudeModelCatalogForBaseUrl: () => []
    });

    const messages = [];
    const context = {
        claudeModelsLoading: false,
        claudeModels: ['old-model'],
        claudeModelsSource: 'remote',
        claudeModelsHasCurrent: false,
        getCurrentClaudeConfig: () => ({
            baseUrl: 'https://maxx-direct.cloverstd.com/project/ym/',
            apiKey: 'maxx-key',
            model: 'gpt-5.2-codex'
        }),
        resetClaudeModelsState: () => {
            throw new Error('should not reset when config exists');
        },
        updateClaudeModelsCurrent: () => {
            throw new Error('should not update current on error branch');
        },
        showMessage: (msg, type) => messages.push({ msg, type })
    };

    await loadClaudeModels.call(context, { silentError: true });
    assert.strictEqual(context.claudeModelsLoading, false);
    assert.deepStrictEqual(context.claudeModels, []);
    assert.strictEqual(context.claudeModelsSource, 'error');
    assert.strictEqual(context.claudeModelsHasCurrent, true);
    assert.deepStrictEqual(messages, []);
});

test('loadClaudeModels ignores stale responses after Claude config selection changes', async () => {
    let resolveApi = null;
    const source = extractMethodAsFunction(appSource, 'loadClaudeModels');
    const loadClaudeModels = instantiateFunction(source, 'loadClaudeModels', {
        api: async () => await new Promise((resolve) => {
            resolveApi = resolve;
        }),
        getClaudeModelCatalogForBaseUrl: () => []
    });

    const configs = {
        alpha: {
            baseUrl: 'https://alpha.example.com',
            apiKey: 'alpha-key',
            model: 'alpha-model'
        },
        beta: {
            baseUrl: 'https://beta.example.com',
            apiKey: 'beta-key',
            model: 'beta-model'
        }
    };
    const context = {
        currentClaudeConfig: 'alpha',
        claudeModelsRequestSeq: 0,
        claudeModelsLoading: false,
        claudeModels: ['old-model'],
        claudeModelsSource: 'remote',
        claudeModelsHasCurrent: true,
        getCurrentClaudeConfig() {
            return configs[this.currentClaudeConfig] || null;
        },
        resetClaudeModelsState() {
            throw new Error('config exists during stale response test');
        },
        updateClaudeModelsCurrent() {
            throw new Error('stale response should not update current state');
        },
        showMessage() {
            throw new Error('stale response should not emit toast');
        }
    };

    const pending = loadClaudeModels.call(context);
    context.currentClaudeConfig = 'beta';
    resolveApi({ models: ['alpha-remote'], source: 'remote' });
    await pending;

    assert.strictEqual(context.claudeModelsLoading, false);
    assert.deepStrictEqual(context.claudeModels, ['old-model']);
    assert.strictEqual(context.claudeModelsSource, 'remote');
    assert.strictEqual(context.claudeModelsHasCurrent, true);
});

test('loadClaudeModels ignores stale failures after Claude config selection changes', async () => {
    let rejectApi = null;
    const source = extractMethodAsFunction(appSource, 'loadClaudeModels');
    const loadClaudeModels = instantiateFunction(source, 'loadClaudeModels', {
        api: async () => await new Promise((_, reject) => {
            rejectApi = reject;
        }),
        getClaudeModelCatalogForBaseUrl: () => []
    });

    const configs = {
        alpha: {
            baseUrl: 'https://alpha.example.com',
            apiKey: 'alpha-key',
            model: 'alpha-model'
        },
        beta: {
            baseUrl: 'https://beta.example.com',
            apiKey: 'beta-key',
            model: 'beta-model'
        }
    };
    const context = {
        currentClaudeConfig: 'alpha',
        claudeModelsRequestSeq: 0,
        claudeModelsLoading: false,
        claudeModels: ['old-model'],
        claudeModelsSource: 'remote',
        claudeModelsHasCurrent: true,
        getCurrentClaudeConfig() {
            return configs[this.currentClaudeConfig] || null;
        },
        resetClaudeModelsState() {
            throw new Error('config exists during stale failure test');
        },
        updateClaudeModelsCurrent() {
            throw new Error('stale failure should not update current state');
        },
        showMessage() {
            throw new Error('stale failure should not emit toast');
        }
    };

    const pending = loadClaudeModels.call(context);
    context.currentClaudeConfig = 'beta';
    rejectApi(new Error('network failed'));
    await pending;

    assert.strictEqual(context.claudeModelsLoading, false);
    assert.deepStrictEqual(context.claudeModels, ['old-model']);
    assert.strictEqual(context.claudeModelsSource, 'remote');
    assert.strictEqual(context.claudeModelsHasCurrent, true);
});

test('loadClaudeModels skips remote fetch for external-credential config without api key', async () => {
    const source = extractMethodAsFunction(appSource, 'loadClaudeModels');
    const loadClaudeModels = instantiateFunction(source, 'loadClaudeModels', {
        api: async () => {
            throw new Error('should not request models endpoint for external credential config');
        },
        getClaudeModelCatalogForBaseUrl: () => ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5']
    });

    const messages = [];
    const context = {
        claudeModelsLoading: true,
        claudeModels: ['old-model'],
        claudeModelsSource: 'remote',
        claudeModelsHasCurrent: false,
        getCurrentClaudeConfig: () => ({
            baseUrl: 'https://maxx-direct.cloverstd.com/project/ym/',
            apiKey: '',
            model: 'claude-opus-4-6',
            externalCredentialType: 'auth-token'
        }),
        resetClaudeModelsState: () => {
            throw new Error('should not reset when config exists');
        },
        updateClaudeModelsCurrent() {
            this.claudeModelsHasCurrent = !!this.currentClaudeModel && this.claudeModels.includes(this.currentClaudeModel);
        },
        currentClaudeModel: 'claude-opus-4-6',
        showMessage: (msg, type) => messages.push({ msg, type })
    };

    await loadClaudeModels.call(context);
    assert.strictEqual(context.claudeModelsLoading, false);
    assert.deepStrictEqual(context.claudeModels, ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5']);
    assert.strictEqual(context.claudeModelsSource, 'catalog');
    assert.strictEqual(context.claudeModelsHasCurrent, true);
    assert.deepStrictEqual(messages, []);
});

test('applyToClaudeSettings does not proxy chat completions through default Anthropic URL', () => {
    const startIndex = cliSource.indexOf('async function applyToClaudeSettings');
    assert.notStrictEqual(startIndex, -1);
    const endIndex = cliSource.indexOf('async function cmdClaude', startIndex);
    assert.notStrictEqual(endIndex, -1);
    const source = cliSource.slice(startIndex, endIndex);
    assert.match(source, /const configuredBaseUrl = typeof config\.baseUrl === 'string' \? config\.baseUrl\.trim\(\) : '';/);
    assert.match(source, /targetApi === 'chat_completions' && !configuredBaseUrl && !upstreamProviderName/);
    assert.match(source, /chat_completions 模式需要显式的上游 Base URL 或可解析的 provider 名称/);
    assert.match(source, /\.\.\.\(configuredBaseUrl \? \{ upstreamBaseUrl: configuredBaseUrl \} : \{\}\)/);
});

test('MCP Claude config schema allows Ollama without API key only for ollama target', () => {
    const toolIndex = cliSource.indexOf("name: 'codexmate.claude.config.apply'");
    assert.notStrictEqual(toolIndex, -1);
    const schemaEnd = cliSource.indexOf('handler: async (args = {}) => applyToClaudeSettings(args || {})', toolIndex);
    assert.notStrictEqual(schemaEnd, -1);
    const schemaSource = cliSource.slice(toolIndex, schemaEnd);
    assert.match(schemaSource, /allOf:\s*\[\{/);
    assert.match(schemaSource, /properties:\s*\{ targetApi:\s*\{ type: 'string', pattern: '\^\[\\\\s\]\*\[oO\]\[lL\]\[lL\]\[aA\]\[mM\]\[aA\]\[\\\\s\]\*\$' \} \}/);
    assert.match(schemaSource, /then:\s*\{ required:\s*\['apiKey'\] \}/);
    assert.doesNotMatch(schemaSource, /required:\s*\['apiKey'\],\s*additionalProperties/);
});

test('buildClaudeSettingsDiff uses JSON.parse instead of TOML for Claude settings', () => {
    const fnMatch = cliSource.match(/function buildClaudeSettingsDiff\([\s\S]*?\n\}/);
    assert(fnMatch, 'buildClaudeSettingsDiff function should exist in cli.js');
    const fnBody = fnMatch[0];
    assert.match(fnBody, /JSON\.parse\(content\)/);
    assert.doesNotMatch(fnBody, /toml\.parse/);
    assert.match(fnBody, /CLAUDE_SETTINGS_FILE/);
    assert.match(fnBody, /buildLineDiff/);
});

test('buildClaudeSettingsDiff is wired up as preview-claude-settings-diff route', () => {
    const routeIndex = cliSource.indexOf("'preview-claude-settings-diff'");
    assert.notStrictEqual(routeIndex, -1, 'route should be registered');
    const routeSnippet = cliSource.slice(routeIndex, routeIndex + 120);
    assert.match(routeSnippet, /buildClaudeSettingsDiff/);
});

test('prepareConfigTemplateDiff calls preview-claude-settings-diff for Claude context', async () => {
    const capturedCalls = [];
    const methods = createCodexConfigMethods({
        api: async (action, params) => {
            capturedCalls.push({ action, params });
            return {
                diff: {
                    lines: [{ type: 'add', value: '{"env": {}}' }],
                    stats: { added: 1, removed: 0, unchanged: 0 },
                    hasChanges: true
                }
            };
        },
        getProviderConfigModeMeta() { return null; }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        configTemplateContext: 'claude',
        configTemplateContent: '{"env":{"ANTHROPIC_MODEL":"test"}}',
        configTemplateDiffVisible: false,
        configTemplateDiffLoading: false,
        configTemplateDiffError: '',
        configTemplateDiffLines: [],
        configTemplateDiffStats: { added: 0, removed: 0, unchanged: 0 },
        configTemplateDiffHasChangesValue: false,
        configTemplateDiffFingerprint: ''
    };

    await methods.prepareConfigTemplateDiff.call(context);

    assert.strictEqual(capturedCalls.length, 1);
    assert.strictEqual(capturedCalls[0].action, 'preview-claude-settings-diff');
    assert.strictEqual(capturedCalls[0].params.content, '{"env":{"ANTHROPIC_MODEL":"test"}}');
    assert.strictEqual(context.configTemplateDiffLines.length, 1);
    assert.strictEqual(context.configTemplateDiffHasChangesValue, true);
});

test('prepareConfigTemplateDiff calls preview-config-template-diff for codex context', async () => {
    const capturedCalls = [];
    const methods = createCodexConfigMethods({
        api: async (action, params) => {
            capturedCalls.push({ action, params });
            return {
                diff: {
                    lines: [{ type: 'context', value: 'model = "test"' }],
                    stats: { added: 0, removed: 0, unchanged: 1 },
                    hasChanges: false
                }
            };
        },
        getProviderConfigModeMeta() { return null; }
    });
    const context = {
        ...createI18nMethods(),
        ...methods,
        lang: 'zh',
        configTemplateContext: 'codex',
        configTemplateContent: 'model = "test"',
        configTemplateDiffVisible: false,
        configTemplateDiffLoading: false,
        configTemplateDiffError: '',
        configTemplateDiffLines: [],
        configTemplateDiffStats: { added: 0, removed: 0, unchanged: 0 },
        configTemplateDiffHasChangesValue: false,
        configTemplateDiffFingerprint: ''
    };

    await methods.prepareConfigTemplateDiff.call(context);

    assert.strictEqual(capturedCalls.length, 1);
    assert.strictEqual(capturedCalls[0].action, 'preview-config-template-diff');
    assert.strictEqual(capturedCalls[0].params.template, 'model = "test"');
});
