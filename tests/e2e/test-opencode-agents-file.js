const fs = require('fs');
const path = require('path');
const { assert } = require('./helpers');

module.exports = async function testOpencodeAgentsFile(ctx) {
    const { api, tmpHome } = ctx;
    const opencodeDir = path.join(tmpHome, '.config', 'opencode');
    const agentsFilePath = path.join(opencodeDir, 'AGENTS.md');

    // ========== Read before config dir exists ==========
    const before = await api('get-opencode-agents-file');
    assert(before.exists === false, 'opencode AGENTS.md should not exist before any write');
    assert(before.baseDirMissing === true, 'get-opencode-agents-file should report baseDirMissing when config dir is absent');
    assert(typeof before.path === 'string', 'get-opencode-agents-file missing path');
    assert(before.path === agentsFilePath, 'get-opencode-agents-file path mismatch');
    assert('content' in before, 'get-opencode-agents-file missing content');
    assert('lineEnding' in before, 'get-opencode-agents-file missing lineEnding');
    assert(!fs.existsSync(opencodeDir), 'reading must not create the opencode config dir');

    // ========== Write is gated by the opencode tool permission ==========
    const writeDenied = await api('apply-opencode-agents-file', { content: 'should-not-write', lineEnding: '\n' });
    assert(writeDenied.error || writeDenied.success !== true, 'apply-opencode-agents-file must be blocked without opencode write permission');
    assert(!fs.existsSync(agentsFilePath), 'no file may be written while the opencode permission is off');

    const enableWrites = await api('set-tool-config-permission', { target: 'opencode', allowWrite: true });
    assert(enableWrites.success === true, 'set-tool-config-permission(opencode) should succeed');

    // ========== Apply then read back ==========
    const apply = await api('apply-opencode-agents-file', { content: '# OpenCode\nkeep it simple\n', lineEnding: '\n' });
    assert(apply.success === true, `apply-opencode-agents-file failed${apply && apply.error ? `: ${apply.error}` : ''}`);
    assert(typeof apply.path === 'string', 'apply-opencode-agents-file missing path');
    assert(apply.path === agentsFilePath, 'apply-opencode-agents-file path mismatch');
    assert(fs.existsSync(agentsFilePath), 'AGENTS.md should exist on disk after apply');

    const after = await api('get-opencode-agents-file');
    assert(after.exists === true, 'opencode AGENTS.md should exist after apply');
    assert(after.baseDirMissing !== true, 'baseDirMissing must clear once the config dir exists');
    assert(after.content.includes('keep it simple'), 'opencode AGENTS.md content mismatch');
    assert(after.lineEnding === '\n', 'opencode AGENTS.md lineEnding mismatch');

    // ========== CRLF round trip ==========
    const crlf = await api('apply-opencode-agents-file', { content: '# OpenCode\r\nwindows line\r\n', lineEnding: '\r\n' });
    assert(crlf.success === true, 'apply-opencode-agents-file(crlf) failed');

    const crlfRead = await api('get-opencode-agents-file');
    assert(crlfRead.lineEnding === '\r\n', 'opencode AGENTS.md lineEnding should be crlf');
    assert(crlfRead.content.includes('windows line\r\n'), 'opencode AGENTS.md should keep crlf content');

    // ========== Empty content allowed, same as other agents files ==========
    const empty = await api('apply-opencode-agents-file', { content: '', lineEnding: '\n' });
    assert(empty.success === true, 'apply-opencode-agents-file should allow empty content');

    // ========== Isolation from the codex AGENTS.md ==========
    const codexApply = await api('apply-agents-file', { content: 'codex-only content\n', lineEnding: '\n' });
    assert(codexApply.success === true, 'apply-agents-file (codex) failed');

    const codexRead = await api('get-agents-file');
    const opencodeRead = await api('get-opencode-agents-file');
    assert(codexRead.content.includes('codex-only content'), 'codex AGENTS.md content mismatch');
    assert(opencodeRead.content === '' || !opencodeRead.content.includes('codex-only content'), 'opencode AGENTS.md must stay independent of the codex AGENTS.md');
    assert(codexRead.path !== opencodeRead.path, 'codex and opencode AGENTS.md must resolve to different paths');

    // ========== Diff preview dispatch ==========
    const diff = await api('preview-agents-diff', { context: 'opencode', content: '# OpenCode\npreviewed\n' });
    assert(!diff.error, `preview-agents-diff(opencode) failed${diff && diff.error ? `: ${diff.error}` : ''}`);
    assert(diff.context === 'opencode', 'preview-agents-diff(opencode) should echo the opencode context');
    assert(diff.path === agentsFilePath, 'preview-agents-diff(opencode) path mismatch');
    assert(diff.diff && diff.diff.hasChanges === true, 'preview-agents-diff(opencode) should detect the change');
};
