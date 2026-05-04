const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const { assert } = require('./helpers');

let bundledAppOptionsPromise = null;

function getBundledAppOptions() {
    if (!bundledAppOptionsPromise) {
        const helperPath = path.resolve(__dirname, '..', 'unit', 'helpers', 'web-ui-app-options.mjs');
        bundledAppOptionsPromise = import(pathToFileURL(helperPath).href)
            .then((mod) => mod.captureCurrentBundledAppOptions());
    }
    return bundledAppOptionsPromise;
}

function createIso(baseMs, offsetSeconds) {
    return new Date(baseMs + (offsetSeconds * 1000)).toISOString();
}

function writeCodexSessionFile(sessionsDir, sessionId, records, updatedAtMs) {
    const filePath = path.join(sessionsDir, `${sessionId}.jsonl`);
    fs.writeFileSync(filePath, records.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf-8');
    try {
        const stamp = new Date(updatedAtMs);
        fs.utimesSync(filePath, stamp, stamp);
    } catch (_) {}
    return filePath;
}

function buildCodexSessionRecords(sessionId, updatedAtMs, messageCount, usage) {
    const records = [{
        type: 'session_meta',
        payload: {
            id: sessionId,
            model: 'gpt-4.1-mini',
            cwd: `/tmp/${sessionId}`,
            timestamp: createIso(updatedAtMs, 0)
        },
        timestamp: createIso(updatedAtMs, 0)
    }];
    for (let i = 0; i < messageCount; i += 1) {
        records.push({
            type: 'response_item',
            payload: {
                type: 'message',
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `${sessionId}-msg-${String(i).padStart(3, '0')}`
            },
            timestamp: createIso(updatedAtMs, i + 1)
        });
    }
    if (usage && typeof usage === 'object') {
        const inputTokens = Number.isFinite(Number(usage.input_tokens)) ? Math.max(0, Math.floor(Number(usage.input_tokens))) : 0;
        const outputTokens = Number.isFinite(Number(usage.output_tokens)) ? Math.max(0, Math.floor(Number(usage.output_tokens))) : 0;
        records.push({
            type: 'event_msg',
            payload: {
                type: 'token_usage',
                info: {
                    total_token_usage: {
                        input_tokens: inputTokens,
                        output_tokens: outputTokens,
                        total_tokens: inputTokens + outputTokens
                    }
                }
            },
            timestamp: createIso(updatedAtMs, messageCount + 2)
        });
    }
    return records;
}

function createWebUiVm(appOptions) {
    const vm = {
        ...(typeof appOptions.data === 'function' ? appOptions.data() : {}),
        _scheduledFrames: [],
        _idleTasks: [],
        _messages: [],
        $refs: {}
    };

    for (const [name, fn] of Object.entries(appOptions.methods || {})) {
        vm[name] = fn;
    }

    for (const [name, getter] of Object.entries(appOptions.computed || {})) {
        Object.defineProperty(vm, name, {
            configurable: true,
            enumerable: true,
            get() {
                return getter.call(vm);
            }
        });
    }

    vm.$nextTick = function $nextTick(callback) {
        if (typeof callback === 'function') {
            callback();
        }
    };
    vm.scheduleAfterFrame = function scheduleAfterFrame(task) {
        this._scheduledFrames.push(task);
    };
    vm.scheduleIdleTask = function scheduleIdleTask(task) {
        this._idleTasks.push(task);
        return task;
    };
    vm.cancelIdleTask = function cancelIdleTask(handle) {
        this._idleTasks = this._idleTasks.filter((task) => task !== handle);
    };
    vm.showMessage = function showMessage(text, type) {
        this._messages.push({ text: String(text), type: type || 'info' });
    };
    vm.cancelSessionTimelineSync = function cancelSessionTimelineSync() {};
    vm.invalidateSessionTimelineMeasurementCache = function invalidateSessionTimelineMeasurementCache() {};
    vm.updateSessionTimelineOffset = function updateSessionTimelineOffset() {};
    vm.scheduleSessionTimelineSync = function scheduleSessionTimelineSync() {};
    vm.setSessionPanelFastHidden = function setSessionPanelFastHidden() {};
    vm.isSessionPanelFastHidden = function isSessionPanelFastHidden() { return false; };
    vm.clearSessionTimelineRefs = function clearSessionTimelineRefs() {};
    vm.resetSessionDetailPagination = function resetSessionDetailPagination() {};
    vm.resetSessionPreviewMessageRender = function resetSessionPreviewMessageRender() {};

    return vm;
}

async function flushScheduledFrames(vm) {
    let guard = 0;
    while (
        (Array.isArray(vm._scheduledFrames) && vm._scheduledFrames.length > 0)
        || (Array.isArray(vm._idleTasks) && vm._idleTasks.length > 0)
    ) {
        const task = (Array.isArray(vm._scheduledFrames) && vm._scheduledFrames.length > 0)
            ? vm._scheduledFrames.shift()
            : (Array.isArray(vm._idleTasks) ? vm._idleTasks.shift() : null);
        if (typeof task === 'function') {
            await Promise.resolve(task());
        }
        guard += 1;
        if (guard > 200) {
            throw new Error('scheduled frame queue did not settle');
        }
    }
}

module.exports = async function testWebUiUsageInteractions(ctx) {
    const { api, tmpHome } = ctx;
    const sessionsDir = path.join(tmpHome, '.codex', 'sessions');
    fs.mkdirSync(sessionsDir, { recursive: true });

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const nowStamp = new Date(now);
    const anchorMs = Date.UTC(nowStamp.getUTCFullYear(), nowStamp.getUTCMonth(), nowStamp.getUTCDate()) + (12 * 60 * 60 * 1000);
    const makeUsage = (total) => ({ input_tokens: Math.floor(total * 0.6), output_tokens: Math.floor(total * 0.4) });

    const hotOldId = 'usage-hot-old';
    const hotNewId = 'usage-hot-new';
    writeCodexSessionFile(
        sessionsDir,
        hotOldId,
        buildCodexSessionRecords(hotOldId, anchorMs - (20 * 60 * 60 * 1000), 220, makeUsage(18000)),
        anchorMs - (20 * 60 * 60 * 1000)
    );
    writeCodexSessionFile(
        sessionsDir,
        hotNewId,
        buildCodexSessionRecords(hotNewId, anchorMs - (2 * 60 * 60 * 1000), 8, makeUsage(4000)),
        anchorMs - (2 * 60 * 60 * 1000)
    );

    for (let i = 0; i < 14; i += 1) {
        const dayStart = anchorMs - (i * dayMs) + (10 * 60 * 1000);
        const sessionId = `usage-day-${String(i).padStart(2, '0')}`;
        const msgCount = i % 3 === 0 ? 35 : 12;
        const usageTotal = 2000 + (i * 300);
        writeCodexSessionFile(
            sessionsDir,
            sessionId,
            buildCodexSessionRecords(sessionId, dayStart, msgCount, makeUsage(usageTotal)),
            dayStart
        );
    }

    const sessionsRes = await api('list-sessions', { source: 'codex', forceRefresh: true, limit: 200 });
    assert(!sessionsRes.error, `list-sessions should succeed: ${sessionsRes.error || ''}`);
    assert(Array.isArray(sessionsRes.sessions) && sessionsRes.sessions.length > 0, 'list-sessions should return sessions');

    const appOptions = await getBundledAppOptions();
    const vm = createWebUiVm(appOptions);
    vm.t = null;
    vm.lang = 'en';
    vm.sessionsList = sessionsRes.sessions;
    vm.sessionPinnedMap = {};
    vm.sessionSortMode = 'hot';

    const hotOld = sessionsRes.sessions.find((item) => item && item.sessionId === hotOldId);
    const hotNew = sessionsRes.sessions.find((item) => item && item.sessionId === hotNewId);
    assert(hotOld && Number(hotOld.totalTokens || 0) > 0, 'hot sort fixtures should expose totalTokens for the older session');
    assert(hotNew && Number(hotNew.totalTokens || 0) > 0, 'hot sort fixtures should expose totalTokens for the newer session');

    const sorted = vm.sortedSessionsList;
    assert(sorted && sorted.length > 0, 'sortedSessionsList should be available');
    const oldIdx = sorted.findIndex((item) => item && item.sessionId === hotOldId);
    const newIdx = sorted.findIndex((item) => item && item.sessionId === hotNewId);
    assert(oldIdx >= 0 && newIdx >= 0, 'hot sort fixtures should be present in the sorted list');
    assert(oldIdx < newIdx, 'hot sort should rank the denser (but older) session before the lighter recent session');

    const usageRes = await api('list-sessions-usage', { source: 'codex', forceRefresh: true, limit: 2000 });
    assert(!usageRes.error, `list-sessions-usage should succeed: ${usageRes.error || ''}`);
    assert(Array.isArray(usageRes.sessions) && usageRes.sessions.length > 0, 'list-sessions-usage should return sessions');

    vm.sessionsUsageList = usageRes.sessions;
    vm.sessionsUsageTimeRange = '7d';
    vm.sessionsUsageCompareEnabled = true;

    const daily = vm.sessionUsageDaily;
    assert(daily && Array.isArray(daily.rows) && daily.rows.length > 0, 'sessionUsageDaily should have rows');
    assert(daily.rows[0].compareEnabled === true, 'compare mode should mark daily rows as compare-enabled');
    assert(
        daily.rows.some((row) => row && Number(row.prevTokenTotal || 0) > 0),
        'compare mode should compute non-zero previous-period tokens for at least one day'
    );
    const rowWithPrev = daily.rows.find((row) => row && Number(row.prevTokenTotal || 0) > 0) || null;
    assert(!!rowWithPrev, 'compare mode should include at least one row with previous-period totals');
    assert(String(rowWithPrev.prevTokenTitle || '').trim(), 'compare mode should provide formatted prevTokenTitle for tooltips');
    assert(String(rowWithPrev.prevCostTitle || '').trim(), 'compare mode should provide formatted prevCostTitle for tooltips');

    const pickedDay = daily.rows.find((row) => row && Number(row.sessionCount || 0) > 0) || daily.rows[0];
    const targetDayKey = pickedDay.key;
    vm.selectSessionsUsageDay(targetDayKey);
    await flushScheduledFrames(vm);

    const selected = vm.sessionsUsageSelectedDaySummary;
    assert(selected && selected.dayKey === targetDayKey, 'selected day summary should resolve the day key');
    assert(Number(selected.sessionCount) >= 1, 'selected day summary should contain at least one session');
    assert(Array.isArray(selected.topSessions), 'selected day summary should include top sessions list');
};
