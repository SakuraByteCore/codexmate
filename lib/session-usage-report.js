'use strict';

const { createSessionUsageLedger, FIELDS } = require('./session-usage-ledger');
const { createContextRecordReader } = require('./session-context-records');
const { createConcurrencyLimiter } = require('../cli/session-usage.concurrent');
const { parseUsageExportDate, normalizeUsageExportModelFilters, sessionMatchesUsageExportModelFilters } = require('../cli/session-usage');
const CACHE_LIMIT = 256;
const CONCURRENCY = 4;
const COLUMNS = ['date', 'source', 'model', ...FIELDS, 'usageEvents', 'sessions'];

function mergeRows(reports, params) {
    if ([params.from, params.to].some(value => value && !/^\d{4}-\d{2}-\d{2}$/.test(value))) {
        throw new Error('Invalid usage date range; records require YYYY-MM-DD');
    }
    const from = parseUsageExportDate(params.from, 'start');
    const to = parseUsageExportDate(params.to, 'end');
    if (Number.isNaN(from) || Number.isNaN(to) || (from !== null && to !== null && from >= to)) {
        throw new Error('Invalid usage date range');
    }
    const filters = normalizeUsageExportModelFilters(params);
    const groups = new Map();
    for (const report of reports) {
        for (const row of report.rows) {
            if (!sessionMatchesUsageExportModelFilters(row, filters)) continue;
            const timestamp = row.date ? Date.parse(row.date + 'T00:00:00.000Z') : null;
            if ((from !== null || to !== null) && timestamp === null) continue;
            if ((from !== null && timestamp < from) || (to !== null && timestamp >= to)) continue;
            const key = `${row.date}\n${row.source}\n${row.model}`;
            const group = groups.get(key) || { date: row.date, source: row.source, model: row.model,
                ...Object.fromEntries(FIELDS.map(field => [field, 0])), usageEvents: 0, sessions: 0 };
            for (const field of FIELDS) group[field] = group[field] === null || row[field] === null ? null : group[field] + row[field];
            group.usageEvents += row.usageEvents;
            group.sessions++;
            groups.set(key, group);
        }
    }
    return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source) || a.model.localeCompare(b.model));
}

function createSessionUsageReportController(deps) {
    const cache = new Map();
    const limit = createConcurrencyLimiter(CONCURRENCY);
    async function scan(session, forceRefresh) {
        const stat = session.filePath ? await deps.fs.promises.stat(session.filePath) : null;
        const signature = stat ? `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}` : '';
        const key = `${session.source}:${session.filePath || session.sessionId}:${session.model || ''}`;
        if (!forceRefresh && signature && cache.get(key)?.signature === signature) return cache.get(key).report;
        const { createContextAnalyzer } = await import('../web-ui/logic.context-health.mjs');
        const analyzer = createContextAnalyzer();
        const reader = createContextRecordReader(session.source, session.cwd || '');
        const ledger = createSessionUsageLedger(session);
        let index = 0;
        for await (const record of deps.iterateSessionUsageRecords(session)) {
            for (const node of reader(record, index++)) analyzer.add(node);
            ledger.add(record);
        }
        if (stat) {
            const after = await deps.fs.promises.stat(session.filePath);
            if (`${after.size}:${after.mtimeMs}:${after.ctimeMs}` !== signature) throw new Error('Session changed during usage scan; refresh');
        }
        const report = { ...ledger.finish(), estimatedTextTokens: analyzer.finish().totalEstimatedTokens };
        if (signature) {
            cache.delete(key);
            cache.set(key, { signature, report });
            if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
        }
        return report;
    }
    async function read(params = {}) {
        // Validate filters before touching session files.
        mergeRows([], params);
        const sessions = await deps.listSessionUsage(params);
        const reports = await Promise.all(sessions.map(session => limit(async () => {
            try { return { ...await scan(session, params.forceRefresh), source: session.source, sessionId: session.sessionId || '' }; }
            catch (error) { return { error: error.message, source: session.source, sessionId: session.sessionId || '', rows: [] }; }
        })));
        const rows = mergeRows(reports, params);
        const totals = Object.fromEntries(FIELDS.map(field => [field, !rows.length || rows.some(row => row[field] === null)
            ? null : rows.reduce((sum, row) => sum + row[field], 0)]));
        return { attribution: 'records', timezone: 'UTC', estimator: 'cjk-1-non-cjk-4-v1', rows,
            summary: { ...totals, scannedSessions: reports.filter(report => !report.error).length,
                candidateSessions: sessions.length, unreportedSessions: reports.filter(report => !report.error && !report.observedRecords).length,
                unsupportedSessions: reports.filter(report => !report.error && !report.supported).length,
                failedSessions: reports.filter(report => report.error).map(({ source, sessionId, error }) => ({ source, sessionId, error })),
                undatedTokens: reports.flatMap(report => report.rows).filter(row => !row.date).reduce((sum, row) => sum + row.totalTokens, 0),
                estimatedTextTokens: reports.reduce((sum, report) => sum + (report.estimatedTextTokens || 0), 0) } };
    }
    return { read };
}

function exportSessionUsageReport(report, format = 'csv') {
    if (report.summary.failedSessions.length) return { error: 'Usage scan incomplete; inspect read-sessions-usage-report and refresh' };
    const extension = format === 'json' ? 'json' : 'csv';
    const csvCell = value => value === null ? '' : /[",\r\n]/.test(String(value)) ? '"' + String(value).replace(/"/g, '""') + '"' : String(value);
    const content = extension === 'json' ? JSON.stringify(report, null, 2) + '\n'
        : [COLUMNS.join(','), ...report.rows.map(row => COLUMNS.map(field => csvCell(row[field])).join(','))].join('\r\n') + '\r\n';
    return { format: extension, mimeType: extension === 'json' ? 'application/json' : 'text/csv',
        fileName: `usage-records.${extension}`, rows: report.rows, content };
}
module.exports = { createSessionUsageReportController, exportSessionUsageReport };
