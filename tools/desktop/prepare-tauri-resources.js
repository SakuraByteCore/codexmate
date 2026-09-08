#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const LAYOUT_VERSION = 1;
const rootDir = path.resolve(__dirname, '..', '..');
const packagePath = path.join(rootDir, 'package.json');
const packageLockPath = path.join(rootDir, 'package-lock.json');
const tauriConfigPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
const cargoTomlPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
const stageRelativePath = path.join('dist', 'desktop', 'codexmate');
const stageDir = path.join(rootDir, stageRelativePath);
const stageNodeModulesDir = path.join(stageDir, 'node_modules');
const stageNodeRuntimeDir = path.join(stageDir, 'node-runtime');
const TAURI_CSP = "default-src 'self' http://127.0.0.1:3737; connect-src 'self' http://127.0.0.1:3737; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'";

const runtimeEntries = [
  'cli.js',
  'package.json',
  'package-lock.json',
  'cli',
  'lib',
  'plugins',
  'web-ui',
  'web-ui.html'
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function assertExists(relativePath) {
  const resolved = path.join(rootDir, relativePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`desktop resource is missing: ${relativePath}`);
  }
  return resolved;
}

function copyPath(sourcePath, destinationPath) {
  const stat = fs.statSync(sourcePath);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  if (stat.isDirectory()) {
    fs.cpSync(sourcePath, destinationPath, {
      recursive: true,
      force: true,
      dereference: false,
      filter: (source) => !source.split(path.sep).includes('.git')
    });
    return;
  }
  fs.copyFileSync(sourcePath, destinationPath);
  if (path.basename(destinationPath) === 'cli.js') {
    fs.chmodSync(destinationPath, stat.mode | 0o755);
  }
}

function copyRuntimeEntries() {
  for (const entry of runtimeEntries) {
    const source = assertExists(entry);
    const destination = path.join(stageDir, entry);
    copyPath(source, destination);
  }
}

function packageLockRuntimeModulePaths(lockFile) {
  const packages = lockFile && typeof lockFile === 'object' ? lockFile.packages : null;
  if (!packages || typeof packages !== 'object') {
    throw new Error('package-lock.json is missing packages metadata; run npm install with a lockfileVersion that records package paths');
  }

  return Object.entries(packages)
    .filter(([packagePathInLock, metadata]) => {
      if (!packagePathInLock.startsWith('node_modules/')) return false;
      if (!metadata || typeof metadata !== 'object') return false;
      return metadata.dev !== true;
    })
    .map(([packagePathInLock]) => packagePathInLock)
    .sort((a, b) => a.localeCompare(b));
}

function copyRuntimeNodeModules(pkg, lockFile) {
  assertExists('node_modules');
  fs.mkdirSync(stageNodeModulesDir, { recursive: true });

  const copied = [];
  for (const modulePath of packageLockRuntimeModulePaths(lockFile)) {
    const source = path.join(rootDir, modulePath);
    if (!fs.existsSync(source)) {
      throw new Error(`runtime dependency is missing from root install: ${modulePath}; run npm ci first`);
    }
    const destination = path.join(stageDir, modulePath);
    copyPath(source, destination);
    copied.push(modulePath);
  }

  const dependencies = Object.keys(pkg.dependencies || {});
  for (const dependencyName of dependencies) {
    const dependencyPath = path.join(stageNodeModulesDir, ...dependencyName.split('/'));
    if (!fs.existsSync(dependencyPath)) {
      throw new Error(`staged runtime dependency is missing: ${dependencyName}`);
    }
  }

  return copied;
}

function nodeExecutableName() {
  return process.platform === 'win32' ? 'node.exe' : 'node';
}

function copyNodeRuntime() {
  const source = process.execPath;
  if (!source || !fs.existsSync(source)) {
    throw new Error('unable to locate current Node.js executable for desktop packaging');
  }

  fs.mkdirSync(stageNodeRuntimeDir, { recursive: true });
  const executableName = nodeExecutableName();
  const destination = path.join(stageNodeRuntimeDir, executableName);
  fs.copyFileSync(source, destination);
  const sourceMode = fs.statSync(source).mode;
  fs.chmodSync(destination, sourceMode | 0o755);
  return path.join('node-runtime', executableName).replace(/\\/g, '/');
}

