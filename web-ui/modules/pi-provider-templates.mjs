export const PI_PROVIDER_TEMPLATE_GROUPS = [
    {
        id: 'custom',
        i18nKey: 'pi.picker.group.custom',
        templates: [
            { id: 'custom-openai', name: 'OpenAI Compatible', baseUrl: '', api: 'openai-completions' },
            { id: 'custom-anthropic', name: 'Anthropic Compatible', baseUrl: '', api: 'anthropic-messages' }
        ]
    },
    {
        id: 'apiKey',
        i18nKey: 'pi.picker.group.apiKey',
        templates: [
            { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', api: 'openai-responses' },
            { id: 'anthropic', name: 'Anthropic', baseUrl: 'https://api.anthropic.com', api: 'anthropic-messages' },
            { id: 'google-gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', api: 'google-generative-ai' },
            { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', api: 'openai-completions' },
            { id: 'moonshot-kimi', name: 'Moonshot Kimi', baseUrl: 'https://api.moonshot.cn/v1', api: 'openai-completions' },
            { id: 'zhipu-glm', name: 'Zhipu GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', api: 'openai-completions' },
            { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', api: 'openai-completions' },
            { id: 'xai-grok', name: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', api: 'openai-completions' },
            { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', api: 'openai-completions' },
            { id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', api: 'openai-completions' }
        ]
    }
];
