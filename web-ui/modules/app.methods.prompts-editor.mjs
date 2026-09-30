/**
 * Prompts-panel Markdown editor methods: overlay highlight sync,
 * mobile view switching, and the live split preview (marked + DOMPurify,
 * debounced). One implementation is shared by the agentsContent editor
 * and the sysPromptContent editor.
 *
 * State contract (declared in app.js data()):
 *   promptsPreviewEnabled, promptsPreviewCollapsed, promptsMobileView,
 *   promptsPreviewLibsMissing, agentsHighlightHtml, sysPromptHighlightHtml,
 *   agentsPreviewHtml, sysPromptPreviewHtml, agentsChangeAxis, sysChangeAxis
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

export function createPromptsEditorMethods() {
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
                return;
            }
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
        }
    };
}
