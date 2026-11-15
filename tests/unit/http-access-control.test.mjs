import assert from 'node:assert/strict';
import nodeTest from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const test = typeof globalThis.test === 'function' ? globalThis.test : nodeTest;
const {
    createHttpAccessControlMiddleware,
    parseAllowedIps,
    isIpAllowed,
    isLoopbackHost,
    assertExternalTokenConfigured
} = require('../../lib/http-access-control.js');

function createResponse() {
    return {
        statusCode: 200,
        headers: {},
        body: '',
        writeHead(statusCode, headers = {}) {
            this.statusCode = statusCode;
            this.headers = headers;
        },
        end(body = '') {
            this.body = body;
        }
    };
}

function createRequest(remoteAddress, authorization, url = '/') {
    const headers = {};
    if (authorization !== undefined) {
        headers.authorization = authorization;
    }
    return {
        url,
        headers,
        socket: { remoteAddress }
    };
}

function invoke(middleware, remoteAddress, authorization, url = '/') {
    const req = createRequest(remoteAddress, authorization, url);
    const res = createResponse();
    let nextCalls = 0;
    middleware(req, res, () => {
        nextCalls += 1;
    });
    return { req, res, nextCalls };
}
test('Bearer token accepts the configured token', () => {
    const middleware = createHttpAccessControlMiddleware({ token: 'secret-token' });
    const result = invoke(middleware, '127.0.0.1', 'Bearer secret-token');

    assert.strictEqual(result.nextCalls, 1);
    assert.strictEqual(result.res.statusCode, 200);
});

test('Bearer token rejects wrong and missing credentials with 401', () => {
    const middleware = createHttpAccessControlMiddleware({ token: 'secret-token' });
    const wrong = invoke(middleware, '127.0.0.1', 'Bearer wrong-token');
    const missing = invoke(middleware, '127.0.0.1');
    const wrongScheme = invoke(middleware, '127.0.0.1', 'Basic secret-token');

    assert.strictEqual(wrong.res.statusCode, 401);
    assert.strictEqual(wrong.res.headers['WWW-Authenticate'], 'Bearer realm="codexmate"');
    assert.strictEqual(wrong.nextCalls, 0);
    assert.deepStrictEqual(JSON.parse(wrong.res.body), { error: 'Unauthorized' });
    assert.strictEqual(missing.res.statusCode, 401);
    assert.strictEqual(missing.nextCalls, 0);
    assert.strictEqual(wrongScheme.res.statusCode, 401);
    assert.strictEqual(wrongScheme.nextCalls, 0);
});

test('IP allowlist rejects an unlisted peer with 403', () => {
    const middleware = createHttpAccessControlMiddleware({
        token: 'secret-token',
        allowedIps: '10.0.0.0/8'
    });
    const result = invoke(middleware, '192.168.1.20', 'Bearer secret-token');

    assert.strictEqual(result.res.statusCode, 403);
    assert.strictEqual(result.nextCalls, 0);
    assert.deepStrictEqual(JSON.parse(result.res.body), { error: 'Forbidden' });
});

test('IP allowlist accepts an exact IPv4 address', () => {
    const middleware = createHttpAccessControlMiddleware({
        allowedIps: '192.168.1.20'
    });
    const result = invoke(middleware, '192.168.1.20');

    assert.strictEqual(result.nextCalls, 1);
});

test('IPv4 CIDR allowlist accepts a peer in the network', () => {
    const middleware = createHttpAccessControlMiddleware({
        allowedIps: '192.168.1.0/24'
    });
    const result = invoke(middleware, '192.168.1.20');

    assert.strictEqual(result.nextCalls, 1);
});

test('IPv6 CIDR allowlist accepts a peer in the network', () => {
    const middleware = createHttpAccessControlMiddleware({
        allowedIps: '2001:db8::/32'
    });
    const result = invoke(middleware, '2001:db8::42');

    assert.strictEqual(result.nextCalls, 1);
});

