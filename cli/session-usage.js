const { createConcurrencyLimiter } = require('./session-usage.concurrent');
const { normalizeSessionModelList, createSessionModelsFileReader } = require('./session-usage.models');

async function listSessionUsageCore(params = {}, deps = {}) {
    const {
        fs,
        listSessionBrowse,
        parseCodexSessionSummary,
        parseClaudeSessionSummary,
        parseCodeBuddySessionSummary,
        parseGeminiSessionSummary,
        parsePiSessionSummary,
        MAX_SESSION_USAGE_LIST_SIZE,
        SESSION_BROWSE_SUMMARY_READ_BYTES
    } = deps;

    const source = params.source === 'codex' || params.source === 'claude' || params.source === 'gemini' || params.source === 'codebuddy' || params.source === 'pi'
        ? params.source
        : 'all';
    const rawLimit = Number(params.limit);
    const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(rawLimit, MAX_SESSION_USAGE_LIST_SIZE))
        : MAX_SESSION_USAGE_LIST_SIZE;

    const sessions = await listSessionBrowse({
        source,
        limit,
        forceRefresh: !!params.forceRefresh
    });
    if (!Array.isArray(sessions) || sessions.length === 0) {
        return [];
    }

    const { readSessionModelsFromFile } = createSessionModelsFileReader(fs, {
        concurrency: 32,
        maxEntries: 1500,
        probeHeadBytes: 128 * 1024,
        probeTailBytes: 128 * 1024
    });

    // CPU/IO 优化策略（面向 2000 会话）：
    // 1) 优先使用 listSessionBrowse 返回的 model/models（零 I/O）
    // 2) 仅当缺少模型名时才读取/解析文件（必要时全文件扫描）
    const limitNormalize = createConcurrencyLimiter(64);
    const normalizedSessions = await Promise.all(
        sessions.map((item) => limitNormalize(async () => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                return null;
            }
            const normalized = { ...item };
            delete normalized.__messageCountExact;

            const baseModels = normalizeSessionModelList([
                ...(Array.isArray(normalized.models) ? normalized.models : []),
                normalized.model,
                normalized.modelName,
                normalized.modelId
            ]);
            if (baseModels.length > 0) {
                normalized.models = baseModels;
                normalized.model = baseModels[0];
                return normalized;
            }

            const filePath = typeof normalized.filePath === 'string' ? normalized.filePath.trim() : '';
            if (!filePath) {
                return null;
            }

            // 快速路径：全文件正则扫描（并发 + 缓存）。只对“缺模型”的会话触发。
            const fullFileModels = await readSessionModelsFromFile(filePath);
            if (fullFileModels.length > 0) {
                normalized.models = fullFileModels;
                normalized.model = fullFileModels[0];
                return normalized;
            }

            // 兜底：摘要解析（可能补 provider 等字段）
            const summaryOptions = {
                summaryReadBytes: SESSION_BROWSE_SUMMARY_READ_BYTES,
                titleReadBytes: SESSION_BROWSE_SUMMARY_READ_BYTES
            };
            let summary = null;
            try {
                summary = normalized.source === 'claude'
                    ? parseClaudeSessionSummary(filePath, summaryOptions)
                    : (normalized.source === 'gemini'
                        ? parseGeminiSessionSummary(filePath, summaryOptions)
                        : (normalized.source === 'codebuddy'
                            ? parseCodeBuddySessionSummary(filePath, summaryOptions)
                            : (normalized.source === 'pi'
                                ? parsePiSessionSummary(filePath, summaryOptions)
                                : parseCodexSessionSummary(filePath, summaryOptions))));
            } catch (_) {
                summary = null;
            }
            if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
                return null;
            }
            const summaryModels = normalizeSessionModelList([
                ...(Array.isArray(summary.models) ? summary.models : []),
                summary.model
            ]);
            if (summaryModels.length === 0) {
                return null;
            }
            normalized.models = summaryModels;
            normalized.model = summaryModels[0];
            if ((!normalized.provider || !String(normalized.provider).trim()) && typeof summary.provider === 'string' && summary.provider.trim()) {
                normalized.provider = summary.provider.trim();
            }
            return normalized;
        }))
    );

    return normalizedSessions.filter(Boolean);
}

function readNonNegativeInteger(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return 0;
    }
    return Math.floor(numeric);
}

function parseUsageExportDate(value, boundary) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    if (value instanceof Date) {
        const time = value.getTime();
        return Number.isFinite(time) ? time : NaN;
    }
    const raw = String(value).trim();
    if (!raw) {
        return null;
    }
    const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
        const year = Number(dateOnly[1]);
        const month = Number(dateOnly[2]) - 1;
        const day = Number(dateOnly[3]);
        const start = Date.UTC(year, month, day);
        const normalized = new Date(start);
        if (!Number.isFinite(start)
            || normalized.getUTCFullYear() !== year
            || normalized.getUTCMonth() !== month
            || normalized.getUTCDate() !== day) {
            return NaN;
        }
        return boundary === 'end' ? start + 24 * 60 * 60 * 1000 : start;
    }
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function formatUsageExportDay(timestamp) {
    return new Date(timestamp).toISOString().slice(0, 10);
}

