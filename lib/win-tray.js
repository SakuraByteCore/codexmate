'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let trayProcess = null;
let exitMarkerPath = null;
let checkTimer = null;

function startWinTray(options = {}) {
    if (process.platform !== 'win32') return;

    const name = String(options.name || 'App');
    const port = Number(options.port) || 3000;
    const pid = process.pid;
    const url = `http://localhost:${port}`;

    exitMarkerPath = path.join(os.tmpdir(), `codexmate-tray-exit-${pid}.marker`);

    try { fs.unlinkSync(exitMarkerPath); } catch (_) { }

    const script = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms, System.Drawing

$name = "${name}"
$url = "${url}"
$exitMarkerPath = "${exitMarkerPath.replace(/\\/g, '/')}"

$form = New-Object System.Windows.Forms.Form
$form.ShowInTaskbar = $false
$form.WindowState = [System.Windows.Forms.FormWindowState]::Minimized
$form.Visible = $false

$icon = New-Object System.Windows.Forms.NotifyIcon
try {
    $bmp = New-Object System.Drawing.Bitmap 16, 16
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(59, 130, 246))
    $font = New-Object System.Drawing.Font "Arial", 10, [System.Drawing.FontStyle]::Bold
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $g.DrawString("C", $font, $brush, -1, -1)
    $g.Dispose()
    $hIcon = $bmp.GetHicon()
    $icon.Icon = [System.Drawing.Icon]::FromHandle($hIcon)
} catch {
    $icon.Icon = [System.Drawing.SystemIcons]::Information
}

$icon.Text = if ($name.Length -gt 63) { $name.Substring(0, 63) } else { $name }
$icon.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = $menu.Items.Add("Open")
$openItem.add_Click({ try { [System.Diagnostics.Process]::Start($url) } catch {} })
$menu.Items.Add("-") | Out-Null
$exitItem = $menu.Items.Add("Exit")
$exitItem.add_Click({
    try { New-Item -Path $exitMarkerPath -ItemType File -Force | Out-Null } catch {}
    $icon.Visible = $false
    $icon.Dispose()
    [System.Windows.Forms.Application]::Exit()
})

$icon.ContextMenuStrip = $menu
$icon.add_DoubleClick({ try { [System.Diagnostics.Process]::Start($url) } catch {} })

[System.Windows.Forms.Application]::Run($form)
`.trim();

    const scriptPath = path.join(os.tmpdir(), `codexmate-tray-${pid}.ps1`);
    fs.writeFileSync(scriptPath, script, 'utf8');

    try {
        trayProcess = spawn('powershell.exe', [
            '-NoProfile', '-Sta', '-WindowStyle', 'Hidden',
            '-ExecutionPolicy', 'Bypass', '-File', scriptPath
        ], { stdio: 'ignore', detached: true, windowsHide: true });
        trayProcess.unref();
        trayProcess.on('error', () => { });
        trayProcess.on('exit', () => {
            trayProcess = null;
            try { fs.unlinkSync(scriptPath); } catch (_) { }
        });
    } catch (_) {
        try { fs.unlinkSync(scriptPath); } catch (_) { }
    }

    checkTimer = setInterval(() => {
        if (!exitMarkerPath) return;
        try {
            fs.accessSync(exitMarkerPath, fs.constants.F_OK);
            try { fs.unlinkSync(exitMarkerPath); } catch (_) { }
            process.exit(0);
        } catch (_) { }
    }, 1500);
}

function stopWinTray() {
    if (checkTimer) { clearInterval(checkTimer); checkTimer = null; }
    if (trayProcess) {
        try { trayProcess.kill(); } catch (_) { }
        trayProcess = null;
    }
    if (exitMarkerPath) {
        try { fs.unlinkSync(exitMarkerPath); } catch (_) { }
        exitMarkerPath = null;
    }
    if (process.platform === 'win32') {
        try {
            const scriptPath = path.join(os.tmpdir(), `codexmate-tray-${process.pid}.ps1`);
            fs.unlinkSync(scriptPath);
        } catch (_) { }
    }
}

module.exports = { startWinTray, stopWinTray };
