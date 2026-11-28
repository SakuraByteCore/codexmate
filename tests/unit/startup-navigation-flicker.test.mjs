import assert from 'assert';
import { readProjectFile } from './helpers/web-ui-source.mjs';

test('startup hides the default dashboard until navigation preferences are restored', () => {
    const app = readProjectFile('web-ui/app.js');
    const header = readProjectFile('web-ui/partials/index/layout-header.html');
    const feedback = readProjectFile('web-ui/styles/feedback.css');

    assert.match(app, /navigationReady:\s*false/);
    assert.match(app, /const preferencesReady = this\.loadWebUiPreferences\(/);
    assert.match(app, /\.finally\(\(\) => \{\s*this\.navigationReady = true;/);
    assert.match(header, /:class="\{ 'navigation-pending': !navigationReady \}"/);
    assert.match(header, /v-if="!navigationReady" class="app-navigation-loading-state"/);
    assert.match(feedback, /\.navigation-pending > \.app-shell\s*\{\s*visibility:\s*hidden;/);
});

test('startup navigation readiness is released even without the preferences loader', () => {
    const app = readProjectFile('web-ui/app.js');
    assert.match(app, /if \(typeof this\.loadWebUiPreferences === 'function'\) \{[\s\S]*?\} else \{\s*this\.navigationReady = true;/);
});

test('prompts loading cannot append the global config placeholder and shrink the page afterward', () => {
    const footer = readProjectFile('web-ui/partials/index/layout-footer.html');
    const condition = footer.match(/v-if="([^"]+)" class="state-message app-loading-state"/)[1];
    const showConfigLoading = new Function('loading', 'mainTab', `return ${condition};`);
    for (const mainTab of ['prompts', 'usage']) {
        assert.strictEqual(showConfigLoading(true, mainTab), false, `${mainTab} must not add a config loading spacer`);
    }
    for (const mainTab of ['config', 'dashboard', 'sessions', 'plugins']) {
        assert.strictEqual(showConfigLoading(true, mainTab), true, `${mainTab} keeps its existing loading state`);
        assert.strictEqual(showConfigLoading(false, mainTab), false);
    }
    assert.match(footer, /v-else-if="initError"/, 'config errors must remain visible');
    const prompts = readProjectFile('web-ui/partials/index/panel-prompts.html');
    assert.match(prompts, /v-if="agentsLoading" class="editor-skeleton"/);
    assert.match(prompts, /v-if="sysPromptLoading" class="editor-skeleton"/);
});
