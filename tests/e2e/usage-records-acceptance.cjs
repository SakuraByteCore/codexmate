'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const android = process.platform === 'android' && Boolean(process.env.CHROME_EXECUTABLE);
if (android) Object.defineProperty(process, 'platform', { value: 'linux' });
const { chromium } = require('playwright-core');
const token = 'usage-records-isolated-fixture';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonl = records => records.map(record => JSON.stringify(record)).join('\n') + '\n';

async function main() {
    const home = await fs.mkdtemp(path.join(os.tmpdir(), 'usage-records-acceptance-'));
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const older = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    const events = total => ({ type: 'event_msg', timestamp: `${total === 100 ? yesterday : today}T12:00:00Z`,
        payload: { type: 'token_count', info: { total_token_usage: { input_tokens: total - 10, output_tokens: 10,
            cached_input_tokens: total === 100 ? 50 : 70, total_tokens: total } } } });
    const codexRecords = [
        { type: 'session_meta', timestamp: yesterday + 'T11:00:00Z', payload: { id: 'codex-records', cwd: home } },
        { type: 'turn_context', timestamp: yesterday + 'T11:01:00Z', payload: { model: 'gpt-records' } },
        { type: 'response_item', timestamp: yesterday + 'T11:02:00Z', payload: { type: 'message', role: 'user', content: 'saved user text' } }, events(100), events(160)
    ];
    const fixtures = new Map([
        [path.join(home, '.codex/sessions/records.jsonl'), jsonl(codexRecords)],
        [path.join(home, '.claude/projects/records/claude.jsonl'), jsonl([
            { type: 'user', timestamp: today + 'T10:00:00Z', sessionId: 'claude-records', cwd: home, message: { role: 'user', content: 'Claude text' } },
            { type: 'assistant', timestamp: today + 'T10:01:00Z', sessionId: 'claude-records', cwd: home,
                message: { id: 'claude-request', role: 'assistant', model: 'claude-records', content: 'reply',
                    usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 20, cache_creation_input_tokens: 3 } } }
        ])],
        [path.join(home, '.claude/projects/records/older.jsonl'), jsonl([
            { type: 'assistant', timestamp: older + 'T10:01:00Z', sessionId: 'older-records', cwd: home,
                message: { id: 'older-request', role: 'assistant', model: 'claude-older', content: 'older reply',
                    usage: { input_tokens: 9, output_tokens: 2, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } }
        ])],
        [path.join(home, '.pi/agent/sessions/records/pi.jsonl'), jsonl([
            { type: 'session', id: 'pi-records', timestamp: today + 'T09:00:00Z', cwd: home },
            { type: 'model_change', timestamp: today + 'T09:00:01Z', provider: 'fixture', modelId: 'pi-records' },
            { type: 'message', id: 'pi-request', timestamp: today + 'T09:01:00Z', message: { role: 'assistant', model: 'pi-records', content: 'Pi reply',
                usage: { input: 10, output: 5, cacheRead: 20, cacheWrite: 3 } } }
        ])]
    ]);
    for (const [file, text] of fixtures) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text); }
    const probe = http.createServer();
    await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    const base = `http://127.0.0.1:${port}`;
    const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: '', CLAUDE_HOME: '', CLAUDE_CONFIG_DIR: '',
        CODEBUDDY_HOME: '', CODEBUDDY_CODE_HOME_DIR: '', WORKBUDDY_HOME: '', WORKBUDDY_AI_HOME_DIR: '',
        PI_HOME: '', XDG_CONFIG_HOME: '', XDG_DATA_HOME: path.join(home, '.local/share'),
        OPENCODE_DATA_HOME: '', OPENCODE_DATA_DIR: '', ZED_DATA_DIR: path.join(home, 'zed'),
        CODEXMATE_HTTP_TOKEN: token, CODEXMATE_PORT: String(port), CODEXMATE_NO_BROWSER: '1' };
    const app = spawn(process.execPath, ['cli.js', 'run', '--no-browser', '--host=127.0.0.1'], { env, stdio: 'ignore' });
    const api = async (action, params = {}) => {
        const response = await fetch(base + '/api', { method: 'POST', headers, body: JSON.stringify({ action, params }) });
        assert.equal(response.status, 200, action);
        return response.json();
    };
    let browser;
    try {
        let ready;
        for (let attempt = 0; attempt < 80; attempt++) {
            ready = await fetch(base + '/?token=' + token).catch(() => null);
            if (ready?.ok) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.ok(ready?.ok, 'isolated candidate instance must load');
        assert.match(await ready.text(), /id="usage-records-report"/);
        assert.equal((await fetch(base + '/api', { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'read-sessions-usage-report' }) })).status, 401);
        const report = await api('read-sessions-usage-report', { source: 'all', forceRefresh: true });
        assert.equal(report.summary.totalTokens, 247, JSON.stringify(report));
        assert.equal(report.rows.find(row => row.source === 'codex' && row.date === yesterday).totalTokens, 100);
        assert.equal(report.rows.find(row => row.source === 'codex' && row.date === today).totalTokens, 60);
        assert.equal(report.rows.find(row => row.source === 'pi').cacheCreationInputTokens, 3);
        assert.ok(report.summary.estimatedTextTokens > 0);
        assert.deepEqual(report.summary.failedSessions, []);
        const legacy = await api('export-sessions-usage', { format: 'csv' });
        assert.match(legacy.content, /^date,model,tokens,sessions\r\n/);
        const exported = await api('export-sessions-usage', { attribution: 'records', format: 'json' });
        assert.deepEqual(JSON.parse(exported.content).rows, report.rows);
        const cli = spawnSync(process.execPath, ['cli.js', 'analytics', 'export', '--attribution', 'records', '--format', 'json', '-o', '-'],
            { env, encoding: 'utf8', timeout: 15000 });
        assert.equal(cli.status, 0, cli.stderr);
        assert.equal(await fs.access(path.join(home, '.codex/config.toml')).then(() => true, () => false), false, 'read-only analytics must not bootstrap Codex config');
        assert.deepEqual(JSON.parse(cli.stdout).rows, report.rows);
        console.log('PASS: loaded candidate API, auth, cross-day totals, caches, separate estimates, legacy export and real CLI records export');
        browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || undefined,
            args: android ? ['--no-zygote', '--single-process', '--disable-dev-shm-usage'] : [] });
        const context = await browser.newContext();
        for (const width of [1440, 390]) {
            const page = await context.newPage();
            await page.setViewportSize({ width, height: 900 });
            await page.goto(base + '/?token=' + token);
            await page.locator(width === 1440 ? '#side-tab-usage' : '#tab-usage').click();
            const details = page.locator('#usage-records-report');
            await details.locator('summary').click();
            await page.waitForFunction(() => document.querySelectorAll('#usage-records-report tbody tr').length === 4);
            assert.match(await details.innerText(), /236/);
            assert.equal(await details.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true, 'numeric table must not overflow its card');
            for (const range of ['all', '7d']) {
                await page.locator(`.usage-range-btn`).filter({ hasText: range === 'all' ? '全部' : '7' }).first().click();
                const expected = range === 'all' ? { count: 5, total: '247' } : { count: 4, total: '236' };
                await page.waitForFunction(expected => document.querySelectorAll('#usage-records-report tbody tr').length === expected.count
                    && document.querySelector('#usage-records-report .usage-kpi-value')?.textContent.trim() === expected.total, expected);
                assert.equal((await details.innerText()).includes(older), range === 'all', 'only all-time rows may include the older session');
            }
            await details.locator('summary').click();
            await details.locator('summary').click();
            assert.match(await details.innerText(), /236/);
            await page.reload();
            await details.locator('summary').click();
            await page.waitForFunction(() => document.querySelectorAll('#usage-records-report tbody tr').length === 4);
            assert.match(await details.innerText(), /236/);
            await page.close();
        }
        const validation = await context.newPage();
        await validation.goto(base + '/?token=' + token);
        await validation.locator('#side-tab-usage').click();
        const validationDetails = validation.locator('#usage-records-report');
        await validationDetails.locator('summary').click();
        await validation.waitForFunction(() => document.querySelectorAll('#usage-records-report tbody tr').length === 4);
        const codexFile = [...fixtures.keys()][0];
        await fs.appendFile(codexFile, JSON.stringify(events(230)) + '\n');
        const updated = await api('read-sessions-usage-report', { source: 'all', forceRefresh: true });
        assert.equal(updated.summary.totalTokens, 317, 'append/reload must invalidate numeric cache');
        await validationDetails.getByRole('button').click();
        await validation.waitForFunction(() => document.querySelector('#usage-records-report .usage-kpi-value')?.textContent.trim() === '306');
        await fs.appendFile(codexFile, '{broken record\n');
        const failed = await api('read-sessions-usage-report', { source: 'all', forceRefresh: true });
        assert.equal(failed.summary.failedSessions.length, 1);
        await validationDetails.getByRole('button').click();
        await validationDetails.getByRole('alert').waitFor();
        assert.match(await validationDetails.getByRole('alert').innerText(), /读取失败 1/);
        assert.match((await api('export-sessions-usage', { attribution: 'records' })).error, /incomplete/);
        await fs.writeFile(codexFile, fixtures.get(codexFile));
        await validationDetails.getByRole('button').click();
        await validation.waitForFunction(() => document.querySelector('#usage-records-report .usage-kpi-value')?.textContent.trim() === '236'
            && !document.querySelector('#usage-records-report [role=alert]'));
        await validation.close();
        for (const [file, original] of fixtures) assert.equal(digest(await fs.readFile(file)), digest(Buffer.from(original)), 'report must not modify sessions');
        console.log('PASS: desktop/compact disclosure, range round-trip, reload, bounded table, append refresh, partial failure and unchanged source files');
    } finally {
        await browser?.close();
        if (app.exitCode === null) { const stopped = new Promise(resolve => app.once('exit', resolve)); app.kill('SIGTERM'); await stopped; }
        await fs.rm(home, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
