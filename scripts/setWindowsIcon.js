const fs = require('fs');
const path = require('path');

function usageAndExit() {
  console.error('Usage: node scripts/setWindowsIcon.js <exePath> <iconIcoPath>');
  process.exit(2);
}

const exeArg = process.argv[2];
const iconArg = process.argv[3];
if (!exeArg || !iconArg) usageAndExit();

const exePath = path.resolve(process.cwd(), exeArg);
const iconPath = path.resolve(process.cwd(), iconArg);

function getWindowsFileVersion(semverLike) {
  const raw = String(semverLike ?? '');
  const core = raw.split('-')[0].split('+')[0];
  const parts = core
    .split('.')
    .map((p) => parseInt(p.replace(/[^\d].*$/, ''), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);

  while (parts.length < 4) parts.push(0);
  return parts.slice(0, 4).join('.');
}

function readPackageJson(cwd) {
  const packageJsonPath = path.join(cwd, 'package.json');
  try {
    const raw = fs.readFileSync(packageJsonPath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function parseIcoImages(icoBuffer) {
  if (icoBuffer.length < 6) throw new Error('Invalid .ico: file too small');
  const reserved = icoBuffer.readUInt16LE(0);
  const type = icoBuffer.readUInt16LE(2);
  const count = icoBuffer.readUInt16LE(4);
  if (reserved !== 0 || type !== 1) throw new Error('Invalid .ico: bad header');
  if (count <= 0) throw new Error('Invalid .ico: no images');

  const images = [];
  for (let i = 0; i < count; i++) {
    const entryOffset = 6 + i * 16;
    if (entryOffset + 16 > icoBuffer.length) break;
    const width = icoBuffer.readUInt8(entryOffset) || 256;
    const height = icoBuffer.readUInt8(entryOffset + 1) || 256;
    const bitCount = icoBuffer.readUInt16LE(entryOffset + 6);
    images.push({ width, height, bitCount });
  }
  return images;
}

function validateIco(iconFilePath) {
  const buf = fs.readFileSync(iconFilePath);
  const images = parseIcoImages(buf);
  const sizes = new Set(images.filter((i) => i.width === i.height).map((i) => i.width));

  const recommended = [16, 32, 48, 256];
  const missing = recommended.filter((s) => !sizes.has(s));
  if (missing.length > 0) {
    console.warn(
      `[icon] Warning: ${path.basename(iconFilePath)} is missing ${missing
        .map((s) => `${s}x${s}`)
        .join(', ')} (may look wrong in Explorer/taskbar)`
    );
  }
}

if (!fs.existsSync(exePath)) {
  console.error(`EXE not found: ${exePath}`);
  process.exit(1);
}
if (!fs.existsSync(iconPath)) {
  console.error(`Icon not found: ${iconPath}`);
  process.exit(1);
}

const rcedit = require('rcedit');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetryRcedit(error) {
  const stderr = error && typeof error.stderr === 'string' ? error.stderr : '';
  const message = error && typeof error.message === 'string' ? error.message : '';
  const combined = `${stderr}\n${message}`.toLowerCase();
  return combined.includes('unable to commit changes') || combined.includes('ebusy') || combined.includes('eacces');
}

(async () => {
  const backupPath = `${exePath}.bak`;
  try {
    validateIco(iconPath);

    const pkg = readPackageJson(process.cwd());
    const exeBase = path.basename(exePath);
    const exeBaseNoExt = path.parse(exeBase).name;
    const productName = (pkg && (pkg.productName || pkg.name)) || exeBaseNoExt;
    const fileDescription = (pkg && pkg.description) || productName;
    const companyName =
      (pkg &&
        ((typeof pkg.author === 'string' && pkg.author) ||
          (pkg.author && typeof pkg.author.name === 'string' && pkg.author.name))) ||
      '';
    const fileVersion = getWindowsFileVersion(pkg && pkg.version);

    fs.copyFileSync(exePath, backupPath);
    const rceditOptions = {
      icon: iconPath,
      'file-version': fileVersion,
      'product-version': fileVersion,
      'version-string': {
        CompanyName: companyName || productName,
        FileDescription: fileDescription,
        InternalName: exeBaseNoExt,
        OriginalFilename: exeBase,
        ProductName: productName,
      },
    };

    let attempt = 0;
    for (;;) {
      attempt += 1;
      try {
        await rcedit(exePath, rceditOptions);
        break;
      } catch (error) {
        if (attempt >= 6 || !shouldRetryRcedit(error)) throw error;
        await sleep(150 * attempt);
      }
    }
    fs.unlinkSync(backupPath);
    console.log(`EXE resources updated: ${path.basename(exePath)} <- ${path.basename(iconPath)}`);
  } catch (error) {
    try {
      if (fs.existsSync(backupPath)) fs.copyFileSync(backupPath, exePath);
    } catch (_) {}
    console.error(error);
    process.exit(1);
  }
})();
