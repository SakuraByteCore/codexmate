const fs = require('fs');
const path = require('path');
const os = require('os');
const toml = require('@iarna/toml');

const APP_NAME = "Codex Switcher Pro";
const PROVIDER_MODELS_FILE = 'models.json';
const PROVIDER_CURRENT_MODELS_FILE = 'provider-current-models.json';

// 默认模型列表
const DEFAULT_MODELS = [
    'gpt-5.1-codex-max'
];

const DEFAULT_CONFIG_CONTENT = `# Codex Configuration File
model_provider = "88code"
model = "gpt-5.1-codex-max"
disable_response_storage = true

[model_providers.88code]
name = "88code"
base_url = "https://www.88code.ai/openai/v1"
wire_api = "responses"
requires_openai_auth = false
preferred_auth_method = ""
request_max_retries = 4
`;

const PRESET_TEMPLATES = {
    "88code": {
        name: "88code",
        base_url: "https://www.88code.ai/openai/v1",
        wire_api: "responses",
        requires_openai_auth: false,
        request_max_retries: 4,
        stream_max_retries: 10,
        stream_idle_timeout_ms: 300000,
        preferred_auth_method: ""
    }
};

function resolvePaths() {
    const homeDir = os.homedir();
    const codexPath = path.join(homeDir, '.codex');
    const localPath = process.cwd();

    let targetDir = codexPath;

    if (fs.existsSync(path.join(localPath, 'config.toml'))) {
        targetDir = localPath;
    } else {
        if (!fs.existsSync(codexPath)) {
            try { fs.mkdirSync(codexPath, { recursive: true }); }
            catch (e) { targetDir = localPath; }
        }
    }

    const configPath = path.join(targetDir, 'config.toml');
    const authPath = path.join(targetDir, 'auth.json');
    const providerModelsPath = path.join(targetDir, PROVIDER_MODELS_FILE);
    const providerCurrentModelsPath = path.join(targetDir, PROVIDER_CURRENT_MODELS_FILE);

    if (!fs.existsSync(configPath)) {
        try { fs.writeFileSync(configPath, DEFAULT_CONFIG_CONTENT, 'utf-8'); } catch (e) {}
    }
    if (!fs.existsSync(authPath)) {
        try { fs.writeFileSync(authPath, '{}', 'utf-8'); } catch (e) {}
    }
    if (!fs.existsSync(providerModelsPath)) {
        try { fs.writeFileSync(providerModelsPath, JSON.stringify(DEFAULT_MODELS, null, 2), 'utf-8'); } catch (e) {}
    }
    if (!fs.existsSync(providerCurrentModelsPath)) {
        try { fs.writeFileSync(providerCurrentModelsPath, JSON.stringify({}, null, 2), 'utf-8'); } catch (e) {}
    }

    return { config: configPath, auth: authPath, providerModels: providerModelsPath, providerCurrentModels: providerCurrentModelsPath, baseDir: targetDir };
}

const PATHS = resolvePaths();

// Claude Code 配置存储在内存中
let claudeConfigsCache = {
    '智谱GLM': {
        apiKey: '',
        baseUrl: 'https://open.bigmodel.cn/api/anthropic',
        model: 'glm-4.7'
    }
};

function syncAuthWithConfig(paths) {
    try {
        if (!fs.existsSync(paths.config)) return;
        const configRaw = fs.readFileSync(paths.config, 'utf-8');
        const config = toml.parse(configRaw);

        const currentProviderName = config.model_provider;
        if (!currentProviderName || !config.model_providers || !config.model_providers[currentProviderName]) {
            return;
        }

        const targetKey = config.model_providers[currentProviderName].preferred_auth_method || "";

        let authData = {};
        let needRewrite = false;

        if (fs.existsSync(paths.auth)) {
            try {
                const authContent = fs.readFileSync(paths.auth, 'utf-8');
                if (authContent.trim()) {
                    authData = JSON.parse(authContent);
                } else {
                    needRewrite = true;
                }
            } catch (e) {
                authData = {};
                needRewrite = true;
            }
        } else {
            needRewrite = true;
        }

        if (authData["OPENAI_API_KEY"] !== targetKey) {
            authData["OPENAI_API_KEY"] = targetKey;
            needRewrite = true;
        }

        if (needRewrite) {
            fs.writeFileSync(paths.auth, JSON.stringify(authData, null, 2), 'utf-8');
            console.log(`[同步] 已强制同步 auth.json`);
        }
    } catch (e) {
        console.error('[同步失败]', e.message);
    }
}

