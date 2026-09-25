import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { buildSessionWorkspaceSummary, createSessionComputed } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.computed.session.mjs'))
);
const { createSessionActionMethods } = await import(
    pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'app.methods.session-actions.mjs'))
);
const { zh } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'i18n', 'locales', 'zh.mjs')));
const { zhTw } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'i18n', 'locales', 'zh-tw.mjs')));
const { ja } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'i18n', 'locales', 'ja.mjs')));
const { vi } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'web-ui', 'modules', 'i18n', 'locales', 'vi.mjs')));

test('buildSessionWorkspaceSummary extracts reusable project memory signals', () => {
    const summary = buildSessionWorkspaceSummary(
        { source: 'codex', sourceLabel: 'Codex', cwd: '/repo/codexmate' },
        [
            {
                normalizedRole: 'user',
                timestamp: '2026-06-24T10:00:00.000Z',
                text: '优化会话浏览 tab，后续要覆盖真实端到端场景。'
            },
            {
                normalizedRole: 'assistant',
                timestamp: '2026-06-24T10:01:00.000Z',
                text: '已修改 README.md、/repo/src/foo.ts、web-ui/partials/index/panel-sessions.html、web-ui/styles/sessions-preview.css、web-ui\\styles\\sessions-toolbar-trash.css 和 C:\\repo\\src\\session-summary.ts。npm run test:unit。https://github.com/SakuraByteCore/codexmate/pull/999。另见 https://example.com/docs. 风险：如果摘要误把噪音当 blocker，需要继续收敛。'
            }
        ],
        {
            messagesLabel: 'Messages',
            userLabel: 'User',
            assistantLabel: 'Assistant',
            commandsLabel: 'Commands',
            artifactsLabel: 'Artifacts',
            risksLabel: 'Risks'
        }
    );

    assert.strictEqual(summary.available, true);
    assert.strictEqual(summary.messageCount, 2);
    assert.deepStrictEqual(summary.roleCounts, { user: 1, assistant: 1, system: 0, other: 0 });
    assert(summary.signals.some(item => item.includes('优化会话浏览 tab')));
    assert(summary.commands.includes('npm run test:unit'));
    assert(summary.files.includes('web-ui/partials/index/panel-sessions.html'));
    assert(summary.files.includes('web-ui/styles/sessions-preview.css'));
    assert(summary.files.includes('web-ui\\styles\\sessions-toolbar-trash.css'));
    assert(summary.files.includes('C:\\repo\\src\\session-summary.ts'));
    assert(summary.files.includes('README.md'));
    assert(summary.files.includes('/repo/src/foo.ts'));
    assert(summary.links.includes('https://github.com/SakuraByteCore/codexmate/pull/999'));
    assert(summary.links.includes('https://example.com/docs'));
    assert(!summary.links.includes('https://example.com/docs.'));
    assert(summary.risks.some(item => item.includes('风险')));
    assert(summary.nextSteps.some(item => item.includes('后续')));
    assert.match(summary.briefText, /Session workspace brief|会话工作简报|Messages/);
    assert.match(summary.briefText, /User: 1/);
    assert.match(summary.briefText, /Assistant: 1/);
    assert.match(summary.briefText, /Commands: 1/);
    assert.match(summary.briefText, /Artifacts: 8/);
    assert.match(summary.briefText, /Risks: 3/);
});

test('session workspace locale labels are translated for changed locales', () => {
    assert.strictEqual(zh['sessions.workspace.kicker'], '工作记忆');
    assert.strictEqual(zh['sessions.workspace.metric.user'], '用户');
    assert.strictEqual(zh['sessions.workspace.metric.assistant'], '助手');

    assert.strictEqual(zhTw['sessions.workspace.kicker'], '工作記憶');
    assert.strictEqual(zhTw['sessions.workspace.metric.user'], '使用者');
    assert.strictEqual(zhTw['sessions.workspace.metric.assistant'], '助手');

    assert.strictEqual(ja['sessions.workspace.kicker'], '作業メモリ');
    assert.strictEqual(ja['sessions.workspace.metric.messages'], 'メッセージ');
    assert.strictEqual(ja['sessions.workspace.metric.user'], 'ユーザー');
    assert.strictEqual(ja['sessions.workspace.metric.assistant'], 'アシスタント');
    assert.strictEqual(ja['sessions.workspace.metric.commands'], 'コマンド');
    assert.strictEqual(ja['sessions.workspace.metric.artifacts'], '成果物');

    assert.strictEqual(vi['sessions.workspace.kicker'], 'Bộ nhớ công việc');
    assert.strictEqual(vi['sessions.workspace.metric.user'], 'Người dùng');
    assert.strictEqual(vi['sessions.workspace.metric.assistant'], 'Trợ lý');
});

