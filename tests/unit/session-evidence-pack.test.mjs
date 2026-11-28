import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionEvidenceMixin } from '../../web-ui/modules/session-evidence.mjs';
const result = (source, filePath, nodeId = 'record-1') => ({ session: { source, sessionId: 'same-id', filePath, title: source }, nodeId, textHash: source + filePath });
const state = () => ({ ...sessionEvidenceMixin.data(), ...sessionEvidenceMixin.methods, t: key => key, handoffDraft: { goal: 'original' } });

test('evidence selection separates sources/files, removes only one and keeps original drafts', async () => {
    const vm = state(); const first = result('codex', '/one'); const second = result('pi', '/two');
    vm.toggleEvidence(first); vm.toggleEvidence(second); assert.equal(vm.evidenceSelections.length, 2);
    vm.toggleEvidence(first); assert.deepEqual(vm.evidenceSelections, [second]); vm.toggleEvidence(first);
    vm.featureCall = async (action, params) => {
        assert.equal(action, 'session-handoff-draft');
        return { evidence: params.selections.map(nodeId => ({ nodeId, textHash: params.source + params.filePath, excerpt: 'historical excerpt', status: 'unverified' })) };
    };
    await vm.generateEvidencePack();
    assert.match(vm.evidencePack, /codex/); assert.match(vm.evidencePack, /pi/); assert.match(vm.evidencePack, /SHA-256/);
    assert.match(vm.evidencePack, /evidence.unverified/); assert.equal(vm.handoffDraft.goal, 'original');
    vm.downloadTextFile = (name, content) => { assert.equal(name, 'codexmate-evidence.md'); assert.equal(content, vm.evidencePack); };
    vm.downloadEvidencePack(); assert.equal(state().evidenceSelections.length, 0);
});

test('changed hashes and partial failures preserve selections but refuse complete export', async () => {
    const vm = state(); vm.toggleEvidence(result('pi', '/one'));
    vm.featureCall = async () => ({ evidence: [{ nodeId: 'record-1', textHash: 'changed', excerpt: 'changed' }] });
    await vm.generateEvidencePack(); assert.equal(vm.evidencePack, ''); assert.equal(vm.evidenceError, 'evidence.changed');
    vm.featureCall = async () => { throw Error('source unavailable'); };
    await vm.generateEvidencePack(); assert.equal(vm.evidenceSelections.length, 1); assert.match(vm.evidenceError, /unavailable/);
});

test('late replies cannot publish after material removal and selection limit is global', async () => {
    const vm = state(); const item = result('pi', '/one'); vm.toggleEvidence(item);
    let resolve; vm.featureCall = () => new Promise(done => { resolve = done; });
    const pending = vm.generateEvidencePack(); vm.toggleEvidence(item); resolve({ evidence: [] }); await pending;
    assert.equal(vm.evidencePack, ''); assert.equal(vm.evidenceBusy, false);
    for (let index = 0; index < 101; index++) vm.toggleEvidence(result('pi', '/' + index));
    assert.equal(vm.evidenceSelections.length, 100); assert.equal(vm.evidenceError, 'evidence.limit');
});
