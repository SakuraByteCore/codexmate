#!/usr/bin/env node
/**
 * Generate web-ui/styles/theme-ocean.css
 *
 * The ocean light theme re-uses the existing light component rules and only
 * re-colours the hardcoded warm palette literals, so every element in the UI
 * follows the ocean palette without touching the light/dark stylesheets.
 *
 * Source of the background layer: dafy-whale-theme (MIT), see
 * web-ui/styles/theme-ocean-tokens.css for attribution.
 *
 * Regenerate with:
 *   node scripts/generate-ocean-theme-css.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STYLES_DIR = path.join(ROOT, 'web-ui', 'styles');
const ENTRY = path.join(ROOT, 'web-ui', 'styles.css');
const OUTPUT = path.join(STYLES_DIR, 'theme-ocean.css');
const HAND_TOKENS_FILE = path.join(STYLES_DIR, 'theme-ocean-tokens.css');

const SKIP_FILES = new Set(['base-theme.css', 'theme-dark.css', 'theme-dark-tokens.css', 'theme-ocean.css', 'theme-ocean-tokens.css']);

/* ---------- palette map: warm light literal -> ocean literal ---------- */
/* rgb triple (no alpha) -> rgb triple; alpha is preserved. */
const OCEAN_MAP = {
    // brand orange family -> ocean blue
    '200,121,99': '59,98,246',
    '210,107,90': '43,80,214',
    '201,94,75': '37,74,200',
    '208,88,58': '30,60,170',
    '217,119,87': '52,90,230',
    '199,86,66': '43,80,214',
    '193,72,59': '35,68,190',
    '176,58,46': '30,60,170',
    '163,51,38': '26,52,150',
    '200,74,58': '43,80,214',
    '196,69,54': '40,76,206',
    '189,70,68': '38,72,200',
    '203,75,75': '40,76,206',
    '181,74,58': '43,80,214',
    '181,90,58': '43,80,214',
    '159,57,44': '30,60,170',
    '143,45,33': '30,60,170',
    // warm greys / browns (borders + tints) -> ocean blue borders
    '137,111,94': '159,195,232',
    '163,146,134': '198,220,242',
    '216,201,184': '214,232,250',
    '210,180,160': '214,232,250',
    '208,196,182': '214,232,250',
    '160,145,130': '198,220,242',
    '139,118,104': '198,220,242',
    '141,91,49': '96,72,30',
    // warm shadows -> cool blue shadows
    '92,68,52': '16,48,92',
    '68,52,39': '16,48,92',
    '50,38,30': '12,36,70',
    '31,26,23': '12,36,70',
    '36,31,28': '12,36,70',
    '27,23,20': '12,36,70',
    '43,37,33': '12,36,70',
    '20,16,12': '12,36,70',
    '45,45,47': '20,52,104',
    '29,29,31': '14,42,92',
    // neutrals
    '142,142,147': '71,106,144',
    '127,127,127': '90,108,132',
    '250,250,250': '238,244,250',
    // cream surfaces -> ocean surfaces
    '255,252,248': '243,249,254',
    '251,247,244': '243,249,254',
    '255,253,252': '243,249,254',
    '255,250,246': '243,249,254',
    '255,251,247': '243,249,254',
    '252,248,241': '243,249,254',
    '250,246,241': '243,249,254',
    '249,244,239': '243,249,254',
    '255,253,250': '243,249,254',
    '255,248,241': '233,243,252',
    '255,243,236': '243,238,252',
    '247,240,233': '233,243,252',
    '247,241,232': '233,243,252',
    '246,240,232': '233,243,252',
    '247,239,232': '233,243,252',
    '247,239,231': '226,238,250'
};

/* Reverse index of mapped targets so the leftover report ignores them. */
const OCEAN_TARGETS = new Set(Object.values(OCEAN_MAP));

/* Semantic status colors (errors / warnings / pinks) intentionally kept. */
const SEMANTIC_KEEP = new Set([
    '220,95,108',
    '138,47,54',
    '246,211,106',
    '250,112,154',
    '111,75,0',
    '214,51,83',
    '254,225,64',
    '232,93,117',
    '255,159,10',
    '191,151,40',
    '254,242,242',
    '255,215,208',
    '183,69,69',
    '159,59,59',
    '217,119,6',
    '180,83,9',
    '194,65,12',
    '238,178,90',
    '255,236,204',
    '255,232,220',
    '141,91,49'
]);

const COLOR_RE = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b|rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*(?:0?\.\d+|1|0)\s*)?\)|\bwhite\b/g;

function readStylesheetOrder() {
    const source = fs.readFileSync(ENTRY, 'utf8');
    const imports = [...source.matchAll(/@import\s+url\(['"]?\.\/styles\/([^'")]+)['"]?\)/g)]
        .map((match) => match[1]);
    if (!imports.length) throw new Error('no stylesheet imports found in web-ui/styles.css');
    return imports.filter((name) => !SKIP_FILES.has(name));
}

