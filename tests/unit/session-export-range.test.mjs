import assert from 'node:assert/strict';
import { createCodexConfigMethods } from '../../web-ui/modules/app.methods.codex-config.mjs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('session backend export and search contracts', () => {
    execFileSync(process.execPath, [fileURLToPath(new URL('./session-search-export.test.cjs', import.meta.url))], { timeout: 10000 });
});
test('session export range preserves default and clears truncation after full export', async () => {
    const requests = [], downloads = [];
    const methods = createCodexConfigMethods({ api: async (_, params) => {
        requests.push(params);
        return { content: 'message', truncated: params.maxMessages !== 'all', maxMessages: 1000 };
    } });
    const context = { sessionExporting: {}, sessionExportRange: 'default', getSessionExportKey: () => 's',
        downloadTextFile: (_, text) => downloads.push(text), showMessage() {}, t: key => key };
    const session = { source: 'codex', sessionId: 's', filePath: '/sample' };
    await methods.exportSession.call(context, session);
    assert.equal(Object.hasOwn(requests[0], 'maxMessages'), false);
    assert.deepEqual(context.sessionExportNotice, { key: 's' });
    context.sessionExportRange = 'all';
    await methods.exportSession.call(context, session);
    assert.equal(requests[1].maxMessages, 'all');
    assert.equal(context.sessionExportNotice, null);
    assert.equal(context.sessionExporting.s, false);
    assert.deepEqual(downloads, ['message', 'message']);
});
