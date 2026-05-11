// 仅供 web-ui 的 codex 模型选择器与新增 provider 模板按钮使用。
// 镜像 logic.claude.mjs 的派生方式，但 codex provider 元信息不带 wire_api，
// 所以 catalog 仅按 baseUrl 的 host/path 命中。

const DEFAULT_OPENAI_CODEX_CATALOG = Object.freeze([
    'gpt-5-codex',
    'gpt-5',
    'gpt-5-mini',
    'gpt-4.1',
    'o4-mini',
    'o3-mini'
]);

const HOST_RULES = Object.freeze([
    { match: (u) => /api\.openai\.com/i.test(u), models: DEFAULT_OPENAI_CODEX_CATALOG },
    { match: (u) => /api\.deepseek\.com/i.test(u), models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'] },
    { match: (u) => /dashscope\.aliyuncs\.com/i.test(u), models: ['qwen3-coder-plus', 'qwen3-coder-flash', 'qwen-max', 'qwen-plus'] },
    { match: (u) => /ark\..*volces\.com/i.test(u), models: ['doubao-seed-1-6-thinking', 'doubao-seed-1-6', 'doubao-1-5-pro-32k', 'doubao-pro-32k'] },
    { match: (u) => /open\.bigmodel\.cn/i.test(u), models: ['glm-4.6', 'glm-4.5', 'glm-4-plus', 'glm-coding'] },
    { match: (u) => /api\.moonshot\.cn|api\.kimi\.com/i.test(u), models: ['moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-latest'] },
    { match: (u) => /api\.minimax/i.test(u), models: ['MiniMax-M2', 'abab6.5s-chat', 'abab6.5-chat'] },
    { match: (u) => /api-inference\.modelscope\.cn/i.test(u), models: ['Qwen/Qwen3-Coder-480B-A35B-Instruct', 'ZhipuAI/GLM-4.5'] },
    { match: (u) => /xiaomimimo\.com/i.test(u), models: ['mimo-v2-pro', 'mimo-v2'] },
    { match: (u) => /ai\.muapi\.cn/i.test(u), models: ['mimo-v2-pro'] }
]);

function normalizeUrl(url) {
    return typeof url === 'string' ? url.trim().toLowerCase() : '';
}

export function getCodexModelCatalogForProvider(provider) {
    if (!provider || typeof provider !== 'object') return [];
    const url = normalizeUrl(provider.url || provider.baseUrl || '');
    const name = typeof provider.name === 'string' ? provider.name.toLowerCase() : '';
    if (!url) {
        if (/openai/.test(name)) return [...DEFAULT_OPENAI_CODEX_CATALOG];
        return [];
    }
    for (const rule of HOST_RULES) {
        if (rule.match(url)) return [...rule.models];
    }
    return [];
}

// 服务模板表：供面板上的预设按钮使用。
// model 字段为可选首选项（添加后由前端写入内存字典 currentModels[name]）。
// useTransform=true 表示该服务需通过内建 OpenAI bridge 转发。
export const CODEX_PROVIDER_TEMPLATES = Object.freeze([
    {
        label: 'MuAPI',
        name: 'muapi',
        url: 'https://ai.muapi.cn/v1',
        model: 'mimo-v2-pro',
        useTransform: true
    },
    {
        label: 'Telepub',
        name: 'telepub',
        url: 'https://voyage.prod.telepub.cn/voyage/api',
        model: 'DeepSeek-V4-pro',
        useTransform: true
    },
    {
        label: 'AnyRouter',
        name: 'anyrouter',
        url: 'https://anyrouter.top/v1',
        model: 'gpt-5.5'
    }
]);
