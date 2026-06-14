import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const searchScript = path.join(projectRoot, 'skills', 'codexmate-cross-session-search', 'scripts', 'search_sessions.py');

function hasPython3() {
    try {
        execFileSync('python3', ['--version'], { stdio: 'ignore' });
        return true;
    } catch (_err) {
        return false;
    }
}

test('cross-session search skill script finds local session evidence', () => {
    if (!hasPython3()) return;

    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-skill-search-'));
    try {
        const codexDir = path.join(tempHome, '.codex', 'sessions', '2026', '06', '14');
        const claudeDir = path.join(tempHome, '.claude', 'projects', '-tmp-project');
        fs.mkdirSync(codexDir, { recursive: true });
        fs.mkdirSync(claudeDir, { recursive: true });

        fs.writeFileSync(path.join(codexDir, 'codex-session.jsonl'), [
            JSON.stringify({ cwd: '/work/SakuraByteCore/codexmate', title: 'codexmate PR search' }),
            JSON.stringify({ role: 'user', content: 'Investigate SakuraByteCore/codexmate PR 197 cross-session search skill' })
        ].join('\n'));
        fs.writeFileSync(path.join(claudeDir, 'claude-session.jsonl'), JSON.stringify({
            cwd: '/work/other',
            content: 'Unrelated Claude Code session'
        }));

        const output = execFileSync('python3', [
            searchScript,
            'SakuraByteCore/codexmate PR 197',
            '--source', 'all',
            '--match', 'all',
            '--path-filter', 'SakuraByteCore/codexmate',
            '--format', 'json',
            '--limit', '5'
        ], {
            cwd: projectRoot,
            env: { ...process.env, HOME: tempHome },
            encoding: 'utf8'
        });
        const parsed = JSON.parse(output);
        assert.ok(Array.isArray(parsed.hits), 'script should return hits array');
        assert.equal(parsed.hits.length, 1, 'script should find only the matching fixture session');
        assert.equal(parsed.hits[0].source, 'codex');
        assert.ok(parsed.hits[0].snippets.some(snippet => snippet.includes('PR 197')));

        const missOutput = execFileSync('python3', [
            searchScript,
            'completely-nonexistent-token-zzq-197',
            '--source', 'all',
            '--match', 'all',
            '--path-filter', 'SakuraByteCore/codexmate',
            '--format', 'json',
            '--limit', '5'
        ], {
            cwd: projectRoot,
            env: { ...process.env, HOME: tempHome },
            encoding: 'utf8'
        });
        const missParsed = JSON.parse(missOutput);
        assert.deepEqual(missParsed.hits, [], 'hyphenated unknown terms must not match just because one split part appears');
    } finally {
        fs.rmSync(tempHome, { recursive: true, force: true });
    }
});
