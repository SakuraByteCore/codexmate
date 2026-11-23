import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { extractSessionDetailPreviewFromFileFast } = require('../../lib/cli-sessions.js');
// Cross the real fast-preview threshold without replacing production dependencies.
const LARGE_SESSION_PADDING = 'x'.repeat(300 * 1024);

test('extractSessionDetailPreviewFromFileFast preserves clipped previews after fully reading a file', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-fast-preview-'));
    const filePath = path.join(tmpDir, 'session.jsonl');

    try {
        const records = [{
            padding: LARGE_SESSION_PADDING,
            type: 'session_meta',
            payload: { id: 'fast-preview-session', cwd: '/tmp/fast-preview-session' },
            timestamp: '2025-04-12T00:00:00.000Z'
        }];
        for (let i = 0; i < 5; i += 1) {
            records.push({
                type: 'response_item',
                payload: {
                    type: 'message',
                    role: i % 2 === 0 ? 'user' : 'assistant',
                    content: `message-${i}-${'x'.repeat(48)}`
                },
                timestamp: `2025-04-12T00:00:0${i + 1}.000Z`
            });
        }
        fs.writeFileSync(filePath, records.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf-8');


        const preview = extractSessionDetailPreviewFromFileFast(filePath, 'codex', 2);

        assert(preview, 'fast preview should return a preview result for large files');
        assert.strictEqual(preview.messages.length, 2, 'fast preview should keep the requested tail window');
        assert.strictEqual(preview.clipped, true, 'fast preview should preserve clipped=true after the full file is read');
        assert.strictEqual(preview.totalMessages, null, 'fast preview should keep non-exact totals for tail previews');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});

test('extractSessionDetailPreviewFromFileFast normalizes full-scan previews before returning', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-fast-preview-full-'));
    const filePath = path.join(tmpDir, 'session.jsonl');

    try {
        const records = [
            { type: 'session_meta', payload: { id: 'full-preview-session' }, padding: LARGE_SESSION_PADDING },
            {
                type: 'response_item',
                payload: {
                    type: 'message',
                    role: 'system',
                    content: 'bootstrap'
                },
                timestamp: '2025-04-12T00:00:00.000Z'
            },
            {
                type: 'response_item',
                payload: {
                    type: 'message',
                    role: 'user',
                    content: 'hello'
                },
                timestamp: '2025-04-12T00:00:01.000Z'
            },
            {
                type: 'response_item',
                payload: {
                    type: 'message',
                    role: 'assistant',
                    content: 'world'
                },
                timestamp: '2025-04-12T00:00:02.000Z'
            }
        ];
        fs.writeFileSync(filePath, records.map((record) => JSON.stringify(record)).join('\n') + '\n', 'utf-8');


        const preview = extractSessionDetailPreviewFromFileFast(filePath, 'codex', 5);

        assert(preview, 'full-scan fast preview should still return a preview');
        assert.deepStrictEqual(
            preview.messages.map((item) => item.role),
            ['user', 'assistant'],
            'full-scan previews should strip leading system/bootstrap messages'
        );
        assert.strictEqual(preview.totalMessages, 2, 'full-scan previews should restore an exact total');
        assert.strictEqual(preview.clipped, false, 'full-scan previews should not stay clipped when all messages fit');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
});
