import assert from 'assert';
import {
    readBundledWebUiCss,
    readBundledWebUiHtml
} from './helpers/web-ui-source.mjs';
import { parseSessionTitleInfo as parseTitle } from '../../web-ui/logic.sessions.mjs';


test('session title parser extracts skill name and location attributes', () => {
    assert.deepStrictEqual(
        parseTitle({
            title: '<skill name="electron-debug" location="C:/Users/test/.agents/skills/electron-debug/SKILL.md"></skill>',
            cwd: 'C:/workspace'
        }),
        {
            title: 'electron-debug',
            location: 'C:/Users/test/.agents/skills/electron-debug/SKILL.md'
        }
    );
});

test('session title parser preserves normal titles and uses cwd as fallback location', () => {
    assert.deepStrictEqual(
        parseTitle({ title: '普通会话', cwd: 'C:/workspace/project' }),
        { title: '普通会话', location: 'C:/workspace/project' }
    );
});

test('session browser renders parsed title and single-line location tooltip', () => {
    const html = readBundledWebUiHtml();
    const styles = readBundledWebUiCss();

    assert.match(html, /class="session-item-heading"/);
    assert.match(html, /class="session-item-title">\{\{ parseSessionTitleInfo\(session\)\.title/);
    assert.match(html, /class="session-item-location" :title="parseSessionTitleInfo\(session\)\.location"/);
    assert.doesNotMatch(html, /class="session-item-cwd session-item-sub"/);

    const locationBlock = styles.match(/\.session-item-location\s*\{[^}]*\}/);
    assert.ok(locationBlock, 'missing session item location style block');
    assert.match(locationBlock[0], /white-space:\s*nowrap;/);
    assert.match(locationBlock[0], /overflow:\s*hidden;/);
    assert.match(locationBlock[0], /text-overflow:\s*ellipsis;/);
});

test('session export action is emphasized without a range selector', () => {
    const html = readBundledWebUiHtml();
    const styles = readBundledWebUiCss();
    const buttonBlock = styles.match(/#panel-sessions \.session-primary-actions \.btn-session-export\s*\{[^}]*\}/);

    assert.doesNotMatch(html, /id="session-export-range"/);
    assert.doesNotMatch(html, /v-model="sessionExportRange"/);
    assert.ok(buttonBlock, 'missing session export button style block');
    assert.match(styles, /#panel-sessions \.session-preview-actions button\s*\{[^}]*height:\s*32px;/);
    assert.match(buttonBlock[0], /background:\s*var\(--color-brand\);/);
    assert.match(buttonBlock[0], /font-weight:\s*600;/);
});
