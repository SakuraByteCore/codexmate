import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { createSessionBrowserMethods } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.methods.session-browser.mjs'))
);

const methods = createSessionBrowserMethods({ api: async () => ({}) });

function createContext(overrides = {}) {
    const context = {
        activeSession: null,
        activeSessionMessages: [],
        sessionPreviewQuery: '',
        sessionMatchSearched: false,
        sessionMatchPendingJump: false,
        sessionMatchTokens: [],
        sessionMatchPositions: [],
        sessionMatchTotalCount: 0,
        sessionMatchNavIndex: 0,
        sessionMatchNavBlocked: false,
        sessionMatchHighlightStamp: 0,
        sessionPreviewVisibleCount: 0,
        sessionDetailLoading: false,
        canLoadMoreSessionMessages: false,
        mainTab: 'sessions',
        sessionStandalone: false,
        __sessionPreviewSearchTimer: null,
        loadActiveSessionDetailCalls: 0,
        loadMoreSessionMessagesCalls: 0,
        selectSessionCalls: [],
        scrolledKeys: [],
        flashedKeys: [],
        nextTickTasks: [],
        async loadActiveSessionDetail() {
            context.loadActiveSessionDetailCalls += 1;
        },
        async loadMoreSessionMessages() {
            context.loadMoreSessionMessagesCalls += 1;
            if (context.onLoadMoreSessionMessages) {
                await context.onLoadMoreSessionMessages();
            }
        },
        async selectSession(session) {
            context.selectSessionCalls.push(session);
        },
        getSessionExportKey(session) {
            return `${session.source}:${session.sessionId}`;
        },
        getRecordRenderKey(message, index) {
            return `${message.timestamp}:${index}`;
        },
        scrollSessionMessageIntoView(messageKey) {
            context.scrolledKeys.push(messageKey);
            return true;
        },
        flashSessionMessageKey(messageKey) {
            context.flashedKeys.push(messageKey);
        },
        $nextTick(task) {
            context.nextTickTasks.push(task);
        }
    };
    Object.assign(context, overrides);
    for (const key of Object.keys(methods)) {
        if (typeof context[key] === 'undefined') {
            context[key] = methods[key];
        }
    }
    return context;
}

test('buildSessionPreviewQueryTokens splits, trims, lowercases and drops empties', () => {
    const context = createContext();
    const tokens = methods.buildSessionPreviewQueryTokens.call(context, '  Fix  BUG ');
    assert.deepStrictEqual(tokens, ['fix', 'bug']);
    assert.deepStrictEqual(methods.buildSessionPreviewQueryTokens.call(context, ''), []);
    assert.deepStrictEqual(methods.buildSessionPreviewQueryTokens.call(context, null), []);
});

test('findSessionMatchMessageIndex maps lineIndex against recordLineIndex, not array order', () => {
    const context = createContext({
        activeSessionMessages: [
            { recordLineIndex: 3, text: 'skip prefix record', timestamp: 't1' },
            { recordLineIndex: 5, text: 'first match', timestamp: 't2' },
            { recordLineIndex: 9, text: 'second match', timestamp: 't3' }
        ]
    });
    assert.strictEqual(methods.findSessionMatchMessageIndex.call(context, { lineIndex: 5 }), 1);
    assert.strictEqual(methods.findSessionMatchMessageIndex.call(context, { lineIndex: 9 }), 2);
    assert.strictEqual(methods.findSessionMatchMessageIndex.call(context, { timestamp: 't3' }), 2);
    assert.strictEqual(methods.findSessionMatchMessageIndex.call(context, { lineIndex: 42 }), -1);
    assert.strictEqual(methods.findSessionMatchMessageIndex.call(context, null), -1);
});

test('highlightQueryText escapes html and wraps tokens case-insensitively', () => {
    const context = createContext({
        sessionMatchTokens: ['fix', 'bug']
    });
    const highlighted = methods.highlightQueryText.call(context, 'Fix <b>the</b> BUG now');
    assert.strictEqual(highlighted, '<mark>Fix</mark> <b>the</b> <mark>BUG</mark> now');
    assert.strictEqual(methods.highlightQueryText.call(context, 42), 42);
    const emptyTokens = createContext({ sessionMatchTokens: [] });
    assert.strictEqual(methods.highlightQueryText.call(emptyTokens, 'Fix <b>'), 'Fix <b>');
    const regexContext = createContext({ sessionMatchTokens: ['a.b'] });
    assert.strictEqual(
        methods.highlightQueryText.call(regexContext, 'say a.b fast'),
        'say <mark>a.b</mark> fast'
    );
});

