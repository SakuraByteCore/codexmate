const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { assert } = require('./helpers');
const hash = (text) => crypto.createHash('sha256').update(text).digest('hex');

module.exports = async function testSessionFeatures(ctx) {
    const { api, tmpHome } = ctx;
    const project = path.join(tmpHome, 'workbench-project'); fs.mkdirSync(project, { recursive: true });
    const filePath = path.join(tmpHome, '.pi/agent/sessions/workbench-fixture.jsonl');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const sessionId = 'workbench-fixture';
    const rows = [{ type: 'session', id: sessionId, cwd: project },
        { type: 'message', message: { role: 'user', content: '工作台验收目标' } },
        { type: 'message', message: { role: 'toolResult', content: 'All 12 tests passed.' } }];
    const original = rows.map(JSON.stringify).join('\n') + '\n'; fs.writeFileSync(filePath, original);
    const session = { source: 'pi', sessionId, filePath, cwd: project };
    const saved = await api('session-bookmark-save', { ...session, nodeId: 'record-1', note: '备忘', tags: ['important'], revision: '' });
    assert(!saved.error && saved.items.length === 1, `bookmark save failed: ${saved.error}`);
    const listed = await api('session-bookmarks-list', { project, tag: 'important', query: '目标' });
    assert(listed.items.length === 1, 'bookmark combined filters failed');
    const stale = await api('session-bookmark-save', { id: saved.item.id, note: 'bad', tags: [], revision: '' });
    assert(stale.errorCode === 'feature-store-conflict', 'stale bookmark write was not rejected');
    const located = await api('session-bookmark-locate', { id: saved.item.id });
    assert(located.available && located.node.id === 'record-1', 'bookmark source lookup failed');
    const draft = await api('session-handoff-draft', { ...session, selections: ['record-1', 'record-2'] });
    assert(!draft.error && draft.card.completed.length === 1 && draft.evidence.length === 2 && !draft.sent, 'evidence draft failed');
    assert(!fs.existsSync(path.join(tmpHome, '.codexmate/threads')), 'draft must not write a handoff');
    const windows = await api('session-feature-settings-save', { key: 'pi:fixture:model', window: 100000, dismissed: true, revision: '' });
    assert(!windows.error && windows.settings.windows['pi:fixture:model'] === 100000, 'window preference persistence failed');
    fs.writeFileSync(path.join(project, 'AGENTS.md'), 'project prompt');
    const projects = await api('session-projects', { project });
    assert(!projects.error && projects.detail && projects.detail.bookmarks.length === 1, `project aggregation failed: ${projects.error}`);
    assert(Number.isFinite(Date.parse(projects.detail.updatedAt)), 'project must preserve native updatedAt metadata');
    const prompt = await api('session-project-prompt', { project, name: 'AGENTS.md' });
    assert(prompt.readOnly && prompt.content === 'project prompt', 'project prompt must be read-only');
    const start = await api('session-index-refresh', { source: 'pi' });
    assert(!start.error, `index refresh rejected: ${start.error}`);
    let index;
    for (let attempt = 0; attempt < 100; attempt++) {
        index = await api('session-index-status');
        if (index.job.status !== 'running') break;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert(['success', 'partial'].includes(index.job.status), `index did not finish: ${index.job.status}`);
    const search = await api('session-index-search', { source: 'pi', project, query: '验收目标' });
    assert(!search.error && search.results.length === 1, `indexed search failed: ${search.error}`);
    const result = search.results[0];
    const focused = await api('session-index-node', { ...result.session, nodeId: result.nodeId, textHash: result.textHash });
    assert(focused.node.text.includes('验收目标'), 'indexed source lookup failed');
    const log = path.join(project, 'mcp-probe.log');
    const mock = path.join(project, 'probe.cjs');
    fs.writeFileSync(mock, `const fs=require('fs'),rl=require('readline').createInterface({input:process.stdin});\nrl.on('line',line=>{const q=JSON.parse(line);fs.appendFileSync(${JSON.stringify(log)},q.method+'\\n');if(q.id===undefined)return;const result=q.method==='initialize'?{protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'fixture',version:'1'}}:{tools:[{name:'read_only',inputSchema:{type:'object'}}]};console.log(JSON.stringify({jsonrpc:'2.0',id:q.id,result}));});\nprocess.on('SIGTERM',()=>{fs.appendFileSync(${JSON.stringify(log)},'closed\\n');process.exit(0)});\n`);
    fs.writeFileSync(path.join(project, '.mcp.json'), JSON.stringify({ mcpServers: { fixture: { command: process.execPath, args: [mock] } } }));
    const targets = await api('session-diagnostics-targets', { cwd: project });
    assert(targets.names.includes('fixture'), 'configured MCP target missing');
    await api('session-diagnostics-start', { cwd: project });
    let diagnostic;
    for (let attempt = 0; attempt < 100; attempt++) {
        diagnostic = await api('session-diagnostics-status');
        if (diagnostic.report.status !== 'running') break;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert(!fs.existsSync(log), 'default local diagnosis started MCP');
    assert(diagnostic.report.items[1].status === 'not_checked', 'unselected provider falsely marked checked');
    await api('session-diagnostics-start', { cwd: project, mcpNames: ['fixture'] });
    for (let attempt = 0; attempt < 100; attempt++) {
        diagnostic = await api('session-diagnostics-status');
        if (diagnostic.report.status !== 'running') break;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    assert(diagnostic.report.items[2].status === 'passed', 'read-only MCP diagnosis failed');
    const calls = fs.readFileSync(log, 'utf8');
    assert(calls.includes('initialize') && calls.includes('tools/list') && calls.includes('closed') && !calls.includes('tools/call'), 'MCP probe wrote or leaked its process');
    assert(!JSON.stringify(diagnostic).includes(tmpHome), 'diagnosis leaked absolute HOME');
    assert(hash(fs.readFileSync(filePath)) === hash(original), 'workbench operations modified original session');
    assert(fs.readFileSync(path.join(project, 'AGENTS.md'), 'utf8') === 'project prompt', 'workbench changed project prompt');
    fs.writeFileSync(filePath, rows.map((row, index) => JSON.stringify(index === 1 ? { ...row, message: { role: 'user', content: 'changed' } } : row)).join('\n'));
    assert(!(await api('session-bookmark-locate', { id: saved.item.id })).available, 'changed source must be marked unavailable');
    const removed = await api('session-bookmark-remove', { id: saved.item.id, revision: listed.revision });
    assert(!removed.error && removed.items.length === 0 && fs.existsSync(filePath), 'unbookmark removed source');
    console.log('[e2e] six session workbench features, conflicts, source evidence and read-only MCP passed');
};
