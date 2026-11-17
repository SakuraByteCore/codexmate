const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const toml = require('@iarna/toml');

const TIMEOUT_MS = 5000;
const SHARED_SERVER = /unified.agent.context|shared.context|memory|\buac\b/i;

function discoverServers(options = {}, warnings = []) {
    const cwd = options.cwd || process.cwd();
    const home = options.home || os.homedir();
    const sources = [
        path.join(cwd, '.mcp.json'),
        path.join(cwd, '.codex', 'config.toml'),
        path.join(home, '.claude.json'),
        path.join(home, '.claude', 'settings.json'),
        path.join(home, '.codex', 'config.toml')
    ];
    const servers = [];
    for (const file of sources) {
        if (!fs.existsSync(file)) continue;
        let config;
        try {
            const text = fs.readFileSync(file, 'utf8');
            config = file.endsWith('.toml') ? toml.parse(text) : JSON.parse(text);
        } catch (_) {
            warnings.push({ source: path.relative(file.startsWith(cwd + path.sep) ? cwd : home, file), reason: 'MCP 配置读取或解析失败' });
            continue;
        }
        const project = (config.projects || {})[cwd] || (config.projects || {})[cwd.split(path.sep).join('/')] || {};
        const entries = { ...(config.mcpServers || config.mcp_servers || {}), ...project.mcpServers };
        const disabled = new Set([...(config.disabledMcpServers || []), ...(project.disabledMcpServers || [])]);
        for (const [name, entry] of Object.entries(entries)) {
            if (!entry || entry.disabled || entry.enabled === false || disabled.has(name)) continue;
            if (!SHARED_SERVER.test([name, entry.command, ...(entry.args || []), entry.url].join(' '))) continue;
            if (!servers.some(server => server.name === name)) servers.push({ ...entry, name, cwd: entry.cwd || cwd });
        }
    }
    return servers;
}

function openStdio(server, timeoutMs) {
    const child = spawn(server.command, server.args || [], {
        cwd: server.cwd || process.cwd(),
        env: { ...process.env, ...(server.env || {}) },
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
    });
    let serial = 0;
    let buffer = '';
    let failure = null;
    const pending = new Map();
    function fail(error) {
        failure = error;
        for (const { reject } of pending.values()) reject(error);
        pending.clear();
    }
    child.on('error', fail);
    child.stdin.on('error', fail);
    child.on('exit', () => fail(new Error('MCP 进程已退出')));
    child.stderr.resume();
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
        buffer += chunk;
        if (Buffer.byteLength(buffer) > 1024 * 1024) return fail(new Error('MCP 响应超过限制'));
        let newline;
        while ((newline = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, newline);
            buffer = buffer.slice(newline + 1);
            let message;
            try { message = JSON.parse(line); } catch (_) { continue; }
            const waiter = pending.get(message.id);
            if (!waiter) continue;
            pending.delete(message.id);
            if (message.error) waiter.reject(new Error('MCP 返回协议错误'));
            else waiter.resolve(message.result);
        }
    });
    return {
        request(method, params, notification = false) {
            if (failure) return Promise.reject(failure);
            const id = ++serial;
            const message = { jsonrpc: '2.0', method, params, ...(!notification ? { id } : {}) };
            if (notification) {
                child.stdin.write(JSON.stringify(message) + '\n');
                return Promise.resolve();
            }
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    pending.delete(id);
                    reject(new Error('MCP 请求超时'));
                }, timeoutMs);
                pending.set(id, {
                    resolve: value => { clearTimeout(timer); resolve(value); },
                    reject: error => { clearTimeout(timer); reject(error); }
                });
                child.stdin.write(JSON.stringify(message) + '\n');
            });
        },
        async close() {
            fail(new Error('MCP 连接已关闭'));
            child.stdin.end();
            if (child.exitCode !== null) return;
            await new Promise(resolve => {
                const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 250);
                child.once('exit', () => { clearTimeout(timer); resolve(); });
                child.kill();
            });
        }
    };
}

function openHttp(server, timeoutMs) {
    const url = new URL(server.url);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('MCP URL 协议不受支持');
    let serial = 0;
    let session = '';
    let protocol = '';
    const transport = url.protocol === 'https:' ? https : http;
    function send(method, params, notification = false, closing = false) {
        const id = ++serial;
        const body = closing ? '' : JSON.stringify({ jsonrpc: '2.0', method, params, ...(!notification ? { id } : {}) });
        return new Promise((resolve, reject) => {
            const request = transport.request(url, {
                method: closing ? 'DELETE' : 'POST',
                headers: { ...(server.headers || {}),
                    ...(server.bearer_token_env_var && process.env[server.bearer_token_env_var]
                        ? { Authorization: `Bearer ${process.env[server.bearer_token_env_var]}` } : {}),
                    'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
                    ...(session ? { 'Mcp-Session-Id': session } : {}),
                    ...(protocol ? { 'MCP-Protocol-Version': protocol } : {}) }
            }, response => {
                if (response.statusCode < 200 || response.statusCode >= 300) {
                    response.resume();
                    reject(new Error(`MCP HTTP ${response.statusCode}`));
                    return;
                }
                session = response.headers['mcp-session-id'] || session;
                let text = '';
                response.setEncoding('utf8');
                response.on('error', reject);
                response.on('data', chunk => {
                    text += chunk;
                    if (Buffer.byteLength(text) > 1024 * 1024) request.destroy(new Error('MCP 响应超过限制'));
                    if ((response.headers['content-type'] || '').includes('text/event-stream')) {
                        const events = text.split(/\r?\n\r?\n/);
                        text = events.pop();
                        for (const event of events) {
                            const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
                            if (!data) continue;
                            try {
                                const message = JSON.parse(data);
                                if (message.id !== id) continue;
                                if (message.error) reject(new Error('MCP 返回协议错误'));
                                else resolve(message.result);
                                response.destroy();
                            } catch (_) { reject(new Error('MCP 返回无效事件')); }
                        }
                    }
                });
                response.on('end', () => {
                    if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`MCP HTTP ${response.statusCode}`));
                    if (notification || closing) return resolve();
                    try {
                        const message = JSON.parse(text);
                        if (message.id !== id || message.error) throw new Error();
                        resolve(message.result);
                    } catch (_) { reject(new Error('MCP 返回无效响应')); }
                });
            });
            const timer = setTimeout(() => request.destroy(new Error('MCP 请求超时')), timeoutMs);
            request.on('close', () => clearTimeout(timer));
            request.on('error', reject);
            request.end(body);
        });
    }
    return {
        async request(method, params, notification) {
            const result = await send(method, params, notification);
            if (method === 'initialize') protocol = result.protocolVersion;
            return result;
        },
        async close() { if (session) await send('', {}, false, true).catch(() => {}); }
    };
}

