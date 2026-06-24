import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');

function readSource(relativePath) {
    return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

test('desktop release diagnostics expose console and file logging paths', () => {
    const mainSource = readSource('src-tauri/src/main.rs');
    const libSource = readSource('src-tauri/src/lib.rs');

    assert.match(mainSource, /app_lib::init_desktop_diagnostics\(\)/);
    assert.match(libSource, /CODEXMATE_DESKTOP_LOG/);
    assert.match(libSource, /CODEXMATE_DESKTOP_LOG_FILE/);
    assert.match(libSource, /--debug-console/);
    assert.match(libSource, /--log-to-console/);
    assert.match(libSource, /AttachConsole/);
    assert.match(libSource, /ATTACH_PARENT_PROCESS/);
    assert.match(libSource, /CONOUT\$/);
    assert.match(libSource, /fn desktop_default_logs_dir\(\) -> PathBuf[\s\S]*CodexMate[\s\S]*logs/);
    assert.match(libSource, /desktop_default_logs_dir\(\)\.join\("desktop\.log"\)/);
    assert.match(libSource, /desktop_default_logs_dir\(\)\.join\("startup\.log"\)/);
    assert.match(libSource, /startup_log_file=/);
    assert.match(libSource, /std::panic::set_hook/);
});

test('desktop backend startup diagnostics use fixed startup log for child stdio', () => {
    const libSource = readSource('src-tauri/src/lib.rs');

    assert.match(libSource, /let inherit_backend_stdio = DESKTOP_CONSOLE_LOGGING\.load/);
    assert.match(libSource, /command\.stdout\(Stdio::inherit\(\)\)\.stderr\(Stdio::inherit\(\)\)/);
    assert.match(libSource, /fn backend_startup_log_file_path\(\) -> PathBuf/);
    assert.match(libSource, /fn backend_startup_log_stdio\(\) -> Stdio/);
    assert.match(libSource, /command\.stdout\(backend_startup_log_stdio\(\)\)\.stderr\(backend_startup_log_stdio\(\)\)/);
    assert.match(libSource, /append_log_line\(backend_startup_log_file_path\(\), &line\)/);
    assert.match(libSource, /if DESKTOP_CONSOLE_LOGGING\.load[\s\S]*return;[\s\S]*CREATE_NO_WINDOW/);
});


test('desktop release backend uses bundled Node runtime instead of requiring system PATH node', () => {
    const libSource = readSource('src-tauri/src/lib.rs');
    const stageSource = readSource('tools/desktop/prepare-tauri-resources.js');

    assert.match(stageSource, /function copyNodeRuntime\(\)/);
    assert.match(stageSource, /process\.execPath/);
    assert.match(stageSource, /node-runtime/);
    assert.match(stageSource, /nodeRuntime/);
    assert.match(libSource, /fn find_node_runtime_path\(app: &tauri::App\)/);
    assert.match(libSource, /CODEXMATE_NODE/);
    assert.match(libSource, /node-runtime/);
    assert.match(libSource, /bundled_node_executable_name\(\)/);
    assert.match(libSource, /let node_bin = find_node_runtime_path\(app\)\?/);
    assert.match(libSource, /Command::new\(&node_bin\)/);
    assert.doesNotMatch(libSource, /unwrap_or_else\(\|_\| "node"\.to_string\(\)\)/);
});

test('desktop startup reuses healthy backend before clearing stale port listeners', () => {
    const libSource = readSource('src-tauri/src/lib.rs');

    assert.match(libSource, /fn release_stale_backend_port\(\) -> usize/);
    assert.match(libSource, /if health_check_ready\(\)[\s\S]*existing backend already ready[\s\S]*return Ok\(None\)/);
    assert.match(libSource, /release_stale_backend_port\(\);[\s\S]*if health_check_ready\(\)[\s\S]*backend became ready after stale port cleanup[\s\S]*return Ok\(None\)/);
    assert.match(libSource, /release_stale_backend_port\(\);[\s\S]*if backend_port_occupied\(\)/);
    assert.match(libSource, /local_address\.starts_with\("127\.0\.0\.1:"\)/);
    assert.match(libSource, /local_address\.starts_with\("\[::1\]:"\)/);
    assert.match(libSource, /non-local listener/);
    assert.match(libSource, /fn is_managed_backend_command\(command_line: &str\) -> bool/);
    assert.match(libSource, /cli\.js run/);
    assert.match(libSource, /codexmate\.exe run/);
    assert.match(libSource, /command_line=/);
    assert.match(libSource, /taskkill[\s\S]*\/PID[\s\S]*\/F/);
    assert.match(libSource, /kill[\s\S]*-9/);
    assert.match(libSource, /backend port cleanup killing managed loopback listener/);
    assert.match(libSource, /unmanaged listener on 127\.0\.0\.1:3737/);
    assert.doesNotMatch(libSource, /ShellExecuteW/);
    assert.doesNotMatch(libSource, /runas/);
});

test('desktop Windows package manifest requires administrator privileges', () => {
    const buildSource = readSource('src-tauri/build.rs');
    const manifestSource = readSource('src-tauri/app.manifest');

    assert.match(buildSource, /tauri_build::WindowsAttributes::new\(\)/);
    assert.match(buildSource, /\.app_manifest\(include_str!\("app\.manifest"\)\)/);
    assert.match(buildSource, /tauri_build::try_build\(attrs\)/);
    assert.match(manifestSource, /assemblyIdentity[\s\S]*name="ai\.codexmate\.desktop"/);
    assert.match(manifestSource, /requestedExecutionLevel\s+level="requireAdministrator"\s+uiAccess="false"/);
    assert.match(manifestSource, /Microsoft\.Windows\.Common-Controls/);
});

test('desktop build workflow verifies the final Windows exe UAC manifest', () => {
    const workflowSource = readSource('.github/workflows/desktop-build.yml');

    assert.match(workflowSource, /Verify Windows app UAC manifest/);
    assert.match(workflowSource, /codexmate-desktop\.exe/);
    assert.match(workflowSource, /mt\.exe/);
    assert.match(workflowSource, /Copy-Item \$manifest/);
    assert.match(workflowSource, /codexmate-desktop\.manifest\.xml/);
    assert.match(workflowSource, /src-tauri\/target\/release\/codexmate-desktop\.exe/);
    assert.match(workflowSource, /requestedExecutionLevel\\s\+level=\"requireAdministrator\"/);
});

test('desktop startup surfaces occupied backend port guidance instead of waiting for readiness timeout', () => {
    const libSource = readSource('src-tauri/src/lib.rs');

    assert.match(libSource, /fn MessageBoxW/);
    assert.match(libSource, /MB_ICONERROR/);
    assert.match(libSource, /MB_TOPMOST/);
    assert.match(libSource, /fn show_startup_error\(message: &str\)/);
    assert.match(libSource, /Codex Mate 启动失败/);
    assert.match(libSource, /fn backend_port_occupied\(\) -> bool/);
    assert.match(libSource, /fn backend_port_occupied_message\(\) -> String/);
    assert.match(libSource, /端口 3737 已被其他进程占用/);
    assert.match(libSource, /Windows 桌面版启动时会请求管理员权限/);
    assert.match(libSource, /详情见 startup\.log/);
    assert.match(libSource, /if backend_port_occupied\(\)[\s\S]*return startup_error\(message\)/);
    assert.match(libSource, /backend port remains occupied after cleanup/);
});

test('desktop windows installer supports overwrite-style reinstall flow', () => {
    const configSource = readSource('src-tauri/tauri.conf.json');
    const hookSource = readSource('src-tauri/windows/installer-hooks.nsh');

    assert.match(configSource, /"windows"\s*:/);
    assert.match(configSource, /"allowDowngrades"\s*:\s*true/);
    assert.match(configSource, /"upgradeCode"\s*:\s*"e84da745-7b0b-5548-85ed-a4a0be7b55ae"/);
    assert.match(configSource, /"installMode"\s*:\s*"both"/);
    assert.match(configSource, /"installerHooks"\s*:\s*"windows\/installer-hooks\.nsh"/);
    assert.match(hookSource, /NSIS_HOOK_PREINSTALL/);
    assert.match(hookSource, /taskkill \/IM "codexmate-desktop\.exe" \/F/);
});
