import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { createStartupClaudeMethods } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.methods.startup-claude.mjs')));

function createContext() {
    const messages = [];
    const writes = [];
    return {
        messages,
        writes,
        starPrompted: false,
        showMessage(message, level) {
            messages.push({ message, level });
        },
        persistWebUiPreferences(overrides) {
            writes.push(overrides);
        }
    };
}

const { maybeShowStarPrompt } = createStartupClaudeMethods();

test('maybeShowStarPrompt skips prompting when preference marker is already set', () => {
    const context = createContext();
    context.starPrompted = true;

    maybeShowStarPrompt.call(context);

    assert.deepStrictEqual(context.messages, []);
    assert.deepStrictEqual(context.writes, []);
});

test('maybeShowStarPrompt silently persists the marker through web UI preferences', () => {
    const context = createContext();

    maybeShowStarPrompt.call(context);

    assert.deepStrictEqual(context.messages, []);
    assert.strictEqual(context.starPrompted, true);
    assert.deepStrictEqual(context.writes, [{ starPrompted: true }]);
});

test('maybeShowStarPrompt stays silent when the preference persistence hook is missing', () => {
    const context = createContext();
    delete context.persistWebUiPreferences;

    maybeShowStarPrompt.call(context);

    assert.deepStrictEqual(context.messages, []);
    assert.strictEqual(context.starPrompted, true);
});
