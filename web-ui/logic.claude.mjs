const DEFAULT_CLAUDE_MODEL_CATALOG = Object.freeze([
    'claude-opus-4-6',
    'claude-opus-4-1',
    'claude-opus-4',
    'claude-sonnet-4-6',
    'claude-sonnet-4-5',
    'claude-sonnet-4',
    'claude-haiku-4-5',
    'claude-3-7-sonnet',
    'claude-3-5-sonnet',
    'claude-3-5-haiku',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku'
]);

const BIGMODEL_CLAUDE_EXTRA_MODELS = Object.freeze([
    'glm-3-turbo',
    'glm-4',
    'glm-4-0520',
    'glm-4-plus',
    'glm-4-air',
    'glm-4-airx',
    'glm-4-flash',
    'glm-4-flashx',
    'glm-4v',
    'glm-4v-flash',
    'glm-4v-plus',
    'glm-4v-plus-0111',
    'glm-4.5',
    'glm-4.5-air',
    'glm-4.5v',
    'glm-4.6',
    'glm-4.6v',
    'glm-4.7',
    'glm-4.7-flash',
    'glm-4.7-flashx',
    'glm-5',
    'glm-5-turbo',
    'glm-5.1',
    'glm-5v',
    'glm-5v-turbo',
    'glm-z1',
    'glm-z1-air',
    'glm-coding'
]);

export function normalizeClaudeValue(value) {
    return typeof value === 'string' ? value.trim() : '';
}

export function getClaudeModelCatalogForBaseUrl(baseUrl) {
    const normalized = normalizeClaudeValue(baseUrl).toLowerCase().replace(/\/+$/g, '');
    const models = [...DEFAULT_CLAUDE_MODEL_CATALOG];
    if (normalized.includes('bigmodel.cn') && normalized.includes('/anthropic')) {
        for (const model of BIGMODEL_CLAUDE_EXTRA_MODELS) {
            if (!models.includes(model)) {
                models.push(model);
            }
        }
    }
    return models;
}

export function normalizeClaudeConfig(config) {
    const safe = config && typeof config === 'object' ? config : {};
    const apiKey = normalizeClaudeValue(safe.apiKey);
    const authToken = normalizeClaudeValue(safe.authToken);
    const useKey = normalizeClaudeValue(safe.useKey);
    const externalCredentialType = normalizeClaudeValue(safe.externalCredentialType)
        || (apiKey ? '' : (authToken ? 'auth-token' : (useKey ? 'claude-code-use-key' : '')));
    const targetApiRaw = normalizeClaudeValue(safe.targetApi).toLowerCase();
    let targetApi = 'responses';
    if (targetApiRaw === 'chat_completions' || targetApiRaw === 'chat-completions' || targetApiRaw === 'chat/completions') {
        targetApi = 'chat_completions';
    } else if (targetApiRaw === 'ollama') {
        targetApi = 'ollama';
    }
    return {
        apiKey,
        baseUrl: normalizeClaudeValue(safe.baseUrl),
        model: normalizeClaudeValue(safe.model),
        authToken,
        useKey,
        externalCredentialType,
        targetApi
    };
}

export function normalizeClaudeSettingsEnv(env) {
    const safe = env && typeof env === 'object' ? env : {};
    const apiKey = normalizeClaudeValue(safe.ANTHROPIC_API_KEY);
    const authToken = normalizeClaudeValue(safe.ANTHROPIC_AUTH_TOKEN);
    const useKey = normalizeClaudeValue(safe.CLAUDE_CODE_USE_KEY);
    return {
        apiKey,
        baseUrl: normalizeClaudeValue(safe.ANTHROPIC_BASE_URL),
        model: normalizeClaudeValue(safe.ANTHROPIC_MODEL) || 'glm-4.7',
        authToken,
        useKey,
        externalCredentialType: apiKey
            ? ''
            : (authToken ? 'auth-token' : (useKey ? 'claude-code-use-key' : ''))
    };
}

function normalizeClaudeComparableUrl(value) {
    const trimmed = normalizeClaudeValue(value);
    if (!trimmed) return '';
    return trimmed.replace(/\/+$/g, '');
}

function isLoopbackClaudeProxyUrl(value) {
    const raw = normalizeClaudeComparableUrl(value);
    if (!raw) return false;
    try {
        const parsed = new URL(raw);
        if (parsed.protocol !== 'http:') return false;
        const host = normalizeClaudeValue(parsed.hostname).toLowerCase();
        return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1';
    } catch (_) {
        return false;
    }
}

