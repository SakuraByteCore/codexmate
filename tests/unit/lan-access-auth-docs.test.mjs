import assert from 'assert';
import fs from 'fs';
import path from 'path';
import nodeTest from 'node:test';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const test = typeof globalThis.test === 'function' ? globalThis.test : nodeTest;

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('LAN access documentation matches the loopback default and token requirement', () => {
    const guideFiles = [
        'site/guide/limits.md',
        'site/guide/quick-start.md',
        'site/guide/start-here.md',
        'site/guide/web-ui.md'
    ];

    for (const relativePath of guideFiles) {
        const content = readProjectFile(relativePath);
        assert.doesNotMatch(content, /默认监听 `0\.0\.0\.0/, relativePath);
        assert.doesNotMatch(content, /默认局域网暴露未鉴权界面/, relativePath);
    }

    const limits = readProjectFile('site/guide/limits.md');
    assert.match(limits, /默认仅监听 `127\.0\.0\.1:3737`/);
    assert.match(limits, /必须设置 `CODEXMATE_HTTP_TOKEN`；未设置时启动直接失败/);
    assert.match(limits, /`CODEXMATE_ALLOWED_IPS`/);

    const quickStart = readProjectFile('site/guide/quick-start.md');
    assert.match(quickStart, /CODEXMATE_HTTP_TOKEN='<高强度随机值>' codexmate run --host 0\.0\.0\.0/);
    assert.match(quickStart, /用户名可留空，密码填写访问令牌/);
    assert.match(quickStart, /启动直接失败并提示 `CODEXMATE_HTTP_TOKEN`/);

    const startHere = readProjectFile('site/guide/start-here.md');
    assert.match(startHere, /任何非回环监听地址缺少令牌时，启动直接失败并提示 `CODEXMATE_HTTP_TOKEN`/);

    const webUi = readProjectFile('site/guide/web-ui.md');
    assert.match(webUi, /## 局域网访问/);
    assert.match(webUi, /Authorization: Bearer/);
    assert.match(webUi, /X-CodexMate-Token/);
    assert.match(webUi, /未设置会直接启动失败，错误信息包含 `CODEXMATE_HTTP_TOKEN`/);
    assert.match(webUi, /远程 `\/bridge\/` 请求强制使用 `Authorization: Bearer <访问令牌>`；缺失或令牌错误会返回 `401`/);
    assert.match(webUi, /`CODEXMATE_ALLOWED_IPS`/);
    assert.match(webUi, /判断仅依据 `req\.socket\.remoteAddress`/);
    assert.match(webUi, /配置后非白名单来源返回 `403`/);
});

test('CLI startup refuses a non-loopback listener without a token', () => {
    const cli = readProjectFile('cli.js');
    assert.match(cli, /对外监听必须设置 CODEXMATE_HTTP_TOKEN/);
    assert.match(cli, /! 启动失败:/);
    assert.doesNotMatch(cli, /未配置访问令牌，远程访问已禁用/);
    assert.doesNotMatch(cli, /如需局域网访问，请先设置 CODEXMATE_HTTP_TOKEN/);
});
