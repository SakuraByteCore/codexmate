import { pluginOwnership, templateOwnershipById } from '../ownership.mjs';

export function buildBuiltinIssueInjectTemplate(t) {
    const tr = (key, fallback, params = null) => (typeof t === 'function' ? t(key, params) : fallback);
    const timestamp = new Date().toISOString();
    const ownership = templateOwnershipById && templateOwnershipById.builtin_issue_inject
        ? templateOwnershipById.builtin_issue_inject
        : pluginOwnership;
    return {
        id: 'builtin_issue_inject',
        name: tr('plugins.builtin.issueInject.name', 'Issue inject'),
        description: tr('plugins.builtin.issueInject.desc', 'Inject {{issue}} into issue {{num}}'),
        template: [
            tr('plugins.builtin.issueInject.line1', '## Requirements'),
            '',
            '{{issue}}',
            '',
            tr('plugins.builtin.issueInject.line2', '## Verification'),
            ''
        ].join('\n'),
        createdAt: timestamp,
        updatedAt: timestamp,
        isBuiltin: true,
        createdBy: ownership && typeof ownership.createdBy === 'string' ? ownership.createdBy : '',
        maintainers: ownership && Array.isArray(ownership.maintainers) ? ownership.maintainers : []
    };
}
