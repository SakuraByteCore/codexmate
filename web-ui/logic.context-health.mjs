import { estimatePromptTokenCount } from './logic.prompts-token-count.mjs';

export const CONTEXT_CATEGORIES = ['system', 'user', 'assistant', 'tools', 'code'];
const HEALTHY_LIMIT = 32000;
const HEAVY_LIMIT = 64000;
const DOMINANT_SHARE = 0.15;
const TOP_CANDIDATES = 7;
const PREVIEW_LENGTH = 120;
const LONG_ERROR_TOKENS = 1024;
const LONG_ERROR_LINES = 100;
const ERROR_PATTERN = /Traceback|(?:Error|Exception)(?::|\b)|^\s+at .+\(.+:\d+/m;
const RULE_PATTERN = /<(system-reminder|instructions|user_instructions|developer_instructions|environment_context|project_rules|skills_instructions)>[\s\S]*?<\/\1>/gi;

export function contextHealthLevel(tokens) {
    return tokens < HEALTHY_LIMIT ? 'healthy' : (tokens <= HEAVY_LIMIT ? 'heavy' : 'bloated');
}

function splitRules(text, category) {
    if (category === 'system' || /^#\s*AGENTS\.md instructions\b/i.test(text.trimStart())) {
        return [{ category: 'system', text }];
    }
    const parts = [];
    let start = 0;
    for (const match of text.matchAll(RULE_PATTERN)) {
        if (match.index > start) parts.push({ category, text: text.slice(start, match.index) });
        parts.push({ category: 'system', text: match[0] });
        start = match.index + match[0].length;
    }
    if (start < text.length) parts.push({ category, text: text.slice(start) });
    return parts;
}

export function splitContextText(text, category) {
    if (!text) return [];
    if (category === 'code') return [{ category, text }];
    const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
    const parts = [];
    let prose = '';
    let code = '';
    let fence = '';
    let diff = false;
    let patch = false;
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        const marker = line.match(/^\s*(`{3,}|~{3,})/);
        if (diff && !patch && !/^(?:[ +\-]|@@ |diff --git |index |new file|deleted file|rename |similarity |\\ No newline)/.test(line)) {
            parts.push({ category: 'code', text: code });
            code = ''; diff = false;
        }
        if (fence) {
            code += line;
            if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && /^\s*(`{3,}|~{3,})\s*$/.test(line)) {
                parts.push({ category: 'code', text: code }); code = ''; fence = '';
            }
        } else if (diff) {
            code += line;
            if (patch && /^\*\*\* End Patch/.test(line)) {
                parts.push({ category: 'code', text: code }); code = ''; diff = false; patch = false;
            }
        } else if (/^(?:diff --git |@@ -|\*\*\* Begin Patch)/.test(line) || (/^--- /.test(line) && /^\+\+\+ /.test(lines[index + 1] || ''))) {
            parts.push(...splitRules(prose, category)); prose = '';
            code = line; diff = true; patch = /^\*\*\* Begin Patch/.test(line);
        } else if (marker) {
            parts.push(...splitRules(prose, category)); prose = '';
            fence = marker[1]; code = line;
        } else prose += line;
    }
    if (code) parts.push({ category: 'code', text: code });
    parts.push(...splitRules(prose, category));
    return parts;
}

function preview(text) {
    return text.replace(/Bearer\s+[^\s,]+/gi, 'Bearer [redacted]')
        .replace(/((?:api[_-]?key|token|authorization)['"]?\s*[:=]\s*['"]?)[^\s,]+/gi, '$1[redacted]')
        .replace(/\s+/g, ' ').slice(0, PREVIEW_LENGTH);
}

export function createContextAnalyzer() {
    const totals = Object.fromEntries(CONTEXT_CATEGORIES.map((id) => [id, { estimatedTokens: 0, characters: 0 }]));
    const top = [];
    const hotspots = new Map();
    const files = new Map();
    let messageCount = 0;
    let totalEstimatedTokens = 0;
    function mark(node, reason) {
        const entry = hotspots.get(node.id) || { ...node, reasons: [] };
        if (!entry.reasons.includes(reason)) entry.reasons.push(reason);
        hotspots.set(node.id, entry);
    }
    return {
        add(node) {
            const counts = Object.fromEntries(CONTEXT_CATEGORIES.map((id) => [id, 0]));
            const texts = [];
            for (const part of node.parts) {
                for (const segment of splitContextText(part.text, part.category)) {
                    const tokens = estimatePromptTokenCount(segment.text);
                    counts[segment.category] += tokens;
                    totals[segment.category].estimatedTokens += tokens;
                    totals[segment.category].characters += segment.text.length;
                    texts.push(segment.text);
                }
            }
            const estimatedTokens = Object.values(counts).reduce((sum, value) => sum + value, 0);
            totalEstimatedTokens += estimatedTokens;
            messageCount++;
            const text = texts.join('');
            const summary = { id: node.id, recordLineIndex: node.recordLineIndex,
                messageIndex: node.messageIndex, role: node.role, estimatedTokens,
                categories: counts, preview: preview(text) };
            top.push(summary);
            top.sort((a, b) => b.estimatedTokens - a.estimatedTokens || a.id.localeCompare(b.id));
            if (top.length > TOP_CANDIDATES) top.pop();
            if (ERROR_PATTERN.test(text) && (estimatedTokens >= LONG_ERROR_TOKENS || text.split('\n').length >= LONG_ERROR_LINES)) {
                mark(summary, 'long_error_log');
            }
            for (const file of node.readPaths || []) {
                const previous = files.get(file);
                if (previous) {
                    previous.count++;
                    mark(previous.first, 'repeated_file_read');
                    mark(summary, 'repeated_file_read');
                } else files.set(file, { count: 1, first: summary });
            }
        },
        finish() {
            for (const node of top) {
                if (node.estimatedTokens > totalEstimatedTokens * DOMINANT_SHARE) mark(node, 'dominant_message');
            }
            const percentage = (tokens) => totalEstimatedTokens ? tokens * 100 / totalEstimatedTokens : 0;
            const describe = (node) => ({ ...node, percentage: percentage(node.estimatedTokens),
                reasons: hotspots.get(node.id)?.reasons || [] });
            return {
                estimator: 'cjk-1-non-cjk-4-v1', estimated: true, messageCount, totalEstimatedTokens,
                health: contextHealthLevel(totalEstimatedTokens),
                categories: CONTEXT_CATEGORIES.map((id) => ({ id, ...totals[id], percentage: percentage(totals[id].estimatedTokens) })),
                topMessages: top.slice(0, 5).map(describe),
                hotspots: [...hotspots.values()].map(describe),
                duplicateFiles: [...files].filter(([, value]) => value.count > 1)
                    .map(([path, value]) => ({ path, reads: value.count }))
            };
        }
    };
}
