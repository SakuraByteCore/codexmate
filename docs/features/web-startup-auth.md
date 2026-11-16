# Web UI 强制启动鉴权技术变更

### 问题
默认监听已为 127.0.0.1，但本机请求存在免认证路径。启动不自动提供浏览器登录凭据。

### 根因
assertRequestAuthorized 对回环来源直接放行；外层中间件只保护远程 bridge。

### 变更
采用 Node.js 原生 HTTP 中间件。每次启动生成独立随机 token，已有 CODEXMATE_HTTP_TOKEN 优先。令牌仅存在内存，不写配置。
保留默认 127.0.0.1。保留外网监听必须显式配置令牌的限制。
在已有 IP 白名单之后、所有业务路由之前检查启动鉴权，本机无例外。
打印带 fragment token 的启动 URL。浏览器引导页读取 fragment，经同源 POST 换取 HttpOnly、SameSite=Strict 会话 cookie，随后移除 fragment。
API 可直接携带 Bearer token。bridge 必须使用 Bearer，不使用浏览器 cookie 代替。
拒绝跨站写请求；无凭据返回 401。认证引导页不包含业务数据。
不改动已有用户配置、CI 或密钥文件。回滚本次命名模块与 cli.js 接入行即可。

### 预期结果
启动后无 token 的本机 API 请求返回 401。终端打印的登录 URL 可直接打开 UI。重启使旧 cookie 失效。

### 验证记录
- `node tests/unit/run.mjs`：876 项全部通过，耗时 29.373 秒。
- `node tests/e2e/run.js`：退出码 0。
- 真实 CLI 启动验证：默认回环 URL、随机启动令牌、匿名 API 401、登录 cookie、认证健康检查 200、认证界面资源 200 全部通过。
- `node --check` 与 `git diff --check`：通过。
- 旧测试客户端已显式携带 Bearer token。未恢复任何匿名访问路径。
