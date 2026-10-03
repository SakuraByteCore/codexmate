/**
 * Pure logic for the prompts-panel Markdown editor.
 * No DOM access in this module so every function stays unit-testable.
 *
 * Preview rendering delegates to the vendored marked + DOMPurify pair; raw
 * markdown may embed arbitrary HTML, so sanitize is mandatory before the
 * result reaches v-html.
 */

/**
 * Render a markdown preview. Returns a state object instead of raw HTML so
 * the UI can surface "libs missing" and "empty input" explicitly instead of
 * faking a successful render.
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
