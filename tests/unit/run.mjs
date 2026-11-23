import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';
import { discoverUnitTests } from './registration.mjs';

const RUNNER_PATH = fileURLToPath(import.meta.url);
const UNIT_DIRECTORY = path.dirname(RUNNER_PATH);
const SUITE_TIMEOUT_MS = 30000;
const LEGACY_SUITE_FILE_LIMIT = 50;
const LEGACY_MODE = '--legacy';
const isLegacyWorker = process.argv[2] === LEGACY_MODE;
const requestedNames = process.argv.slice(isLegacyWorker ? 3 : 2);
const inventory = discoverUnitTests();
for (const name of requestedNames) {
    if (!inventory.some(entry => entry.name === name && entry.runner !== 'archived')) {
        throw new Error(`Unknown or archived unit test: ${name}`);
    }
}
const selected = inventory.filter(entry => !requestedNames.length || requestedNames.includes(entry.name));

if (isLegacyWorker) {
    const cases = [];
    let currentFile = '';
    globalThis.test = (name, fn) => cases.push({ name, fn, file: currentFile });
    let failures = 0;
    for (const entry of selected.filter(entry => entry.runner === 'legacy')) {
        currentFile = entry.name;
        try {
            await import(pathToFileURL(path.join(UNIT_DIRECTORY, entry.name)));
        } catch (error) {
            failures += 1;
            console.error(`Import failed: ${entry.name}`, error);
        }
    }
    for (const { name, fn, file } of cases) {
        try {
            await fn();
        } catch (error) {
            failures += 1;
            console.error(`Failed: ${file}: ${name}`, error);
        }
    }
    console.log(`Legacy unit tests: ${cases.length} registered, ${failures} failed.`);
    // The worker owns its timers; exit only after every registered assertion finishes.
    process.exit(failures || process.exitCode ? 1 : 0);
} else {
    for (const entry of selected.filter(entry => entry.runner === 'archived')) {
        console.log(`Archived unit test: ${entry.name}: ${entry.reason}`);
    }
    const legacyFiles = selected.filter(entry => entry.runner === 'legacy').map(entry => entry.name);
    const nodeFiles = selected.filter(entry => ['node', 'standalone'].includes(entry.runner)).map(entry => path.join(UNIT_DIRECTORY, entry.name));
    const suites = [];
    for (let offset = 0; offset < legacyFiles.length; offset += LEGACY_SUITE_FILE_LIMIT) {
        const files = legacyFiles.slice(offset, offset + LEGACY_SUITE_FILE_LIMIT);
        suites.push({ name: `legacy ${offset / LEGACY_SUITE_FILE_LIMIT + 1}`, args: [RUNNER_PATH, LEGACY_MODE, ...files], count: files.length });
    }
    suites.push({ name: 'node:test', args: ['--test', '--test-concurrency=1', ...nodeFiles], count: nodeFiles.length });
    let failures = 0;
    for (const suite of suites.filter(suite => suite.count > 0)) {
        console.log(`Unit suite ${suite.name}: ${suite.count} files.`);
        const result = spawnSync(process.execPath, suite.args, { stdio: 'inherit', timeout: SUITE_TIMEOUT_MS });
        if (result.error || result.status !== 0) {
            failures += 1;
            console.error(`Unit suite ${suite.name} failed: ${result.error?.message || result.signal || result.status}`);
        }
    }
    process.exit(failures ? 1 : 0);
}
