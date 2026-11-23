'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const JSON5 = require('json5');
const toml = require('@iarna/toml');
const { snapshot, hash, stageConfigWrites } = require('./config-change-fs');
const { writeTextAtomicWithBackup } = require('./cli-config-engine');
const { buildLineDiff } = require('./text-diff');

const PREVIEW_TTL_MS = 5 * 60 * 1000;
const MAX_PREVIEWS = 20;
const MAX_PLAN_BYTES = 16 * 1024 * 1024;
const SECRET_KEY = /api.?key|auth.?token|authorization|password|passwd|secret|credential|bearer|cookie|session|private.?key|preferred_auth_method|(^|_)(access|refresh|id)[_-]?token$|^(key|token|access|refresh)$/i;

function parseConfig(buffer) {
    const text = buffer ? buffer.toString('utf8').replace(/^\uFEFF/, '') : '';
    if (!text.trim()) return {};
    try { return JSON5.parse(text); } catch (_) { return toml.parse(text); }
}

function redactConfig(value, secrets) {
    if (Array.isArray(value)) return value.map(item => redactConfig(item, secrets));
    if (typeof value === 'string') {
        if (/^(?:bearer\s+|sk[-_]|gsk_|AIza|xox[baprs]-|gh[pousr]_)/i.test(value)) { secrets.add(value); return '[REDACTED]'; }
        if (/^https?:\/\//i.test(value)) {
            const url = new URL(value);
            if (url.username) url.username = '[REDACTED]';
            if (url.password) url.password = '[REDACTED]';
            for (const key of [...url.searchParams.keys()]) if (SECRET_KEY.test(key)) url.searchParams.set(key, '[REDACTED]');
            return url.toString();
        }
        return value;
    }
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
        if (SECRET_KEY.test(key)) {
            const collect = (entry) => {
                if (typeof entry === 'string' && entry) secrets.add(entry);
                else if (entry && typeof entry === 'object') Object.values(entry).forEach(collect);
            };
            collect(item);
            return [key, '[REDACTED]'];
        }
        return [key, redactConfig(item, secrets)];
    }));
}

function buildPreviewFile(entry) {
    const secrets = new Set();
    let before;
    let after;
    let hidden = false;
    try {
        before = JSON.stringify(redactConfig(parseConfig(entry.before.buffer), secrets), null, 2);
        after = JSON.stringify(redactConfig(parseConfig(entry.after), secrets), null, 2);
    } catch (_) {
        before = after = '[内容无法安全解析，已隐藏]';
        hidden = true;
    }
    // Also remove a credential repeated in a URL, comment or a non-secret field.
    for (const secret of [...secrets].sort((a, b) => b.length - a.length)) {
        const escaped = JSON.stringify(secret).slice(1, -1);
        before = before.split(escaped).join('[REDACTED]');
        after = after.split(escaped).join('[REDACTED]');
    }
    return {
        path: entry.path,
        operation: !entry.before.exists ? 'create' : (entry.after === null ? 'delete' : 'modify'),
        hidden,
        maskedOnly: before === after,
        diff: buildLineDiff(before, after)
    };
}

function configChangeError(code, message, extra = {}) {
    return { error: message, errorCode: code, ...extra };
}

function atomicBuffer(filePath, buffer, mode, fsImpl) {
    fsImpl.mkdirSync(path.dirname(filePath), { recursive: true });
    const temp = `${filePath}.tmp-config-change-${crypto.randomBytes(8).toString('hex')}`;
    try {
        fsImpl.writeFileSync(temp, buffer, { mode, flag: 'wx' });
        fsImpl.chmodSync(temp, mode);
        fsImpl.renameSync(temp, filePath);
        if (hash(fsImpl.readFileSync(filePath)) !== hash(buffer)) throw new Error('写入校验失败');
    } finally {
        if (fsImpl.existsSync(temp)) fsImpl.unlinkSync(temp);
    }
}

