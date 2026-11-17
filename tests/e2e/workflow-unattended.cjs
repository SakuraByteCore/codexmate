const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('playwright-core');
const root = path.resolve(__dirname, '../..');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-unattended-'));
const port = 22000 + Math.floor(Math.random() * 3000);
const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex'), CODEXMATE_PORT: String(port), CODEXMATE_NO_BROWSER: '1', CODEXMATE_HTTP_TOKEN: 'isolated-workflow-test' };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let child, browser;
async function api(action, params = {}) {
    const response = await fetch(`http://127.0.0.1:${port}/api`, { method: 'POST', headers: { Authorization: 'Bearer isolated-workflow-test', 'Content-Type': 'application/json' }, body: JSON.stringify({ action, params }) });
    assert.equal(response.status, 200);
    return response.json();
}
async function start() {
    child = spawn(process.execPath, [path.join(root, 'cli.js'), 'run', '--no-browser'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
    for (let i = 0; i < 60; i++) {
        try { if ((await api('health-check')).ok) return; } catch (_) {}
        await delay(150);
    }
    throw new Error('HTTP service did not start');
}
async function stop() { if (!child || child.exitCode !== null) return; const closed = new Promise(resolve => child.once('exit', resolve)); child.kill(); await closed; }
async function settled(id) {
    for (let i = 0; i < 80; i++) {
        const run = await api('workflow-run-detail', { runId: id });
        if (['completed', 'waiting', 'failed', 'cancelled'].includes(run.status)) return run;
        await delay(50);
    }
    throw new Error('run did not settle');
}
(async () => {
    try {
        await start();
        const cli = spawnSync(process.execPath, [path.join(root, 'cli.js'), 'workflow', 'submit', 'diagnose-config', '--json'], { env, encoding: 'utf8' });
        assert.equal(cli.status, 0, cli.stderr);
        const submitted = JSON.parse(cli.stdout.slice(cli.stdout.indexOf('{')));
        const done = await settled(submitted.id);
        assert.equal(done.status, 'completed'); assert.equal(done.steps.length, 3); assert.equal(done.summary.unfinished.length, 0);
        const stored = JSON.parse(fs.readFileSync(path.join(home, '.codex', 'workflow-runs', `${done.id}.json`)));
        assert.deepEqual(stored.output, done.output);
        console.log('PASS CLI -> HTTP -> automatic completion -> persisted full output');
        const blocked = await api('workflow-submit', { id: 'safe-provider-switch', input: {} });
        assert.equal((await settled(blocked.id)).status, 'waiting');
        await api('workflow-resume', { runId: blocked.id, input: { provider: 'test', apply: false } });
        assert.equal((await settled(blocked.id)).status, 'completed');
        const denied = await api('workflow-submit', { id: 'safe-provider-switch', input: { provider: 'test', apply: true } });
        assert.equal((await settled(denied.id)).status, 'waiting');
        await api('workflow-cancel', { runId: denied.id });
        assert.equal((await settled(denied.id)).status, 'cancelled');
        console.log('PASS missing input -> intervention -> resume; write denied -> cancel');
        await stop();
        const recoveryDir = path.join(home, '.codex', 'workflow-runs');
        const readRecovery = { ...done, id: 'recovery-read', status: 'running', steps: done.steps.slice(0, 1), activeStep: { ...done.definition.steps[1] }, execution: null };
        const writeRecovery = { ...done, id: 'recovery-write', status: 'running', definition: { ...done.definition, steps: [{ id: 'uncertain', tool: 'codexmate.config.template.apply', write: true }] }, steps: [], activeStep: { id: 'uncertain', write: true } };
        fs.writeFileSync(path.join(recoveryDir, 'recovery-read.json'), JSON.stringify(readRecovery));
        fs.writeFileSync(path.join(recoveryDir, 'recovery-write.json'), JSON.stringify(writeRecovery));
        await start();
        const recovered = await settled('recovery-read');
        assert.equal(recovered.status, 'completed'); assert.equal(recovered.stepAttempts.status, 1);
        assert.equal((await settled('recovery-write')).status, 'waiting');
        console.log('PASS seeded interrupted checkpoint -> real service read recovery; uncertain write waits');
        assert.deepEqual((await api('workflow-run-detail', { runId: done.id })).output, done.output);
        assert.equal((await api('workflow-run-detail', { runId: done.id })).attempts, 1);
        console.log('PASS process restart -> same result without replay');
        const old = spawnSync(process.execPath, [path.join(root, 'cli.js'), 'workflow', 'run', 'diagnose-config', '--json'], { env, encoding: 'utf8' });
        assert.equal(old.status, 0, old.stderr); assert.equal(JSON.parse(old.stdout.slice(old.stdout.indexOf('{'))).success, true);
        console.log('PASS legacy synchronous CLI');
        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`http://127.0.0.1:${port}/?token=isolated-workflow-test`);
        await page.getByRole('heading', { name: '自动工作流', exact: true }).waitFor();
        await page.locator('#workflow-id').selectOption('diagnose-config');
        const count = (await api('workflow-active-runs')).runs.length;
        await page.getByRole('button', { name: '提交任务', exact: true }).click();
        await page.waitForFunction(count => document.querySelectorAll('[aria-label="自动工作流"] article').length > count, count);
        await page.close();
        const runs = (await api('workflow-active-runs')).runs;
        const latest = runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        assert.equal((await settled(latest.id)).status, 'completed');
        const reopened = await browser.newPage(); await reopened.goto(`http://127.0.0.1:${port}/?token=isolated-workflow-test`);
        await reopened.getByText(latest.id, { exact: false }).waitFor();
        console.log('PASS browser submit -> close page -> complete -> reopen result');
    } finally {
        if (browser) await browser.close(); await stop();
        console.log(`Isolated evidence: ${home}`);
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
