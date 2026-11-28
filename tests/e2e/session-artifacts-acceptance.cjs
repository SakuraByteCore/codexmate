'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

async function checkArtifacts({ page, originals, codexFile, width, restored = false }) {
    const basket = page.locator('.evidence-basket'); const form = basket.locator('.evidence-generator');
    const format = form.getByRole('combobox', { name: '输出格式', exact: true });
    const preview = basket.locator('.evidence-preview pre');
    const count = await basket.locator('.evidence-list li').count(); const invalidChecked = new Set();
    for (const kind of ['receipt', 'relay', 'receipt', 'evidence']) {
        await format.selectOption(kind); assert.equal(await preview.count(), 0, 'format changes clear old output');
        if (kind !== 'evidence') {
            await form.locator('textarea').fill('用户补充说明：下一步从真实入口验收');
            if (!invalidChecked.has(kind)) {
                invalidChecked.add(kind);
                if (restored) await fs.rename(codexFile, codexFile + '.artifact-fixture');
                else await fs.writeFile(codexFile, originals.get(codexFile).replace('evidence needle codex-one', 'changed source'));
                try {
                    await form.getByRole('button').click(); await basket.getByRole('alert').waitFor();
                    assert.equal(await preview.count(), 0, 'invalid originals refuse artifacts in both state chains');
                    assert.equal(await basket.locator('.evidence-list li').count(), count);
                } finally {
                    if (restored) await fs.rename(codexFile + '.artifact-fixture', codexFile);
                    else await fs.writeFile(codexFile, originals.get(codexFile));
                }
            }
        }
        await form.getByRole('button').focus(); await page.keyboard.press('Enter'); await preview.waitFor();
        const text = await preview.innerText(); assert.match(text, /SHA-256/); assert.match(text, /codex/); assert.match(text, /pi/);
        if (kind === 'receipt') { assert.match(text, /^# 开发小票/); assert.match(text, /历史检查记录汇总/); assert.match(text, /不代表任务完成/); }
        if (kind === 'relay') { assert.match(text, /^# 多 Agent 接力包/); assert.match(text, /第一棒：执行者/); assert.match(text, /第二棒：审阅者/); }
        if (kind !== 'evidence') { assert.match(text, /未执行.*未验收/); assert.match(text, /人工 UAT：待执行/); }
        const downloading = page.waitForEvent('download'); await basket.getByRole('button', { name: '下载 Markdown', exact: true }).click();
        const downloaded = await downloading;
        const filename = { evidence: 'codexmate-evidence.md', receipt: 'codexmate-development-receipt.md', relay: 'codexmate-agent-relay.md' }[kind];
        assert.equal(downloaded.suggestedFilename(), filename);
        assert.equal(await fs.readFile(await downloaded.path(), 'utf8'), '\uFEFF' + text + (text.endsWith('\n') ? '' : '\n'));
    }
    await format.selectOption('relay'); await form.locator('textarea').fill('layout sample');
    const geometry = await form.evaluate(element => {
        const boxes = [...element.querySelectorAll('input,select,textarea,button')].map(control => {
            const rect = control.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
        });
        return { fits: element.scrollWidth <= element.clientWidth + 1, boxes,
            overlap: boxes.some((left, index) => boxes.slice(index + 1).some(right => Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1)) };
    });
    assert.ok(geometry.fits); assert.equal(geometry.overlap, false);
    assert.ok(geometry.boxes.every(box => box.height >= 44 && box.width >= 44 && box.left >= 0 && box.right <= width + 1));
    if (width === 1440) assert.ok(Math.abs(geometry.boxes[0].top - geometry.boxes[1].top) <= 1, 'goal and format share a row');
    console.log('ARTIFACT_LAYOUT', width, JSON.stringify(geometry));
    await form.getByRole('combobox').focus(); await page.keyboard.press('Tab');
    assert.ok(await form.locator('textarea').evaluate(element => document.activeElement === element), 'Tab reaches notes');
    await form.locator('textarea').fill('pending output');
    let unblock; let intercepted;
    const gate = new Promise(resolve => { unblock = resolve; }); const held = new Promise(resolve => { intercepted = resolve; });
    const handler = async route => {
        if (route.request().postDataJSON()?.action === 'session-handoff-draft') { intercepted(); await gate; }
        await route.continue();
    };
    await page.route('**/api', handler);
    try {
        await form.getByRole('button').click(); await held; await form.locator('textarea').fill('updated while running');
        unblock(); await page.waitForFunction(() => !document.querySelector('.evidence-generator button').disabled);
        assert.equal(await preview.count(), 0, 'late result cannot publish after notes change');
    } finally { unblock(); await page.unroute('**/api', handler); }
    await format.selectOption('evidence'); await form.getByRole('button').click(); await preview.waitFor();
    console.log('PASS artifacts: formats, keyboard, invalid original/recovery, identical downloads, late result and layout', width, restored ? 'restored' : 'current');
}
module.exports = { checkArtifacts };
