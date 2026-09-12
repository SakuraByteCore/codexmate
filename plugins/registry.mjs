import { pluginMeta as promptTemplatesMeta } from './prompt-templates/manifest.mjs';
import { loadPromptTemplatesOverview } from './prompt-templates/overview.mjs';
import { pluginMeta as textToolsMeta } from './text-tools/manifest.mjs';
import { loadTextToolsOverview } from './text-tools/overview.mjs';

export const pluginsRegistry = [
    { id: promptTemplatesMeta.id, meta: promptTemplatesMeta, loadOverview: loadPromptTemplatesOverview },
    { id: textToolsMeta.id, meta: textToolsMeta, loadOverview: loadTextToolsOverview }
];

export function getFirstPluginId() {
    return pluginsRegistry.length ? pluginsRegistry[0].id : '';
}

export function getPluginEntry(id) {
    const key = typeof id === 'string' ? id.trim() : '';
    if (!key) return null;
    return pluginsRegistry.find((item) => item && item.id === key) || null;
}
