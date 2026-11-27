'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { entryPath, token } = require('../e2e-browser/access-token.cjs');
const { startLocalServer, closeServer } = require('./helpers');

const route = '/api/file-sharing';
const auth = { Authorization: `Bearer ${token}` };
const filename = 'メモ.txt';
const plain = Buffer.from('file sharing\n');
const html = Buffer.from('<!doctype html><title>Attachment</title>');

function uploadBody(folder, files, bytes = Buffer.alloc(0)) {
    const manifest = Buffer.from(JSON.stringify({ folder, files }));
    const prefix = Buffer.alloc(4);
    prefix.writeUInt32BE(manifest.length);
    return Buffer.concat([prefix, manifest, bytes]);
}

async function checkFormerUploadQuotas(page, compact, fixtures, list) {
    const baseline = process.argv.includes('--quota-baseline');
    const name = 'large.bin';
    const size = 512 * 1024 * 1024 + 1;
    const file = path.join(fixtures, name);
    await fs.writeFile(file, 'file-sharing fixture');
    await fs.truncate(file, size);
    const folder = path.join(fixtures, 'many');
    await fs.mkdir(folder);
    for (let index = 0; index < 1001; index++) await fs.writeFile(path.join(folder, index + '.txt'), '');
    async function submit(target, selector, selection, name, expectedCount) {
        const share = target.locator('#plugin-file-sharing');
        await share.locator(selector).setInputFiles(selection);
        const notice = share.getByRole('alert');
        if (baseline) {
            await notice.waitFor();
            assert.match(await notice.textContent(), /512 MiB/);
            assert.equal(await share.locator('#upload-file-sharing').count(), 0);
            console.log('BASELINE: picker rejected ' + name);
            return;
        }
        await share.locator('.file-sharing-pending').getByText(name, { exact: true }).waitFor();
        assert.equal(await notice.count(), 0);
        await share.locator('#upload-file-sharing').click();
        await share.locator('.file-sharing-batches > li').nth(expectedCount - 1).waitFor({ timeout: 25000 });
        assert.equal((await list()).batches.length, expectedCount);
    }
    await submit(page, '#file-sharing-files', file, name, 1);
    if (!baseline) {
        await compact.reload();
        await compact.locator('#plugin-file-sharing .file-sharing-batches > li').first().waitFor();
    }
    await submit(compact, '#file-sharing-folder', folder, 'many/1000.txt', 2);
    if (baseline) {
        assert.deepEqual((await list()).batches, []);
        return;
    }
    await submit(compact, '#file-sharing-files', file, name, 3);
    const { batches } = await list();
    assert.equal(batches[1].files.length, 1001);
    assert.equal(batches.flatMap(batch => batch.files).reduce((sum, entry) => sum + entry.size, 0), 2 * size);
    await compact.reload();
    const share = compact.locator('#plugin-file-sharing');
    const rows = share.locator('.file-sharing-batches > li');
    await rows.nth(2).waitFor();
    assert.equal(await rows.nth(1).locator('a').count(), 1001);
    const digest = async source => {
        const hash = require('node:crypto').createHash('sha256');
        for await (const chunk of require('node:fs').createReadStream(source)) hash.update(chunk);
        return hash.digest('hex');
    };
    const expectedDigest = await digest(file);
    for (const index of [0, 2]) {
        const downloading = compact.waitForEvent('download');
        await rows.nth(index).locator('a').click();
        const download = await downloading;
        assert.equal(download.suggestedFilename(), name);
        assert.equal(await digest(await download.path()), expectedDigest);
        await download.delete();
    }
    for (const index of [2, 1, 0]) {
        await rows.nth(index).locator('button.file-sharing-remove').click();
        await rows.nth(index).waitFor({ state: 'detached' });
    }
    assert.deepEqual((await list()).batches, []);
    console.log('PASS: two 536870913-byte files with matching SHA-256; 1001-file folder; refresh and removal');
}

