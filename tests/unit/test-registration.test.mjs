import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { discoverUnitTests } from './registration.mjs';

function withFixtures(callback) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'unit-registration-'));
    try {
        return callback(directory);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
}

test('unit discovery includes every test file once with an explicit runner', () => {
    const directory = path.dirname(fileURLToPath(import.meta.url));
    const names = fs.readdirSync(directory).filter(name => /\.test\.(?:mjs|cjs|js)$/.test(name)).sort();
    const inventory = discoverUnitTests();
    assert.deepStrictEqual(inventory.map(entry => entry.name), names);
    assert.strictEqual(new Set(inventory.map(entry => entry.name)).size, names.length);
    assert(inventory.every(entry => ['legacy', 'node', 'standalone', 'archived'].includes(entry.runner)));
    const archived = inventory.filter(entry => entry.runner === 'archived');
    assert.deepStrictEqual(archived.map(entry => entry.name), ['automation.test.mjs', 'task-workspace-chat.test.mjs']);
    assert(archived.every(entry => entry.reason.includes('ee55bb3')));
});

test('unit discovery picks up new legacy, native, and standalone tests without a manual list', () => {
    withFixtures(directory => {
        fs.writeFileSync(path.join(directory, 'global.test.mjs'), "test('case', () => {});\n");
        fs.writeFileSync(path.join(directory, 'native.test.mjs'), "import test from 'node:test';\n");
        fs.writeFileSync(path.join(directory, 'fallback.test.mjs'), "import nodeTest from 'node:test';\nconst test = typeof globalThis.test === 'function' ? globalThis.test : nodeTest;\ntest('case', () => {});\n");
        fs.writeFileSync(path.join(directory, 'standalone.test.cjs'), "require('assert').ok(true);\n");
        fs.writeFileSync(path.join(directory, 'helper.mjs'), 'export const helper = true;\n');
        assert.deepStrictEqual(discoverUnitTests(directory), [
            { name: 'fallback.test.mjs', runner: 'legacy' },
            { name: 'global.test.mjs', runner: 'legacy' },
            { name: 'native.test.mjs', runner: 'node' },
            { name: 'standalone.test.cjs', runner: 'standalone' }
        ]);
    });
});
