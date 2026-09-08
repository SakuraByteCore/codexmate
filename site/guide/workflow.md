# 核心工作流

一条典型链路:初始化 → 切 provider → 应用配置 → 集中管理 → 导出复盘 → 测试。六步串起 CLI 与 Web UI 协作。

## 1. 初始化与状态确认

```bash
codexmate setup
codexmate status
```

目标:确认 provider、model 与关键配置路径可读。

## 2. 切换 Codex provider/model

```bash
codexmate switch <provider>
codexmate use <model>
```

目标:不改业务代码完成模型路由切换(Codex)。

## 3. 应用 Claude / OpenClaw 配置

```bash
codexmate claude <BaseURL> <API_KEY> [model]
```

目标:统一入口写运行时配置,减少手改错误。KiloCode 走 `codexmate kilo config` 写 `~/.config/kilo/kilo.jsonc` 且保留已有 Key。

## 4. 启动 Web UI 集中管理

```bash
codexmate run
```

Web UI 可做:provider/model 切换、Claude 方案管理、OpenClaw JSON5 配置管理、会话筛选/删除/导出。

无头或自动化:

```bash
codexmate run --no-browser
```

## 5. 导出会话用于复盘

```bash
codexmate export-session --source codex --session-id <ID>
```

目标:关键会话沉淀为 Markdown 归档审阅。来源支持 codex/claude/gemini/codebuddy/pi。

## 6. 测试约定(不打开页面)

```bash
npm run test:e2e
```

目标:E2E 仅验证服务与 API 行为,不依赖浏览器自动打开。

## 下一步
场景跑通后看 [会话管理](/guide/sessions) 深挖跨工具会话视图,或看 [Skills & Prompt](/guide/skills-prompt)。
