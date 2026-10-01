/**
 * Prompts-panel Markdown editor methods: overlay highlight sync,
 * mobile view switching, and the live split preview (marked + DOMPurify,
 * debounced). One implementation is shared by the agentsContent editor
 * and the sysPromptContent editor.
 *
 * State contract (declared in app.js data()):
 *   promptsPreviewEnabled, promptsPreviewCollapsed, promptsMobileView,
 *   promptsPreviewLibsMissing, agentsHighlightHtml, sysPromptHighlightHtml,
 *   agentsPreviewHtml, sysPromptPreviewHtml, agentsChangeAxis, sysChangeAxis,
 *   promptsPathReferencePaths, promptsPathReferenceLoading,
 *   promptsPathReferenceCacheKey (path-reference dropdown)
 * Template contract:
 *   refs promptsAgentsTextarea / promptsSysTextarea on the two textareas,
 *   refs promptsAgentsHighlight / promptsSysHighlight on the backdrop <pre>,
 *   refs promptsAgentsDiffView / promptsSysDiffView on the two diff row containers.
 */

import {
    buildMarkdownPreviewHtml,
    highlightMarkdownText
} from '../logic.markdown-editor.mjs';
import {
    buildPromptPathReferenceOptions as buildPromptPathReferenceOptionList,
    buildPromptPathReferenceSentence,
    insertPromptPathReferenceText
} from '../logic.prompts-path-reference.mjs';
import {
    buildPromptsChangeAxis,
    buildPromptsDiffAxis,
    computePromptsAxisScrollTop
} from '../logic.prompts-change-axis.mjs';

const PROMPTS_HIGHLIGHT_DEBOUNCE_MS = 150;
const PROMPTS_PREVIEW_DEBOUNCE_MS = 300;
const PROMPTS_AXIS_DEBOUNCE_MS = 300;

const PROMPTS_EDITOR_META = {
    agents: {
        contentField: 'agentsContent',
        originalField: 'agentsOriginalContent',
        highlightField: 'agentsHighlightHtml',
        previewField: 'agentsPreviewHtml',
        axisField: 'agentsChangeAxis',
        diffLinesField: 'agentsDiffLines',
        diffStatsField: 'agentsDiffStats',
        diffVisibleField: 'agentsDiffVisible',
        loadingField: 'agentsLoading',
        savingField: 'agentsSaving',
        diffLoadingField: 'agentsDiffLoading',
        prepareDiffMethod: 'prepareAgentsDiff',
        textareaRef: 'promptsAgentsTextarea',
        highlightRef: 'promptsAgentsHighlight',
        diffViewRef: 'promptsAgentsDiffView'
    },
    sys: {
        contentField: 'sysPromptContent',
        originalField: 'sysPromptOriginalContent',
        highlightField: 'sysPromptHighlightHtml',
        previewField: 'sysPromptPreviewHtml',
        axisField: 'sysChangeAxis',
        diffLinesField: 'sysPromptDiffLines',
        diffStatsField: 'sysPromptDiffStats',
        diffVisibleField: 'sysPromptDiffVisible',
        loadingField: 'sysPromptLoading',
        savingField: 'sysPromptSaving',
        diffLoadingField: 'sysPromptDiffLoading',
        prepareDiffMethod: 'prepareSysPromptDiff',
        textareaRef: 'promptsSysTextarea',
        highlightRef: 'promptsSysHighlight',
        diffViewRef: 'promptsSysDiffView'
    }
};

function emptyPromptsChangeAxis() {
    return { mode: 'edit', ticks: [], truncated: false, totalLines: 0, added: 0, removed: 0 };
}

function resolvePromptsHljs() {
    if (typeof window !== 'undefined' && window.hljs) {
        return window.hljs;
    }
    return null;
}

function resolvePromptsPreviewLibs() {
    if (typeof window === 'undefined') {
        return { marked: null, purify: null };
    }
    return { marked: window.marked || null, purify: window.DOMPurify || null };
}

