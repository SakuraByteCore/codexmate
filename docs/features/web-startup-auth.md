# Web UI 强制启动鉴权技术变更

### 问题
启动鉴权曾使用登录页、HttpOnly Cookie 和会话状态。浏览器地址中的访问 token 会被清理，刷新或复制链接后无法直接复用。

### 根因
早期实现把 token 只用于一次性登录交换，再以 Cookie 表示已认证状态。

### 变更
采用无登录态模式。启动 URL 固定携带 `?token=<访问令牌>`，访问 token 始终保留在地址栏，不再生成 Cookie、登录页或会话状态。
API 请求从当前 URL 读取 token，并通过 `Authorization: Bearer <token>` 发送。直接下载、ZIP 上传、独立会话链接也显式携带 token。
API、下载和根页面必须提供有效 token。静态 JS、CSS、图片不包含密钥，允许公开加载；敏感数据接口统一鉴权。
bridge 保持既有独立鉴权边界，不与 Web UI 启动 token 合并。
默认监听保持 127.0.0.1。外网监听继续要求显式配置 CODEXMATE_HTTP_TOKEN。
不使用 Cookie、localStorage、sessionStorage 或登录状态。所有请求必须显式携带 token。

### 预期结果
执行 npm run dev 后，打开的 URL 始终显示 token。直接刷新、复制并打开该 URL 均能访问。
不携带 token 的 API 返回 401。不存在登录页、登录状态或认证 Cookie。

### 验证记录
- `node tests/unit/run.mjs`：876 项全部通过，耗时 30.561 秒。
- `node tests/e2e/run.js`：退出码 0。
- 真实 npm run dev：URL 保留 ?token；根页面直达 UI；无登录页/Cookie；匿名 API 401；Bearer API 200。
- 相关分组回归：88 项通过。
- `node --check` 与 `git diff --check`：通过。
- 未执行真实浏览器下载交互；下载与 ZIP 上传已通过代码链路和端到端接口验证。
