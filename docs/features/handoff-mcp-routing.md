# Handoff MCP 路由技术变更

### 问题
当前检出的仓库没有 thread handoff 命令或 Handoff Card 存储实现。会话浏览界面为 Thread 展示入口。本次补充最小文件交接基线与 MCP 增强路由，不修改用户 MCP 配置。

### 根因
lib/mcp-stdio.js 是服务端路由，不是 MCP 客户端。现有会话界面缺少交接审计信息。

### 变更
- 使用 Node.js 原生进程与 HTTP 能力，短连接执行 initialize、tools/list、tools/call，不添加守护进程。
- 从项目 .mcp.json、用户 Claude 配置和 Codex TOML 配置只读发现共享记忆服务。按配置顺序只读探测兼容服务，选择一个服务写入，不合并数据，不重试写入。
- 按服务实际工具 inputSchema 选择受支持的原生记忆写入操作；不兼容 schema 回退文件。未知必填参数不猜测。
- 文件先落地，MCP 仅为增强投递。审计记录保存路由、服务名称、工具、耗时、失败阶段、回退、读取状态。
- 写入只标记 awaiting_read。目标读取确认必须提供 handoff 标识、目标 Agent 与读取凭据；用户明确上报确认，不把 CodexMate 自检当作目标读取。
- 会话 Thread 展示审计列表，支持生成交接、刷新状态、一键读取文件内容到剪贴板作为显式注入操作。不自动改写目标 prompt。
- 独立 UI 工作委派只修改 web-ui 文件；主线程拥有后端、CLI、测试与本归档。

### 预期结果
运行 codexmate thread handoff <thread-id> --card <json-file> --target <agent>。提供目标、已完成、卡点、下一步、涉及文件字段。
MCP 不存在、初始化失败、schema 不兼容、调用失败时显示文件路径与原因。写入成功显示等待目标读取；显式确认后显示已确认读取。
审计及卡片位于用户 CodexMate 数据目录下 threads，不构建独立共享记忆存储。

### 验证记录
- `node --test tests/unit/thread-handoff.test.mjs`：7 项通过。覆盖真实 CLI 文件回退、真实 CLI stdio MCP 写入、HTTP 会话清理、写入失败、schema 不兼容、超时不重试、读取证据、界面方法剪贴板行为。
- 分组执行 thread-handoff、mcp-stdio、web-ui-source-bundle、cli-help、session-header-actions-layout、session-actions-layout：25 项通过。
- `node tests/e2e/run.js`：退出码 0。
- `node tests/unit/run.mjs`：30 秒超时，完整单元回归未完成；不能将分组通过等同全量通过。
- `node --check`：后端模块与界面模块通过；`git diff --check` 通过。
- 原生 MCP 模拟服务验证已通过。未连接用户实际安装的 unified-agent-context/shared-context-mcp；未知工具名或必填参数回退文件，不能承诺任意版本兼容。
- 预编译模板已通过 `compileWebUiTemplateToRenderScript()` 重建，模板一致性测试通过。未执行真实浏览器交互验收。
- 临时测试夹具位于系统临时目录，由测试脚本可重建。交付源码位于当前工作区。

### 使用示例
卡片 JSON：`{"goal":"完成交接","completed":["生成摘要"],"blockers":[],"nextSteps":["继续验证"],"files":["lib/thread-handoff.js"]}`。
执行 `node cli.js thread handoff demo --card card.json --target claude`。
执行 `node cli.js thread list demo` 查看最新状态。
执行 `node cli.js thread ack demo --handoff <id> --agent claude --evidence <目标会话检索记录>` 上报读取。
执行 `node cli.js thread fallback demo --handoff <id>` 返回卡片文本。

### 已知边界
读取确认为附证据的目标自报，不是独立验证。通用 MCP 协议不提供目标读取回执，写入成功默认维持等待读取。
界面文件注入入口复制卡片，需要粘贴到目标会话，不自动发送。
审计是追加 JSONL 事件，保留写入结果与回退、读取事件。writeDurationMs 为工具写入耗时，durationMs 为探测加写入耗时。


### 影响与回滚
只添加交接路径，现有会话加载与 MCP 服务端不变。回滚本次命名文件及 cli.js 接入行即可；保留用户审计与卡片。
