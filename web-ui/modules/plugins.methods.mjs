import { createPromptTemplatesMethods } from '../../plugins/prompt-templates/methods.mjs';
import { createTextToolsMethods } from '../../plugins/text-tools/methods.mjs';
import { createPromptInvocationMethods } from '../../plugins/prompt-templates/invocation.mjs';

export function createPluginsMethods() {
    return {
        ...createPromptTemplatesMethods(),
        ...createPromptInvocationMethods(),
        ...createTextToolsMethods()
    };
}
