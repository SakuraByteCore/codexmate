const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { assert } = require('./helpers');

function encodeFrame(payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf-8');
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, 'utf-8');
    return Buffer.concat([header, body]);
}

function decodeFrames(stdoutBuffer) {
    const messages = [];
    let offset = 0;

    while (offset < stdoutBuffer.length) {
        const headerEnd = stdoutBuffer.indexOf('\r\n\r\n', offset, 'utf-8');
        assert(headerEnd >= 0, 'mcp stdout contains an incomplete frame header');

        const headerText = stdoutBuffer.slice(offset, headerEnd).toString('utf-8');
        let contentLength = -1;
        for (const line of headerText.split('\r\n')) {
            const idx = line.indexOf(':');
            if (idx <= 0) continue;
            const key = line.slice(0, idx).trim().toLowerCase();
            if (key !== 'content-length') continue;
            contentLength = Number.parseInt(line.slice(idx + 1).trim(), 10);
            break;
        }
        assert(Number.isFinite(contentLength) && contentLength >= 0, 'invalid content-length in mcp response');

        const bodyStart = headerEnd + 4;
        const bodyEnd = bodyStart + contentLength;
        assert(bodyEnd <= stdoutBuffer.length, 'mcp stdout contains an incomplete frame body');

        const bodyText = stdoutBuffer.slice(bodyStart, bodyEnd).toString('utf-8');
        let payload = null;
        try {
            payload = JSON.parse(bodyText);
        } catch (error) {
            throw new Error(`invalid mcp json payload: ${error.message || error}`);
        }
        messages.push(payload);
        offset = bodyEnd;
    }

    return messages;
}

function runMcpExchange(node, cliPath, env, args, requests) {
    const input = Buffer.concat((requests || []).map(encodeFrame));
    const result = spawnSync(node, [cliPath, 'mcp', 'serve', ...(args || [])], {
        env,
        input,
        encoding: 'buffer',
        maxBuffer: 5 * 1024 * 1024
    });

    if (result.error) {
        throw result.error;
    }

    const stderrText = Buffer.isBuffer(result.stderr)
        ? result.stderr.toString('utf-8')
        : String(result.stderr || '');
    assert(result.status === 0, `mcp command failed (${result.status}): ${stderrText}`);

    const stdoutBuffer = Buffer.isBuffer(result.stdout)
        ? result.stdout
        : Buffer.from(result.stdout || '', 'utf-8');
    assert(stdoutBuffer.length > 0, 'mcp command produced empty stdout');

    return decodeFrames(stdoutBuffer);
}