export function isLikelyBuiltinClaudeProxySettingsEnv(env = {}) {
    const normalized = normalizeClaudeSettingsEnv(env);
    return !!(
        normalized.baseUrl
        && normalized.model
        && /^[a-f0-9]{48}$/i.test(normalized.apiKey)
        && isLoopbackClaudeProxyUrl(normalized.baseUrl)
    );
}

function isClaudeTransformConfig(config = {}) {
    const targetApi = normalizeClaudeConfig(config).targetApi;
    return targetApi === 'chat_completions' || targetApi === 'ollama';
}

export function matchBuiltinClaudeProxyConfigFromSettings(claudeConfigs = {}, env = {}, preferredName = '') {
    if (!isLikelyBuiltinClaudeProxySettingsEnv(env)) {
        return '';
    }
    const normalizedSettings = normalizeClaudeSettingsEnv(env);
    const preferred = normalizeClaudeValue(preferredName);
    if (preferred && claudeConfigs && claudeConfigs[preferred]) {
        const config = normalizeClaudeConfig(claudeConfigs[preferred]);
        if (isClaudeTransformConfig(config) && config.model === normalizedSettings.model) {
            return preferred;
        }
    }

    const matches = [];
    for (const [name, config] of Object.entries(claudeConfigs || {})) {
        const normalizedConfig = normalizeClaudeConfig(config);
        if (!isClaudeTransformConfig(normalizedConfig)) {
            continue;
        }
        if (normalizedConfig.model === normalizedSettings.model) {
            matches.push(name);
        }
    }
    return matches.length === 1 ? matches[0] : '';
}

function hasClaudeCredential(config = {}) {
    return !!(config.apiKey || config.authToken || config.useKey);
}

export function matchClaudeConfigFromSettings(claudeConfigs = {}, env = {}) {
    const normalizedSettings = normalizeClaudeSettingsEnv(env);
    if (!normalizedSettings.baseUrl || !normalizedSettings.model || !hasClaudeCredential(normalizedSettings)) {
        return '';
    }
    // 检测本地桥接 URL
    if (typeof normalizedSettings.baseUrl === 'string' && normalizedSettings.baseUrl.includes('/bridge/claude-local/')) {
        return 'claude-local';
    }
    const comparableSettingsUrl = normalizeClaudeComparableUrl(normalizedSettings.baseUrl);
    const entries = Object.entries(claudeConfigs || {});
    for (const [name, config] of entries) {
        const normalizedConfig = normalizeClaudeConfig(config);
        if (!normalizedConfig.baseUrl || !normalizedConfig.model) {
            continue;
        }
        if (normalizeClaudeComparableUrl(normalizedConfig.baseUrl) !== comparableSettingsUrl
            || normalizedConfig.model !== normalizedSettings.model) {
            continue;
        }
        if (normalizedSettings.apiKey && normalizedConfig.apiKey === normalizedSettings.apiKey) {
            return name;
        }
        if (!normalizedSettings.apiKey
            && normalizedConfig.apiKey === ''
            && normalizedConfig.externalCredentialType
            && normalizedConfig.externalCredentialType === normalizedSettings.externalCredentialType) {
            return name;
        }
    }
    return '';
}

export function findDuplicateClaudeConfigName(claudeConfigs = {}, config) {
    const normalized = normalizeClaudeConfig(config);
    if (!normalized.baseUrl || !normalized.model) {
        return '';
    }
    const comparableUrl = normalizeClaudeComparableUrl(normalized.baseUrl);
    const isExternal = !normalized.apiKey && !!normalized.externalCredentialType;
    if (!normalized.apiKey && !isExternal) {
        return '';
    }
    const entries = Object.entries(claudeConfigs || {});
    for (const [name, existing] of entries) {
        const normalizedExisting = normalizeClaudeConfig(existing);
        if (!normalizedExisting.baseUrl || !normalizedExisting.model) {
            continue;
        }
        if (normalizeClaudeComparableUrl(normalizedExisting.baseUrl) !== comparableUrl
            || normalizedExisting.model !== normalized.model
            || normalizedExisting.targetApi !== normalized.targetApi) {
            continue;
        }
        if (normalized.apiKey && normalizedExisting.apiKey === normalized.apiKey) {
            return name;
        }
        if (isExternal
            && !normalizedExisting.apiKey
            && normalizedExisting.externalCredentialType === normalized.externalCredentialType) {
            return name;
        }
    }
    return '';
}
