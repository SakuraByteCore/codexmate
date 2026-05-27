/**
 * URL 规范化函数单元测试
 *
 * 测试客户端 URL 规范化逻辑，无需启动服务器
 */

/**
 * 从 app.js 中提取的 URL 规范化逻辑
 */
function normalizeWebUiUrl(inputUrl) {
    const url = new URL(inputUrl);
    let pathname = url.pathname;

    // 循环修复多层 /web-ui/ 重复
    let prevPathname;
    do {
        prevPathname = pathname;
        pathname = pathname.replace(/\/+web-ui\/+web-ui\/+/g, '/web-ui/');
    } while (pathname !== prevPathname);

    // /web-ui/* 入口重定向到根路径
    if (pathname === '/web-ui' || pathname === '/web-ui/' || pathname === '/web-ui/index.html') {
        const targetUrl = new URL(url);
        targetUrl.pathname = '/';
        return targetUrl.toString();
    }

    // 如果路径有变化，返回修正后的 URL
    if (pathname !== url.pathname) {
        url.pathname = pathname;
        return url.toString();
    }

    return inputUrl;
}

/**
 * 测试用例定义
 */
const testCases = [
    // 基础路径 - 不应修改
    {
        description: '根路径不应修改',
        input: 'http://127.0.0.1:3737/',
        expected: 'http://127.0.0.1:3737/'
    },
    {
        description: '/session 不应修改',
        input: 'http://127.0.0.1:3737/session?source=codex',
        expected: 'http://127.0.0.1:3737/session?source=codex'
    },

    // /web-ui 入口重定向到根路径
    {
        description: '/web-ui 应重定向到 /',
        input: 'http://127.0.0.1:3737/web-ui',
        expected: 'http://127.0.0.1:3737/'
    },
    {
        description: '/web-ui/ 应重定向到 /',
        input: 'http://127.0.0.1:3737/web-ui/',
        expected: 'http://127.0.0.1:3737/'
    },
    {
        description: '/web-ui/?s=1 应重定向并保留参数',
        input: 'http://127.0.0.1:3737/web-ui/?s=1',
        expected: 'http://127.0.0.1:3737/?s=1'
    },
    {
        description: '/web-ui/#section 应重定向并保留 hash',
        input: 'http://127.0.0.1:3737/web-ui/#section',
        expected: 'http://127.0.0.1:3737/#section'
    },
    {
        description: '/web-ui/?s=1#section 应重定向并保留参数和 hash',
        input: 'http://127.0.0.1:3737/web-ui/?s=1#section',
        expected: 'http://127.0.0.1:3737/?s=1#section'
    },
    {
        description: '/web-ui/index.html 应重定向到 /',
        input: 'http://127.0.0.1:3737/web-ui/index.html',
        expected: 'http://127.0.0.1:3737/'
    },
    {
        description: '/web-ui/index.html?s=1 应重定向并保留参数',
        input: 'http://127.0.0.1:3737/web-ui/index.html?s=1',
        expected: 'http://127.0.0.1:3737/?s=1'
    },
    {
        description: '/web-ui/index.html#section 应重定向并保留 hash',
        input: 'http://127.0.0.1:3737/web-ui/index.html#section',
        expected: 'http://127.0.0.1:3737/#section'
    },

    // 重复路径 - index.html 变体重定向到 /
    {
        description: '/web-ui/web-ui/ 应重定向到 /',
        input: 'http://127.0.0.1:3737/web-ui/web-ui/',
        expected: 'http://127.0.0.1:3737/'
    },
    {
        description: '/web-ui/web-ui/index.html 应重定向到 /',
        input: 'http://127.0.0.1:3737/web-ui/web-ui/index.html',
        expected: 'http://127.0.0.1:3737/'
    },
    {
        description: '/web-ui/web-ui/web-ui/index.html 应重定向到 /',
        input: 'http://127.0.0.1:3737/web-ui/web-ui/web-ui/index.html',
        expected: 'http://127.0.0.1:3737/'
    },

    // 资源重复路径规范化
    {
        description: '/web-ui/web-ui/app.js 应规范化为 /web-ui/app.js',
        input: 'http://127.0.0.1:3737/web-ui/web-ui/app.js',
        expected: 'http://127.0.0.1:3737/web-ui/app.js'
    },
    {
        description: '/web-ui/web-ui/app.js?s=1 应保留参数',
        input: 'http://127.0.0.1:3737/web-ui/web-ui/app.js?s=1&debug=1',
        expected: 'http://127.0.0.1:3737/web-ui/app.js?s=1&debug=1'
    },
    {
        description: '/web-ui/web-ui/?s=1 应重定向并保留参数',
        input: 'http://127.0.0.1:3737/web-ui/web-ui/?s=1',
        expected: 'http://127.0.0.1:3737/?s=1'
    },

    // 会话浏览相关 URL
    {
        description: '/web-ui?tab=sessions 应重定向并保留参数',
        input: 'http://127.0.0.1:3737/web-ui?tab=sessions&s_source=codex',
        expected: 'http://127.0.0.1:3737/?tab=sessions&s_source=codex'
    },
    {
        description: '/web-ui/index.html?tab=sessions 应重定向并保留参数',
        input: 'http://127.0.0.1:3737/web-ui/index.html?tab=sessions&s_source=claude',
        expected: 'http://127.0.0.1:3737/?tab=sessions&s_source=claude'
    },

    // Edge cases
    {
        description: '带端口和自定义域的 URL',
        input: 'http://example.com:8080/web-ui/index.html',
        expected: 'http://example.com:8080/'
    },
    {
        description: 'HTTPS URL',
        input: 'https://example.com/web-ui/',
        expected: 'https://example.com/'
    },

    // 不应影响其他路径
    {
        description: '/res/logo.png 不应修改',
        input: 'http://127.0.0.1:3737/res/logo.png',
        expected: 'http://127.0.0.1:3737/res/logo.png'
    },
    {
        description: '/api 不应修改',
        input: 'http://127.0.0.1:3737/api',
        expected: 'http://127.0.0.1:3737/api'
    },
    {
        description: '嵌套在其他目录下的 web-ui 不应规范化',
        input: 'http://127.0.0.1:3737/other/web-ui/index.html',
        expected: 'http://127.0.0.1:3737/other/web-ui/index.html'
    }
];

