import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { executeWorkflowDefinition: execute, validateWorkflowDefinition: validate } = require('../../lib/workflow-engine');
const step = (id, extra = {}) => ({ id, tool: 'read', write: false, ...extra });
test('dependencies reject cycles and schedule prerequisite first', async () => {
    const definition = { id: 'dag', steps: [step('b', { dependsOn: ['a'] }), step('a')] };
    assert.equal(validate(definition).ok, true);
    const result = await execute(definition, {}, { invokeTool: async () => ({ ok: true }) });
    assert.deepEqual(result.steps.map(item => item.id), ['a', 'b']);
    definition.steps[1].dependsOn = ['b'];
    assert.equal(validate(definition).ok, false);
});
test('only explicitly retryable reads retry within budget', async () => {
    let calls = 0;
    const result = await execute({ steps: [step('a', { retry: 2 })] }, {}, {
        invokeTool: async () => ++calls < 3 ? { error: 'temporary', retryable: true } : { ok: true }
    });
    assert.equal(result.success, true); assert.equal(calls, 3); assert.equal(result.steps[0].attempts, 3);
    calls = 0;
    await execute({ steps: [step('a', { write: true, retry: 2 })] }, {}, {
        allowWrite: true, invokeTool: async () => { calls++; return { error: 'uncertain', retryable: true }; }
    });
    assert.equal(calls, 1);
});
test('timeout waits for real tool settlement and forwards abort signal', async () => {
    let settled = false;
    const result = await execute({ steps: [step('a', { timeoutMs: 5 })] }, {}, {
        invokeTool: async (_, args, { signal }) => {
            await new Promise(resolve => setTimeout(resolve, 15));
            assert.equal(signal.aborted, true); settled = true; return { ok: true };
        }
    });
    assert.equal(settled, true); assert.equal(result.waiting, true); assert.equal(result.success, false);
});
test('real engine checkpoints resume without replay and cancellation stops successors', async () => {
    const logs = []; let calls = 0;
    const definition = { steps: [step('a'), step('b')] };
    const first = await execute(definition, {}, {
        invokeTool: async () => ({ value: ++calls }), onProgress: async log => logs.push(log), shouldStop: () => calls === 1
    });
    assert.equal(first.cancelled, true);
    const resumed = await execute(definition, {}, { resumeSteps: logs, invokeTool: async () => ({ value: ++calls }) });
    assert.equal(resumed.success, true); assert.equal(calls, 2); assert.equal(resumed.steps[0].output.value, 1);
});
