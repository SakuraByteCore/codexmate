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

module.exports = async function testWebUiAssets(ctx) {
    const { port } = ctx;

    const rootPage = await getText(port, '/');
    assert(rootPage.statusCode === 200, 'root web ui page should return 200');
    assert(
        /^text\/html\b/.test(String(rootPage.headers['content-type'] || '')),
        'root web ui page should return html content type'
    );
    assert(rootPage.body.includes('id="panel-market"'), 'root web ui page should inline market panel');
    assert(rootPage.body.includes('class="modal modal-wide skills-modal"'), 'root web ui page should inline skills modal');
    assert(rootPage.body.includes('src="/web-ui/app.js"'), 'root web ui page should point to the absolute app entry');
    assert(!rootPage.body.includes('src="web-ui/app.js"'), 'root web ui page should not use a relative app entry');
    assert(!/<!--\s*@include\s+/.test(rootPage.body), 'root web ui page should not leak include directives');

    // /web-ui/index.html now returns 404 (only root path serves HTML)
    const bundledIndex = await getText(port, '/web-ui/index.html');
    assert(bundledIndex.statusCode === 302, '/web-ui/index.html should redirect to the canonical root URL');
    assert(bundledIndex.headers.location === '/', '/web-ui/index.html should not remain in the address bar');
    assert(bundledIndex.headers['cache-control'] === 'no-store, max-age=0', '/web-ui/index.html redirect should not be cached');

    const bundledIndexWithQuery = await getText(port, '/web-ui/index.html?tab=sessions');
    assert(bundledIndexWithQuery.statusCode === 302, '/web-ui/index.html with query should redirect');
    assert(bundledIndexWithQuery.headers.location === '/?tab=sessions', '/web-ui/index.html redirect should preserve query params');

    // /web-ui/ now returns 404 (only root path serves HTML)
    const bundledIndexWithSlash = await getText(port, '/web-ui/');
    assert(bundledIndexWithSlash.statusCode === 404, '/web-ui/ should return 404');

    const appEntry = await getText(port, '/web-ui/app.js');
    assert(appEntry.statusCode === 200, 'app entry should return 200');
    assert(
        /^application\/javascript\b/.test(String(appEntry.headers['content-type'] || '')),
        'app entry should return javascript content type'
    );
    assert(appEntry.body.includes('document.addEventListener(\'DOMContentLoaded\''), 'app entry should contain the executable bootstrap');
    assert(appEntry.body.includes('window.__CODEXMATE_WEB_UI_RENDER__'), 'app entry should include the precompiled Web UI render function');
    assert(!/\bwith\s*\(/.test(appEntry.body), 'app entry render function should be safe for module strict mode');
    assert(
        !/(?:^|\n)\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]\.[^'"]+['"]\s*;?/.test(appEntry.body),
        'app entry should not leak split relative module imports'
    );
    assert(
        !/(?:^|\n)\s*export\s+\*\s+from\s+['"]\.[^'"]+['"]\s*;?/.test(appEntry.body),
        'app entry should not leak split re-export directives'
    );
    assert(appEntry.body.includes('onClaudeModelChange'), 'app entry should expose Claude model handler');

    const logicEntry = await getText(port, '/web-ui/logic.mjs');
    assert(logicEntry.statusCode === 200, 'logic entry should return 200');
    assert(
        /^application\/javascript\b/.test(String(logicEntry.headers['content-type'] || '')),
        'logic entry should return javascript content type'
    );
    assert(
        logicEntry.body.includes('export function normalizeClaudeValue'),
        'logic entry should preserve named exports for compatibility'
    );
    assert(
        !/(?:^|\n)\s*export\s+\*\s+from\s+['"]\.[^'"]+['"]\s*;?/.test(logicEntry.body),
        'logic entry should not leak split re-export directives'
    );

    const cssAsset = await getText(port, '/web-ui/styles/base-theme.css');
    assert(cssAsset.statusCode === 404, 'new split css implementation detail should stay private');
    assert(
        /^text\/plain\b/.test(String(cssAsset.headers['content-type'] || '')),
        'private split css asset should return plain-text not found'
    );

    const bundledCss = await getText(port, '/web-ui/styles.css');
    assert(bundledCss.statusCode === 200, 'styles entry should return 200');
    assert(
        /^text\/css\b/.test(String(bundledCss.headers['content-type'] || '')),
        'styles entry should return css content type'
    );
    assert(bundledCss.body.includes('--radius-md:'), 'styles entry should include theme variables');
    assert(
        !/@import\s+url\(['"]\.\/styles\//.test(bundledCss.body),
        'styles entry should not leak split css imports'
    );

    const moduleAsset = await getText(port, '/web-ui/modules/app.constants.mjs');
    assert(moduleAsset.statusCode === 404, 'new split module implementation detail should stay private');
    assert(
        /^text\/plain\b/.test(String(moduleAsset.headers['content-type'] || '')),
        'private split module asset should return plain-text not found'
    );

    const traversal = await getText(port, '/web-ui/../cli.js');
    assert(traversal.statusCode === 403, 'path traversal outside web-ui should be forbidden');
};
