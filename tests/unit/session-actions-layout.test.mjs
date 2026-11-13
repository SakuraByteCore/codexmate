import assert from 'assert';
import {
    readBundledWebUiCss,
    readBundledWebUiHtml
} from './helpers/web-ui-source.mjs';

test('session preview actions use stable left and right groups', () => {
    const html = readBundledWebUiHtml();
    const styles = readBundledWebUiCss();

    assert.match(html, /class="session-actions session-preview-actions"/);
    assert.match(html, /class="session-secondary-actions"/);
    assert.match(html, /class="session-primary-actions"/);
    assert.match(html, /class="btn-session-export has-label"/);
    assert.match(html, /class="btn-session-delete has-label session-delete-text-button"/);

    const outer = styles.match(/#panel-sessions \.session-preview-actions\s*\{[^}]*\}/);
    const left = styles.match(/#panel-sessions \.session-secondary-actions\s*\{[^}]*\}/);
    const right = styles.match(/#panel-sessions \.session-primary-actions\s*\{[^}]*\}/);

    assert.ok(outer && left && right);
    assert.match(outer[0], /display:\s*flex;/);
    assert.match(outer[0], /justify-content:\s*space-between;/);
    assert.match(outer[0], /flex-wrap:\s*nowrap;/);
    assert.match(left[0], /min-width:\s*0;/);
    assert.match(left[0], /overflow:\s*hidden;/);
    assert.match(left[0], /gap:\s*8px;/);
    assert.match(right[0], /flex-shrink:\s*0;/);
    assert.match(right[0], /gap:\s*16px;/);
});

test('session preview action labels collapse inside narrow preview container', () => {
    const html = readBundledWebUiHtml();
    const styles = readBundledWebUiCss();

    assert.match(html, /session-action-optional-text/);
    assert.match(styles, /@container session-preview \(max-width:\s*620px\)/);
    assert.match(styles, /\.session-action-optional-text\s*\{\s*display:\s*none;/);
    assert.match(styles, /\.session-action-optional-label\s*\{[^}]*width:\s*32px;[^}]*padding:\s*0;/);
});
