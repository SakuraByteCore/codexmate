# Web UI 集中管理

`codexmate run` 起的 Web UI 是协作中枢:provider 切换、多工具配置方案、会话统一视图、Skills 与 Prompt 编辑都在一处。

侧边栏固定使用紧凑折叠布局，不再提供展开或折叠按钮。保留导航文字、语言切换和设置入口；底部语言入口只显示当前语言名，不显示“语言：”前缀。历史侧边栏偏好不再改变布局。

## 外观主题

在「设置 → 外观主题」选择浅色、深色、海洋蓝或柔紫。柔紫参考 [Catppuccin Latte](https://github.com/catppuccin/palette)，使用浅底、深色文字与紫色强调；成功、警告、错误保留各自颜色。主题保存到服务端 Web UI 偏好，刷新后恢复。浏览器缓存只用于首屏渲染，不替代服务端偏好。窄屏按两列显示主题选项。

## 版本更新提醒

点击侧边栏或移动端顶部的“有新版本”，在当前页面查看当前版本、最新版本与 `codexmate update`。点击“复制”复制命令；复制失败时可手动选中命令。点击关闭、遮罩或按 `Escape` 关闭弹窗，键盘焦点返回版本入口。

点击与复制不会执行更新。在运行 Codex Mate 的主机终端执行命令，更新成功后重启服务；远程访问时不要在访问设备上执行。没有新版本时点击检查更新，检查失败时点击重试。

## 启动选项

```bash
codexmate run                # 默认 127.0.0.1:3737,自动开浏览器
codexmate run --no-browser   # 仅服务,不开页面(调试 / CI)
codexmate run --host 127.0.0.1
CODEXMATE_PORT=8080 codexmate run
```

端口不可用自动顺延(`3738`/`3739`...)。

## 局域网访问

默认只允许本机访问。需要从同一局域网的另一台设备访问时，先设置访问令牌，再显式监听所有网卡：

```bash
CODEXMATE_HTTP_TOKEN='<高强度随机值>' codexmate run --host 0.0.0.0
```

`localhost`、`127.0.0.0/8` 和 `::1` 属于回环地址。监听其他地址时必须设置 `CODEXMATE_HTTP_TOKEN`；未设置会直接启动失败，错误信息包含 `CODEXMATE_HTTP_TOKEN`。

然后用 `http://<本机局域网IP>:<端口>` 访问。终端会显示最终监听地址和端口。远程 Web UI 保留浏览器 Basic Auth 兼容：浏览器弹出登录框时，用户名可留空，密码填写访问令牌。脚本访问远程 Web UI 或 API 时，可使用以下任一种请求头：
```bash
curl -H "Authorization: Bearer <访问令牌>" http://<本机局域网IP>:<端口>/api
curl -H "X-CodexMate-Token: <访问令牌>" http://<本机局域网IP>:<端口>/api
```

远程 `/bridge/` 请求强制使用 `Authorization: Bearer <访问令牌>`；缺失或令牌错误会返回 `401`。回环地址访问 `/bridge/` 保留现有兼容行为，不强制 Bearer。

`CODEXMATE_ALLOWED_IPS` 可选填逗号分隔的 CIDR 或单个 IP，例如 `192.168.1.10,192.168.1.0/24`。判断仅依据 `req.socket.remoteAddress`；留空表示不限制来源 IP，配置后非白名单来源返回 `403`。白名单同样作用于回环来源：本机访问需要把 `127.0.0.1` 与 `::1` 一并列入，否则本机请求也会收到 `403`。

访问令牌仅从启动进程的 `CODEXMATE_HTTP_TOKEN` 环境变量读取，需在启动前设置。涉及 Key、配置或 Skills 的远程访问必须保持令牌鉴权开启。

## 插件和模板

插件子标签与桌面侧栏顺序一致：提示词模板 → 文本工具 → 文件共享。切换仍按插件 ID 保存选择，刷新后恢复已选插件。

## 文件共享

从桌面侧栏「文件共享」或紧凑布局「插件 → 文件共享」进入。选择文件或文件夹后先查看待上传列表；点击上传才发送，取消不上传。文件夹保留相对路径，不包含未选择的文件。

- 点击下载获取上传副本。下载使用附件方式，不在页面执行 HTML。
- 点击「复制局域网下载链接」生成单个文件的下载授权；每次复制生成独立令牌，有效期为 60 分钟。持有链接的同网段接收方无需登录管理界面；不要把链接公开给无关人员。
- 下载监听器按需启动，使用独立端口；与管理端口不同，不开放管理 API。链接不是管理令牌，不能用于配置或会话操作。`CODEXMATE_ALLOWED_IPS` 仍限制下载来源。
- 仅支持私有 IPv4 网卡及所选网卡的同网段来源。没有可用网卡时显示错误；多网卡与 VPN 环境请核对复制链接的 IP，确认接收方能到达该地址。
- 移除批次会删除临时副本，使该批次链接失效；不会删除设备上的原文件。刷新页面可重新查看当前服务的批次。
- 停止服务会清理临时副本，重启后不恢复批次或旧链接。这是临时共享，不是永久文件存储；异常退出后的清理需另行核查。
- 剪贴板复制失败时，使用弹出的链接手动复制。单次上传最长 10 分钟；清单上限 512 KiB，没有 512 MiB 文件大小上限，仍受可用磁盘与网络限制。

开发验收入口：`npm run test:file-sharing`；LAN 专项使用 `npm run test:file-sharing:lan`。需要可用 Chromium（可设置 `CHROME_EXECUTABLE`）与充足临时磁盘；LAN 专项还需要可达的私有网卡。环境缺失属于未验收，不算通过。验收包含两个超过 512 MiB 的文件及 1001 文件目录。需要分批时，用 `npm run test:file-sharing:lan -- --skip-large` 验普通与 LAN 路径，用 `npm run test:file-sharing -- --large-only` 验大文件；两批都通过才覆盖完整范围。

## 用量记录明细

在 Usage 页展开明细，查看 UTC 记录分布、缓存分项与单列的完整文本估算。旧图表保持会话更新时间口径。当前逐记录适配 Codex、Claude、Pi、Gemini JSON；未知与失败单列，不冒充账单。支持 `codexmate analytics export --attribution records`；详见[会话指南](/guide/sessions#用量记录明细)。开发验收使用 `npm run test:usage-records`，同样需要可用 Chromium。

## 工作台新增入口

会话全文索引提供[跨会话证据包](/guide/sessions#跨会话证据包)，只生成可核对的历史摘录。Usage 单独提供[费用参考](/guide/sessions#费用参考-usd)，采用内置模型价格快照，不作为账单。项目工作台可展开[Git 改动关联](/guide/sessions#git-改动关联-只读)，只读当前仓库，时间候选不等于因果。

## 能办的事

### Provider 与 Model
- Codex provider/model 切换,带指纹头规范化(Codex CLI 形态请求)。

### Provider 桥
- OpenAI 桥: Codex Responses API 转标准 OpenAI 格式。
- Claude 桥: Claude Code 接 OpenAI Chat Completions 兼容 provider 与 Ollama。
- OpenCode Store: 多 provider 存 `~/.codexmate`,仅激活项投影到原生配置。
- KiloCode 桥: 写 `~/.config/kilo/kilo.jsonc` 保留 Key。

### 模型测试 {#路由组}

选择 **Codex** 或 **Pi**，子页签选择保存在 Web 偏好中，刷新页面或直接打开此页后恢复。从已有配置选择供应商与模型，输入问题后点击「发送测试」。测试完成后显示供应商、上游返回的模型 ID、Markdown 回复与从开始测试到收齐回复的耗时（含本机配置读取），单位为秒，保留两位小数。切换选择不会改写已显示结果的来源；请求中禁用重复提交。无模型时提供配置入口，失败保留输入，展示错误与耗时。界面不展示额度说明。

测试直接调用所选模型，不经过模型组轮换或备用策略，不调用 CLI 或工具，不写供应商配置、模型选择、组绑定或测试历史。不需要开启配置写权限；管理 API 的访问认证保持不变。只有点击发送才消耗供应商额度。单次只发一个请求，不自动重试或探测 `/models`；不设本地响应超时，也没有测试间隔；返回后即可再次发送。输出上限 2048 Token，回复体上限 256 KiB。达到输出上限时标注回复未完整生成。

Codex 读取已有供应商与模型列表，OpenAI 转换供应商复用已配置上游。Pi 读取 `~/.pi/agent/models.json` 的供应商与模型，支持模型级接口覆盖。支持 Responses、Chat Completions、Completions 和 Anthropic Messages。凭据在服务端读取已有 API Key 或环境变量；不在目录接口返回密钥。原生 Codex/Pi 登录凭据、命令式凭据、其他接口暂不支持，会显示错误，不执行凭据命令。

请求头参考 Codex 与 Pi 的 GitHub 实现。Codex 使用本机版本与平台构造 `User-Agent`，发送 `Originator: codex_cli_rs`；读取 `http_headers`、`env_http_headers` 及已配置转换上游的头。Pi 的 API Key 模式沿用 OpenAI／Anthropic SDK UA 与 SDK 版本、运行时头，供应商及模型自定义头优先，大小写不产生重复头。找不到已安装版本时使用 `codexmate/<版本> (<来源> API test)`，不写死其他平台或虚构 CLI／SDK 版本。

Responses 使用结构化用户消息与 `store: false`。Codex 读取 `model_reasoning_effort`、`model_reasoning_summary`、`model_verbosity`，不开放工具调用。Pi 读取模型 `maxTokens` 与 `compat.maxTokensField`、`compat.supportsStore`；输出上限取模型限制与 2048 的较小值。标准 Pi Chat 使用 `max_completion_tokens`，明确配置兼容字段时遵循配置。仍只发一次请求，不增加重试、冷却、响应超时或 OAuth 登录接入。

Web 不再显示模型组、分配策略或 OpenAI Chat 接入设置，不读取组状态。已有后端组 API、桥接流量与配置文件保持原行为；此改动不解除绑定，不停用已配置接入。

### 配置变更预览与撤销

Codex、Claude、OpenClaw、OpenCode、KiloCode、Pi 共用写入预览。保存或应用配置时查看受影响文件，确认后才写入。预览按规范化字段对比；密钥、认证值与 URL 中的凭据隐藏，格式变化另行标注。

- 在「设置 → 配置写入预览」关闭弹窗后直接写入，仍执行冲突检查与备份。
- 预览有效期为 5 分钟。文件在读取或预览后发生外部修改时拒绝写入；取消弹窗，重新加载配置后再保存。
- 在配置中心点击「撤销最近一次」，查看受影响路径后确认。每种工具保留一次撤销记录；服务重启不清除记录。
- 撤销还原原始内容与权限。本次创建的文件删除；已有目录不删除。外部修改或备份校验失败时拒绝撤销。
- 多文件写入失败时恢复已写入文件。恢复失败会显示路径；不要重复提交，先核对对应备份。

变更记录位于 `~/.codexmate/config-change-last.json`，只保存路径、哈希与备份位置，不保存密钥。原内容沿用相邻的 `*.codexmate-backup-*.bak` 备份。预览编号仅保存在服务内存；服务重启后需重新预览。界面中的配置草稿与预设不属于原生配置文件撤销范围。CLI 命令与旧 API 保持原行为。

### 读取超时与恢复

启动配置读取共用 6 秒总预算；Claude 配置刷新与供应商缓存读取各有 6 秒截止时间。超时会取消客户端请求，解除加载状态。恢复服务连接后重新加载；配置启动失败时刷新页面。

其他长任务不套用上述截止时间。配置保存不自动重试；客户端取消不代表服务端撤销已执行的写入。

### 健康检查
探测 Codex/Claude 本地路由,失败项高亮,可勾选批量安全清理(不动健康与受保护项)。

### 会话
Codex/Claude/Gemini CLI/CodeBuddy/Pi 会话统一搜索、筛选、预览、导出、删除、批量清理。详见 [会话管理](/guide/sessions)。

## 下一步
Web UI 会话部分看 [会话管理](/guide/sessions) 详述,自动化场景回 [核心工作流](/guide/workflow) 第 6 步。

## 统一故障诊断

在设置页展开“统一故障诊断”。默认只读取本地 Doctor 结果，不发起模型请求，不启动 MCP。勾选“探测当前 Codex 路由”才联网；MCP 仅检查勾选的已配置服务，执行 `initialize` 与 `tools/list`，不调用 `tools/call`。本地检查不会自动删除配置或执行报告中的命令。

默认显示每项的实际检查时间、状态、耗时与问题摘要，原始证据在“技术详情”中展开；未勾选的远端项显示未检查，不显示通过。单项上限 15 秒，总流程上限 60 秒；取消停止后续项，已发起的有界请求清理后结束。

导出 JSON 或 Markdown 前隐藏认证字段、已知访问令牌、URL 凭据、用户主目录与所选项目绝对路径。报告仅下载到用户选定位置，不上传。当前远端 Provider 检查覆盖激活的 Codex 路由，不宣称覆盖所有工具或供应商。原 `codexmate doctor` 命令保持不变。
