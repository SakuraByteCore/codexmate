import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { contextWindowReference } from '../../web-ui/logic.context-window.mjs';
const require = createRequire(import.meta.url);
const { createSessionFeatureSettings } = require('../../lib/session-feature-settings');

test('context reference preserves thresholds, unknown models and ratios above 100 percent', () => {
    for (const [tokens, status] of [[79999, 'normal'], [80000, 'warning'], [80001, 'warning'], [94999, 'warning'], [95000, 'high'], [95001, 'high'], [120000, 'high']]) {
        const result = contextWindowReference({ totalEstimatedTokens: tokens }, { window: 100000 });
        assert.equal(result.status, status); assert.equal(result.percentage, tokens / 1000);
    }
    assert.equal(contextWindowReference({ totalEstimatedTokens: 1 }).status, 'unknown');
    assert.equal(contextWindowReference({ totalEstimatedTokens: 1, models: ['a', 'b'] }, { window: 100 }).status, 'unknown');
    assert.equal(contextWindowReference({ totalEstimatedTokens: 80, models: ['a'], modelWindows: { a: 100 } }).source, 'record');
    for (const window of [0, -1, 1.5, Infinity, 'wrong']) assert.throws(() => contextWindowReference({ totalEstimatedTokens: 1 }, { window }), /invalid/);
});
test('window overrides and dismissed reminders persist without changing tool settings', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'window-prefs-'));
    try {
        const api = createSessionFeatureSettings(root);
        const saved = api.save({ key: 'pi:one:model', window: 100000, dismissed: true, revision: '' });
        const restarted = createSessionFeatureSettings(root);
        assert.equal(restarted.get().settings.windows['pi:one:model'], 100000);
        assert.equal(restarted.get().settings.dismissed['pi:one:model'], true);
        assert.throws(() => restarted.save({ key: 'pi:one:model', window: '', dismissed: false, revision: '' }), /conflict/);
        restarted.save({ key: 'pi:one:model', window: '', dismissed: false, revision: saved.revision });
        assert.equal(restarted.get().settings.windows['pi:one:model'], undefined);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
