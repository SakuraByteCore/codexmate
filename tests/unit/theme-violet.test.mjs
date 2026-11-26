import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createThemeMethods } from '../../web-ui/modules/app.methods.theme.mjs';
import { DICT } from '../../web-ui/modules/i18n.dict.mjs';

const require = createRequire(import.meta.url);
const postcss = require('postcss');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const tokensCss = read('web-ui/styles/theme-violet-tokens.css');
const tokens = new Map();
postcss.parse(tokensCss).walkDecls(decl => tokens.set(decl.prop, decl.value));
const surfaces = ['bg', 'surface', 'surface-alt', 'surface-elevated'];
const themes = ['light', 'dark', 'ocean', 'violet'];

// Independent CSS OKLCH decoding checks the emitted tokens, not generator constants.
function linearRgb(value) {
    const match = value.match(/^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)/);
    assert.ok(match, `Expected OKLCH color: ${value}`);
    const lightness = Number(match[1]) / 100;
    const chroma = Number(match[2]);
    const hue = Number(match[3]) * Math.PI / 180;
    const a = chroma * Math.cos(hue), b = chroma * Math.sin(hue);
    const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}

function luminance(name) {
    const [r, g, b] = linearRgb(tokens.get(`--color-${name}`));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first, second) {
    const a = luminance(first), b = luminance(second);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test('all four themes normalize while invalid values retain the light fallback', () => {
    const methods = createThemeMethods();
    for (const theme of themes) assert.equal(methods.normalizeTheme(`  ${theme.toUpperCase()}  `), theme);
    for (const value of ['', 'system', 'invalid', null, {}, 1]) assert.equal(methods.normalizeTheme(value), 'light');
});

test('theme methods keep DOM attributes, render hints and preference writes synchronized', () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const attributes = new Map(), storage = new Map(), saved = [];
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: {
        setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key)
    } } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)
    } });
    try {
        const context = { theme: 'light', ...createThemeMethods(), persistWebUiPreferences: value => saved.push(value) };
        for (const theme of ['violet', 'dark', 'ocean']) {
            context.setTheme(theme);
            assert.equal(attributes.get('data-theme'), theme);
            assert.equal(storage.get('codexmateThemeCache'), theme);
            assert.deepEqual(saved.at(-1), { theme });
        }
        context.setTheme('invalid');
        assert.equal(context.theme, 'light');
        assert.equal(attributes.has('data-theme'), false);
        assert.equal(storage.has('codexmateThemeCache'), false);
        assert.deepEqual(saved.at(-1), { theme: 'light' });
    } finally {
        if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
        else delete globalThis.document;
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
        else delete globalThis.localStorage;
    }
});

test('inline head restores supported caches and tolerates blocked storage', () => {
    const script = read('web-ui/index.html').match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);
    for (const cached of [...themes, 'invalid', null]) {
        const attributes = new Map();
        vm.runInNewContext(script, { localStorage: { getItem: key => {
            assert.equal(key, 'codexmateThemeCache'); return cached;
        } }, document: { documentElement: { setAttribute: (key, value) => attributes.set(key, value) } } });
        assert.equal(attributes.get('data-theme'), cached && themes.includes(cached) && cached !== 'light' ? cached : undefined);
    }
    assert.doesNotThrow(() => vm.runInNewContext(script, { localStorage: { getItem() { throw new Error('blocked'); } } }));
});

test('appearance options expose pressed states and locale labels without changing neighboring toggles', () => {
    const panel = read('web-ui/partials/index/panel-settings.html');
    const section = panel.match(/<section class="settings-card" :aria-label="t\('settings\.theme\.title'\)">[\s\S]*?<\/section>/)?.[0];
    assert.ok(section);
    assert.match(section, /settings-toggle-group settings-theme-options/);
    for (const theme of themes) {
        assert.ok(section.includes(`@click="setTheme('${theme}')"`));
        assert.ok(section.includes(`:aria-pressed="theme === '${theme}'"`));
        for (const code of ['zh', 'zh-tw', 'en', 'ja', 'vi']) assert.ok(DICT[code][`settings.theme.${theme}`]?.trim());
    }
    const css = postcss.parse(read('web-ui/styles/settings-panel.css'));
    const sizing = css.nodes.find(rule => rule.selector === '#panel-settings .settings-theme-options .toggle-btn');
    assert.ok(sizing.nodes.some(decl => decl.prop === 'min-height' && decl.value === '44px'));
    assert.ok(sizing.nodes.some(decl => decl.prop === 'min-width' && decl.value === '44px'));
    const mobile = css.nodes.find(rule => rule.name === 'media' && rule.nodes.some(child => child.selector === '#panel-settings .settings-theme-options'));
    assert.equal(mobile.params, '(max-width: 640px)');
    assert.ok(mobile.nodes[0].nodes.some(decl => decl.prop === 'grid-template-columns' && decl.value === 'repeat(2, minmax(0, 1fr))'));
});

