# Codex Mate Desktop (Tauri)

Codex Mate 的桌面版使用 Tauri 作为 Windows / macOS 外壳，复用现有 Node CLI 与 Web UI 服务。

## 架构

- Tauri 负责桌面窗口、系统打包和平台安装包。
- 现有 `cli.js run --host 127.0.0.1 --no-browser` 继续提供本地 Web UI 与 `/api`。
- 桌面窗口加载 `http://127.0.0.1:3737`，避免重写现有 Web UI API。
- Rust / Tauri 源码只参与桌面构建阶段，不进入主 npm CLI 包。
- `npm run desktop:stage` 会先生成稳定运行时目录 `dist/desktop/codexmate/`，再由 Tauri 把这个目录作为单一 resource 打进 app。
- 打包产物内置构建机当前 Node.js runtime，release 启动后端时优先使用 bundled `node-runtime/node(.exe)`，不依赖用户系统 PATH 里的 `node`。

## Staging 布局

`tools/desktop/prepare-tauri-resources.js` 参考 Codex 的“先 stage、再打包、再校验”模型，生成的目录大致是：

```text
dist/desktop/codexmate/
├── codexmate-desktop.json
├── cli.js
├── cli/
├── lib/
├── plugins/
├── web-ui/
├── web-ui.html
├── package.json
├── package-lock.json
├── node-runtime/          # bundled Node.js runtime used by release desktop startup
└── node_modules/          # package-lock 中非 dev 的运行时依赖
```

脚本会验证入口文件、Web UI、manifest、`node_modules`、bundled Node runtime 和直接运行时依赖是否存在。这样可以提前暴露资源缺失，而不是等 `tauri build` 通过后才在用户机器上启动失败。

## 命令

```bash
npm run desktop:stage
npm run desktop:prepare   # desktop:stage 的兼容别名
npm run desktop:dev
npm run desktop:build
```

## 本地要求

桌面构建需要：

- Node.js 18+
- Rust / Cargo
- Tauri 对应平台依赖

release 桌面包会内置 Node.js runtime 来启动打包进 resources 的 Codex Mate 后端；用户机器不需要预装 Node.js。调试或排障时仍可用 `CODEXMATE_NODE=/path/to/node` 显式覆盖 runtime。

## 启动诊断日志

Windows release 包仍使用 GUI subsystem，普通双击不会弹出黑色控制台。需要快速定位启动闪退时，可以从 PowerShell / CMD 显式启用控制台日志：

```powershell
codexmate-desktop.exe --debug-console
```

也可以通过环境变量启用：

```powershell
$env:CODEXMATE_DESKTOP_LOG = "1"
codexmate-desktop.exe
```

启用后，桌面壳会尝试附着父控制台，打印 Rust/Tauri 启动日志，并让内置 Node backend 的 stdout/stderr 继承到当前终端。无论是否启用控制台，桌面壳都会写入本地文件日志；未启用控制台时，backend stdout/stderr 会写入 `startup.log`：

```text
%LOCALAPPDATA%\CodexMate\logs\desktop.log
%LOCALAPPDATA%\CodexMate\logs\startup.log
```

如需指定 `desktop.log` 位置：

```powershell
$env:CODEXMATE_DESKTOP_LOG_FILE = "$env:TEMP\codexmate-desktop.log"
codexmate-desktop.exe --debug-console
```

## CI

`.github/workflows/desktop-build.yml` 会在 GitHub Actions 上：

- `npm ci` 安装依赖
- `npm pack --dry-run --json` 验证主 npm CLI 包 payload
- `npm run desktop:stage` 验证桌面运行时 staging
- 在 macOS / Windows 上执行 `npm run desktop:build`

构建产物会以 `codexmate-desktop-macOS` / `codexmate-desktop-Windows` artifact 上传。
