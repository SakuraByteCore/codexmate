const { assert, runSync, fs, path, os } = require('./helpers');

module.exports = async function testInvalidConfig(ctx) {
    const { node, cliPath } = ctx;
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-invalid-config-'));
    const codexDir = path.join(tempHome, '.codex');
    fs.mkdirSync(codexDir, { recursive: true });

    const malformedToml = [
        'model_provider = "openai"',
        'model = "gpt-5.3-codex"',
        '[model_providers.bad name]',
        'name = "bad name"',
        ''
    ].join('\n');

    fs.writeFileSync(path.join(codexDir, 'config.toml'), malformedToml, 'utf-8');

    const env = {
        ...process.env,
        HOME: tempHome,
        USERPROFILE: tempHome,
        CODEXMATE_FORCE_RESET_EXISTING_CONFIG: '0'
    };

    try {
        const statusResult = runSync(node, [cliPath, 'status'], { env });
        assert(statusResult.status !== 0, 'status should fail when config.toml is invalid');
        const statusError = JSON.parse(String(statusResult.stderr || '').trim());
        assert(statusError.error.code === 'CONFIG_TOML_PARSE_ERROR', 'status should emit structured parse error');
        assert(statusError.error.type === 'parse', 'status error type should be parse');
        assert(statusError.error.path, 'status error should include config path');

        const listResult = runSync(node, [cliPath, 'list'], { env });
        assert(listResult.status !== 0, 'list should fail when config.toml is invalid');
        const listError = JSON.parse(String(listResult.stderr || '').trim());
        assert(listError.error.code === 'CONFIG_TOML_PARSE_ERROR', 'list should emit structured parse error');
        assert(listError.error.type === 'parse', 'list error type should be parse');
    } finally {
        try {
            if (fs.rmSync) {
                fs.rmSync(tempHome, { recursive: true, force: true });
            } else {
                fs.rmdirSync(tempHome, { recursive: true });
            }
        } catch (_) {}
    }
};
