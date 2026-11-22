const fs = require('fs');
const path = require('path');
const { assert } = require('./helpers');

module.exports = async function testContextHealth(ctx) {
    const { api, tmpHome, env } = ctx;
    for (const [source, filePath, sessionId] of [
        ['codex', ctx.sessionPath, ctx.sessionId], ['claude', ctx.claudeSessionPath, ctx.claudeSessionId],
        ['gemini', ctx.geminiSessionPath, ctx.geminiSessionId]
    ]) {
        const report = await api('session-context-health', { source, filePath, sessionId });
        assert(!report.error && report.complete && report.messageCount >= 2, `${source}: complete context analysis failed`);
        assert(report.categories.length === 5, `${source}: missing categories`);
        assert(report.categories.reduce((sum, part) => sum + part.estimatedTokens, 0) === report.totalEstimatedTokens, `${source}: category total mismatch`);
        const node = await api('session-context-node', { source, filePath, sessionId, nodeId: report.topMessages[0].id });
        assert(!node.error && node.node.text.length > 0, `${source}: node retrieval failed`);
    }
    for (const [source, dir] of [['codebuddy', '.codebuddy/projects'], ['workbuddy', '.workbuddy-ai/projects'], ['pi', '.pi/agent/sessions']]) {
        const filePath = path.join(tmpHome, dir, 'context-fixture.jsonl');
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, [{ type: 'message', message: { role: 'user', content: 'u'.repeat(16) } },
            { type: 'message', message: { role: 'assistant', content: 'a'.repeat(16) } }].map(JSON.stringify).join('\n') + '\n');
        const report = await api('session-context-health', { source, filePath });
        assert(!report.error && report.messageCount === 2 && report.totalEstimatedTokens === 8, `${source}: full context endpoint failed: ${report.error || report.messageCount}`);
        const node = await api('session-context-node', { source, filePath, nodeId: report.topMessages[0].id });
        assert(!node.error && node.node.text.length === 16, `${source}: exact node lookup failed`);
    }
    let DatabaseSync;
    try { ({ DatabaseSync } = require('node:sqlite')); } catch (error) {
        if (error.code !== 'ERR_UNKNOWN_BUILTIN_MODULE') throw error;
        console.log('[e2e] native SQLite unavailable; database source checks require Node SQLite support');
        return;
    }
    const root = env.XDG_DATA_HOME;
    const opencodePath = path.join(root, 'opencode', 'opencode.db');
    fs.mkdirSync(path.dirname(opencodePath), { recursive: true });
    const opencode = new DatabaseSync(opencodePath);
    try {
        opencode.exec('CREATE TABLE session (id TEXT PRIMARY KEY, directory TEXT, path TEXT, time_updated INTEGER, time_archived INTEGER); CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT); CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT, data TEXT); BEGIN;');
        opencode.prepare('INSERT INTO session VALUES (?, ?, ?, ?, NULL)').run('ses_context_fixture', tmpHome, tmpHome, 1);
        const addMessage = opencode.prepare('INSERT INTO message VALUES (?, ?, ?, ?, ?)');
        const addPart = opencode.prepare('INSERT INTO part VALUES (?, ?, ?)');
        for (let index = 0; index < 2100; index++) {
            addMessage.run(`msg_${index}`, 'ses_context_fixture', index, index, JSON.stringify({ role: 'user' }));
            addPart.run(`part_${index}`, `msg_${index}`, JSON.stringify({ type: 'text', text: 'u'.repeat(16) }));
        }
        opencode.exec('COMMIT;');
    } finally { opencode.close(); }
    const opencodeReport = await api('session-context-health', { source: 'opencode', sessionId: 'ses_context_fixture' });
    assert(!opencodeReport.error && opencodeReport.messageCount === 2100, `OpenCode full scan failed: ${opencodeReport.error || opencodeReport.messageCount}`);
    assert(opencodeReport.totalEstimatedTokens === 8400, 'OpenCode total must include records beyond the 2000-message preview cap');
    const zedPath = path.join(env.ZED_DATA_DIR, 'threads', 'threads.db');
    fs.mkdirSync(path.dirname(zedPath), { recursive: true });
    const zed = new DatabaseSync(zedPath);
    const zedId = '11111111-2222-3333-4444-555555555555';
    const document = { title: 'Context fixture', messages: [{ User: { content: [{ Text: 'u'.repeat(16) }] } },
        { Agent: { content: [{ Thinking: { text: 'r'.repeat(16) } }, { Text: 'a'.repeat(16) }],
            tool_results: { first: { content: 't'.repeat(16) } } } }] };
    try {
        zed.exec('CREATE TABLE threads (id TEXT PRIMARY KEY, data BLOB, data_type TEXT, folder_paths TEXT, summary TEXT, created_at TEXT, updated_at TEXT);');
        zed.prepare('INSERT INTO threads VALUES (?, ?, ?, ?, ?, ?, ?)').run(zedId, Buffer.from(JSON.stringify(document)), 'json', JSON.stringify([tmpHome]), 'fixture', '2026-01-01', '2026-01-01');
    } finally { zed.close(); }
    const zedReport = await api('session-context-health', { source: 'zed', sessionId: zedId });
    assert(!zedReport.error && zedReport.messageCount === 2, `Zed complete tree failed: ${zedReport.error || zedReport.messageCount}`);
    assert(zedReport.categories.find((part) => part.id === 'tools').estimatedTokens === 4, 'Zed tool sidecar must not disappear');
    assert(zedReport.categories.find((part) => part.id === 'assistant').estimatedTokens === 8, 'Zed reasoning must not disappear');
    const target = await api('session-context-node', { source: 'zed', sessionId: zedId, nodeId: zedReport.topMessages[0].id });
    assert(!target.error && target.node.text.includes('t'.repeat(16)), 'Zed node must include hidden tool text');
    assert((await api('session-context-health', { source: 'invalid' })).error, 'invalid source must fail');
    console.log('[e2e] context health complete scans, OpenCode >2000 records, Zed tools and node retrieval passed');
};
