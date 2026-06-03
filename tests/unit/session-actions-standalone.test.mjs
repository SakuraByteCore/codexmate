import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { createSessionActionMethods } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.methods.session-actions.mjs'))
);

function withWindow(windowLike, fn) {
    const previousWindow = globalThis.window;
    globalThis.window = windowLike;
    try {
        return fn();
    } finally {
        globalThis.window = previousWindow;
    }
}

test('buildSessionStandaloneUrl returns empty when neither origin nor apiBase is usable', () => {
    const methods = createSessionActionMethods({ apiBase: '   ' });

    const url = withWindow({
        location: {
            origin: 'null'
        }
    }, () => methods.buildSessionStandaloneUrl.call({}, {
        source: 'codex',
        sessionId: 'session-1'
    }));

    assert.strictEqual(url, '');
});

test('copySessionLink shows an error when url cannot be built', async () => {
    const methods = createSessionActionMethods({ apiBase: '' });
    const context = {
        ...methods,
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        fallbackCopyText() { return true; }
    };

    await withWindow({
        location: {
            origin: 'null'
        }
    }, () => methods.copySessionLink.call(context, {
        source: 'codex',
        sessionId: 'session-1'
    }));

    assert.deepStrictEqual(context.shownMessages, [{
        message: '无法生成链接',
        type: 'error'
    }]);
});

test('copySessionPath copies the session file path', async () => {
    const methods = createSessionActionMethods({ apiBase: '' });
    const copied = [];
    const context = {
        ...methods,
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        fallbackCopyText(value) {
            copied.push(value);
            return true;
        }
    };

    await methods.copySessionPath.call(context, {
        source: 'codex',
        sessionId: 'session-1',
        filePath: '  /tmp/codexmate/session-1.jsonl  '
    });

    assert.deepStrictEqual(copied, ['/tmp/codexmate/session-1.jsonl']);
    assert.deepStrictEqual(context.shownMessages, [{
        message: '已复制路径',
        type: 'success'
    }]);
});

test('copySessionPath reports an error when the session has no file path', async () => {
    const methods = createSessionActionMethods({ apiBase: '' });
    let copied = false;
    const context = {
        ...methods,
        shownMessages: [],
        showMessage(message, type) {
            this.shownMessages.push({ message, type });
        },
        fallbackCopyText() {
            copied = true;
            return true;
        }
    };

    await methods.copySessionPath.call(context, {
        source: 'codex',
        sessionId: 'session-1'
    });

    assert.strictEqual(copied, false);
    assert.deepStrictEqual(context.shownMessages, [{
        message: '无本地文件路径',
        type: 'error'
    }]);
});
