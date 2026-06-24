import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function readPngSize(filePath) {
    const buffer = fs.readFileSync(filePath);
    assert.strictEqual(buffer.toString('latin1', 0, 8), '\x89PNG\r\n\x1A\n', `${filePath} must be a PNG`);
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

function readIcoSizes(filePath) {
    const buffer = fs.readFileSync(filePath);
    assert.strictEqual(buffer.readUInt16LE(0), 0, `${filePath} ico reserved field must be zero`);
    assert.strictEqual(buffer.readUInt16LE(2), 1, `${filePath} must be an icon resource`);
    const count = buffer.readUInt16LE(4);
    const sizes = [];
    for (let index = 0; index < count; index += 1) {
        const offset = 6 + index * 16;
        const width = buffer[offset] || 256;
        const height = buffer[offset + 1] || 256;
        sizes.push(`${width}x${height}`);
    }
    return sizes.sort((a, b) => Number(a.split('x')[0]) - Number(b.split('x')[0]));
}

function readIcnsTypes(filePath) {
    const buffer = fs.readFileSync(filePath);
    assert.strictEqual(buffer.toString('latin1', 0, 4), 'icns', `${filePath} must be an ICNS file`);
    assert.strictEqual(buffer.readUInt32BE(4), buffer.length, `${filePath} ICNS length header must match file size`);
    const types = [];
    for (let offset = 8; offset + 8 <= buffer.length;) {
        const type = buffer.toString('latin1', offset, offset + 4);
        const size = buffer.readUInt32BE(offset + 4);
        assert.ok(size >= 8, `${filePath} ICNS entry ${type} has invalid size`);
        types.push(type);
        offset += size;
    }
    return types.sort();
}

test('desktop staging creates validated runtime resource layout', () => {
    const result = spawnSync(process.execPath, ['tools/desktop/prepare-tauri-resources.js'], {
        cwd: projectRoot,
        encoding: 'utf8'
    });

    assert.strictEqual(result.status, 0, result.stderr || result.stdout);

    const stageRoot = path.join(projectRoot, 'dist', 'desktop', 'codexmate');
    const requiredEntries = [
        'codexmate-desktop.json',
        'cli.js',
        'cli',
        'lib',
        'plugins',
        'web-ui',
        'web-ui.html',
        'package.json',
        'package-lock.json',
        'node_modules',
        'node-runtime'
    ];

    for (const entry of requiredEntries) {
        assert.ok(fs.existsSync(path.join(stageRoot, entry)), `missing staged desktop resource: ${entry}`);
    }

    const pkg = readJson(path.join(projectRoot, 'package.json'));
    const manifest = readJson(path.join(stageRoot, 'codexmate-desktop.json'));
    assert.strictEqual(manifest.layoutVersion, 1);
    assert.strictEqual(manifest.version, pkg.version);
    assert.strictEqual(manifest.entrypoint, 'cli.js');
    assert.match(manifest.nodeRuntime, /^node-runtime\/node(\.exe)?$/);
    assert.ok(fs.existsSync(path.join(stageRoot, manifest.nodeRuntime)), 'manifest should point at the bundled Node.js runtime');
    assert.ok(manifest.copiedRuntimeModules > 0, 'manifest should record copied runtime node modules');

    for (const dependencyName of Object.keys(pkg.dependencies || {})) {
        const dependencyPath = path.join(stageRoot, 'node_modules', ...dependencyName.split('/'));
        assert.ok(fs.existsSync(dependencyPath), `missing staged runtime dependency: ${dependencyName}`);
    }

    const tauriConfig = readJson(path.join(projectRoot, 'src-tauri', 'tauri.conf.json'));
    assert.strictEqual(tauriConfig.bundle.resources['../dist/desktop/codexmate'], 'codexmate');
    assert.match(tauriConfig.app.security.csp, /default-src 'self'/);
    assert.match(tauriConfig.app.security.csp, /http:\/\/127\.0\.0\.1:3737/);
});

test('desktop icons are sized correctly and referenced by Tauri bundle config', () => {
    const tauriConfig = readJson(path.join(projectRoot, 'src-tauri', 'tauri.conf.json'));
    const bundleIcons = Array.isArray(tauriConfig.bundle && tauriConfig.bundle.icon)
        ? tauriConfig.bundle.icon
        : [];
    assert.deepStrictEqual(bundleIcons, [
        'icons/32x32.png',
        'icons/128x128.png',
        'icons/128x128@2x.png',
        'icons/icon.icns',
        'icons/icon.ico'
    ]);

    const expectedPngSizes = {
        '32x32.png': [32, 32],
        '64x64.png': [64, 64],
        '128x128.png': [128, 128],
        '128x128@2x.png': [256, 256],
        'icon.png': [512, 512],
        'Square30x30Logo.png': [30, 30],
        'Square44x44Logo.png': [44, 44],
        'Square71x71Logo.png': [71, 71],
        'Square89x89Logo.png': [89, 89],
        'Square107x107Logo.png': [107, 107],
        'Square142x142Logo.png': [142, 142],
        'Square150x150Logo.png': [150, 150],
        'Square284x284Logo.png': [284, 284],
        'Square310x310Logo.png': [310, 310],
        'StoreLogo.png': [50, 50]
    };
    for (const [fileName, expectedSize] of Object.entries(expectedPngSizes)) {
        assert.deepStrictEqual(
            readPngSize(path.join(projectRoot, 'src-tauri', 'icons', fileName)),
            expectedSize,
            `${fileName} should have the expected generated icon dimensions`
        );
    }

    for (const icon of bundleIcons) {
        assert.ok(fs.existsSync(path.join(projectRoot, 'src-tauri', icon)), `bundle icon is missing: ${icon}`);
    }
    assert.deepStrictEqual(readIcoSizes(path.join(projectRoot, 'src-tauri', 'icons', 'icon.ico')), [
        '16x16',
        '24x24',
        '32x32',
        '48x48',
        '64x64',
        '256x256'
    ]);
    assert.deepStrictEqual(readIcnsTypes(path.join(projectRoot, 'src-tauri', 'icons', 'icon.icns')), [
        'ic07',
        'ic08',
        'ic09',
        'ic10',
        'ic11',
        'ic12',
        'ic13',
        'ic14',
        'il32',
        'is32',
        'l8mk',
        's8mk'
    ]);
});
