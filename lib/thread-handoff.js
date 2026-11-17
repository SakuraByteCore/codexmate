const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { deliver } = require('./handoff-mcp');

function threadDirectory(threadId, options = {}) {
    if (typeof threadId !== 'string' || !threadId.trim()) throw new Error('缺少 threadId');
    const key = crypto.createHash('sha256').update(threadId).digest('hex');
    return path.join(options.root || path.join(os.homedir(), '.codexmate', 'threads'), key);
}

function appendEvent(threadId, event, options) {
    const directory = threadDirectory(threadId, options);
    fs.mkdirSync(directory, { recursive: true });
    fs.appendFileSync(path.join(directory, 'handoffs.jsonl'), JSON.stringify({ ...event, eventAt: new Date().toISOString() }) + '\n', { mode: 0o600 });
}

function listHandoffs(threadId, options) {
    const file = path.join(threadDirectory(threadId, options), 'handoffs.jsonl');
    if (!fs.existsSync(file)) return [];
    const records = new Map();
    for (const line of fs.readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
        const event = JSON.parse(line);
        records.set(event.id, { ...(records.get(event.id) || {}), ...event });
    }
    return Array.from(records.values()).reverse();
}

function requireRecord(params, options) {
    const record = listHandoffs(params.threadId, options).find(item => item.id === params.handoffId);
    if (!record) throw new Error('未找到交接记录');
    return record;
}

function validateCard(card) {
    if (!card || typeof card.goal !== 'string' || !card.goal.trim()) throw new Error('交接卡缺少 goal');
    for (const field of ['completed', 'blockers', 'nextSteps', 'files']) {
        if (!Array.isArray(card[field]) || card[field].some(value => typeof value !== 'string')) {
            throw new Error(`交接卡 ${field} 必须为字符串数组`);
        }
    }
    return Object.fromEntries(['goal', 'completed', 'blockers', 'nextSteps', 'files'].map(key => [key, card[key]]));
}

function resultMessage(record) {
    if (record.route === 'mcp') return `已写入 MCP ${record.mcp.server}；等待目标 Agent 读取确认。文件回退：${record.filePath}`;
    return `已走文件级路径：${record.filePath}；${record.reason || '已手动回退'}。尚未确认目标读取。`;
}

async function createHandoff(params, options = {}) {
    const directory = threadDirectory(params.threadId, options);
    if (typeof params.target !== 'string' || !params.target.trim()) throw new Error('缺少目标 Agent');
    const card = validateCard(params.card);
    const id = crypto.randomBytes(16).toString('hex');
    const createdAt = new Date().toISOString();
    const handoff = { id, threadId: params.threadId, target: params.target, createdAt, card,
        acknowledgement: { command: `codexmate thread ack ${params.threadId} --handoff ${id} --agent ${params.target} --evidence <读取证据>`,
            instruction: '目标 Agent 实际读取本卡后，使用原始 threadId、id、target 调用 thread ack；evidence 填写目标会话或检索记录标识。此确认为目标自报，非自动验证。' } };
    fs.mkdirSync(directory, { recursive: true });
    const filePath = path.join(directory, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(handoff, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    let record = { id, threadId: params.threadId, target: params.target, createdAt, filePath,
        route: 'file', status: 'file_ready', mcp: null, durationMs: 0, fallback: false,
        reason: 'MCP 探测进行中；文件已就绪', readConfirmation: null, event: 'created' };
    appendEvent(params.threadId, record, options);
    const delivery = await deliver(handoff, { ...options, ...(params.cwd ? { cwd: path.resolve(params.cwd) } : {}) });
    record = { ...record, route: delivery.ok ? 'mcp' : 'file',
        status: delivery.ok ? 'awaiting_read' : 'file_ready', mcp: delivery.mcp,
        durationMs: delivery.durationMs, writeDurationMs: delivery.writeDurationMs, discoveryWarnings: delivery.discoveryWarnings,
        writeResult: delivery.ok ? 'written' : delivery.stage === 'tools/call' ? 'failed_or_unconfirmed' : 'not_attempted',
        fallback: !delivery.ok, reason: delivery.reason, stage: delivery.stage, event: 'delivery' };
    appendEvent(params.threadId, record, options);
    return { record, message: resultMessage(record) };
}

function fallbackHandoff(params, options) {
    const record = requireRecord(params, options);
    const text = fs.readFileSync(record.filePath, 'utf8');
    const updated = { id: record.id, route: 'file', fallback: true,
        status: record.readConfirmation ? 'read_confirmed' : 'file_ready', event: 'manual_fallback',
        reason: '用户选择文件级注入' };
    appendEvent(params.threadId, updated, options);
    return { record: { ...record, ...updated }, text, message: '已切换文件路径；请将交接卡注入目标 Agent，未据此确认读取。' };
}

function acknowledgeHandoff(params, options) {
    const record = requireRecord(params, options);
    if (params.agent !== record.target) throw new Error('确认 Agent 与目标不匹配');
    if (typeof params.evidence !== 'string' || !params.evidence.trim()) throw new Error('读取确认需要会话或检索记录证据');
    const updated = { id: record.id, status: 'read_confirmed', event: 'read_acknowledged',
        readConfirmation: { agent: params.agent, evidence: params.evidence, at: new Date().toISOString(), source: 'target_reported' } };
    appendEvent(params.threadId, updated, options);
    return { record: { ...record, ...updated }, message: '已记录目标自报读取确认；证据已归档。' };
}

async function handleThreadAction(action, params, options) {
    if (action === 'thread-handoff-list') return { records: listHandoffs(params.threadId, options) };
    if (action === 'thread-handoff-create') return createHandoff(params, options);
    if (action === 'thread-handoff-fallback') return fallbackHandoff(params, options);
    if (action === 'thread-handoff-ack') return acknowledgeHandoff(params, options);
    throw new Error('未知交接操作');
}

async function cmdThread(args) {
    const [operation, threadId, ...flags] = args;
    if (!operation || operation === '--help' || operation === '-h') {
        console.log('用法：codexmate thread handoff <thread-id> --card <json-file> --target <agent>\n'
            + '      codexmate thread list <thread-id>\n'
            + '      codexmate thread fallback <thread-id> --handoff <id>\n'
            + '      codexmate thread ack <thread-id> --handoff <id> --agent <agent> --evidence <读取证据>');
        return;
    }
    const params = { threadId };
    const names = { '--card': 'cardFile', '--target': 'target', '--handoff': 'handoffId', '--agent': 'agent', '--evidence': 'evidence' };
    for (let i = 0; i < flags.length; i += 2) {
        if (!names[flags[i]] || !flags[i + 1] || flags[i + 1].startsWith('--')) throw new Error('交接命令参数无效');
        params[names[flags[i]]] = flags[i + 1];
    }
    const actions = { handoff: 'create', list: 'list', fallback: 'fallback', ack: 'ack' };
    if (!actions[operation]) throw new Error('未知 thread 子命令');
    if (operation === 'handoff') {
        if (!params.cardFile) throw new Error('请用 --card 指定结构化交接卡 JSON 文件');
        params.card = JSON.parse(fs.readFileSync(path.resolve(params.cardFile), 'utf8'));
    }
    const result = await handleThreadAction(`thread-handoff-${actions[operation]}`, params);
    console.log(JSON.stringify(result, null, 2));
}

module.exports = { createHandoff, listHandoffs, fallbackHandoff, acknowledgeHandoff, handleThreadAction, cmdThread };
