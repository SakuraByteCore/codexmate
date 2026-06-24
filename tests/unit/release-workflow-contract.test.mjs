import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

test('release workflow uploads desktop installers as release assets', () => {
    const releaseWorkflow = fs.readFileSync(path.join(projectRoot, '.github', 'workflows', 'release.yml'), 'utf8');

    assert.match(releaseWorkflow, /\n  resolve:\n[\s\S]*?\n  desktop:\n/m);
    assert.match(releaseWorkflow, /\n  desktop:\n[\s\S]*?runs-on:\s*\$\{\{ matrix\.os \}\}/m);
    assert.match(releaseWorkflow, /name:\s*codexmate-desktop-\$\{\{ matrix\.name \}\}/m);
    assert.match(releaseWorkflow, /src-tauri\/target\/release\/bundle\/dmg\/\*\.dmg/);
    assert.match(releaseWorkflow, /src-tauri\/target\/release\/bundle\/msi\/\*\.msi/);
    assert.match(releaseWorkflow, /src-tauri\/target\/release\/bundle\/nsis\/\*\.exe/);
    assert.match(releaseWorkflow, /pattern:\s*codexmate-desktop-\*/);
    assert.match(releaseWorkflow, /merge-multiple:\s*true/);
    assert.match(releaseWorkflow, /desktop-release-assets\/\*\*\/\*\.dmg/);
    assert.match(releaseWorkflow, /desktop-release-assets\/\*\*\/\*\.msi/);
    assert.match(releaseWorkflow, /desktop-release-assets\/\*\*\/\*\.exe/);
});
