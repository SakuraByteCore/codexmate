'use strict';
const assert = require('node:assert/strict');
const { checkCollections, checkStories } = require('./workbench-collections-stories.cjs');
const { checkArtifacts } = require('./session-artifacts-acceptance.cjs');
const { checkHandoffUi } = require('./thread-handoff-ui.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const android = process.platform === 'android' && Boolean(process.env.CHROME_EXECUTABLE);
if (android) Object.defineProperty(process, 'platform', { value: 'linux' });
const { chromium } = require('playwright-core');
const TOKEN = 'workbench-isolated-fixture';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonl = records => records.map(record => JSON.stringify(record)).join('\n') + '\n';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const git = (cwd, args) => {
    const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 5000 });
    assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
};

async function checkEvidence({ page, api, originals, codexFile }) {
    await page.locator('.session-features .feature-tabs button').filter({ hasText: '全文索引' }).click();
    await page.locator('.session-source-pill[data-source="all"]').click();
    await page.locator('.session-role-select').selectOption('user');
    const search = page.locator('.feature-search-form').first();
    await search.locator('input').fill('evidence needle');
    await page.waitForFunction(() => !document.querySelector('.feature-search-form button')?.disabled);
    await search.locator('input').press('Enter');
    const choices = page.getByRole('checkbox', { name: '加入证据包', exact: true });
    await choices.first().waitFor(); assert.equal(await choices.count(), 3);
    for (let index = 0; index < 3; index++) { await choices.nth(index).focus(); await page.keyboard.press('Space'); }
    const basket = page.locator('.evidence-basket');
    assert.equal(await basket.locator('li').count(), 3);
    for (const source of ['codex', 'pi', 'codex', 'all']) {
        await page.locator(`.session-source-pill[data-source="${source}"]`).click();
        assert.equal(await basket.locator('li').count(), 3, 'source round-trip keeps only explicit material selections');
    }
    await basket.locator('input').fill('Continue from verified historical sources');
    await fs.writeFile(codexFile, originals.get(codexFile).replace('evidence needle codex-one', 'changed source'));
    await basket.getByRole('button', { name: '生成证据包', exact: true }).click();
    await basket.getByRole('alert').waitFor(); assert.match(await basket.innerText(), /原文已变化/);
    assert.equal(await basket.locator('.evidence-preview').count(), 0, 'changed source refuses complete pack');
    await fs.writeFile(codexFile, originals.get(codexFile));
    await basket.getByRole('button', { name: '生成证据包', exact: true }).click();
    const preview = basket.locator('.evidence-preview pre'); await preview.waitFor();
    const content = await preview.innerText(); assert.match(content, /codex/); assert.match(content, /pi/); assert.match(content, /SHA-256/); assert.match(content, /当前版本/);
    const download = page.waitForEvent('download'); await basket.getByRole('button', { name: '下载 Markdown', exact: true }).click();
    assert.equal(await fs.readFile(await (await download).path(), 'utf8'), '\uFEFF' + content + (content.endsWith('\n') ? '' : '\n'));
    await checkArtifacts({ page, originals, codexFile, width: page.viewportSize().width });
    const indexed = await api('session-index-search', { query: 'evidence needle', role: 'user' });
    await page.locator('.feature-record').filter({ hasText: 'evidence needle codex-one' }).getByRole('button', { name: '查看原文', exact: true }).click();
    await page.locator('.feature-focus pre').filter({ hasText: 'evidence needle codex-one' }).waitFor();
    assert.equal(indexed.results.length, 3); assert.equal(await basket.locator('li').count(), 3);
    await page.reload(); await page.locator('.session-features .feature-tabs').waitFor();
    assert.equal(await page.locator('.evidence-basket').count(), 0, 'reload clears only the new memory basket');
    console.log('PASS evidence: real Enter/Space, three sessions/two sources, source round-trip, hash failure/recovery, original node, identical download and reload');
}