function updateAuthJson(authPath, apiKey) {
    let authData = {};
    if (fs.existsSync(authPath)) {
        try {
            const content = fs.readFileSync(authPath, 'utf-8');
            if (content.trim()) authData = JSON.parse(content);
        } catch (err) {}
    }
    authData["OPENAI_API_KEY"] = apiKey;
    try { fs.writeFileSync(authPath, JSON.stringify(authData, null, 2), 'utf-8'); } catch(e){}
}

/**
 * 初始化全局模型列表和提供商当前模型
 * - 所有提供商共享一个全局模型列表
 * - 每个提供商记住自己的当前模型选择
 */
function initializeProviderModels(paths) {
    try {
        if (!fs.existsSync(paths.config)) return;

        const configRaw = fs.readFileSync(paths.config, 'utf-8');
        const config = toml.parse(configRaw);

        if (!config.model_providers) return;

        // 读取或创建全局模型列表
        let globalModels = [...DEFAULT_MODELS];
        if (fs.existsSync(paths.providerModels)) {
            try {
                const content = fs.readFileSync(paths.providerModels, 'utf-8');
                const data = JSON.parse(content);

                // 检查是否是旧格式（按提供商分组的对象）
                if (typeof data === 'object' && !Array.isArray(data)) {
                    // 迁移：从旧格式收集所有模型，创建全局列表
                    const modelSet = new Set();
                    for (const providerData of Object.values(data)) {
                        if (Array.isArray(providerData)) {
                            providerData.forEach(m => modelSet.add(m));
                        } else if (providerData?.models) {
                            providerData.models.forEach(m => modelSet.add(m));
                        }
                    }
                    globalModels = Array.from(modelSet);
                    if (globalModels.length === 0) {
                        globalModels = [...DEFAULT_MODELS];
                    }
                    fs.writeFileSync(paths.providerModels, JSON.stringify(globalModels, null, 2), 'utf-8');
                    console.log('[迁移] 已从旧格式迁移到全局模型列表，模型数量:', globalModels.length);
                } else if (Array.isArray(data)) {
                    globalModels = data;
                }
            } catch (e) {
                console.error('[读取模型列表失败]', e.message);
            }
        } else {
            fs.writeFileSync(paths.providerModels, JSON.stringify(globalModels, null, 2), 'utf-8');
        }

        // 读取或创建提供商当前模型映射
        let providerCurrentModels = {};
        if (fs.existsSync(paths.providerCurrentModels)) {
            try {
                providerCurrentModels = JSON.parse(fs.readFileSync(paths.providerCurrentModels, 'utf-8'));
            } catch (e) {
                console.error('[读取提供商当前模型失败]', e.message);
            }
        }

        let needsUpdate = false;

        // 确保每个提供商都有当前模型记录
        for (const providerName of Object.keys(config.model_providers)) {
            if (!providerCurrentModels[providerName]) {
                providerCurrentModels[providerName] = DEFAULT_MODELS[0];
                needsUpdate = true;
                console.log(`[初始化] 为提供商 "${providerName}" 设置默认当前模型`);
            }
        }

        // 清理已删除的提供商记录
        const currentProviderNames = new Set(Object.keys(config.model_providers));
        for (const providerName of Object.keys(providerCurrentModels)) {
            if (!currentProviderNames.has(providerName)) {
                delete providerCurrentModels[providerName];
                needsUpdate = true;
                console.log(`[清理] 移除已删除提供商 "${providerName}" 的当前模型记录`);
            }
        }

        if (needsUpdate) {
            fs.writeFileSync(paths.providerCurrentModels, JSON.stringify(providerCurrentModels, null, 2), 'utf-8');
        }
    } catch (e) {
        console.error('[初始化模型列表失败]', e.message);
    }
}

// ============================================================================
// TOML 配置验证和修复功能
// ============================================================================

/**
 * 验证并修复损坏的 TOML 配置文件
 */
