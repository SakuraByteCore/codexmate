# Web UI 集中管理

`codexmate run` 起的 Web UI 是协作中枢:provider 切换、多工具配置方案、会话统一视图、Skills 与 Prompt 编辑都在一处。

## 启动选项

```bash
codexmate run                # 默认 0.0.0.0:3737,自动开浏览器
codexmate run --no-browser   # 仅服务,不开页面(调试 / CI)
codexmate run --host 127.0.0.1
CODEXMATE_PORT=8080 codexmate run
```

端口不可用自动顺延(`3738`/`3739`...)。

> 安全提示:默认局域网暴露未鉴权界面,涉及密钥/配置/Skills 建议改 `127.0.0.1`。

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
