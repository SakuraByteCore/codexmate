<div align="center">

<img src="site/.vitepress/public/images/logo.png" alt="Codex Mate logo" width="160" />

# Codex Mate

**找回散落在不同 AI 编程工具里的对话。**

Codex Mate 是本地运行的 CLI + Web 管理工具，在一个界面查看、筛选和导出已有会话，也能集中管理 Provider、Skills 与任务。

<p>
  <a href="https://sakurabytecore.github.io/codexmate/">[项目文档]</a>
  <a href="#快速开始">[快速开始]</a>
  <a href="README.md">[English]</a>
  <a href="README.vi.md">[Tiếng Việt]</a>
</p>

[![Version](https://img.shields.io/npm/v/codexmate?style=flat-square&color=A179FF)](https://www.npmjs.com/package/codexmate)
[![Build](https://img.shields.io/github/actions/workflow/status/SakuraByteCore/codexmate/release.yml?style=flat-square&color=44cc11)](https://github.com/SakuraByteCore/codexmate/actions/workflows/release.yml)
[![Downloads](https://img.shields.io/npm/dt/codexmate?style=flat-square)](https://www.npmjs.com/package/codexmate)
[![Install](https://img.shields.io/badge/install-brew%20%7C%20curl%20%7C%20npm-0A0?style=flat-square)](#homebrew-安装macos--linux)
[![Platform](https://img.shields.io/badge/platform-Termux%20%7C%20Linux%20%7C%20macOS%20%7C%20Windows-555?style=flat-square)](#快速开始)
[![Node](https://img.shields.io/node/v/codexmate?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/npm/l/codexmate?style=flat-square)](LICENSE)
[![Stars](https://img.shields.io/github/stars/SakuraByteCore/codexmate?style=flat-square&color=gold)](https://github.com/SakuraByteCore/codexmate/stargazers)
[![Issues](https://img.shields.io/github/issues/SakuraByteCore/codexmate?style=flat-square&color=ff69b4)](https://github.com/SakuraByteCore/codexmate/issues)
[![On StackMap](https://img.shields.io/endpoint?url=https%3A%2F%2Fstackmap.shipwithai.xyz%2Fapi%2Fbadge%2Fcodexmate.json)](https://stackmap.shipwithai.xyz/repos/SakuraByteCore/codexmate?utm_source=badge)

<br />

</div>

---

> [!TIP]
> **本地优先**：读取本机已有会话、管理本地配置，无需 Codex Mate 云端账户，不收遥测。模型调用仍由所配置的 Provider 处理，本地运行不等于模型离线运行。

## 什么是 Codex Mate?

上周讨论过的方案，忘了是在 Codex 还是 Claude Code？先在会话浏览器按来源、项目或时间缩小范围，打开记录确认内容，再导出为 Markdown 留作参考。

Codex Mate 管理已有工具和本地记录，不是新的 AI 模型，也不替代原来的编程助手。第一次使用不必配置全部工具；先找回一段对话即可。

[开始使用](#快速开始) · [查看会话使用方法](https://sakurabytecore.github.io/codexmate/guide/sessions) · [线程交接](#线程交接)

## 快速开始

先任选一种方式安装，再运行 `codexmate run`。按终端显示的地址打开 Web UI，在「会话来源」选已有记录的工具，打开一条会话并点击「导出记录」。没有本地记录时，先在原工具中产生一段对话。

导出用于阅读与归档，不等于在另一工具中恢复完整状态。需要配置 Provider 时再使用 `codexmate setup`；详细步骤见[快速开始](https://sakurabytecore.github.io/codexmate/guide/quick-start)。

### Homebrew 安装（macOS / Linux）

```bash
brew tap SakuraByteCore/codexmate
brew install codexmate
```

需要 [Node.js](https://nodejs.org/)（如未安装可执行 `brew install node`）。

### 通过 npm 安装

```bash
npm install -g codexmate
codexmate run
```

如果默认 Web UI 端口 `3737` 不可用，Codex Mate 会自动尝试后续端口（`3738`、`3739` ...）。如需固定端口，可以指定 `CODEXMATE_PORT`：

```bash
CODEXMATE_PORT=8080 codexmate run
```

Windows PowerShell：

```powershell
$env:CODEXMATE_PORT=8080; codexmate run
```

### 通过 curl 安装 (独立包)

```bash
curl -fsSL https://raw.githubusercontent.com/SakuraByteCore/codexmate/main/scripts/install.sh | bash
```

### 支持的智能体

- **Codex**: `npm install -g @openai/codex`
- **Claude Code**: `npm install -g @anthropic-ai/claude-code`
- **Gemini CLI**: `npm install -g @google/gemini-cli`
- **CodeBuddy**: `npm install -g @tencent-ai/codebuddy-code`
- **KiloCode**: `npm install -g @kilocode/cli`（`kilo` / `kilocode`）
- **OpenCode**: 参照 [OpenCode 官方文档](https://opencode.ai/) 安装
- **OpenClaw**: 参见 [OpenClaw 仓库](https://github.com/moeru-ai/openclaw)
- **Pi**: 会话从 `~/.pi/agent/sessions` 自动发现；供应商配置位于 `~/.pi/agent/models.json`，默认供应商/模型位于 `~/.pi/agent/settings.json`
- **Zed**: 智能体会话从 Zed 本地数据库（其数据目录下的 `threads/threads.db`）只读发现，并在会话浏览器中列出

---

## 线程交接

通过共享记忆 MCP 向目标智能体交接结构化卡片，不等于恢复完整会话状态。先保存 `card.json`：`goal` 为字符串，`completed`、`blockers`、`nextSteps`、`files` 均为字符串数组。

```json
{
  "goal": "完成文档更新",
  "completed": ["已核查会话指南"],
  "blockers": [],
  "nextSteps": ["核对各语言示例"],
  "files": ["README.md"]
}
```

在源码目录运行下列命令；安装后将 `node cli.js` 替换为 `codexmate`：

```bash
node cli.js thread handoff <thread-id> --card <json-file> --target <agent>
node cli.js thread list <thread-id>
node cli.js thread fallback <thread-id> --handoff <id>
node cli.js thread ack <thread-id> --handoff <id> --agent <target> --evidence <session-or-retrieval-id>
```

将交接返回的编号填入 `<id>`，`<target>` 使用同一目标智能体，证据填写真实会话或检索编号。仅在目标自报已读取卡片后执行 `ack`。

- **文件优先，限定 MCP 路由**：先将交接文件保存到 `~/.codexmate/threads/<hash>/`。只读探测项目 `.mcp.json`、Claude 用户配置、Codex `config.toml` 中的共享记忆 MCP，不修改配置。按兼容原生写入工具选择单个 MCP，使用短连接，不启动守护进程。不承诺兼容任意 MCP 版本，不新增依赖，不添加强行插入提示词的机制。
- **显式文件回退**：MCP 写入失败不自动重试，结果明确提示文件路径。`thread fallback` 返回文件文本。界面会话交接区的「复制卡片」按钮同样是显式文件回退；复制后仍须手动粘贴到目标，不自动发送。
- **写入成功不等于读取**：MCP 写入成功仅进入 `awaiting_read`，不能证明目标已读取。`thread ack` 记录附证据的目标自报读取，不是独立验证的回执。
- **交接审计**：`thread list <thread-id>` 返回审计，包含所选 MCP/tool、耗时、写入结果、回退和读取状态。

---

## 有什么独特之处？

找回对话之后，还可以继续管理日常工作所需的配置、Skills 与任务：
- **统一会话浏览器**：集中浏览 Codex、Claude Code、Gemini CLI、CodeBuddy Code、WorkBuddy、Pi、OpenCode 与 Zed 的本地会话；检索、导出和删除的来源限制见[会话指南](https://sakurabytecore.github.io/codexmate/guide/sessions)。
- **OpenAI 兼容桥接**：通过归一化 Responses API，让 Codex 能够与任何支持 OpenAI 格式的 UI 配合使用；内建 Codex 转换会补齐并规范化 `User-Agent`、`Version`、`OpenAI-Beta`、`Originator` 等 Codex 指纹，对上游伪装为官方 Codex CLI 请求。
- **Claude Provider 桥接**：通过内建本地 Claude 兼容代理，让 Claude Code 接入 OpenAI Chat Completions 兼容 provider 与 Ollama。
- **OpenCode Provider 控制**：在 `~/.codexmate` 下维护 CodexMate 自有的 OpenCode 多 provider 存储，只将当前选中的 provider 投影到 OpenCode 原生配置，避免污染或误删用户已有配置。
- **Pi Provider 配置**：在 Web UI 中管理 Pi 供应商，写入 `~/.pi/agent/models.json` 时无损保留未知字段，支持自动拉取远端模型列表，并可一键切换 `~/.pi/agent/settings.json` 中的默认供应商/模型。
- **Provider 健康清理**：探测本地 Codex 与 Claude provider 路由，在同一个弹窗里集中展示失败配置，并批量清理已选坏配置，不影响正常或受保护项。
- **Skills 市场**：本地优先的市场，支持在不同的智能体应用之间共享和导入 Skills。
- **提示词文件编辑器**：统一编辑全局和项目级 `CLAUDE.md` 与 `AGENTS.md`（含 OpenCode 的 `~/.config/opencode/AGENTS.md`），支持项目路径自动检测，并提供通用预设池复用 prompt。
- **任务编排器**：复用工作流定义自动推进任务，持久保存进度与结果，仅在阻塞时请求介入。

---

## 当前进展

| 特性 | 状态 | 描述 |
| --- | --- | --- |
| **Provider 管理** | ✅ | 切换 Codex、Claude、OpenCode、KiloCode、OpenClaw 与 Pi 的 provider/model |
| **状态实时同步** | ✅ | 实时感知 Codex/Claude 的配置与运行状态变更 |
| **会话浏览器** | ✅ | 集中浏览与筛选本地会话，按来源提供检索、Markdown 导出等操作；详见会话指南 |
| **Usage 统计** | ✅ | 可视化消息趋势与热门项目统计 |
| **本地 Skills 市场** | ✅ | 跨应用的智能体 Skills 导入与导出 |
| **任务队列** | ✅ | 支持依赖的自动工作流、持久进度、安全恢复与结果汇总 |
| **OpenAI 桥接** | ✅ | 将 Codex Responses API 转换为标准 OpenAI 格式，并在内建转换中附加/规范化 Codex 指纹 |
| **Claude Provider 桥接** | ✅ | 通过内建 Claude 兼容代理，让 Claude Code 接入 OpenAI Chat Completions 兼容 provider 与 Ollama |
| **OpenCode Provider 存储** | ✅ | 在 `~/.codexmate` 中保留多个 OpenCode provider，只将当前选中的 provider 投影到 OpenCode 原生配置 |
| **Pi Provider 配置** | ✅ | 在 Web UI 中管理 Pi 供应商，写入 `~/.pi/agent/models.json`（未知字段无损保留），并切换 `~/.pi/agent/settings.json` 中的默认供应商/模型 |
| **Provider 健康检查** | ✅ | 探测本地 Codex/Claude provider 路由，标记失败配置，并安全批量移除已选坏配置 |
| **提示词模板** | ✅ | 支持变量的可复用提示词插件 |
| **提示词文件编辑器** | ✅ | 编辑全局和项目级 CLAUDE.md / AGENTS.md，支持自动检测、路径切换与通用预设池。应用预设只更新编辑器，需手动保存才会写入文件。 |
| **MCP 集成** | ✅ | 通过 MCP stdio 暴露本地工具与资源 |
| **自动更新** | ✅ | 通过 `codexmate update` 快速更新 CLI |

---

## 自动工作流：提交后无需持续看守

复用现有工作流定义，提交一次后由后端自动推进。首页“自动工作流”提供提交、结果查询、补充输入后继续、取消后续执行。关闭页面不影响任务；服务停止期间不执行任务。

### 启动与使用

先在一个终端启动本地服务，保持服务运行：

```bash
codexmate run --no-browser
```

在另一个终端提交任务。将返回记录中的 `id` 用作后续命令的 `<runId>`：

```bash
codexmate workflow list --json
codexmate workflow submit diagnose-config --json
codexmate workflow active-runs --json
codexmate workflow detail <runId> --json
codexmate workflow resume <runId> --input @input.json --json
codexmate workflow cancel <runId> --json
```

- `resume` 仅继续等待介入的任务；`input.json` 提供补充后的完整输入。省略 `--input` 时保留原输入。
- 写入步骤需要显式传入 `--allow-write`，还须开启对应工具配置的写权限。结果不明的写步骤，须核对实际副作用后再决定是否继续。
- CLI 默认连接 `127.0.0.1:3737`。自定义端口时，服务与调用终端须配置相同的 `CODEXMATE_PORT`；配置访问令牌时，两端须使用相同的 `CODEXMATE_HTTP_TOKEN`。
- 原同步命令 `codexmate workflow run` 保持兼容；`workflow runs` 查询原执行历史，`workflow active-runs` 查询持久运行记录。

### 自动处理与安全边界

- 持久保存定义快照、输入、节点状态、完整输出和尝试次数；结果汇总包含完成项、最终结果与未完成原因。
- 重启服务后恢复已确认安全的只读节点，不重复执行已成功节点。写节点或未分类节点的执行结果不明时，转为等待介入，不自动重放。
- 支持显式依赖校验；旧定义保持顺序执行。不包含自然语言自动拆任务。
- 仅对明确标为可重试的只读失败执行有限重试；`retry` 范围为 `0–5`，默认不重试。写操作不自动重试。
- 缺少必要输入或写权限时等待介入。取消只停止后续推进；执行中工具结束前显示“正在取消”。
- `timeoutMs` 到期后传递中止信号，但仍等待工具实际结束。不支持该信号的工具无法保证硬超时，不会虚报已终止。
- 在 Webhook 设置中启用 `workflow-completed`、`workflow-failed`、`workflow-waiting`，接收完成、失败或介入提醒。通知失败单独记录，不改变任务执行结论；未配置通知时仍可查询结果。

---

## 架构总览

```mermaid
%%{ init: { 'flowchart': { 'curve': 'catmullRom' } } }%%
flowchart TD
    User([用户])
    CLI[CLI 命令]
    WebUI[Web 界面]
    MCP[MCP 服务]

    subgraph Mate [Codex Mate 核心]
        API[HTTP API]
        Config[配置引擎]
        Session[会话管理器]
        Skills[Skills 市场]
        Tasks[任务运行器]
    end

    subgraph Local [本地文件系统]
        CodexDir[~/.codex]
        ClaudeDir[~/.claude]
        ClawDir[~/.openclaw]
        OpenCodeDir[~/.config/opencode]
        MateDir[~/.codexmate]
        State[会话/Usage/回收站]
    end

    User --> CLI & WebUI & MCP
    CLI & WebUI & MCP --> API

    API --> Config & Session & Skills & Tasks

    Config --> CodexDir & ClaudeDir & ClawDir & OpenCodeDir & MateDir
    Session --> State
    Skills --> Local
```

---

## 特别鸣谢

> [!IMPORTANT]
> 本项目目前处于早期开发阶段。我们正在寻找开发者共同构建本地智能体生态！

感谢所有贡献者对 Codex Mate 的辛勤付出 ❤️

<a href="https://github.com/SakuraByteCore/codexmate/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=SakuraByteCore/codexmate" />
</a>

## 开源协议

Apache-2.0
