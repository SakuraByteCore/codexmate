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
    assert.match(libSource, /fn backend_startup_log_excerpt\(\) -> String/);
    assert.match(libSource, /startup\.log tail/);
    assert.match(libSource, /command[\s\S]*\.stdout\(backend_startup_log_stdio\(\)\)[\s\S]*\.stderr\(backend_startup_log_stdio\(\)\)/);
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

test('desktop startup reuses healthy backend without killing occupied ports', () => {
    const libSource = readSource('src-tauri/src/lib.rs');

    assert.match(libSource, /if health_check_ready\(\)[\s\S]*existing backend already ready[\s\S]*return Ok\(None\)/);
    assert.match(libSource, /backend port is occupied but not ready yet; waiting before surfacing occupied-port guidance/);
    assert.match(libSource, /if backend_port_occupied\(\)[\s\S]*wait_for_backend\(Duration::from_secs\(5\)\)[\s\S]*existing backend became ready while waiting[\s\S]*return Ok\(None\)/);
    assert.match(libSource, /backend port remains occupied after grace wait/);
    assert.doesNotMatch(libSource, /fn release_stale_backend_port\(\) -> usize/);
    assert.doesNotMatch(libSource, /fn is_managed_backend_command\(command_line: &str\) -> bool/);
    assert.doesNotMatch(libSource, /taskkill[\s\S]*\/PID[\s\S]*\/F/);
    assert.doesNotMatch(libSource, /kill[\s\S]*-9/);
    assert.doesNotMatch(libSource, /ShellExecuteW/);
    assert.doesNotMatch(libSource, /runas/);
});

test('desktop Windows package does not require administrator privileges', () => {
    const buildSource = readSource('src-tauri/build.rs');
    const workflowSource = readSource('.github/workflows/desktop-build.yml');

    assert.match(buildSource, /tauri_build::build\(\)/);
    assert.doesNotMatch(buildSource, /app_manifest/);
    assert.doesNotMatch(workflowSource, /Verify Windows app UAC manifest/);
    assert.doesNotMatch(workflowSource, /requireAdministrator/);
});

test('desktop startup surfaces occupied backend port guidance instead of killing processes', () => {
    const libSource = readSource('src-tauri/src/lib.rs');

    assert.match(libSource, /fn MessageBoxW/);
    assert.match(libSource, /MB_ICONERROR/);
    assert.match(libSource, /MB_TOPMOST/);
    assert.match(libSource, /fn show_startup_error\(message: &str\)/);
    assert.match(libSource, /Codex Mate 启动失败/);
    assert.match(libSource, /fn backend_port_occupied\(\) -> bool/);
    assert.match(libSource, /fn wait_for_spawned_backend\(child: &mut Child, timeout: Duration\) -> Result<\(\), String>/);
    assert.match(libSource, /backend exited before readiness/);
    assert.match(libSource, /Duration::from_secs\(60\)/);
    assert.match(libSource, /backend_startup_log_excerpt\(\)/);
    assert.match(libSource, /fn backend_port_occupied_message\(\) -> String/);
    assert.match(libSource, /端口 3737 已被其他进程占用/);
    assert.match(libSource, /请先关闭旧的 Codex Mate \/ codexmate run 实例后重试/);
    assert.match(libSource, /startup\.log/);
    assert.match(libSource, /if backend_port_occupied\(\)[\s\S]*wait_for_backend\(Duration::from_secs\(5\)\)[\s\S]*return startup_error\(message\)/);
    assert.match(libSource, /backend port remains occupied after grace wait/);
});

test('desktop windows installer avoids force-closing running apps', () => {
    const configSource = readSource('src-tauri/tauri.conf.json');

    assert.match(configSource, /"windows"\s*:/);
    assert.match(configSource, /"allowDowngrades"\s*:\s*true/);
    assert.match(configSource, /"upgradeCode"\s*:\s*"e84da745-7b0b-5548-85ed-a4a0be7b55ae"/);
    assert.match(configSource, /"installMode"\s*:\s*"both"/);
    assert.doesNotMatch(configSource, /installerHooks/);
});
