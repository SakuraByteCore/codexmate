import assert from 'assert';
import {
    readBundledWebUiCss,
    readBundledWebUiHtml
} from './helpers/web-ui-source.mjs';
import { captureCurrentBundledAppOptions } from './helpers/web-ui-app-options.mjs';
import { createI18nMethods } from '../../web-ui/modules/i18n.mjs';

test('sidebar language menu toggles and applies selected language', () => {
    const methods = createI18nMethods();
    const calls = [];
    const context = {
        languageMenuOpen: false,
        lang: 'zh',
        setLang(next) {
            calls.push(next);
            this.lang = next;
        }
    };

    methods.toggleLanguageMenu.call(context);
    assert.strictEqual(context.languageMenuOpen, true);
    methods.selectLanguage.call(context, 'en');
    assert.deepStrictEqual(calls, ['en']);
    assert.strictEqual(context.languageMenuOpen, false);
});

test('sidebar language menu closes when focus leaves the dropdown', () => {
    const methods = createI18nMethods();
    const context = { languageMenuOpen: true };
    const parent = { contains: () => false };

    methods.handleLanguageMenuFocusOut.call(context, { currentTarget: parent, relatedTarget: {} });
    assert.strictEqual(context.languageMenuOpen, false);
});

test('sidebar exposes an accessible language dropdown menu', () => {
    const html = readBundledWebUiHtml();
    const styles = readBundledWebUiCss();

    assert.match(html, /class="side-language-menu"/);
    const trigger = html.match(/<div class="side-language-menu">[\s\S]*?<\/button>/);
    assert.ok(trigger, 'sidebar language trigger must exist');
    assert.match(trigger[0], /@keydown\.esc\.prevent="closeLanguageMenu">\s*\{\{ currentLanguageLabel\(\) \}\}/);
    assert.doesNotMatch(trigger[0], /\{\{ t\('settings\.language\.sideLabel'/);
    assert.match(trigger[0], /:aria-label="t\('settings\.language\.sideLabel', \{ language: currentLanguageLabel\(\) \}\)"/);
    assert.match(html, /:aria-expanded="languageMenuOpen \? 'true' : 'false'"/);
    assert.match(html, /aria-haspopup="menu"/);
    assert.match(html, /class="side-language-dropdown" role="menu"/);
    assert.match(html, /role="menuitemradio"/);
    assert.match(styles, /\.side-language-dropdown\s*\{[^}]*position:\s*absolute;[^}]*bottom:\s*calc\(100% \+ 8px\);/);
    assert.match(styles, /\.side-language-menu\s*\{[^}]*display:\s*flex;[^}]*justify-content:\s*center;/);
    assert.match(styles, /\.side-rail-lang \.language-settings-link\s*\{[^}]*width:\s*fit-content;[^}]*margin-inline:\s*auto;/);
    assert.match(styles, /\.side-language-option\s*\{[^}]*min-height:\s*36px;/);
});

test('session source pills use the shared top spacing rhythm', () => {
    const styles = readBundledWebUiCss();

    assert.match(styles, /\.session-selector-section\s*\{[^}]*padding:\s*0 10px 8px;[^}]*gap:\s*0;/);
});

test('sidebar stays collapsed without a collapse or expand control', async () => {
    const options = await captureCurrentBundledAppOptions();
    const html = readBundledWebUiHtml();
    assert.strictEqual(options.data().sidebarCollapsed, true);
    assert.match(html, /:class="\['app-shell', 'sidebar-collapsed', \{ standalone: sessionStandalone \}\]"/);
    assert.doesNotMatch(html, /side-rail-collapse-toggle|@click="toggleSidebarCollapsed"/);
    assert.doesNotMatch(html, /'sidebar-collapsed': sidebarCollapsed/);
    assert.match(html, /class="side-rail" v-if="!sessionStandalone"/);
    assert.match(html, /@click="onMainTabClick\('dashboard', \$event\)"/);
});
