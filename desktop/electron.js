'use strict';
/**
 * Codex Mate 桌面壳主进程。
 * 职责：spawn `codexmate run --no-browser` 后端 -> 解析 stdout 中的 Web UI 地址
 * -> BrowserWindow 顶层加载；退出时终止后端进程树；单实例锁。
 * 源码零侵入：不 require、不修改 codexmate 代码，仅依赖其 stdout 契约。
 */
const { app, BrowserWindow, shell, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const APP_TITLE = 'Codex Mate';
const START_TIMEOUT_MS = 30000;
const READY_TIMEOUT_MS = 30000;
const BACKEND_URL_LINE_RE = /(?:已打开|待访问):\s*(https?:\/\/[^\s\u001b]+)/;

let backendChild = null;
let mainWindow = null;
let shuttingDown = false;

function resolveBackendEntry() {
    // codexmate 的 exports 未暴露 ./cli.js，只能经由 "." 主入口解析
    let entry = require.resolve('codexmate');
    if (!entry.endsWith(`${path.sep}cli.js`)) {
        const candidate = path.join(path.dirname(entry), 'cli.js');
        if (fs.existsSync(candidate)) entry = candidate;
    }
    // ELECTRON_RUN_AS_NODE 下 Node 无 asar 补丁，改指 electron-builder 解包目录
    const asarSeg = `${path.sep}app.asar${path.sep}`;
    const unpackedSeg = `${path.sep}app.asar.unpacked${path.sep}`;
    return entry.split(asarSeg).join(unpackedSeg);
}

function startBackend() {
    return new Promise((resolve, reject) => {
        const entry = resolveBackendEntry();
        const cwd = path.dirname(entry);
        const child = spawn(process.execPath, [entry, 'run', '--no-browser'], {
            cwd,
            env: Object.assign({}, process.env, {
                CODEXMATE_NO_BROWSER: '1',
                ELECTRON_RUN_AS_NODE: '1'
            }),
            stdio: ['ignore', 'pipe', 'pipe'],
            windowsHide: true
        });
        backendChild = child;
        let stdoutBuf = '';
        let stderrTail = '';
        let settled = false;
        const finish = (err, url) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (err) reject(err);
            else resolve({ child, url });
        };
        const timer = setTimeout(() => {
            finish(new Error(`后端启动超时（${START_TIMEOUT_MS / 1000}s）\n${stderrTail}`));
        }, START_TIMEOUT_MS);
        child.stdout.on('data', (chunk) => {
            if (settled) return;
            stdoutBuf = (stdoutBuf + chunk.toString('utf8')).slice(-4096);
            const match = stdoutBuf.match(BACKEND_URL_LINE_RE);
            if (match) finish(null, match[1]);
        });
        child.stderr.on('data', (chunk) => {
            stderrTail = (stderrTail + chunk.toString('utf8')).slice(-2000);
        });
        child.on('error', (err) => finish(err));
        child.on('exit', (code) => {
            backendChild = null;
            if (!settled) finish(new Error(`后端进程提前退出 (code ${code})\n${stderrTail}`));
        });
    });
}

function waitForReady(url, timeoutMs) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const attempt = () => {
            const req = http.get(url, (res) => {
                res.resume();
                if (res.statusCode && res.statusCode < 500) resolve();
                else retry();
            });
            req.on('error', retry);
            req.setTimeout(2000, () => { req.destroy(); retry(); });
        };
        const retry = () => {
            if (Date.now() - startedAt >= timeoutMs) {
                reject(new Error(`Web UI 就绪超时: ${url}`));
                return;
            }
            setTimeout(attempt, 300);
        };
        attempt();
    });
}

function killBackend() {
    const child = backendChild;
    backendChild = null;
    if (!child || child.killed || child.pid == null) return;
    if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
            stdio: 'ignore',
            windowsHide: true
        });
    } else {
        try { child.kill('SIGTERM'); } catch (e) { /* 子进程可能已退出 */ }
    }
}

function showErrorPage(win, message) {
    if (!win || win.isDestroyed()) return;
    win.loadFile(path.join(__dirname, 'error.html'), {
        query: { message: String(message || '未知错误').slice(0, 4000) }
    });
}

function attachBackendExitWatch(child) {
    child.on('exit', (code) => {
        backendChild = null;
        if (!shuttingDown) showErrorPage(mainWindow, `后端进程已退出 (code ${code})`);
    });
}

function boot() {
    startBackend().then(({ child, url }) => {
        backendChild = child;
        attachBackendExitWatch(child);
        return waitForReady(url, READY_TIMEOUT_MS).then(() => {
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(url);
        });
    }).catch((err) => showErrorPage(mainWindow, err && err.message ? err.message : String(err)));
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 960,
        minHeight: 600,
        title: APP_TITLE,
        icon: path.join(__dirname, 'build', 'icon.png'),
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });
    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//.test(url)) shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.on('closed', () => { mainWindow = null; });
    return mainWindow;
}

ipcMain.on('desktop-retry', () => {
    killBackend();
    if (mainWindow && !mainWindow.isDestroyed()) boot();
});

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    });
    app.whenReady().then(() => {
        createWindow();
        boot();
    });
    app.on('window-all-closed', () => app.quit());
    app.on('before-quit', () => { shuttingDown = true; });
    app.on('will-quit', killBackend);
}
