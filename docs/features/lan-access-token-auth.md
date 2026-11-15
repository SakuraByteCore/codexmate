# 局域网访问令牌体验优化

### 问题
局域网访问文档未完整说明启动失败条件、远程 Web UI 与 `/bridge/` 的不同鉴权要求，以及基于来源 IP 的访问限制。用户无法据此判断哪些监听地址和请求头可用。

### 原因
默认绑定地址、令牌鉴权和 IP 白名单已分别实现，但相关指南仍只描述了局域网访问的基础用法。远程 Web UI 兼容浏览器 Basic Auth 与脚本请求头，`/bridge/` 则对远程请求强制 Bearer；这些差异需要明确说明。

### 修改点
site/guide/limits.md 补充非回环监听缺少令牌时启动失败，以及 IP 白名单入口。
site/guide/quick-start.md 补充远程 Web UI 的浏览器 Basic Auth 与脚本请求头用法。
site/guide/start-here.md 补充监听地址边界、启动失败提示和鉴权方式。
site/guide/web-ui.md 说明远程 Web UI、`/bridge/` 和 `CODEXMATE_ALLOWED_IPS` 的鉴权与访问规则。
docs/features/lan-access-token-auth.md 更新本次文档变更说明。

### 预期结果
默认启动仍仅监听 `127.0.0.1`。任何非回环监听地址缺少 `CODEXMATE_HTTP_TOKEN` 时启动直接失败；远程 Web UI 兼容浏览器 Basic Auth、Bearer 和 `X-CodexMate-Token`，远程 `/bridge/` 仅接受 Bearer，回环地址保留现有兼容行为。`CODEXMATE_ALLOWED_IPS` 接受逗号分隔的 CIDR 或单个 IP，仅依据 `req.socket.remoteAddress` 判断；留空不限制，配置后非白名单来源返回 `403`，白名单同样覆盖回环来源，本机访问需要把 `127.0.0.1` 与 `::1` 一并列入。
验证：执行 `node --test tests/unit/lan-access-auth-docs.test.mjs` 和目标文件 `git diff --check`。
