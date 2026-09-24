import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const statsModule = require(path.join(__dirname, '..', '..', 'cli', 'session-code-stats.js'));
const {
    countTextLines,
    computeCodeStatsFromLines,
    computeCodeStatsSinceMs,
    listSessionCodeStatsCore
} = statsModule;

const computedFactory = await import(pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.computed.session.mjs')));

function makeTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'session-code-stats-'));
}

function claudeToolLine(blocks) {
    return JSON.stringify({
        type: 'assistant',
        message: { role: 'assistant', content: blocks }
    });
}

test('countTextLines handles empty, single, trailing-newline and multi-line inputs', () => {
    assert.strictEqual(countTextLines(''), 0);
    assert.strictEqual(countTextLines('a'), 1);
    assert.strictEqual(countTextLines('a\n'), 1);
    assert.strictEqual(countTextLines('a\nb'), 2);
    assert.strictEqual(countTextLines('a\nb\n'), 2);
    assert.strictEqual(countTextLines('\n'), 1);
    assert.strictEqual(countTextLines(123), 0);
});

test('computeCodeStatsFromLines parses Claude Edit, Write, MultiEdit and ignores other tools', async () => {
    const lines = [
        JSON.stringify({ type: 'user', message: { role: 'user', content: 'hi' } }),
        claudeToolLine([
            { type: 'text', text: 'working' },
            {
                type: 'tool_use',
                name: 'Edit',
                input: { file_path: '/x/a.js', old_string: 'old1\nold2\n', new_string: 'new1\n' }
            }
        ]),
        claudeToolLine([
            { type: 'tool_use', name: 'Write', input: { file_path: '/x/b.js', content: 'l1\nl2\nl3' } }
        ]),
        claudeToolLine([
            {
                type: 'tool_use',
                name: 'MultiEdit',
                input: {
                    file_path: '/x/a.js',
                    edits: [
                        { old_string: 'p', new_string: 'q\nr' },
                        { old_string: 's\nt', new_string: 'u' }
                    ]
                }
            }
        ]),
        claudeToolLine([
            { type: 'tool_use', name: 'Read', input: { file_path: '/x/ignored.js' } }
        ]),
        claudeToolLine([
            { type: 'tool_use', name: 'NotebookEdit', input: { notebook_path: '/x/n.ipynb' } }
        ])
    ];
    const stats = await computeCodeStatsFromLines(lines, 'claude');
    assert.strictEqual(stats.filesChanged, 3);
    assert.strictEqual(stats.linesAdded, 7);
    assert.strictEqual(stats.linesRemoved, 5);
});

test('computeCodeStatsFromLines parses Codex apply_patch payloads and skips non-edit calls', async () => {
    const patch = [
        '*** Begin Patch',
        '*** Update File: src/app.js',
        '@@',
        ' context line',
        '-removed line',
        '+added line',
        '+another added line',
        '*** Add File: new.txt',
        '+hello',
        '+world',
        '*** End Patch'
    ].join('\n');
    const lines = [
        JSON.stringify({ type: 'response_item', payload: { type: 'message', role: 'user', content: 'go' } }),
        JSON.stringify({
            type: 'response_item',
            payload: {
                type: 'function_call',
                name: 'apply_patch',
                arguments: JSON.stringify({ input: patch })
            }
        }),
        JSON.stringify({
            type: 'response_item',
            payload: {
                type: 'function_call',
                name: 'shell',
                arguments: JSON.stringify({ command: 'ls -la' })
            }
        })
    ];
    const stats = await computeCodeStatsFromLines(lines, 'codex');
    assert.strictEqual(stats.filesChanged, 2);
    assert.strictEqual(stats.linesAdded, 4);
    assert.strictEqual(stats.linesRemoved, 1);
});