test('submitSessionPreviewSearch reloads active session with pending jump and clears on empty query', async () => {
    const context = createContext({
        activeSession: { source: 'codex', sessionId: 's1' },
        sessionPreviewQuery: '  deploy  '
    });
    methods.submitSessionPreviewSearch.call(context);
    assert.strictEqual(context.sessionMatchPendingJump, true);
    assert.strictEqual(context.loadActiveSessionDetailCalls, 1);

    const emptyContext = createContext({
        activeSession: { source: 'codex', sessionId: 's1' },
        sessionPreviewQuery: '   ',
        sessionMatchPendingJump: true
    });
    methods.submitSessionPreviewSearch.call(emptyContext);
    assert.strictEqual(emptyContext.sessionPreviewQuery, '');
    assert.strictEqual(emptyContext.sessionMatchPendingJump, false);

    const idleContext = createContext({ sessionPreviewQuery: 'deploy' });
    methods.submitSessionPreviewSearch.call(idleContext);
    assert.strictEqual(idleContext.loadActiveSessionDetailCalls, 0);
});

test('clearSessionPreviewSearch resets query, nav state and cancels pending debounce', async () => {
    const context = createContext({
        activeSession: { source: 'codex', sessionId: 's1' },
        sessionPreviewQuery: 'deploy',
        sessionMatchSearched: true,
        sessionMatchPendingJump: true,
        sessionMatchTokens: ['deploy'],
        sessionMatchPositions: [{ lineIndex: 2 }],
        sessionMatchTotalCount: 1,
        sessionMatchNavIndex: 0,
        sessionMatchNavBlocked: true,
        sessionMatchHighlightStamp: 3
    });
    methods.onSessionPreviewSearchInput.call(context);
    assert.ok(context.__sessionPreviewSearchTimer);
    methods.clearSessionPreviewSearch.call(context);
    assert.strictEqual(context.__sessionPreviewSearchTimer, null);
    assert.strictEqual(context.sessionPreviewQuery, '');
    assert.strictEqual(context.sessionMatchSearched, false);
    assert.strictEqual(context.sessionMatchPendingJump, false);
    assert.strictEqual(context.sessionMatchPositions.length, 0);
    assert.strictEqual(context.sessionMatchNavBlocked, false);
    assert.strictEqual(context.sessionMatchHighlightStamp, 4);

    await new Promise((resolve) => setTimeout(resolve, 460));
    assert.strictEqual(context.loadActiveSessionDetailCalls, 0);
});

test('resetSessionPreviewSearchNav bumps the highlight stamp once and cancels timers', () => {
    const context = createContext({
        sessionMatchHighlightStamp: 7,
        sessionMatchTokens: ['x'],
        sessionMatchPositions: [{ lineIndex: 1 }]
    });
    methods.onSessionPreviewSearchInput.call(context);
    methods.resetSessionPreviewSearchNav.call(context);
    assert.strictEqual(context.sessionMatchHighlightStamp, 8);
    assert.strictEqual(context.sessionMatchPositions.length, 0);
    assert.strictEqual(context.__sessionPreviewSearchTimer, null);
});

test('onSessionPreviewSearchInput debounces submit until input settles', async () => {
    const context = createContext({
        activeSession: { source: 'codex', sessionId: 's1' },
        sessionPreviewQuery: 'deploy'
    });
    methods.onSessionPreviewSearchInput.call(context);
    assert.strictEqual(context.loadActiveSessionDetailCalls, 0);
    assert.ok(context.__sessionPreviewSearchTimer);

    await new Promise((resolve) => setTimeout(resolve, 480));
    assert.strictEqual(context.__sessionPreviewSearchTimer, null);
    assert.strictEqual(context.sessionMatchPendingJump, true);
    assert.strictEqual(context.loadActiveSessionDetailCalls, 1);
});

test('revealSessionMatchPosition reveals loaded hits and expands visible window', () => {
    const context = createContext({
        activeSessionMessages: [
            { recordLineIndex: 2, timestamp: 't1' },
            { recordLineIndex: 6, timestamp: 't2' }
        ],
        sessionMatchPositions: [{ lineIndex: 6, timestamp: 't2' }],
        sessionPreviewVisibleCount: 1,
        sessionMatchNavIndex: 5
    });
    const revealed = methods.revealSessionMatchPosition.call(context, 7);
    assert.strictEqual(revealed, true);
    assert.strictEqual(context.sessionMatchNavIndex, 0);
    assert.strictEqual(context.sessionMatchNavBlocked, false);
    assert.strictEqual(context.sessionPreviewVisibleCount, 2);
    assert.strictEqual(context.nextTickTasks.length, 1);
    context.nextTickTasks[0]();
    assert.deepStrictEqual(context.scrolledKeys, ['t2:1']);
    assert.deepStrictEqual(context.flashedKeys, ['t2:1']);
});

