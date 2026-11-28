'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { checkArtifacts } = require('./session-artifacts-acceptance.cjs');
const LONG_NAME = '故障复盘专题'.repeat(14);

async function checkCollections({ page, api, originals, codexFile, width }) {
    await page.locator('.session-features .feature-tabs button').filter({ hasText: '全文索引' }).click();
    await page.locator('.session-source-pill[data-source="all"]').click();
    await page.locator('.session-role-select').selectOption('user');
    const search = page.locator('.feature-search-form').first(); await search.locator('input').fill('evidence needle');
    await search.locator('input').press('Enter'); await page.getByRole('checkbox', { name: '加入证据包', exact: true }).first().waitFor();
    for (const choice of await page.getByRole('checkbox', { name: '加入证据包', exact: true }).all()) { await choice.focus(); await page.keyboard.press('Space'); }
    const collections = page.locator('.evidence-collections'); const basket = page.locator('.evidence-basket');
    await collections.locator('summary').click();
    const name = collections.getByLabel('专题名称', { exact: true }); await name.fill('专题 A'); await name.press('Enter');
    await collections.getByRole('button', { name: '专题 A', exact: true }).waitFor();
    await name.fill('专题 B'); await collections.getByRole('button', { name: '另存专题', exact: true }).click();
    await collections.getByRole('button', { name: '专题 B', exact: true }).waitFor();
    for (const title of ['专题 A', '专题 B', '专题 A']) { await collections.getByRole('button', { name: title, exact: true }).click(); await page.waitForFunction(title => document.querySelector('.collection-editor input')?.value === title, title); }
    assert.equal(await basket.locator('li').count(), 3);
    await basket.getByRole('button', { name: '移除', exact: true }).last().click();
    await collections.getByRole('button', { name: '保存专题', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.collection-list button[aria-pressed="true"]')?.parentElement.textContent.includes('2/100'));
    await collections.getByRole('button', { name: '专题 B', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('.evidence-basket li').length === 3);
    await page.reload(); await page.locator('#panel-sessions .session-features').waitFor(); assert.equal(await basket.count(), 0);
    await collections.locator('summary').click(); await collections.getByRole('button', { name: '专题 B', exact: true }).click();
    await basket.locator('li').first().waitFor(); assert.equal(await basket.locator('[data-state="ready"]').count(), 3);
    await basket.getByRole('button', { name: '查看原文', exact: true }).first().click(); await page.locator('.feature-focus').waitFor();
    await fs.writeFile(codexFile, originals.get(codexFile).replace('evidence needle codex-one', 'changed source'));
    await basket.getByRole('button', { name: '生成证据包', exact: true }).click(); await basket.getByRole('alert').waitFor();
    assert.equal(await basket.locator('.evidence-preview').count(), 0);
    await collections.getByRole('button', { name: '专题 B', exact: true }).click(); await basket.locator('[data-state="changed"]').waitFor();
    await fs.rename(codexFile, codexFile + '.fixture-backup');
    try {
        await collections.getByRole('button', { name: '专题 B', exact: true }).click(); await basket.locator('[data-state="unavailable"]').waitFor();
        await basket.getByRole('button', { name: '生成证据包', exact: true }).click(); await basket.getByRole('alert').waitFor();
        assert.equal(await basket.locator('.evidence-preview').count(), 0);
    } finally { await fs.rename(codexFile + '.fixture-backup', codexFile); await fs.writeFile(codexFile, originals.get(codexFile)); }
    await collections.getByRole('button', { name: '专题 B', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('.evidence-basket [data-state="ready"]').length === 3);
    await basket.getByRole('button', { name: '生成证据包', exact: true }).click(); await basket.locator('.evidence-preview').waitFor();
    const content = await basket.locator('.evidence-preview pre').innerText(); const downloading = page.waitForEvent('download');
    await basket.getByRole('button', { name: '下载 Markdown', exact: true }).click();
    assert.equal(await fs.readFile(await (await downloading).path(), 'utf8'), '\uFEFF' + content + (content.endsWith('\n') ? '' : '\n'));
    await checkArtifacts({ page, originals, codexFile, width, restored: true });
    await name.fill(LONG_NAME); await collections.getByRole('button', { name: '另存专题', exact: true }).click(); await collections.getByRole('button', { name: LONG_NAME, exact: true }).waitFor();
    const bounds = await collections.evaluate(element => ({ width: element.clientWidth, scroll: element.scrollWidth,
        controls: [...element.querySelectorAll('button,input')].filter(control => control.getBoundingClientRect().height).map(control => {
            const box = control.getBoundingClientRect(); return { left: box.left, right: box.right, height: box.height }; }) }));
    assert.ok(bounds.scroll <= bounds.width + 1, 'collection container has no horizontal overflow');
    assert.ok(bounds.controls.every(box => box.height >= 44 && box.left >= 0 && box.right <= width + 1), 'visible collection controls fit and retain hit targets');
    const overlaps = await collections.locator('.collection-list li').evaluateAll(rows => rows.some(row => {
        const boxes = [...row.children].map(element => element.getBoundingClientRect());
        return boxes.some((left, index) => boxes.slice(index + 1).some(right => Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1));
    })); assert.equal(overlaps, false, 'long collection labels, counts and neighboring buttons do not overlap');
    const axes = await collections.locator('.collection-list li').evaluateAll(rows => rows.map(row => {
        const count = row.querySelector('.feature-count').getBoundingClientRect(); const remove = row.lastElementChild.getBoundingClientRect();
        return { countRight: count.right, removeRight: remove.right, centerGap: Math.abs(count.top + count.height / 2 - remove.top - remove.height / 2) };
    }));
    assert.ok(axes.every(row => Math.abs(row.countRight - axes[0].countRight) <= 1 && Math.abs(row.removeRight - axes[0].removeRight) <= 1 && row.centerGap <= 1), 'collection counts and actions retain shared columns and vertical centers');
    console.log('POLISH collection columns', width, axes);
    await collections.screenshot({ path: `.tmp/collections-${width}.png` });
    for (const title of ['专题 A', '专题 B', LONG_NAME]) { const row = collections.locator('.collection-list li').filter({ has: page.getByRole('button', { name: title, exact: true }) }); await row.getByRole('button', { name: '移除专题', exact: true }).click(); await row.waitFor({ state: 'detached' }); }
    // Retain one named collection to test a real server restart later.
    const restartName = '重启恢复专题 ' + width;
    await name.fill(restartName); await collections.getByRole('button', { name: '保存专题', exact: true }).click(); await collections.getByRole('button', { name: restartName, exact: true }).waitFor();
    assert.equal((await api('session-collections-list')).items.some(item => item.name === restartName), true);
    console.log('PASS collections: explicit save, Enter/Space, A-B-A, independent edits, reload, changed/missing originals, exact export and layout', width);
}

async function checkStories({ page, api, first, second, width }) {
    const panel = page.locator('.project-git'); const picker = page.locator('.feature-project-picker');
    await panel.locator('.git-commit-list > li > button').first().click();
    const stories = panel.locator('.project-stories'); await stories.getByRole('combobox', { name: /关联会话/ }).waitFor();
    const report = await api('session-stories-list', { project: first }); const session = report.sessions[0];
    const key = JSON.stringify([session.source, session.sessionId, session.filePath]);
    await page.waitForFunction(key => [...document.querySelectorAll('.story-editor select option')].some(option => option.value === key), key);
    await stories.getByRole('combobox', { name: /关联会话/ }).selectOption(key); await stories.getByLabel('改动原因', { exact: true }).fill('解释当前改动');
    await stories.getByRole('combobox', { name: /关联会话/ }).focus(); await page.keyboard.press('Tab');
    assert.equal(await stories.getByLabel('改动原因', { exact: true }).evaluate(element => element === document.activeElement), true, 'Tab reaches the adjacent note field');
    await stories.getByRole('button', { name: '保存关联', exact: true }).focus(); await page.keyboard.press('Enter'); await stories.locator('.story-record').filter({ hasText: '解释当前改动' }).waitFor();
    assert.match(await stories.innerText(), /用户关联/); assert.match(await panel.innerText(), /时间关联候选/);
    const linked = await api('session-stories-list', { project: first });
    await api('session-story-save', { project: first, sha: linked.items[0].sha, session, note: '另一窗口修改', revision: linked.revision });
    await stories.getByRole('button', { name: '保存关联', exact: true }).click(); await stories.getByRole('alert').waitFor(); assert.match(await stories.getByRole('alert').innerText(), /其他操作修改/);
    await stories.getByRole('button', { name: '刷新关联', exact: true }).click(); await stories.locator('.story-record').filter({ hasText: '另一窗口修改' }).waitFor();
    await stories.getByLabel('改动原因', { exact: true }).fill('重新核对后保存'); await stories.getByRole('button', { name: '保存关联', exact: true }).click(); await stories.locator('.story-record').filter({ hasText: '重新核对后保存' }).waitFor();
    const secondSession = report.sessions[1]; const secondKey = JSON.stringify([secondSession.source, secondSession.sessionId, secondSession.filePath]);
    await stories.getByRole('combobox', { name: /关联会话/ }).selectOption(secondKey); await stories.getByLabel('改动原因', { exact: true }).fill('并列会话说明');
    await stories.getByRole('button', { name: '保存关联', exact: true }).click(); await page.waitForFunction(() => document.querySelectorAll('.story-record').length === 2);
    for (const project of [second, first]) {
        await picker.getByRole('button').filter({ hasText: project }).click(); await page.waitForFunction(project => document.querySelector('.project-git .feature-path')?.textContent.trim() === project, project);
        await panel.locator('.git-commit-list > li > button').first().click(); await stories.getByRole('combobox', { name: /关联会话/ }).waitFor();
        if (project === second) { await page.waitForFunction(() => !document.querySelector('.project-stories [role="status"]')); assert.equal(await stories.locator('.story-record').count(), 0); }
        else await stories.locator('.story-record').filter({ hasText: '重新核对后保存' }).waitFor();
    }
    await page.reload(); await page.locator('.session-features .feature-tabs button').filter({ hasText: '项目工作台' }).click();
    await picker.getByRole('button').filter({ hasText: first }).click(); await panel.locator('summary').click(); await panel.locator('.git-commit-list > li > button').first().click();
    await stories.locator('.story-record').filter({ hasText: '重新核对后保存' }).waitFor();
    const primary = stories.locator('.story-record').filter({ hasText: '重新核对后保存' });
    await primary.locator('button').first().click(); await page.locator('.session-preview.active').waitFor();
    await fs.rename(session.filePath, session.filePath + '.fixture-backup');
    try {
        await stories.getByRole('button', { name: '刷新关联', exact: true }).click(); await primary.getByText('会话不在当前发现候选中', { exact: false }).waitFor();
        assert.equal(await stories.locator('.story-record').count(), 2, 'missing discovered source keeps both stored links');
    } finally { await fs.rename(session.filePath + '.fixture-backup', session.filePath); }
    await stories.getByRole('button', { name: '刷新关联', exact: true }).click(); await primary.locator('button').first().waitFor();
    await primary.getByRole('button', { name: '取消关联', exact: true }).click(); await primary.waitFor({ state: 'detached' });
    assert.equal(await stories.locator('.story-record').count(), 1, 'removing one link preserves another session');
    await stories.getByRole('combobox', { name: /关联会话/ }).selectOption(key); await stories.getByLabel('改动原因', { exact: true }).fill('重启后的故事');
    await stories.getByRole('button', { name: '保存关联', exact: true }).click(); await stories.locator('.story-record').waitFor();
    assert.ok(await stories.evaluate(element => element.scrollWidth <= element.clientWidth + 1), 'story container fits');
    const metrics = await stories.locator('button,select,textarea').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().height).map(element => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, height: rect.height }; }));
    assert.ok(metrics.every(rect => rect.height >= 44 && rect.left >= 0 && rect.right <= width + 1), 'story hit targets and adjacent controls fit');
    const overlaps = await stories.locator('.story-editor').evaluate(form => {
        const boxes = [...form.querySelectorAll('button,select,textarea')].map(element => element.getBoundingClientRect());
        return boxes.some((left, index) => boxes.slice(index + 1).some(right => Math.min(left.right, right.right) - Math.max(left.left, right.left) > 1 && Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top) > 1));
    }); assert.equal(overlaps, false, 'story selector, note and action buttons do not overlap');
    const typography = await stories.evaluate(section => ({ title: Number.parseFloat(getComputedStyle(section.querySelector('h4')).fontSize), body: Number.parseFloat(getComputedStyle(section.querySelector('.feature-note')).fontSize) }));
    assert.ok(typography.title / typography.body >= 1.25, 'story heading has at least 1.25 scale contrast');
    const rows = await stories.locator('.story-record').evaluateAll(records => records.map(record => {
        const title = record.querySelector('button:not(.feature-quiet)').getBoundingClientRect(); const remove = record.querySelector('.feature-quiet').getBoundingClientRect();
        return { topGap: Math.abs(title.top - remove.top), overlap: Math.min(title.right, remove.right) - Math.max(title.left, remove.left) };
    })); assert.ok(rows.every(row => row.topGap <= 1 && row.overlap <= 0), 'story title and adjacent cancellation align without overlap');
    console.log('POLISH story hierarchy', width, typography, rows);
    await stories.screenshot({ path: `.tmp/stories-${width}.png` });
    console.log('PASS stories: explicit save/update, candidate distinction, conflict recovery, project round-trip, source opening, reload, removal and layout', width);
}
module.exports = { checkCollections, checkStories };
