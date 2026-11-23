import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { api, apiWithMeta } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'api.mjs')));

function createResponse({
    ok = true,
    status = 200,
    statusText = 'OK',
    contentType = 'application/json; charset=utf-8',
    jsonValue = {},
    jsonError = null,
    textValue = ''
} = {}) {
    return {
        ok,
        status,
        statusText,
        headers: {
            get(name) {
                return String(name || '').toLowerCase() === 'content-type'
                    ? contentType
                    : '';
            }
        },
        async json() {
            if (jsonError) {
                throw jsonError;
            }
            return jsonValue;
        },
        async text() {
            return textValue;
        }
    };
}

async function withFetch(fetchImpl, fn) {
    const previousFetch = globalThis.fetch;
    globalThis.fetch = fetchImpl;
    try {
        return await fn();
    } finally {
        if (typeof previousFetch === 'undefined') {
            delete globalThis.fetch;
        } else {
            globalThis.fetch = previousFetch;
        }
    }
}

test('api surfaces response context for non-json payloads', async () => {
    const fetch = async () => createResponse({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        contentType: 'text/plain; charset=utf-8',
        textValue: 'upstream exploded'
    });

    await withFetch(fetch, async () => {
        await assert.rejects(
            () => api('status'),
            (error) => {
                assert.match(error.message, /status/i);
                assert.match(error.message, /502/);
                assert.match(error.message, /Bad Gateway/);
                assert.match(error.message, /content-type/i);
                assert.match(error.message, /text\/plain/i);
                assert.match(error.message, /upstream exploded/);
                assert.match(error.message, /status/);
                return true;
            }
        );
    });
});

test('api does not leak raw html error pages into startup-visible errors', async () => {
    const fetch = async () => createResponse({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        contentType: 'text/html; charset=utf-8',
        textValue: '<!doctype html><html><body><h1>Bad Gateway</h1><p>Understand this error</p></body></html>'
    });

    await withFetch(fetch, async () => {
        await assert.rejects(
            () => api('status'),
            (error) => {
                assert.match(error.message, /status/i);
                assert.match(error.message, /502/);
                assert.match(error.message, /Bad Gateway/);
                assert.match(error.message, /content-type/i);
                assert.match(error.message, /text\/html/i);
                assert.doesNotMatch(error.message, /Understand this error/i);
                assert.doesNotMatch(error.message, /<!doctype html>/i);
                return true;
            }
        );
    });
});

test('api surfaces response context for json parse failures', async () => {
    const fetch = async () => createResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        contentType: 'application/json; charset=utf-8',
        jsonError: new SyntaxError('Unexpected token < in JSON')
    });

    await withFetch(fetch, async () => {
        await assert.rejects(
            () => api('list'),
            (error) => {
                assert.match(error.message, /list/);
                assert.match(error.message, /200/);
                assert.match(error.message, /content-type/i);
                assert.match(error.message, /application\/json/i);
                assert.match(error.message, /Unexpected token </);
                return true;
            }
        );
    });
});

test('apiWithMeta preserves payload-too-large for json object responses', async () => {
    const fetch = async () => createResponse({
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        contentType: 'application/json; charset=utf-8',
        jsonValue: { ok: false, error: 'too big' }
    });

    await withFetch(fetch, async () => {
        const result = await apiWithMeta('preview-agents-diff');
        assert.deepStrictEqual(result, {
            ok: false,
            status: 413,
            error: 'too big',
            errorCode: 'payload-too-large'
        });
    });
});

test('apiWithMeta preserves payload-too-large for json non-object responses', async () => {
    const fetch = async () => createResponse({
        ok: false,
        status: 413,
        statusText: 'Payload Too Large',
        contentType: 'application/json; charset=utf-8',
        jsonValue: ['too', 'big']
    });

    await withFetch(fetch, async () => {
        const result = await apiWithMeta('preview-agents-diff');
        assert.deepStrictEqual(result, {
            ok: false,
            status: 413,
            data: ['too', 'big'],
            errorCode: 'payload-too-large'
        });
    });
});

for (const requestApi of [api, apiWithMeta]) {
    test(`${requestApi.name} aborts stalled headers once without retrying`, async () => {
        let requestSignal;
        let calls = 0;
        await withFetch((_url, { signal }) => {
            calls += 1;
            requestSignal = signal;
            return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }));
        }, async () => {
            await assert.rejects(() => requestApi('status', {}, { timeoutMs: 10 }), { name: 'TimeoutError' });
            assert.strictEqual(requestSignal.aborted, true);
            assert.strictEqual(calls, 1);
        });
    });

    test(`${requestApi.name} keeps deadline active while parsing the response body`, async () => {
        let requestSignal;
        await withFetch(async (_url, { signal }) => {
            requestSignal = signal;
            return { ...createResponse(), json: () => new Promise(() => {}) };
        }, async () => {
            await assert.rejects(() => requestApi('status', {}, { timeoutMs: 10 }), { name: 'TimeoutError' });
            assert.strictEqual(requestSignal.aborted, true);
        });
    });
}

test('api forwards caller cancellation and removes its listener after success', async () => {
    const controller = new AbortController();
    const reason = new Error('caller canceled');
    await withFetch((_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }), async () => {
        const pending = api('status', {}, { signal: controller.signal });
        controller.abort(reason);
        await assert.rejects(pending, error => error === reason);
    });
    const successController = new AbortController();
    let removed = 0;
    const originalRemove = successController.signal.removeEventListener.bind(successController.signal);
    successController.signal.removeEventListener = (...args) => { removed += 1; originalRemove(...args); };
    await withFetch(async () => createResponse({ jsonValue: { success: true } }), async () => {
        assert.deepStrictEqual(await api('status', {}, { signal: successController.signal }), { success: true });
        assert.strictEqual(removed, 1);
    });
});

test('api leaves ordinary requests unbounded and rejects invalid deadlines before fetching', async () => {
    let calls = 0;
    await withFetch(async (_url, init) => {
        calls += 1;
        assert.strictEqual(Object.prototype.hasOwnProperty.call(init, 'signal'), false);
        return createResponse();
    }, async () => {
        await api('status');
        await assert.rejects(() => api('status', {}, { timeoutMs: -1 }), TypeError);
        assert.strictEqual(calls, 1);
    });
});
