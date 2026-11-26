const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { version: appVersion } = require('../package.json');

const CLIENT_VERSION_TIMEOUT_MS = 1500;
const CLIENT_HEADER_CACHE = new Map();
const SDK_NAMES = { 'anthropic-messages': '@anthropic-ai/sdk' };
const SDK_CLIENT_NAMES = { '@anthropic-ai/sdk': 'Anthropic', openai: 'OpenAI' };
const SDK_OS_NAMES = { android: 'Android', darwin: 'MacOS', win32: 'Windows', linux: 'Linux' };
const SDK_ARCH_NAMES = { x32: 'x32', x64: 'x64', arm: 'arm', arm64: 'arm64' };

function sdkVersion(packageName) {
    const roots = [process.cwd(), path.resolve(path.dirname(process.execPath), '../lib/node_modules')];
    for (const directory of (process.env.PATH || '').split(path.delimiter)) {
        const executable = path.join(directory, process.platform === 'win32' ? 'pi.cmd' : 'pi');
        if (fs.existsSync(executable)) roots.push(path.dirname(fs.realpathSync(executable)));
    }
    try {
        const metadata = require.resolve(`${packageName}/package.json`, { paths: roots });
        return JSON.parse(fs.readFileSync(metadata, 'utf8')).version;
    } catch (error) {
        if (error.code !== 'MODULE_NOT_FOUND' && error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
        return '';
    }
}

function modelTestClientHeaders(target, api) {
    const cacheKey = `${target}:${api}`;
    if (CLIENT_HEADER_CACHE.has(cacheKey)) return CLIENT_HEADER_CACHE.get(cacheKey);
    const fallback = `codexmate/${appVersion} (${target} API test)`;
    let headers = { 'user-agent': fallback };
    if (target === 'codex') {
        let version = '';
        try {
            const output = execFileSync('codex', ['--version'], { encoding: 'utf8', timeout: CLIENT_VERSION_TIMEOUT_MS, stdio: ['ignore', 'pipe', 'ignore'] });
            version = output.trim().match(/^codex-cli\s+(\S+)$/)?.[1] || '';
        } catch (error) {
            // Version probing is optional; never invent an installed client version.
            if (!error.code && !Number.isInteger(error.status)) throw error;
        }
        const platform = `${os.type()} ${os.release()}; ${os.arch()}`.replace(/[^\x20-\x7e]/g, '_');
        headers = { 'user-agent': version ? `codex_cli_rs/${version} (${platform})` : fallback, originator: 'codex_cli_rs' };
    } else {
        const packageName = SDK_NAMES[api] || 'openai';
        const version = sdkVersion(packageName);
        if (version) headers = {
            'user-agent': `${SDK_CLIENT_NAMES[packageName]}/JS ${version}`,
            'x-stainless-lang': 'js', 'x-stainless-package-version': version,
            'x-stainless-runtime': 'node', 'x-stainless-runtime-version': process.version,
            'x-stainless-os': SDK_OS_NAMES[process.platform] || `other:${process.platform}`,
            'x-stainless-arch': SDK_ARCH_NAMES[process.arch] || `other:${process.arch}`,
            'x-stainless-retry-count': '0'
        };
    }
    CLIENT_HEADER_CACHE.set(cacheKey, headers);
    return headers;
}

module.exports = { modelTestClientHeaders };
