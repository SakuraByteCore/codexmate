'use strict';
/**
 * 桌面壳契约自检（K5.4 正样例断言）：
 * 断言 codexmate 后端在 --no-browser 模式下确实输出可被 electron.js
 * BACKEND_URL_LINE_RE 捕获的 Web UI 地址行，且该地址可返回非 5xx 响应。
 * 自检失败即退出码非 0，禁止采信壳的启动链路。
 */
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const { createRequire } = require('module');

const cwdRequire = createRequire(path.join(process.cwd(), 'package.json'));
let ENTRY = cwdRequire.resolve('codexmate');
if (!ENTRY.endsWith(path.sep + 'cli.js')) {
    const candidate = path.join(path.dirname(ENTRY), 'cli.js');
    if (require('fs').existsSync(candidate)) ENTRY = candidate;
}
const URL_LINE_RE = /(?:已打开|待访问):\s*(https?:\/\/[^\s\u001b]+)/;
const TEST_PORT = process.env.CODEXMATE_SELFTEST_PORT || '39391';

function fetchOk(url) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            res.resume();
            resolve(res.statusCode && res.statusCode < 500);
        });
        req.on('error', reject);
        req.setTimeout(3000, () => { req.destroy(); reject(new Error('probe timeout')); });
    });
}

const child = spawn(process.execPath, [ENTRY, 'run', '--no-browser'], {
    cwd: path.dirname(ENTRY),
    env: Object.assign({}, process.env, {
        CODEXMATE_NO_BROWSER: '1',
        CODEXMATE_PORT: TEST_PORT
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
});

let stdoutBuf = '';
let done = false;
const finish = (code, message) => {
    if (done) return;
    done = true;
    if (child.pid != null && !child.killed) {
        if (process.platform === 'win32') {
            spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
        } else {
            child.kill('SIGTERM');
        }
    }
    if (message) console.error(message);
    process.exit(code);
};

const guard = setTimeout(() => finish(1, 'FAIL: 后端启动超时'), 30000);

child.stdout.on('data', (chunk) => {
    stdoutBuf += chunk.toString('utf8');
    const match = stdoutBuf.match(URL_LINE_RE);
    if (!match) return;
    clearTimeout(guard);
    const url = match[1];
    const portOk = url.includes(`:${TEST_PORT}`);
    fetchOk(url).then((ok) => {
        const passed = portOk && ok;
        finish(passed ? 0 : 1, passed
            ? `PASS: 契约命中 -> ${url} (HTTP 探测通过)`
            : `FAIL: url=${url} portMatch=${portOk} httpOk=${ok}`);
    }).catch((err) => finish(1, `FAIL: HTTP 探测失败 ${err.message}`));
});

child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
});
child.on('exit', (code) => {
    if (!done) finish(1, `FAIL: 后端提前退出 (code ${code})`);
});