function normalizeUsageExportFormat(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return normalized === 'json' ? 'json' : 'csv';
}

function normalizeUsageExportModelFilters(params = {}) {
    const raw = [];
    const push = (value) => {
        if (Array.isArray(value)) {
            value.forEach(push);
            return;
        }
        if (typeof value !== 'string') {
            return;
        }
        value.split(',').forEach((item) => {
            const normalized = item.trim().toLowerCase();
            if (normalized) raw.push(normalized);
        });
    };
    push(params.model);
    push(params.models);
    // API-facing alias: callers may pass modelType when they reuse usage filters
    // outside the CLI flag surface.
    push(params.modelType);
    return [...new Set(raw)];
}

function sessionMatchesUsageExportModelFilters(session, filters) {
    if (!filters.length) {
        return true;
    }
    const models = [];
    if (typeof session.model === 'string') models.push(session.model);
    if (Array.isArray(session.models)) models.push(...session.models.filter(item => typeof item === 'string'));
    const normalizedModels = models.map(item => item.trim().toLowerCase()).filter(Boolean);
    return filters.some(filter => normalizedModels.some(model => model === filter || model.includes(filter)));
}

function escapeUsageCsvCell(value) {
    const raw = value === undefined || value === null ? '' : String(value);
    if (!/[",\n\r]/.test(raw)) {
        return raw;
    }
    return `"${raw.replace(/"/g, '""')}"`;
}

function serializeUsageExportRowsToCsv(rows) {
    const columns = ['date', 'model', 'tokens', 'sessions'];
    const lines = [columns.join(',')];
    for (const row of rows) {
        lines.push(columns.map(column => escapeUsageCsvCell(row[column])).join(','));
    }
    return lines.join('\r\n') + '\r\n';
}

function buildUsageExportRows(sessions = [], params = {}) {
    const fromTime = parseUsageExportDate(params.from ?? params.startDate, 'start');
    const toTime = parseUsageExportDate(params.to ?? params.endDate, 'end');
    if (Number.isNaN(fromTime)) {
        return { error: 'Invalid from date' };
    }
    if (Number.isNaN(toTime)) {
        return { error: 'Invalid to date' };
    }
    if (fromTime !== null && toTime !== null && fromTime >= toTime) {
        return { error: 'from date must be before to date' };
    }

    const modelFilters = normalizeUsageExportModelFilters(params);
    const groups = new Map();
    for (const session of Array.isArray(sessions) ? sessions : []) {
        if (!session || typeof session !== 'object' || Array.isArray(session)) {
            continue;
        }
        if (!sessionMatchesUsageExportModelFilters(session, modelFilters)) {
            continue;
        }
        const timestamp = Date.parse(session.updatedAt || session.createdAt || '');
        if (!Number.isFinite(timestamp)) {
            continue;
        }
        if (fromTime !== null && timestamp < fromTime) {
            continue;
        }
        if (toTime !== null && timestamp >= toTime) {
            continue;
        }
        const model = typeof session.model === 'string' && session.model.trim()
            ? session.model.trim()
            : (Array.isArray(session.models) && typeof session.models[0] === 'string' ? session.models[0].trim() : 'unknown');
        if (!model) {
            continue;
        }
        const date = formatUsageExportDay(timestamp);
        const key = `${date}\u0000${model}`;
        const current = groups.get(key) || { date, model, tokens: 0, sessions: 0 };
        current.tokens += readNonNegativeInteger(session.totalTokens ?? session.tokens);
        current.sessions += 1;
        groups.set(key, current);
    }

    const rows = [...groups.values()].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.model.localeCompare(b.model);
    });
    return { rows };
}

async function exportSessionUsageCore(params = {}, deps = {}) {
    const listSessionUsage = typeof deps.listSessionUsage === 'function'
        ? deps.listSessionUsage
        : (options) => listSessionUsageCore(options, deps);
    const sessions = Array.isArray(params.sessions)
        ? params.sessions
        : await listSessionUsage({
            source: params.source,
            limit: params.limit,
            forceRefresh: !!params.forceRefresh
        });
    const built = buildUsageExportRows(sessions, params);
    if (built.error) {
        return { error: built.error };
    }
    const format = normalizeUsageExportFormat(params.format);
    const rows = built.rows;
    const content = format === 'json'
        ? JSON.stringify({ rows }, null, 2) + '\n'
        : serializeUsageExportRowsToCsv(rows);
    const extension = format === 'json' ? 'json' : 'csv';
    return {
        format,
        mimeType: format === 'json' ? 'application/json' : 'text/csv',
        fileName: `usage-export.${extension}`,
        rows,
        content
    };
}

module.exports = {
    listSessionUsageCore,
    buildUsageExportRows,
    exportSessionUsageCore,
    serializeUsageExportRowsToCsv
};
