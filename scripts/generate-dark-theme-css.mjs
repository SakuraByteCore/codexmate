#!/usr/bin/env node
/**
 * Generate web-ui/styles/theme-dark.css
 *
 * Light theme source files stay untouched. This script scans every stylesheet
 * referenced by web-ui/styles.css (except base-theme.css, whose tokens are
 * overridden by hand below, and theme-dark.css itself), finds declarations
 * with hardcoded light-biased colors, and emits mirrored declarations under
 * `[data-theme="dark"]` with mapped dark values.
 *
 * Regenerate with:
 *   node scripts/generate-dark-theme-css.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STYLES_DIR = path.join(ROOT, 'web-ui', 'styles');
const ENTRY = path.join(ROOT, 'web-ui', 'styles.css');
const OUTPUT = path.join(STYLES_DIR, 'theme-dark.css');
const HAND_TOKENS_FILE = path.join(STYLES_DIR, 'theme-dark-tokens.css');

const SKIP_FILES = new Set(['base-theme.css', 'theme-dark.css', 'theme-dark-tokens.css', 'theme-ocean.css', 'theme-ocean-tokens.css']);

// Selectors under contract tests that forbid duplication in other stylesheets
// (e.g. tests/unit/session-header-actions-layout.test.mjs). Their hardcoded
// colors are tokenized in the source files instead of mirrored here.
const SKIP_SELECTORS = [/sessions-header-actions/];

function readStylesheetOrder() {
    const source = fs.readFileSync(ENTRY, 'utf8');
    const imports = [...source.matchAll(/@import\s+url\(['"]?\.\/styles\/([^'")]+)['"]?\)/g)]
        .map((match) => match[1]);
    if (!imports.length) throw new Error('no stylesheet imports found in web-ui/styles.css');
    return imports.filter((name) => !SKIP_FILES.has(name));
}

/* ---------- color parsing / conversion ---------- */

function parseHexChannels(hex) {
    let raw = hex.replace(/^#/, '');
    if (raw.length === 3 || raw.length === 4) raw = [...raw].map((ch) => ch + ch).join('');
    return {
        r: parseInt(raw.slice(0, 2), 16),
        g: parseInt(raw.slice(2, 4), 16),
        b: parseInt(raw.slice(4, 6), 16),
        a: raw.length === 8 ? parseInt(raw.slice(6, 8), 16) / 255 : 1
    };
}

function rgbToHsl(r, g, b) {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
        else if (max === gn) h = ((bn - rn) / d + 2) / 6;
        else h = ((rn - gn) / d + 4) / 6;
    }
    return { h: h * 360, s, l };
}

function hueToRgb(p, q, t) {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
}

function hslToRgb(h, s, l) {
    const hn = (h % 360) / 360;
    if (s === 0) {
        const v = Math.round(l * 255);
        return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
        r: Math.round(hueToRgb(p, q, hn + 1 / 3) * 255),
        g: Math.round(hueToRgb(p, q, hn) * 255),
        b: Math.round(hueToRgb(p, q, hn - 1 / 3) * 255)
    };
}

function round2(value) {
    return Math.round(value * 100) / 100;
}

function rgbaText(r, g, b, a) {
    if (a >= 1) return `rgb(${r}, ${g}, ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${round2(a)})`;
}

/* ---------- dark mapping ---------- */

const KEEP = Symbol('keep');

// Hand-curated overrides keyed by normalized literal text; reviewed against
// real usage sites. Value '*' keeps the literal unchanged in dark mode.
// A value of the form { default: 'x', color: 'y' } applies 'color' when the
// declaration property is `color` (text) and 'default' otherwise.
const MANUAL_MAP = {
    '#fff': KEEP,
    '#ffffff': KEEP,
    '#fffdfc': '#202124',
    '#fff8f1': '#17181A',
    '#f7f0e9': '#17181A',
    '#f1e8df': '#202124',
    '#fef2f2': '#3A2326',
    '#ffd7d0': { default: '#5A2A22', color: '#F0A79B' },
    '#241f1c': '#EDE9E5',
    '#5a504a': '#B9AFA8',
    '#82746a': '#958A80',
    '#a99b91': '#857A72',
    '#8e8e93': '#A6A6AB',
    '#1d1d1f': '#ECE8E4', // brand-kicker text; only used as text color
    '#2d2d2f': '#D8D3CE', // brand-kicker gradient tail; only used as text color
    '#c87963': '#D68F79',
    '#d97757': '#E08A6F',
    '#d26b5a': '#DE8370',
    '#a95845': '#C1715C'
};

