'use strict';

const crypto = require('crypto');
const { writeTextAtomicWithBackup } = require('../lib/cli-config-engine');
const CONFIG_VERSION = 1;
const MAX_CONFIG_BYTES = 2 * 1024 * 1024;
const HISTORY_BUCKET = 'plugin_prompt_templates';
const TEMPLATE_FIELDS = ['id', 'name', 'description', 'template', 'createdAt', 'updatedAt', 'createdBy'];

function normalizeTemplates(input) {
    if (!Array.isArray(input)) throw new Error('模板配置必须是数组');
    const ids = new Set();
    return input.filter((item) => item && item.isBuiltin !== true).map((item) => {
        if (typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !item.name.trim()
            || typeof item.template !== 'string' || ids.has(item.id)) throw new Error('模板配置条目无效');
        ids.add(item.id);
        const entry = Object.fromEntries(TEMPLATE_FIELDS.map((field) => [field, typeof item[field] === 'string' ? item[field] : '']));
        entry.isBuiltin = false;
        entry.maintainers = Array.isArray(item.maintainers) ? item.maintainers.filter((name) => typeof name === 'string') : [];
        return entry;
    });
}

function serializeTemplates(templates) {
    const content = JSON.stringify({ version: CONFIG_VERSION, templates: normalizeTemplates(templates) }, null, 2) + '\n';
    if (Buffer.byteLength(content, 'utf8') > MAX_CONFIG_BYTES) throw new Error('模板配置超过 2MB');
    return content;
}

function createPluginConfigController({ fs, path, CONFIG_DIR, backupPromptBeforeWrite }) {
    const filePath = path.join(CONFIG_DIR, 'codexmate-plugin-config.json');
    function getPluginConfig() {
        try {
            const exists = fs.existsSync(filePath);
            const raw = exists ? fs.readFileSync(filePath, 'utf8') : '';
            const parsed = exists ? JSON.parse(raw) : { version: CONFIG_VERSION, templates: [] };
            if (parsed.version !== CONFIG_VERSION) throw new Error('模板配置版本无效');
            return {
                exists, templates: normalizeTemplates(parsed.templates), historyBucket: HISTORY_BUCKET,
                hash: crypto.createHash('sha256').update(raw).digest('hex')
            };
        } catch (error) { return { error: error.message }; }
    }
    function applyPluginConfig(params = {}) {
        try {
            const content = serializeTemplates(params.templates);
            const current = getPluginConfig();
            if (current.error) return current;
            if (typeof params.baseHash !== 'string' || params.baseHash !== current.hash) {
                return { error: '模板配置已被修改，请重新加载后再保存' };
            }
            if (!current.exists && Array.isArray(params.legacyTemplates) && params.legacyTemplates.length) {
                writeTextAtomicWithBackup(filePath, serializeTemplates(params.legacyTemplates), { fs });
            }
            const backup = backupPromptBeforeWrite(HISTORY_BUCKET, filePath);
            if (backup && backup.error) return { error: backup.error };
            writeTextAtomicWithBackup(filePath, content, { fs });
            return getPluginConfig();
        } catch (error) { return { error: error.message }; }
    }
    return { getPluginConfig, applyPluginConfig };
}

module.exports = { createPluginConfigController };
