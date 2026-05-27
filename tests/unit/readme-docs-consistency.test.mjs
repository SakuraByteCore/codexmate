import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('README Architecture diagram includes the documented config files', () => {
    const readme = readProjectFile('README.md');
    const readmeZh = readProjectFile('README.zh.md');
    
    // 验证 README.md 中的架构图节点
    assert.match(readme, /ClawDir\[~\/\.openclaw\]/);
    assert.match(readme, /ClaudeDir\[~\/\.claude\]/);
    assert.match(readme, /CodexDir\[~\/\.codex\]/);

    // 验证 README.zh.md 中的架构图节点
    assert.match(readmeZh, /ClawDir\[~\/\.openclaw\]/);
    assert.match(readmeZh, /ClaudeDir\[~\/\.claude\]/);
    assert.match(readmeZh, /CodexDir\[~\/\.codex\]/);
});
