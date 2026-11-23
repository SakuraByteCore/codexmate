'use strict';

const nativeFs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();
const hash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

function snapshot(filePath, fs = nativeFs, options = {}) {
    try {
        const stat = options.allowSymlinks ? fs.statSync(filePath) : fs.lstatSync(filePath);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`配置目标不是普通文件: ${filePath}`);
        const buffer = fs.readFileSync(filePath);
        return { exists: true, buffer, hash: hash(buffer), mode: stat.mode & 0o777 };
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        return { exists: false, buffer: null, hash: '', mode: 0o600 };
    }
}

function getEntry(store, filePath) {
    const key = path.resolve(filePath);
    if (!store.files.has(key)) {
        if (nativeFs.existsSync(key) && nativeFs.statSync(key).size > store.maxFileBytes) throw new Error('配置文件超过预览容量');
        const before = snapshot(key, nativeFs, { allowSymlinks: store.allowSymlinks });
        store.files.set(key, { path: key, before, after: before.buffer, mode: before.mode, written: false });
    }
    return store.files.get(key);
}

function missing(filePath) {
    const error = new Error(`ENOENT: ${filePath}`);
    error.code = 'ENOENT';
    throw error;
}

const stagedMethods = {
    existsSync(store, filePath) {
        const key = path.resolve(filePath);
        if (store.directories.has(key)) return true;
        if (nativeFs.existsSync(key) && nativeFs.statSync(key).isDirectory()) return true;
        return getEntry(store, key).after !== null;
    },
    readFileSync(store, filePath, options) {
        const entry = getEntry(store, filePath);
        if (entry.after === null) return missing(filePath);
        const encoding = typeof options === 'string' ? options : options && options.encoding;
        return encoding ? entry.after.toString(encoding) : Buffer.from(entry.after);
    },
    writeFileSync(store, filePath, content, options) {
        const entry = getEntry(store, filePath);
        const encoding = typeof options === 'string' ? options : options && options.encoding;
        const buffer = Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(String(content), encoding || 'utf8');
        if (buffer.length > store.maxFileBytes) throw new Error('配置文件超过预览容量');
        entry.after = buffer;
        if (!entry.before.exists && options && typeof options === 'object' && options.mode !== undefined) entry.mode = options.mode;
        entry.written = true;
    },
    mkdirSync(store, filePath) {
        let dir = path.resolve(filePath);
        while (!nativeFs.existsSync(dir)) {
            store.directories.add(dir);
            const observed = store.files.get(dir);
            if (observed && !observed.written && !observed.before.exists) store.files.delete(dir);
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
        }
    },
    statSync(store, filePath) {
        const key = path.resolve(filePath);
        if (nativeFs.existsSync(key) && !store.files.has(key)) return nativeFs.statSync(key);
        if (store.directories.has(key)) return { isDirectory: () => true, isFile: () => false, mode: 0o700 };
        const entry = getEntry(store, key);
        if (entry.after === null) return missing(filePath);
        return { isFile: () => true, isDirectory: () => false, mode: entry.mode, size: entry.after.length, mtimeMs: Date.now() };
    },
    readdirSync(store, filePath, options) {
        const key = path.resolve(filePath);
        if (!nativeFs.existsSync(key) && !store.directories.has(key)) return missing(filePath);
        if (options && options.withFileTypes) throw new Error('配置预览不支持目录对象读取');
        const names = new Set(nativeFs.existsSync(key) ? nativeFs.readdirSync(key) : []);
        for (const entry of store.files.values()) {
            if (path.dirname(entry.path) !== key) continue;
            if (entry.after === null) names.delete(path.basename(entry.path));
            else names.add(path.basename(entry.path));
        }
        return [...names];
    },
    chmodSync(store, filePath, mode) {
        const entry = getEntry(store, filePath);
        // Existing user permissions are never broadened by a previewed write.
        if (!entry.before.exists) entry.mode = mode;
    },
    unlinkSync(store, filePath) {
        const entry = getEntry(store, filePath);
        entry.after = null;
        entry.written = true;
    },
    copyFileSync(store, source, target) {
        stagedMethods.writeFileSync(store, target, stagedMethods.readFileSync(store, source));
    },
    renameSync(store, source, target) {
        stagedMethods.copyFileSync(store, source, target);
        stagedMethods.unlinkSync(store, source);
    }
};
const mutationPattern = /^(write|append|copy|rename|unlink|mkdir|rmdir|rm|chmod|chown|truncate|open|createWrite|symlink|link|utimes)/;

const fs = new Proxy(nativeFs, {
    get(target, name) {
        const original = target[name];
        if (typeof original !== 'function') return original;
        return (...args) => {
            const store = storage.getStore();
            if (!store) return original.apply(target, args);
            if (stagedMethods[name]) return stagedMethods[name](store, ...args);
            if (mutationPattern.test(name)) throw new Error(`配置预览不支持文件操作: ${name}`);
            return original.apply(target, args);
        };
    }
});

async function stageConfigWrites(callback, options = {}) {
    const store = { files: new Map(), directories: new Set(), maxFileBytes: options.maxFileBytes === undefined ? 4 * 1024 * 1024 : options.maxFileBytes, allowSymlinks: options.allowSymlinks === true };
    const result = await storage.run(store, callback);
    return { result, files: [...store.files.values()] };
}

module.exports = { fs, snapshot, hash, stageConfigWrites, isConfigStaging: () => !!storage.getStore() };
