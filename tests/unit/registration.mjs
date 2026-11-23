import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const UNIT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(UNIT_DIRECTORY, '..', '..');
const ARCHIVED_DEPENDENCIES = {
    'automation.test.mjs': 'lib/automation.js',
    'task-workspace-chat.test.mjs': 'lib/task-workspace-chat.js'
};
const NODE_TEST_IMPORT = /^\s*import\s+[^\n;]+\s+from\s+['"]node:test['"]/m;
const GLOBAL_TEST_CALL = /^\s*test\(/m;
const GLOBAL_TEST_FALLBACK = /\bconst\s+test\s*=\s*typeof\s+globalThis\.test/;

export function discoverUnitTests(directory = UNIT_DIRECTORY) {
    return fs.readdirSync(directory)
        .filter(name => /\.test\.(?:mjs|cjs|js)$/.test(name))
        .sort()
        .map(name => {
            const dependency = ARCHIVED_DEPENDENCIES[name];
            if (dependency && !fs.existsSync(path.join(PROJECT_ROOT, dependency))) {
                return { name, runner: 'archived', reason: `${dependency} removed by ee55bb3; assertions retained` };
            }
            const source = fs.readFileSync(path.join(directory, name), 'utf8');
            const runner = NODE_TEST_IMPORT.test(source) && !GLOBAL_TEST_FALLBACK.test(source)
                ? 'node' : (GLOBAL_TEST_CALL.test(source) ? 'legacy' : 'standalone');
            return { name, runner };
        });
}
