'use strict';

const readline = require('readline');
const { createContextRecordReader } = require('./session-context-records');
const RULE_FIELDS = ['system_prompt', 'systemInstruction', 'instructions', 'project_rules', 'skills_instructions'];

function createSessionContextHealthController(deps) {
    const { fs, normalizeSessionSourceName, resolveSessionFilePath, queryOpencodeSessionMessages, queryZedSessionMessages } = deps;
    async function* records(source, filePath, sessionId) {
        if (source === 'opencode' || source === 'zed') {
            const query = source === 'zed' ? queryZedSessionMessages : queryOpencodeSessionMessages;
            const data = query(sessionId, { maxMessages: Infinity, contextHealth: true });
            if (!data) throw new Error('会话数据库读取失败');
            if (data.cwd) yield { type: 'session_meta', payload: { cwd: data.cwd } };
            if (data.instructions) yield { type: 'system_context', instructions: data.instructions };
            for (const message of data.messages || []) yield message;
            return;
        }
        if (source === 'gemini' || filePath.toLowerCase().endsWith('.json')) {
            const data = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
            const cwd = data.projectRoot || data.cwd;
            if (cwd) yield { type: 'session_meta', payload: { cwd } };
            for (const field of RULE_FIELDS) {
                if (data[field]) yield { type: 'system_context', instructions: data[field] };
            }
            const messages = Array.isArray(data) ? data : (data.messages || data.children || []);
            for (const message of messages) yield message;
            return;
        }
        const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
        const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
        let readError;
        stream.on('error', (error) => { readError = error; lines.close(); });
        try {
            for await (const line of lines) {
                if (!line.trim()) { yield null; continue; }
                try { yield JSON.parse(line.charCodeAt(0) === 0xFEFF ? line.slice(1) : line); }
                catch (_) { throw new Error('会话含无法解析的消息记录'); }
            }
            if (readError) throw readError;
        } finally { lines.close(); stream.destroy(); }
    }
    function resolve(params) {
        const source = normalizeSessionSourceName(params.source, '');
        if (!source) throw new Error('Invalid source');
        const filePath = resolveSessionFilePath(source, params.filePath || params.file, params.sessionId);
        if (!filePath) throw new Error('Session file not found');
        return { source, filePath, sessionId: params.sessionId };
    }
    async function scan(params, focus) {
        const target = resolve(params);
        const { createContextAnalyzer } = await import('../web-ui/logic.context-health.mjs');
        const analyzer = createContextAnalyzer();
        const reader = createContextRecordReader(target.source, params.cwd || '');
        let index = 0;
        const models = new Set();
        const modelWindows = {};
        for await (const record of records(target.source, target.filePath, target.sessionId)) {
            const metadata = record?.payload || record?.message || record || {};
            const model = metadata.model || metadata.modelID || metadata.info?.modelID;
            const window = metadata.model_context_window ?? metadata.context_window ?? metadata.contextWindow;
            if (typeof model === 'string' && model) {
                models.add(model);
                if (Number.isSafeInteger(window) && window > 0) modelWindows[model] = window;
            }
            for (const node of reader(record, index)) {
                if (!focus) analyzer.add(node);
                if (node.id === focus) {
                    return { source: target.source, node: { id: node.id, role: node.role,
                        recordLineIndex: node.recordLineIndex, messageIndex: node.messageIndex,
                        text: node.parts.map((part) => part.text).join('\n'), readPaths: node.readPaths || [] } };
                }
            }
            index++;
        }
        if (focus) throw new Error('消息节点不存在，请刷新体检结果');
        return { source: target.source, sessionId: target.sessionId, complete: true, scannedRecords: index, models: [...models], modelWindows, ...analyzer.finish() };
    }
    async function readSessionContextHealth(params = {}) {
        try { return await scan(params); } catch (error) { return { error: error.message }; }
    }
    async function readSessionContextNode(params = {}) {
        if (typeof params.nodeId !== 'string' || !/^record-\d+(?:\.(?:body-)?(?:children|messages|branches)-\d+)*$/.test(params.nodeId)) {
            return { error: '消息节点 ID 无效' };
        }
        try { return await scan(params, params.nodeId); } catch (error) { return { error: error.message }; }
    }
    async function* iterateSessionContextNodes(params = {}) {
        const target = resolve(params);
        const reader = createContextRecordReader(target.source, params.cwd || '');
        let index = 0;
        for await (const record of records(target.source, target.filePath, target.sessionId)) {
            for (const node of reader(record, index)) yield { ...node,
                text: node.parts.map((part) => part.text).join('\n'),
                timestamp: record?.timestamp || record?.message?.timestamp || '' };
            index++;
        }
    }
    async function* iterateSessionUsageRecords(params = {}) {
        const target = resolve(params);
        yield* records(target.source, target.filePath, target.sessionId);
    }
    return { readSessionContextHealth, readSessionContextNode, iterateSessionContextNodes, iterateSessionUsageRecords };
}

module.exports = { createSessionContextHealthController };
