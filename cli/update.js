const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync, spawn } = require('child_process');

/**
 * 快速更新命令实现
 */
async function cmdToolUpdate(args = []) {
    const pkg = require('../package.json');
    const currentVersion = pkg.version;
    const isCheckOnly = args.includes('--check');

    console.log(`[Update] 当前版本: v${currentVersion}`);

    let latestVersion = '';
    try {
        latestVersion = await fetchLatestVersion();
    } catch (err) {
        console.error(`[Update] 获取最新版本失败: ${err.message}`);
        return;
    }

    if (!latestVersion) {
        console.error('[Update] 无法获取最新版本信息');
        return;
    }

    if (latestVersion === currentVersion) {
        console.log('[Update] 已是最新版本。');
        return;
    }

    console.log(`[Update] 发现新版本: v${latestVersion}`);

    if (isCheckOnly) {
        console.log('[Update] 请运行 "codexmate update" 进行更新。');
        return;
    }

    // 确定安装方式并执行更新
    const installMethod = detectInstallMethod();
    console.log(`[Update] 检测到安装方式: ${installMethod}`);

    try {
        switch (installMethod) {
            case 'npm':
                updateViaNpm();
                break;
            case 'git':
                updateViaGit();
                break;
            case 'standalone':
                updateViaStandalone(latestVersion);
                break;
            default:
                console.log('[Update] 未知安装方式，请手动更新。');
                return;
        }
        console.log('[Update] 更新指令已下达。');
    } catch (err) {
        console.error(`[Update] 更新失败: ${err.message}`);
    }
}

async function fetchLatestVersion(options = {}) {
    return new Promise((resolve, reject) => {
        const timeoutMs = Number.isFinite(Number(options.timeoutMs))
            ? Math.max(0, Number(options.timeoutMs))
            : 5000;
        const url = 'https://registry.npmjs.org/codexmate/latest';
        let settled = false;
        const finish = (fn, value) => {
            if (settled) return;
            settled = true;
            fn(value);
        };
        const req = https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                        finish(reject, new Error(`NPM registry returned ${res.statusCode}`));
                        return;
                    }
                    const json = JSON.parse(data);
                    finish(resolve, json.version || '');
                } catch (e) {
                    finish(reject, new Error('解析 NPM 响应失败'));
                }
            });
        });
        if (timeoutMs > 0) {
            req.setTimeout(timeoutMs, () => {
                req.destroy(new Error('获取 NPM 最新版本超时'));
            });
        }
        req.on('error', (err) => {
            finish(reject, err);
        });
    });
}

function normalizePackageVersion(value) {
    const normalized = typeof value === 'string' ? value.trim().replace(/^v/i, '') : '';
    return /^\d+(?:\.\d+){0,2}(?:[-+][0-9A-Za-z.-]+)?$/.test(normalized) ? normalized : '';
}

function comparePackageVersions(left, right) {
    const normalizeParts = (value) => {
        const normalized = normalizePackageVersion(value);
        if (!normalized) return null;
        return normalized.split(/[+-]/)[0].split('.').map((part) => Number.parseInt(part, 10) || 0);
    };
    const a = normalizeParts(left);
    const b = normalizeParts(right);
    if (!a || !b) return 0;
    for (let i = 0; i < 3; i += 1) {
        const diff = (a[i] || 0) - (b[i] || 0);
        if (diff < 0) return -1;
        if (diff > 0) return 1;
    }
    return 0;
}

let latestVersionStatusCache = null;

async function fetchLatestVersionStatus(options = {}) {
    const currentVersion = normalizePackageVersion(options.currentVersion) || String(options.currentVersion || '');
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) ? Number(options.timeoutMs) : 5000;
    const cacheTtlMs = Number.isFinite(Number(options.cacheTtlMs)) ? Math.max(0, Number(options.cacheTtlMs)) : 10 * 60 * 1000;
    const now = typeof options.now === 'function' ? options.now() : Date.now();
    if (latestVersionStatusCache && cacheTtlMs > 0 && now - latestVersionStatusCache.checkedAtMs < cacheTtlMs) {
        return { ...latestVersionStatusCache.payload, cached: true };
    }

    const latestVersionRaw = await fetchLatestVersion({ timeoutMs });
    const latestVersion = normalizePackageVersion(latestVersionRaw) || String(latestVersionRaw || '');
    const payload = {
        currentVersion,
        latestVersion,
        updateAvailable: !!currentVersion && !!latestVersion && comparePackageVersions(currentVersion, latestVersion) < 0,
        source: 'npm',
        checkedAt: new Date(now).toISOString(),
        cached: false
    };
    latestVersionStatusCache = { checkedAtMs: now, payload };
    return payload;
}

