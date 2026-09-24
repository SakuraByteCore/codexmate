const { createConcurrencyLimiter } = require('./session-usage.concurrent');

const CODE_STATS_SCAN_CONCURRENCY = 12;
const CODE_STATS_TIME_BUDGET_MS = 8000;
const CODE_STATS_CACHE_FILE_NAME = 'session-code-stats-cache.json';
const CODE_STATS_CACHE_VERSION = 1;
const CODE_STATS_CACHE_MAX_ENTRIES = 4096;

const CLAUDE_FILE_EDIT_TOOL_NAMES = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const CODEX_PATCH_HEADER_RE = /^\*\*\* (Add|Update|Delete) File: ?(.*)$/;

function countTextLines(value) {
    if (typeof value !== 'string' || value === '') {
        return 0;
    }
    let count = 0;
    let sawContent = false;
    for (let index = 0; index < value.length; index += 1) {
        if (value.charCodeAt(index) === 10) {
            count += 1;
            sawContent = true;
        }
    }
    if (!sawContent || value.charCodeAt(value.length - 1) !== 10) {
        count += 1;
    }
    return count;
}

function createEmptyStats() {
    return {
        filesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0,
        files: new Set()
    };
}

function normalizeStatsResult(stats) {
    return {
        filesChanged: stats.files.size,
        linesAdded: stats.linesAdded,
        linesRemoved: stats.linesRemoved
    };
}

function recordFilePath(stats, filePath) {
    if (typeof filePath !== 'string') return;
    const normalized = filePath.trim();
    if (normalized) stats.files.add(normalized);
}

function applyClaudeToolUseBlock(stats, block) {
    if (!block || typeof block !== 'object' || typeof block.name !== 'string') return;
    const name = block.name;
    if (!CLAUDE_FILE_EDIT_TOOL_NAMES.has(name)) return;
    const input = block.input && typeof block.input === 'object' ? block.input : {};
    if (name === 'NotebookEdit') {
        recordFilePath(stats, input.notebook_path || input.file_path);
        return;
    }
    recordFilePath(stats, input.file_path);
    if (name === 'Edit') {
        stats.linesAdded += countTextLines(input.new_string);
        stats.linesRemoved += countTextLines(input.old_string);
        return;
    }
    if (name === 'MultiEdit') {
        const edits = Array.isArray(input.edits) ? input.edits : [];
        for (const edit of edits) {
            if (!edit || typeof edit !== 'object') continue;
            stats.linesAdded += countTextLines(edit.new_string);
            stats.linesRemoved += countTextLines(edit.old_string);
        }
        return;
    }
    if (name === 'Write') {
        stats.linesAdded += countTextLines(input.content);
    }
}

function applyClaudeRecord(stats, record) {
    const message = record && record.message && typeof record.message === 'object'
        ? record.message
        : null;
    const content = message && Array.isArray(message.content) ? message.content : null;
    if (!content) return;
    for (const block of content) {
        if (block && typeof block === 'object' && block.type === 'tool_use') {
            applyClaudeToolUseBlock(stats, block);
        }
    }
}

function extractCodexPatchText(payload) {
    if (!payload || typeof payload !== 'object') return '';
    const type = typeof payload.type === 'string' ? payload.type : '';
    if (type !== 'function_call' && type !== 'custom_tool_call') return '';
    const name = typeof payload.name === 'string' ? payload.name : '';
    if (typeof payload.input === 'string' && payload.input.includes('*** Begin Patch')) {
        return payload.input;
    }
    const argumentsText = typeof payload.arguments === 'string' ? payload.arguments : '';
    if (!argumentsText) return '';
    if (name !== 'apply_patch' && !argumentsText.includes('*** Begin Patch')) return '';
    try {
        const parsed = JSON.parse(argumentsText);
        if (parsed && typeof parsed === 'object' && typeof parsed.input === 'string') {
            return parsed.input.includes('*** Begin Patch') ? parsed.input : '';
        }
        if (typeof parsed === 'string' && parsed.includes('*** Begin Patch')) {
            return parsed;
        }
    } catch (_) {
        if (name === 'apply_patch' && argumentsText.includes('*** Begin Patch')) {
            return argumentsText;
        }
    }
    return '';
}

function applyCodexPatchText(stats, patchText) {
    if (typeof patchText !== 'string' || !patchText.includes('*** Begin Patch')) return;
    const lines = patchText.split('\n');
    for (const rawLine of lines) {
        const headerMatch = rawLine.match(CODEX_PATCH_HEADER_RE);
        if (headerMatch) {
            recordFilePath(stats, headerMatch[2]);
            continue;
        }
        if (rawLine.startsWith('***')) continue;
        if (rawLine.startsWith('+++') || rawLine.startsWith('---')) continue;
        if (rawLine.startsWith('+')) {
            stats.linesAdded += 1;
        } else if (rawLine.startsWith('-')) {
            stats.linesRemoved += 1;
        }
    }
}