function parseChannels(text) {
    const raw = text.trim().toLowerCase();
    if (raw === 'white') return { r: 255, g: 255, b: 255, a: 1 };
    const short = raw.match(/^#([0-9a-f]{3})$/);
    if (short) {
        const s = short[1].split('').map((c) => c + c).join('');
        return { r: parseInt(s.slice(0, 2), 16), g: parseInt(s.slice(2, 4), 16), b: parseInt(s.slice(4, 6), 16), a: 1 };
    }
    const long = raw.match(/^#([0-9a-f]{6})$/);
    if (long) {
        return {
            r: parseInt(long[1].slice(0, 2), 16),
            g: parseInt(long[1].slice(2, 4), 16),
            b: parseInt(long[1].slice(4, 6), 16),
            a: 1
        };
    }
    const rgb = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/);
    if (!rgb) return null;
    return {
        r: Number(rgb[1]),
        g: Number(rgb[2]),
        b: Number(rgb[3]),
        a: rgb[4] === undefined ? 1 : Number(rgb[4])
    };
}

function channelsToText(c) {
    const alpha = Math.round(c.a * 100) / 100;
    if (alpha >= 1) return `rgb(${c.r}, ${c.g}, ${c.b})`;
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

function mapLiteral(raw) {
    const channels = parseChannels(raw);
    if (!channels) return null;
    const key = `${channels.r},${channels.g},${channels.b}`;
    const mapped = OCEAN_MAP[key];
    if (!mapped) return null;
    const [r, g, b] = mapped.split(',').map((v) => Number(v));
    return channelsToText({ r, g, b, a: channels.a });
}

function mapDeclaration(decl) {
    const colon = decl.indexOf(':');
    if (colon <= 0) return null;
    const prop = decl.slice(0, colon);
    const value = decl.slice(colon + 1);
    let changed = false;
    const mappedValue = value.replace(COLOR_RE, (raw) => {
        const mapped = mapLiteral(raw);
        if (!mapped) return raw;
        changed = true;
        return mapped;
    });
    if (!changed) return null;
    return emitDeclaration(prop, mappedValue);
}

/* Mirroring a `background:` shorthand resets longhands declared separately,
 * so pure colors are emitted as background-color and pure images as
 * background-image, keeping the light longhands intact. */
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

function prefixSelector(selector) {
    return selector
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => (part === ':root' ? ':root[data-theme="ocean"]' : `[data-theme="ocean"] ${part}`))
        .join(',\n');
}

const order = readStylesheetOrder();
const groups = new Map();
const unmapped = new Map();
for (const name of order) {
    const css = stripComments(fs.readFileSync(path.join(STYLES_DIR, name), 'utf8'));
    for (const rule of extractRules(css)) {
        if (!rule.selector || /@(?:import|charset|keyframes|font-face)/i.test(rule.selector)) continue;
        const decls = rule.body.split(';').map((d) => d.trim()).filter(Boolean);
        const mappedDecls = [];
        for (const decl of decls) {
            const mapped = mapDeclaration(decl);
            if (mapped) {
                mappedDecls.push(mapped);
                continue;
            }
            for (const raw of decl.match(COLOR_RE) || []) {
                const channels = parseChannels(raw);
                if (!channels) continue;
                const key = `${channels.r},${channels.g},${channels.b}`;
                if (OCEAN_MAP[key]) continue;
                if (OCEAN_TARGETS.has(key)) continue;
                if (SEMANTIC_KEEP.has(key)) continue;
                if (channels.r - channels.b < 3) continue;
                if (channels.r - channels.b < 8 && Math.min(channels.r, channels.g, channels.b) < 240) continue;
                unmapped.set(key, (unmapped.get(key) || 0) + 1);
            }
        }
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
 * Codex Mate Web UI - ocean light theme overrides.
 *
 * The token section is hand maintained in web-ui/styles/theme-ocean-tokens.css.
 * The component section below is GENERATED - do not edit by hand.
 * Regenerate after changing any stylesheet:
 *   node scripts/generate-ocean-theme-css.mjs
 */
`;

const output = `${header}\n${handTokens}\n\n/* ==========================================================================
   GENERATED COMPONENT OVERRIDES - do not edit by hand
   ========================================================================== */\n\n${generated.trimEnd()}\n`;
fs.writeFileSync(OUTPUT, output);
process.stdout.write(`wrote ${OUTPUT} (${output.length} bytes)\n`);
if (unmapped.size) {
    process.stdout.write('warm literals without an ocean mapping (kept as-is):\n');
    for (const [key, count] of [...unmapped.entries()].sort((a, b) => b[1] - a[1])) {
        process.stdout.write(`  ${key} x${count}\n`);
    }
}