function detectInstallMethod() {
    const cliPath = path.resolve(__dirname, '..');

    // 1. Git 仓库检测
    if (fs.existsSync(path.join(cliPath, '.git'))) {
        return 'git';
    }

    // 2. Standalone 检测 (通常在 ~/.codexmate)
    const installDir = process.env.CODEXMATE_INSTALL_DIR || path.join(require('os').homedir(), '.codexmate');
    if (cliPath.toLowerCase().startsWith(path.resolve(installDir).toLowerCase())) {
        return 'standalone';
    }

    // 3. NPM 全局安装检测
    // 如果路径包含 node_modules，通常是 npm 安装
    if (cliPath.includes('node_modules')) {
        return 'npm';
    }

    return 'unknown';
}

function updateViaNpm() {
    console.log('[Update] 正在通过 npm 更新...');
    // 使用 spawn 运行，这样可以实时看到输出
    const isWindows = process.platform === 'win32';
    const npmCmd = isWindows ? 'npm.cmd' : 'npm';

    // 注意：npm install -g 可能会因为权限问题失败
    console.log(`[Update] 执行: ${npmCmd} install -g codexmate`);

    // 我们不直接在这里结束进程，因为 npm 更新后会覆盖文件
    // 但为了安全，我们提示用户
    try {
        execSync(`${npmCmd} install -g codexmate`, { stdio: 'inherit' });
        console.log('[Update] NPM 更新完成，请重启程序。');
    } catch (e) {
        throw new Error('NPM 更新失败，请尝试使用 sudo 或管理员权限运行。');
    }
}

function updateViaGit() {
    console.log('[Update] 正在通过 Git 更新...');
    try {
        execSync('git pull', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
        execSync('npm install', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
        console.log('[Update] Git 更新完成。');
    } catch (e) {
        throw new Error('Git 更新失败，请检查网络或本地改动。');
    }
}

function updateViaStandalone(version) {
    console.log(`[Update] 正在更新 Standalone 版本至 v${version}...`);
    // 对于 Standalone，最简单的方法是重新运行安装脚本
    // 或者提示用户重新运行 curl 命令
    console.log('[Update] 请运行以下命令进行快速更新:');
    console.log('curl -fsSL https://raw.githubusercontent.com/SakuraByteCore/codexmate/main/scripts/install.sh | bash');

    // 尝试自动化（实验性）
    if (process.platform !== 'win32') {
        console.log('[Update] 尝试自动执行安装脚本...');
        try {
            const crypto = require('crypto');
            const tmpScript = path.join(os.tmpdir(), `codexmate-install-${Date.now()}.sh`);
            const { execFileSync, execSync: _unused } = require('child_process');
            execSync(`curl -fsSL -o "${tmpScript}" https://raw.githubusercontent.com/SakuraByteCore/codexmate/main/scripts/install.sh`, { stdio: 'inherit' });
            const scriptContent = fs.readFileSync(tmpScript, 'utf-8');
            const checksum = crypto.createHash('sha256').update(scriptContent).digest('hex');
            console.log(`[Update] Script checksum: ${checksum}`);
            fs.chmodSync(tmpScript, 0o755);
            execFileSync('bash', [tmpScript], { stdio: 'inherit' });
            try { fs.unlinkSync(tmpScript); } catch (_) {}
        } catch (e) {
            console.warn('[Update] 自动脚本执行失败，请手动运行。');
        }
    } else {
        console.log('[Update] Windows 环境下请手动下载最新版本或使用 npm 安装。');
    }
}

module.exports = {
    cmdToolUpdate,
    fetchLatestVersion,
    fetchLatestVersionStatus,
    normalizePackageVersion,
    comparePackageVersions
};
