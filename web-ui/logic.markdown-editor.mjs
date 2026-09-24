/**
 * Pure logic for the prompts-panel Markdown editor.
 * No DOM access in this module so every function stays unit-testable.
 *
 * Syntax highlighting delegates to the vendored highlight.js UMD build
 * (web-ui/res/highlight.min.js, "markdown" grammar is included in the
 * common build) and the rendered highlight markup is layered behind a
 * transparent textarea. Preview rendering delegates to the vendored
 * marked + DOMPurify pair; raw markdown may embed arbitrary HTML, so
 * sanitize is mandatory before the result reaches v-html.
 */

const HIGHLIGHT_MAX_CHARS = 200000;
const HTML_ESCAPE_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
};

const LIST_PREFIX_RE = /^[ \t]*([-*+])[ \t]/;

let hasWarnedHighlightFallback = false;

export function escapeHtmlText(text) {
    return String(text === null || text === undefined ? '' : text)
        .replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

function plainHighlightFallback(text) {
    if (!hasWarnedHighlightFallback) {
        hasWarnedHighlightFallback = true;
        // eslint-disable-next-line no-console
        console.warn('prompts editor: highlight.js unavailable, editor falls back to plain text rendering');
    }
    return escapeHtmlText(text) + '\n';
}

/**
 * Produce the highlighted HTML layer for a markdown source string.
 * highlight.js escapes HTML entities itself; the trailing newline keeps
 * the <pre> backdrop visually aligned with the textarea's final line.
 * Returns escaped plain text when hljs is missing or the input exceeds
 * the highlight budget (observable degradation, never a fake success).
 */
export function highlightMarkdownText(text, hljs) {
    const source = typeof text === 'string' ? text : '';
    if (!hljs || typeof hljs.highlight !== 'function' || typeof hljs.getLanguage !== 'function' || !hljs.getLanguage('markdown')) {
        return plainHighlightFallback(source);
    }
    if (source.length > HIGHLIGHT_MAX_CHARS) {
        return plainHighlightFallback(source);
    }
    try {
        return hljs.highlight(source, { language: 'markdown', ignoreUnescapedHTML: true }).value + '\n';
    } catch (e) {
        return plainHighlightFallback(source);
    }
}

function lineBounds(text, start, end) {
    const from = text.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    let to = text.indexOf('\n', end);
    if (to === -1) {
        to = text.length;
    }
    return { from, to };
}

function clampSelection(text, selStart, selEnd) {
    const max = text.length;
    const start = Math.max(0, Math.min(max, typeof selStart === 'number' ? Math.floor(selStart) : 0));
    const end = Math.max(start, Math.min(max, typeof selEnd === 'number' ? Math.floor(selEnd) : start));
    return { start, end };
}

function wrapInline(text, selStart, selEnd, marker) {
    const { start, end } = clampSelection(text, selStart, selEnd);
    const next = text.slice(0, start) + marker + text.slice(start, end) + marker + text.slice(end);
    if (start === end) {
        return { text: next, selStart: start + marker.length, selEnd: start + marker.length };
    }
    return { text: next, selStart: start + marker.length, selEnd: end + marker.length };
}

function toggleLineListPrefix(text, selStart, selEnd) {
    const { start, end } = clampSelection(text, selStart, selEnd);
    const bounds = lineBounds(text, start, end);
    const block = text.slice(bounds.from, bounds.to);
    const lines = block.split('\n');
    const hasEmptyLine = lines.some((line) => line.length === 0);
    const allPrefixed = !hasEmptyLine && lines.every((line) => LIST_PREFIX_RE.test(line));
    const nextBlock = lines
        .map((line) => {
            if (allPrefixed) {
                return line.replace(/^([ \t]*)[-*+][ \t]/, '$1');
            }
            if (line.length === 0 || LIST_PREFIX_RE.test(line)) {
                return line;
            }
            const indentMatch = /^[ \t]*/.exec(line);
            const indent = indentMatch ? indentMatch[0] : '';
            return indent + '- ' + line.slice(indent.length);
        })
        .join('\n');
    const next = text.slice(0, bounds.from) + nextBlock + text.slice(bounds.to);
    const delta = nextBlock.length - block.length;
    return { text: next, selStart: bounds.from, selEnd: bounds.to + delta };
}

function wrapCodeBlock(text, selStart, selEnd) {
    const { start, end } = clampSelection(text, selStart, selEnd);
    const inner = text.slice(start, end);
    const prefix = '```\n';
    const suffix = '\n```';
    const next = text.slice(0, start) + prefix + inner + suffix + text.slice(end);
    const innerStart = start + prefix.length;
    if (start === end) {
        return { text: next, selStart: innerStart, selEnd: innerStart };
    }
    return { text: next, selStart: innerStart, selEnd: innerStart + inner.length };
}

/**
 * Apply one toolbar action to a markdown source string.
 * action: 'bold' | 'list' | 'code'. Pure: (text, selection, action) => next state.
 */
export function applyMarkdownToolbarAction(text, selStart, selEnd, action) {
    const source = typeof text === 'string' ? text : '';
    const clamped = clampSelection(source, selStart, selEnd);
    if (action === 'bold') {
        return wrapInline(source, selStart, selEnd, '**');
    }
    if (action === 'list') {
        return toggleLineListPrefix(source, selStart, selEnd);
    }
    if (action === 'code') {
        return wrapCodeBlock(source, selStart, selEnd);
    }
    return { text: source, selStart: clamped.start, selEnd: clamped.end };
}

/**
 * Render a markdown preview. Returns a state object instead of raw HTML so
 * the UI can surface "libs missing" and "empty input" explicitly instead
 * of faking a successful render.
 */
export function buildMarkdownPreviewHtml(text, marked, purify) {
    const source = typeof text === 'string' ? text : '';
    if (!source.trim()) {
        return { empty: true, html: '' };
    }
    if (!marked || typeof marked.parse !== 'function' || !purify || typeof purify.sanitize !== 'function') {
        return { unavailable: true, html: '' };
    }
    const rawHtml = marked.parse(source, { gfm: true, breaks: false });
    return { html: purify.sanitize(String(rawHtml)) };
}
