const { assert } = require('./helpers');

module.exports = async function testInstallStatus(ctx) {
    const { api } = ctx;
    const report = await api('install-status', undefined, 10000);
    assert(report && Array.isArray(report.targets), 'install-status should return targets');
    const claude = report.targets.find((item) => item && item.id === 'claude') || null;
    assert(claude, 'install-status should include claude target');
    assert(claude.installed === true, 'claude should be detected as installed when binary is present');
    assert(typeof claude.version === 'string', 'claude install-status should include version');
};

