# Web UI 集中管理

`codexmate run` 起的 Web UI 是协作中枢:provider 切换、多工具配置方案、会话统一视图、Skills 与 Prompt 编辑都在一处。

侧边栏固定使用紧凑折叠布局，不再提供展开或折叠按钮。保留导航文字、语言切换和设置入口；底部语言入口只显示当前语言名，不显示“语言：”前缀。历史侧边栏偏好不再改变布局。

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

## 能办的事

### Provider 与 Model
- Codex provider/model 切换,带指纹头规范化(Codex CLI 形态请求)。

### Provider 桥
- OpenAI 桥: Codex Responses API 转标准 OpenAI 格式。
- Claude 桥: Claude Code 接 OpenAI Chat Completions 兼容 provider 与 Ollama。
- OpenCode Store: 多 provider 存 `~/.codexmate`,仅激活项投影到原生配置。
- KiloCode 桥: 写 `~/.config/kilo/kilo.jsonc` 保留 Key。

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
