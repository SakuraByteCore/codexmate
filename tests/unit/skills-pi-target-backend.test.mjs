import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const skillsModule = require('../../cli/skills.js');

const { getPiSkillsDir, listSkills, normalizeSkillTargetApp } = skillsModule;

test('normalizeSkillTargetApp accepts the pi target', () => {
    assert.strictEqual(normalizeSkillTargetApp('pi'), 'pi');
    assert.strictEqual(normalizeSkillTargetApp('codex'), 'codex');
    assert.strictEqual(normalizeSkillTargetApp('Claude'), 'claude');
    assert.strictEqual(normalizeSkillTargetApp('unknown-app'), '');
});

test('listSkills returns pi target metadata with .pi agent skills root', () => {
    const result = listSkills({ targetApp: 'pi' });

    assert.strictEqual(result.targetApp, 'pi');
    assert.strictEqual(result.targetLabel, 'Pi');
    assert.match(result.root, /\.pi[\\/]agent[\\/]skills$/);
    assert.strictEqual(typeof result.exists, 'boolean');
    assert.ok(Array.isArray(result.items));
});

test('getPiSkillsDir honors PI_CODING_AGENT_DIR override and restores env', () => {
    const originalEnv = process.env.PI_CODING_AGENT_DIR;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-agent-'));
    try {
        process.env.PI_CODING_AGENT_DIR = tempDir;
        const expected = path.join(tempDir, 'skills');
        assert.strictEqual(getPiSkillsDir(), expected);
    } finally {
        if (typeof originalEnv === 'string') {
            process.env.PI_CODING_AGENT_DIR = originalEnv;
        } else {
            delete process.env.PI_CODING_AGENT_DIR;
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
});
