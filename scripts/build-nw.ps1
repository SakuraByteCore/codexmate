param(
  [string]$Platform = "win64",
  [string]$Arch = "x64",
  [string]$OutputDir = "dist-nw"
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

$baseName = if ($pkgMeta -and $pkgMeta.name) { [string]$pkgMeta.name } else { "codex-switcher" }
$version = if ($pkgMeta -and $pkgMeta.version) { [string]$pkgMeta.version } else { "dev" }

$distDir = Join-Path $repoRoot $OutputDir
if (-not (Test-Path $distDir)) { New-Item -ItemType Directory -Path $distDir | Out-Null }

Write-Host "Building NW.js application..." -ForegroundColor Cyan
Write-Host "Platform: $Platform, Arch: $Arch" -ForegroundColor Gray

$nwbuildCmd = "npx nwbuild"

$arguments = @(
  "--mode=build",
  "--version=latest",
  "--platform=$Platform",
  "--arch=$Arch",
  "--outDir=$distDir",
  "$repoRoot"
)

Write-Host "Running: $nwbuildCmd $($arguments -join ' ')" -ForegroundColor Gray

& npx nwbuild @arguments
if ($LASTEXITCODE -ne 0) {
  Write-Host "NW.js build failed!" -ForegroundColor Red
  exit $LASTEXITCODE
}

$buildDir = Join-Path $distDir ("Codex Switcher Pro" -replace ' ', '')
if (Test-Path $buildDir) {
  $exeName = "$baseName.exe"
  $sourceExe = Join-Path $buildDir $exeName
  $versionedExe = Join-Path $distDir ("{0}-{1}.exe" -f $baseName, $version)

  if (Test-Path $sourceExe) {
    Copy-Item -Force -Path $sourceExe -Destination $versionedExe
    Write-Host "`nBuild completed successfully!" -ForegroundColor Green
    Write-Host "Output: $versionedExe" -ForegroundColor Cyan
  }
} else {
  Write-Host "Build directory not found at $buildDir" -ForegroundColor Yellow
}
