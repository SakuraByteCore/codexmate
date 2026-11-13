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
