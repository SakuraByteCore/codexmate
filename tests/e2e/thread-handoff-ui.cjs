'use strict';
const assert = require('node:assert/strict');

async function checkHandoffUi({ page, api, width }) {
    const baseline = process.env.HANDOFF_UI_BASELINE === '1';
    await page.locator('.session-source-pill[data-source="codex"]').click();
    const first = page.locator('.session-item').filter({ hasText: 'codex-one' }).first();
    const second = page.locator('.session-item').filter({ hasText: 'codex-two' }).first();
    await first.click(); const handoff = page.locator('.thread-handoff');
    await handoff.locator(':scope > summary').focus(); await page.keyboard.press('Enter');
    const form = handoff.locator('.thread-handoff-form'); await form.waitFor();
    const target = form.locator('input'); const goal = form.locator('textarea').first(); const submit = form.locator('[type="submit"]');
    assert.ok(await submit.isDisabled()); await target.fill('reviewer-agent'); assert.ok(await submit.isDisabled());
    await goal.fill('核对会话交接的来源与结果，保留未验证项。');
    await form.locator('.thread-handoff-optional > summary').click();
    const fields = form.locator('.thread-handoff-optional textarea'); assert.equal(await fields.count(), 4);
    for (const [index, text] of ['已定位原文', '尚未验收', '从真实入口验证', 'web-ui/partials/index/thread-handoff.html'].entries()) await fields.nth(index).fill(text);
    await second.click(); await handoff.locator(':scope > summary').click(); assert.equal(await goal.inputValue(), '');
    await first.click(); await handoff.locator(':scope > summary').click(); assert.equal(await target.inputValue(), 'reviewer-agent');
    assert.match(await goal.inputValue(), /保留未验证项/);
    const before = await api('thread-handoff-list', { threadId: 'codex-one' });
    await page.waitForFunction(() => document.querySelector('.thread-handoff-submit') && !document.querySelector('.thread-handoff-submit').disabled);
    console.log('HANDOFF_BEFORE_SUBMIT', await submit.evaluate(element => ({ disabled: element.disabled, open: element.closest('details.thread-handoff').open, form: element.form?.className })));
    await submit.focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(count => document.querySelectorAll('.thread-handoff .session-workspace-list > li').length === count + 1, before.records.length);
    const latest = (await api('thread-handoff-list', { threadId: 'codex-one' })).records[0];
    assert.equal(latest.status, 'file_ready'); assert.equal(latest.target, 'reviewer-agent');
    const row = handoff.locator('.session-workspace-list > li').first(); assert.match(await row.innerText(), /文件已就绪/);
    const warnings = handoff.locator('[role="status"]'); assert.match(await warnings.first().innerText(), /尚未确认目标读取/);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await row.getByRole('button', { name: '复制卡片', exact: true }).click();
    const copy = handoff.locator('textarea[readonly]'); await copy.waitFor(); await copy.focus();
    const selection = await copy.evaluate(element => ({ start: element.selectionStart, end: element.selectionEnd, length: element.value.length, disabled: element.disabled }));
    assert.equal(selection.start, 0); assert.equal(selection.end, selection.length); assert.equal(selection.disabled, false);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), await copy.inputValue());
    assert.match(await handoff.innerText(), /未发送给目标/); assert.equal((await api('thread-handoff-list', { threadId: 'codex-one' })).records[0].status, 'file_ready');
    await api('thread-handoff-ack', { threadId: 'codex-one', handoffId: latest.id, agent: 'reviewer-agent', evidence: 'target-session-proof' });
    await handoff.getByRole('button', { name: '刷新历史', exact: true }).click(); await row.getByText('目标自报已读取（附证据）', { exact: false }).waitFor();
    if (!baseline) {
        const audit = row.locator('.thread-handoff-audit'); await audit.locator('summary').click();
        await row.getByText(latest.id, { exact: true }).waitFor();
        await audit.locator('summary').click(); assert.equal(await audit.getAttribute('open'), null);
        await row.getByText('target-session-proof', { exact: true }).waitFor();
    }
    await form.locator('.thread-handoff-optional > summary').click();
    const geometry = await handoff.evaluate(element => {
        const controls = [...element.querySelectorAll('input,textarea,button,summary')].filter(control => control.checkVisibility()).map(control => {
            const rect = control.getBoundingClientRect(); return { tag: control.tagName, width: rect.width, height: rect.height, left: rect.left, right: rect.right };
        });
        const form = element.querySelector('form'); const label = form.querySelector('label span'); const record = element.querySelector('.session-workspace-list > li');
        return { fits: element.scrollWidth <= element.clientWidth + 1, controls, inputFont: parseFloat(getComputedStyle(form.querySelector('input')).fontSize),
            labelFont: parseFloat(getComputedStyle(label).fontSize), historyFont: parseFloat(getComputedStyle(record).fontSize), height: element.getBoundingClientRect().height };
    }); console.log('HANDOFF_UI_METRICS', width, JSON.stringify(geometry));
    await handoff.screenshot({ path: `.tmp/handoff-ui-${baseline ? 'before' : 'after'}-${width}.png` });
    if (!baseline) {
        assert.ok(geometry.fits); assert.ok(geometry.inputFont >= 16 && geometry.labelFont >= 14 && geometry.historyFont >= 14);
        assert.ok(geometry.controls.every(rect => rect.height >= 44 && rect.width >= 44 && rect.left >= 0 && rect.right <= width + 1));
        const alignment = await form.evaluate(element => {
            const [target, goal] = [...element.querySelectorAll(':scope > label')].map(label => label.getBoundingClientRect());
            return { topGap: Math.abs(target.top - goal.top), leftGap: Math.abs(target.left - goal.left), separated: target.right <= goal.left };
        });
        assert.ok(width === 1440 ? alignment.topGap <= 1 && alignment.separated : alignment.leftGap <= 1);
        const targetHeight = await target.evaluate(element => element.getBoundingClientRect().height);
        assert.ok(targetHeight <= 48, 'single-line target does not stretch to the multiline goal');
        const overlaps = await form.evaluate(element => {
            const controls = [...element.querySelectorAll('input,textarea,button,summary')].filter(control => control.checkVisibility()).map(control => control.getBoundingClientRect());
            return controls.some((left, index) => controls.slice(index + 1).some(right => Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1));
        }); assert.equal(overlaps, false, 'form controls do not overlap');
        const rowAlignment = await row.evaluate(element => {
            const title = element.querySelector('.thread-handoff-record-title').getBoundingClientRect(); const button = element.querySelector('button').getBoundingClientRect();
            return { topGap: Math.abs(title.top - button.top), gap: button.left - title.right };
        }); assert.ok(rowAlignment.topGap <= 1 && rowAlignment.gap >= 8, 'record title and copy action align');
    }
    if (!baseline) {
        const themes = await handoff.evaluate(async element => {
            const root = document.documentElement; const previous = root.getAttribute('data-theme'); const samples = [];
            const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const context = canvas.getContext('2d');
            const luminance = color => {
                context.clearRect(0, 0, 1, 1); context.fillStyle = color; context.fillRect(0, 0, 1, 1);
                const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4; });
                return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
            };
            for (const theme of ['light', 'dark', 'ocean', 'violet']) {
                if (theme === 'light') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
                await new Promise(resolve => setTimeout(resolve, 200));
                const style = getComputedStyle(element.querySelector('.thread-handoff-submit')); const foreground = luminance(style.color); const background = luminance(style.backgroundColor);
                samples.push({ theme, contrast: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05), fits: element.scrollWidth <= element.clientWidth + 1 });
            }
            if (previous === null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', previous);
            return samples;
        });
        console.log('HANDOFF_THEMES', JSON.stringify(themes)); assert.ok(themes.every(theme => theme.contrast >= 4.5 && theme.fits));
        await page.emulateMedia({ reducedMotion: 'reduce' });
        assert.equal(await submit.evaluate(element => getComputedStyle(element).transitionDuration), '0s');
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        await checkHandoffRecordVariants({ page, api, handoff, latest, width });
    }
    await page.reload(); await page.locator('.session-source-pill[data-source="codex"]').click(); await first.click();
    await handoff.locator(':scope > summary').click(); assert.equal(await goal.inputValue(), '');
    await handoff.locator('.session-workspace-list > li').first().waitFor();
    if (!baseline) {
        const selection = page.locator('.session-preview.active .feature-message-select input').first();
        await selection.check();
        const draftButton = handoff.locator('.feature-actions button'); await draftButton.waitFor();
        await draftButton.focus(); await page.keyboard.press('Enter');
        const evidence = handoff.locator('.thread-handoff-evidence button'); await evidence.first().waitFor();
        assert.equal(await evidence.count(), 1); assert.match(await goal.inputValue(), /evidence needle codex-one/);
        await evidence.first().click(); await page.locator('.feature-focus pre').filter({ hasText: 'evidence needle codex-one' }).waitFor();
        console.log('PASS handoff selected-message draft and original evidence navigation', width);
    }

    console.log('PASS handoff UI: actual create/copy/ack, readonly selection, A-B-A drafts, reload and layout', width, baseline ? 'baseline' : 'final');
}

