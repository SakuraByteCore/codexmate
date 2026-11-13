import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

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
    assert.match(limits, /`--host 0\.0\.0\.0` 并设置 `CODEXMATE_HTTP_TOKEN`/);

    const quickStart = readProjectFile('site/guide/quick-start.md');
    assert.match(quickStart, /CODEXMATE_HTTP_TOKEN='<高强度随机值>' codexmate run --host 0\.0\.0\.0/);
    assert.match(quickStart, /用户名可留空，密码填写访问令牌/);

    const webUi = readProjectFile('site/guide/web-ui.md');
    assert.match(webUi, /## 局域网访问/);
    assert.match(webUi, /Authorization: Bearer/);
    assert.match(webUi, /X-CodexMate-Token/);
    assert.match(webUi, /未设置 `CODEXMATE_HTTP_TOKEN` 时，远程请求会被拒绝/);
});

test('CLI startup warning describes remote access as disabled without a token', () => {
    const cli = readProjectFile('cli.js');
    assert.match(cli, /未配置访问令牌，远程访问已禁用/);
    assert.match(cli, /如需局域网访问，请先设置 CODEXMATE_HTTP_TOKEN/);
    assert.doesNotMatch(cli, /当前监听所有网卡（\$\{tokenEnabled \? '已启用鉴权' : '无鉴权'\}）/);
});
