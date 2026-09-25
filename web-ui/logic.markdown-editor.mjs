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
