/**
 * Prompts-panel Markdown editor methods: overlay highlight sync,
 * mobile-friendly toolbar actions (bold / list / code / undo), and the
 * live split preview (marked + DOMPurify, debounced). One implementation
 * is shared by the agentsContent editor and the sysPromptContent editor.
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
    applyMarkdownToolbarAction,
    buildMarkdownPreviewHtml,
    highlightMarkdownText
} from '../logic.markdown-editor.mjs';

const PROMPTS_HIGHLIGHT_DEBOUNCE_MS = 150;
const PROMPTS_PREVIEW_DEBOUNCE_MS = 300;
const PROMPTS_UNDO_STACK_LIMIT = 50;

const PROMPTS_EDITOR_META = {
    agents: {
        contentField: 'agentsContent',
        highlightField: 'agentsHighlightHtml',
        previewField: 'agentsPreviewHtml',
        textareaRef: 'promptsAgentsTextarea',
        highlightRef: 'promptsAgentsHighlight',
        undoStackKey: 'agents'
    },
    sys: {
        contentField: 'sysPromptContent',
        highlightField: 'sysPromptHighlightHtml',
        previewField: 'sysPromptPreviewHtml',
        textareaRef: 'promptsSysTextarea',
        highlightRef: 'promptsSysHighlight',
        undoStackKey: 'sys'
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

        promptsEditorUndoStack(key) {
            const meta = this.promptsEditorMeta(key);
            if (!meta) {
                return null;
            }
            if (!this._promptsEditorUndoStacks) {
                this._promptsEditorUndoStacks = {};
            }
            if (!Array.isArray(this._promptsEditorUndoStacks[meta.undoStackKey])) {
                this._promptsEditorUndoStacks[meta.undoStackKey] = [];
            }
            return this._promptsEditorUndoStacks[meta.undoStackKey];
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

        togglePromptsPreview() {
            this.promptsPreviewEnabled = !this.promptsPreviewEnabled;
            if (this.promptsPreviewEnabled) {
                this.refreshPromptsPreview('agents');
                this.refreshPromptsPreview('sys');
            }
        },

        setPromptsMobileView(view) {
            if (view === 'edit' || view === 'preview') {
                this.promptsMobileView = view;
            }
        },

        applyPromptsToolbarAction(key, action) {
            const meta = this.promptsEditorMeta(key);
            if (!meta || !this.$refs || !this.$refs[meta.textareaRef]) {
                return;
            }
            const textarea = this.$refs[meta.textareaRef];
            if (textarea.readOnly) {
                return;
            }
            const stack = this.promptsEditorUndoStack(key);
            stack.push({
                text: this[meta.contentField],
                selStart: textarea.selectionStart,
                selEnd: textarea.selectionEnd
            });
            if (stack.length > PROMPTS_UNDO_STACK_LIMIT) {
                stack.shift();
            }
            const result = applyMarkdownToolbarAction(
                this[meta.contentField],
                textarea.selectionStart,
                textarea.selectionEnd,
                action
            );
            this[meta.contentField] = result.text;
            this.$nextTick(() => {
                textarea.focus();
                textarea.setSelectionRange(result.selStart, result.selEnd);
                this.refreshPromptsHighlight(key);
            });
            this.schedulePromptsPreview(key);
        },

        promptsUndo(key) {
            const meta = this.promptsEditorMeta(key);
            const stack = this.promptsEditorUndoStack(key);
            if (!meta || !stack || !stack.length || !this.$refs || !this.$refs[meta.textareaRef]) {
                return;
            }
            const snapshot = stack.pop();
            const textarea = this.$refs[meta.textareaRef];
            this[meta.contentField] = snapshot.text;
            this.$nextTick(() => {
                textarea.focus();
                textarea.setSelectionRange(snapshot.selStart, snapshot.selEnd);
                this.refreshPromptsHighlight(key);
            });
            this.schedulePromptsPreview(key);
        },

        clearPromptsEditorUndoStack(key) {
            const stack = this.promptsEditorUndoStack(key);
            if (stack) {
                stack.length = 0;
            }
        }
    };
}
