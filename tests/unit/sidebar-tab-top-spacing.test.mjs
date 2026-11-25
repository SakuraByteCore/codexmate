import assert from 'assert';
import postcss from 'postcss';
import { readProjectFile, readBundledWebUiCss } from './helpers/web-ui-source.mjs';

test('sidebar tabs share a consistent top spacing rhythm', () => {
    const html = readProjectFile('web-ui/partials/index/layout-header.html');
    const navigationStyles = readProjectFile('web-ui/styles/navigation-panels.css');
    const titleStyles = readProjectFile('web-ui/styles/titles-cards.css');
    const settingsStyles = readProjectFile('web-ui/styles/settings-panel.css');

    const topbarBlock = navigationStyles.match(/\.main-panel-topbar\s*\{[^}]*\}/);
    const statusBlock = navigationStyles.match(/\.main-panel-topbar \.status-strip\s*\{[^}]*\}/);
    const segmentedBlock = titleStyles.match(/\.segmented-control\s*\{[^}]*\}/);
    const settingsTabsBlock = settingsStyles.match(/\.settings-tab-header\s*\{[^}]*\}/);

    assert.ok(topbarBlock && statusBlock && segmentedBlock && settingsTabsBlock);
    assert.match(topbarBlock[0], /margin:\s*0 -16px 12px;/);
    assert.match(topbarBlock[0], /padding:\s*0 16px 8px;/);
    assert.match(statusBlock[0], /margin-top:\s*8px;/);
    assert.match(statusBlock[0], /margin-bottom:\s*8px;/);
    assert.match(segmentedBlock[0], /margin-bottom:\s*12px;/);
    assert.match(settingsTabsBlock[0], /margin:\s*0 0 12px;/);
    assert.doesNotMatch(html, /session-status-topbar/);
    assert.doesNotMatch(html, /status-strip-placeholder/);
});

test('every topbar spacing override resolves to the same 12px gap', () => {
    const css = postcss.parse(readBundledWebUiCss());
    let overrides = 0;
    css.walkDecls('--panel-top-gap', (declaration) => assert.equal(declaration.value, '12px'));
    assert.match(css.toString(), /--panel-top-gap:\s*12px;/);
    css.walkRules((rule) => {
        if (!rule.selector.endsWith('.main-panel-topbar')) return;
        const margins = rule.nodes.filter((node) => node.type === 'decl' && ['margin', 'margin-bottom', 'margin-block-end'].includes(node.prop));
        if (!margins.length) return;
        assert.ok(margins.at(-1).value.endsWith('var(--panel-top-gap)'), rule.selector);
        overrides += 1;
    });
    assert.equal(overrides, 7, 'base, compact layout and all five responsive overrides must share the gap');
});

test('leading tools do not add margins while session viewport layout remains intact', () => {
    const navigation = readProjectFile('web-ui/styles/navigation-panels.css');
    const features = readProjectFile('web-ui/styles/session-features.css');
    const preview = readProjectFile('web-ui/styles/sessions-preview.css');
    assert.match(navigation, /\.content-wrapper\s*\{[^}]*display:\s*flow-root;/);
    assert.match(features, /#panel-sessions > div > \.session-features,\s*#panel-settings > \.feature-diagnostics\s*\{\s*margin-block-start: 0;/);
    assert.match(features, /#panel-sessions > div > \.session-features > \.feature-toolbar\s*\{\s*padding-block-start: 0;/);
    assert.match(features, /\.session-features\s*\{[^}]*margin: var\(--spacing-sm\) 0;/);
    assert.match(preview, /\.content-wrapper:has\(#panel-sessions:not\(\[style\*="display: none"\]\)\)\s*\{\s*display: flex;\s*flex: 1;/);
});
