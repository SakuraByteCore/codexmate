import assert from 'assert';
import { readProjectFile } from './helpers/web-ui-source.mjs';

const cliSource = readProjectFile('cli.js');

function extractBlockBySignature(source, signature) {
    const startIndex = source.indexOf(signature);
    if (startIndex === -1) {
        throw new Error(`Signature not found: ${signature}`);
    }
    const signatureBraceOffset = signature.lastIndexOf('{');
    const braceStart = signatureBraceOffset >= 0
        ? (startIndex + signatureBraceOffset)
        : source.indexOf('{', startIndex + signature.length);
    if (braceStart === -1) {
        throw new Error(`Opening brace not found for: ${signature}`);
    }
    let depth = 0;
    for (let i = braceStart; i < source.length; i += 1) {
        const ch = source[i];
        if (ch === '{') depth += 1;
        if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(startIndex, i + 1);
            }
        }
    }
    throw new Error(`Closing brace not found for: ${signature}`);
}

function instantiateFunction(funcSource, funcName, bindings = {}) {
    const bindingNames = Object.keys(bindings);
    const bindingValues = Object.values(bindings);
    return Function(...bindingNames, `${funcSource}\nreturn ${funcName};`)(...bindingValues);
}

test('resolveSpawnCommand keeps bare command names on windows', () => {
    const source = extractBlockBySignature(cliSource, 'function resolveSpawnCommand(command) {');
    const resolveSpawnCommand = instantiateFunction(source, 'resolveSpawnCommand', {
        process: { platform: 'win32' },
        resolveCommandPath() {
            return 'C:\\nvm4w\\nodejs\\codex';
        }
    });

    assert.strictEqual(resolveSpawnCommand('codex'), 'codex');
});