async function checkPricing({ page, api, navigate, originals, piFile }) {
    await navigate('usage'); const pricing = page.locator('#usage-price-reference');
    await pricing.locator('summary').click(); await pricing.locator('tbody tr').first().waitFor();
    for (const range of ['all', '7d', 'all']) {
        await page.locator('.usage-range-btn').filter({ hasText: range === 'all' ? '全部' : '7' }).first().click();
        await page.waitForFunction(expected => document.querySelectorAll('#usage-price-reference tbody tr').length === expected, range === 'all' ? 3 : 2);
        const report = await api('session-usage-pricing', range === 'all' ? {} : { from: new Date().toISOString().slice(0, 10) });
        assert.equal(report.summary.unknownRows, 1); assert.equal(report.summary.complete, false); assert.equal(report.summary.estimatedUsd, null);
        assert.ok(report.summary.knownSubtotalUsd > 0); assert.match(await pricing.innerText(), /Wei-Shaw\/model-price-repo/);
        assert.match(await pricing.innerText(), /模型无价格记录/); assert.match(await pricing.innerText(), /不是账单/);
    }
    const download = page.waitForEvent('download'); await pricing.getByRole('button', { name: '下载价格参考 JSON', exact: true }).click();
    const downloaded = await fs.readFile(await (await download).path(), 'utf8');
    assert.equal(downloaded.charCodeAt(0), 0xFEFF, 'existing text downloader preserves UTF-8 BOM');
    const exported = JSON.parse(downloaded.slice(1));
    assert.equal(exported.summary.unknownRows, 1); assert.match(exported.priceSource.sha256, /^[a-f0-9]{64}$/);
    assert.equal(await pricing.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, 'pricing must fit target container');
    await fs.writeFile(piFile, originals.get(piFile).replace('unknown-price-fixture', 'claude-sonnet-4-5'));
    await pricing.getByRole('button', { name: '刷新统计', exact: true }).click();
    const known = await api('session-usage-pricing'); assert.equal(known.summary.complete, true); assert.equal(known.summary.unknownRows, 0);
    await page.waitForFunction(total => document.querySelector('.usage-price-total')?.textContent.includes(total), '$' + known.summary.estimatedUsd.toFixed(6));
    await fs.writeFile(piFile, originals.get(piFile)); await pricing.getByRole('button', { name: '刷新统计', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#usage-price-reference tbody')?.textContent.includes('模型无价格记录'));
    await page.reload(); await pricing.locator('summary').click(); await page.waitForFunction(() => document.querySelectorAll('#usage-price-reference tbody tr').length === 3);
    console.log('PASS pricing: source/hash, known/unknown, date round-trip, displayed/exported results, reload and bounded layout');
}

async function checkGit({ page, navigate, first, second }) {
    await navigate('sessions'); await page.locator('.session-features .feature-tabs button').filter({ hasText: '项目工作台' }).click();
    const picker = page.locator('.feature-project-picker');
    await picker.getByRole('button').filter({ hasText: first }).click();
    const panel = page.locator('.project-git'); await panel.locator('summary').click();
    await panel.locator('.git-commit-list li').first().waitFor(); assert.match(await panel.innerText(), /时间关联候选/);
    await panel.locator('.git-commit-list > li > button').first().click(); await panel.locator('.git-commit-stat').waitFor();
    assert.match(await panel.locator('.git-commit-stat').innerText(), /source.txt/);
    await panel.locator('.feature-link-list button').first().click();
    await page.locator('.session-preview.active .session-source[data-source="codex"]').waitFor();
    for (const project of [second, first]) {
        await picker.getByRole('button').filter({ hasText: project }).click();
        await page.waitForFunction(project => document.querySelector('.project-git .feature-path')?.textContent.trim() === project, project);
    }
    assert.equal(await panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true, 'Git panel must fit target container');
    await page.reload(); await page.locator('.session-features .feature-tabs button').filter({ hasText: '项目工作台' }).click();
    await picker.getByRole('button').filter({ hasText: first }).click(); await panel.locator('summary').click(); await panel.locator('.git-commit-list li').first().waitFor();
    console.log('PASS Git: current repo, candidate navigation, commit files, same-name project round-trip, reload and bounded layout');
}

async function main() {
    const home = await fs.mkdtemp(path.join(path.resolve('.tmp'), 'workbench-acceptance-'));
    const first = path.join(home, 'repositories/a/repo'); const second = path.join(home, 'repositories/b/repo');
    const today = new Date().toISOString().slice(0, 10); const older = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    for (const cwd of [first, second]) {
        await fs.mkdir(cwd, { recursive: true }); git(cwd, ['init', '-q']); git(cwd, ['config', 'user.name', 'Fixture']); git(cwd, ['config', 'user.email', 'fixture@example.invalid']);
        await fs.writeFile(path.join(cwd, 'source.txt'), 'fixture'); git(cwd, ['add', 'source.txt']); git(cwd, ['commit', '-qm', 'fixture commit']);
    }
    const codex = ({ id, cwd, date, input, output, cached }) => jsonl([
        { type: 'session_meta', timestamp: date + 'T12:00:00Z', payload: { id, cwd } },
        { type: 'turn_context', timestamp: date + 'T12:00:01Z', payload: { model: 'gpt-5.2' } },
        { type: 'response_item', timestamp: date + 'T12:00:02Z', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'evidence needle ' + id }] } },
        { type: 'event_msg', timestamp: date + 'T12:00:03Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, output_tokens: output, cached_input_tokens: cached, total_tokens: input + output } } } }
    ]);
    const codexFile = path.join(home, '.codex/sessions/one.jsonl');
    const originals = new Map([[codexFile, codex({ id: 'codex-one', cwd: first, date: today, input: 100, output: 10, cached: 40 })],
        [path.join(home, '.codex/sessions/two.jsonl'), codex({ id: 'codex-two', cwd: second, date: older, input: 30, output: 5, cached: 0 })],
        [path.join(home, '.pi/agent/sessions/fixture/pi.jsonl'), jsonl([
            { type: 'session', id: 'pi-one', cwd: first, timestamp: today + 'T12:00:00Z' },
            { type: 'message', id: 'pi-user', timestamp: today + 'T12:00:01Z', message: { role: 'user', content: [{ type: 'text', text: 'evidence needle pi-one' }] } },
            { type: 'message', id: 'pi-reply', timestamp: today + 'T12:00:02Z', message: { role: 'assistant', model: 'unknown-price-fixture', content: [{ type: 'text', text: 'unverified reply' }], usage: { input: 10, output: 5, cacheRead: 20, cacheWrite: 3 } } }
        ])]]);
    for (const [file, text] of originals) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text); }
    const indexes = new Map(); for (const cwd of [first, second]) indexes.set(cwd, digest(await fs.readFile(path.join(cwd, '.git/index'))));
    const probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: '', CLAUDE_HOME: '', CLAUDE_CONFIG_DIR: '', PI_HOME: '',
        CODEBUDDY_HOME: '', CODEBUDDY_CODE_HOME_DIR: '', WORKBUDDY_HOME: '', WORKBUDDY_AI_HOME_DIR: '', XDG_CONFIG_HOME: '', XDG_DATA_HOME: path.join(home, '.local/share'), OPENCODE_DATA_HOME: '', OPENCODE_DATA_DIR: '', ZED_DATA_DIR: path.join(home, 'zed'), CODEXMATE_HTTP_TOKEN: TOKEN, CODEXMATE_PORT: String(port), CODEXMATE_NO_BROWSER: '1' };
    let app = spawn(process.execPath, ['cli.js', 'run', '--no-browser', '--host=127.0.0.1'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let serverLog = ''; app.stdout.on('data', chunk => { serverLog += chunk; }); app.stderr.on('data', chunk => { serverLog += chunk; });
    const base = `http://127.0.0.1:${port}`;
    const api = async (action, params = {}) => { const response = await fetch(base + '/api', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, params }) }); assert.equal(response.status, 200); const result = await response.json(); assert.equal(result.error, undefined, JSON.stringify(result)); return result; };
    let browser;
    try {
        let ready; for (let attempt = 0; attempt < 80; attempt++) { ready = await fetch(base + '/?token=' + TOKEN).catch(() => null); if (ready?.ok) break; await delay(100); }
        assert.ok(ready?.ok, serverLog); assert.equal(await (await fetch(base + '/web-ui/app.js')).text(), require('../../web-ui/source-bundle.cjs').readExecutableBundledWebUiScript(), 'instance loads final bundle');
        assert.equal(await (await fetch(base + '/web-ui/styles.css')).text(), require('../../web-ui/source-bundle.cjs').readBundledWebUiCss(), 'instance loads final bundled CSS');
        assert.equal((await api('status')).version, require('../../package.json').version, 'running backend reports package version');
        console.log('PASS running version', require('../../package.json').version);
        await api('session-index-refresh', { source: 'all' }); let status; do { await delay(50); status = await api('session-index-status'); } while (status.job.status === 'running'); assert.equal(status.job.status, 'success');
        for (const action of ['session-collections-list', 'session-collection-open', 'session-collection-save', 'session-collection-remove', 'session-stories-list', 'session-story-save', 'session-story-remove']) {
            const denied = await fetch(base + '/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, params: {} }) });
            assert.equal(denied.status, 401, 'new actions retain authentication');
        }
        browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || undefined, args: android ? ['--no-zygote', '--single-process', '--disable-dev-shm-usage'] : [] });
        const context = await browser.newContext({ acceptDownloads: true }); context.setDefaultTimeout(8000);
        for (const width of [1440, 390]) {
            const page = await context.newPage(); await page.setViewportSize({ width, height: 900 });
            const actions = []; const errors = []; page.on('pageerror', error => errors.push(error.message));
            page.on('request', request => { if (request.url().endsWith('/api') && request.method() === 'POST') actions.push(request.postDataJSON()?.action); });
            await page.goto(base + '/?token=' + TOKEN); const navigate = tab => page.locator(width === 1440 ? '#side-tab-' + tab : '#tab-' + tab).click();
            try {
                await navigate('sessions');
                if (process.env.WORKBENCH_ACCEPTANCE_FOCUS === 'handoff') {
                    await checkHandoffUi({ page, api, width });
                } else if (process.env.WORKBENCH_ACCEPTANCE_FOCUS === 'stories') {
                    await page.locator('.session-features .feature-tabs button').filter({ hasText: '项目工作台' }).click();
                    await page.locator('.feature-project-picker button').filter({ hasText: first }).click(); await page.locator('.project-git > summary').click();
                } else {
                    await checkEvidence({ page, api, originals, codexFile }); await checkCollections({ page, api, originals, codexFile, width });
                    if (process.env.WORKBENCH_ACCEPTANCE_FOCUS !== 'artifacts') {
                    await checkPricing({ page, api, navigate, originals, piFile: [...originals.keys()].find(file => file.includes('/.pi/')) });
                    }
                    if (!['collections', 'artifacts', 'handoff'].includes(process.env.WORKBENCH_ACCEPTANCE_FOCUS)) await checkGit({ page, navigate, first, second });
                }
                if (!['collections', 'artifacts', 'handoff'].includes(process.env.WORKBENCH_ACCEPTANCE_FOCUS)) await checkStories({ page, api, first, second, width });
            } catch (error) {
                console.error('PAGE_ERRORS', errors); console.error('LAST_ACTIONS', actions.slice(-15)); console.error('FEATURE_ACTIONS', actions.filter(action => /session-project|session-stor/.test(action))); console.error('VM_STATE', await page.evaluate(() => { const vm = document.querySelector('#app')?.__vue_app__?._instance?.proxy || document.querySelector('#app')?._vnode?.component?.proxy; return vm ? { view: vm.featureView, sequence: vm.featureRequestSeq, busy: vm.featureBusy, project: vm.projectSelected, report: vm.projectReport, error: vm.featureError, git: vm.projectGitCommit, stories: vm.stories, storyError: vm.storyError } : 'no-vm'; }));
                console.error('VISIBLE_STATE', (await page.locator('#app').innerText()).slice(-6500)); throw error;
            }
            assert.deepEqual(errors, [], 'no runtime errors'); assert.equal(actions.some(action => /model-test|session-diagnostics-start/.test(action) || (process.env.WORKBENCH_ACCEPTANCE_FOCUS !== 'handoff' && action === 'thread-handoff-create')), false, 'no model calls, automatic handoff or MCP start');
            await page.close(); console.log('PASS loaded desktop/compact entry', width);
        }
        if (!['collections', 'artifacts', 'handoff'].includes(process.env.WORKBENCH_ACCEPTANCE_FOCUS)) {
            if (process.env.WORKBENCH_ACCEPTANCE_FOCUS === 'stories') {
                const result = await api('session-index-search', { query: 'evidence needle', role: 'user' });
                await api('session-collection-save', { name: '重启恢复专题', goal: '', references: result.results, revision: '' });
            }
            const savedCollections = (await api('session-collections-list')).items;
            const savedStories = (await api('session-stories-list', { project: first })).items;
            const stopped = new Promise(resolve => app.once('exit', resolve)); app.kill('SIGTERM'); await stopped;
            app = spawn(process.execPath, ['cli.js', 'run', '--no-browser', '--host=127.0.0.1'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
            app.stdout.on('data', chunk => { serverLog += chunk; }); app.stderr.on('data', chunk => { serverLog += chunk; });
            let restarted; for (let attempt = 0; attempt < 80; attempt++) { restarted = await fetch(base + '/?token=' + TOKEN).catch(() => null); if (restarted?.ok) break; await delay(100); }
            assert.ok(restarted?.ok, serverLog); assert.equal(await (await fetch(base + '/web-ui/app.js')).text(), require('../../web-ui/source-bundle.cjs').readExecutableBundledWebUiScript(), 'restarted instance loads final bundle');
            assert.deepEqual((await api('session-collections-list')).items, savedCollections);
            assert.deepEqual((await api('session-stories-list', { project: first })).items, savedStories);
            const restored = await context.newPage(); await restored.setViewportSize({ width: 390, height: 900 }); await restored.goto(base + '/?token=' + TOKEN);
            await restored.locator('#tab-sessions').click(); await restored.locator('.evidence-collections > summary').click();
            await restored.getByRole('button', { name: /^重启恢复专题/ }).first().click(); await restored.locator('.evidence-basket [data-state="ready"]').first().waitFor();
            await restored.locator('.session-features .feature-tabs button').filter({ hasText: '项目工作台' }).click();
            await restored.locator('.feature-project-picker button').filter({ hasText: first }).click(); await restored.locator('.project-git > summary').click();
            await restored.locator('.git-commit-list > li > button').first().click(); await restored.locator('.story-record').filter({ hasText: '重启后的故事' }).waitFor();
            const palettes = await restored.evaluate(async () => {
                const root = document.documentElement; const original = root.getAttribute('data-theme'); const results = [];
                for (const theme of ['light', 'dark', 'ocean', 'violet']) {
                    if (theme === 'light') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
                    // Sample after the existing 160ms color transition, not during interpolation.
                    await new Promise(resolve => setTimeout(resolve, 200));
                    const collection = document.querySelector('.collection-list button[aria-pressed="true"]'); const tab = document.querySelector('.feature-tabs button[aria-expanded="true"]');
                    const chosen = getComputedStyle(collection); const navigation = getComputedStyle(tab);
                    results.push({ theme, matches: chosen.color === navigation.color && chosen.backgroundColor === navigation.backgroundColor,
                        chosen: [chosen.color, chosen.backgroundColor], navigation: [navigation.color, navigation.backgroundColor],
                        fits: [...document.querySelectorAll('.evidence-collections,.project-stories')].every(element => element.scrollWidth <= element.clientWidth + 1) });
                }
                if (original === null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', original);
                return results;
            }); console.log('POLISH themes', palettes); assert.ok(palettes.every(result => result.matches && result.fits), 'four themes retain shared selected colors and bounded layouts');
            await restored.close();
            console.log('PASS real service restart: saved collections/stories preserved and reopened through visible entries');
        }
        for (const [file, original] of originals) assert.equal(digest(await fs.readFile(file)), digest(Buffer.from(original)), 'original session unchanged');
        for (const [cwd, hash] of indexes) assert.equal(digest(await fs.readFile(path.join(cwd, '.git/index'))), hash, 'Git index unchanged');
        assert.equal(await fs.access(path.join(home, '.codex/config.toml')).then(() => true, () => false), false, 'no provider bootstrap');
    } finally {
        await browser?.close(); if (app.exitCode === null) { const stopped = new Promise(resolve => app.once('exit', resolve)); app.kill('SIGTERM'); await stopped; }
        await fs.writeFile('.tmp/workbench-server.log', serverLog); await fs.rm(home, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
