import { createPromptTemplatesMethods } from '../../plugins/prompt-templates/methods.mjs';
import { createTextToolsMethods } from '../../plugins/text-tools/methods.mjs';

export function createPluginsMethods() {
    return {
        ...createPromptTemplatesMethods(),
        ...createTextToolsMethods()
    };
}
