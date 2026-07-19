#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const stageDir = path.join(rootDir, 'dist', 'desktop', 'codexmate');
const releaseDir = path.join(rootDir, 'src-tauri', 'target', 'release');
const portableDir = path.join(rootDir, 'dist', 'desktop', 'portable', 'Codex Mate');

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
  if (stat.mode & 0o111) {
    fs.chmodSync(destinationPath, stat.mode);
  }
}

function assertExists(filePath, label) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} is missing: ${path.relative(rootDir, filePath)}`);
  }
}

function desktopExecutableName() {
  return process.platform === 'win32' ? 'codexmate-desktop.exe' : 'codexmate-desktop';
}

function main() {
  const executableName = desktopExecutableName();
  const executablePath = path.join(releaseDir, executableName);
  assertExists(executablePath, 'desktop executable');
  assertExists(stageDir, 'staged desktop runtime resources');
  assertExists(path.join(stageDir, 'cli.js'), 'staged cli entrypoint');
  assertExists(path.join(stageDir, 'node-runtime'), 'staged Node.js runtime');

  fs.rmSync(portableDir, { recursive: true, force: true });
  fs.mkdirSync(portableDir, { recursive: true });
  copyPath(executablePath, path.join(portableDir, executableName));
  copyPath(stageDir, path.join(portableDir, 'codexmate'));

  fs.writeFileSync(
    path.join(portableDir, 'README.txt'),
    [
      'Codex Mate portable desktop package',
      '',
      `Run ${executableName} from this folder.`,
      'Do not move the codexmate folder away from the executable; it contains the bundled backend runtime.',
      'No installer or administrator privileges are required.'
    ].join('\n') + '\n'
  );

  console.log(`portable desktop package staged at ${path.relative(rootDir, portableDir)}`);
}

main();
