import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { usagePricingMixin } from '../../web-ui/modules/usage-pricing.mjs';
const require = createRequire(import.meta.url);
const { estimateUsageRow, priceUsageReport } = require('../../lib/session-usage-pricing');
const catalog = { models: { model: { input_cost_per_token: 2e-6, output_cost_per_token: 8e-6, cache_read_input_token_cost: 0.2e-6, cache_creation_input_token_cost: 3e-6 } }, commit: 'fixture', currency: 'USD' };
const row = { model: 'model', source: 'codex', inputTokens: 100, outputTokens: 10, cachedInputTokens: 40, cacheCreationInputTokens: null, totalTokens: 110 };
const summary = { failedSessions: [], unreportedSessions: 0, unsupportedSessions: 0 };

test('price references use source cache semantics without charging cached input twice', () => {
    const codex = estimateUsageRow(row, catalog);
    assert.ok(Math.abs(codex.estimatedUsd - (60 * 2e-6 + 40 * 0.2e-6 + 10 * 8e-6)) < 1e-12);
    const claude = estimateUsageRow({ ...row, source: 'claude', cacheCreationInputTokens: 5, totalTokens: 155 }, catalog);
    assert.ok(Math.abs(claude.estimatedUsd - (100 * 2e-6 + 40 * 0.2e-6 + 5 * 3e-6 + 10 * 8e-6)) < 1e-12);
    assert.equal(estimateUsageRow({ ...row, source: 'gemini', totalTokens: 120 }, catalog).reason, 'usage-unclassified');
});

test('missing usage, unknown models, unpriced categories and partial reports stay unknown', () => {
    assert.equal(estimateUsageRow({ ...row, model: 'unknown' }, catalog).estimatedUsd, null);
    assert.equal(estimateUsageRow({ ...row, cachedInputTokens: null }, catalog).reason, 'usage-incomplete');
    const missingRate = { models: { model: { input_cost_per_token: 0, output_cost_per_token: 0 } } };
    assert.equal(estimateUsageRow(row, missingRate).reason, 'rate-missing');
    const report = priceUsageReport({ rows: [row, { ...row, model: 'unknown' }], summary, timezone: 'UTC' }, catalog);
    assert.equal(report.summary.estimatedUsd, null); assert.equal(report.summary.unknownRows, 1); assert.ok(report.summary.knownSubtotalUsd > 0);
    assert.equal(priceUsageReport({ rows: [], summary }, catalog).summary.estimatedUsd, null);
    assert.equal(priceUsageReport({ rows: [row], summary: { ...summary, failedSessions: [{}] } }, catalog).summary.complete, false);
    assert.equal(priceUsageReport({ rows: [row], summary }, catalog).priceSource.commit, 'fixture');
});

test('bundled price source preserves real provenance and matches a named model exactly', () => {
    const snapshot = require('../../lib/data/model-prices.json');
    assert.equal(snapshot.repository, 'https://github.com/Wei-Shaw/model-price-repo');
    assert.match(snapshot.commit, /^[a-f0-9]{40}$/); assert.match(snapshot.sha256, /^[a-f0-9]{64}$/);
    assert.match(snapshot.license, /MIT/); assert.ok(Object.keys(snapshot.models).length > 100);
    const known = estimateUsageRow({ ...row, model: 'gpt-5.2' }); assert.equal(known.reason, 'base-rate');
});

test('pricing range changes reject late replies and download the displayed report', async () => {
    const vm = { ...usagePricingMixin.data(), ...usagePricingMixin.methods, sessionsUsageTimeRange: '7d', t: key => key };
    const pending = []; vm.featureCall = (action, params) => { assert.equal(action, 'session-usage-pricing'); return new Promise(resolve => pending.push({ resolve, params })); };
    const first = vm.loadUsagePricing(); vm.sessionsUsageTimeRange = 'all'; const second = vm.loadUsagePricing();
    pending[1].resolve({ rows: ['current'] }); await second; pending[0].resolve({ rows: ['old'] }); await first;
    assert.deepEqual(vm.usagePricing.rows, ['current']); assert.ok(pending[0].params.from); assert.equal(pending[1].params.from, undefined);
    vm.downloadTextFile = (_name, content) => assert.deepEqual(JSON.parse(content), vm.usagePricing); vm.downloadUsagePricing();
});


test('record discovery refreshes new candidates without discarding unchanged numeric caches', async () => {
    const { createSessionUsageReportController } = require('../../lib/session-usage-report');
    const sessions = [{ source: 'pi', sessionId: 'first', filePath: '/first', model: 'model' }];
    let scans = 0;
    const controller = createSessionUsageReportController({
        fs: { promises: { stat: async () => ({ size: 1, mtimeMs: 1, ctimeMs: 1 }) } },
        listSessionUsage: async params => { assert.equal(params.forceRefresh, true); return sessions; },
        async *iterateSessionUsageRecords() { scans++; yield { type: 'message', id: 'one', timestamp: '2026-01-01', message: { role: 'assistant', usage: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } } }; }
    });
    assert.equal((await controller.read()).summary.candidateSessions, 1);
    sessions.push({ source: 'pi', sessionId: 'second', filePath: '/second', model: 'model' });
    assert.equal((await controller.read()).summary.candidateSessions, 2);
    assert.equal(scans, 2, 'only the new session needs a numeric scan');
});
