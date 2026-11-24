const WARNING_RATIO = 0.8;
const HIGH_RATIO = 0.95;
export function contextWindowReference(report, { model = '', window = '' } = {}) {
    if (!report) return null;
    const models = report.models || [];
    const selected = model || (models.length === 1 ? models[0] : '');
    if (models.length > 1 && !selected) return { status: 'unknown', model: '', source: 'unknown' };
    const manual = window !== '' && window !== null && window !== undefined;
    const size = manual ? Number(window) : Number((report.modelWindows || {})[selected]);
    if (manual && (!Number.isSafeInteger(size) || size <= 0)) throw new Error('context-window-invalid');
    if (!Number.isSafeInteger(size) || size <= 0) return { status: 'unknown', model: selected, source: 'unknown' };
    const ratio = report.totalEstimatedTokens / size;
    return { status: ratio >= HIGH_RATIO ? 'high' : ratio >= WARNING_RATIO ? 'warning' : 'normal',
        model: selected, window: size, ratio, percentage: ratio * 100, source: manual ? 'manual' : 'record', estimated: true };
}
