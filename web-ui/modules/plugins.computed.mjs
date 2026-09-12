import { createPluginsComputed as createPromptTemplatesComputed } from '../../plugins/prompt-templates/computed.mjs';
import { createPluginsComputed as createTextToolsComputed } from '../../plugins/text-tools/computed.mjs';

export function createPluginsComputed() {
    return {
        ...createPromptTemplatesComputed(),
        ...createTextToolsComputed()
    };
}
