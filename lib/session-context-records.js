'use strict';

const ROLE_CATEGORIES = { system: 'system', developer: 'system', skill: 'system', rules: 'system', user: 'user', human: 'user',
    assistant: 'assistant', agent: 'assistant', model: 'assistant', gemini: 'assistant',
    tool: 'tools', toolresult: 'tools', tool_result: 'tools', function_call_output: 'tools' };
const RULE_FIELDS = ['base_instructions', 'developer_instructions', 'system_prompt', 'systemInstruction', 'instructions', 'project_rules', 'skills_instructions'];

function categoryForRole(role) {
    const key = String(role || '').toLowerCase();
    return Object.prototype.hasOwnProperty.call(ROLE_CATEGORIES, key) ? ROLE_CATEGORIES[key] : '';
}

function contentParts(content, category) {
    const parts = [];
    const queue = [{ value: content, category }];
    while (queue.length) {
        const item = queue.pop();
        const value = item.value;
        if (typeof value === 'string') {
            if (value) parts.push({ text: value, category: item.category });
            continue;
        }
        if (!value || typeof value !== 'object') continue;
        if (Array.isArray(value)) {
            for (let index = value.length - 1; index >= 0; index--) queue.push({ value: value[index], category: item.category });
            continue;
        }
        const type = String(value.type || '').toLowerCase();
        const nextCategory = /^(code|diff)$/.test(type) || value.Code ? 'code'
            : (/^(tool|tool_result|toolresult|function_call_output)$/.test(type) || value.ToolResult ? 'tools' : item.category);
        const text = value.Text ?? value.text ?? value.thinking ?? value.Thinking ?? value.Code
            ?? value.ToolResult ?? value.content ?? value.output ?? value.code ?? value.diff ?? value.value ?? value.summary ?? value.parts;
        if (value.state && (value.state.output !== undefined || value.state.error !== undefined)) {
            const output = value.state.output ?? value.state.error;
            queue.push({ value: typeof output === 'object' ? JSON.stringify(output) : output, category: 'tools' });
        } else if (/^(toolcall|tool_use)$/.test(type)) {
            queue.push({ value: `${value.name || ''}\n${JSON.stringify(value.arguments || value.input || {})}`, category: 'assistant' });
        } else if (text !== undefined) queue.push({ value: text, category: nextCategory });
    }
    return parts;
}

