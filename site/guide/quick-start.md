# 快速开始

## 环境要求

- `Node.js >= 14`
- Windows / macOS / Linux

## 安装

三种方式任选其一。

### Homebrew（macOS / Linux）

```bash
brew tap SakuraByteCore/codexmate
brew install codexmate
```

需要 Node.js(`brew install node` 若未装)。

### npm

```bash
npm install -g codexmate
```

### curl 独立安装

```bash
curl -fsSL https://raw.githubusercontent.com/SakuraByteCore/codexmate/main/scripts/install.sh | bash
```

### 免安装试用

```bash
npx codexmate@latest status
```

## 安装官方 CLI（可选）

Codex Mate 能透传调用官方 CLI(如 `codexmate codex ...`)并在 Web UI 浏览本地会话。建议按需安装:

```bash
npm install -g @openai/codex
npm install -g @anthropic-ai/claude-code
npm install -g @google/gemini-cli
npm install -g @tencent-ai/codebuddy-code
npm install -g @kilocode/cli
```

OpenCode 见 [官方文档](https://opencode.ai/),OpenClaw 见 [仓库](https://github.com/moeru-ai/openclaw),Pi 会话从 `~/.pi/agent/sessions` 发现。

## 最短启动路径

```bash
codexmate setup
codexmate status
codexmate run
```

默认监听 `0.0.0.0:3737`,支持局域网访问,自动开浏览器。仅本机访问:

```bash
CODEXMATE_HOST=127.0.0.1 codexmate run
```

仅起服务(测试 / CI):

```bash
codexmate run --no-browser
```

固定端口:

```bash
CODEXMATE_PORT=8080 codexmate run
```

Windows PowerShell:

```powershell
$env:CODEXMATE_PORT=8080; codexmate run
```

> 安全提示:默认监听在局域网暴露未鉴权界面。仅可信网络使用;涉及 Key/配置/Skills 管理建议改 `127.0.0.1`。

## 校验建议

- 执行 `codexmate status` 确认当前 provider/model。
- 先在 Web UI 预览配置再应用。
- 导出会话先按来源筛选减少噪音数据。

## 下一步
跑起来后看 [核心工作流](/guide/workflow) 串一遍典型场景,或直接 [启动 Web UI](/guide/web-ui)。
