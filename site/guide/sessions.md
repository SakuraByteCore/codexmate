# 会话管理

找回某次讨论，确认内容，再导出为 Markdown 留作项目记录。会话浏览器集中展示不同工具的本地记录；查看和导出不等于迁移完整智能体状态，主动删除则是另一类写入操作。

## 先找回一段对话

1. 按[快速开始](/guide/quick-start)启动，进入 Web UI 会话视图。
2. 在「会话来源」选择已有记录的工具，再按项目路径或时间缩小范围。可输入关键词并按回车检索；界面有检索入口不代表所有来源的记录格式都已经验证。
3. 打开会话，核对项目、时间和讨论内容。
4. 点击「导出记录」，打开下载的 Markdown，检查需要的文字是否完整，并留意截断提示。

没有记录时先确认原工具在本机保存过会话，再清除筛选条件并刷新。配置 Provider 不会生成历史会话。

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

OpenCode 导出分支存在尚未完成运行验证的兼容性疑点，请先用一条样例确认导出结果，不把来源出现在列表中视为导出成功保证。首次体验可先使用已有的 Codex 或 Claude Code 记录。

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

## 主动删除与清理

删除不属于首次查找与导出流程，也不是只读操作。当前 Web UI 的单条删除入口限制为 Codex、Claude 和 Pi；其他来源不能据此推断支持删除。

清理前核对来源、筛选结果和界面确认信息。回收站可配置，不能一概承诺删除都会进入回收站或一定可恢复；需要保留原始记录时先自行备份。回收站规则另见[设计边界](/guide/limits)。

## 用量分析与下一步

Web UI 还提供消息趋势和项目排行，帮助复盘使用情况。找回记录后，需要复用工作方式可看 [Skills 与提示词](/guide/skills-prompt)，需要管理配置可看[核心工作流](/guide/workflow)。
