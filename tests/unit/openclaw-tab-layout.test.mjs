import assert from 'assert';
import { createRequire } from 'module';
import { readProjectFile } from './helpers/web-ui-source.mjs';

const require = createRequire(import.meta.url);
const postcss = require('postcss');
const sourceBundle = require('../../web-ui/source-bundle.cjs');
const panel = readProjectFile('web-ui/partials/index/panel-config-openclaw.html');
const css = readProjectFile('web-ui/styles/openclaw-structured.css');
const tabStyles = css.slice(css.indexOf('/* Keep OpenClaw layout isolated'));

function declarations(selector) {
    let result;
    postcss.parse(tabStyles).walkRules(rule => {
        if (!rule.parent.type || rule.parent.type !== 'root' || rule.selector !== selector) return;
        result = Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
    });
    assert(result, `missing tab selector: ${selector}`);
    return result;
}

test('OpenClaw tab names each section and removes repeated file decoration', () => {
    for (const id of ['openclaw-summary-title', 'openclaw-workspace-title', 'openclaw-configs-title']) {
        assert(panel.includes(`id="${id}"`), `missing heading: ${id}`);
        assert(panel.includes(`aria-labelledby="${id}"`), `missing section label: ${id}`);
    }
    assert(panel.includes("t('openclaw.workspaceFile')"));
    assert(!panel.includes('Workspace file'));
    assert(!panel.includes('📄'));
    assert(!panel.includes('summary-note'));
    assert(panel.includes('v-if="agentsLoading" class="tool-meta"'));
    assert(panel.includes("getOpenclawStatusSummaryItems()"));
});

test('OpenClaw styles remain scoped with wrapping, selection and accessible controls', () => {
    const parsed = postcss.parse(tabStyles);
    parsed.walkRules(rule => assert(rule.selector.startsWith('#panel-config-openclaw '), `unscoped selector: ${rule.selector}`));
    assert.strictEqual(declarations('#panel-config-openclaw .openclaw-summary-item').background, 'transparent');
    assert.strictEqual(declarations('#panel-config-openclaw .openclaw-tools-grid')['grid-template-columns'], 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))');
    assert.strictEqual(declarations('#panel-config-openclaw .openclaw-card-list')['grid-template-columns'], 'minmax(0, 1fr)');
    assert.strictEqual(declarations('#panel-config-openclaw .card-action-btn').width, '44px');
    assert.strictEqual(declarations('#panel-config-openclaw .card-action-btn').height, '44px');
    assert.strictEqual(declarations('#panel-config-openclaw .summary-item-value')['overflow-wrap'], 'anywhere');
    assert(tabStyles.includes(':focus-visible'));
    assert(tabStyles.includes('.card.active:hover:not(.disabled)'));
    assert(tabStyles.includes('@media (max-width: 520px)'));
    assert(tabStyles.includes('@media (prefers-reduced-motion: reduce)'));
    assert(!tabStyles.includes('linear-gradient'));
    assert(!/:is\([^)]*::/.test(tabStyles));
});

test('served precompiled template matches the current OpenClaw markup', () => {
    assert.strictEqual(sourceBundle.readPrecompiledWebUiRenderScript(), sourceBundle.compileWebUiTemplateToRenderScript());
});

test('OpenClaw permission card inherits the same surface as adjacent config tabs', () => {
    assert.deepStrictEqual(declarations('#panel-config-openclaw .tool-config-write-card'), { margin: '0' });
    for (const name of ['claude', 'opencode', 'pi']) {
        const neighbor = readProjectFile(`web-ui/partials/index/panel-config-${name}.html`);
        assert(neighbor.includes('class="tool-config-write-card"'));
    }
});

test('OpenClaw section typography and spacing reuse the shared control scale', () => {
    for (const selector of ['#panel-config-openclaw .summary-title', '#panel-config-openclaw .openclaw-section-title']) {
        const styles = declarations(selector);
        assert.strictEqual(styles['font-size'], 'var(--font-size-secondary)');
        assert.strictEqual(styles['font-weight'], 'var(--font-weight-secondary)');
        assert.strictEqual(styles.color, 'var(--color-text-secondary)');
    }
    assert.strictEqual(declarations('#panel-config-openclaw .openclaw-layout').gap, 'var(--spacing-sm)');
    assert.strictEqual(declarations('#panel-config-openclaw .tool-config-write-body').gap, 'var(--spacing-md)');
    assert.strictEqual(declarations('#panel-config-openclaw .tool-title')['font-family'], 'var(--font-family-body)');
});

test('OpenClaw config cards share boundaries and use two columns only on wide screens', () => {
    const styles = declarations('#panel-config-openclaw .openclaw-card-list .card');
    assert.strictEqual(styles.border, '1px solid var(--color-border-soft)');
    assert.strictEqual(styles['border-radius'], 'var(--radius-md)');
    assert(panel.includes('<div class="card-icon">{{ name.charAt(0).toUpperCase() }}</div>'));
    let desktopColumns;
    postcss.parse(tabStyles).walkAtRules('media', rule => {
        if (rule.params !== '(min-width: 960px)') return;
        rule.walkRules(child => {
            if (child.selector === '#panel-config-openclaw .openclaw-card-list') {
                desktopColumns = child.nodes.find(node => node.prop === 'grid-template-columns').value;
            }
        });
    });
    assert.strictEqual(desktopColumns, 'repeat(2, minmax(0, 1fr))');
    assert(!tabStyles.includes('.card-icon {'));
});
