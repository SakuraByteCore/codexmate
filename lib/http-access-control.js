'use strict';

const crypto = require('crypto');
const net = require('net');

const IPV4_BYTE_COUNT = 4;
const IPV6_BYTE_COUNT = 16;
const IPV4_PREFIX_MAX = 32;
const IPV6_PREFIX_MAX = 128;
const BITS_PER_BYTE = 8;
const AUTH_REALM = 'codexmate';
const SECURITY_HEADERS = Object.freeze({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:"
});

function parseIpv4Bytes(value) {
    if (net.isIP(value) !== 4) {
        return null;
    }
    return Buffer.from(value.split('.').map((part) => Number(part)));
}

function parseIpv6Words(value) {
    if (net.isIP(value) !== 6) {
        return null;
    }
    const halves = value.split('::');
    if (halves.length > 2) {
        return null;
    }

    const parseSide = (side) => {
        if (!side) {
            return [];
        }
        const words = [];
        const tokens = side.split(':');
        for (let index = 0; index < tokens.length; index += 1) {
            const token = tokens[index];
            if (token.includes('.')) {
                if (index !== tokens.length - 1) {
                    return null;
                }
                const ipv4 = parseIpv4Bytes(token);
                if (!ipv4) {
                    return null;
                }
                words.push(ipv4[0] * 256 + ipv4[1]);
                words.push(ipv4[2] * 256 + ipv4[3]);
                continue;
            }
            if (!/^[0-9a-f]{1,4}$/i.test(token)) {
                return null;
            }
            words.push(parseInt(token, 16));
        }
        return words;
    };

    const left = parseSide(halves[0]);
    const right = parseSide(halves[1] || '');
    if (!left || !right) {
        return null;
    }

    let words;
    if (halves.length === 1) {
        if (left.length !== 8) {
            return null;
        }
        words = left;
    } else {
        const missing = 8 - left.length - right.length;
        if (missing < 1) {
            return null;
        }
        words = left.concat(new Array(missing).fill(0), right);
    }

    const bytes = Buffer.alloc(IPV6_BYTE_COUNT);
    for (let index = 0; index < words.length; index += 1) {
        bytes.writeUInt16BE(words[index], index * 2);
    }
    return bytes;
}

function parseIp(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const address = value.trim();
    const ipv4 = parseIpv4Bytes(address);
    if (ipv4) {
        return { version: 4, bytes: ipv4 };
    }
    const ipv6 = parseIpv6Words(address);
    if (ipv6) {
        return { version: 6, bytes: ipv6 };
    }
    return null;
}

function isIpv4Mapped(bytes) {
    if (bytes.length !== IPV6_BYTE_COUNT) {
        return false;
    }
    for (let index = 0; index < 10; index += 1) {
        if (bytes[index] !== 0) {
            return false;
        }
    }
    return bytes[10] === 255 && bytes[11] === 255;
}

function normalizeIp(ip) {
    if (ip && ip.version === 6 && isIpv4Mapped(ip.bytes)) {
        return { version: 4, bytes: ip.bytes.slice(12, 16) };
    }
    return ip;
}

function parseCidr(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const parts = value.trim().split('/');
    if (parts.length > 2) {
        return null;
    }
    const ip = parseIp(parts[0]);
    if (!ip) {
        return null;
    }
    let prefix = null;
    if (parts.length === 2) {
        if (!/^\d+$/.test(parts[1])) {
            return null;
        }
        prefix = Number(parts[1]);
    }
    const maxPrefix = ip.version === 4 ? IPV4_PREFIX_MAX : IPV6_PREFIX_MAX;
    if (prefix !== null && prefix > maxPrefix) {
        return null;
    }
    if (ip.version === 6 && isIpv4Mapped(ip.bytes) && (prefix === null || prefix >= 96)) {
        return {
            version: 4,
            bytes: ip.bytes.slice(12, 16),
            prefix: prefix === null ? IPV4_PREFIX_MAX : prefix - 96
        };
    }
    return {
        version: ip.version,
        bytes: ip.bytes,
        prefix: prefix === null ? maxPrefix : prefix
    };
}

function parseAllowedIps(value) {
    let source = value;
    if (source === undefined || source === null) {
        source = [];
    } else if (typeof source === 'string') {
        source = source.split(',');
    } else if (!Array.isArray(source)) {
        throw new Error('parseAllowedIps: allowed IP list must be a string or an array');
    }

    const entries = [];
    for (const item of source) {
        if (typeof item !== 'string') {
            throw new Error('parseAllowedIps: allowed IP entries must be strings');
        }
        for (const part of item.split(',')) {
            const entry = part.trim();
            if (!entry) {
                continue;
            }
            if (!parseCidr(entry)) {
                throw new Error(`parseAllowedIps: invalid CIDR entry "${entry}"`);
            }
            entries.push(entry);
        }
    }
    return entries;
}