function validateAndFixConfig(configPath) {
    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        toml.parse(content);
        return { success: true, fixed: false };
    } catch (e) {
        console.log('[TOML修复] 检测到损坏的配置文件，尝试修复...');

        try {
            let fixedContent = fs.readFileSync(configPath, 'utf-8');

            // 修复：错误的转义序列 \. -> .
            fixedContent = fixedContent.replace(
                /model\s*=\s*"([^"]*\\\.)([^"]*)"/g,
                (match, prefix, suffix) => `model = "${prefix.replace(/\\\./g, '.')}${suffix}"`
            );

            // 验证修复后的内容
            try {
                toml.parse(fixedContent);
                const backupPath = configPath + '.backup.' + Date.now();
                fs.writeFileSync(backupPath, fs.readFileSync(configPath, 'utf-8'), 'utf-8');
                fs.writeFileSync(configPath, fixedContent, 'utf-8');
                console.log('[TOML修复] 配置文件已修复，原文件备份至:', path.basename(backupPath));
                return { success: true, fixed: true };
            } catch (e2) {
                console.log('[TOML修复] 无法修复，使用默认配置');
                fs.writeFileSync(configPath, DEFAULT_CONFIG_CONTENT, 'utf-8');
                return { success: true, fixed: true };
            }
        } catch (e2) {
            return { success: false, error: e.message };
        }
    }
}

// 首次启动时验证配置
validateAndFixConfig(PATHS.config);

syncAuthWithConfig(PATHS);

// 初始化提供商模型列表
initializeProviderModels(PATHS);

