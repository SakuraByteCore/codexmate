const crypto = require('crypto');
const { fs, isConfigStaging } = require('./config-change-fs');
const path = require('path');
const toml = require('@iarna/toml');

const PROVIDER_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;
const PROVIDER_NAME_MESSAGE = '名称仅支持字母/数字/_-';

function normalizeProviderName(name) {
    return typeof name === 'string' ? name.trim() : '';
}

function validateProviderName(name) {
    const normalized = normalizeProviderName(name);
    if (!normalized) {
        return {
            valid: false,
            code: 'INVALID_PROVIDER_NAME',
            field: 'name',
            message: '名称不能为空',
            name: normalized
        };
    }
    if (!PROVIDER_NAME_PATTERN.test(normalized)) {
        return {
            valid: false,
            code: 'INVALID_PROVIDER_NAME',
            field: 'name',
            message: PROVIDER_NAME_MESSAGE,
            name: normalized
        };
    }
    return {
        valid: true,
        code: '',
        field: '',
        message: '',
        name: normalized
    };
}

function isValidProviderName(name) {
    return validateProviderName(name).valid;
}

function validateProviderNamesInParsedConfig(parsed) {
    const activeProvider = parsed && typeof parsed.model_provider === 'string' ? parsed.model_provider.trim() : '';
    if (activeProvider && !isValidProviderName(activeProvider)) {
        return { error: `当前 provider 名称非法: ${activeProvider}（名称仅支持字母/数字/_-）` };
    }
    const providers = parsed && typeof parsed.model_providers === 'object' && parsed.model_providers !== null
        ? parsed.model_providers
        : {};
    for (const name of Object.keys(providers)) {
        if (!isValidProviderName(name)) {
            return { error: `provider 名称非法: ${name}（名称仅支持字母/数字/_-）` };
        }
    }
    return null;
}

function createConfigError(options = {}) {
    const error = new Error(options.detail || options.message || '配置操作失败');
    error.code = options.code || 'CONFIG_ERROR';
    error.type = options.type || 'config';
    error.path = options.path || '';
    error.publicReason = options.message || error.message;
    error.detail = options.detail || error.message;
    error.backupPath = options.backupPath || '';
    error.rolledBack = options.rolledBack === true;
    error.rollbackFailed = options.rollbackFailed === true;
    return error;
}

function formatConfigError(error) {
    const payload = {
        error: {
            code: error && error.code ? error.code : 'CONFIG_ERROR',
            type: error && error.type ? error.type : 'config',
            path: error && error.path ? error.path : '',
            message: error && error.publicReason ? error.publicReason : (error && error.message ? error.message : '配置操作失败'),
            detail: error && error.detail ? error.detail : (error && error.message ? error.message : '配置操作失败')
        }
    };
    if (error && error.backupPath) payload.error.backupPath = error.backupPath;
    if (error && typeof error.rolledBack === 'boolean') payload.error.rolledBack = error.rolledBack;
    if (error && error.rollbackFailed === true) payload.error.rollbackFailed = true;
    return JSON.stringify(payload);
}

function hashBuffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

function formatBackupTimestamp(value) {
    const date = value instanceof Date && !Number.isNaN(value.getTime()) ? value : new Date();
    const pad = (num) => String(num).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        '-',
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds()),
        '-',
        String(date.getMilliseconds()).padStart(3, '0')
    ].join('');
}

function createBackupPath(filePath, fsImpl, now) {
    const dirPath = path.dirname(filePath);
    const baseName = path.basename(filePath);
    const timestamp = formatBackupTimestamp(now);
    const prefix = `${baseName}.codexmate-backup-${timestamp}`;
    let backupPath = path.join(dirPath, `${prefix}.bak`);
    let suffix = 1;
    while (fsImpl.existsSync(backupPath)) {
        backupPath = path.join(dirPath, `${prefix}-${suffix}.bak`);
        suffix += 1;
    }
    return backupPath;
}

function ensureAtomicTargetWritable(filePath, fsImpl) {
    if (!fsImpl.existsSync(filePath)) return 0o600;
    return fsImpl.statSync(filePath).mode & 0o777;
}

function syncFile(filePath, fsImpl) {
    let fd = null;
    try {
        fd = fsImpl.openSync(filePath, 'r');
        fsImpl.fsyncSync(fd);
    } catch (_) {
    } finally {
        if (fd !== null) {
            try { fsImpl.closeSync(fd); } catch (_) {}
        }
    }
}

