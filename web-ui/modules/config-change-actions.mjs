// Keep this contract aligned with CONFIG_CHANGE_ACTIONS in cli.js.
export const CONFIG_CHANGE_ACTIONS = Object.freeze({
    'apply-config-template': 'codex', 'add-provider': 'codex', 'update-provider': 'codex',
    'delete-provider': 'codex', 'reset-config': 'codex', 'add-model': 'codex', 'delete-model': 'codex',
    'apply-claude-settings-raw': 'claude', 'apply-claude-config': 'claude',
    'apply-opencode-config': 'opencode', 'update-opencode-selection': 'opencode',
    'apply-kilocode-config': 'kilocode', 'apply-openclaw-config': 'openclaw',
    'write-pi-models': 'pi', 'write-pi-settings': 'pi', 'apply-pi-config-history': 'pi'
});