async function checkLanDownload({ page, compact, browser, base, textPath, htmlPath, folderPath }) {
    const mainPort = new URL(base).port;
    const linkEndpoint = base + new URL(textPath, base).pathname + '/link';
    const oldMethod = await fetch(linkEndpoint, { headers: auth });
    assert.equal(oldMethod.status, 405);
    assert.equal((await fetch(linkEndpoint, { method: 'POST' })).status, 401);
    assert.equal((await fetch(linkEndpoint, { method: 'POST', headers: { ...auth, Origin: 'http://localhost:9999' } })).status, 403);
    const chooseCopy = (target, file) => target.locator('#plugin-file-sharing .file-sharing-row').filter({ hasText: file }).locator('button.file-sharing-copy');
    const copy = chooseCopy(page, filename);
    assert.ok(await copy.getAttribute('aria-label'));
    assert.equal(await copy.getAttribute('title'), await copy.getAttribute('aria-label'));
    const copyLink = async (target, control, pathname) => {
        const issued = target.waitForResponse(response => new URL(response.url()).pathname === pathname && response.request().method() === 'POST');
        await control.click();
        const response = await issued;
        assert.equal(response.status(), 201);
        const payload = await response.json();
        assert.ok(payload.expiresAt > Date.now());
        return new URL(payload.url);
    };
    const first = await copyLink(page, copy, new URL(linkEndpoint).pathname);
    await page.waitForFunction(expected => navigator.clipboard.readText().then(value => value === expected), first.href);
    const second = await copyLink(page, copy, new URL(linkEndpoint).pathname);
    await page.waitForFunction(expected => navigator.clipboard.readText().then(value => value === expected), second.href);
    const capability = second.searchParams.get('token');
    const { isIpAllowed } = require('../../lib/http-access-control');
    assert.ok(isIpAllowed(second.hostname, ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16']));
    assert.notEqual(second.port, mainPort);
    assert.ok(capability && capability !== first.searchParams.get('token') && capability !== token, 'token must be fresh and independent');
    assert.equal((await fetch(base + route, { headers: { Authorization: 'Bearer ' + capability } })).status, 401);
    const request = await fetch(second);
    assert.equal(request.status, 200);
    assert.equal(request.headers.get('content-type'), 'application/octet-stream');
    assert.match(request.headers.get('content-disposition'), /^attachment;/);
    assert.deepEqual(Buffer.from(await request.arrayBuffer()), plain);
    assert.equal((await fetch(second, { method: 'HEAD' })).headers.get('content-length'), String(plain.length));
    assert.equal((await fetch(new URL(second.pathname, second))).status, 403);
    const wrongFile = new URL(second.href);
    wrongFile.pathname = new URL(htmlPath, base).pathname.replace('/api/file-sharing/', '/download/');
    assert.equal((await fetch(wrongFile)).status, 403);
    const wrongToken = new URL(second.href);
    wrongToken.searchParams.set('token', token);
    assert.equal((await fetch(wrongToken)).status, 403);
    assert.equal((await fetch(new URL(route + second.search, second))).status, 404);
    assert.equal((await fetch(second, { method: 'DELETE' })).status, 405);
    const visitor = await browser.newPage();
    try {
        const downloading = visitor.waitForEvent('download');
        await visitor.goto(second.href).catch(() => {}); // An attachment aborts document navigation.
        const download = await downloading;
        assert.equal(download.suggestedFilename(), filename);
        assert.deepEqual(await fs.readFile(await download.path()), plain);
    } finally { await visitor.close(); }

    await compact.locator('#plugin-file-sharing .plugins-panel-head button').nth(2).click();
    const folderCopy = chooseCopy(compact, 'shared/sub/nested.bin');
    await folderCopy.waitFor();
    await compact.evaluate(() => {
        // Simulate clients where both clipboard mechanisms are denied.
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
        document.execCommand = () => false;
    });
    let manualPrompt = false;
    compact.once('dialog', dialog => {
        manualPrompt = dialog.type() === 'prompt' && dialog.defaultValue().includes('/download/');
        void dialog.dismiss();
    });
    const folderLink = await copyLink(compact, folderCopy, new URL(folderPath, base).pathname + '/link');
    await folderCopy.waitFor();
    await compact.waitForFunction(() => !document.querySelector('.file-sharing-copy:disabled'));
    assert.ok(manualPrompt, 'clipboard denial must offer the generated URL');
    assert.deepEqual(Buffer.from(await (await fetch(folderLink)).arrayBuffer()), Buffer.from([0, 25, 255]));
    console.log('PASS: dedicated LAN address/port, unique tokens, isolated file permissions, browser download and manual copy fallback');
    return { first, second, folderLink };
}

async function runFileSharingAcceptance() {
    const { server, port } = await startLocalServer();
    await closeServer(server);
    const base = `http://127.0.0.1:${port}`;
    const ready = base + entryPath;
    const list = () => fetch(base + route, { headers: auth }).then(response => response.json());
    const upload = (body, headers = auth) => fetch(base + route, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body
    });
    const fixtures = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'file-sharing-acceptance-'));
    const folder = path.join(fixtures, 'shared');
    const empty = path.join(fixtures, 'empty');
    await fs.mkdir(path.join(folder, 'sub'), { recursive: true });
    await fs.mkdir(path.join(empty, 'sub'), { recursive: true });
    await fs.writeFile(path.join(folder, 'sub', 'nested.bin'), Buffer.from([0, 25, 255]));
    await fs.writeFile(path.join(folder, 'zero.txt'), '');
    await fs.writeFile(path.join(fixtures, 'not-selected.txt'), 'private fixture');
    const app = spawn(process.execPath, ['tests/e2e-browser/start-app.js', String(port)], {
        env: { ...process.env, TMP: fixtures, TEMP: fixtures }, stdio: 'ignore'
    });
    let browser;
    try {
        let response;
        for (let attempt = 0; attempt < 80; attempt++) {
            response = await fetch(ready).catch(() => null);
            if (response?.ok) break;
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        assert.ok(response?.ok, 'isolated CLI Web instance failed to start');
        assert.match(await response.text(), /id="plugin-file-sharing"/);
        const appBundle = await fetch(base + '/web-ui/app.js').then(r => r.text());
        assert.match(appBundle, /function createFileSharingMethods/);
        if (!process.argv.includes('--quota-baseline')) assert.doesNotMatch(appBundle, /plugins.fileSharing.limit/);
        browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || undefined });
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
        await page.goto(ready);
        await page.locator('#side-tab-plugins-file-sharing').click();
        const share = page.locator('#plugin-file-sharing');
        await share.locator('.skills-empty-state').waitFor();
        assert.deepEqual((await list()).batches, []);
        assert.equal(await page.locator('#side-tab-plugins-file-sharing').getAttribute('aria-current'), 'page');

        async function chooseFile(buttonIndex, files) {
            const chooser = page.waitForEvent('filechooser');
            await share.locator('.plugins-panel-head button').nth(buttonIndex).click();
            await (await chooser).setFiles(files);
        }
        await chooseFile(0, [{ name: filename, mimeType: 'text/plain', buffer: plain }]);
        await page.locator('#cancel-file-sharing').click();
        assert.deepEqual((await list()).batches, []);
        await chooseFile(0, [
            { name: filename, mimeType: 'text/plain', buffer: plain },
            { name: '<b>.html', mimeType: 'text/html', buffer: html }
        ]);
        await share.getByText('<b>.html', { exact: true }).waitFor();
        assert.equal(await share.locator('b').count(), 0);
        assert.deepEqual((await list()).batches, [], 'selection alone must not send files');
        await page.locator('#upload-file-sharing').click();
        await share.locator('.file-sharing-batches a').nth(1).waitFor();
        const textLink = share.locator('.file-sharing-batches a').first();
        const textPath = await textLink.getAttribute('href');
        const htmlPath = await share.locator('.file-sharing-batches a').nth(1).getAttribute('href');
        assert.equal((await fetch(base + route)).status, 401);
        assert.equal((await fetch(new URL(htmlPath, base + '/').origin + new URL(htmlPath, base + '/').pathname)).status, 401);
        const attachment = await fetch(base + htmlPath);
        assert.equal(attachment.status, 200);
        assert.equal(attachment.headers.get('content-type'), 'application/octet-stream');
        assert.match(attachment.headers.get('content-disposition'), /^attachment;/);
        assert.match(attachment.headers.get('content-security-policy'), /^sandbox/);
        assert.equal(attachment.headers.get('x-content-type-options'), 'nosniff');
        assert.deepEqual(Buffer.from(await attachment.arrayBuffer()), html);
        assert.equal((await fetch(base + htmlPath, { method: 'HEAD' })).headers.get('content-length'), String(html.length));
        const firstDownload = page.waitForEvent('download');
        await textLink.click();
        const download = await firstDownload;
        assert.equal(download.suggestedFilename(), filename);
        assert.deepEqual(await fs.readFile(await download.path()), plain);
        console.log('PASS: explicit selection, cancel, file downloads, attachment headers, auth');

        const compact = await browser.newPage({ viewport: { width: 390, height: 844 } });
        await compact.goto(ready);
        await compact.locator('#tab-plugins').click();
        await compact.locator('#panel-plugins [data-plugin-id="file-sharing"]').click();
        const compactShare = compact.locator('#plugin-file-sharing');
        await compactShare.getByText(filename, { exact: true }).waitFor();
        assert.equal(await compactShare.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
        const readerDownload = compact.waitForEvent('download');
        await compactShare.locator('.file-sharing-batches a').first().click();
        assert.deepEqual(await fs.readFile(await (await readerDownload).path()), plain);
        await compact.reload();
        await compactShare.getByText(filename, { exact: true }).waitFor();
        await chooseFile(1, folder);
        await share.getByText('shared/sub/nested.bin', { exact: true }).waitFor();
        await page.locator('#upload-file-sharing').click();
        const nested = share.locator('.file-sharing-row').filter({ hasText: 'shared/sub/nested.bin' }).getByRole('link');
        await nested.waitFor();
        const folderPath = await nested.getAttribute('href');
        assert.deepEqual(Buffer.from(await (await fetch(base + folderPath)).arrayBuffer()), Buffer.from([0, 25, 255]));
        assert.equal((await list()).batches.length, 2);
        await chooseFile(1, empty);
        assert.equal(await page.locator('#upload-file-sharing').count(), 0);
        assert.equal((await list()).batches.length, 2);
        console.log('PASS: nested directory, empty directory, compact layout, independent reader and reload');
        const lan = process.argv.includes('--lan') ? await checkLanDownload({ page, compact, browser, base, textPath, htmlPath, folderPath }) : null;

        assert.equal((await upload(uploadBody('empty', []))).status, 400);
        assert.equal((await upload(uploadBody('folder', [{ name: 'folder/../no.txt', size: 0 }]))).status, 400);
        const invalidLargeUpload = await upload(uploadBody('', [{ name: 'missing-large-body.bin', size: 512 * 1024 * 1024 + 1 }]));
        assert.equal(invalidLargeUpload.status, process.argv.includes('--quota-baseline') ? 413 : 400);
        if (!process.argv.includes('--quota-baseline')) assert.deepEqual(await invalidLargeUpload.json(), { error: 'invalid' });
        assert.equal((await upload(uploadBody('', [{ name: 'incomplete.txt', size: 3 }], Buffer.from('x')))).status, 400);
        assert.equal((await upload(uploadBody('', [{ name: 'foreign.txt', size: 0 }]), { ...auth, Origin: 'http://localhost:9999' })).status, 403);
        assert.equal((await upload(uploadBody('', [{ name: 'private.txt', size: 0 }]), {})).status, 401);
        assert.equal((await fetch(base + new URL(textPath, base).pathname, { method: 'DELETE' })).status, 401);
        assert.deepEqual((await list()).batches.flatMap(batch => batch.files.map(file => file.name)).sort(),
            ['<b>.html', 'shared/sub/nested.bin', 'shared/zero.txt', filename].sort());
        await compactShare.locator('.plugins-panel-head button').nth(2).click();
        await compactShare.getByText('shared/sub/nested.bin', { exact: true }).waitFor();
        await share.locator('.file-sharing-batches > li').nth(1).locator('button.file-sharing-remove').click();
        await nested.waitFor({ state: 'hidden' });
        assert.equal((await fetch(base + folderPath)).status, 404);
        if (lan) assert.equal((await fetch(lan.folderLink)).status, 404);
        assert.deepEqual(await fs.readFile(path.join(folder, 'sub', 'nested.bin')), Buffer.from([0, 25, 255]));
        await compactShare.locator('.plugins-panel-head button').nth(2).click();
        await compactShare.getByText('shared/sub/nested.bin', { exact: true }).waitFor({ state: 'hidden' });
        await share.locator('.file-sharing-batches > li').first().locator('button.file-sharing-remove').click();
        await share.locator('.skills-empty-state').waitFor();
        assert.equal((await fetch(base + textPath)).status, 404);
        if (lan) {
            assert.equal((await fetch(lan.first)).status, 404);
            assert.equal((await fetch(lan.second)).status, 404);
            console.log('PASS: removing the batch revokes every issued LAN link');
        }
        await compactShare.locator('.plugins-panel-head button').nth(2).click();
        await compactShare.locator('.skills-empty-state').waitFor();
        await page.reload();
        await share.locator('.skills-empty-state').waitFor();
        console.log('PASS: invalid batches never listed; removal disables download and preserves source');
        await checkFormerUploadQuotas(page, compact, fixtures, list);

        await page.locator('#side-tab-plugins').click();
        const panel = page.locator('#panel-plugins');
        await panel.locator('.prompt-compose-template-select').waitFor();
        assert.doesNotMatch(await panel.locator('.plugins-panel-head').innerText(), /ymkiux/);
        assert.equal(await panel.locator('.prompt-compose-form .plugins-panel-note').count(), 0);
        assert.equal(await panel.locator('.prompt-compose-preview .plugins-panel-note').count(), 0);
        const vars = panel.locator('.prompt-var-input');
        await vars.first().waitFor();
        assert.ok(await panel.locator('.prompt-vars-block .plugins-panel-note').isVisible());
        for (const field of await vars.all()) await field.fill('acceptance');
        const generated = await panel.locator('.prompt-preview-textarea').inputValue();
        assert.match(generated, /acceptance/);
        await panel.locator('.prompt-compose-preview button').click();
        // Windows clipboard normalizes textarea line breaks to CRLF.
        assert.equal((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n'), generated);
        await panel.locator('.mode-pill').nth(1).click();
        await panel.locator('.prompt-template-item').first().click();
        assert.equal(await panel.locator('.prompt-editor-name').isDisabled(), true);
        assert.equal(await panel.locator('.prompt-editor-head .plugins-panel-note').count(), 1);
        assert.doesNotMatch(await panel.locator('.prompt-editor-head').innerText(), /ymkiux/);
        await page.locator('#side-tab-plugins-text-tools').click();
        await panel.locator('textarea').first().fill('alpha\n beta');
        assert.equal(await panel.locator('textarea').nth(1).inputValue(), 'alpha beta');
        await panel.locator('.prompt-compose-preview button').click();
        assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'alpha beta');
        assert.doesNotMatch(await panel.locator('.plugins-panel-head').innerText(), /ymkiux/);
        console.log('PASS: template generation, readonly management, text compress and copy; no attribution');
    } finally {
        await browser?.close();
        if (app.exitCode === null) {
            const stopped = new Promise(resolve => app.once('exit', resolve));
            if (process.platform === 'win32') {
                const killer = spawn('taskkill', ['/pid', String(app.pid), '/t', '/f'], { stdio: 'ignore' });
                await new Promise(resolve => killer.once('exit', resolve));
            } else app.kill();
            await stopped;
        }
        await fs.rm(fixtures, { recursive: true, force: true, maxRetries: 3 });
    }
}

runFileSharingAcceptance().catch(error => { console.error(error); process.exitCode = 1; });