module.exports = {
    getConfig: () => {
        try {
            if (!fs.existsSync(PATHS.config)) {
                return { error: `Config file missing: ${PATHS.config}` };
            }

            // 添加配置验证和修复
            const validation = validateAndFixConfig(PATHS.config);
            if (!validation.success) {
                return { error: "配置文件损坏且无法自动修复: " + validation.error };
            }

            const configRaw = fs.readFileSync(PATHS.config, 'utf-8');
            const config = toml.parse(configRaw);
            const providers = {};
            if (config.model_providers) {
                for (const [key, val] of Object.entries(config.model_providers)) {
                    let preview = val.preferred_auth_method || 'N/A';
                    if (preview.length > 12) preview = preview.substring(0, 4) + '...' + preview.substring(preview.length - 4);
                    else if (preview.length > 8) preview = preview.substring(0, 8) + '...';
                    providers[key] = { preferred_auth_method: val.preferred_auth_method || '', auth_method_preview: preview };
                }
            }

            // 读取全局共享的模型列表
            let models = [...DEFAULT_MODELS];
            try {
                if (fs.existsSync(PATHS.providerModels)) {
                    const content = fs.readFileSync(PATHS.providerModels, 'utf-8');
                    const data = JSON.parse(content);

                    // 如果是旧格式（对象），先迁移
                    if (typeof data === 'object' && !Array.isArray(data)) {
                        const modelSet = new Set();
                        for (const providerData of Object.values(data)) {
                            if (Array.isArray(providerData)) {
                                providerData.forEach(m => modelSet.add(m));
                            } else if (providerData?.models) {
                                providerData.models.forEach(m => modelSet.add(m));
                            }
                        }
                        models = Array.from(modelSet);
                        if (models.length === 0) {
                            models = [...DEFAULT_MODELS];
                        }
                        fs.writeFileSync(PATHS.providerModels, JSON.stringify(models, null, 2), 'utf-8');
                        console.log('[迁移] getConfig: 已迁移到全局模型列表');
                    } else if (Array.isArray(data)) {
                        models = data;
                    }
                }
            } catch (e) {
                console.error('[读取模型列表失败]', e.message);
            }

            // 读取每个提供商的当前模型
            let providerCurrentModels = {};
            try {
                if (fs.existsSync(PATHS.providerCurrentModels)) {
                    providerCurrentModels = JSON.parse(fs.readFileSync(PATHS.providerCurrentModels, 'utf-8'));
                }
            } catch (e) {
                console.error('[读取提供商当前模型失败]', e.message);
            }

            return {
                current: config.model_provider || '',
                currentModel: config.model || 'gpt-5.1-codex-max',
                providers,
                models,
                providerCurrentModels,
                path: PATHS.config,
                configFixed: validation.fixed
            };
        } catch (e) {
            return { error: "Malformed content (Invalid TOML): " + e.message };
        }
    },

    addModel: (providerName, modelName) => {
        try {
            // 读取全局模型列表
            let models = [...DEFAULT_MODELS];
            if (fs.existsSync(PATHS.providerModels)) {
                const content = fs.readFileSync(PATHS.providerModels, 'utf-8');
                const data = JSON.parse(content);

                // 如果是旧格式，先迁移
                if (typeof data === 'object' && !Array.isArray(data)) {
                    const modelSet = new Set();
                    for (const providerData of Object.values(data)) {
                        if (Array.isArray(providerData)) {
                            providerData.forEach(m => modelSet.add(m));
                        } else if (providerData?.models) {
                            providerData.models.forEach(m => modelSet.add(m));
                        }
                    }
                    models = Array.from(modelSet);
                    if (models.length === 0) {
                        models = [...DEFAULT_MODELS];
                    }
                } else if (Array.isArray(data)) {
                    models = data;
                }
            }

            // 添加模型（如果不存在）
            if (!models.includes(modelName)) {
                models.push(modelName);
                fs.writeFileSync(PATHS.providerModels, JSON.stringify(models, null, 2), 'utf-8');
                return { success: true, models };
            }

            return { success: true, models, exists: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    deleteModel: (providerName, modelName) => {
        try {
            // 读取全局模型列表
            let models = [...DEFAULT_MODELS];
            if (fs.existsSync(PATHS.providerModels)) {
                const content = fs.readFileSync(PATHS.providerModels, 'utf-8');
                const data = JSON.parse(content);

                // 如果是旧格式，先迁移
                if (typeof data === 'object' && !Array.isArray(data)) {
                    const modelSet = new Set();
                    for (const providerData of Object.values(data)) {
                        if (Array.isArray(providerData)) {
                            providerData.forEach(m => modelSet.add(m));
                        } else if (providerData?.models) {
                            providerData.models.forEach(m => modelSet.add(m));
                        }
                    }
                    models = Array.from(modelSet);
                    if (models.length === 0) {
                        models = [...DEFAULT_MODELS];
                    }
                } else if (Array.isArray(data)) {
                    models = data;
                }
            }

            // 至少保留一个模型
            if (models.length <= 1) {
                return { success: false, error: 'Cannot delete the last model' };
            }

            // 从全局列表删除模型
            models = models.filter(m => m !== modelName);
            fs.writeFileSync(PATHS.providerModels, JSON.stringify(models, null, 2), 'utf-8');

            // 检查是否有提供商正在使用被删除的模型
            let providerCurrentModels = {};
            if (fs.existsSync(PATHS.providerCurrentModels)) {
                providerCurrentModels = JSON.parse(fs.readFileSync(PATHS.providerCurrentModels, 'utf-8'));
            }

            // 如果有提供商使用被删除的模型，切换到第一个模型
            let needsUpdate = false;
            for (const [provider, currentModel] of Object.entries(providerCurrentModels)) {
                if (currentModel === modelName) {
                    providerCurrentModels[provider] = models[0];
                    needsUpdate = true;
                }
            }

            if (needsUpdate) {
                fs.writeFileSync(PATHS.providerCurrentModels, JSON.stringify(providerCurrentModels, null, 2), 'utf-8');
            }

            return { success: true, models };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    switchModel: (modelName) => {
        try {
            const configRaw = fs.readFileSync(PATHS.config, 'utf-8');
            const config = toml.parse(configRaw);
            const currentProvider = config.model_provider;

            // 使用行号精确替换，避免破坏 TOML 结构
            const lines = configRaw.split('\n');
            const modelLineIdx = lines.findIndex(line =>
                line.trim().startsWith('model =')
            );

            if (modelLineIdx !== -1) {
                // 替换现有行
                lines[modelLineIdx] = `model = "${modelName}"`;
                const newContent = lines.join('\n');

                // 验证写入后的内容
                try {
                    toml.parse(newContent);
                    fs.writeFileSync(PATHS.config, newContent, 'utf-8');

                    // 保存当前提供商的模型选择
                    if (currentProvider) {
                        let providerCurrentModels = {};
                        if (fs.existsSync(PATHS.providerCurrentModels)) {
                            providerCurrentModels = JSON.parse(fs.readFileSync(PATHS.providerCurrentModels, 'utf-8'));
                        }
                        providerCurrentModels[currentProvider] = modelName;
                        fs.writeFileSync(PATHS.providerCurrentModels, JSON.stringify(providerCurrentModels, null, 2), 'utf-8');
                    }

                    return { success: true };
                } catch (e) {
                    return { success: false, error: '写入后验证失败: ' + e.message };
                }
            } else {
                // 添加新行
                const providerIdx = lines.findIndex(line =>
                    line.includes('model_provider')
                );

                if (providerIdx !== -1) {
                    lines.splice(providerIdx + 1, 0, `model = "${modelName}"`);
                    const newContent = lines.join('\n');

                    try {
                        toml.parse(newContent);
                        fs.writeFileSync(PATHS.config, newContent, 'utf-8');

                        // 保存当前提供商的模型选择
                        if (currentProvider) {
                            let providerCurrentModels = {};
                            if (fs.existsSync(PATHS.providerCurrentModels)) {
                                providerCurrentModels = JSON.parse(fs.readFileSync(PATHS.providerCurrentModels, 'utf-8'));
                            }
                            providerCurrentModels[currentProvider] = modelName;
                            fs.writeFileSync(PATHS.providerCurrentModels, JSON.stringify(providerCurrentModels, null, 2), 'utf-8');
                        }

                        return { success: true };
                    } catch (e) {
                        return { success: false, error: '添加后验证失败: ' + e.message };
                    }
                }
            }

            return { success: false, error: '未找到 model_provider 配置' };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    getTemplate: (name) => {
        if (PRESET_TEMPLATES[name]) {
            return { success: true, template: PRESET_TEMPLATES[name] };
        } else {
            return { success: false, error: 'Template not found' };
        }
    },

    switchProvider: (provider) => {
        try {
            const configRaw = fs.readFileSync(PATHS.config, 'utf-8');
            const config = toml.parse(configRaw);
            if (!config.model_providers?.[provider]) {
                return { success: false, error: `Provider does not exist` };
            }

            const newRaw = configRaw.replace(/^(model_provider\s*=\s*)(["']).*?(["'])/m, `$1$2${provider}$3`);
            fs.writeFileSync(PATHS.config, newRaw, 'utf-8');

            const authKey = config.model_providers[provider].preferred_auth_method;
            updateAuthJson(PATHS.auth, authKey);

            // 读取提供商的当前模型
            let providerCurrentModels = {};
            if (fs.existsSync(PATHS.providerCurrentModels)) {
                providerCurrentModels = JSON.parse(fs.readFileSync(PATHS.providerCurrentModels, 'utf-8'));
            }

            // 如果提供商没有记录的当前模型，使用默认模型
            let targetModel = providerCurrentModels[provider] || DEFAULT_MODELS[0];

            // 初始化提供商的当前模型（如果不存在）
            if (!providerCurrentModels[provider]) {
                providerCurrentModels[provider] = targetModel;
                fs.writeFileSync(PATHS.providerCurrentModels, JSON.stringify(providerCurrentModels, null, 2), 'utf-8');
            }

            // 切换到该提供商的模型
            const configRaw2 = fs.readFileSync(PATHS.config, 'utf-8');
            const lines = configRaw2.split('\n');
            const modelLineIdx = lines.findIndex(line => line.trim().startsWith('model ='));

            if (modelLineIdx !== -1) {
                lines[modelLineIdx] = `model = "${targetModel}"`;
                const newContent = lines.join('\n');
                try {
                    toml.parse(newContent);
                    fs.writeFileSync(PATHS.config, newContent, 'utf-8');
                } catch (e) {
                    console.error('[切换模型失败]', e.message);
                }
            }

            return { success: true, targetModel };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    updateApiKey: (provider, newKey) => {
        try {
            const configRaw = fs.readFileSync(PATHS.config, 'utf-8');
            const safeName = provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const sectionRegex = new RegExp(`\\[\\s*model_providers\\s*\\.\\s*${safeName}\\s*\\]`);
            const match = configRaw.match(sectionRegex);
            if (!match) throw new Error('Section not found');

            const startIdx = match.index + match[0].length;
            const rest = configRaw.slice(startIdx);
            const nextIdx = rest.indexOf('[');
            const scope = nextIdx === -1 ? rest : rest.slice(0, nextIdx);

            const keyRegex = /(preferred_auth_method\s*=\s*)(["']).*?(["'])/;
            const keyMatch = scope.match(keyRegex);
            if (!keyMatch) throw new Error('Key field missing in config');

            const absStart = startIdx + keyMatch.index;
            const newRaw = configRaw.slice(0, absStart) + `${keyMatch[1]}${keyMatch[2]}${newKey}${keyMatch[3]}` + configRaw.slice(absStart + keyMatch[0].length);
            fs.writeFileSync(PATHS.config, newRaw, 'utf-8');

            try {
                const newParsed = toml.parse(newRaw);
                if (newParsed.model_provider === provider) updateAuthJson(PATHS.auth, newKey);
            } catch (e) { }

            return true;
        } catch (e) {
            throw e;
        }
    },

    addProvider: (data) => {
        try {
            const { name, base_url, api_key, from_template } = data;
            const configRaw = fs.readFileSync(PATHS.config, 'utf-8');
            const config = toml.parse(configRaw);

            if (config.model_providers && config.model_providers[name]) {
                return { success: false, error: `Provider "${name}" exists` };
            }

            let defaults = { wire_api: "responses", requires_openai_auth: false, request_max_retries: 4, stream_max_retries: 10, stream_idle_timeout_ms: 300000 };
            if (from_template && PRESET_TEMPLATES[from_template]) {
                const t = PRESET_TEMPLATES[from_template];
                defaults = { ...defaults, ...t };
            }

            const newBlock = `
[model_providers.${name}]
name = "${name}"
base_url = "${base_url}"
wire_api = "${defaults.wire_api}"
requires_openai_auth = ${defaults.requires_openai_auth}
preferred_auth_method = "${api_key}"
request_max_retries = ${defaults.request_max_retries}
stream_max_retries = ${defaults.stream_max_retries}
stream_idle_timeout_ms = ${defaults.stream_idle_timeout_ms}
`;
            const appendRaw = configRaw.trimEnd() + "\n" + newBlock;
            fs.writeFileSync(PATHS.config, appendRaw, 'utf-8');

            // 为新提供商初始化当前模型
            let providerCurrentModels = {};
            if (fs.existsSync(PATHS.providerCurrentModels)) {
                providerCurrentModels = JSON.parse(fs.readFileSync(PATHS.providerCurrentModels, 'utf-8'));
            }
            if (!providerCurrentModels[name]) {
                providerCurrentModels[name] = DEFAULT_MODELS[0];
                fs.writeFileSync(PATHS.providerCurrentModels, JSON.stringify(providerCurrentModels, null, 2), 'utf-8');
            }

            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    deleteProvider: (provider) => {
        try {
            const configRaw = fs.readFileSync(PATHS.config, 'utf-8');

            const safeName = provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const sectionRegex = new RegExp(`\\[\\s*model_providers\\s*\\.\\s*${safeName}\\s*\\]`);
            const match = configRaw.match(sectionRegex);
            if (!match) throw new Error(`Provider block not found`);

            const startIdx = match.index;
            const rest = configRaw.slice(startIdx + match[0].length);
            const nextSectionRelativeIdx = rest.indexOf('[');
            let endIdx = nextSectionRelativeIdx === -1 ? configRaw.length : (startIdx + match[0].length + nextSectionRelativeIdx);

            const newRaw = configRaw.slice(0, startIdx) + configRaw.slice(endIdx);
            fs.writeFileSync(PATHS.config, newRaw.trim(), 'utf-8');

            // 删除提供商的当前模型记录
            let providerCurrentModels = {};
            if (fs.existsSync(PATHS.providerCurrentModels)) {
                providerCurrentModels = JSON.parse(fs.readFileSync(PATHS.providerCurrentModels, 'utf-8'));
            }
            if (providerCurrentModels[provider]) {
                delete providerCurrentModels[provider];
                fs.writeFileSync(PATHS.providerCurrentModels, JSON.stringify(providerCurrentModels, null, 2), 'utf-8');
            }

            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    },

    // Claude Code 配置相关函数（内存存储，直接注入系统环境变量）
    getClaudeConfigs: () => {
        return claudeConfigsCache;
    },

    saveClaudeConfigs: (configs) => {
        try {
            claudeConfigsCache = configs;
            return true;
        } catch (e) {
            console.error('[保存Claude配置失败]', e.message);
            return false;
        }
    },

    applyToSystemEnv: (config) => {
        try {
            const { execSync } = require('child_process');

            // 使用同一个 API Key
            const apiKey = config.apiKey || '';

            // 设置用户环境变量
            const envVars = [
                ['ANTHROPIC_API_KEY', apiKey],
                ['ANTHROPIC_AUTH_TOKEN', apiKey],  // 使用相同的 API Key
                ['ANTHROPIC_BASE_URL', config.baseUrl || 'https://open.bigmodel.cn/api/anthropic'],
                ['CLAUDE_CODE_USE_KEY', '1'],
                ['ANTHROPIC_MODEL', config.model || 'glm-4.7']
            ];

            for (const [key, value] of envVars) {
                try {
                    // 使用 setx 命令设置用户环境变量
                    execSync(`setx ${key} "${value}"`, { encoding: 'utf-8' });
                    console.log(`[环境变量] 已设置 ${key}=${value}`);
                } catch (e) {
                    console.error(`[环境变量] 设置 ${key} 失败:`, e.message);
                }
            }

            return { success: true };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
};
