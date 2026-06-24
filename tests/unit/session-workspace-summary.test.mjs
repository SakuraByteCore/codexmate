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
                text: '已修改 web-ui/partials/index/panel-sessions.html 和 web-ui/styles/sessions-preview.css。npm run test:unit。https://github.com/SakuraByteCore/codexmate/pull/999。风险：如果摘要误把噪音当 blocker，需要继续收敛。'
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
    assert(summary.links.includes('https://github.com/SakuraByteCore/codexmate/pull/999'));
    assert(summary.risks.some(item => item.includes('风险')));
    assert(summary.nextSteps.some(item => item.includes('后续')));
    assert.match(summary.briefText, /Session workspace brief|会话工作简报|Messages/);
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