function createConfigChanges(options) {
    const fsImpl = options.fs || fs;
    const plans = new Map();
    let busy = false;
    const now = options.now || Date.now;
    const journalPath = options.journalPath;

    function readJournal() {
        if (!fsImpl.existsSync(journalPath)) return {};
        const data = JSON.parse(fsImpl.readFileSync(journalPath, 'utf8'));
        if (!data || data.version !== 1 || !data.changes || typeof data.changes !== 'object') throw new Error('变更记录无效');
        return data.changes;
    }
    function writeJournal(changes) {
        atomicBuffer(journalPath, Buffer.from(JSON.stringify({ version: 1, changes }, null, 2) + '\n'), 0o600, fsImpl);
    }
    function publicChange(change) {
        if (!change) return null;
        return { id: change.id, target: change.target, action: change.action, createdAt: change.createdAt, files: change.files.map(item => ({ path: item.path })) };
    }
    function publicBaseline(entries) {
        return entries.map(entry => {
            const current = snapshot(entry.path, fsImpl);
            return { path: entry.path, exists: current.exists, hash: current.hash, mode: current.mode };
        });
    }
    function permission(target) {
        return options.isAllowed(target) ? null : configChangeError('tool-config-write-disabled', '配置写入权限未开启', { target });
    }
    function checkFile(entry, expected) {
        if (!options.isPathAllowed(entry.path)) throw new Error('配置路径超出允许范围');
        const current = snapshot(entry.path, fsImpl);
        if (current.exists !== expected.exists || current.hash !== expected.hash || (current.exists && current.mode !== expected.mode)) {
            const error = new Error('配置已被外部修改，请刷新后重新预览');
            error.code = 'config-change-conflict';
            error.path = entry.path;
            throw error;
        }
    }
    function prunePlans() {
        for (const [id, plan] of plans) if (plan.expiresAt <= now()) plans.delete(id);
        while (plans.size >= MAX_PREVIEWS) plans.delete(plans.keys().next().value);
    }

    async function preview(params = {}) {
        if (busy) return configChangeError('config-change-busy', '已有配置变更正在执行');
        const action = params.action;
        const target = options.getTarget(action);
        if (!target) return configChangeError('config-change-unsupported', '该操作不支持配置预览');
        const denied = permission(target);
        if (denied) return denied;
        try {
            const staged = await stageConfigWrites(() => options.execute(action, params.params || {}));
            if (!staged.result || staged.result.error || staged.result.success === false) return configChangeError('config-change-invalid', '配置校验失败，请检查输入格式与必填字段');
            for (const entry of staged.files) if (entry.written && !options.isPathAllowed(entry.path)) throw new Error('配置路径超出允许范围');
            if (Array.isArray(params.baseline)) {
                for (const entry of staged.files) {
                    const expected = params.baseline.find(item => item.path === entry.path);
                    if (expected) checkFile(entry, expected);
                }
            }
            const bytes = staged.files.reduce((total, entry) => total + (entry.before.buffer ? entry.before.buffer.length : 0) + (entry.after ? entry.after.length : 0), 0);
            if (bytes > MAX_PLAN_BYTES) return configChangeError('config-change-too-large', '配置变更超过预览容量');
            const files = staged.files.filter(entry => entry.written && (entry.after === null ? entry.before.exists : (!entry.before.exists || hash(entry.after) !== entry.before.hash)));
            const plan = { id: crypto.randomBytes(24).toString('hex'), action, target, files, reads: staged.files.filter(entry => options.isPathAllowed(entry.path)), result: staged.result, expiresAt: now() + PREVIEW_TTL_MS };
            prunePlans();
            plan.bytes = bytes;
            while ([...plans.values()].reduce((total, item) => total + item.bytes, bytes) > MAX_PLAN_BYTES) plans.delete(plans.keys().next().value);
            plans.set(plan.id, plan);
            return { previewId: plan.id, target, action, expiresAt: plan.expiresAt, hasChanges: files.length > 0, files: files.map(buildPreviewFile) };
        } catch (error) {
            if (error.code === 'config-change-conflict') return configChangeError(error.code, error.message, { path: error.path });
            return configChangeError('config-change-invalid', '无法预览配置，请检查文件与输入格式');
        }
    }

    function restoreEntries(entries) {
        const failed = [];
        for (const entry of [...entries].reverse()) {
            try {
                // Never roll back a subsequent external edit.
                checkFile(entry, entry.writtenState);
                if (entry.before.exists) atomicBuffer(entry.path, entry.before.buffer, entry.before.mode, fsImpl);
                else if (fsImpl.existsSync(entry.path)) fsImpl.unlinkSync(entry.path);
            } catch (_) { failed.push(entry.path); }
        }
        return failed;
    }

    async function apply(params = {}) {
        if (busy) return configChangeError('config-change-busy', '已有配置变更正在执行');
        const plan = plans.get(params.previewId);
        if (!plan || plan.expiresAt <= now()) return configChangeError('config-change-expired', '预览已失效，请重新预览');
        const denied = permission(plan.target);
        if (denied) return denied;
        busy = true;
        const applied = [];
        let runtimeState;
        let runtimeTouched = false;
        try {
            const changes = readJournal();
            for (const entry of plan.reads) checkFile(entry, entry.before);
            if (!plan.files.length) { plans.delete(plan.id); return { ...plan.result, success: true, noChanges: true }; }
            runtimeState = options.runtimeState ? options.runtimeState(plan) : null;
            for (const entry of plan.files) {
                checkFile(entry, entry.before);
                if (options.beforeWrite) options.beforeWrite(plan, entry);
                const result = writeTextAtomicWithBackup(entry.path, (entry.after || entry.before.buffer).toString('utf8'), { fs: fsImpl });
                if (entry.after === null) fsImpl.unlinkSync(entry.path);
                applied.push({ ...entry, backupPath: result ? result.backupPath : '', writtenState: snapshot(entry.path, fsImpl) });
            }
            if (options.reconcileRuntime) {
                runtimeTouched = true;
                await options.reconcileRuntime(plan, false, runtimeState);
            }
            for (const entry of applied) checkFile(entry, entry.writtenState);
            const change = {
                id: crypto.randomBytes(24).toString('hex'), target: plan.target, action: plan.action,
                createdAt: new Date(now()).toISOString(), runtimeState,
                files: applied.map(entry => ({ path: entry.path, backupPath: entry.backupPath, before: { exists: entry.before.exists, hash: entry.before.hash, mode: entry.before.mode }, after: entry.writtenState.exists ? { exists: true, hash: entry.writtenState.hash, mode: entry.writtenState.mode } : { exists: false, hash: '', mode: 0o600 } }))
            };
            const baseline = publicBaseline(plan.reads);
            changes[plan.target] = change;
            writeJournal(changes);
            plans.delete(plan.id);
            return { ...plan.result, success: true, change: publicChange(change), configChangeTarget: plan.target, configChangeBaseline: baseline };
        } catch (error) {
            const rollbackFailed = restoreEntries(applied);
            if (error.rollbackFailed) rollbackFailed.push(error.path || 'config-write');
            if (runtimeTouched && options.reconcileRuntime) {
                try { await options.reconcileRuntime(plan, true, runtimeState); } catch (_) { rollbackFailed.push('claude-runtime'); }
            }
            return configChangeError(error.code === 'config-change-conflict' ? error.code : 'config-change-write-failed', error.code === 'config-change-conflict' ? error.message : '配置变更失败，已尝试恢复原内容', { path: error.path || '', rollbackFailed, rolledBack: rollbackFailed.length === 0 });
        } finally { busy = false; }
    }

    function last(params = {}) {
        if (!options.isTarget(params.target)) return configChangeError('config-change-invalid', '配置目标无效');
        try { return { change: publicChange(readJournal()[params.target]) }; }
        catch (_) { return configChangeError('config-change-history-invalid', '无法读取最近一次变更记录'); }
    }

    async function undo(params = {}) {
        if (busy) return configChangeError('config-change-busy', '已有配置变更正在执行');
        if (!options.isTarget(params.target)) return configChangeError('config-change-invalid', '配置目标无效');
        const denied = permission(params.target);
        if (denied) return denied;
        busy = true;
        const restored = [];
        let change;
        let runtimeState;
        let runtimeTouched = false;
        try {
            const changes = readJournal();
            change = changes[params.target];
            if (!change || change.id !== params.changeId) return configChangeError('config-change-expired', '撤销记录已失效，请刷新');
            const entries = change.files.map(item => {
                checkFile(item, item.after);
                let buffer = null;
                if (item.before.exists) {
                    if (!item.backupPath || path.dirname(item.backupPath) !== path.dirname(item.path) || !path.basename(item.backupPath).startsWith(path.basename(item.path) + '.codexmate-backup-')) throw new Error('备份路径无效');
                    buffer = fsImpl.readFileSync(item.backupPath);
                    if (hash(buffer) !== item.before.hash) throw new Error('备份校验失败');
                }
                return { ...item, buffer, current: snapshot(item.path, fsImpl) };
            });
            runtimeState = options.runtimeState ? options.runtimeState(change) : null;
            for (const entry of entries) {
                checkFile(entry, entry.after);
                const restoreEntry = { path: entry.path, before: entry.current, writtenState: { exists: entry.buffer !== null, hash: entry.buffer ? hash(entry.buffer) : '', mode: entry.before.mode } };
                try {
                    if (entry.buffer === null) fsImpl.unlinkSync(entry.path);
                    else atomicBuffer(entry.path, entry.buffer, entry.before.mode, fsImpl);
                } finally {
                    const current = snapshot(entry.path, fsImpl);
                    if (current.exists === restoreEntry.writtenState.exists && current.hash === restoreEntry.writtenState.hash) restored.push(restoreEntry);
                }
            }
            if (options.reconcileRuntime) {
                runtimeTouched = true;
                await options.reconcileRuntime(change, true, change.runtimeState);
            }
            for (const entry of restored) checkFile(entry, entry.writtenState);
            const baseline = publicBaseline(change.files);
            delete changes[params.target];
            writeJournal(changes);
            return { success: true, target: params.target, configChangeTarget: params.target, configChangeBaseline: baseline };
        } catch (error) {
            const rollbackFailed = restoreEntries(restored);
            if (runtimeTouched && options.reconcileRuntime) {
                try { await options.reconcileRuntime(change, true, runtimeState); } catch (_) { rollbackFailed.push('claude-runtime'); }
            }
            return configChangeError(error.code || 'config-change-undo-failed', error.code === 'config-change-conflict' ? error.message : '撤销失败，已保留当前配置', { path: error.path || '', rollbackFailed, rolledBack: rollbackFailed.length === 0 });
        } finally { busy = false; }
    }

    return { preview, apply, last, undo, isBusy: () => busy };
}

module.exports = { createConfigChanges, buildPreviewFile, PREVIEW_TTL_MS };
