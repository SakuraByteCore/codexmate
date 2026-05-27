const http = require('http');
const { assert } = require('./helpers');

function getText(port, requestPath, timeoutMs = 2000) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: requestPath,
            method: 'GET'
        }, (res) => {
            let body = '';
            res.setEncoding('utf-8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers || {},
                    body
                });
            });
        });

        req.on('error', reject);
        req.setTimeout(timeoutMs, () => {
            req.destroy(new Error('Request timeout'));
        });
        req.end();
    });
}

/**
 * 测试 Web UI URL 路由修复
 *
 * 背景：/web-ui 入口已废弃，统一使用根路径 /。
 * 资源文件仍挂载在 /web-ui/* 下。
 *
 * 修复内容：
 * 1. 服务端：/web-ui、/web-ui/、/web-ui/index.html 返回 404
 * 2. 根路径 / 返回 HTML
 * 3. 资源路径 /web-ui/app.js 等继续工作
 * 4. 客户端：访问 /web-ui/* 时自动跳转到 /
 */
module.exports = async function testWebUiUrlRouting(ctx) {
    const { port } = ctx;

    // ========== 服务器侧路由测试 ==========

    // 测试根路径 / - 应该返回 HTML
    const rootPath = await getText(port, '/');
    assert(
        rootPath.statusCode === 200,
        `/ should return 200, got ${rootPath.statusCode}`
    );
    assert(
        /^text\/html\b/.test(String(rootPath.headers['content-type'] || '')),
        '/ should return html content type'
    );
    assert(
        rootPath.body.includes('id="app"'),
        '/ should contain Vue app mount point'
    );

    // 测试 /web-ui (无斜尾) - 应该返回 404
    const webUiNoSlash = await getText(port, '/web-ui');
    assert(
        webUiNoSlash.statusCode === 404,
        `/web-ui should return 404, got ${webUiNoSlash.statusCode}`
    );

    // 测试 /web-ui/ (有斜尾) - 应该返回 404
    const webUiWithSlash = await getText(port, '/web-ui/');
    assert(
        webUiWithSlash.statusCode === 404,
        `/web-ui/ should return 404, got ${webUiWithSlash.statusCode}`
    );

    // 测试 /web-ui/index.html (显式请求) - 应该返回 404
    const webUiIndexHtml = await getText(port, '/web-ui/index.html');
    assert(
        webUiIndexHtml.statusCode === 404,
        `/web-ui/index.html should return 404, got ${webUiIndexHtml.statusCode}`
    );

    // 测试 /web-ui/app.js - 应该返回 JavaScript（资源路径继续工作）
    const appJs = await getText(port, '/web-ui/app.js');
    assert(
        appJs.statusCode === 200,
        `/web-ui/app.js should return 200, got ${appJs.statusCode}`
    );
    assert(
        /^application\/javascript\b/.test(String(appJs.headers['content-type'] || '')),
        '/web-ui/app.js should return javascript content type'
    );

    // 测试带 query 参数的根路径请求
    const rootWithQuery = await getText(port, '/?s=1');
    assert(
        rootWithQuery.statusCode === 200,
        `/?s=1 should return 200, got ${rootWithQuery.statusCode}`
    );
    assert(
        /^text\/html\b/.test(String(rootWithQuery.headers['content-type'] || '')),
        '/?s=1 should return html content type'
    );

    // 测试带 query 参数的资源请求
    const appJsWithQuery = await getText(port, '/web-ui/app.js?debug=1');
    assert(
        appJsWithQuery.statusCode === 200,
        `/web-ui/app.js?debug=1 should return 200, got ${appJsWithQuery.statusCode}`
    );

    // ========== 重复路径测试 ==========

    // 测试 /web-ui/web-ui/ - 应该返回 404
    const doubleRepeatSlash = await getText(port, '/web-ui/web-ui/');
    assert(
        doubleRepeatSlash.statusCode === 404,
        `/web-ui/web-ui/ should return 404, got ${doubleRepeatSlash.statusCode}`
    );

    // 测试 /web-ui/web-ui/index.html - 应该返回 404
    const doubleRepeat = await getText(port, '/web-ui/web-ui/index.html');
    assert(
        doubleRepeat.statusCode === 404,
        `/web-ui/web-ui/index.html should return 404, got ${doubleRepeat.statusCode}`
    );

    // 测试 /web-ui/web-ui/app.js - 资源重复路径修复
    const doubleRepeatApp = await getText(port, '/web-ui/web-ui/app.js');
    assert(
        doubleRepeatApp.statusCode === 200,
        `/web-ui/web-ui/app.js should return 200 after normalization, got ${doubleRepeatApp.statusCode}`
    );

    // ========== 安全测试 ==========

    // 测试路径遍历攻击
    const traversalAttempt = await getText(port, '/web-ui/../cli.js');
    assert(
        traversalAttempt.statusCode === 403,
        `/web-ui/../cli.js should be forbidden (403), got ${traversalAttempt.statusCode}`
    );

    const traversalAttempt2 = await getText(port, '/web-ui/../../package.json');
    assert(
        traversalAttempt2.statusCode === 403,
        `/web-ui/../../package.json should be forbidden (403), got ${traversalAttempt2.statusCode}`
    );

    // 测试编码的路径遍历
    const encodedTraversal = await getText(port, '/web-ui/%2e%2e/%2e%2e/cli.js');
    assert(
        encodedTraversal.statusCode === 403,
        `/web-ui/%2e%2e/%2e%2e/cli.js should be forbidden (403), got ${encodedTraversal.statusCode}`
    );

    // ========== 边界情况测试 ==========

    // 测试双斜杠 /web-ui//
    const doubleSlash = await getText(port, '/web-ui//');
    assert(
        doubleSlash.statusCode === 200,
        `/web-ui// should be normalized and return 200, got ${doubleSlash.statusCode}`
    );

    // 测试 /web-ui/app.js/app.js (无效嵌套)
    const invalidNested = await getText(port, '/web-ui/app.js/app.js');
    assert(
        invalidNested.statusCode === 404,
        `/web-ui/app.js/app.js should return 404, got ${invalidNested.statusCode}`
    );

    // ========== 私有资源保护测试 ==========

    // 测试私有模块不应该直接访问
    const privateModule = await getText(port, '/web-ui/modules/app.constants.mjs');
    assert(
        privateModule.statusCode === 404,
        `/web-ui/modules/app.constants.mjs should return 404 (private), got ${privateModule.statusCode}`
    );

    // 测试私有 CSS 不应该直接访问
    const privateCss = await getText(port, '/web-ui/styles/base-theme.css');
    assert(
        privateCss.statusCode === 404,
        `/web-ui/styles/base-theme.css should return 404 (private), got ${privateCss.statusCode}`
    );

    // ========== 响应一致性测试 ==========

    // 验证 /web-ui 和 /web-ui/ 返回相同内容（除了可能的细微差异）
    assert(
        webUiNoSlash.body.includes('id="app"'),
        '/web-ui response should contain Vue app'
    );
    assert(
        webUiWithSlash.body.includes('id="app"'),
        '/web-ui/ response should contain Vue app'
    );

    // 验证所有 HTML 响应都指向正确的静态资源路径
    const htmlResponses = [webUiNoSlash, webUiWithSlash, webUiIndexHtml];
    for (const i = 0; i < htmlResponses.length; i++) {
        const response = htmlResponses[i];
        assert(
            response.body.includes('src="/web-ui/app.js"'),
            `HTML response ${i} should use absolute path for app.js`
        );
        assert(
            !response.body.includes('src="web-ui/app.js"'),
            `HTML response ${i} should not use relative path for app.js`
        );
    }
};
