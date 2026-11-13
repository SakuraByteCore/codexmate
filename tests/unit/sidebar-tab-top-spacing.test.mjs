import assert from 'assert';
import { readProjectFile } from './helpers/web-ui-source.mjs';

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
