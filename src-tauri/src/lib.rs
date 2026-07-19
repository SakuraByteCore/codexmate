use std::{
    fs::{self, OpenOptions},
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use tauri::{Manager, WindowEvent};

struct BackendState(Mutex<Option<Child>>);

static DESKTOP_CONSOLE_LOGGING: AtomicBool = AtomicBool::new(false);

#[cfg(windows)]
mod windows_console {
    #[link(name = "kernel32")]
    extern "system" {
        fn AttachConsole(dw_process_id: u32) -> i32;
    }

    const ATTACH_PARENT_PROCESS: u32 = 0xFFFF_FFFF;

    pub fn attach_parent_console() -> bool {
        // SAFETY: AttachConsole is a process-wide Windows API. Passing the documented
        // ATTACH_PARENT_PROCESS constant only asks Windows to connect this GUI-subsystem
        // process to the launching console, when one exists.
        unsafe { AttachConsole(ATTACH_PARENT_PROCESS) != 0 }
    }
}

#[cfg(windows)]
mod windows_dialog {
    use std::{ffi::c_void, os::windows::ffi::OsStrExt, ptr};

    #[link(name = "user32")]
    extern "system" {
        fn MessageBoxW(hwnd: *mut c_void, text: *const u16, caption: *const u16, kind: u32) -> i32;
    }

    const MB_OK: u32 = 0x00000000;
    const MB_ICONERROR: u32 = 0x00000010;
    const MB_TOPMOST: u32 = 0x00040000;

    fn wide(value: &str) -> Vec<u16> {
        std::ffi::OsStr::new(value)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    pub fn show_error(caption: &str, message: &str) {
        let caption = wide(caption);
        let message = wide(message);
        // SAFETY: MessageBoxW is called with null owner and valid null-terminated
        // UTF-16 buffers that outlive the call.
        unsafe {
            MessageBoxW(
                ptr::null_mut(),
                message.as_ptr(),
                caption.as_ptr(),
                MB_OK | MB_ICONERROR | MB_TOPMOST,
            );
        }
    }
}

fn desktop_debug_requested() -> bool {
    let env_enabled = std::env::var("CODEXMATE_DESKTOP_LOG")
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on" | "trace" | "debug"
            )
        })
        .unwrap_or(false);
    if env_enabled {
        return true;
    }

    std::env::args().skip(1).any(|arg| {
        matches!(
            arg.as_str(),
            "--debug-console" | "--console-log" | "--log-to-console" | "--verbose" | "--trace"
        )
    })
}

fn desktop_log_file_path() -> PathBuf {
    if let Ok(value) = std::env::var("CODEXMATE_DESKTOP_LOG_FILE") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }

    desktop_default_logs_dir().join("desktop.log")
}

fn desktop_default_logs_dir() -> PathBuf {
    let base_dir = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir());
    base_dir.join("CodexMate").join("logs")
}

fn backend_startup_log_file_path() -> PathBuf {
    desktop_default_logs_dir().join("startup.log")
}

fn now_epoch_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or(0)
}

fn write_console_log(line: &str) {
    #[cfg(windows)]
    if let Ok(mut console) = OpenOptions::new().write(true).open("CONOUT$") {
        let _ = console.write_all(line.as_bytes());
        return;
    }

    let _ = std::io::stderr().write_all(line.as_bytes());
}

fn desktop_log(message: impl AsRef<str>) {
    let line = format!("[{}] {}\n", now_epoch_millis(), message.as_ref());
    if DESKTOP_CONSOLE_LOGGING.load(Ordering::Relaxed) {
        write_console_log(&line);
    }

    append_log_line(desktop_log_file_path(), &line);
    append_log_line(backend_startup_log_file_path(), &line);
}

fn show_startup_error(message: &str) {
    desktop_log(format!("startup error shown to user: {message}"));
    #[cfg(windows)]
    windows_dialog::show_error("Codex Mate 启动失败", message);
}

fn startup_error<T>(message: impl Into<String>) -> Result<T, Box<dyn std::error::Error>> {
    let message = message.into();
    show_startup_error(&message);
    Err(message.into())
}

fn append_log_line(log_path: PathBuf, line: &str) {
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = file.write_all(line.as_bytes());
    }
}

fn backend_startup_log_stdio() -> Stdio {
    let log_path = backend_startup_log_file_path();
    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
        .map(Stdio::from)
        .unwrap_or_else(|_| Stdio::null())
}

fn backend_startup_log_excerpt() -> String {
    let log_path = backend_startup_log_file_path();
    let Ok(bytes) = fs::read(&log_path) else {
        return format!("startup.log not readable at {}", log_path.display());
    };
    if bytes.is_empty() {
        return format!("startup.log is empty at {}", log_path.display());
    }

    let keep_from = bytes.len().saturating_sub(4096);
    let text = String::from_utf8_lossy(&bytes[keep_from..]);
    let excerpt = text
        .lines()
        .rev()
        .take(30)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join("\n");
    if excerpt.trim().is_empty() {
        format!("startup.log has no readable text at {}", log_path.display())
    } else {
        format!("startup.log tail ({}):\n{}", log_path.display(), excerpt)
    }
}

