import assert from 'assert';
import { EventEmitter } from 'events';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createWebServerLifecycle } = require('../../lib/web-server.js');

function createLifecycle() {
    const server = new EventEmitter();
    const events = [];
    let closeCallback;
    let fallback;
    server.listen = (port, host, callback) => {
        server.listening = true;
        events.push([port, host]);
        callback();
    };
    server.close = callback => { closeCallback = callback; };
    const handle = createWebServerLifecycle({ server, host: '127.0.0.1', port: 3737, httpToken: 'unit-token', openBrowser: false }, {
        http: {}, spawn() { assert.fail('browser must stay closed'); }, process: { env: {} },
        console: { log() {}, warn() {}, error() {} },
        setTimeout(callback, ms) { fallback = callback; events.push(ms); },
        formatHostForUrl: host => host, DEFAULT_WEB_OPEN_HOST: '127.0.0.1', isAnyAddressHost: () => false,
        getUnattendedWorkflowRunner: () => ({ recover() { events.push('recover'); } })
    });
    return { server, handle, events, close: () => closeCallback(), expire: () => fallback() };
}

test('web lifecycle module imports without creating or listening on a server', () => {
    execFileSync(process.execPath, ['-e', "require('http').createServer = () => { throw new Error('unexpected server'); }; require('./lib/web-server.js');"], { cwd: process.cwd(), timeout: 1000 });
});

test('web lifecycle retains startup recovery and releases tracked connections on graceful stop', async () => {
    const lifecycle = createLifecycle();
    let destroyed = 0;
    const socket = new EventEmitter();
    socket.destroy = () => { destroyed += 1; };
    lifecycle.server.emit('connection', socket);
    const stopped = lifecycle.handle.stop();
    assert.deepStrictEqual(lifecycle.events, [[3737, '127.0.0.1'], 'recover', 800]);
    lifecycle.close();
    await stopped;
    assert.strictEqual(destroyed, 1);
    lifecycle.expire();
    assert.strictEqual(destroyed, 1);
});

test('web lifecycle force-stop releases live sockets when server close does not settle', async () => {
    const lifecycle = createLifecycle();
    let destroyed = 0;
    const socket = new EventEmitter();
    socket.destroy = () => { destroyed += 1; };
    lifecycle.server.emit('connection', socket);
    const stopped = lifecycle.handle.stop();
    lifecycle.expire();
    await stopped;
    assert.strictEqual(destroyed, 1);
});
