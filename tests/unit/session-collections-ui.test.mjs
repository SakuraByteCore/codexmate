import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionCollectionsMixin } from '../../web-ui/modules/session-collections.mjs';
import { sessionFeaturesMixin } from '../../web-ui/modules/session-features.mjs';
import { sessionStoriesMixin } from '../../web-ui/modules/session-stories.mjs';
const session = { source: 'pi', sessionId: 'one', filePath: '/one', cwd: '/repo', title: 'one' };
const reference = { session, nodeId: 'record-1', textHash: 'hash', state: 'ready' };
const collectionState = () => ({ ...sessionCollectionsMixin.data(), ...sessionCollectionsMixin.methods,
    evidenceSelections: [], evidenceSequence: 0, evidenceGoal: '', evidencePack: '', evidenceError: '', featureErrorText: error => error.message });

test('saved collection opens explicitly, round-trips independently and strips previews when saving', async () => {
    const vm = collectionState(); const stored = [{ id: 'a', name: 'A', goal: 'goal', references: [reference] }, { id: 'b', name: 'B', goal: '', references: [{ ...reference, nodeId: 'record-2' }] }];
    vm.featureCall = async (action, params) => {
        if (action === 'session-collections-list') return { items: stored, revision: 'rev' };
        const item = stored.find(entry => entry.id === params.id);
        return { item, items: item.references, revision: 'rev' };
    };
    await vm.loadEvidenceCollections(); assert.equal(vm.evidenceSelections.length, 0);
    for (const item of [stored[0], stored[1], stored[0]]) await vm.openEvidenceCollection(item);
    assert.equal(vm.collectionId, 'a'); assert.equal(vm.evidenceSelections[0].nodeId, 'record-1');
    vm.featureCall = async (action, params) => {
        assert.equal(action, 'session-collection-save'); assert.equal(params.id, ''); assert.equal(params.revision, 'rev');
        assert.deepEqual(Object.keys(params.references[0]).sort(), ['nodeId', 'session', 'textHash']);
        return { items: stored, item: stored[1], revision: 'new' };
    };
    await vm.saveEvidenceCollection(true); assert.equal(vm.collectionId, 'b'); assert.equal(vm.collectionBusy, false);
});

test('late collection and story replies cannot replace a newer target', async () => {
    const vm = collectionState(); let finish;
    vm.featureCall = () => new Promise(resolve => { finish = resolve; });
    const pending = vm.openEvidenceCollection({ id: 'a' }); vm.collectionSequence++;
    finish({ item: { id: 'a', name: 'A', goal: '' }, items: [reference] }); await pending;
    assert.equal(vm.evidenceSelections.length, 0);
    const story = { ...sessionStoriesMixin.data(), ...sessionStoriesMixin.methods, projectSelected: '/repo', projectGitCommit: { sha: 'one' }, featureErrorText: error => error.message };
    story.featureCall = () => new Promise(resolve => { finish = resolve; });
    const loading = story.loadProjectStories(); story.projectSelected = '/other'; sessionStoriesMixin.watch.projectSelected.call(story);
    finish({ items: [{ sha: 'one' }], sessions: [session], revision: 'old' }); await loading;
    assert.deepEqual(story.stories, []); assert.equal(story.storyBusy, false);
});

test('story saving carries the current project, full commit and selected session only', async () => {
    const vm = { ...sessionStoriesMixin.data(), ...sessionStoriesMixin.methods, projectSelected: '/repo', projectGitCommit: { sha: 'a'.repeat(40) }, featureErrorText: error => error.message };
    vm.storySessions = [session]; vm.storySession = vm.storySessionKey(session); vm.storyNote = 'why'; vm.storyRevision = 'rev';
    vm.featureCall = async (action, params) => {
        assert.equal(action, 'session-story-save'); assert.equal(params.project, '/repo'); assert.equal(params.sha.length, 40);
        assert.equal(params.session, session); assert.equal(params.note, 'why'); assert.equal(params.revision, 'rev');
        return { items: [{ sha: params.sha, session, note: 'why' }], sessions: [session], revision: 'new' };
    };
    await vm.saveProjectStory(); assert.equal(vm.stories.length, 1); assert.equal(vm.storyRevision, 'new');
    vm.commitStories = sessionStoriesMixin.computed.commitStories.call(vm);
    sessionStoriesMixin.watch.storySession.call(vm, vm.storySession); assert.equal(vm.storyNote, 'why');
});


test('initial session loading cannot invalidate an independent project workspace request', async () => {
    const vm = { ...sessionFeaturesMixin.data(), ...sessionFeaturesMixin.methods };
    let finish; vm.featureCall = () => new Promise(resolve => { finish = resolve; });
    const pending = vm.loadProjectWorkspace();
    sessionFeaturesMixin.watch.handoffSessionKey.call(vm);
    finish({ projects: [{ key: '/repo' }], detail: null }); await pending;
    assert.equal(vm.projectReport.projects[0].key, '/repo'); assert.equal(vm.featureBusy, false);
});
