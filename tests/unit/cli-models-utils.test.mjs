import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
    getSupplementalModelsForBaseUrl,
    mergeModelCatalog
} = await import(pathToFileURL(path.join(__dirname, '..', '..', 'lib', 'cli-models-utils.js')));

test('getSupplementalModelsForBaseUrl returns the BigModel Claude-compatible catalog including glm-5.1', () => {
    const models = getSupplementalModelsForBaseUrl('https://open.bigmodel.cn/api/anthropic');

    assert(models.includes('glm-4.7'));
    assert(models.includes('glm-5.1'));
    assert(models.includes('glm-coding'));
    assert(!models.includes('glm-image'));
});

test('getSupplementalModelsForBaseUrl returns Anthropic Claude models for official endpoints', () => {
    const models = getSupplementalModelsForBaseUrl('https://api.anthropic.com');

    assert(models.includes('claude-opus-4-6'));
    assert(models.includes('claude-opus-4-1'));
    assert(models.includes('claude-sonnet-4-6'));
    assert(models.includes('claude-sonnet-4-5'));
    assert(models.includes('claude-haiku-4-5'));
    assert(models.includes('claude-3-7-sonnet'));
    assert(models.includes('claude-3-haiku'));
    assert(!models.includes('glm-5.1'));
});

test('getSupplementalModelsForBaseUrl returns provider-specific Claude-compatible Codex catalogs', () => {
    const deepseekModels = getSupplementalModelsForBaseUrl('https://api.deepseek.com/anthropic');
    const qwenModels = getSupplementalModelsForBaseUrl('https://coding.dashscope.aliyuncs.com/apps/anthropic');
    const zaiModels = getSupplementalModelsForBaseUrl('https://api.z.ai/api/anthropic');
    const modelscopeModels = getSupplementalModelsForBaseUrl('https://api-inference.modelscope.cn');

    assert(deepseekModels.includes('DeepSeek-V3.2'));
    assert(!deepseekModels.includes('qwen3-coder'));
    assert(qwenModels.includes('qwen3-coder'));
    assert(!qwenModels.includes('DeepSeek-V3.2'));
    assert(zaiModels.includes('glm-5'));
    assert(modelscopeModels.includes('ZhipuAI/GLM-5'));
});

test('getSupplementalModelsForBaseUrl does not match unrelated bigmodel hosts or paths', () => {
    assert.deepStrictEqual(getSupplementalModelsForBaseUrl('https://notbigmodel.cn/api/anthropic'), []);
    assert.deepStrictEqual(getSupplementalModelsForBaseUrl('https://open.bigmodel.cn/api/anthropicx'), []);
    assert.deepStrictEqual(getSupplementalModelsForBaseUrl('https://api.deepseek.com/v1'), []);
    assert.deepStrictEqual(getSupplementalModelsForBaseUrl('https://coding.dashscope.aliyuncs.com/apps/openai'), []);
});

test('mergeModelCatalog keeps remote order and appends missing Claude endpoint extras once', () => {
    const merged = mergeModelCatalog(
        ['glm-4.7', 'glm-5'],
        ['glm-5', 'glm-5.1', 'glm-4.7-flash']
    );

    assert.deepStrictEqual(merged, ['glm-4.7', 'glm-5', 'glm-5.1', 'glm-4.7-flash']);
});