test('computeCodeStatsFromLines accepts Codex custom_tool_call with raw input string', async () => {
    const patch = '*** Begin Patch\n*** Delete File: gone.js\n*** End Patch\n';
    const lines = [
        JSON.stringify({
            type: 'response_item',
            payload: {
                type: 'custom_tool_call',
                name: 'apply_patch',
                input: patch
            }
        })
    ];
    const stats = await computeCodeStatsFromLines(lines, 'codex');
    assert.strictEqual(stats.filesChanged, 1);
    assert.strictEqual(stats.linesAdded, 0);
    assert.strictEqual(stats.linesRemoved, 0);
});

test('computeCodeStatsSinceMs week-aligns the 7d window start like the web-ui range window', () => {
    // 2026-01-08 is a Thursday. 7d startDay = 2026-01-02 (Friday), aligned back to Monday 2025-12-29.
    const since = computeCodeStatsSinceMs('7d', Date.UTC(2026, 0, 8, 15, 30, 0));
    assert.strictEqual(since, Date.UTC(2025, 11, 29));
    assert.strictEqual(computeCodeStatsSinceMs('all', Date.now()), 0);
});

test('listSessionCodeStatsCore aggregates stats, filters range and non-target sources, and persists cache', async () => {
    const dir = makeTempDir();
    const cacheDir = path.join(dir, 'cache');
    const claudeFile = path.join(dir, 'claude.jsonl');
    const codexFile = path.join(dir, 'codex.jsonl');
    const staleFile = path.join(dir, 'stale.jsonl');
    fs.writeFileSync(claudeFile, claudeToolLine([
        { type: 'tool_use', name: 'Edit', input: { file_path: '/x/a.js', old_string: 'a\n', new_string: 'b\nc\n' } }
    ]) + '\n');
    fs.writeFileSync(codexFile, JSON.stringify({
        type: 'response_item',
        payload: {
            type: 'function_call',
            name: 'apply_patch',
            arguments: JSON.stringify({ input: '*** Begin Patch\n*** Update File: src/c.js\n-old\n+new\n*** End Patch\n' })
        }
    }) + '\n');
    fs.writeFileSync(staleFile, claudeToolLine([
        { type: 'tool_use', name: 'Write', input: { file_path: '/x/stale.js', content: 'x\n' } }
    ]) + '\n');
    const nowIso = new Date().toISOString();
    const sessions = [
        { source: 'claude', sessionId: 'a', filePath: claudeFile, updatedAt: nowIso },
        { source: 'codex', sessionId: 'b', filePath: codexFile, updatedAt: nowIso },
        { source: 'pi', sessionId: 'pi', filePath: staleFile, updatedAt: nowIso },
        { source: 'claude', sessionId: 'stale', filePath: staleFile, updatedAt: '2020-01-01T00:00:00.000Z' }
    ];
    const deps = {
        fs,
        path,
        readline: require('readline'),
        cacheDir,
        listSessionBrowse: async () => sessions
    };

    const res1 = await listSessionCodeStatsCore({ source: 'all', range: '7d' }, deps);
    assert.strictEqual(res1.total, 2);
    assert.strictEqual(res1.computed, 2);
    assert.strictEqual(res1.errorCount, 0);
    const claudeStats = res1.stats.find((item) => item.key === 'claude:a');
    assert.strictEqual(claudeStats.filesChanged, 1);
    assert.strictEqual(claudeStats.linesAdded, 2);
    assert.strictEqual(claudeStats.linesRemoved, 1);
    const cachePath = path.join(cacheDir, 'session-code-stats-cache.json');
    assert.ok(fs.existsSync(cachePath));

    // Second pass: everything must come from cache (zero stream scans).
    let scans = 0;
    const fsProbe = new Proxy(fs, {
        get(target, prop) {
            if (prop === 'createReadStream') {
                return (...args) => {
                    scans += 1;
                    return target.createReadStream(...args);
                };
            }
            return target[prop];
        }
    });
    const res2 = await listSessionCodeStatsCore({ source: 'all', range: '7d' }, { ...deps, fs: fsProbe });
    assert.strictEqual(res2.computed, 2);
    assert.strictEqual(scans, 0);

    // Third pass: appending to the claude file invalidates only that entry via mtime.
    fs.appendFileSync(claudeFile, claudeToolLine([
        { type: 'tool_use', name: 'Write', input: { file_path: '/x/d.js', content: 'z\n' } }
    ]) + '\n');
    let scans3 = 0;
    const fsProbe3 = new Proxy(fs, {
        get(target, prop) {
            if (prop === 'createReadStream') {
                return (...args) => {
                    scans3 += 1;
                    return target.createReadStream(...args);
                };
            }
            return target[prop];
        }
    });
    const res3 = await listSessionCodeStatsCore({ source: 'all', range: '7d' }, { ...deps, fs: fsProbe3 });
    assert.strictEqual(scans3, 1);
    const claudeStats3 = res3.stats.find((item) => item.key === 'claude:a');
    assert.strictEqual(claudeStats3.filesChanged, 2);
    assert.strictEqual(claudeStats3.linesAdded, 3);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('listSessionCodeStatsCore honors the time budget and reports partial progress', async () => {
    const dir = makeTempDir();
    const cacheDir = path.join(dir, 'cache');
    const nowIso = new Date().toISOString();
    const sessions = [];
    for (let i = 0; i < 24; i += 1) {
        const file = path.join(dir, `s${i}.jsonl`);
        fs.writeFileSync(file, claudeToolLine([
            { type: 'tool_use', name: 'Write', input: { file_path: `/x/f${i}.js`, content: 'x\n' } }
        ]) + '\n');
        sessions.push({ source: 'claude', sessionId: `s${i}`, filePath: file, updatedAt: nowIso });
    }
    let tick = 0;
    const deps = {
        fs,
        path,
        readline: require('readline'),
        cacheDir,
        listSessionBrowse: async () => sessions,
        now: () => {
            tick += 1;
            // First two calls fix the window base; every later call advances past the budget.
            return tick <= 2 ? 1000 : 1000 + ((tick - 2) * 600);
        }
    };
    const res = await listSessionCodeStatsCore({ source: 'all', range: '7d', timeBudgetMs: 500 }, deps);
    assert.strictEqual(res.total, 24);
    assert.ok(res.computed < res.total, `expected partial compute, got ${res.computed}/${res.total}`);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('listSessionCodeStatsCore reports scan errors honestly as zero-stat entries', async () => {
    const dir = makeTempDir();
    const cacheDir = path.join(dir, 'cache');
    const nowIso = new Date().toISOString();
    const sessions = [
        { source: 'claude', sessionId: 'gone', filePath: path.join(dir, 'missing.jsonl'), updatedAt: nowIso }
    ];
    const deps = {
        fs,
        path,
        readline: require('readline'),
        cacheDir,
        listSessionBrowse: async () => sessions
    };
    const res = await listSessionCodeStatsCore({ source: 'all', range: '7d' }, deps);
    assert.strictEqual(res.total, 1);
    assert.strictEqual(res.computed, 1);
    assert.strictEqual(res.errorCount, 1);
    assert.strictEqual(res.stats[0].filesChanged, 0);
    assert.strictEqual(res.stats[0].linesAdded, 0);
    assert.strictEqual(res.stats[0].linesRemoved, 0);
    fs.rmSync(dir, { recursive: true, force: true });
});

test('usageCodeStatsSummary joins filtered sessions with stats and reports coverage', () => {
    const computed = computedFactory.createSessionComputed();
    const summaryFn = computed.usageCodeStatsSummary;
    const vm = {
        sessionUsageCharts: {
            filteredSessions: [
                { source: 'claude', sessionId: 'a' },
                { source: 'codex', sessionId: 'b' },
                { source: 'pi', sessionId: 'c' },
                { source: 'claude', sessionId: 'a' }
            ]
        },
        sessionsCodeStats: {
            'claude:a': { filesChanged: 2, linesAdded: 10, linesRemoved: 4 },
            'codex:b': { filesChanged: 1, linesAdded: 3, linesRemoved: 1 }
        },
        sessionsCodeStatsLoading: false,
        sessionsCodeStatsError: ''
    };
    const summary = summaryFn.call(vm);
    assert.strictEqual(summary.filesChanged, 3);
    assert.strictEqual(summary.linesAdded, 13);
    assert.strictEqual(summary.linesRemoved, 5);
    assert.strictEqual(summary.counted, 2);
    assert.strictEqual(summary.total, 3);
    assert.strictEqual(summary.loading, false);

    const empty = summaryFn.call({
        sessionUsageCharts: null,
        sessionsCodeStats: {},
        sessionsCodeStatsLoading: true,
        sessionsCodeStatsError: ''
    });
    assert.strictEqual(empty.total, 0);
    assert.strictEqual(empty.counted, 0);
    assert.strictEqual(empty.loading, true);
});

test('usageKpiCards renders all six cards without scope errors (busiestDay regression)', async () => {
    const logic = await import(pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'logic.mjs')));
    const computed = computedFactory.createSessionComputed();
    const sessions = [
        {
            source: 'claude',
            model: 'claude-sonnet-4',
            createdAt: '2026-09-24T08:00:00.000Z',
            updatedAt: '2026-09-24T09:00:00.000Z',
            messageCount: 5,
            totalTokens: 120,
            contextWindow: 32000,
            cwd: '/a',
            sessionId: 'a'
        }
    ];
    const charts = logic.buildUsageChartGroups(sessions, { range: '7d' });
    const vm = {
        t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
        lang: 'zh',
        sessionsUsageTimeRange: '7d',
        sessionUsageCharts: charts,
        sessionUsageDaily: { rows: [{ key: '09-24', tokenTotal: 120 }] },
        sessionsUsageList: sessions,
        sessionsCodeStats: { 'claude:a': { filesChanged: 2, linesAdded: 10, linesRemoved: 4 } },
        sessionsCodeStatsLoading: false,
        sessionsCodeStatsError: ''
    };

    // The whole usage render chain must execute without ReferenceError.
    const summary = computed.usageCodeStatsSummary.call(vm);
    // Vue resolves usageCodeStatsSummary on `this`; emulate that channel for the bare vm.
    vm.usageCodeStatsSummary = summary;
    assert.strictEqual(summary.counted, 1);
    assert.strictEqual(summary.total, 1);

    const cards = computed.usageKpiCards.call(vm);
    assert.strictEqual(cards.length, 7);
    const busiest = cards.find((card) => card.key === 'busiest-day');
    assert.ok(busiest, 'busiest-day card missing');
    assert.ok(busiest.value.includes('·'), `busiest-day value broken: ${busiest.value}`);
    const files = cards.find((card) => card.key === 'files-changed');
    assert.ok(files && files.value === '2', `files-changed card broken: ${files && files.value}`);
    const lines = cards.find((card) => card.key === 'lines-changed');
    assert.ok(lines && lines.value.includes('10') && lines.value.includes('4'), `lines-changed card broken: ${lines && lines.value}`);
    assert.strictEqual(files.delta, '');

    for (const name of ['usageCurrentSessionStats', 'usageWaveHeaderSummary', 'usageRankedLists', 'usageHeroDelta', 'usageHeroDeltaClass', 'usageKpiCards']) {
        assert.strictEqual(typeof computed[name], 'function', `missing computed ${name}`);
        computed[name].call(vm);
    }

    // Partial coverage must surface the counted/total delta instead of fake completeness.
    const partialVm = { ...vm, sessionsCodeStats: {} };
    partialVm.usageCodeStatsSummary = computed.usageCodeStatsSummary.call(partialVm);
    const partialCards = computed.usageKpiCards.call(partialVm);
    const partialFiles = partialCards.find((card) => card.key === 'files-changed');
    assert.ok(partialFiles.delta.includes('0') && partialFiles.delta.includes('1'), `coverage delta broken: ${partialFiles.delta}`);
    assert.strictEqual(partialFiles.deltaClass, 'delta-neutral');
});
