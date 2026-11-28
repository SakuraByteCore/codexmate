'use strict';
const snapshot = require('./data/model-prices.json');
const TOKEN_FIELDS = ['inputTokens', 'outputTokens', 'cachedInputTokens', 'cacheCreationInputTokens'];
const RATE_FIELDS = ['input_cost_per_token', 'output_cost_per_token', 'cache_read_input_token_cost', 'cache_creation_input_token_cost'];
const INCLUDED_CACHE_SOURCES = ['codex', 'gemini'];

function estimateUsageRow(row, catalog = snapshot) {
    const rates = catalog.models[row.model];
    const unknown = reason => ({ ...row, estimatedUsd: null, reason, rates: rates || null });
    if (!rates) return unknown('model-unknown');
    const counts = TOKEN_FIELDS.map(field => row[field]);
    if (INCLUDED_CACHE_SOURCES.includes(row.source)) {
        counts[3] = counts[3] ?? 0;
        if (counts[0] !== null && counts[2] !== null) counts[0] -= counts[2];
    }
    if (counts.some(count => !Number.isSafeInteger(count) || count < 0)) return unknown('usage-incomplete');
    // Gemini totals can include reasoning/tool tokens absent from the priced categories.
    if (!Number.isSafeInteger(row.totalTokens) || counts.reduce((sum, count) => sum + count, 0) !== row.totalTokens) return unknown('usage-unclassified');
    let estimatedUsd = 0;
    for (const [index, count] of counts.entries()) {
        if (!count) continue;
        const rate = rates[RATE_FIELDS[index]];
        if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0) return unknown('rate-missing');
        estimatedUsd += count * rate;
    }
    if (!Number.isFinite(estimatedUsd)) return unknown('usage-incomplete');
    return { ...row, estimatedUsd, reason: 'base-rate', rates };
}

function priceUsageReport(report, catalog = snapshot) {
    const rows = report.rows.map(row => estimateUsageRow(row, catalog));
    const priced = rows.filter(row => row.estimatedUsd !== null);
    const knownSubtotalUsd = priced.reduce((sum, row) => sum + row.estimatedUsd, 0);
    const complete = rows.length > 0 && priced.length === rows.length && !report.summary.failedSessions.length
        && !report.summary.unreportedSessions && !report.summary.unsupportedSessions;
    const { models, license, ...priceSource } = catalog;
    return { rows, priceSource, summary: { knownSubtotalUsd, estimatedUsd: complete ? knownSubtotalUsd : null,
        pricedRows: priced.length, unknownRows: rows.length - priced.length, complete,
        failedSessions: report.summary.failedSessions.length, unreportedSessions: report.summary.unreportedSessions,
        unsupportedSessions: report.summary.unsupportedSessions }, timezone: report.timezone, attribution: 'base-rate-reference' };
}
module.exports = { estimateUsageRow, priceUsageReport };
