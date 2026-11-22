import assert from 'assert';
import { createRequire } from 'module';
import { createContextAnalyzer, contextHealthLevel, splitContextText } from '../../web-ui/logic.context-health.mjs';
const require = createRequire(import.meta.url);
const { createContextRecordReader } = require('../../lib/session-context-records');

function analyze(records, source = 'codex') {
    const reader = createContextRecordReader(source, '/repo');
    const analyzer = createContextAnalyzer();
    records.forEach((record, index) => reader(record, index).forEach((node) => analyzer.add(node)));
    return analyzer.finish();
}

test('context health counts system and rules without omitting leading instructions', () => {
    const report = analyze([
        { type: 'session_meta', payload: { base_instructions: { text: 'a'.repeat(16) } } },
        { type: 'response_item', payload: { type: 'message', role: 'developer', content: 'b'.repeat(16) } },
        { type: 'response_item', payload: { type: 'message', role: 'user', content: '<INSTRUCTIONS>规则</INSTRUCTIONS>请执行' } }
    ]);
    assert.strictEqual(report.messageCount, 3);
    assert.ok(report.categories.find((part) => part.id === 'system').estimatedTokens >= 8);
    assert.strictEqual(report.categories.reduce((sum, part) => sum + part.estimatedTokens, 0), report.totalEstimatedTokens);
    assert.ok(Math.abs(report.categories.reduce((sum, part) => sum + part.percentage, 0) - 100) < 1e-9);
});

test('context health classifies user messages from every connected source and walks branches', () => {
    const text = 'u'.repeat(16);
    const sources = {
        codex: { type: 'response_item', payload: { type: 'message', role: 'user', content: text } },
        claude: { type: 'user', message: { role: 'user', content: text } },
        gemini: { type: 'user', content: text },
        codebuddy: { type: 'message', role: 'user', content: text },
        workbuddy: { type: 'message', role: 'user', content: text },
        pi: { type: 'message', message: { role: 'user', content: [{ type: 'text', text }] } },
        opencode: { role: 'user', content: [{ type: 'text', text }] },
        zed: { User: { content: [{ Text: text }] } }
    };
    for (const [source, record] of Object.entries(sources)) {
        const report = analyze([record], source);
        assert.strictEqual(report.totalEstimatedTokens, 4, source);
        assert.strictEqual(report.categories.find((part) => part.id === 'user').percentage, 100, source);
    }
    const report = analyze([{ role: 'user', content: text, children: [{ role: 'user', content: text, branches: [{ role: 'user', content: text }] }] }], 'claude');
    assert.strictEqual(report.messageCount, 3);
    assert.strictEqual(report.totalEstimatedTokens, 12);
});

test('context health accounts for assistant reasoning and text across native content formats', () => {
    const text = 'a'.repeat(16);
    const cases = [
        ['codex', { type: 'response_item', payload: { type: 'reasoning', summary: [{ type: 'summary_text', text }] } }],
        ['zed', { Agent: { content: [{ Thinking: { text } }, { Text: text }] } }],
        ['pi', { type: 'message', message: { role: 'assistant', content: [{ type: 'thinking', thinking: text }] } }],
        ['gemini', { type: 'gemini', content: text, thoughts: [{ text }] }]
    ];
    for (const [source, record] of cases) {
        const report = analyze([record], source);
        const expected = source === 'zed' || source === 'gemini' ? 8 : 4;
        assert.strictEqual(report.categories.find((part) => part.id === 'assistant').estimatedTokens, expected, source);
        assert.strictEqual(report.categories.find((part) => part.id === 'assistant').percentage, 100, source);
    }
});

test('context health counts native tool outputs and error states without treating them as replies', () => {
    const text = 't'.repeat(16);
    const cases = [
        ['codex', { type: 'response_item', payload: { type: 'function_call_output', call_id: 'one', output: text } }],
        ['claude', { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'one', content: text }] } }],
        ['pi', { type: 'message', message: { role: 'toolResult', toolCallId: 'one', content: [{ type: 'text', text }] } }],
        ['opencode', { role: 'assistant', content: [{ type: 'tool', tool: 'read', state: { error: text, input: { filePath: 'a.js' } } }] }],
        ['zed', { Agent: { content: [{ ToolResult: { content: text } }] } }]
    ];
    for (const [source, record] of cases) {
        const report = analyze([record], source);
        assert.strictEqual(report.categories.find((part) => part.id === 'tools').estimatedTokens, 4, source);
        assert.strictEqual(report.categories.find((part) => part.id === 'tools').percentage, 100, source);
    }
});