fn configure_desktop_console_logging() -> bool {
    if !desktop_debug_requested() {
        DESKTOP_CONSOLE_LOGGING.store(false, Ordering::Relaxed);
        return false;
    }

    #[cfg(windows)]
    let attached = windows_console::attach_parent_console();
    #[cfg(not(windows))]
    let attached = true;

    DESKTOP_CONSOLE_LOGGING.store(attached, Ordering::Relaxed);
    attached
}

pub fn init_desktop_diagnostics() {
    let console_attached = configure_desktop_console_logging();
    let log_path = desktop_log_file_path();
    std::panic::set_hook(Box::new(move |panic_info| {
        desktop_log(format!("panic: {panic_info}"));
    }));

    desktop_log(format!(
        "codexmate desktop starting; console_logging={}; log_file={}; startup_log_file={}",
        console_attached,
        log_path.display(),
        backend_startup_log_file_path().display()
    ));
    desktop_log(format!(
        "args={}",
        std::env::args().collect::<Vec<_>>().join(" ")
    ));
}

fn health_check_ready() -> bool {
    let addr: SocketAddr = match "127.0.0.1:3737".parse() {
        Ok(value) => value,
        Err(_) => return false,
    };
    let mut stream = match TcpStream::connect_timeout(&addr, Duration::from_millis(1000)) {
        Ok(value) => value,
        Err(_) => return false,
    };
    let _ = stream.set_read_timeout(Some(Duration::from_millis(1500)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(1000)));

    let body = r#"{"action":"health-check","params":{}}"#;
    let request = format!(
    "POST /api HTTP/1.1\r\nHost: 127.0.0.1:3737\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
    body.as_bytes().len(),
    body
  );
    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }
    let status_ok = response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200");
    let identity_ok = response.contains("\"ok\":true");
    status_ok && identity_ok
}

fn backend_port_occupied() -> bool {
    let addr: SocketAddr = match "127.0.0.1:3737".parse() {
        Ok(value) => value,
        Err(_) => return false,
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(1000)).is_ok()
}

fn backend_port_occupied_message() -> String {
    "端口 3737 已被其他进程占用，Codex Mate 无法启动后端。请先关闭旧的 Codex Mate / codexmate run 实例后重试；如果问题持续，请查看 startup.log。".to_string()
}

fn wait_for_backend(timeout: Duration) -> bool {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if health_check_ready() {
            desktop_log("backend health check passed");
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    desktop_log("backend health check timed out");
    false
}

fn wait_for_spawned_backend(child: &mut Child, timeout: Duration) -> Result<(), String> {
    let started = Instant::now();
    while started.elapsed() < timeout {
        if health_check_ready() {
            desktop_log("spawned backend health check passed");
            return Ok(());
        }

        match child.try_wait() {
            Ok(Some(status)) => {
                let message = format!(
          "Codex Mate 后端进程已退出，未能完成启动。退出状态：{status}。请查看 startup.log。详情：codexmate backend exited before becoming ready on 127.0.0.1:3737\n\n{}",
          backend_startup_log_excerpt()
        );
                desktop_log(format!("backend exited before readiness; status={status}"));
                return Err(message);
            }
            Ok(None) => {}
            Err(err) => {
                desktop_log(format!(
                    "backend readiness wait could not inspect child status: {err}"
                ));
            }
        }

        std::thread::sleep(Duration::from_millis(200));
    }

    let message = format!(
    "Codex Mate 后端启动后没有及时就绪。请关闭旧的 Codex Mate / codexmate run 实例后重试；如果问题持续，请查看 startup.log。详情：codexmate backend did not become ready on 127.0.0.1:3737\n\n{}",
    backend_startup_log_excerpt()
  );
    desktop_log("spawned backend health check timed out");
    Err(message)
}

#[cfg(windows)]
fn configure_backend_process(command: &mut Command) {
    if DESKTOP_CONSOLE_LOGGING.load(Ordering::Relaxed) {
        return;
    }
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn configure_backend_process(_command: &mut Command) {}

fn find_cli_path(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let mut candidates = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("codexmate").join("cli.js"));
        candidates.push(resource_dir.join("cli.js"));
    }

    #[cfg(debug_assertions)]
    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir.join("cli.js"));
    }

    candidates
        .into_iter()
        .find(|candidate| candidate.is_file())
        .ok_or_else(|| "unable to locate bundled codexmate cli.js".into())
}

fn bundled_node_executable_name() -> &'static str {
    if cfg!(windows) {
        "node.exe"
    } else {
        "node"
    }
}