function writeStageManifest(pkg, copiedModules, nodeRuntime) {
  writeJson(path.join(stageDir, 'codexmate-desktop.json'), {
    layoutVersion: LAYOUT_VERSION,
    productName: 'Codex Mate',
    version: pkg.version,
    entrypoint: 'cli.js',
    nodeRuntime,
    nodeModules: 'node_modules',
    webUi: 'web-ui',
    copiedRuntimeModules: copiedModules.length
  });
}

function validateStagedResources(pkg) {
  const requiredStageEntries = [
    'cli.js',
    'package.json',
    'package-lock.json',
    'cli',
    'lib',
    'plugins',
    'web-ui',
    'web-ui.html',
    'node_modules',
    'node-runtime',
    'codexmate-desktop.json'
  ];

  for (const entry of requiredStageEntries) {
    const stagedPath = path.join(stageDir, entry);
    if (!fs.existsSync(stagedPath)) {
      throw new Error(`staged desktop resource is missing: ${entry}`);
    }
  }

  const stagedPackage = readJson(path.join(stageDir, 'package.json'));
  if (stagedPackage.name !== pkg.name || stagedPackage.version !== pkg.version) {
    throw new Error(`staged package metadata mismatch: expected ${pkg.name}@${pkg.version}`);
  }

  const manifest = readJson(path.join(stageDir, 'codexmate-desktop.json'));
  if (manifest.layoutVersion !== LAYOUT_VERSION || manifest.entrypoint !== 'cli.js') {
    throw new Error('staged desktop manifest is invalid');
  }
  if (!manifest.nodeRuntime || !fs.existsSync(path.join(stageDir, manifest.nodeRuntime))) {
    throw new Error('staged desktop Node.js runtime is missing');
  }
}

function stageDesktopResources(pkg, lockFile) {
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });
  copyRuntimeEntries();
  const copiedModules = copyRuntimeNodeModules(pkg, lockFile);
  const nodeRuntime = copyNodeRuntime();
  writeStageManifest(pkg, copiedModules, nodeRuntime);
  validateStagedResources(pkg);
  return copiedModules.length;
}

function updateTauriConfig(pkg) {
  const config = readJson(tauriConfigPath);

  config.productName = 'Codex Mate';
  config.version = pkg.version;
  config.identifier = config.identifier && config.identifier !== 'com.tauri.dev'
    ? config.identifier
    : 'ai.codexmate.desktop';

  config.build = {
    ...(config.build || {}),
    devUrl: 'http://127.0.0.1:3737',
    frontendDist: '../web-ui',
    beforeDevCommand: 'npm run desktop:stage && node cli.js run --host 127.0.0.1 --no-browser',
    beforeBuildCommand: 'npm run desktop:stage'
  };

  config.app = {
    ...(config.app || {}),
    windows: [
      {
        label: 'main',
        title: 'Codex Mate',
        width: 1280,
        height: 860,
        minWidth: 960,
        minHeight: 640,
        resizable: true,
        fullscreen: false,
        url: 'http://127.0.0.1:3737'
      }
    ],
    security: {
      ...(config.app && config.app.security ? config.app.security : {}),
      csp: TAURI_CSP
    }
  };

  config.bundle = {
    ...(config.bundle || {}),
    active: true,
    targets: 'all',
    resources: {
      '../dist/desktop/codexmate': 'codexmate'
    }
  };

  writeJson(tauriConfigPath, config);
}

function updateCargoVersion(pkg) {
  if (!fs.existsSync(cargoTomlPath)) return;
  const cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  const nextCargoToml = cargoToml.replace(
    /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/,
    `$1${pkg.version}$3`
  );
  fs.writeFileSync(cargoTomlPath, nextCargoToml);
}

function main() {
  const pkg = readJson(packagePath);
  const lockFile = readJson(packageLockPath);

  runtimeEntries.forEach(assertExists);
  const copiedModuleCount = stageDesktopResources(pkg, lockFile);
  updateTauriConfig(pkg);
  updateCargoVersion(pkg);

  console.log(`desktop resources staged at ${path.relative(rootDir, stageDir)} for Codex Mate ${pkg.version}`);
  console.log(`desktop stage includes ${copiedModuleCount} production node_modules package(s)`);
}

main();
