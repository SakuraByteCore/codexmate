'use strict';

function createPromptHistoryController(deps = {}) {
    const {
        fs,
        path,
        CONFIG_DIR,
        MAX_HISTORY = 20
    } = deps;

    if (!fs) throw new Error('createPromptHistoryController 缺少 fs');
    if (!path) throw new Error('createPromptHistoryController 缺少 path');
    if (typeof CONFIG_DIR !== 'string' || !CONFIG_DIR) throw new Error('createPromptHistoryController 缺少 CONFIG_DIR');

    const HISTORY_ROOT = path.join(CONFIG_DIR, 'codexmate-prompt-history');
    const STAMP_RE = /^(\d{8})-(\d{6})-(\d{3})\.bak$/;

    function sanitizeBucket(bucket) {
        const raw = typeof bucket === 'string' ? bucket.trim() : '';
        if (!raw) throw new Error('prompt history bucket 不能为空');
        const safe = raw.replace(/[^A-Za-z0-9_.-]/g, '_');
        if (!safe) throw new Error('prompt history bucket 无效: ' + bucket);
        return safe;
    }

    function resolveBucketDir(bucket) {
        const safe = sanitizeBucket(bucket);
        return path.join(HISTORY_ROOT, safe);
    }

    function buildTimestamp(d = new Date()) {
        const pad2 = (n) => String(n).padStart(2, '0');
        const pad3 = (n) => String(n).padStart(3, '0');
        return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`
            + `-${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
            + `-${pad3(d.getMilliseconds())}`;
    }

    function parseStamp(name) {
        return STAMP_RE.test(name) ? name.slice(0, name.length - 4) : null;
    }

    function ensureDirSync(dir) {
        fs.mkdirSync(dir, { recursive: true });
    }

    function rmtreeSync(dir) {
        try {
            fs.rmSync(dir, { recursive: true, force: true });
        } catch (_) {}
    }

    function backupPromptBeforeWrite(bucket, currentFilePath) {
        const dir = resolveBucketDir(bucket);
        const exists = fs.existsSync(currentFilePath);
        if (!exists) return { backedUp: false, entries: listPromptHistory(bucket) };
        let raw;
        try {
            raw = fs.readFileSync(currentFilePath, 'utf-8');
        } catch (e) {
            return { backedUp: false, error: '读取当前文件失败: ' + e.message };
        }
        ensureDirSync(dir);
        const stamp = buildTimestamp();
        const dest = path.join(dir, stamp + '.bak');
        try {
            fs.writeFileSync(dest, raw, 'utf-8');
        } catch (e) {
            return { backedUp: false, error: '写入备份失败: ' + e.message };
        }
        trimHistory(dir);
        return { backedUp: true, entries: listPromptHistory(bucket) };
    }

    function listPromptHistory(bucket) {
        const dir = resolveBucketDir(bucket);
        if (!fs.existsSync(dir)) return [];
        let names;
        try {
            names = fs.readdirSync(dir);
        } catch (_) {
            return [];
        }
        const items = [];
        for (const name of names) {
            const stamp = parseStamp(name);
            if (!stamp) continue;
            let stat;
            try {
                stat = fs.statSync(path.join(dir, name));
            } catch (_) {
                continue;
            }
            items.push({
                id: stamp,
                bucket: sanitizeBucket(bucket),
                size: Number(stat.size) || 0,
                mtimeMs: Number(stat.mtimeMs) || 0
            });
        }
        items.sort((a, b) => b.mtimeMs - a.mtimeMs);
        return items;
    }

    function readPromptHistory(bucket, id) {
        const dir = resolveBucketDir(bucket);
        const stamp = typeof id === 'string' ? id.trim() : '';
        const fullName = stamp + '.bak';
        if (!stamp || !STAMP_RE.test(fullName)) {
            return { error: 'history id invalid' };
        }
        const file = path.join(dir, fullName);
        if (!fs.existsSync(file)) return { error: 'history entry 不存在' };
        try {
            const content = fs.readFileSync(file, 'utf-8');
            return { id: stamp, content, bucket: sanitizeBucket(bucket) };
        } catch (e) {
            return { error: '读取 history 失败: ' + e.message };
        }
    }

    function trimHistory(dir) {
        let names;
        try {
            names = fs.readdirSync(dir);
        } catch (_) {
            return;
        }
        const stamped = [];
        for (const name of names) {
            const stamp = parseStamp(name);
            if (!stamp) continue;
            let stat;
            try {
                stat = fs.statSync(path.join(dir, name));
            } catch (_) {
                continue;
            }
            stamped.push({ name, mtimeMs: Number(stat.mtimeMs) || 0 });
        }
        stamped.sort((a, b) => b.mtimeMs - a.mtimeMs);
        if (stamped.length <= MAX_HISTORY) return;
        for (let i = MAX_HISTORY; i < stamped.length; i++) {
            try {
                fs.unlinkSync(path.join(dir, stamped[i].name));
            } catch (_) {}
        }
    }

    function clearPromptHistory(bucket) {
        if (!bucket) {
            rmtreeSync(HISTORY_ROOT);
            return { cleared: true };
        }
        const dir = resolveBucketDir(bucket);
        rmtreeSync(dir);
        return { cleared: true };
    }

    return {
        sanitizeBucket,
        backupPromptBeforeWrite,
        listPromptHistory,
        readPromptHistory,
        clearPromptHistory
    };
}

module.exports = {
    createPromptHistoryController
};