fn find_node_runtime_path(app: &tauri::App) -> Result<PathBuf, Box<dyn std::error::Error>> {
    if let Ok(value) = std::env::var("CODEXMATE_NODE") {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        let candidates = [
            resource_dir
                .join("codexmate")
                .join("node-runtime")
                .join(bundled_node_executable_name()),
            resource_dir
                .join("node-runtime")
                .join(bundled_node_executable_name()),
        ];

        if let Some(candidate) = candidates.into_iter().find(|candidate| candidate.is_file()) {
            return Ok(candidate);
        }
    }

    #[cfg(debug_assertions)]
    {
        Ok(PathBuf::from("node"))
    }

    #[cfg(not(debug_assertions))]
    {
        startup_error("Codex Mate 打包产物缺少内置 Node.js runtime，无法启动后端。请重新下载安装包；如果问题持续，请查看 startup.log。详情：bundled node-runtime/node is missing")
    }
}

fn spawn_backend(app: &tauri::App) -> Result<Option<Child>, Box<dyn std::error::Error>> {
    if std::env::var("CODEXMATE_DESKTOP_SKIP_BACKEND")
        .ok()
        .as_deref()
        == Some("1")
    {
        desktop_log("backend spawn skipped by CODEXMATE_DESKTOP_SKIP_BACKEND=1");
        return Ok(None);
    }

    if health_check_ready() {
        desktop_log("existing backend already ready; reusing 127.0.0.1:3737 listener");
        return Ok(None);
    }

    if backend_port_occupied() {
        desktop_log("backend port is occupied but not ready yet; waiting before surfacing occupied-port guidance");
        if wait_for_backend(Duration::from_secs(5)) {
            desktop_log(
                "existing backend became ready while waiting; reusing 127.0.0.1:3737 listener",
            );
            return Ok(None);
        }
        let message = backend_port_occupied_message();
        desktop_log(format!(
            "backend port remains occupied after grace wait; {message}"
        ));
        return startup_error(message);
    }

    let cli_path = find_cli_path(app)?;
    let cli_dir = cli_path
        .parent()
        .ok_or_else(|| "unable to resolve codexmate cli directory")?;
    let node_bin = find_node_runtime_path(app)?;
    let inherit_backend_stdio = DESKTOP_CONSOLE_LOGGING.load(Ordering::Relaxed);

    desktop_log(format!(
        "spawning backend; node={}; cli={}; cwd={}; inherit_stdio={}",
        node_bin.display(),
        cli_path.display(),
        cli_dir.display(),
        inherit_backend_stdio
    ));

    let mut command = Command::new(&node_bin);
    command
        .arg(&cli_path)
        .arg("run")
        .arg("--host")
        .arg("127.0.0.1")
        .arg("--no-browser")
        .current_dir(cli_dir)
        .env("CODEXMATE_NO_BROWSER", "1")
        .env("CODEXMATE_HOST", "127.0.0.1")
        .env("CODEXMATE_PORT", "3737")
        .stdin(Stdio::null());

    if inherit_backend_stdio {
        command.stdout(Stdio::inherit()).stderr(Stdio::inherit());
    } else {
        command
            .stdout(backend_startup_log_stdio())
            .stderr(backend_startup_log_stdio());
    }

    configure_backend_process(&mut command);

    let mut child = command.spawn().map_err(|err| {
        desktop_log(format!("backend spawn failed: {err}"));
        format!("unable to start codexmate backend with Node.js: {err}")
    })?;

    desktop_log(format!("backend process spawned; pid={}", child.id()));

    if let Err(message) = wait_for_spawned_backend(&mut child, Duration::from_secs(60)) {
        let _ = child.kill();
        let _ = child.wait();
        desktop_log("backend killed after spawned readiness failure");
        return startup_error(message);
    }

    Ok(Some(child))
}

fn stop_backend(window: &tauri::Window) {
    let state = window.state::<BackendState>();
    let child = {
        let mut guard = match state.0.lock() {
            Ok(value) => value,
            Err(_) => return,
        };
        guard.take()
    };

    if let Some(mut child) = child {
        desktop_log(format!("stopping backend process; pid={}", child.id()));
        let _ = child.kill();
        let _ = child.wait();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    desktop_log("building tauri application");
    tauri::Builder::default()
        .setup(|app| {
            app.handle().plugin(
                tauri_plugin_log::Builder::default()
                    .level(log::LevelFilter::Info)
                    .build(),
            )?;
            if cfg!(debug_assertions) {
                desktop_log("debug build: backend managed by beforeDevCommand");
                app.manage(BackendState(Mutex::new(None)));
            } else {
                let child = spawn_backend(app)?;
                app.manage(BackendState(Mutex::new(child)));
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() == "main" && matches!(event, WindowEvent::Destroyed) {
                desktop_log("main window destroyed");
                stop_backend(window);
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
