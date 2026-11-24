'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const MAX_STORE_BYTES = 5 * 1024 * 1024;
const digest = (text) => crypto.createHash('sha256').update(text).digest('hex');

function createLocalFeatureStore(filePath, initial) {
    function read() {
        try {
            const stat = fs.lstatSync(filePath);
            if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_STORE_BYTES) throw new Error('feature-store-invalid');
            const text = fs.readFileSync(filePath, 'utf8');
            const value = JSON.parse(text);
            if (value.version !== initial.version) throw new Error('feature-store-invalid');
            return { value, revision: digest(text) };
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
            return { value: JSON.parse(JSON.stringify(initial)), revision: '' };
        }
    }
    function write(value, revision) {
        if (read().revision !== revision) throw new Error('feature-store-conflict');
        const text = JSON.stringify(value) + '\n';
        if (Buffer.byteLength(text) > MAX_STORE_BYTES) throw new Error('feature-store-full');
        fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
        const temporary = `${filePath}.${crypto.randomBytes(12).toString('hex')}.tmp`;
        try {
            fs.writeFileSync(temporary, text, { mode: 0o600, flag: 'wx' });
            if (read().revision !== revision) throw new Error('feature-store-conflict');
            fs.renameSync(temporary, filePath);
        } finally {
            if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        }
        return { value, revision: digest(text) };
    }
    return { read, write };
}
module.exports = { createLocalFeatureStore, digest };
