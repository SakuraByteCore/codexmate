'use strict';

const FIELDS = ['inputTokens', 'cachedInputTokens', 'cacheCreationInputTokens', 'outputTokens', 'totalTokens'];
function count(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}
function readUsage(usage, source) {
    if (!usage || typeof usage !== 'object') return null;
    const input = count(usage.input_tokens ?? usage.inputTokens ?? usage.input);
    const output = count(usage.output_tokens ?? usage.outputTokens ?? usage.output);
    const cached = count(usage.cached_input_tokens ?? usage.cache_read_input_tokens ?? usage.cacheRead
        ?? usage.input_tokens_details?.cached_tokens);
    const created = count(usage.cache_creation_input_tokens ?? usage.cacheWrite);
    const total = count(usage.total_tokens ?? usage.totalTokens);
    if ([input, output, cached, created, total].every(value => value === null)) return null;
    // Codex cached input is a subset of input; reasoning is a subset of output.
    const inferredTotal = (input || 0) + (output || 0) + (source === 'codex' ? 0 : (cached || 0) + (created || 0));
    return { inputTokens: input, cachedInputTokens: cached, cacheCreationInputTokens: created,
        outputTokens: output, totalTokens: total ?? (input !== null && output !== null ? inferredTotal : null) };
}
function recordModel(record, fallback) {
    const model = record?.message?.model ?? record?.payload?.model ?? record?.model;
    return typeof model === 'string' && model.trim() && model !== '<synthetic>' ? model.trim() : fallback;
}
function recordTime(record) {
    const timestamp = record?.timestamp ?? record?.message?.timestamp;
    return typeof timestamp === 'string' && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : '';
}

function createSessionUsageLedger(session) {
    const source = session.source;
    const supported = ['codex', 'claude', 'pi'].includes(source);
    let model = Array.isArray(session.models) && session.models.length > 1 ? 'unknown' : (session.model || 'unknown');
    const snapshots = new Map();
    const rows = new Map();
    let cumulative;
    let observedRecords = 0;
    function add(record) {
        model = recordModel(record, model);
        if (!supported) return;
        const payload = record?.payload;
        const message = record?.message;
        const isCodex = source === 'codex' && record?.type === 'event_msg' && payload?.type === 'token_count';
        const isAssistant = message?.role === 'assistant' || record?.type === 'assistant' || record?.role === 'assistant';
        if (!isCodex && !isAssistant) return;
        const usage = isCodex ? payload?.info?.total_token_usage : (message?.usage ?? record?.usage);
        const totals = readUsage(usage, source);
        if (!totals) return;
        const requestId = message?.id ?? record?.id ?? record?.uuid;
        const previous = isCodex ? cumulative : (requestId ? snapshots.get(requestId) : null);
        const reset = isCodex && previous && totals.totalTokens < previous.totalTokens;
        const delta = Object.fromEntries(FIELDS.map(field => {
            if (totals[field] === null) return [field, null];
            const before = !reset && previous ? previous[field] || 0 : 0;
            return [field, Math.max(0, totals[field] - before)];
        }));
        if (isCodex) cumulative = totals;
        else if (requestId) snapshots.set(requestId, Object.fromEntries(FIELDS.map(field =>
            [field, totals[field] === null ? previous?.[field] ?? null : Math.max(totals[field], previous?.[field] || 0)])));
        if (previous && FIELDS.every(field => !delta[field])) return;
        observedRecords++;
        const timestamp = recordTime(record);
        const date = timestamp.slice(0, 10);
        const key = `${date}\n${model}`;
        const row = rows.get(key) || { date, source, model, ...Object.fromEntries(FIELDS.map(field => [field, 0])), usageEvents: 0 };
        for (const field of FIELDS) row[field] = row[field] === null || delta[field] === null ? null : row[field] + delta[field];
        row.usageEvents += 1;
        rows.set(key, row);
    }
    return { add, finish: () => ({ supported, observedRecords, rows: [...rows.values()] }) };
}

module.exports = { createSessionUsageLedger, FIELDS };