async function checkHandoffRecordVariants({ page, api, handoff, latest, width }) {
    const variants = [
        { ...latest, route: 'mcp', status: 'awaiting_read', readConfirmation: null, mcp: { server: 'fixture-memory', tool: 'store' }, writeResult: 'written', reason: '等待目标实际读取', fallback: false },
        { ...latest, route: 'file', status: 'file_ready', readConfirmation: null, writeResult: 'failed_or_unconfirmed', reason: '模拟写入失败，未重试', fallback: true, discoveryWarnings: [{ source: 'fixture config', reason: 'probe warning' }] }
    ];
    for (const record of variants) {
        const handler = async route => {
            if (route.request().postDataJSON()?.action === 'thread-handoff-list') await route.fulfill({ json: { records: [record] } });
            else await route.continue();
        };
        await page.route('**/api', handler);
        try {
            await handoff.getByRole('button', { name: '刷新历史', exact: true }).click();
            const row = handoff.locator('.thread-handoff-record').first();
            const button = row.getByRole('button', { name: record.route === 'mcp' ? '回退文件并复制卡片' : '复制卡片', exact: true });
            await button.waitFor(); await row.getByText('原因：' + record.reason, { exact: true }).waitFor(); assert.ok(await button.isEnabled());
            if (record.route === 'file') assert.match(await row.innerText(), /失败或结果未确认（不重试）/);
            const audit = row.locator('.thread-handoff-audit'); if (!await audit.evaluate(element => element.open)) await audit.locator('summary').click();
            await audit.getByText(record.id, { exact: true }).waitFor();
            if (record.mcp) assert.match(await audit.innerText(), /fixture-memory/);
            if (record.discoveryWarnings?.length) assert.match(await audit.innerText(), /probe warning/);
            assert.ok(await row.evaluate(element => element.scrollWidth <= element.clientWidth + 1));
            const buttons = await row.locator('button').evaluateAll(elements => elements.map(element => element.getBoundingClientRect()).map(rect => ({ width: rect.width, height: rect.height, right: rect.right })));
            assert.ok(buttons.every(rect => rect.width >= 44 && rect.height >= 44 && rect.right <= width + 1));
            await button.click(); await handoff.locator('textarea[readonly]').waitFor();
            assert.equal((await api('thread-handoff-list', { threadId: 'codex-one' })).records[0].status, 'read_confirmed', 'copying preserves actual self-reported read status');
        } finally { await page.unroute('**/api', handler); }
    }
    await handoff.getByRole('button', { name: '刷新历史', exact: true }).click();
    console.log('PASS handoff record variants: simulated MCP/file rendering, details, real file copy, no repeated delivery', width);
}

module.exports = { checkHandoffUi };
