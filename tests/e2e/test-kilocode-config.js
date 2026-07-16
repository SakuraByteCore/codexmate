const path = require('path');
const { assert, fs } = require('./helpers');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = async function testKilocodeConfig(ctx) {
    const { api, tmpHome, mockProviderUrl } = ctx;
    const configPath = path.join(tmpHome, '.config', 'kilo', 'kilo.jsonc');
    const launchRecord = path.join(tmpHome, 'kilocode-launch.json');

    const denied = await api('apply-kilocode-config', {
        provider: 'codexmate',
        url: `${mockProviderUrl}/v1`,
        apiKey: 'sk-denied',
        model: 'denied-model'
    });
    assert(denied && denied.error, 'KiloCode config write should be denied before permission is enabled');
    assert(!fs.existsSync(configPath), 'KiloCode config should not be created while write permission is disabled');

    const permission = await api('set-tool-config-permission', { target: 'kilocode', allowWrite: true });
    assert(permission && permission.success === true, 'KiloCode write permission should be enabled');
    assert(permission.permissions && permission.permissions.kilocode === true, 'KiloCode permission should persist in preferences');

    const models = await api('models-by-url', { baseUrl: `${mockProviderUrl}/v1`, apiKey: 'sk-mock' }, 5000);
    assert(models && Array.isArray(models.models), 'mock provider model lookup should return model list');
    assert(models.models.includes('e2e2-model'), 'mock provider model list should include fixture model');

    const applied = await api('apply-kilocode-config', {
        provider: 'codexmate-e2e',
        url: `${mockProviderUrl}/v1`,
        apiKey: 'sk-kilocode-e2e',
        model: 'e2e2-model'
    });
    assert(applied && applied.success === true, 'KiloCode config should be applied after permission is enabled');
    assert(fs.existsSync(configPath), 'KiloCode config file should be created');
    const rawConfig = fs.readFileSync(configPath, 'utf8');
    assert(rawConfig.includes('codexmate-e2e/e2e2-model'), 'KiloCode config should select provider/model reference');
    assert(rawConfig.includes(`${mockProviderUrl}/v1`), 'KiloCode config should store provider baseURL');
    assert(rawConfig.includes('sk-kilocode-e2e'), 'KiloCode config should store API key in target file');

    const info = await api('get-kilocode-config');
    assert(info && info.currentProvider === 'codexmate-e2e', 'KiloCode config summary should expose current provider');
    assert(info.currentModel === 'e2e2-model', 'KiloCode config summary should expose current model');
    assert(info.content && !info.content.includes('sk-kilocode-e2e'), 'KiloCode config preview should redact API key');
    assert(info.providers.some(provider => provider.name === 'codexmate-e2e' && provider.hasKey === true), 'KiloCode summary should include configured provider');

    const started = await api('start-kilocode', { args: ['--scenario', 'e2e'] }, 5000);
    assert(started && started.success === true, 'KiloCode launch should return success with fake binary');
    for (let i = 0; i < 20 && !fs.existsSync(launchRecord); i++) {
        await sleep(50);
    }
    assert(fs.existsSync(launchRecord), 'fake KiloCode binary should record launch invocation');
    const launch = JSON.parse(fs.readFileSync(launchRecord, 'utf8'));
    assert(Array.isArray(launch.args) && launch.args.includes('--scenario') && launch.args.includes('e2e'), 'KiloCode launch should pass through web args');
};
