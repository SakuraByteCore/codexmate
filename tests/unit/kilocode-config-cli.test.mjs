import assert from 'assert';
import test from 'node:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.join(__dirname, '..', '..');
const cliPath = path.join(repoRoot, 'cli.js');

function runCli(args = [], env = {}) {
    return spawnSync(process.execPath, [cliPath, ...args], {
        cwd: repoRoot,
        encoding: 'utf-8',
        env: { ...process.env, ...env }
    });
}

function tmpHome() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-kilo-'));
}

test('kilo command writes KiloCode provider URL key and model config', () => {
    const home = tmpHome();
    const xdg = path.join(home, '.config');
    const result = runCli([
        'kilo',
        'config',
        ' https://api.example.com/v1/ ',
        ' sk-test ',
        ' gpt-e2e ',
        '--provider',
        'custom-kilo'
    ], { HOME: home, XDG_CONFIG_HOME: xdg });

    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /已写入 KiloCode 配置/);

    const configPath = path.join(xdg, 'kilo', 'kilo.jsonc');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.strictEqual(config.$schema, 'https://app.kilo.ai/config.json');
    assert.deepStrictEqual(config.enabled_providers, ['custom-kilo']);
    assert.strictEqual(config.model, 'custom-kilo/gpt-e2e');
    assert.deepStrictEqual(config.provider['custom-kilo'], {
        name: 'custom-kilo',
        npm: '@ai-sdk/openai-compatible',
        api: 'https://api.example.com/v1',
        env: [],
        models: {
            'gpt-e2e': {
                name: 'gpt-e2e',
                tool_call: true
            }
        },
        options: {
            apiKey: 'sk-test',
            baseURL: 'https://api.example.com/v1'
        }
    });
});

test('kilo command preserves existing provider config entries while updating target', () => {
    const home = tmpHome();
    const xdg = path.join(home, '.config');
    const configDir = path.join(xdg, 'kilo');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'kilo.json'), JSON.stringify({
        $schema: 'https://app.kilo.ai/config.json',
        enabled_providers: ['existing'],
        provider: {
            existing: {
                name: 'Existing',
                npm: '@ai-sdk/openai-compatible',
                api: 'https://old.example.com/v1',
                models: { old: { name: 'old' } },
                options: { apiKey: 'old-key', custom: true }
            }
        }
    }, null, 2));

    const result = runCli(['kilocode', 'config', 'https://new.example.com/v1', 'sk-new', 'new-model'], {
        HOME: home,
        XDG_CONFIG_HOME: xdg
    });

    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    const config = JSON.parse(fs.readFileSync(path.join(configDir, 'kilo.json'), 'utf-8'));
    assert.deepStrictEqual(config.enabled_providers, ['existing', 'codexmate']);
    assert.strictEqual(config.provider.existing.options.apiKey, 'old-key');
    assert.strictEqual(config.provider.codexmate.api, 'https://new.example.com/v1');
    assert.strictEqual(config.provider.codexmate.options.apiKey, 'sk-new');
    assert.strictEqual(config.model, 'codexmate/new-model');
});


test('kilo help documents launch and config modes', () => {
    const home = tmpHome();
    const result = runCli(['kilo', '--help'], { HOME: home, XDG_CONFIG_HOME: path.join(home, '.config') });
    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /默认启动 KiloCode/);
    assert.match(result.stdout, /kilo config <URL>/);
});
