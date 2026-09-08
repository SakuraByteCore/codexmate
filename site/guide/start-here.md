# 从这里开始

> 给新来的你：一张小地图

Codex Mate 是本地优先的配置与会话管理工具——一个 CLI + 一个 Web UI，把 Codex、Claude Code、Gemini CLI、CodeBuddy Code、Pi、OpenCode、KiloCode、OpenClaw 的配置、会话、Skills 统一管起来。不碰云端账号、不收遥测、配置全部写本地文件。

读完这一页，你会知道：它解决什么问题、怎么装、最短启动路径、和原工具的边界。

## 它解决什么

管理多个本地 AI agent 时，每个工具都有自己的配置格式、session 存储位置、skills 目录，手动切换容易出错、会话难以统一查看。Codex Mate 提供一个统一控制面板，把这些乱象收拢。

## 它是什么 / 不是什么

- 它是配置与会话管理层 + 本地代理桥,不是新前端。
- 它把配置写本地文件,不做云端托管与账号体系。
- 它不代管密钥,只负责写配置。
- 它不替代任何原工具,只在其之上做管理层。

## 三步启动

```bash
codexmate setup
codexmate status
codexmate run
```

默认监听 `0.0.0.0:3737`,支持局域网访问并自动开浏览器。只本机: `CODEXMATE_HOST=127.0.0.1` 或 `--host 127.0.0.1`。仅起服务不开页面: `codexmate run --no-browser`。固定端口不可用自动顺延 (`3738`/`3739`...),或强制指定 `CODEXMATE_PORT=8080`。

> 安全提示:默认监听在局域网暴露未鉴权界面。仅可信网络使用;涉及 Key/配置/Skills 管理建议改 `127.0.0.1`。

## 下一步

去 [它能做什么](/guide/capabilities) 看完整能力清单,或直接跳 [快速开始](/guide/quick-start) 自己跑一遍。
