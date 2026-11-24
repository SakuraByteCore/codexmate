import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { generateHandoffDraft } = require('../../lib/session-handoff-draft');

test('handoff draft only trusts selected tool evidence and never treats planned tests as passed', async () => {
    const nodes = [
        { id: 'record-1', role: 'user', text: '修复当前项目' },
        { id: 'record-2', role: 'tool', text: 'All 12 tests passed.' },
        { id: 'record-3', role: 'tool', text: 'pass 12\nfail 1' },
        { id: 'record-4', role: 'assistant', text: 'All 99 tests passed.' },
        { id: 'record-5', role: 'tool', text: 'All 12 tests passed.\n尚未执行完整回归' }
    ];
    const calls = [];
    const draft = await generateHandoffDraft({ source: 'pi', sessionId: 'one', selections: nodes.map((node) => node.id) },
        async (params) => { calls.push(params); return { source: 'pi', node: nodes.find((node) => node.id === params.nodeId) }; });
    assert.equal(draft.card.goal, nodes[0].text); assert.deepEqual(draft.card.completed, [nodes[1].text]);
    assert.deepEqual(draft.card.blockers, [nodes[2].text]); assert.equal(draft.unverified.length, 3);
    assert.equal(draft.evidence.length, 5); assert.equal(draft.sent, false); assert.equal(draft.requiresReview, true);
    assert.ok(calls.every((params) => params.sessionId === 'one' && params.source === 'pi'));
    await assert.rejects(generateHandoffDraft({ selections: [] }, () => {}), /selection-invalid/);
});
