import test from 'node:test';
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const searchScript = path.join(projectRoot, 'skills', 'codexmate-project-context-recovery', 'scripts', 'search_sessions.py');

function hasPython3() {
    try {
        execFileSync('python3', ['--version'], { stdio: 'ignore' });
        return true;
    } catch (_err) {
        return false;
    }
}

function runSearch(args, tempHome) {
    return execFileSync('python3', [searchScript, ...args], {
        cwd: projectRoot,
        env: { ...process.env, HOME: tempHome },
        encoding: 'utf8'
    });
}

test('project context recovery skill script finds evidence and builds a handoff brief', () => {
    if (!hasPython3()) return;

    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-skill-search-'));
    try {
        const codexDir = path.join(tempHome, '.codex', 'sessions', '2026', '06', '14');
        const derivedCodexDir = path.join(tempHome, '.codexmate', 'sessions', 'derived', 'codex');
        const claudeDir = path.join(tempHome, '.claude', 'projects', '-tmp-project');
        fs.mkdirSync(codexDir, { recursive: true });
        fs.mkdirSync(derivedCodexDir, { recursive: true });
        fs.mkdirSync(claudeDir, { recursive: true });

        fs.writeFileSync(path.join(codexDir, 'codex-session.jsonl'), [
            JSON.stringify({
                cwd: '/work/SakuraByteCore/codexmate',
                title: 'codexmate PR context recovery',
                git: {
                    branch: 'feat/project-context-recovery',
                    repository_url: 'https://github.com/SakuraByteCore/codexmate.git',
                    commit_hash: 'abcdef1234567890abcdef1234567890abcdef12'
                }
            }),
            JSON.stringify({ role: 'user', content: 'Investigate SakuraByteCore/codexmate PR 197 project context recovery skill' }),
            JSON.stringify({ role: 'assistant', content: 'Updated skills/codexmate-project-context-recovery/SKILL.md and scripts/search_sessions.py. Validation passed: npm run lint and npm run test:unit.' })
        ].join('\n'));
        fs.writeFileSync(path.join(derivedCodexDir, 'derived-session.jsonl'), JSON.stringify({
            cwd: '/work/SakuraByteCore/codexmate',
            content: 'Derived codexmate session marker umbrella-source-ok'
        }));
        fs.writeFileSync(path.join(claudeDir, 'claude-session.jsonl'), JSON.stringify({
            cwd: '/work/other',
            content: 'Unrelated Claude Code session'
        }));

        const output = runSearch([
            'SakuraByteCore/codexmate PR 197',
            '--source', 'all',
            '--match', 'all',
            '--path-filter', 'SakuraByteCore/codexmate',
            '--format', 'json',
            '--limit', '5'
        ], tempHome);
        const parsed = JSON.parse(output);
        assert.ok(Array.isArray(parsed.hits), 'script should return hits array');
        assert.equal(parsed.hits.length, 1, 'script should find only the matching fixture session');
        assert.equal(parsed.hits[0].source, 'codex');
        assert.ok(parsed.hits[0].snippets.some(snippet => snippet.includes('PR 197')));

        const briefOutput = runSearch([
            'SakuraByteCore/codexmate feat/project-context-recovery',
            '--mode', 'brief',
            '--source', 'all',
            '--match', 'all',
            '--path-filter', 'SakuraByteCore/codexmate',
            '--format', 'json',
            '--limit', '5'
        ], tempHome);
        const brief = JSON.parse(briefOutput);
        assert.equal(brief.confidence, 'high');
        assert.equal(brief.summary.hitCount, 1);
        assert.ok(brief.summary.repos.includes('SakuraByteCore/codexmate'));
        assert.ok(brief.summary.branches.includes('feat/project-context-recovery'));
        assert.ok(brief.summary.files.includes('scripts/search_sessions.py'));
        assert.ok(brief.evidence.validations.some(item => item.includes('npm run lint')));
        assert.ok(brief.timeline[0].evidence.some(item => item.includes('feat/project-context-recovery')));

        const derivedOutput = runSearch([
            'umbrella-source-ok',
            '--source', 'codexmate-derived',
            '--match', 'all',
            '--path-filter', 'SakuraByteCore/codexmate',
            '--format', 'json',
            '--limit', '5'
        ], tempHome);
        const derivedParsed = JSON.parse(derivedOutput);
        assert.equal(derivedParsed.hits.length, 1, 'umbrella codexmate-derived source should search derived codex sessions');
        assert.equal(derivedParsed.hits[0].source, 'codexmate-derived-codex');

        assert.throws(() => runSearch([
            'SakuraByteCore/codexmate',
            '--source', 'all',
            '--limit', '-1'
        ], tempHome), /must be greater than 0/);

        const missOutput = runSearch([
            'completely-nonexistent-token-zzq-197',
            '--source', 'all',
            '--match', 'all',
            '--path-filter', 'SakuraByteCore/codexmate',
            '--format', 'json',
            '--limit', '5'
        ], tempHome);
        const missParsed = JSON.parse(missOutput);
        assert.deepEqual(missParsed.hits, [], 'hyphenated unknown terms must not match just because one split part appears');
    } finally {
        fs.rmSync(tempHome, { recursive: true, force: true });
    }
});
