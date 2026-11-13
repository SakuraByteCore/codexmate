import assert from 'assert';
import { readProjectFile } from './helpers/web-ui-source.mjs';

test('trash panel uses an adaptive vertical flow layout', () => {
    const styles = readProjectFile('web-ui/styles/trash-panel.css');
    const shell = styles.match(/\.trash-panel-shell\s*\{[^}]*\}/);

    assert.ok(shell);
    assert.match(shell[0], /width:\s*min\(100%, 1480px\);/);
    assert.match(shell[0], /margin:\s*0;/);
    assert.match(shell[0], /padding:\s*0 0 32px;/);
    assert.match(shell[0], /display:\s*flex;/);
    assert.match(shell[0], /flex-direction:\s*column;/);
    assert.match(shell[0], /gap:\s*16px;/);
    assert.doesNotMatch(shell[0], /grid-template-columns:/);
});

test('trash configuration and content modules stay in one vertical flow', () => {
    const html = readProjectFile('web-ui/partials/index/panel-trash.html');
    const styles = readProjectFile('web-ui/styles/trash-panel.css');

    assert.match(html, /class="settings-card trash-config-card"/);
    assert.match(html, /class="trash-content-section"/);
    assert.match(styles, /\.trash-content-section\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;[^}]*gap:\s*14px;/);
    assert.match(styles, /\.trash-config-card \.settings-toggle-row\s*\{[^}]*justify-content:\s*space-between;/);
    assert.match(styles, /\.trash-config-card \.settings-retention\s*\{[^}]*width:\s*100%;[^}]*justify-content:\s*space-between;/);
    assert.match(styles, /\.trash-empty-state\s*\{[^}]*min-height:\s*240px;[^}]*padding:\s*40px 24px;/);
    assert.match(styles, /\.trash-toolbar\s*\{[^}]*padding:\s*0 0 12px;[^}]*margin-bottom:\s*0;/);
});
