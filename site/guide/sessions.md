# 会话管理

找回某次讨论，确认内容，再导出为 Markdown 留作项目记录。会话浏览器集中展示不同工具的本地记录；查看和导出不等于迁移完整智能体状态，主动删除则是另一类写入操作。

## 先找回一段对话

1. 按[快速开始](/guide/quick-start)启动，进入 Web UI 会话视图。
2. 在「会话来源」选择已有记录的工具，再按项目路径或时间缩小范围。可输入关键词并按回车检索；界面有检索入口不代表所有来源的记录格式都已经验证。
3. 打开会话，核对项目、时间和讨论内容。
4. 在「导出范围」选择最近 1000 条或全部可提取消息，再点击「导出记录」。打开下载的 Markdown 核对内容；截断说明会保留在当前会话预览中，可选择全部后重新导出。

关键词查询会显示实际扫描数与本次候选数。未完成时请缩小来源或项目范围；候选范围不等于全部历史记录。筛选无结果时可直接点击「清除筛选」。没有记录时先确认原工具在本机保存过会话，再刷新。配置 Provider 不会生成历史会话。

## 来源与存储位置

以下依据仓库 `0.1.28` 的来源选项和读取路径整理，表示当前实现有对应入口，**不是逐来源、逐 CLI 版本的运行验收矩阵**。环境变量或工具自身配置可能改变实际目录。

| 来源参数 | 工具 | 默认记录位置 |
| --- | --- | --- |
| `codex` | Codex | `~/.codex` 下的会话目录 |
| `claude` | Claude Code | `~/.claude` 下的会话目录 |
| `gemini` | Gemini CLI | `~/.gemini` |
| `codebuddy` | CodeBuddy Code | `~/.codebuddy` |
| `workbuddy` | WorkBuddy | `~/.workbuddy-ai/projects` |
| `pi` | Pi | `~/.pi/agent/sessions` |
| `opencode` | OpenCode | 数据目录中的 `opencode.db`，默认 `~/.local/share/opencode` |
| `zed` | Zed | Zed 数据目录下的 `threads/threads.db` |

OpenCode 导出的来源分支现已互斥，避免数据库读取结果被通用文件读取覆盖。各工具版本的存储格式仍可能不同，先用一条记录核对结果；来源出现在列表中不代表所有版本均已验证。

## CLI 导出

命令支持的来源值与上表一致。用实际会话 ID 替换 `YOUR_SESSION_ID`：

```bash
codexmate export-session --source codex --session-id YOUR_SESSION_ID
```

也可指定文件和输出位置：

```bash
codexmate export-session --source claude --file "./session.jsonl" --output "./session-notes.md"
```

默认最多提取最近 `1000` 条消息。需要取消数量上限时：

```bash
codexmate export-session --source codex --session-id YOUR_SESSION_ID --max-messages all
```

数量上限取消不等于无损导出：实现以提取后的消息文本生成 Markdown，并处理开头的系统消息。图片、工具调用状态和权限等不应被视为完整保留。导出文件用于阅读与归档，不能代替原始会话备份。

## 导出与转换的区别

Markdown 导出不要求在另一编程工具中恢复会话。现有会话转换仅面向 Codex 与 Claude，围绕文本消息生成目标记录，并有独立的消息数量限制。不要将其理解为无损迁移；目标原生 CLI 能否续接，需要按具体版本另行验证。

## 结构化交接与共享记忆

在会话的「会话交接」区填写目标代理与交接目标。生成后查看每条交接的路径、写入结果、耗时和读取状态。MCP 路径下点击「回退文件并复制卡片」，再粘贴到目标会话；复制不等于发送。

也可保存卡片 JSON：

```json
{"goal":"完成交接验证","completed":["已定位问题"],"blockers":[],"nextSteps":["执行定向测试"],"files":["lib/thread-handoff.js"]}
```

```bash
codexmate thread handoff YOUR_SESSION_ID --card card.json --target claude
codexmate thread list YOUR_SESSION_ID
codexmate thread fallback YOUR_SESSION_ID --handoff HANDOFF_ID
codexmate thread ack YOUR_SESSION_ID --handoff HANDOFF_ID --agent claude --evidence TARGET_SESSION_OR_RETRIEVAL_ID
```

先保存文件，再只读探测项目 `.mcp.json`、项目及用户 `.codex/config.toml`、用户 `.claude.json` 与 `.claude/settings.json`。识别 `uac` 等共享记忆服务，按原生工具 schema 选择单个 MCP。支持 `memory_write`、`set_memory` 等兼容写入工具；未知必填字段视为不兼容。不会新建共享记忆存储，不修改用户配置，不强塞目标提示词。

MCP 不可用或写入失败时明确提示文件路径，不自动重试写入。卡片与追加审计保存在 `~/.codexmate/threads/<hash>/`。审计记录 MCP、工具、耗时、结果、回退与读取确认；配置解析问题也会记录。连接用完关闭，不新增守护进程。

写入成功仅标记 `awaiting_read`，不是读取凭证。目标实际读取后才使用 `ack` 上报会话或检索标识；`read_confirmed` 表示附证据自报，不是独立验证。未上报时保持等待读取，不能断言目标一定没读。


会话详情的更新、路径复制、导出与删除仅显示图标。悬停查看操作提示；键盘和读屏保留操作名称。删除仍使用原有确认与回收站设置。

## 主动删除与清理

删除不属于首次查找与导出流程，也不是只读操作。当前 Web UI 的单条删除入口限制为 Codex、Claude 和 Pi；其他来源不能据此推断支持删除。

清理前核对来源、筛选结果和界面确认信息。回收站可配置，不能一概承诺删除都会进入回收站或一定可恢复；需要保留原始记录时先自行备份。回收站规则另见[设计边界](/guide/limits)。

## 上下文体检

打开会话浏览器中的记录，在详情顶部查看完整上下文的预估 Token 与堆叠条。统计覆盖保存的完整消息树，不限当前分页；支持上方列出的八种来源。

五类明细默认显示，无需展开：系统与规则、用户指令、模型文本与思考、工具输出与日志、代码块与 Diff。代码分段从所属角色中拆出，分类总和与总数一致。

- 健康：少于 32000 预估 Token。
- 偏重：32000 至 64000，包含两端。
- 膨胀：超过 64000。

界面仅保留总量、健康评级、构成条和分类统计。不显示膨胀热点列表、Top 5 排行或展开开关。后端保持原分析与节点查询接口兼容。

这些数字估算已保存的可读文本，不等同模型实际请求 Token 或费用。体检不会读取工具引用的文件，不修改会话。会话更新后点击刷新；读取失败时显示错误，不展示不完整统计。

## 用量分析与下一步

Web UI 还提供消息趋势和项目排行，帮助复盘使用情况。找回记录后，需要复用工作方式可看 [Skills 与提示词](/guide/skills-prompt)，需要管理配置可看[核心工作流](/guide/workflow)。