function writeBufferAtomically(filePath, buffer, mode, fsImpl) {
    const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    try {
        fsImpl.writeFileSync(tmpPath, buffer, { encoding: 'utf-8', mode });
        fsImpl.chmodSync(tmpPath, mode);
        syncFile(tmpPath, fsImpl);
        fsImpl.renameSync(tmpPath, filePath);
    } catch (error) {
        if (fsImpl.existsSync(tmpPath)) {
            try { fsImpl.unlinkSync(tmpPath); } catch (_) {}
        }
        throw error;
    }
}

function writeConfigAtomicWithBackup(filePath, content, options = {}) {
    const tomlImpl = options.toml || toml;
    const text = typeof content === 'string' ? content : String(content || '');

    try {
        tomlImpl.parse(text);
    } catch (error) {
        throw createConfigError({
            code: 'CONFIG_TOML_WRITE_INVALID',
            type: 'parse',
            path: filePath,
            message: '待写入的 config.toml 无效',
            detail: error && error.message ? error.message : String(error)
        });
    }

    return writeTextAtomicWithBackup(filePath, text, options);
}

function writeTextAtomicWithBackup(filePath, content, options = {}) {
    const fsImpl = options.fs || fs;
    const now = options.now instanceof Date ? options.now : new Date();
    const text = typeof content === 'string' ? content : String(content || '');
    if (isConfigStaging() && fsImpl === fs) {
        fsImpl.writeFileSync(filePath, text, 'utf8');
        return { path: filePath, backupPath: '', backupCreated: false };
    }
    fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
    const targetExists = fsImpl.existsSync(filePath);
    const originalBuffer = targetExists ? fsImpl.readFileSync(filePath) : null;
    const originalHash = originalBuffer ? hashBuffer(originalBuffer) : '';
    let backupPath = '';

    if (targetExists) {
        backupPath = createBackupPath(filePath, fsImpl, now);
        try {
            fsImpl.copyFileSync(filePath, backupPath);
            const backupBuffer = fsImpl.readFileSync(backupPath);
            if (hashBuffer(backupBuffer) !== originalHash) {
                throw new Error('备份文件校验失败');
            }
        } catch (error) {
            throw createConfigError({
                code: 'CONFIG_BACKUP_FAILED',
                type: 'backup',
                path: filePath,
                message: '创建配置备份失败',
                detail: error && error.message ? error.message : String(error),
                backupPath
            });
        }
    }

    const nextBuffer = Buffer.from(text, 'utf-8');
    const nextHash = hashBuffer(nextBuffer);
    const mode = ensureAtomicTargetWritable(filePath, fsImpl);

    try {
        writeBufferAtomically(filePath, nextBuffer, mode, fsImpl);
        const writtenBuffer = fsImpl.readFileSync(filePath);
        if (hashBuffer(writtenBuffer) !== nextHash) {
            throw new Error('写入结果校验失败');
        }
    } catch (error) {
        let rolledBack = false;
        let rollbackFailed = false;
        if (targetExists && backupPath) {
            try {
                const backupBuffer = fsImpl.readFileSync(backupPath);
                writeBufferAtomically(filePath, backupBuffer, mode, fsImpl);
                const restoredBuffer = fsImpl.readFileSync(filePath);
                rolledBack = hashBuffer(restoredBuffer) === originalHash;
                rollbackFailed = !rolledBack;
            } catch (_) {
                rollbackFailed = true;
            }
        } else if (!targetExists && fsImpl.existsSync(filePath)) {
            try {
                fsImpl.unlinkSync(filePath);
                rolledBack = true;
            } catch (_) {
                rollbackFailed = true;
            }
        }
        throw createConfigError({
            code: 'CONFIG_WRITE_FAILED',
            type: 'write',
            path: filePath,
            message: '写入配置失败',
            detail: error && error.message ? error.message : String(error),
            backupPath,
            rolledBack,
            rollbackFailed
        });
    }

    return {
        backupPath,
        backupCreated: !!backupPath,
        path: filePath
    };
}

module.exports = {
    PROVIDER_NAME_PATTERN,
    PROVIDER_NAME_MESSAGE,
    validateProviderName,
    validateProviderNamesInParsedConfig,
    isValidProviderName,
    createConfigError,
    formatConfigError,
    writeConfigAtomicWithBackup,
    writeTextAtomicWithBackup
};
