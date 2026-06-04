import assert from 'assert';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const update = require(path.join(__dirname, '..', '..', 'cli', 'update.js'));

test('comparePackageVersions normalizes v-prefixed package versions', () => {
    assert.strictEqual(update.comparePackageVersions('v0.0.41', '0.0.41'), 0);
    assert.strictEqual(update.comparePackageVersions('0.0.40', '0.0.41'), -1);
    assert.strictEqual(update.comparePackageVersions('0.0.42', '0.0.41'), 1);
});

test('normalizePackageVersion rejects non-package version labels', () => {
    assert.strictEqual(update.normalizePackageVersion('v0.0.43'), '0.0.43');
    assert.strictEqual(update.normalizePackageVersion('latest'), '');
    assert.strictEqual(update.normalizePackageVersion(''), '');
});
