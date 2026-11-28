import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionEvidenceMixin } from '../../web-ui/modules/session-evidence.mjs';
import { sessionCollectionsMixin } from '../../web-ui/modules/session-collections.mjs';
import { sessionArtifactFilename } from '../../web-ui/logic.session-artifacts.mjs';
const state = () => ({ ...sessionEvidenceMixin.data(), ...sessionEvidenceMixin.methods, t: key => key });
const items = ['passed', 'failed', 'unverified'].map((status, index) => ({
    session: { source: index ? 'pi' : 'codex', sessionId: 'same-id', filePath: '/source-' + index, title: 'source-' + index },
    nodeId: 'record-' + index, textHash: String(index).repeat(64), status
}));
const verified = async (action, params) => {
    assert.equal(action, 'session-handoff-draft');
    return { evidence: items.filter(item => item.session.filePath === params.filePath).map(item => ({
        nodeId: item.nodeId, textHash: item.textHash, status: item.status, excerpt: '# source content\n未验证当前版本'
    })) };
};

test('receipt and relay reuse verified sources, keep drafts, and download their own filenames', async () => {
    const vm = state(); vm.evidenceSelections = items; vm.featureCall = verified;
    vm.evidenceGoal = 'Improve handoff'; vm.evidenceNote = 'User supplied change reason'; vm.handoffDraft = { goal: 'original' };
    for (const format of ['receipt', 'relay', 'receipt', 'evidence']) {
        vm.evidenceFormat = format; await vm.generateEvidencePack();
        assert.equal(vm.evidenceGeneratedFormat, format); assert.equal(vm.evidenceSelections.length, 3);
        assert.equal(vm.handoffDraft.goal, 'original'); assert.match(vm.evidencePack, /SHA-256/);
        assert.match(vm.evidencePack, /codex/); assert.match(vm.evidencePack, /pi/);
        assert.match(vm.evidencePack, /> # source content/);
        for (const status of ['passed', 'failed', 'unverified']) assert.ok(vm.evidencePack.includes('evidence.' + status));
        if (format === 'receipt') assert.match(vm.evidencePack, /artifacts.noVerdict/);
        if (format === 'relay') {
            for (const stage of ['executor', 'reviewer', 'uat']) assert.ok(vm.evidencePack.includes('artifacts.' + stage));
        }
        if (format !== 'evidence') assert.match(vm.evidencePack, /> User supplied change reason/);
        vm.downloadTextFile = (name, text) => {
            assert.equal(name, sessionArtifactFilename(format)); assert.equal(text, vm.evidencePack);
        }; vm.downloadEvidencePack();
    }
    assert.equal(sessionArtifactFilename('receipt'), 'codexmate-development-receipt.md');
    assert.equal(sessionArtifactFilename('relay'), 'codexmate-agent-relay.md');
});

test('both artifacts reject changed or unavailable sources without losing selections', async () => {
    for (const format of ['receipt', 'relay']) {
        const vm = state(); vm.evidenceFormat = format; vm.evidenceSelections = items;
        vm.featureCall = async () => ({ evidence: [{ nodeId: items[0].nodeId, textHash: 'changed' }] });
        await vm.generateEvidencePack(); assert.equal(vm.evidencePack, ''); assert.equal(vm.evidenceError, 'evidence.changed');
        vm.featureCall = async () => { throw Error('source unavailable'); };
        await vm.generateEvidencePack(); assert.equal(vm.evidencePack, ''); assert.equal(vm.evidenceSelections.length, 3);
    }
});

test('input changes and material removal invalidate pending artifacts', async () => {
    for (const field of ['evidenceFormat', 'evidenceGoal', 'evidenceNote', 'selection']) {
        const vm = state(); vm.evidenceFormat = 'relay'; vm.evidenceSelections = [items[0]];
        let resolve; vm.featureCall = () => new Promise(done => { resolve = done; });
        const pending = vm.generateEvidencePack();
        if (field === 'selection') vm.toggleEvidence(items[0]);
        else { vm[field] = 'new'; sessionEvidenceMixin.watch[field].call(vm); }
        resolve(await verified('session-handoff-draft', { filePath: items[0].session.filePath })); await pending;
        assert.equal(vm.evidencePack, ''); assert.equal(vm.evidenceBusy, false);
    }
});

test('reopened collections clear unsaved artifact notes without persisting them', async () => {
    const vm = { ...state(), ...sessionCollectionsMixin.data(), ...sessionCollectionsMixin.methods, evidenceNote: 'previous topic' };
    vm.featureCall = async () => ({ item: { id: 'topic', name: 'topic', goal: 'restored' }, items, revision: 'revision' });
    await vm.openEvidenceCollection({ id: 'topic' });
    assert.equal(vm.evidenceNote, ''); assert.equal(vm.evidenceGoal, 'restored'); assert.deepEqual(vm.evidenceSelections, items);
});
