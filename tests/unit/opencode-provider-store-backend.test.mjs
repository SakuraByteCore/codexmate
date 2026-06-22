import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

function postJson(port, payload, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: '/api',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.setEncoding('utf-8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body || '{}'));
                } catch (e) {
                    reject(new Error(`Invalid JSON response: ${body.slice(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(timeoutMs, () => req.destroy(new Error('Request timeout')));
        req.write(data);
        req.end();
    });
}

async function waitForServer(port) {
    let lastError;
    for (let i = 0; i < 30; i += 1) {
        try {
            await postJson(port, { action: 'status' }, 1000);
            return;
        } catch (e) {
            lastError = e;
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }
    throw lastError || new Error('server not ready');
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function allocateEphemeralPort() {
    return new Promise((resolve, reject) => {
        const server = http.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = address && typeof address.port === 'number' ? address.port : 0;
            server.close((err) => {
                if (err) {
                    reject(err);
                } else if (port > 0) {
                    resolve(port);
                } else {
                    reject(new Error('failed to allocate ephemeral port'));
                }
            });
        });
    });
}

async function withCodexMateServer(fn) {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-opencode-store-'));
    const home = path.join(tmpRoot, 'home');
    const xdg = path.join(tmpRoot, 'xdg');
    fs.mkdirSync(home, { recursive: true });
    fs.mkdirSync(xdg, { recursive: true });
    const port = await allocateEphemeralPort();
    const child = spawn(process.execPath, [path.join(projectRoot, 'cli.js'), 'run', '--no-browser'], {
        cwd: projectRoot,
        env: {
            ...process.env,
            HOME: home,
            USERPROFILE: home,
            XDG_CONFIG_HOME: xdg,
            CODEX_HOME: '',
            CLAUDE_HOME: '',
            CLAUDE_CONFIG_DIR: '',
            CODEXMATE_PORT: String(port),
            CODEXMATE_NO_BROWSER: '1'
        },
        stdio: ['ignore', 'ignore', 'pipe']
    });
    let stderr = '';
    child.stderr.on('data', chunk => stderr += chunk.toString());
    try {
        await waitForServer(port);
        const api = (action, params = {}, timeoutMs) => postJson(port, { action, params }, timeoutMs);
        await fn({ api, home, xdg });
    } catch (e) {
        if (stderr) e.message += `\nserver stderr:\n${stderr}`;
        throw e;
    } finally {
        await new Promise((resolve) => {
            const timer = setTimeout(() => {
                try { child.kill('SIGKILL'); } catch (e) {}
                resolve();
            }, 1500);
            child.once('exit', () => {
                clearTimeout(timer);
                resolve();
            });
            try { child.kill('SIGINT'); } catch (e) {}
        });
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
}

test('opencode provider library is stored under .codexmate and only selected provider is projected to OpenCode', async () => {
    await withCodexMateServer(async ({ api, home, xdg }) => {
        const enable = await api('set-tool-config-permission', { target: 'opencode', allowWrite: true });
        assert.strictEqual(enable.success, true);

        const first = await api('update-opencode-selection', {
            provider: 'anthropic',
            model: 'claude-4-sonnet',
            apiKey: 'sk-anthropic',
            agent: 'build',
            applyToCoreAgents: true,
            autoCompact: false,
            maxTokens: '5000',
            reasoningEffort: 'high'
        });
        assert.strictEqual(first.success, true, first.error || 'first apply failed');

        const opencodeConfigPath = path.join(xdg, 'opencode', 'opencode.jsonc');
        const providerStorePath = path.join(home, '.codexmate', 'opencode', 'providers.json');
        assert.strictEqual(first.targetPath, opencodeConfigPath);
        assert.strictEqual(first.providerStorePath, providerStorePath);

        const second = await api('update-opencode-selection', {
            provider: 'openai',
            model: 'gpt-4.1',
            apiKey: 'sk-openai',
            agent: 'build',
            applyToCoreAgents: true,
            autoCompact: true
        });
        assert.strictEqual(second.success, true, second.error || 'second apply failed');

        const opencodeConfig = readJson(opencodeConfigPath);
        assert.strictEqual(opencodeConfig.model, 'openai/gpt-4.1');
        assert.deepStrictEqual(Object.keys(opencodeConfig.provider).sort(), ['openai']);
        assert.strictEqual(opencodeConfig.provider.openai.options.apiKey, 'sk-openai');
        assert(!JSON.stringify(opencodeConfig).includes('sk-anthropic'), 'inactive provider secret should not leak into OpenCode config');

        const store = readJson(providerStorePath);
        assert.deepStrictEqual(Object.keys(store.providers).sort(), ['anthropic', 'openai']);
        assert.strictEqual(store.providers.anthropic.apiKey, 'sk-anthropic');
        assert.strictEqual(store.providers.openai.apiKey, 'sk-openai');
        assert.strictEqual(store.lastApplied.provider, 'openai');

        const refreshed = await api('get-opencode-config');
        const providers = Object.fromEntries(refreshed.providers.map(item => [item.name, item]));
        assert.strictEqual(providers.anthropic.source, 'codexmate');
        assert.strictEqual(providers.openai.source, 'opencode');
    });
});

test('opencode projection cleanup does not delete user-modified native provider config', async () => {
    await withCodexMateServer(async ({ api, xdg }) => {
        const enable = await api('set-tool-config-permission', { target: 'opencode', allowWrite: true });
        assert.strictEqual(enable.success, true);

        const first = await api('update-opencode-selection', {
            provider: 'anthropic',
            model: 'claude-4-sonnet',
            apiKey: 'sk-anthropic',
            agent: 'build',
            applyToCoreAgents: false
        });
        assert.strictEqual(first.success, true, first.error || 'first apply failed');

        const opencodeConfigPath = path.join(xdg, 'opencode', 'opencode.jsonc');
        const manuallyEdited = readJson(opencodeConfigPath);
        manuallyEdited.provider.anthropic.options.baseURL = 'https://user-edited.example.test';
        fs.writeFileSync(opencodeConfigPath, JSON.stringify(manuallyEdited, null, 2) + '\n', 'utf-8');

        const second = await api('update-opencode-selection', {
            provider: 'openai',
            model: 'gpt-4.1',
            apiKey: 'sk-openai',
            agent: 'build',
            applyToCoreAgents: false
        });
        assert.strictEqual(second.success, true, second.error || 'second apply failed');

        const opencodeConfig = readJson(opencodeConfigPath);
        assert(opencodeConfig.provider.anthropic, 'user-modified provider should be preserved');
        assert.strictEqual(opencodeConfig.provider.anthropic.options.baseURL, 'https://user-edited.example.test');
        assert(opencodeConfig.provider.openai, 'new selected provider should be projected');
    });
});

test('opencode projection cleanup does not delete pre-existing native provider even when unchanged', async () => {
    await withCodexMateServer(async ({ api, xdg }) => {
        const opencodeConfigPath = path.join(xdg, 'opencode', 'opencode.jsonc');
        fs.mkdirSync(path.dirname(opencodeConfigPath), { recursive: true });
        fs.writeFileSync(opencodeConfigPath, JSON.stringify({
            $schema: 'https://opencode.ai/config.json',
            model: 'anthropic/claude-4-sonnet',
            provider: {
                anthropic: {
                    options: {
                        apiKey: 'sk-user-native'
                    }
                }
            },
            disabled_providers: ['anthropic'],
            agent: {
                build: {
                    model: 'anthropic/claude-4-sonnet'
                }
            }
        }, null, 2) + '\n', 'utf-8');

        const enable = await api('set-tool-config-permission', { target: 'opencode', allowWrite: true });
        assert.strictEqual(enable.success, true);

        const first = await api('update-opencode-selection', {
            provider: 'anthropic',
            model: 'claude-4-sonnet',
            agent: 'build',
            applyToCoreAgents: false,
            disabled: true
        });
        assert.strictEqual(first.success, true, first.error || 'first apply failed');

        const second = await api('update-opencode-selection', {
            provider: 'openai',
            model: 'gpt-4.1',
            apiKey: 'sk-openai',
            agent: 'build',
            applyToCoreAgents: false
        });
        assert.strictEqual(second.success, true, second.error || 'second apply failed');

        const opencodeConfig = readJson(opencodeConfigPath);
        assert(opencodeConfig.provider.anthropic, 'pre-existing native provider must not be deleted');
        assert.strictEqual(opencodeConfig.provider.anthropic.options.apiKey, 'sk-user-native');
        assert(opencodeConfig.provider.openai, 'new selected provider should be projected');
        assert.deepStrictEqual(opencodeConfig.disabled_providers, ['anthropic'], 'pre-existing native disabled provider entry must be preserved');
    });
});