function bytesMatchPrefix(left, right, prefix) {
    const fullBytes = Math.floor(prefix / BITS_PER_BYTE);
    for (let index = 0; index < fullBytes; index += 1) {
        if (left[index] !== right[index]) {
            return false;
        }
    }
    const remainingBits = prefix % BITS_PER_BYTE;
    if (!remainingBits) {
        return true;
    }
    const mask = (0xff << (BITS_PER_BYTE - remainingBits)) & 0xff;
    return (left[fullBytes] & mask) === (right[fullBytes] & mask);
}

function compileAllowedIps(allowedIps) {
    return parseAllowedIps(allowedIps).map((entry) => parseCidr(entry));
}

function isIpAllowed(ip, allowedIps) {
    const candidate = normalizeIp(parseIp(ip));
    if (!candidate) {
        return false;
    }
    return compileAllowedIps(allowedIps).some((rule) => (
        candidate.version === rule.version &&
        bytesMatchPrefix(candidate.bytes, rule.bytes, rule.prefix)
    ));
}

function sendJson(res, statusCode, payload, headers = {}) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        ...SECURITY_HEADERS,
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}
function tokensMatch(provided, expected) {
    const providedDigest = crypto.createHash('sha256').update(provided, 'utf8').digest();
    const expectedDigest = crypto.createHash('sha256').update(expected, 'utf8').digest();
    return crypto.timingSafeEqual(providedDigest, expectedDigest);
}
function isLoopbackAddress(value) {
    const candidate = normalizeIp(parseIp(value));
    if (!candidate) {
        return false;
    }
    if (candidate.version === 4) {
        return candidate.bytes[0] === 127;
    }
    return candidate.bytes.every((byte, index) => (index === 15 ? byte === 1 : byte === 0));
}


function getBearerToken(req) {
    const headers = req && req.headers;
    const authorization = headers && headers.authorization;
    if (typeof authorization !== 'string') {
        return null;
    }
    const match = /^Bearer[ \t]+(.+)$/i.exec(authorization.trim());
    if (!match || /\s/.test(match[1])) {
        return null;
    }
    return match[1];
}

function createHttpAccessControlMiddleware(options = {}) {
    const requiresToken = typeof options.requiresToken === 'function'
        ? options.requiresToken
        : () => true;
    const bypassLoopback = options.bypassLoopback === true;
    const token = typeof options.token === 'string' ? options.token.trim() : '';
    const allowedRules = compileAllowedIps(options.allowedIps);

    return (req, res, next) => {
        if (allowedRules.length > 0) {
            const remoteAddress = req && req.socket && req.socket.remoteAddress;
            const candidate = normalizeIp(parseIp(remoteAddress));
            const allowed = candidate && allowedRules.some((rule) => (
                candidate.version === rule.version &&
                bytesMatchPrefix(candidate.bytes, rule.bytes, rule.prefix)
            ));
            if (!allowed) {
                sendJson(res, 403, { error: 'Forbidden' });
                return;
            }
        }

        const remoteAddress = req && req.socket && req.socket.remoteAddress;
        const loopbackPeer = bypassLoopback && isLoopbackAddress(remoteAddress);
        if (token && !loopbackPeer && requiresToken(req)) {
            const provided = getBearerToken(req);
            if (!provided || !tokensMatch(provided, token)) {
                sendJson(res, 401, { error: 'Unauthorized' }, {
                    'WWW-Authenticate': `Bearer realm="${AUTH_REALM}"`
                });
                return;
            }
        }

        next();
    };
}

function isLoopbackHost(host) {
    if (typeof host !== 'string') {
        return false;
    }
    let value = host.trim().toLowerCase();
    if (!value) {
        return false;
    }
    if (value.startsWith('[') && value.endsWith(']')) {
        value = value.slice(1, -1);
    }
    if (value === 'localhost' || value === 'localhost.') {
        return true;
    }
    const ip = normalizeIp(parseIp(value));
    if (!ip) {
        return false;
    }
    if (ip.version === 4) {
        return ip.bytes[0] === 127;
    }
    return ip.bytes.every((byte, index) => (index === 15 ? byte === 1 : byte === 0));
}

function assertExternalTokenConfigured(host, token) {
    const normalizedToken = typeof token === 'string' ? token.trim() : '';
    if (!isLoopbackHost(host) && !normalizedToken) {
        throw new Error('对外监听必须设置 CODEXMATE_HTTP_TOKEN');
    }
}

module.exports = {
    createHttpAccessControlMiddleware,
    parseAllowedIps,
    isIpAllowed,
    isLoopbackHost,
    assertExternalTokenConfigured
};
