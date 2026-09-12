import { pluginOwnership } from './ownership.mjs';

const baseMeta = {
    id: 'text-tools',
    title: 'Text Tools',
    titleKey: 'plugins.catalog.textTools.title',
    description: 'Developer-oriented string utilities: whitespace, dedupe/sort/reverse, case, Base64, JSON, timestamp and radix conversion.',
    descriptionKey: 'plugins.catalog.textTools.description',
    statusLabel: 'standard',
    statusLabelKey: 'plugins.status.standard',
    tone: 'configured'
};

export const pluginMeta = {
    ...baseMeta,
    createdBy: pluginOwnership && typeof pluginOwnership.createdBy === 'string' ? pluginOwnership.createdBy : '',
    maintainers: pluginOwnership && Array.isArray(pluginOwnership.maintainers) ? pluginOwnership.maintainers : []
};