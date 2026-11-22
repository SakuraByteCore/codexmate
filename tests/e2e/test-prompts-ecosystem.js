const { assert } = require('./helpers');

module.exports = async function testPromptsEcosystem({ api }) {
    const initial = await api('get-plugin-config');
    assert(!initial.error && typeof initial.hash === 'string', 'plugin configuration endpoint must return a hash');
    const old = { id: 'e2e-template', name: 'Template', template: '{{project_path}}', isBuiltin: false };
    const next = { ...old, template: '{{project_path}}\n{{git_diff}}' };
    const saved = await api('apply-plugin-config', { templates: [next], legacyTemplates: [old], baseHash: initial.hash });
    assert(!saved.error && saved.templates[0].template === next.template, 'plugin configuration must save through the real API');
    const versions = await api('list-prompt-history', { bucket: saved.historyBucket });
    assert(Array.isArray(versions) && versions.length > 0, 'migration must preserve the old browser template');
    const previous = await api('get-prompt-history', { bucket: saved.historyBucket, id: versions[0].id });
    const config = JSON.parse(previous.content);
    assert(config.templates[0].template === old.template, 'history must preserve the raw template placeholders');
    const stale = await api('apply-plugin-config', { templates: [], baseHash: initial.hash });
    assert(!!stale.error, 'stale plugin writes must be rejected');
    const restored = await api('apply-plugin-config', { templates: config.templates, baseHash: saved.hash });
    assert(!restored.error && restored.templates[0].template === old.template, 'plugin rollback must write the chosen version');
    const after = await api('list-prompt-history', { bucket: saved.historyBucket });
    assert(after.length > versions.length, 'rollback must preserve a backup of the replaced configuration');
    const prompt = await api('get-agents-file');
    const conflict = await api('apply-agents-file', { content: 'must-not-write', baseContent: `${prompt.content}stale` });
    assert(!!conflict.error, 'prompt rollback must check the current file');
    assert((await api('get-agents-file')).content === prompt.content, 'failed prompt rollback must not alter the file');
    const applied = await api('apply-agents-file', { content: 'ecosystem-test\n', baseContent: prompt.content });
    assert(applied.success === true && !!applied.historyBucket, 'compatible prompt writes must succeed and return a history bucket');
    assert((await api('get-agents-file')).content === 'ecosystem-test\n', 'atomic prompt write must preserve text semantics');
    console.log('[e2e] prompts ecosystem endpoints, history and atomic rollback passed');
};