function applyCodexRecord(stats, record) {
    if (!record || record.type !== 'response_item') return;
    applyCodexPatchText(stats, extractCodexPatchText(record.payload));
}

function shouldParseLineForSource(line, source) {
    if (source === 'claude') {
        return line.includes('"tool_use"');
    }
    if (source === 'codex') {
        return line.includes('apply_patch') || line.includes('*** Begin Patch');
    }
    return false;
}

function parseJsonLine(line) {
    try {
        const parsed = JSON.parse(line);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) {
        return null;
    }
}

async function computeCodeStatsFromLines(lines, source) {
    const stats = createEmptyStats();
    for await (const rawLine of lines) {
        const line = typeof rawLine === 'string' ? rawLine : '';
        if (!line || !shouldParseLineForSource(line, source)) continue;
        const record = parseJsonLine(line);
        if (!record) continue;
        if (source === 'claude') {
            applyClaudeRecord(stats, record);
        } else if (source === 'codex') {
            applyCodexRecord(stats, record);
        }
    }
    return normalizeStatsResult(stats);
}

async function computeSessionCodeStatsFromFile(filePath, source, deps = {}) {
    const fs = deps.fs;
    const readline = deps.readline;
    if (!fs || !readline || typeof filePath !== 'string' || !filePath) {
        throw new Error('computeSessionCodeStatsFromFile requires fs, readline and filePath');
    }
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
        return await computeCodeStatsFromLines(rl, source);
    } finally {
        rl.close();
        stream.destroy();
    }
}

function readCodeStatsCache(cachePath, deps = {}) {
    const fs = deps.fs;
    if (!fs) return { version: CODE_STATS_CACHE_VERSION, entries: {} };
    try {
        const raw = fs.readFileSync(cachePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object'
            || parsed.version !== CODE_STATS_CACHE_VERSION
            || !parsed.entries || typeof parsed.entries !== 'object') {
            return { version: CODE_STATS_CACHE_VERSION, entries: {} };
        }
        return { version: CODE_STATS_CACHE_VERSION, entries: parsed.entries };
    } catch (_) {
        return { version: CODE_STATS_CACHE_VERSION, entries: {} };
    }
}

function writeCodeStatsCache(cachePath, cache, deps = {}) {
    const fs = deps.fs;
    const path = deps.path;
    if (!fs || !path) return;
    try {
        const entries = cache.entries || {};
        const keys = Object.keys(entries);
        if (keys.length > CODE_STATS_CACHE_MAX_ENTRIES) {
            keys.sort((a, b) => (entries[a].lastUsed || 0) - (entries[b].lastUsed || 0));
            for (const key of keys.slice(0, keys.length - CODE_STATS_CACHE_MAX_ENTRIES)) {
                delete entries[key];
            }
        }
        fs.mkdirSync(path.dirname(cachePath), { recursive: true });
        const tempPath = `${cachePath}.tmp`;
        fs.writeFileSync(tempPath, JSON.stringify({ version: CODE_STATS_CACHE_VERSION, entries }) + '\n');
        fs.renameSync(tempPath, cachePath);
    } catch (_) {
        // Cache persistence is a best-effort optimization; failures force a re-scan.
    }
}

function normalizeCodeStatsRange(range) {
    const normalized = typeof range === 'string' ? range.trim().toLowerCase() : '';
    if (normalized === '30d' || normalized === 'all') return normalized;
    return '7d';
}

function computeCodeStatsSinceMs(range, now = Date.now()) {
    if (range === 'all') return 0;
    const rangeDays = range === '30d' ? 30 : 7;
    const dayMs = 24 * 60 * 60 * 1000;
    const stamp = new Date(now);
    const todayStart = Date.UTC(stamp.getUTCFullYear(), stamp.getUTCMonth(), stamp.getUTCDate());
    const startDay = todayStart - ((rangeDays - 1) * dayMs);
    const startShift = (new Date(startDay).getUTCDay() + 6) % 7;
    return startDay - (startShift * dayMs);
}

