## 问题
Pi 配置页新增 Provider 时，原逻辑基于 `baseUrl` 域名推导 `id/name`，易引入外部网页元数据且可能携带 `-`、符号等不稳定字符，导致运行时 provider 标识可被解析破坏。

## 原因
- Provider 标识与网页标题/域名耦合，违背 runtime provider identity “稳定、纯数字、无外部依赖”要求。

## 修改点
- `web-ui/modules/app.methods.pi-config.mjs`：新增 Provider 时写入 `id/name = timestamp`；`piProviderName` 直接返回纯 Provider ID；保留 `piProviderUrlTitle` 空占位以维持接口兼容；`derivePiProviderId` 保留 `baseUrl` 形参但改用时间戳增量生成。
- `web-ui/res/web-ui-render.precompiled.js`：同步重新编译使模板与预渲染一致。

## 预期结果
- 新增 Pi Provider 的 `id/name` 为 13 位纯数字时间戳，避免网页标题污染运行时配置。
- `piProviderName` 返回纯 Provider ID，`piProviderUrlTitle` 返回空字符串，运行时配置不再包含网页派生标题。
- 单测全部通过、Lint 通过；预编译渲染与当前模板严格一致。