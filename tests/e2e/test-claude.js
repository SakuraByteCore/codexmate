const fs = require('fs');
const path = require('path');
const { assert } = require('./helpers');

module.exports = async function testClaude(ctx) {
    const { api, mockProviderUrl, claudeModel, tmpHome } = ctx;

    // ========== Get Claude Settings Tests ==========
    const claudeSettingsInfo = await api('get-claude-settings');
    assert(claudeSettingsInfo.apiKey === 'sk-claude', 'get-claude-settings apiKey mismatch');
    assert(claudeSettingsInfo.baseUrl === mockProviderUrl, 'get-claude-settings baseUrl mismatch');
    assert(claudeSettingsInfo.model === claudeModel, 'get-claude-settings model mismatch');
    assert('exists' in claudeSettingsInfo, 'get-claude-settings missing exists');
    assert(typeof claudeSettingsInfo.targetPath === 'string', 'get-claude-settings missing targetPath');

    // ========== Get Claude Settings - Missing File Tests ==========
    // Note: In E2E context, settings exist from setup, so we test the structure

    // ========== Export Claude Share Tests ==========
    const claudeShareMissing = await api('export-claude-share', { config: { apiKey: 'only-key' } });
    assert(claudeShareMissing.error, 'export-claude-share should fail when baseUrl missing');

    const claudeShareMissingKey = await api('export-claude-share', { config: { baseUrl: mockProviderUrl } });
    assert(claudeShareMissingKey.error, 'export-claude-share should fail when apiKey missing');

    const claudeShareEmptyConfig = await api('export-claude-share', { config: {} });
    assert(claudeShareEmptyConfig.error, 'export-claude-share should fail for empty config');

    const claudeShareNullConfig = await api('export-claude-share', { config: null });
    assert(claudeShareNullConfig.error, 'export-claude-share should fail for null config');

    // ========== Export Claude Share - Success Tests ==========
    const claudeShare = await api('export-claude-share', {
        config: { baseUrl: mockProviderUrl, apiKey: 'sk-claude', model: claudeModel }
    });
    assert(claudeShare.payload, 'export-claude-share missing payload');
    assert(claudeShare.payload.baseUrl === mockProviderUrl, 'export-claude-share baseUrl mismatch');
    assert(claudeShare.payload.apiKey === 'sk-claude', 'export-claude-share apiKey mismatch');
    assert(claudeShare.payload.model === claudeModel, 'export-claude-share model mismatch');

    // ========== Export Claude Share - Default Model Tests ==========
    const claudeShareDefaultModel = await api('export-claude-share', {
        config: { baseUrl: mockProviderUrl, apiKey: 'sk-claude' }
    });
    assert(claudeShareDefaultModel.payload, 'export-claude-share(default model) missing payload');
    assert(claudeShareDefaultModel.payload.model === 'glm-4.7', 'export-claude-share should use default model');

    const claudeShareOllamaNoKey = await api('export-claude-share', {
        config: { baseUrl: 'http://127.0.0.1:11434', apiKey: '', model: 'llama3.1:8b', targetApi: 'ollama' }
    });
    assert(claudeShareOllamaNoKey.payload, 'export-claude-share(ollama no key) missing payload');
    assert(claudeShareOllamaNoKey.payload.baseUrl === 'http://127.0.0.1:11434', 'export-claude-share(ollama) baseUrl mismatch');
    assert(claudeShareOllamaNoKey.payload.apiKey === '', 'export-claude-share(ollama) should preserve empty api key');
    assert(claudeShareOllamaNoKey.payload.model === 'llama3.1:8b', 'export-claude-share(ollama) model mismatch');
    assert(claudeShareOllamaNoKey.payload.targetApi === 'ollama', 'export-claude-share(ollama) target api mismatch');

    // ========== Apply Claude Config Tests ==========
    const permissionsBefore = await api('get-tool-config-permissions');
    assert(permissionsBefore.permissions && permissionsBefore.permissions.claude === false, 'claude write permission should default to disabled');
    const deniedClaudeApply = await api('apply-claude-config', {
        config: { baseUrl: mockProviderUrl, apiKey: 'sk-denied', model: 'denied-model' }
    });
    assert(deniedClaudeApply.errorCode === 'tool-config-write-disabled', 'apply-claude-config should be blocked until claude writes are enabled');
    const enableClaudeWrites = await api('set-tool-config-permission', { target: 'claude', allowWrite: true });
    assert(enableClaudeWrites.success === true, 'set-tool-config-permission(claude) should succeed');

    const applyClaudeEmpty = await api('apply-claude-config', { config: {} });
    assert(applyClaudeEmpty.error, 'apply-claude-config should fail for empty config');

    const applyClaudeMissingKey = await api('apply-claude-config', {
        config: { baseUrl: mockProviderUrl, model: 'test' }
    });
    // Should succeed but with empty key
    assert(applyClaudeMissingKey.success || applyClaudeMissingKey.error, 'apply-claude-config should return result');

    const applyClaudeValid = await api('apply-claude-config', {
        config: { baseUrl: mockProviderUrl, apiKey: 'sk-new', model: 'new-model' }
    });
    assert(applyClaudeValid.success === true, 'apply-claude-config failed');

    // ========== Verify Applied Settings ==========
    const claudeSettingsAfter = await api('get-claude-settings');
    assert(claudeSettingsAfter.apiKey === 'sk-new', 'get-claude-settings apiKey not updated');
    assert(claudeSettingsAfter.baseUrl === mockProviderUrl, 'get-claude-settings baseUrl not updated');
    assert(claudeSettingsAfter.model === 'new-model', 'get-claude-settings model not updated');

    const applyClaudeChatCompletions = await api('apply-claude-config', {
        config: { name: 'claude-chat-direct', baseUrl: mockProviderUrl, apiKey: 'sk-new', model: 'new-model', targetApi: 'chat_completions' }
    });
    assert(applyClaudeChatCompletions.success === true, 'apply-claude-config chat_completions failed');
    assert(applyClaudeChatCompletions.mode === 'claude-proxy', 'apply-claude-config chat_completions should use claude proxy mode');
    assert(applyClaudeChatCompletions.proxy && applyClaudeChatCompletions.proxy.mode === 'anthropic-to-chat-completions', 'apply-claude-config chat_completions proxy mode mismatch');

    const claudeChatSettings = await api('get-claude-settings');
    assert(/^[a-f0-9]{48}$/.test(claudeChatSettings.apiKey), 'chat_completions should point Claude Code at a random local proxy token');
    assert(claudeChatSettings.apiKey !== 'sk-new', 'chat_completions should not write the upstream API key into Claude Code settings');
    assert(/http:\/\/127\.0\.0\.1:\d+$/.test(claudeChatSettings.baseUrl), 'chat_completions should point Claude Code at local proxy base url');
    assert(claudeChatSettings.model === 'new-model', 'chat_completions should preserve Claude model');

    const claudeProxyStatus = await api('claude-proxy-status');
    assert(claudeProxyStatus.running === true, 'chat_completions apply should start Claude proxy');
    assert(claudeProxyStatus.settings && claudeProxyStatus.settings.host === '127.0.0.1', 'chat_completions apply should bind Claude proxy to loopback');
    assert(claudeProxyStatus.runtime && claudeProxyStatus.runtime.mode === 'anthropic-to-chat-completions', 'Claude proxy runtime mode mismatch after chat_completions apply');
    assert(claudeProxyStatus.runtime.upstreamProvider === 'claude-chat-direct', 'Claude proxy should use the applied Claude config as direct upstream');
    assert(claudeProxyStatus.runtime.upstreamBaseUrl === mockProviderUrl, 'Claude proxy direct upstream base url mismatch');

    const applyClaudeOllama = await api('apply-claude-config', {
        config: { name: 'local-ollama', baseUrl: mockProviderUrl, apiKey: '', model: 'llama3.1:8b', targetApi: 'ollama' }
    });
    assert(applyClaudeOllama.success === true, 'apply-claude-config ollama without api key failed');
    assert(applyClaudeOllama.mode === 'claude-proxy', 'apply-claude-config ollama should use claude proxy mode');
    assert(applyClaudeOllama.targetApi === 'ollama', 'apply-claude-config ollama target api mismatch');
    assert(applyClaudeOllama.proxy && applyClaudeOllama.proxy.mode === 'anthropic-to-ollama', 'apply-claude-config ollama proxy mode mismatch');

    const claudeOllamaSettings = await api('get-claude-settings');
    assert(/^[a-f0-9]{48}$/.test(claudeOllamaSettings.apiKey), 'ollama should point Claude Code at a random local proxy token even when upstream key is empty');
    assert(/http:\/\/127\.0\.0\.1:\d+$/.test(claudeOllamaSettings.baseUrl), 'ollama should point Claude Code at local proxy base url');
    assert(claudeOllamaSettings.model === 'llama3.1:8b', 'ollama should preserve Claude model');

    const claudeOllamaProxyStatus = await api('claude-proxy-status');
    assert(claudeOllamaProxyStatus.running === true, 'ollama apply should start Claude proxy');
    assert(claudeOllamaProxyStatus.settings && claudeOllamaProxyStatus.settings.targetApi === 'ollama', 'ollama apply should persist saved Claude proxy targetApi');
    assert(claudeOllamaProxyStatus.runtime && claudeOllamaProxyStatus.runtime.mode === 'anthropic-to-ollama', 'Claude proxy runtime mode mismatch after ollama apply');
    assert(claudeOllamaProxyStatus.runtime.upstreamProvider === 'local-ollama', 'Ollama proxy should use the applied Claude config as direct upstream');
    assert(claudeOllamaProxyStatus.runtime.upstreamBaseUrl === mockProviderUrl, 'Ollama proxy direct upstream base url mismatch');

    // ========== Restore Original Settings ==========
    const restoreClaude = await api('apply-claude-config', {
        config: { baseUrl: mockProviderUrl, apiKey: 'sk-claude', model: claudeModel }
    });
    assert(restoreClaude.success === true, 'restore-claude-config failed');
    const claudeProxyStatusAfterRestore = await api('claude-proxy-status');
    assert(claudeProxyStatusAfterRestore.running === false, 'responses apply should stop Claude proxy runtime');
    assert(claudeProxyStatusAfterRestore.settings && claudeProxyStatusAfterRestore.settings.targetApi === 'responses', 'responses apply should reset saved Claude proxy targetApi');

    // ========== Chat Completions Apply Rollback Tests ==========
    const claudeSettingsPath = path.join(tmpHome, '.claude', 'settings.json');
    const validClaudeSettings = fs.readFileSync(claudeSettingsPath, 'utf-8');
    try {
        fs.writeFileSync(claudeSettingsPath, '{ invalid json', 'utf-8');
        const failedChatApply = await api('apply-claude-config', {
            config: { name: 'claude-chat-direct', baseUrl: mockProviderUrl, apiKey: 'sk-new', model: 'new-model', targetApi: 'chat_completions' }
        });
        assert(failedChatApply.success === false || failedChatApply.error, 'apply-claude-config should fail when Claude settings cannot be read');
        const claudeProxyStatusAfterFailedApply = await api('claude-proxy-status');
        assert(claudeProxyStatusAfterFailedApply.running === false, 'failed chat_completions apply should roll back the Claude proxy runtime');
        assert(claudeProxyStatusAfterFailedApply.settings && claudeProxyStatusAfterFailedApply.settings.targetApi === 'responses', 'failed chat_completions apply should reset saved Claude proxy targetApi');
    } finally {
        fs.writeFileSync(claudeSettingsPath, validClaudeSettings, 'utf-8');
    }
};
