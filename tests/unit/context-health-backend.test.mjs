import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { createSessionContextHealthController } = require('../../lib/session-context-health');

function controller(root, queries = {}) {
    return createSessionContextHealthController({ fs,
        normalizeSessionSourceName: (source) => ['codex', 'claude', 'gemini', 'codebuddy', 'workbuddy', 'pi', 'zed', 'opencode'].includes(source) ? source : '',
        resolveSessionFilePath: (_source, file) => file && file.startsWith(root) ? file : '',
        ...queries });
}

test('context health backend scans beyond preview limits and retrieves a hidden nested node', async () => {
    const base = path.resolve('.tmp'); fs.mkdirSync(base, { recursive: true });
    const root = fs.mkdtempSync(path.join(base, 'context-health-'));
    try {
        const filePath = path.join(root, 'session.jsonl');
        const rows = [{ type: 'session_meta', payload: { instructions: 's'.repeat(16) } },
            ...Array.from({ length: 1100 }, () => ({ role: 'user', content: 'u'.repeat(16) })),
            { role: 'user', content: 'parent', branches: [{ role: 'tool', content: 'Error: fixture\n'.repeat(1024) }] }];
        const text = rows.map(JSON.stringify).join('\n') + '\n';
        fs.writeFileSync(filePath, text);
        const api = controller(root);
        const report = await api.readSessionContextHealth({ source: 'codex', filePath });
        assert.strictEqual(report.complete, true);
        assert.strictEqual(report.messageCount, 1103);
        assert.strictEqual(report.scannedRecords, rows.length);
        assert.strictEqual(report.categories.reduce((sum, part) => sum + part.estimatedTokens, 0), report.totalEstimatedTokens);
        const largest = report.topMessages[0];
        assert.strictEqual(largest.id, 'record-1101.branches-0');
        const node = await api.readSessionContextNode({ source: 'codex', filePath, nodeId: largest.id });
        assert.strictEqual(node.node.text, rows[1101].branches[0].content);
        assert.strictEqual(fs.readFileSync(filePath, 'utf8'), text);
        assert.ok((await api.readSessionContextNode({ source: 'codex', filePath, nodeId: '../file' })).error);
        assert.ok((await api.readSessionContextHealth({ source: 'invalid', filePath })).error);
        fs.writeFileSync(filePath, '{not-json}\n');
        assert.ok((await api.readSessionContextHealth({ source: 'codex', filePath })).error);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('context health backend retains JSON metadata and all database messages including Zed sidecars', async () => {
    const base = path.resolve('.tmp'); fs.mkdirSync(base, { recursive: true });
    const root = fs.mkdtempSync(path.join(base, 'context-health-'));
    try {
        const filePath = path.join(root, 'session.json');
        fs.writeFileSync(filePath, JSON.stringify({ instructions: 's'.repeat(16), messages: [{ type: 'user', content: 'u'.repeat(16) }] }));
        const options = [];
        const api = controller(root, {
            queryOpencodeSessionMessages: (_id, params) => { options.push(params); return { messages: Array.from({ length: 2100 }, () => ({ role: 'user', content: 'u'.repeat(16) })) }; },
            queryZedSessionMessages: () => ({ messages: [{ Agent: { content: [{ Text: 'a'.repeat(16) }],
                tool_results: { first: { content: 't'.repeat(16) } }, reasoning_details: [{ text: 'r'.repeat(16) }] } }] })
        });
        const gemini = await api.readSessionContextHealth({ source: 'gemini', filePath });
        assert.strictEqual(gemini.messageCount, 2);
        assert.strictEqual(gemini.categories.find((part) => part.id === 'system').estimatedTokens, 4);
        const opencode = await api.readSessionContextHealth({ source: 'opencode', filePath, sessionId: 'fixture' });
        assert.strictEqual(opencode.messageCount, 2100);
        assert.strictEqual(options[0].maxMessages, Infinity);
        assert.strictEqual(options[0].contextHealth, true);
        const zed = await api.readSessionContextHealth({ source: 'zed', filePath, sessionId: 'fixture' });
        assert.strictEqual(zed.categories.find((part) => part.id === 'assistant').estimatedTokens, 8);
        assert.strictEqual(zed.categories.find((part) => part.id === 'tools').estimatedTokens, 4);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
