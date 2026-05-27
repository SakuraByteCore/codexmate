import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { withGlobalOverrides } from './helpers/web-ui-app-options.mjs';
import { readBundledWebUiScript } from './helpers/web-ui-source.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const {
    buildSessionsFilterShareUrl,
    installWebUiUrlCanonicalization,
    normalizeCurrentWebUiUrl
} = await import(pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'sessions-filters-url.mjs')));

function createLocationHarness(href) {
    const state = { href };
    return {
        window: {
            get location() {
                return new URL(state.href);
            },
            history: {
                replaceState(_state, _title, nextUrl) {
                    state.href = new URL(String(nextUrl), state.href).href;
                },
                pushState(_state, _title, nextUrl) {
                    state.href = new URL(String(nextUrl), state.href).href;
                }
            }
        },
        state
    };
}

test('normalizeCurrentWebUiUrl removes stale /web-ui/index.html from the address bar', async () => {
    const harness = createLocationHarness('http://127.0.0.1:3737/web-ui/index.html?tab=sessions#panel');

    await withGlobalOverrides({ window: harness.window }, async () => {
        const url = normalizeCurrentWebUiUrl();
        assert.strictEqual(url.href, 'http://127.0.0.1:3737/?tab=sessions#panel');
    });

    assert.strictEqual(harness.state.href, 'http://127.0.0.1:3737/?tab=sessions#panel');
});

test('history canonicalization guard rejects future /web-ui/index.html writes', async () => {
    const harness = createLocationHarness('http://127.0.0.1:3737/');

    await withGlobalOverrides({ window: harness.window }, async () => {
        assert.strictEqual(installWebUiUrlCanonicalization(), true);
        window.history.replaceState(null, '', '/web-ui/index.html?tab=config');
        assert.strictEqual(harness.state.href, 'http://127.0.0.1:3737/?tab=config');
        window.history.pushState(null, '', '/web-ui/index.html?tab=settings#data');
        assert.strictEqual(harness.state.href, 'http://127.0.0.1:3737/?tab=settings#data');
    });
});

test('session filter URL sync does not reintroduce /web-ui/index.html', async () => {
    const harness = createLocationHarness('http://127.0.0.1:3737/web-ui/index.html?tab=sessions');
    const vm = {
        sessionFilterSource: 'codex',
        sessionPathFilter: '/tmp/project',
        sessionQuery: 'hello',
        sessionRoleFilter: 'assistant',
        sessionTimePreset: '7d'
    };

    await withGlobalOverrides({ window: harness.window }, async () => {
        const url = buildSessionsFilterShareUrl(vm);
        assert.strictEqual(
            url,
            'http://127.0.0.1:3737/?tab=sessions&s_source=codex&s_path=%2Ftmp%2Fproject&s_query=hello&s_role=assistant&s_time=7d'
        );
    });
});

test('app boot canonicalizes the current Web UI URL before Vue initialization', () => {
    const script = readBundledWebUiScript();
    assert.match(script, /import\s+\{\s*installWebUiUrlCanonicalization\s*\}/);
    assert.match(script, /DOMContentLoaded[\s\S]*installWebUiUrlCanonicalization\(\);[\s\S]*typeof Vue === 'undefined'/);
});
