import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createSessionBrowserMethods } from '../../web-ui/modules/app.methods.session-browser.mjs';
const require = createRequire(import.meta.url);
const { createSessionUsageLedger } = require('../../lib/session-usage-ledger');
const { createSessionUsageReportController, exportSessionUsageReport } = require('../../lib/session-usage-report');
const { parseAnalyticsExportArgs } = require('../../cli/analytics-export-args');
const codex = (timestamp, total, cached = 0) => ({ type: 'event_msg', timestamp, payload: { type: 'token_count',
    info: { total_token_usage: { input_tokens: total - 10, output_tokens: 10, cached_input_tokens: cached, total_tokens: total } } } });

test('Codex records cross UTC days, ignore repeated cumulative snapshots and handle resets', () => {
    const ledger = createSessionUsageLedger({ source: 'codex', model: 'gpt-test' });
    ledger.add(codex('2026-05-01T23:59:00Z', 100, 50));
    ledger.add(codex('2026-05-02T00:00:00Z', 100, 50));
    ledger.add(codex('2026-05-02T00:01:00Z', 150, 70));
    ledger.add(codex('2026-05-02T00:02:00Z', 30, 5));
    const rows = ledger.finish().rows;
    assert.deepEqual(rows.map(row => [row.date, row.totalTokens, row.cachedInputTokens]),
        [['2026-05-01', 100, 50], ['2026-05-02', 80, 25]]);
    assert.equal(rows[0].inputTokens + rows[0].outputTokens, rows[0].totalTokens, 'cached input must not be added twice');
});

test('Claude/Pi cache categories, duplicate message snapshots and absent metadata stay explicit', () => {
    const ledger = createSessionUsageLedger({ source: 'claude', models: ['a', 'b'] });
    const record = { type: 'assistant', timestamp: '2026-05-01T12:00:00Z', message: { id: 'request-1',
        usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 20, cache_creation_input_tokens: 3 } } };
    ledger.add(record); ledger.add(record);
    const [row] = ledger.finish().rows;
    assert.equal(row.model, 'unknown');
    assert.equal(row.totalTokens, 38);
    assert.equal(row.cacheCreationInputTokens, 3);
    assert.equal(row.usageEvents, 1);
    const pi = createSessionUsageLedger({ source: 'pi', model: 'pi-model' });
    pi.add({ type: 'message', id: 'pi-1', message: { role: 'assistant', usage: { input: 10, output: 5, cacheRead: 20, cacheWrite: 3 } } });
    assert.equal(pi.finish().rows[0].totalTokens, 38);
    assert.equal(pi.finish().rows[0].date, '', 'unknown dates must not use session updatedAt');
    const missing = createSessionUsageLedger({ source: 'claude' });
    missing.add({ type: 'user', usage: { total_tokens: 123 } });
    assert.equal(missing.finish().observedRecords, 0);
});

test('report separates saved-text estimates, filters record dates and blocks partial exports', async () => {
    let scans = 0;
    const sessions = [{ source: 'codex', sessionId: 'ok', filePath: '/fixture', model: 'gpt-test', updatedAt: '2026-05-03' }];
    let version = 1;
    const controller = createSessionUsageReportController({
        fs: { promises: { stat: async () => ({ size: version, mtimeMs: version, ctimeMs: version }) } },
        listSessionUsage: async () => sessions,
        async *iterateSessionUsageRecords(session) {
            scans++;
            if (session.sessionId === 'bad') throw new Error('fixture read failure');
            yield { type: 'response_item', payload: { role: 'user', content: 'saved visible text' } };
            yield codex('2026-05-01T23:59:00Z', 100, 20);
            yield codex('2026-05-02T00:00:00Z', 140, 30);
        }
    });
    const first = await controller.read({ from: '2026-05-01', to: '2026-05-01' });
    assert.equal(first.summary.totalTokens, 100);
    assert.ok(first.summary.estimatedTextTokens > 0);
    assert.equal(first.timezone, 'UTC');
    assert.match(exportSessionUsageReport(first).content, /^date,source,model,inputTokens/);
    await controller.read({ from: '2026-05-02', to: '2026-05-02' });
    assert.equal(scans, 1, 'unchanged files should reuse numeric scan results');
    version++;
    await controller.read({});
    assert.equal(scans, 2, 'changed files must invalidate the cache');
    await controller.read({ forceRefresh: true });
    assert.equal(scans, 3);
    sessions.push({ source: 'claude', sessionId: 'bad', filePath: '/bad' });
    const partial = await controller.read({});
    assert.equal(partial.summary.failedSessions.length, 1);
    assert.match(exportSessionUsageReport(partial).error, /incomplete/);
    await assert.rejects(controller.read({ from: 'invalid' }), /Invalid usage date/);
    assert.equal(parseAnalyticsExportArgs(['--attribution=records']).error, '');
    assert.match(parseAnalyticsExportArgs(['--attribution=invalid']).error, /attribution/);
});

test('usage disclosure loads on demand and switches range without accepting stale results', async () => {
    const pending = [];
    const methods = createSessionBrowserMethods({ api: (action, params) => {
        assert.equal(action, 'read-sessions-usage-report');
        return new Promise(resolve => pending.push({ resolve, params }));
    } });
    const state = { ...methods, sessionsUsageTimeRange: '7d', usageRecords: null, usageRecordsLoading: false,
        usageRecordsRange: '', usageRecordsOpen: true, t: key => key };
    const loading = state.loadUsageRecords();
    state.sessionsUsageTimeRange = 'all';
    pending[0].resolve({ summary: {}, rows: ['stale'] });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(pending.length, 2);
    pending[1].resolve({ summary: {}, rows: ['current'] });
    await loading;
    assert.deepEqual(state.usageRecords.rows, ['current']);
    assert.equal(state.usageRecordsRange, 'all');
    await state.toggleUsageRecords({ target: { open: false } });
    await state.toggleUsageRecords({ target: { open: true } });
    assert.equal(pending.length, 2, 'reopening should reuse the current result');
});

test('unknown totals, unsupported sources and duplicate partial snapshots never fabricate usage', async () => {
    const missing = createSessionUsageLedger({ source: 'claude' });
    missing.add({ type: 'assistant', id: 'partial', usage: { total_tokens: 20 } });
    missing.add({ type: 'assistant', id: 'partial', usage: { total_tokens: 20 } });
    assert.equal(missing.finish().rows[0].inputTokens, null);
    assert.equal(missing.finish().rows[0].cachedInputTokens, null);
    assert.equal(missing.finish().rows[0].usageEvents, 1);
    const unsupported = createSessionUsageLedger({ source: 'zed' });
    unsupported.add({ role: 'assistant', usage: { total_tokens: 90 } });
    assert.equal(unsupported.finish().supported, false);
    assert.deepEqual(unsupported.finish().rows, []);
    const controller = createSessionUsageReportController({ listSessionUsage: async () => [], fs: {},
        async *iterateSessionUsageRecords() {} });
    assert.equal((await controller.read()).summary.totalTokens, null, 'no usage is unknown, not zero consumption');
    await assert.rejects(controller.read({ from: '2026-05-01T12:00:00Z' }), /YYYY-MM-DD/);
    assert.match(parseAnalyticsExportArgs(['--attribution']).error, /attribution/);
});
