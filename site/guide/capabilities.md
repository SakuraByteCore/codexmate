# 它能做什么

完整能力按四块组织:provider 管理、会话浏览、Skills 与提示词、任务编排。下面的状态表来自仓库 README,各项都已在 CLI / Web UI 落地。

## 功能进度

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| Provider 管理 | ✅ | Codex / Claude / OpenCode / KiloCode / OpenClaw 的 provider/model 切换 |
| 实时同步 | ✅ | Codex / Claude 配置与状态实时监控 |
| 会话浏览 | ✅ | Codex / Claude Code / Gemini CLI / CodeBuddy Code / Pi 会话统一搜索、预览、筛选、导出 |
| 用量分析 | ✅ | 消息趋势与项目排行可视化 |
| 本地 Skills Market | ✅ | 跨 agent 应用导入导出 skills |
| 任务队列 | ✅ | 基于 DAG 的任务执行与日志 |
| OpenAI 桥 | ✅ | Codex Responses API 转标准 OpenAI 格式,并在内置转换中补齐/规范化 Codex 指纹头 |
| Claude Provider 桥 | ✅ | Claude Code 接 OpenAI Chat Completions 兼容 provider 与 Ollama |
| OpenCode Provider Store | ✅ | 多 provider 存于 `~/.codexmate`,仅把激活项投影到原生配置 |
| KiloCode 配置桥 | ✅ | `codexmate kilo config` 或 Web UI 写 `~/.config/kilo/kilo.jsonc`,保留已有 Key |
| Provider 健康检查 | ✅ | 探测 Codex/Claude 本地路由,高亮失败项并批量安全清理 |
| Prompt 模板 | ✅ | 带变量复用提示词插件 |
| Prompt 文件编辑器 | ✅ | 编辑全局/项目级 `CLAUDE.md`/`AGENTS.md`,自动检测项目路径,应用 preset 仅更新编辑器,保存才写盘 |
| MCP 集成 | ✅ | MCP stdio 暴露本地工具与资源 |
| 自动更新 | ✅ | `codexmate update` 一键升级 CLI |

## 四块能力拆解

### Provider 管理
统一切换多个 agent 的 provider/model;每个工具的配置写入路径隔离,首轮接管有备份,可回滚。

### 会话浏览
把散落在各工具目录的会话拉到同一视图:搜索、筛选、预览、导出为 Markdown、单条删除与批量清理。

### Skills 与提示词
本地优先的 Skills Market 做跨应用导入导出;Prompt 文件编辑器管 `CLAUDE.md`/`AGENTS.md`,带可复用 preset 池。

### 任务编排
基于 DAG 的任务队列,支持依赖追踪、执行与日志,适合编排多步任务。

## 下一步
能力清单看完,去 [快速开始](/guide/quick-start) 跑起来,或看 [架构总览](/guide/architecture) 懂内部怎么连。