test('violet tokens cover the existing palette and remain in the sRGB gamut', () => {
    const required = new Set();
    postcss.parse(read('web-ui/styles/theme-ocean-tokens.css')).walkDecls(decl => {
        if (decl.prop.startsWith('--') && !decl.prop.startsWith('--color-ocean-wash-')) required.add(decl.prop);
    });
    for (const token of required) assert.ok(tokens.has(token), `Missing token: ${token}`);
    for (const [name, value] of tokens) {
        if (!value.startsWith('oklch(')) continue;
        for (const channel of linearRgb(value)) assert.ok(channel >= 0 && channel <= 1, `${name} is out of gamut: ${channel}`);
    }
    assert.equal(tokens.get('--bg-warm-gradient'), 'var(--color-bg)');
    assert.equal(tokens.get('--shadow-card'), 'none');
});

test('text, semantic status and accent colors meet WCAG AA on every violet surface', () => {
    for (const foreground of ['text-primary', 'text-secondary', 'text-tertiary', 'text-muted', 'brand', 'brand-dark', 'success', 'error', 'warning']) {
        for (const surface of surfaces) assert.ok(contrast(foreground, surface) >= 4.5, `${foreground}/${surface}: ${contrast(foreground, surface).toFixed(3)}:1`);
    }
    for (const foreground of ['brand', 'brand-dark', 'success', 'error', 'warning']) {
        assert.ok(contrast('surface-elevated', foreground) >= 4.5, `On-accent text/${foreground}`);
    }
    for (const border of ['border', 'border-strong']) {
        for (const surface of surfaces) assert.ok(contrast(border, surface) >= 3, `${border}/${surface}`);
    }
});

