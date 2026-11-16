'use strict';

// 仅用于隔离的浏览器测试服务器；访问外部实例时由环境提供对应令牌。
const token = process.env.CODEXMATE_E2E_TOKEN || 'codexmate-browser-e2e-token';
const entryPath = `/?token=${encodeURIComponent(token)}`;

module.exports = { token, entryPath };
