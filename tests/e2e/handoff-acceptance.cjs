'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert/strict');
const { spawnSync } = require('child_process');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-handoff-cli-uat-'));
const launcher = path.resolve(__dirname, '../../tools/dev/launch.js');
const env = { ...process.env, HOME: root, USERPROFILE: root };
const card = { goal: '验收交接', completed: ['路由实现'], blockers: [], nextSteps: ['目标检索'], files: ['lib/handoff-mcp.js'] };
const cardFile = path.join(root, 'card.json');
fs.writeFileSync(cardFile, JSON.stringify(card));
function cli(args, success = true) {
    const result = spawnSync(process.execPath, [launcher, 'thread', ...args], { cwd: root, env, encoding: 'utf8', timeout: 12000 });
    assert.ifError(result.error);
    if (!success) { assert.notEqual(result.status, 0); return result.stderr; }
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
}
function create(thread) { return cli(['handoff', thread, '--card', cardFile, '--target', 'claude']); }
function list(thread) { return cli(['list', thread]).records[0]; }
const file = create('file');
assert.equal(file.record.route, 'file');
assert.match(file.message, /文件级路径/);
assert.deepEqual(JSON.parse(fs.readFileSync(file.record.filePath, 'utf8')).card, card);
assert.equal(list('file').id, file.record.id);
console.log('PASS file: launcher exit, visible route, complete artifact, fresh-process persistence');
const server = path.join(root, 'memory.cjs');
fs.writeFileSync(server, `const fs=require('fs'),path=require('path');
const mode=process.argv[2],file=path.join(process.cwd(),mode+'-calls.jsonl');
require('readline').createInterface({input:process.stdin}).on('line',line=>{
 const r=JSON.parse(line);fs.appendFileSync(file,JSON.stringify({pid:process.pid,...r})+'\\n');if(!r.id)return;
 let result=r.method==='initialize'?{protocolVersion:'2025-03-26'}:{tools:[{name:'set_memory',inputSchema:{type:'object',properties:{key:{type:'string'},value:{type:'string'},tags:{type:'array',items:{type:'string'}}},required:['key','value']}}]};
 if(r.method==='tools/call') {if(mode==='timeout')return;result=mode==='error'?{isError:true,content:[]}:{content:[{type:'text',text:'saved'}]};if(mode==='ok')fs.writeFileSync(path.join(process.cwd(),'memory.json'),JSON.stringify(r.params.arguments));}
 process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:r.id,result})+'\\n');});`);
function configure(mode) {
    fs.writeFileSync(path.join(root, '.mcp.json'), JSON.stringify({ mcpServers: {
        'shared-context-uat': { command: process.execPath, args: [server, mode] },
        'shared-context-unused': { command: process.execPath, args: [server, 'unused'] }
    } }));
}
for (const mode of ['ok', 'error', 'timeout']) {
    configure(mode);
    const result = create(mode);
    assert.equal(result.record.route, mode === 'ok' ? 'mcp' : 'file');
    assert.equal(result.record.status, mode === 'ok' ? 'awaiting_read' : 'file_ready');
    assert.equal(result.record.fallback, mode !== 'ok');
    assert.equal(result.record.readConfirmation, null);
    assert.equal(result.record.mcp.server, 'shared-context-uat');
    assert.ok(result.record.durationMs >= result.record.writeDurationMs);
    const calls = fs.readFileSync(path.join(root, mode + '-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(calls.filter(c => c.method === 'tools/call').length, 1);
    assert.equal(fs.existsSync(path.join(root, 'unused-calls.jsonl')), false);
    assert.throws(() => process.kill(calls[0].pid, 0), /ESRCH/);
    assert.equal(list(mode).id, result.record.id);
    if (mode !== 'ok') {
        assert.match(result.message, /文件级路径/);
        assert.equal(result.record.writeResult, 'failed_or_unconfirmed');
        assert.deepEqual(JSON.parse(fs.readFileSync(result.record.filePath, 'utf8')).card, card);
        console.log('PASS ' + mode + ': one write, visible fallback, durable card, MCP process terminated');
        continue;
    }
    const stored = JSON.parse(fs.readFileSync(path.join(root, 'memory.json'), 'utf8'));
    const delivered = JSON.parse(stored.value);
    assert.equal(stored.key, 'handoff:' + result.record.id);
    assert.deepEqual(delivered.card, card);
    const base = ['ok', '--handoff', result.record.id];
    assert.match(cli(['ack', ...base, '--agent', 'codex', '--evidence', 'retrieval-1'], false), /不匹配/);
    assert.match(cli(['ack', ...base, '--agent', 'claude'], false), /证据/);
    cli(['ack', ...base, '--agent', 'claude', '--evidence', 'target-session:retrieval-1']);
    assert.equal(list('ok').status, 'read_confirmed');
    const fallback = cli(['fallback', ...base]);
    assert.equal(fallback.text, fs.readFileSync(result.record.filePath, 'utf8'));
    const latest = list('ok');
    assert.equal(latest.route, 'file');
    assert.equal(latest.status, 'read_confirmed');
    assert.equal(latest.writeResult, 'written');
    assert.equal(latest.readConfirmation.evidence, 'target-session:retrieval-1');
    const events = fs.readFileSync(path.join(path.dirname(result.record.filePath), 'handoffs.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.deepEqual(events.map(e => e.event), ['created', 'delivery', 'read_acknowledged', 'manual_fallback']);
    console.log('PASS MCP: native tool, complete durable memory, separate ack, fallback and fresh-process audit');
}
console.log(JSON.stringify({ environment: process.platform + ' ' + process.version, substitute: 'local stdio protocol service, not third-party MCP', artifacts: root }));
