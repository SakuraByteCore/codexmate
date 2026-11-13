import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { createSkillsMethods } from '../../web-ui/modules/skills.methods.mjs';
import {
    readBundledWebUiCss,
    readBundledWebUiHtml
} from './helpers/web-ui-source.mjs';

const require = createRequire(import.meta.url);
const { backupSkills } = require('../../cli/skills.js');

test('backupSkills exports every current-target skill with a manifest', async () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-backup-test-'));
    const skillsDir = path.join(tempHome, 'skills');
    const alpha = path.join(skillsDir, 'alpha');
    const incomplete = path.join(skillsDir, 'incomplete');
    fs.mkdirSync(alpha, { recursive: true });
    fs.mkdirSync(incomplete, { recursive: true });
    fs.writeFileSync(path.join(alpha, 'SKILL.md'), '# alpha\n', 'utf8');
    fs.writeFileSync(path.join(alpha, 'helper.js'), 'export default 1;\n', 'utf8');
    fs.writeFileSync(path.join(incomplete, 'notes.txt'), 'keep\n', 'utf8');

    try {
        const script = `const { backupSkills } = require(${JSON.stringify(path.resolve('cli/skills.js'))}); backupSkills({ targetApp: 'codex' }).then((result) => console.log(JSON.stringify(result)));`;
        const output = execFileSync(process.execPath, ['-e', script], {
            encoding: 'utf8',
            env: { ...process.env, CODEX_HOME: tempHome }
        });
        const result = JSON.parse(output.trim());
        assert.ifError(result.error);
        assert.strictEqual(result.exported.length, 2);
        assert.match(result.fileName, /^codex-skills-backup-.+\.zip$/);
        assert.strictEqual(result.backup.format, 'codexmate-skills-backup');
        assert.strictEqual(result.backup.targetApp, 'codex');
        assert.deepStrictEqual(
            result.backup.skills.map((item) => item.name).sort(),
            ['alpha', 'incomplete']
        );
        assert.strictEqual(result.backup.skills.find((item) => item.name === 'alpha').hasSkillFile, true);
        assert.strictEqual(result.backup.skills.find((item) => item.name === 'incomplete').hasSkillFile, false);
    } finally {
        fs.rmSync(tempHome, { recursive: true, force: true });
    }
});

test('skill tab exposes backup and selected-export actions', () => {
    const html = readBundledWebUiHtml();
    const styles = readBundledWebUiCss();

    assert.match(html, /@click="backupCurrentSkills"/);
    assert.match(html, /@click="exportMarketSelectedSkills"/);
    assert.match(html, /class="skills-market-selection-bar"/);
    assert.match(html, /@change="toggleAllSkillsMarketSelection"/);
    assert.match(html, /@change="toggleSkillsMarketSelection\(skill\.name\)"/);
    assert.match(styles, /\.skills-market-selection-bar\s*\{[^}]*display:\s*flex;/);
    assert.match(styles, /\.skills-flow-header > \.skills-flow-actions\s*\{[^}]*flex-wrap:\s*nowrap;/);
});

test('skill market export reads only the tab selection', async () => {
    const requests = [];
    const methods = createSkillsMethods({
        api: async (action, params) => {
            requests.push({ action, params });
            return { fileName: 'codex-skills.zip', downloadPath: '/download/token', exported: [{ name: 'alpha' }], failed: [] };
        }
    });
    const context = {
        skillsTargetApp: 'codex',
        skillsMarketSelectedNames: ['alpha'],
        skillsSelectedNames: ['other'],
        skillsExporting: false,
        skillsBackingUp: false,
        skillsDeleting: false,
        skillsZipImporting: false,
        skillsImporting: false,
        showMessage() {},
        document: {
            createElement: () => ({ click() {}, style: {} }),
            body: { appendChild() {}, removeChild() {} }
        }
    };

    await methods.exportMarketSelectedSkills.call({
        ...context,
        exportSkillSelection: methods.exportSkillSelection
    });
    assert.deepStrictEqual(requests[0].params.names, ['alpha']);
    assert.strictEqual(context.skillsExporting, false);
});
