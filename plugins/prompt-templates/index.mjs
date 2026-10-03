export { createPromptTemplatesMethods as createPluginsMethods } from './methods.mjs';
export { createPromptTemplatesComputed as createPluginsComputed } from './computed.mjs';
export { promptTemplatesPluginMeta as pluginMeta } from './manifest.mjs';
export {
    readPromptTemplatesFromStorage,
    persistPromptTemplatesToStorage,
    clearPromptTemplatesStorage
} from './storage.mjs';
