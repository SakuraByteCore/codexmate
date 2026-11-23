const { assert, fs, path } = require('./helpers');

module.exports = async function testConfigChanges(ctx) {
    const { api, tmpHome, mockProviderUrl } = ctx;
    const savedPermissions = (await api('get-tool-config-permissions')).permissions;
    const template = await api('get-config-template', { model: 'preview-test-model' });
    const models = JSON.parse(fs.readFileSync(path.join(tmpHome, '.codex', 'models.json'), 'utf8'));
    const piSettings = path.join(tmpHome, '.pi', 'agent', 'settings.json');
    const piOriginal = fs.existsSync(piSettings) ? fs.readFileSync(piSettings) : null;
    fs.mkdirSync(path.dirname(piSettings), { recursive: true });
    fs.writeFileSync(piSettings, '{"defaultModel":"seed-model","unknown":true}');
    const covered = new Set();
    const cases = [
        { target: 'codex', action: 'apply-config-template', params: { template: template.template } },
        { target: 'claude', action: 'apply-claude-settings-raw', params: { content: JSON.stringify({ env: { ANTHROPIC_API_KEY: 'preview-secret-claude', ANTHROPIC_MODEL: 'preview-model' }, unknown: true }) } },
        { target: 'openclaw', action: 'apply-openclaw-config', params: { content: JSON.stringify({ models: { providers: { preview: { baseUrl: mockProviderUrl, apiKey: 'preview-secret-openclaw' } } }, unknown: true }) } },
        { target: 'opencode', action: 'apply-opencode-config', params: { content: JSON.stringify({ provider: { preview: { options: { apiKey: 'preview-secret-opencode' } } }, model: 'preview/model', unknown: true }) } },
        { target: 'kilocode', action: 'apply-kilocode-config', params: { provider: 'preview-test', url: mockProviderUrl, apiKey: 'preview-secret-kilo', model: 'preview-model' } },
        { target: 'pi', action: 'write-pi-models', params: { file: { providers: { preview: { apiKey: 'preview-secret-pi', baseUrl: mockProviderUrl, models: [{ id: 'preview-model' }] } }, unknown: true } } },
        { target: 'pi', action: 'write-pi-settings', params: { settings: { defaultProvider: 'preview', defaultModel: 'preview-model', unknown: true } } },
        { target: 'codex', action: 'add-provider', params: { name: 'preview-added', url: mockProviderUrl, key: 'preview-secret-added', model: 'preview-added-model', useTransform: true } },
        { target: 'codex', action: 'update-provider', params: { name: 'e2e', url: mockProviderUrl, key: 'preview-secret-updated', useTransform: true } },
        { target: 'codex', action: 'delete-provider', params: { name: 'e2e' } },
        { target: 'codex', action: 'reset-config', params: {} },
        { target: 'codex', action: 'add-model', params: { model: 'preview-extra-model' } },
        { target: 'codex', action: 'delete-model', params: { model: models[0] } },
        { target: 'opencode', action: 'update-opencode-selection', params: { provider: 'preview', model: 'preview-model', apiKey: 'preview-secret-selection', agent: 'build' } },
        { target: 'pi', action: 'apply-pi-config-history', params: { target: 'settings' } }
    ];
    try {
        for (const item of cases) {
            await api('set-tool-config-permission', { target: item.target, allowWrite: true });
            if (item.action === 'apply-pi-config-history') {
                const history = await api('list-prompt-history', { bucket: 'pi-settings' });
                assert(Array.isArray(history) && history.length > 0, 'Pi history fixture missing');
                item.params.id = history[0].id;
            }
            const preview = await api('preview-config-change', { action: item.action, params: item.params });
            assert(!preview.error && preview.hasChanges, `${item.target}: preview failed (${preview.errorCode || ''})`);
            assert(preview.files.length > 0, `${item.target}: no affected files`);
            assert(!JSON.stringify(preview).includes('preview-secret-'), `${item.target}: preview leaked a credential`);
            const originals = preview.files.map(file => ({ path: file.path, exists: fs.existsSync(file.path), content: fs.existsSync(file.path) ? fs.readFileSync(file.path) : null, mode: fs.existsSync(file.path) ? fs.statSync(file.path).mode & 0o777 : 0 }));
            // A second preview must neither create backups nor change target bytes.
            const parentEntries = new Map(originals.map(file => [path.dirname(file.path), fs.existsSync(path.dirname(file.path)) ? fs.readdirSync(path.dirname(file.path)).sort() : null]));
            await api('preview-config-change', { action: item.action, params: item.params });
            for (const [dir, entries] of parentEntries) {
                const current = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : null;
                assert(JSON.stringify(current) === JSON.stringify(entries), `${item.target}: preview created a directory or backup`);
            }
            for (const file of originals) assert(file.exists ? fs.readFileSync(file.path).equals(file.content) : !fs.existsSync(file.path), `${item.target}: preview wrote a file`);
            const applied = await api('apply-config-change', { previewId: preview.previewId });
            assert(applied.success && applied.change, `${item.target}: apply failed (${applied.errorCode || ''})`);
            const journal = fs.readFileSync(path.join(tmpHome, '.codexmate', 'config-change-last.json'), 'utf8');
            assert(!journal.includes('preview-secret-'), `${item.target}: journal leaked a credential`);
            const last = await api('get-last-config-change', { target: item.target });
            assert(last.change.id === applied.change.id, `${item.target}: last change mismatch`);
            const undone = await api('undo-config-change', { target: item.target, changeId: applied.change.id });
            assert(undone.success, `${item.target}: undo failed (${undone.errorCode || ''})`);
            for (const file of originals) {
                assert(file.exists ? fs.readFileSync(file.path).equals(file.content) : !fs.existsSync(file.path), `${item.target}: undo did not restore bytes/existence`);
                if (file.exists) assert((fs.statSync(file.path).mode & 0o777) === file.mode, `${item.target}: undo changed mode`);
            }
            assert((await api('get-last-config-change', { target: item.target })).change === null, `${item.target}: undo record not consumed`);
            covered.add(item.action);
            for (const [dir, entries] of parentEntries) {
                if (entries === null && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
            }
        }
        // A loaded raw editor must not overwrite an external edit that predates preview.
        const loaded = await api('get-claude-settings-raw');
        const claudePath = path.join(tmpHome, '.claude', 'settings.json');
        const original = fs.readFileSync(claudePath);
        try {
            fs.writeFileSync(claudePath, '{"external":true}');
            const conflict = await api('preview-config-change', { action: 'apply-claude-settings-raw', params: { content: loaded.content }, baseline: loaded.configChangeBaseline });
            assert(conflict.errorCode === 'config-change-conflict', 'stale editor baseline was not rejected');
            assert(fs.readFileSync(claudePath, 'utf8') === '{"external":true}', 'stale preview overwrote external edit');
        } finally { fs.writeFileSync(claudePath, original); }

        const proxyBefore = await api('claude-proxy-status');
        const claudePreview = await api('preview-config-change', { action: 'apply-claude-config', params: { config: { name: 'preview-proxy', apiKey: 'preview-secret-proxy', baseUrl: mockProviderUrl, model: 'preview-model', targetApi: 'chat_completions' } } });
        assert(!claudePreview.error, 'Claude proxy preview failed');
        assert(!JSON.stringify(claudePreview).includes('preview-secret-proxy'), 'Claude proxy preview leaked credential');
        const proxyAfterPreview = await api('claude-proxy-status');
        assert(proxyBefore.running === proxyAfterPreview.running, 'preview changed Claude proxy runtime');
        const applied = await api('apply-config-change', { previewId: claudePreview.previewId });
        assert(applied.success, `Claude proxy apply failed (${applied.errorCode || ''})`);
        assert((await api('claude-proxy-status')).running === true, 'Claude proxy not started after commit');
        assert((await api('undo-config-change', { target: 'claude', changeId: applied.change.id })).success, 'Claude proxy undo failed');
        assert((await api('claude-proxy-status')).running === proxyBefore.running, 'Claude proxy runtime not restored');
        covered.add('apply-claude-config');
        assert(covered.size === 16, 'not all supported configuration actions were exercised');
        console.log('[e2e] all 16 configuration actions: read-only preview, redaction, byte-exact undo, conflict protection and Claude runtime passed');

        await api('set-tool-config-permission', { target: 'pi', allowWrite: false });
        assert((await api('preview-config-change', { action: 'write-pi-settings', params: { defaultModel: 'denied' } })).errorCode === 'tool-config-write-disabled', 'preview bypassed write permissions');
        assert((await api('preview-config-change', { action: 'constructor' })).errorCode === 'config-change-unsupported', 'inherited action accepted');
        const partials = await api('get-last-config-change', { target: 'not-a-tool' });
        assert(partials.errorCode === 'config-change-invalid', 'invalid undo target accepted');
    } finally {
        if (piOriginal) fs.writeFileSync(piSettings, piOriginal);
        else if (fs.existsSync(piSettings)) fs.unlinkSync(piSettings);
        for (const [target, allowWrite] of Object.entries(savedPermissions)) await api('set-tool-config-permission', { target, allowWrite });
    }
};
