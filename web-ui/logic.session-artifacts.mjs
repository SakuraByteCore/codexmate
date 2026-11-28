const ARTIFACT_FORMATS = Object.freeze({
    evidence: 'codexmate-evidence.md',
    receipt: 'codexmate-development-receipt.md',
    relay: 'codexmate-agent-relay.md'
});
const quote = text => String(text).split('\n').map(line => '> ' + line).join('\n');
const sourceKey = item => JSON.stringify([item.session.source, item.session.sessionId, item.session.filePath, item.nodeId]);

export function sessionArtifactFilename(format) {
    return ARTIFACT_FORMATS[format];
}

export function renderSessionArtifact({ format, goal, note, selections, evidence, translate }) {
    const t = translate;
    const entries = selections.map(item => ({ item, source: evidence.get(sourceKey(item)) }));
    const lines = [`# ${t('artifacts.' + format)}`, '', t('artifacts.scope'), '',
        `## ${t('artifacts.goal')}`, '', quote(goal.trim() || t('artifacts.unspecified'))];
    if (note.trim()) lines.push('', `## ${t('artifacts.note')}`, '', quote(note.trim()));
    if (format === 'receipt') {
        lines.push('', `## ${t('artifacts.checks')}`, '');
        for (const status of ['passed', 'failed', 'unverified']) {
            const count = entries.filter(entry => entry.source.status === status).length;
            lines.push(`- ${t('evidence.' + status)}: ${count}`);
        }
        lines.push('', t('artifacts.noVerdict'));
    } else {
        lines.push('', `## ${t('artifacts.executor')}`, '', t('artifacts.executorTask'), '',
            `## ${t('artifacts.reviewer')}`, '', t('artifacts.reviewerTask'));
    }
    lines.push('', `## ${t('artifacts.sources')}`);
    for (const [index, { item, source }] of entries.entries()) {
        lines.push('', `### ${index + 1}. ${item.session.title || item.session.sessionId}`, '',
            `${item.session.source} · ${item.session.sessionId} · ${source.nodeId}`,
            `${t('evidence.path')}: ${JSON.stringify(item.session.filePath || item.session.cwd || '')}`,
            `SHA-256: ${source.textHash}`, `${t('evidence.status')}: ${t('evidence.' + source.status)}`, '', quote(source.excerpt));
    }
    lines.push('', `## ${t('artifacts.uat')}`, '', t('artifacts.uatTask'));
    return lines.join('\n').trim() + '\n';
}
