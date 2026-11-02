#!/usr/bin/env node
'use strict';

// 启动 Codex Mate Web UI，供 tester-army/e2e 浏览器测试使用。
// 使用临时 HOME 隔离开发者真实配置，进程退出后立即清理临时目录。

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..');
const port = String(process.argv[2] || process.env.CODEXMATE_PORT || '3939');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-e2e-home-'));

const child = spawn(
    process.execPath,
    [path.join(repoRoot, 'cli.js'), 'run', '--no-browser', '--host=127.0.0.1'],
    {
        cwd: repoRoot,
        env: Object.assign({}, process.env, {
            HOME: home,
            USERPROFILE: home,
            CODEXMATE_PORT: port,
            CODEXMATE_NO_BROWSER: '1'
        }),
        stdio: 'inherit'
    }
);

let stopping = false;

function stop(signal) {
    if (stopping) return;
    stopping = true;
    child.kill(signal);
}

function cleanup() {
    try {
        fs.rmSync(home, { recursive: true, force: true });
    } catch (err) {
        console.error('[e2e-browser] 清理临时 HOME 失败:', err && err.message ? err.message : err);
    }
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

child.on('error', (err) => {
    console.error('[e2e-browser] 启动 Web UI 失败:', err && err.message ? err.message : err);
    cleanup();
    process.exit(1);
});

child.on('exit', (code, signal) => {
    cleanup();
    process.exit(signal ? 1 : (code === null ? 1 : code));
});
