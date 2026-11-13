# 设计边界

用前必读:明确什么不做,避免误用。

## 不做的事

- **不做云端托管与账号体系**——全部本地,无遥测、无云账号。
- **不代管密钥**——只负责写配置,Key 由用户自管。
- **不替代原工具**——仅在其之上做配置与会话管理层,原工具照常运行。

## 配置写入约定

- 配置写本地文件,首轮接管有备份,便于回滚。
- 各工具配置路径隔离:
  - Codex: `~/.codex`(含 `AGENTS.md` 与 skills)
  - Claude: `~/.claude/settings.json`
  - OpenClaw: `~/.openclaw/openclaw.json` 与 workspace `AGENTS.md`
  - OpenCode: `~/.codexmate` 多 provider store,投影到 `~/.config/opencode`
  - KiloCode: `~/.config/kilo/kilo.jsonc`

## 安全提示

- 默认仅监听 `127.0.0.1:3737`，管理界面不会自动暴露到局域网。
- 需要局域网访问时，使用 `--host 0.0.0.0` 并设置 `CODEXMATE_HTTP_TOKEN`；未设置令牌时远程请求会被拒绝。
- 涉及 Key、配置或 Skills 的远程访问必须通过令牌鉴权，详见 [Web UI 指南](/guide/web-ui)。

## 下一步
回 [目录](/) 重新挑章节,或看 [GitHub Pages 部署](/guide/github-pages) 把文档站发上线。