module.exports = async function testMcp(ctx) {
    const { env, node, cliPath, api, longSessionId, longMessageCount, tmpHome } = ctx;

    const readOnlyRequests = [
        { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
        { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
        { jsonrpc: '2.0', id: 3, method: 'resources/read', params: { uri: 'codexmate://sessions?source=all' } },
        {
            jsonrpc: '2.0',
            id: 4,
            method: 'tools/call',
            params: {
                name: 'codexmate.session.list',
                arguments: { source: 'CODEX', forceRefresh: true, limit: 100 }
            }
        },
        {
            jsonrpc: '2.0',
            id: 5,
            method: 'tools/call',
            params: {
                name: 'codexmate.claude.settings.get',
                arguments: {}
            }
        },
        {
            jsonrpc: '2.0',
            id: 6,
            method: 'resources/read',
            params: { uri: 'codexmate://workflows' }
        },
        {
            jsonrpc: '2.0',
            id: 7,
            method: 'tools/call',
            params: {
                name: 'codexmate.workflow.list',
                arguments: {}
            }
        },
        {
            jsonrpc: '2.0',
            id: 8,
            method: 'tools/call',
            params: {
                name: 'codexmate.workflow.run',
                arguments: {
                    id: 'diagnose-config',
                    input: {}
                }
            }
        },
        {
            jsonrpc: '2.0',
            id: 9,
            method: 'tools/call',
            params: {
                name: 'codexmate.workflow.run',
                arguments: {
                    id: 'safe-provider-switch',
                    input: {
                        provider: 'e2e',
                        apply: true
                    }
                }
            }
        },
        {
            jsonrpc: '2.0',
            id: 10,
            method: 'resources/read',
            params: { uri: 'codexmate://workflow-runs?limit=5' }
        }
    ];
    const readOnlyResponses = runMcpExchange(node, cliPath, env, ['--read-only'], readOnlyRequests);
    const readOnlyById = new Map(readOnlyResponses.map((item) => [item.id, item]));

    assert(readOnlyById.has(1), 'mcp initialize response missing');
    assert(readOnlyById.has(2), 'mcp tools/list response missing');
    assert(readOnlyById.has(3), 'mcp resources/read response missing');
    assert(readOnlyById.has(4), 'mcp session.list response missing');
    assert(readOnlyById.has(5), 'mcp claude.settings.get response missing');
    assert(readOnlyById.has(6), 'mcp workflows resource response missing');
    assert(readOnlyById.has(7), 'mcp workflow.list response missing');
    assert(readOnlyById.has(8), 'mcp workflow.run diagnose-config response missing');
    assert(readOnlyById.has(9), 'mcp workflow.run write-guard response missing');
    assert(readOnlyById.has(10), 'mcp workflow-runs resource response missing');

    const initResult = readOnlyById.get(1).result || {};
    assert(initResult.protocolVersion === '2025-11-25', 'mcp protocol version mismatch');

    const tools = Array.isArray((readOnlyById.get(2).result || {}).tools)
        ? readOnlyById.get(2).result.tools
        : [];
    const toolNames = new Set(tools.map((item) => item && item.name).filter(Boolean));
    assert(toolNames.has('codexmate.status.get'), 'mcp read-only tools missing codexmate.status.get');
    assert(!toolNames.has('codexmate.provider.add'), 'mcp read-only tools should not expose write tool');
    assert(toolNames.has('codexmate.workflow.list'), 'mcp read-only tools missing codexmate.workflow.list');
    assert(toolNames.has('codexmate.workflow.get'), 'mcp read-only tools missing codexmate.workflow.get');
    assert(toolNames.has('codexmate.workflow.validate'), 'mcp read-only tools missing codexmate.workflow.validate');
    assert(toolNames.has('codexmate.workflow.run'), 'mcp read-only tools missing codexmate.workflow.run');
    assert(toolNames.has('codexmate.memory.search'), 'mcp read-only tools missing codexmate.memory.search');
    assert(toolNames.has('codexmate.memory.list'), 'mcp read-only tools missing codexmate.memory.list');
    assert(!toolNames.has('codexmate.memory.save'), 'mcp read-only tools should not expose codexmate.memory.save');
    assert(!toolNames.has('codexmate.memory.update'), 'mcp read-only tools should not expose codexmate.memory.update');
    assert(!toolNames.has('codexmate.memory.delete'), 'mcp read-only tools should not expose codexmate.memory.delete');

    const sessionResource = readOnlyById.get(3).result || {};
    assert(Array.isArray(sessionResource.contents), 'mcp resources/read should return contents');
    const sessionResourcePayload = JSON.parse((sessionResource.contents[0] || {}).text || '{}');
    assert(Array.isArray(sessionResourcePayload.sessions), 'mcp sessions resource should contain sessions array');
    const workflowResource = readOnlyById.get(6).result || {};
    assert(Array.isArray(workflowResource.contents), 'mcp workflows resource should return contents');
    const workflowResourcePayload = JSON.parse((workflowResource.contents[0] || {}).text || '{}');
    assert(Array.isArray(workflowResourcePayload.workflows), 'mcp workflows resource should contain workflows');
    assert(
        workflowResourcePayload.workflows.some((item) => item && item.id === 'diagnose-config'),
        'mcp workflows resource should include diagnose-config'
    );

    const sessionListPayload = ((readOnlyById.get(4).result || {}).structuredContent) || {};
    assert(sessionListPayload.source === 'codex', 'mcp session.list should normalize source to codex');
    assert(Array.isArray(sessionListPayload.sessions), 'mcp session.list should return sessions');
    assert(sessionListPayload.sessions.length > 0, 'mcp session.list should return codex sessions');
    assert(
        sessionListPayload.sessions.every((item) => item && item.source === 'codex'),
        'mcp session.list should not include claude sessions when source=CODEX'
    );

    const httpCodexSessions = await api('list-sessions', { source: 'codex', forceRefresh: true, limit: 100 });
    const httpCodexByKey = new Map((httpCodexSessions.sessions || []).map((item) => [
        `${item.source}:${item.sessionId}:${item.filePath}`,
        item
    ]));
    for (const item of sessionListPayload.sessions) {
        const key = `${item.source}:${item.sessionId}:${item.filePath}`;
        const httpItem = httpCodexByKey.get(key);
        assert(httpItem, `http list-sessions missing MCP codex session ${key}`);
        assert(item.messageCount === httpItem.messageCount, `mcp session.list messageCount drifted for ${item.sessionId}`);
    }
    const mcpLongSession = sessionListPayload.sessions.find((item) => item && item.sessionId === longSessionId);
    assert(mcpLongSession && Number.isFinite(mcpLongSession.messageCount), 'mcp session.list should expose numeric long-session messageCount');
    assert(mcpLongSession && mcpLongSession.messageCount >= 0, 'mcp session.list should expose non-negative long-session messageCount');

    const httpAllSessions = await api('list-sessions', { source: 'all', forceRefresh: true, limit: sessionResourcePayload.sessions.length || 120 });
    const httpAllByKey = new Map((httpAllSessions.sessions || []).map((item) => [
        `${item.source}:${item.sessionId}:${item.filePath}`,
        item
    ]));
    for (const item of sessionResourcePayload.sessions) {
        const key = `${item.source}:${item.sessionId}:${item.filePath}`;
        const httpItem = httpAllByKey.get(key);
        assert(httpItem, `http list-sessions missing MCP resource session ${key}`);
        assert(item.messageCount === httpItem.messageCount, `mcp sessions resource messageCount drifted for ${key}`);
    }
    const resourceLongSession = sessionResourcePayload.sessions.find((item) => item && item.sessionId === longSessionId);
    assert(resourceLongSession && Number.isFinite(resourceLongSession.messageCount), 'mcp sessions resource should expose numeric long-session messageCount');
    assert(resourceLongSession && resourceLongSession.messageCount >= 0, 'mcp sessions resource should expose non-negative long-session messageCount');

    const claudeSettingsPayload = ((readOnlyById.get(5).result || {}).structuredContent) || {};
    assert(claudeSettingsPayload.redacted === true, 'mcp claude.settings.get should mark payload as redacted');
    assert(claudeSettingsPayload.apiKey !== 'sk-claude', 'mcp claude.settings.get should not return plain api key');
    assert(
        typeof claudeSettingsPayload.apiKey === 'string' && !claudeSettingsPayload.apiKey.includes('sk-claude'),
        'mcp claude.settings.get apiKey should be masked'
    );
    assert(
        typeof ((claudeSettingsPayload.env || {}).ANTHROPIC_API_KEY) === 'string'
            && !String((claudeSettingsPayload.env || {}).ANTHROPIC_API_KEY).includes('sk-claude'),
        'mcp claude.settings.get env.ANTHROPIC_API_KEY should be masked'
    );

    const workflowListPayload = ((readOnlyById.get(7).result || {}).structuredContent) || {};
    assert(Array.isArray(workflowListPayload.workflows), 'mcp workflow.list should return workflows array');
    assert(
        workflowListPayload.workflows.some((item) => item && item.id === 'safe-provider-switch'),
        'mcp workflow.list should include safe-provider-switch'
    );

    const workflowRunPayload = ((readOnlyById.get(8).result || {}).structuredContent) || {};
    assert(workflowRunPayload.success === true, 'mcp workflow.run diagnose-config should succeed');
    assert(Array.isArray(workflowRunPayload.steps), 'mcp workflow.run should include steps');
    assert(workflowRunPayload.steps.length >= 3, 'mcp workflow.run diagnose-config should execute builtin steps');

    const workflowWriteBlockedPayload = ((readOnlyById.get(9).result || {}).structuredContent) || {};
    assert(workflowWriteBlockedPayload.success === false, 'mcp workflow.run should block write step in read-only mode');
    assert(
        typeof workflowWriteBlockedPayload.error === 'string'
            && workflowWriteBlockedPayload.error.includes('allowWrite'),
        'mcp workflow.run should include allowWrite guard error in read-only mode'
    );

    const workflowRunsResource = readOnlyById.get(10).result || {};
    assert(Array.isArray(workflowRunsResource.contents), 'mcp workflow-runs resource should return contents');
    const workflowRunsPayload = JSON.parse((workflowRunsResource.contents[0] || {}).text || '{}');
    assert(Array.isArray(workflowRunsPayload.runs), 'mcp workflow-runs resource should contain runs array');
    assert(workflowRunsPayload.runs.length > 0, 'mcp workflow-runs resource should include run records');

    const mcpSessionsDir = path.join(tmpHome, '.codex', 'sessions');
    fs.mkdirSync(mcpSessionsDir, { recursive: true });
    const mcpTrashSessionId = 'mcp-trash-file-alias-e2e';
    const mcpTrashSessionPath = path.join(mcpSessionsDir, `${mcpTrashSessionId}.jsonl`);
    fs.writeFileSync(mcpTrashSessionPath, [
        JSON.stringify({
            type: 'session_meta',
            payload: { id: mcpTrashSessionId, cwd: '/tmp/mcp-trash-file-alias' },
            timestamp: '2025-03-30T00:00:00.000Z'
        }),
        JSON.stringify({
            type: 'response_item',
            payload: { type: 'message', role: 'user', content: 'trash me through mcp file alias' },
            timestamp: '2025-03-30T00:00:01.000Z'
        })
    ].join('\n') + '\n', 'utf-8');

    const mcpDeleteSessionId = 'mcp-delete-file-alias-e2e';
    const mcpDeleteSessionPath = path.join(mcpSessionsDir, `${mcpDeleteSessionId}.jsonl`);
    fs.writeFileSync(mcpDeleteSessionPath, [
        JSON.stringify({
            type: 'session_meta',
            payload: { id: mcpDeleteSessionId, cwd: '/tmp/mcp-delete-file-alias' },
            timestamp: '2025-03-30T00:00:00.000Z'
        }),
        JSON.stringify({
            type: 'response_item',
            payload: { type: 'message', role: 'user', content: 'delete me through mcp file alias' },
            timestamp: '2025-03-30T00:00:01.000Z'
        })
    ].join('\n') + '\n', 'utf-8');

    const e2eCodexmateDir = path.join(process.cwd(), '.codexmate');
    try { fs.rmSync(e2eCodexmateDir, { recursive: true, force: true }); } catch (_) {}

    const writeEnabledRequests = [
        { jsonrpc: '2.0', id: 11, method: 'initialize', params: {} },
        { jsonrpc: '2.0', id: 12, method: 'tools/list', params: {} },
        {
            jsonrpc: '2.0',
            id: 13,
            method: 'tools/call',
            params: {
                name: 'codexmate.session.trash',
                arguments: {
                    source: 'codex',
                    file: mcpTrashSessionPath
                }
            }
        },
        {
            jsonrpc: '2.0',
            id: 14,
            method: 'tools/call',
            params: {
                name: 'codexmate.session.delete',
                arguments: {
                    source: 'codex',
                    file: mcpDeleteSessionPath
                }
            }
        },
        {
            jsonrpc: '2.0',
            id: 15,
            method: 'tools/call',
            params: {
                name: 'codexmate.memory.save',
                arguments: {
                    summary: 'JWT refresh token race condition',
                    content: 'Added mutex to refresh flow in src/auth/refresh.ts',
                    tags: ['auth', 'jwt', 'bug-fix'],
                    sourceSession: 'test-session-001'
                }
            }
        },
        {
            jsonrpc: '2.0',
            id: 16,
            method: 'tools/call',
            params: {
                name: 'codexmate.memory.save',
                arguments: {
                    summary: 'API rate limiting strategy',
                    content: 'Use sliding window with Redis sorted sets',
                    tags: ['api', 'performance']
                }
            }
        },
        {
            jsonrpc: '2.0',
            id: 17,
            method: 'tools/call',
            params: {
                name: 'codexmate.memory.search',
                arguments: {
                    query: 'jwt race'
                }
            }
        },
        {
            jsonrpc: '2.0',
            id: 18,
            method: 'tools/call',
            params: {
                name: 'codexmate.memory.list',
                arguments: {}
            }
        },
        {
            jsonrpc: '2.0',
            id: 19,
            method: 'tools/call',
            params: {
                name: 'codexmate.memory.update',
                arguments: {
                    id: 'mem_nonexistent_000000',
                    summary: 'should fail'
                }
            }
        },
        {
            jsonrpc: '2.0',
            id: 20,
            method: 'tools/call',
            params: {
                name: 'codexmate.memory.delete',
                arguments: {
                    id: 'mem_nonexistent_000000'
                }
            }
        }
    ];
    const writeEnabledResponses = runMcpExchange(node, cliPath, {
        ...env,
        CODEXMATE_MCP_ALLOW_WRITE: '1'
    }, [], writeEnabledRequests);
    const writeById = new Map(writeEnabledResponses.map((item) => [item.id, item]));
    const writeTools = Array.isArray((writeById.get(12).result || {}).tools)
        ? writeById.get(12).result.tools
        : [];
    const writeToolNames = new Set(writeTools.map((item) => item && item.name).filter(Boolean));
    assert(writeToolNames.has('codexmate.provider.add'), 'mcp write mode should expose codexmate.provider.add');

    const sessionTrashTool = writeTools.find((item) => item && item.name === 'codexmate.session.trash');
    assert(sessionTrashTool, 'mcp write mode should expose codexmate.session.trash');
    const sessionTrashProperties = ((sessionTrashTool || {}).inputSchema || {}).properties || {};
    assert(sessionTrashProperties.filePath, 'codexmate.session.trash should expose filePath in schema');
    assert(sessionTrashProperties.file, 'codexmate.session.trash should keep file alias in schema');
    assert(!sessionTrashProperties.recordLineIndex, 'codexmate.session.trash should not expose recordLineIndex');
    assert(!sessionTrashProperties.recordLineIndices, 'codexmate.session.trash should not expose recordLineIndices');

    const sessionDeleteTool = writeTools.find((item) => item && item.name === 'codexmate.session.delete');
    assert(sessionDeleteTool, 'mcp write mode should expose codexmate.session.delete');
    const sessionDeleteProperties = ((sessionDeleteTool || {}).inputSchema || {}).properties || {};
    assert(sessionDeleteProperties.filePath, 'codexmate.session.delete should expose filePath in schema');
    assert(sessionDeleteProperties.file, 'codexmate.session.delete should keep file alias in schema');
    assert(!sessionDeleteProperties.recordLineIndex, 'codexmate.session.delete should not expose recordLineIndex');
    assert(!sessionDeleteProperties.recordLineIndices, 'codexmate.session.delete should not expose recordLineIndices');

    const mcpTrashPayload = ((writeById.get(13).result || {}).structuredContent) || {};
    assert(mcpTrashPayload.success === true, 'mcp session.trash should accept file alias');
    assert(mcpTrashPayload.trashed === true, 'mcp session.trash should move the whole session into trash');
    assert(mcpTrashPayload.filePath === mcpTrashSessionPath, 'mcp session.trash should return the resolved filePath');
    assert(typeof mcpTrashPayload.trashId === 'string' && mcpTrashPayload.trashId, 'mcp session.trash should return trashId');
    assert(!fs.existsSync(mcpTrashSessionPath), 'mcp session.trash should move the source file out of the sessions directory');

    const trashList = await api('list-session-trash', { limit: 100, forceRefresh: true });
    const mcpTrashItem = (trashList.items || []).find((item) => item && item.trashId === mcpTrashPayload.trashId);
    assert(mcpTrashItem && mcpTrashItem.sessionId === mcpTrashSessionId, 'mcp session.trash should create a visible trash entry');

    const purgeTrashResult = await api('purge-session-trash', { trashId: mcpTrashPayload.trashId });
    assert(purgeTrashResult.success === true, 'mcp-created trash entry should be purgeable');

    const mcpDeletePayload = ((writeById.get(14).result || {}).structuredContent) || {};
    assert(mcpDeletePayload.success === true, 'mcp session.delete should accept file alias');
    assert(mcpDeletePayload.deleted === true, 'mcp session.delete should keep permanent delete semantics');
    assert(mcpDeletePayload.filePath === mcpDeleteSessionPath, 'mcp session.delete should return the resolved filePath');
    assert(!fs.existsSync(mcpDeleteSessionPath), 'mcp session.delete should remove the source file');

    const deleteTrashList = await api('list-session-trash', { limit: 100, forceRefresh: true });
    const deleteTrashItem = (deleteTrashList.items || []).find((item) => item && (
        item.originalFilePath === mcpDeleteSessionPath ||
        item.filePath === mcpDeleteSessionPath ||
        item.sessionId === mcpDeleteSessionId
    ));
    assert(!deleteTrashItem, 'mcp session.delete should not create a trash entry');

    assert(writeToolNames.has('codexmate.memory.save'), 'mcp write mode should expose codexmate.memory.save');
    assert(writeToolNames.has('codexmate.memory.update'), 'mcp write mode should expose codexmate.memory.update');
    assert(writeToolNames.has('codexmate.memory.delete'), 'mcp write mode should expose codexmate.memory.delete');

    const memSave1 = ((writeById.get(15).result || {}).structuredContent) || {};
    assert(memSave1.success === true, 'mcp memory.save first entry should succeed');
    assert(typeof (memSave1.memory || {}).id === 'string', 'mcp memory.save should return memory id');
    assert((memSave1.memory || {}).summary === 'JWT refresh token race condition', 'mcp memory.save should return summary');
    assert(JSON.stringify((memSave1.memory || {}).tags) === JSON.stringify(['auth', 'jwt', 'bug-fix']), 'mcp memory.save should return tags');

    const memSave2 = ((writeById.get(16).result || {}).structuredContent) || {};
    assert(memSave2.success === true, 'mcp memory.save second entry should succeed');

    const memSearch = ((writeById.get(17).result || {}).structuredContent) || {};
    assert(memSearch.count === 1, 'mcp memory.search should find one match');
    assert((memSearch.memories || [])[0] && (memSearch.memories || [])[0].summary === 'JWT refresh token race condition', 'mcp memory.search should return matching entry');

    const memList = ((writeById.get(18).result || {}).structuredContent) || {};
    assert(memList.total === 2, 'mcp memory.list should return both entries');
    assert(Array.isArray(memList.memories) && memList.memories.length === 2, 'mcp memory.list should include 2 items');

    const memUpdateBad = ((writeById.get(19).result || {}).structuredContent) || {};
    assert(typeof memUpdateBad.error === 'string' && memUpdateBad.error.includes('not found'), 'mcp memory.update should error on nonexistent id');

    const memDeleteBad = ((writeById.get(20).result || {}).structuredContent) || {};
    assert(typeof memDeleteBad.error === 'string' && memDeleteBad.error.includes('not found'), 'mcp memory.delete should error on nonexistent id');

    const savedMemoryId = (memSave1.memory || {}).id;
    const memoryUpdateDeleteRequests = [
        { jsonrpc: '2.0', id: 21, method: 'initialize', params: {} },
        {
            jsonrpc: '2.0',
            id: 22,
            method: 'tools/call',
            params: {
                name: 'codexmate.memory.update',
                arguments: {
                    id: savedMemoryId,
                    summary: 'JWT refresh token race condition (fixed)',
                    tags: ['auth', 'jwt', 'resolved']
                }
            }
        },
        {
            jsonrpc: '2.0',
            id: 23,
            method: 'tools/call',
            params: {
                name: 'codexmate.memory.delete',
                arguments: {
                    id: (memSave2.memory || {}).id
                }
            }
        },
        {
            jsonrpc: '2.0',
            id: 24,
            method: 'tools/call',
            params: {
                name: 'codexmate.memory.search',
                arguments: {
                    query: 'api rate limiting'
                }
            }
        }
    ];
    const memUpdateDeleteResponses = runMcpExchange(node, cliPath, {
        ...env,
        CODEXMATE_MCP_ALLOW_WRITE: '1'
    }, [], memoryUpdateDeleteRequests);
    const udById = new Map(memUpdateDeleteResponses.map((item) => [item.id, item]));

    const memUpdated = ((udById.get(22).result || {}).structuredContent) || {};
    assert(memUpdated.success === true, 'mcp memory.update should succeed');
    assert((memUpdated.memory || {}).summary === 'JWT refresh token race condition (fixed)', 'mcp memory.update should reflect new summary');
    assert(JSON.stringify((memUpdated.memory || {}).tags) === JSON.stringify(['auth', 'jwt', 'resolved']), 'mcp memory.update should reflect new tags');

    const memDeleted = ((udById.get(23).result || {}).structuredContent) || {};
    assert(memDeleted.success === true, 'mcp memory.delete should succeed');

    const memSearchAfterDelete = ((udById.get(24).result || {}).structuredContent) || {};
    assert(memSearchAfterDelete.count === 0, 'mcp memory.search should find nothing after delete');
};