/**
 * 运行所有测试
 */
function runTests() {
    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const testCase of testCases) {
        const result = normalizeWebUiUrl(testCase.input);
        if (result === testCase.expected) {
            passed++;
            console.log(`✓ ${testCase.description}`);
        } else {
            failed++;
            failures.push({
                description: testCase.description,
                input: testCase.input,
                expected: testCase.expected,
                actual: result
            });
            console.log(`✗ ${testCase.description}`);
            console.log(`  输入:    ${testCase.input}`);
            console.log(`  期望:    ${testCase.expected}`);
            console.log(`  实际:    ${result}`);
        }
    }

    console.log(`\n====================`);
    console.log(`总计: ${testCases.length} 个测试`);
    console.log(`通过: ${passed} 个`);
    console.log(`失败: ${failed} 个`);
    console.log(`====================`);

    if (failures.length > 0) {
        console.log('\n失败详情:');
        for (const failure of failures) {
            console.log(`\n- ${failure.description}`);
            console.log(`  输入:   ${failure.input}`);
            console.log(`  期望:  ${failure.expected}`);
            console.log(`  实际:  ${failure.actual}`);
        }
        return false;
    }

    return true;
}

/**
 * 直接运行测试（当通过 node 命令执行时）
 */
runTests();

/**
 * 导出供其他测试模块使用
 */
export {
    normalizeWebUiUrl,
    testCases,
    runTests
};
