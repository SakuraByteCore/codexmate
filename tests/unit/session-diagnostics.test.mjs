import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSessionDiagnostics, redactDiagnostic } = require('../../lib/session-diagnostics');

test('diagnostics only execute selected remote checks, redact reports and preserve cancellation states', async () => {
    let calls = 0; let api;
    api = createSessionDiagnostics({ home: '/private/home', secrets: () => ['fixture-secret'], mcpTargets: () => ['fixture'],
        local: async () => ({ ok: true, detail: '/private/home config', apiKey: 'fixture-secret' }),
        provider: async () => { calls++; return { ok: false, code: 'auth-failed', detail: 'Bearer fixture-secret' }; },
        mcp: async () => { calls++; return { ok: true, tools: ['read'] }; } });
    api.start(); await api.wait(); assert.equal(calls, 0);
    assert.equal(api.status().report.items[1].status, 'not_checked');
    api.start({ remote: true, mcpNames: ['fixture'] }); await api.wait(); assert.equal(calls, 2);
    assert.equal(api.status().report.status, 'partial');
    assert.ok(!JSON.stringify(api.status()).includes('fixture-secret')); assert.ok(!JSON.stringify(api.status()).includes('/private/home'));
    assert.throws(() => api.start({ mcpNames: ['unknown'] }), /input-invalid/);
    const cancelled = createSessionDiagnostics({ local: async () => { cancelled.cancel(); return { ok: true }; },
        provider: async () => { throw new Error('must not run'); }, mcpTargets: () => [], home: '' });
    cancelled.start({ remote: true }); await cancelled.wait();
    assert.equal(cancelled.status().report.status, 'cancelled'); assert.equal(cancelled.status().report.items[1].status, 'cancelled');
    const cleaned = JSON.stringify(redactDiagnostic({ error: 'https://user:pass@host/?token=abc', authorization: 'unsafe' }));
    for (const secret of ['user:pass', 'token=abc', 'unsafe']) assert.ok(!cleaned.includes(secret));
});
