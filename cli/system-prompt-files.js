'use strict';

const { writeTextAtomicWithBackup } = require('../lib/cli-config-engine');

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
    const MAX_PROMPT_BYTES = 2 * 1024 * 1024;
    const READ_FLAGS = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);

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

    function isValidFileName(filename) {
        return typeof filename === 'string' && filename.length > 3
            && filename === filename.trim() && filename.endsWith('.md')
            && !/[\\/\0]/.test(filename) && path.basename(filename) === filename;
    }

    function resolveSystemPromptDirectory(params) {
        const scope = normalizeScope(params.scope);
        const cwd = typeof params.cwd === 'string' && params.cwd.trim() ? params.cwd.trim() : process.cwd();
        return { scope, directory: scope === 'global' ? path.resolve(PI_AGENT_DIR) : path.join(path.resolve(cwd), '.pi') };
    }

    function resolveSystemPromptFilePath(params = {}) {
        const { scope, directory } = resolveSystemPromptDirectory(params);
        const hasFileName = Object.prototype.hasOwnProperty.call(params, 'fileName');
        if (hasFileName && !isValidFileName(params.fileName)) {
            throw new Error('Invalid system prompt filename: expected a direct .md file');
        }
        const requestedMode = normalizeMode(hasFileName ? (params.mode || 'system') : params.mode);
        const filename = hasFileName ? params.fileName : MODES[requestedMode];
        const mode = filename === MODES.append ? 'append' : (filename === MODES.system ? 'system' : requestedMode);
        return { scope, mode, filename, path: path.join(directory, filename), replaceDefault: filename === MODES.system };
    }

    function systemHistoryBucket(target) {
        if (!Object.values(MODES).includes(target.filename)) return 'system_file_' + hashContent(target.path);
        return 'system_' + target.scope + '_' + (target.scope === 'project'
            ? sanitizeSystemHistoryId(path.dirname(target.path)) : 'global');
    }

    function listSystemPromptFiles(params = {}) {
        const { scope, directory } = resolveSystemPromptDirectory(params);
        try {
            let entries;
            try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
            catch (error) { if (error.code !== 'ENOENT') throw error; entries = []; }
            const files = entries.filter(entry => entry.isFile() && isValidFileName(entry.name))
                .map(entry => ({ filename: entry.name, path: path.join(directory, entry.name), exists: true }));
            for (const filename of Object.values(MODES)) {
                if (!entries.some(entry => entry.name === filename)) {
                    files.push({ filename, path: path.join(directory, filename), exists: false });
                }
            }
            const order = Object.values(MODES);
            files.sort((left, right) => {
                const rank = name => order.includes(name) ? order.indexOf(name) : order.length;
                return rank(left.filename) - rank(right.filename) || left.filename.localeCompare(right.filename);
            });
            return { scope, directory, files };
        } catch (error) { return { scope, directory, files: [], error: '读取 Pi 文件列表失败: ' + error.message }; }
    }

    function readSystemPromptFile(params = {}) {
        return readSystemPromptFilePath(resolveSystemPromptFilePath(params));
    }

    function saveSystemPromptFile(params = {}) {
        const content = typeof params.content === 'string' ? params.content : '';
        if (!content.trim()) {
            return { error: 'System prompt 不能为空' };
        }
        if (content.length > MAX_PROMPT_BYTES) {
            return { error: '内容过大（最大 2MB）' };
        }
        const target = resolveSystemPromptFilePath(params);
        if (!Object.values(MODES).includes(target.filename) && Buffer.byteLength(content, 'utf8') > MAX_PROMPT_BYTES) {
            return { error: '内容过大（最大 2MB）' };
        }
        const current = readSystemPromptFilePath(target);
        if (current.error) {
            return { error: current.error };
        }
        if (!Object.values(MODES).includes(target.filename) && !current.exists) {
            return { error: '文件不存在，请刷新文件列表' };
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
                const bucket = systemHistoryBucket(target);
                const backup = backupPromptBeforeWrite(bucket, target.path);
                if (backup && backup.error) return { error: backup.error };
                sysHistoryBucket = bucket;
            }
            const finalContent = content.endsWith('\n') ? content : content + '\n';
            writeTextAtomicWithBackup(target.path, finalContent, { fs });
            try { fs.chmodSync(target.path, 0o600); } catch (_) {}
        } catch (e) {
            return { error: '写入 system prompt 失败: ' + e.message };
        }
        const saved = readSystemPromptFilePath(target);
        if (sysHistoryBucket) saved.historyBucket = sysHistoryBucket;
        return saved;
    }

    function readSystemPromptFilePath(resolved) {
        let exists = false;
        let content = '';
        try {
            const stat = fs.lstatSync(resolved.path);
            if (!stat.isFile()) throw new Error('目标必须是普通 .md 文件，不能使用符号链接');
            if (!Object.values(MODES).includes(resolved.filename) && stat.size > MAX_PROMPT_BYTES) {
                throw new Error('内容过大（最大 2MB）');
            }
            content = fs.readFileSync(resolved.path, { encoding: 'utf8', flag: READ_FLAGS });
            exists = true;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                return { ...resolved, exists: false, content: '', hash: hashContent(''), error: '读取 system prompt 失败: ' + error.message };
            }
        }
        return { ...resolved, historyBucket: systemHistoryBucket(resolved), exists, content, hash: hashContent(content) };
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
            mode: target.mode,
            filename: target.filename
        };
    }

    return {
        listSystemPromptFiles,
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
