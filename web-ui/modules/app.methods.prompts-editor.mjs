/**
 * Prompts-panel Markdown editor methods: overlay highlight sync,
 * mobile view switching, and the live split preview (marked + DOMPurify,
 * debounced). One implementation is shared by the agentsContent editor
 * and the sysPromptContent editor.
 *
 * State contract (declared in app.js data()):
 *   promptsPreviewEnabled, promptsMobileView, promptsPreviewLibsMissing,
 *   agentsHighlightHtml, sysPromptHighlightHtml,
 *   agentsPreviewHtml, sysPromptPreviewHtml
 * Template contract:
 *   refs promptsAgentsTextarea / promptsSysTextarea on the two textareas,
 *   refs promptsAgentsHighlight / promptsSysHighlight on the backdrop <pre>.
 */

import {
    buildMarkdownPreviewHtml,
    highlightMarkdownText
} from '../logic.markdown-editor.mjs';

const PROMPTS_HIGHLIGHT_DEBOUNCE_MS = 150;
const PROMPTS_PREVIEW_DEBOUNCE_MS = 300;

const PROMPTS_EDITOR_META = {
    agents: {
        contentField: 'agentsContent',
        highlightField: 'agentsHighlightHtml',
        previewField: 'agentsPreviewHtml',
        textareaRef: 'promptsAgentsTextarea',
        highlightRef: 'promptsAgentsHighlight'
    },
    sys: {
        contentField: 'sysPromptContent',
        highlightField: 'sysPromptHighlightHtml',
        previewField: 'sysPromptPreviewHtml',
        textareaRef: 'promptsSysTextarea',
        highlightRef: 'promptsSysHighlight'
    }
};

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
        },

        setPromptsMobileView(view) {
            if (view === 'edit' || view === 'preview') {
                this.promptsMobileView = view;
            }
        }
    };
}
