import { createPluginsMethods as createPromptTemplatesMethods } from '../../plugins/prompt-templates/methods.mjs';
import { createPluginsMethods as createTextToolsMethods } from '../../plugins/text-tools/methods.mjs';

export function createPluginsMethods() {
    return {
        ...createPromptTemplatesMethods(),
        ...createTextToolsMethods()
    };
}
