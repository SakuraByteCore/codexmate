/**
 * Prompts-panel "path reference" logic: build the dropdown entries that
 * point to the OTHER instruction-file tabs' real absolute paths, and
 * splice the rendered reference sentence into editor content at the caret.
 *
 * The inserted sentence is instruction-file CONTENT (not UI text), so it
 * is intentionally a fixed English template, independent of the UI locale.
 *
 * Pure functions only: no Vue, no DOM, no api access.
 */

export const PROMPT_PATH_REFERENCE_TEMPLATE = 'Always follow the rules defined in `{path}`.';

const PROMPT_PATH_REFERENCE_ENTRY_ORDER = ['codex', 'opencode', 'claudeGlobal', 'claudeProject', 'system'];

// promptsSubTab value -> entry id excluded from that tab's own dropdown.
const CURRENT_TAB_EXCLUDED_ENTRY = {
    'codex': 'codex',
    'opencode': 'opencode',
    'claude-project': 'claudeProject',
    'system': 'system'
};

export function buildPromptPathReferenceSentence(path) {
    const target = typeof path === 'string' ? path.trim() : '';
    if (!target) {
        return '';
    }
    return PROMPT_PATH_REFERENCE_TEMPLATE.replace('{path}', target);
}

/**
 * Splice `text` into `content` at the given selection, replacing the
 * selected range (same contract as typing over a selection). Out-of-range
 * indices are clamped; invalid indices fall back to "insert at end".
 */
export function insertPromptPathReferenceText(content, selectionStart, selectionEnd, text) {
    const source = typeof content === 'string' ? content : '';
    const inserted = typeof text === 'string' ? text : '';
    const fallback = source.length;
    const rawStart = Number.isFinite(selectionStart) ? Number(selectionStart) : fallback;
    const rawEnd = Number.isFinite(selectionEnd) ? Number(selectionEnd) : fallback;
    const start = Math.min(Math.max(rawStart, 0), source.length);
    const end = Math.min(Math.max(rawEnd, start), source.length);
    return {
        content: source.slice(0, start) + inserted + source.slice(end),
        caret: start + inserted.length
    };
}

/**
 * Build the dropdown option list for the prompts editors.
 *
 * config:
 *   - currentTab: promptsSubTab value ('codex' | 'opencode' | 'claude-project' | 'system')
 *   - paths: map entry id -> { path, exists, error } (server-resolved absolute paths)
 *   - t: i18n translator, signature t(key, params)
 *   - systemFile: file name shown for the Pi system-prompt entry (SYSTEM.md / APPEND_SYSTEM.md)
 *
 * Each option: { id, label, path, exists, disabled, disabledReason }.
 * Missing/error entries stay in the list but render disabled, so a failed
 * fetch is visible instead of silently hiding a tab.
 */
export function buildPromptPathReferenceOptions(config) {
    const cfg = config || {};
    const currentTab = CURRENT_TAB_EXCLUDED_ENTRY[cfg.currentTab] ? cfg.currentTab : 'codex';
    const excludedEntry = CURRENT_TAB_EXCLUDED_ENTRY[currentTab];
    const paths = cfg.paths || {};
    const t = typeof cfg.t === 'function' ? cfg.t : ((key) => key);
    const systemFile = typeof cfg.systemFile === 'string' && cfg.systemFile.trim()
        ? cfg.systemFile.trim()
        : 'SYSTEM.md';

    const labelKeys = {
        codex: 'prompts.pathReference.codex',
        opencode: 'prompts.pathReference.opencode',
        claudeGlobal: 'prompts.pathReference.claudeGlobal',
        claudeProject: 'prompts.pathReference.claudeProject',
        system: 'prompts.pathReference.system'
    };

    const options = [];
    for (const id of PROMPT_PATH_REFERENCE_ENTRY_ORDER) {
        if (id === excludedEntry) {
            continue;
        }
        const entry = paths[id] || null;
        let label = id === 'system'
            ? t(labelKeys[id], { file: systemFile })
            : t(labelKeys[id]);
        let disabled = false;
        let disabledReason = '';
        if (id === 'claudeProject' && !(entry && entry.path)) {
            disabled = true;
            disabledReason = t('prompts.pathReference.projectMissing');
        }
        if (!entry) {
            disabled = true;
            if (!disabledReason) {
                disabledReason = t('prompts.pathReference.notLoaded');
            }
        } else if (entry.error) {
            disabled = true;
            disabledReason = entry.error;
        } else if (entry.path && entry.exists === false) {
            label += ' · ' + t('common.notExistsWillCreateOnSave');
        }
        options.push({
            id,
            label,
            path: entry && entry.path ? entry.path : '',
            exists: entry ? !!entry.exists : false,
            disabled,
            disabledReason
        });
    }
    return options;
}
