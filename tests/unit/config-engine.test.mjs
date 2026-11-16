import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    validateProviderName,
    isValidProviderName,
    writeConfigAtomicWithBackup,
    formatConfigError
} = require('../../lib/cli-config-engine');

function createTempDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-config-engine-'));
}

test('provider name validation rejects dot, space and control characters', () => {
    for (const name of ['alpha', 'Alpha123', 'alpha_1', 'alpha-1']) {
        assert.strictEqual(isValidProviderName(name), true, name);
        assert.strictEqual(validateProviderName(name).valid, true, name);
    }
    for (const name of ['alpha.provider', 'bad name', 'bad\tname', 'bad\nname', 'bad\u0007name', 'bad/name', '名称']) {
        const result = validateProviderName(name);
        assert.strictEqual(result.valid, false, name);
        assert.strictEqual(result.code, 'INVALID_PROVIDER_NAME');
        assert.strictEqual(result.message, '名称仅支持字母/数字/_-');
    }
});

test('config write creates verified timestamp backup and atomically replaces target', () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'config.toml');
    const original = 'model_provider = "alpha"\nmodel = "m1"\n\n[model_providers.alpha]\nname = "alpha"\n';
    const next = 'model_provider = "beta"\nmodel = "m2"\n\n[model_providers.beta]\nname = "beta"\n';
    fs.writeFileSync(filePath, original, 'utf-8');

    try {
        const result = writeConfigAtomicWithBackup(filePath, next, {
            now: new Date('2026-01-02T03:04:05.006Z')
        });
        assert.strictEqual(result.backupCreated, true);
        assert.match(path.basename(result.backupPath), /^config\.toml\.codexmate-backup-\d{8}-\d{6}-\d{3}\.bak$/);
        assert.strictEqual(fs.readFileSync(result.backupPath, 'utf-8'), original);
        assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), next);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('same timestamp writes create independent backup files', () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'config.toml');
    const now = new Date('2026-01-02T03:04:05.006Z');
    fs.writeFileSync(filePath, 'model = "m1"\n', 'utf-8');

    try {
        const first = writeConfigAtomicWithBackup(filePath, 'model = "m2"\n', { now });
        const second = writeConfigAtomicWithBackup(filePath, 'model = "m3"\n', { now });
        assert.notStrictEqual(first.backupPath, second.backupPath);
        assert.strictEqual(fs.readFileSync(first.backupPath, 'utf-8'), 'model = "m1"\n');
        assert.strictEqual(fs.readFileSync(second.backupPath, 'utf-8'), 'model = "m2"\n');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('invalid new TOML is rejected before backup or target write', () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'config.toml');
    const original = 'model = "m1"\n';
    fs.writeFileSync(filePath, original, 'utf-8');

    try {
        assert.throws(
            () => writeConfigAtomicWithBackup(filePath, 'model = "broken\n'),
            error => error.code === 'CONFIG_TOML_WRITE_INVALID'
        );
        assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), original);
        assert.deepStrictEqual(fs.readdirSync(dir), ['config.toml']);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('backup failure leaves target unchanged', () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'config.toml');
    const original = 'model = "m1"\n';
    fs.writeFileSync(filePath, original, 'utf-8');
    const failingFs = Object.assign({}, fs, {
        copyFileSync() {
            throw new Error('copy failed');
        }
    });

    try {
        assert.throws(
            () => writeConfigAtomicWithBackup(filePath, 'model = "m2"\n', { fs: failingFs }),
            error => error.code === 'CONFIG_BACKUP_FAILED'
        );
        assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), original);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('write failure restores verified backup', () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'config.toml');
    const original = 'model = "m1"\n';
    fs.writeFileSync(filePath, original, 'utf-8');
    let renameCalls = 0;
    const failingFs = Object.assign({}, fs, {
        renameSync(source, target) {
            renameCalls += 1;
            if (renameCalls === 1) throw new Error('rename failed');
            return fs.renameSync(source, target);
        }
    });

    try {
        assert.throws(
            () => writeConfigAtomicWithBackup(filePath, 'model = "m2"\n', { fs: failingFs }),
            error => error.code === 'CONFIG_WRITE_FAILED' && error.rolledBack === true
        );
        assert.strictEqual(fs.readFileSync(filePath, 'utf-8'), original);
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

test('config error formatter emits stable JSON payload', () => {
    const payload = JSON.parse(formatConfigError({
        code: 'CONFIG_TOML_PARSE_ERROR',
        type: 'parse',
        path: '/tmp/config.toml',
        publicReason: 'config.toml 解析失败',
        detail: 'bad token'
    }));
    assert.deepStrictEqual(payload, {
        error: {
            code: 'CONFIG_TOML_PARSE_ERROR',
            type: 'parse',
            path: '/tmp/config.toml',
            message: 'config.toml 解析失败',
            detail: 'bad token'
        }
    });
});
