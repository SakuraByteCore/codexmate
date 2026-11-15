# Web UI 集中管理

`codexmate run` 起的 Web UI 是协作中枢:provider 切换、多工具配置方案、会话统一视图、Skills 与 Prompt 编辑都在一处。

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

### 健康检查
探测 Codex/Claude 本地路由,失败项高亮,可勾选批量安全清理(不动健康与受保护项)。

### 会话
Codex/Claude/Gemini CLI/CodeBuddy/Pi 会话统一搜索、筛选、预览、导出、删除、批量清理。详见 [会话管理](/guide/sessions)。

## 下一步
Web UI 会话部分看 [会话管理](/guide/sessions) 详述,自动化场景回 [核心工作流](/guide/workflow) 第 6 步。
