'use strict';
const { createSessionBookmarks } = require('./session-bookmarks');
const { digest } = require('./local-feature-store');
const { createSessionSearchIndex } = require('./session-search-index');
const { generateHandoffDraft } = require('./session-handoff-draft');
const { createSessionProjects } = require('./session-projects');
const { createSessionFeatureSettings } = require('./session-feature-settings');
const { createSessionDiagnostics } = require('./session-diagnostics');

function createSessionFeatures(deps) {
    async function readNode(params) {
        if (params.nodeId) return deps.readNode(params);
        let match;
        for await (const node of deps.nodes(params)) {
            if (node.text !== params.messageText) continue;
            if (match) return { error: 'bookmark-source-unavailable' };
            match = node;
        }
        return match ? { source: params.source, node: match } : { error: 'bookmark-source-unavailable' };
    }
    const bookmarks = createSessionBookmarks({ root: deps.root, readNode });
    const index = createSessionSearchIndex(deps);
    const projects = createSessionProjects({ ...deps, bookmarks });
    const settings = createSessionFeatureSettings(deps.root);
    const diagnostics = deps.diagnostics ? createSessionDiagnostics(deps.diagnostics) : null;
    const actions = {
        'session-diagnostics-targets': (params) => { if (!diagnostics) throw new Error('feature-action-invalid'); return diagnostics.targets(params.cwd); },
        'session-diagnostics-start': (params) => { if (!diagnostics) throw new Error('feature-action-invalid'); return diagnostics.start(params); },
        'session-diagnostics-status': () => { if (!diagnostics) throw new Error('feature-action-invalid'); return diagnostics.status(); },
        'session-diagnostics-cancel': () => { if (!diagnostics) throw new Error('feature-action-invalid'); return diagnostics.cancel(); },
        'session-feature-settings-get': () => settings.get(),
        'session-feature-settings-save': (params) => settings.save(params),
        'session-projects': (params) => projects.list(params),
        'session-project-map': (params) => projects.map(params),
        'session-project-prompt': (params) => projects.prompt(params),
        'session-handoff-draft': (params) => generateHandoffDraft(params, readNode),
        'session-index-status': () => index.status(),
        'session-index-refresh': (params) => index.start(params),
        'session-index-cancel': () => index.cancel(),
        'session-index-search': (params) => index.search(params),
        'session-index-node': async (params) => {
            const result = await readNode(params);
            if (result.error || digest(result.node.text) !== params.textHash) throw new Error('bookmark-source-unavailable');
            return result;
        },
        'session-bookmarks-list': (params) => bookmarks.list(params),
        'session-bookmark-save': (params) => bookmarks.save(params),
        'session-bookmark-remove': (params) => bookmarks.remove(params),
        'session-bookmark-locate': (params) => bookmarks.locate(params)
    };
    async function handle(action, params = {}) {
        try {
            if (!actions[action]) throw new Error('feature-action-invalid');
            return await actions[action](params);
        } catch (error) {
            // Keep filesystem paths and raw upstream errors out of the public contract.
            const code = /^[a-z]+(?:-[a-z]+)+$/.test(error.message) ? error.message : 'feature-read-failed';
            return { error: code, errorCode: code };
        }
    }
    return { handle, bookmarks, readNode, index };
}
module.exports = { createSessionFeatures };