test('revealSessionMatchPosition wraps backward navigation', () => {
    const context = createContext({
        activeSessionMessages: [
            { recordLineIndex: 2, timestamp: 't1' },
            { recordLineIndex: 6, timestamp: 't2' }
        ],
        sessionMatchPositions: [{ lineIndex: 2, timestamp: 't1' }, { lineIndex: 6, timestamp: 't2' }],
        sessionPreviewVisibleCount: 2,
        sessionMatchNavIndex: 1
    });
    methods.revealSessionMatchPosition.call(context, -1);
    assert.strictEqual(context.sessionMatchNavIndex, 1);
    methods.stepSessionMatchNav.call(context, -1);
    assert.strictEqual(context.sessionMatchNavIndex, 0);
    methods.stepSessionMatchNav.call(context, -1);
    assert.strictEqual(context.sessionMatchNavIndex, 1);
});

test('ensureSessionMatchPositionVisible auto-loads more messages until the hit is present', async () => {
    const missingMessage = { recordLineIndex: 21, timestamp: 't21' };
    const context = createContext({
        activeSessionMessages: [{ recordLineIndex: 2, timestamp: 't1' }],
        sessionMatchPositions: [{ lineIndex: 21, timestamp: 't21' }],
        sessionPreviewVisibleCount: 1,
        canLoadMoreSessionMessages: true,
        async onLoadMoreSessionMessages() {
            context.activeSessionMessages.push(missingMessage);
            context.canLoadMoreSessionMessages = false;
        }
    });
    const revealed = await methods.ensureSessionMatchPositionVisible.call(context, 0);
    assert.strictEqual(revealed, true);
    assert.strictEqual(context.loadMoreSessionMessagesCalls, 1);
    assert.strictEqual(context.sessionMatchNavBlocked, false);
    assert.strictEqual(context.sessionPreviewVisibleCount, 2);
    context.nextTickTasks[0]();
    assert.deepStrictEqual(context.scrolledKeys, ['t21:1']);
});

test('ensureSessionMatchPositionVisible gives up blocked when nothing more can load', async () => {
    const context = createContext({
        activeSessionMessages: [{ recordLineIndex: 2, timestamp: 't1' }],
        sessionMatchPositions: [{ lineIndex: 99, timestamp: 't99' }],
        canLoadMoreSessionMessages: false
    });
    const revealed = await methods.ensureSessionMatchPositionVisible.call(context, 0);
    assert.strictEqual(revealed, false);
    assert.strictEqual(context.sessionMatchNavBlocked, true);
    assert.strictEqual(context.loadMoreSessionMessagesCalls, 0);
});

test('openSessionFromListMatch carries the list query into the preview and reloads same-session targets', async () => {
    const sameSession = { source: 'codex', sessionId: 's1' };
    const context = createContext({
        sessionQuery: ' deploy ',
        activeSession: sameSession,
        activeSessionMessages: [{ recordLineIndex: 2, timestamp: 't1' }]
    });
    await methods.openSessionFromListMatch.call(context, sameSession);
    assert.strictEqual(context.selectSessionCalls.length, 1);
    assert.strictEqual(context.sessionPreviewQuery, 'deploy');
    assert.strictEqual(context.sessionMatchPendingJump, true);
    assert.strictEqual(context.loadActiveSessionDetailCalls, 1);

    const freshContext = createContext({
        sessionQuery: 'deploy',
        activeSession: null,
        activeSessionMessages: []
    });
    await methods.openSessionFromListMatch.call(freshContext, { source: 'codex', sessionId: 's2' });
    assert.strictEqual(freshContext.sessionPreviewQuery, 'deploy');
    assert.strictEqual(freshContext.sessionMatchPendingJump, true);
    assert.strictEqual(freshContext.loadActiveSessionDetailCalls, 0);

    const noQueryContext = createContext({ sessionQuery: '' });
    await methods.openSessionFromListMatch.call(noQueryContext, { source: 'codex', sessionId: 's3' });
    assert.strictEqual(noQueryContext.selectSessionCalls.length, 1);
    assert.strictEqual(noQueryContext.sessionPreviewQuery, '');
});
