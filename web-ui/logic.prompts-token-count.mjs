/**
 * Heuristic token-count estimation for the prompts panel.
 *
 * The Web UI ships zero npm dependencies and all frontend libraries are
 * vendored single files, so a real BPE tokenizer (2-3 MB per encoding) is not
 * an acceptable trade-off for this feature. Instead we use a lightweight
 * heuristic that is accurate enough for "is my instruction file 2k or 20k
 * tokens" style decisions:
 *
 *   - CJK ideographs / kana / fullwidth forms count as ~1 token per
 *     character (matches the common ~1 token per CJK char behavior of
 *     mainstream tokenizers);
 *   - everything else (Latin words, markdown syntax, whitespace, code) is
 *     estimated at ~4 characters per token.
 *
 * Values are meant to be displayed with an "approx." qualifier in the UI.
 */

// CJK ideographs, Hangul jamo/syllables, kana, CJK punctuation/symbols and
// fullwidth forms all tokenize at roughly one token per character.
const CJK_TOKEN_RE = /[\u1100-\u11FF\u2E80-\u2EFF\u3000-\u303F\u3040-\u30FF\u3130-\u318F\u3400-\u4DBF\u4E00-\u9FFF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/g;

// Non-CJK text averages roughly 4 characters per token for typical
// English + markdown + code instruction files.
const NON_CJK_CHARS_PER_TOKEN = 4;

export function estimatePromptTokenCount(text) {
    const source = typeof text === 'string' ? text : '';
    if (!source) {
        return 0;
    }
    const cjkMatches = source.match(CJK_TOKEN_RE);
    const cjkTokenCount = cjkMatches ? cjkMatches.length : 0;
    const nonCjkCharCount = source.length - cjkTokenCount;
    return cjkTokenCount + Math.ceil(nonCjkCharCount / NON_CJK_CHARS_PER_TOKEN);
}

export function buildPromptTokenDiffStats(originalText, currentText) {
    const before = estimatePromptTokenCount(originalText);
    const current = estimatePromptTokenCount(currentText);
    const delta = current - before;
    return {
        before,
        current,
        delta,
        deltaLabel: delta === 0 ? '±0' : (delta > 0 ? `+${delta}` : String(delta)),
        deltaKind: delta === 0 ? 'same' : (delta > 0 ? 'add' : 'del')
    };
}
