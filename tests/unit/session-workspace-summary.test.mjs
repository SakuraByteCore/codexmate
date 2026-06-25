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
                text: '已修改 web-ui/partials/index/panel-sessions.html、web-ui/styles/sessions-preview.css、web-ui\\styles\\sessions-toolbar-trash.css 和 C:\\repo\\src\\session-summary.ts。npm run test:unit。https://github.com/SakuraByteCore/codexmate/pull/999。风险：如果摘要误把噪音当 blocker，需要继续收敛。'
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
    assert(summary.links.includes('https://github.com/SakuraByteCore/codexmate/pull/999'));
    assert(summary.risks.some(item => item.includes('风险')));
    assert(summary.nextSteps.some(item => item.includes('后续')));
    assert.match(summary.briefText, /Session workspace brief|会话工作简报|Messages/);
});

test('session workspace locale labels are translated for Japanese and Vietnamese', () => {
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

test('copySessionWorkspaceBrief copies the structured brief text', async () => {
    const methods = createSessionActionMethods({ api: async () => ({}) });
    const copied = [];
    const messages = [];
    const context = {
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

    await methods.copySessionWorkspaceBrief.call(context);

    assert.deepStrictEqual(copied, ['# Brief\n\n- web-ui/partials/index/panel-sessions.html']);
    assert.deepStrictEqual(messages, [{ message: 'sessions.workspace.copy.success', type: 'success' }]);
});