test('generated violet rules stay scoped, preserve statuses and avoid decorative backgrounds', () => {
    const source = read('web-ui/styles/theme-violet.css');
    const css = postcss.parse(source);
    assert.doesNotMatch(source, /\[data-theme=["'](?:dark|ocean)["']\]/);
    css.walkRules(rule => assert.ok(rule.selector.includes('[data-theme="violet"]'), `Unscoped rule: ${rule.selector}`));
    css.walkDecls(/^background(?:-image)?$/, decl => assert.doesNotMatch(decl.value, /gradient\(/));
    css.walkDecls('box-shadow', decl => assert.equal(decl.value, 'none'));
    const errors = [], successes = [];
    css.walkRules(rule => {
        if (rule.selector.includes('.mobile-update-chip--error')) errors.push(rule.toString());
        if (rule.selector.includes('.mobile-update-chip--current')) successes.push(rule.toString());
    });
    assert.ok(errors.some(rule => rule.includes('var(--color-error)')));
    assert.ok(successes.some(rule => rule.includes('var(--color-success)')));
    assert.match(source, /:focus-visible\s*\{\s*outline: 2px solid var\(--color-brand\)/);
});

test('ocean compatibility and violet artifact match in read-only check mode', t => {
    // Use an isolated fixture: unrelated stale legacy artifacts must not be rewritten.
    const temporaryRoot = path.join(root, '.tmp');
    fs.mkdirSync(temporaryRoot, { recursive: true });
    const fixture = fs.mkdtempSync(path.join(temporaryRoot, 'violet-ocean-'));
    t.after(() => {
        const before = spawnSync('du', ['-sBM', temporaryRoot], { encoding: 'utf8' }).stdout.trim();
        console.log('Rebuildable fixture:', fixture, fs.readdirSync(fixture));
        fs.rmSync(fixture, { recursive: true });
        const after = spawnSync('du', ['-sBM', temporaryRoot], { encoding: 'utf8' }).stdout.trim();
        console.log('Fixture cleanup:', before, '->', after);
        assert.equal(fs.existsSync(fixture), false);
    });
    fs.mkdirSync(path.join(fixture, 'scripts'));
    fs.mkdirSync(path.join(fixture, 'web-ui/styles'), { recursive: true });
    fs.copyFileSync(path.join(root, 'scripts/generate-ocean-theme-css.mjs'), path.join(fixture, 'scripts/generate-ocean-theme-css.mjs'));
    fs.writeFileSync(path.join(fixture, 'web-ui/styles.css'), "@import url('./styles/controls.css');\n@import url('./styles/theme-violet.css');\n");
    fs.writeFileSync(path.join(fixture, 'web-ui/styles/controls.css'), '.sample { color: #C87963; border: 1px solid rgba(137, 111, 94, 0.18); background: rgba(255, 253, 250, 0.86); }');
    fs.copyFileSync(path.join(root, 'web-ui/styles/theme-ocean-tokens.css'), path.join(fixture, 'web-ui/styles/theme-ocean-tokens.css'));
    const generated = spawnSync(process.execPath, ['scripts/generate-ocean-theme-css.mjs'], { cwd: fixture, encoding: 'utf8', timeout: 10000 });
    assert.equal(generated.status, 0, generated.stderr);
    const ocean = fs.readFileSync(path.join(fixture, 'web-ui/styles/theme-ocean.css'), 'utf8');
    assert.match(ocean, /color:rgb\(59, 98, 246\)/);
    assert.match(ocean, /border:1px solid rgba\(159, 195, 232, 0\.18\)/);
    assert.match(ocean, /background-color:rgba\(243, 249, 254, 0\.86\)/);
    assert.doesNotMatch(ocean, /data-theme="violet"/);
    for (const theme of ['ocean', 'violet']) {
        const result = spawnSync(process.execPath, ['scripts/generate-ocean-theme-css.mjs', theme, '--check'], { cwd: theme === 'ocean' ? fixture : root, encoding: 'utf8', timeout: 10000 });
        assert.equal(result.status, 0, result.stderr || result.error?.message);
        assert.match(result.stdout, /verified/);
    }
});

function violetDeclarations(selector) {
    const declarations = new Map();
    postcss.parse(read('web-ui/styles/theme-violet.css')).walkRules(rule => {
        if (rule.selector === selector) rule.walkDecls(decl => declarations.set(decl.prop, decl.value));
    });
    return declarations;
}

test('mini confirmation buttons retain a paired foreground and background after generic mini rules', () => {
    const button = violetDeclarations(':root[data-theme="violet"] .btn-mini.btn-confirm-mini');
    assert.equal(button.get('background-color'), 'var(--color-brand)');
    assert.equal(button.get('color'), 'var(--color-surface-elevated)');
    assert.ok(contrast('surface-elevated', 'brand') >= 4.5);
});

test('flattening preserves the leading paint color and the source semantic action roles', () => {
    const cases = [
        ['.btn-confirm.secondary', 'success'],
        ['.btn-remove-model:hover', 'error'],
        ['.btn-cancel', 'bg'],
        ['.btn-cancel:hover', 'surface-alt'],
        ['.model-list', 'surface']
    ];
    for (const [selector, role] of cases) {
        const declarations = violetDeclarations(`[data-theme="violet"] ${selector}`);
        assert.equal(declarations.get('background-color'), `var(--color-${role})`, selector);
        assert.equal(declarations.get('background-image'), 'none', selector);
    }
});

test('modal overlays use a dark scrim instead of flattening the decorative light wash', () => {
    for (const selector of ['.modal-overlay', '.project-announcement-overlay']) {
        const overlay = violetDeclarations(`[data-theme="violet"] ${selector}`);
        assert.equal(overlay.get('background-color'), 'var(--color-modal-scrim)', selector);
    }
    assert.equal(tokens.get('--color-modal-scrim'), 'color-mix(in oklch, var(--color-text-primary) 48%, transparent)');
});

test('keyframe steps never leak into ordinary theme selectors', () => {
    postcss.parse(read('web-ui/styles/theme-violet.css')).walkRules(rule => {
        assert.doesNotMatch(rule.selector, /\[data-theme="violet"\]\s+(?:\d+(?:\.\d+)?%|from\b|to\b)/);
    });
});


test('clipped sidebar brand text never becomes an opaque dark block', () => {
    const brand = violetDeclarations('[data-theme="violet"] .brand-kicker');
    assert.equal(brand.get('background-color'), 'transparent');
    assert.equal(brand.get('background-image'), 'none');
    assert.equal(brand.get('-webkit-text-fill-color'), 'var(--color-text-primary)');
});
