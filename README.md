<div align="center">

<img src="site/.vitepress/public/images/logo.png" alt="Codex Mate logo" width="160" />

# Codex Mate

**One dashboard for all your local AI coding agents. Switch providers, manage sessions, and orchestrate tasks across Codex, Claude Code, and OpenClaw. Zero cloud, local-first control plane.**

<p>
  <a href="https://sakurabytecore.github.io/codexmate/">[Documentation]</a>
  <a href="#quick-start">[Quick Start]</a>
  <a href="README.zh.md">[简体中文]</a>
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

<img src="site/.vitepress/public/images/readme-hero.png" alt="Codex Mate screenshot" width="100%" />

</div>

---

> [!TIP]
> **Local First**: All configurations and sessions are stored in your home directory. No telemetry, no cloud accounts required.

> [!IMPORTANT]
> This project is currently in early stage. We are seeking developers to help build the local agent ecosystem!

## What is Codex Mate?

Have you ever felt overwhelmed by managing multiple local AI agents? Each has its own config format, session storage, and skills directory.

**Codex Mate** offers a unified control plane to bring order to the chaos. It's a local-first CLI + Web UI designed to manage [Codex](https://github.com/openai/codex)、[Claude Code](https://github.com/anthropic-ai/claude-code) and [OpenClaw](https://github.com/moeru-ai/openclaw) seamlessly.

### What's So Special?

Unlike simple wrappers, Codex Mate acts as a **Local Agent Bridge**:
- **Unified Session Browser**: Search and export sessions across all tools in one place.
- **OpenAI-Compatible Bridge**: Use Codex with any OpenAI-compatible UI by normalizing the Responses API.
- **Claude Provider Bridge**: Connect Claude Code to OpenAI Chat Completions-compatible providers and Ollama through the built-in local Claude-compatible proxy.
- **Skills Marketplace**: A local-first market to share and import skills between different agent apps.
- **Task Orchestrator**: Plan and execute complex tasks with dependency tracking.

---

## Current Progress

| Feature | Status | Description |
| --- | --- | --- |
| **Provider Management** | ✅ | Switch providers/models for Codex, Claude, and OpenClaw |
| **Live Agent Sync** | ✅ | Real-time monitoring of Codex/Claude config & status |
| **Session Browser** | ✅ | List, filter, and export sessions (Codex/Claude/Gemini) |
| **Usage Analytics** | ✅ | Visualize message trends and top projects |
| **Local Skills Market** | ✅ | Cross-app import/export of agent skills |
| **Task Queue** | ✅ | DAG-based task execution and logs |
| **OpenAI Bridge** | ✅ | Convert Codex Responses API to standard OpenAI format |
| **Claude Provider Bridge** | ✅ | Connect Claude Code to OpenAI Chat Completions-compatible providers and Ollama via the built-in Claude-compatible proxy |
| **Prompt Templates** | ✅ | Reusable prompt plugins with variables |
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
        State[Sessions/Usage/Trash]
    end

    User --> CLI & WebUI & MCP
    CLI & WebUI & MCP --> API

    API --> Config & Session & Skills & Tasks

    Config --> CodexDir & ClaudeDir & ClawDir
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

[![Star History Chart](https://api.star-history.com/svg?repos=SakuraByteCore/codexmate&type=Date)](https://star-history.com/#SakuraByteCore/codexmate&Date)

## License

Apache-2.0