test('IPv4-mapped IPv6 peers match IPv4 allowlist rules', () => {
    const middleware = createHttpAccessControlMiddleware({
        allowedIps: '192.168.1.0/24'
    });
    const result = invoke(middleware, '::ffff:192.168.1.20');

    assert.strictEqual(result.nextCalls, 1);
    assert.strictEqual(isIpAllowed('::ffff:192.168.1.20', '192.168.1.0/24'), true);
    assert.strictEqual(isIpAllowed('192.168.1.20', '::ffff:192.168.1.20'), true);
});

test('empty allowlist disables IP restriction', () => {
    const middleware = createHttpAccessControlMiddleware({ allowedIps: '' });
    const result = invoke(middleware, '203.0.113.10');

    assert.strictEqual(result.nextCalls, 1);
    assert.deepStrictEqual(parseAllowedIps(''), []);
});

test('parseAllowedIps splits comma-separated values and rejects invalid CIDR', () => {
    assert.deepStrictEqual(
        parseAllowedIps('127.0.0.1, 10.0.0.0/8,2001:db8::/32'),
        ['127.0.0.1', '10.0.0.0/8', '2001:db8::/32']
    );
    assert.throws(
        () => parseAllowedIps('10.0.0.0/99'),
        /parseAllowedIps: invalid CIDR/
    );
});

test('external listener requires a token while loopback listener does not', () => {
    assert.throws(
        () => assertExternalTokenConfigured('0.0.0.0', ''),
        /CODEXMATE_HTTP_TOKEN/
    );
    assert.doesNotThrow(() => assertExternalTokenConfigured('localhost', ''));
    assert.doesNotThrow(() => assertExternalTokenConfigured('127.0.0.1', ''));
    assert.doesNotThrow(() => assertExternalTokenConfigured('::1', ''));
    assert.strictEqual(isLoopbackHost('127.255.0.1'), true);
    assert.strictEqual(isLoopbackHost('192.168.1.1'), false);
});

test('requiresToken scopes the Bearer challenge to selected paths', () => {
    const middleware = createHttpAccessControlMiddleware({
        token: 'secret-token',
        requiresToken(req) {
            return req.url.startsWith('/bridge/');
        }
    });
    const publicPath = invoke(middleware, '192.168.1.20', undefined, '/');
    const bridgePath = invoke(middleware, '192.168.1.20', undefined, '/bridge/local/v1');

    assert.strictEqual(publicPath.nextCalls, 1);
    assert.strictEqual(publicPath.res.statusCode, 200);
    assert.strictEqual(bridgePath.res.statusCode, 401);
    assert.strictEqual(bridgePath.nextCalls, 0);
});

test('bypassLoopback exempts loopback peers from the Bearer challenge only', () => {
    const middleware = createHttpAccessControlMiddleware({
        token: 'secret-token',
        bypassLoopback: true
    });
    const loopback = invoke(middleware, '127.0.0.1');
    const remote = invoke(middleware, '192.168.1.20');

    assert.strictEqual(loopback.nextCalls, 1);
    assert.strictEqual(loopback.res.statusCode, 200);
    assert.strictEqual(remote.res.statusCode, 401);
    assert.strictEqual(remote.nextCalls, 0);
});

test('IP allowlist covers loopback peers when a list is configured', () => {
    const middleware = createHttpAccessControlMiddleware({
        allowedIps: '127.0.0.1,::1'
    });
    const ipv4Loopback = invoke(middleware, '127.0.0.1');
    const ipv6Loopback = invoke(middleware, '::1');
    const otherPeer = invoke(middleware, '192.168.1.20');

    assert.strictEqual(ipv4Loopback.nextCalls, 1);
    assert.strictEqual(ipv6Loopback.nextCalls, 1);
    assert.strictEqual(otherPeer.res.statusCode, 403);
    assert.strictEqual(otherPeer.nextCalls, 0);
});