function resolveCodeStatsSessionTarget(session, sinceMs) {
    if (!session || typeof session !== 'object') return null;
    const source = typeof session.source === 'string' ? session.source.trim().toLowerCase() : '';
    if (source !== 'codex' && source !== 'claude') return null;
    const updatedAtMs = Date.parse(session.updatedAt || '');
    if (!Number.isFinite(updatedAtMs)) return null;
    if (sinceMs > 0 && updatedAtMs < sinceMs) return null;
    const sessionId = typeof session.sessionId === 'string' ? session.sessionId.trim() : '';
    const filePath = typeof session.filePath === 'string' ? session.filePath.trim() : '';
    if (!sessionId || !filePath) return null;
    return { key: `${source}:${sessionId}`, source, sessionId, filePath };
}

async function listSessionCodeStatsCore(params = {}, deps = {}) {
    const {
        fs,
        path,
        readline,
        listSessionBrowse,
        cacheDir,
        now = () => Date.now()
    } = deps;

    const source = params.source === 'codex' || params.source === 'claude' || params.source === 'all'
        ? params.source
        : 'all';
    const range = normalizeCodeStatsRange(params.range);
    const sinceMs = computeCodeStatsSinceMs(range, now());
    const rawLimit = Number(params.limit);
    const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(rawLimit, 2000))
        : (range === 'all' ? 2000 : (range === '30d' ? 1200 : 600));

    const sessions = await listSessionBrowse({
        source,
        limit,
        forceRefresh: !!params.forceRefresh
    });

    const targets = [];
    const seenKeys = new Set();
    for (const session of Array.isArray(sessions) ? sessions : []) {
        const target = resolveCodeStatsSessionTarget(session, sinceMs);
        if (!target || seenKeys.has(target.key)) continue;
        seenKeys.add(target.key);
        targets.push(target);
    }

    const cachePath = typeof cacheDir === 'string' && path
        ? path.join(cacheDir, CODE_STATS_CACHE_FILE_NAME)
        : null;
    const cache = cachePath ? readCodeStatsCache(cachePath, { fs }) : { version: CODE_STATS_CACHE_VERSION, entries: {} };
    const limitScan = createConcurrencyLimiter(CODE_STATS_SCAN_CONCURRENCY);
    const budgetMs = Number.isFinite(Number(params.timeBudgetMs))
        ? Math.max(500, Math.floor(Number(params.timeBudgetMs)))
        : CODE_STATS_TIME_BUDGET_MS;
    const startedAtMs = now();
    const results = new Map();
    const pendingTargets = [];
    let errorCount = 0;

    for (const target of targets) {
        let stat = null;
        try {
            stat = fs.statSync(target.filePath);
        } catch (_) {
            stat = null;
        }
        const entry = stat ? cache.entries[target.filePath] : null;
        if (stat && entry
            && Number(entry.size) === stat.size
            && Number(entry.mtimeMs) === Math.floor(stat.mtimeMs)) {
            entry.lastUsed = now();
            results.set(target.key, {
                ...target,
                filesChanged: Math.max(0, Math.floor(Number(entry.filesChanged) || 0)),
                linesAdded: Math.max(0, Math.floor(Number(entry.linesAdded) || 0)),
                linesRemoved: Math.max(0, Math.floor(Number(entry.linesRemoved) || 0))
            });
        } else {
            pendingTargets.push(target);
        }
    }

    const scanTasks = pendingTargets.map((target) => limitScan(async () => {
        if (now() - startedAtMs >= budgetMs) return;
        try {
            const stats = await computeSessionCodeStatsFromFile(target.filePath, target.source, { fs, readline });
            results.set(target.key, { ...target, ...stats });
            try {
                const stat = fs.statSync(target.filePath);
                cache.entries[target.filePath] = {
                    size: stat.size,
                    mtimeMs: Math.floor(stat.mtimeMs),
                    filesChanged: stats.filesChanged,
                    linesAdded: stats.linesAdded,
                    linesRemoved: stats.linesRemoved,
                    lastUsed: now()
                };
            } catch (_) {
                // File vanished during scan; skip caching so the next pass re-scans.
            }
        } catch (_) {
            errorCount += 1;
            results.set(target.key, { ...target, filesChanged: 0, linesAdded: 0, linesRemoved: 0 });
        }
    }));
    await Promise.all(scanTasks);

    if (cachePath) {
        writeCodeStatsCache(cachePath, cache, { fs, path });
    }

    return {
        stats: [...results.values()],
        computed: results.size,
        total: targets.length,
        errorCount,
        range
    };
}

module.exports = {
    CODE_STATS_TIME_BUDGET_MS,
    computeCodeStatsFromLines,
    computeSessionCodeStatsFromFile,
    computeCodeStatsSinceMs,
    countTextLines,
    applyCodexPatchText,
    extractCodexPatchText,
    listSessionCodeStatsCore
};