function classify(c) {
    const { r, g, b } = c;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const spread = max - min;
    if (min >= 245) return 'white';
    if (min >= 200 && max >= 240) return 'warm-white';
    if (max <= 60) return spread <= 8 ? 'neutral-dark' : 'cool-dark';
    if (max <= 95 && r >= g && g >= b) return 'dark-warm';
    if (min >= 80 && max <= 220 && r >= b) return 'light-border';
    return 'saturated';
}

function propKind(prop) {
    const p = prop.toLowerCase().trim();
    if (p === 'color') return 'color';
    if (p.startsWith('border') || p.startsWith('outline')) return 'border';
    if (p.includes('shadow')) return 'shadow';
    if (p.startsWith('background') || p === 'fill' || p === 'stroke') return 'background';
    if (p.startsWith('--')) return 'custom';
    return 'other';
}

function mapColorChannels(c, prop) {
    const kind = classify(c);
    const kind2 = propKind(prop);
    const { r, g, b, a } = c;

    if (kind === 'white') {
        // White text / borders / glows intentionally sit on colored surfaces.
        if (kind2 === 'background') {
            if (a >= 1) return '#202124';
            if (a >= 0.5) return rgbaText(30, 31, 34, a);
            // translucent white surfaces become subtle dark-mode tints, not bright grey
            return rgbaText(255, 255, 255, a === 0 ? 0 : Math.max(0.02, a * 0.15));
        }
        return KEEP;
    }
    if (kind === 'warm-white') {
        if (kind2 === 'background' || kind2 === 'custom') {
            if (a >= 0.9) return '#202124';
            if (a >= 0.5) return rgbaText(30, 31, 34, a);
            return rgbaText(255, 255, 255, Math.max(0.02, a * 0.28));
        }
        if (kind2 === 'color') return rgbaText(236, 232, 228, a);
        return rgbaText(255, 255, 255, Math.min(0.3, a * 0.5));
    }
    if (kind === 'light-border') {
        if (a >= 1) return rgbaText(255, 255, 255, 0.32);
        return rgbaText(255, 255, 255, Math.min(0.3, a * 0.7));
    }
    if (kind === 'dark-warm') {
        if (kind2 === 'background' || kind2 === 'custom') return KEEP; // dark chips stay dark
        if (a >= 0.55) return rgbaText(236, 232, 228, a);
        if (kind2 === 'border') return rgbaText(255, 255, 255, Math.min(0.22, a * 1.4));
        return rgbaText(0, 0, 0, Math.min(0.55, a * 2.4));
    }
    if (kind === 'neutral-dark') {
        return KEEP; // dark chips remain valid surfaces in dark mode
    }
    if (kind === 'cool-dark') {
        if (kind2 === 'shadow' || kind2 === 'background' || kind2 === 'other') {
            return rgbaText(0, 0, 0, Math.min(0.55, a * 1.6));
        }
        if (a < 1 && a >= 0.5) return rgbaText(236, 232, 228, a);
        return KEEP;
    }
    // saturated: brand-family oranges map to the dark-theme brand accent
    const hsl = rgbToHsl(r, g, b);
    if (hsl.h >= 8 && hsl.h <= 30 && hsl.s >= 0.3 && hsl.s <= 0.65 && hsl.l >= 0.4 && hsl.l <= 0.68) {
        return rgbaText(214, 143, 121, a);
    }
    // other saturated colors: brighten mid tones for dark surfaces
    let l = hsl.l;
    if (l < 0.3) l = Math.min(0.75, l + 0.2);
    else if (l <= 0.6) l = Math.min(0.78, l + 0.14);
    else l = Math.min(0.85, l + 0.05);
    const mapped = hslToRgb(hsl.h, hsl.s, l);
    return rgbaText(mapped.r, mapped.g, mapped.b, a);
}

