import { createPromptTemplatesComputed } from '../../plugins/prompt-templates/computed.mjs';
import { createTextToolsComputed } from '../../plugins/text-tools/computed.mjs';

export function createPluginsComputed() {
    return {
        ...createPromptTemplatesComputed(),
        ...createTextToolsComputed()
    };
}
