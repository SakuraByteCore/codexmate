'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');
const android = process.platform === 'android' && Boolean(process.env.CHROME_EXECUTABLE);
if (android) Object.defineProperty(process, 'platform', { value: 'linux' });
const { chromium } = require('playwright-core');
const TOKEN = 'session-items-isolated-fixture';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const jsonl = records => records.map(record => JSON.stringify(record)).join('\n') + '\n';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));


async function checkMessageHeader(page, messageText) {
    const header = page.locator('.session-msg').filter({ hasText: messageText }).locator('.session-msg-header');
    const checkbox = header.getByRole('checkbox');
    await checkbox.scrollIntoViewIfNeeded();
    const alignment = await header.evaluate(element => {
        const checkbox = element.querySelector('input[type="checkbox"]');
        const role = element.querySelector('.session-msg-role');
        const time = element.querySelector('.session-msg-time');
        const message = element.closest('.session-msg');
        const content = message.querySelector('.session-msg-content');
        const body = content.getBoundingClientRect();
        const bodyStyle = getComputedStyle(content);
        const header = element.getBoundingClientRect();
        const messageBox = message.getBoundingClientRect();
        const targets = [...element.querySelectorAll('.session-feature-controls button, .feature-message-select')].map(target => {
            const box = target.getBoundingClientRect();
            const x = box.left + box.width / 2;
            return {
                width: box.width,
                height: box.height,
                fits: box.top >= messageBox.top && box.bottom <= body.top + 0.5,
                edgesHit: [box.top + 2, box.bottom - 2].every(y => target.contains(document.elementFromPoint(x, y)))
            };
        });
        const centerY = node => {
            const { top, height } = node.getBoundingClientRect();
            return top + height / 2;
        };
        return {
            headerHeight: header.height,
            divider: {
                width: bodyStyle.borderTopWidth,
                style: bodyStyle.borderTopStyle,
                color: bodyStyle.borderTopColor,
                gap: body.top - header.bottom,
                aligned: Math.abs(body.left - header.left) <= 1 && Math.abs(body.right - header.right) <= 1
            },
            targets,
            roleOffset: Math.abs(centerY(checkbox) - centerY(role)),
            timeOffset: Math.abs(centerY(checkbox) - centerY(time)),
            role: role.textContent.trim(),
            time: time.textContent.trim()
        };
    });
    assert.ok(alignment.headerHeight <= 28, `compact message header ${JSON.stringify(alignment)}`);
    assert.equal(alignment.divider.width, '1px');
    assert.equal(alignment.divider.style, 'solid');
    assert.notEqual(alignment.divider.color, 'rgba(0, 0, 0, 0)');
    assert.equal(alignment.divider.gap, 8);
    assert.equal(alignment.divider.aligned, true);
    assert.equal(alignment.targets.length, 2);
    for (const target of alignment.targets) {
        assert.ok(target.width >= 44 && target.height >= 44 && target.fits && target.edgesHit, JSON.stringify(target));
    }
    assert.ok(alignment.role && alignment.time, 'fixture renders both role and time');
    assert.ok(alignment.roleOffset <= 1 && alignment.timeOffset <= 1, JSON.stringify(alignment));
    await checkbox.press('Space');
    assert.equal(await checkbox.isChecked(), true);
    await checkbox.click();
    assert.equal(await checkbox.isChecked(), false);
    await header.locator('.session-feature-controls').getByRole('button').click({ position: { x: 22, y: 42 } });
    await page.locator('.feature-editor').waitFor();
    await page.locator('.feature-tabs button[aria-expanded="true"]').click();
    console.log('Message header', page.viewportSize().width, JSON.stringify(alignment));
}