test('activeSessionWorkspaceSummary computed stays empty without an active session', () => {
    const computed = createSessionComputed();
    const summary = computed.activeSessionWorkspaceSummary.call({
        mainTab: 'sessions',
        activeSession: null,
        activeSessionMessages: [],
        t(key) { return key; }
    });

    assert.strictEqual(summary.available, false);
    assert.strictEqual(summary.messageCount, 0);
});

test('copySessionWorkspaceBrief appends the full exported transcript', async () => {
    const exportContent = '# AI Session Export\n\n## Messages\n\n### 1. User\n\n优化会话浏览 tab';
    const methods = createSessionActionMethods({ api: async () => ({ content: exportContent }) });
    const copied = [];
    const messages = [];
    const context = {
        activeSession: { source: 'codex', sessionId: 's1', filePath: '/sessions/s1.jsonl' },
        activeSessionWorkspaceSummary: {
            briefText: '# Brief\n\n- web-ui/partials/index/panel-sessions.html'
        },
        fallbackCopyText(text) {
            copied.push(text);
            return true;
        },
        showMessage(message, type) {
            messages.push({ message, type });
        },
        t(key) { return key; }
    };
    context.notifyBriefCopied = (exportResult) => methods.notifyBriefCopied.call(context, exportResult);

    await methods.copySessionWorkspaceBrief.call(context);

    assert.deepStrictEqual(copied, [
        '# Brief\n\n- web-ui/partials/index/panel-sessions.html\n\n---\n\n' + exportContent
    ]);
    assert.deepStrictEqual(messages, [{ message: 'sessions.workspace.copy.success', type: 'success' }]);
});

test('copySessionWorkspaceBrief aborts loudly when the export backend fails', async () => {
    const methods = createSessionActionMethods({ api: async () => ({ error: 'Session file not found' }) });
    const copied = [];
    const messages = [];
    const context = {
        activeSession: { source: 'codex', sessionId: 's1', filePath: '/sessions/s1.jsonl' },
        activeSessionWorkspaceSummary: {
            briefText: '# Brief\n\n- item'
        },
        fallbackCopyText(text) {
            copied.push(text);
            return true;
        },
        showMessage(message, type) {
            messages.push({ message, type });
        },
        t(key) { return key; }
    };
    context.notifyBriefCopied = (exportResult) => methods.notifyBriefCopied.call(context, exportResult);

    await methods.copySessionWorkspaceBrief.call(context);

    assert.deepStrictEqual(copied, []);
    assert.deepStrictEqual(messages, [{ message: 'Session file not found', type: 'error' }]);
});

test('workspace brief text keeps empty sections with explicit placeholders', () => {
    const summary = buildSessionWorkspaceSummary(
        { source: 'codex', sourceLabel: 'Codex', cwd: '/repo/codexmate' },
        [
            {
                normalizedRole: 'user',
                timestamp: '',
                text: '随便聊聊'
            }
        ]
    );

    assert.match(summary.briefText, /User: 1/);
    assert.match(summary.briefText, /Assistant: 0/);
    assert.match(summary.briefText, /Commands: 0/);
    assert.match(summary.briefText, /Artifacts: 0/);
    assert.match(summary.briefText, /Risks: 0/);
    assert.match(summary.briefText, /## Signals\n- 随便聊聊/);
    assert.match(summary.briefText, /## Reusable commands\n- No command signals/);
    assert.match(summary.briefText, /## Files\n- No file signals/);
    assert.match(summary.briefText, /## Links\n- No link signals/);
    assert.match(summary.briefText, /## Risks \/ blockers\n- No risks or todos detected/);
    assert.match(summary.briefText, /## Next steps\n- No risks or todos detected/);
});
