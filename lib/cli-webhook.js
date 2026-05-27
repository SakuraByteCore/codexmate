const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const os = require('os');
const net = require('net');

const ALLOWED_EVENTS = ['provider-switch', 'claude-md-edit'];
const DEFAULT_TIMEOUT_MS = 5000;

function isPrivateNetworkHost(hostname) {
    const host = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
    if (!host) return true;
    if (host === 'localhost') return true;
    const ipVer = net.isIP(host);
    if (!ipVer) return false;
    if (ipVer === 4) {
        const parts = host.split('.').map(function (x) { return parseInt(x, 10); });
        if (parts[0] === 10) return true;
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        if (parts[0] === 192 && parts[1] === 168) return true;
        if (parts[0] === 127) return true;
        if (parts[0] === 0) return true;
        if (parts[0] === 169 && parts[1] === 254) return true;
        return false;
    }
    if (host === '::1' || host === '::') return true;
    if (host.startsWith('fc') || host.startsWith('fd')) return true;
    if (host.startsWith('fe80')) return true;
    return false;
}

function defaultConfigPath() {
    return path.join(os.homedir(), '.codex', 'codexmate-webhook.json');
}

function normalizeConfig(cfg) {
    const out = { enabled: false, url: '', events: ALLOWED_EVENTS.slice() };
    if (!cfg || typeof cfg !== 'object') return out;
    out.enabled = !!cfg.enabled;
    out.url = typeof cfg.url === 'string' ? cfg.url.trim() : '';
    if (Array.isArray(cfg.events)) {
        const filtered = cfg.events.filter(function (e) { return ALLOWED_EVENTS.indexOf(e) !== -1; });
        out.events = filtered.length ? filtered : ALLOWED_EVENTS.slice();
    }
    return out;
}

function loadWebhookConfig(filePath) {
    const target = filePath || defaultConfigPath();
    try {
        if (!fs.existsSync(target)) {
            return normalizeConfig({});
        }
        const raw = fs.readFileSync(target, 'utf-8');
        return normalizeConfig(JSON.parse(raw));
    } catch (_) {
        return normalizeConfig({});
    }
}

function saveWebhookConfig(cfg, filePath) {
    const target = filePath || defaultConfigPath();
    const normalized = normalizeConfig(cfg);
    try {
        fs.mkdirSync(path.dirname(target), { recursive: true });
    } catch (_) {}
    fs.writeFileSync(target, JSON.stringify(normalized, null, 2), { encoding: 'utf-8', mode: 0o600 });
    return normalized;
}

function postJson(targetUrl, payload, timeoutMs) {
    return new Promise(function (resolve) {
        let parsed;
        try {
            parsed = new URL(targetUrl);
        } catch (_) {
            resolve({ ok: false, error: 'invalid-url' });
            return;
        }
        const allowPrivateWebhook = process.env.CODEXMATE_ALLOW_PRIVATE_WEBHOOK === '1';
        if (!allowPrivateWebhook && isPrivateNetworkHost(parsed.hostname || '')) {
            resolve({ ok: false, error: 'Refusing to send webhook to private network host' });
            return;
        }
        const transport = parsed.protocol === 'https:' ? https : http;
        const body = JSON.stringify(payload || {});
        let req;
        try {
            req = transport.request({
                method: 'POST',
                protocol: parsed.protocol,
                hostname: parsed.hostname,
                port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                path: (parsed.pathname || '/') + (parsed.search || ''),
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body, 'utf-8'),
                    'User-Agent': 'codexmate-webhook/1'
                }
            }, function (res) {
                let raw = '';
                res.on('data', function (chunk) {
                    if (raw.length < 1024) raw += chunk.toString('utf-8');
                });
                res.on('end', function () {
                    const status = res.statusCode || 0;
                    resolve({ ok: status >= 200 && status < 300, status: status, body: raw.slice(0, 200) });
                });
            });
        } catch (e) {
            resolve({ ok: false, error: e && e.message ? e.message : String(e) });
            return;
        }
        const wait = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;
        req.setTimeout(wait, function () { req.destroy(new Error('timeout')); });
        req.on('error', function (err) { resolve({ ok: false, error: err && err.message ? err.message : String(err) }); });
        req.write(body);
        req.end();
    });
}

function buildPayload(event, summary, details) {
    return {
        event: String(event || ''),
        summary: String(summary || ''),
        operator: process.env.USER || process.env.USERNAME || (os.userInfo && os.userInfo().username) || '',
        timestamp: new Date().toISOString(),
        details: details && typeof details === 'object' ? details : {}
    };
}

function notifyWebhook(event, summary, details, options) {
    const opts = options || {};
    const cfg = opts.config ? normalizeConfig(opts.config) : loadWebhookConfig(opts.filePath);
    if (!cfg.enabled || !cfg.url) {
        return Promise.resolve({ ok: false, skipped: true, reason: 'disabled' });
    }
    if (cfg.events.indexOf(event) === -1) {
        return Promise.resolve({ ok: false, skipped: true, reason: 'event-filtered' });
    }
    return postJson(cfg.url, buildPayload(event, summary, details), opts.timeoutMs);
}

module.exports = {
    ALLOWED_EVENTS,
    defaultConfigPath,
    normalizeConfig,
    loadWebhookConfig,
    saveWebhookConfig,
    notifyWebhook,
    buildPayload,
    postJson
};