async function checkMessageCopy(page, messageText, minLines) {
    const message = page.locator('.session-msg.user').filter({ hasText: messageText });
    const copy = message.locator('.session-msg-copy');
    await copy.scrollIntoViewIfNeeded();
    const measure = () => copy.evaluate(button => {
        const content = button.closest('.session-msg').querySelector('.session-msg-content');
        const body = content.getBoundingClientRect();
        const style = getComputedStyle(content);
        const textRange = document.createRange();
        textRange.selectNodeContents(content);
        const lineCount = new Set([...textRange.getClientRects()].filter(rect => rect.width > 0).map(rect => rect.top)).size;
        const lineHeight = parseFloat(style.lineHeight);
        const target = button.getBoundingClientRect();
        const icon = button.querySelector('svg').getBoundingClientRect();
        const header = button.closest('.session-msg-header');
        const meta = header.querySelector('.session-msg-meta').getBoundingClientRect();
        const time = header.querySelector('.session-msg-time');
        const x = target.left + target.width / 2;
        return { bodyHeight: body.height, lineCount, naturalHeight: lineCount * lineHeight + parseFloat(style.borderTopWidth),
            targetGap: body.top - target.bottom, iconGap: body.top - icon.bottom,
            width: target.width, height: target.height, iconWidth: icon.width, iconHeight: icon.height,
            sideGap: target.left - meta.right, timeFits: time.scrollWidth <= time.clientWidth + 1,
            iconOffset: Math.abs(icon.top + icon.height / 2 - (meta.top + meta.height / 2)),
            edgesHit: [target.top + 2, target.bottom - 2].every(y => button.contains(document.elementFromPoint(x, y))) };
    });
    const verify = async () => {
        const bounds = await measure();
        assert.ok(Math.abs(bounds.bodyHeight - bounds.naturalHeight) <= 0.5, JSON.stringify(bounds));
        assert.ok(bounds.lineCount >= minLines, JSON.stringify(bounds));
        if (minLines === 1) assert.equal(bounds.lineCount, 1);
        assert.ok(bounds.targetGap >= -0.5 && bounds.iconGap >= 3 && bounds.sideGap >= 4, JSON.stringify(bounds));
        assert.ok(bounds.iconOffset <= 1 && bounds.timeFits && bounds.edgesHit, JSON.stringify(bounds));
        assert.deepEqual([bounds.width, bounds.height, bounds.iconWidth, bounds.iconHeight], [44, 44, 8, 8]);
    };
    await verify();
    await copy.hover();
    await page.mouse.down();
    try { await verify(); } finally { await page.mouse.up(); }
    await page.waitForFunction(text => navigator.clipboard.readText().then(value => value.includes(text)), messageText);
    await verify();
}

