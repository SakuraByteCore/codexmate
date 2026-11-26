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
    const testRequests = [];
    const upstream = http.createServer((req, res) => {
        let text = '';
        req.on('data', chunk => { text += chunk; });
        req.on('end', () => {
            const payload = JSON.parse(text);
            calls.push(payload.model);
            testRequests.push({ headers: req.headers, payload });
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = payload.model === 'alpha-model' ? 503 : 200;
            res.end(JSON.stringify(res.statusCode === 503 ? { error: 'unavailable' }
                : req.url === '/v1/messages' ? { id: 'msg', type: 'message', model: payload.model, role: 'assistant', content: [{ type: 'text', text: 'ok' }], usage: {} }
                    : { id: 'resp', object: 'response', model: payload.model, output: [], output_text: '真实测试回复', status: 'completed' }));
        });
    });
    const upstreamPort = await listen(upstream);
    const reserve = http.createServer();
    const port = await listen(reserve);
    await new Promise(resolve => reserve.close(resolve));
    fs.mkdirSync(path.join(home, '.codex'));
    const configPath = path.join(home, '.codex', 'config.toml');
    fs.writeFileSync(configPath, `model_provider = "alpha"\nmodel = "original"\n[model_providers.alpha]\nbase_url = "http://127.0.0.1:${upstreamPort}/v1"\nexperimental_bearer_token = "test-secret-not-public"\n[model_providers.beta]\nbase_url = "http://127.0.0.1:${upstreamPort}/v1"\nhttp_headers = { User-Agent = "configured-codex/1" }\nenv_http_headers = { X-Test-Route = "MOCK_MODEL_TEST_HEADER" }\n`);
    const configBefore = fs.readFileSync(configPath, 'utf8');
    fs.writeFileSync(path.join(home, '.codex/codexmate-claude-bridge.json'), JSON.stringify({ providers: {
        alpha: { baseUrl: `http://127.0.0.1:${upstreamPort}`, model: 'alpha-model', apiKey: 'test-secret-not-public', targetApi: 'responses' },
        beta: { baseUrl: `http://127.0.0.1:${upstreamPort}`, model: 'beta-model', apiKey: 'test-secret-not-public', targetApi: 'responses' }
    } }));
    const output = fs.createWriteStream(path.join(home, 'server.log'));
    const child = spawn(process.execPath, [path.join(project, 'cli.js'), 'run'], {
        cwd: project,
        env: { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: '', CLAUDE_HOME: '', CLAUDE_CONFIG_DIR: '', XDG_CONFIG_HOME: '', PI_HOME: '',
            XDG_DATA_HOME: path.join(home, '.local/share'), CODEXMATE_PORT: String(port), CODEXMATE_NO_BROWSER: '1', CODEXMATE_HTTP_TOKEN: 'routing-test-token', MOCK_MODEL_TEST_HEADER: 'env-route' },
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
    await api('set-web-ui-preferences', { preferences: { theme: '  VIOLET  ', navigation: { mainTab: 'routing', configMode: 'codex', modelTestTarget: 'pi' } } });
    assert.equal((await api('get-web-ui-preferences')).preferences.navigation.mainTab, 'routing');
    assert.equal((await api('get-web-ui-preferences')).preferences.navigation.modelTestTarget, 'pi');
    assert.equal((await api('get-web-ui-preferences')).preferences.theme, 'violet');
    for (const [theme, expected] of [['ocean', 'ocean'], ['dark', 'dark'], ['light', 'light'], ['bogus', 'light']]) {
        await api('set-web-ui-preferences', { preferences: { theme } });
        assert.equal((await api('get-web-ui-preferences')).preferences.theme, expected);
        assert.equal((await api('get-web-ui-preferences')).preferences.navigation.modelTestTarget, 'pi');
    }
    state = await api('routing-bind', { target: 'codex', id: '', revision: state.revision });
    assert.equal(state.bindings.codex, '');
    state = await api('routing-delete', { id, revision: state.revision });
    assert.equal(state.groups.length, 0);
    assert.equal((await api('local-bridge-toggle', { enable: false })).success, true);
    assert.match(fs.readFileSync(configPath, 'utf8'), /model_provider = "alpha"/);
    fs.mkdirSync(path.join(home, '.pi/agent'), { recursive: true });
    const piPath = path.join(home, '.pi/agent/models.json');
    fs.writeFileSync(piPath, JSON.stringify({ providers: { saved: {
        api: 'openai-responses', baseUrl: `http://127.0.0.1:${upstreamPort}/v1`, apiKey: 'mock-pi-test-key', headers: { 'User-Agent': 'provider-pi/1' },
        models: [{ id: 'pi-model', headers: { 'user-agent': 'model-pi/2' }, maxTokens: 512 }]
    } } }));
    const snapshots = [fs.readFileSync(configPath, 'utf8'), fs.readFileSync(piPath, 'utf8'), fs.readFileSync(storage, 'utf8')];
    await api('set-tool-config-permission', { target: 'codex', allowWrite: false });
    await api('set-tool-config-permission', { target: 'pi', allowWrite: false });
    const catalog = await api('model-test-catalog');
    assert.ok(catalog.catalogs.codex.some(entry => entry.name === 'beta'));
    assert.deepEqual(catalog.catalogs.pi[0].models, ['pi-model']);
    assert.doesNotMatch(JSON.stringify(catalog), /test-secret-not-public|mock-pi-test-key/);
    const beforeCalls = calls.length;
    const live = await api('model-test-run', { target: 'codex', provider: 'beta', model: 'original', prompt: '手动输入的问题' });
    assert.equal(live.ok, true); assert.equal(live.text, '真实测试回复'); assert.ok(Number.isFinite(live.durationMs));
    const piLive = await api('model-test-run', { target: 'pi', provider: 'saved', model: 'pi-model', prompt: 'Pi 的问题' });
    assert.equal(piLive.ok, true); assert.equal(piLive.model, 'pi-model');
    assert.equal(testRequests.at(-2).headers['user-agent'], 'configured-codex/1');
    assert.equal(testRequests.at(-2).headers['x-test-route'], 'env-route');
    assert.equal(testRequests.at(-2).headers.originator, 'codex_cli_rs');
    assert.equal(testRequests.at(-1).headers['user-agent'], 'model-pi/2');
    assert.equal(testRequests.at(-1).payload.max_output_tokens, 512);
    assert.equal(testRequests.at(-1).payload.store, false);
    assert.equal(calls.length - beforeCalls, 2, 'real tests must make one upstream call each');
    assert.equal((await jsonRequest(port, '/api', { action: 'model-test-run' }, 'wrong-token')).status, 401);
    assert.equal((await api('model-test-run', { target: 'pi', provider: 'saved', model: 'missing', prompt: 'no' })).ok, false);
    assert.equal(fs.readFileSync(configPath, 'utf8'), snapshots[0]);
    assert.equal(fs.readFileSync(piPath, 'utf8'), snapshots[1]);
    assert.equal(fs.readFileSync(storage, 'utf8'), snapshots[2]);

});
