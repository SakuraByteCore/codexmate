param(
  [string]$Target = "node18-win-x64",
  [string]$Output = "codex-switcher.exe",
  [string]$Icon = "icon.ico"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$pkgMeta = $null
try {
  $pkgMeta = Get-Content -Raw (Join-Path $repoRoot "package.json") | ConvertFrom-Json
} catch {
  $pkgMeta = $null
}

$pkgBin = Join-Path $repoRoot "node_modules\\pkg\\lib-es5\\bin.js"
if (-not (Test-Path $pkgBin)) {
  throw "Missing pkg dependency. Run 'pnpm install' first."
}

function Get-FullPath {
  param([Parameter(Mandatory = $true)][string]$Path, [string]$Base = $repoRoot)
  if ([IO.Path]::IsPathRooted($Path)) { return [IO.Path]::GetFullPath($Path) }
  return [IO.Path]::GetFullPath((Join-Path $Base $Path))
}

$distDir = Join-Path $repoRoot "dist"
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }

$baseName =
  if ($pkgMeta -and $pkgMeta.name) { [string]$pkgMeta.name } else { [IO.Path]::GetFileNameWithoutExtension($Output) }
$version = if ($pkgMeta -and $pkgMeta.version) { [string]$pkgMeta.version } else { "dev" }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

$stampedExe = Join-Path $distDir ("{0}-{1}-{2}.exe" -f $baseName, $version, $stamp)
$versionedExe = Join-Path $distDir ("{0}-{1}.exe" -f $baseName, $version)

$outputPath = Get-FullPath -Path $Output
$outputDir = Split-Path -Parent $outputPath
if ($outputDir -and -not (Test-Path $outputDir)) { New-Item -ItemType Directory -Path $outputDir | Out-Null }

$stampedFull = Get-FullPath -Path $stampedExe -Base $repoRoot
$versionedFull = Get-FullPath -Path $versionedExe -Base $repoRoot

node $pkgBin . --targets $Target --output $stampedExe
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

node (Join-Path $repoRoot "scripts\\setWindowsIcon.js") $stampedExe $Icon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# Windows Explorer aggressively caches icons by file path; producing a versioned copy
# makes it obvious the new icon is actually embedded.
if ($stampedFull -ne $versionedFull) {
  Copy-Item -Force -Path $stampedExe -Destination $versionedExe
  Write-Host ("Wrote: {0}" -f $versionedExe)
}

try {
  $outputFull = Get-FullPath -Path $Output
  if ($stampedFull -ne $outputFull) {
    Copy-Item -Force -Path $stampedExe -Destination $outputFull
    Write-Host ("Wrote: {0}" -f $outputFull)
  } else {
    Write-Host ("Wrote: {0}" -f $stampedExe)
  }
} catch {
  Write-Warning ("Could not overwrite output EXE (likely in use): {0}`nUse: {1}" -f $outputPath, $stampedExe)
}

$outputBackup = ("{0}.bak" -f (Get-FullPath -Path $Output))
if (Test-Path $outputBackup) {
  Remove-Item -Force -Path $outputBackup -ErrorAction SilentlyContinue
  if (-not (Test-Path $outputBackup)) {
    Write-Host ("Deleted: {0}" -f $outputBackup)
  }
}
