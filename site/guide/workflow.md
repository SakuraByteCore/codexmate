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

### 自动工作流面板

在概览页选择任务定义。需要额外输入时，展开「输入参数」填写 JSON。仅在需要写入时勾选本次授权，再提交任务。无记录时隐藏空白列表；提交后自动展开运行记录，完成后保留结果入口，可展开摘要或详情查看结果。需要介入时，先载入原输入，核对授权后继续；取消入口保持独立。

面板文案与状态随界面语言切换，支持简体中文、繁体中文、英语、日语和越南语。用户定义的任务名、执行结果与后端错误保留原文。窄屏下操作按钮自动换行。

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
