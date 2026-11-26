import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
async function listen(instance) {
    instance.listen(0, '127.0.0.1');
    await once(instance, 'listening');
    return instance.address().port;
}
function jsonRequest(port, pathname, payload, token = 'routing-test-token') {
    return new Promise((resolve, reject) => {
        const request = http.request({ hostname: '127.0.0.1', port, path: pathname, method: 'POST', headers: {
            'Content-Type': 'application/json', Authorization: `Bearer ${token}`
        } }, response => {
            let text = '';
            response.on('data', chunk => { text += chunk; });
            response.on('end', () => {
                try { resolve({ status: response.statusCode, value: JSON.parse(text) }); }
                catch (error) { reject(error); }
            });
        });
        request.setTimeout(2000, () => request.destroy(new Error('request timeout')));
        request.on('error', reject);
        request.end(JSON.stringify(payload));
    });
}
test('routing API enforces permissions, revisions, binding and live group failover in an isolated home', { timeout: 25000 }, async t => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'codexmate-routing-api-'));
    const calls = [];
    const upstream = http.createServer((req, res) => {
        let text = '';
        req.on('data', chunk => { text += chunk; });
        req.on('end', () => {
            const payload = JSON.parse(text);
            calls.push(payload.model);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = payload.model === 'alpha-model' ? 503 : 200;
            res.end(JSON.stringify(res.statusCode === 503 ? { error: 'unavailable' }
                : req.url === '/v1/messages' ? { id: 'msg', type: 'message', model: payload.model, role: 'assistant', content: [{ type: 'text', text: 'ok' }], usage: {} }
                    : { id: 'resp', object: 'response', model: payload.model, output: [], status: 'completed' }));
        });
    });
    const upstreamPort = await listen(upstream);
    const reserve = http.createServer();
    const port = await listen(reserve);
    await new Promise(resolve => reserve.close(resolve));
    fs.mkdirSync(path.join(home, '.codex'));
    const configPath = path.join(home, '.codex', 'config.toml');
    fs.writeFileSync(configPath, `model_provider = "alpha"\nmodel = "original"\n[model_providers.alpha]\nbase_url = "http://127.0.0.1:${upstreamPort}/v1"\nexperimental_bearer_token = "test-secret-not-public"\n[model_providers.beta]\nbase_url = "http://127.0.0.1:${upstreamPort}/v1"\n`);
    const configBefore = fs.readFileSync(configPath, 'utf8');
    fs.writeFileSync(path.join(home, '.codex/codexmate-claude-bridge.json'), JSON.stringify({ providers: {
        alpha: { baseUrl: `http://127.0.0.1:${upstreamPort}`, model: 'alpha-model', apiKey: 'test-secret-not-public', targetApi: 'responses' },
        beta: { baseUrl: `http://127.0.0.1:${upstreamPort}`, model: 'beta-model', apiKey: 'test-secret-not-public', targetApi: 'responses' }
    } }));
    const output = fs.createWriteStream(path.join(home, 'server.log'));
    const child = spawn(process.execPath, [path.join(project, 'cli.js'), 'run'], {
        cwd: project,
        env: { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: '', CLAUDE_HOME: '', CLAUDE_CONFIG_DIR: '', XDG_CONFIG_HOME: '', PI_HOME: '',
            XDG_DATA_HOME: path.join(home, '.local/share'), CODEXMATE_PORT: String(port), CODEXMATE_NO_BROWSER: '1', CODEXMATE_HTTP_TOKEN: 'routing-test-token' },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    child.stdout.pipe(output); child.stderr.pipe(output, { end: false });
    t.after(async () => {
        if (child.exitCode === null) {
            const closed = once(child, 'close'); child.kill('SIGTERM'); await closed;
        }
        await new Promise(resolve => upstream.close(resolve));
        output.end();
        fs.rmSync(home, { recursive: true, force: true });
    });
    const api = async (action, params = {}) => (await jsonRequest(port, '/api', { action, params })).value;
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
        if (child.exitCode !== null) throw new Error(fs.readFileSync(path.join(home, 'server.log'), 'utf8'));
        try { ready = (await api('health-check')).ok === true; } catch (_) { ready = false; }
        if (ready) break;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, 'server did not start');
    let state = await api('routing-get');
    assert.deepEqual(state.groups, []);
    assert.equal(JSON.stringify(state).includes('test-secret-not-public'), false);
    const storage = path.join(home, '.codexmate/routing-groups.json');
    assert.equal(fs.existsSync(storage), false, 'read created group storage');
    const draft = { name: 'Daily', target: 'codex', strategy: 'order', members: [{ provider: 'alpha', model: 'alpha-model' }, { provider: 'beta', model: 'beta-model' }] };
    await api('set-tool-config-permission', { target: 'codex', allowWrite: false });
    assert.equal((await api('routing-save', { ...draft, revision: state.revision })).errorCode, 'tool-config-write-disabled');
    assert.equal(fs.existsSync(storage), false, 'denied write created group storage');
    await api('set-tool-config-permission', { target: 'codex', allowWrite: true });
    state = await api('routing-save', { ...draft, revision: state.revision });
    assert.equal(state.success, true);
    assert.equal(fs.readFileSync(configPath, 'utf8'), configBefore, 'creating a group changed agent config');
    const id = state.groups[0].id;
    const staleRevision = state.revision;
    state = await api('routing-bind', { target: 'codex', id, revision: state.revision });
    assert.equal(state.bridges.codex.active, false, 'binding silently enabled the bridge');
    assert.equal((await api('routing-save', { ...draft, id, revision: staleRevision })).errorCode, 'routing-conflict');
    assert.equal((await api('routing-delete', { id, revision: state.revision })).errorCode, 'routing-in-use');
    assert.equal((await api('local-bridge-toggle', { enable: true })).success, true);
    const response = await jsonRequest(port, '/bridge/local/v1/responses', { model: 'original', input: 'hello' });
    assert.equal(response.status, 200);
    assert.deepEqual(calls, ['alpha-model', 'beta-model']);
    await api('set-tool-config-permission', { target: 'claude', allowWrite: true });
    state = await api('routing-save', { ...draft, target: 'claude', revision: state.revision });
    assert.equal(state.success, true);
    const claudeId = state.groups.find(group => group.target === 'claude').id;
    state = await api('routing-bind', { target: 'claude', id: claudeId, revision: state.revision });
    assert.equal((await api('claude-local-bridge-toggle', { enable: true })).success, true);
    const claudeResponse = await jsonRequest(port, '/bridge/claude-local/v1/messages', { model: 'original', max_tokens: 16, messages: [{ role: 'user', content: 'hello' }] });
    assert.equal(claudeResponse.status, 200);
    assert.equal(claudeResponse.value.type, 'message');
    assert.equal(claudeResponse.value.model, 'beta-model');
    assert.deepEqual(calls.slice(-2), ['alpha-model', 'beta-model']);
    state = await api('routing-bind', { target: 'claude', id: '', revision: state.revision });
    state = await api('routing-delete', { id: claudeId, revision: state.revision });
    assert.equal((await api('claude-local-bridge-toggle', { enable: false })).success, true);

    assert.equal((await jsonRequest(port, '/api', { action: 'routing-get' }, 'wrong-token')).status, 401);
    await api('set-web-ui-preferences', { preferences: { navigation: { mainTab: 'routing', configMode: 'codex' } } });
    assert.equal((await api('get-web-ui-preferences')).preferences.navigation.mainTab, 'routing');
    state = await api('routing-bind', { target: 'codex', id: '', revision: state.revision });
    assert.equal(state.bindings.codex, '');
    state = await api('routing-delete', { id, revision: state.revision });
    assert.equal(state.groups.length, 0);
    assert.equal((await api('local-bridge-toggle', { enable: false })).success, true);
    assert.match(fs.readFileSync(configPath, 'utf8'), /model_provider = "alpha"/);
});
