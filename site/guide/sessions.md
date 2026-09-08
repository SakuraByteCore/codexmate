# 会话管理

把散落在各工具本地目录的会话拉到同一视图:搜索、预览、筛选、导出、删除。不代管密钥,只读会话目录。

## 支持来源

| 工具 | 会话位置 |
| --- | --- |
| Codex | `~/.codex` 会话目录 |
| Claude Code | `~/.claude` 会话目录 |
| Gemini CLI | `~/.gemini` |
| CodeBuddy Code | `~/.codebuddy` |
| Pi | `~/.pi/agent/sessions` |

## 导出

```bash
codexmate export-session --source <codex|claude|gemini|codebuddy|pi> --session-id <ID>
```

会话沉淀为 Markdown 文档归档审阅。

## 删除与清理

- 单条删除:Web UI 会话视图选中删除。
- 批量清理:按来源/时间筛选后批量删除。
- 删除走回收站链路,不直接永久删除(详见 [设计边界](/guide/limits))。

## 用量分析

Web UI 内可视化消息趋势与项目排行,便于复盘高频项目与使用模式。

## 下一步
会话之外看 [Skills & Prompt](/guide/skills-prompt),或回 [核心工作流](/guide/workflow)。
