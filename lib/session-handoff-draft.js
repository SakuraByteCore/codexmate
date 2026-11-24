'use strict';
const { digest } = require('./local-feature-store');
const MAX_SELECTIONS = 100;
const EXCERPT_LENGTH = 800;
const GOAL_LENGTH = 500;

function classifyEvidence(node) {
    const text = node.text;
    const isTool = /tool|function_call_output/i.test(node.role);
    if (!isTool) return 'unverified';
    const failed = /(?:\b(?:fail(?:ed|ures?)?|errors?)\s*[:=]?\s*[1-9]\d*\b|\bexit(?:ed)?(?: with)?(?: code)?\s*[:=]?\s*[1-9]\d*\b|测试失败|验证失败|未通过)/i.test(text);
    if (failed) return 'failed';
    const passed = /(?:^|\n)\s*(?:All \d+ tests passed[.!]?|(?:ℹ|#)?\s*pass\s+[1-9]\d*|exit(?:ed)?(?: with)?(?: code)?\s*[:=]?\s*0)\s*(?:\n|$)/i.test(text);
    const ambiguous = /未(?:执行|运行|验证)|尚未|not (?:run|executed|passed)|待确认/i.test(text);
    return passed && !ambiguous ? 'passed' : 'unverified';
}
async function generateHandoffDraft(params, readNode) {
    if (!Array.isArray(params.selections) || !params.selections.length || params.selections.length > MAX_SELECTIONS
        || params.selections.some((value) => typeof value !== 'string')) throw new Error('handoff-selection-invalid');
    const card = { goal: String(params.goal || '').trim().slice(0, GOAL_LENGTH), completed: [], blockers: [], nextSteps: [], files: [] };
    const evidence = [];
    const unverified = [];
    for (const selection of [...new Set(params.selections)]) {
        const result = await readNode({ source: params.source, sessionId: params.sessionId, filePath: params.filePath,
            cwd: params.cwd, ...(selection.startsWith('text:') ? { messageText: selection.slice(5) } : { nodeId: selection }) });
        if (result.error) throw new Error('bookmark-source-unavailable');
        const node = result.node;
        const status = classifyEvidence(node);
        const excerpt = node.text.slice(0, EXCERPT_LENGTH);
        for (const file of node.readPaths || []) if (!card.files.includes(file)) card.files.push(file);
        for (const line of node.text.split('\n')) {
            if (/^(?:下一步|后续步骤|next steps?)\s*[:：]/i.test(line.trim())) card.nextSteps.push(line.trim());
        }
        if (!card.goal && node.role === 'user') card.goal = node.text.slice(0, GOAL_LENGTH);
        if (status === 'passed') card.completed.push(excerpt);
        else if (status === 'failed') card.blockers.push(excerpt);
        else unverified.push(excerpt);
        evidence.push({ source: result.source, sessionId: params.sessionId || '', filePath: params.filePath || '',
            cwd: params.cwd || '', nodeId: node.id, textHash: digest(node.text), excerpt, status });
    }
    return { card, evidence, unverified, requiresReview: true, sent: false };
}
module.exports = { generateHandoffDraft, classifyEvidence };
