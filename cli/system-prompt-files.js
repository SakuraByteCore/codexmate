'use strict';

function createSystemPromptFileController(deps = {}) {
    const {
        fs,
        path,
        os,
        crypto,
        buildLineDiff,
        CONFIG_DIR,
        PI_AGENT_DIR,
        backupPromptBeforeWrite
    } = deps;

    if (!fs) throw new Error('createSystemPromptFileController 缺少 fs');
    if (!path) throw new Error('createSystemPromptFileController 缺少 path');
    if (!os) throw new Error('createSystemPromptFileController 缺少 os');
    if (!crypto) throw new Error('createSystemPromptFileController 缺少 crypto');
    if (typeof buildLineDiff !== 'function') throw new Error('createSystemPromptFileController 缺少 buildLineDiff');
    if (typeof CONFIG_DIR !== 'string' || !CONFIG_DIR) throw new Error('createSystemPromptFileController 缺少 CONFIG_DIR');
    if (typeof PI_AGENT_DIR !== 'string' || !PI_AGENT_DIR) throw new Error('createSystemPromptFileController 缺少 PI_AGENT_DIR');
    if (typeof backupPromptBeforeWrite !== 'function' && typeof backupPromptBeforeWrite !== 'undefined') throw new Error('createSystemPromptFileController 备份回调无效');

    const MODES = {
        system: 'SYSTEM.md',
        append: 'APPEND_SYSTEM.md'
    };

    const SCOPES = ['global', 'project'];

    function normalizeMode(mode) {
        const key = typeof mode === 'string' ? mode.trim() : '';
        if (!Object.prototype.hasOwnProperty.call(MODES, key)) {
            throw new Error("Invalid system prompt mode: expected 'system' or 'append'");
        }
        return key;
    }

    function sanitizeSystemHistoryId(raw) {
        const safe = typeof raw === 'string' ? raw.trim() : '';
        if (!safe) return 'global';
        return safe.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 64) || 'global';
    }

    function normalizeScope(scope) {
        const key = typeof scope === 'string' ? scope.trim() : '';
        if (!SCOPES.includes(key)) {
            throw new Error("Invalid system prompt scope: expected 'global' or 'project'");
        }
        return key;
    }

    function hashContent(content) {
        return crypto.createHash('sha256').update(String(content || '')).digest('hex');
    }

    function resolveSystemPromptFilePath(params = {}) {
        const scope = normalizeScope(params.scope);
        const mode = normalizeMode(params.mode);
        const filename = MODES[mode];
        let base;
        if (scope === 'global') {
            base = PI_AGENT_DIR;
        } else {
            const cwd = typeof params.cwd === 'string' && params.cwd.trim()
                ? params.cwd.trim()
                : process.cwd();
            base = path.join(path.resolve(cwd), '.pi');
        }
        return {
            scope,
            mode,
            filename,
            path: path.join(base, filename),
            replaceDefault: mode === 'system'
        };
    }

    function readSystemPromptFile(params = {}) {
        const target = resolveSystemPromptFilePath(params);
        const exists = fs.existsSync(target.path);
        let content = '';
        if (exists) {
            try {
                content = fs.readFileSync(target.path, 'utf8');
            } catch (e) {
                return { ...target, exists: false, content: '', hash: hashContent(''), error: '读取 system prompt 失败: ' + e.message };
            }
        }
        return {
            ...target,
            exists,
            content,
            hash: hashContent(content)
        };
    }

    function saveSystemPromptFile(params = {}) {
        const content = typeof params.content === 'string' ? params.content : '';
        if (!content.trim()) {
            return { error: 'System prompt 不能为空' };
        }
        if (content.length > 2 * 1024 * 1024) {
            return { error: '内容过大（最大 2MB）' };
        }
        const target = resolveSystemPromptFilePath(params);
        const current = readSystemPromptFilePath(target);
        if (current.error) {
            return { error: current.error };
        }
        const baseHash = typeof params.baseHash === 'string' ? params.baseHash.trim() : '';
        if (baseHash && baseHash !== current.hash) {
            return { error: '文件已被外部修改，请重新加载后再保存' };
        }
        let sysHistoryBucket = '';
        try {
            const dir = path.dirname(target.path);
            fs.mkdirSync(dir, { recursive: true });
            if (typeof backupPromptBeforeWrite === 'function') {
                const bucket = 'system_' + target.scope + '_' + (target.scope === 'project'
                    ? sanitizeSystemHistoryId(path.dirname(target.path))
                    : 'global');
                backupPromptBeforeWrite(bucket, target.path);
                sysHistoryBucket = bucket;
            }
            const finalContent = content.endsWith('\n') ? content : content + '\n';
            fs.writeFileSync(target.path, finalContent, { encoding: 'utf8', mode: 0o600 });
            try { fs.chmodSync(target.path, 0o600); } catch (_) {}
        } catch (e) {
            return { error: '写入 system prompt 失败: ' + e.message };
        }
        const saved = readSystemPromptFilePath(target);
        if (sysHistoryBucket) saved.historyBucket = sysHistoryBucket;
        return saved;
    }

    function readSystemPromptFilePath(resolved) {
        const exists = fs.existsSync(resolved.path);
        let content = '';
        if (exists) {
            try {
                content = fs.readFileSync(resolved.path, 'utf8');
            } catch (e) {
                return { ...resolved, exists: false, content: '', hash: hashContent(''), error: '读取 system prompt 失败: ' + e.message };
            }
        }
        return {
            ...resolved,
            exists,
            content,
            hash: hashContent(content)
        };
    }

    function buildSystemPromptDiff(params = {}) {
        const hasBaseContent = typeof params.baseContent === 'string';
        const target = resolveSystemPromptFilePath(params);
        const current = readSystemPromptFilePath(target);
        if (current.error) {
            return { error: current.error };
        }
        const beforeText = hasBaseContent
            ? (typeof params.baseContent === 'string' ? params.baseContent : '')
            : (current.content || '');
        const afterText = typeof params.content === 'string' ? params.content : '';
        const normalizedBefore = beforeText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const normalizedAfter = afterText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const diff = buildLineDiff(normalizedBefore, normalizedAfter);
        const hasChanges = diff.truncated
            ? normalizedBefore !== normalizedAfter
            : (diff.stats.added > 0 || diff.stats.removed > 0);
        return {
            diff: {
                ...diff,
                hasChanges
            },
            path: target.path,
            exists: current.exists,
            scope: target.scope,
            mode: target.mode
        };
    }

    return {
        readSystemPromptFile,
        saveSystemPromptFile,
        buildSystemPromptDiff,
        normalizeMode,
        normalizeScope
    };
}

module.exports = {
    createSystemPromptFileController
};
