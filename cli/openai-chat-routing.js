'use strict';
const http = require('http');
const https = require('https');
const { pipeline } = require('stream');
const { joinApiUrl } = require('../lib/cli-utils');
const UPSTREAM_IDLE_TIMEOUT_MS = 300000;

function createOpenaiChatRoutingHandler({ member, authorization, upstreamHeaders, httpAgent, httpsAgent }) {
    return (req, res) => {
        const url = new URL(joinApiUrl(member.baseUrl, 'chat/completions'));
        const transport = url.protocol === 'https:' ? https : http;
        const headers = { ...upstreamHeaders, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'X-Codexmate-Routing-Hop': '1' };
        if (authorization) headers.Authorization = authorization;
        const upstream = transport.request(url, {
            method: 'POST', headers, agent: url.protocol === 'https:' ? httpsAgent : httpAgent
        }, response => {
            res.writeHead(response.statusCode, {
                'Content-Type': response.headers['content-type'] || 'application/json',
                'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no'
            });
            if (response.statusCode < 400 && typeof res.flushHeaders === 'function') res.flushHeaders();
            pipeline(response, res, error => { if (error) res.destroy(error); });
        });
        const abort = () => upstream.destroy();
        res.once('close', abort);
        res.once('finish', () => res.removeListener('close', abort));
        upstream.setTimeout(UPSTREAM_IDLE_TIMEOUT_MS, () => upstream.destroy(new Error('Upstream timeout')));
        upstream.once('error', () => {
            if (res.destroyed) return;
            if (res.headersSent) { res.destroy(); return; }
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: 'OpenAI Chat upstream request failed', type: 'api_error', code: null, param: null } }));
        });
        req.pipe(upstream);
        return true;
    };
}
module.exports = { createOpenaiChatRoutingHandler };