// Only map semantic fields exposed by a native tool. Unknown required fields
// make a tool incompatible rather than inventing server-specific arguments.
function nativeWrite(tool, handoff) {
    const name = tool.name || '';
    if (!/^(memory_write|set_memory|save_context|store_context|add_context|write_context|store_memory|save_memory|add_memory|create_memory|create_entities)$/.test(name)) return null;
    const schema = tool.inputSchema || {};
    const properties = schema.properties || {};
    const content = JSON.stringify(handoff);
    const values = {
        content, text: content, memory: content, context: content, value: content,
        title: `Handoff ${handoff.id}`, name: `Handoff ${handoff.id}`,
        key: `handoff:${handoff.id}`, agent_id: handoff.target, agent: handoff.target,
        project_id: handoff.threadId, project: handoff.threadId,
        tags: ['handoff', handoff.threadId, handoff.target],
        metadata: { handoffId: handoff.id, threadId: handoff.threadId, target: handoff.target },
        entities: [{ name: `handoff:${handoff.id}`, entityType: 'handoff', observations: [content] }]
    };
    const args = {};
    for (const [key, property] of Object.entries(properties)) {
        const value = values[key];
        if (value === undefined) continue;
        const type = Array.isArray(value) ? 'array' : typeof value;
        if (property.type && property.type !== type) continue;
        if (property.enum && !property.enum.includes(value)) continue;
        args[key] = value;
    }
    if ((schema.required || []).some(key => !(key in args))) return null;
    if (!['content', 'text', 'memory', 'context', 'value', 'entities'].some(key => key in args)) return null;
    if (name === 'set_memory' && !('key' in args && 'value' in args)) return null;
    return { name, arguments: args };
}

async function deliver(handoff, options = {}) {
    const start = Date.now();
    let server;
    let connection;
    let stage = 'discovery';
    let tool = null;
    const discoveryWarnings = [];
    let writeStarted = null;
    try {
        const servers = discoverServers(options, discoveryWarnings);
        if (!servers.length) return { ok: false, reason: discoveryWarnings.length ? 'MCP 配置读取或解析失败；未探测到可用共享记忆 MCP' : '未探测到共享记忆 MCP', stage,
            durationMs: Date.now() - start, writeDurationMs: 0, mcp: null, discoveryWarnings };
        // Probe candidates read-only; after the first compatible tool is selected,
        // perform exactly one write. A failed write never selects another server.
        for (const candidate of servers) {
            server = candidate;
            stage = 'initialize';
            tool = null;
            try {
                const timeout = options.timeoutMs || TIMEOUT_MS;
                connection = server.url ? openHttp(server, timeout) : openStdio(server, timeout);
                await connection.request('initialize', {
                    protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'codexmate-handoff', version: '1.0.0' }
                });
                await connection.request('notifications/initialized', {}, true);
                stage = 'tools/list';
                let cursor;
                do {
                    const listing = await connection.request('tools/list', cursor ? { cursor } : {});
                    for (const entry of listing.tools || []) {
                        tool = nativeWrite(entry, handoff);
                        if (tool) break;
                    }
                    cursor = listing.nextCursor;
                } while (!tool && cursor);
                if (!tool) throw new Error('共享记忆工具接口不兼容');
                break;
            } catch (error) {
                if (connection) await connection.close();
                connection = null;
                if (candidate === servers[servers.length - 1]) throw error;
            }
        }
        stage = 'tools/call';
        writeStarted = Date.now();
        const result = await connection.request('tools/call', tool);
        if (!result || result.isError) throw new Error('共享记忆写入失败');
        return { ok: true, reason: '', stage, mcp: { server: server.name, tool: tool.name },
            durationMs: Date.now() - start, writeDurationMs: Date.now() - writeStarted, discoveryWarnings };
    } catch (error) {
        // Never persist server response bodies, environment values or credentials.
        const safeReasons = ['共享记忆工具接口不兼容', '共享记忆写入失败', 'MCP 请求超时', 'MCP 进程已退出', 'MCP 返回协议错误'];
        return { ok: false, reason: safeReasons.includes(error.message) ? error.message : `MCP ${stage} 失败`,
            stage, mcp: server ? { server: server.name, tool: tool && tool.name } : null,
            durationMs: Date.now() - start, writeDurationMs: writeStarted === null ? 0 : Date.now() - writeStarted, discoveryWarnings };
    } finally {
        if (connection) await connection.close();
    }
}

module.exports = { deliver, discoverServers, nativeWrite };