test('context health separates fences and diffs from surrounding prose without double counting', () => {
    const text = 'Read this\n```js\nconst a = 1;\n```\nResult:\ndiff --git a/a.js b/a.js\n--- a/a.js\n+++ b/a.js\n@@ -1 +1 @@\n-old\n+new\nDone\n';
    const parts = splitContextText(text, 'tools');
    assert.strictEqual(parts.map((part) => part.text).join(''), text);
    assert.strictEqual(parts.filter((part) => part.category === 'code').length, 2);
    assert.ok(parts.some((part) => part.category === 'tools' && part.text.includes('Done')));
    const report = analyze([{ role: 'assistant', content: [{ type: 'code', code: 'c'.repeat(16) }] }], 'opencode');
    assert.strictEqual(report.categories.find((part) => part.id === 'code').estimatedTokens, 4);
    assert.strictEqual(report.categories.find((part) => part.id === 'code').percentage, 100);
    const open = splitContextText('plain\n```\nunfinished', 'assistant');
    assert.strictEqual(open.map((part) => part.text).join(''), 'plain\n```\nunfinished');
    assert.strictEqual(open[open.length - 1].category, 'code');
});

test('context health flags strictly over fifteen percent and keeps the largest five nodes', () => {
    const report = analyze([15, 25, 20, 10, 10, 10, 10].map((tokens) => ({ role: 'user', content: 'u'.repeat(tokens * 4) })));
    assert.strictEqual(report.totalEstimatedTokens, 100);
    assert.strictEqual(report.topMessages.length, 5);
    assert.deepStrictEqual(report.topMessages.map((node) => node.estimatedTokens), [25, 20, 15, 10, 10]);
    assert.ok(!report.topMessages.find((node) => node.estimatedTokens === 15).reasons.includes('dominant_message'));
    assert.strictEqual(report.hotspots.filter((node) => node.reasons.includes('dominant_message')).length, 2);
});

test('context health identifies repeated file reads and long error logs in native calls', () => {
    const records = [
        { type: 'session_meta', payload: { cwd: '/repo' } },
        { type: 'response_item', payload: { type: 'function_call', name: 'read', call_id: 'a', arguments: '{"path":"src/a.js"}' } },
        { type: 'response_item', payload: { type: 'function_call_output', call_id: 'a', output: 'first' } },
        { type: 'response_item', payload: { type: 'function_call', name: 'read', call_id: 'b', arguments: '{"path":"/repo/src/a.js"}' } },
        { type: 'response_item', payload: { type: 'function_call_output', call_id: 'b', output: 'Error: failure\n'.repeat(100) } }
    ];
    const report = analyze(records);
    assert.deepStrictEqual(report.duplicateFiles, [{ path: '/repo/src/a.js', reads: 2 }]);
    assert.strictEqual(report.hotspots.filter((node) => node.reasons.includes('repeated_file_read')).length, 2);
    assert.ok(report.hotspots.find((node) => node.id === 'record-4').reasons.includes('long_error_log'));
    const short = analyze([{ role: 'tool', content: 'Error: short' }]);
    assert.ok(!short.hotspots.some((node) => node.reasons.includes('long_error_log')));
    const privateText = analyze([{ role: 'user', content: 'Authorization: Bearer fixture-secret {"api_key":"fixture-key"}' }]);
    assert.ok(!privateText.topMessages[0].preview.includes('fixture-secret'));
    assert.ok(!privateText.topMessages[0].preview.includes('fixture-key'));
});

test('context health walks both wrapper and payload branches with distinct node identities', () => {
    const read = createContextRecordReader('codex');
    const record = { type: 'response_item', payload: { type: 'message', role: 'user', content: 'root',
        children: [{ role: 'assistant', content: 'payload child' }] },
        children: [{ role: 'tool', content: 'wrapper child' }] };
    const nodes = read(record, 0);
    assert.strictEqual(nodes.length, 3);
    assert.strictEqual(new Set(nodes.map((node) => node.id)).size, 3);
    assert.ok(nodes.some((node) => node.parts[0].text === 'payload child'));
    assert.ok(nodes.some((node) => node.parts[0].text === 'wrapper child'));
});
