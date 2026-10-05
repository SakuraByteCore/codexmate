#!/usr/bin/env node
'use strict';
/**
 * codexmate 启动包装器（launcher）
 * 作用：以 spawn 方式原样转发 `node cli.js <argv>`；
 * 仅当子进程因「package.json 中已声明的依赖缺失」（Cannot find module /
 * MODULE_NOT_FOUND）而失败时，在包根目录自动执行一次 npm install，
 * 然后重跑原命令一次；其余任何错误原样透传退出码，行为与直跑 cli.js 一致。
 * 本文件必须保持零第三方依赖（它要能跑在 npm install 之前）。
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const CLI_ENTRY = path.join(PACKAGE_ROOT, 'cli.js');
const RETRY_FLAG = 'CODEXMATE_LAUNCH_RETRIED';
const STDERR_KEEP_BYTES = 128 * 1024;
// 匹配 "Cannot find module 'X'" / "Cannot find module \"X\"" / MODULE_NOT_FOUND 路径
const MISSING_MODULE_RE = /(?:Cannot find module|MODULE_NOT_FOUND)(?:[^\S\r\n]*['"]([^'"\r\n]+)['"])?/;

function isWindows() {
    return process.platform === 'win32';
}

function forwardSignalsTo(child) {
    const signals = ['SIGINT', 'SIGTERM', 'SIGHUP'];
    signals.forEach(function (sig) {
        process.on(sig, function () {
            try { child.kill(sig); } catch (e) { /* 子进程可能已退出 */ }
        });
    });
}

function extractMissingPackageName(stderrText) {
    const m = MISSING_MODULE_RE.exec(stderrText);
    if (!m || !m[1]) return null;
    const raw = m[1];
    // 相对/绝对路径的 require 失败属于代码 bug，不属于环境缺依赖，不触发重试
    if (raw.startsWith('.') || raw.startsWith('/') || path.isAbsolute(raw)) return null;
    const parts = raw.split('/');
    // scoped 包（@scope/name）取前两段，普通包取第一段
    const pkgName = raw.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    return pkgName;
}

function isDeclaredDependency(pkgName) {
    try {
        const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
        const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
        return Object.prototype.hasOwnProperty.call(deps, pkgName);
    } catch (e) {
        return false;
    }
}

function runNpmInstall(cb) {
    const child = spawn('npm', ['install'], {
        cwd: PACKAGE_ROOT,
        stdio: 'inherit',
        shell: isWindows()
    });
    forwardSignalsTo(child);
    child.on('error', function (err) {
        process.stderr.write('[codexmate-launch] npm install 无法启动: ' + err.message + '\n');
        cb(false);
    });
    child.on('exit', function (code) {
        cb(code === 0);
    });
}

function spawnCli(args, opts, onExit) {
    const pipeStderr = !!opts.pipeStderr;
    const child = spawn(process.execPath, args, {
        cwd: process.cwd(),
        env: opts.env || process.env,
        stdio: ['inherit', 'inherit', pipeStderr ? 'pipe' : 'inherit']
    });
    let stderrText = '';
    if (pipeStderr) {
        child.stderr.on('data', function (chunk) {
            process.stderr.write(chunk); // 实时原样转发，绝不静默吞掉
            stderrText += chunk;
            if (stderrText.length > STDERR_KEEP_BYTES) {
                stderrText = stderrText.slice(-STDERR_KEEP_BYTES);
            }
        });
    }
    forwardSignalsTo(child);
    child.on('error', function (err) {
        process.stderr.write('[codexmate-launch] 无法启动 cli.js: ' + err.message + '\n');
        process.exit(127);
    });
    child.on('exit', function (code, signal) {
        onExit(code, signal, stderrText);
    });
    return child;
}

function runFinal(args) {
    const env = Object.assign({}, process.env);
    env[RETRY_FLAG] = '1';
    spawnCli(args, { env: env, pipeStderr: false }, function (code, signal) {
        if (signal) {
            process.exit(128 + 15);
        }
        process.exit(code === null ? 1 : code);
    });
}

function main() {
    const args = [CLI_ENTRY].concat(process.argv.slice(2));

    // 重入护栏：已被 launcher 重跑过的进程不再重试，杜绝死循环
    if (process.env[RETRY_FLAG] === '1') {
        runFinal(args);
        return;
    }

    spawnCli(args, { pipeStderr: true }, function (code, signal, stderrText) {
        if (signal) {
            process.exit(128 + 15);
        }
        const exitCode = code === null ? 1 : code;
        if (exitCode === 0) {
            process.exit(0);
        }
        const missing = extractMissingPackageName(stderrText);
        if (!missing || !isDeclaredDependency(missing)) {
            process.exit(exitCode); // 非环境性缺依赖：退出码原样透传
        }
        process.stderr.write(
            '[codexmate-launch] 检测到已声明的依赖缺失: ' + missing +
            '，自动执行 npm install 后重试一次...\n'
        );
        runNpmInstall(function (ok) {
            if (!ok) {
                process.stderr.write('[codexmate-launch] npm install 失败，保留上方原始报错并以原退出码退出。\n');
                process.exit(exitCode);
            }
            runFinal(args);
        });
    });
}

main();
