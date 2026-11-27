import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = name => fs.readFileSync(new URL('../../' + name, import.meta.url), 'utf8');
test('file sharing has explicit browser/LAN commands and documents its lifecycle', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.equal(pkg.scripts['test:file-sharing'], 'node tests/e2e/file-sharing-acceptance.cjs');
    assert.equal(pkg.scripts['test:file-sharing:lan'], 'node tests/e2e/file-sharing-acceptance.cjs --lan');
    const guide = read('site/guide/web-ui.md');
    for (const phrase of ['## 文件共享', '60 分钟', '独立', '原文件', '停止服务', '管理令牌', '选择']) assert.ok(guide.includes(phrase), phrase);
    for (const file of ['README.md', 'README.zh.md', 'README.vi.md']) assert.match(read(file), /guide\/web-ui#(?:文件共享|%E6%96%87%E4%BB%B6%E5%85%B1%E4%BA%AB)/, file);
});
