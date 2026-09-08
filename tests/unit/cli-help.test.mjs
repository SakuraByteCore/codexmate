import assert from 'assert';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.join(__dirname, '..', '..', 'cli.js');

function runCli(args = []) {
    return spawnSync(process.execPath, [cliPath, ...args], {
        cwd: path.join(__dirname, '..', '..'),
        encoding: 'utf-8'
    });
}

test('top-level help flags print usage and exit successfully', () => {
    for (const args of [[], ['--help'], ['-h'], ['help']]) {
        const result = runCli(args);
        assert.strictEqual(result.status, 0, `args ${args.join(' ')} stderr: ${result.stderr}`);
        assert.match(result.stdout, /Codex Mate/);
        assert.match(result.stdout, /codexmate import-skills/);
        assert.doesNotMatch(result.stderr, /error|exception/i);
    }
});

// task command removed in ee55bb3d
test("task help documents workspace and thread flags [skipped: ee55bb3d]", function() {});
/*
    const result = runCli(['task', '--help']);

    assert.strictEqual(result.status, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /--cwd <路径>/);
    assert.match(result.stdout, /--thread-id <ID>/);
    assert.match(result.stdout, /--conversation-id <ID>/);
    assert.match(result.stdout, /--session-id <ID>/);
});
*/
