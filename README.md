<div align="center">

<img src="site/.vitepress/public/images/logo.png" alt="Codex Mate logo" width="160" />

# Codex Mate

**One dashboard for all your local AI coding agents. Switch providers, manage sessions, and orchestrate tasks across Codex, Claude Code, OpenCode, KiloCode, and OpenClaw. Zero cloud, local-first control plane.**

<p>
  <a href="https://sakurabytecore.github.io/codexmate/">[Documentation]</a>
  <a href="#quick-start">[Quick Start]</a>
  <a href="README.zh.md">[简体中文]</a>
  <a href="README.vi.md">[Tiếng Việt]</a>
</p>

[![Version](https://img.shields.io/npm/v/codexmate?style=flat-square&color=A179FF)](https://www.npmjs.com/package/codexmate)
[![Build](https://img.shields.io/github/actions/workflow/status/SakuraByteCore/codexmate/release.yml?style=flat-square&color=44cc11)](https://github.com/SakuraByteCore/codexmate/actions/workflows/release.yml)
[![Downloads](https://img.shields.io/npm/dt/codexmate?style=flat-square)](https://www.npmjs.com/package/codexmate)
[![Install](https://img.shields.io/badge/install-brew%20%7C%20curl%20%7C%20npm-0A0?style=flat-square)](#install-via-homebrew-macos--linux)
[![Platform](https://img.shields.io/badge/platform-Termux%20%7C%20Linux%20%7C%20macOS%20%7C%20Windows-555?style=flat-square)](#quick-start)
[![Node](https://img.shields.io/node/v/codexmate?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/npm/l/codexmate?style=flat-square)](LICENSE)
[![Stars](https://img.shields.io/github/stars/SakuraByteCore/codexmate?style=flat-square&color=gold)](https://github.com/SakuraByteCore/codexmate/stargazers)
[![Issues](https://img.shields.io/github/issues/SakuraByteCore/codexmate?style=flat-square&color=ff69b4)](https://github.com/SakuraByteCore/codexmate/issues)

<br />

<p>
  <img src="site/.vitepress/public/images/readme/config-codex.png" alt="Codex Mate Codex provider configuration" width="100%" />
</p>
<p>
  <img src="site/.vitepress/public/images/readme/config-opencode.png" alt="Codex Mate OpenCode provider configuration" width="100%" />
</p>
<p>
  <img src="site/.vitepress/public/images/readme/sessions.png" alt="Codex Mate unified session browser" width="100%" />
</p>

</div>

---

> [!TIP]
> **Local First**: All configurations and sessions are stored in your home directory. No telemetry, no cloud accounts required.

> [!IMPORTANT]
> This project is currently in early stage. We are seeking developers to help build the local agent ecosystem!

## What is Codex Mate?

Have you ever felt overwhelmed by managing multiple local AI agents? Each has its own config format, session storage, and skills directory.

**Codex Mate** offers a unified control plane to bring order to the chaos. It's a local-first CLI + Web UI designed to manage [Codex](https://github.com/openai/codex), [Claude Code](https://github.com/anthropic-ai/claude-code), [OpenCode](https://opencode.ai/), KiloCode, and [OpenClaw](https://github.com/moeru-ai/openclaw) seamlessly.

### What's So Special?

Unlike simple wrappers, Codex Mate acts as a **Local Agent Bridge**:
- **Unified Session Browser**: Search, inspect, filter, and export local sessions across Codex, Claude Code, Gemini CLI, and CodeBuddy Code from one place.
- **OpenAI-Compatible Bridge**: Use Codex with any OpenAI-compatible UI by normalizing the Responses API; the built-in Codex conversion also fills and normalizes Codex fingerprint headers such as `User-Agent`, `Version`, `OpenAI-Beta`, and `Originator` so upstream providers see an official Codex CLI-shaped request.
- **Claude Provider Bridge**: Connect Claude Code to OpenAI Chat Completions-compatible providers and Ollama through the built-in local Claude-compatible proxy.
- **OpenCode Provider Control**: Manage OpenCode provider/model selection with a CodexMate-owned provider store under `~/.codexmate`, projecting only the active provider into native OpenCode config to avoid polluting or deleting user-owned settings.
- **KiloCode Config Bridge**: Configure KiloCode providers from the CLI or Web UI, writing to `~/.config/kilo/kilo.jsonc` while preserving stored API keys.
- **Provider Health Cleanup**: Probe local Codex and Claude provider routes, surface failed configs in one modal, and bulk-clean selected broken providers without touching healthy or protected entries.
- **Skills Marketplace**: A local-first market to share and import skills between different agent apps.
- **Prompt File Editor**: Unified editor for global and project-level `CLAUDE.md` and `AGENTS.md` with auto-detection of project paths, plus a shared preset pool for reusable prompts.
- **Task Orchestrator**: Plan and execute complex tasks with dependency tracking.

---

## Current Progress

| Feature | Status | Description |
| --- | --- | --- |
| **Provider Management** | ✅ | Switch providers/models for Codex, Claude, OpenCode, KiloCode, and OpenClaw |
| **Live Agent Sync** | ✅ | Real-time monitoring of Codex/Claude config & status |
| **Session Browser** | ✅ | Search, preview, filter, and export sessions across Codex, Claude Code, Gemini CLI, and CodeBuddy Code |
| **Usage Analytics** | ✅ | Visualize message trends and top projects |
| **Local Skills Market** | ✅ | Cross-app import/export of agent skills |
| **Task Queue** | ✅ | DAG-based task execution and logs |
| **OpenAI Bridge** | ✅ | Convert Codex Responses API to standard OpenAI format and attach/normalize Codex fingerprints in the built-in conversion |
| **Claude Provider Bridge** | ✅ | Connect Claude Code to OpenAI Chat Completions-compatible providers and Ollama via the built-in Claude-compatible proxy |
| **OpenCode Provider Store** | ✅ | Keep multiple OpenCode providers in `~/.codexmate` while projecting only the selected provider to native OpenCode config |
| **KiloCode Config Bridge** | ✅ | Configure KiloCode through `codexmate kilo config` or the Web UI, writing provider URL/model/API key data to `~/.config/kilo/kilo.jsonc` |
| **Provider Health Check** | ✅ | Probe local Codex/Claude provider routes, highlight failed configs, and bulk-remove selected broken providers safely |
| **Prompt Templates** | ✅ | Reusable prompt plugins with variables |
| **Prompt File Editor** | ✅ | Edit global and project-level CLAUDE.md / AGENTS.md with auto-detect, path switching, and a shared preset pool. Applying a preset only updates the editor; save manually to write the file. |
| **MCP Integration** | ✅ | Expose local tools and resources via MCP stdio |
| **Auto Update** | ✅ | Quick update CLI via `codexmate update` |

---

## Quick Start

### Install via Homebrew (macOS / Linux)

```bash
brew tap SakuraByteCore/codexmate
brew install codexmate
```

Requires [Node.js](https://nodejs.org/) (`brew install node` if not present).

### Install via npm

```bash
npm install -g codexmate
codexmate run
```

If the default Web UI port `3737` is unavailable, Codex Mate automatically tries the next ports (`3738`, `3739`, ...). To force a fixed port, set `CODEXMATE_PORT`:

```bash
CODEXMATE_PORT=8080 codexmate run
```

Windows PowerShell:

```powershell
$env:CODEXMATE_PORT=8080; codexmate run
```

### Install via curl (Standalone)

```bash
curl -fsSL https://raw.githubusercontent.com/SakuraByteCore/codexmate/main/scripts/install.sh | bash
```

### Supported Agents

- **Codex**: `npm install -g @openai/codex`
- **Claude Code**: `npm install -g @anthropic-ai/claude-code`
- **Gemini CLI**: `npm install -g @google/gemini-cli`
- **CodeBuddy**: `npm install -g @tencent-ai/codebuddy-code`
- **KiloCode**: `npm install -g @kilocode/cli` (`kilo` / `kilocode`)
- **OpenCode**: install from the [official OpenCode docs](https://opencode.ai/)

---

## Architecture

```mermaid
%%{ init: { 'flowchart': { 'curve': 'catmullRom' } } }%%
flowchart TD
    User([User])
    CLI[CLI]
    WebUI[Web UI]
    MCP[MCP Server]

    subgraph Mate [Codex Mate Core]
        API[HTTP API]
        Config[Config Engine]
        Session[Session Manager]
        Skills[Skills Market]
        Tasks[Task Runner]
    end

    subgraph Local [Local Filesystem]
        CodexDir[~/.codex]
        ClaudeDir[~/.claude]
        ClawDir[~/.openclaw]
        OpenCodeDir[~/.config/opencode]
        MateDir[~/.codexmate]
        State[Sessions/Usage/Trash]
    end

    User --> CLI & WebUI & MCP
    CLI & WebUI & MCP --> API

    API --> Config & Session & Skills & Tasks

    Config --> CodexDir & ClaudeDir & ClawDir & OpenCodeDir & MateDir
    Session --> State
    Skills --> Local
```

---

## Special Thanks

Special thanks to all contributors for their contributions to Codex Mate ❤️

<a href="https://github.com/SakuraByteCore/codexmate/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=SakuraByteCore/codexmate" />
</a>

## Star History

<a href="https://star-history.com/#SakuraByteCore/codexmate&type=date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=SakuraByteCore/codexmate&type=date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=SakuraByteCore/codexmate&type=date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=SakuraByteCore/codexmate&type=date" width="100%" />
  </picture>
</a>

## License

Apache-2.0