async function main() {
    const home = await fs.mkdtemp(path.join(path.resolve('.tmp'), 'session-items-visual-'));
    const first = path.join(home, 'repositories/a/repo'); const second = path.join(home, 'repositories/b/repo');
    const today = new Date().toISOString().slice(0, 10); const older = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    for (const cwd of [first, second]) {
        await fs.mkdir(cwd, { recursive: true });
    }
    const longMessage = "A longer wrapped record ".repeat(12).trim();
    const codex = ({ id, cwd, date, input, output, cached, detail = "" }) => jsonl([
        { type: 'session_meta', timestamp: date + 'T12:00:00Z', payload: { id, cwd } },
        { type: 'turn_context', timestamp: date + 'T12:00:01Z', payload: { model: 'gpt-5.2' } },
        { type: 'response_item', timestamp: date + 'T12:00:02Z', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'evidence needle ' + id + detail }] } },
        { type: 'event_msg', timestamp: date + 'T12:00:03Z', payload: { type: 'token_count', info: { total_token_usage: { input_tokens: input, output_tokens: output, cached_input_tokens: cached, total_tokens: input + output } } } }
    ]);
    const codexFile = path.join(home, '.codex/sessions/one.jsonl');
    const originals = new Map([[codexFile, codex({ id: 'codex-one', cwd: first, date: today, input: 100, output: 10, cached: 40 })],
        [path.join(home, '.codex/sessions/two.jsonl'), codex({ id: 'codex-two', cwd: second, date: older, input: 30, output: 5, cached: 0, detail: '\n' + longMessage })],
        [path.join(home, '.pi/agent/sessions/fixture/pi.jsonl'), jsonl([
            { type: 'session', id: 'pi-one', cwd: first, timestamp: today + 'T12:00:00Z' },
            { type: 'message', id: 'pi-user', timestamp: today + 'T12:00:01Z', message: { role: 'user', content: [{ type: 'text', text: 'evidence needle pi-one' }] } },
            { type: 'message', id: 'pi-reply', timestamp: today + 'T12:00:02Z', message: { role: 'assistant', model: 'unknown-price-fixture', content: [{ type: 'text', text: 'unverified reply' }], usage: { input: 10, output: 5, cacheRead: 20, cacheWrite: 3 } } }
        ])]]);
    for (const [file, text] of originals) { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, text); }
    const probe = http.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve)); const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
    const env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: '', CLAUDE_HOME: '', CLAUDE_CONFIG_DIR: '', PI_HOME: '',
        CODEBUDDY_HOME: '', CODEBUDDY_CODE_HOME_DIR: '', WORKBUDDY_HOME: '', WORKBUDDY_AI_HOME_DIR: '', XDG_CONFIG_HOME: '', XDG_DATA_HOME: path.join(home, '.local/share'), OPENCODE_DATA_HOME: '', OPENCODE_DATA_DIR: '', ZED_DATA_DIR: path.join(home, 'zed'), CODEXMATE_HTTP_TOKEN: TOKEN, CODEXMATE_PORT: String(port), CODEXMATE_NO_BROWSER: '1' };
    const app = spawn(process.execPath, ['cli.js', 'run', '--no-browser', '--host=127.0.0.1'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let serverLog = ''; app.stdout.on('data', chunk => { serverLog += chunk; }); app.stderr.on('data', chunk => { serverLog += chunk; });
    const base = `http://127.0.0.1:${port}`;
    let browser;
    try {
        let ready; for (let attempt = 0; attempt < 80; attempt++) { ready = await fetch(base + '/?token=' + TOKEN).catch(() => null); if (ready?.ok) break; await delay(100); }
        assert.ok(ready?.ok, serverLog); assert.equal(await (await fetch(base + '/web-ui/app.js')).text(), require('../../web-ui/source-bundle.cjs').readExecutableBundledWebUiScript(), 'instance loads final bundle');
        assert.equal(await (await fetch(base + '/web-ui/styles.css')).text(), require('../../web-ui/source-bundle.cjs').readBundledWebUiCss(), 'instance loads final styles');
        browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || undefined, args: android ? ['--no-zygote', '--single-process', '--disable-dev-shm-usage'] : [] });
        const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
        for (const width of [1440, 390]) {
            const page = await context.newPage(); await page.setViewportSize({ width, height: 900 });
            const actions = []; const errors = []; page.on('pageerror', error => errors.push(error.message));
            page.on('request', request => { if (request.url().endsWith('/api') && request.method() === 'POST') actions.push(request.postDataJSON()?.action); });
            await page.goto(base + '/?token=' + TOKEN); const navigate = tab => page.locator(width === 1440 ? '#side-tab-' + tab : '#tab-' + tab).click();
            try {
                await navigate('sessions');
                await page.locator('.session-source-pill[data-source="all"]').click();
                await page.waitForFunction(() => document.querySelectorAll('.session-list > .session-item').length === 3);
                const rows = page.locator('.session-list > .session-item');
                const one = rows.filter({ hasText: 'evidence needle codex-one' });
                const two = rows.filter({ hasText: 'evidence needle codex-two' });
                await two.focus(); await page.keyboard.press('Enter'); await page.waitForFunction(() => document.querySelector('.session-item[aria-current="true"] .session-item-title')?.textContent.includes('codex-two'));
                await checkMessageCopy(page, longMessage, 2);
                await one.focus(); await page.keyboard.press('Space'); await page.waitForFunction(() => document.querySelector('.session-item[aria-current="true"] .session-item-title')?.textContent.includes('codex-one'));
                await checkMessageHeader(page, 'evidence needle codex-one');
                await checkMessageCopy(page, 'evidence needle codex-one', 1);
                await two.locator('.session-item-pin').click(); assert.equal(await one.getAttribute('aria-current'), 'true');
                await one.locator('button:not(.session-item-pin)').click(); assert.match(await page.evaluate(() => navigator.clipboard.readText()), /codex.*resume/);
                const checkGeometry = async (batch = false) => {
                    const metrics = [];
                    for (const row of await rows.all()) {
                        await row.scrollIntoViewIfNeeded();
                        metrics.push(await row.evaluate(row => {
                        const box = row.getBoundingClientRect(), style = getComputedStyle(row), actions = row.querySelector('.session-item-actions').getBoundingClientRect(), heading = row.querySelector('.session-item-heading').getBoundingClientRect();
                        return { image: style.backgroundImage, shadow: style.boxShadow, transform: style.transform, height: box.height, headingRight: heading.right, actionsLeft: actions.left,
                            buttons: [...row.querySelectorAll('.session-item-copy')].map(button => { const b = button.getBoundingClientRect(), hit = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return { width: b.width, height: b.height, within: b.top >= box.top && b.bottom <= box.bottom && b.right <= box.right, hit: !!hit && button.contains(hit), hitTarget: hit?.tagName, buttonBox: b.toJSON(), rowBox: box.toJSON(), headerDirection: getComputedStyle(row.querySelector('.session-item-header')).flexDirection }; }) };
                        }));
                    }
                    for (const metric of metrics) { assert.equal(metric.image, 'none'); assert.equal(metric.shadow, 'none'); assert.equal(metric.transform, 'none'); assert.ok(metric.headingRight <= metric.actionsLeft); for (const button of metric.buttons) { assert.ok(button.width >= 44 && button.height >= 44); assert.equal(button.within, true, JSON.stringify(button)); assert.equal(button.hit, !batch, JSON.stringify(button)); } }
                    return metrics;
                };
                for (const theme of ['light', 'dark', 'ocean', 'violet']) { await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme); await checkGeometry(); }
                await page.evaluate(() => document.documentElement.dataset.theme = 'light'); await one.hover(); await page.mouse.down(); await checkGeometry(); await page.mouse.up(); await checkGeometry();
                await page.locator('.session-list').screenshot({ path: '.tmp/session-items-after-' + width + '.png' });
                await two.locator('.session-item-pin').click(); assert.equal(await two.locator('.session-item-pin').getAttribute('aria-pressed'), 'false');
                await page.locator('.btn-tool-batch').click();
                const checkbox = two.locator('.session-batch-check input');
                await checkbox.focus();
                const target = await checkbox.boundingBox();
                assert.ok(target.width >= 44 && target.height >= 44);
                assert.equal(await checkbox.evaluate(input => {
                    const box = input.getBoundingClientRect();
                    return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === input;
                }), true);
                await page.keyboard.press('Space');
                assert.equal(await checkbox.isChecked(), true);
                assert.match(await two.getAttribute('class'), /batch-selected/);
                assert.equal(await one.getAttribute('aria-current'), 'true');
                await checkGeometry(true);
                await checkbox.click();
                assert.equal(await checkbox.isChecked(), false);
                assert.equal(await one.getAttribute('aria-current'), 'true');
                const query = page.locator('.session-query-input');
                await query.fill('evidence needle');
                await query.press('Enter');
                const snippet = rows.locator('.session-match-snippet').first();
                await snippet.waitFor();
                assert.equal(await snippet.evaluate(element => {
                    const row = element.closest('.session-item').getBoundingClientRect();
                    const box = element.getBoundingClientRect();
                    return box.bottom <= row.bottom && box.right <= row.right;
                }), true, 'search snippet fits the record row');
                console.log('PASS record items', width, 'four themes, keyboard selection, copy, pin, press/release, batch hit targets and search snippets');
            } catch (error) {
                console.error('PAGE_ERRORS', errors); console.error('LAST_ACTIONS', actions.slice(-15));
                console.error('VISIBLE_STATE', (await page.locator('#app').innerText()).slice(-6500)); throw error;
            }
            assert.deepEqual(errors, [], 'no runtime errors'); assert.equal(actions.some(action => /model-test|thread-handoff-create|session-diagnostics-start/.test(action)), false, 'no model calls, automatic handoff or MCP start');
            await page.close(); console.log('PASS loaded desktop/compact entry', width);
        }
        for (const [file, original] of originals) assert.equal(digest(await fs.readFile(file)), digest(Buffer.from(original)), 'original session unchanged');
        assert.equal(await fs.access(path.join(home, '.codex/config.toml')).then(() => true, () => false), false, 'no provider bootstrap');
    } finally {
        await browser?.close(); if (app.exitCode === null) { const stopped = new Promise(resolve => app.once('exit', resolve)); app.kill('SIGTERM'); await stopped; }
        await fs.writeFile('.tmp/session-items-server.log', serverLog); await fs.rm(home, { recursive: true, force: true });
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