export function createPromptsEditorMethods(options = {}) {
    const { api } = options;

    return {
        promptsEditorMeta(key) {
            return PROMPTS_EDITOR_META[key] || null;
        },


        refreshPromptsHighlight(key) {
            const meta = this.promptsEditorMeta(key);
            if (!meta) {
                return;
            }
            this[meta.highlightField] = highlightMarkdownText(this[meta.contentField], resolvePromptsHljs());
            this.syncPromptsOverlayScroll(key);
        },

        schedulePromptsHighlight(key) {
            const meta = this.promptsEditorMeta(key);
            if (!meta) {
                return;
            }
            if (!this._promptsHighlightTimers) {
                this._promptsHighlightTimers = {};
            }
            if (this._promptsHighlightTimers[key]) {
                clearTimeout(this._promptsHighlightTimers[key]);
            }
            this._promptsHighlightTimers[key] = setTimeout(() => {
                this._promptsHighlightTimers[key] = null;
                this.refreshPromptsHighlight(key);
            }, PROMPTS_HIGHLIGHT_DEBOUNCE_MS);
        },

        syncPromptsOverlayScroll(key) {
            const meta = this.promptsEditorMeta(key);
            if (!meta || typeof this.$refs !== 'object' || !this.$refs) {
                return;
            }
            const textarea = this.$refs[meta.textareaRef];
            const backdrop = this.$refs[meta.highlightRef];
            if (!textarea || !backdrop) {
                return;
            }
            backdrop.scrollTop = textarea.scrollTop;
            backdrop.scrollLeft = textarea.scrollLeft;
        },

        refreshPromptsPreview(key) {
            const meta = this.promptsEditorMeta(key);
            if (!meta) {
                return;
            }
            if (!this.promptsPreviewEnabled) {
                return;
            }
            const libs = resolvePromptsPreviewLibs();
            const state = buildMarkdownPreviewHtml(this[meta.contentField], libs.marked, libs.purify);
            if (state.unavailable) {
                this.promptsPreviewLibsMissing = true;
                this[meta.previewField] = '';
                return;
            }
            this.promptsPreviewLibsMissing = false;
            this[meta.previewField] = state.html;
        },

        schedulePromptsPreview(key) {
            const meta = this.promptsEditorMeta(key);
            if (!meta) {
                return;
            }
            if (!this._promptsPreviewTimers) {
                this._promptsPreviewTimers = {};
            }
            if (this._promptsPreviewTimers[key]) {
                clearTimeout(this._promptsPreviewTimers[key]);
            }
            this._promptsPreviewTimers[key] = setTimeout(() => {
                this._promptsPreviewTimers[key] = null;
                this.refreshPromptsPreview(key);
            }, PROMPTS_PREVIEW_DEBOUNCE_MS);
        },

        schedulePromptsEditorRefresh(key) {
            this.schedulePromptsHighlight(key);
            this.schedulePromptsPreview(key);
            this.schedulePromptsChangeAxis(key);
        },

        refreshPromptsChangeAxis(key) {
            const meta = this.promptsEditorMeta(key);
            if (!meta) {
                return;
            }
            if (this[meta.diffVisibleField]) {
                const axis = buildPromptsDiffAxis(this[meta.diffLinesField]);
                const stats = this[meta.diffStatsField];
                this[meta.axisField] = {
                    mode: 'diff',
                    ticks: axis.truncated ? [] : axis.ticks,
                    truncated: axis.truncated,
                    totalLines: axis.rowCount,
                    added: Number(stats && stats.added) || 0,
                    removed: Number(stats && stats.removed) || 0
                };
                this.consumePromptsAxisPendingJump(key);
                return;
            }
            this.clearPromptsAxisPendingJump(key);
            const current = this[meta.contentField];
            const original = this[meta.originalField];
            if (typeof current !== 'string' || current === original) {
                this[meta.axisField] = emptyPromptsChangeAxis();
                return;
            }
            const axis = buildPromptsChangeAxis(typeof original === 'string' ? original : '', current);
            this[meta.axisField] = {
                mode: 'edit',
                ticks: axis.truncated ? [] : axis.ticks,
                truncated: axis.truncated,
                totalLines: axis.totalLines,
                added: Number(axis.stats && axis.stats.added) || 0,
                removed: Number(axis.stats && axis.stats.removed) || 0
            };
        },

        schedulePromptsChangeAxis(key) {
            const meta = this.promptsEditorMeta(key);
            if (!meta) {
                return;
            }
            if (!this._promptsAxisTimers) {
                this._promptsAxisTimers = {};
            }
            if (this._promptsAxisTimers[key]) {
                clearTimeout(this._promptsAxisTimers[key]);
            }
            this._promptsAxisTimers[key] = setTimeout(() => {
                this._promptsAxisTimers[key] = null;
                this.refreshPromptsChangeAxis(key);
            }, PROMPTS_AXIS_DEBOUNCE_MS);
        },

        jumpToPromptsChangeTick(key, tick) {
            const meta = this.promptsEditorMeta(key);
            const axis = meta ? this[meta.axisField] : null;
            if (!meta || !axis || !tick) {
                return;
            }
            if (axis.mode === 'diff') {
                const view = this.$refs && this.$refs[meta.diffViewRef];
                const rows = view && view.children ? Array.prototype.slice.call(view.children) : [];
                const target = rows[tick.rowIndex];
                if (target && typeof target.scrollIntoView === 'function') {
                    target.scrollIntoView({ block: 'center' });
                }
                return;
            }
            // Edit mode: a tick click opens the red/green comparison view
            // focused on this hunk, so the user sees WHAT changed (old vs new),
            // not just where. prepareAgentsDiff / prepareSysPromptDiff are the
            // same preview entry the save/eye button uses; both settle their
            // own error state internally and never reject.
            const canOpenDiff = typeof this[meta.prepareDiffMethod] === 'function'
                && !this[meta.loadingField]
                && !this[meta.savingField]
                && !this[meta.diffLoadingField];
            if (canOpenDiff) {
                this._promptsAxisPendingJump = { key, startLine: tick.startLine };
                this[meta.prepareDiffMethod]();
                return;
            }
            // Fallback when the diff flow is not wired on the context (isolated
            // method usage): keep the legacy proportional editor scroll so the
            // click still produces an observable move instead of a silent no-op.
            const textarea = this.$refs && this.$refs[meta.textareaRef];
            if (!textarea || typeof textarea.scrollTop !== 'number') {
                return;
            }
            textarea.scrollTop = computePromptsAxisScrollTop(
                textarea.scrollHeight,
                textarea.clientHeight,
                tick.startLine,
                axis.totalLines
            );
            this.syncPromptsOverlayScroll(key);
        },

        clearPromptsAxisPendingJump(key) {
            if (this._promptsAxisPendingJump && this._promptsAxisPendingJump.key === key) {
                this._promptsAxisPendingJump = null;
            }
        },

        consumePromptsAxisPendingJump(key) {
            const pending = this._promptsAxisPendingJump;
            if (!pending || pending.key !== key) {
                return;
            }
            const meta = this.promptsEditorMeta(key);
            if (!meta) {
                this._promptsAxisPendingJump = null;
                return;
            }
            const axis = this[meta.axisField];
            if (!axis || axis.mode !== 'diff' || !axis.ticks.length) {
                return;
            }
            this._promptsAxisPendingJump = null;
            const target = axis.ticks.find((tick) => tick.startLine === pending.startLine)
                || axis.ticks.find((tick) => tick.startLine >= pending.startLine)
                || axis.ticks[axis.ticks.length - 1];
            const applyScroll = () => {
                const view = this.$refs && this.$refs[meta.diffViewRef];
                const rows = view && view.children ? Array.prototype.slice.call(view.children) : [];
                const row = rows[target.rowIndex];
                if (row && typeof row.scrollIntoView === 'function') {
                    row.scrollIntoView({ block: 'center' });
                }
            };
            if (typeof this.$nextTick === 'function') {
                this.$nextTick(applyScroll);
            } else {
                applyScroll();
            }
        },

        setPromptsMobileView(view) {
            if (view === 'edit' || view === 'preview') {
                this.promptsMobileView = view;
            }
        },

        togglePromptsPreviewCollapsed() {
            this.promptsPreviewCollapsed = !this.promptsPreviewCollapsed;
            if (typeof this.persistWebUiPreferences === 'function') {
                this.persistWebUiPreferences({ promptsPreviewCollapsed: this.promptsPreviewCollapsed });
            }
        },

        buildPromptsPathReferenceCacheKey() {
            return [
                (this.projectClaudeMdPath || '').trim(),
                this.sysPromptScope || 'global',
                this.sysPromptMode || 'system'
            ].join('|');
        },

        // Lazy loader for the path-reference dropdown. Fetches the OTHER tabs'
        // real absolute paths via the existing metaOnly RPC contracts
        // (get-agents-file / get-opencode-agents-file / get-claude-md-file
        // return path + exists without content; get-system-prompt returns
        // path + a small SYSTEM.md/APPEND_SYSTEM.md read). Cache key covers the
        // only inputs that change a resolved path: project baseDir, sysPrompt
        // scope and mode. Idempotent per key; concurrent callers share the
        // in-flight promise.
        loadPromptsPathReferences() {
            const cacheKey = this.buildPromptsPathReferenceCacheKey();
            if (this.promptsPathReferenceCacheKey === cacheKey && !this.promptsPathReferenceLoading) {
                return Promise.resolve();
            }
            if (this.promptsPathReferenceLoading && this._promptsPathReferencePromise) {
                return this._promptsPathReferencePromise;
            }
            if (typeof api !== 'function') {
                return Promise.resolve();
            }
            const projectPath = (this.projectClaudeMdPath || '').trim();
            const scope = this.sysPromptScope || 'global';
            const mode = this.sysPromptMode || 'system';
            const fetchEntry = async (action, params) => {
                try {
                    const res = await api(action, params);
                    if (res && res.error) {
                        return { path: '', exists: false, error: String(res.error) };
                    }
                    return { path: (res && res.path) || '', exists: !!(res && res.exists) };
                } catch (e) {
                    return {
                        path: '',
                        exists: false,
                        error: typeof this.t === 'function' ? this.t('prompts.pathReference.loadFailed') : 'load failed'
                    };
                }
            };
            this.promptsPathReferenceLoading = true;
            const promise = Promise.all([
                fetchEntry('get-agents-file', { metaOnly: true }),
                fetchEntry('get-opencode-agents-file', { metaOnly: true }),
                fetchEntry('get-claude-md-file', { metaOnly: true }),
                projectPath
                    ? fetchEntry('get-claude-md-file', { baseDir: projectPath, metaOnly: true })
                    : Promise.resolve(null),
                fetchEntry('get-system-prompt', { scope, mode })
            ]).then((results) => {
                this.promptsPathReferencePaths = {
                    codex: results[0],
                    opencode: results[1],
                    claudeGlobal: results[2],
                    claudeProject: results[3] || { path: '', exists: false, error: '' },
                    system: results[4]
                };
                this.promptsPathReferenceCacheKey = cacheKey;
            }).finally(() => {
                this.promptsPathReferenceLoading = false;
                this._promptsPathReferencePromise = null;
            });
            this._promptsPathReferencePromise = promise;
            return promise;
        },

        promptsPathReferenceOptionList() {
            return buildPromptPathReferenceOptionList({
                currentTab: this.promptsSubTab,
                paths: this.promptsPathReferencePaths || {},
                t: (key, params) => (typeof this.t === 'function' ? this.t(key, params) : key),
                systemFile: (this.sysPromptMode || 'system') === 'append' ? 'APPEND_SYSTEM.md' : 'SYSTEM.md'
            });
        },

        insertPromptPathReference(entryId, key, event) {
            const select = event && event.target;
            if (select && typeof select.value === 'string') {
                select.value = '';
            }
            const meta = this.promptsEditorMeta(key);
            const entry = (this.promptsPathReferencePaths || {})[entryId];
            if (!meta || !entry || !entry.path || entry.error) {
                return;
            }
            if (this[meta.loadingField] || this[meta.savingField] || this[meta.diffVisibleField]) {
                return;
            }
            const sentence = buildPromptPathReferenceSentence(entry.path);
            if (!sentence) {
                return;
            }
            const textarea = typeof this.$refs === 'object' && this.$refs
                ? this.$refs[meta.textareaRef]
                : null;
            const content = typeof this[meta.contentField] === 'string' ? this[meta.contentField] : '';
            let start = content.length;
            let end = content.length;
            if (textarea && typeof textarea.selectionStart === 'number') {
                start = textarea.selectionStart;
                end = textarea.selectionEnd;
            }
            const result = insertPromptPathReferenceText(content, start, end, sentence);
            this[meta.contentField] = result.content;
            this.schedulePromptsEditorRefresh(key);
            const restoreCaret = () => {
                if (textarea && typeof textarea.setSelectionRange === 'function') {
                    textarea.setSelectionRange(result.caret, result.caret);
                    textarea.focus();
                }
            };
            if (typeof this.$nextTick === 'function') {
                this.$nextTick(restoreCaret);
            } else {
                restoreCaret();
            }
            if (typeof this.showMessage === 'function') {
                this.showMessage(this.t('prompts.pathReference.toast.inserted'), 'success');
            }
        }
    };
}
