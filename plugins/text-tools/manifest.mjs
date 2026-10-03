import { textToolsPluginOwnership } from './ownership.mjs';

const textToolsBaseMeta = {
    id: 'text-tools',
    title: 'Text Tools',
    titleKey: 'plugins.catalog.textTools.title',
    description: 'Lightweight in-browser text utilities; the first tool compresses text into a single line.',
    descriptionKey: 'plugins.catalog.textTools.description',
    statusLabel: 'standard',
    statusLabelKey: 'plugins.status.standard',
    tone: 'configured'
};

export const textToolsPluginMeta = {
    ...textToolsBaseMeta,
    createdBy: textToolsPluginOwnership && typeof textToolsPluginOwnership.createdBy === 'string' ? textToolsPluginOwnership.createdBy : '',
    maintainers: textToolsPluginOwnership && Array.isArray(textToolsPluginOwnership.maintainers) ? textToolsPluginOwnership.maintainers : []
};

export { textToolsPluginMeta as pluginMeta };
