function createWebServerLifecycle(options, dependencies) {
    const { server, host, port, httpToken, openBrowser } = options;
    const { http, spawn, process, console, setTimeout, formatHostForUrl, DEFAULT_WEB_OPEN_HOST, isAnyAddressHost, getUnattendedWorkflowRunner } = dependencies;
    const connections = new Set();

    const probeWebUiReadiness = (callback) => {
        const payload = JSON.stringify({ action: 'health-check', params: {} });
        const requestOptions = {
            hostname: openHost,
            port,
            path: '/api',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(payload, 'utf-8'),
                ...(httpToken ? { Authorization: `Bearer ${httpToken}` } : {})
            }
        };
        let settled = false;
        const finish = (ready) => {
            if (settled) return;
            settled = true;
            callback(ready);
        };
        const req = http.request(requestOptions, (probeRes) => {
            if (typeof probeRes.resume === 'function') {
                probeRes.resume();
            }
            probeRes.on('end', () => {
                finish(probeRes.statusCode === 200);
            });
        });
        req.on('error', () => finish(false));
        req.setTimeout(1000, () => {
            try { req.destroy(); } catch (_) { }
            finish(false);
        });
        req.end(payload, 'utf-8');
    };

    const probeWebUiAssetReadiness = (callback) => {
        const requestOptions = {
            hostname: openHost,
            port,
            path: '/web-ui/app.js',
            method: 'GET',
            headers: httpToken ? { Authorization: `Bearer ${httpToken}` } : {}
        };
        let settled = false;
        const finish = (ready) => {
            if (settled) return;
            settled = true;
            callback(ready);
        };
        const req = http.request(requestOptions, (probeRes) => {
            if (typeof probeRes.resume === 'function') {
                probeRes.resume();
            }
            probeRes.on('end', () => {
                finish(probeRes.statusCode === 200);
            });
        });
        req.on('error', () => finish(false));
        req.setTimeout(1000, () => {
            try { req.destroy(); } catch (_) { }
            finish(false);
        });
        req.end();
    };

    const openBrowserAfterReady = (url) => {
        // Some environments may start the listener before the bundled web-ui assets
        // are ready for the first browser hit; wait until both API and assets respond.
        const maxAttempts = 120;
        const retryDelayMs = 200;
        let finished = false;

        const finish = (ready) => {
            if (finished) return;
            finished = true;
            if (!ready) {
                console.warn('! Web UI 就绪探测超时，未自动打开浏览器，请手动访问:', url);
                return;
            }

            const platform = process.platform;
            const commandSpec = platform === 'win32'
                ? { command: 'cmd', args: ['/c', 'start', '', url] }
                : (platform === 'darwin'
                    ? { command: 'open', args: [url] }
                    : { command: 'xdg-open', args: [url] });

            try {
                const child = spawn(commandSpec.command, commandSpec.args, {
                    stdio: 'ignore',
                    detached: true,
                    windowsHide: true
                });
                child.on('error', () => {
                    console.warn('无法自动打开浏览器，请手动访问:', url);
                });
                if (typeof child.unref === 'function') {
                    child.unref();
                }
            } catch (_) {
                console.warn('无法自动打开浏览器，请手动访问:', url);
            }
        };
        const scheduleProbe = (attempt) => {
            probeWebUiReadiness((apiReady) => {
                if (!apiReady) {
                    if (attempt >= maxAttempts) {
                        finish(false);
                        return;
                    }
                    setTimeout(() => scheduleProbe(attempt + 1), retryDelayMs);
                    return;
                }
                probeWebUiAssetReadiness((assetReady) => {
                    if (assetReady) {
                        finish(true);
                        return;
                    }
                    if (attempt >= maxAttempts) {
                        finish(false);
                        return;
                    }
                    setTimeout(() => scheduleProbe(attempt + 1), retryDelayMs);
                });
            });
        };

        scheduleProbe(1);
    };

    server.on('connection', (socket) => {
        connections.add(socket);
        socket.on('close', () => connections.delete(socket));
    });

    const printPortOverrideHint = () => {
        const examplePort = port === 8080 ? 8081 : 8080;
        console.error(`  临时换端口（macOS/Linux）: CODEXMATE_PORT=${examplePort} codexmate run`);
        console.error(`  临时换端口（Windows PowerShell）: $env:CODEXMATE_PORT=${examplePort}; codexmate run`);
        console.error(`  临时换端口（Windows CMD）: set CODEXMATE_PORT=${examplePort} && codexmate run`);
    };

    server.once('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            console.error(`! 启动失败: 端口 ${port} 已被占用，可能有残留的 codexmate run 实例。`);
            console.error('  请先停止旧实例或更换端口后重试。');
            printPortOverrideHint();
        } else if (err && err.code === 'EACCES') {
            console.error(`! 启动失败: 没有权限监听 ${host}:${port}。`);
            console.error('  请检查系统/安全软件限制，或更换端口后重试。');
            printPortOverrideHint();
        } else {
            console.error('! 启动 Web UI 失败:', err && err.message ? err.message : err);
        }
        process.exit(1);
    });

    const openHost = host === '::'
        ? '::1'
        : (host === '0.0.0.0' ? DEFAULT_WEB_OPEN_HOST : host);

    const openUrl = `http://${formatHostForUrl(openHost)}:${port}/?token=${encodeURIComponent(httpToken)}`;

    server.listen(port, host, () => {
        getUnattendedWorkflowRunner().recover();
        console.log('\n✓ Web UI 已启动');
        const willOpenBrowser = !!openBrowser && !process.env.CODEXMATE_NO_BROWSER;
        console.log(`  ${willOpenBrowser ? '已打开' : '待访问'}: ${openUrl}`);
        if (host && host !== openHost) {
            console.log('  监听地址:', host);
        }
        console.log('  退出: Ctrl+C\n');
        if (isAnyAddressHost(host)) {
            console.warn('! 安全提示: 当前监听所有网卡，局域网访问需要访问令牌。');
            console.warn('  远程 /bridge/ 请求需携带 Authorization: Bearer <访问令牌>。');
            const allowedIps = (process.env.CODEXMATE_ALLOWED_IPS || '').trim();
            if (allowedIps) {
                console.warn(`  已启用的来源 IP 白名单: ${allowedIps}`);
            }
        }

        if (willOpenBrowser) {
            openBrowserAfterReady(openUrl);
        }
    });

    const stop = () => new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            for (const socket of connections) {
                try { socket.destroy(); } catch (_) { }
            }
            connections.clear();
            resolve();
        };

        if (!server.listening) {
            finish();
            return;
        }

        server.close(() => finish());
        setTimeout(() => finish(), 800);
    });

    return { server, stop };
}

module.exports = { createWebServerLifecycle };
