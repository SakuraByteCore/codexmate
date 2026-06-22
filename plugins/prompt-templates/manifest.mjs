import { pluginOwnership } from './ownership.mjs';

const baseMeta = {
    id: 'prompt-templates',
    title: 'Prompt Templates',
    titleKey: 'plugins.catalog.promptTemplates.title',
    description: 'Standardized, template-driven prompts with variables and copy/export helpers.',
    descriptionKey: 'plugins.catalog.promptTemplates.description',
    statusLabel: 'standard',
    statusLabelKey: 'plugins.status.standard',
    tone: 'configured'
};

export const pluginMeta = {
    ...baseMeta,
    createdBy: pluginOwnership && typeof pluginOwnership.createdBy === 'string' ? pluginOwnership.createdBy : '',
    maintainers: pluginOwnership && Array.isArray(pluginOwnership.maintainers) ? pluginOwnership.maintainers : []
};