const COLOR_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*(?:0?\.\d+|1|0)\s*)?\)|\bwhite\b/g;
const URL_STROKE_RE = /%23([0-9a-fA-F]{6})\b/g;

// CSS named colors actually used by the light stylesheets; parsed as full-alpha
// channels so they flow through the same dark mapping as hex literals.
const NAMED_CHANNELS = { white: { r: 255, g: 255, b: 255, a: 1 } };
function normalizeLiteral(text) {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

function mapLiteral(raw) {
    const key = normalizeLiteral(raw);
    if (Object.prototype.hasOwnProperty.call(MANUAL_MAP, key)) {
        let mapped = MANUAL_MAP[key];
        if (mapped && typeof mapped === 'object') {
            mapped = currentProp === 'color' ? mapped.color : mapped.default;
        }
        return mapped === KEEP ? null : mapped;
    }
    let c;
    if (raw.startsWith('#')) c = parseHexChannels(raw);
    else if (NAMED_CHANNELS[raw]) c = NAMED_CHANNELS[raw];
    else {
        const parts = raw.replace(/rgba?\(|\)/g, '').split(',').map((part) => part.trim());
        c = {
            r: parseInt(parts[0], 10),
            g: parseInt(parts[1], 10),
            b: parseInt(parts[2], 10),
            a: parts.length > 3 && parts[3] !== '' ? parseFloat(parts[3]) : 1
        };
    }
    const mappedChannels = mapColorChannels(c, currentProp);
    return mappedChannels === KEEP ? null : mappedChannels;
}

let currentProp = '';

function mapDeclaration(decl) {
    const colon = decl.indexOf(':');
    if (colon <= 0) return null;
    currentProp = decl.slice(0, colon);
    const value = decl.slice(colon + 1);
    let changed = false;
    const mappedValue = value
        .replace(COLOR_RE, (raw) => {
            const mapped = mapLiteral(raw);
            if (mapped === null || mapped === undefined) return raw;
            changed = true;
            return mapped;
        })
        .replace(URL_STROKE_RE, (_raw, hex) => {
            const mapped = mapLiteral(`#${hex}`);
            if (mapped === null || mapped === undefined) return _raw;
            changed = true;
            const channels = mapped.startsWith('#')
                ? parseHexChannels(mapped)
                : null;
            if (channels) return `%23${mapped.slice(1).toUpperCase()}`;
            const rgba = mapped.match(/rgba?\(([^)]+)\)/);
            if (rgba && rgba[1].split(',').length === 3) {
                changed = true;
                const [rr, gg, bb] = rgba[1].split(',').map((v) => parseInt(v.trim(), 10));
                return `%23${[rr, gg, bb].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
            }
            return _raw;
        });
    if (!changed) return null;
    return emitDeclaration(currentProp, mappedValue);
}


/* Mirroring a `background:` shorthand under a higher-specificity dark selector
 * resets longhands (repeat/position/size/clip) that light rules declare separately
 * (e.g. select chevrons tile into a wavy row; background-clip:text is lost).
 * Emit pure-color values as background-color and pure-image values as
 * background-image so the light longhands keep applying in dark mode. */
function stripImageSegments(value) {
    let out = '';
    let i = 0;
    while (i < value.length) {
        const m = /url\(|gradient\(/.exec(value.slice(i));
        if (!m) {
            out += value.slice(i);
            break;
        }
        const start = i + m.index;
        out += value.slice(i, start);
        let depth = 1;
        let j = start + m[0].length;
        while (j < value.length && depth > 0) {
            if (value[j] === '(') depth += 1;
            else if (value[j] === ')') depth -= 1;
            j += 1;
        }
        i = j;
    }
    return out;
}

function emitDeclaration(prop, mappedValue) {
    const trimmedProp = prop.trim();
    const trimmedValue = mappedValue.trim();
    if (trimmedProp !== 'background') return `${trimmedProp}:${trimmedValue}`;
    const residue = stripImageSegments(trimmedValue);
    const hasImage = residue !== trimmedValue;
    const hasStandaloneColor = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b|rgba?\(|\bwhite\b/.test(residue);
    if (hasImage && !hasStandaloneColor) return `background-image:${trimmedValue}`;
    if (!hasImage) return `background-color:${trimmedValue}`;
    return `${trimmedProp}:${trimmedValue}`;
}
/* ---------- minimal CSS rule walker ---------- */

function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractRules(css) {
    const rules = [];
    const stack = [];
    let buf = '';
    for (let i = 0; i < css.length; i += 1) {
        const ch = css[i];
        if (ch === '{') {
            const prelude = buf.trim();
            buf = '';
            if (/^@(?:media|supports)\b/i.test(prelude)) {
                stack.push({ type: 'at', prelude });
            } else if (/^@(?:keyframes|-webkit-keyframes|font-face|page|layer)\b/i.test(prelude)) {
                stack.push({ type: 'skip' });
            } else {
                stack.push({ type: 'rule', selector: prelude });
            }
        } else if (ch === '}') {
            const frame = stack.pop();
            buf = '';
            if (!frame) continue;
            if (frame.type === 'rule') {
                const media = stack.filter((f) => f.type === 'at').map((f) => f.prelude);
                rules.push({ media: media.join(' && '), selector: frame.selector, body: frame.body || '' });
            }
            if (frame.type === 'rule' || frame.type === 'skip') {
                // body already captured below via buf trick; nothing else to do
            }
        } else if (ch === ';') {
            const top = stack[stack.length - 1];
            if (top && top.type === 'rule') {
                top.body = (top.body || '') + buf + ';';
                buf = '';
            } else {
                buf = '';
            }
        } else {
            buf += ch;
        }
    }
    return rules;
}

/* ---------- main ---------- */

function prefixSelector(selector) {
    return selector
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (part === ':root' ? ':root[data-theme="dark"]' : `[data-theme="dark"] ${part}`))
        .join(',\n');
}

const order = readStylesheetOrder();
const groups = new Map(); // key: media || '', value: Map(selector -> decls[])
for (const name of order) {
    const css = stripComments(fs.readFileSync(path.join(STYLES_DIR, name), 'utf8'));
    for (const rule of extractRules(css)) {
        if (!rule.selector || /@(?:import|charset|keyframes|font-face)/i.test(rule.selector)) continue;
        if (SKIP_SELECTORS.some((re) => re.test(rule.selector))) continue;
        const decls = rule.body.split(';').map((d) => d.trim()).filter(Boolean);
        const mappedDecls = decls.map(mapDeclaration).filter(Boolean);
        if (!mappedDecls.length) continue;
        const mediaKey = rule.media || '';
        if (!groups.has(mediaKey)) groups.set(mediaKey, new Map());
        const bySelector = groups.get(mediaKey);
        if (!bySelector.has(rule.selector)) bySelector.set(rule.selector, []);
        bySelector.get(rule.selector).push(...mappedDecls);
    }
}

let generated = '';
for (const [mediaKey, bySelector] of groups) {
    const body = [];
    for (const [selector, decls] of bySelector) {
        body.push(`${prefixSelector(selector)} {\n${decls.map((d) => `    ${d};`).join('\n')}\n}`);
    }
    if (mediaKey) {
        generated += `${mediaKey} {\n${body.join('\n')}\n}\n\n`;
    } else {
        generated += `${body.join('\n')}\n\n`;
    }
}

const handTokens = fs.readFileSync(HAND_TOKENS_FILE, 'utf8').trimEnd();

const header = `/*
 * Codex Mate Web UI - dark theme overrides.
 *
 * The token section is hand maintained in web-ui/styles/theme-dark-tokens.css.
 * The component section below is GENERATED - do not edit by hand.
 * Regenerate after changing any stylesheet:
 *   node scripts/generate-dark-theme-css.mjs
 */
`;

const output = `${header}\n${handTokens}\n\n/* ==========================================================================\n   GENERATED COMPONENT OVERRIDES - do not edit by hand\n   ========================================================================== */\n\n${generated.trimEnd()}\n`;

fs.writeFileSync(OUTPUT, output);
process.stdout.write(`wrote ${OUTPUT} (${output.length} bytes)\n`);