function normalizeReadPath(value, cwd) {
    if (typeof value !== 'string' || !value.trim() || /^https?:\/\//i.test(value)) return '';
    const raw = value.trim().replace(/\\/g, '/');
    const full = raw.startsWith('/') || /^[A-Za-z]:\//.test(raw) ? raw : `${cwd || ''}/${raw}`;
    const parts = [];
    for (const part of full.split('/')) {
        if (!part || part === '.') continue;
        if (part === '..') parts.pop(); else parts.push(part);
    }
    return `${full.startsWith('/') ? '/' : ''}${parts.join('/')}`;
}

function readPaths(name, input, cwd) {
    let args = input;
    if (typeof input === 'string') { try { args = JSON.parse(input); } catch (_) { args = {}; } }
    if (!args || typeof args !== 'object') return [];
    const command = args.cmd || args.command || '';
    const isRead = /read|cat|grep|get.content|open.file/i.test(name || '') || /(?:^|[\s;&|])(cat|sed|head|tail|rg|grep|Get-Content)\s/.test(command);
    if (!isRead) return [];
    const paths = [args.path, args.file_path, args.filePath, args.file, args.filename].filter((value) => typeof value === 'string');
    if (!paths.length && command) {
        const match = command.match(/(?:^|[;&|]\s*)(?:cat|sed|head|tail|rg|grep|Get-Content)\s+([^;&|]+)/);
        const tokens = match ? match[1].match(/"[^"]+"|'[^']+'|\S+/g) || [] : [];
        for (const token of tokens) {
            const value = token.replace(/^['"]|['"]$/g, '');
            if (!value.startsWith('-') && !/^\d+(?:,\d+)?[a-z]$/i.test(value)
                && (value.includes('/') || /\.[A-Za-z0-9]+$/.test(value))) paths.push(value);
        }
    }
    return paths.map((value) => normalizeReadPath(value, cwd)).filter(Boolean);
}

function createContextRecordReader(source, cwd = '') {
    const calls = new Map();
    return function readRecord(record, recordIndex) {
        const metadataCwd = record?.type === 'session_meta' ? record.payload?.cwd : (record?.type === 'session' ? record.cwd : '');
        if (typeof metadataCwd === 'string' && metadataCwd) cwd = metadataCwd;
        const nodes = [];
        const stack = [{ record, suffix: '' }];
        while (stack.length) {
            const current = stack.pop();
            const raw = current.record;
            if (!raw || typeof raw !== 'object') continue;
            let body = raw.message && typeof raw.message === 'object' ? raw.message : raw;
            if (source === 'codex' && raw.type === 'response_item') body = raw.payload || {};
            if (raw.User) body = { ...raw.User, role: 'user' };
            if (raw.Agent) body = { ...raw.Agent, role: 'assistant' };
            if (raw.Tool || raw.ToolResult) body = { content: raw.Tool || raw.ToolResult, role: 'tool' };
            if (raw.System) body = { content: raw.System.content ?? raw.System, role: 'system' };
            const type = String(body.type || '').toLowerCase();
            let role = body.role || raw.role || raw.type;
            if (type === 'reasoning' || type === 'function_call' || type === 'tool_call') role = 'assistant';
            if (type === 'function_call_output' || type === 'tool_result') role = 'tool';
            const category = categoryForRole(role);
            let parts = [];
            const paths = [];
            if (category) {
                const content = body.content ?? body.text ?? body.message ?? body.output ?? body.summary ?? body.thinking ?? body.reasoning_content;
                parts = contentParts(content, category);
                const toolResults = body.tool_results;
                if (toolResults) {
                    for (const result of Array.isArray(toolResults) ? toolResults : Object.values(toolResults)) {
                        parts.push(...contentParts(result, 'tools'));
                    }
                }
                for (const key of ['thoughts', 'reasoning_content', 'reasoning_details']) {
                    if (body[key] !== undefined && body[key] !== content) parts.push(...contentParts(body[key], 'assistant'));
                }
                if (type === 'function_call' || type === 'tool_call') {
                    parts = [{ category: 'assistant', text: `${body.name || body.tool || ''}\n${typeof body.arguments === 'string' ? body.arguments : JSON.stringify(body.arguments || body.input || {})}` }];
                    calls.set(body.call_id || body.id, readPaths(body.name || body.tool, body.arguments || body.input, cwd));
                }
                if (type === 'function_call_output' || String(role).toLowerCase() === 'toolresult') {
                    paths.push(...(calls.get(body.call_id || body.toolCallId || body.tool_use_id) || []));
                }
                for (const part of Array.isArray(body.content) ? body.content : []) {
                    if (!part) continue;
                    if (/^(toolcall|tool_use)$/i.test(part.type || '')) {
                        calls.set(part.id, readPaths(part.name, part.arguments || part.input, cwd));
                    }
                    if (part.type === 'tool_result') paths.push(...(calls.get(part.tool_use_id) || []));
                    if (/tool/i.test(part.type || '') && (part.state?.output !== undefined || part.state?.error !== undefined || part.type === 'tool_result')) {
                        paths.push(...readPaths(part.tool || part.name, part.state?.input || part.input, cwd));
                    }
                }
                if (category === 'tools') paths.push(...readPaths(body.name || body.tool, body.input || body.arguments, cwd));
            }
            if (raw.type === 'session_meta' || raw.type === 'system_context') {
                const metadata = raw.payload || raw;
                parts = RULE_FIELDS.flatMap((key) => contentParts(metadata[key], 'system'));
                role = 'system';
            }
            if (parts.length) nodes.push({ id: `record-${recordIndex}${current.suffix}`, role,
                recordLineIndex: recordIndex, messageIndex: recordIndex, parts, readPaths: paths });
            const containers = body === raw ? [{ value: raw, prefix: '' }]
                : [{ value: body, prefix: 'body-' }, { value: raw, prefix: '' }];
            const groups = containers.flatMap((container) => ['children', 'messages', 'branches'].map((field) => ({
                children: container.value[field], field: `${container.prefix}${field}`
            })));
            for (const group of groups) {
                if (!Array.isArray(group.children)) continue;
                for (let index = group.children.length - 1; index >= 0; index--) {
                    stack.push({ record: group.children[index], suffix: `${current.suffix}.${group.field}-${index}` });
                }
            }
        }
        return nodes;
    };
}

module.exports = { createContextRecordReader, contentParts };
