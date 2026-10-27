# 快速开始

目标：安装启动后，找到一段已有对话并导出 Markdown，而不只是打开服务。建议先选一条本机已有的 Codex 或 Claude Code 会话完成操作；其他来源的差异见[会话指南](/guide/sessions)。

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

只查看已有会话，不必安装全部 CLI，也不必先配置 Provider。尚无记录时，先在选用的原工具里完成一段对话；需要运行该工具时再安装对应 CLI。

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

默认监听地址可被局域网访问；只需本机使用时选择上面的 `127.0.0.1`。默认端口被占用时会尝试后续端口；显式指定不可用的端口则启动失败，请以终端输出为准。

## 第一次完成：找回并导出一段对话

1. 打开终端输出的 Web UI 地址，进入会话视图。
2. 在「会话来源」选择已有记录的工具，用项目路径或时间筛选缩小范围。输入关键词并按回车检索；检索结果受来源记录格式与扫描范围影响。
3. 打开一条会话，核对讨论内容和项目是否正确。
4. 点击预览区的「导出记录」，打开下载的 Markdown，确认需要的内容是否包含在内。留意截断提示，导出限制和 CLI 参数见[会话指南](/guide/sessions)。

完成标志是拿到可阅读、内容符合预期的记录，而非仅看到首页。如果列表为空，先确认该来源在当前机器上有会话、筛选条件没有排除它，再刷新。不要通过配置 Provider 来尝试生成历史记录。

## 需要配置模型时再做

```bash
codexmate setup
codexmate status
```

`setup` 是交互式配置向导，`status` 检查当前配置，不是浏览已有会话的必要步骤。应用配置前先在 Web UI 预览；配置管理操作会写入本地文件。

## 下一步

按[会话指南](/guide/sessions)了解来源与导出边界。需要管理 Provider、Skills 或任务时，再看[核心工作流](/guide/workflow)。
