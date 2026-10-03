import { promptTemplatesPluginMeta } from './prompt-templates/manifest.mjs';
import { loadPromptTemplatesOverview } from './prompt-templates/overview.mjs';
import { textToolsPluginMeta } from './text-tools/manifest.mjs';
import { loadTextToolsOverview } from './text-tools/overview.mjs';

export const pluginsRegistry = [
    { id: promptTemplatesPluginMeta.id, meta: promptTemplatesPluginMeta, loadOverview: loadPromptTemplatesOverview },
    { id: textToolsPluginMeta.id, meta: textToolsPluginMeta, loadOverview: loadTextToolsOverview }
];

export function getFirstPluginId() {
    return pluginsRegistry.length ? pluginsRegistry[0].id : '';
}

export function getPluginEntry(id) {
    const key = typeof id === 'string' ? id.trim() : '';
    if (!key) return null;
    return pluginsRegistry.find((item) => item && item.id === key) || null;
}
