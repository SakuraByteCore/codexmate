'use strict';

const http = require('http');
const os = require('os');
const { createHmac, randomBytes, timingSafeEqual } = require('crypto');
const { isIpAllowed, parseAllowedIps } = require('./http-access-control');

const PRIVATE_SUBNETS = ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
const DOWNLOAD_PATH = /^\/download\/([a-f0-9]{32})\/(0|[1-9]\d*)$/;
const TOKEN_PATTERN = /^(\d{13})\.([a-f0-9]{32})\.([a-f0-9]{64})$/;
const LINK_TTL_MS = 60 * 60 * 1000;
const MAX_REQUEST_HEADER_BYTES = 8 * 1024;
const HEADER_TIMEOUT_MS = 10 * 1000;

function findLanInterface(localAddress) {
    const interfaces = Object.values(os.networkInterfaces()).flat().filter(entry =>
        !entry.internal && entry.cidr && isIpAllowed(entry.address, PRIVATE_SUBNETS));
    return interfaces.find(entry => entry.address === localAddress) || interfaces[0];
}

function rejectDownload(res, status) {
    res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff'
    });
    res.end(http.STATUS_CODES[status]);
}

function createLanDownloads(sendFile) {
    const secret = randomBytes(32);
    const allowedIps = parseAllowedIps(process.env.CODEXMATE_ALLOWED_IPS || '');
    const signature = (resource, stamp, nonce) => createHmac('sha256', secret)
        .update(`${resource}\n${stamp}\n${nonce}`).digest();
    const sockets = new Set();
    let listener;
    let server;

    function authorizeLink(resource, query) {
        const token = TOKEN_PATTERN.exec(new URLSearchParams(query).get('token') || '');
        if (!token || Number(token[1]) <= Date.now()) return false;
        return timingSafeEqual(signature(resource, token[1], token[2]), Buffer.from(token[3], 'hex'));
    }

    async function start(iface) {
        const { address, cidr } = iface;
        server = http.createServer({ maxHeaderSize: MAX_REQUEST_HEADER_BYTES }, (req, res) => {
            const remote = req.socket.remoteAddress;
            if (!isIpAllowed(remote, [cidr]) || (allowedIps.length && !isIpAllowed(remote, allowedIps))) {
                return rejectDownload(res, 403);
            }
            if (req.method !== 'GET' && req.method !== 'HEAD') return rejectDownload(res, 405);
            const authority = `${address}:${server.address().port}`;
            if (req.headers.host !== authority) return rejectDownload(res, 404);
            const queryStart = req.url.indexOf('?');
            const resource = queryStart === -1 ? req.url : req.url.slice(0, queryStart);
            const match = DOWNLOAD_PATH.exec(resource);
            if (!match) return rejectDownload(res, 404);
            if (!authorizeLink(resource, queryStart === -1 ? '' : req.url.slice(queryStart + 1))) return rejectDownload(res, 403);
            void sendFile(req, res, match[1], Number(match[2])).catch(error => {
                if (res.headersSent || res.destroyed) return;
                rejectDownload(res, error.status || 500);
            });
        });
        server.headersTimeout = HEADER_TIMEOUT_MS;
        server.on('connection', socket => {
            sockets.add(socket);
            socket.once('close', () => sockets.delete(socket));
        });
        await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen(0, address, () => {
                server.removeListener('error', reject);
                resolve();
            });
        });
        return `http://${address}:${server.address().port}`;
    }

    return {
        async issue(id, index, localAddress) {
            if (!listener) {
                const iface = findLanInterface(localAddress);
                if (!iface) return null;
                listener = start(iface).catch(error => {
                    listener = null;
                    server = null;
                    console.warn('! LAN download listener failed:', error.code || 'error');
                    return null;
                });
            }
            const origin = await listener;
            if (!origin) return null;
            const resource = `/download/${id}/${index}`;
            const expiresAt = Date.now() + LINK_TTL_MS;
            const nonce = randomBytes(16).toString('hex');
            const token = `${expiresAt}.${nonce}.${signature(resource, expiresAt, nonce).toString('hex')}`;
            return { url: `${origin}${resource}?token=${token}`, expiresAt };
        },
        async close() {
            if (!listener) return;
            await listener;
            if (!server) return;
            await new Promise(resolve => {
                server.close(resolve);
                for (const socket of sockets) socket.destroy();
            });
        }
    };
}

module.exports = { createLanDownloads };
