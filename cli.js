#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const toml = require('@iarna/toml');
const JSON5 = require('json5');
const zipLib = require('zip-lib');
const yauzl = require('yauzl');
const { exec, execSync, execFileSync, spawn, spawnSync } = require('child_process');
const http = require('http');
const https = require('https');
const net = require('net');
const readline = require('readline');
const {
    expandHomePath,
    resolveExistingDir,
    resolveHomePath,
    hasUtf8Bom,
    stripUtf8Bom,
    ensureUtf8Bom,
    detectLineEnding,
    normalizeLineEnding,
    isValidProviderName,
    escapeTomlBasicString,
    buildModelProviderTableHeader,
    buildModelsCandidates,
    isValidHttpUrl,
    normalizeBaseUrl,
    joinApiUrl
} = require('./lib/cli-utils');
const {
    ensureDir,
    readJsonFile,
    readJsonArrayFile,
    readJsonObjectFromFile,
    backupFileIfNeededOnce,
    writeJsonAtomic,
    formatTimestampForFileName
} = require('./lib/cli-file-utils');
const { buildLineDiff } = require('./lib/text-diff');
const {
    extractModelNames,
    hasModelsListPayload,
    buildModelsCacheKey,
    buildApiProbeUrlCandidates,
    buildModelProbeSpec,
    buildModelProbeSpecs,
    extractModelResponseText,
    normalizeWireApi,
    getSupplementalModelsForBaseUrl,
    mergeModelCatalog
} = require('./lib/cli-models-utils');
const {
    probeUrl,
    probeJsonPost
} = require('./lib/cli-network-utils');
const {
    toIsoTime,
    updateLatestIso,
    truncateText,
    extractMessageText,
    normalizeRole,
    parseMaxMessagesValue,
    resolveMaxMessagesValue
} = require('./lib/cli-session-utils');
const { createMcpStdioServer } = require('./lib/mcp-stdio');
const {
    validateWorkflowDefinition,
    executeWorkflowDefinition
} = require('./lib/workflow-engine');
const {
    ALLOWED_EVENTS: WEBHOOK_ALLOWED_EVENTS,
    defaultConfigPath: defaultWebhookConfigPath,
    loadWebhookConfig,
    saveWebhookConfig,
    notifyWebhook
} = require('./lib/cli-webhook');
const { buildConfigHealthReport: buildConfigHealthReportCore, buildAllProvidersHealthReport: buildAllProvidersHealthReportCore } = require('./cli/config-health');
const { buildDoctorReport, buildDoctorLegacyPayload, renderDoctorMarkdown } = require('./cli/doctor-core');
const {
    createAuthProfileController
} = require('./cli/auth-profiles');
const {
    createBuiltinProxyRuntimeController
} = require('./cli/builtin-proxy');
const {
    createBuiltinClaudeProxyRuntimeController
} = require('./cli/claude-proxy');
const {
    createOpenaiBridgeHttpHandler,
    upsertOpenaiBridgeProvider,
    readOpenaiBridgeSettings,
    resolveOpenaiBridgeUpstream
} = require('./cli/openai-bridge');
const {
    createLocalBridgeHttpHandler
} = require('./cli/local-bridge');
const {
    createOpenclawConfigController
} = require('./cli/openclaw-config');
const {
    createConfigBootstrapController
} = require('./cli/config-bootstrap');
const {
    createAgentsFileController
} = require('./cli/agents-files');
const {
    createSystemPromptFileController
} = require('./cli/system-prompt-files');
const {
    createPromptHistoryController
} = require('./cli/prompt-history');
const {
    createArchiveHelperController
} = require('./cli/archive-helpers');
const {
    createZipCommandController
} = require('./cli/zip-commands');
const { cmdConvertSession } = require('./cli/session-convert');
const {
    getCodexSkillsDir,
    getClaudeSkillsDir,
    normalizeSkillTargetApp,
    getSkillTargetByApp,
    resolveSkillTarget,
    listSkills,
    listCodexSkills,
    scanUnmanagedSkills,
    scanUnmanagedCodexSkills,
    importSkills,
    importCodexSkills,
    importSkillsFromZipFile,
    importCodexSkillsFromZipFile,
    importSkillsFromZip,
    importCodexSkillsFromZip,
    exportSkills,
    exportCodexSkills,
    deleteSkills,
    deleteCodexSkills
} = require('./cli/skills');
const { cmdImportSkills: cmdImportSkillsFromUrl } = require('./cli/import-skills-url');
const { cmdToolUpdate, fetchLatestVersionStatus } = require('./cli/update');
const {
    getFileStatSafe,
    isBootstrapLikeText,
    removeLeadingSystemMessage,
    normalizeQueryTokens,
    expandSessionQueryTokens,
    matchTokensInText,
    extractMessageFromRecord,
    appendSessionDetailTailMessage,
    applySessionDetailRecordMetadata,
    extractSessionDetailPreviewFromTailText,
    extractSessionDetailPreviewFromFileFast
} = require('./lib/cli-sessions');
const { listSessionUsageCore, exportSessionUsageCore } = require('./cli/session-usage');
const { parseAnalyticsExportArgs } = require('./cli/analytics-export-args');
const {
    readBundledWebUiCss,
    readBundledWebUiHtml,
    readExecutableBundledJavaScriptModule,
    readExecutableBundledWebUiScript
} = require('./web-ui/source-bundle.cjs');
const {
    registerDownloadArtifact,
    resolveDownloadArtifact
} = require('./lib/download-artifacts');

const DEFAULT_WEB_PORT = 3737;
const DEFAULT_WEB_HOST = '127.0.0.1';
const DEFAULT_WEB_OPEN_HOST = '127.0.0.1';

// ============================================================================
// 配置
// ============================================================================
const CONFIG_DIR = path.join(os.homedir(), '.codex');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.toml');
const AUTH_FILE = path.join(CONFIG_DIR, 'auth.json');
const OPENCODE_CONFIG_DIR = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'opencode');
const KILOCODE_CONFIG_DIR = path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'kilo');
const KILOCODE_GLOBAL_JSONC_CONFIG_FILE = path.join(KILOCODE_CONFIG_DIR, 'kilo.jsonc');
const KILOCODE_GLOBAL_JSON_CONFIG_FILE = path.join(KILOCODE_CONFIG_DIR, 'kilo.json');
const OPENCODE_CONFIG_ENV_FILE = process.env.OPENCODE_CONFIG ? path.resolve(process.env.OPENCODE_CONFIG) : '';
const OPENCODE_GLOBAL_JSONC_CONFIG_FILE = path.join(OPENCODE_CONFIG_DIR, 'opencode.jsonc');
const OPENCODE_GLOBAL_JSON_CONFIG_FILE = path.join(OPENCODE_CONFIG_DIR, 'opencode.json');
const OPENCODE_LEGACY_CONFIG_FILE = path.join(OPENCODE_CONFIG_DIR, 'config.json');
const AUTH_PROFILES_DIR = path.join(CONFIG_DIR, 'auth-profiles');
const AUTH_REGISTRY_FILE = path.join(AUTH_PROFILES_DIR, 'registry.json');
const MODELS_FILE = path.join(CONFIG_DIR, 'models.json');
const CURRENT_MODELS_FILE = path.join(CONFIG_DIR, 'provider-current-models.json');
const INIT_MARK_FILE = path.join(CONFIG_DIR, 'codexmate-init.json');
const BUILTIN_PROXY_SETTINGS_FILE = path.join(CONFIG_DIR, 'codexmate-proxy.json');
const BUILTIN_CLAUDE_PROXY_SETTINGS_FILE = path.join(CONFIG_DIR, 'codexmate-claude-proxy.json');
const OPENAI_BRIDGE_SETTINGS_FILE = path.join(CONFIG_DIR, 'codexmate-openai-bridge.json');
const LOCAL_BRIDGE_SETTINGS_FILE = path.join(CONFIG_DIR, 'codexmate-local-bridge.json');
const CLAUDE_LOCAL_BRIDGE_SETTINGS_FILE = path.join(CONFIG_DIR, 'codexmate-claude-local-bridge.json');
const CLAUDE_LOCAL_PROVIDERS_FILE = path.join(CONFIG_DIR, 'codexmate-claude-bridge.json');
const CODEX_SESSIONS_DIR = path.join(CONFIG_DIR, 'sessions');
const SESSION_TRASH_DIR = path.join(CONFIG_DIR, 'codexmate-session-trash');
const SESSION_TRASH_FILES_DIR = path.join(SESSION_TRASH_DIR, 'files');
const SESSION_TRASH_INDEX_FILE = path.join(SESSION_TRASH_DIR, 'index.json');
const OPENCLAW_DIR = path.join(os.homedir(), '.openclaw');
const OPENCLAW_CONFIG_FILE = path.join(OPENCLAW_DIR, 'openclaw.json');
const OPENCLAW_WORKSPACE_DIR = path.join(OPENCLAW_DIR, 'workspace');
const OPENCLAW_DEFAULT_AGENT_ID = 'main';
const OPENCLAW_AUTH_PROFILES_FILE_NAME = 'auth-profiles.json';
const OPENCLAW_AUTH_STATE_FILE_NAME = 'auth-state.json';
const CLAUDE_DIR = path.join(os.homedir(), '.claude');
const CLAUDE_SETTINGS_FILE = path.join(CLAUDE_DIR, 'settings.json');
const CLAUDE_MD_FILE_NAME = 'CLAUDE.md';
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const CODEBUDDY_DIR = path.join(os.homedir(), '.codebuddy');
const CODEBUDDY_PROJECTS_DIR = path.join(CODEBUDDY_DIR, 'projects');
const CODEXMATE_DIR = path.join(os.homedir(), '.codexmate');
const PROVIDER_CACHE_FILE_GROUPS = Object.freeze({
    claude: [
        'claude-providers.json'
    ],
    codex: [
        'codex-providers.json',
        'codex-provider-current-models.json'
    ],
    opencode: [
        'opencode-providers.json',
        'opencode-provider-current-models.json'
    ]
});
const PROVIDER_CACHE_PROVIDER_FILES = Object.freeze([
    'codex-providers.json',
    'claude-providers.json',
    'opencode-providers.json'
]);
const PROVIDER_CACHE_CURRENT_MODEL_FILES = Object.freeze([
    'codex-provider-current-models.json',
    'opencode-provider-current-models.json'
]);
const PROVIDER_CACHE_MAX_FILE_BYTES = 256 * 1024;
const CODEXMATE_PREFERENCES_FILE = path.join(CODEXMATE_DIR, 'preferences.json');
const CODEXMATE_OPENCODE_DIR = path.join(CODEXMATE_DIR, 'opencode');
const CODEXMATE_OPENCODE_PROVIDER_STORE_FILE = path.join(CODEXMATE_OPENCODE_DIR, 'providers.json');
const CODEXMATE_SESSIONS_DIR = path.join(CODEXMATE_DIR, 'sessions');
const CODEXMATE_DERIVED_SESSIONS_DIR = path.join(CODEXMATE_SESSIONS_DIR, 'derived');
const CODEXMATE_DERIVED_CODEX_DIR = path.join(CODEXMATE_DERIVED_SESSIONS_DIR, 'codex');
const CODEXMATE_DERIVED_CLAUDE_DIR = path.join(CODEXMATE_DERIVED_SESSIONS_DIR, 'claude');
const GEMINI_DIR = path.join(os.homedir(), '.gemini');
const GEMINI_TMP_DIR = path.join(GEMINI_DIR, 'tmp');
const PI_DIR = path.join(os.homedir(), '.pi');
const PI_SESSIONS_DIR = path.join(PI_DIR, 'agent', 'sessions');
const RECENT_CONFIGS_FILE = path.join(CONFIG_DIR, 'recent-configs.json');
const WORKFLOW_DEFINITIONS_FILE = path.join(CONFIG_DIR, 'codexmate-workflows.json');
const WORKFLOW_RUNS_FILE = path.join(CONFIG_DIR, 'codexmate-workflow-runs.jsonl');
const TASK_OPENAI_CHAT_TIMEOUT_MS = 180000;
const TASK_OPENAI_CHAT_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const DEFAULT_CLAUDE_MODEL = 'glm-4.7';
const DEFAULT_MODEL_CONTEXT_WINDOW = 190000;
const DEFAULT_MODEL_AUTO_COMPACT_TOKEN_LIMIT = 185000;
const CODEX_BACKUP_NAME = 'codex-config';

const DEFAULT_MODELS = ['gpt-5.3-codex', 'gpt-5.1-codex-max', 'gpt-4-turbo', 'gpt-4'];
const SPEED_TEST_TIMEOUT_MS = 8000;
const MAX_SESSION_LIST_SIZE = 300;
const MAX_SESSION_TRASH_LIST_SIZE = 500;
const DEFAULT_SESSION_TRASH_RETENTION_DAYS = 30;
const MAX_EXPORT_MESSAGES = 1000;
const DEFAULT_SESSION_DETAIL_MESSAGES = 300;
const MAX_SESSION_DETAIL_MESSAGES = 1000;
const SESSION_TITLE_READ_BYTES = 64 * 1024;
const CODEXMATE_MANAGED_MARKER = '# codexmate-managed: true';
const SESSION_LIST_CACHE_TTL_MS = 4000;
const SESSION_SUMMARY_READ_BYTES = 256 * 1024;
const SESSION_CONTENT_READ_BYTES = SESSION_SUMMARY_READ_BYTES;
const SESSION_PREVIEW_MESSAGE_TEXT_MAX_LENGTH = 4000;
const EXACT_MESSAGE_COUNT_CACHE_MAX_ENTRIES = 800;
const DEFAULT_CONTENT_SCAN_LIMIT = 50;
const SESSION_SCAN_FACTOR = 4;
const SESSION_SCAN_MIN_FILES = 800;
const SESSION_BROWSE_SCAN_FACTOR = 2;
const SESSION_BROWSE_MIN_FILES = 120;
const SESSION_BROWSE_SUMMARY_READ_BYTES = 64 * 1024;
const SESSION_USAGE_TAIL_READ_BYTES = 64 * 1024;
const SESSION_INVENTORY_CACHE_MAX_ENTRIES = 12;
const MAX_SESSION_PATH_LIST_SIZE = 2000;
const MAX_SESSION_USAGE_LIST_SIZE = 2000;
const FAST_SESSION_DETAIL_PREVIEW_FILE_BYTES = 256 * 1024;
const FAST_SESSION_DETAIL_PREVIEW_CHUNK_BYTES = 64 * 1024;
const FAST_SESSION_DETAIL_PREVIEW_MAX_BYTES = 1024 * 1024;
const AGENTS_FILE_NAME = 'AGENTS.md';
const PI_AGENT_DIR = path.join(os.homedir(), '.pi', 'agent');
const MODELS_CACHE_TTL_MS = 60 * 1000;
const MODELS_NEGATIVE_CACHE_TTL_MS = 5 * 1000;
const MODELS_CACHE_MAX_ENTRIES = 50;
const MODELS_RESPONSE_MAX_BYTES = 1024 * 1024;
const MAX_RECENT_CONFIGS = 3;
const MAX_UPLOAD_SIZE = 200 * 1024 * 1024;
const MAX_SKILLS_ZIP_UPLOAD_SIZE = 20 * 1024 * 1024;
const MAX_API_BODY_SIZE = 4 * 1024 * 1024;
const MAX_SKILLS_ZIP_ENTRY_COUNT = 2000;
const MAX_SKILLS_ZIP_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const DEFAULT_EXTRACT_SUFFIXES = Object.freeze(['.json']);
const g_taskRunControllers = new Map();
let g_taskQueueProcessor = null;
const BUILTIN_PROXY_PROVIDER_NAME = 'codexmate-proxy';
const BUILTIN_LOCAL_PROVIDER_NAME = 'local';
const DEFAULT_BUILTIN_PROXY_SETTINGS = Object.freeze({
    enabled: false,
    host: '127.0.0.1',
    port: 8318,
    provider: '',
    authSource: 'provider',
    timeoutMs: 30000
});
const DEFAULT_BUILTIN_CLAUDE_PROXY_SETTINGS = Object.freeze({
    enabled: false,
    host: '127.0.0.1',
    port: 8328,
    provider: '',
    upstreamProviderName: '',
    upstreamBaseUrl: '',
    upstreamApiKey: '',
    authSource: 'provider',
    targetApi: 'responses',
    timeoutMs: 30000
});
const CLI_INSTALL_TARGETS = Object.freeze([
    {
        id: 'claude',
        name: 'Claude Code CLI',
        packageName: '@anthropic-ai/claude-code',
        bins: ['claude']
    },
    {
        id: 'codebuddy',
        name: 'CodeBuddy Code',
        packageName: '@tencent-ai/codebuddy-code',
        bins: ['codebuddy']
    },
    {
        id: 'gemini',
        name: 'Gemini CLI',
        packageName: '@google/gemini-cli',
        bins: ['gemini']
    },
    {
        id: 'codex',
        name: 'Codex CLI',
        packageName: '@openai/codex',
        bins: ['codex']
    },
    {
        id: 'kilocode',
        name: 'KiloCode CLI',
        packageName: '@kilocode/cli',
        bins: ['kilo', 'kilocode']
    }
]);

const HTTP_KEEP_ALIVE_AGENT = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxFreeSockets: 4
});
const HTTPS_KEEP_ALIVE_AGENT = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 1000,
    maxFreeSockets: 4
});

const openaiBridgeHandler = createOpenaiBridgeHttpHandler({
    settingsFile: OPENAI_BRIDGE_SETTINGS_FILE,
    expectedToken: typeof process.env.CODEXMATE_HTTP_TOKEN === 'string' ? process.env.CODEXMATE_HTTP_TOKEN.trim() : '',
    maxBodySize: MAX_API_BODY_SIZE,
    httpAgent: HTTP_KEEP_ALIVE_AGENT,
    httpsAgent: HTTPS_KEEP_ALIVE_AGENT
});

const localBridgeHandler = createLocalBridgeHttpHandler({
    readConfigFn: readConfig,
    openaiBridgeFile: OPENAI_BRIDGE_SETTINGS_FILE,
    claudeProvidersFile: CLAUDE_LOCAL_PROVIDERS_FILE,
    localBridgeSettingsFile: LOCAL_BRIDGE_SETTINGS_FILE,
    expectedToken: typeof process.env.CODEXMATE_HTTP_TOKEN === 'string' ? process.env.CODEXMATE_HTTP_TOKEN.trim() : '',
    maxBodySize: MAX_API_BODY_SIZE,
    httpAgent: HTTP_KEEP_ALIVE_AGENT,
    httpsAgent: HTTPS_KEEP_ALIVE_AGENT
});

function resolveWebPort() {
    const raw = process.env.CODEXMATE_PORT;
    if (!raw) return DEFAULT_WEB_PORT;
    const parsed = parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_WEB_PORT;
    return parsed;
}

function isWebPortExplicit() {
    return typeof process.env.CODEXMATE_PORT === 'string' && process.env.CODEXMATE_PORT.trim().length > 0;
}

async function resolveAvailableWebPort(port, host, options = {}) {
    const explicitPort = !!options.explicitPort;
    const maxAttemptsRaw = Number.isFinite(options.maxAttempts) ? options.maxAttempts : parseInt(options.maxAttempts, 10);
    const maxAttempts = Number.isFinite(maxAttemptsRaw) && maxAttemptsRaw > 0 ? Math.floor(maxAttemptsRaw) : 20;
    const netModule = options.net || net;
    const requestedPort = parseInt(String(port), 10);
    if (!Number.isFinite(requestedPort) || requestedPort <= 0 || explicitPort) {
        return {
            port,
            requestedPort: port,
            explicitPort,
            changed: false,
            attempts: []
        };
    }

    const attempts = [];
    const checkPort = (candidatePort) => new Promise((resolve) => {
        const tester = netModule.createServer();
        let settled = false;
        const finish = (result) => {
            if (settled) return;
            settled = true;
            resolve(result);
        };
        tester.once('error', (error) => {
            finish({
                available: false,
                code: error && error.code ? String(error.code) : '',
                message: error && error.message ? String(error.message) : ''
            });
        });
        tester.once('listening', () => {
            tester.close(() => finish({ available: true, code: '', message: '' }));
        });
        try {
            tester.listen(candidatePort, host);
        } catch (error) {
            finish({
                available: false,
                code: error && error.code ? String(error.code) : '',
                message: error && error.message ? String(error.message) : String(error)
            });
        }
    });

    const lastPort = Math.min(65535, requestedPort + maxAttempts - 1);
    for (let candidatePort = requestedPort; candidatePort <= lastPort; candidatePort += 1) {
        const result = await checkPort(candidatePort);
        attempts.push({ port: candidatePort, available: !!result.available, code: result.code || '' });
        if (result.available) {
            return {
                port: candidatePort,
                requestedPort,
                explicitPort: false,
                changed: candidatePort !== requestedPort,
                attempts
            };
        }
        if (result.code !== 'EADDRINUSE' && result.code !== 'EACCES') {
            return {
                port: requestedPort,
                requestedPort,
                explicitPort: false,
                changed: false,
                attempts,
                error: result.message || result.code || 'port probe failed'
            };
        }
    }

    return {
        port: requestedPort,
        requestedPort,
        explicitPort: false,
        changed: false,
        attempts,
        error: `no available port found from ${requestedPort} to ${lastPort}`
    };
}

// #region releaseRunPortIfNeeded
function releaseRunPortIfNeeded(port, host, deps = {}) {
    const numericPort = parseInt(String(port), 10);
    if (numericPort !== DEFAULT_WEB_PORT) {
        return { attempted: false, released: false, pids: [], reason: 'non-default-port' };
    }

    const processRef = deps.process || process;
    const runSpawnSync = deps.spawnSync || spawnSync;
    const logger = deps.logger || console;
    const killProcess = typeof deps.kill === 'function'
        ? deps.kill
        : (typeof processRef.kill === 'function' ? processRef.kill.bind(processRef) : null);
    const seenPids = new Set();
    const candidatePids = new Set();
    const currentPid = Number(processRef.pid);
    const normalizedHost = typeof host === 'string' ? host.trim().toLowerCase() : '';
    let released = false;
    const windowsCommandLineCache = new Map();

    const isManagedRunCommand = (commandLine) => {
        const normalizedLine = ` ${String(commandLine || '').replace(/\s+/g, ' ').trim()} `;
        return /(^|[\/\\\s])codexmate(?:\.cmd|\.exe)? run(\s|$)/i.test(normalizedLine)
            || /(^|[\/\\\s])cli\.js run(\s|$)/i.test(normalizedLine);
    };

    const normalizeListenerHost = (value) => {
        const trimmed = String(value || '').trim().toLowerCase();
        if (!trimmed) {
            return '';
        }
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            return trimmed.slice(1, -1);
        }
        return trimmed.startsWith('::ffff:') ? trimmed.slice('::ffff:'.length) : trimmed;
    };

    const extractListenerHost = (localAddress) => {
        const trimmed = String(localAddress || '').trim();
        if (!trimmed) {
            return '';
        }
        if (trimmed.startsWith('[')) {
            const closingBracket = trimmed.indexOf(']');
            if (closingBracket > 0) {
                return normalizeListenerHost(trimmed.slice(1, closingBracket));
            }
        }
        const lastColon = trimmed.lastIndexOf(':');
        if (lastColon <= 0) {
            return normalizeListenerHost(trimmed);
        }
        return normalizeListenerHost(trimmed.slice(0, lastColon));
    };

    const isMatchingWindowsListenerAddress = (localAddress) => {
        const listenerHost = extractListenerHost(localAddress);
        if (!listenerHost || !normalizedHost) {
            return false;
        }
        if (normalizedHost === 'localhost') {
            return listenerHost === '127.0.0.1' || listenerHost === '::1';
        }
        if (normalizedHost === '0.0.0.0' || normalizedHost === '::') {
            return listenerHost === normalizedHost;
        }
        return listenerHost === normalizeListenerHost(normalizedHost);
    };

    const addPidsFromText = (text, targetSet = seenPids) => {
        if (!targetSet) {
            return;
        }
        const lines = String(text || '').split(/\r?\n/);
        for (const line of lines) {
            const tokens = line.trim().split(/\s+/).filter(Boolean);
            for (const token of tokens) {
                if (!/^\d+$/.test(token)) {
                    continue;
                }
                targetSet.add(Number(token));
            }
        }
    };

    const runCommand = (command, args, options = {}) => {
        const {
            stdoutPidSet = seenPids,
            stderrPidSet = seenPids
        } = options;
        const result = runSpawnSync(command, args, { encoding: 'utf8' });
        if (result && result.stdout) addPidsFromText(result.stdout, stdoutPidSet);
        if (result && result.stderr) addPidsFromText(result.stderr, stderrPidSet);
        return result || {};
    };

    const addManagedRunPidsFromPs = (text, allowedPids = null) => {
        const lines = String(text || '').split(/\r?\n/);
        for (const line of lines) {
            const normalizedLine = ` ${line.replace(/\s+/g, ' ').trim()} `;
            if (!/(^|[\/\s])codexmate run(\s|$)/.test(normalizedLine) && !/(^|[\/\s])cli\.js run(\s|$)/.test(normalizedLine)) {
                continue;
            }
            const pidMatch = line.match(/^\S+\s+(\d+)\s+/);
            if (!pidMatch) {
                continue;
            }
            const pid = Number(pidMatch[1]);
            if (!Number.isFinite(pid) || pid <= 0 || pid === currentPid) {
                continue;
            }
            if (allowedPids && !allowedPids.has(pid)) {
                continue;
            }
            seenPids.add(pid);
        }
    };

    const getWindowsProcessCommandLine = (pid) => {
        if (windowsCommandLineCache.has(pid)) {
            return windowsCommandLineCache.get(pid);
        }
        const result = runCommand(
            'powershell',
            [
                '-NoProfile',
                '-Command',
                `$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${pid}"; if ($p) { $p.CommandLine }`
            ],
            { stdoutPidSet: null, stderrPidSet: null }
        );
        const commandLine = !result.error && result.status === 0
            ? String(result.stdout || '').trim()
            : '';
        windowsCommandLineCache.set(pid, commandLine);
        return commandLine;
    };

    if (processRef.platform === 'win32') {
        const netstatResult = runCommand('netstat', ['-ano', '-p', 'tcp'], { stdoutPidSet: null, stderrPidSet: null });
        if (!(netstatResult && netstatResult.error)) {
            const lines = String(netstatResult.stdout || '').split(/\r?\n/);
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length < 5) {
                    continue;
                }
                const localAddress = parts[1];
                const state = parts[3];
                const pidText = parts[4];
                if (state !== 'LISTENING' || !localAddress.endsWith(`:${numericPort}`) || !/^\d+$/.test(pidText)) {
                    continue;
                }
                if (!isMatchingWindowsListenerAddress(localAddress)) {
                    continue;
                }
                candidatePids.add(Number(pidText));
            }
            for (const pid of candidatePids) {
                if (pid === currentPid) {
                    continue;
                }
                if (!isManagedRunCommand(getWindowsProcessCommandLine(pid))) {
                    continue;
                }
                seenPids.add(pid);
                const taskkillResult = runCommand(
                    'taskkill',
                    ['/PID', String(pid), '/F'],
                    { stdoutPidSet: null, stderrPidSet: null }
                );
                if (!taskkillResult.error && taskkillResult.status === 0) {
                    released = true;
                }
            }
        }
    } else {
        let psResult = null;
        const readPsResult = () => {
            if (psResult) {
                return psResult;
            }
            psResult = runCommand('ps', ['-ef'], { stdoutPidSet: null, stderrPidSet: null });
            return psResult;
        };

        const lsofResult = runCommand(
            'lsof',
            ['-ti', `tcp:${numericPort}`],
            { stdoutPidSet: candidatePids, stderrPidSet: null }
        );
        const shouldTryFuser = !!(lsofResult && lsofResult.error && lsofResult.error.code === 'ENOENT');
        if (shouldTryFuser && candidatePids.size === 0) {
            runCommand(
                'fuser',
                [`${numericPort}/tcp`],
                { stdoutPidSet: candidatePids, stderrPidSet: candidatePids }
            );
        }
        if (candidatePids.size > 0) {
            const managedPsResult = readPsResult();
            if (!(managedPsResult && managedPsResult.error)) {
                addManagedRunPidsFromPs(managedPsResult.stdout, candidatePids);
            }
        }
    }

    if (processRef.platform !== 'win32' && killProcess && !released && seenPids.size > 0) {
        for (const pid of seenPids) {
            if (pid === currentPid) {
                continue;
            }
            try {
                killProcess(pid, 'SIGKILL');
                released = true;
            } catch (_) { }
        }
    }

    if (released) {
        logger.log(`~ 已释放端口 ${numericPort} 占用`);
    }

    return {
        attempted: true,
        released,
        pids: Array.from(seenPids)
            .filter((pid) => pid !== currentPid)
            .sort((a, b) => a - b)
    };
}
// #endregion releaseRunPortIfNeeded

function resolveWebHost(options = {}) {
    const optionHost = typeof options.host === 'string' ? options.host.trim() : '';
    if (optionHost) {
        return optionHost;
    }
    const envHost = typeof process.env.CODEXMATE_HOST === 'string' ? process.env.CODEXMATE_HOST.trim() : '';
    if (envHost) {
        return envHost;
    }
    return DEFAULT_WEB_HOST;
}

const EMPTY_CONFIG_FALLBACK_TEMPLATE = `model = "gpt-5.3-codex"
model_context_window = ${DEFAULT_MODEL_CONTEXT_WINDOW}
model_auto_compact_token_limit = ${DEFAULT_MODEL_AUTO_COMPACT_TOKEN_LIMIT}
disable_response_storage = true
approval_policy = "never"
sandbox_mode = "danger-full-access"
model_provider = "local"
personality = "pragmatic"
web_search = "live"

[model_providers.local]
name = "local"
base_url = "http://127.0.0.1:3737/bridge/local/v1"
wire_api = "responses"
requires_openai_auth = true
preferred_auth_method = "codexmate"
codexmate_bridge = "local"
request_max_retries = 4
stream_max_retries = 10
stream_idle_timeout_ms = 300000
`;

let g_sessionListCache = new Map();
let g_sessionInventoryCache = new Map();
let g_sessionFileLookupCache = {
    codex: new Map(),
    claude: new Map(),
    gemini: new Map(),
    codebuddy: new Map(),
    pi: new Map()
};
let g_exactMessageCountCache = new Map();
let g_modelsCache = new Map();
let g_modelsInFlight = new Map();

function isBuiltinProxyProvider(providerName) {
    return typeof providerName === 'string' && providerName.trim().toLowerCase() === BUILTIN_PROXY_PROVIDER_NAME.toLowerCase();
}

function isLocalProvider(providerName) {
    return typeof providerName === 'string' && providerName.trim().toLowerCase() === BUILTIN_LOCAL_PROVIDER_NAME.toLowerCase();
}

function isReservedProviderNameForCreation(providerName) {
    return isLocalProvider(providerName);
}

function isBuiltinManagedProvider(providerName) {
    return isBuiltinProxyProvider(providerName) || isLocalProvider(providerName);
}

function isNonDeletableProvider(providerName) {
    return isBuiltinManagedProvider(providerName);
}

function isNonEditableProvider(providerName) {
    return isBuiltinManagedProvider(providerName);
}

// ============================================================================
// 工具函数
// ============================================================================
function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

function createConfigLoadError(type, message, detail) {
    const err = new Error(detail || message);
    err.configErrorType = type || 'read';
    err.configPublicReason = message || '读取 config.toml 失败';
    err.configDetail = detail || message || '';
    return err;
}

function readConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        throw createConfigLoadError(
            'missing',
            '未检测到 config.toml',
            `配置文件不存在: ${CONFIG_FILE}`
        );
    }

    let content = '';
    try {
        content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    } catch (e) {
        throw createConfigLoadError(
            'read',
            '读取 config.toml 失败',
            `读取配置文件失败: ${e && e.message ? e.message : e}`
        );
    }

    let parsed;
    try {
        parsed = toml.parse(content);
    } catch (e) {
        throw createConfigLoadError(
            'parse',
            'config.toml 解析失败',
            `配置文件解析失败: ${e && e.message ? e.message : e}`
        );
    }

    if (isPlainObject(parsed) && isPlainObject(parsed.model_providers)) {
        const providerHeaderSegmentKeySet = collectModelProviderHeaderSegmentKeySet(content);
        parsed.model_providers = normalizeLegacyModelProviders(parsed.model_providers, providerHeaderSegmentKeySet);
    }
    return parsed;
}

function writeConfig(content) {
    assertToolConfigWriteAllowed('codex');
    try {
        fs.writeFileSync(CONFIG_FILE, content, 'utf-8');
    } catch (e) {
        throw new Error(`写入配置失败: ${e.message}`);
    }
}

function readModels() {
    if (fs.existsSync(MODELS_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(MODELS_FILE, 'utf-8'));
        } catch (e) { }
    }
    return [...DEFAULT_MODELS];
}

function writeModels(models) {
    assertToolConfigWriteAllowed('codex');
    fs.writeFileSync(MODELS_FILE, JSON.stringify(models, null, 2), 'utf-8');
}

function readCurrentModels() {
    if (fs.existsSync(CURRENT_MODELS_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(CURRENT_MODELS_FILE, 'utf-8'));
        } catch (e) { }
    }
    return {};
}

function writeCurrentModels(data) {
    assertToolConfigWriteAllowed('codex');
    fs.writeFileSync(CURRENT_MODELS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function updateAuthJson(apiKey) {
    assertToolConfigWriteAllowed('codex');
    let authData = {};
    if (fs.existsSync(AUTH_FILE)) {
        try {
            const content = fs.readFileSync(AUTH_FILE, 'utf-8');
            if (content.trim()) authData = JSON.parse(content);
        } catch (e) { }
    }
    authData['OPENAI_API_KEY'] = apiKey;
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

const TOOL_CONFIG_PERMISSION_TARGETS = new Set(['codex', 'claude', 'opencode', 'kilocode', 'openclaw', 'pi']);
const TOOL_CONFIG_PERMISSION_DEFAULTS = Object.freeze({ codex: false, claude: false, opencode: false, kilocode: false, openclaw: false, pi: false });
let toolConfigWriteGuardDepth = 0;

function enterToolConfigWriteGuard() {
    toolConfigWriteGuardDepth += 1;
    let active = true;
    return () => {
        if (!active) return;
        active = false;
        toolConfigWriteGuardDepth = Math.max(0, toolConfigWriteGuardDepth - 1);
    };
}

function isToolConfigWriteGuardActive() {
    return toolConfigWriteGuardDepth > 0;
}

function normalizeToolConfigTarget(value) {
    const target = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return TOOL_CONFIG_PERMISSION_TARGETS.has(target) ? target : '';
}

function normalizeToolConfigPermissions(value) {
    const source = isPlainObject(value) ? value : {};
    return {
        codex: source.codex === true,
        claude: source.claude === true,
        opencode: source.opencode === true,
        kilocode: source.kilocode === true,
        openclaw: source.openclaw === true,
        pi: source.pi === true
    };
}

function readCodexmatePreferences() {
    if (!fs.existsSync(CODEXMATE_PREFERENCES_FILE)) return {};
    try {
        const raw = fs.readFileSync(CODEXMATE_PREFERENCES_FILE, 'utf-8');
        const parsed = raw && raw.trim() ? JSON.parse(raw) : {};
        return isPlainObject(parsed) ? parsed : {};
    } catch (_) {
        return {};
    }
}

function writeCodexmatePreferences(preferences) {
    ensureDir(CODEXMATE_DIR);
    writeJsonAtomic(CODEXMATE_PREFERENCES_FILE, isPlainObject(preferences) ? preferences : {});
}

function normalizeShareCommandPrefixPreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return normalized === 'codexmate' ? 'codexmate' : 'npm start';
}

function normalizeBooleanPreference(value, defaultValue = true) {
    if (value === true) return true;
    if (value === false) return false;
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') return true;
    if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') return false;
    return defaultValue !== false;
}

function normalizeSessionTrashRetentionPreference(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 1) return 30;
    return Math.min(365, Math.max(1, Math.floor(numeric)));
}

function normalizeSessionTimelineStylePreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return normalized === 'bar' ? 'bar' : 'dots';
}

function normalizeSettingsTabPreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return normalized === 'data' ? 'data' : 'general';
}

function normalizeMainTabPreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    const allowed = new Set(['dashboard', 'config', 'sessions', 'usage', 'market', 'plugins', 'docs', 'settings', 'trash', 'prompts']);
    return allowed.has(normalized) ? normalized : 'dashboard';
}

function normalizeConfigModePreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return ['codex', 'claude', 'openclaw', 'opencode', 'kilocode', 'pi'].includes(normalized) ? normalized : 'codex';
}

function normalizeUsageTimeRangePreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'all' || normalized === '30d') return normalized;
    return '7d';
}

function normalizePromptsSubTabPreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'claude-project') return normalized;
    if (normalized === 'system') return normalized;
    return 'codex';
}

function normalizeSysPromptScopePreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return normalized === 'project' ? 'project' : 'global';
}

function normalizeSysPromptModePreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return normalized === 'append' ? 'append' : 'system';
}

function normalizeSidebarCollapsedPreference(value) {
    return normalizeBooleanPreference(value, false);
}

function normalizeSessionFilterSourcePreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'all' || normalized === 'claude' || normalized === 'gemini' || normalized === 'codebuddy' || normalized === 'pi') return normalized;
    return 'codex';
}

function normalizeSessionRoleFilterPreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'user' || normalized === 'assistant' || normalized === 'system' || normalized === 'tool') return normalized;
    return 'all';
}

function normalizeSessionTimePresetPreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === '24h' || normalized === '7d' || normalized === '30d') return normalized;
    return 'all';
}

function normalizeSessionSortModePreference(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return normalized === 'hot' ? 'hot' : 'time';
}

function normalizeSessionFiltersPreference(value = {}) {
    const source = isPlainObject(value) ? value : {};
    return {
        source: normalizeSessionFilterSourcePreference(source.source),
        pathFilter: typeof source.pathFilter === 'string' ? source.pathFilter : '',
        query: typeof source.query === 'string' ? source.query : '',
        roleFilter: normalizeSessionRoleFilterPreference(source.roleFilter),
        timePreset: normalizeSessionTimePresetPreference(source.timePreset),
        sortMode: normalizeSessionSortModePreference(source.sortMode)
    };
}

function normalizeSessionPinnedMapPreference(value = {}) {
    const source = isPlainObject(value) ? value : {};
    const next = {};
    for (const [key, item] of Object.entries(source)) {
        if (!key) continue;
        const numeric = Number(item);
        if (!Number.isFinite(numeric) || numeric <= 0) continue;
        next[key] = Math.floor(numeric);
    }
    return next;
}

function normalizePlainObjectPreference(value = {}) {
    return isPlainObject(value) ? value : {};
}

function normalizeArrayPreference(value = []) {
    return Array.isArray(value) ? value : [];
}

function normalizeWebUiPreferences(value = {}) {
    const source = isPlainObject(value) ? value : {};
    const navigation = isPlainObject(source.navigation) ? source.navigation : {};
    return {
        shareCommandPrefix: normalizeShareCommandPrefixPreference(source.shareCommandPrefix),
        sessionTrashEnabled: normalizeBooleanPreference(source.sessionTrashEnabled, true),
        sessionTrashRetentionDays: normalizeSessionTrashRetentionPreference(source.sessionTrashRetentionDays),
        sessionTimelineStyle: normalizeSessionTimelineStylePreference(source.sessionTimelineStyle),
        configTemplateDiffConfirmEnabled: normalizeBooleanPreference(source.configTemplateDiffConfirmEnabled, true),
        sessionsUsageTimeRange: normalizeUsageTimeRangePreference(source.sessionsUsageTimeRange),
        promptsSubTab: normalizePromptsSubTabPreference(source.promptsSubTab),
        sysPromptScope: normalizeSysPromptScopePreference(source.sysPromptScope),
        sysPromptMode: normalizeSysPromptModePreference(source.sysPromptMode),
        projectClaudeMdPath: typeof source.projectClaudeMdPath === 'string' ? source.projectClaudeMdPath : '',
        sidebarCollapsed: normalizeSidebarCollapsedPreference(source.sidebarCollapsed),
        starPrompted: normalizeBooleanPreference(source.starPrompted, false),
        sessionLoadNativeDialog: normalizeBooleanPreference(source.sessionLoadNativeDialog, false),
        language: typeof source.language === 'string' ? source.language : '',
        sessionFilters: normalizeSessionFiltersPreference(source.sessionFilters),
        sessionPinnedMap: normalizeSessionPinnedMapPreference(source.sessionPinnedMap),
        claudeConfigs: normalizePlainObjectPreference(source.claudeConfigs),
        currentClaudeConfig: typeof source.currentClaudeConfig === 'string' ? source.currentClaudeConfig : '',
        openclawConfigs: normalizePlainObjectPreference(source.openclawConfigs),
        toolConfigPermissions: normalizeToolConfigPermissions(source.toolConfigPermissions || TOOL_CONFIG_PERMISSION_DEFAULTS),
        deletedClaudeSettingsImports: normalizeArrayPreference(source.deletedClaudeSettingsImports),
        navigation: {
            mainTab: normalizeMainTabPreference(navigation.mainTab),
            configMode: normalizeConfigModePreference(navigation.configMode),
            settingsTab: normalizeSettingsTabPreference(navigation.settingsTab),
            skillsTargetApp: navigation.skillsTargetApp === 'claude' || navigation.skillsTargetApp === 'pi'
                ? navigation.skillsTargetApp
                : 'codex',
            promptTemplatesMode: navigation.promptTemplatesMode === 'manage' ? 'manage' : 'compose'
        }
    };
}

function readWebUiPreferences() {
    const preferences = readCodexmatePreferences();
    return normalizeWebUiPreferences(preferences.webUi || {});
}

function setWebUiPreferences(params = {}) {
    const preferences = readCodexmatePreferences();
    const current = isPlainObject(preferences.webUi) ? preferences.webUi : {};
    const incoming = isPlainObject(params && params.preferences) ? params.preferences : {};
    const next = normalizeWebUiPreferences({
        ...current,
        ...incoming,
        navigation: {
            ...(isPlainObject(current.navigation) ? current.navigation : {}),
            ...(isPlainObject(incoming.navigation) ? incoming.navigation : {})
        }
    });
    preferences.webUi = next;
    if (isPlainObject(incoming.toolConfigPermissions)) {
        preferences.toolConfigPermissions = normalizeToolConfigPermissions(incoming.toolConfigPermissions);
    }
    writeCodexmatePreferences(preferences);
    return { success: true, preferences: next };
}

function readToolConfigPermissions() {
    const preferences = readCodexmatePreferences();
    return normalizeToolConfigPermissions(preferences.toolConfigPermissions || TOOL_CONFIG_PERMISSION_DEFAULTS);
}

function isToolConfigWriteAllowed(target) {
    const normalizedTarget = normalizeToolConfigTarget(target);
    if (!normalizedTarget) return false;
    return readToolConfigPermissions()[normalizedTarget] === true;
}

function buildToolConfigWriteDeniedPayload(target) {
    const normalizedTarget = normalizeToolConfigTarget(target) || target || '';
    return {
        error: '当前为仅浏览，未修改配置。',
        errorCode: 'tool-config-write-disabled',
        target: normalizedTarget,
        permissions: readToolConfigPermissions()
    };
}

function assertToolConfigWriteAllowed(target) {
    if (!isToolConfigWriteGuardActive()) return;
    if (isToolConfigWriteAllowed(target)) return;
    const payload = buildToolConfigWriteDeniedPayload(target);
    const err = new Error(payload.error);
    err.code = payload.errorCode;
    err.target = payload.target;
    throw err;
}

function getApiToolConfigWriteTarget(action) {
    const name = typeof action === 'string' ? action.trim() : '';
    if (!name) return '';
    const codexWriteActions = new Set([
        'apply-config-template',
        'add-provider',
        'update-provider',
        'delete-provider',
        'reset-config',
        'add-model',
        'delete-model',
        'restore-codex-dir',
        'import-config',
        'import-auth-profile',
        'switch-auth-profile',
        'delete-auth-profile',
        'proxy-enable-codex-default',
        'proxy-apply-provider',
        'local-bridge-toggle',
        'local-bridge-set-excluded'
    ]);
    const claudeWriteActions = new Set([
        'apply-claude-settings-raw',
        'apply-claude-config',
        'restore-claude-dir',
        'claude-local-bridge-toggle',
        'claude-local-bridge-set-excluded',
        'claude-local-bridge-sync-providers',
        'delete-provider-cache-record'
    ]);
    const opencodeWriteActions = new Set([
        'apply-opencode-config',
        'update-opencode-selection'
    ]);
    const kilocodeWriteActions = new Set([
        'apply-kilocode-config',
        'start-kilocode'
    ]);
    const openclawWriteActions = new Set([
        'apply-openclaw-config',
        'apply-openclaw-agents-file',
        'apply-openclaw-workspace-file'
    ]);
    if (codexWriteActions.has(name)) return 'codex';
    if (claudeWriteActions.has(name)) return 'claude';
    if (opencodeWriteActions.has(name)) return 'opencode';
    if (kilocodeWriteActions.has(name)) return 'kilocode';
    if (openclawWriteActions.has(name)) return 'openclaw';
    const piWriteActions = new Set([
        'write-pi-models',
        'write-pi-settings'
    ]);
    if (piWriteActions.has(name)) return 'pi';
    return '';
}

function getPiAgentDir() {
    const homeDir = (typeof os.homedir === 'function' ? os.homedir() : null) || process.env.HOME || process.env.USERPROFILE || '';
    return path.join(homeDir, '.pi', 'agent');
}

function readPiModels(params = {}) {
    try {
        const dir = getPiAgentDir();
        const filePath = path.join(dir, 'models.json');
        if (!fs.existsSync(filePath)) {
            return { providers: {}, file: {} };
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        const providers = (data && typeof data === 'object' && data.providers && typeof data.providers === 'object')
            ? data.providers
            : {};
        const file = data && typeof data === 'object' && !Array.isArray(data) ? data : { providers };
        return { providers, file };
    } catch (e) {
        return { error: e && e.message ? e.message : '读取 Pi models.json 失败' };
    }
}

function writePiModels(params = {}) {
    const file = params && typeof params.file === 'object' && params.file !== null && !Array.isArray(params.file) ? params.file : null;
    const providers = params && typeof params.providers === 'object' ? params.providers : null;
    if (!file && providers === null) {
        return { error: '缺少可写入的内容' };
    }
    try {
        const dir = getPiAgentDir();
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, 'models.json');
        if (file) {
            historyBackup('pi-models', filePath);
            fs.writeFileSync(filePath, JSON.stringify(file, null, 2), 'utf-8');
            return { success: true };
        }
        let existing = {};
        if (fs.existsSync(filePath)) {
            try {
                existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            } catch (_) {
                existing = {};
            }
        }
        existing.providers = providers;
        fs.writeFileSync(filePath, JSON.stringify(existing, null, 2), 'utf-8');
        return { success: true };
    } catch (e) {
        return { error: e && e.message ? e.message : '写入 Pi models.json 失败' };
    }
}

async function fetchPiRemoteModels(params = {}) {
    const baseUrl = typeof params.baseUrl === 'string' ? params.baseUrl.trim() : '';
    const apiKey = typeof params.apiKey === 'string' ? params.apiKey.trim() : '';
    if (!baseUrl || !isValidHttpUrl(baseUrl)) {
        return { error: 'baseUrl 无效', models: [] };
    }
    try {
        const result = await fetchModelsFromBaseUrl(baseUrl, apiKey);
        const models = result && Array.isArray(result.models)
            ? [...new Set(result.models.filter((id) => typeof id === 'string' && id !== ''))].sort()
            : [];
        if (models.length > 0) return { models };
        return { error: (result && result.error) || '未获取到可用模型', models: [] };
    } catch (e) {
        return { error: e && e.message ? e.message : '请求失败', models: [] };
    }
}

const PI_MODELS_DEV_API_URL = 'https://models.dev/api.json';
const PI_MODELS_CATALOG_CACHE_TTL_MS = 60 * 60 * 1000;
const PI_MODELS_DEV_TIMEOUT_MS = 15000;
let g_piModelsDevCatalogCache = null;
let g_piModelsDevCatalogCachedAt = 0;

function fetchPiModelsDevCatalog() {
    if (g_piModelsDevCatalogCache && Date.now() - g_piModelsDevCatalogCachedAt < PI_MODELS_CATALOG_CACHE_TTL_MS) {
        return Promise.resolve(g_piModelsDevCatalogCache);
    }
    return new Promise((resolve) => {
        const finish = (payload) => {
            if (payload && !payload.error) {
                g_piModelsDevCatalogCache = payload;
                g_piModelsDevCatalogCachedAt = Date.now();
            }
            resolve(payload);
        };
        const req = https.get(PI_MODELS_DEV_API_URL, {
            headers: {
                'User-Agent': 'codexmate-models',
                'Accept': 'application/json'
            },
            agent: HTTPS_KEEP_ALIVE_AGENT
        }, (res) => {
            const status = res.statusCode || 0;
            if (status >= 400) {
                res.resume();
                return finish({ error: `HTTP ${status}` });
            }
            let body = '';
            res.on('data', chunk => {
                body += chunk;
            });
            res.on('end', () => {
                try {
                    const catalog = JSON.parse(body || '{}');
                    if (!catalog || typeof catalog !== 'object' || Array.isArray(catalog)) {
                        return finish({ error: '响应内容不是有效的目录对象' });
                    }
                    finish(catalog);
                } catch (e) {
                    finish({ error: e && e.message ? e.message : '解析目录响应失败' });
                }
            });
        });
        req.setTimeout(PI_MODELS_DEV_TIMEOUT_MS, () => {
            req.destroy(new Error('请求超时'));
        });
        req.on('error', (err) => {
            finish({ error: err && err.message ? err.message : '请求失败' });
        });
    });
}

function normalizePiCatalogUrl(url) {
    return typeof url === 'string' ? url.trim().replace(/\/+$/, '') : '';
}

function findPiCatalogModelInProvider(provider, modelId) {
    const models = provider && typeof provider === 'object' ? provider.models : null;
    if (!models || typeof models !== 'object') return null;
    const hit = models[modelId];
    return hit && typeof hit === 'object' ? hit : null;
}

function findPiCatalogModel(catalog, lookup) {
    if (lookup.providerId && catalog[lookup.providerId]) {
        return findPiCatalogModelInProvider(catalog[lookup.providerId], lookup.modelId);
    }
    const entries = Object.entries(catalog);
    for (const [key, provider] of entries) {
        const api = normalizePiCatalogUrl(provider && typeof provider === 'object' ? provider.api : '');
        if ((lookup.baseUrl && api === lookup.baseUrl) || (lookup.providerId && key === lookup.providerId)) {
            return findPiCatalogModelInProvider(provider, lookup.modelId);
        }
    }
    for (const [, provider] of entries) {
        const hit = findPiCatalogModelInProvider(provider, lookup.modelId);
        if (hit) return hit;
    }
    return null;
}

function toPiCatalogModelInfo(raw) {
    const numericOrNull = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
    const limit = raw && typeof raw.limit === 'object' && raw.limit !== null ? raw.limit : {};
    const cost = raw && typeof raw.cost === 'object' && raw.cost !== null ? raw.cost : {};
    return {
        name: typeof raw.name === 'string' ? raw.name : '',
        reasoning: !!raw.reasoning,
        contextWindow: numericOrNull(limit.context),
        maxTokens: numericOrNull(limit.output),
        cost: {
            input: numericOrNull(cost.input),
            output: numericOrNull(cost.output),
            cacheRead: numericOrNull(cost.cache_read),
            cacheWrite: numericOrNull(cost.cache_write)
        }
    };
}

async function fetchPiModelsCatalog(params = {}) {
    const modelId = typeof params.modelId === 'string' ? params.modelId.trim() : '';
    if (!modelId) {
        return { error: '模型 ID 不能为空' };
    }
    const lookup = {
        modelId,
        providerId: typeof params.providerId === 'string' ? params.providerId.trim() : '',
        baseUrl: normalizePiCatalogUrl(params.baseUrl)
    };
    const catalog = await fetchPiModelsDevCatalog();
    if (!catalog || typeof catalog !== 'object' || typeof catalog.error === 'string') {
        const reason = catalog && catalog.error ? catalog.error : '响应结构无效';
        return { error: `models.dev 目录请求失败：${reason}` };
    }
    const hit = findPiCatalogModel(catalog, lookup);
    if (!hit) {
        return { error: 'models.dev 目录中未找到该模型' };
    }
    return { ok: true, model: toPiCatalogModelInfo(hit) };
}

function readPiSettings(params = {}) {
    try {
        const dir = getPiAgentDir();
        const filePath = path.join(dir, 'settings.json');
        if (!fs.existsSync(filePath)) {
            return { settings: {} };
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        return { settings: data || {} };
    } catch (e) {
        return { error: e && e.message ? e.message : '读取 Pi settings.json 失败' };
    }
}

function writePiSettings(params = {}) {
    const fullSettings = params && typeof params.settings === 'object' && params.settings !== null && !Array.isArray(params.settings) ? params.settings : null;
    const updates = {};
    if (typeof (params && params.defaultProvider) === 'string') updates.defaultProvider = params.defaultProvider;
    if (typeof (params && params.defaultModel) === 'string') updates.defaultModel = params.defaultModel;
    if (!fullSettings && Object.keys(updates).length === 0) {
        return { error: '缺少可写入的设置项' };
    }
    try {
        const dir = getPiAgentDir();
        fs.mkdirSync(dir, { recursive: true });
        const filePath = path.join(dir, 'settings.json');
        if (fullSettings) {
            historyBackup('pi-settings', filePath);
            fs.writeFileSync(filePath, JSON.stringify(fullSettings, null, 2), 'utf-8');
            return { success: true, settings: fullSettings };
        }
        let existing = {};
        if (fs.existsSync(filePath)) {
            try {
                existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            } catch (_) {
                existing = {};
            }
            if (!existing || typeof existing !== 'object' || Array.isArray(existing)) existing = {};
        }
        const updated = { ...existing, ...updates };
        fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
        return { success: true, settings: updated };
    } catch (e) {
        return { error: e && e.message ? e.message : '写入 Pi settings.json 失败' };
    }
}

function applyPiConfigHistory(params = {}) {
    const target = typeof params.target === 'string' ? params.target.trim() : '';
    if (target !== 'settings' && target !== 'models') {
        return { error: '无效的历史记录目标' };
    }
    const bucket = target === 'settings' ? 'pi-settings' : 'pi-models';
    const fileName = target === 'settings' ? 'settings.json' : 'models.json';
    let entry;
    try {
        entry = readPromptHistory(bucket, String(params.id || ''));
    } catch (_) {
        return { error: '历史记录不存在或读取失败' };
    }
    const content = entry && typeof entry.content === 'string' ? entry.content : '';
    let parsed = null;
    if (content) {
        try {
            parsed = JSON.parse(content);
        } catch (_) {
            parsed = null;
        }
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { error: '历史记录内容不是有效的 JSON 对象' };
    }
    try {
        const filePath = path.join(getPiAgentDir(), fileName);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        historyBackup(bucket, filePath);
        fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2), 'utf-8');
    } catch (e) {
        return { error: (e && e.message) || '应用历史记录失败' };
    }
    if (target === 'settings') return { success: true, settings: parsed };
    return { success: true, file: parsed };
}

function setToolConfigPermission(params = {}) {
    const target = normalizeToolConfigTarget(params && params.target);
    if (!target) return { error: '未知配置对象' };
    const preferences = readCodexmatePreferences();
    const current = normalizeToolConfigPermissions(preferences.toolConfigPermissions || TOOL_CONFIG_PERMISSION_DEFAULTS);
    current[target] = params && params.allowWrite === true;
    preferences.toolConfigPermissions = current;
    writeCodexmatePreferences(preferences);

    let bootstrapNotice = '';
    if (target === 'codex' && current.codex) {
        const bootstrap = ensureManagedConfigBootstrap({ allowWrite: true });
        bootstrapNotice = bootstrap && bootstrap.notice ? bootstrap.notice : '';
    }

    return {
        success: true,
        target,
        permissions: current,
        bootstrapNotice
    };
}

const PROVIDER_CONFIG_KEYS = new Set([
    'name',
    'base_url',
    'wire_api',
    'requires_openai_auth',
    'preferred_auth_method',
    'request_max_retries',
    'stream_max_retries',
    'stream_idle_timeout_ms'
]);
const RECOVERABLE_PROVIDER_SIGNAL_KEYS = [...PROVIDER_CONFIG_KEYS].filter((key) => key !== 'name' && key !== 'base_url');

function looksLikeProviderConfig(value) {
    if (!isPlainObject(value)) return false;
    return Object.keys(value).some((key) => PROVIDER_CONFIG_KEYS.has(key));
}

function isRecoverableNestedProviderConfig(value) {
    if (!isPlainObject(value)) return false;
    const hasBaseUrl = typeof value.base_url === 'string' && value.base_url.trim() !== '';
    if (!hasBaseUrl) return false;
    const hasName = typeof value.name === 'string' && value.name.trim() !== '';
    const hasProviderSignals = RECOVERABLE_PROVIDER_SIGNAL_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
    return hasName || hasProviderSignals;
}

function collectNestedProviderConfigs(node, pathSegments, collector) {
    if (!isPlainObject(node)) return;
    const segments = Array.isArray(pathSegments) ? pathSegments : [String(pathSegments || '')];
    const lastSegment = segments.length > 0 ? segments[segments.length - 1] : '';
    if (segments.length > 1 && lastSegment === 'metadata') {
        return;
    }
    if (isRecoverableNestedProviderConfig(node)) {
        collector.push({
            name: segments.join('.'),
            segments: segments.slice(),
            provider: node
        });
    }
    for (const [childKey, childValue] of Object.entries(node)) {
        if (!isPlainObject(childValue)) continue;
        collectNestedProviderConfigs(childValue, [...segments, childKey], collector);
    }
}

function normalizeLegacySegments(segments) {
    if (!Array.isArray(segments) || segments.length === 0) return null;
    return segments.map((item) => String(item));
}

function buildLegacySegmentsKey(segments) {
    const normalized = normalizeLegacySegments(segments);
    return normalized ? JSON.stringify(normalized) : '';
}

function appendLegacySegmentsVariant(provider, segments) {
    if (!isPlainObject(provider)) return;
    const normalized = normalizeLegacySegments(segments);
    if (!normalized) return;

    const variants = [];
    const seen = new Set();
    const pushVariant = (candidate) => {
        const key = buildLegacySegmentsKey(candidate);
        if (!key || seen.has(key)) return;
        seen.add(key);
        variants.push(normalizeLegacySegments(candidate));
    };

    if (Array.isArray(provider.__codexmate_legacy_segments)) {
        pushVariant(provider.__codexmate_legacy_segments);
    }
    if (Array.isArray(provider.__codexmate_legacy_segment_variants)) {
        for (const candidate of provider.__codexmate_legacy_segment_variants) {
            pushVariant(candidate);
        }
    }
    pushVariant(normalized);

    try {
        if (!Array.isArray(provider.__codexmate_legacy_segments)) {
            Object.defineProperty(provider, '__codexmate_legacy_segments', {
                value: normalized,
                enumerable: false,
                configurable: true,
                writable: true
            });
        }
        Object.defineProperty(provider, '__codexmate_legacy_segment_variants', {
            value: variants,
            enumerable: false,
            configurable: true,
            writable: true
        });
    } catch (e) { }
}

function setLegacySegmentsMetadata(provider, segments) {
    appendLegacySegmentsVariant(provider, segments);
}

function normalizeLegacyModelProviders(modelProviders, providerHeaderSegmentKeySet = null) {
    if (!isPlainObject(modelProviders)) {
        return modelProviders;
    }

    let changed = false;
    const normalized = {};
    const addRecovered = (entry) => {
        const name = entry && typeof entry.name === 'string' ? entry.name : '';
        const segments = entry && Array.isArray(entry.segments) ? entry.segments.slice() : null;
        const provider = entry ? entry.provider : null;
        if (!name || !isPlainObject(provider)) return;
        const segmentKey = buildLegacySegmentsKey(segments);
        if (providerHeaderSegmentKeySet instanceof Set && segmentKey && !providerHeaderSegmentKeySet.has(segmentKey)) {
            return;
        }
        const existing = Object.prototype.hasOwnProperty.call(normalized, name)
            ? normalized[name]
            : (Object.prototype.hasOwnProperty.call(modelProviders, name) ? modelProviders[name] : null);
        if (isPlainObject(existing)) {
            if (!Array.isArray(existing.__codexmate_legacy_segments)) {
                setLegacySegmentsMetadata(existing, [name]);
            }
            appendLegacySegmentsVariant(existing, segments);
            return;
        }
        if (Object.prototype.hasOwnProperty.call(modelProviders, name)) return;
        if (Object.prototype.hasOwnProperty.call(normalized, name)) return;
        setLegacySegmentsMetadata(provider, segments);
        normalized[name] = provider;
        changed = true;
    };

    for (const [name, provider] of Object.entries(modelProviders)) {
        normalized[name] = provider;
        if (!isPlainObject(provider)) continue;

        if (looksLikeProviderConfig(provider)) {
            setLegacySegmentsMetadata(provider, [name]);
            for (const [childKey, childValue] of Object.entries(provider)) {
                if (!isPlainObject(childValue)) continue;
                const recovered = [];
                collectNestedProviderConfigs(childValue, [name, childKey], recovered);
                for (const recoveredEntry of recovered) {
                    addRecovered(recoveredEntry);
                }
            }
            continue;
        }

        const recovered = [];
        collectNestedProviderConfigs(provider, [name], recovered);
        delete normalized[name];
        changed = true;
        for (const recoveredEntry of recovered) {
            addRecovered(recoveredEntry);
        }
    }

    return changed ? normalized : modelProviders;
}

function escapeRegex(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function areStringArraysEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (String(a[i]) !== String(b[i])) return false;
    }
    return true;
}

function parseTomlDottedKeyExpression(expression) {
    const text = String(expression || '');
    let index = 0;
    const segments = [];
    const skipWhitespace = () => {
        while (index < text.length && /\s/.test(text[index])) index++;
    };

    while (index < text.length) {
        skipWhitespace();
        if (index >= text.length) break;

        const ch = text[index];
        if (ch === "'") {
            const end = text.indexOf("'", index + 1);
            if (end === -1) return null;
            segments.push(text.slice(index + 1, end));
            index = end + 1;
        } else if (ch === '"') {
            index += 1;
            let value = '';
            let closed = false;
            while (index < text.length) {
                const cur = text[index];
                if (cur === '"') {
                    index += 1;
                    closed = true;
                    break;
                }
                if (cur !== '\\') {
                    value += cur;
                    index += 1;
                    continue;
                }
                if (index + 1 >= text.length) return null;
                const esc = text[index + 1];
                if (esc === 'u' || esc === 'U') {
                    const hexLen = esc === 'u' ? 4 : 8;
                    const hex = text.slice(index + 2, index + 2 + hexLen);
                    if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
                    try {
                        value += String.fromCodePoint(parseInt(hex, 16));
                    } catch (e) {
                        return null;
                    }
                    index += 2 + hexLen;
                    continue;
                }
                const unescaped = {
                    b: '\b',
                    t: '\t',
                    n: '\n',
                    f: '\f',
                    r: '\r',
                    '"': '"',
                    '\\': '\\'
                }[esc];
                if (unescaped === undefined) return null;
                value += unescaped;
                index += 2;
            }
            if (!closed) return null;
            segments.push(value);
        } else {
            const start = index;
            while (index < text.length && !/\s|\./.test(text[index])) index++;
            const bare = text.slice(start, index);
            if (!bare) return null;
            segments.push(bare);
        }

        skipWhitespace();
        if (index >= text.length) break;
        if (text[index] !== '.') return null;
        index += 1;
    }

    return segments.length > 0 ? segments : null;
}

function collectTomlMultilineStringRanges(text) {
    const source = typeof text === 'string' ? text : '';
    const ranges = [];
    let i = 0;
    let inMultilineBasic = false;
    let inMultilineLiteral = false;
    let rangeStart = -1;

    while (i < source.length) {
        if (inMultilineBasic) {
            if (source.slice(i, i + 3) === '"""') {
                let slashCount = 0;
                for (let j = i - 1; j >= 0 && source[j] === '\\'; j--) {
                    slashCount++;
                }
                if (slashCount % 2 === 0) {
                    let runEnd = i + 3;
                    while (runEnd < source.length && source[runEnd] === '"') runEnd++;
                    ranges.push({ start: rangeStart, end: runEnd });
                    inMultilineBasic = false;
                    rangeStart = -1;
                    i = runEnd;
                    continue;
                }
            }
            i++;
            continue;
        }

        if (inMultilineLiteral) {
            if (source.slice(i, i + 3) === "'''") {
                let runEnd = i + 3;
                while (runEnd < source.length && source[runEnd] === '\'') runEnd++;
                ranges.push({ start: rangeStart, end: runEnd });
                inMultilineLiteral = false;
                rangeStart = -1;
                i = runEnd;
                continue;
            }
            i++;
            continue;
        }

        const ch = source[i];
        if (ch === '#') {
            while (i < source.length && source[i] !== '\n') i++;
            continue;
        }

        if (source.slice(i, i + 3) === '"""') {
            inMultilineBasic = true;
            rangeStart = i;
            i += 3;
            continue;
        }

        if (source.slice(i, i + 3) === "'''") {
            inMultilineLiteral = true;
            rangeStart = i;
            i += 3;
            continue;
        }

        if (ch === '"') {
            i++;
            while (i < source.length) {
                if (source[i] === '\\') {
                    i += 2;
                    continue;
                }
                if (source[i] === '"' || source[i] === '\n') {
                    i++;
                    break;
                }
                i++;
            }
            continue;
        }

        if (ch === '\'') {
            i++;
            while (i < source.length) {
                if (source[i] === '\'' || source[i] === '\n') {
                    i++;
                    break;
                }
                i++;
            }
            continue;
        }

        i++;
    }

    if (rangeStart >= 0) {
        ranges.push({ start: rangeStart, end: source.length });
    }
    return ranges;
}

function isIndexInRanges(index, ranges) {
    for (const range of ranges) {
        if (index < range.start) return false;
        if (index >= range.start && index < range.end) return true;
    }
    return false;
}

function findProviderSectionRanges(content, providerName, exactSegments = null) {
    const text = typeof content === 'string' ? content : '';
    const name = typeof providerName === 'string' ? providerName.trim() : '';
    const targetSegments = Array.isArray(exactSegments) ? exactSegments.map((item) => String(item)) : null;
    if (!text || !name) return [];

    const safeName = escapeRegex(name);
    const headerPatterns = [
        { priority: 0, regex: new RegExp(`^\\s*model_providers\\s*\\.\\s*"${safeName}"\\s*$`) },
        { priority: 1, regex: new RegExp(`^\\s*model_providers\\s*\\.\\s*'${safeName}'\\s*$`) },
        { priority: 2, regex: new RegExp(`^\\s*model_providers\\s*\\.\\s*${safeName}\\s*$`) }
    ];

    const allHeaders = [];
    const targetPriorityByStart = new Map();
    const multilineStringRanges = collectTomlMultilineStringRanges(text);
    const sectionLineRegex = /^[ \t]*\[(?!\[)([^\]\n]+)\][ \t]*(?:#.*)?$/gm;
    let match;
    while ((match = sectionLineRegex.exec(text)) !== null) {
        const start = match.index;
        if (isIndexInRanges(start, multilineStringRanges)) {
            continue;
        }
        allHeaders.push(start);
        const headerExpr = String(match[1] || '').trim();

        const parsedSegments = parseTomlDottedKeyExpression(headerExpr);
        if (Array.isArray(parsedSegments) && parsedSegments.length >= 2 && parsedSegments[0] === 'model_providers') {
            const providerSegments = parsedSegments.slice(1);
            if (targetSegments && targetSegments.length > 0 && areStringArraysEqual(providerSegments, targetSegments)) {
                const prev = targetPriorityByStart.get(start);
                if (prev === undefined || -3 < prev) {
                    targetPriorityByStart.set(start, -3);
                }
                continue;
            }
            if (!targetSegments || targetSegments.length === 0) {
                const parsedName = providerSegments.join('.');
                if (parsedName === name) {
                    const prev = targetPriorityByStart.get(start);
                    if (prev === undefined || -2 < prev) {
                        targetPriorityByStart.set(start, -2);
                    }
                    continue;
                }
            }
        }

        for (const pattern of headerPatterns) {
            if (pattern.regex.test(headerExpr)) {
                const prev = targetPriorityByStart.get(start);
                if (prev === undefined || pattern.priority < prev) {
                    targetPriorityByStart.set(start, pattern.priority);
                }
                break;
            }
        }
    }

    if (targetPriorityByStart.size === 0) {
        return [];
    }

    const ranges = [];
    for (let i = 0; i < allHeaders.length; i++) {
        const start = allHeaders[i];
        if (!targetPriorityByStart.has(start)) continue;
        const end = i + 1 < allHeaders.length ? allHeaders[i + 1] : text.length;
        ranges.push({
            start,
            end,
            priority: targetPriorityByStart.get(start)
        });
    }
    const exactMatches = ranges.filter((range) => range.priority === -3);
    return exactMatches.length > 0 ? exactMatches : ranges;
}

function doesSegmentsStartWith(segments, prefix) {
    if (!Array.isArray(segments) || !Array.isArray(prefix) || prefix.length === 0 || segments.length < prefix.length) {
        return false;
    }
    for (let i = 0; i < prefix.length; i++) {
        if (String(segments[i]) !== String(prefix[i])) return false;
    }
    return true;
}

function findProviderDescendantSectionRanges(content, prefixSegments) {
    const text = typeof content === 'string' ? content : '';
    const prefix = Array.isArray(prefixSegments) ? prefixSegments.map((item) => String(item)) : [];
    if (!text || prefix.length === 0) return [];

    const allHeaders = [];
    const parsedProviderSegmentsByStart = new Map();
    const multilineStringRanges = collectTomlMultilineStringRanges(text);
    const sectionLineRegex = /^[ \t]*\[(?!\[)([^\]\n]+)\][ \t]*(?:#.*)?$/gm;
    let match;
    while ((match = sectionLineRegex.exec(text)) !== null) {
        const start = match.index;
        if (isIndexInRanges(start, multilineStringRanges)) {
            continue;
        }
        allHeaders.push(start);
        const headerExpr = String(match[1] || '').trim();
        const parsedSegments = parseTomlDottedKeyExpression(headerExpr);
        if (!Array.isArray(parsedSegments) || parsedSegments.length < 2 || parsedSegments[0] !== 'model_providers') {
            continue;
        }
        parsedProviderSegmentsByStart.set(start, parsedSegments.slice(1));
    }

    const ranges = [];
    for (let i = 0; i < allHeaders.length; i++) {
        const start = allHeaders[i];
        const providerSegments = parsedProviderSegmentsByStart.get(start);
        if (!providerSegments) continue;
        if (!doesSegmentsStartWith(providerSegments, prefix)) continue;
        if (providerSegments.length <= prefix.length) continue;
        const end = i + 1 < allHeaders.length ? allHeaders[i + 1] : text.length;
        ranges.push({ start, end, priority: 0 });
    }
    return ranges;
}

function collectModelProviderHeaderSegmentKeySet(content) {
    const text = typeof content === 'string' ? content : '';
    const keys = new Set();
    if (!text) return keys;

    const multilineStringRanges = collectTomlMultilineStringRanges(text);
    const sectionLineRegex = /^[ \t]*\[(?!\[)([^\]\n]+)\][ \t]*(?:#.*)?$/gm;
    let match;
    while ((match = sectionLineRegex.exec(text)) !== null) {
        const start = match.index;
        if (isIndexInRanges(start, multilineStringRanges)) {
            continue;
        }
        const headerExpr = String(match[1] || '').trim();
        const parsedSegments = parseTomlDottedKeyExpression(headerExpr);
        if (!Array.isArray(parsedSegments) || parsedSegments.length < 2 || parsedSegments[0] !== 'model_providers') {
            continue;
        }
        const key = buildLegacySegmentsKey(parsedSegments.slice(1));
        if (key) keys.add(key);
    }
    return keys;
}

const {
    listAuthProfilesInfo,
    importAuthProfileFromFile,
    importAuthProfileFromUpload,
    switchAuthProfile,
    deleteAuthProfile,
    resolveAuthTokenFromCurrentProfile
} = createAuthProfileController({
    fs,
    path,
    ensureDir,
    readJsonFile,
    writeJsonAtomic,
    stripUtf8Bom,
    toIsoTime,
    isPlainObject,
    AUTH_PROFILES_DIR,
    AUTH_REGISTRY_FILE,
    AUTH_FILE
});

function getCodexSessionsDir() {
    const candidates = [];
    const envCodexHome = process.env.CODEX_HOME;
    if (envCodexHome) {
        candidates.push(path.join(envCodexHome, 'sessions'));
    }
    const xdgConfig = process.env.XDG_CONFIG_HOME;
    if (xdgConfig) {
        candidates.push(path.join(xdgConfig, 'codex', 'sessions'));
    }
    candidates.push(path.join(os.homedir(), '.config', 'codex', 'sessions'));
    candidates.push(CODEX_SESSIONS_DIR);
    return resolveExistingDir(candidates, CODEX_SESSIONS_DIR);
}

function getClaudeProjectsDir() {
    const candidates = [];
    const envClaudeHome = process.env.CLAUDE_HOME || process.env.CLAUDE_CONFIG_DIR;
    if (envClaudeHome) {
        candidates.push(path.join(envClaudeHome, 'projects'));
    }
    const xdgConfig = process.env.XDG_CONFIG_HOME;
    if (xdgConfig) {
        candidates.push(path.join(xdgConfig, 'claude', 'projects'));
    }
    candidates.push(path.join(os.homedir(), '.config', 'claude', 'projects'));
    candidates.push(CLAUDE_PROJECTS_DIR);
    return resolveExistingDir(candidates, CLAUDE_PROJECTS_DIR);
}

function getGeminiTmpDir() {
    const candidates = [];
    const envGeminiHome = process.env.GEMINI_HOME;
    if (envGeminiHome) {
        candidates.push(path.join(envGeminiHome, 'tmp'));
    }
    const xdgConfig = process.env.XDG_CONFIG_HOME;
    if (xdgConfig) {
        candidates.push(path.join(xdgConfig, 'gemini', 'tmp'));
    }
    candidates.push(path.join(os.homedir(), '.config', 'gemini', 'tmp'));
    candidates.push(GEMINI_TMP_DIR);
    return resolveExistingDir(candidates, GEMINI_TMP_DIR);
}

function getCodeBuddyProjectsDir() {
    const candidates = [];
    const envHome = process.env.CODEBUDDY_CODE_HOME_DIR || process.env.CODEBUDDY_HOME;
    if (envHome) {
        candidates.push(path.join(envHome, 'projects'));
    }
    candidates.push(CODEBUDDY_PROJECTS_DIR);
    return resolveExistingDir(candidates, CODEBUDDY_PROJECTS_DIR);
}

function getPiSessionsDir() {
    const candidates = [];
    const envPiHome = process.env.PI_HOME;
    if (envPiHome) {
        candidates.push(path.join(envPiHome, 'agent', 'sessions'));
    }
    const xdgConfig = process.env.XDG_CONFIG_HOME;
    if (xdgConfig) {
        candidates.push(path.join(xdgConfig, 'pi', 'agent', 'sessions'));
    }
    candidates.push(PI_SESSIONS_DIR);
    return resolveExistingDir(candidates, PI_SESSIONS_DIR);
}

function getCodexmateDerivedSessionsRoot(target) {
    if (target === 'claude') {
        return CODEXMATE_DERIVED_CLAUDE_DIR;
    }
    return CODEXMATE_DERIVED_CODEX_DIR;
}

function normalizeSessionDerivedTarget(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'codex' || normalized === 'claude') {
        return normalized;
    }
    return '';
}

function normalizeSessionDerivedSource(value) {
    return normalizeSessionDerivedTarget(value);
}

function buildSessionDerivedSourceKey(source, sessionId, filePath) {
    const baseSource = normalizeSessionDerivedSource(source);
    const id = typeof sessionId === 'string' ? sessionId.trim() : '';
    const pathValue = typeof filePath === 'string' ? filePath.trim() : '';
    const seed = `${baseSource}|${id}|${pathValue}`;
    return crypto.createHash('sha1').update(seed).digest('hex').slice(0, 16);
}

function formatCompactTimestamp(value = Date.now()) {
    const stamp = new Date(value);
    const year = String(stamp.getFullYear());
    const month = String(stamp.getMonth() + 1).padStart(2, '0');
    const day = String(stamp.getDate()).padStart(2, '0');
    const hour = String(stamp.getHours()).padStart(2, '0');
    const minute = String(stamp.getMinutes()).padStart(2, '0');
    const second = String(stamp.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}-${hour}${minute}${second}`;
}

function buildDerivedSessionId(baseId, useUuid) {
    if (useUuid) {
        return crypto.randomUUID();
    }
    const safeBase = typeof baseId === 'string' && baseId.trim() ? baseId.trim() : 'session';
    const normalized = safeBase.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'session';
    const suffix = crypto.randomBytes(3).toString('hex');
    return `${normalized}-${formatCompactTimestamp()}-${suffix}`;
}

function buildDerivedSessionOutputDir(target, source, sourceKey) {
    const targetRoot = getCodexmateDerivedSessionsRoot(target);
    const safeSource = normalizeSessionDerivedSource(source) || 'codex';
    const safeKey = typeof sourceKey === 'string' && sourceKey.trim() ? sourceKey.trim() : 'unknown';
    return path.join(targetRoot, safeSource, safeKey);
}

function readModelsCacheEntry(cacheKey) {
    if (!cacheKey) return null;
    const entry = g_modelsCache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
        g_modelsCache.delete(cacheKey);
        return null;
    }
    g_modelsCache.delete(cacheKey);
    g_modelsCache.set(cacheKey, entry);
    return entry.result || null;
}

function writeModelsCacheEntry(cacheKey, result) {
    if (!cacheKey) return;
    const isNegative = !!(result && (result.error || result.unlimited));
    const ttl = isNegative ? MODELS_NEGATIVE_CACHE_TTL_MS : MODELS_CACHE_TTL_MS;
    const entry = {
        result,
        expiresAt: Date.now() + ttl
    };
    if (g_modelsCache.has(cacheKey)) {
        g_modelsCache.delete(cacheKey);
    }
    g_modelsCache.set(cacheKey, entry);
    while (g_modelsCache.size > MODELS_CACHE_MAX_ENTRIES) {
        const oldestKey = g_modelsCache.keys().next().value;
        g_modelsCache.delete(oldestKey);
    }
}

async function fetchModelsFromBaseUrl(baseUrl, apiKey) {
    const cacheKey = buildModelsCacheKey(baseUrl, apiKey);
    const cached = readModelsCacheEntry(cacheKey);
    if (cached) return cached;

    const inFlight = g_modelsInFlight.get(cacheKey);
    if (inFlight) return inFlight;

    const promise = (async () => {
        const result = await fetchModelsFromBaseUrlCore(baseUrl, apiKey);
        const supplementalModels = getSupplementalModelsForBaseUrl(baseUrl);
        const mergedModels = mergeModelCatalog(result && Array.isArray(result.models) ? result.models : [], supplementalModels);
        const finalResult = mergedModels.length > 0
            ? {
                models: mergedModels,
                unlimited: false,
                source: (result && result.error) ? 'catalog' : (result && result.source ? result.source : 'catalog')
            }
            : result;
        writeModelsCacheEntry(cacheKey, finalResult);
        return finalResult;
    })();

    g_modelsInFlight.set(cacheKey, promise);
    promise.finally(() => {
        g_modelsInFlight.delete(cacheKey);
    });
    return promise;
}

async function fetchModelsFromBaseUrlCore(baseUrl, apiKey) {
    const candidates = buildModelsCandidates(baseUrl);
    if (candidates.length === 0) return { error: 'Provider missing URL' };

    let lastError = '';
    for (const modelsUrl of candidates) {
        let parsed;
        try {
            parsed = new URL(modelsUrl);
        } catch (e) {
            lastError = 'Invalid URL';
            continue;
        }

        const transport = parsed.protocol === 'https:' ? https : http;
        const agent = parsed.protocol === 'https:' ? HTTPS_KEEP_ALIVE_AGENT : HTTP_KEEP_ALIVE_AGENT;
        const headers = {
            'User-Agent': 'codexmate-models',
            'Accept': 'application/json'
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
            headers['x-api-key'] = apiKey;
        }

        const result = await new Promise((innerResolve) => {
            let settled = false;
            const finish = (payload) => {
                if (settled) return;
                settled = true;
                innerResolve(payload);
            };
            const req = transport.request(parsed, { method: 'GET', headers, agent }, (res) => {
                const status = res.statusCode || 0;
                const contentType = String(res.headers['content-type'] || '').toLowerCase();
                if (status === 404 || status === 405 || status === 501) {
                    res.resume();
                    return finish({ unavailable: true });
                }
                let body = '';
                let receivedBytes = 0;
                res.on('data', chunk => {
                    receivedBytes += chunk.length || 0;
                    if (receivedBytes > MODELS_RESPONSE_MAX_BYTES) {
                        res.destroy();
                        return finish({ unavailable: true });
                    }
                    body += chunk;
                });
                res.on('end', () => {
                    if (settled) return;
                    if (status >= 400) {
                        return finish({ error: `Request failed: ${status}` });
                    }
                    if (contentType && !contentType.includes('application/json')) {
                        return finish({ unavailable: true });
                    }
                    try {
                        const payload = JSON.parse(body || '{}');
                        if (!hasModelsListPayload(payload)) {
                            return finish({ unavailable: true });
                        }
                        const models = extractModelNames(payload);
                        return finish({ models });
                    } catch (e) {
                        return finish({ unavailable: true });
                    }
                });
            });

            req.setTimeout(SPEED_TEST_TIMEOUT_MS, () => {
                req.destroy(new Error('timeout'));
            });
            req.on('error', (err) => {
                finish({ error: err.message || 'Request failed' });
            });
            req.end();
        });

        if (result && Array.isArray(result.models)) {
            return { models: result.models };
        }
        if (result && result.error) {
            lastError = result.error;
            continue;
        }
    }

    if (lastError) {
        return { error: lastError };
    }
    return { unlimited: true };
}

async function fetchProviderModels(providerName, overrides = {}) {
    const { config } = readConfigOrVirtualDefault();
    const targetProvider = providerName || config.model_provider || '';
    if (!targetProvider) return { error: '未设置当前提供商' };

    const providers = config.model_providers || {};
    const provider = providers[targetProvider];
    if (!provider) return { error: `提供商不存在: ${targetProvider}` };

    const baseUrl = overrides.baseUrl || provider.base_url || '';
    const apiKey = overrides.apiKey ?? provider.preferred_auth_method ?? '';
    const res = await fetchModelsFromBaseUrl(baseUrl, apiKey);
    if (res.unlimited) return { models: [], provider: targetProvider, unlimited: true };
    if (res.error) return { error: res.error };
    return { models: res.models || [], provider: targetProvider, unlimited: false };
}

// buildAgentsDiff keeps the metaOnly optimization inside cli/agents-files.js.
const {
    backupPromptBeforeWrite: historyBackup,
    listPromptHistory,
    readPromptHistory,
    clearPromptHistory
} = createPromptHistoryController({
    fs,
    path,
    CONFIG_DIR
});

const {
    resolveAgentsFilePath,
    validateAgentsBaseDir,
    detectProjectClaudeMdDir,
    validateClaudeMdBaseDir,
    resolveClaudeMdFilePath,
    readClaudeMdFile,
    applyClaudeMdFile,
    readAgentsFile,
    applyAgentsFile,
    normalizeDiffText,
    buildAgentsDiff
} = createAgentsFileController({
    fs,
    path,
    os,
    ensureDir,
    stripUtf8Bom,
    detectLineEnding,
    normalizeLineEnding,
    ensureUtf8Bom,
    buildLineDiff,
    CONFIG_DIR,
    AGENTS_FILE_NAME,
    CLAUDE_DIR,
    CLAUDE_MD_FILE_NAME,
    backupPromptBeforeWrite: historyBackup,
    readOpenclawAgentsFile() {
        return readOpenclawAgentsFile(...arguments);
    },
    readOpenclawWorkspaceFile() {
        return readOpenclawWorkspaceFile(...arguments);
    }
});

const {
    readSystemPromptFile,
    saveSystemPromptFile,
    buildSystemPromptDiff
} = createSystemPromptFileController({
    fs,
    path,
    os,
    crypto,
    buildLineDiff,
    CONFIG_DIR,
    PI_AGENT_DIR,
    backupPromptBeforeWrite: historyBackup
});

const {
    readOpenclawConfigFile,
    applyOpenclawConfig,
    readOpenclawAgentsFile,
    applyOpenclawAgentsFile,
    readOpenclawWorkspaceFile,
    applyOpenclawWorkspaceFile
} = createOpenclawConfigController({
    fs,
    path,
    os,
    ensureDir,
    readJsonObjectFromFile,
    writeJsonAtomic,
    backupFileIfNeededOnce,
    stripUtf8Bom,
    detectLineEnding,
    normalizeLineEnding,
    ensureUtf8Bom,
    isPlainObject,
    resolveHomePath,
    readAgentsFile,
    applyAgentsFile,
    OPENCLAW_CONFIG_FILE,
    OPENCLAW_WORKSPACE_DIR,
    OPENCLAW_DIR,
    OPENCLAW_DEFAULT_AGENT_ID,
    OPENCLAW_AUTH_PROFILES_FILE_NAME,
    OPENCLAW_AUTH_STATE_FILE_NAME,
    AGENTS_FILE_NAME
});

const {
    normalizeRecentConfigs,
    readRecentConfigs,
    writeRecentConfigs,
    recordRecentConfig,
    sanitizeRemovedBuiltinProxyProvider,
    readConfigOrVirtualDefault,
    printConfigLoadErrorAndMarkExit,
    ensureManagedConfigBootstrap,
    resetConfigToDefault,
    consumeInitNotice
} = createConfigBootstrapController({
    fs,
    path,
    readJsonFile,
    readJsonArrayFile,
    writeJsonAtomic,
    formatTimestampForFileName,
    isPlainObject,
    ensureConfigDir,
    readConfig,
    removePersistedBuiltinProxyProviderFromConfig() {
        return removePersistedBuiltinProxyProviderFromConfig();
    },
    writeConfig,
    readModels,
    writeModels,
    readCurrentModels,
    writeCurrentModels,
    updateAuthJson,
    CONFIG_DIR,
    CONFIG_FILE,
    AUTH_FILE,
    MODELS_FILE,
    RECENT_CONFIGS_FILE,
    INIT_MARK_FILE,
    MAX_RECENT_CONFIGS,
    DEFAULT_MODELS,
    DEFAULT_MODEL_CONTEXT_WINDOW,
    DEFAULT_MODEL_AUTO_COMPACT_TOKEN_LIMIT,
    CODEXMATE_MANAGED_MARKER,
    BUILTIN_PROXY_PROVIDER_NAME,
    BUILTIN_LOCAL_PROVIDER_NAME,
    EMPTY_CONFIG_FALLBACK_TEMPLATE
});

const {
    resolveZipTool,
    resolveUnzipTool,
    zipWithLibrary,
    unzipWithLibrary,
    copyDirRecursive,
    inspectZipArchiveLimits,
    writeUploadZipStream,
    writeUploadZip,
    extractUploadZip,
    findConfigSourceDir,
    prepareDirectoryDownload,
    backupDirectoryIfExists,
    restoreConfigDirectoryFromUpload
} = createArchiveHelperController({
    fs,
    path,
    os,
    execSync,
    execFileSync,
    zipLib,
    yauzl,
    ensureDir,
    isPathInside,
    commandExists,
    MAX_UPLOAD_SIZE,
    MAX_SKILLS_ZIP_UPLOAD_SIZE,
    MAX_SKILLS_ZIP_ENTRY_COUNT,
    MAX_SKILLS_ZIP_UNCOMPRESSED_BYTES
});

const {
    cmdZip,
    cmdUnzip,
    cmdUnzipExt,
    splitExtractSuffixInput,
    parseZipCommandArgs,
    parseUnzipExtCommandArgs
} = createZipCommandController({
    fs,
    path,
    execSync,
    process,
    yauzl,
    formatTimestampForFileName,
    inspectZipArchiveLimits,
    resolveZipTool,
    resolveUnzipTool,
    zipWithLibrary,
    unzipWithLibrary,
    DEFAULT_EXTRACT_SUFFIXES,
    MAX_SKILLS_ZIP_ENTRY_COUNT,
    MAX_SKILLS_ZIP_UNCOMPRESSED_BYTES,
    ensureDir
});

async function buildConfigHealthReport(params = {}) {
    return buildConfigHealthReportCore(params, {
        readConfigOrVirtualDefault,
        readModels
    });
}

async function buildAllProvidersHealthReport(params = {}) {
    return buildAllProvidersHealthReportCore(params, {
        readConfigOrVirtualDefault,
        readCurrentModels,
        probeJsonPost
    });
}

function hasConfigLoadError(result) {
    return !!(result
        && result.isVirtual
        && (result.errorType === 'parse' || result.errorType === 'read'));
}

function normalizeTopLevelConfigWithTemplate(template, selectedProvider, selectedModel) {
    let content = typeof template === 'string' ? template : '';
    if (!content.trim()) {
        throw new Error('模板内容为空');
    }

    const provider = typeof selectedProvider === 'string' ? selectedProvider.trim() : '';
    const model = typeof selectedModel === 'string' ? selectedModel.trim() : '';

    if (provider) {
        if (/^\s*model_provider\s*=.*$/m.test(content)) {
            content = content.replace(/^\s*model_provider\s*=.*$/m, `model_provider = "${provider}"`);
        } else {
            content = `model_provider = "${provider}"\n` + content;
        }
    }

    if (model) {
        if (/^\s*model\s*=.*$/m.test(content)) {
            content = content.replace(/^\s*model\s*=.*$/m, `model = "${model}"`);
        } else {
            content = `model = "${model}"\n` + content;
        }
    }

    return content;
}

function applyServiceTierToTemplate(template, serviceTier) {
    let content = typeof template === 'string' ? template : '';
    const tier = typeof serviceTier === 'string' ? serviceTier.trim().toLowerCase() : '';
    if (!tier) {
        return content;
    }

    content = content.replace(/^\s*service_tier\s*=\s*["'][^"']*["']\s*\n?/gmi, '');
    if (tier !== 'fast') {
        return content;
    }

    content = content.replace(/^\s*\n*/, '');
    return `service_tier = "fast"\n${content}`;
}

function applyReasoningEffortToTemplate(template, reasoningEffort) {
    let content = typeof template === 'string' ? template : '';
    const effort = typeof reasoningEffort === 'string' ? reasoningEffort.trim().toLowerCase() : '';
    if (!effort) {
        return content;
    }

    content = content.replace(/^\s*model_reasoning_effort\s*=\s*["'][^"']*["']\s*\n?/gmi, '');
    if (effort === 'high' || effort === 'xhigh') {
        content = content.replace(/^\s*\n*/, '');
        return `model_reasoning_effort = "${effort}"\n${content}`;
    }
    return content;
}

function normalizePositiveIntegerParam(value) {
    if (value === undefined || value === null) {
        return null;
    }
    const text = typeof value === 'number'
        ? String(value)
        : (typeof value === 'string' ? value.trim() : String(value).trim());
    if (!text) {
        return null;
    }
    if (!/^\d+$/.test(text)) {
        return null;
    }
    const parsed = Number.parseInt(text, 10);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}

function applyPositiveIntegerConfigToTemplate(template, key, value) {
    let content = typeof template === 'string' ? template : '';
    const normalized = normalizePositiveIntegerParam(value);
    if (!key || normalized === null) {
        return content;
    }

    const hasBom = content.charCodeAt(0) === 0xFEFF;
    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    if (hasBom) {
        content = content.slice(1);
    }
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`^\\s*${escapedKey}\\s*=\\s*[^\\n]*\\n?`, 'gmi');
    content = content.replace(pattern, '');
    content = content.replace(new RegExp(`^(?:[\\t ]*${lineEnding})+`), '');
    return `${hasBom ? '\uFEFF' : ''}${key} = ${normalized}${lineEnding}${content}`;
}

function getConfigTemplate(params = {}) {
    let content = EMPTY_CONFIG_FALLBACK_TEMPLATE;
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
            if (raw && raw.trim()) {
                content = raw;
            }
        } catch (e) { }
    }
    if (
        params.modelAutoCompactTokenLimit !== undefined
        && params.modelAutoCompactTokenLimit !== null
        && normalizePositiveIntegerParam(params.modelAutoCompactTokenLimit) === null
    ) {
        return { error: 'modelAutoCompactTokenLimit must be a positive integer' };
    }
    if (
        params.modelContextWindow !== undefined
        && params.modelContextWindow !== null
        && normalizePositiveIntegerParam(params.modelContextWindow) === null
    ) {
        return { error: 'modelContextWindow must be a positive integer' };
    }
    const selectedProvider = typeof params.provider === 'string' ? params.provider.trim() : '';
    const selectedModel = typeof params.model === 'string' ? params.model.trim() : '';
    let template = normalizeTopLevelConfigWithTemplate(content, selectedProvider, selectedModel);
    if (typeof params.serviceTier === 'string') {
        template = applyServiceTierToTemplate(template, params.serviceTier);
    }
    if (typeof params.reasoningEffort === 'string') {
        template = applyReasoningEffortToTemplate(template, params.reasoningEffort);
    }
    if (!/^\s*model_auto_compact_token_limit\s*=.*$/m.test(template)) {
        template = applyPositiveIntegerConfigToTemplate(
            template,
            'model_auto_compact_token_limit',
            DEFAULT_MODEL_AUTO_COMPACT_TOKEN_LIMIT
        );
    }
    if (!/^\s*model_context_window\s*=.*$/m.test(template)) {
        template = applyPositiveIntegerConfigToTemplate(
            template,
            'model_context_window',
            DEFAULT_MODEL_CONTEXT_WINDOW
        );
    }
    if (params.modelAutoCompactTokenLimit !== undefined) {
        template = applyPositiveIntegerConfigToTemplate(
            template,
            'model_auto_compact_token_limit',
            params.modelAutoCompactTokenLimit
        );
    }
    if (params.modelContextWindow !== undefined) {
        template = applyPositiveIntegerConfigToTemplate(
            template,
            'model_context_window',
            params.modelContextWindow
        );
    }
    return {
        template
    };
}

function readPositiveIntegerConfigValue(config, key) {
    const options = arguments[2] && typeof arguments[2] === 'object' ? arguments[2] : {};
    const useDefaultsWhenMissing = options.useDefaultsWhenMissing !== false;
    if (!config || typeof config !== 'object' || !key) {
        return '';
    }
    const raw = config[key];
    if (raw === undefined && useDefaultsWhenMissing) {
        if (key === 'model_context_window') return DEFAULT_MODEL_CONTEXT_WINDOW;
        if (key === 'model_auto_compact_token_limit') return DEFAULT_MODEL_AUTO_COMPACT_TOKEN_LIMIT;
    }
    const normalized = normalizePositiveIntegerParam(raw);
    return normalized === null ? '' : normalized;
}

function applyConfigTemplate(params = {}) {
    const template = typeof params.template === 'string' ? params.template : '';
    if (!template.trim()) {
        return { error: '模板内容不能为空' };
    }

    let parsed;
    try {
        parsed = toml.parse(template);
    } catch (e) {
        return { error: `模板 TOML 解析失败: ${e.message}` };
    }

    if (
        Object.prototype.hasOwnProperty.call(parsed, 'model_context_window')
        && normalizePositiveIntegerParam(parsed.model_context_window) === null
    ) {
        return { error: '模板中的 model_context_window 必须是正整数' };
    }

    if (
        Object.prototype.hasOwnProperty.call(parsed, 'model_auto_compact_token_limit')
        && normalizePositiveIntegerParam(parsed.model_auto_compact_token_limit) === null
    ) {
        return { error: '模板中的 model_auto_compact_token_limit 必须是正整数' };
    }

    if (!parsed.model_provider || typeof parsed.model_provider !== 'string') {
        return { error: '模板缺少 model_provider' };
    }

    if (!parsed.model || typeof parsed.model !== 'string') {
        return { error: '模板缺少 model' };
    }

    if (!parsed.model_providers || typeof parsed.model_providers !== 'object') {
        return { error: '模板缺少 model_providers 配置块' };
    }

    const activeProvider = parsed.model_provider;
    const activeProviderBlock = parsed.model_providers[activeProvider];
    if (!activeProviderBlock || typeof activeProviderBlock !== 'object') {
        return { error: `模板中找不到当前 provider: ${activeProvider}` };
    }

    writeConfig(template.trim() + '\n');
    updateAuthJson(activeProviderBlock.preferred_auth_method || '');

    const models = readModels();
    if (!models.includes(parsed.model)) {
        models.push(parsed.model);
        writeModels(models);
    }

    const currentModels = readCurrentModels();
    currentModels[activeProvider] = parsed.model;
    writeCurrentModels(currentModels);

    recordRecentConfig(activeProvider, parsed.model);

    return { success: true };
}

function buildConfigTemplateDiff(params = {}) {
    const template = typeof params.template === 'string' ? params.template : '';
    if (!template.trim()) {
        return { error: '模板内容不能为空' };
    }

    // Validate template format (same constraints as apply) but do not write anything.
    let parsed;
    try {
        parsed = toml.parse(template);
    } catch (e) {
        return { error: `模板 TOML 解析失败: ${e.message}` };
    }

    if (
        Object.prototype.hasOwnProperty.call(parsed, 'model_context_window')
        && normalizePositiveIntegerParam(parsed.model_context_window) === null
    ) {
        return { error: '模板中的 model_context_window 必须是正整数' };
    }

    if (
        Object.prototype.hasOwnProperty.call(parsed, 'model_auto_compact_token_limit')
        && normalizePositiveIntegerParam(parsed.model_auto_compact_token_limit) === null
    ) {
        return { error: '模板中的 model_auto_compact_token_limit 必须是正整数' };
    }

    if (!parsed.model_provider || typeof parsed.model_provider !== 'string') {
        return { error: '模板缺少 model_provider' };
    }

    if (!parsed.model || typeof parsed.model !== 'string') {
        return { error: '模板缺少 model' };
    }

    if (!parsed.model_providers || typeof parsed.model_providers !== 'object') {
        return { error: '模板缺少 model_providers 配置块' };
    }

    const activeProvider = parsed.model_provider;
    const activeProviderBlock = parsed.model_providers[activeProvider];
    if (!activeProviderBlock || typeof activeProviderBlock !== 'object') {
        return { error: `模板中找不到当前 provider: ${activeProvider}` };
    }

    let beforeText = '';
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            beforeText = fs.readFileSync(CONFIG_FILE, 'utf-8');
        } catch (e) {
            return { error: `读取 config.toml 失败: ${e.message}` };
        }
    }
    const afterText = template.trim() + '\n';
    const diff = buildLineDiff(beforeText, afterText);
    const hasChanges = (diff.stats.added || 0) + (diff.stats.removed || 0) > 0;
    return {
        diff: {
            ...diff,
            hasChanges
        }
    };
}

function buildClaudeSettingsDiff(params = {}) {
    const content = typeof params.content === 'string' ? params.content : '';
    if (!content.trim()) {
        return { error: 'JSON 内容不能为空' };
    }
    if (content.length > 1024 * 1024) {
        return { error: '内容过大（最大 1MB）' };
    }
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        return { error: `JSON 解析失败: ${e.message}` };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { error: 'JSON 内容必须是一个对象' };
    }
    let beforeText = '';
    if (fs.existsSync(CLAUDE_SETTINGS_FILE)) {
        try {
            beforeText = fs.readFileSync(CLAUDE_SETTINGS_FILE, 'utf-8');
        } catch (e) {
            return { error: `读取 settings.json 失败: ${e.message}` };
        }
    }
    const afterText = JSON.stringify(parsed, null, 2) + '\n';
    const diff = buildLineDiff(beforeText, afterText);
    const hasChanges = (diff.stats.added || 0) + (diff.stats.removed || 0) > 0;
    return {
        diff: {
            ...diff,
            hasChanges
        }
    };
}


function normalizeOpenaiBridgeMaxRetries(value, fallback = 2) {
    const raw = Number(value);
    const fallbackRaw = Number(fallback);
    const base = Number.isFinite(raw) ? raw : (Number.isFinite(fallbackRaw) ? fallbackRaw : 2);
    return Math.min(10, Math.max(2, Math.floor(base)));
}

function resolveProviderOpenaiBridgeMaxRetries(provider) {
    if (!provider || typeof provider !== 'object') return 2;
    if (provider.codexmate_bridge_max_retries !== undefined) {
        return normalizeOpenaiBridgeMaxRetries(provider.codexmate_bridge_max_retries);
    }
    if (provider.openai_bridge_max_retries !== undefined) {
        return normalizeOpenaiBridgeMaxRetries(provider.openai_bridge_max_retries);
    }
    if (provider.max_retries !== undefined) {
        return normalizeOpenaiBridgeMaxRetries(provider.max_retries);
    }
    return 2;
}

function addProviderToConfig(params = {}) {
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    const url = typeof params.url === 'string' ? params.url.trim() : '';
    const key = typeof params.key === 'string' ? params.key.trim() : '';
    const requireModel = !!params.requireModel;
    const fallbackModel = (() => {
        if (requireModel) return '';
        const list = readModels();
        return Array.isArray(list) && typeof list[0] === 'string' ? list[0].trim() : '';
    })();
    const model = typeof params.model === 'string' && params.model.trim()
        ? params.model.trim()
        : fallbackModel;
    const useTransform = !!params.useTransform;
    const hasOpenaiBridgeMaxRetries = params.openaiBridgeMaxRetries !== undefined || params.maxRetries !== undefined;
    const openaiBridgeMaxRetries = normalizeOpenaiBridgeMaxRetries(params.openaiBridgeMaxRetries ?? params.maxRetries);
    const allowManaged = !!params.allowManaged;
    const normalizedUrl = normalizeBaseUrl(url);

    if (!name) return { error: '名称不能为空' };
    if (!url) return { error: 'URL 不能为空' };
    if (!model) return { error: '模型名称不能为空' };
    if (!isValidProviderName(name)) {
        return { error: '名称仅支持字母/数字/._-' };
    }
    if (!isValidHttpUrl(normalizedUrl)) {
        return { error: 'URL 仅支持 http/https' };
    }
    if (isReservedProviderNameForCreation(name)) {
        return { error: '提供商名称不可用' };
    }
    if (isBuiltinProxyProvider(name) && !allowManaged) {
        return { error: `${"codexmate-proxy"} 为保留名称，不可手动添加` }; // keep literal for codexmate-proxy
    }

    ensureConfigDir();

    let content = '';
    if (fs.existsSync(CONFIG_FILE)) {
        try {
            content = fs.readFileSync(CONFIG_FILE, 'utf-8');
        } catch (e) {
            return { error: `读取 config.toml 失败: ${e.message}` };
        }
    } else {
        content = EMPTY_CONFIG_FALLBACK_TEMPLATE;
    }

    if (!content || !content.trim()) {
        content = EMPTY_CONFIG_FALLBACK_TEMPLATE;
    }

    let parsed;
    try {
        parsed = toml.parse(content);
    } catch (e) {
        return { error: `config.toml 解析失败: ${e.message}` };
    }

    const providerHeaderSegmentKeySet = collectModelProviderHeaderSegmentKeySet(content);
    const normalizedProviders = isPlainObject(parsed.model_providers)
        ? normalizeLegacyModelProviders(parsed.model_providers, providerHeaderSegmentKeySet)
        : {};
    if (normalizedProviders && normalizedProviders[name]) {
        return { error: '提供商已存在' };
    }

    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    const safeName = escapeTomlBasicString(name);
    let baseUrlForConfig = normalizedUrl;
    let authKeyForConfig = key;
    const extraLines = [];

    if (useTransform) {
        const saveRes = upsertOpenaiBridgeProvider(OPENAI_BRIDGE_SETTINGS_FILE, name, normalizedUrl, key, undefined, { maxRetries: openaiBridgeMaxRetries });
        if (saveRes && saveRes.error) {
            return { error: String(saveRes.error) };
        }
        const port = resolveWebPort();
        // 通过 URL 构造避免出现重复 /（例如 /bridge/openai//v1）
        baseUrlForConfig = new URL(
            `/bridge/openai/${encodeURIComponent(name)}/v1`,
            `http://${DEFAULT_WEB_OPEN_HOST}:${port}`
        ).toString().replace(/\/+$/g, '');
        authKeyForConfig = 'codexmate';
        extraLines.push(`codexmate_bridge = "openai"`);
        extraLines.push(`codexmate_bridge_max_retries = ${openaiBridgeMaxRetries}`);
    }

    const safeUrl = escapeTomlBasicString(baseUrlForConfig);
    const safeKey = escapeTomlBasicString(authKeyForConfig);
    const block = [
        buildModelProviderTableHeader(name),
        `name = "${safeName}"`,
        `base_url = "${safeUrl}"`,
        `wire_api = "responses"`,
        `requires_openai_auth = true`,
        `preferred_auth_method = "${safeKey}"`,
        `models = [{ id = "${escapeTomlBasicString(model)}", name = "${escapeTomlBasicString(model)}" }]`,
        ...extraLines,
        `request_max_retries = 4`,
        `stream_max_retries = 10`,
        `stream_idle_timeout_ms = 300000`
    ].join(lineEnding);

    const newContent = content.trimEnd() + lineEnding + lineEnding + block + lineEnding;

    try {
        writeConfig(newContent);
        const models = readModels();
        if (!models.includes(model)) {
            writeModels([...models, model]);
        }
        const currentModels = readCurrentModels();
        currentModels[name] = model;
        writeCurrentModels(currentModels);
    } catch (e) {
        return { error: `写入配置失败: ${e.message}` };
    }

    return { success: true };
}

function updateProviderInConfig(params = {}) {
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    const url = typeof params.url === 'string' ? params.url.trim() : '';
    const key = params.key !== undefined && params.key !== null
        ? String(params.key).trim()
        : undefined;
    const useTransform = !!params.useTransform;
    const hasOpenaiBridgeMaxRetries = params.openaiBridgeMaxRetries !== undefined || params.maxRetries !== undefined;
    const openaiBridgeMaxRetries = normalizeOpenaiBridgeMaxRetries(params.openaiBridgeMaxRetries ?? params.maxRetries);
    const allowManaged = !!params.allowManaged;

    if (!name) return { error: '名称不能为空' };
    if (!url && key === undefined) {
        return { error: 'URL 或密钥至少填写一项' };
    }
    if (url && !isValidHttpUrl(normalizeBaseUrl(url))) {
        return { error: 'URL 仅支持 http/https' };
    }
    if (isNonEditableProvider(name) && !allowManaged) {
        return { error: `${name} 为保留名称，不可编辑` };
    }

    try {
        cmdUpdate(name, url || undefined, key, true, { allowManaged, useTransform, ...(hasOpenaiBridgeMaxRetries ? { openaiBridgeMaxRetries } : {}) });
        return { success: true };
    } catch (e) {
        return { error: e.message || '更新失败' };
    }
}


function redactProviderCacheValue(value) {
    const secretKeyPattern = /(?:^key$|api[_-]?key|auth[_-]?token|access[_-]?token|refresh[_-]?token|id[_-]?token|token|password|passwd|secret|credential|authorization|bearer|cookie|session|private[_-]?key|client[_-]?secret|x-api-key)/i;
    const secretQueryPattern = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|password|passwd|secret|credential|authorization|client[_-]?secret|key)/i;
    const secretValuePattern = /^(?:bearer\s+|sk-[A-Za-z0-9]|sk_[A-Za-z0-9]|gsk_|AIza|xox[baprs]-|gh[pousr]_|or-[A-Za-z0-9]|ds-[A-Za-z0-9])/i;
    const redactSecretString = (text) => String(text || '') ? '***' : '';
    const redactUrlString = (text) => {
        if (typeof text !== 'string' || !/^https?:\/\//i.test(text)) return text;
        try {
            const parsed = new URL(text);
            if (parsed.username) parsed.username = '***';
            if (parsed.password) parsed.password = '***';
            for (const key of Array.from(parsed.searchParams.keys())) {
                if (secretQueryPattern.test(key)) parsed.searchParams.set(key, '***');
            }
            return parsed.toString();
        } catch (_) {
            return text.replace(/([?&](?:api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|password|passwd|secret|credential|authorization|client[_-]?secret|key)=)[^&#]*/gi, '$1***');
        }
    };
    const visit = (input, key = '') => {
        if (secretKeyPattern.test(key)) {
            if (typeof input === 'boolean' || typeof input === 'number') return input;
            if (input === null || input === undefined || input === '') return input === undefined ? null : input;
            return redactSecretString(input);
        }
        if (Array.isArray(input)) {
            return input.map((item) => visit(item, key));
        }
        if (isPlainObject(input)) {
            const output = {};
            for (const [childKey, childValue] of Object.entries(input)) {
                output[childKey] = visit(childValue, childKey);
            }
            return output;
        }
        if (typeof input === 'string') {
            const urlRedacted = redactUrlString(input);
            if (urlRedacted !== input) return urlRedacted;
            if (secretValuePattern.test(input.trim())) return redactSecretString(input.trim());
        }
        return input;
    };
    return visit(value);
}

function getProviderCacheDisplayPath(fileName) {
    return `~/.codexmate/${fileName}`;
}

function sanitizeProviderCacheErrorMessage(message, fileName, fallback = '读取缓存文件失败') {
    const raw = typeof message === 'string' && message.trim() ? message : fallback;
    const displayPath = getProviderCacheDisplayPath(fileName);
    const absolutePath = path.join(CODEXMATE_DIR, fileName);
    return raw
        .split(absolutePath).join(displayPath)
        .split(CODEXMATE_DIR).join('~/.codexmate');
}

function pickProviderCacheString(source, keys) {
    if (!isPlainObject(source)) return '';
    for (const key of keys) {
        const value = source[key];
        if (typeof value === 'string' && value.trim()) return value.trim();
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    }
    return '';
}

function summarizeProviderCacheEntry(name, entry = {}) {
    const provider = isPlainObject(entry) ? entry : {};
    const providerName = pickProviderCacheString(provider, ['name', 'id', 'provider', 'title']) || String(name || '').trim() || 'provider';
    const baseUrl = pickProviderCacheString(provider, ['base_url', 'baseUrl', 'url', 'endpoint']);
    const wireApi = pickProviderCacheString(provider, ['wire_api', 'wireApi', 'api', 'type']);
    const authMethod = pickProviderCacheString(provider, ['preferred_auth_method', 'authMethod', 'auth_method']);
    const model = pickProviderCacheString(provider, ['model', 'default_model', 'defaultModel']);
    return {
        name: providerName,
        baseUrl: baseUrl ? redactProviderCacheValue(baseUrl) : '',
        wireApi,
        authMethod: authMethod ? redactProviderCacheValue(authMethod) : '',
        model,
        data: redactProviderCacheValue(provider)
    };
}

function extractProviderCacheSummaries(data) {
    const providers = [];
    const seen = new Set();
    const addProvider = (name, entry) => {
        const summary = summarizeProviderCacheEntry(name, entry);
        const key = `${summary.name}\u0000${summary.baseUrl}\u0000${summary.wireApi}`;
        if (seen.has(key)) return;
        seen.add(key);
        providers.push(summary);
    };
    const visitContainer = (container) => {
        if (!container) return;
        if (Array.isArray(container)) {
            for (const item of container) {
                if (!isPlainObject(item)) continue;
                addProvider(pickProviderCacheString(item, ['name', 'id', 'provider']) || `provider-${providers.length + 1}`, item);
            }
            return;
        }
        if (!isPlainObject(container)) return;
        for (const [name, entry] of Object.entries(container)) {
            if (isPlainObject(entry)) addProvider(name, entry);
        }
    };

    if (isPlainObject(data)) {
        visitContainer(data.providers);
        visitContainer(data.configs);
        visitContainer(data.providerConfigs);
        visitContainer(data.items);
        if (providers.length === 0 && (data.base_url || data.baseUrl || data.url || data.endpoint)) {
            addProvider(pickProviderCacheString(data, ['name', 'id', 'provider']) || 'default', data);
        }
    } else if (Array.isArray(data)) {
        visitContainer(data);
    }
    return providers.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function buildProviderCacheFileRecord(fileName) {
    const filePath = path.join(CODEXMATE_DIR, fileName);
    const displayPath = getProviderCacheDisplayPath(fileName);
    const record = {
        name: fileName,
        path: displayPath,
        displayPath,
        exists: false,
        ok: true,
        tooLarge: false,
        size: 0,
        mtime: '',
        data: null,
        providers: [],
        providerCount: 0,
        error: ''
    };
    if (!fs.existsSync(filePath)) {
        return record;
    }
    record.exists = true;
    try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) {
            record.ok = false;
            record.error = '缓存路径不是普通文件，已跳过读取';
            return record;
        }
        record.size = Number(stat.size) || 0;
        record.mtime = stat.mtime instanceof Date && !Number.isNaN(stat.mtime.getTime())
            ? stat.mtime.toISOString()
            : '';
    } catch (e) {
        record.ok = false;
        record.error = sanitizeProviderCacheErrorMessage(e && e.message ? e.message : String(e || '读取缓存文件状态失败'), fileName, '读取缓存文件状态失败');
        return record;
    }
    if (record.size > PROVIDER_CACHE_MAX_FILE_BYTES) {
        record.ok = false;
        record.tooLarge = true;
        record.error = `缓存文件过大，已跳过 JSON 读取（${record.size} bytes > ${PROVIDER_CACHE_MAX_FILE_BYTES} bytes）`;
        return record;
    }
    try {
        const content = stripUtf8Bom(fs.readFileSync(filePath, 'utf-8'));
        const parsed = content.trim() ? JSON.parse(content) : null;
        record.data = redactProviderCacheValue(parsed);
        record.providers = extractProviderCacheSummaries(parsed);
        record.providerCount = record.providers.length;
    } catch (e) {
        record.ok = false;
        record.error = sanitizeProviderCacheErrorMessage(e && e.message ? e.message : String(e || '读取缓存文件失败'), fileName);
    }
    return record;
}

function listProviderCacheFileNamesForGroup(groupKey) {
    const defaults = PROVIDER_CACHE_FILE_GROUPS[groupKey] || [];
    const names = new Set(defaults);
    try {
        if (fs.existsSync(CODEXMATE_DIR)) {
            for (const fileName of fs.readdirSync(CODEXMATE_DIR)) {
                if (typeof fileName !== 'string' || !fileName.endsWith('.json')) continue;
                if (groupKey === 'opencode' && /^opencode[-_]/i.test(fileName)) {
                    names.add(fileName);
                }
            }
        }
    } catch (_) {}
    return Array.from(names).sort((a, b) => a.localeCompare(b));
}

function readProviderCacheRecords() {
    const groupLabels = {
        claude: 'Claude',
        codex: 'Codex',
        opencode: 'OpenCode'
    };
    const groups = Object.keys(PROVIDER_CACHE_FILE_GROUPS).map((key) => {
        const files = listProviderCacheFileNamesForGroup(key).map((fileName) => buildProviderCacheFileRecord(fileName));
        return {
            key,
            label: groupLabels[key] || key,
            files,
            existingCount: files.filter((file) => file && file.exists).length
        };
    });
    return {
        root: '~/.codexmate',
        maxFileBytes: PROVIDER_CACHE_MAX_FILE_BYTES,
        generatedAt: new Date().toISOString(),
        groups
    };
}

function readProviderCacheJsonObject(fileName) {
    const filePath = path.join(CODEXMATE_DIR, fileName);
    try {
        if (!fs.existsSync(filePath)) return {};
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) return {};
        const parsed = JSON.parse(stripUtf8Bom(fs.readFileSync(filePath, 'utf-8')) || '{}');
        return isPlainObject(parsed) ? parsed : {};
    } catch (_) {
        return {};
    }
}

function writeProviderCacheJsonObject(fileName, data) {
    ensureDir(CODEXMATE_DIR);
    const filePath = path.join(CODEXMATE_DIR, fileName);
    writeJsonAtomic(filePath, isPlainObject(data) ? data : {});
    try {
        fs.chmodSync(filePath, 0o600);
    } catch (_) {}
    return getProviderCacheDisplayPath(fileName);
}

function normalizeProviderCacheProviderMap(rawProviders) {
    const providers = {};
    if (Array.isArray(rawProviders)) {
        for (const item of rawProviders) {
            if (!isPlainObject(item)) continue;
            const name = pickProviderCacheString(item, ['name', 'id', 'provider']);
            if (name) providers[name] = item;
        }
        return providers;
    }
    if (isPlainObject(rawProviders)) {
        for (const [name, entry] of Object.entries(rawProviders)) {
            if (isPlainObject(entry)) providers[name] = entry;
        }
    }
    return providers;
}

function removeProviderFromProviderCacheContainer(rawProviders, providerName) {
    const targetName = typeof providerName === 'string' ? providerName.trim() : '';
    if (!targetName) return { value: rawProviders, changed: false };

    const matchesProviderName = (name) => String(name || '').trim() === targetName;
    if (Array.isArray(rawProviders)) {
        const filtered = rawProviders.filter((item) => {
            if (!isPlainObject(item)) return true;
            const itemName = pickProviderCacheString(item, ['name', 'id', 'provider']);
            return !matchesProviderName(itemName);
        });
        return { value: filtered, changed: filtered.length !== rawProviders.length };
    }
    if (!isPlainObject(rawProviders)) return { value: rawProviders, changed: false };

    const next = { ...rawProviders };
    let changed = false;
    for (const [name, entry] of Object.entries(rawProviders)) {
        const entryName = isPlainObject(entry)
            ? pickProviderCacheString(entry, ['name', 'id', 'provider'])
            : '';
        if (matchesProviderName(name) || matchesProviderName(entryName)) {
            delete next[name];
            changed = true;
        }
    }
    return { value: next, changed };
}

function resolveProviderCacheDeleteGroups(groups) {
    const requested = Array.isArray(groups) ? groups : (groups ? [groups] : []);
    const normalized = requested
        .map((item) => String(item || '').trim().toLowerCase())
        .filter((item) => Object.prototype.hasOwnProperty.call(PROVIDER_CACHE_FILE_GROUPS, item));
    return normalized.length ? Array.from(new Set(normalized)) : Object.keys(PROVIDER_CACHE_FILE_GROUPS);
}

function removeProviderFromProviderCacheRecords(providerName, options = {}) {
    const targetName = typeof providerName === 'string' ? providerName.trim() : '';
    const summary = { removed: false, providerFiles: [], currentModelFiles: [] };
    if (!targetName) return summary;

    const groups = resolveProviderCacheDeleteGroups(options.groups || options.group);
    const providerFiles = groups
        .flatMap((group) => PROVIDER_CACHE_FILE_GROUPS[group] || [])
        .filter((fileName) => PROVIDER_CACHE_PROVIDER_FILES.includes(fileName));
    const currentModelFiles = groups
        .flatMap((group) => PROVIDER_CACHE_FILE_GROUPS[group] || [])
        .filter((fileName) => PROVIDER_CACHE_CURRENT_MODEL_FILES.includes(fileName));

    for (const fileName of Array.from(new Set(providerFiles))) {
        const existing = readProviderCacheJsonObject(fileName);
        if (!isPlainObject(existing) || !Object.prototype.hasOwnProperty.call(existing, 'providers')) continue;
        const removed = removeProviderFromProviderCacheContainer(existing.providers, targetName);
        if (!removed.changed) continue;
        writeProviderCacheJsonObject(fileName, {
            ...existing,
            generatedAt: new Date().toISOString(),
            providers: removed.value
        });
        summary.removed = true;
        summary.providerFiles.push(fileName);
    }

    for (const fileName of Array.from(new Set(currentModelFiles))) {
        const existing = readProviderCacheJsonObject(fileName);
        if (!isPlainObject(existing) || !Object.prototype.hasOwnProperty.call(existing, targetName)) continue;
        const next = { ...existing };
        delete next[targetName];
        writeProviderCacheJsonObject(fileName, next);
        summary.removed = true;
        summary.currentModelFiles.push(fileName);
    }
    return summary;
}

function deleteProviderCacheRecord(params = {}) {
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    if (!name) return { error: '名称不能为空' };
    const group = typeof params.group === 'string' ? params.group.trim().toLowerCase() : '';
    const groups = resolveProviderCacheDeleteGroups(group || params.groups);
    const summary = removeProviderFromProviderCacheRecords(name, { groups });
    return {
        success: true,
        name,
        groups,
        removed: summary.removed,
        providerFiles: summary.providerFiles,
        currentModelFiles: summary.currentModelFiles,
        records: readProviderCacheRecords()
    };
}

function readClaudeProviderCacheProvider(name) {
    const targetName = typeof name === 'string' ? name.trim() : '';
    if (!targetName) return null;
    const cached = normalizeProviderCacheProviderMap(readProviderCacheJsonObject('claude-providers.json').providers);
    const entry = cached[targetName];
    return isPlainObject(entry) ? { name: targetName, ...entry } : null;
}

function readClaudeProviderCacheConfigs() {
    const cached = normalizeProviderCacheProviderMap(readProviderCacheJsonObject('claude-providers.json').providers);
    const providers = [];
    for (const [name, entry] of Object.entries(cached)) {
        if (!name || !isPlainObject(entry)) continue;
        const baseUrl = typeof entry.baseUrl === 'string' ? entry.baseUrl.trim() : '';
        const model = typeof entry.model === 'string' ? entry.model.trim() : '';
        if (!baseUrl || !model) continue;
        providers.push({
            name,
            baseUrl,
            model,
            targetApi: normalizeClaudeTargetApi(entry.targetApi),
            hasKey: typeof entry.apiKey === 'string' && entry.apiKey.trim().length > 0,
            providerCacheRef: name,
            source: 'provider-cache'
        });
    }
    return { providers: providers.sort((a, b) => a.name.localeCompare(b.name)) };
}

function buildProviderCacheSyncProviders() {
    const configResult = readConfigOrVirtualDefault();
    if (hasConfigLoadError(configResult)) {
        return { error: (configResult.error && configResult.error.configPublicReason) || '读取 config.toml 失败' };
    }
    const config = configResult.config || {};
    const providers = isPlainObject(config.model_providers) ? config.model_providers : {};
    const currentModels = readCurrentModels();
    const activeProvider = typeof config.model_provider === 'string' ? config.model_provider.trim() : '';
    const activeModel = typeof config.model === 'string' ? config.model.trim() : '';
    const syncProviders = [];

    for (const [name, provider] of Object.entries(providers)) {
        if (!name || !isPlainObject(provider) || isBuiltinManagedProvider(name)) continue;
        const bridgeType = typeof provider.codexmate_bridge === 'string' ? provider.codexmate_bridge.trim() : '';
        const isOpenaiBridgeProvider = bridgeType === 'openai'
            || (typeof provider.base_url === 'string' && provider.base_url.includes('/bridge/openai/'));
        let baseUrl = typeof provider.base_url === 'string' ? provider.base_url.trim() : '';
        let apiKey = typeof provider.preferred_auth_method === 'string' ? provider.preferred_auth_method : '';
        if (isOpenaiBridgeProvider) {
            const upstream = resolveOpenaiBridgeUpstream(OPENAI_BRIDGE_SETTINGS_FILE, name);
            if (upstream && !upstream.error) {
                baseUrl = upstream.baseUrl || baseUrl;
                apiKey = upstream.apiKey || apiKey;
            }
        }
        const wireApi = typeof provider.wire_api === 'string' && provider.wire_api.trim()
            ? provider.wire_api.trim()
            : 'responses';
        const model = typeof currentModels[name] === 'string' && currentModels[name].trim()
            ? currentModels[name].trim()
            : (activeProvider === name ? activeModel : '');
        syncProviders.push({
            name,
            baseUrl,
            apiKey,
            wireApi,
            model,
            bridge: bridgeType || (isOpenaiBridgeProvider ? 'openai' : '')
        });
    }
    return { providers: syncProviders.sort((a, b) => a.name.localeCompare(b.name)) };
}

function mergeProviderCacheFile(fileName, nextProviders, buildEntry) {
    const existing = readProviderCacheJsonObject(fileName);
    const existingProviders = normalizeProviderCacheProviderMap(existing.providers);
    const providers = {};
    for (const provider of nextProviders) {
        const previous = isPlainObject(providers[provider.name]) ? providers[provider.name] : {};
        const cachedPrevious = isPlainObject(existingProviders[provider.name]) ? existingProviders[provider.name] : previous;
        providers[provider.name] = { ...cachedPrevious, ...buildEntry(provider) };
    }
    const next = {
        ...existing,
        version: Number(existing.version) > 0 ? Number(existing.version) : 1,
        generatedAt: new Date().toISOString(),
        providers
    };
    const displayPath = writeProviderCacheJsonObject(fileName, next);
    return { path: displayPath, providerCount: Object.keys(providers).length };
}

function mergeProviderCacheCurrentModelsFile(fileName, nextProviders) {
    const existing = readProviderCacheJsonObject(fileName);
    const next = {};
    for (const provider of nextProviders) {
        if (provider.model) {
            next[provider.name] = provider.model;
        } else if (typeof existing[provider.name] === 'string' && existing[provider.name].trim()) {
            next[provider.name] = existing[provider.name];
        }
    }
    const displayPath = writeProviderCacheJsonObject(fileName, next);
    return { path: displayPath, modelCount: Object.keys(next).length };
}

function syncProviderCacheRecords() {
    const built = buildProviderCacheSyncProviders();
    if (built.error) return { error: built.error };
    const providers = built.providers || [];
    if (providers.length === 0) {
        return { errorKey: 'modal.providerCache.noSyncableProviders', error: 'No syncable providers' };
    }

    const writtenFiles = [];
    writtenFiles.push(mergeProviderCacheFile('codex-providers.json', providers, (provider) => ({
        name: provider.name,
        base_url: provider.baseUrl,
        wire_api: provider.wireApi,
        preferred_auth_method: provider.apiKey,
        model: provider.model,
        ...(provider.bridge ? { codexmate_bridge: provider.bridge } : {})
    })));
    writtenFiles.push(mergeProviderCacheCurrentModelsFile('codex-provider-current-models.json', providers));
    writtenFiles.push(mergeProviderCacheFile('claude-providers.json', providers, (provider) => ({
        name: provider.name,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: provider.model,
        targetApi: normalizeClaudeTargetApi(provider.wireApi),
        ...(provider.bridge ? { bridge: provider.bridge } : {})
    })));
    writtenFiles.push(mergeProviderCacheFile('opencode-providers.json', providers, (provider) => ({
        name: provider.name,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: provider.model,
        disabled: false,
        ...(provider.bridge ? { bridge: provider.bridge } : {})
    })));
    writtenFiles.push(mergeProviderCacheCurrentModelsFile('opencode-provider-current-models.json', providers));

    return {
        success: true,
        summary: {
            providerCount: providers.length,
            fileCount: writtenFiles.length,
            writtenFiles
        },
        records: readProviderCacheRecords()
    };
}

function getProviderKey(params = {}) {
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    if (!name) return { error: '名称不能为空' };
    try {
        const config = readConfig();
        const provider = config.model_providers && config.model_providers[name];
        if (!provider) return { error: '提供商不存在' };

        const bridge = typeof provider.codexmate_bridge === 'string' ? provider.codexmate_bridge.trim() : '';
        const isTransform = bridge === 'openai' || String(provider.base_url || '').includes('/bridge/openai/');
        if (isTransform) {
            const settings = readOpenaiBridgeSettings(OPENAI_BRIDGE_SETTINGS_FILE);
            const entry = settings.providers ? settings.providers[name] : null;
            const key = entry && typeof entry.apiKey === 'string' ? entry.apiKey : '';
            return { key };
        }

        const key = typeof provider.preferred_auth_method === 'string' ? provider.preferred_auth_method : '';
        return { key };
    } catch (e) {
        return { error: e.message || '读取失败' };
    }
}

function deleteProviderFromConfig(params = {}) {
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    if (!name) return { error: '名称不能为空' };
    if (isNonDeletableProvider(name)) {
        return { error: `${name} 为保留名称，不可删除` };
    }
    if (!fs.existsSync(CONFIG_FILE)) {
        return { error: 'config.toml 不存在' };
    }

    let config;
    try {
        config = readConfig();
    } catch (e) {
        return { error: `读取配置失败: ${e.message}` };
    }

    const result = performProviderDeletion(name, { silent: true, config });
    if (result.error) {
        return { error: result.error };
    }
    return {
        success: true,
        switched: !!result.switched,
        provider: result.provider || '',
        model: result.model || ''
    };
}

function performProviderDeletion(name, options = {}) {
    const silent = !!options.silent;
    if (isNonDeletableProvider(name)) {
        const msg = `${name} 为保留名称，不可删除`;
        if (!silent) console.error('错误:', msg);
        return { error: msg };
    }
    const config = options.config || readConfig();
    if (!config.model_providers || !config.model_providers[name]) {
        const msg = '提供商不存在';
        if (!silent) console.error('错误:', msg, name);
        return { error: msg };
    }

    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
    const hasBom = content.charCodeAt(0) === 0xFEFF;
    const providerConfig = config.model_providers[name];
    const providerSegments = providerConfig && Array.isArray(providerConfig.__codexmate_legacy_segments)
        ? providerConfig.__codexmate_legacy_segments
        : null;
    const providerSegmentVariants = (() => {
        const variants = [];
        const seen = new Set();
        const pushVariant = (segments) => {
            const normalized = normalizeLegacySegments(segments);
            const key = buildLegacySegmentsKey(normalized);
            if (!key || seen.has(key)) return;
            seen.add(key);
            variants.push(normalized);
        };
        if (providerConfig && Array.isArray(providerConfig.__codexmate_legacy_segments)) {
            pushVariant(providerConfig.__codexmate_legacy_segments);
        }
        if (providerConfig && Array.isArray(providerConfig.__codexmate_legacy_segment_variants)) {
            for (const segments of providerConfig.__codexmate_legacy_segment_variants) {
                pushVariant(segments);
            }
        }
        if (providerSegments) {
            pushVariant(providerSegments);
        }
        if (variants.length === 0) {
            pushVariant(String(name || '').split('.').filter((item) => item));
        }
        return variants;
    })();

    const remainingProviders = Object.keys(config.model_providers || {}).filter(item => item !== name);
    if (remainingProviders.length === 0) {
        const msg = '删除后将没有可用提供商';
        if (!silent) console.error('错误:', msg);
        return { error: msg };
    }

    const currentProvider = typeof config.model_provider === 'string' ? config.model_provider.trim() : '';
    const currentModels = readCurrentModels();
    const models = readModels();
    const result = { success: true, switched: false, provider: '', model: '' };

    if (currentModels[name]) {
        delete currentModels[name];
    }

    let fallbackProvider = currentProvider;
    let fallbackModel = typeof config.model === 'string' ? config.model.trim() : '';
    if (currentProvider === name) {
        fallbackProvider = remainingProviders[0];
        fallbackModel = currentModels[fallbackProvider]
            || (Array.isArray(models) && models.length > 0 ? models[0] : (DEFAULT_MODELS[0] || ''));
        result.switched = true;
        result.provider = fallbackProvider;
        result.model = fallbackModel;
    }

    const upsertTopLevel = (text, key, value) => {
        if (!value && value !== '') return text;
        const regex = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
        if (regex.test(text)) {
            return text.replace(regex, `${key} = "${value}"`);
        }
        return `${key} = "${value}"${lineEnding}${text}`;
    };

    let updatedContent = null;
    const combinedRanges = [];
    for (const segments of providerSegmentVariants) {
        combinedRanges.push(...findProviderSectionRanges(content, name, segments));
        combinedRanges.push(...findProviderDescendantSectionRanges(content, segments));
    }
    if (combinedRanges.length === 0) {
        combinedRanges.push(...findProviderSectionRanges(content, name, providerSegments));
    }
    if (combinedRanges.length > 0) {
        const sorted = combinedRanges.sort((a, b) => b.start - a.start || b.end - a.end);
        const seen = new Set();
        let removedContent = content;
        for (const range of sorted) {
            const rangeKey = `${range.start}:${range.end}`;
            if (seen.has(rangeKey)) continue;
            seen.add(rangeKey);
            removedContent = removedContent.slice(0, range.start) + removedContent.slice(range.end);
        }
        updatedContent = removedContent.replace(/\n{3,}/g, lineEnding + lineEnding);
    }

    if (updatedContent) {
        if (result.switched) {
            updatedContent = upsertTopLevel(updatedContent, 'model_provider', fallbackProvider);
            updatedContent = upsertTopLevel(updatedContent, 'model', fallbackModel);
            currentModels[fallbackProvider] = fallbackModel;
        }
    } else {
        // 回退：重建 TOML，保持行尾风格
        const rebuilt = JSON.parse(JSON.stringify(config));
        delete rebuilt.model_providers[name];
        if (result.switched) {
            rebuilt.model_provider = fallbackProvider;
            rebuilt.model = fallbackModel;
            currentModels[fallbackProvider] = fallbackModel;
        }
        const hasMarker = content.includes(CODEXMATE_MANAGED_MARKER);
        let rebuiltToml = toml.stringify(rebuilt).trimEnd();
        rebuiltToml = rebuiltToml.replace(/\n/g, lineEnding);
        if (hasMarker && !rebuiltToml.includes(CODEXMATE_MANAGED_MARKER)) {
            rebuiltToml = `${CODEXMATE_MANAGED_MARKER}${lineEnding}${rebuiltToml}`;
        }
        updatedContent = rebuiltToml + lineEnding;
        if (hasBom && updatedContent.charCodeAt(0) !== 0xFEFF) {
            updatedContent = '\uFEFF' + updatedContent;
        }
    }

    writeCurrentModels(currentModels);
    writeConfig(updatedContent.trimEnd() + lineEnding);
    removeProviderFromProviderCacheRecords(name);

    return result;
}


function normalizePathForCompare(targetPath, options = {}) {
    const ignoreCase = !!options.ignoreCase;
    let resolved = '';
    try {
        resolved = fs.realpathSync.native ? fs.realpathSync.native(targetPath) : fs.realpathSync(targetPath);
    } catch (e) {
        resolved = path.resolve(targetPath);
    }
    return ignoreCase ? resolved.toLowerCase() : resolved;
}

function isPathInside(targetPath, rootPath) {
    if (!targetPath || !rootPath) {
        return false;
    }
    const ignoreCase = process.platform === 'win32';
    const resolvedTarget = normalizePathForCompare(targetPath, { ignoreCase });
    const resolvedRoot = normalizePathForCompare(rootPath, { ignoreCase });
    if (resolvedTarget === resolvedRoot) {
        return true;
    }
    const separator = resolvedRoot.includes('/') && !resolvedRoot.includes('\\') ? '/' : path.sep;
    const rootWithSlash = resolvedRoot.endsWith(separator) ? resolvedRoot : resolvedRoot + separator;
    return resolvedTarget.startsWith(rootWithSlash);
}

function resolveCopyTargetRoot(targetDir) {
    const base = typeof targetDir === 'string' ? targetDir.trim() : '';
    const pathApi = base.includes('/') && !base.includes('\\') && path.posix ? path.posix : path;
    const suffixSegments = [];
    let current = pathApi.resolve(base || '');
    while (current && !fs.existsSync(current)) {
        const parent = pathApi.dirname(current);
        if (!parent || parent === current) {
            break;
        }
        suffixSegments.unshift(pathApi.basename(current));
        current = parent;
    }
    let resolvedRoot = normalizePathForCompare(current || base);
    if (!resolvedRoot) {
        resolvedRoot = pathApi.resolve(base || '');
    }
    for (const segment of suffixSegments) {
        resolvedRoot = pathApi.join(resolvedRoot, segment);
    }
    return resolvedRoot;
}

function collectJsonlFiles(rootDir, maxFiles = 5000) {
    if (!fs.existsSync(rootDir)) {
        return [];
    }

    const stack = [rootDir];
    const files = [];
    while (stack.length > 0 && files.length < maxFiles) {
        const dir = stack.pop();
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
                files.push(fullPath);
            }

            if (files.length >= maxFiles) {
                break;
            }
        }
    }

    return files;
}

function readJsonlRecords(filePath) {
    let content = '';
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        return [];
    }

    const records = [];
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            records.push(JSON.parse(trimmed));
        } catch (e) { }
    }
    return records;
}

function getFileHeadText(filePath, maxBytes = SESSION_SUMMARY_READ_BYTES) {
    let fd;
    try {
        fd = fs.openSync(filePath, 'r');
        const stat = fs.fstatSync(fd);
        const size = Math.min(maxBytes, stat.size);
        if (size <= 0) {
            return '';
        }

        const buffer = Buffer.alloc(size);
        fs.readSync(fd, buffer, 0, size, 0);
        return buffer.toString('utf-8');
    } catch (e) {
        return '';
    } finally {
        if (fd !== undefined) {
            try { fs.closeSync(fd); } catch (e) { }
        }
    }
}

function getFileTailText(filePath, maxBytes = SESSION_USAGE_TAIL_READ_BYTES) {
    let fd;
    try {
        fd = fs.openSync(filePath, 'r');
        const stat = fs.fstatSync(fd);
        const size = Math.min(maxBytes, stat.size);
        if (size <= 0) {
            return '';
        }

        const start = Math.max(0, stat.size - size);
        const buffer = Buffer.alloc(size);
        fs.readSync(fd, buffer, 0, size, start);
        let text = buffer.toString('utf-8');
        if (start > 0) {
            const newlineIndex = text.indexOf('\n');
            text = newlineIndex >= 0 ? text.slice(newlineIndex + 1) : '';
        }
        return text;
    } catch (e) {
        return '';
    } finally {
        if (fd !== undefined) {
            try { fs.closeSync(fd); } catch (e) { }
        }
    }
}

function parseJsonlContent(content) {
    if (!content) {
        return [];
    }

    const records = [];
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            records.push(JSON.parse(trimmed));
        } catch (e) { }
    }
    return records;
}

function parseJsonlHeadRecords(filePath, maxBytes = SESSION_SUMMARY_READ_BYTES) {
    const headText = getFileHeadText(filePath, maxBytes);
    if (!headText) {
        return [];
    }

    return parseJsonlContent(headText);
}

function parseJsonlTailRecords(filePath, maxBytes = SESSION_USAGE_TAIL_READ_BYTES) {
    const tailText = getFileTailText(filePath, maxBytes);
    if (!tailText) {
        return [];
    }

    return parseJsonlContent(tailText);
}

function buildClaudeStoredIndexMessageCount(messageCount) {
    const safeCount = Number.isFinite(Number(messageCount))
        ? Math.max(0, Math.floor(Number(messageCount)))
        : 0;
    return safeCount + 1;
}

function getFileMtimeMs(filePath, stat = null) {
    const fileStat = stat || getFileStatSafe(filePath);
    if (!fileStat || !Number.isFinite(Number(fileStat.mtimeMs))) {
        return 0;
    }
    return Math.max(0, Math.floor(Number(fileStat.mtimeMs)));
}

function isSessionSummaryMessageCountExact(stat, maxBytes = SESSION_SUMMARY_READ_BYTES) {
    if (!stat || !Number.isFinite(Number(stat.size))) {
        return false;
    }
    return Number(stat.size) <= maxBytes;
}

function buildExactMessageCountCacheKey(filePath, source, stat = null) {
    const validSource = source === 'claude' ? 'claude' : (source === 'codex' ? 'codex' : '');
    if (!validSource || !filePath) {
        return '';
    }
    const mtimeMs = getFileMtimeMs(filePath, stat);
    if (!mtimeMs) {
        return '';
    }
    return `${validSource}:${path.resolve(filePath)}:${mtimeMs}`;
}

function readExactMessageCountCache(filePath, source, stat = null) {
    const cacheKey = buildExactMessageCountCacheKey(filePath, source, stat);
    if (!cacheKey) {
        return null;
    }
    if (!g_exactMessageCountCache.has(cacheKey)) {
        return null;
    }
    const cached = g_exactMessageCountCache.get(cacheKey);
    g_exactMessageCountCache.delete(cacheKey);
    g_exactMessageCountCache.set(cacheKey, cached);
    return Number.isFinite(Number(cached)) ? Math.max(0, Math.floor(Number(cached))) : null;
}

function writeExactMessageCountCache(filePath, source, messageCount, stat = null) {
    const cacheKey = buildExactMessageCountCacheKey(filePath, source, stat);
    const safeCount = Number.isFinite(Number(messageCount))
        ? Math.max(0, Math.floor(Number(messageCount)))
        : null;
    if (!cacheKey || safeCount === null) {
        return;
    }
    if (g_exactMessageCountCache.has(cacheKey)) {
        g_exactMessageCountCache.delete(cacheKey);
    }
    g_exactMessageCountCache.set(cacheKey, safeCount);
    if (g_exactMessageCountCache.size <= EXACT_MESSAGE_COUNT_CACHE_MAX_ENTRIES) {
        return;
    }
    const firstKey = g_exactMessageCountCache.keys().next().value;
    if (firstKey) {
        g_exactMessageCountCache.delete(firstKey);
    }
}

async function mapWithConcurrency(items, concurrency, mapper) {
    const list = Array.isArray(items) ? items : [];
    if (list.length === 0) {
        return [];
    }
    const safeConcurrency = Math.max(1, Math.min(Math.floor(Number(concurrency)) || 1, list.length));
    const results = new Array(list.length);
    let nextIndex = 0;
    const workers = Array.from({ length: safeConcurrency }, async () => {
        while (nextIndex < list.length) {
            const currentIndex = nextIndex;
            nextIndex += 1;
            results[currentIndex] = await mapper(list[currentIndex], currentIndex);
        }
    });
    await Promise.all(workers);
    return results.filter((item) => item !== undefined);
}

function countConversationMessagesInRecords(records, source) {
    const messages = [];
    for (const record of records) {
        if (source === 'codex') {
            if (record.type === 'response_item' && record.payload && record.payload.type === 'message') {
                const role = normalizeRole(record.payload.role);
                if (role === 'assistant' || role === 'user' || role === 'system') {
                    messages.push({
                        role,
                        text: extractMessageText(record.payload.content)
                    });
                }
            }
            continue;
        }
        if (source === 'codebuddy') {
            if (record && record.type === 'message') {
                const role = normalizeRole(record.role);
                if (role === 'assistant' || role === 'user' || role === 'system') {
                    const content = record.message?.content ?? record.content ?? '';
                    messages.push({
                        role,
                        text: extractMessageText(content)
                    });
                }
            }
            continue;
        }

        const role = normalizeRole(record.type);
        if (role === 'assistant' || role === 'user' || role === 'system') {
            const content = record.message ? record.message.content : '';
            messages.push({
                role,
                text: extractMessageText(content)
            });
        }
    }

    return removeLeadingSystemMessage(messages).length;
}

async function countConversationMessagesInFile(filePath, source) {
    const fileStat = getFileStatSafe(filePath);
    const cached = readExactMessageCountCache(filePath, source, fileStat);
    if (cached !== null) {
        return cached;
    }

    if (source === 'gemini') {
        let json;
        try {
            json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (_) {
            json = null;
        }
        const rawMessages = json && Array.isArray(json.messages) ? json.messages : [];
        const messages = [];
        for (const entry of rawMessages) {
            if (!entry || typeof entry !== 'object') continue;
            const role = normalizeGeminiMessageRole(entry.type);
            if (!role) continue;
            const text = extractMessageText(extractGeminiMessageText(entry.content ?? entry.message ?? entry.text));
            if (!text && role !== 'system') continue;
            messages.push({ role, text });
        }
        const safeCount = removeLeadingSystemMessage(messages).length;
        writeExactMessageCountCache(filePath, source, safeCount, fileStat);
        return safeCount;
    }

    let stream;
    let rl;
    let messageCount = 0;
    let leadingSystem = true;

    try {
        stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

        for await (const line of rl) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            let record;
            try {
                record = JSON.parse(trimmed);
            } catch (e) {
                continue;
            }

            let role = '';
            let text = '';
            if (source === 'codex') {
                if (record.type === 'response_item' && record.payload && record.payload.type === 'message') {
                    role = normalizeRole(record.payload.role);
                    text = extractMessageText(record.payload.content);
                }
            } else if (source === 'codebuddy') {
                if (record && record.type === 'message') {
                    role = normalizeRole(record.role);
                    if (role === 'assistant' || role === 'user' || role === 'system') {
                        text = extractMessageText(record.message?.content ?? record.content ?? '');
                    } else {
                        role = '';
                    }
                }
            } else if (source === 'pi') {
                if (record && record.type === 'message' && record.message && typeof record.message === 'object') {
                    role = normalizeRole(record.message.role);
                    if (role === 'assistant' || role === 'user' || role === 'system') {
                        text = extractMessageText(record.message.content);
                    } else {
                        role = '';
                    }
                }
            } else {
                role = normalizeRole(record.type);
                if (role === 'assistant' || role === 'user' || role === 'system') {
                    const content = record.message ? record.message.content : '';
                    text = extractMessageText(content);
                } else {
                    role = '';
                }
            }
            if (!role) {
                continue;
            }

            const hasText = text.length > 0;
            if (leadingSystem && (role === 'system' || (hasText && isBootstrapLikeText(text)))) {
                continue;
            }

            leadingSystem = false;
            messageCount += 1;
        }
        const safeCount = Math.max(0, messageCount);
        writeExactMessageCountCache(filePath, source, safeCount, fileStat);
        return safeCount;
    } catch (e) {
        const safeCount = countConversationMessagesInRecords(readJsonlRecords(filePath), source);
        writeExactMessageCountCache(filePath, source, safeCount, fileStat);
        return safeCount;
    } finally {
        if (rl) {
            try { rl.close(); } catch (e) { }
        }
        if (stream && !stream.destroyed && stream.destroy) {
            try { stream.destroy(); } catch (e) { }
        }
    }
}

function extractSessionDetailPreviewFromRecords(records, source, messageLimit) {
    const safeMessageLimit = Number.isFinite(Number(messageLimit))
        ? Math.max(1, Math.floor(Number(messageLimit)))
        : DEFAULT_SESSION_DETAIL_MESSAGES;
    const state = {
        sessionId: '',
        cwd: '',
        updatedAt: '',
        messages: [],
        tailLimit: safeMessageLimit,
        totalMessages: 0,
        leadingSystem: true
    };

    for (let lineIndex = 0; lineIndex < records.length; lineIndex++) {
        const record = records[lineIndex];
        applySessionDetailRecordMetadata(record, source, state);
        appendSessionDetailTailMessage(state, record, source, lineIndex);
    }

    return state;
}

async function extractSessionDetailPreviewFromFile(filePath, source, messageLimit, options = {}) {
    if (options && options.preview) {
        const fastPreview = extractSessionDetailPreviewFromFileFast(filePath, source, messageLimit);
        if (fastPreview && (!fastPreview.clipped || fastPreview.messages.length > 0)) {
            return fastPreview;
        }
    }

    const safeMessageLimit = Number.isFinite(Number(messageLimit))
        ? Math.max(1, Math.floor(Number(messageLimit)))
        : DEFAULT_SESSION_DETAIL_MESSAGES;
    const state = {
        sessionId: '',
        cwd: '',
        updatedAt: '',
        messages: [],
        tailLimit: safeMessageLimit,
        totalMessages: 0,
        leadingSystem: true
    };

    let stream;
    let rl;
    try {
        stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

        let lineIndex = 0;
        for await (const line of rl) {
            const currentLineIndex = lineIndex;
            lineIndex += 1;

            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }

            let record;
            try {
                record = JSON.parse(trimmed);
            } catch (e) {
                continue;
            }

            applySessionDetailRecordMetadata(record, source, state);
            appendSessionDetailTailMessage(state, record, source, currentLineIndex);
        }
        return state;
    } catch (e) {
        return extractSessionDetailPreviewFromRecords(readJsonlRecords(filePath), source, safeMessageLimit);
    } finally {
        if (rl) {
            try { rl.close(); } catch (e) { }
        }
        if (stream && !stream.destroyed && stream.destroy) {
            try { stream.destroy(); } catch (e) { }
        }
    }
}

async function resolveSessionTrashEntryExactMessageCount(entry) {
    const normalizedEntry = normalizeSessionTrashEntry(entry);
    if (!normalizedEntry) {
        return null;
    }
    const trashFilePath = resolveSessionTrashFilePath(normalizedEntry);
    if (!trashFilePath || !fs.existsSync(trashFilePath)) {
        return normalizedEntry;
    }
    const trashFileStat = getFileStatSafe(trashFilePath);
    const trashFileMtimeMs = getFileMtimeMs(trashFilePath, trashFileStat);
    if (
        Number.isFinite(Number(normalizedEntry.messageCount))
        && normalizedEntry.messageCount >= 0
        && trashFileMtimeMs > 0
        && normalizedEntry.messageCountMtimeMs === trashFileMtimeMs
    ) {
        return normalizedEntry;
    }

    const exactMessageCount = await countConversationMessagesInFile(trashFilePath, normalizedEntry.source);
    if (!Number.isFinite(Number(exactMessageCount))) {
        return normalizedEntry;
    }

    const safeMessageCount = Math.max(0, Math.floor(Number(exactMessageCount)));
    if (
        normalizedEntry.messageCount === safeMessageCount
        && normalizedEntry.messageCountMtimeMs === trashFileMtimeMs
    ) {
        return normalizedEntry;
    }

    return {
        ...normalizedEntry,
        messageCount: safeMessageCount,
        messageCountMtimeMs: trashFileMtimeMs
    };
}

async function hydrateSessionTrashEntries(entries, options = {}) {
    const source = options.source === 'claude'
        ? 'claude'
        : (options.source === 'codex'
            ? 'codex'
            : (options.source === 'gemini'
                ? 'gemini'
                : (options.source === 'codebuddy'
                    ? 'codebuddy'
                    : (options.source === 'pi' ? 'pi' : 'all'))));
    const hydratedEntries = await mapWithConcurrency(Array.isArray(entries) ? entries : [], 8, async (entry) => {
        const normalizedEntry = normalizeSessionTrashEntry(entry);
        if (!normalizedEntry) {
            return undefined;
        }
        return await resolveSessionTrashEntryExactMessageCount(normalizedEntry);
    });

    if (source === 'codex' || source === 'claude' || source === 'gemini' || source === 'codebuddy' || source === 'pi') {
        return hydratedEntries.filter((entry) => entry.source === source);
    }
    return hydratedEntries;
}

async function hydrateSessionItemsExactMessageCount(items) {
    return await mapWithConcurrency(Array.isArray(items) ? items : [], 8, async (item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return undefined;
        }
        if (item.__messageCountExact === true) {
            return item;
        }
        const source = item.source === 'claude'
            ? 'claude'
            : (item.source === 'codex'
                ? 'codex'
                : (item.source === 'gemini'
                    ? 'gemini'
                    : (item.source === 'codebuddy'
                        ? 'codebuddy'
                        : (item.source === 'pi' ? 'pi' : ''))));
        const filePath = typeof item.filePath === 'string' ? item.filePath : '';
        if (!source || !filePath || !fs.existsSync(filePath)) {
            return item;
        }

        const exactMessageCount = await countConversationMessagesInFile(filePath, source);
        if (!Number.isFinite(Number(exactMessageCount))) {
            return item;
        }

        const safeMessageCount = Math.max(0, Math.floor(Number(exactMessageCount)));
        if (Number(item.messageCount) === safeMessageCount) {
            return {
                ...item,
                __messageCountExact: true
            };
        }

        return {
            ...item,
            messageCount: safeMessageCount,
            __messageCountExact: true
        };
    });
}

function getSessionExportKeyForApi(item) {
    const source = item && item.source ? String(item.source).trim() : '';
    const sessionId = item && item.sessionId ? String(item.sessionId) : '';
    const filePath = item && item.filePath ? String(item.filePath) : '';
    return `${source || 'unknown'}:${sessionId}:${filePath}`;
}

async function readSessionMessageCounts(params = {}) {
    const rawItems = Array.isArray(params.items) ? params.items : [];
    const rawLimit = Number(params.limit);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.floor(rawLimit), 80)) : 40;
    const items = rawItems.slice(0, limit);
    const hydrated = await mapWithConcurrency(items, 4, async (item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return undefined;
        }
        const key = getSessionExportKeyForApi(item);
        const source = item.source === 'claude'
            ? 'claude'
            : (item.source === 'codex'
                ? 'codex'
                : (item.source === 'gemini'
                    ? 'gemini'
                    : (item.source === 'codebuddy'
                        ? 'codebuddy'
                        : (item.source === 'pi' ? 'pi' : ''))));
        const filePath = typeof item.filePath === 'string' ? item.filePath : '';
        if (!source || !filePath || !fs.existsSync(filePath)) {
            return { key };
        }
        const exactMessageCount = await countConversationMessagesInFile(filePath, source);
        if (!Number.isFinite(Number(exactMessageCount))) {
            return { key };
        }
        return {
            key,
            messageCount: Math.max(0, Math.floor(Number(exactMessageCount)))
        };
    });
    return {
        items: hydrated.filter(Boolean)
    };
}

function sortSessionsByUpdatedAt(items) {
    items.sort((a, b) => {
        const aTime = Date.parse(a.updatedAt || '') || 0;
        const bTime = Date.parse(b.updatedAt || '') || 0;
        return bTime - aTime;
    });
    return items;
}

function mergeAndLimitSessions(items, limit) {
    const deduped = [];
    const seen = new Set();
    for (const item of items) {
        if (!item || !item.filePath) continue;
        const key = `${item.source}:${item.sessionId || item.filePath}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(item);
    }

    return sortSessionsByUpdatedAt(deduped).slice(0, limit);
}

function normalizeSessionPathFilter(pathFilter) {
    if (typeof pathFilter !== 'string') {
        return '';
    }
    const trimmed = pathFilter.trim();
    return trimmed ? trimmed.toLowerCase() : '';
}

function matchesSessionPathFilter(session, normalizedFilter) {
    if (!normalizedFilter) {
        return true;
    }
    if (!session || typeof session !== 'object') {
        return false;
    }

    const cwd = typeof session.cwd === 'string' ? session.cwd.toLowerCase() : '';
    return cwd.includes(normalizedFilter);
}

function normalizeKeywords(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const seen = new Set();
    const result = [];
    for (const item of value) {
        const normalized = typeof item === 'string' ? item.trim() : String(item || '').trim();
        if (!normalized) continue;
        const lower = normalized.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        result.push(normalized);
    }
    return result;
}

function normalizeCapabilities(value) {
    const result = {};
    if (!value || typeof value !== 'object') {
        return result;
    }
    if (value.code === true) {
        result.code = true;
    }
    return result;
}

function normalizeQueryMode(mode) {
    return mode === 'or' ? 'or' : 'and';
}

function normalizeQueryScope(scope) {
    if (scope === 'content' || scope === 'all' || scope === 'summary') {
        return scope;
    }
    return 'summary';
}

function normalizeRoleFilter(roleFilter) {
    if (roleFilter === 'all' || roleFilter === undefined || roleFilter === null) {
        return 'all';
    }
    const normalized = normalizeRole(String(roleFilter));
    return normalized || 'all';
}

function buildSessionSummaryText(session) {
    if (!session) {
        return '';
    }
    const keywords = Array.isArray(session.keywords) ? session.keywords.join(' ') : '';
    const provider = typeof session.provider === 'string' ? session.provider : '';
    return [
        session.title,
        session.sessionId,
        session.cwd,
        session.filePath,
        session.sourceLabel,
        provider,
        keywords
    ].filter(Boolean).join(' ');
}

function createSessionQueryScanState(tokens, options = {}) {
    const mode = normalizeQueryMode(options.mode);
    const roleFilter = normalizeRoleFilter(options.roleFilter);
    const maxMatches = Number.isFinite(Number(options.maxMatches))
        ? Math.max(1, Number(options.maxMatches))
        : 1;
    const snippetLimit = Number.isFinite(Number(options.snippetLimit))
        ? Math.max(0, Number(options.snippetLimit))
        : 0;

    return {
        tokens,
        mode,
        roleFilter,
        maxMatches,
        snippetLimit,
        count: 0,
        snippets: [],
        leadingSystem: roleFilter !== 'system'
    };
}

function consumeSessionQueryMessage(state, message) {
    if (!state || typeof state !== 'object' || !message) {
        return false;
    }

    const role = normalizeRole(message.role);
    const text = typeof message.text === 'string' ? message.text : '';
    if (!role || !text) {
        return false;
    }

    if (state.leadingSystem && (role === 'system' || isBootstrapLikeText(text))) {
        return false;
    }
    state.leadingSystem = false;

    if (state.roleFilter !== 'all' && role !== state.roleFilter) {
        return false;
    }
    if (!matchTokensInText(text, state.tokens, state.mode)) {
        return false;
    }

    state.count += 1;
    if (state.snippetLimit > 0 && state.snippets.length < state.snippetLimit) {
        state.snippets.push(truncateText(text));
    }
    return state.count >= state.maxMatches;
}

function buildSessionQueryScanResult(state) {
    return {
        hit: !!(state && state.count > 0),
        count: state && Number.isFinite(state.count) ? state.count : 0,
        snippets: state && Array.isArray(state.snippets) ? state.snippets : []
    };
}

function scanSessionContentForQueryInRecords(records, source, state) {
    if (!Array.isArray(records) || !state) {
        return buildSessionQueryScanResult(state);
    }

    for (const record of records) {
        const message = extractMessageFromRecord(record, source);
        if (!message) {
            continue;
        }
        if (consumeSessionQueryMessage(state, message)) {
            break;
        }
    }

    return buildSessionQueryScanResult(state);
}

async function scanSessionContentForQuery(session, tokens, options = {}) {
    if (!session || !Array.isArray(tokens) || tokens.length === 0) {
        return { hit: false, count: 0, snippets: [] };
    }

    const filePath = resolveSessionFilePath(session.source, session.filePath, session.sessionId);
    if (!filePath) {
        return { hit: false, count: 0, snippets: [] };
    }

    const rawMaxBytes = Number(options.maxBytes);
    const maxBytes = Number.isFinite(rawMaxBytes) && rawMaxBytes > 0
        ? Math.max(1024, rawMaxBytes)
        : 0;
    const state = createSessionQueryScanState(tokens, options);
    if (session.source === 'gemini') {
        if (state.roleFilter !== 'all') {
            let json;
            try {
                json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            } catch (_) {
                json = null;
            }
            const rawMessages = json && Array.isArray(json.messages) ? json.messages : [];
            for (const entry of rawMessages) {
                if (!entry || typeof entry !== 'object') continue;
                const role = normalizeGeminiMessageRole(entry.type);
                if (!role) continue;
                const text = extractMessageText(extractGeminiMessageText(entry.content ?? entry.message ?? entry.text));
                if (!text) continue;
                if (consumeSessionQueryMessage(state, { role, text })) {
                    break;
                }
            }
            return buildSessionQueryScanResult(state);
        }

        let text = '';
        try {
            const stat = fs.statSync(filePath);
            const targetBytes = maxBytes > 0 ? Math.min(maxBytes, stat.size || 0) : Math.min(stat.size || 0, 512 * 1024);
            const fd = fs.openSync(filePath, 'r');
            const buf = Buffer.alloc(targetBytes);
            const bytes = fs.readSync(fd, buf, 0, targetBytes, 0);
            fs.closeSync(fd);
            text = bytes > 0 ? buf.slice(0, bytes).toString('utf-8') : '';
        } catch (_) {
            try {
                text = fs.readFileSync(filePath, 'utf-8');
            } catch (_) {
                text = '';
            }
        }

        if (!matchTokensInText(text, state.tokens, state.mode)) {
            return buildSessionQueryScanResult(state);
        }
        state.count = 1;
        if (state.snippetLimit > 0) {
            state.snippets.push(truncateText(text));
        }
        return buildSessionQueryScanResult(state);
    }
    let stream;
    let rl;
    try {
        stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

        let bytesRead = 0;
        for await (const line of rl) {
            if (maxBytes > 0 && bytesRead >= maxBytes) {
                break;
            }

            bytesRead += Buffer.byteLength(line, 'utf-8') + 1;
            const trimmed = line.trim();
            if (!trimmed) {
                continue;
            }

            let record;
            try {
                record = JSON.parse(trimmed);
            } catch (e) {
                continue;
            }

            const message = extractMessageFromRecord(record, session.source);
            if (!message) {
                continue;
            }
            if (consumeSessionQueryMessage(state, message)) {
                break;
            }
        }

        return buildSessionQueryScanResult(state);
    } catch (e) {
        return scanSessionContentForQueryInRecords(readJsonlRecords(filePath), session.source, state);
    } finally {
        if (rl) {
            try { rl.close(); } catch (e) { }
        }
        if (stream && !stream.destroyed && stream.destroy) {
            try { stream.destroy(); } catch (e) { }
        }
    }
}

async function applySessionQueryFilter(sessions, options = {}) {
    const tokens = Array.isArray(options.tokens) ? options.tokens : [];
    if (tokens.length === 0) {
        return sessions;
    }

    const mode = normalizeQueryMode(options.queryMode);
    const scope = normalizeQueryScope(options.queryScope);
    const roleFilter = normalizeRoleFilter(options.roleFilter);
    const contentScanLimit = Number.isFinite(Number(options.contentScanLimit))
        ? Math.max(1, Number(options.contentScanLimit))
        : DEFAULT_CONTENT_SCAN_LIMIT;
    const contentScanBytes = Number.isFinite(Number(options.contentScanBytes))
        ? Math.max(1024, Number(options.contentScanBytes))
        : 0;

    let scanned = 0;
    const results = [];

    for (const session of sessions) {
        if (scope === 'content' && scanned >= contentScanLimit) {
            break;
        }

        const summaryText = buildSessionSummaryText(session);
        const summaryHit = scope !== 'content' && matchTokensInText(summaryText, tokens, mode);
        let contentHit = false;
        let contentInfo = null;

        const shouldScanContent = scope === 'content' || scope === 'all' || !summaryHit;
        if (shouldScanContent && scanned < contentScanLimit) {
            scanned += 1;
            contentInfo = await scanSessionContentForQuery(session, tokens, {
                mode,
                roleFilter,
                maxBytes: contentScanBytes,
                maxMatches: 1,
                snippetLimit: 2
            });
            contentHit = contentInfo.hit;
        }

        const hit = scope === 'summary'
            ? summaryHit
            : (scope === 'content' ? contentHit : (summaryHit || contentHit));

        if (!hit) {
            continue;
        }

        const matchInfo = contentInfo && contentInfo.hit
            ? contentInfo
            : { hit: true, count: 1, snippets: [] };
        session.match = {
            hit: true,
            count: matchInfo.count || 1,
            snippets: Array.isArray(matchInfo.snippets) ? matchInfo.snippets : []
        };
        results.push(session);
    }

    return results;
}
function collectRecentJsonlFiles(rootDir, options = {}) {
    if (!fs.existsSync(rootDir)) {
        return [];
    }

    const returnCount = Math.max(1, Number(options.returnCount) || 1);
    const maxFilesScanned = Math.max(returnCount, Number(options.maxFilesScanned) || 2000);
    const ignoreSubPath = typeof options.ignoreSubPath === 'string' ? options.ignoreSubPath : '';
    const stack = [rootDir];
    const filesMeta = [];
    let scanned = 0;

    while (stack.length > 0 && scanned < maxFilesScanned) {
        const dir = stack.pop();
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }

            if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
                continue;
            }

            if (ignoreSubPath && fullPath.includes(ignoreSubPath)) {
                continue;
            }

            scanned += 1;
            try {
                const stat = fs.statSync(fullPath);
                filesMeta.push({ filePath: fullPath, mtimeMs: stat.mtimeMs || 0 });
            } catch (e) { }

            if (scanned >= maxFilesScanned) {
                break;
            }
        }
    }

    filesMeta.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return filesMeta.slice(0, returnCount).map(item => item.filePath);
}

function collectRecentJsonlFilesFromRoots(rootDirs, options = {}) {
    const roots = Array.isArray(rootDirs)
        ? rootDirs.filter((dirPath) => typeof dirPath === 'string' && dirPath.trim() && fs.existsSync(dirPath.trim()))
        : [];
    if (roots.length === 0) {
        return [];
    }

    const returnCount = Math.max(1, Number(options.returnCount) || 1);
    const maxFilesScanned = Math.max(returnCount, Number(options.maxFilesScanned) || 2000);
    const ignoreSubPath = typeof options.ignoreSubPath === 'string' ? options.ignoreSubPath : '';
    const stack = roots.map((dirPath) => dirPath.trim());
    const filesMeta = [];
    let scanned = 0;

    while (stack.length > 0 && scanned < maxFilesScanned) {
        const dir = stack.pop();
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (_) {
            continue;
        }

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                stack.push(fullPath);
                continue;
            }
            if (!entry.isFile() || !entry.name.endsWith('.jsonl')) {
                continue;
            }
            if (ignoreSubPath && fullPath.includes(ignoreSubPath)) {
                continue;
            }
            scanned += 1;
            try {
                const stat = fs.statSync(fullPath);
                filesMeta.push({ filePath: fullPath, mtimeMs: stat.mtimeMs || 0 });
            } catch (_) { }
            if (scanned >= maxFilesScanned) {
                break;
            }
        }
    }

    filesMeta.sort((a, b) => b.mtimeMs - a.mtimeMs);
    return filesMeta.slice(0, returnCount).map(item => item.filePath);
}

function getSessionListCache(cacheKey, forceRefresh = false) {
    if (forceRefresh) {
        g_sessionListCache.delete(cacheKey);
        return null;
    }

    const cached = g_sessionListCache.get(cacheKey);
    if (!cached) {
        return null;
    }

    if ((Date.now() - cached.timestamp) > SESSION_LIST_CACHE_TTL_MS) {
        g_sessionListCache.delete(cacheKey);
        return null;
    }

    return cached.value;
}

function setSessionListCache(cacheKey, value) {
    g_sessionListCache.set(cacheKey, {
        timestamp: Date.now(),
        value
    });

    if (g_sessionListCache.size > 20) {
        const firstKey = g_sessionListCache.keys().next().value;
        if (firstKey) {
            g_sessionListCache.delete(firstKey);
        }
    }
}

function buildSessionInventoryCacheKey(source, limit, options = {}) {
    const normalizedSource = source === 'claude'
        ? 'claude'
        : (source === 'gemini'
            ? 'gemini'
            : (source === 'codebuddy'
                ? 'codebuddy'
                : (source === 'pi' ? 'pi' : 'codex')));
    const normalizedLimit = Number.isFinite(Number(limit))
        ? Math.max(1, Math.floor(Number(limit)))
        : 1;
    const scanFactor = Number.isFinite(Number(options.scanFactor))
        ? Math.max(1, Number(options.scanFactor))
        : '';
    const minFiles = Number.isFinite(Number(options.minFiles))
        ? Math.max(1, Math.floor(Number(options.minFiles)))
        : '';
    const targetCount = Number.isFinite(Number(options.targetCount))
        ? Math.max(1, Math.floor(Number(options.targetCount)))
        : '';
    const scanCount = Number.isFinite(Number(options.scanCount))
        ? Math.max(1, Math.floor(Number(options.scanCount)))
        : '';
    const maxFilesScanned = Number.isFinite(Number(options.maxFilesScanned))
        ? Math.max(1, Math.floor(Number(options.maxFilesScanned)))
        : '';
    const summaryReadBytes = Number.isFinite(Number(options.summaryReadBytes))
        ? Math.max(1024, Math.floor(Number(options.summaryReadBytes)))
        : '';
    const titleReadBytes = Number.isFinite(Number(options.titleReadBytes))
        ? Math.max(1024, Math.floor(Number(options.titleReadBytes)))
        : '';
    return [
        'inventory',
        normalizedSource,
        normalizedLimit,
        scanFactor,
        minFiles,
        targetCount,
        scanCount,
        maxFilesScanned,
        summaryReadBytes,
        titleReadBytes
    ].join(':');
}

function cloneSessionInventoryCacheValue(value) {
    if (!Array.isArray(value)) {
        return null;
    }
    return value.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return item;
        }
        const cloned = { ...item };
        if (item.match && typeof item.match === 'object' && !Array.isArray(item.match)) {
            cloned.match = {
                ...item.match,
                snippets: Array.isArray(item.match.snippets)
                    ? [...item.match.snippets]
                    : []
            };
        }
        return cloned;
    });
}

function getSessionInventoryCache(cacheKey, forceRefresh = false) {
    if (forceRefresh) {
        g_sessionInventoryCache.delete(cacheKey);
        return null;
    }

    const cached = g_sessionInventoryCache.get(cacheKey);
    if (!cached) {
        return null;
    }

    if ((Date.now() - cached.timestamp) > SESSION_LIST_CACHE_TTL_MS) {
        g_sessionInventoryCache.delete(cacheKey);
        return null;
    }

    const clonedValue = cloneSessionInventoryCacheValue(cached.value);
    if (!Array.isArray(clonedValue)) {
        g_sessionInventoryCache.delete(cacheKey);
        return null;
    }

    return clonedValue;
}

function registerSessionFileLookupEntries(source, sessions = []) {
    const normalizedSource = source === 'claude' || source === 'gemini' || source === 'codebuddy' || source === 'pi'
        ? source
        : 'codex';
    const store = g_sessionFileLookupCache[normalizedSource];
    if (!(store instanceof Map) || !Array.isArray(sessions)) {
        return;
    }
    for (const session of sessions) {
        if (!session || typeof session !== 'object' || Array.isArray(session)) {
            continue;
        }
        const sessionId = typeof session.sessionId === 'string' ? session.sessionId.trim().toLowerCase() : '';
        const filePath = typeof session.filePath === 'string' ? session.filePath.trim() : '';
        if (!sessionId || !filePath) {
            continue;
        }
        store.set(sessionId, filePath);
    }
}

function setSessionInventoryCache(cacheKey, source, value) {
    const storedValue = cloneSessionInventoryCacheValue(value);
    if (!Array.isArray(storedValue)) {
        return;
    }
    g_sessionInventoryCache.set(cacheKey, {
        timestamp: Date.now(),
        source,
        value: storedValue
    });
    registerSessionFileLookupEntries(source, storedValue);

    if (g_sessionInventoryCache.size > SESSION_INVENTORY_CACHE_MAX_ENTRIES) {
        const firstKey = g_sessionInventoryCache.keys().next().value;
        if (firstKey) {
            g_sessionInventoryCache.delete(firstKey);
        }
    }
}

function listSessionInventoryBySource(source, limit, scanOptions = {}, options = {}) {
    const normalizedSource = source === 'claude' || source === 'gemini' || source === 'codebuddy' || source === 'pi'
        ? source
        : 'codex';
    const forceRefresh = !!options.forceRefresh;
    const cacheKey = buildSessionInventoryCacheKey(normalizedSource, limit, scanOptions);
    const cached = getSessionInventoryCache(cacheKey, forceRefresh);
    if (cached) {
        return cached;
    }

    const sessions = normalizedSource === 'claude'
        ? listClaudeSessions(limit, scanOptions)
        : (normalizedSource === 'gemini'
            ? listGeminiSessions(limit, scanOptions)
            : (normalizedSource === 'codebuddy'
                ? listCodeBuddySessions(limit, scanOptions)
                : (normalizedSource === 'pi'
                    ? listPiSessions(limit, scanOptions)
                    : listCodexSessions(limit, scanOptions))));
    setSessionInventoryCache(cacheKey, normalizedSource, sessions);
    return sessions;
}

function invalidateSessionListCache() {
    g_sessionListCache.clear();
    g_sessionInventoryCache.clear();
    g_sessionFileLookupCache = {
        codex: new Map(),
        claude: new Map(),
        gemini: new Map(),
        codebuddy: new Map(),
        pi: new Map()
    };
}

function readNonNegativeInteger(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return null;
    }
    return Math.floor(numeric);
}

function readTotalTokensFromUsage(usage) {
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
        return null;
    }
    const explicitTotal = readNonNegativeInteger(usage.total_tokens ?? usage.totalTokens);
    if (explicitTotal !== null) {
        return explicitTotal;
    }
    const inputTokens = readNonNegativeInteger(usage.input_tokens ?? usage.inputTokens);
    const cachedInputTokens = readNonNegativeInteger(
        usage.cached_input_tokens ?? usage.cachedInputTokens
        ?? usage.cache_read_input_tokens ?? usage.cacheReadInputTokens
    );
    const cacheCreationInputTokens = readNonNegativeInteger(
        usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens
    );
    const outputTokens = readNonNegativeInteger(usage.output_tokens ?? usage.outputTokens);
    const reasoningOutputTokens = readNonNegativeInteger(usage.reasoning_output_tokens ?? usage.reasoningOutputTokens);
    if (inputTokens === null && cachedInputTokens === null && cacheCreationInputTokens === null && outputTokens === null && reasoningOutputTokens === null) {
        return null;
    }
    return (inputTokens || 0) + (cachedInputTokens || 0) + (cacheCreationInputTokens || 0) + (outputTokens || 0) + (reasoningOutputTokens || 0);
}

function readUsageTotalsFromUsage(usage) {
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
        return null;
    }
    const inputTokens = readNonNegativeInteger(usage.input_tokens ?? usage.inputTokens);
    const cachedInputTokens = readNonNegativeInteger(
        usage.cached_input_tokens ?? usage.cachedInputTokens
        ?? usage.cache_read_input_tokens ?? usage.cacheReadInputTokens
    );
    const cacheCreationInputTokens = readNonNegativeInteger(
        usage.cache_creation_input_tokens ?? usage.cacheCreationInputTokens
    );
    const outputTokens = readNonNegativeInteger(usage.output_tokens ?? usage.outputTokens);
    const reasoningOutputTokens = readNonNegativeInteger(usage.reasoning_output_tokens ?? usage.reasoningOutputTokens);
    const totalTokens = readNonNegativeInteger(usage.total_tokens ?? usage.totalTokens)
        ?? ((inputTokens === null && cachedInputTokens === null && cacheCreationInputTokens === null && outputTokens === null && reasoningOutputTokens === null)
            ? null
            : ((inputTokens || 0) + (cachedInputTokens || 0) + (cacheCreationInputTokens || 0) + (outputTokens || 0) + (reasoningOutputTokens || 0)));
    if (inputTokens === null && cachedInputTokens === null && cacheCreationInputTokens === null && outputTokens === null && reasoningOutputTokens === null && totalTokens === null) {
        return null;
    }
    return {
        inputTokens,
        cachedInputTokens,
        cacheCreationInputTokens,
        outputTokens,
        reasoningOutputTokens,
        totalTokens
    };
}

function readContextWindowValue(target) {
    if (!target || typeof target !== 'object' || Array.isArray(target)) {
        return null;
    }
    return readNonNegativeInteger(
        target.model_context_window
        ?? target.modelContextWindow
        ?? target.context_window
        ?? target.contextWindow
    );
}

function applyUsageTotalsToState(state, usageTotals) {
    if (!state || typeof state !== 'object' || !usageTotals || typeof usageTotals !== 'object' || Array.isArray(usageTotals)) {
        return;
    }
    const pairs = [
        ['inputTokens', usageTotals.inputTokens],
        ['cachedInputTokens', usageTotals.cachedInputTokens],
        ['cacheCreationInputTokens', usageTotals.cacheCreationInputTokens],
        ['outputTokens', usageTotals.outputTokens],
        ['reasoningOutputTokens', usageTotals.reasoningOutputTokens],
        ['totalTokens', usageTotals.totalTokens]
    ];
    for (const [key, value] of pairs) {
        const normalized = readNonNegativeInteger(value);
        if (normalized === null) {
            continue;
        }
        state[key] = Math.max(readNonNegativeInteger(state[key]) || 0, normalized);
    }
}

function readSessionModelsFromRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return [];
    }
    const models = [];

    const pushModel = (candidate) => {
        if (Array.isArray(candidate)) {
            for (const item of candidate) {
                pushModel(item);
            }
            return;
        }
        if (typeof candidate !== 'string') {
            return;
        }
        const normalized = candidate.trim();
        if (!normalized || models.includes(normalized)) {
            return;
        }
        models.push(normalized);
    };

    const shouldReadModelKey = (key) => {
        const normalized = typeof key === 'string'
            ? key.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
            : '';
        if (!normalized || normalized.includes('provider')) {
            return false;
        }
        return normalized === 'model'
            || normalized === 'models'
            || normalized.endsWith('model')
            || normalized.endsWith('models')
            || normalized.includes('modelname')
            || normalized.includes('modelid')
            || normalized.includes('modelslug')
            || normalized.includes('selectedmodel')
            || normalized.includes('defaultmodel')
            || normalized.includes('modelconfig');
    };

    const pushObjectModelCandidates = (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return;
        }
        pushModel(value.model);
        pushModel(value.models);
        pushModel(value.name);
        pushModel(value.id);
        pushModel(value.slug);
        pushModel(value.model_name);
        pushModel(value.model_id);
        pushModel(value.modelId);
        pushModel(value.model_slug);
        pushModel(value.modelSlug);
        pushModel(value.default_model);
        pushModel(value.defaultModel);
        pushModel(value.selected_model);
        pushModel(value.selectedModel);
    };

    const seen = new Set();
    const visit = (value, keyHint = '') => {
        if (Array.isArray(value)) {
            if (shouldReadModelKey(keyHint)) {
                pushModel(value);
            }
            for (const item of value) {
                visit(item, keyHint);
            }
            return;
        }
        if (!value || typeof value !== 'object') {
            if (shouldReadModelKey(keyHint)) {
                pushModel(value);
            }
            return;
        }
        if (seen.has(value)) {
            return;
        }
        seen.add(value);
        if (shouldReadModelKey(keyHint)) {
            pushObjectModelCandidates(value);
        }
        for (const [childKey, childValue] of Object.entries(value)) {
            visit(childValue, childKey);
        }
    };

    visit(record);
    return models;
}

function readSessionModelFromRecord(record) {
    const models = readSessionModelsFromRecord(record);
    return models[0] || '';
}

function readExplicitSessionProviderFromRecord(record) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
        return '';
    }
    const payload = record.payload && typeof record.payload === 'object' && !Array.isArray(record.payload)
        ? record.payload
        : null;
    const message = record.message && typeof record.message === 'object' && !Array.isArray(record.message)
        ? record.message
        : null;
    const candidates = [
        payload && payload.model_provider,
        payload && payload.modelProvider,
        payload && payload.provider,
        payload && payload.provider_name,
        payload && payload.providerName,
        message && message.provider,
        record.provider,
        record.provider_name,
        record.providerName
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim()) {
            return candidate.trim();
        }
    }
    return '';
}

function readSessionProviderFromRecord(record, source = '') {
    const provider = readExplicitSessionProviderFromRecord(record);
    if (provider) {
        return provider;
    }
    return source === 'claude'
        ? 'claude'
        : (source === 'gemini'
            ? 'gemini'
            : (source === 'codebuddy'
                ? 'codebuddy'
                : (source === 'pi' ? 'pi' : 'codex')));
}

function applySessionUsageSummaryFromRecord(state, record, source) {
    if (!state || typeof state !== 'object' || !record || typeof record !== 'object' || Array.isArray(record)) {
        return;
    }

    let totalTokens = null;
    let contextWindow = null;
    let usageTotals = null;

    if (source === 'codex') {
        const payload = record.payload && typeof record.payload === 'object' && !Array.isArray(record.payload)
            ? record.payload
            : null;
        const info = payload && payload.info && typeof payload.info === 'object' && !Array.isArray(payload.info)
            ? payload.info
            : null;
        usageTotals = readUsageTotalsFromUsage(info && info.total_token_usage)
            ?? readUsageTotalsFromUsage(payload && payload.total_token_usage)
            ?? readUsageTotalsFromUsage(payload && payload.usage);
        totalTokens = readTotalTokensFromUsage(info && info.total_token_usage)
            ?? readTotalTokensFromUsage(payload && payload.total_token_usage)
            ?? readTotalTokensFromUsage(payload && payload.usage);
        contextWindow = readContextWindowValue(info)
            ?? readContextWindowValue(payload);
    } else {
        const message = record.message && typeof record.message === 'object' && !Array.isArray(record.message)
            ? record.message
            : null;
        const payload = record.payload && typeof record.payload === 'object' && !Array.isArray(record.payload)
            ? record.payload
            : null;
        usageTotals = readUsageTotalsFromUsage(record.usage)
            ?? readUsageTotalsFromUsage(message && message.usage)
            ?? readUsageTotalsFromUsage(payload && payload.usage);
        totalTokens = readTotalTokensFromUsage(record.usage)
            ?? readTotalTokensFromUsage(message && message.usage)
            ?? readTotalTokensFromUsage(payload && payload.usage);
        contextWindow = readContextWindowValue(record)
            ?? readContextWindowValue(message)
            ?? readContextWindowValue(payload);
    }

    applyUsageTotalsToState(state, usageTotals);

    if (totalTokens !== null) {
        state.totalTokens = Math.max(readNonNegativeInteger(state.totalTokens) || 0, totalTokens);
    }
    if (contextWindow !== null) {
        state.contextWindow = Math.max(readNonNegativeInteger(state.contextWindow) || 0, contextWindow);
    }
}

function applySessionUsageSummaryFromIndexEntry(state, entry) {
    if (!state || typeof state !== 'object' || !entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return;
    }
    const totalTokens = readNonNegativeInteger(entry.totalTokens)
        ?? readTotalTokensFromUsage(entry.totalTokenUsage)
        ?? readTotalTokensFromUsage(entry.usage);
    const usageTotals = readUsageTotalsFromUsage(entry.totalTokenUsage)
        ?? readUsageTotalsFromUsage(entry.usage);
    const contextWindow = readContextWindowValue(entry);
    applyUsageTotalsToState(state, usageTotals);
    if (totalTokens !== null) {
        state.totalTokens = Math.max(readNonNegativeInteger(state.totalTokens) || 0, totalTokens);
    }
    if (contextWindow !== null) {
        state.contextWindow = Math.max(readNonNegativeInteger(state.contextWindow) || 0, contextWindow);
    }
}

function parseCodexSessionSummary(filePath, options = {}) {
    const summaryReadBytes = Number.isFinite(Number(options.summaryReadBytes))
        ? Math.max(1024, Math.floor(Number(options.summaryReadBytes)))
        : SESSION_SUMMARY_READ_BYTES;
    const titleReadBytes = Number.isFinite(Number(options.titleReadBytes))
        ? Math.max(1024, Math.floor(Number(options.titleReadBytes)))
        : SESSION_TITLE_READ_BYTES;
    const records = parseJsonlHeadRecords(filePath, summaryReadBytes);
    if (records.length === 0) {
        return null;
    }

    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch (e) {
        return null;
    }

    let sessionId = path.basename(filePath, '.jsonl');
    let cwd = '';
    let createdAt = '';
    let updatedAt = stat.mtime.toISOString();
    let firstPrompt = '';
    let messageCount = 0;
    let totalTokens = 0;
    let contextWindow = 0;
    let inputTokens = 0;
    let cachedInputTokens = 0;
    let cacheCreationInputTokens = 0;
    let outputTokens = 0;
    let reasoningOutputTokens = 0;
    let provider = 'codex';
    let model = '';
    const models = [];
    const usageState = { totalTokens, contextWindow, inputTokens, cachedInputTokens, cacheCreationInputTokens, outputTokens, reasoningOutputTokens };
    const previewMessages = [];

    for (const record of records) {
        if (record.timestamp) {
            updatedAt = updateLatestIso(updatedAt, record.timestamp);
        }

        applySessionUsageSummaryFromRecord(usageState, record, 'codex');
        totalTokens = usageState.totalTokens || 0;
        contextWindow = usageState.contextWindow || 0;
        inputTokens = usageState.inputTokens || 0;
        cachedInputTokens = usageState.cachedInputTokens || 0;
        cacheCreationInputTokens = usageState.cacheCreationInputTokens || 0;
        outputTokens = usageState.outputTokens || 0;
        reasoningOutputTokens = usageState.reasoningOutputTokens || 0;

        if (record.type === 'session_meta' && record.payload) {
            sessionId = record.payload.id || sessionId;
            cwd = record.payload.cwd || cwd;
            createdAt = toIsoTime(record.payload.timestamp || record.timestamp, createdAt);
            provider = readSessionProviderFromRecord(record, 'codex') || provider;
            continue;
        }
        const recordModels = readSessionModelsFromRecord(record);
        for (const recordModel of recordModels) {
            if (!models.includes(recordModel)) {
                models.push(recordModel);
            }
        }
        model = recordModels[0] || model;

        if (record.type === 'response_item' && record.payload && record.payload.type === 'message') {
            const role = normalizeRole(record.payload.role);
            if (role === 'user' || role === 'assistant' || role === 'system') {
                const text = extractMessageText(record.payload.content);
                previewMessages.push({ role, text });
            }
        }
    }

    const tailRecords = parseJsonlTailRecords(filePath, summaryReadBytes);
    for (const record of tailRecords) {
        applySessionUsageSummaryFromRecord(usageState, record, 'codex');
        totalTokens = usageState.totalTokens || 0;
        contextWindow = usageState.contextWindow || 0;
        inputTokens = usageState.inputTokens || 0;
        cachedInputTokens = usageState.cachedInputTokens || 0;
        cacheCreationInputTokens = usageState.cacheCreationInputTokens || 0;
        outputTokens = usageState.outputTokens || 0;
        reasoningOutputTokens = usageState.reasoningOutputTokens || 0;
        provider = readExplicitSessionProviderFromRecord(record) || provider;
        const recordModels = readSessionModelsFromRecord(record);
        for (const recordModel of recordModels) {
            if (!models.includes(recordModel)) {
                models.push(recordModel);
            }
        }
        model = recordModels[0] || model;
    }

    const filteredPreviewMessages = removeLeadingSystemMessage(previewMessages);
    messageCount = filteredPreviewMessages.length;
    const firstUser = filteredPreviewMessages.find(item => item.role === 'user' && item.text);
    if (firstUser) {
        firstPrompt = truncateText(firstUser.text);
    }

    if (!firstPrompt) {
        const titleRecords = parseJsonlHeadRecords(filePath, titleReadBytes);
        const titleMessages = [];
        for (const record of titleRecords) {
            if (record.type === 'response_item' && record.payload && record.payload.type === 'message') {
                const role = normalizeRole(record.payload.role);
                if (role === 'user' || role === 'assistant' || role === 'system') {
                    titleMessages.push({
                        role,
                        text: extractMessageText(record.payload.content)
                    });
                }
            }
        }

        const filteredTitleMessages = removeLeadingSystemMessage(titleMessages);
        const titleUser = filteredTitleMessages.find(item => item.role === 'user' && item.text);
        if (titleUser) {
            firstPrompt = truncateText(titleUser.text);
        }
    }

    messageCount = Math.max(0, messageCount);

    return {
        source: 'codex',
        sourceLabel: 'Codex',
        provider,
        model,
        models,
        sessionId,
        title: firstPrompt || sessionId,
        cwd,
        createdAt,
        updatedAt,
        messageCount,
        totalTokens,
        contextWindow,
        inputTokens,
        cachedInputTokens,
        cacheCreationInputTokens,
        outputTokens,
        reasoningOutputTokens,
        __messageCountExact: isSessionSummaryMessageCountExact(stat, summaryReadBytes),
        filePath,
        keywords: [],
        capabilities: {}
    };
}

function parseClaudeSessionSummary(filePath, options = {}) {
    const summaryReadBytes = Number.isFinite(Number(options.summaryReadBytes))
        ? Math.max(1024, Math.floor(Number(options.summaryReadBytes)))
        : SESSION_SUMMARY_READ_BYTES;
    const titleReadBytes = Number.isFinite(Number(options.titleReadBytes))
        ? Math.max(1024, Math.floor(Number(options.titleReadBytes)))
        : SESSION_TITLE_READ_BYTES;
    const records = parseJsonlHeadRecords(filePath, summaryReadBytes);
    if (records.length === 0) {
        return null;
    }

    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch (e) {
        return null;
    }

    const sessionId = path.basename(filePath, '.jsonl');
    let cwd = '';
    let firstPrompt = '';
    let messageCount = 0;
    let totalTokens = 0;
    let contextWindow = 0;
    let inputTokens = 0;
    let cachedInputTokens = 0;
    let cacheCreationInputTokens = 0;
    let outputTokens = 0;
    let reasoningOutputTokens = 0;
    let provider = 'claude';
    let model = '';
    const models = [];
    const usageState = { totalTokens, contextWindow, inputTokens, cachedInputTokens, cacheCreationInputTokens, outputTokens, reasoningOutputTokens };
    const previewMessages = [];
    let createdAt = '';
    let updatedAt = stat.mtime.toISOString();

    for (const record of records) {
        if (!createdAt && record.timestamp) {
            createdAt = toIsoTime(record.timestamp, createdAt);
        }
        if (record.timestamp) {
            updatedAt = updateLatestIso(updatedAt, record.timestamp);
        }

        applySessionUsageSummaryFromRecord(usageState, record, 'claude');
        totalTokens = usageState.totalTokens || 0;
        contextWindow = usageState.contextWindow || 0;
        inputTokens = usageState.inputTokens || 0;
        cachedInputTokens = usageState.cachedInputTokens || 0;
        cacheCreationInputTokens = usageState.cacheCreationInputTokens || 0;
        outputTokens = usageState.outputTokens || 0;
        reasoningOutputTokens = usageState.reasoningOutputTokens || 0;

        if (!cwd && record.cwd) {
            cwd = record.cwd;
        }

        provider = readExplicitSessionProviderFromRecord(record) || provider;
        const recordModels = readSessionModelsFromRecord(record);
        for (const recordModel of recordModels) {
            if (!models.includes(recordModel)) {
                models.push(recordModel);
            }
        }
        model = recordModels[0] || model;

        const role = normalizeRole(record.type);
        if (role === 'assistant' || role === 'user' || role === 'system') {
            const userContent = record.message ? record.message.content : '';
            previewMessages.push({
                role,
                text: extractMessageText(userContent)
            });
        }
    }

    const tailRecords = parseJsonlTailRecords(filePath, summaryReadBytes);
    for (const record of tailRecords) {
        if (record && record.timestamp) {
            updatedAt = updateLatestIso(updatedAt, record.timestamp);
        }
        applySessionUsageSummaryFromRecord(usageState, record, 'claude');
        totalTokens = usageState.totalTokens || 0;
        contextWindow = usageState.contextWindow || 0;
        inputTokens = usageState.inputTokens || 0;
        cachedInputTokens = usageState.cachedInputTokens || 0;
        cacheCreationInputTokens = usageState.cacheCreationInputTokens || 0;
        outputTokens = usageState.outputTokens || 0;
        reasoningOutputTokens = usageState.reasoningOutputTokens || 0;
        provider = readExplicitSessionProviderFromRecord(record) || provider;
        const recordModels = readSessionModelsFromRecord(record);
        for (const recordModel of recordModels) {
            if (!models.includes(recordModel)) {
                models.push(recordModel);
            }
        }
        model = recordModels[0] || model;
    }

    const filteredPreviewMessages = removeLeadingSystemMessage(previewMessages);
    messageCount = filteredPreviewMessages.length;
    const firstUser = filteredPreviewMessages.find(item => item.role === 'user' && item.text);
    if (firstUser) {
        firstPrompt = truncateText(firstUser.text);
    }

    if (!firstPrompt) {
        const titleRecords = parseJsonlHeadRecords(filePath, titleReadBytes);
        const titleMessages = [];
        for (const record of titleRecords) {
            const role = normalizeRole(record.type);
            if (role === 'assistant' || role === 'user' || role === 'system') {
                const userContent = record.message ? record.message.content : '';
                titleMessages.push({
                    role,
                    text: extractMessageText(userContent)
                });
            }
        }

        const filteredTitleMessages = removeLeadingSystemMessage(titleMessages);
        const titleUser = filteredTitleMessages.find(item => item.role === 'user' && item.text);
        if (titleUser) {
            firstPrompt = truncateText(titleUser.text);
        }
    }

    messageCount = Math.max(0, messageCount);

    return {
        source: 'claude',
        sourceLabel: 'Claude Code',
        provider,
        model,
        models,
        sessionId,
        title: firstPrompt || sessionId,
        cwd,
        createdAt,
        updatedAt,
        messageCount,
        totalTokens,
        contextWindow,
        inputTokens,
        cachedInputTokens,
        cacheCreationInputTokens,
        outputTokens,
        reasoningOutputTokens,
        __messageCountExact: isSessionSummaryMessageCountExact(stat, summaryReadBytes),
        filePath,
        keywords: [],
        capabilities: { code: true }
    };
}

function parseCodeBuddySessionSummary(filePath, options = {}) {
    const summaryReadBytes = Number.isFinite(Number(options.summaryReadBytes))
        ? Math.max(1024, Math.floor(Number(options.summaryReadBytes)))
        : SESSION_SUMMARY_READ_BYTES;
    const titleReadBytes = Number.isFinite(Number(options.titleReadBytes))
        ? Math.max(1024, Math.floor(Number(options.titleReadBytes)))
        : SESSION_TITLE_READ_BYTES;
    const records = parseJsonlHeadRecords(filePath, summaryReadBytes);
    if (records.length === 0) {
        return null;
    }

    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch (_) {
        return null;
    }

    let sessionId = path.basename(filePath, '.jsonl');
    let cwd = '';
    let firstPrompt = '';
    let messageCount = 0;
    let totalTokens = 0;
    let contextWindow = 0;
    let inputTokens = 0;
    let cachedInputTokens = 0;
    let cacheCreationInputTokens = 0;
    let outputTokens = 0;
    let reasoningOutputTokens = 0;
    let provider = 'codebuddy';
    let model = '';
    const models = [];
    const usageState = { totalTokens, contextWindow, inputTokens, cachedInputTokens, cacheCreationInputTokens, outputTokens, reasoningOutputTokens };
    const previewMessages = [];
    let createdAt = '';
    let updatedAt = stat.mtime.toISOString();

    for (const record of records) {
        if (!createdAt && record && record.timestamp) {
            createdAt = toIsoTime(record.timestamp, createdAt);
        }
        if (record && record.timestamp) {
            updatedAt = updateLatestIso(updatedAt, record.timestamp);
        }

        applySessionUsageSummaryFromRecord(usageState, record, 'codebuddy');
        totalTokens = usageState.totalTokens || 0;
        contextWindow = usageState.contextWindow || 0;
        inputTokens = usageState.inputTokens || 0;
        cachedInputTokens = usageState.cachedInputTokens || 0;
        cacheCreationInputTokens = usageState.cacheCreationInputTokens || 0;
        outputTokens = usageState.outputTokens || 0;
        reasoningOutputTokens = usageState.reasoningOutputTokens || 0;

        if (record && typeof record.sessionId === 'string' && record.sessionId.trim()) {
            sessionId = record.sessionId.trim();
        }
        if (!cwd && record && typeof record.cwd === 'string' && record.cwd.trim()) {
            cwd = record.cwd.trim();
        }

        provider = readExplicitSessionProviderFromRecord(record) || provider;
        const recordModels = readSessionModelsFromRecord(record);
        for (const recordModel of recordModels) {
            if (!models.includes(recordModel)) {
                models.push(recordModel);
            }
        }
        model = recordModels[0] || model;

        if (record && record.type === 'message') {
            const role = normalizeRole(record.role);
            if (role === 'assistant' || role === 'user' || role === 'system') {
                const content = record.message?.content ?? record.content ?? '';
                previewMessages.push({
                    role,
                    text: extractMessageText(content)
                });
            }
        }
    }

    const tailRecords = parseJsonlTailRecords(filePath, summaryReadBytes);
    for (const record of tailRecords) {
        applySessionUsageSummaryFromRecord(usageState, record, 'codebuddy');
        totalTokens = usageState.totalTokens || 0;
        contextWindow = usageState.contextWindow || 0;
        inputTokens = usageState.inputTokens || 0;
        cachedInputTokens = usageState.cachedInputTokens || 0;
        cacheCreationInputTokens = usageState.cacheCreationInputTokens || 0;
        outputTokens = usageState.outputTokens || 0;
        reasoningOutputTokens = usageState.reasoningOutputTokens || 0;
        provider = readExplicitSessionProviderFromRecord(record) || provider;
        const recordModels = readSessionModelsFromRecord(record);
        for (const recordModel of recordModels) {
            if (!models.includes(recordModel)) {
                models.push(recordModel);
            }
        }
        model = recordModels[0] || model;
    }

    const filteredPreviewMessages = removeLeadingSystemMessage(previewMessages);
    messageCount = filteredPreviewMessages.length;
    const firstUser = filteredPreviewMessages.find(item => item.role === 'user' && item.text);
    if (firstUser) {
        firstPrompt = truncateText(firstUser.text);
    }

    if (!firstPrompt) {
        const titleRecords = parseJsonlHeadRecords(filePath, titleReadBytes);
        const titleMessages = [];
        for (const record of titleRecords) {
            if (record && record.type === 'message') {
                const role = normalizeRole(record.role);
                if (role === 'assistant' || role === 'user' || role === 'system') {
                    const content = record.message?.content ?? record.content ?? '';
                    titleMessages.push({
                        role,
                        text: extractMessageText(content)
                    });
                }
            }
        }

        const filteredTitleMessages = removeLeadingSystemMessage(titleMessages);
        const titleUser = filteredTitleMessages.find(item => item.role === 'user' && item.text);
        if (titleUser) {
            firstPrompt = truncateText(titleUser.text);
        }
    }

    messageCount = Math.max(0, messageCount);

    return {
        source: 'codebuddy',
        sourceLabel: 'CodeBuddy Code',
        provider,
        model,
        models,
        sessionId,
        title: firstPrompt || sessionId,
        cwd,
        createdAt,
        updatedAt,
        messageCount,
        totalTokens,
        contextWindow,
        inputTokens,
        cachedInputTokens,
        cacheCreationInputTokens,
        outputTokens,
        reasoningOutputTokens,
        __messageCountExact: isSessionSummaryMessageCountExact(stat, summaryReadBytes),
        filePath,
        keywords: [],
        capabilities: { code: true }
    };
}

function extractGeminiMessageText(content) {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        const parts = [];
        for (const item of content) {
            if (!item) continue;
            if (typeof item === 'string') {
                parts.push(item);
                continue;
            }
            if (typeof item.text === 'string' && item.text.trim()) {
                parts.push(item.text);
                continue;
            }
            if (typeof item.content === 'string' && item.content.trim()) {
                parts.push(item.content);
            }
        }
        return parts.filter(Boolean).join('\n');
    }
    if (content && typeof content === 'object') {
        if (typeof content.text === 'string') {
            return content.text;
        }
        if (typeof content.content === 'string') {
            return content.content;
        }
        if (Array.isArray(content.parts)) {
            return extractGeminiMessageText(content.parts);
        }
        if (Array.isArray(content.content)) {
            return extractGeminiMessageText(content.content);
        }
    }
    return '';
}

function normalizeGeminiMessageRole(type) {
    const t = typeof type === 'string' ? type.trim().toLowerCase() : '';
    if (t === 'user') return 'user';
    if (t === 'gemini' || t === 'assistant' || t === 'model') return 'assistant';
    if (t === 'system' || t === 'info' || t === 'warning' || t === 'error') return 'system';
    return '';
}

function parseGeminiSessionSummary(filePath, options = {}) {
    const summaryReadBytes = Number.isFinite(Number(options.summaryReadBytes))
        ? Math.max(1024, Math.floor(Number(options.summaryReadBytes)))
        : SESSION_SUMMARY_READ_BYTES;
    const titleReadBytes = Number.isFinite(Number(options.titleReadBytes))
        ? Math.max(1024, Math.floor(Number(options.titleReadBytes)))
        : SESSION_TITLE_READ_BYTES;
    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch (_) {
        return null;
    }

    const fileName = path.basename(filePath);
    const projectHash = path.basename(path.dirname(path.dirname(filePath)));
    let sessionId = path.basename(filePath, '.json');
    let createdAt = '';
    let updatedAt = stat.mtime.toISOString();
    let provider = 'gemini';
    let model = '';
    const models = [];
    let firstPrompt = '';
    let messageCount = 0;

    let headText = '';
    try {
        const fd = fs.openSync(filePath, 'r');
        const buf = Buffer.alloc(summaryReadBytes);
        const bytes = fs.readSync(fd, buf, 0, summaryReadBytes, 0);
        fs.closeSync(fd);
        headText = bytes > 0 ? buf.slice(0, bytes).toString('utf-8') : '';
    } catch (_) {
        headText = '';
    }

    if (headText) {
        const sessionIdMatch = headText.match(/"sessionId"\s*:\s*"([^"]+)"/);
        if (sessionIdMatch) {
            sessionId = sessionIdMatch[1] || sessionId;
        }
        const startMatch = headText.match(/"startTime"\s*:\s*"([^"]+)"/);
        if (startMatch) {
            createdAt = toIsoTime(startMatch[1], createdAt);
        }
        const updatedMatch = headText.match(/"lastUpdated"\s*:\s*"([^"]+)"/);
        if (updatedMatch) {
            updatedAt = toIsoTime(updatedMatch[1], updatedAt);
        }
        const modelMatch = headText.match(/"model"\s*:\s*"([^"]+)"/);
        if (modelMatch && modelMatch[1]) {
            model = modelMatch[1];
            models.push(model);
        }
        const summaryMatch = headText.match(/"summary"\s*:\s*"([^"]+)"/);
        if (summaryMatch && summaryMatch[1]) {
            firstPrompt = truncateText(summaryMatch[1]);
        }
        if (!firstPrompt) {
            const userIdx = headText.search(/"type"\s*:\s*"user"/);
            if (userIdx >= 0) {
                const slice = headText.slice(userIdx, Math.min(headText.length, userIdx + titleReadBytes));
                const contentStringMatch = slice.match(/"content"\s*:\s*"((?:\\\\.|[^\"\\\\])*)"/);
                const textMatch = slice.match(/"text"\s*:\s*"((?:\\\\.|[^\"\\\\])*)"/);
                const raw = (contentStringMatch && contentStringMatch[1]) || (textMatch && textMatch[1]) || '';
                if (raw) {
                    try {
                        firstPrompt = truncateText(JSON.parse(`"${raw}"`));
                    } catch (_) {
                        firstPrompt = truncateText(raw);
                    }
                }
            }
        }
    }

    if (!createdAt) {
        createdAt = stat.mtime.toISOString();
    }

    const cwd = projectHash ? path.join(getGeminiTmpDir(), projectHash) : '';

    return {
        source: 'gemini',
        sourceLabel: 'Gemini CLI',
        provider,
        model,
        models,
        sessionId,
        title: firstPrompt || sessionId || fileName,
        cwd,
        createdAt,
        updatedAt,
        messageCount,
        totalTokens: 0,
        contextWindow: 0,
        inputTokens: 0,
        cachedInputTokens: 0,
        outputTokens: 0,
        reasoningOutputTokens: 0,
        __messageCountExact: false,
        filePath,
        keywords: [],
        capabilities: { code: true }
    };
}

function extractPiUsageFromMessage(message) {
    if (!message || typeof message !== 'object' || Array.isArray(message)) {
        return null;
    }
    const usage = message.usage;
    if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
        return null;
    }
    const inputTokens = readNonNegativeInteger(usage.input);
    const outputTokens = readNonNegativeInteger(usage.output);
    const cachedInputTokens = readNonNegativeInteger(usage.cacheRead);
    const cacheCreationInputTokens = readNonNegativeInteger(usage.cacheWrite);
    const reasoningOutputTokens = readNonNegativeInteger(usage.reasoning);
    if (inputTokens === null && outputTokens === null && cachedInputTokens === null && cacheCreationInputTokens === null && reasoningOutputTokens === null) {
        return null;
    }
    return {
        inputTokens: inputTokens || 0,
        cachedInputTokens: cachedInputTokens || 0,
        cacheCreationInputTokens: cacheCreationInputTokens || 0,
        outputTokens: outputTokens || 0,
        reasoningOutputTokens: reasoningOutputTokens || 0
    };
}

function parsePiSessionSummary(filePath, options = {}) {
    const summaryReadBytes = Number.isFinite(Number(options.summaryReadBytes))
        ? Math.max(1024, Math.floor(Number(options.summaryReadBytes)))
        : SESSION_SUMMARY_READ_BYTES;
    const titleReadBytes = Number.isFinite(Number(options.titleReadBytes))
        ? Math.max(1024, Math.floor(Number(options.titleReadBytes)))
        : SESSION_TITLE_READ_BYTES;
    const records = parseJsonlHeadRecords(filePath, summaryReadBytes);
    if (records.length === 0) {
        return null;
    }

    let stat;
    try {
        stat = fs.statSync(filePath);
    } catch (_) {
        return null;
    }

    let sessionId = path.basename(filePath, '.jsonl');
    let cwd = '';
    let createdAt = '';
    let updatedAt = stat.mtime.toISOString();
    let firstPrompt = '';
    let messageCount = 0;
    let totalTokens = 0;
    let contextWindow = 0;
    let inputTokens = 0;
    let cachedInputTokens = 0;
    let cacheCreationInputTokens = 0;
    let outputTokens = 0;
    let reasoningOutputTokens = 0;
    let provider = 'pi';
    let model = '';
    const models = [];
    const previewMessages = [];

    for (const record of records) {
        if (!createdAt && record && record.type === 'session' && record.timestamp) {
            createdAt = toIsoTime(record.timestamp, createdAt);
        }
        if (record && record.timestamp) {
            updatedAt = updateLatestIso(updatedAt, record.timestamp);
        }
        if (record && record.type === 'session') {
            sessionId = record.id || sessionId;
            cwd = record.cwd || cwd;
        }
        if (record && record.type === 'model_change' && record.modelId) {
            if (!models.includes(record.modelId)) {
                models.push(record.modelId);
            }
            model = model || record.modelId;
            if (record.provider) {
                provider = record.provider;
            }
        }
        if (record && record.type === 'message' && record.message && typeof record.message === 'object') {
            const role = normalizeRole(record.message.role);
            if (role === 'user' || role === 'assistant' || role === 'system') {
                messageCount += 1;
                const text = extractMessageText(record.message.content);
                if (role === 'assistant' && record.message.model && !models.includes(record.message.model)) {
                    models.push(record.message.model);
                    model = model || record.message.model;
                }
                if (record.message.provider) {
                    provider = record.message.provider;
                }
                const piUsage = extractPiUsageFromMessage(record.message);
                if (piUsage) {
                    inputTokens += piUsage.inputTokens;
                    cachedInputTokens += piUsage.cachedInputTokens;
                    cacheCreationInputTokens += piUsage.cacheCreationInputTokens;
                    outputTokens += piUsage.outputTokens;
                    reasoningOutputTokens += piUsage.reasoningOutputTokens;
                }
                if (text) {
                    previewMessages.push({ role, text });
                    if (!firstPrompt && role === 'user') {
                        firstPrompt = text.split('\n')[0].slice(0, 80);
                    }
                }
            }
        }
    }

    totalTokens = inputTokens + cachedInputTokens + cacheCreationInputTokens + outputTokens + reasoningOutputTokens;

    const tailRecords = parseJsonlTailRecords(filePath, summaryReadBytes);
    let tailMessageCount = 0;
    let tailHasMore = false;
    for (const record of tailRecords) {
        if (record && record.timestamp) {
            updatedAt = updateLatestIso(updatedAt, record.timestamp);
        }
        if (record && record.type === 'message' && record.message && typeof record.message === 'object') {
            const role = normalizeRole(record.message.role);
            if (role === 'user' || role === 'assistant' || role === 'system') {
                tailMessageCount += 1;
                const piUsage = extractPiUsageFromMessage(record.message);
                if (piUsage) {
                    inputTokens += piUsage.inputTokens;
                    cachedInputTokens += piUsage.cachedInputTokens;
                    cacheCreationInputTokens += piUsage.cacheCreationInputTokens;
                    outputTokens += piUsage.outputTokens;
                    reasoningOutputTokens += piUsage.reasoningOutputTokens;
                }
                if (role === 'assistant' && record.message.model && !models.includes(record.message.model)) {
                    models.push(record.message.model);
                }
                if (record.message.provider) {
                    provider = record.message.provider;
                }
            }
        }
    }
    totalTokens = inputTokens + cachedInputTokens + cacheCreationInputTokens + outputTokens + reasoningOutputTokens;

    const fileName = path.basename(filePath, '.jsonl');
    return {
        source: 'pi',
        sourceLabel: 'Pi',
        provider,
        model,
        models,
        sessionId,
        title: firstPrompt || sessionId || fileName,
        cwd,
        createdAt,
        updatedAt,
        messageCount,
        totalTokens,
        contextWindow,
        inputTokens,
        cachedInputTokens,
        cacheCreationInputTokens,
        outputTokens,
        reasoningOutputTokens,
        __messageCountExact: false,
        filePath,
        keywords: [],
        capabilities: { code: true }
    };
}

function listCodexSessions(limit, options = {}) {
    const codexSessionsDir = getCodexSessionsDir();
    const scanFactor = Number.isFinite(Number(options.scanFactor))
        ? Math.max(1, Number(options.scanFactor))
        : SESSION_SCAN_FACTOR;
    const minFiles = Number.isFinite(Number(options.minFiles))
        ? Math.max(1, Number(options.minFiles))
        : Math.min(SESSION_SCAN_MIN_FILES, MAX_SESSION_LIST_SIZE * SESSION_SCAN_FACTOR);
    const targetCount = Number.isFinite(Number(options.targetCount))
        ? Math.max(1, Math.floor(Number(options.targetCount)))
        : Math.max(1, Math.floor(limit * scanFactor));
    const scanCount = Number.isFinite(Number(options.scanCount))
        ? Math.max(targetCount, Math.floor(Number(options.scanCount)))
        : Math.max(targetCount, minFiles);
    const maxFilesScanned = Number.isFinite(Number(options.maxFilesScanned))
        ? Math.max(scanCount, Math.floor(Number(options.maxFilesScanned)))
        : Math.max(scanCount * 2, minFiles);
    const summaryReadBytes = Number.isFinite(Number(options.summaryReadBytes))
        ? Math.max(1024, Math.floor(Number(options.summaryReadBytes)))
        : SESSION_SUMMARY_READ_BYTES;
    const titleReadBytes = Number.isFinite(Number(options.titleReadBytes))
        ? Math.max(1024, Math.floor(Number(options.titleReadBytes)))
        : SESSION_TITLE_READ_BYTES;
    const files = collectRecentJsonlFilesFromRoots([codexSessionsDir, getCodexmateDerivedSessionsRoot('codex')], {
        returnCount: scanCount,
        maxFilesScanned
    });
    const sessions = [];

    for (const filePath of files) {
        const summary = parseCodexSessionSummary(filePath, {
            summaryReadBytes,
            titleReadBytes
        });
        if (summary) {
            sessions.push(attachSessionNativeStatus({
                ...summary,
                derived: isDerivedSessionFile(filePath)
            }));
        }

        if (sessions.length >= targetCount) {
            break;
        }
    }

    return mergeAndLimitSessions(sessions, limit);
}

function listClaudeSessions(limit, options = {}) {
    const claudeProjectsDir = getClaudeProjectsDir();
    const derivedClaudeRoot = getCodexmateDerivedSessionsRoot('claude');
    const hasProjectsDir = fs.existsSync(claudeProjectsDir);
    const hasDerivedDir = fs.existsSync(derivedClaudeRoot);
    if (!hasProjectsDir && !hasDerivedDir) {
        return [];
    }

    const scanFactor = Number.isFinite(Number(options.scanFactor))
        ? Math.max(1, Number(options.scanFactor))
        : SESSION_SCAN_FACTOR;
    const minFiles = Number.isFinite(Number(options.minFiles))
        ? Math.max(1, Number(options.minFiles))
        : Math.min(SESSION_SCAN_MIN_FILES, MAX_SESSION_LIST_SIZE * SESSION_SCAN_FACTOR);
    const targetCount = Number.isFinite(Number(options.targetCount))
        ? Math.max(1, Math.floor(Number(options.targetCount)))
        : Math.max(1, Math.floor(limit * scanFactor));
    const scanCount = Number.isFinite(Number(options.scanCount))
        ? Math.max(targetCount, Math.floor(Number(options.scanCount)))
        : Math.max(targetCount, minFiles);
    const maxFilesScanned = Number.isFinite(Number(options.maxFilesScanned))
        ? Math.max(scanCount, Math.floor(Number(options.maxFilesScanned)))
        : Math.max(scanCount * 2, minFiles);
    const summaryReadBytes = Number.isFinite(Number(options.summaryReadBytes))
        ? Math.max(1024, Math.floor(Number(options.summaryReadBytes)))
        : SESSION_SUMMARY_READ_BYTES;
    const titleReadBytes = Number.isFinite(Number(options.titleReadBytes))
        ? Math.max(1024, Math.floor(Number(options.titleReadBytes)))
        : SESSION_TITLE_READ_BYTES;

    const sessions = [];
    let projectDirs = [];
    if (hasProjectsDir) {
        try {
            projectDirs = fs.readdirSync(claudeProjectsDir, { withFileTypes: true })
                .filter(entry => entry.isDirectory())
                .map(entry => path.join(claudeProjectsDir, entry.name));
        } catch (e) {
            projectDirs = [];
        }
    }

    for (const projectDir of projectDirs) {
        const indexPath = path.join(projectDir, 'sessions-index.json');
        const index = readJsonFile(indexPath, null);
        if (!index || !Array.isArray(index.entries)) {
            continue;
        }

        for (const entry of index.entries) {
            if (!entry || typeof entry !== 'object') continue;
            const sessionId = entry.sessionId || '';
            if (!sessionId) continue;

            let filePath = typeof entry.fullPath === 'string' && entry.fullPath
                ? entry.fullPath
                : path.join(projectDir, `${sessionId}.jsonl`);
            filePath = expandHomePath(filePath);
            if (filePath && !path.isAbsolute(filePath)) {
                filePath = path.join(projectDir, filePath);
            }
            filePath = filePath ? path.resolve(filePath) : '';

            const fileStat = getFileStatSafe(filePath);
            if (!fileStat) {
                continue;
            }

            let updatedAt = toIsoTime(entry.modified || entry.fileMtime, fileStat.mtime.toISOString());
            let createdAt = toIsoTime(entry.created, '');
            let title = truncateText(entry.summary || entry.firstPrompt || sessionId, 120);
            let messageCount = Number.isFinite(entry.messageCount) ? Math.max(0, entry.messageCount - 1) : 0;
            let totalTokens = 0;
            let contextWindow = 0;
            let inputTokens = 0;
            let cachedInputTokens = 0;
            let cacheCreationInputTokens = 0;
            let outputTokens = 0;
            let reasoningOutputTokens = 0;
            let model = typeof entry.model === 'string' ? entry.model.trim() : '';
            const models = model ? [model] : [];

            const usageState = { totalTokens, contextWindow, inputTokens, cachedInputTokens, cacheCreationInputTokens, outputTokens, reasoningOutputTokens };
            applySessionUsageSummaryFromIndexEntry(usageState, entry);
            totalTokens = usageState.totalTokens || 0;
            contextWindow = usageState.contextWindow || 0;
            inputTokens = usageState.inputTokens || 0;
            cachedInputTokens = usageState.cachedInputTokens || 0;
            cacheCreationInputTokens = usageState.cacheCreationInputTokens || 0;
            outputTokens = usageState.outputTokens || 0;
            reasoningOutputTokens = usageState.reasoningOutputTokens || 0;

            const quickRecords = parseJsonlHeadRecords(filePath, summaryReadBytes);
            if (quickRecords.length > 0) {
                const filteredCount = countConversationMessagesInRecords(quickRecords, 'claude');
                if (filteredCount > 0 || messageCount === 0) {
                    messageCount = filteredCount;
                }

                const quickMessages = [];
                for (const record of quickRecords) {
                    if (record && record.timestamp) {
                        if (!createdAt) {
                            createdAt = toIsoTime(record.timestamp, createdAt);
                        }
                        updatedAt = updateLatestIso(updatedAt, record.timestamp);
                    }
                    applySessionUsageSummaryFromRecord(usageState, record, 'claude');
                    const recordModels = readSessionModelsFromRecord(record);
                    for (const recordModel of recordModels) {
                        if (!models.includes(recordModel)) {
                            models.push(recordModel);
                        }
                    }
                    model = recordModels[0] || model;
                    const role = normalizeRole(record.type);
                    if (role === 'assistant' || role === 'user' || role === 'system') {
                        const content = record.message ? record.message.content : '';
                        quickMessages.push({ role, text: extractMessageText(content) });
                    }
                }
                totalTokens = usageState.totalTokens || 0;
                contextWindow = usageState.contextWindow || 0;
                inputTokens = usageState.inputTokens || 0;
                cachedInputTokens = usageState.cachedInputTokens || 0;
                cacheCreationInputTokens = usageState.cacheCreationInputTokens || 0;
                outputTokens = usageState.outputTokens || 0;
                reasoningOutputTokens = usageState.reasoningOutputTokens || 0;
                const filteredQuickMessages = removeLeadingSystemMessage(quickMessages);
                const firstUser = filteredQuickMessages.find(item => item.role === 'user' && item.text);
                if (firstUser) {
                    title = truncateText(firstUser.text, 120);
                }
            }

            const tailRecords = parseJsonlTailRecords(filePath, summaryReadBytes);
            for (const record of tailRecords) {
                if (record && record.timestamp) {
                    if (!createdAt) {
                        createdAt = toIsoTime(record.timestamp, createdAt);
                    }
                    updatedAt = updateLatestIso(updatedAt, record.timestamp);
                }
                applySessionUsageSummaryFromRecord(usageState, record, 'claude');
                const recordModels = readSessionModelsFromRecord(record);
                for (const recordModel of recordModels) {
                    if (!models.includes(recordModel)) {
                        models.push(recordModel);
                    }
                }
                model = recordModels[0] || model;
            }
            totalTokens = usageState.totalTokens || 0;
            contextWindow = usageState.contextWindow || 0;
            inputTokens = usageState.inputTokens || 0;
            cachedInputTokens = usageState.cachedInputTokens || 0;
            cacheCreationInputTokens = usageState.cacheCreationInputTokens || 0;
            outputTokens = usageState.outputTokens || 0;
            reasoningOutputTokens = usageState.reasoningOutputTokens || 0;

            const provider = typeof entry.provider === 'string' && entry.provider.trim()
                ? entry.provider.trim()
                : 'claude';
            const keywords = normalizeKeywords(entry.keywords);
            const capabilities = normalizeCapabilities(entry.capabilities);

            sessions.push(attachSessionNativeStatus({
                source: 'claude',
                sourceLabel: 'Claude Code',
                provider,
                sessionId,
                title,
                cwd: entry.projectPath || index.originalPath || '',
                createdAt,
                updatedAt,
                messageCount,
                totalTokens,
                contextWindow,
                inputTokens,
                cachedInputTokens,
                cacheCreationInputTokens,
                outputTokens,
                reasoningOutputTokens,
                model,
                models,
                __messageCountExact: quickRecords.length > 0 && isSessionSummaryMessageCountExact(fileStat, summaryReadBytes),
                filePath,
                derived: isDerivedSessionFile(filePath),
                keywords,
                capabilities
            }));

            if (sessions.length >= targetCount) {
                break;
            }
        }

        if (sessions.length >= targetCount) {
            break;
        }
    }

    // 补充扫描未索引的 .jsonl 文件（包括 sessions-index.json 中遗漏的会话）
    const seenFilePaths = new Set(sessions.map((item) => item.filePath).filter(Boolean));
    const fallbackFiles = collectRecentJsonlFiles(claudeProjectsDir, {
        returnCount: scanCount,
        maxFilesScanned,
        ignoreSubPath: `${path.sep}subagents${path.sep}`
    });
    for (const filePath of fallbackFiles) {
        if (seenFilePaths.has(filePath)) continue;
        const summary = parseClaudeSessionSummary(filePath, {
            summaryReadBytes,
            titleReadBytes
        });
        if (summary) {
            sessions.push(attachSessionNativeStatus({
                ...summary,
                derived: isDerivedSessionFile(filePath)
            }));
            seenFilePaths.add(filePath);
        }

        if (sessions.length >= targetCount) {
            break;
        }
    }

    if (fs.existsSync(derivedClaudeRoot)) {
        const seen = new Set(sessions.map((item) => (item && item.filePath ? item.filePath : '')).filter(Boolean));
        const derivedFiles = collectRecentJsonlFiles(derivedClaudeRoot, {
            returnCount: scanCount,
            maxFilesScanned
        });
        for (const filePath of derivedFiles) {
            if (seen.has(filePath)) continue;
            const summary = parseClaudeSessionSummary(filePath, {
                summaryReadBytes,
                titleReadBytes
            });
            if (summary) {
                sessions.push(attachSessionNativeStatus({
                    ...summary,
                    derived: isDerivedSessionFile(filePath)
                }));
            }
            seen.add(filePath);
        }
    }

    return mergeAndLimitSessions(sessions, limit);
}

function listGeminiSessions(limit, options = {}) {
    const geminiTmpDir = getGeminiTmpDir();
    if (!fs.existsSync(geminiTmpDir)) {
        return [];
    }

    const scanFactor = Number.isFinite(Number(options.scanFactor))
        ? Math.max(1, Number(options.scanFactor))
        : SESSION_SCAN_FACTOR;
    const minFiles = Number.isFinite(Number(options.minFiles))
        ? Math.max(1, Number(options.minFiles))
        : Math.min(SESSION_SCAN_MIN_FILES, MAX_SESSION_LIST_SIZE * SESSION_SCAN_FACTOR);
    const targetCount = Number.isFinite(Number(options.targetCount))
        ? Math.max(1, Math.floor(Number(options.targetCount)))
        : Math.max(1, Math.floor(limit * scanFactor));
    const scanCount = Number.isFinite(Number(options.scanCount))
        ? Math.max(targetCount, Math.floor(Number(options.scanCount)))
        : Math.max(targetCount, minFiles);
    const maxFilesScanned = Number.isFinite(Number(options.maxFilesScanned))
        ? Math.max(scanCount, Math.floor(Number(options.maxFilesScanned)))
        : Math.max(scanCount * 2, minFiles);
    const summaryReadBytes = Number.isFinite(Number(options.summaryReadBytes))
        ? Math.max(1024, Math.floor(Number(options.summaryReadBytes)))
        : SESSION_SUMMARY_READ_BYTES;
    const titleReadBytes = Number.isFinite(Number(options.titleReadBytes))
        ? Math.max(1024, Math.floor(Number(options.titleReadBytes)))
        : SESSION_TITLE_READ_BYTES;

    const sessions = [];
    const filesMeta = [];
    let scanned = 0;
    let projectDirs = [];
    try {
        projectDirs = fs.readdirSync(geminiTmpDir, { withFileTypes: true })
            .filter(entry => entry.isDirectory())
            .map(entry => path.join(geminiTmpDir, entry.name));
    } catch (_) {
        projectDirs = [];
    }

    for (const projectDir of projectDirs) {
        const chatsDir = path.join(projectDir, 'chats');
        if (!fs.existsSync(chatsDir)) {
            continue;
        }
        let entries = [];
        try {
            entries = fs.readdirSync(chatsDir, { withFileTypes: true });
        } catch (_) {
            entries = [];
        }
        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.json')) {
                continue;
            }
            const fullPath = path.join(chatsDir, entry.name);
            try {
                const stat = fs.statSync(fullPath);
                filesMeta.push({ filePath: fullPath, mtimeMs: stat.mtimeMs || 0 });
            } catch (_) { }
            scanned += 1;
            if (scanned >= maxFilesScanned) {
                break;
            }
        }
        if (scanned >= maxFilesScanned) {
            break;
        }
    }

    filesMeta.sort((a, b) => b.mtimeMs - a.mtimeMs);
    for (const item of filesMeta.slice(0, scanCount)) {
        const summary = parseGeminiSessionSummary(item.filePath, { summaryReadBytes, titleReadBytes });
        if (summary) {
            sessions.push(summary);
        }
        if (sessions.length >= targetCount) {
            break;
        }
    }

    return mergeAndLimitSessions(sessions, limit);
}

function listCodeBuddySessions(limit, options = {}) {
    const projectsDir = getCodeBuddyProjectsDir();
    if (!fs.existsSync(projectsDir)) {
        return [];
    }

    const scanFactor = Number.isFinite(Number(options.scanFactor))
        ? Math.max(1, Number(options.scanFactor))
        : SESSION_SCAN_FACTOR;
    const minFiles = Number.isFinite(Number(options.minFiles))
        ? Math.max(1, Number(options.minFiles))
        : Math.min(SESSION_SCAN_MIN_FILES, MAX_SESSION_LIST_SIZE * SESSION_SCAN_FACTOR);
    const targetCount = Number.isFinite(Number(options.targetCount))
        ? Math.max(1, Math.floor(Number(options.targetCount)))
        : Math.max(1, Math.floor(limit * scanFactor));
    const scanCount = Number.isFinite(Number(options.scanCount))
        ? Math.max(targetCount, Math.floor(Number(options.scanCount)))
        : Math.max(targetCount, minFiles);
    const maxFilesScanned = Number.isFinite(Number(options.maxFilesScanned))
        ? Math.max(scanCount, Math.floor(Number(options.maxFilesScanned)))
        : Math.max(scanCount * 2, minFiles);
    const summaryReadBytes = Number.isFinite(Number(options.summaryReadBytes))
        ? Math.max(1024, Math.floor(Number(options.summaryReadBytes)))
        : SESSION_SUMMARY_READ_BYTES;
    const titleReadBytes = Number.isFinite(Number(options.titleReadBytes))
        ? Math.max(1024, Math.floor(Number(options.titleReadBytes)))
        : SESSION_TITLE_READ_BYTES;

    const files = collectRecentJsonlFiles(projectsDir, {
        returnCount: scanCount,
        maxFilesScanned,
        ignoreSubPath: `${path.sep}subagents${path.sep}`
    });
    const sessions = [];
    for (const filePath of files) {
        if (path.basename(filePath) === 'history.jsonl') {
            continue;
        }
        const summary = parseCodeBuddySessionSummary(filePath, {
            summaryReadBytes,
            titleReadBytes
        });
        if (summary) {
            sessions.push(summary);
        }
        if (sessions.length >= targetCount) {
            break;
        }
    }
    return mergeAndLimitSessions(sessions, limit);
}

function listPiSessions(limit, options = {}) {
    const sessionsDir = getPiSessionsDir();
    if (!fs.existsSync(sessionsDir)) {
        return [];
    }

    const scanFactor = Number.isFinite(Number(options.scanFactor))
        ? Math.max(1, Number(options.scanFactor))
        : SESSION_SCAN_FACTOR;
    const minFiles = Number.isFinite(Number(options.minFiles))
        ? Math.max(1, Number(options.minFiles))
        : Math.min(SESSION_SCAN_MIN_FILES, MAX_SESSION_LIST_SIZE * SESSION_SCAN_FACTOR);
    const targetCount = Number.isFinite(Number(options.targetCount))
        ? Math.max(1, Math.floor(Number(options.targetCount)))
        : Math.max(1, Math.floor(limit * scanFactor));
    const scanCount = Number.isFinite(Number(options.scanCount))
        ? Math.max(targetCount, Math.floor(Number(options.scanCount)))
        : Math.max(targetCount, minFiles);
    const maxFilesScanned = Number.isFinite(Number(options.maxFilesScanned))
        ? Math.max(scanCount, Math.floor(Number(options.maxFilesScanned)))
        : Math.max(scanCount * 2, minFiles);
    const summaryReadBytes = Number.isFinite(Number(options.summaryReadBytes))
        ? Math.max(1024, Math.floor(Number(options.summaryReadBytes)))
        : SESSION_SUMMARY_READ_BYTES;
    const titleReadBytes = Number.isFinite(Number(options.titleReadBytes))
        ? Math.max(1024, Math.floor(Number(options.titleReadBytes)))
        : SESSION_TITLE_READ_BYTES;

    const files = collectRecentJsonlFiles(sessionsDir, {
        returnCount: scanCount,
        maxFilesScanned
    });
    const sessions = [];
    for (const filePath of files) {
        const summary = parsePiSessionSummary(filePath, {
            summaryReadBytes,
            titleReadBytes
        });
        if (summary) {
            sessions.push(summary);
        }
        if (sessions.length >= targetCount) {
            break;
        }
    }
    return mergeAndLimitSessions(sessions, limit);
}

async function listAllSessions(params = {}) {
    const source = params.source === 'codex' || params.source === 'claude' || params.source === 'gemini' || params.source === 'codebuddy' || params.source === 'pi'
        ? params.source
        : 'all';
    const rawLimit = Number(params.limit);
    const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(rawLimit, MAX_SESSION_LIST_SIZE))
        : 120;
    const forceRefresh = !!params.forceRefresh;
    const normalizedPathFilter = normalizeSessionPathFilter(params.pathFilter);
    const hasPathFilter = !!normalizedPathFilter;
    const queryTokens = expandSessionQueryTokens(normalizeQueryTokens(params.query));
    const hasQuery = queryTokens.length > 0;
    const browseLightweight = params.browseLightweight === true && !hasQuery && !hasPathFilter;
    const queryKeyRaw = typeof params.query === 'string' ? params.query.trim() : '';
    const queryKey = queryKeyRaw.length > 240 ? queryKeyRaw.slice(0, 240) : queryKeyRaw;
    const cacheKey = hasQuery
        ? `query:${source}:${limit}:${normalizedPathFilter}:${params.queryMode || ''}:${params.queryScope || ''}:${params.roleFilter || ''}:${Number(params.contentScanLimit) || ''}:${Number(params.contentScanBytes) || ''}:${queryKey}`
        : `${browseLightweight ? 'browse' : 'default'}:${source}:${limit}:${normalizedPathFilter}`;
    const cached = getSessionListCache(cacheKey, forceRefresh);
    if (cached) {
        return cached;
    }

    const scanOptions = hasPathFilter
        ? {
            scanFactor: SESSION_SCAN_FACTOR * 2,
            minFiles: SESSION_SCAN_MIN_FILES * 2
        }
        : (browseLightweight
            ? {
                scanFactor: SESSION_BROWSE_SCAN_FACTOR,
                minFiles: SESSION_BROWSE_MIN_FILES,
                summaryReadBytes: SESSION_BROWSE_SUMMARY_READ_BYTES,
                titleReadBytes: SESSION_BROWSE_SUMMARY_READ_BYTES
            }
            : {});

    let sessions = [];
    if (source === 'all' || source === 'codex') {
        sessions = sessions.concat(listSessionInventoryBySource('codex', limit, scanOptions, { forceRefresh }));
    }
    if (source === 'all' || source === 'claude') {
        sessions = sessions.concat(listSessionInventoryBySource('claude', limit, scanOptions, { forceRefresh }));
    }
    if (source === 'all' || source === 'gemini') {
        sessions = sessions.concat(listSessionInventoryBySource('gemini', limit, scanOptions, { forceRefresh }));
    }
    if (source === 'all' || source === 'codebuddy') {
        sessions = sessions.concat(listSessionInventoryBySource('codebuddy', limit, scanOptions, { forceRefresh }));
    }
    if (source === 'all' || source === 'pi') {
        sessions = sessions.concat(listSessionInventoryBySource('pi', limit, scanOptions, { forceRefresh }));
    }

    if (hasPathFilter) {
        sessions = sessions.filter(item => matchesSessionPathFilter(item, normalizedPathFilter));
    }

    let result = sessions;
    if (hasQuery) {
        result = await applySessionQueryFilter(result, {
            tokens: queryTokens,
            queryMode: params.queryMode,
            queryScope: params.queryScope,
            roleFilter: params.roleFilter,
            contentScanLimit: params.contentScanLimit,
            contentScanBytes: params.contentScanBytes
        });
    }
    result = mergeAndLimitSessions(result, limit);
    setSessionListCache(cacheKey, result);
    return result;
}

async function listAllSessionsData(params = {}) {
    const source = params.source === 'codex' || params.source === 'claude'
        ? params.source
        : 'all';
    const rawLimit = Number(params.limit);
    const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(rawLimit, MAX_SESSION_LIST_SIZE))
        : 120;
    const forceRefresh = !!params.forceRefresh;
    const normalizedPathFilter = normalizeSessionPathFilter(params.pathFilter);
    const queryTokens = expandSessionQueryTokens(normalizeQueryTokens(params.query));
    const hasQuery = queryTokens.length > 0;
    const cacheKey = hasQuery ? '' : `exact:${source}:${limit}:${normalizedPathFilter}`;
    if (!hasQuery) {
        const cached = getSessionListCache(cacheKey, forceRefresh);
        if (cached) {
            return cached;
        }
    }

    const sessions = await listAllSessions(params);
    const hydratedSessions = await hydrateSessionItemsExactMessageCount(sessions);
    const result = hydratedSessions.map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return item;
        }
        const normalized = { ...item };
        delete normalized.__messageCountExact;
        return normalized;
    });
    if (!hasQuery) {
        setSessionListCache(cacheKey, result);
    }
    return result;
}

async function listSessionBrowse(params = {}) {
    const sessions = await listAllSessions({
        ...params,
        browseLightweight: true
    });
    return Array.isArray(sessions)
        ? sessions.map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                return item;
            }
            const normalized = { ...item };
            delete normalized.__messageCountExact;
            return normalized;
        })
        : [];
}

async function listSessionUsage(params = {}) {
    return listSessionUsageCore(params, {
        fs,
        listSessionBrowse,
        parseCodexSessionSummary,
        parseClaudeSessionSummary,
        parseCodeBuddySessionSummary,
        parseGeminiSessionSummary,
        parsePiSessionSummary,
        MAX_SESSION_USAGE_LIST_SIZE,
        SESSION_BROWSE_SUMMARY_READ_BYTES
    });
}

async function exportSessionUsage(params = {}) {
    return exportSessionUsageCore(params, {
        listSessionUsage
    });
}

function listSessionPaths(params = {}) {
    const source = typeof params.source === 'string' ? params.source.trim().toLowerCase() : '';
    if (source && source !== 'codex' && source !== 'claude' && source !== 'gemini' && source !== 'codebuddy' && source !== 'pi' && source !== 'all') {
        return [];
    }
    const validSource = source === 'codex' || source === 'claude' || source === 'gemini' || source === 'codebuddy' || source === 'pi' ? source : 'all';
    const rawLimit = Number(params.limit);
    const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(rawLimit, MAX_SESSION_PATH_LIST_SIZE))
        : 500;
    const forceRefresh = !!params.forceRefresh;
    const cacheKey = `paths:${validSource}:${limit}`;
    const cached = getSessionListCache(cacheKey, forceRefresh);
    if (cached) {
        return cached;
    }

    const gatherLimit = Math.min(MAX_SESSION_PATH_LIST_SIZE, Math.max(limit * 4, 800));
    const scanOptions = {
        scanFactor: SESSION_SCAN_FACTOR * 2,
        minFiles: SESSION_SCAN_MIN_FILES * 2,
        targetCount: Math.max(gatherLimit * 2, 1000),
        summaryReadBytes: SESSION_BROWSE_SUMMARY_READ_BYTES,
        titleReadBytes: SESSION_BROWSE_SUMMARY_READ_BYTES
    };

    let sessions = [];
    if (validSource === 'all' || validSource === 'codex') {
        sessions = sessions.concat(listSessionInventoryBySource('codex', gatherLimit, scanOptions, { forceRefresh }));
    }
    if (validSource === 'all' || validSource === 'claude') {
        sessions = sessions.concat(listSessionInventoryBySource('claude', gatherLimit, scanOptions, { forceRefresh }));
    }
    if (validSource === 'all' || validSource === 'gemini') {
        sessions = sessions.concat(listSessionInventoryBySource('gemini', gatherLimit, scanOptions, { forceRefresh }));
    }
    if (validSource === 'all' || validSource === 'codebuddy') {
        sessions = sessions.concat(listSessionInventoryBySource('codebuddy', gatherLimit, scanOptions, { forceRefresh }));
    }
    if (validSource === 'all' || validSource === 'pi') {
        sessions = sessions.concat(listSessionInventoryBySource('pi', gatherLimit, scanOptions, { forceRefresh }));
    }

    const dedupedPaths = [];
    const seen = new Set();
    const sorted = sortSessionsByUpdatedAt(sessions);
    for (const session of sorted) {
        const cwd = typeof session.cwd === 'string' ? session.cwd.trim() : '';
        if (!cwd) {
            continue;
        }
        const key = cwd.toLowerCase();
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        dedupedPaths.push(cwd);
        if (dedupedPaths.length >= limit) {
            break;
        }
    }

    setSessionListCache(cacheKey, dedupedPaths);
    return dedupedPaths;
}

function resolveSessionFilePath(source, filePath, sessionId) {
    const normalizedSource = source === 'claude' || source === 'gemini' || source === 'codebuddy' || source === 'pi'
        ? source
        : 'codex';
    const homeDir = process && process.env && process.env.HOME ? process.env.HOME : '';
    const derivedCodexDir = homeDir ? `${homeDir}/.codexmate/sessions/derived/codex` : '';
    const derivedClaudeDir = homeDir ? `${homeDir}/.codexmate/sessions/derived/claude` : '';
    const roots = normalizedSource === 'claude'
        ? [getClaudeProjectsDir(), derivedClaudeDir]
        : (normalizedSource === 'gemini'
            ? [getGeminiTmpDir()]
            : (normalizedSource === 'codebuddy'
                ? [getCodeBuddyProjectsDir()]
                : (normalizedSource === 'pi'
                    ? [getPiSessionsDir()]
                    : [getCodexSessionsDir(), derivedCodexDir])));
    const availableRoots = roots.filter((dirPath) => dirPath && fs.existsSync(dirPath));
    if (availableRoots.length === 0) {
        return '';
    }

    if (typeof filePath === 'string' && filePath.trim()) {
        const expandedPath = expandHomePath(filePath.trim());
        const targetPath = expandedPath ? path.resolve(expandedPath) : '';
        if (targetPath && fs.existsSync(targetPath) && availableRoots.some((rootPath) => isPathInside(targetPath, rootPath))) {
            return targetPath;
        }
    }

    if (typeof sessionId === 'string' && sessionId.trim()) {
        const targetId = sessionId.trim().toLowerCase();
        const lookupStore = g_sessionFileLookupCache[normalizedSource];
        if (lookupStore instanceof Map && lookupStore.has(targetId)) {
            const cachedPath = lookupStore.get(targetId);
            if (cachedPath && fs.existsSync(cachedPath) && availableRoots.some((rootPath) => isPathInside(cachedPath, rootPath))) {
                return cachedPath;
            }
            lookupStore.delete(targetId);
        }
        let matchedFile = '';
        if (normalizedSource === 'gemini') {
            const filesMeta = [];
            let projectDirs = [];
            try {
                projectDirs = fs.readdirSync(root, { withFileTypes: true })
                    .filter(entry => entry.isDirectory())
                    .map(entry => path.join(root, entry.name));
            } catch (_) {
                projectDirs = [];
            }
            for (const projectDir of projectDirs) {
                const chatsDir = path.join(projectDir, 'chats');
                if (!fs.existsSync(chatsDir)) continue;
                let entries = [];
                try {
                    entries = fs.readdirSync(chatsDir, { withFileTypes: true });
                } catch (_) {
                    entries = [];
                }
                for (const entry of entries) {
                    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
                    const fullPath = path.join(chatsDir, entry.name);
                    filesMeta.push(fullPath);
                    if (filesMeta.length >= 5000) break;
                }
                if (filesMeta.length >= 5000) break;
            }
            matchedFile = filesMeta.find(item => path.basename(item, '.json').toLowerCase() === targetId) || '';
        } else {
            const files = [];
            for (const rootPath of availableRoots) {
                files.push(...collectJsonlFiles(rootPath, 5000));
                if (files.length >= 5000) break;
            }
            matchedFile = files.find(item => path.basename(item, '.jsonl').toLowerCase() === targetId) || '';
        }
        if (matchedFile && fs.existsSync(matchedFile)) {
            return matchedFile;
        }
    }

    return '';
}

function getSessionFileArg(params = {}) {
    if (!params || typeof params !== 'object') {
        return '';
    }
    if (typeof params.filePath === 'string' && params.filePath.trim()) {
        return params.filePath.trim();
    }
    if (typeof params.file === 'string' && params.file.trim()) {
        return params.file.trim();
    }
    return '';
}

function findClaudeSessionIndexPath(sessionFilePath) {
    const root = getClaudeProjectsDir();
    if (!root || !sessionFilePath) {
        return '';
    }
    if (!isPathInside(sessionFilePath, root)) {
        return '';
    }
    let current = path.dirname(sessionFilePath);
    const resolvedRoot = path.resolve(root);
    while (current && isPathInside(current, resolvedRoot)) {
        const candidate = path.join(current, 'sessions-index.json');
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return '';
}

function resolveClaudeProjectDirForCwd(cwd) {
    const projectsDir = getClaudeProjectsDir();
    const raw = typeof cwd === 'string' ? cwd.trim() : '';
    if (!projectsDir || !raw) {
        return '';
    }
    const ignoreCase = process.platform === 'win32';
    const resolvedCwd = path.resolve(expandHomePath(raw));
    let entries = [];
    try {
        entries = fs.readdirSync(projectsDir, { withFileTypes: true });
    } catch (_) {
        entries = [];
    }
    for (const entry of entries) {
        if (!entry || !entry.isDirectory()) continue;
        const projectDir = path.join(projectsDir, entry.name);
        const indexPath = path.join(projectDir, 'sessions-index.json');
        if (!fs.existsSync(indexPath)) continue;
        const index = readJsonFile(indexPath, null);
        const originalPathRaw = index && typeof index.originalPath === 'string' ? index.originalPath.trim() : '';
        if (!originalPathRaw) continue;
        const resolvedOriginal = path.resolve(expandHomePath(originalPathRaw));
        if (normalizePathForCompare(resolvedOriginal, { ignoreCase }) === normalizePathForCompare(resolvedCwd, { ignoreCase })) {
            return projectDir;
        }
    }
    const hash = crypto.createHash('sha1').update(resolvedCwd).digest('hex').slice(0, 12);
    return path.join(projectsDir, `codexmate-${hash}`);
}

function ensureClaudeSessionsIndex(indexPath, originalPath) {
    if (!indexPath) return;
    const resolvedOriginal = typeof originalPath === 'string' && originalPath.trim()
        ? path.resolve(expandHomePath(originalPath.trim()))
        : '';
    const existing = readJsonFile(indexPath, null);
    const index = existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...existing }
        : { entries: [] };
    if (!Array.isArray(index.entries)) {
        index.entries = [];
    }
    if (!index.originalPath && resolvedOriginal) {
        index.originalPath = resolvedOriginal;
    }
    if (!fs.existsSync(indexPath)) {
        if (!index.originalPath) {
            index.originalPath = resolvedOriginal || path.dirname(indexPath);
        }
        writeJsonAtomic(indexPath, index);
        return;
    }
    if (existing && typeof existing === 'object' && !Array.isArray(existing) && existing.originalPath === index.originalPath) {
        return;
    }
    writeJsonAtomic(indexPath, index);
}

const {
    findAvailablePort,
    saveBuiltinProxySettings,
    removePersistedBuiltinProxyProviderFromConfig,
    hasCodexConfigReadyForProxy,
    resolveBuiltinProxyProviderName,
    startBuiltinProxyRuntime,
    stopBuiltinProxyRuntime,
    getBuiltinProxyStatus
} = createBuiltinProxyRuntimeController({
    fs,
    https,
    CONFIG_FILE,
    BUILTIN_PROXY_SETTINGS_FILE,
    DEFAULT_BUILTIN_PROXY_SETTINGS,
    BUILTIN_PROXY_PROVIDER_NAME,
    CODEXMATE_MANAGED_MARKER,
    HTTP_KEEP_ALIVE_AGENT,
    HTTPS_KEEP_ALIVE_AGENT,
    readConfig,
    writeConfig,
    readConfigOrVirtualDefault,
    resolveAuthTokenFromCurrentProfile,
    isPlainObject,
    isBuiltinManagedProvider,
    findProviderSectionRanges,
    findProviderDescendantSectionRanges,
    normalizeLegacySegments,
    buildLegacySegmentsKey,
    formatHostForUrl
});

const {
    startBuiltinClaudeProxyRuntime,
    stopBuiltinClaudeProxyRuntime,
    getBuiltinClaudeProxyStatus
} = createBuiltinClaudeProxyRuntimeController({
    BUILTIN_CLAUDE_PROXY_SETTINGS_FILE,
    DEFAULT_BUILTIN_CLAUDE_PROXY_SETTINGS,
    BUILTIN_PROXY_PROVIDER_NAME,
    MAX_API_BODY_SIZE,
    HTTP_KEEP_ALIVE_AGENT,
    HTTPS_KEEP_ALIVE_AGENT,
    readConfigOrVirtualDefault,
    resolveBuiltinProxyProviderName,
    resolveAuthTokenFromCurrentProfile,
    OPENAI_BRIDGE_SETTINGS_FILE,
    resolveOpenaiBridgeUpstream
});

function applyBuiltinProxyProvider(params = {}) {
    return { error: '该功能已移除' };
}

async function ensureBuiltinProxyForCodexDefault(params = {}) {
    return { error: '该功能已移除' };
}

function readLocalBridgeSettings() {
    const defaults = { enabled: false, lastActiveProvider: '', lastModel: '', excludedProviders: [] };
    try {
        if (!fs.existsSync(LOCAL_BRIDGE_SETTINGS_FILE)) return defaults;
        const raw = JSON.parse(fs.readFileSync(LOCAL_BRIDGE_SETTINGS_FILE, 'utf-8'));
        return {
            enabled: !!raw.enabled,
            lastActiveProvider: typeof raw.lastActiveProvider === 'string' ? raw.lastActiveProvider.trim() : '',
            lastModel: typeof raw.lastModel === 'string' ? raw.lastModel.trim() : '',
            excludedProviders: Array.isArray(raw.excludedProviders) ? raw.excludedProviders.filter(p => typeof p === 'string') : []
        };
    } catch (e) {
        return defaults;
    }
}

function writeLocalBridgeSettings(settings) {
    assertToolConfigWriteAllowed('codex');
    fs.writeFileSync(LOCAL_BRIDGE_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

function toggleLocalBridgeProvider(params = {}) {
    const enable = !!params.enable;
    const settings = readLocalBridgeSettings();
    try {
        const config = readConfig();
        const currentProvider = typeof config.model_provider === 'string' ? config.model_provider.trim() : '';
        const currentModel = typeof config.model === 'string' ? config.model.trim() : '';

        if (enable) {
            if (currentProvider === 'local') return { success: true, enabled: true, notice: '已启用 local 转换' };
            settings.lastActiveProvider = currentProvider;
            settings.lastModel = currentModel;
            settings.enabled = true;
            writeLocalBridgeSettings(settings);
            let content = fs.readFileSync(CONFIG_FILE, 'utf-8');
            content = content.replace(/^(model_provider\s*=\s*)(["']).*?(["'])/m, `$1$2local$3`);
            writeConfig(content);
            return { success: true, enabled: true, previousProvider: currentProvider };
        } else {
            if (currentProvider !== 'local') {
                settings.enabled = false;
                writeLocalBridgeSettings(settings);
                return { success: true, enabled: false, notice: 'local 转换未启用' };
            }
            const restoreProvider = settings.lastActiveProvider || '';
            if (!restoreProvider) {
                settings.enabled = false;
                writeLocalBridgeSettings(settings);
                return { success: true, enabled: false, notice: '已关闭 local 转换（无历史 provider 可恢复）' };
            }
            let content = fs.readFileSync(CONFIG_FILE, 'utf-8');
            content = content.replace(/^(model_provider\s*=\s*)(["']).*?(["'])/m, `$1$2${restoreProvider}$3`);
            if (settings.lastModel) {
                content = content.replace(/^(model\s*=\s*)(["']).*?(["'])/m, `$1$2${settings.lastModel}$3`);
            }
            writeConfig(content);
            settings.enabled = false;
            writeLocalBridgeSettings(settings);
            return { success: true, enabled: false, restoredProvider: restoreProvider, restoredModel: settings.lastModel };
        }
    } catch (e) {
        return { error: e && e.message ? e.message : '操作失败' };
    }
}

function getLocalBridgeStatus() {
    const settings = readLocalBridgeSettings();
    let currentProvider = '';
    try {
        const config = readConfig();
        currentProvider = typeof config.model_provider === 'string' ? config.model_provider.trim() : '';
    } catch (e) { /* ignore */ }
    return {
        enabled: settings.enabled,
        active: currentProvider === 'local',
        excludedProviders: settings.excludedProviders,
        lastActiveProvider: settings.lastActiveProvider,
        lastModel: settings.lastModel
    };
}

function setLocalBridgeExcludedProviders(params = {}) {
    const names = Array.isArray(params.names) ? params.names.filter(n => typeof n === 'string' && n.trim()) : [];
    const settings = readLocalBridgeSettings();
    settings.excludedProviders = names;
    writeLocalBridgeSettings(settings);
    return { success: true, excludedProviders: names };
}

function getLocalBridgeExcludedProviders() {
    const settings = readLocalBridgeSettings();
    return { excludedProviders: settings.excludedProviders };
}

// ============================================================================
// Claude Local Bridge
// ============================================================================

function readClaudeLocalBridgeSettings() {
    const defaults = { enabled: false, lastActiveBaseUrl: '', lastModel: '', excludedProviders: [] };
    try {
        if (!fs.existsSync(CLAUDE_LOCAL_BRIDGE_SETTINGS_FILE)) return defaults;
        const raw = JSON.parse(fs.readFileSync(CLAUDE_LOCAL_BRIDGE_SETTINGS_FILE, 'utf-8'));
        return {
            enabled: !!raw.enabled,
            lastActiveBaseUrl: typeof raw.lastActiveBaseUrl === 'string' ? raw.lastActiveBaseUrl.trim() : '',
            lastModel: typeof raw.lastModel === 'string' ? raw.lastModel.trim() : '',
            excludedProviders: Array.isArray(raw.excludedProviders) ? raw.excludedProviders.filter(p => typeof p === 'string') : []
        };
    } catch (e) {
        return defaults;
    }
}

function writeClaudeLocalBridgeSettings(settings) {
    assertToolConfigWriteAllowed('claude');
    fs.writeFileSync(CLAUDE_LOCAL_BRIDGE_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

function readClaudeLocalProvidersFile() {
    try {
        if (!fs.existsSync(CLAUDE_LOCAL_PROVIDERS_FILE)) return { providers: {} };
        const raw = JSON.parse(fs.readFileSync(CLAUDE_LOCAL_PROVIDERS_FILE, 'utf-8'));
        return { providers: (raw && typeof raw.providers === 'object') ? raw.providers : {} };
    } catch (e) {
        return { providers: {} };
    }
}

function writeClaudeLocalProvidersFile(data) {
    assertToolConfigWriteAllowed('claude');
    ensureDir(CONFIG_DIR);
    fs.writeFileSync(CLAUDE_LOCAL_PROVIDERS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function syncClaudeProvidersToBridgeFile() {
    // Sync Claude configs from localStorage-equivalent (browser) to bridge file
    // Called when providers are added/updated/deleted via web UI
    const existing = readClaudeLocalProvidersFile();
    const providers = existing.providers || {};
    // Preserve existing entries, update from params
    return { providers };
}

function toggleClaudeLocalBridge(params = {}) {
    assertToolConfigWriteAllowed('claude');
    const enable = !!params.enable;
    const settings = readClaudeLocalBridgeSettings();

    try {
        const readResult = readJsonObjectFromFile(CLAUDE_SETTINGS_FILE, {});
        if (!readResult.ok) {
            return { success: false, error: readResult.error || '读取 Claude settings.json 失败' };
        }
        const currentSettings = readResult.data || {};
        const currentEnv = (currentSettings.env && typeof currentSettings.env === 'object' && !Array.isArray(currentSettings.env))
            ? currentSettings.env : {};
        const currentBaseUrl = typeof currentEnv.ANTHROPIC_BASE_URL === 'string' ? currentEnv.ANTHROPIC_BASE_URL.trim() : '';

        if (enable) {
            if (currentBaseUrl.includes('/bridge/claude-local/')) {
                return { success: true, enabled: true, notice: '已启用 Claude 本地负载均衡' };
            }
            settings.lastActiveBaseUrl = currentBaseUrl;
            settings.lastModel = typeof currentEnv.ANTHROPIC_MODEL === 'string' ? currentEnv.ANTHROPIC_MODEL.trim() : '';
            settings.enabled = true;
            writeClaudeLocalBridgeSettings(settings);

            const localPort = resolveWebPort();
            const localBaseUrl = `http://127.0.0.1:${localPort}/bridge/claude-local/v1`;
            const nextEnv = { ...currentEnv, ANTHROPIC_BASE_URL: localBaseUrl };
            const nextSettings = { ...currentSettings, env: nextEnv };
            ensureDir(CLAUDE_DIR);
            backupFileIfNeededOnce(CLAUDE_SETTINGS_FILE);
            writeJsonAtomic(CLAUDE_SETTINGS_FILE, nextSettings);
            return { success: true, enabled: true, previousBaseUrl: currentBaseUrl };
        } else {
            if (!currentBaseUrl.includes('/bridge/claude-local/')) {
                settings.enabled = false;
                writeClaudeLocalBridgeSettings(settings);
                return { success: true, enabled: false, notice: 'Claude 本地负载均衡未启用' };
            }
            const restoreBaseUrl = settings.lastActiveBaseUrl || '';
            if (!restoreBaseUrl) {
                settings.enabled = false;
                writeClaudeLocalBridgeSettings(settings);
                return { success: true, enabled: false, notice: '已关闭 Claude 本地负载均衡（无历史配置可恢复）' };
            }
            const nextEnv = { ...currentEnv, ANTHROPIC_BASE_URL: restoreBaseUrl };
            if (settings.lastModel) {
                nextEnv.ANTHROPIC_MODEL = settings.lastModel;
            }
            const nextSettings = { ...currentSettings, env: nextEnv };
            ensureDir(CLAUDE_DIR);
            backupFileIfNeededOnce(CLAUDE_SETTINGS_FILE);
            writeJsonAtomic(CLAUDE_SETTINGS_FILE, nextSettings);
            settings.enabled = false;
            writeClaudeLocalBridgeSettings(settings);
            return { success: true, enabled: false, restoredBaseUrl: restoreBaseUrl, restoredModel: settings.lastModel };
        }
    } catch (e) {
        return { error: e && e.message ? e.message : '操作失败' };
    }
}

function getClaudeLocalBridgeStatus() {
    const settings = readClaudeLocalBridgeSettings();
    let currentBaseUrl = '';
    try {
        const readResult = readJsonObjectFromFile(CLAUDE_SETTINGS_FILE, {});
        if (readResult.ok && readResult.data && readResult.data.env) {
            currentBaseUrl = typeof readResult.data.env.ANTHROPIC_BASE_URL === 'string' ? readResult.data.env.ANTHROPIC_BASE_URL.trim() : '';
        }
    } catch (e) { /* ignore */ }
    const providersData = readClaudeLocalProvidersFile();
    const providerNames = Object.keys(providersData.providers || {});
    return {
        enabled: settings.enabled,
        active: currentBaseUrl.includes('/bridge/claude-local/'),
        excludedProviders: settings.excludedProviders,
        lastActiveBaseUrl: settings.lastActiveBaseUrl,
        lastModel: settings.lastModel,
        providers: providerNames
    };
}

function setClaudeLocalBridgeExcludedProviders(params = {}) {
    const names = Array.isArray(params.names) ? params.names.filter(n => typeof n === 'string' && n.trim()) : [];
    const settings = readClaudeLocalBridgeSettings();
    settings.excludedProviders = names;
    writeClaudeLocalBridgeSettings(settings);
    return { success: true, excludedProviders: names };
}

function getClaudeLocalBridgeExcludedProviders() {
    const settings = readClaudeLocalBridgeSettings();
    return { excludedProviders: settings.excludedProviders };
}

function syncClaudeBridgeProviders(params = {}) {
    const providers = (params.providers && typeof params.providers === 'object') ? params.providers : {};
    const existing = readClaudeLocalProvidersFile();
    const excluded = existing.excludedProviders || [];
    writeClaudeLocalProvidersFile({ providers, excludedProviders: excluded });
    return { success: true, count: Object.keys(providers).length };
}

function removeClaudeSessionIndexEntry(indexPath, sessionFilePath, sessionId) {
    if (!indexPath || !fs.existsSync(indexPath)) {
        return { removed: false, entry: null };
    }
    const index = readJsonFile(indexPath, null);
    if (!index || !Array.isArray(index.entries)) {
        return { removed: false, entry: null };
    }
    const ignoreCase = process.platform === 'win32';
    const resolvedFile = sessionFilePath
        ? normalizePathForCompare(sessionFilePath, { ignoreCase })
        : '';
    let removedEntry = null;
    const filtered = index.entries.filter((entry) => {
        if (!entry || typeof entry !== 'object') {
            return false;
        }
        if (entry.fullPath) {
            const expanded = expandHomePath(entry.fullPath);
            const entryPath = expanded
                ? normalizePathForCompare(expanded, { ignoreCase })
                : '';
            if (entryPath && resolvedFile && entryPath === resolvedFile) {
                if (!removedEntry) {
                    removedEntry = entry;
                }
                return false;
            }
        }
        const entrySessionId = typeof entry.sessionId === 'string' ? entry.sessionId : '';
        if (!resolvedFile && sessionId && entrySessionId === sessionId) {
            if (!removedEntry) {
                removedEntry = entry;
            }
            return false;
        }
        return true;
    });
    if (filtered.length === index.entries.length) {
        return { removed: false, entry: null };
    }
    index.entries = filtered;
    writeJsonAtomic(indexPath, index);
    return {
        removed: true,
        entry: removedEntry && typeof removedEntry === 'object'
            ? JSON.parse(JSON.stringify(removedEntry))
            : null
    };
}

function moveFileSync(sourcePath, targetPath) {
    ensureDir(path.dirname(targetPath));
    try {
        fs.renameSync(sourcePath, targetPath);
        return;
    } catch (error) {
        if (!error || error.code !== 'EXDEV') {
            throw error;
        }
    }

    fs.copyFileSync(sourcePath, targetPath);
    try {
        fs.unlinkSync(sourcePath);
    } catch (error) {
        try {
            fs.unlinkSync(targetPath);
        } catch (_) { }
        throw error;
    }
}

function buildSessionSummaryFallback(source, filePath, sessionId = '') {
    const resolvedSessionId = sessionId || path.basename(filePath, '.jsonl');
    const sourceLabel = source === 'claude'
        ? 'Claude Code'
        : (source === 'gemini'
            ? 'Gemini CLI'
            : (source === 'codebuddy'
                ? 'CodeBuddy Code'
                : (source === 'pi' ? 'Pi' : 'Codex')));
    return {
        source,
        sourceLabel,
        provider: source === 'claude'
            ? 'claude'
            : (source === 'gemini'
                ? 'gemini'
                : (source === 'codebuddy'
                    ? 'codebuddy'
                    : (source === 'pi' ? 'pi' : 'codex'))),
        sessionId: resolvedSessionId,
        title: resolvedSessionId,
        cwd: '',
        createdAt: '',
        updatedAt: '',
        messageCount: 0,
        totalTokens: 0,
        contextWindow: 0,
        filePath,
        keywords: [],
        capabilities: source === 'claude' || source === 'gemini' || source === 'codebuddy' ? { code: true } : {}
    };
}

function generateSessionTrashId() {
    if (crypto.randomUUID) {
        return `trash-${crypto.randomUUID()}`;
    }
    return `trash-${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
}

function allocateSessionTrashTarget(extension = 'jsonl') {
    ensureDir(SESSION_TRASH_FILES_DIR);
    const safeExt = typeof extension === 'string' && extension.trim()
        ? extension.trim().replace(/^\./, '')
        : 'jsonl';
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const trashId = generateSessionTrashId();
        const trashFileName = `${trashId}.${safeExt}`;
        const trashFilePath = path.join(SESSION_TRASH_FILES_DIR, trashFileName);
        if (!fs.existsSync(trashFilePath)) {
            return { trashId, trashFileName, trashFilePath };
        }
    }
    const fallbackId = `trash-${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
    return {
        trashId: fallbackId,
        trashFileName: `${fallbackId}.${safeExt}`,
        trashFilePath: path.join(SESSION_TRASH_FILES_DIR, `${fallbackId}.${safeExt}`)
    };
}

function normalizeSessionTrashEntry(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        return null;
    }
    const source = entry.source === 'claude'
        ? 'claude'
        : (entry.source === 'codex'
            ? 'codex'
            : (entry.source === 'gemini'
                ? 'gemini'
                : (entry.source === 'codebuddy'
                    ? 'codebuddy'
                    : (entry.source === 'pi' ? 'pi' : ''))));
    const trashId = typeof entry.trashId === 'string' ? entry.trashId.trim() : '';
    if (!source || !trashId || trashId.includes('/') || trashId.includes('\\') || trashId.includes('\0')) {
        return null;
    }
    const sessionId = typeof entry.sessionId === 'string' ? entry.sessionId.trim() : '';
    const trashFileNameRaw = typeof entry.trashFileName === 'string' ? entry.trashFileName.trim() : '';
    const trashFileName = path.basename(trashFileNameRaw || `${trashId}.jsonl`);
    if (!trashFileName || trashFileName === '.' || trashFileName === '..' || trashFileName.includes('\0')) {
        return null;
    }
    return {
        trashId,
        trashFileName,
        source,
        sourceLabel: source === 'claude'
            ? 'Claude Code'
            : (source === 'gemini'
                ? 'Gemini CLI'
                : (source === 'codebuddy'
                    ? 'CodeBuddy Code'
                    : (source === 'pi' ? 'Pi' : 'Codex'))),
        sessionId: sessionId || trashId,
        title: typeof entry.title === 'string' && entry.title.trim() ? entry.title.trim() : (sessionId || trashId),
        cwd: typeof entry.cwd === 'string' ? entry.cwd : '',
        createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
        updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : '',
        deletedAt: typeof entry.deletedAt === 'string' ? entry.deletedAt : '',
        messageCount: Number.isFinite(Number(entry.messageCount))
            ? Math.max(0, Math.floor(Number(entry.messageCount)))
            : 0,
        messageCountMtimeMs: Number.isFinite(Number(entry.messageCountMtimeMs))
            ? Math.max(0, Math.floor(Number(entry.messageCountMtimeMs)))
            : 0,
        originalFilePath: typeof entry.originalFilePath === 'string' ? entry.originalFilePath : '',
        provider: typeof entry.provider === 'string' && entry.provider.trim()
            ? entry.provider.trim()
            : (source === 'claude' ? 'claude' : (source === 'gemini' ? 'gemini' : (source === 'codebuddy' ? 'codebuddy' : (source === 'pi' ? 'pi' : 'codex')))),
        keywords: normalizeKeywords(entry.keywords),
        capabilities: normalizeCapabilities(entry.capabilities),
        claudeIndexPath: typeof entry.claudeIndexPath === 'string' ? entry.claudeIndexPath : '',
        claudeIndexEntry: entry.claudeIndexEntry && typeof entry.claudeIndexEntry === 'object' && !Array.isArray(entry.claudeIndexEntry)
            ? entry.claudeIndexEntry
            : null
    };
}

function resolveSessionTrashFilePath(entry) {
    const normalized = normalizeSessionTrashEntry(entry);
    if (!normalized) {
        return '';
    }
    const filePath = path.join(SESSION_TRASH_FILES_DIR, normalized.trashFileName);
    return isPathInside(filePath, SESSION_TRASH_FILES_DIR) ? filePath : '';
}

function writeSessionTrashEntries(entries) {
    writeJsonAtomic(SESSION_TRASH_INDEX_FILE, {
        version: 1,
        updatedAt: new Date().toISOString(),
        entries
    });
}

function readSessionTrashEntries(options = {}) {
    const cleanup = options.cleanup !== false;
    const parsed = readJsonFile(SESSION_TRASH_INDEX_FILE, null);
    if (!parsed || !Array.isArray(parsed.entries)) {
        return [];
    }

    const normalizedEntries = [];
    let dirty = false;
    for (const rawEntry of parsed.entries) {
        const entry = normalizeSessionTrashEntry(rawEntry);
        if (!entry) {
            dirty = true;
            continue;
        }
        const trashFilePath = resolveSessionTrashFilePath(entry);
        if (!trashFilePath || !fs.existsSync(trashFilePath)) {
            dirty = true;
            continue;
        }
        normalizedEntries.push(entry);
    }

    if (dirty && cleanup) {
        writeSessionTrashEntries(normalizedEntries);
    }

    return normalizedEntries;
}

function purgeExpiredSessionTrashEntries(retentionDays) {
    const days = Number.isFinite(Number(retentionDays)) && Number(retentionDays) > 0
        ? Math.floor(Number(retentionDays))
        : DEFAULT_SESSION_TRASH_RETENTION_DAYS;
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const entries = readSessionTrashEntries({ cleanup: false });
    if (entries.length === 0) {
        return { purged: 0 };
    }
    const remaining = [];
    let purgedCount = 0;
    for (const entry of entries) {
        const deletedAtMs = Date.parse(entry.deletedAt || entry.updatedAt || '') || 0;
        if (deletedAtMs > 0 && deletedAtMs < cutoffMs) {
            const trashFilePath = resolveSessionTrashFilePath(entry);
            if (trashFilePath) {
                try { fs.unlinkSync(trashFilePath); } catch (_) { }
            }
            purgedCount += 1;
        } else {
            remaining.push(entry);
        }
    }
    if (purgedCount > 0) {
        writeSessionTrashEntries(remaining);
    }
    return { purged: purgedCount };
}

function buildSessionTrashEntry(summary, options = {}) {
    const source = options.source === 'claude'
        ? 'claude'
        : (options.source === 'gemini'
            ? 'gemini'
            : (options.source === 'codebuddy'
                ? 'codebuddy'
                : (options.source === 'pi' ? 'pi' : 'codex')));
    const sessionId = options.sessionId || summary.sessionId || path.basename(options.originalFilePath || summary.filePath || '', '.jsonl');
    const claudeIndexEntry = options.claudeIndexEntry && typeof options.claudeIndexEntry === 'object' && !Array.isArray(options.claudeIndexEntry)
        ? options.claudeIndexEntry
        : null;
    const deletedAt = typeof options.deletedAt === 'string' && options.deletedAt
        ? options.deletedAt
        : new Date().toISOString();
    const sourceLabel = source === 'claude'
        ? 'Claude Code'
        : (source === 'gemini'
            ? 'Gemini CLI'
            : (source === 'codebuddy'
                ? 'CodeBuddy Code'
                : (source === 'pi' ? 'Pi' : 'Codex')));
    const fallbackTitle = truncateText(
        (claudeIndexEntry && (claudeIndexEntry.summary || claudeIndexEntry.firstPrompt)) || sessionId,
        120
    );
    const rawFallbackMessageCount = claudeIndexEntry && claudeIndexEntry.messageCount;
    const fallbackMessageCount = Number.isFinite(Number(rawFallbackMessageCount))
        ? Math.max(0, Number(rawFallbackMessageCount))
        : 0;
    const resolvedMessageCount = Number.isFinite(Number(summary && summary.messageCount))
        ? Math.max(0, Math.floor(Number(summary.messageCount)))
        : fallbackMessageCount;
    const messageCountMtimeMs = getFileMtimeMs(options.trashFilePath);
    const normalizedClaudeKeywords = claudeIndexEntry && Array.isArray(claudeIndexEntry.keywords)
        ? normalizeKeywords(claudeIndexEntry.keywords)
        : [];
    const normalizedClaudeCapabilities = claudeIndexEntry
        ? normalizeCapabilities(claudeIndexEntry.capabilities)
        : {};
    const normalizedSummaryKeywords = normalizeKeywords(summary.keywords);
    const normalizedSummaryCapabilities = normalizeCapabilities(summary.capabilities);
    return {
        trashId: options.trashId,
        trashFileName: options.trashFileName,
        source,
        sourceLabel,
        sessionId,
        title: summary.title || fallbackTitle || sessionId,
        cwd: summary.cwd || (claudeIndexEntry && typeof claudeIndexEntry.projectPath === 'string' ? claudeIndexEntry.projectPath : ''),
        createdAt: summary.createdAt || toIsoTime(claudeIndexEntry && claudeIndexEntry.created, ''),
        updatedAt: summary.updatedAt || toIsoTime(claudeIndexEntry && (claudeIndexEntry.modified || claudeIndexEntry.fileMtime), ''),
        deletedAt,
        messageCount: resolvedMessageCount,
        messageCountMtimeMs,
        originalFilePath: options.originalFilePath || summary.filePath || '',
        provider: (claudeIndexEntry && typeof claudeIndexEntry.provider === 'string' && claudeIndexEntry.provider.trim())
            ? claudeIndexEntry.provider.trim()
            : (summary.provider || (source === 'claude' ? 'claude' : (source === 'gemini' ? 'gemini' : (source === 'codebuddy' ? 'codebuddy' : (source === 'pi' ? 'pi' : 'codex'))))),
        keywords: normalizedClaudeKeywords.length > 0 ? normalizedClaudeKeywords : normalizedSummaryKeywords,
        capabilities: Object.keys(normalizedClaudeCapabilities).length > 0
            ? normalizedClaudeCapabilities
            : normalizedSummaryCapabilities,
        claudeIndexPath: typeof options.claudeIndexPath === 'string' ? options.claudeIndexPath : '',
        claudeIndexEntry
    };
}

function resolveSessionRestoreTarget(entry) {
    const normalized = normalizeSessionTrashEntry(entry);
    if (!normalized) {
        return '';
    }
    const root = normalized.source === 'claude'
        ? getClaudeProjectsDir()
        : (normalized.source === 'gemini'
            ? getGeminiTmpDir()
            : (normalized.source === 'codebuddy'
                ? getCodeBuddyProjectsDir()
                : (normalized.source === 'pi' ? getPiSessionsDir() : getCodexSessionsDir())));
    const originalFilePath = typeof normalized.originalFilePath === 'string' ? normalized.originalFilePath.trim() : '';
    if (!root || !originalFilePath) {
        return '';
    }
    const expanded = expandHomePath(originalFilePath);
    const resolved = expanded ? path.resolve(expanded) : '';
    if (!resolved || !isPathInside(resolved, root)) {
        return '';
    }
    return resolved;
}

function resolveClaudeSessionRestoreIndexPath(entry, targetFilePath) {
    const fallbackIndexPath = findClaudeSessionIndexPath(targetFilePath) || path.join(path.dirname(targetFilePath), 'sessions-index.json');
    const fallbackResolved = fallbackIndexPath ? path.resolve(fallbackIndexPath) : '';
    const candidateRaw = entry && typeof entry.claudeIndexPath === 'string' ? entry.claudeIndexPath.trim() : '';
    if (!candidateRaw) {
        return fallbackResolved;
    }
    const claudeProjectsDir = getClaudeProjectsDir();
    if (!claudeProjectsDir) {
        return fallbackResolved;
    }
    const candidateIndexPath = path.resolve(candidateRaw);
    if (path.basename(candidateIndexPath).toLowerCase() !== 'sessions-index.json') {
        return fallbackResolved;
    }
    if (!isPathInside(candidateIndexPath, claudeProjectsDir)) {
        return fallbackResolved;
    }
    if (!isPathInside(targetFilePath, path.dirname(candidateIndexPath))) {
        return fallbackResolved;
    }
    return candidateIndexPath;
}

function buildClaudeSessionIndexEntry(entry, sessionFilePath) {
    const normalized = normalizeSessionTrashEntry(entry);
    const stored = normalized && normalized.claudeIndexEntry && typeof normalized.claudeIndexEntry === 'object'
        ? JSON.parse(JSON.stringify(normalized.claudeIndexEntry))
        : {};
    const storedCapabilities = stored && stored.capabilities && typeof stored.capabilities === 'object' && !Array.isArray(stored.capabilities)
        ? stored.capabilities
        : null;
    const storedKeywords = Array.isArray(stored && stored.keywords)
        ? stored.keywords
        : null;
    const normalizedMessageCount = Number(normalized && normalized.messageCount);
    const storedMessageCount = Number(stored && stored.messageCount);
    let modifiedAt = '';
    try {
        modifiedAt = fs.statSync(sessionFilePath).mtime.toISOString();
    } catch (e) {
        modifiedAt = normalized && normalized.updatedAt ? normalized.updatedAt : new Date().toISOString();
    }
    const projectDir = path.dirname(sessionFilePath);
    return {
        ...stored,
        sessionId: normalized.sessionId,
        fullPath: sessionFilePath,
        projectPath: (stored && typeof stored.projectPath === 'string' && stored.projectPath.trim())
            ? stored.projectPath.trim()
            : projectDir,
        created: (stored && typeof stored.created === 'string' && stored.created.trim())
            ? stored.created.trim()
            : (normalized.createdAt || modifiedAt),
        modified: modifiedAt,
        summary: (stored && typeof stored.summary === 'string' && stored.summary.trim())
            ? stored.summary.trim()
            : (normalized.title || normalized.sessionId),
        provider: (stored && typeof stored.provider === 'string' && stored.provider.trim())
            ? stored.provider.trim()
            : (normalized.provider || 'claude'),
        capabilities: normalizeCapabilities(
            storedCapabilities && Object.keys(storedCapabilities).length > 0
                ? storedCapabilities
                : normalized.capabilities
        ),
        keywords: normalizeKeywords(
            storedKeywords && storedKeywords.length > 0
                ? storedKeywords
                : normalized.keywords
        ),
        messageCount: Number.isFinite(normalizedMessageCount)
            ? buildClaudeStoredIndexMessageCount(normalizedMessageCount)
            : (
                Number.isFinite(storedMessageCount)
                    ? Math.max(0, Math.floor(storedMessageCount))
                    : buildClaudeStoredIndexMessageCount(normalized && normalized.messageCount)
            )
    };
}

function upsertClaudeSessionIndexEntry(indexPath, sessionFilePath, entry) {
    if (!indexPath) {
        return;
    }
    const parsed = readJsonFile(indexPath, null);
    const index = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    const entries = Array.isArray(index.entries) ? index.entries : [];
    const ignoreCase = process.platform === 'win32';
    const resolvedFile = normalizePathForCompare(sessionFilePath, { ignoreCase });
    const normalizedEntry = normalizeSessionTrashEntry(entry);
    const filtered = entries.filter((item) => {
        if (!item || typeof item !== 'object') {
            return false;
        }
        if (typeof item.fullPath === 'string' && item.fullPath) {
            const expanded = expandHomePath(item.fullPath);
            const itemPath = expanded
                ? normalizePathForCompare(expanded, { ignoreCase })
                : '';
            if (itemPath && itemPath === resolvedFile) {
                return false;
            }
        }
        const itemSessionId = typeof item.sessionId === 'string' ? item.sessionId : '';
        if (!resolvedFile && normalizedEntry.sessionId && itemSessionId === normalizedEntry.sessionId) {
            return false;
        }
        return true;
    });
    filtered.unshift(buildClaudeSessionIndexEntry(normalizedEntry, sessionFilePath));
    index.entries = filtered;
    if (!index.originalPath) {
        index.originalPath = path.dirname(indexPath);
    }
    writeJsonAtomic(indexPath, index);
}

async function listSessionTrashItems(params = {}) {
    const source = params.source === 'claude'
        ? 'claude'
        : (params.source === 'codex'
            ? 'codex'
            : (params.source === 'gemini'
                ? 'gemini'
                : (params.source === 'codebuddy'
                    ? 'codebuddy'
                    : (params.source === 'pi' ? 'pi' : 'all'))));
    const countOnly = params.countOnly === true;
    const rawLimit = Number(params.limit);
    const limit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(rawLimit, MAX_SESSION_TRASH_LIST_SIZE))
        : 200;
    if (params.autoPurge !== false) {
        purgeExpiredSessionTrashEntries(params.retentionDays);
    }
    const allEntries = readSessionTrashEntries();
    let items = source === 'codex' || source === 'claude' || source === 'gemini' || source === 'codebuddy' || source === 'pi'
        ? allEntries.filter((entry) => entry.source === source)
        : allEntries.slice();
    items.sort((a, b) => {
        const aTime = Date.parse(a.deletedAt || a.updatedAt || '') || 0;
        const bTime = Date.parse(b.deletedAt || b.updatedAt || '') || 0;
        return bTime - aTime;
    });
    const totalCount = items.length;
    if (countOnly) {
        return {
            totalCount,
            items: []
        };
    }
    const visibleEntries = items.slice(0, limit);
    const hydratedVisibleEntries = await hydrateSessionTrashEntries(visibleEntries, { source });
    const updatedEntriesById = new Map();
    for (let index = 0; index < visibleEntries.length; index += 1) {
        const originalEntry = visibleEntries[index];
        const hydratedEntry = hydratedVisibleEntries[index];
        if (!originalEntry || !hydratedEntry) {
            continue;
        }
        if (
            originalEntry.messageCount !== hydratedEntry.messageCount
            || originalEntry.messageCountMtimeMs !== hydratedEntry.messageCountMtimeMs
        ) {
            updatedEntriesById.set(originalEntry.trashId, hydratedEntry);
        }
    }
    if (updatedEntriesById.size > 0) {
        const latestEntries = readSessionTrashEntries({ cleanup: false });
        writeSessionTrashEntries(latestEntries.map((entry) => updatedEntriesById.get(entry.trashId) || entry));
    }
    return {
        totalCount,
        items: hydratedVisibleEntries.map((item) => ({
            ...item,
            trashFilePath: resolveSessionTrashFilePath(item)
        }))
    };
}

async function restoreSessionTrashItem(params = {}) {
    const trashId = typeof params.trashId === 'string' ? params.trashId.trim() : '';
    if (!trashId) {
        return { error: '请先选择要恢复的回收站记录' };
    }

    const entries = readSessionTrashEntries();
    const entry = entries.find((item) => item.trashId === trashId);
    if (!entry) {
        return { error: '回收站记录不存在' };
    }
    const hydratedEntry = await resolveSessionTrashEntryExactMessageCount(entry);
    if (!hydratedEntry) {
        return { error: '回收站记录不存在' };
    }

    const trashFilePath = resolveSessionTrashFilePath(hydratedEntry);
    if (!trashFilePath || !fs.existsSync(trashFilePath)) {
        return { error: '回收站文件不存在' };
    }

    const targetFilePath = resolveSessionRestoreTarget(hydratedEntry);
    if (!targetFilePath) {
        return { error: '原始会话路径非法，无法恢复' };
    }
    if (fs.existsSync(targetFilePath)) {
        return { error: '原始会话路径已存在同名文件，请先手动处理冲突' };
    }

    let claudeIndexPath = '';
    try {
        const latestEntries = readSessionTrashEntries({ cleanup: false });
        const latestEntry = latestEntries.find((item) => item && item.trashId === trashId);
        if (!latestEntry) {
            return { error: '回收站记录不存在' };
        }
        const remainingEntries = latestEntries.filter((item) => item.trashId !== trashId);
        moveFileSync(trashFilePath, targetFilePath);
        if (hydratedEntry.source === 'claude') {
            claudeIndexPath = resolveClaudeSessionRestoreIndexPath(hydratedEntry, targetFilePath);
            upsertClaudeSessionIndexEntry(claudeIndexPath, targetFilePath, hydratedEntry);
        }
        writeSessionTrashEntries(remainingEntries);
    } catch (e) {
        let rollbackSucceeded = false;
        if (fs.existsSync(targetFilePath) && !fs.existsSync(trashFilePath)) {
            try {
                moveFileSync(targetFilePath, trashFilePath);
                rollbackSucceeded = true;
            } catch (_) { }
        }
        if (rollbackSucceeded && entry.source === 'claude' && claudeIndexPath && fs.existsSync(claudeIndexPath)) {
            try {
                removeClaudeSessionIndexEntry(claudeIndexPath, targetFilePath, entry.sessionId);
            } catch (_) { }
        }
        return { error: `恢复会话失败: ${e.message}` };
    }

    invalidateSessionListCache();

    return {
        success: true,
        restored: true,
        trashId,
        source: entry.source,
        sessionId: entry.sessionId,
        filePath: targetFilePath
    };
}

async function purgeSessionTrashItems(params = {}) {
    const entries = readSessionTrashEntries();
    if (entries.length === 0) {
        return { success: true, purged: [], count: 0 };
    }

    const all = params.all === true;
    const trashIds = Array.isArray(params.trashIds)
        ? params.trashIds
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(Boolean)
        : [];
    const singleTrashId = typeof params.trashId === 'string' ? params.trashId.trim() : '';
    const targetIds = all
        ? new Set(entries.map((item) => item.trashId))
        : new Set(singleTrashId ? [singleTrashId, ...trashIds] : trashIds);

    if (targetIds.size === 0) {
        return { error: '请先选择要彻底删除的回收站记录' };
    }

    const purged = [];
    const remaining = [];
    let purgeError = null;
    for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        if (!targetIds.has(entry.trashId)) {
            remaining.push(entry);
            continue;
        }
        const trashFilePath = resolveSessionTrashFilePath(entry);
        if (trashFilePath && fs.existsSync(trashFilePath)) {
            try {
                fs.unlinkSync(trashFilePath);
            } catch (e) {
                if (!purgeError) purgeError = e;
                remaining.push(entry);
                continue;
            }
        }
        purged.push({
            trashId: entry.trashId,
            source: entry.source,
            sessionId: entry.sessionId
        });
    }

    try {
        writeSessionTrashEntries(remaining);
    } catch (e) {
        return { error: `回收站索引更新失败: ${e.message}` };
    }

    if (purgeError) {
        return { error: `彻底删除失败: ${purgeError.message}` };
    }

    return {
        success: true,
        purged,
        count: purged.length
    };
}

async function trashSessionData(params = {}) {
    const source = params.source === 'claude'
        ? 'claude'
        : (params.source === 'codex'
            ? 'codex'
            : (params.source === 'gemini'
                ? 'gemini'
                : (params.source === 'codebuddy'
                    ? 'codebuddy'
                    : (params.source === 'pi' ? 'pi' : ''))));
    if (!source) {
        return { error: 'Invalid source' };
    }

    const filePath = resolveSessionFilePath(source, getSessionFileArg(params), params.sessionId);
    if (!filePath) {
        return { error: 'Session file not found' };
    }

    const summary = (source === 'claude'
        ? parseClaudeSessionSummary(filePath)
        : (source === 'gemini'
            ? parseGeminiSessionSummary(filePath)
            : (source === 'codebuddy'
                ? parseCodeBuddySessionSummary(filePath)
                : (source === 'pi' ? parsePiSessionSummary(filePath) : parseCodexSessionSummary(filePath)))))
        || buildSessionSummaryFallback(source, filePath, params.sessionId);
    const exactMessageCount = await countConversationMessagesInFile(filePath, source);
    if (Number.isFinite(Number(exactMessageCount))) {
        summary.messageCount = Math.max(0, Math.floor(Number(exactMessageCount)));
    }
    const sessionId = summary.sessionId || params.sessionId || path.basename(filePath, source === 'gemini' ? '.json' : '.jsonl');
    const { trashId, trashFileName, trashFilePath } = allocateSessionTrashTarget(source === 'gemini' ? 'json' : 'jsonl');
    const deletedAt = new Date().toISOString();
    const claudeIndexPath = source === 'claude' ? findClaudeSessionIndexPath(filePath) : '';
    let removedClaudeIndexEntry = null;

    try {
        moveFileSync(filePath, trashFilePath);
    } catch (e) {
        return { error: `移入回收站失败: ${e.message}` };
    }

    try {
        if (source === 'claude' && claudeIndexPath) {
            const removal = removeClaudeSessionIndexEntry(claudeIndexPath, filePath, sessionId);
            removedClaudeIndexEntry = removal && removal.entry ? removal.entry : null;
        }
        const entry = buildSessionTrashEntry(summary, {
            trashId,
            trashFileName,
            trashFilePath,
            source,
            sessionId,
            deletedAt,
            originalFilePath: filePath,
            claudeIndexPath,
            claudeIndexEntry: removedClaudeIndexEntry
        });
        const entries = readSessionTrashEntries({ cleanup: false });
        const totalCount = entries.length + 1;
        const nextEntries = [entry, ...entries].slice(0, MAX_SESSION_TRASH_LIST_SIZE);
        writeSessionTrashEntries(nextEntries);
        summary.totalCount = Math.min(totalCount, MAX_SESSION_TRASH_LIST_SIZE);
    } catch (e) {
        let rollbackSucceeded = false;
        if (fs.existsSync(trashFilePath) && !fs.existsSync(filePath)) {
            try {
                moveFileSync(trashFilePath, filePath);
                rollbackSucceeded = true;
            } catch (_) { }
        }
        if (rollbackSucceeded && source === 'claude' && claudeIndexPath && removedClaudeIndexEntry) {
            try {
                upsertClaudeSessionIndexEntry(claudeIndexPath, filePath, {
                    source,
                    sessionId,
                    title: summary.title,
                    messageCount: summary.messageCount,
                    capabilities: summary.capabilities,
                    keywords: summary.keywords,
                    updatedAt: summary.updatedAt,
                    createdAt: summary.createdAt,
                    claudeIndexEntry: removedClaudeIndexEntry,
                    originalFilePath: filePath,
                    trashId,
                    trashFileName
                });
            } catch (_) { }
        }
        if (!rollbackSucceeded && fs.existsSync(trashFilePath)) {
            try { fs.unlinkSync(trashFilePath); } catch (_) { }
        }
        return { error: `移入回收站失败: ${e.message}` };
    }

    invalidateSessionListCache();

    return {
        success: true,
        source,
        sessionId,
        filePath,
        trashed: true,
        trashId,
        deletedAt,
        totalCount: Number.isFinite(Number(summary && summary.totalCount))
            ? Math.max(0, Math.floor(Number(summary.totalCount)))
            : undefined,
        messageCount: Number.isFinite(Number(summary && summary.messageCount))
            ? Math.max(0, Math.floor(Number(summary.messageCount)))
            : 0
    };
}

async function deleteSessionData(params = {}) {
    const source = params.source === 'claude'
        ? 'claude'
        : (params.source === 'codex'
            ? 'codex'
            : (params.source === 'gemini'
                ? 'gemini'
                : (params.source === 'codebuddy'
                    ? 'codebuddy'
                    : (params.source === 'pi' ? 'pi' : ''))));
    if (!source) {
        return { error: 'Invalid source' };
    }

    const filePath = resolveSessionFilePath(source, getSessionFileArg(params), params.sessionId);
    if (!filePath) {
        return { error: 'Session file not found' };
    }

    const sessionId = params.sessionId || path.basename(filePath, source === 'gemini' ? '.json' : '.jsonl');
    let fileDeleted = false;
    try {
        fs.unlinkSync(filePath);
        fileDeleted = true;
    } catch (e) {
        return { error: `删除会话失败: ${e.message}` };
    }

    if (source === 'claude') {
        const indexPath = findClaudeSessionIndexPath(filePath);
        if (indexPath) {
            try {
                removeClaudeSessionIndexEntry(indexPath, filePath, sessionId);
            } catch (e) {
                console.warn('删除会话索引失败:', e && e.message ? e.message : e);
                if (!fileDeleted) {
                    return { error: `删除会话失败: ${e.message || e}` };
                }
            }
        }
    }

    invalidateSessionListCache();

    return {
        success: true,
        source,
        sessionId,
        filePath,
        deleted: true
    };
}

function generateCloneSessionId() {
    if (crypto.randomUUID) {
        return `clone-${crypto.randomUUID()}`;
    }
    const timePart = Date.now().toString(36);
    const randomPart = crypto.randomBytes(8).toString('hex');
    return `clone-${timePart}-${randomPart}`;
}

function allocateCloneSessionTarget(dirPath) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const sessionId = generateCloneSessionId();
        const filePath = path.join(dirPath, `${sessionId}.jsonl`);
        if (!fs.existsSync(filePath)) {
            return { sessionId, filePath };
        }
    }
    const fallbackId = `clone-${Date.now().toString(36)}-${crypto.randomBytes(8).toString('hex')}`;
    return { sessionId: fallbackId, filePath: path.join(dirPath, `${fallbackId}.jsonl`) };
}

function parseTimestampMs(value) {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        if (value > 1e12) return value;
        if (value > 1e9) return value * 1000;
        return value;
    }
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        if (Number.isFinite(parsed)) {
            return parsed;
        }
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            if (numeric > 1e12) return numeric;
            if (numeric > 1e9) return numeric * 1000;
            return numeric;
        }
    }
    return null;
}

async function cloneCodexSession(params = {}) {
    const source = params.source === 'codex' ? 'codex' : '';
    if (!source) {
        return { error: '仅支持 Codex 会话克隆' };
    }

    const filePath = resolveSessionFilePath(source, getSessionFileArg(params), params.sessionId);
    if (!filePath) {
        return { error: 'Session file not found' };
    }

    let content = '';
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (e) {
        return { error: `读取会话失败: ${e.message}` };
    }

    if (!content.trim()) {
        return { error: 'Session file is empty' };
    }

    const lineEnding = detectLineEnding(content);
    const rawLines = content.split(/\r?\n/);
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
        rawLines.pop();
    }

    let originalSessionId = typeof params.sessionId === 'string' ? params.sessionId.trim() : '';
    if (!originalSessionId) {
        originalSessionId = path.basename(filePath, '.jsonl');
    }
    let maxTimestampMs = 0;

    for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
            const record = JSON.parse(trimmed);
            if (record && record.type === 'session_meta' && record.payload) {
                if (record.payload.id) {
                    originalSessionId = record.payload.id;
                }
            }
            if (record && record.timestamp !== undefined) {
                const ts = parseTimestampMs(record.timestamp);
                if (Number.isFinite(ts) && ts > maxTimestampMs) {
                    maxTimestampMs = ts;
                }
            }
        } catch (e) { }
    }

    const sessionsDir = getCodexSessionsDir();
    ensureDir(sessionsDir);
    const target = allocateCloneSessionTarget(sessionsDir);
    const newSessionId = target.sessionId;
    const newFilePath = target.filePath;
    const offsetMs = maxTimestampMs ? (Date.now() - maxTimestampMs) : 0;
    const cloneTime = new Date(Date.now() + 1);
    const cloneIso = cloneTime.toISOString();

    const outputLines = [];
    for (const line of rawLines) {
        const trimmed = line.trim();
        if (!trimmed) {
            outputLines.push(line);
            continue;
        }
        let record;
        try {
            record = JSON.parse(trimmed);
        } catch (e) {
            outputLines.push(line);
            continue;
        }

        if (originalSessionId && typeof record.sessionId === 'string' && record.sessionId === originalSessionId) {
            record.sessionId = newSessionId;
        }
        if (originalSessionId && typeof record.session_id === 'string' && record.session_id === originalSessionId) {
            record.session_id = newSessionId;
        }
        if (offsetMs && record.timestamp !== undefined) {
            const ts = parseTimestampMs(record.timestamp);
            if (Number.isFinite(ts)) {
                record.timestamp = new Date(ts + offsetMs).toISOString();
            }
        }
        if (record && record.type === 'session_meta' && record.payload && typeof record.payload === 'object') {
            record.payload = {
                ...record.payload,
                id: newSessionId,
                timestamp: cloneIso
            };
            record.timestamp = cloneIso;
        }

        outputLines.push(JSON.stringify(record));
    }

    const output = outputLines.join(lineEnding) + lineEnding;
    try {
        fs.writeFileSync(newFilePath, output, 'utf-8');
    } catch (e) {
        return { error: `写入克隆会话失败: ${e.message}` };
    }
    try {
        fs.utimesSync(newFilePath, cloneTime, cloneTime);
    } catch (e) { }

    invalidateSessionListCache();

    return {
        success: true,
        source,
        sourceLabel: 'Codex',
        sessionId: newSessionId,
        filePath: newFilePath
    };
}

function buildSessionMarkdown(payload) {
    const lines = [
        '# AI Session Export',
        '',
        `- Source: ${payload.sourceLabel}`,
        `- Session ID: ${payload.sessionId}`,
        `- Updated At: ${payload.updatedAt || 'unknown'}`,
        `- Working Directory: ${payload.cwd || 'unknown'}`,
        `- Original File: ${payload.filePath}`,
        '',
        '## Messages',
        ''
    ];

    if (!payload.messages || payload.messages.length === 0) {
        lines.push('(no user/assistant messages found)');
        lines.push('');
        return lines.join('\n');
    }

    payload.messages.forEach((message, index) => {
        const role = message.role === 'assistant' ? 'Assistant' : 'User';
        const timeInfo = message.timestamp ? ` · ${message.timestamp}` : '';
        lines.push(`### ${index + 1}. ${role}${timeInfo}`);
        lines.push('');
        lines.push(message.text || '(empty message)');
        lines.push('');
    });

    return lines.join('\n');
}

function buildSessionPlainText(messages) {
    if (!Array.isArray(messages) || messages.length === 0) {
        return '';
    }

    const lines = [];
    messages.forEach((message) => {
        const role = normalizeRole(message && message.role) || 'unknown';
        const text = message && typeof message.text === 'string' ? message.text : '';
        lines.push(role);
        lines.push(text);
        lines.push('');
    });

    while (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }

    return lines.join('\n');
}

function getDerivedSessionMetaPath(filePath) {
    if (!filePath) return '';
    const base = filePath.toLowerCase().endsWith('.jsonl')
        ? filePath.slice(0, -6)
        : filePath;
    return `${base}.meta.json`;
}

function isDerivedSessionFile(filePath) {
    const metaPath = getDerivedSessionMetaPath(filePath);
    if (!metaPath) return false;
    try {
        if (fs.existsSync(metaPath)) {
            return true;
        }
    } catch (_) {
        return false;
    }
    const base = path.basename(filePath || '', path.extname(filePath || ''));
    if (/-\d{8}-\d{6}-[0-9a-f]{6}$/i.test(base)) return true;
    const norm = (filePath || '').replace(/\\/g, '/');
    if (norm.includes('/.codexmate/sessions/derived/')) return true;
    return false;
}

function readDerivedSessionMeta(filePath) {
    const metaPath = getDerivedSessionMetaPath(filePath);
    if (!metaPath) return null;
    return readJsonFile(metaPath, null);
}

function resolveNativeSessionFilePath(source, sessionId, cwd = '') {
    const normalizedSource = normalizeSessionDerivedTarget(source);
    const id = typeof sessionId === 'string' ? sessionId.trim() : '';
    if (!normalizedSource || !id) return '';
    if (normalizedSource === 'codex') {
        return path.join(getCodexSessionsDir(), `${id}.jsonl`);
    }
    const projectDir = resolveClaudeProjectDirForCwd(cwd || '') || path.join(getClaudeProjectsDir(), 'codexmate-derived');
    return path.join(projectDir, `${id}.jsonl`);
}

function buildSessionNativeStatus(source, sessionId, cwd, filePath, derived) {
    const normalizedSource = normalizeSessionDerivedTarget(source);
    const id = typeof sessionId === 'string' ? sessionId.trim() : '';
    const currentPath = typeof filePath === 'string' && filePath.trim()
        ? path.resolve(expandHomePath(filePath.trim()))
        : '';
    const nativePath = resolveNativeSessionFilePath(normalizedSource, id, cwd || '');
    const resolvedNativePath = nativePath ? path.resolve(expandHomePath(nativePath)) : '';
    const inNativePath = !!(currentPath && resolvedNativePath && currentPath === resolvedNativePath);
    const nativeExists = !!(resolvedNativePath && fs.existsSync(resolvedNativePath));
    const currentExists = !!(currentPath && fs.existsSync(currentPath));
    const isDerived = derived === true || isDerivedSessionFile(currentPath);
    const nativeAvailable = inNativePath || nativeExists || (!isDerived && currentExists);
    const effectiveNativePath = !isDerived && currentPath
        ? currentPath
        : (resolvedNativePath || '');
    return {
        derived: isDerived,
        nativeAvailable,
        nativePath: effectiveNativePath,
        derivedPath: isDerived && currentPath && !inNativePath ? currentPath : '',
        nativeImportAvailable: isDerived && !!resolvedNativePath && !inNativePath
    };
}

function attachSessionNativeStatus(session) {
    if (!session || typeof session !== 'object') return session;
    const meta = session.meta && typeof session.meta === 'object' && !Array.isArray(session.meta)
        ? session.meta
        : (session.derived === true ? readDerivedSessionMeta(session.filePath) : null);
    const metaConvertedFromLabel = buildConvertedFromLabel(meta);
    const convertedFromLabel = typeof session.convertedFromLabel === 'string' && session.convertedFromLabel.trim()
        ? session.convertedFromLabel.trim()
        : metaConvertedFromLabel;
    const convertedFrom = typeof session.convertedFrom === 'string' && session.convertedFrom.trim()
        ? session.convertedFrom.trim()
        : (convertedFromLabel ? convertedFromLabel.toLowerCase().replace(' code', '') : '');
    return {
        ...session,
        ...(convertedFrom ? { convertedFrom } : {}),
        ...(convertedFromLabel ? { convertedFromLabel } : {}),
        ...buildSessionNativeStatus(
            session.source,
            session.sessionId,
            session.cwd,
            session.filePath,
            session.derived === true
        )
    };
}

function buildConvertedFromLabel(meta) {
    const rawSourceType = meta && meta.source && typeof meta.source.type === 'string'
        ? meta.source.type
        : (meta && typeof meta.convertedFrom === 'string' ? meta.convertedFrom : '');
    const sourceType = rawSourceType.trim().toLowerCase();
    if (sourceType === 'codex') return 'Codex';
    if (sourceType === 'claude') return 'Claude Code';
    return '';
}

function resolveStateMaxMessages(state) {
    if (!state || typeof state !== 'object') {
        return MAX_EXPORT_MESSAGES;
    }

    return resolveMaxMessagesValue(state.maxMessages, MAX_EXPORT_MESSAGES);
}

function canAppendMessage(state) {
    const maxMessages = resolveStateMaxMessages(state);
    if (maxMessages === Infinity) {
        return true;
    }
    return state.messages.length < maxMessages;
}

function extractCodexMessageFromRecord(record, state, lineIndex = -1) {
    if (record.timestamp) {
        state.updatedAt = toIsoTime(record.timestamp, state.updatedAt);
    }

    if (record.type === 'session_meta' && record.payload) {
        state.sessionId = record.payload.id || state.sessionId;
        state.cwd = record.payload.cwd || state.cwd;
        return;
    }

    if (record.type === 'response_item' && record.payload && record.payload.type === 'message') {
        const role = normalizeRole(record.payload.role);
        if (role === 'user' || role === 'assistant' || role === 'system') {
            const text = extractMessageText(record.payload.content);
            if (text && canAppendMessage(state)) {
                state.messages.push({
                    role,
                    text,
                    timestamp: toIsoTime(record.timestamp, ''),
                    recordLineIndex: Number.isInteger(lineIndex) ? lineIndex : -1
                });
            }
        }
    }
}

function extractClaudeMessageFromRecord(record, state, lineIndex = -1) {
    if (record.timestamp) {
        state.updatedAt = toIsoTime(record.timestamp, state.updatedAt);
    }

    if (!state.sessionId && record.sessionId) {
        state.sessionId = record.sessionId;
    }

    if (!state.cwd && record.cwd) {
        state.cwd = record.cwd;
    }

    const role = normalizeRole(record.type);
    if (role === 'user' || role === 'assistant' || role === 'system') {
        const content = record.message ? record.message.content : '';
        const text = extractMessageText(content);
        if (text && canAppendMessage(state)) {
            state.messages.push({
                role,
                text,
                timestamp: toIsoTime(record.timestamp, ''),
                recordLineIndex: Number.isInteger(lineIndex) ? lineIndex : -1
            });
        }
    }
}

function extractCodeBuddyMessageFromRecord(record, state, lineIndex = -1) {
    if (record && record.timestamp) {
        state.updatedAt = toIsoTime(record.timestamp, state.updatedAt);
    }

    if (record && typeof record.sessionId === 'string' && record.sessionId.trim()) {
        state.sessionId = record.sessionId.trim();
    }

    if (!state.cwd && record && typeof record.cwd === 'string' && record.cwd.trim()) {
        state.cwd = record.cwd.trim();
    }

    if (!record || record.type !== 'message') {
        return;
    }

    const role = normalizeRole(record.role);
    if (role === 'user' || role === 'assistant' || role === 'system') {
        const content = record.message?.content ?? record.content ?? '';
        const text = extractMessageText(content);
        if (text && canAppendMessage(state)) {
            state.messages.push({
                role,
                text,
                timestamp: toIsoTime(record.timestamp, ''),
                recordLineIndex: Number.isInteger(lineIndex) ? lineIndex : -1
            });
        }
    }
}

function extractPiMessageFromRecord(record, state, lineIndex = -1) {
    if (record && record.timestamp) {
        state.updatedAt = toIsoTime(record.timestamp, state.updatedAt);
    }
    if (record && record.type === 'session') {
        state.sessionId = record.id || state.sessionId;
        state.cwd = record.cwd || state.cwd;
        return;
    }
    if (!record || record.type !== 'message' || !record.message || typeof record.message !== 'object') {
        return;
    }
    const role = normalizeRole(record.message.role);
    if (role === 'user' || role === 'assistant' || role === 'system') {
        const text = extractMessageText(record.message.content);
        if (text && canAppendMessage(state)) {
            state.messages.push({
                role,
                text,
                timestamp: toIsoTime(record.timestamp, ''),
                recordLineIndex: Number.isInteger(lineIndex) ? lineIndex : -1
            });
        }
    }
}

function recordHasCodexMessage(record) {
    if (!record || record.type !== 'response_item' || !record.payload) {
        return false;
    }
    if (record.payload.type !== 'message') {
        return false;
    }
    const role = normalizeRole(record.payload.role);
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
        return false;
    }
    const text = extractMessageText(record.payload.content);
    return !!text;
}

function recordHasClaudeMessage(record) {
    if (!record) {
        return false;
    }
    const role = normalizeRole(record.type);
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
        return false;
    }
    const content = record.message ? record.message.content : '';
    const text = extractMessageText(content);
    return !!text;
}

function recordHasCodeBuddyMessage(record) {
    if (!record || record.type !== 'message') {
        return false;
    }
    const role = normalizeRole(record.role);
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
        return false;
    }
    const content = record.message?.content ?? record.content ?? '';
    const text = extractMessageText(content);
    return !!text;
}

function recordHasPiMessage(record) {
    if (!record || record.type !== 'message' || !record.message || typeof record.message !== 'object') {
        return false;
    }
    const role = normalizeRole(record.message.role);
    if (role !== 'user' && role !== 'assistant' && role !== 'system') {
        return false;
    }
    const text = extractMessageText(record.message.content);
    return !!text;
}

function recordHasMessage(record, source) {
    if (source === 'codex') return recordHasCodexMessage(record);
    if (source === 'codebuddy') return recordHasCodeBuddyMessage(record);
    if (source === 'pi') return recordHasPiMessage(record);
    return recordHasClaudeMessage(record);
}

function extractMessagesFromRecords(records, source, options = {}) {
    const maxMessages = resolveMaxMessagesValue(options.maxMessages, MAX_EXPORT_MESSAGES);
    const state = {
        sessionId: '',
        cwd: '',
        updatedAt: '',
        messages: [],
        maxMessages,
        truncated: false
    };

    for (let lineIndex = 0; lineIndex < records.length; lineIndex++) {
        const record = records[lineIndex];
        if (source === 'codex') {
            extractCodexMessageFromRecord(record, state, lineIndex);
        } else if (source === 'codebuddy') {
            extractCodeBuddyMessageFromRecord(record, state, lineIndex);
        } else if (source === 'pi') {
            extractPiMessageFromRecord(record, state, lineIndex);
        } else {
            extractClaudeMessageFromRecord(record, state, lineIndex);
        }

        if (state.maxMessages !== Infinity && state.messages.length >= state.maxMessages) {
            for (let i = lineIndex + 1; i < records.length; i++) {
                if (recordHasMessage(records[i], source)) {
                    state.truncated = true;
                    break;
                }
            }
            break;
        }
    }

    return state;
}

async function extractMessagesFromFile(filePath, source, options = {}) {
    const maxMessages = resolveMaxMessagesValue(options.maxMessages, MAX_EXPORT_MESSAGES);
    const state = {
        sessionId: '',
        cwd: '',
        updatedAt: '',
        messages: [],
        maxMessages,
        truncated: false
    };

    let stream;
    let rl;
    try {
        stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

        let lineIndex = 0;
        let limitReached = false;
        for await (const line of rl) {
            const currentLineIndex = lineIndex;
            lineIndex += 1;

            const trimmed = line.trim();
            if (!trimmed) continue;

            let record;
            try {
                record = JSON.parse(trimmed);
            } catch (e) {
                continue;
            }

            if (limitReached) {
                if (recordHasMessage(record, source)) {
                    state.truncated = true;
                    break;
                }
                continue;
            }

            if (source === 'codex') {
                extractCodexMessageFromRecord(record, state, currentLineIndex);
            } else if (source === 'codebuddy') {
                extractCodeBuddyMessageFromRecord(record, state, currentLineIndex);
            } else if (source === 'pi') {
                extractPiMessageFromRecord(record, state, currentLineIndex);
            } else {
                extractClaudeMessageFromRecord(record, state, currentLineIndex);
            }

            if (state.maxMessages !== Infinity && state.messages.length >= state.maxMessages) {
                limitReached = true;
            }
        }
    } catch (e) {
        const fallbackRecords = readJsonlRecords(filePath);
        return extractMessagesFromRecords(fallbackRecords, source, { maxMessages });
    } finally {
        if (rl) {
            try { rl.close(); } catch (e) { }
        }
        if (stream && !stream.destroyed && stream.destroy) {
            try { stream.destroy(); } catch (e) { }
        }
    }

    return state;
}

async function readSessionDetail(params = {}) {
    const source = params.source === 'claude'
        ? 'claude'
        : (params.source === 'codex'
            ? 'codex'
            : (params.source === 'gemini'
                ? 'gemini'
                : (params.source === 'codebuddy'
                    ? 'codebuddy'
                    : (params.source === 'pi' ? 'pi' : ''))));
    if (!source) {
        return { error: 'Invalid source' };
    }

    const filePath = resolveSessionFilePath(source, getSessionFileArg(params), params.sessionId);
    if (!filePath) {
        return { error: 'Session file not found' };
    }

    const rawMaxMessages = Number(params.maxMessages);
    const rawLimit = Number.isFinite(rawMaxMessages) ? rawMaxMessages : Number(params.messageLimit);
    const messageLimit = Number.isFinite(rawLimit)
        ? Math.max(1, Math.min(rawLimit, MAX_SESSION_DETAIL_MESSAGES))
        : DEFAULT_SESSION_DETAIL_MESSAGES;
    const preview = params.preview === true || params.preview === 'true';

    let extracted;
    if (source === 'gemini') {
        let json;
        try {
            json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (_) {
            json = null;
        }
        if (!json || typeof json !== 'object') {
            return { error: 'Failed to parse session file' };
        }
        const rawMessages = Array.isArray(json.messages) ? json.messages : [];
        const messages = [];
        for (const entry of rawMessages) {
            if (!entry || typeof entry !== 'object') continue;
            const role = normalizeGeminiMessageRole(entry.type);
            if (!role) continue;
            const text = extractMessageText(extractGeminiMessageText(entry.content ?? entry.message ?? entry.text));
            if (!text && role !== 'system') continue;
            messages.push({
                role,
                text,
                timestamp: toIsoTime(entry.timestamp ?? entry.time ?? entry.at, '')
            });
        }
        const filtered = removeLeadingSystemMessage(messages);
        const totalMessages = filtered.length;
        const clipped = totalMessages > messageLimit;
        const sliced = clipped ? filtered.slice(Math.max(0, totalMessages - messageLimit)) : filtered;
        extracted = {
            sessionId: typeof json.sessionId === 'string' && json.sessionId.trim() ? json.sessionId.trim() : path.basename(filePath, '.json'),
            cwd: typeof json.projectRoot === 'string' ? json.projectRoot : (typeof json.cwd === 'string' ? json.cwd : ''),
            updatedAt: toIsoTime(json.lastUpdated ?? json.updatedAt, ''),
            totalMessages,
            clipped,
            messages: sliced
        };
    } else {
        extracted = await extractSessionDetailPreviewFromFile(filePath, source, messageLimit, { preview });
    }
    const sessionId = extracted.sessionId || params.sessionId || path.basename(filePath, source === 'gemini' ? '.json' : '.jsonl');
    const sourceLabel = source === 'codex'
        ? 'Codex'
        : (source === 'claude'
            ? 'Claude Code'
            : (source === 'gemini'
                ? 'Gemini CLI'
                : (source === 'pi' ? 'Pi' : 'CodeBuddy Code')));
    const clippedMessages = Array.isArray(extracted.messages) ? extracted.messages : [];
    const hasExactTotalMessages = Number.isFinite(extracted.totalMessages);
    const startIndex = hasExactTotalMessages
        ? Math.max(0, extracted.totalMessages - clippedMessages.length)
        : 0;
    const indexedMessages = clippedMessages.map((message, messageIndex) => {
        const normalizedMessage = {
            ...message,
            messageIndex: startIndex + messageIndex
        };
        if (preview && typeof normalizedMessage.text === 'string') {
            normalizedMessage.text = truncateText(normalizedMessage.text, SESSION_PREVIEW_MESSAGE_TEXT_MAX_LENGTH);
        }
        return normalizedMessage;
    });

    return {
        source,
        sourceLabel,
        sessionId,
        cwd: extracted.cwd || '',
        updatedAt: extracted.updatedAt || '',
        derived: (() => {
            try {
                const metaPath = filePath.toLowerCase().endsWith('.jsonl')
                    ? `${filePath.slice(0, -6)}.meta.json`
                    : `${filePath}.meta.json`;
                if (fs.existsSync(metaPath)) {
                    return true;
                }
            } catch (_) {
                return false;
            }
            const base = path.basename(filePath || '', path.extname(filePath || ''));
            if (/-\d{8}-\d{6}-[0-9a-f]{6}$/i.test(base)) return true;
            const norm = (filePath || '').replace(/\\/g, '/');
            return norm.includes('/.codexmate/sessions/derived/');
        })(),
        totalMessages: hasExactTotalMessages ? extracted.totalMessages : null,
        clipped: typeof extracted.clipped === 'boolean'
            ? extracted.clipped
            : (hasExactTotalMessages ? extracted.totalMessages > indexedMessages.length : false),
        messageLimit,
        messages: indexedMessages,
        filePath,
        ...(typeof buildSessionNativeStatus === 'function'
            ? buildSessionNativeStatus(source, sessionId, extracted.cwd || '', filePath, (typeof isDerivedSessionFile === 'function' ? isDerivedSessionFile(filePath) : false))
            : { derived: (typeof isDerivedSessionFile === 'function' ? isDerivedSessionFile(filePath) : false) }),
        convertedFrom: (() => {
            if (typeof buildConvertedFromLabel !== 'function' || typeof readDerivedSessionMeta !== 'function') return '';
            const label = buildConvertedFromLabel(readDerivedSessionMeta(filePath));
            return label ? label.toLowerCase().replace(' code', '') : '';
        })(),
        convertedFromLabel: (typeof buildConvertedFromLabel === 'function' && typeof readDerivedSessionMeta === 'function')
            ? buildConvertedFromLabel(readDerivedSessionMeta(filePath))
            : ''
    };
}

async function readSessionPlain(params = {}) {
    const source = params.source === 'claude'
        ? 'claude'
        : (params.source === 'codex'
            ? 'codex'
            : (params.source === 'gemini'
                ? 'gemini'
                : (params.source === 'codebuddy'
                    ? 'codebuddy'
                    : (params.source === 'pi' ? 'pi' : ''))));
    if (!source) {
        return { error: 'Invalid source' };
    }

    const filePath = resolveSessionFilePath(source, getSessionFileArg(params), params.sessionId);
    if (!filePath) {
        return { error: 'Session file not found' };
    }

    const rawMaxMessages = params.maxMessages;
    const maxMessages = rawMaxMessages === Infinity || rawMaxMessages === 'all'
        ? Infinity
        : (
            Number.isFinite(Number(rawMaxMessages))
                ? Math.max(1, Math.floor(Number(rawMaxMessages)))
                : 50
        );

    let extracted;
    if (source === 'gemini') {
        let json;
        try {
            json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (_) {
            json = null;
        }
        if (!json || typeof json !== 'object') {
            return { error: 'Failed to parse session file' };
        }
        const rawMessages = Array.isArray(json.messages) ? json.messages : [];
        const messages = [];
        for (const entry of rawMessages) {
            if (!entry || typeof entry !== 'object') continue;
            const role = normalizeGeminiMessageRole(entry.type);
            if (!role) continue;
            const text = extractMessageText(extractGeminiMessageText(entry.content ?? entry.message ?? entry.text));
            if (!text && role !== 'system') continue;
            messages.push({ role, text });
            if (maxMessages !== Infinity && messages.length >= maxMessages) {
                break;
            }
        }
        extracted = {
            sessionId: typeof json.sessionId === 'string' && json.sessionId.trim() ? json.sessionId.trim() : path.basename(filePath, '.json'),
            cwd: typeof json.projectRoot === 'string' ? json.projectRoot : '',
            messages,
            truncated: maxMessages !== Infinity && rawMessages.length > messages.length
        };
    } else {
        try {
            extracted = await extractMessagesFromFile(filePath, source, { maxMessages });
        } catch (e) {
            extracted = null;
        }

        if (!extracted) {
            return { error: 'Failed to parse session file' };
        }

        if ((!extracted.messages || extracted.messages.length === 0) && !extracted.sessionId && !extracted.cwd) {
            const fallbackRecords = readJsonlRecords(filePath);
            if (fallbackRecords.length === 0) {
                return { error: 'Session file is empty' };
            }
            extracted = extractMessagesFromRecords(fallbackRecords, source, { maxMessages });
        }
    }

    const sessionId = extracted.sessionId || params.sessionId || path.basename(filePath, source === 'gemini' ? '.json' : '.jsonl');
    const sourceLabel = source === 'codex'
        ? 'Codex'
        : (source === 'claude'
            ? 'Claude Code'
            : (source === 'gemini'
                ? 'Gemini CLI'
                : (source === 'pi' ? 'Pi' : 'CodeBuddy Code')));
    const messages = removeLeadingSystemMessage(Array.isArray(extracted.messages) ? extracted.messages : []);
    const text = buildSessionPlainText(messages);

    return {
        source,
        sourceLabel,
        sessionId,
        title: sessionId,
        filePath,
        text,
        clipped: maxMessages !== Infinity && !!(extracted && extracted.truncated)
    };
}

async function exportSessionData(params = {}) {
    const source = params.source === 'claude'
        ? 'claude'
        : (params.source === 'codex'
            ? 'codex'
            : (params.source === 'gemini'
                ? 'gemini'
                : (params.source === 'codebuddy'
                    ? 'codebuddy'
                    : (params.source === 'pi' ? 'pi' : ''))));
    if (!source) {
        return { error: 'Invalid source' };
    }

    const maxMessages = resolveMaxMessagesValue(params.maxMessages, MAX_EXPORT_MESSAGES);
    const filePath = resolveSessionFilePath(source, getSessionFileArg(params), params.sessionId);
    if (!filePath) {
        return { error: 'Session file not found' };
    }

    let extracted;
    if (source === 'gemini') {
        let json;
        try {
            json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (_) {
            json = null;
        }
        if (!json || typeof json !== 'object') {
            return { error: 'Failed to parse session file' };
        }
        const rawMessages = Array.isArray(json.messages) ? json.messages : [];
        const messages = [];
        for (const entry of rawMessages) {
            if (!entry || typeof entry !== 'object') continue;
            const role = normalizeGeminiMessageRole(entry.type);
            if (!role) continue;
            const text = extractMessageText(extractGeminiMessageText(entry.content ?? entry.message ?? entry.text));
            if (!text && role !== 'system') continue;
            messages.push({ role, text, timestamp: toIsoTime(entry.timestamp ?? entry.time ?? entry.at, '') });
        }
        extracted = {
            sessionId: typeof json.sessionId === 'string' && json.sessionId.trim() ? json.sessionId.trim() : path.basename(filePath, '.json'),
            cwd: typeof json.projectRoot === 'string' ? json.projectRoot : '',
            updatedAt: toIsoTime(json.lastUpdated ?? json.updatedAt, ''),
            messages: maxMessages === Infinity ? messages : messages.slice(-maxMessages),
            truncated: maxMessages !== Infinity && messages.length > maxMessages
        };
    } else {
        try {
            extracted = await extractMessagesFromFile(filePath, source, { maxMessages });
        } catch (e) {
            extracted = null;
        }

        if (!extracted) {
            return { error: 'Failed to parse session file' };
        }

        if ((!extracted.messages || extracted.messages.length === 0) && !extracted.sessionId && !extracted.cwd) {
            const fallbackRecords = readJsonlRecords(filePath);
            if (fallbackRecords.length === 0) {
                return { error: 'Session file is empty' };
            }
            extracted = extractMessagesFromRecords(fallbackRecords, source, { maxMessages });
        }
    }

    extracted.messages = removeLeadingSystemMessage(Array.isArray(extracted.messages) ? extracted.messages : []);

    if (!extracted.messages || extracted.messages.length === 0) {
        const stat = fs.existsSync(filePath) ? fs.statSync(filePath) : null;
        if (!stat || stat.size === 0) {
            return { error: 'Session file is empty' };
        }
    }

    const sessionId = extracted.sessionId || params.sessionId || path.basename(filePath, source === 'gemini' ? '.json' : '.jsonl');
    const safeSessionId = String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_');
    const sourceLabel = source === 'codex'
        ? 'Codex'
        : (source === 'claude'
            ? 'Claude Code'
            : (source === 'gemini'
                ? 'Gemini CLI'
                : (source === 'pi' ? 'Pi' : 'CodeBuddy Code')));
    const truncated = !!extracted.truncated;
    const maxMessagesLabel = maxMessages === Infinity ? 'all' : maxMessages;
    const markdown = buildSessionMarkdown({
        sourceLabel,
        sessionId,
        updatedAt: extracted.updatedAt,
        cwd: extracted.cwd,
        filePath,
        messages: extracted.messages
    });

    return {
        source,
        sourceLabel,
        sessionId,
        fileName: `${source}-session-${safeSessionId}.md`,
        content: markdown,
        truncated,
        maxMessages: maxMessagesLabel
    };
}

async function convertSessionToDerived(params = {}) {
    const source = normalizeSessionDerivedSource(params.source);
    const target = normalizeSessionDerivedTarget(params.target || params.to);
    if (!source || !target) {
        return { error: 'Invalid source/target' };
    }
    if (source === target) {
        return { error: 'source and target must be different' };
    }

    const maxMessages = resolveMaxMessagesValue(params.maxMessages, MAX_EXPORT_MESSAGES);
    const filePath = resolveSessionFilePath(source, getSessionFileArg(params), params.sessionId);
    if (!filePath) {
        return { error: 'Session file not found' };
    }

    let extracted;
    try {
        extracted = await extractMessagesFromFile(filePath, source, { maxMessages });
    } catch (_) {
        extracted = null;
    }
    if (!extracted) {
        return { error: 'Failed to parse session file' };
    }

    const baseSessionId = extracted.sessionId || params.sessionId || path.basename(filePath, '.jsonl');
    const sourceKey = buildSessionDerivedSourceKey(source, baseSessionId, filePath);
    const outputDirModeRaw = typeof params.outputDir === 'string'
        ? params.outputDir
        : (typeof params.output_dir === 'string' ? params.output_dir : 'native');
    const outputDirMode = outputDirModeRaw.trim().toLowerCase() === 'derived' ? 'derived' : 'native';
    const cwd = typeof extracted.cwd === 'string' ? extracted.cwd : '';
    const outputDir = outputDirMode === 'derived'
        ? buildDerivedSessionOutputDir(target, source, sourceKey)
        : (target === 'codex'
            ? getCodexSessionsDir()
            : (resolveClaudeProjectDirForCwd(cwd || '') || path.join(getClaudeProjectsDir(), 'codexmate-derived')));
    ensureDir(outputDir);

    let derivedSessionId = '';
    let outputPath = '';
    let metaPath = '';
    if (outputDirMode === 'native') {
        derivedSessionId = baseSessionId;
        outputPath = path.join(outputDir, `${derivedSessionId}.jsonl`);
        metaPath = path.join(outputDir, `${derivedSessionId}.meta.json`);
        if (fs.existsSync(outputPath) || fs.existsSync(metaPath)) {
            return { error: 'Converted sessionId conflicts with an existing native session; please retry or choose derived output.' };
        }
    } else {
        const useUuid = target === 'codex' || target === 'claude';
        for (let attempt = 0; attempt < 8; attempt += 1) {
            derivedSessionId = buildDerivedSessionId(baseSessionId, useUuid);
            outputPath = path.join(outputDir, `${derivedSessionId}.jsonl`);
            metaPath = path.join(outputDir, `${derivedSessionId}.meta.json`);
            if (!fs.existsSync(outputPath) && !fs.existsSync(metaPath)) {
                break;
            }
            derivedSessionId = '';
        }
        if (!derivedSessionId) {
            return { error: 'Converted sessionId conflicts with an existing native session; please retry or choose derived output.' };
        }
    }

    const resolvedCwd = cwd ? path.resolve(expandHomePath(cwd)) : '';
    const messages = removeLeadingSystemMessage(Array.isArray(extracted.messages) ? extracted.messages : []);
    const now = Date.now();
    const baseTime = new Date(now).toISOString();
    const lines = [];

    if (target === 'codex') {
        lines.push(JSON.stringify({ type: 'session_meta', timestamp: baseTime, payload: { id: derivedSessionId, cwd } }));
        for (let i = 0; i < messages.length; i += 1) {
            const message = messages[i];
            if (!message) continue;
            const role = normalizeRole(message.role);
            if (role !== 'user' && role !== 'assistant' && role !== 'system') continue;
            const text = typeof message.text === 'string' ? message.text : '';
            if (!text) continue;
            lines.push(JSON.stringify({
                type: 'response_item',
                timestamp: toIsoTime(message.timestamp, '') || new Date(now + i).toISOString(),
                payload: { type: 'message', role, content: text }
            }));
        }
    } else {
        const claudeIndexPath = target === 'claude' ? path.join(outputDir, 'sessions-index.json') : '';
        for (let i = 0; i < messages.length; i += 1) {
            const message = messages[i];
            if (!message) continue;
            const role = normalizeRole(message.role);
            if (role !== 'user' && role !== 'assistant' && role !== 'system') continue;
            const text = typeof message.text === 'string' ? message.text : '';
            if (!text) continue;
            lines.push(JSON.stringify({
                type: role,
                timestamp: toIsoTime(message.timestamp, '') || new Date(now + i).toISOString(),
                sessionId: derivedSessionId,
                cwd,
                message: { content: text }
            }));
        }
        if (claudeIndexPath) {
            ensureClaudeSessionsIndex(claudeIndexPath, resolvedCwd);
        }
    }

    fs.writeFileSync(outputPath, `${lines.join('\n')}\n`, 'utf-8');
    writeJsonAtomic(metaPath, {
        version: 1,
        createdAt: baseTime,
        source: {
            type: source,
            sessionId: baseSessionId,
            filePath
        },
        target: {
            type: target,
            sessionId: derivedSessionId,
            filePath: outputPath
        },
        options: {
            maxMessages: maxMessages === Infinity ? 'all' : maxMessages,
            outputDir: outputDirMode
        }
    });

    invalidateSessionListCache();

    const summary = target === 'codex'
        ? parseCodexSessionSummary(outputPath, { summaryReadBytes: SESSION_BROWSE_SUMMARY_READ_BYTES, titleReadBytes: SESSION_BROWSE_SUMMARY_READ_BYTES })
        : parseClaudeSessionSummary(outputPath, { summaryReadBytes: SESSION_BROWSE_SUMMARY_READ_BYTES, titleReadBytes: SESSION_BROWSE_SUMMARY_READ_BYTES });
    if (target === 'claude' && summary) {
        const indexPath = path.join(outputDir, 'sessions-index.json');
        ensureClaudeSessionsIndex(indexPath, resolvedCwd);
        upsertClaudeSessionIndexEntry(indexPath, outputPath, {
            source: 'claude',
            trashId: summary.sessionId,
            trashFileName: `${summary.sessionId}.jsonl`,
            sessionId: summary.sessionId,
            title: summary.title,
            cwd: summary.cwd,
            createdAt: summary.createdAt,
            updatedAt: summary.updatedAt,
            messageCount: summary.messageCount,
            provider: summary.provider,
            keywords: summary.keywords,
            capabilities: summary.capabilities,
            claudeIndexEntry: resolvedCwd ? { projectPath: resolvedCwd } : null
        });
    }
    const maxMessagesLabel = maxMessages === Infinity ? 'all' : maxMessages;

    return {
        derived: true,
        source,
        target,
        truncated: !!extracted.truncated,
        maxMessages: maxMessagesLabel,
        session: attachSessionNativeStatus(summary ? {
            ...summary,
            derived: true,
            convertedFrom: source,
            convertedFromLabel: source === 'codex' ? 'Codex' : 'Claude Code'
        } : {
            source: target,
            sourceLabel: target === 'codex' ? 'Codex' : 'Claude Code',
            sessionId: derivedSessionId,
            title: derivedSessionId,
            cwd,
            createdAt: baseTime,
            updatedAt: baseTime,
            messageCount: messages.length,
            totalTokens: 0,
            contextWindow: 0,
            inputTokens: 0,
            cachedInputTokens: 0,
            outputTokens: 0,
            reasoningOutputTokens: 0,
            __messageCountExact: true,
            filePath: outputPath,
            derived: true,
            convertedFrom: source,
            convertedFromLabel: source === 'codex' ? 'Codex' : 'Claude Code',
            keywords: [],
            capabilities: {}
        })
    };
}


async function importDerivedSessionToNative(params = {}) {
    const source = normalizeSessionDerivedTarget(params.source);
    if (!source) {
        return { error: 'Invalid source', errorCode: 'INVALID_SOURCE' };
    }
    const filePath = resolveSessionFilePath(source, getSessionFileArg(params), params.sessionId);
    if (!filePath) {
        return { error: 'Session file not found', errorCode: 'SESSION_FILE_NOT_FOUND' };
    }

    const summary = (source === 'claude' ? parseClaudeSessionSummary(filePath) : parseCodexSessionSummary(filePath))
        || buildSessionSummaryFallback(source, filePath, params.sessionId);
    const sessionId = summary.sessionId || params.sessionId || path.basename(filePath, '.jsonl');
    const nativePath = resolveNativeSessionFilePath(source, sessionId, summary.cwd || '');
    if (!nativePath) {
        return { error: 'Native session path unavailable', errorCode: 'NATIVE_SESSION_PATH_UNAVAILABLE' };
    }

    const resolvedSourcePath = path.resolve(expandHomePath(filePath));
    const resolvedNativePath = path.resolve(expandHomePath(nativePath));
    const overwrite = params.overwrite === true || params.confirmOverwrite === true || params.force === true;
    const hadNativeBefore = fs.existsSync(resolvedNativePath);
    if (resolvedSourcePath === resolvedNativePath) {
        return {
            success: true,
            imported: false,
            alreadyNative: true,
            source,
            sessionId,
            filePath: resolvedNativePath,
            nativePath: resolvedNativePath,
            nativeAvailable: true,
            session: attachSessionNativeStatus({ ...summary, filePath: resolvedNativePath, derived: true })
        };
    }
    if (fs.existsSync(resolvedNativePath) && !overwrite) {
        return {
            error: 'Native session already exists',
            errorCode: 'NATIVE_SESSION_EXISTS',
            conflict: true,
            source,
            sessionId,
            filePath: resolvedSourcePath,
            nativePath: resolvedNativePath,
            nativeAvailable: true,
            session: attachSessionNativeStatus({ ...summary, filePath: resolvedSourcePath, derived: true })
        };
    }

    const targetMetaPath = getDerivedSessionMetaPath(resolvedNativePath);
    const indexPath = source === 'claude' ? path.join(path.dirname(resolvedNativePath), 'sessions-index.json') : '';
    const tmpNativePath = `${resolvedNativePath}.tmp-${process.pid}-${Date.now()}`;
    let previousNative = null;
    let previousMeta = null;
    let previousIndex = null;
    try {
        previousNative = hadNativeBefore ? fs.readFileSync(resolvedNativePath) : null;
        previousMeta = targetMetaPath && fs.existsSync(targetMetaPath)
            ? fs.readFileSync(targetMetaPath)
            : null;
        previousIndex = indexPath && fs.existsSync(indexPath)
            ? fs.readFileSync(indexPath)
            : null;
        ensureDir(path.dirname(resolvedNativePath));
        fs.copyFileSync(resolvedSourcePath, tmpNativePath);
        const sourceMetaPath = getDerivedSessionMetaPath(resolvedSourcePath);
        let meta = readDerivedSessionMeta(resolvedSourcePath) || {};
        if (!meta || typeof meta !== 'object' || Array.isArray(meta)) meta = {};
        meta.version = meta.version || 1;
        meta.importedAt = new Date().toISOString();
        meta.target = {
            ...(meta.target && typeof meta.target === 'object' ? meta.target : {}),
            type: source,
            sessionId,
            filePath: resolvedNativePath
        };
        if (sourceMetaPath && fs.existsSync(sourceMetaPath)) {
            writeJsonAtomic(targetMetaPath, meta);
        } else {
            writeJsonAtomic(targetMetaPath, meta);
        }
        if (source === 'claude') {
            ensureClaudeSessionsIndex(indexPath, summary.cwd || '');
            upsertClaudeSessionIndexEntry(indexPath, resolvedNativePath, {
                ...summary,
                source: 'claude',
                trashId: sessionId,
                trashFileName: `${sessionId}.jsonl`,
                sessionId,
                claudeIndexEntry: { projectPath: summary.cwd || '' }
            });
        }
        if (hadNativeBefore) {
            fs.unlinkSync(resolvedNativePath);
        }
        fs.renameSync(tmpNativePath, resolvedNativePath);
    } catch (e) {
        try {
            if (fs.existsSync(tmpNativePath)) fs.unlinkSync(tmpNativePath);
        } catch (_) { }
        try {
            if (previousNative) {
                ensureDir(path.dirname(resolvedNativePath));
                fs.writeFileSync(resolvedNativePath, previousNative);
            } else if (!hadNativeBefore && fs.existsSync(resolvedNativePath)) {
                fs.unlinkSync(resolvedNativePath);
            }
        } catch (_) { }
        try {
            if (previousMeta) {
                ensureDir(path.dirname(targetMetaPath));
                fs.writeFileSync(targetMetaPath, previousMeta);
            } else if (targetMetaPath && fs.existsSync(targetMetaPath)) {
                fs.unlinkSync(targetMetaPath);
            }
        } catch (_) { }
        try {
            if (indexPath) {
                if (previousIndex) {
                    ensureDir(path.dirname(indexPath));
                    fs.writeFileSync(indexPath, previousIndex);
                } else if (fs.existsSync(indexPath)) {
                    fs.unlinkSync(indexPath);
                }
            }
        } catch (_) { }
        return { error: `Import to native failed: ${e.message}`, errorCode: 'IMPORT_DERIVED_SESSION_FAILED', reason: e.message };
    }

    invalidateSessionListCache();
    const importedSummary = (source === 'claude' ? parseClaudeSessionSummary(resolvedNativePath) : parseCodexSessionSummary(resolvedNativePath))
        || { ...summary, filePath: resolvedNativePath };
    return {
        success: true,
        imported: true,
        source,
        sessionId,
        filePath: resolvedNativePath,
        nativePath: resolvedNativePath,
        nativeAvailable: true,
        previousFilePath: resolvedSourcePath,
        overwritten: hadNativeBefore && overwrite,
        session: attachSessionNativeStatus({ ...importedSummary, filePath: resolvedNativePath, derived: true })
    };
}

function buildExportPayload(includeKeys) {
    const { config } = readConfigOrVirtualDefault();
    const providers = config.model_providers || {};
    const providerData = {};
    for (const [name, provider] of Object.entries(providers)) {
        if (isBuiltinManagedProvider(name)) {
            continue;
        }
        providerData[name] = {
            baseUrl: provider.base_url || '',
            apiKey: includeKeys ? (provider.preferred_auth_method || '') : null
        };
    }

    return {
        version: 1,
        currentProvider: config.model_provider || '',
        currentModel: config.model || '',
        providers: providerData,
        models: readModels(),
        currentModels: readCurrentModels()
    };
}

function buildClaudeSharePayload(config = {}) {
    const apiKey = typeof config.apiKey === 'string' ? config.apiKey : '';
    const baseUrl = typeof config.baseUrl === 'string' ? config.baseUrl : '';
    const model = typeof config.model === 'string' ? config.model : '';
    const targetApi = normalizeClaudeTargetApi(config.targetApi);

    if (!baseUrl) return { error: 'Claude Base URL 未设置' };
    if (!apiKey && targetApi !== 'ollama') return { error: 'Claude API 密钥未设置' };

    return {
        payload: {
            baseUrl: baseUrl.trim(),
            apiKey: apiKey.trim(),
            model: (model && model.trim()) || DEFAULT_CLAUDE_MODEL,
            targetApi
        }
    };
}

function buildProviderSharePayload(params = {}) {
    const name = typeof params.name === 'string' ? params.name.trim() : '';
    if (!name) {
        return { error: '缺少提供商名称' };
    }

    const { config } = readConfigOrVirtualDefault();
    const providers = config.model_providers || {};
    const provider = providers[name];
    if (!provider || typeof provider !== 'object') {
        return { error: `提供商不存在: ${name}` };
    }

    const bridgeType = typeof provider.codexmate_bridge === 'string' && provider.codexmate_bridge.trim()
        ? provider.codexmate_bridge.trim()
        : '';
    const isOpenaiBridgeProvider = bridgeType === 'openai'
        || (typeof provider.base_url === 'string' && provider.base_url.includes('/bridge/openai/'));

    let baseUrl = typeof provider.base_url === 'string' ? provider.base_url.trim() : '';
    let apiKey = typeof provider.preferred_auth_method === 'string'
        ? provider.preferred_auth_method.trim()
        : '';

    // 对 transform provider：分享出去的应该是“上游 URL/API Key”，而不是本机 bridge URL。
    // 保持向下兼容：如果无法解析上游配置，则回退为当前 provider.base_url。
    if (isOpenaiBridgeProvider) {
        const upstream = resolveOpenaiBridgeUpstream(OPENAI_BRIDGE_SETTINGS_FILE, name);
        if (!upstream.error) {
            baseUrl = upstream.baseUrl || baseUrl;
            apiKey = upstream.apiKey || apiKey;
        }
    }
    const currentModels = readCurrentModels();
    const savedModel = currentModels && typeof currentModels[name] === 'string'
        ? currentModels[name].trim()
        : '';
    const activeProvider = typeof config.model_provider === 'string' ? config.model_provider.trim() : '';
    const activeModel = typeof config.model === 'string' ? config.model.trim() : '';
    const model = savedModel || (activeProvider === name ? activeModel : '');

    if (!baseUrl) {
        return { error: `提供商 ${name} 缺少 base_url` };
    }

    return {
        payload: {
            name,
            baseUrl,
            apiKey,
            model,
            bridge: bridgeType || (isOpenaiBridgeProvider ? 'openai' : '')
        }
    };
}

function normalizeImportPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return { error: 'Invalid import payload' };
    }

    const rawProviders = payload.providers || payload.model_providers || [];
    const providers = {};
    if (Array.isArray(rawProviders)) {
        for (const item of rawProviders) {
            if (!item || typeof item !== 'object') continue;
            const name = item.name || item.provider || '';
            const baseUrl = item.baseUrl || item.base_url || item.url || '';
            const apiKey = item.apiKey ?? item.key ?? item.preferred_auth_method ?? null;
            if (name && baseUrl && /^[a-zA-Z0-9_\-.\s]+$/.test(name)) {
                providers[name] = { baseUrl, apiKey };
            }
        }
    } else if (typeof rawProviders === 'object') {
        for (const [name, item] of Object.entries(rawProviders)) {
            if (!item || typeof item !== 'object') continue;
            const baseUrl = item.baseUrl || item.base_url || item.url || '';
            const apiKey = item.apiKey ?? item.key ?? item.preferred_auth_method ?? null;
            if (name && baseUrl && /^[a-zA-Z0-9_\-.\s]+$/.test(name)) {
                providers[name] = { baseUrl, apiKey };
            }
        }
    }

    if (Object.keys(providers).length === 0 && (!payload.models || payload.models.length === 0)) {
        return { error: 'Invalid import payload' };
    }

    return {
        providers,
        models: Array.isArray(payload.models) ? payload.models : [],
        currentProvider: typeof payload.currentProvider === 'string' ? payload.currentProvider : '',
        currentModel: typeof payload.currentModel === 'string' ? payload.currentModel : '',
        currentModels: payload.currentModels && typeof payload.currentModels === 'object' ? payload.currentModels : {}
    };
}

function importConfigData(payload, options = {}) {
    const normalized = normalizeImportPayload(payload);
    if (normalized.error) {
        return { error: normalized.error };
    }

    const overwriteProviders = !!options.overwriteProviders;
    const applyCurrent = !!options.applyCurrent;
    const applyCurrentModels = !!options.applyCurrentModels;

    const { config: existingConfig } = readConfigOrVirtualDefault();
    const existingProviders = existingConfig.model_providers || {};
    let addedProviders = 0;
    let updatedProviders = 0;

    for (const [name, provider] of Object.entries(normalized.providers)) {
        if (isBuiltinManagedProvider(name)) {
            continue;
        }
        if (existingProviders[name]) {
            if (overwriteProviders) {
                const apiKey = typeof provider.apiKey === 'string' && provider.apiKey
                    ? provider.apiKey
                    : undefined;
                cmdUpdate(name, provider.baseUrl, apiKey, true);
                updatedProviders += 1;
            }
        } else {
            const apiKey = typeof provider.apiKey === 'string' ? provider.apiKey : '';
            cmdAdd(name, provider.baseUrl, apiKey, true);
            addedProviders += 1;
        }
    }

    let addedModels = 0;
    if (normalized.models.length > 0) {
        const existingModels = new Set(readModels());
        for (const model of normalized.models) {
            if (typeof model !== 'string' || !model.trim()) continue;
            if (!existingModels.has(model)) {
                cmdAddModel(model, true);
                existingModels.add(model);
                addedModels += 1;
            }
        }
    }

    if (applyCurrentModels && normalized.currentModels) {
        const currentModels = readCurrentModels();
        for (const [name, model] of Object.entries(normalized.currentModels)) {
            if (isBuiltinManagedProvider(name)) continue;
            if (typeof model !== 'string' || !model) continue;
            currentModels[name] = model;
        }
        writeCurrentModels(currentModels);
    }

    const { config: finalConfig } = readConfigOrVirtualDefault();
    const finalProviders = finalConfig.model_providers || {};
    if (applyCurrent && normalized.currentProvider) {
        if (finalProviders[normalized.currentProvider]) {
            cmdSwitch(normalized.currentProvider, true);
        }
        if (normalized.currentModel) {
            const models = readModels();
            if (!models.includes(normalized.currentModel)) {
                cmdAddModel(normalized.currentModel, true);
            }
            cmdUseModel(normalized.currentModel, true);
        }
    }

    return {
        success: true,
        summary: {
            addedProviders,
            updatedProviders,
            addedModels
        }
    };
}

function resolveSpeedTestTarget(params) {
    if (!params) return { error: 'Missing params' };

    if (typeof params.kind === 'string' && params.kind.trim() === 'claude') {
        const baseUrl = typeof params.url === 'string' ? params.url.trim() : '';
        const apiKey = typeof params.apiKey === 'string' ? params.apiKey.trim() : '';
        const model = typeof params.model === 'string' ? params.model.trim() : '';
        if (!baseUrl) {
            return { error: 'Missing url' };
        }
        if (!apiKey) {
            return { error: 'Missing apiKey' };
        }
        if (!model) {
            return { error: 'Missing model' };
        }
        const normalizedBase = baseUrl.replace(/\/+$/, '');
        let parsed = null;
        try {
            parsed = new URL(normalizedBase);
        } catch (_) {
            return { error: 'Invalid URL' };
        }
        const pathname = typeof parsed.pathname === 'string' ? parsed.pathname : '';
        const trimmedPath = pathname.replace(/\/+$/, '');
        const isRootPath = !trimmedPath || trimmedPath === '/';
        const endsWithV1 = trimmedPath.endsWith('/v1');
        const makeCandidate = (url) => ({
            method: 'POST',
            url,
            body: {
                model,
                max_tokens: 16,
                messages: [{ role: 'user', content: 'ping' }]
            }
        });
        const candidates = [];
        if (endsWithV1) {
            candidates.push(makeCandidate(`${normalizedBase}/messages`));
        } else if (isRootPath) {
            candidates.push(makeCandidate(`${normalizedBase}/v1/messages`));
            candidates.push(makeCandidate(`${normalizedBase}/messages`));
        } else {
            candidates.push(makeCandidate(`${normalizedBase}/messages`));
            candidates.push(makeCandidate(`${normalizedBase}/v1/messages`));
        }
        return {
            kind: 'claude',
            candidates,
            apiKey,
            apiKeyHeader: 'x-api-key',
            headers: {
                'anthropic-version': '2023-06-01'
            }
        };
    }

    if (params.name) {
        const { config } = readConfigOrVirtualDefault();
        const providers = config.model_providers || {};
        const provider = providers[params.name];
        if (!provider) {
            return { error: 'Provider not found' };
        }
        if (!provider.base_url) {
            return { error: 'Provider missing URL' };
        }
        const providerName = String(params.name).trim();
        const currentModels = readCurrentModels();
        const selectedModel = typeof currentModels[providerName] === 'string' && currentModels[providerName].trim()
            ? currentModels[providerName].trim()
            : (typeof config.model === 'string' ? config.model.trim() : '');

        const apiKey = typeof provider.preferred_auth_method === 'string'
            ? provider.preferred_auth_method.trim()
            : '';

        const candidates = [];
        for (const spec of buildModelProbeSpecs(provider, selectedModel, provider.base_url)) {
            if (!spec || !spec.url) continue;
            candidates.push({ method: 'POST', url: spec.url, body: spec.body });
        }
        for (const url of buildApiProbeUrlCandidates(provider.base_url, 'models')) {
            candidates.push({ method: 'GET', url });
        }
        if (candidates.length === 0) {
            candidates.push({ method: 'GET', url: provider.base_url });
        }

        return {
            kind: 'provider',
            candidates,
            apiKey
        };
    }

    if (params.url) {
        return {
            method: 'GET',
            url: params.url,
            apiKey: typeof params.apiKey === 'string' ? params.apiKey : ''
        };
    }

    return { error: 'Missing name or url' };
}

function runSpeedTest(targetUrl, apiKey, options = {}) {
    const timeoutMs = Number.isFinite(options.timeoutMs)
        ? Math.max(1000, Number(options.timeoutMs))
        : SPEED_TEST_TIMEOUT_MS;
    const method = typeof options.method === 'string' ? options.method.toUpperCase() : 'GET';
    if (method === 'POST') {
        return probeJsonPost(targetUrl, options.body || {}, {
            apiKey,
            apiKeyHeader: typeof options.apiKeyHeader === 'string' ? options.apiKeyHeader : '',
            headers: options.headers && typeof options.headers === 'object' ? options.headers : null,
            timeoutMs,
            maxBytes: 256 * 1024
        }).then((result) => ({
            ok: !!result.ok,
            status: Number.isFinite(result.status) ? result.status : 0,
            durationMs: Number.isFinite(result.durationMs) ? result.durationMs : 0,
            error: result.ok ? '' : (result.error || '')
        }));
    }
    return probeUrl(targetUrl, {
        apiKey,
        apiKeyHeader: typeof options.apiKeyHeader === 'string' ? options.apiKeyHeader : '',
        headers: options.headers && typeof options.headers === 'object' ? options.headers : null,
        timeoutMs,
        maxBytes: 256 * 1024
    }).then((result) => ({
        ok: !!result.ok,
        status: Number.isFinite(result.status) ? result.status : 0,
        durationMs: Number.isFinite(result.durationMs) ? result.durationMs : 0,
        error: result.ok ? '' : (result.error || '')
    }));
}

// ============================================================================
// 命令
// ============================================================================

// 交互式配置向导
async function cmdSetup() {
    console.log('\n交互式配置向导');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const lineQueue = [];
    let lineResolver = null;
    let rlClosed = false;
    rl.on('line', (line) => {
        if (lineResolver) {
            const resolve = lineResolver;
            lineResolver = null;
            resolve(line);
        } else {
            lineQueue.push(line);
        }
    });
    rl.on('close', () => {
        rlClosed = true;
        if (lineResolver) {
            const resolve = lineResolver;
            lineResolver = null;
            resolve('');
        }
    });
    const ask = async (question) => {
        if (question) {
            process.stdout.write(question);
        }
        if (lineQueue.length > 0) {
            return lineQueue.shift();
        }
        if (rlClosed) {
            return '';
        }
        return await new Promise(resolve => {
            lineResolver = resolve;
        });
    };

    let providerName = '';
    let baseUrl = '';
    let apiKey = '';
    let modelName = '';
    let isCustomProvider = false;

    try {
        const { config } = readConfigOrVirtualDefault();
        const providers = config.model_providers || {};
        const providerNames = Object.keys(providers);
        const currentProvider = typeof config.model_provider === 'string' ? config.model_provider.trim() : '';
        const defaultProvider = currentProvider || providerNames[0] || '';
        let availableModels = [];
        let defaultModel = config.model || '';
        let modelFetchUnlimited = false;

        while (true) {
            console.log('\n选择提供商:');
            if (providerNames.length > 0) {
                providerNames.forEach((name, index) => {
                    console.log(`  ${index + 1}. ${name}`);
                });
                console.log(`  ${providerNames.length + 1}. 自定义`);
            } else {
                console.log('  (暂无提供商，需自定义)');
            }

            const suffix = defaultProvider ? ` (默认 ${defaultProvider})` : '';
            const input = (await ask(`请输入序号或名称${suffix}: `)).trim();

            if (!input) {
                if (defaultProvider) {
                    providerName = defaultProvider;
                    isCustomProvider = false;
                    break;
                }
                isCustomProvider = true;
                break;
            }

            if (/^\d+$/.test(input)) {
                const index = parseInt(input, 10);
                if (index >= 1 && index <= providerNames.length) {
                    providerName = providerNames[index - 1];
                    isCustomProvider = false;
                    break;
                }
                if (index === providerNames.length + 1) {
                    isCustomProvider = true;
                    break;
                }
                console.log('提示: 序号无效，请重试。');
                continue;
            }

            if (providers[input]) {
                providerName = input;
                isCustomProvider = false;
                break;
            }

            if (isValidProviderName(input)) {
                providerName = input;
                isCustomProvider = true;
                break;
            }

            console.log('提示: 名称仅支持字母/数字/._-');
        }

        if (isCustomProvider && !providerName) {
            while (true) {
                const nameInput = (await ask('请输入自定义提供商名称(字母/数字/._-): ')).trim();
                if (!nameInput) {
                    console.log('提示: 名称不能为空。');
                    continue;
                }
                if (!isValidProviderName(nameInput)) {
                    console.log('提示: 名称仅支持字母/数字/._-');
                    continue;
                }
                providerName = nameInput;
                break;
            }
        }

        if (isCustomProvider) {
            while (true) {
                const urlInput = (await ask('Base URL: ')).trim();
                if (!urlInput) {
                    console.log('提示: Base URL 不能为空。');
                    continue;
                }
                baseUrl = urlInput;
                break;
            }
            apiKey = (await ask('API Key (可空): ')).trim();
        }

        let modelFetchError = '';
        if (providerName) {
            if (isCustomProvider) {
                const res = await fetchModelsFromBaseUrl(baseUrl, apiKey);
                if (res.unlimited) {
                    modelFetchUnlimited = true;
                } else if (res.error) {
                    modelFetchError = res.error;
                } else {
                    availableModels = res.models || [];
                }
            } else {
                const res = await fetchProviderModels(providerName);
                if (res.unlimited) {
                    modelFetchUnlimited = true;
                } else if (res.error) {
                    modelFetchError = res.error;
                } else {
                    availableModels = res.models || [];
                }
            }
        }
        if (modelFetchUnlimited) {
            console.log('提示: 提供商未提供模型列表，视为不限，请手动输入。');
        } else if (modelFetchError) {
            console.log(`提示: 获取模型列表失败: ${modelFetchError}，请手动输入。`);
        }
        if (availableModels.length > 0) {
            if (!defaultModel || !availableModels.includes(defaultModel)) {
                defaultModel = availableModels[0];
            }
        }

        while (true) {
            console.log('\n选择模型:');
            if (availableModels.length > 0) {
                availableModels.forEach((name, index) => {
                    console.log(`  ${index + 1}. ${name}`);
                });
            } else {
                console.log('  (暂无模型，将使用自定义输入)');
            }

            const suffix = defaultModel ? ` (默认 ${defaultModel})` : '';
            const input = (await ask(`请输入序号或名称${suffix}: `)).trim();

            if (!input) {
                if (defaultModel) {
                    modelName = defaultModel;
                    break;
                }
                console.log('提示: 模型不能为空。');
                continue;
            }

            if (/^\d+$/.test(input)) {
                const index = parseInt(input, 10);
                if (index >= 1 && index <= availableModels.length) {
                    modelName = availableModels[index - 1];
                    break;
                }
                console.log('提示: 序号无效，请重试。');
                continue;
            }

            modelName = input;
            break;
        }

        console.log('\n即将应用:');
        console.log('  提供商:', providerName);
        if (isCustomProvider) {
            console.log('  Base URL:', baseUrl);
        }
        console.log('  模型:', modelName);

        const confirm = (await ask('确认应用? (Y/n): ')).trim().toLowerCase();
        if (confirm === 'n' || confirm === 'no') {
            console.log('已取消');
            return;
        }

        if (isCustomProvider) {
            if (providers[providerName]) {
                cmdUpdate(providerName, baseUrl, apiKey, true);
            } else {
                cmdAdd(providerName, baseUrl, apiKey, true);
            }
        }

        const latestModels = readModels();
        if (modelName && !latestModels.includes(modelName)) {
            cmdAddModel(modelName, true);
        }

        cmdSwitch(providerName, true);
        cmdUseModel(modelName, true);

        console.log('✓ 已应用配置');
        console.log('  提供商:', providerName);
        console.log('  模型:', modelName);
        console.log();
    } catch (e) {
        console.error('错误:', e.message || e);
        process.exitCode = 1;
    } finally {
        rl.close();
    }
}

// 显示当前状态
function cmdStatus() {
    const configResult = readConfigOrVirtualDefault();
    if (hasConfigLoadError(configResult)) {
        printConfigLoadErrorAndMarkExit(configResult);
        return;
    }
    const { config, isVirtual } = configResult;
    const current = config.model_provider || '未设置';
    const currentModel = config.model || '未设置';

    console.log('\n当前状态:');
    console.log('  提供商:', current);
    console.log('  模型:', currentModel);
    console.log('  模型列表: 接口提供');
    if (isVirtual) {
        console.log('  说明: 当前为虚拟默认配置（config.toml 尚未创建）');
    }
    console.log();
}

function parseDoctorCommandArgs(argv = []) {
    const options = {
        format: 'json',
        lang: '',
        range: '7d',
        targetApp: 'codex',
        remote: true,
        includeInstall: true,
        includeUsage: true,
        includeTasks: true,
        includeSkills: true,
        output: ''
    };
    let cursor = 0;
    while (cursor < argv.length) {
        const token = String(argv[cursor] || '');
        if (token === '--json') {
            options.format = 'json';
            cursor += 1;
            continue;
        }
        if (token === '--format') {
            const value = String(argv[cursor + 1] || '').trim().toLowerCase();
            if (!value || value.startsWith('--')) {
                throw new Error('错误: --format 需要一个值（json/md）');
            }
            options.format = value === 'md' || value === 'markdown' ? 'md' : 'json';
            cursor += 2;
            continue;
        }
        if (token === '--output') {
            const value = String(argv[cursor + 1] || '').trim();
            if (!value || value.startsWith('--')) {
                throw new Error('错误: --output 需要一个值（文件路径）');
            }
            options.output = value;
            cursor += 2;
            continue;
        }
        if (token === '--lang') {
            const value = String(argv[cursor + 1] || '').trim().toLowerCase();
            if (!value || value.startsWith('--')) {
                throw new Error('错误: --lang 需要一个值（zh/en）');
            }
            options.lang = value === 'en' ? 'en' : 'zh';
            cursor += 2;
            continue;
        }
        if (token === '--range') {
            const value = String(argv[cursor + 1] || '').trim().toLowerCase();
            if (!value || value.startsWith('--')) {
                throw new Error('错误: --range 需要一个值（7d/30d/all）');
            }
            options.range = value === 'all' ? 'all' : (value === '30d' ? '30d' : '7d');
            cursor += 2;
            continue;
        }
        if (token === '--target-app') {
            const value = String(argv[cursor + 1] || '').trim().toLowerCase();
            if (!value || value.startsWith('--')) {
                throw new Error('错误: --target-app 需要一个值（codex/claude）');
            }
            options.targetApp = value === 'claude' ? 'claude' : 'codex';
            cursor += 2;
            continue;
        }
        if (token === '--no-remote') {
            options.remote = false;
            cursor += 1;
            continue;
        }
        if (token === '--no-install') {
            options.includeInstall = false;
            cursor += 1;
            continue;
        }
        cursor += 1;
    }
    return options;
}

async function cmdDoctor(argv = []) {
    try {
        const options = parseDoctorCommandArgs(argv);
        const report = await buildDoctorReport(options, {
            getStatusPayload: buildMcpStatusPayload,
            buildInstallStatusReport,
            buildConfigHealthReport,
            listSessionUsage,
            listSkills
        });
        const format = options.format === 'md' ? 'md' : 'json';
        const text = format === 'md'
            ? renderDoctorMarkdown(report)
            : JSON.stringify(report, null, 2);
        if (options.output) {
            ensureDir(path.dirname(options.output));
            fs.writeFileSync(options.output, text);
        } else {
            process.stdout.write(text + '\n');
        }
    } catch (e) {
        console.error('错误:', e && e.message ? e.message : e);
        process.exitCode = 1;
    }
}

async function cmdImportSkills(argv = []) {
    try {
        await cmdImportSkillsFromUrl(argv);
    } catch (e) {
        console.error('错误:', e && e.message ? e.message : e);
        process.exitCode = 1;
    }
}

// 列出所有提供商
function cmdList() {
    const configResult = readConfigOrVirtualDefault();
    if (hasConfigLoadError(configResult)) {
        printConfigLoadErrorAndMarkExit(configResult);
        return;
    }
    const { config, isVirtual } = configResult;
    const providers = config.model_providers || {};
    const current = config.model_provider;

    console.log('\n提供商列表:');
    console.log('┌─────────────────────────────────────────────────────────┐');

    const names = Object.keys(providers);
    if (names.length === 0) {
        console.log('│  (无)                                                         │');
    } else {
        names.forEach(name => {
            const p = providers[name];
            const isCurrent = name === current;
            const marker = isCurrent ? '●' : ' ';
            const key = p.preferred_auth_method || '(无密钥)';
            const displayKey = key.length > 30 ? key.substring(0, 27) + '...' : key;

            console.log(`│ ${marker} ${name.padEnd(20)}  ${displayKey.padEnd(31)} │`);
        });
    }

    console.log('└─────────────────────────────────────────────────────────┘');
    console.log(`总计: ${names.length} 个提供商`);
    if (isVirtual) {
        console.log('提示: 当前使用虚拟默认配置（config.toml 尚未创建）');
    }
    console.log();
}

// 列出所有模型
async function cmdModels() {
    const res = await fetchProviderModels('');
    if (res.error) {
        console.error('错误: 获取模型列表失败:', res.error);
        process.exitCode = 1;
        return;
    }
    if (res.unlimited) {
        const label = res.provider ? ` (${res.provider})` : '';
        console.log(`\n可用模型${label}:`);
        console.log('  (接口未提供，视为不限)');
        console.log();
        return;
    }
    const models = Array.isArray(res.models) ? res.models : [];
    const label = res.provider ? ` (${res.provider})` : '';
    console.log(`\n可用模型${label}:`);
    if (models.length === 0) {
        console.log('  (空)');
    } else {
        models.forEach((m, i) => {
            console.log(`  ${i + 1}. ${m}`);
        });
    }
    console.log();
}

// 切换提供商
function cmdSwitch(providerName, silent = false) {
    const config = sanitizeRemovedBuiltinProxyProvider(readConfig());
    const providers = config.model_providers || {};

    if (!providers[providerName]) {
        if (!silent) {
            console.error('错误: 提供商不存在:', providerName);
            console.log('\n可用的提供商:');
            Object.keys(providers).forEach(name => console.log('  -', name));
        }
        throw new Error('提供商不存在');
    }

    // 切换提供商
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const newContent = content.replace(
        /^(model_provider\s*=\s*)(["']).*?(["'])/m,
        `$1$2${providerName}$3`
    );
    writeConfig(newContent);

    // 更新认证信息
    const apiKey = providers[providerName].preferred_auth_method || '';
    updateAuthJson(apiKey);

    // 切换到该提供商的模型
    const currentModels = readCurrentModels();
    const targetModel = currentModels[providerName] || readModels()[0];
    const content2 = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const modelRegex = /^(model\s*=\s*)(["']).*?(["'])/m;
    if (modelRegex.test(content2)) {
        const newContent2 = content2.replace(modelRegex, `$1$2${targetModel}$3`);
        writeConfig(newContent2);
    }

    if (!silent) {
        console.log('✓ 已切换到:', providerName);
        console.log('✓ 当前模型:', targetModel);
        console.log();
    }
    recordRecentConfig(providerName, targetModel);
    return targetModel;
}

// 切换模型
function cmdUseModel(modelName, silent = false) {
    if (!modelName) {
        if (!silent) console.error('错误: 模型名称必填');
        throw new Error('模型名称必填');
    }
    const models = readModels();
    if (!models.includes(modelName)) {
        models.push(modelName);
        writeModels(models);
    }

    const config = readConfig();
    const currentProvider = config.model_provider;
    if (!currentProvider) {
        if (!silent) console.error('错误: 未设置当前提供商');
        throw new Error('未设置当前提供商');
    }

    // 更新模型
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const modelRegex = /^(model\s*=\s*)(["']).*?(["'])/m;
    if (modelRegex.test(content)) {
        const newContent = content.replace(modelRegex, `$1$2${modelName}$3`);
        writeConfig(newContent);
    }

    // 保存当前提供商的模型选择
    const currentModels = readCurrentModels();
    currentModels[currentProvider] = modelName;
    writeCurrentModels(currentModels);

    if (!silent) {
        console.log('✓ 已切换模型:', modelName);
        console.log();
    }
    recordRecentConfig(currentProvider, modelName);
}

// 添加提供商
function cmdAdd(name, baseUrl, apiKey, silent = false, options = {}) {
    const providerName = typeof name === 'string' ? name.trim() : '';
    const providerBaseUrl = normalizeBaseUrl(baseUrl);
    const bridgeType = options && typeof options.bridge === 'string' ? options.bridge.trim() : '';
    const useOpenaiBridge = bridgeType === 'openai';

    if (bridgeType && bridgeType !== 'openai') {
        const msg = `错误: 不支持的 --bridge 值: ${bridgeType}（仅支持: openai）`;
        if (!silent) console.error(msg);
        throw new Error(msg);
    }

    if (!providerName || !providerBaseUrl) {
        if (!silent) {
            console.error('用法: codexmate add <名称> <URL> [密钥] [--bridge <openai>]');
            console.log('\n示例:');
            console.log('  codexmate add 88code https://api.88code.ai/v1 sk-xxx');
            console.log('  codexmate add 88code https://api.88code.ai/v1 sk-xxx --bridge openai');
        }
        throw new Error('名称和URL必填');
    }
    if (!isValidProviderName(providerName)) {
        if (!silent) console.error('错误: 名称仅支持字母/数字/._-');
        throw new Error('名称仅支持字母/数字/._-');
    }
    if (isReservedProviderNameForCreation(providerName)) {
        if (!silent) console.error('错误: 提供商名称不可用');
        throw new Error('提供商名称不可用');
    }
    if (isBuiltinProxyProvider(providerName)) {
        if (!silent) console.error(`错误: ${providerName} 为保留名称，不可手动添加`);
        throw new Error(`${providerName} 为保留名称，不可手动添加`);
    }
    if (!isValidHttpUrl(providerBaseUrl)) {
        if (!silent) console.error('错误: URL 仅支持 http/https');
        throw new Error('URL 仅支持 http/https');
    }

    const config = readConfig();
    if (config.model_providers && config.model_providers[providerName]) {
        if (!silent) console.error('错误: 提供商已存在:', providerName);
        throw new Error('提供商已存在');
    }

    // 使用内建转换（可向下兼容：未来新增 bridgeType 仅需在这里扩展分支）
    if (useOpenaiBridge) {
        const res = addProviderToConfig({
            name: providerName,
            url: providerBaseUrl,
            key: apiKey || '',
            useTransform: true
        });
        if (res && res.error) {
            throw new Error(res.error);
        }
        // 初始化当前模型（保持与普通 add 行为一致）
        const currentModels = readCurrentModels();
        if (!currentModels[providerName]) {
            currentModels[providerName] = readModels()[0];
            writeCurrentModels(currentModels);
        }
        if (!silent) {
            console.log('✓ 已添加提供商:', providerName);
            console.log('  上游 URL:', providerBaseUrl);
            console.log('  模式: 内建转换 (openai)');
            console.log();
        }
        return;
    }

    const safeName = escapeTomlBasicString(providerName);
    const safeBaseUrl = escapeTomlBasicString(providerBaseUrl);
    const safeApiKey = escapeTomlBasicString(apiKey || '');
    const newBlock = `
${buildModelProviderTableHeader(providerName)}
name = "${safeName}"
base_url = "${safeBaseUrl}"
wire_api = "responses"
requires_openai_auth = true
preferred_auth_method = "${safeApiKey}"
request_max_retries = 4
stream_max_retries = 10
stream_idle_timeout_ms = 300000
`;

    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    writeConfig(content.trimEnd() + '\n' + newBlock);

    // 初始化当前模型
    const currentModels = readCurrentModels();
    if (!currentModels[providerName]) {
        currentModels[providerName] = readModels()[0];
        writeCurrentModels(currentModels);
    }

    if (!silent) {
        console.log('✓ 已添加提供商:', providerName);
        console.log('  URL:', providerBaseUrl);
        console.log();
    }
}

// 删除提供商
function cmdDelete(name, silent = false) {
    const res = performProviderDeletion(name, { silent });
    if (res.error) {
        throw new Error(res.error);
    }
    if (!silent) {
        console.log('✓ 已删除提供商:', name);
        if (res.switched && res.provider) {
            console.log(`  已自动切换到 provider: ${res.provider}，model: ${res.model || '(未设置)'}`);
        }
        console.log();
    }
}

// 更新提供商
function cmdUpdate(name, baseUrl, apiKey, silent = false, options = {}) {
    const allowManaged = !!(options && options.allowManaged);
    const forceUseTransform = !!(options && options.useTransform);
    const hasOpenaiBridgeMaxRetries = options && Object.prototype.hasOwnProperty.call(options, 'openaiBridgeMaxRetries');
    const openaiBridgeMaxRetries = normalizeOpenaiBridgeMaxRetries(options && options.openaiBridgeMaxRetries);
    const normalizedBaseUrl = baseUrl === undefined ? undefined : normalizeBaseUrl(baseUrl);
    if (!name) {
        if (!silent) console.error('错误: 提供商名称必填');
        throw new Error('提供商名称必填');
    }
    if (isNonEditableProvider(name) && !allowManaged) {
        const msg = `${name} 为保留名称，不可编辑`;
        if (!silent) console.error(`错误: ${msg}`);
        throw new Error(msg);
    }

    const config = readConfig();
    if (!config.model_providers || !config.model_providers[name]) {
        if (!silent) console.error('错误: 提供商不存在:', name);
        throw new Error('提供商不存在');
    }

    const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const providerConfig = config.model_providers[name];
    const isTransformProvider = (() => {
        if (forceUseTransform) return true;
        if (!providerConfig || typeof providerConfig !== 'object') return false;
        const bridge = typeof providerConfig.codexmate_bridge === 'string' ? providerConfig.codexmate_bridge.trim() : '';
        if (bridge === 'openai') return true;
        const url = typeof providerConfig.base_url === 'string' ? providerConfig.base_url : '';
        return url.includes('/bridge/openai/');
    })();
    const providerSegments = providerConfig && Array.isArray(providerConfig.__codexmate_legacy_segments)
        ? providerConfig.__codexmate_legacy_segments
        : null;
    const ranges = findProviderSectionRanges(content, name, providerSegments);
    if (ranges.length === 0) {
        if (!silent) console.error('错误: 无法找到提供商配置块');
        throw new Error('无法找到提供商配置块');
    }
    if (normalizedBaseUrl !== undefined && !isValidHttpUrl(normalizedBaseUrl)) {
        if (!silent) console.error('错误: URL 仅支持 http/https');
        throw new Error('URL 仅支持 http/https');
    }

    const replaceTomlStringField = (block, fieldName, rawValue) => {
        const safeValue = escapeTomlBasicString(rawValue);
        const escapedFieldName = escapeRegex(fieldName);
        const multilineRanges = collectTomlMultilineStringRanges(block);
        const tripleStartRegex = new RegExp(`^(\\s*${escapedFieldName}\\s*=\\s*)(\"\"\"|''')`, 'mg');
        let tripleStartMatch = null;
        let tripleCandidate;
        while ((tripleCandidate = tripleStartRegex.exec(block)) !== null) {
            if (isIndexInRanges(tripleCandidate.index, multilineRanges)) {
                continue;
            }
            tripleStartMatch = tripleCandidate;
            break;
        }
        if (tripleStartMatch) {
            const prefixStart = tripleStartMatch.index;
            const prefixEnd = prefixStart + tripleStartMatch[1].length;
            const tripleQuote = tripleStartMatch[2];
            const valueStart = prefixEnd + tripleQuote.length;
            const quoteChar = tripleQuote[0];
            let valueEnd = -1;
            let closingRunLength = 0;
            for (let i = valueStart; i < block.length; i++) {
                if (block[i] !== quoteChar) continue;
                let runEnd = i + 1;
                while (runEnd < block.length && block[runEnd] === quoteChar) {
                    runEnd++;
                }
                const runLength = runEnd - i;
                if (runLength < tripleQuote.length) {
                    i = runEnd - 1;
                    continue;
                }
                if (tripleQuote === '"""') {
                    let slashCount = 0;
                    for (let j = i - 1; j >= valueStart && block[j] === '\\'; j--) {
                        slashCount++;
                    }
                    if (slashCount % 2 !== 0) {
                        continue;
                    }
                }
                valueEnd = i;
                closingRunLength = runLength;
                break;
            }
            if (valueEnd === -1) {
                throw new Error(`${fieldName} 使用了未闭合的多行 TOML 字符串，无法安全更新`);
            }
            const lineEndIndex = block.indexOf('\n', valueEnd + closingRunLength);
            let tailEnd = lineEndIndex === -1 ? block.length : lineEndIndex;
            if (lineEndIndex > 0 && block[lineEndIndex - 1] === '\r') {
                tailEnd = lineEndIndex - 1;
            }
            const tail = block.slice(valueEnd + closingRunLength, tailEnd);
            const tailMatch = tail.match(/^(\s+#.*)?\s*$/);
            if (!tailMatch) {
                throw new Error(`${fieldName} 多行字符串后的语法不受支持，无法安全更新`);
            }
            const commentSuffix = tailMatch[1] || '';
            const replacementLine = `${block.slice(prefixStart, prefixEnd)}"${safeValue}"${commentSuffix}`;
            return block.slice(0, prefixStart) + replacementLine + block.slice(tailEnd);
        }

        const withCommentRegex = new RegExp(
            `^(\\s*${escapedFieldName}\\s*=\\s*)(?:"(?:\\\\.|[^"\\\\])*"|'[^'\\n]*')(\\s+#.*)?$`,
            'mg'
        );
        let replaced = false;
        let next = block.replace(
            withCommentRegex,
            (full, prefix, suffix = '', offset) => {
                if (replaced || isIndexInRanges(offset, multilineRanges)) {
                    return full;
                }
                replaced = true;
                return `${prefix}"${safeValue}"${suffix}`;
            }
        );
        if (!replaced) {
            const fallbackRegex = new RegExp(`^(\\s*${escapedFieldName}\\s*=\\s*)(.*?)(\\s+#.*)?$`, 'mg');
            let fallbackReplaced = false;
            const multilineRangesForNext = collectTomlMultilineStringRanges(next);
            let fallbackMatch;
            let fallbackCandidate;
            while ((fallbackCandidate = fallbackRegex.exec(next)) !== null) {
                if (isIndexInRanges(fallbackCandidate.index, multilineRangesForNext)) {
                    continue;
                }
                fallbackMatch = fallbackCandidate;
                break;
            }
            if (fallbackMatch) {
                const existingValue = String(fallbackMatch[2] || '').trim();
                const looksLikeMultilineArray = existingValue.startsWith('[') && !existingValue.endsWith(']');
                const looksLikeMultilineInlineTable = existingValue.startsWith('{') && !existingValue.endsWith('}');
                if (looksLikeMultilineArray || looksLikeMultilineInlineTable) {
                    throw new Error(`${fieldName} 当前值是多行 TOML 结构，无法安全更新`);
                }
                const prefix = fallbackMatch[1];
                const suffix = fallbackMatch[3] || '';
                const replacement = `${prefix}"${safeValue}"${suffix}`;
                next = `${next.slice(0, fallbackMatch.index)}${replacement}${next.slice(fallbackMatch.index + fallbackMatch[0].length)}`;
                fallbackReplaced = true;
            }
            if (!fallbackReplaced) {
                const keyIndentMatch = block.match(/^(\s*)[A-Za-z0-9_.-]+\s*=/m);
                const indent = keyIndentMatch ? keyIndentMatch[1] : '';
                const lineEnding = block.includes('\r\n') ? '\r\n' : '\n';
                const tailMatch = block.match(/(\s*)$/);
                const tail = tailMatch ? tailMatch[1] : '';
                const body = block.slice(0, block.length - tail.length);
                const separator = body.endsWith('\n') || body.endsWith('\r') ? '' : lineEnding;
                next = `${body}${separator}${indent}${fieldName} = "${safeValue}"${tail}`;
            }
        }
        return next;
    };

    const replaceTomlNumberField = (block, fieldName, rawValue) => {
        const numberValue = String(Math.floor(Number(rawValue)));
        const escapedFieldName = escapeRegex(fieldName);
        const multilineRanges = collectTomlMultilineStringRanges(block);
        const withCommentRegex = new RegExp(`^(\\s*${escapedFieldName}\\s*=\\s*)([-+]?\\d+(?:\\.\\d+)?)(\\s+#.*)?$`, 'mg');
        let replaced = false;
        let next = block.replace(withCommentRegex, (full, prefix, _value, suffix = '', offset) => {
            if (replaced || isIndexInRanges(offset, multilineRanges)) {
                return full;
            }
            replaced = true;
            return `${prefix}${numberValue}${suffix}`;
        });
        if (!replaced) {
            const keyIndentMatch = block.match(/^(\s*)[A-Za-z0-9_.-]+\s*=/m);
            const indent = keyIndentMatch ? keyIndentMatch[1] : '';
            const lineEnding = block.includes('\r\n') ? '\r\n' : '\n';
            const tailMatch = block.match(/(\s*)$/);
            const tail = tailMatch ? tailMatch[1] : '';
            const body = block.slice(0, block.length - tail.length);
            const separator = body.endsWith('\n') || body.endsWith('\r') ? '' : lineEnding;
            next = `${body}${separator}${indent}${fieldName} = ${numberValue}${tail}`;
        }
        return next;
    };

    const replaceTomlBooleanField = (block, fieldName, rawValue) => {
        const boolValue = rawValue ? 'true' : 'false';
        const escapedFieldName = escapeRegex(fieldName);
        const multilineRanges = collectTomlMultilineStringRanges(block);
        const withCommentRegex = new RegExp(`^(\\s*${escapedFieldName}\\s*=\\s*)(true|false)(\\s+#.*)?$`, 'mg');
        let replaced = false;
        let next = block.replace(withCommentRegex, (full, prefix, _value, suffix = '', offset) => {
            if (replaced || isIndexInRanges(offset, multilineRanges)) {
                return full;
            }
            replaced = true;
            return `${prefix}${boolValue}${suffix}`;
        });
        if (!replaced) {
            const keyIndentMatch = block.match(/^(\s*)[A-Za-z0-9_.-]+\s*=/m);
            const indent = keyIndentMatch ? keyIndentMatch[1] : '';
            const lineEnding = block.includes('\r\n') ? '\r\n' : '\n';
            const tailMatch = block.match(/(\s*)$/);
            const tail = tailMatch ? tailMatch[1] : '';
            const body = block.slice(0, block.length - tail.length);
            const separator = body.endsWith('\n') || body.endsWith('\r') ? '' : lineEnding;
            next = `${body}${separator}${indent}${fieldName} = ${boolValue}${tail}`;
        }
        return next;
    };

    const computeLocalOpenaiBridgeBaseUrl = () => {
        const port = resolveWebPort();
        return new URL(
            `/bridge/openai/${encodeURIComponent(name)}/v1`,
            `http://${DEFAULT_WEB_OPEN_HOST}:${port}`
        ).toString().replace(/\/+$/g, '');
    };

    let newContent = content;
    const sorted = ranges.sort((a, b) => b.start - a.start);
    for (const range of sorted) {
        const providerBlock = newContent.slice(range.start, range.end);
        let updatedBlock = providerBlock;

        if (isTransformProvider) {
            // 对 transform provider：UI 的 URL/key 表单代表“上游 OpenAI 兼容服务”，而不是写入 config.toml 的 base_url。
            // config.toml 仍需保持本地 bridge base_url + 固定 token。
            const settings = readOpenaiBridgeSettings(OPENAI_BRIDGE_SETTINGS_FILE);
            const existing = settings && settings.providers ? settings.providers[name] : null;
            const existingBaseUrl = existing && typeof existing.baseUrl === 'string' ? existing.baseUrl : '';
            const existingApiKey = existing && typeof existing.apiKey === 'string' ? existing.apiKey : '';

            const upstreamBaseUrl = normalizedBaseUrl !== undefined
                ? normalizedBaseUrl
                : normalizeBaseUrl(existingBaseUrl || '');
            const upstreamApiKey = apiKey !== undefined && apiKey !== ''
                ? apiKey
                : existingApiKey;

            if (upstreamBaseUrl) {
                const saveRes = upsertOpenaiBridgeProvider(OPENAI_BRIDGE_SETTINGS_FILE, name, upstreamBaseUrl, upstreamApiKey, undefined, {
                    maxRetries: hasOpenaiBridgeMaxRetries ? openaiBridgeMaxRetries : resolveProviderOpenaiBridgeMaxRetries(providerConfig)
                });
                if (saveRes && saveRes.error) {
                    throw new Error(String(saveRes.error));
                }
            } else {
                // 不提供 URL 且没有已有上游配置时无法更新
                const resolved = resolveOpenaiBridgeUpstream(OPENAI_BRIDGE_SETTINGS_FILE, name);
                if (resolved && resolved.error) {
                    throw new Error(String(resolved.error));
                }
            }

            updatedBlock = replaceTomlStringField(updatedBlock, 'base_url', computeLocalOpenaiBridgeBaseUrl());
            updatedBlock = replaceTomlBooleanField(updatedBlock, 'requires_openai_auth', true);
            updatedBlock = replaceTomlStringField(updatedBlock, 'preferred_auth_method', 'codexmate');
            updatedBlock = replaceTomlStringField(updatedBlock, 'codexmate_bridge', 'openai');
            if (hasOpenaiBridgeMaxRetries) {
                updatedBlock = replaceTomlNumberField(updatedBlock, 'codexmate_bridge_max_retries', openaiBridgeMaxRetries);
            }
        } else {
            if (normalizedBaseUrl) {
                updatedBlock = replaceTomlStringField(updatedBlock, 'base_url', normalizedBaseUrl);
            }
            if (apiKey !== undefined) {
                updatedBlock = replaceTomlStringField(updatedBlock, 'preferred_auth_method', apiKey);
            }
        }

        newContent = newContent.slice(0, range.start) + updatedBlock + newContent.slice(range.end);
    }

    const finalContent = newContent.trim();
    try {
        toml.parse(finalContent);
    } catch (e) {
        throw new Error(`更新后的 config.toml 无效: ${e.message}`);
    }
    writeConfig(finalContent);

    // 如果更新了 API Key 且该提供商是当前激活的，同步更新 auth.json
    const currentProvider = config.model_provider;
    if (apiKey !== undefined && name === currentProvider) {
        updateAuthJson(apiKey);
    }

    if (!silent) {
        console.log('✓ 已更新提供商:', name);
        console.log();
    }
}

function stripJsoncComments(input) {
    const text = String(input || '');
    let output = '';
    let inString = false;
    let quote = '';
    let escaped = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];
        if (inString) {
            output += ch;
            if (escaped) {
                escaped = false;
            } else if (ch === '\\') {
                escaped = true;
            } else if (ch === quote) {
                inString = false;
                quote = '';
            }
            continue;
        }
        if (ch === '"' || ch === "'") {
            inString = true;
            quote = ch;
            output += ch;
            continue;
        }
        if (ch === '/' && next === '/') {
            while (i < text.length && text[i] !== '\n') i++;
            output += '\n';
            continue;
        }
        if (ch === '/' && next === '*') {
            i += 2;
            while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
            i += 1;
            continue;
        }
        output += ch;
    }
    return output.replace(/,\s*([}\]])/g, '$1');
}

function readKilocodeGlobalConfig() {
    const candidates = [KILOCODE_GLOBAL_JSONC_CONFIG_FILE, KILOCODE_GLOBAL_JSON_CONFIG_FILE];
    const filePath = candidates.find((candidate) => fs.existsSync(candidate)) || KILOCODE_GLOBAL_JSONC_CONFIG_FILE;
    if (!fs.existsSync(filePath)) {
        return { filePath, config: {} };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    if (!raw.trim()) {
        return { filePath, config: {} };
    }
    try {
        const parsed = JSON.parse(stripJsoncComments(raw));
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('配置根节点必须是对象');
        }
        return { filePath, config: parsed };
    } catch (e) {
        throw new Error(`读取 KiloCode 配置失败: ${e.message}`);
    }
}

function normalizeKilocodeProviderName(value) {
    const name = typeof value === 'string' && value.trim() ? value.trim() : 'codexmate';
    if (!/^[A-Za-z0-9._-]+$/.test(name)) {
        throw new Error('provider 仅支持字母/数字/._-');
    }
    return name;
}

function writeKilocodeProviderConfig(params = {}) {
    const provider = normalizeKilocodeProviderName(params.provider);
    const url = normalizeBaseUrl(params.url || '');
    const incomingKey = typeof params.key === 'string' ? params.key.trim() : '';
    const model = typeof params.model === 'string' ? params.model.trim() : '';
    if (!url) throw new Error('URL 必填');
    if (!model) throw new Error('模型名称必填');
    if (!isValidHttpUrl(url)) throw new Error('URL 仅支持 http/https');

    const { filePath, config } = readKilocodeGlobalConfig();
    const existingProvider = config.provider
        && typeof config.provider === 'object'
        && !Array.isArray(config.provider)
        && config.provider[provider]
        && typeof config.provider[provider] === 'object'
        && !Array.isArray(config.provider[provider])
        ? config.provider[provider]
        : {};
    const existingOptions = existingProvider.options && typeof existingProvider.options === 'object' && !Array.isArray(existingProvider.options)
        ? existingProvider.options
        : {};
    const existingKey = typeof existingOptions.apiKey === 'string' ? existingOptions.apiKey.trim() : '';
    const key = incomingKey || existingKey;
    if (!key) throw new Error('API Key 必填');

    const next = { ...config };
    if (!next.$schema) {
        next.$schema = 'https://app.kilo.ai/config.json';
    }
    next.provider = next.provider && typeof next.provider === 'object' && !Array.isArray(next.provider)
        ? { ...next.provider }
        : {};
    next.provider[provider] = {
        ...(next.provider[provider] && typeof next.provider[provider] === 'object' && !Array.isArray(next.provider[provider])
            ? next.provider[provider]
            : {}),
        name: provider,
        npm: '@ai-sdk/openai-compatible',
        api: url,
        env: [],
        models: {
            [model]: {
                name: model,
                tool_call: true
            }
        },
        options: {
            ...(next.provider[provider]
                && typeof next.provider[provider] === 'object'
                && next.provider[provider].options
                && typeof next.provider[provider].options === 'object'
                && !Array.isArray(next.provider[provider].options)
                ? next.provider[provider].options
                : {}),
            apiKey: key,
            baseURL: url
        }
    };
    next.model = `${provider}/${model}`;
    const enabled = Array.isArray(next.enabled_providers) ? next.enabled_providers.filter((item) => typeof item === 'string' && item.trim()) : [];
    next.enabled_providers = enabled.includes(provider) ? enabled : [...enabled, provider];

    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + '\n', 'utf-8');
    return { filePath, provider, model, url };
}

function parseKilocodeCommandArgs(argv = []) {
    const options = { provider: 'codexmate', command: '' };
    const positional = [];
    let passthrough = [];
    for (let i = 0; i < argv.length; i++) {
        const token = String(argv[i] || '');
        if (token === '--') {
            passthrough = argv.slice(i + 1).map(item => String(item));
            break;
        }
        if (token === '--provider') {
            const value = String(argv[i + 1] || '');
            if (!value || value.startsWith('--')) throw new Error('错误: --provider 需要一个值');
            options.provider = value;
            i += 1;
            continue;
        }
        if (token.startsWith('--provider=')) {
            options.provider = token.slice('--provider='.length);
            continue;
        }
        if (token === '--help' || token === '-h') {
            options.help = true;
            continue;
        }
        positional.push(token);
    }
    if (positional[0] === 'config' || positional[0] === 'setup') {
        options.command = positional.shift();
    }
    return {
        command: options.command,
        url: positional[0],
        key: positional[1],
        model: positional[2],
        provider: options.provider,
        help: !!options.help,
        passthrough: passthrough.length ? passthrough : positional.slice(options.command ? 3 : 0)
    };
}

function printKilocodeUsage() {
    console.log('\n用法:');
    console.log('  codexmate kilo [KiloCode参数...]');
    console.log('  codexmate kilo <URL> <API密钥> <模型> [--provider <id>] [-- KiloCode参数...]');
    console.log('  codexmate kilo config <URL> <API密钥> <模型> [--provider <id>]');
    console.log('\n说明:');
    console.log('  codexmate kilo 默认启动 KiloCode；带 URL/API密钥/模型时会先写入 KiloCode provider 配置再启动。');
    console.log('  纯配置请使用 codexmate kilo config ...');
    console.log('  配置写入 ~/.config/kilo/kilo.jsonc（或已存在的 kilo.json）。');
}

function resolveKilocodeBinary() {
    for (const bin of ['kilo', 'kilocode']) {
        if (commandExists(bin, '--version')) return bin;
    }
    return '';
}

function runKilocodeCommand(args = [], options = {}) {
    const bin = resolveKilocodeBinary();
    if (!bin) {
        throw new Error('无法启动 KiloCode，请确认已安装 KiloCode CLI，并且 kilo 或 kilocode 在 PATH 中。');
    }
    const finalArgs = Array.isArray(args) ? args.filter(item => item !== undefined).map(item => String(item)) : [];
    if (options.detached === true) {
        const child = spawn(bin, finalArgs, {
            detached: true,
            stdio: 'ignore',
            windowsHide: true
        });
        child.unref();
        return { success: true, bin, args: finalArgs, pid: child.pid };
    }
    return new Promise((resolve, reject) => {
        const child = spawn(bin, finalArgs, {
            stdio: 'inherit',
            windowsHide: false
        });
        child.on('error', reject);
        child.on('exit', (code, signal) => {
            if (signal) {
                reject(new Error(`KiloCode 已终止: ${signal}`));
                return;
            }
            resolve(code || 0);
        });
    });
}

async function cmdKilocode(argv = []) {
    const parsed = parseKilocodeCommandArgs(argv);
    if (parsed.help) {
        printKilocodeUsage();
        return 0;
    }
    if (parsed.command === 'config') {
        if (!parsed.url || !parsed.key || !parsed.model) {
            printKilocodeUsage();
            throw new Error('URL、API密钥和模型名称必填');
        }
        const result = writeKilocodeProviderConfig(parsed);
        console.log('✓ 已写入 KiloCode 配置');
        console.log('  文件:', result.filePath);
        console.log('  provider:', result.provider);
        console.log('  URL:', result.url);
        console.log('  模型:', `${result.provider}/${result.model}`);
        console.log();
        return 0;
    }
    let passthrough = parsed.passthrough;
    if (parsed.url && parsed.key && parsed.model) {
        const result = writeKilocodeProviderConfig(parsed);
        console.log('✓ 已写入 KiloCode 配置，正在启动 KiloCode');
        console.log('  文件:', result.filePath);
        console.log('  模型:', `${result.provider}/${result.model}`);
        console.log();
        passthrough = parsed.passthrough;
    } else if (parsed.url || parsed.key || parsed.model) {
        passthrough = [parsed.url, parsed.key, parsed.model, ...parsed.passthrough].filter(item => item !== undefined && item !== '');
    }
    return runKilocodeCommand(passthrough);
}

function summarizeKilocodeConfig(config = {}, targetPath = KILOCODE_GLOBAL_JSONC_CONFIG_FILE, exists = false) {
    const providers = getRecord(config.provider);
    const modelRef = typeof config.model === 'string' ? config.model.trim() : '';
    const slash = modelRef.indexOf('/');
    const currentProvider = slash > 0 ? modelRef.slice(0, slash) : '';
    const currentModel = slash > 0 ? modelRef.slice(slash + 1) : modelRef;
    const providerNames = [...new Set([...Object.keys(providers), currentProvider].filter(Boolean))];
    const redactedConfig = JSON.parse(JSON.stringify(config && typeof config === 'object' ? config : {}));
    const redactedProviders = getRecord(redactedConfig.provider);
    for (const provider of Object.values(redactedProviders)) {
        const options = getRecord(provider && provider.options);
        if (typeof options.apiKey === 'string' && options.apiKey) {
            options.apiKey = maskKey(options.apiKey);
        }
    }
    return {
        exists: !!exists,
        targetPath,
        currentProvider,
        currentModel,
        providers: providerNames.map((name) => {
            const provider = getRecord(providers[name]);
            const options = getRecord(provider.options);
            const apiKey = typeof options.apiKey === 'string' ? options.apiKey : '';
            const modelNames = Object.keys(getRecord(provider.models));
            return {
                name,
                api: typeof provider.api === 'string' ? provider.api : '',
                baseURL: typeof options.baseURL === 'string' ? options.baseURL : '',
                hasKey: apiKey.trim().length > 0,
                apiKey: maskKey(apiKey),
                models: modelNames
            };
        }),
        content: JSON.stringify(redactedConfig, null, 2) + '\n',
        redacted: true
    };
}

function readKilocodeConfigInfo() {
    try {
        const { filePath, config } = readKilocodeGlobalConfig();
        return summarizeKilocodeConfig(config, filePath, fs.existsSync(filePath));
    } catch (e) {
        return { error: e.message || '读取 KiloCode 配置失败', targetPath: KILOCODE_GLOBAL_JSONC_CONFIG_FILE };
    }
}

function applyKilocodeConfig(params = {}) {
    assertToolConfigWriteAllowed('kilocode');
    try {
        const result = writeKilocodeProviderConfig({
            provider: params.provider,
            url: params.url,
            key: params.apiKey,
            model: params.model
        });
        const info = readKilocodeConfigInfo();
        return { success: true, ...result, ...info };
    } catch (e) {
        return { error: e.message || '写入 KiloCode 配置失败' };
    }
}

function startKilocodeFromWeb(params = {}) {
    assertToolConfigWriteAllowed('kilocode');
    try {
        if (params && params.configure === true) {
            const saved = applyKilocodeConfig(params);
            if (saved && saved.error) return saved;
        }
        const args = Array.isArray(params.args) ? params.args.map(item => String(item)) : [];
        return runKilocodeCommand(args, { detached: true });
    } catch (e) {
        return { error: e.message || '启动 KiloCode 失败' };
    }
}

// 添加模型
function cmdAddModel(modelName, silent = false) {
    if (!modelName) {
        if (!silent) console.error('用法: codexmate add-model <模型名称>');
        throw new Error('模型名称必填');
    }

    const models = readModels();
    if (models.includes(modelName)) {
        if (!silent) console.log('模型已存在:', modelName);
        return;
    }

    models.push(modelName);
    writeModels(models);

    if (!silent) {
        console.log('✓ 已添加模型:', modelName);
        console.log();
    }
}

// 删除模型
function cmdDeleteModel(modelName, silent = false) {
    const models = readModels();
    const index = models.indexOf(modelName);
    if (index === -1) {
        if (!silent) console.error('错误: 模型不存在:', modelName);
        throw new Error('模型不存在');
    }

    if (models.length <= 1) {
        if (!silent) console.error('错误: 至少需要保留一个模型');
        throw new Error('至少需要保留一个模型');
    }

    models.splice(index, 1);
    writeModels(models);

    // 检查是否有提供商使用该模型
    const currentModels = readCurrentModels();
    let needsUpdate = false;
    for (const [provider, currentModel] of Object.entries(currentModels)) {
        if (currentModel === modelName) {
            currentModels[provider] = models[0];
            needsUpdate = true;
        }
    }

    if (needsUpdate) {
        writeCurrentModels(currentModels);
    }

    if (!silent) {
        console.log('✓ 已删除模型:', modelName);
        console.log();
    }
}

// 脱敏 key
function maskKey(key) {
    if (!key) return '';
    if (key.length <= 8) return '****';
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
}

function normalizeClaudeTargetApi(value) {
    const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (raw === 'chat_completions' || raw === 'chat-completions' || raw === 'chat/completions') {
        return 'chat_completions';
    }
    if (raw === 'ollama') {
        return 'ollama';
    }
    return 'responses';
}

function resetBuiltinClaudeProxySavedSettingsToResponses() {
    const proxySettingsResult = readJsonObjectFromFile(BUILTIN_CLAUDE_PROXY_SETTINGS_FILE, DEFAULT_BUILTIN_CLAUDE_PROXY_SETTINGS);
    const proxySettings = proxySettingsResult.ok && proxySettingsResult.data && typeof proxySettingsResult.data === 'object' && !Array.isArray(proxySettingsResult.data)
        ? proxySettingsResult.data
        : DEFAULT_BUILTIN_CLAUDE_PROXY_SETTINGS;
    writeJsonAtomic(BUILTIN_CLAUDE_PROXY_SETTINGS_FILE, {
        ...DEFAULT_BUILTIN_CLAUDE_PROXY_SETTINGS,
        ...proxySettings,
        enabled: false,
        targetApi: 'responses'
    });
}

// 应用到 Claude Code settings.json（跨平台）
async function applyToClaudeSettings(config = {}) {
    let proxyStarted = false;
    try {
        assertToolConfigWriteAllowed('claude');
        const providerCacheRef = typeof config.providerCacheRef === 'string' ? config.providerCacheRef.trim() : '';
        const cachedProvider = providerCacheRef ? readClaudeProviderCacheProvider(providerCacheRef) : null;
        if (providerCacheRef && !cachedProvider) {
            return { success: false, mode: 'provider-cache', error: '缓存中的 Claude provider 不存在，请重新同步' };
        }
        const effectiveConfig = cachedProvider
            ? {
                ...config,
                apiKey: cachedProvider.apiKey || config.apiKey || '',
                baseUrl: cachedProvider.baseUrl || config.baseUrl || '',
                model: cachedProvider.model || config.model || '',
                targetApi: cachedProvider.targetApi || config.targetApi || 'responses'
            }
            : config;
        const apiKey = (effectiveConfig.apiKey || '').trim();
        const targetApi = normalizeClaudeTargetApi(effectiveConfig.targetApi);
        if (!apiKey && targetApi !== 'ollama') {
            return { success: false, mode: 'settings-file', error: '请先输入 API Key' };
        }

        const configuredBaseUrl = typeof effectiveConfig.baseUrl === 'string' ? effectiveConfig.baseUrl.trim() : '';
        const baseUrl = (configuredBaseUrl || (targetApi === 'ollama' ? 'http://127.0.0.1:11434' : 'https://open.bigmodel.cn/api/anthropic')).trim();
        const model = (effectiveConfig.model || DEFAULT_CLAUDE_MODEL).trim();
        let settingsBaseUrl = baseUrl;
        let settingsApiKey = apiKey;
        let proxyResult = null;

        if (targetApi === 'chat_completions' || targetApi === 'ollama') {
            const upstreamProviderName = typeof effectiveConfig.name === 'string' ? effectiveConfig.name.trim() : '';
            if (targetApi === 'chat_completions' && !configuredBaseUrl && !upstreamProviderName) {
                return {
                    success: false,
                    mode: 'claude-proxy',
                    error: 'chat_completions 模式需要显式的上游 Base URL 或可解析的 provider 名称'
                };
            }
            await stopBuiltinClaudeProxyRuntime();
            const proxyToken = crypto.randomBytes(24).toString('hex');
            proxyResult = await startBuiltinClaudeProxyRuntime({
                enabled: true,
                host: DEFAULT_BUILTIN_CLAUDE_PROXY_SETTINGS.host,
                provider: upstreamProviderName,
                authSource: 'provider',
                targetApi,
                timeoutMs: DEFAULT_BUILTIN_CLAUDE_PROXY_SETTINGS.timeoutMs,
                upstreamProviderName,
                ...(configuredBaseUrl ? { upstreamBaseUrl: configuredBaseUrl } : {}),
                upstreamApiKey: apiKey
            });
            if (!proxyResult || proxyResult.error || proxyResult.success === false || !proxyResult.listenUrl) {
                await stopBuiltinClaudeProxyRuntime();
                resetBuiltinClaudeProxySavedSettingsToResponses();
                return {
                    success: false,
                    mode: 'claude-proxy',
                    error: (proxyResult && proxyResult.error) || '启动 Claude 兼容代理失败'
                };
            }
            proxyStarted = true;
            settingsBaseUrl = proxyResult.listenUrl;
            settingsApiKey = proxyToken;
        } else {
            await stopBuiltinClaudeProxyRuntime();
            resetBuiltinClaudeProxySavedSettingsToResponses();
        }

        const readResult = readJsonObjectFromFile(CLAUDE_SETTINGS_FILE, {});
        if (!readResult.ok) {
            if (proxyStarted) {
                await stopBuiltinClaudeProxyRuntime();
                resetBuiltinClaudeProxySavedSettingsToResponses();
            }
            return { success: false, mode: 'settings-file', error: readResult.error };
        }

        const currentSettings = readResult.data;
        const currentEnv = (currentSettings.env && typeof currentSettings.env === 'object' && !Array.isArray(currentSettings.env))
            ? currentSettings.env
            : {};

        const nextEnv = {
            ...currentEnv,
            ANTHROPIC_API_KEY: settingsApiKey,
            ANTHROPIC_BASE_URL: settingsBaseUrl,
            ANTHROPIC_MODEL: model
        };
        delete nextEnv.ANTHROPIC_AUTH_TOKEN;
        delete nextEnv.CLAUDE_CODE_USE_KEY;
        const subModels = {
            ANTHROPIC_DEFAULT_HAIKU_MODEL: model,
            ANTHROPIC_DEFAULT_SONNET_MODEL: model,
            ANTHROPIC_DEFAULT_OPUS_MODEL: model
        };
        Object.assign(nextEnv, subModels);

        const nextSettings = {
            ...currentSettings,
            env: nextEnv
        };

        ensureDir(CLAUDE_DIR);
        const backupPath = backupFileIfNeededOnce(CLAUDE_SETTINGS_FILE);
        writeJsonAtomic(CLAUDE_SETTINGS_FILE, nextSettings);

        const result = {
            success: true,
            mode: targetApi === 'responses' ? 'settings-file' : 'claude-proxy',
            targetApi,
            targetPath: CLAUDE_SETTINGS_FILE,
            updatedKeys: [
                'env.ANTHROPIC_API_KEY',
                'env.ANTHROPIC_BASE_URL',
                'env.ANTHROPIC_MODEL',
                'env.ANTHROPIC_DEFAULT_HAIKU_MODEL',
                'env.ANTHROPIC_DEFAULT_SONNET_MODEL',
                'env.ANTHROPIC_DEFAULT_OPUS_MODEL'
            ]
        };
        if (proxyResult) {
            result.proxy = {
                running: true,
                listenUrl: proxyResult.listenUrl,
                upstreamProvider: proxyResult.upstreamProvider || '',
                mode: proxyResult.mode || (targetApi === 'ollama' ? 'anthropic-to-ollama' : 'anthropic-to-chat-completions')
            };
        }
        if (backupPath) {
            result.backupPath = backupPath;
        }
        return result;
    } catch (e) {
        if (proxyStarted) {
            try { await stopBuiltinClaudeProxyRuntime(); } catch (_) {}
            try { resetBuiltinClaudeProxySavedSettingsToResponses(); } catch (_) {}
        }
        return {
            success: false,
            mode: 'settings-file',
            error: e.message || '应用 Claude 配置失败'
        };
    }
}

function readClaudeSettingsInfo() {
    const readResult = readJsonObjectFromFile(CLAUDE_SETTINGS_FILE, {});
    if (!readResult.ok) {
        return {
            error: readResult.error || '读取 Claude 配置失败',
            exists: !!readResult.exists,
            targetPath: CLAUDE_SETTINGS_FILE
        };
    }

    const settings = readResult.data || {};
    const env = (settings.env && typeof settings.env === 'object' && !Array.isArray(settings.env))
        ? settings.env
        : {};

    return {
        exists: !!readResult.exists,
        targetPath: CLAUDE_SETTINGS_FILE,
        apiKey: typeof env.ANTHROPIC_API_KEY === 'string' ? env.ANTHROPIC_API_KEY : '',
        authToken: typeof env.ANTHROPIC_AUTH_TOKEN === 'string' ? env.ANTHROPIC_AUTH_TOKEN : '',
        useKey: typeof env.CLAUDE_CODE_USE_KEY === 'string' ? env.CLAUDE_CODE_USE_KEY : '',
        baseUrl: typeof env.ANTHROPIC_BASE_URL === 'string' ? env.ANTHROPIC_BASE_URL : '',
        model: typeof env.ANTHROPIC_MODEL === 'string' ? env.ANTHROPIC_MODEL : '',
        env
    };
}

function readClaudeSettingsRaw() {
    if (!fs.existsSync(CLAUDE_SETTINGS_FILE)) {
        return { content: '{}', exists: false, targetPath: CLAUDE_SETTINGS_FILE };
    }
    try {
        const raw = fs.readFileSync(CLAUDE_SETTINGS_FILE, 'utf-8');
        return { content: raw || '{}', exists: true, targetPath: CLAUDE_SETTINGS_FILE };
    } catch (e) {
        return { error: e.message || '读取 settings.json 失败' };
    }
}

function applyClaudeSettingsRaw(params = {}) {
    assertToolConfigWriteAllowed('claude');
    const content = typeof params.content === 'string' ? params.content : '';
    if (!content.trim()) {
        return { error: '内容不能为空' };
    }
    if (content.length > 1024 * 1024) {
        return { error: '内容过大（最大 1MB）' };
    }
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        return { error: `JSON 解析失败: ${e.message}` };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { error: 'JSON 内容必须是一个对象' };
    }
    try {
        ensureDir(CLAUDE_DIR);
        backupFileIfNeededOnce(CLAUDE_SETTINGS_FILE);
        writeJsonAtomic(CLAUDE_SETTINGS_FILE, parsed);
        return { success: true, targetPath: CLAUDE_SETTINGS_FILE };
    } catch (e) {
        return { error: e.message || '写入 settings.json 失败' };
    }
}

function getOpencodeConfigCandidates() {
    const candidates = [
        OPENCODE_CONFIG_ENV_FILE,
        OPENCODE_GLOBAL_JSONC_CONFIG_FILE,
        OPENCODE_GLOBAL_JSON_CONFIG_FILE,
        OPENCODE_LEGACY_CONFIG_FILE
    ]
        .filter(Boolean)
        .map(item => path.resolve(item));
    return [...new Set(candidates)];
}

function resolveOpencodeConfigFile() {
    const candidates = getOpencodeConfigCandidates();
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return OPENCODE_CONFIG_ENV_FILE || OPENCODE_GLOBAL_JSONC_CONFIG_FILE;
}

function readOpencodeConfigObject(content) {
    const raw = typeof content === 'string' ? content : '';
    if (!raw.trim()) {
        return {};
    }
    const parsed = JSON5.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('OpenCode config must be a JSON/JSONC object');
    }
    return parsed;
}

function normalizeOpencodeAgentName(value) {
    const name = typeof value === 'string' ? value.trim() : '';
    return /^[a-zA-Z0-9_.-]+$/.test(name) ? name : '';
}

function normalizeOpencodeProviderName(value) {
    const name = typeof value === 'string' ? value.trim().toLowerCase() : '';
    return /^[a-z0-9_.-]+$/.test(name) ? name : '';
}

function splitOpencodeModelRef(modelRef) {
    const raw = typeof modelRef === 'string' ? modelRef.trim() : '';
    const slash = raw.indexOf('/');
    if (slash <= 0 || slash === raw.length - 1) {
        return { provider: '', model: raw };
    }
    return {
        provider: normalizeOpencodeProviderName(raw.slice(0, slash)),
        model: raw.slice(slash + 1).trim()
    };
}

function joinOpencodeModelRef(providerName, model) {
    const provider = normalizeOpencodeProviderName(providerName);
    const modelName = typeof model === 'string' ? model.trim().replace(/^\/+/, '') : '';
    return provider && modelName ? `${provider}/${modelName}` : '';
}

function getRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stableOpencodeJson(value) {
    if (Array.isArray(value)) {
        return `[${value.map(item => stableOpencodeJson(item)).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableOpencodeJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function hashOpencodeManagedValue(value) {
    return crypto.createHash('sha256').update(stableOpencodeJson(value === undefined ? null : value)).digest('hex');
}

function normalizeOpencodeProviderStore(raw) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const providers = {};
    const sourceProviders = getRecord(source.providers);
    for (const [rawName, rawProvider] of Object.entries(sourceProviders)) {
        const name = normalizeOpencodeProviderName(rawName);
        const provider = getRecord(rawProvider);
        if (!name) continue;
        const apiKey = typeof provider.apiKey === 'string' ? provider.apiKey : '';
        const model = typeof provider.model === 'string' ? provider.model.trim() : '';
        const maxTokens = Number.isFinite(Number(provider.maxTokens)) && Number(provider.maxTokens) > 0
            ? Number(provider.maxTokens)
            : null;
        const reasoningEffort = typeof provider.reasoningEffort === 'string' ? provider.reasoningEffort.trim().toLowerCase() : '';
        providers[name] = {
            apiKey,
            model,
            disabled: provider.disabled === true,
            maxTokens,
            reasoningEffort: ['low', 'medium', 'high'].includes(reasoningEffort) ? reasoningEffort : '',
            updatedAt: typeof provider.updatedAt === 'string' ? provider.updatedAt : ''
        };
    }
    const rawLastApplied = getRecord(source.lastApplied);
    const lastAppliedProvider = normalizeOpencodeProviderName(rawLastApplied.provider);
    const lastApplied = lastAppliedProvider
        ? {
            provider: lastAppliedProvider,
            modelRef: typeof rawLastApplied.modelRef === 'string' ? rawLastApplied.modelRef : '',
            providerHash: typeof rawLastApplied.providerHash === 'string' ? rawLastApplied.providerHash : '',
            disabledProvidersHash: typeof rawLastApplied.disabledProvidersHash === 'string' ? rawLastApplied.disabledProvidersHash : '',
            providerCreatedByCodexMate: rawLastApplied.providerCreatedByCodexMate === true,
            disabledProviderAddedByCodexMate: rawLastApplied.disabledProviderAddedByCodexMate === true
        }
        : null;
    return {
        version: 1,
        providers,
        lastApplied
    };
}

function readOpencodeProviderStore() {
    if (!fs.existsSync(CODEXMATE_OPENCODE_PROVIDER_STORE_FILE)) {
        return normalizeOpencodeProviderStore({});
    }
    try {
        const raw = JSON.parse(fs.readFileSync(CODEXMATE_OPENCODE_PROVIDER_STORE_FILE, 'utf-8') || '{}');
        return normalizeOpencodeProviderStore(raw);
    } catch (e) {
        return normalizeOpencodeProviderStore({});
    }
}

function writeOpencodeProviderStore(store) {
    ensureDir(CODEXMATE_OPENCODE_DIR);
    writeJsonAtomic(CODEXMATE_OPENCODE_PROVIDER_STORE_FILE, normalizeOpencodeProviderStore(store));
    try {
        fs.chmodSync(CODEXMATE_OPENCODE_PROVIDER_STORE_FILE, 0o600);
    } catch (e) {}
}

function summarizeOpencodeConfig(config = {}, targetPath = resolveOpencodeConfigFile(), exists = false, providerStore = readOpencodeProviderStore()) {
    const providers = getRecord(config.provider);
    const storedProviders = getRecord(providerStore.providers);
    const agents = getRecord(config.agent);
    const disabledProviders = Array.isArray(config.disabled_providers)
        ? config.disabled_providers.map(item => normalizeOpencodeProviderName(item)).filter(Boolean)
        : [];
    const topLevelModel = splitOpencodeModelRef(config.model);
    const agentEntries = Object.entries(agents)
        .filter(([, agent]) => agent && typeof agent === 'object' && !Array.isArray(agent))
        .map(([name, agent]) => {
            const modelRef = typeof agent.model === 'string' ? agent.model : '';
            const parsedModel = splitOpencodeModelRef(modelRef);
            const requestBody = getRecord(getRecord(agent.request).body);
            return {
                name,
                model: parsedModel.model || modelRef,
                modelRef,
                provider: parsedModel.provider,
                maxTokens: Number.isFinite(Number(requestBody.max_tokens)) ? Number(requestBody.max_tokens) : null,
                reasoningEffort: typeof requestBody.reasoning_effort === 'string' ? requestBody.reasoning_effort : ''
            };
        });
    const preferredAgentName = normalizeOpencodeAgentName(config.default_agent) || 'build';
    const primaryAgent = agentEntries.find(item => item.name === preferredAgentName)
        || agentEntries.find(item => item.name === 'build')
        || agentEntries[0]
        || null;
    const currentProvider = topLevelModel.provider || (primaryAgent && primaryAgent.provider) || '';
    const currentModel = topLevelModel.model || (primaryAgent && primaryAgent.model) || '';
    const providerNames = [...new Set([
        ...Object.keys(storedProviders),
        ...Object.keys(providers),
        currentProvider,
        ...(agentEntries.map(item => item.provider))
    ].map(item => normalizeOpencodeProviderName(item)).filter(Boolean))];
    return {
        exists: !!exists,
        targetPath,
        providerStorePath: CODEXMATE_OPENCODE_PROVIDER_STORE_FILE,
        providers: providerNames.map((name) => {
            const provider = getRecord(providers[name]);
            const storedProvider = getRecord(storedProviders[name]);
            const options = getRecord(provider.options);
            const apiKey = typeof options.apiKey === 'string' && options.apiKey.trim()
                ? options.apiKey
                : (typeof storedProvider.apiKey === 'string' ? storedProvider.apiKey : '');
            return {
                name,
                apiKey: maskKey(apiKey),
                hasKey: apiKey.trim().length > 0,
                disabled: disabledProviders.includes(name) || storedProvider.disabled === true,
                source: Object.prototype.hasOwnProperty.call(providers, name) ? 'opencode' : 'codexmate'
            };
        }),
        agents: agentEntries,
        currentAgent: primaryAgent ? primaryAgent.name : preferredAgentName,
        currentProvider,
        currentModel,
        currentModelRef: joinOpencodeModelRef(currentProvider, currentModel),
        autoCompact: getRecord(config.compaction).auto !== false,
        redacted: true
    };
}

function readOpencodeConfigInfo() {
    const targetPath = resolveOpencodeConfigFile();
    if (!fs.existsSync(targetPath)) {
        const config = { $schema: 'https://opencode.ai/config.json' };
        return {
            ...summarizeOpencodeConfig(config, targetPath, false),
            content: JSON.stringify(config, null, 2) + '\n',
            candidates: getOpencodeConfigCandidates()
        };
    }
    try {
        const raw = fs.readFileSync(targetPath, 'utf-8');
        const config = readOpencodeConfigObject(raw);
        return {
            ...summarizeOpencodeConfig(config, targetPath, true),
            content: raw || '{}',
            candidates: getOpencodeConfigCandidates()
        };
    } catch (e) {
        return {
            error: e.message || '读取 OpenCode 配置失败',
            exists: true,
            targetPath,
            candidates: getOpencodeConfigCandidates()
        };
    }
}

function applyOpencodeConfigRaw(params = {}) {
    assertToolConfigWriteAllowed('opencode');
    const content = typeof params.content === 'string' ? params.content : '';
    if (!content.trim()) {
        return { error: '内容不能为空' };
    }
    if (content.length > 1024 * 1024) {
        return { error: '内容过大（最大 1MB）' };
    }
    let parsed;
    try {
        parsed = readOpencodeConfigObject(content);
    } catch (e) {
        return { error: `OpenCode JSON/JSONC 解析失败: ${e.message}` };
    }
    const targetPath = resolveOpencodeConfigFile();
    try {
        ensureDir(path.dirname(targetPath));
        backupFileIfNeededOnce(targetPath);
        fs.writeFileSync(targetPath, JSON.stringify(parsed, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
        return {
            success: true,
            targetPath,
            content: JSON.stringify(parsed, null, 2) + '\n',
            ...summarizeOpencodeConfig(parsed, targetPath, true)
        };
    } catch (e) {
        return { error: e.message || '写入 OpenCode 配置失败' };
    }
}

function removePreviousCodexMateOpencodeProjection(config, lastApplied, nextProviderName) {
    const previousProvider = normalizeOpencodeProviderName(lastApplied && lastApplied.provider);
    const nextProvider = normalizeOpencodeProviderName(nextProviderName);
    if (!previousProvider || previousProvider === nextProvider) return;

    const providers = getRecord(config.provider);
    if (lastApplied.providerCreatedByCodexMate === true && providers[previousProvider] && lastApplied.providerHash) {
        const currentHash = hashOpencodeManagedValue(providers[previousProvider]);
        if (currentHash === lastApplied.providerHash) {
            delete providers[previousProvider];
        }
    }
    if (Object.keys(providers).length) {
        config.provider = providers;
    } else {
        delete config.provider;
    }

    if (lastApplied.disabledProviderAddedByCodexMate === true && Array.isArray(config.disabled_providers) && lastApplied.disabledProvidersHash) {
        const currentDisabled = config.disabled_providers.map(item => normalizeOpencodeProviderName(item)).filter(Boolean).sort();
        if (hashOpencodeManagedValue(currentDisabled) === lastApplied.disabledProvidersHash) {
            const nextDisabled = currentDisabled.filter(item => item !== previousProvider);
            if (nextDisabled.length) {
                config.disabled_providers = nextDisabled;
            } else {
                delete config.disabled_providers;
            }
        }
    }
}

function updateOpencodeSelection(params = {}) {
    assertToolConfigWriteAllowed('opencode');
    const providerName = normalizeOpencodeProviderName(params.provider);
    const model = typeof params.model === 'string' ? params.model.trim() : '';
    const agentName = normalizeOpencodeAgentName(params.agent || 'build') || 'build';
    if (!providerName) {
        return { error: '请选择 OpenCode provider' };
    }
    if (!model) {
        return { error: '请选择或输入 OpenCode model' };
    }

    const targetPath = resolveOpencodeConfigFile();
    let config = {};
    if (fs.existsSync(targetPath)) {
        try {
            config = readOpencodeConfigObject(fs.readFileSync(targetPath, 'utf-8'));
        } catch (e) {
            return { error: `OpenCode JSON/JSONC 解析失败: ${e.message}` };
        }
    }
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
        config = {};
    }

    const providerStore = readOpencodeProviderStore();
    removePreviousCodexMateOpencodeProjection(config, providerStore.lastApplied, providerName);
    const providerExistedBeforeApply = !!(getRecord(config.provider)[providerName]);
    const disabledContainedBeforeApply = Array.isArray(config.disabled_providers)
        && config.disabled_providers.map(item => normalizeOpencodeProviderName(item)).filter(Boolean).includes(providerName);

    if (!config.$schema) {
        config.$schema = 'https://opencode.ai/config.json';
    }
    const modelRef = joinOpencodeModelRef(providerName, model);
    config.model = modelRef;

    if (!config.provider || typeof config.provider !== 'object' || Array.isArray(config.provider)) {
        config.provider = {};
    }
    const storedProvider = getRecord(providerStore.providers[providerName]);
    const previousProvider = getRecord(config.provider[providerName]);
    const previousOptions = getRecord(previousProvider.options);
    const explicitApiKey = typeof params.apiKey === 'string' ? params.apiKey.trim() : '';
    const storedApiKey = typeof storedProvider.apiKey === 'string' ? storedProvider.apiKey.trim() : '';
    const apiKey = explicitApiKey || storedApiKey;
    config.provider[providerName] = {
        ...previousProvider,
        options: {
            ...previousOptions
        }
    };
    if (apiKey) {
        config.provider[providerName].options.apiKey = apiKey;
    }
    if (Object.keys(config.provider[providerName].options).length === 0) {
        delete config.provider[providerName].options;
    }

    const disabledSet = new Set(Array.isArray(config.disabled_providers)
        ? config.disabled_providers.map(item => normalizeOpencodeProviderName(item)).filter(Boolean)
        : []);
    if (params.disabled === true) {
        disabledSet.add(providerName);
    } else {
        disabledSet.delete(providerName);
    }
    if (disabledSet.size) {
        config.disabled_providers = [...disabledSet].sort();
    } else {
        delete config.disabled_providers;
    }

    if (!config.agent || typeof config.agent !== 'object' || Array.isArray(config.agent)) {
        config.agent = {};
    }
    const coreAgents = params.applyToCoreAgents === true
        ? ['build', 'plan', 'general', 'title', 'summary', 'compaction']
        : [agentName];
    for (const name of coreAgents) {
        const previousAgent = getRecord(config.agent[name]);
        const previousRequest = getRecord(previousAgent.request);
        const previousBody = getRecord(previousRequest.body);
        const nextAgent = {
            ...previousAgent,
            model: modelRef
        };
        const requestBody = { ...previousBody };
        const maxTokens = normalizePositiveIntegerParam(params.maxTokens);
        if (maxTokens !== null) {
            requestBody.max_tokens = maxTokens;
        }
        const effort = typeof params.reasoningEffort === 'string' ? params.reasoningEffort.trim().toLowerCase() : '';
        if (effort === 'low' || effort === 'medium' || effort === 'high') {
            requestBody.reasoning_effort = effort;
        }
        if (Object.keys(requestBody).length) {
            nextAgent.request = {
                ...previousRequest,
                body: requestBody
            };
        }
        config.agent[name] = nextAgent;
    }
    if (!config.default_agent) {
        config.default_agent = agentName;
    }
    if (!config.compaction || typeof config.compaction !== 'object' || Array.isArray(config.compaction)) {
        config.compaction = {};
    }
    config.compaction.auto = params.autoCompact !== false;

    const maxTokens = normalizePositiveIntegerParam(params.maxTokens);
    const effort = typeof params.reasoningEffort === 'string' ? params.reasoningEffort.trim().toLowerCase() : '';
    providerStore.providers[providerName] = {
        ...storedProvider,
        apiKey: apiKey || '',
        model,
        disabled: params.disabled === true,
        maxTokens,
        reasoningEffort: ['low', 'medium', 'high'].includes(effort) ? effort : '',
        updatedAt: new Date().toISOString()
    };

    try {
        ensureDir(path.dirname(targetPath));
        backupFileIfNeededOnce(targetPath);
        const content = JSON.stringify(config, null, 2) + '\n';
        fs.writeFileSync(targetPath, content, { encoding: 'utf-8', mode: 0o600 });
        const disabledProviders = Array.isArray(config.disabled_providers)
            ? config.disabled_providers.map(item => normalizeOpencodeProviderName(item)).filter(Boolean).sort()
            : [];
        providerStore.lastApplied = {
            provider: providerName,
            modelRef,
            providerHash: hashOpencodeManagedValue(getRecord(config.provider)[providerName]),
            disabledProvidersHash: hashOpencodeManagedValue(disabledProviders),
            providerCreatedByCodexMate: providerExistedBeforeApply !== true,
            disabledProviderAddedByCodexMate: params.disabled === true && disabledContainedBeforeApply !== true
        };
        writeOpencodeProviderStore(providerStore);
        return {
            success: true,
            targetPath,
            ...summarizeOpencodeConfig(config, targetPath, true, providerStore),
            content
        };
    } catch (e) {
        return { error: e.message || '写入 OpenCode 配置失败' };
    }
}
// API: 打包 Claude 配置目录（系统 zip 可用则使用，否则回退 zip-lib）
async function prepareClaudeDirDownload() {
    return await prepareDirectoryDownload(CLAUDE_DIR, {
        missingMessage: 'Claude 配置目录不存在',
        fileNamePrefix: 'claude-config'
    });
}

// API: 打包 Codex 配置目录（同策略）
async function prepareCodexDirDownload() {
    return await prepareDirectoryDownload(CONFIG_DIR, {
        missingMessage: 'Codex 配置目录不存在',
        fileNamePrefix: CODEX_BACKUP_NAME
    });
}

async function restoreClaudeDir(payload) {
    return await restoreConfigDirectoryFromUpload(payload, {
        targetDir: CLAUDE_DIR,
        requiredFileName: 'settings.json',
        markerDirName: '.claude',
        tempPrefix: 'claude-restore',
        backupPrefix: 'claude-config'
    });
}

async function restoreCodexDir(payload) {
    return await restoreConfigDirectoryFromUpload(payload, {
        targetDir: CONFIG_DIR,
        requiredFileName: 'config.toml',
        markerDirName: '.codex',
        tempPrefix: 'codex-restore',
        backupPrefix: 'codex-config'
    });
}

// CLI: 一行写入 Claude Code 配置
function parseClaudeCommandArgs(argv = []) {
    const positionals = [];
    let targetApi = 'responses';
    for (let i = 0; i < argv.length; i += 1) {
        const token = String(argv[i] ?? '');
        if (token === '--target-api' || token === '--targetApi') {
            const nextValue = String(argv[i + 1] ?? '');
            if (!nextValue || nextValue.startsWith('--')) {
                throw new Error('错误: --target-api 需要一个值（responses、chat_completions 或 ollama）');
            }
            targetApi = normalizeClaudeTargetApi(nextValue);
            i += 1;
            continue;
        }
        positionals.push(token);
    }

    const baseUrl = positionals[0];
    if (targetApi === 'ollama' && positionals.length === 2) {
        return {
            baseUrl,
            apiKey: '',
            model: positionals[1],
            targetApi
        };
    }
    return {
        baseUrl,
        apiKey: positionals[1],
        model: positionals[2],
        targetApi
    };
}

async function cmdClaude(args = []) {
    const argv = Array.isArray(args) ? args : [];
    // 无参数 → 代理启动
    if (argv.length === 0 || (argv.length === 1 && argv[0] === undefined)) {
        return runProxyCommand('Claude', 'claude', [], '', { autoFlag: '--dangerously-skip-permissions' });
    }
    // 有参数 → 配置写入
    const { baseUrl, apiKey, model, targetApi } = parseClaudeCommandArgs(argv);
    const normalizedBaseUrl = typeof baseUrl === 'string' ? baseUrl.trim() : '';
    const normalizedKey = typeof apiKey === 'string' ? apiKey.trim() : '';
    const normalizedModel = typeof model === 'string' && model.trim()
        ? model.trim()
        : DEFAULT_CLAUDE_MODEL;

    const silent = false;

    if (!normalizedBaseUrl || (!normalizedKey && targetApi !== 'ollama')) {
        if (!silent) {
            console.error('用法: codexmate claude <BaseURL> <API密钥> [模型] [--target-api responses|chat_completions|ollama]');
            console.log('\n示例:');
            console.log('  codexmate claude https://open.bigmodel.cn/api/anthropic sk-ant-xxx glm-4.7');
            console.log("  codexmate claude http://127.0.0.1:11434 '' llama3.1:8b --target-api ollama");
        }
        throw new Error(targetApi === 'ollama' ? 'BaseURL 必填' : 'BaseURL 和 API 密钥必填');
    }

    const result = await applyToClaudeSettings({
        baseUrl: normalizedBaseUrl,
        apiKey: normalizedKey,
        model: normalizedModel,
        targetApi
    });

    if (!result || result.success === false) {
        const message = (result && result.error) || '应用 Claude 配置失败';
        if (!silent) console.error('错误:', message);
        throw new Error(message);
    }

    if (!silent) {
        console.log('✓ 已写入 Claude Code 配置');
        console.log('  Base URL:', normalizedBaseUrl);
        console.log('  模型:', normalizedModel);
        if (result.targetPath) {
            console.log('  目标文件:', result.targetPath);
        }
        if (result.backupPath) {
            console.log('  已自动备份:', result.backupPath);
        }
        console.log();
    }

    return 0;
}

function commandExists(command, args = '') {
    const cmd = typeof command === 'string' ? command.trim() : '';
    const argText = typeof args === 'string' ? args.trim() : '';
    if (!cmd || cmd.includes('\0') || /[\r\n]/.test(cmd)) {
        return false;
    }
    const argv = argText ? argText.split(/\s+/g).filter(Boolean) : [];
    const hasSeparators = cmd.includes('/') || cmd.includes('\\');
    const useShell = process.platform === 'win32' && !hasSeparators;
    if (useShell) {
        if (!/^[A-Za-z0-9._-]+$/.test(cmd)) return false;
        if (argText && /[\r\n;&|<>`$]/.test(argText)) return false;
    }
    try {
        const probe = spawnSync(cmd, argv, {
            stdio: 'ignore',
            windowsHide: true,
            timeout: 5000,
            shell: useShell
        });
        return probe.status === 0;
    } catch (_) {
        return false;
    }
}

function isPrivateNetworkHost(hostname) {
    const host = typeof hostname === 'string' ? hostname.trim().toLowerCase() : '';
    if (!host) return true;
    if (host === 'localhost') return true;
    const ipVer = net.isIP(host);
    if (!ipVer) {
        return false;
    }
    if (ipVer === 4) {
        const parts = host.split('.').map((x) => parseInt(x, 10));
        if (parts.length !== 4 || parts.some((x) => !Number.isFinite(x))) return true;
        const [a, b] = parts;
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 169 && b === 254) return true;
        if (a === 192 && b === 168) return true;
        if (a === 172 && b >= 16 && b <= 31) return true;
        return false;
    }
    if (ipVer === 6) {
        if (host === '::1') return true;
        if (host.startsWith('fe80:')) return true;
        if (host.startsWith('fc') || host.startsWith('fd')) return true;
        return false;
    }
    return false;
}

function detectPreferredPackageManager() {
    const userAgent = typeof process.env.npm_config_user_agent === 'string'
        ? process.env.npm_config_user_agent.trim().toLowerCase()
        : '';
    if (userAgent.startsWith('pnpm/')) return 'pnpm';
    if (userAgent.startsWith('bun/')) return 'bun';
    if (userAgent.startsWith('npm/')) return 'npm';

    if (commandExists('pnpm', '--version')) return 'pnpm';
    if (commandExists('bun', '--version')) return 'bun';
    return 'npm';
}

function resolveCommandPath(command) {
    if (!command) return '';
    const locator = process.platform === 'win32' ? 'where' : 'which';
    try {
        const probe = spawnSync(locator, [command], {
            encoding: 'utf8',
            windowsHide: true,
            timeout: 2500
        });
        if (probe.error || probe.status !== 0) {
            return '';
        }
        const lines = String(probe.stdout || '')
            .split(/\r?\n/g)
            .map((line) => line.trim())
            .filter(Boolean);
        return lines[0] || '';
    } catch (e) {
        return '';
    }
}

function resolveSpawnCommand(command) {
    if (!command) return '';
    if (process.platform === 'win32') {
        return command;
    }
    return resolveCommandPath(command) || command;
}

function parseBinaryVersionOutput(text) {
    const raw = typeof text === 'string' ? text : '';
    const line = raw
        .split(/\r?\n/g)
        .map((item) => item.trim())
        .find(Boolean) || '';
    if (!line) return '';
    return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

function probeCliBinary(binName) {
    const attempts = [['--version'], ['-v'], ['version']];
    let lastError = '';

    for (const args of attempts) {
        try {
            let output = '';
            let status = 0;
            if (process.platform === 'win32') {
                const argString = args.join(' ').trim();
                const commandLine = argString ? `${binName} ${argString}` : binName;
                const stdout = execSync(commandLine, {
                    encoding: 'utf8',
                    windowsHide: true,
                    timeout: 5000,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    shell: true
                });
                output = String(stdout || '');
            } else {
                const cmd = resolveSpawnCommand(binName);
                const probe = spawnSync(cmd, args, {
                    encoding: 'utf8',
                    windowsHide: true,
                    timeout: 5000,
                    stdio: ['ignore', 'pipe', 'pipe']
                });
                status = Number.isFinite(probe.status) ? probe.status : (probe.error ? 1 : 0);
                output = `${probe.stdout || ''}\n${probe.stderr || ''}`.trim();
            }
            const version = parseBinaryVersionOutput(output);
            return {
                installed: true,
                bin: binName,
                version: version || 'unknown',
                path: resolveCommandPath(binName),
                error: ''
            };
        } catch (error) {
            const err = error || {};
            const stdout = typeof err.stdout === 'string' ? err.stdout : String(err.stdout || '');
            const stderr = typeof err.stderr === 'string' ? err.stderr : String(err.stderr || '');
            const output = `${stdout}\n${stderr}`.trim();
            const version = parseBinaryVersionOutput(output);
            const status = Number.isFinite(err.status) ? err.status : null;
            if (version && status === 0) {
                return {
                    installed: true,
                    bin: binName,
                    version,
                    path: resolveCommandPath(binName),
                    error: ''
                };
            }
            if (version) {
                lastError = status !== null
                    ? `${binName} exited with ${status}: ${version}`
                    : `${binName} failed: ${version}`;
                continue;
            }
            const message = err && err.message ? String(err.message) : '';
            if (message && !/ENOENT/i.test(message)) {
                lastError = message;
            }
        }
    }

    return {
        installed: false,
        bin: binName,
        version: '',
        path: '',
        error: lastError
    };
}

function resolveInstallCommandsByPackageManager(packageManager) {
    const normalized = String(packageManager || '').trim().toLowerCase();
    const manager = normalized === 'pnpm' || normalized === 'bun' || normalized === 'npm'
        ? normalized
        : 'npm';
    const commandsByTarget = {};

    for (const target of CLI_INSTALL_TARGETS) {
        const pkg = target.packageName;
        if (manager === 'pnpm') {
            commandsByTarget[target.id] = {
                install: `pnpm add -g ${pkg}`,
                update: `pnpm up -g ${pkg}`,
                uninstall: `pnpm remove -g ${pkg}`
            };
            continue;
        }
        if (manager === 'bun') {
            commandsByTarget[target.id] = {
                install: `bun add -g ${pkg}`,
                update: `bun update -g ${pkg}`,
                uninstall: `bun remove -g ${pkg}`
            };
            continue;
        }
        commandsByTarget[target.id] = {
            install: `npm install -g ${pkg}`,
            update: `npm update -g ${pkg}`,
            uninstall: `npm uninstall -g ${pkg}`
        };
    }

    return {
        packageManager: manager,
        commandsByTarget
    };
}

function buildInstallStatusReport() {
    const packageManager = detectPreferredPackageManager();
    const targetReports = CLI_INSTALL_TARGETS.map((target) => {
        let hit = null;
        let lastError = '';
        for (const binName of target.bins) {
            const probe = probeCliBinary(binName);
            if (probe.installed) {
                hit = probe;
                break;
            }
            if (probe.error) {
                lastError = probe.error;
            }
        }
        return {
            id: target.id,
            name: target.name,
            packageName: target.packageName,
            installed: !!(hit && hit.installed),
            bin: hit ? hit.bin : (target.bins[0] || ''),
            version: hit ? hit.version : '',
            commandPath: hit ? hit.path : '',
            error: hit ? '' : lastError
        };
    });

    const commandSpec = resolveInstallCommandsByPackageManager(packageManager);
    return {
        platform: process.platform,
        packageManager: commandSpec.packageManager,
        targets: targetReports,
        commandsByTarget: commandSpec.commandsByTarget
    };
}


function resolveExportOutputPath(outputPath, defaultFileName) {
    const fallback = path.resolve(process.cwd(), defaultFileName);
    if (typeof outputPath !== 'string' || !outputPath.trim()) {
        return fallback;
    }

    const trimmed = outputPath.trim();
    const resolved = path.resolve(trimmed);
    const hasTrailingSep = /[\\\/]$/.test(trimmed);
    if (hasTrailingSep) {
        ensureDir(resolved);
        return path.join(resolved, defaultFileName);
    }

    if (fs.existsSync(resolved)) {
        try {
            const stat = fs.statSync(resolved);
            if (stat.isDirectory()) {
                return path.join(resolved, defaultFileName);
            }
        } catch (e) { }
    }

    return resolved;
}

function printExportSessionUsage() {
    console.log('\n用法: codexmate export-session --source <codex|claude|gemini|codebuddy|pi> (--session-id <ID>|--file <PATH>) [--output <PATH>] [--max-messages <N|all|Infinity>]');
    console.log('\n示例:');
    console.log('  codexmate export-session --source codex --session-id 123456');
    console.log('  codexmate export-session --source claude --file "~/.claude/projects/demo/session.jsonl"');
    console.log('  codexmate export-session --source codebuddy --file "~/.codebuddy/projects/demo/session.jsonl"');
    console.log('  codexmate export-session --source codex --session-id 123456 --max-messages=all');
}

function parseExportSessionArgs(args = []) {
    const options = {
        source: '',
        sessionId: '',
        filePath: '',
        output: '',
        maxMessages: undefined
    };
    const errors = [];

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg) continue;

        if (arg.startsWith('--source=')) {
            options.source = arg.slice('--source='.length);
            continue;
        }
        if (arg === '--source') {
            options.source = args[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg.startsWith('--session-id=')) {
            options.sessionId = arg.slice('--session-id='.length);
            continue;
        }
        if (arg === '--session-id') {
            options.sessionId = args[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg.startsWith('--file=')) {
            options.filePath = arg.slice('--file='.length);
            continue;
        }
        if (arg === '--file') {
            options.filePath = args[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg.startsWith('--output=')) {
            options.output = arg.slice('--output='.length);
            continue;
        }
        if (arg === '--output') {
            options.output = args[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg.startsWith('--max-messages=')) {
            options.maxMessages = arg.slice('--max-messages='.length);
            continue;
        }
        if (arg === '--max-messages') {
            options.maxMessages = args[i + 1] || '';
            i += 1;
            continue;
        }

        errors.push(`未知参数: ${arg}`);
    }

    const normalizedSource = options.source.trim().toLowerCase();
    if (normalizedSource && normalizedSource !== 'codex' && normalizedSource !== 'claude' && normalizedSource !== 'pi') {
        errors.push('参数 --source 仅支持 codex、claude 或 pi');
    }
    options.source = normalizedSource;

    if (!options.source) {
        errors.push('缺少 --source');
    }

    if (!options.sessionId && !options.filePath) {
        errors.push('必须指定 --session-id 或 --file');
    }

    if (options.maxMessages !== undefined) {
        const parsed = parseMaxMessagesValue(options.maxMessages);
        if (parsed === null) {
            errors.push('参数 --max-messages 无效');
        } else {
            options.maxMessages = parsed === Infinity ? Infinity : Math.max(1, Math.floor(parsed));
        }
    }

    return {
        options,
        error: errors.length > 0 ? errors.join('；') : ''
    };
}

async function cmdExportSession(args = []) {
    const parsed = parseExportSessionArgs(args);
    if (parsed.error) {
        console.error('错误:', parsed.error);
        printExportSessionUsage();
        process.exit(1);
    }

    const options = parsed.options;
    const maxMessages = resolveMaxMessagesValue(options.maxMessages, MAX_EXPORT_MESSAGES);
    let result;
    try {
        result = await exportSessionData({
            source: options.source,
            sessionId: options.sessionId,
            filePath: options.filePath,
            maxMessages
        });
    } catch (e) {
        console.error('导出失败:', e.message || e);
        process.exit(1);
    }

    if (result && result.error) {
        console.error('导出失败:', result.error);
        process.exit(1);
    }

    const defaultFileName = (result && result.fileName)
        ? result.fileName
        : `${options.source}-session-${options.sessionId || Date.now()}.md`;
    const outputPath = resolveExportOutputPath(options.output, defaultFileName);
    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, (result && result.content) ? result.content : '', 'utf-8');

    console.log('\n✓ 会话已导出:', outputPath);
    if (result && result.truncated) {
        const label = maxMessages === Infinity ? 'all' : maxMessages;
        console.log(`! 已截断: 仅导出前 ${label} 条消息`);
        console.log('  可使用 --max-messages=all 导出完整内容');
    }
    console.log();
}

function printAnalyticsUsage() {
    console.log('\n用法:');
    console.log('  codexmate analytics export [--format csv|json] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--model <MODEL>] [--source <codex|claude|gemini|codebuddy|pi|all>] [--output <PATH|->] [-o <PATH|->]');
    console.log('');
}

async function cmdAnalytics(args = []) {
    const subcommand = args[0];
    if (subcommand !== 'export') {
        printAnalyticsUsage();
        process.exit(subcommand ? 1 : 0);
    }
    const parsed = parseAnalyticsExportArgs(args.slice(1));
    if (parsed.options.help) {
        printAnalyticsUsage();
        process.exit(0);
    }
    if (parsed.error) {
        console.error('错误:', parsed.error);
        printAnalyticsUsage();
        process.exit(1);
    }

    const result = await exportSessionUsage(parsed.options);
    if (result && result.error) {
        console.error('导出失败:', result.error);
        process.exit(1);
    }
    const output = parsed.options.output || (result && result.fileName) || `usage-export.${parsed.options.format}`;
    if (output === '-') {
        process.stdout.write(result && result.content ? result.content : '');
        return;
    }
    const outputPath = path.resolve(process.cwd(), output);
    ensureDir(path.dirname(outputPath));
    fs.writeFileSync(outputPath, result && result.content ? result.content : '', 'utf-8');
    console.log(`\n✓ Usage 已导出: ${outputPath}`);
    console.log(`  格式: ${result.format}; rows: ${Array.isArray(result.rows) ? result.rows.length : 0}`);
    console.log();
}

function parseStartOptions(args = []) {
    const options = { host: '', noBrowser: false };
    if (!Array.isArray(args)) {
        return options;
    }

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (!arg) continue;
        if (arg === '--no-browser') {
            options.noBrowser = true;
            continue;
        }
        if (arg.startsWith('--host=')) {
            options.host = arg.slice('--host='.length);
            continue;
        }
        if (arg === '--host') {
            options.host = args[i + 1] || '';
            i += 1;
        }
    }

    return options;
}

function isAnyAddressHost(host) {
    return host === '0.0.0.0' || host === '::';
}

function formatHostForUrl(host) {
    const value = typeof host === 'string' ? host.trim() : '';
    if (!value) return '';
    if (value.startsWith('[') && value.endsWith(']')) {
        return value;
    }
    if (value.includes(':')) {
        return `[${value}]`;
    }
    return value;
}

// #region watchPathsForRestart
function watchPathsForRestart(targets, onChange) {
    const debounceMs = 300;
    let timer = null;
    const watcherEntries = new Map();
    const getPathApi = (targetPath) => {
        const value = typeof targetPath === 'string' ? targetPath.trim() : '';
        return value.includes('/') && !value.includes('\\') && path.posix ? path.posix : path;
    };
    const getPathSeparator = (targetPath) => {
        const pathApi = getPathApi(targetPath);
        return pathApi.sep || (pathApi === path.posix ? '/' : path.sep);
    };

    const trigger = (info) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            onChange(info);
        }, debounceMs);
    };

    const closeWatcher = (watchKey) => {
        const entry = watcherEntries.get(watchKey);
        if (!entry) return;
        watcherEntries.delete(watchKey);
        try {
            entry.watcher.close();
        } catch (_) { }
    };

    const listDirectoryTree = (rootDir) => {
        const queue = [rootDir];
        const directories = [];
        const seen = new Set();
        const pathApi = getPathApi(rootDir);
        while (queue.length) {
            const current = queue.shift();
            if (!current || seen.has(current) || !fs.existsSync(current)) {
                continue;
            }
            seen.add(current);
            let stat = null;
            try {
                stat = fs.statSync(current);
            } catch (_) {
                continue;
            }
            if (!stat || !stat.isDirectory()) {
                continue;
            }
            directories.push(current);
            let entries = [];
            try {
                entries = fs.readdirSync(current, { withFileTypes: true });
            } catch (_) {
                continue;
            }
            for (const entry of entries) {
                if (entry && typeof entry.isDirectory === 'function' && entry.isDirectory()) {
                    queue.push(pathApi.join(current, entry.name));
                }
            }
        }
        return directories;
    };

    const isSameOrNestedPath = (candidate, rootDir) => {
        const separator = getPathSeparator(rootDir);
        return candidate === rootDir || candidate.startsWith(`${rootDir}${separator}`);
    };

    const addWatcher = (target, recursive, isDirectory = false) => {
        if (!fs.existsSync(target)) return;
        const watchKey = `${recursive ? 'recursive' : 'plain'}:${target}`;
        if (watcherEntries.has(watchKey)) {
            return true;
        }
        try {
            const pathApi = getPathApi(target);
            const basename = isDirectory ? '' : pathApi.basename(target);
            const watchTarget = isDirectory ? target : pathApi.dirname(target);
            const watcher = fs.watch(watchTarget, { recursive }, (eventType, filename) => {
                if (isDirectory && !recursive && eventType === 'rename') {
                    syncDirectoryTree(target);
                }
                if (!filename) return;
                let normalizedFilename = String(filename).replace(/\\/g, '/');
                if (!isDirectory) {
                    const fileNameOnly = normalizedFilename.split('/').pop();
                    if (fileNameOnly !== basename) {
                        return;
                    }
                    normalizedFilename = basename;
                }
                const lower = normalizedFilename.toLowerCase();
                if (!(/\.(html|js|mjs|cjs|css)$/.test(lower))) return;
                trigger({ target, eventType, filename: normalizedFilename });
            });
            watcher.on('error', () => {
                closeWatcher(watchKey);
                if (isDirectory && recursive && !fs.existsSync(target)) {
                    syncDirectoryTree(target);
                    addMissingDirectoryWatcher(target);
                    return;
                }
                if (isDirectory && !recursive) {
                    syncDirectoryTree(target);
                } else if (fs.existsSync(target)) {
                    addWatcher(target, recursive, isDirectory);
                }
            });
            watcherEntries.set(watchKey, {
                watcher,
                target,
                recursive,
                isDirectory
            });
            return true;
        } catch (e) {
            return false;
        }
    };

    const addMissingDirectoryWatcher = (target) => {
        const pathApi = getPathApi(target);
        const parentDir = pathApi.dirname(target);
        if (!parentDir || parentDir === target || !fs.existsSync(parentDir)) {
            return false;
        }
        const watchKey = `missing-dir:${target}`;
        if (watcherEntries.has(watchKey)) {
            return true;
        }
        const basename = path.basename(target);
        try {
            const watcher = fs.watch(parentDir, { recursive: false }, (_eventType, filename) => {
                if (!filename) return;
                const fileNameOnly = String(filename).replace(/\\/g, '/').split('/').pop();
                if (fileNameOnly !== basename) {
                    return;
                }
                if (!fs.existsSync(target)) {
                    syncDirectoryTree(target);
                    return;
                }
                closeWatcher(watchKey);
                const ok = addWatcher(target, true, true);
                if (!ok) {
                    syncDirectoryTree(target);
                }
            });
            watcher.on('error', () => {
                closeWatcher(watchKey);
                if (fs.existsSync(parentDir) && !fs.existsSync(target)) {
                    addMissingDirectoryWatcher(target);
                }
            });
            watcherEntries.set(watchKey, {
                watcher,
                target: parentDir,
                recursive: false,
                isDirectory: false
            });
            return true;
        } catch (_) {
            return false;
        }
    };

    const syncDirectoryTree = (rootDir) => {
        const directories = listDirectoryTree(rootDir);
        const existingDirectorySet = new Set(directories);
        for (const [watchKey, entry] of Array.from(watcherEntries.entries())) {
            if (!entry.isDirectory || entry.recursive) {
                continue;
            }
            if (!isSameOrNestedPath(entry.target, rootDir)) {
                continue;
            }
            if (!existingDirectorySet.has(entry.target)) {
                closeWatcher(watchKey);
            }
        }
        for (const directory of directories) {
            addWatcher(directory, false, true);
        }
    };

    for (const target of targets) {
        if (!fs.existsSync(target)) continue;
        let stat = null;
        try {
            stat = fs.statSync(target);
        } catch (_) {
            continue;
        }
        if (stat && stat.isDirectory()) {
            const ok = addWatcher(target, true, true);
            if (!ok) {
                syncDirectoryTree(target);
            }
            continue;
        }
        const ok = addWatcher(target, true, false);
        if (!ok) {
            addWatcher(target, false, false);
        }
    }

    return () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
        for (const watchKey of Array.from(watcherEntries.keys())) {
            closeWatcher(watchKey);
        }
    };
}
// #endregion watchPathsForRestart

function writeJsonResponse(res, statusCode, payload, headers = {}) {
    const body = JSON.stringify(payload, null, 2);
    res.writeHead(statusCode, {
        ...headers,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body, 'utf-8')
    });
    res.end(body, 'utf-8');
}

function readJsonRequestBody(req, res, options = {}) {
    const maxBytes = Number.isFinite(options.maxBytes) ? Math.max(1024, Math.floor(options.maxBytes)) : MAX_API_BODY_SIZE;
    return new Promise((resolve) => {
        const chunks = [];
        let bodySize = 0;
        let bodyTooLarge = false;
        req.on('data', (chunk) => {
            if (bodyTooLarge) return;
            bodySize += chunk.length;
            if (bodySize > maxBytes) {
                bodyTooLarge = true;
                writeJsonResponse(res, 413, {
                    error: `请求体过大（>${Math.floor(maxBytes / 1024 / 1024)}MB）`
                });
                req.destroy();
                resolve({ ok: false, error: 'payload-too-large' });
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (bodyTooLarge) return;
            const rawBuffer = chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
            const rawText = rawBuffer.length ? rawBuffer.toString('utf-8') : '';
            try {
                resolve({ ok: true, body: JSON.parse(rawText || '{}'), rawText, rawBuffer });
            } catch (error) {
                resolve({ ok: false, error: error && error.message ? error.message : 'invalid json' });
            }
        });
    });
}

function isLoopbackRemoteAddress(value) {
    const addr = typeof value === 'string' ? value.trim() : '';
    if (!addr) return false;
    if (addr === '127.0.0.1' || addr === '::1') return true;
    if (addr === '::ffff:127.0.0.1') return true;
    return false;
}

function extractRequestToken(req) {
    const headers = req && req.headers && typeof req.headers === 'object' ? req.headers : {};
    const rawAuth = typeof headers.authorization === 'string' ? headers.authorization.trim() : '';
    if (rawAuth) {
        const bearerMatch = rawAuth.match(/^bearer\s+(.+)$/i);
        if (bearerMatch && bearerMatch[1]) return bearerMatch[1].trim();
        const basicMatch = rawAuth.match(/^basic\s+(.+)$/i);
        if (basicMatch && basicMatch[1]) {
            try {
                const decoded = Buffer.from(basicMatch[1].trim(), 'base64').toString('utf-8');
                const separatorIndex = decoded.indexOf(':');
                if (separatorIndex >= 0) {
                    const password = decoded.slice(separatorIndex + 1).trim();
                    if (password) return password;
                }
                if (decoded.trim()) return decoded.trim();
            } catch (_) { }
        }
        return rawAuth;
    }
    const raw = typeof headers['x-codexmate-token'] === 'string' ? headers['x-codexmate-token'].trim() : '';
    return raw;
}

function readServerToken() {
    const raw = typeof process.env.CODEXMATE_HTTP_TOKEN === 'string' ? process.env.CODEXMATE_HTTP_TOKEN.trim() : '';
    return raw;
}

function assertRequestAuthorized(req, res) {
    const remoteAddr = req && req.socket ? req.socket.remoteAddress : '';
    if (isLoopbackRemoteAddress(remoteAddr)) {
        return { ok: true, mode: 'loopback' };
    }
    const expected = readServerToken();
    if (!expected) {
        writeJsonResponse(res, 403, {
            error: 'Remote access is disabled (set CODEXMATE_HTTP_TOKEN or use --host 127.0.0.1)'
        });
        return { ok: false, mode: 'missing-token' };
    }
    const actual = extractRequestToken(req);
    if (!actual || !safeTimingEqual(actual, expected)) {
        writeJsonResponse(res, 401, { error: 'Unauthorized' }, {
            'WWW-Authenticate': 'Basic realm="codexmate"'
        });
        return { ok: false, mode: 'unauthorized' };
    }
    return { ok: true, mode: 'token' };
}

function isProtectedWebSurfacePath(requestPath) {
    return requestPath === '/'
        || requestPath === '/session'
        || requestPath === '/web-ui/index.html'
        || requestPath.startsWith('/web-ui/')
        || requestPath.startsWith('/res/');
}

const g_webhookDeliveryCache = new Map();

function pruneWebhookDeliveryCache() {
    const now = Date.now();
    for (const [key, expiresAt] of g_webhookDeliveryCache.entries()) {
        if (now >= expiresAt) {
            g_webhookDeliveryCache.delete(key);
        }
    }
}

function rememberWebhookDeliveryId(value, ttlMs = 10 * 60 * 1000) {
    const id = typeof value === 'string' ? value.trim() : '';
    if (!id) return { ok: true, seen: false };
    pruneWebhookDeliveryCache();
    if (g_webhookDeliveryCache.has(id)) {
        return { ok: true, seen: true };
    }
    g_webhookDeliveryCache.set(id, Date.now() + ttlMs);
    while (g_webhookDeliveryCache.size > 2000) {
        const firstKey = g_webhookDeliveryCache.keys().next().value;
        if (!firstKey) break;
        g_webhookDeliveryCache.delete(firstKey);
    }
    return { ok: true, seen: false };
}

function safeTimingEqual(a, b) {
    try {
        const ba = Buffer.isBuffer(a) ? a : Buffer.from(String(a || ''), 'utf-8');
        const bb = Buffer.isBuffer(b) ? b : Buffer.from(String(b || ''), 'utf-8');
        if (ba.length !== bb.length) return false;
        return crypto.timingSafeEqual(ba, bb);
    } catch (_) {
        return false;
    }
}

function verifyGithubWebhookSignature(secret, signatureHeader, rawBuffer) {
    const key = typeof secret === 'string' ? secret : '';
    const signature = typeof signatureHeader === 'string' ? signatureHeader.trim() : '';
    if (!key || !signature || !signature.startsWith('sha256=')) return false;
    const expected = 'sha256=' + crypto.createHmac('sha256', key).update(rawBuffer || Buffer.alloc(0)).digest('hex');
    return safeTimingEqual(signature, expected);
}

function streamZipDownloadResponse(res, filePath, options = {}) {
    if (!filePath || !fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('File Not Found');
        return;
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not a File');
        return;
    }
    const downloadName = typeof options.fileName === 'string' && options.fileName.trim()
        ? options.fileName.trim()
        : path.basename(filePath);
    const deleteAfterDownload = !!options.deleteAfterDownload;
    const onAfterComplete = typeof options.onAfterComplete === 'function'
        ? options.onAfterComplete
        : null;
    res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${path.basename(downloadName)}"`,
        'Content-Length': stat.size
    });

    const stream = fs.createReadStream(filePath);
    let finished = false;
    const finalize = () => {
        if (finished) return;
        finished = true;
        if (deleteAfterDownload && fs.existsSync(filePath)) {
            try {
                fs.unlinkSync(filePath);
            } catch (_) { }
        }
        if (onAfterComplete) {
            try {
                onAfterComplete();
            } catch (_) { }
        }
    };
    stream.on('error', () => {
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Download Error');
        } else {
            try {
                res.destroy();
            } catch (_) { }
        }
        finalize();
    });
    res.on('finish', finalize);
    res.on('close', finalize);
    stream.pipe(res);
}

function resolveUploadFileNameFromRequest(req, fallbackName = 'codex-skills.zip') {
    const rawHeader = req.headers['x-codexmate-file-name'];
    const source = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const fallback = typeof fallbackName === 'string' && fallbackName.trim()
        ? fallbackName.trim()
        : 'codex-skills.zip';
    if (!source || typeof source !== 'string') {
        return fallback;
    }
    const decoded = (() => {
        try {
            return decodeURIComponent(source);
        } catch (_) {
            return source;
        }
    })();
    const normalized = path.basename(decoded.trim());
    return normalized || fallback;
}

function resolveSkillTargetAppFromRequest(req, fallbackApp = 'codex') {
    const fallbackTarget = resolveSkillTarget({}, fallbackApp);
    const fallback = fallbackTarget ? fallbackTarget.app : 'codex';
    try {
        const parsed = new URL(req.url || '/', 'http://localhost');
        const hasTargetApp = parsed.searchParams.has('targetApp');
        const hasTarget = parsed.searchParams.has('target');
        if (hasTargetApp || hasTarget) {
            const target = resolveSkillTarget({
                ...(hasTargetApp ? { targetApp: parsed.searchParams.get('targetApp') } : {}),
                ...(hasTarget ? { target: parsed.searchParams.get('target') } : {})
            }, fallback);
            return target ? target.app : null;
        }
        return fallback;
    } catch (_) {
        return fallback;
    }
}

async function handleImportSkillsZipUpload(req, res, options = {}) {
    if (req.method !== 'POST') {
        if (req && typeof req.resume === 'function') {
            req.resume();
        }
        writeJsonResponse(res, 405, { error: 'Method Not Allowed' });
        return;
    }
    try {
        const forcedTargetApp = normalizeSkillTargetApp(options && options.targetApp ? options.targetApp : '');
        const targetApp = forcedTargetApp || resolveSkillTargetAppFromRequest(req, 'codex');
        if (!targetApp) {
            if (req && typeof req.resume === 'function') {
                req.resume();
            }
            writeJsonResponse(res, 400, { error: '目标宿主不支持' });
            return;
        }
        const fileName = resolveUploadFileNameFromRequest(req, `${targetApp}-skills.zip`);
        const upload = await writeUploadZipStream(
            req,
            'codex-skills-import',
            fileName,
            MAX_SKILLS_ZIP_UPLOAD_SIZE
        );
        const result = await importSkillsFromZipFile(upload.zipPath, {
            tempDir: upload.tempDir,
            fallbackName: fileName,
            targetApp
        });
        writeJsonResponse(res, 200, result || {});
    } catch (e) {
        const message = e && e.message ? e.message : '上传失败';
        writeJsonResponse(res, 400, { error: message });
    }
}

const PUBLIC_WEB_UI_DYNAMIC_ASSETS = new Map([
    ['app.js', {
        mime: 'application/javascript; charset=utf-8',
        reader: readExecutableBundledWebUiScript
    }],
    ['index.html', {
        mime: 'text/html; charset=utf-8',
        reader: readBundledWebUiHtml
    }],
    ['logic.mjs', {
        mime: 'application/javascript; charset=utf-8',
        reader: readExecutableBundledJavaScriptModule
    }],
    ['styles.css', {
        mime: 'text/css; charset=utf-8',
        reader: readBundledWebUiCss
    }]
]);

const PUBLIC_WEB_UI_STATIC_ASSETS = new Set([
    'modules/config-mode.computed.mjs',
    'modules/skills.computed.mjs',
    'modules/skills.methods.mjs',
    'session-helpers.mjs'
]);

function createWebServer({ htmlPath, assetsDir, webDir, host, port, openBrowser }) {
    const connections = new Set();
    const probeWebUiReadiness = (callback) => {
        const payload = JSON.stringify({ action: 'health-check', params: {} });
        const requestOptions = {
            hostname: openHost,
            port,
            path: '/api',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(payload, 'utf-8')
            }
        };
        let settled = false;
        const finish = (ready) => {
            if (settled) return;
            settled = true;
            callback(ready);
        };
        const req = http.request(requestOptions, (probeRes) => {
            if (typeof probeRes.resume === 'function') {
                probeRes.resume();
            }
            probeRes.on('end', () => {
                finish(probeRes.statusCode === 200);
            });
        });
        req.on('error', () => finish(false));
        req.setTimeout(1000, () => {
            try { req.destroy(); } catch (_) { }
            finish(false);
        });
        req.end(payload, 'utf-8');
    };
    const probeWebUiAssetReadiness = (callback) => {
        const requestOptions = {
            hostname: openHost,
            port,
            path: '/web-ui/app.js',
            method: 'GET'
        };
        let settled = false;
        const finish = (ready) => {
            if (settled) return;
            settled = true;
            callback(ready);
        };
        const req = http.request(requestOptions, (probeRes) => {
            if (typeof probeRes.resume === 'function') {
                probeRes.resume();
            }
            probeRes.on('end', () => {
                finish(probeRes.statusCode === 200);
            });
        });
        req.on('error', () => finish(false));
        req.setTimeout(1000, () => {
            try { req.destroy(); } catch (_) { }
            finish(false);
        });
        req.end();
    };
    const openBrowserAfterReady = (url) => {
        // Some environments may start the listener before the bundled web-ui assets
        // are ready for the first browser hit; wait until both API and assets respond.
        const maxAttempts = 120;
        const retryDelayMs = 200;
        let finished = false;

        const finish = (ready) => {
            if (finished) return;
            finished = true;
            if (!ready) {
                console.warn('! Web UI 就绪探测超时，未自动打开浏览器，请手动访问:', url);
                return;
            }

            const platform = process.platform;
            const commandSpec = platform === 'win32'
                ? { command: 'cmd', args: ['/c', 'start', '', url] }
                : (platform === 'darwin'
                    ? { command: 'open', args: [url] }
                    : { command: 'xdg-open', args: [url] });

            try {
                const child = spawn(commandSpec.command, commandSpec.args, {
                    stdio: 'ignore',
                    detached: true,
                    windowsHide: true
                });
                child.on('error', () => {
                    console.warn('无法自动打开浏览器，请手动访问:', url);
                });
                if (typeof child.unref === 'function') {
                    child.unref();
                }
            } catch (_) {
                console.warn('无法自动打开浏览器，请手动访问:', url);
            }
        };
        const scheduleProbe = (attempt) => {
            probeWebUiReadiness((apiReady) => {
                if (!apiReady) {
                    if (attempt >= maxAttempts) {
                        finish(false);
                        return;
                    }
                    setTimeout(() => scheduleProbe(attempt + 1), retryDelayMs);
                    return;
                }
                probeWebUiAssetReadiness((assetReady) => {
                    if (assetReady) {
                        finish(true);
                        return;
                    }
                    if (attempt >= maxAttempts) {
                        finish(false);
                        return;
                    }
                    setTimeout(() => scheduleProbe(attempt + 1), retryDelayMs);
                });
            });
        };

        scheduleProbe(1);
    };
    const writeWebUiAssetError = (res, requestPath, error) => {
        const message = error && error.message ? error.message : String(error);
        console.error(`! Web UI 资源读取失败 [${requestPath}]:`, message);
        if (res.headersSent) {
            try {
                res.destroy(error);
            } catch (_) { }
            return;
        }
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
    };

    const rateLimitMap = new Map();
    const RATE_LIMIT_WINDOW_MS = 60000;
    const RATE_LIMIT_MAX = 120;
    function checkRateLimit(key) {
        const now = Date.now();
        const entry = rateLimitMap.get(key);
        if (!entry || now - entry.start > RATE_LIMIT_WINDOW_MS) {
            rateLimitMap.set(key, { start: now, count: 1 });
            return true;
        }
        entry.count++;
        if (entry.count > RATE_LIMIT_MAX) return false;
        return true;
    }
    setInterval(function () {
        const now = Date.now();
        for (const [key, entry] of rateLimitMap.entries()) {
            if (now - entry.start > RATE_LIMIT_WINDOW_MS * 2) rateLimitMap.delete(key);
        }
    }, RATE_LIMIT_WINDOW_MS).unref();

    const server = http.createServer((req, res) => {
        const securityHeaders = {
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:"
        };
        const origWriteHead = res.writeHead.bind(res);
        res.writeHead = function (statusCode, headers) {
            const merged = Object.assign({}, securityHeaders, headers || {});
            return origWriteHead(statusCode, merged);
        };
        const requestPath = (req.url || '/').split('?')[0];
        const sendJson = (statusCode, payload) => {
            const body = JSON.stringify(payload || {}, null, 2);
            res.writeHead(statusCode, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(body, 'utf-8')
            });
            res.end(body, 'utf-8');
        };
        if (typeof localBridgeHandler === 'function' && localBridgeHandler(req, res)) {
            return;
        }
        if (typeof openaiBridgeHandler === 'function' && openaiBridgeHandler(req, res)) {
            return;
        }
        if (isProtectedWebSurfacePath(requestPath)) {
            const remoteAddr = req && req.socket ? req.socket.remoteAddress : '';
            const isLoopback = !remoteAddr || isLoopbackRemoteAddress(remoteAddr);
            if (!isLoopback) {
                const rateLimitKey = (remoteAddr || 'unknown') + ':' + requestPath;
                if (!checkRateLimit(rateLimitKey)) {
                    writeJsonResponse(res, 429, { error: 'Rate limit exceeded' }, { 'Retry-After': '60' });
                    return;
                }
                const auth = assertRequestAuthorized(req, res);
                if (!auth.ok) {
                    return;
                }
            }
        }
        if (
            requestPath === '/api'
            || requestPath.startsWith('/api/import-')
            || requestPath.startsWith('/download/')
        ) {
            const remoteAddr = req && req.socket ? req.socket.remoteAddress : '';
            const isLoopback = !remoteAddr || isLoopbackRemoteAddress(remoteAddr);
            if (!isLoopback) {
                const rateLimitKey = (remoteAddr || 'unknown') + ':' + requestPath;
                if (!checkRateLimit(rateLimitKey)) {
                    writeJsonResponse(res, 429, { error: 'Rate limit exceeded' }, { 'Retry-After': '60' });
                    return;
                }
                const auth = assertRequestAuthorized(req, res);
                if (!auth.ok) {
                    return;
                }
            }
        }
        if (requestPath === '/api/import-skills-zip') {
            void handleImportSkillsZipUpload(req, res);
            return;
        }
        if (requestPath === '/api/import-codex-skills-zip') {
            void handleImportSkillsZipUpload(req, res, { targetApp: 'codex' });
            return;
        }
        if (requestPath === '/api') {
            const method = (req.method ? String(req.method) : 'POST').toUpperCase();
            if (method !== 'POST') {
                sendJson(405, { error: 'Method Not Allowed' });
                return;
            }
            let body = '';
            let bodySize = 0;
            let bodyTooLarge = false;
            req.on('data', chunk => {
                if (bodyTooLarge) return;
                bodySize += chunk.length;
                if (bodySize > MAX_API_BODY_SIZE) {
                    bodyTooLarge = true;
                    sendJson(413, {
                        error: `请求体过大（>${Math.floor(MAX_API_BODY_SIZE / 1024 / 1024)}MB）`
                    });
                    req.destroy();
                    return;
                }
                body += chunk;
            });
            req.on('end', async () => {
                if (bodyTooLarge) return;
                let leaveToolConfigWriteGuard = null;
                try {
                    const { action, params } = JSON.parse(body || '{}');
                    leaveToolConfigWriteGuard = typeof enterToolConfigWriteGuard === 'function'
                        ? enterToolConfigWriteGuard()
                        : () => {};
                    let result;

                    const guardedToolConfigTarget = getApiToolConfigWriteTarget(action);
                    if (guardedToolConfigTarget && !isToolConfigWriteAllowed(guardedToolConfigTarget)) {
                        result = buildToolConfigWriteDeniedPayload(guardedToolConfigTarget);
                    } else {
                        switch (action) {
                        case 'health-check':
                            result = { ok: true };
                            break;
                        case 'get-tool-config-permissions':
                            result = { permissions: readToolConfigPermissions() };
                            break;
                        case 'get-web-ui-preferences':
                            result = { preferences: readWebUiPreferences() };
                            break;
                        case 'set-web-ui-preferences':
                            result = setWebUiPreferences(params || {});
                            break;
                        case 'set-tool-config-permission':
                            result = setToolConfigPermission(params || {});
                            break;
                        case 'status': {
                            const statusConfigResult = readConfigOrVirtualDefault();
                            const config = statusConfigResult.config;
                            const serviceTier = typeof config.service_tier === 'string' ? config.service_tier.trim() : '';
                            const modelReasoningEffort = typeof config.model_reasoning_effort === 'string' ? config.model_reasoning_effort.trim() : '';
                            const budgetReadOptions = {
                                useDefaultsWhenMissing: !hasConfigLoadError(statusConfigResult)
                            };
                            const modelContextWindow = readPositiveIntegerConfigValue(
                                config,
                                'model_context_window',
                                budgetReadOptions
                            );
                            const modelAutoCompactTokenLimit = readPositiveIntegerConfigValue(
                                config,
                                'model_auto_compact_token_limit',
                                budgetReadOptions
                            );
                            const pkgVersion = (() => {
                                try {
                                    const pkg = require('./package.json');
                                    return pkg && pkg.version ? pkg.version : '';
                                } catch (_) {
                                    return '';
                                }
                            })();
                            result = {
                                version: pkgVersion,
                                provider: config.model_provider || '未设置',
                                model: config.model || '未设置',
                                currentModels: readCurrentModels(),
                                serviceTier,
                                modelReasoningEffort,
                                modelContextWindow,
                                modelAutoCompactTokenLimit,
                                configReady: !statusConfigResult.isVirtual,
                                configErrorType: statusConfigResult.errorType || '',
                                configNotice: statusConfigResult.reason || '',
                                initNotice: consumeInitNotice(),
                                toolConfigPermissions: readToolConfigPermissions()
                            };
                            break;
                        }
                        case 'read-pi-models': {
                            result = readPiModels(params || {});
                            break;
                        }
                        case 'write-pi-models': {
                            result = writePiModels(params || {});
                            break;
                        }
                        case 'read-pi-settings': {
                            result = readPiSettings(params || {});
                            break;
                        }
                        case 'write-pi-settings': {
                            result = writePiSettings(params || {});
                            break;
                        }
                        case 'apply-pi-config-history': {
                            result = applyPiConfigHistory(params || {});
                            break;
                        }
                        case 'fetch-pi-remote-models': {
                            result = await fetchPiRemoteModels(params || {});
                            break;
                        }
                        case 'pi-models-catalog': {
                            result = await fetchPiModelsCatalog(params || {});
                            break;
                        }
                        case 'install-status':
                            result = buildInstallStatusReport();
                            break;
                        case 'version-status': {
                            const currentVersion = (() => {
                                try {
                                    const pkg = require('./package.json');
                                    return pkg && pkg.version ? pkg.version : '';
                                } catch (_) {
                                    return '';
                                }
                            })();
                            try {
                                const force = !!(params && params.force);
                                result = await fetchLatestVersionStatus({ currentVersion, timeoutMs: 2000, cacheTtlMs: force ? 0 : undefined });
                            } catch (e) {
                                result = {
                                    currentVersion,
                                    latestVersion: '',
                                    updateAvailable: false,
                                    source: 'npm',
                                    checkedAt: new Date().toISOString(),
                                    cached: false,
                                    error: e && e.message ? e.message : '获取最新版本失败'
                                };
                            }
                            break;
                        }
                        case 'list':
                            result = buildMcpProviderListPayload();
                            break;
                        case 'models':
                            {
                                const providerName = params && typeof params.provider === 'string' ? params.provider : '';
                                if (!providerName) {
                                    result = { error: 'Provider name is required' };
                                } else {
                                    const res = await fetchProviderModels(providerName);
                                    if (res.error) {
                                        result = { error: res.error, models: [], source: 'remote' };
                                    } else if (res.unlimited) {
                                        result = { models: [], source: 'remote', provider: res.provider || '', unlimited: true };
                                    } else {
                                        result = { models: res.models || [], source: 'remote', provider: res.provider || '' };
                                    }
                                }
                            }
                            break;
                        case 'models-by-url':
                            {
                                const baseUrl = params && typeof params.baseUrl === 'string' ? params.baseUrl : '';
                                const apiKey = params && typeof params.apiKey === 'string' ? params.apiKey : '';
                                if (!baseUrl) {
                                    result = { error: 'Base URL is required' };
                                } else {
                                    const remoteAddr = req && req.socket ? req.socket.remoteAddress : '';
                                    const requesterIsLoopback = !remoteAddr
                                        || remoteAddr === '127.0.0.1'
                                        || remoteAddr === '::1'
                                        || remoteAddr === '::ffff:127.0.0.1';
                                    if (!requesterIsLoopback) {
                                        try {
                                            const parsedUrl = new URL(baseUrl);
                                            if (isPrivateNetworkHost(parsedUrl.hostname || '')) {
                                                result = { error: 'Refusing to access private network baseUrl from non-loopback request' };
                                                break;
                                            }
                                        } catch (_) { }
                                    }
                                    const res = await fetchModelsFromBaseUrl(baseUrl, apiKey);
                                    if (res.error) {
                                        result = { error: res.error, models: [], source: 'remote' };
                                    } else if (res.unlimited) {
                                        result = { models: [], source: 'remote', unlimited: true };
                                    } else {
                                        result = { models: res.models || [], source: 'remote' };
                                    }
                                }
                            }
                            break;
                        case 'get-config-template':
                            result = getConfigTemplate(params || {});
                            break;
                        case 'apply-config-template':
                            result = applyConfigTemplate(params || {});
                            break;
                        case 'preview-config-template-diff':
                            result = buildConfigTemplateDiff(params || {});
                            break;
                        case 'add-provider':
                            result = addProviderToConfig({ ...(params || {}), requireModel: true });
                            break;
                        case 'update-provider':
                            result = updateProviderInConfig(params || {});
                            break;
                        case 'get-provider-key':
                            result = getProviderKey(params || {});
                            break;
                        case 'get-provider-cache-records':
                            result = readProviderCacheRecords();
                            break;
                        case 'get-claude-provider-cache-configs':
                            result = readClaudeProviderCacheConfigs();
                            break;
                        case 'sync-provider-cache-records':
                            result = syncProviderCacheRecords();
                            break;
                        case 'delete-provider-cache-record':
                            result = deleteProviderCacheRecord(params || {});
                            break;
                        case 'delete-provider':
                            result = deleteProviderFromConfig(params || {});
                            break;
                        case 'get-recent-configs':
                            result = { items: readRecentConfigs() };
                            break;
                        case 'config-health-check':
                            result = await buildConfigHealthReport(params || {});
                            break;
                        case 'providers-health':
                            result = await buildAllProvidersHealthReport(params || {});
                            break;
                        case 'doctor':
                            {
                                const doctorParams = isPlainObject(params) ? params : {};
                                const report = await buildDoctorReport(doctorParams, {
                                    getStatusPayload: buildMcpStatusPayload,
                                    buildInstallStatusReport,
                                    buildConfigHealthReport,
                                    listSessionUsage,
                                    listSkills
                                });
                                result = buildDoctorLegacyPayload(report);
                                result.markdown = renderDoctorMarkdown(report);
                            }
                            break;
                        case 'get-agents-file':
                            result = readAgentsFile(params || {});
                            break;
                        case 'apply-agents-file':
                            result = applyAgentsFile(params || {});
                            break;
                        case 'get-claude-md-file':
                            result = readClaudeMdFile(params || {});
                            break;
                        case 'apply-claude-md-file':
                            result = applyClaudeMdFile(params || {});
                            if (result && !result.error) {
                                const mdBaseDir = params && params.baseDir ? String(params.baseDir).trim() : '';
                                const mdTarget = mdBaseDir
                                    ? path.join(mdBaseDir, 'CLAUDE.md')
                                    : ((params && params.targetPath) ? String(params.targetPath) : 'CLAUDE.md');
                                notifyWebhook('claude-md-edit', 'CLAUDE.md modified: ' + mdTarget, { targetPath: mdTarget, projectPath: mdBaseDir }).catch(function () { });
                            }
                            break;
                        case 'detect-project-claude-md':
                            result = detectProjectClaudeMdDir((params && params.baseDir) || '');
                            break;
                        case 'preview-agents-diff':
                            result = buildAgentsDiff(params || {});
                            break;
                        case 'list-skills':
                            result = listSkills(params || {});
                            break;
                        case 'delete-skills':
                            result = deleteSkills(params || {});
                            break;
                        case 'scan-unmanaged-skills':
                            result = scanUnmanagedSkills(params || {});
                            break;
                        case 'import-skills':
                            result = importSkills(params || {});
                            break;
                        case 'export-skills':
                            result = await exportSkills(params || {});
                            break;
                        case 'list-codex-skills':
                            result = listCodexSkills();
                            break;
                        case 'delete-codex-skills':
                            result = deleteCodexSkills(params || {});
                            break;
                        case 'scan-unmanaged-codex-skills':
                            result = scanUnmanagedCodexSkills();
                            break;
                        case 'import-codex-skills':
                            result = importCodexSkills(params || {});
                            break;
                        case 'export-codex-skills':
                            result = await exportCodexSkills(params || {});
                            break;
                        case 'get-openclaw-config':
                            result = readOpenclawConfigFile();
                            break;
                        case 'apply-openclaw-config':
                            result = applyOpenclawConfig(params || {});
                            break;
                        case 'reset-config':
                            result = resetConfigToDefault();
                            break;
                        case 'get-openclaw-agents-file':
                            result = readOpenclawAgentsFile();
                            break;
                        case 'apply-openclaw-agents-file':
                            result = applyOpenclawAgentsFile(params || {});
                            break;
                        case 'get-openclaw-workspace-file':
                            result = readOpenclawWorkspaceFile(params || {});
                            break;
                        case 'apply-openclaw-workspace-file':
                            result = applyOpenclawWorkspaceFile(params || {});
                            break;
                        case 'get-system-prompt':
                            result = readSystemPromptFile(params || {});
                            break;
                        case 'apply-system-prompt':
                            result = saveSystemPromptFile(params || {});
                            break;
                        case 'preview-system-prompt-diff':
                            result = buildSystemPromptDiff(params || {});
                            break;
                        case 'list-prompt-history':
                            result = listPromptHistory((params && params.bucket) || '');
                            break;
                        case 'get-prompt-history':
                            result = readPromptHistory((params && params.bucket) || '', (params && params.id) || '');
                            break;
                        case 'switch':
                        case 'use':
                        case 'add':
                        case 'delete':
                        case 'update':
                            result = { error: 'Codex 配置改动已切换为模板确认模式，请使用模板编辑器并手动确认应用。' };
                            break;
                        case 'add-model':
                            cmdAddModel(params.model, true);
                            result = { success: true };
                            break;
                        case 'delete-model':
                            cmdDeleteModel(params.model, true);
                            result = { success: true };
                            break;
                        case 'get-claude-settings':
                            result = readClaudeSettingsInfo();
                            break;
                        case 'get-claude-settings-raw':
                            result = readClaudeSettingsRaw();
                            break;
                        case 'preview-claude-settings-diff':
                            result = buildClaudeSettingsDiff(params || {});
                            break;
                        case 'apply-claude-settings-raw':
                            result = applyClaudeSettingsRaw(params || {});
                            break;
                        case 'get-opencode-config':
                            result = readOpencodeConfigInfo();
                            break;
                        case 'get-kilocode-config':
                            result = readKilocodeConfigInfo();
                            break;
                        case 'apply-opencode-config':
                            result = applyOpencodeConfigRaw(params || {});
                            break;
                        case 'update-opencode-selection':
                            result = updateOpencodeSelection(params || {});
                            break;
                        case 'apply-kilocode-config':
                            result = applyKilocodeConfig(params || {});
                            break;
                        case 'start-kilocode':
                            result = startKilocodeFromWeb(params || {});
                            break;
                        case 'apply-claude-config':
                            result = await applyToClaudeSettings(params.config);
                            if (result && !result.error) {
                                const cfgName = (params && params.config && typeof params.config.name === 'string') ? params.config.name : '';
                                const cfgFrom = (params && typeof params.previousName === 'string') ? params.previousName : '';
                                const summary = cfgFrom
                                    ? ('Provider switched: ' + cfgFrom + ' -> ' + cfgName)
                                    : ('Provider applied: ' + cfgName);
                                notifyWebhook('provider-switch', summary, { name: cfgName, previousName: cfgFrom }).catch(function () { });
                            }
                            break;
                        case 'get-webhook-config':
                            result = loadWebhookConfig();
                            break;
                        case 'set-webhook-config':
                            result = saveWebhookConfig(params && params.config ? params.config : {});
                            break;
                        case 'test-webhook': {
                            const overrideCfg = params && params.config ? params.config : null;
                            const probe = await notifyWebhook(
                                'provider-switch',
                                'codexmate webhook test ping',
                                { test: true },
                                overrideCfg ? { config: overrideCfg } : {}
                            );
                            result = probe;
                            break;
                        }
                        case 'export-claude-share':
                            result = buildClaudeSharePayload(params && params.config ? params.config : {});
                            break;
                        case 'export-provider':
                            result = buildProviderSharePayload(params || {});
                            break;
                        case 'export-config':
                            result = {
                                data: buildExportPayload(!!params.includeKeys)
                            };
                            break;
                        case 'import-config':
                            result = importConfigData(params.payload, params.options || {});
                            break;
                        case 'speed-test': {
                            const target = resolveSpeedTestTarget(params);
                            if (target.error) {
                                result = { error: target.error };
                                break;
                            }
                            const timeoutMs = Number.isFinite(params && params.timeoutMs)
                                ? Math.max(1000, Number(params.timeoutMs))
                                : 0;
                            if (Array.isArray(target.candidates) && target.candidates.length > 0) {
                                let finalCandidate = target.candidates[0];
                                let finalResult = null;
                                for (let index = 0; index < target.candidates.length; index += 1) {
                                    const candidate = target.candidates[index];
                                    const probeResult = await runSpeedTest(candidate.url, target.apiKey, {
                                        ...candidate,
                                        apiKeyHeader: target.apiKeyHeader,
                                        headers: target.headers,
                                        timeoutMs: timeoutMs || undefined
                                    });
                                    finalCandidate = candidate;
                                    finalResult = probeResult;
                                    const status = Number.isFinite(probeResult && probeResult.status) ? probeResult.status : 0;
                                    const shouldTryNext = index < target.candidates.length - 1 && status === 404;
                                    if (!shouldTryNext) {
                                        break;
                                    }
                                }
                                result = {
                                    ok: !!(finalResult && finalResult.ok),
                                    status: Number.isFinite(finalResult && finalResult.status) ? finalResult.status : 0,
                                    durationMs: Number.isFinite(finalResult && finalResult.durationMs) ? finalResult.durationMs : 0,
                                    error: finalResult && finalResult.ok ? '' : (finalResult && finalResult.error ? finalResult.error : ''),
                                    url: finalCandidate && finalCandidate.url ? finalCandidate.url : ''
                                };
                                break;
                            }
                            result = await runSpeedTest(target.url, target.apiKey, {
                                ...target,
                                timeoutMs: timeoutMs || undefined
                            });
                            break;
                        }
                        case 'openai-bridge-get-provider': {
                            const name = params && typeof params.name === 'string' ? params.name.trim() : '';
                            if (!name) {
                                result = { error: 'provider name is required' };
                                break;
                            }
                            const upstream = resolveOpenaiBridgeUpstream(OPENAI_BRIDGE_SETTINGS_FILE, name);
                            if (upstream.error) {
                                result = { error: upstream.error };
                                break;
                            }
                            // 不返回 apiKey（敏感信息），仅返回用户填过的上游 URL
                            const config = readConfig();
                            const provider = config.model_providers && config.model_providers[name];
                            const providerMaxRetries = resolveProviderOpenaiBridgeMaxRetries(provider);
                            result = { baseUrl: upstream.baseUrl, hasApiKey: !!(upstream.apiKey), maxRetries: providerMaxRetries };
                            break;
                        }
                        case 'list-sessions':
                            {
                                const source = typeof params.source === 'string' ? params.source.trim().toLowerCase() : '';
                                if (source && source !== 'codex' && source !== 'claude' && source !== 'gemini' && source !== 'codebuddy' && source !== 'pi' && source !== 'all') {
                                    result = { error: 'Invalid source. Must be codex, claude, gemini, codebuddy, pi, or all' };
                                } else {
                                    result = {
                                        sessions: await listSessionBrowse(params),
                                        source: source || 'all'
                                    };
                                }
                            }
                            break;
                        case 'list-sessions-usage':
                            {
                                const usageParams = isPlainObject(params) ? params : {};
                                const source = typeof usageParams.source === 'string' ? usageParams.source.trim().toLowerCase() : '';
                                if (source && source !== 'codex' && source !== 'claude' && source !== 'gemini' && source !== 'codebuddy' && source !== 'pi' && source !== 'all') {
                                    result = { error: 'Invalid source. Must be codex, claude, gemini, codebuddy, pi, or all' };
                                } else {
                                    result = {
                                        sessions: await listSessionUsage({
                                            ...usageParams,
                                            source: source || 'all'
                                        }),
                                        source: source || 'all'
                                    };
                                }
                            }
                            break;
                        case 'export-sessions-usage':
                            {
                                const usageParams = isPlainObject(params) ? params : {};
                                const source = typeof usageParams.source === 'string' ? usageParams.source.trim().toLowerCase() : '';
                                if (source && source !== 'codex' && source !== 'claude' && source !== 'gemini' && source !== 'codebuddy' && source !== 'pi' && source !== 'all') {
                                    result = { error: 'Invalid source. Must be codex, claude, gemini, codebuddy, pi, or all' };
                                } else {
                                    result = await exportSessionUsage({
                                        ...usageParams,
                                        source: source || 'all'
                                    });
                                }
                            }
                            break;
                        case 'list-session-paths':
                            {
                                const source = typeof params.source === 'string' ? params.source.trim().toLowerCase() : '';
                                if (source && source !== 'codex' && source !== 'claude' && source !== 'gemini' && source !== 'codebuddy' && source !== 'pi' && source !== 'all') {
                                    result = { error: 'Invalid source. Must be codex, claude, gemini, codebuddy, pi, or all' };
                                } else {
                                    result = {
                                        paths: listSessionPaths(params)
                                    };
                                }
                            }
                            break;
                        case 'list-session-trash':
                            result = await listSessionTrashItems(params || {});
                            break;
                        case 'restore-session-trash':
                            result = await restoreSessionTrashItem(params || {});
                            break;
                        case 'purge-session-trash':
                            result = await purgeSessionTrashItems(params || {});
                            break;
                        case 'trash-session':
                            result = await trashSessionData(params || {});
                            break;
                        case 'export-session':
                            result = await exportSessionData(params);
                            break;
                        case 'convert-session':
                            result = await convertSessionToDerived(params || {});
                            break;
                        case 'import-derived-session':
                            result = await importDerivedSessionToNative(params || {});
                            break;
                        case 'delete-session':
                            result = await deleteSessionData(params || {});
                            break;
                        case 'clone-session':
                            result = await cloneCodexSession(params || {});
                            break;
                        case 'session-message-counts':
                            result = await readSessionMessageCounts(params || {});
                            break;
                        case 'session-detail':
                            result = await readSessionDetail(params);
                            break;
                        case 'session-plain':
                            result = await readSessionPlain(params);
                            break;
                        case 'download-claude-dir':
                            result = await prepareClaudeDirDownload();
                            break;
                        case 'download-codex-dir':
                            result = await prepareCodexDirDownload();
                            break;
                        case 'restore-claude-dir':
                            result = await restoreClaudeDir(params || {});
                            break;
                        case 'restore-codex-dir':
                            result = await restoreCodexDir(params || {});
                            break;
                        case 'list-auth-profiles':
                            result = {
                                profiles: listAuthProfilesInfo()
                            };
                            break;
                        case 'import-auth-profile':
                            result = importAuthProfileFromUpload(params || {});
                            break;
                        case 'switch-auth-profile':
                            {
                                const profileName = params && typeof params.name === 'string' ? params.name.trim() : '';
                                if (!profileName) {
                                    result = { error: '认证名称不能为空' };
                                } else {
                                    try {
                                        result = switchAuthProfile(profileName, { silent: true });
                                    } catch (e) {
                                        result = { error: e.message || '切换认证失败' };
                                    }
                                }
                            }
                            break;
                        case 'delete-auth-profile':
                            result = deleteAuthProfile(params && params.name ? params.name : '');
                            break;
                        case 'proxy-status':
                            result = getBuiltinProxyStatus();
                            break;
                        case 'proxy-save-config':
                            result = saveBuiltinProxySettings(params || {});
                            break;
                        case 'proxy-start':
                            result = await startBuiltinProxyRuntime(params || {});
                            break;
                        case 'proxy-stop':
                            result = await stopBuiltinProxyRuntime();
                            break;
                        case 'claude-proxy-status':
                            result = getBuiltinClaudeProxyStatus();
                            break;
                        case 'claude-proxy-start':
                            result = await startBuiltinClaudeProxyRuntime(params || {});
                            break;
                        case 'claude-proxy-stop':
                            result = await stopBuiltinClaudeProxyRuntime();
                            break;
                        case 'proxy-enable-codex-default':
                            result = await ensureBuiltinProxyForCodexDefault(params || {});
                            break;
                        case 'proxy-apply-provider':
                            result = applyBuiltinProxyProvider(params || {});
                            break;
                        case 'local-bridge-toggle':
                            result = toggleLocalBridgeProvider(params || {});
                            break;
                        case 'local-bridge-status':
                            result = getLocalBridgeStatus();
                            break;
                        case 'local-bridge-set-excluded':
                            result = setLocalBridgeExcludedProviders(params || {});
                            break;
                        case 'local-bridge-get-excluded':
                            result = getLocalBridgeExcludedProviders();
                            break;
                        case 'claude-local-bridge-toggle':
                            result = toggleClaudeLocalBridge(params || {});
                            break;
                        case 'claude-local-bridge-status':
                            result = getClaudeLocalBridgeStatus();
                            break;
                        case 'claude-local-bridge-set-excluded':
                            result = setClaudeLocalBridgeExcludedProviders(params || {});
                            break;
                        case 'claude-local-bridge-get-excluded':
                            result = getClaudeLocalBridgeExcludedProviders();
                            break;
                        case 'claude-local-bridge-sync-providers':
                            result = syncClaudeBridgeProviders(params || {});
                            break;
                        case 'workflow-list':
                            result = listWorkflowDefinitions();
                            break;
                        case 'workflow-get':
                            {
                                const id = params && typeof params.id === 'string' ? params.id.trim() : '';
                                if (!id) {
                                    result = { error: 'workflow id is required' };
                                } else {
                                    result = getWorkflowDefinitionById(id);
                                }
                            }
                            break;
                        case 'workflow-validate':
                            {
                                const id = params && typeof params.id === 'string' ? params.id.trim() : '';
                                if (!id) {
                                    result = { ok: false, error: 'workflow id is required' };
                                    break;
                                }
                                const input = params && params.input && typeof params.input === 'object' && !Array.isArray(params.input)
                                    ? params.input
                                    : {};
                                result = validateWorkflowById(id, input);
                            }
                            break;
                        case 'workflow-run':
                            {
                                const id = params && typeof params.id === 'string' ? params.id.trim() : '';
                                if (!id) {
                                    result = { error: 'workflow id is required' };
                                    break;
                                }
                                const input = params && params.input && typeof params.input === 'object' && !Array.isArray(params.input)
                                    ? params.input
                                    : {};
                                result = await runWorkflowById(id, input, {
                                    allowWrite: !!(params && params.allowWrite),
                                    dryRun: !!(params && params.dryRun)
                                });
                            }
                            break;
                        case 'workflow-runs':
                            {
                                const rawLimit = params && Number.isFinite(params.limit) ? params.limit : parseInt(params && params.limit, 10);
                                const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.floor(rawLimit)) : 20;
                                result = {
                                    runs: listWorkflowRunRecords(limit),
                                    limit
                                };
                            }
                            break;
                        default:
                            result = { error: '未知操作' };
                        }
                    }

                    const responseBody = JSON.stringify(result, null, 2);
                    res.writeHead(200, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Content-Length': Buffer.byteLength(responseBody, 'utf-8')
                    });
                    res.end(responseBody, 'utf-8');
                    if (leaveToolConfigWriteGuard) leaveToolConfigWriteGuard();
                } catch (e) {
                    if (leaveToolConfigWriteGuard) leaveToolConfigWriteGuard();
                    const errorBody = JSON.stringify({ error: e.message }, null, 2);
                    res.writeHead(500, {
                        'Content-Type': 'application/json; charset=utf-8',
                        'Content-Length': Buffer.byteLength(errorBody, 'utf-8')
                    });
                    res.end(errorBody, 'utf-8');
                }
            });
        } else if (requestPath === '/web-ui/index.html') {
            const rawUrl = typeof req.url === 'string' ? req.url : '';
            const queryIndex = rawUrl.indexOf('?');
            const query = queryIndex >= 0 ? rawUrl.slice(queryIndex) : '';
            res.writeHead(302, {
                'Location': `/${query}`,
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-store, max-age=0'
            });
            res.end('Found');
        } else if (requestPath.startsWith('/web-ui/')) {
            // Skip the /web-ui/ directory itself, which is handled above
            const normalized = path.normalize(requestPath).replace(/^([\\.\\/])+/, '');
            const filePath = path.join(__dirname, normalized);
            if (!isPathInside(filePath, webDir)) {
                res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Forbidden');
                return;
            }
            const relativePath = path.relative(webDir, filePath).replace(/\\/g, '/');

            // Empty relativePath means direct /web-ui/ access - return 404
            if (relativePath === '' || relativePath === 'index.html') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not Found');
                return;
            }

            const dynamicAsset = PUBLIC_WEB_UI_DYNAMIC_ASSETS.get(relativePath);
            if (dynamicAsset) {
                try {
                    const assetBody = dynamicAsset.reader(filePath);
                    res.writeHead(200, {
                        'Content-Type': dynamicAsset.mime,
                        'Cache-Control': 'no-store, max-age=0'
                    });
                    res.end(assetBody, 'utf-8');
                } catch (error) {
                    writeWebUiAssetError(res, requestPath, error);
                }
                return;
            }
            if (!PUBLIC_WEB_UI_STATIC_ASSETS.has(relativePath)) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not Found');
                return;
            }
            if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not Found');
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            const mime = ext === '.js' || ext === '.mjs'
                ? 'application/javascript; charset=utf-8'
                : ext === '.html'
                    ? 'text/html; charset=utf-8'
                    : ext === '.css'
                        ? 'text/css; charset=utf-8'
                        : ext === '.json'
                            ? 'application/json; charset=utf-8'
                            : 'application/octet-stream';
            res.writeHead(200, {
                'Content-Type': mime,
                'Cache-Control': 'no-store, max-age=0'
            });
            fs.createReadStream(filePath).pipe(res);
        } else if (requestPath.startsWith('/download/')) {
            const fileName = requestPath.slice('/download/'.length);
            let decodedFileName = '';
            try {
                decodedFileName = decodeURIComponent(fileName);
            } catch (_) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Bad Request');
                return;
            }

            const artifact = resolveDownloadArtifact(decodedFileName, { consume: true });
            if (artifact) {
                streamZipDownloadResponse(res, artifact.filePath, {
                    fileName: artifact.fileName,
                    deleteAfterDownload: artifact.deleteAfterDownload !== false
                });
                return;
            }
            const allowLegacy = process.env.CODEXMATE_ALLOW_LEGACY_DOWNLOAD === '1';
            const remoteAddr = req && req.socket ? req.socket.remoteAddress : '';
            const isLoopback = !remoteAddr || remoteAddr === '127.0.0.1' || remoteAddr === '::1' || remoteAddr === '::ffff:127.0.0.1';
            if (!allowLegacy || !isLoopback) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not Found');
                return;
            }
            const tempDir = os.tmpdir();
            const legacyFilePath = path.join(tempDir, decodedFileName);
            if (!isPathInside(legacyFilePath, tempDir)) {
                res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Forbidden');
                return;
            }
            streamZipDownloadResponse(res, legacyFilePath, {
                fileName: path.basename(legacyFilePath),
                deleteAfterDownload: false
            });
        } else if (requestPath.startsWith('/res/')) {
            const normalized = path.normalize(requestPath.slice('/res/'.length)).replace(/^([\\.\\/])+/, '');
            const filePath = path.join(assetsDir, normalized);
            if (!isPathInside(filePath, assetsDir)) {
                res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Forbidden');
                return;
            }
            if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not Found');
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            const mime = ext === '.js'
                ? 'application/javascript; charset=utf-8'
                : ext === '.html'
                    ? 'text/html; charset=utf-8'
                    : ext === '.json'
                        ? 'application/json; charset=utf-8'
                        : 'application/octet-stream';
            res.writeHead(200, {
                'Content-Type': mime,
                'Cache-Control': 'no-store, max-age=0'
            });
            fs.createReadStream(filePath).pipe(res);
        } else {
            // Serve the SPA shell for routable entry points. Keep /web-ui as 404.
            if (requestPath === '/' || requestPath === '/session') {
                try {
                    const html = readBundledWebUiHtml(htmlPath);
                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Cache-Control': 'no-store, max-age=0'
                    });
                    res.end(html);
                } catch (error) {
                    writeWebUiAssetError(res, requestPath, error);
                }
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not Found');
            }
        }
    });

    server.on('connection', (socket) => {
        connections.add(socket);
        socket.on('close', () => connections.delete(socket));
    });

    const printPortOverrideHint = () => {
        const examplePort = port === 8080 ? 8081 : 8080;
        console.error(`  临时换端口（macOS/Linux）: CODEXMATE_PORT=${examplePort} codexmate run`);
        console.error(`  临时换端口（Windows PowerShell）: $env:CODEXMATE_PORT=${examplePort}; codexmate run`);
        console.error(`  临时换端口（Windows CMD）: set CODEXMATE_PORT=${examplePort} && codexmate run`);
    };

    server.once('error', (err) => {
        if (err && err.code === 'EADDRINUSE') {
            console.error(`! 启动失败: 端口 ${port} 已被占用，可能有残留的 codexmate run 实例。`);
            console.error('  请先停止旧实例或更换端口后重试。');
            printPortOverrideHint();
        } else if (err && err.code === 'EACCES') {
            console.error(`! 启动失败: 没有权限监听 ${host}:${port}。`);
            console.error('  请检查系统/安全软件限制，或更换端口后重试。');
            printPortOverrideHint();
        } else {
            console.error('! 启动 Web UI 失败:', err && err.message ? err.message : err);
        }
        process.exit(1);
    });

    const openHost = host === '::'
        ? '::1'
        : (host === '0.0.0.0' ? DEFAULT_WEB_OPEN_HOST : host);
    const openUrl = `http://${formatHostForUrl(openHost)}:${port}`;
    server.listen(port, host, () => {
        console.log('\n✓ Web UI 已启动');
        const willOpenBrowser = !!openBrowser && !process.env.CODEXMATE_NO_BROWSER;
        console.log(`  ${willOpenBrowser ? '已打开' : '待访问'}: ${openUrl}`);
        if (host && host !== openHost) {
            console.log('  监听地址:', host);
        }
        console.log('  退出: Ctrl+C\n');
        if (isAnyAddressHost(host)) {
            const tokenEnabled = typeof process.env.CODEXMATE_HTTP_TOKEN === 'string' && process.env.CODEXMATE_HTTP_TOKEN.trim().length > 0;
            console.warn(`! 安全提示: 当前监听所有网卡（${tokenEnabled ? '已启用鉴权' : '无鉴权'}）。`);
            if (!tokenEnabled) {
                console.warn('  建议仅在可信网络使用，或改用 --host 127.0.0.1。');
                console.warn('  如需远程访问，请设置 CODEXMATE_HTTP_TOKEN。');
            }
        }

        if (willOpenBrowser) {
            openBrowserAfterReady(openUrl);
        }
    });

    const stop = () => new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            for (const socket of connections) {
                try { socket.destroy(); } catch (_) { }
            }
            connections.clear();
            resolve();
        };

        if (!server.listening) {
            finish();
            return;
        }

        server.close(() => finish());
        setTimeout(() => finish(), 800);
    });

    return { server, stop };
}

// Region markers are used by unit tests that extract these helpers directly.
// #region createSerializedWebUiRestartHandler
function createSerializedWebUiRestartHandler(runRestart) {
    let restartQueued = false;
    let latestRestartInfo = null;
    let restartInFlight = null;

    const drainRestartQueue = async () => {
        try {
            while (restartQueued) {
                restartQueued = false;
                await runRestart(latestRestartInfo);
            }
        } finally {
            restartInFlight = null;
            if (restartQueued) {
                restartInFlight = drainRestartQueue();
                return restartInFlight;
            }
        }
    };

    return (info) => {
        latestRestartInfo = info;
        restartQueued = true;
        if (!restartInFlight) {
            restartInFlight = drainRestartQueue();
        }
        return restartInFlight;
    };
}
// #endregion createSerializedWebUiRestartHandler

// #region restartWebUiServerAfterFrontendChange
async function restartWebUiServerAfterFrontendChange({
    serverHandle,
    serverOptions,
    createServer = createWebServer,
    delayMs = 3000,
    wait = setTimeout,
    logger = console
}) {
    logger.log('  正在停止旧服务...');
    try {
        await serverHandle.stop();
        logger.log('  旧服务已停止');
    } catch (e) {
        logger.warn('! 停止旧服务失败:', e.message || e);
    }

    await new Promise((resolve) => wait(resolve, delayMs));

    try {
        const nextServerHandle = await createServer(serverOptions);
        logger.log('✓ 已重启 Web UI 服务\n');
        return nextServerHandle;
    } catch (e) {
        logger.error('! 重启失败:', e.message || e);
        return serverHandle;
    }
}
// #endregion restartWebUiServerAfterFrontendChange

// 打开 Web UI
async function cmdStart(options = {}) {
    const webDir = path.join(__dirname, 'web-ui');
    const newHtmlPath = path.join(webDir, 'index.html');
    const legacyHtmlPath = path.join(__dirname, 'web-ui.html');
    const htmlPath = fs.existsSync(newHtmlPath) ? newHtmlPath : legacyHtmlPath;
    const assetsDir = path.join(webDir, 'res');
    if (!fs.existsSync(htmlPath)) {
        console.error('错误: Web UI 页面不存在（尝试路径: web-ui/index.html, web-ui.html）');
        process.exit(1);
    }

    let port = resolveWebPort();
    const explicitPort = isWebPortExplicit();
    const host = resolveWebHost(options);
    releaseRunPortIfNeeded(port, host);
    const selectedPort = await resolveAvailableWebPort(port, host, { explicitPort });
    if (selectedPort.error) {
        console.error(`! 启动失败: ${selectedPort.error}`);
        console.error(`  已尝试端口: ${selectedPort.attempts.map((attempt) => attempt.port).join(', ')}`);
        console.error('  请设置 CODEXMATE_PORT 指定可用端口后重试。');
        process.exit(1);
    }
    if (selectedPort.changed) {
        const failed = selectedPort.attempts
            .filter((attempt) => !attempt.available)
            .map((attempt) => `${attempt.port}${attempt.code ? `(${attempt.code})` : ''}`)
            .join(', ');
        console.warn(`! 默认端口 ${selectedPort.requestedPort} 不可用，已自动切换到 ${selectedPort.port}。`);
        if (failed) {
            console.warn(`  跳过端口: ${failed}`);
        }
        console.warn('  如需固定端口，请设置 CODEXMATE_PORT 后重新启动。');
    }
    port = selectedPort.port;

    const isDev = process.env.NODE_ENV === 'development'
        || process.env.CODEXMATE_DEV === '1'
        || process.env.CODEXMATE_DEV === 'true';

    const shouldOpenBrowser = !options.noBrowser && !process.env.CODEXMATE_NO_BROWSER;

    let serverHandle = createWebServer({
        htmlPath,
        assetsDir,
        webDir,
        host,
        port,
        openBrowser: shouldOpenBrowser
    });

    // 禁止前端变更侦测与自动重启：避免终端输出噪音与访问时短暂 Connection Refused。
    // 如需热重启，请由开发者自行使用外部 watcher / nodemon 等工具。
    const stopWatch = () => { };

    const handleExit = () => {
        stopWatch();
        Promise.allSettled([
            serverHandle.stop(),
            stopBuiltinProxyRuntime(),
            stopBuiltinClaudeProxyRuntime()
        ]).finally(() => process.exit(0));
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);
}

function cmdAuth(args = []) {
    const subcommand = (args[0] || 'list').toLowerCase();

    if (subcommand === 'list') {
        const profiles = listAuthProfilesInfo();
        if (profiles.length === 0) {
            console.log('\n认证列表: (空)\n');
            return;
        }
        console.log('\n认证列表:');
        profiles.forEach((profile) => {
            const marker = profile.current ? '●' : ' ';
            const type = profile.type || 'unknown';
            const email = profile.email || '(无邮箱)';
            console.log(` ${marker} ${profile.name}  [${type}]  ${email}`);
        });
        console.log();
        return;
    }

    if (subcommand === 'status') {
        const profiles = listAuthProfilesInfo();
        const current = profiles.find((item) => item.current);
        if (!current) {
            console.log('\n当前认证: 未设置\n');
            return;
        }
        console.log('\n当前认证:');
        console.log('  名称:', current.name);
        console.log('  类型:', current.type || 'unknown');
        if (current.email) {
            console.log('  账号:', current.email);
        }
        if (current.expired) {
            console.log('  过期时间:', current.expired);
        }
        console.log();
        return;
    }

    if (subcommand === 'import' || subcommand === 'upload') {
        const filePath = args[1];
        const nameArg = args[2] && !args[2].startsWith('--') ? args[2] : '';
        const noActivate = args.includes('--no-activate');
        if (!filePath) {
            throw new Error('用法: codexmate auth import <json文件路径> [名称] [--no-activate]');
        }
        const result = importAuthProfileFromFile(filePath, {
            name: nameArg,
            activate: !noActivate
        });
        console.log(`✓ 已导入认证: ${result.profile.name}`);
        if (result.profile.email) {
            console.log(`  账号: ${result.profile.email}`);
        }
        if (!noActivate) {
            console.log('  已自动切换为当前认证');
        }
        console.log();
        return;
    }

    if (subcommand === 'switch' || subcommand === 'use') {
        const name = args[1];
        if (!name) {
            throw new Error('用法: codexmate auth switch <名称>');
        }
        switchAuthProfile(name);
        return;
    }

    if (subcommand === 'delete' || subcommand === 'remove') {
        const name = args[1];
        if (!name) {
            throw new Error('用法: codexmate auth delete <名称>');
        }
        const result = deleteAuthProfile(name);
        if (result.error) {
            throw new Error(result.error);
        }
        console.log(`✓ 已删除认证: ${name}`);
        if (result.switchedTo) {
            console.log(`  已自动切换到: ${result.switchedTo}`);
        }
        console.log();
        return;
    }

    throw new Error(`未知 auth 子命令: ${subcommand}`);
}

function parseProxyCliOptions(args = []) {
    const payload = {};
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === '--provider') {
            payload.provider = args[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg === '--host') {
            payload.host = args[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg === '--port') {
            const raw = args[i + 1];
            i += 1;
            if (raw === undefined) {
                return { error: '--port 缺少值' };
            }
            const port = parseInt(raw, 10);
            if (!Number.isFinite(port)) {
                return { error: '--port 必须是数字' };
            }
            payload.port = port;
            continue;
        }
        if (arg === '--auth-source') {
            payload.authSource = args[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg === '--timeout-ms') {
            const raw = args[i + 1];
            i += 1;
            if (raw === undefined) {
                return { error: '--timeout-ms 缺少值' };
            }
            const timeoutMs = parseInt(raw, 10);
            if (!Number.isFinite(timeoutMs)) {
                return { error: '--timeout-ms 必须是数字' };
            }
            payload.timeoutMs = timeoutMs;
            continue;
        }
        if (arg === '--enable') {
            payload.enabled = true;
            continue;
        }
        if (arg === '--disable') {
            payload.enabled = false;
            continue;
        }
        if (arg === '--no-switch') {
            payload.switchToProxy = false;
            continue;
        }
        return { error: `未知参数: ${arg}` };
    }
    return { payload };
}

async function cmdProxy(args = []) {
    void args;
    throw new Error('该功能已移除');
}

function parseWorkflowInputArg(rawInput) {
    const raw = typeof rawInput === 'string' ? rawInput.trim() : '';
    if (!raw) {
        return {};
    }
    let content = raw;
    if (raw.startsWith('@')) {
        const filePath = path.resolve(raw.slice(1));
        if (!fs.existsSync(filePath)) {
            throw new Error(`工作流输入文件不存在: ${filePath}`);
        }
        content = fs.readFileSync(filePath, 'utf-8');
    }
    let parsed;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        throw new Error(`工作流输入 JSON 解析失败: ${e.message}`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('工作流输入必须是 JSON 对象');
    }
    return parsed;
}

function printWorkflowHelp() {
    console.log('\n用法: codexmate workflow <list|get|validate|run|runs> [参数]');
    console.log('  codexmate workflow list');
    console.log('  codexmate workflow get diagnose-config');
    console.log('  codexmate workflow validate safe-provider-switch --input \'{"provider":"e2e"}\'');
    console.log('  codexmate workflow run diagnose-config --input \'{}\'');
    console.log('  codexmate workflow run safe-provider-switch --input \'{"provider":"e2e","apply":true}\' --allow-write');
    console.log('  codexmate workflow runs --limit 20');
    console.log('参数:');
    console.log('  --input <JSON|@file>  传入工作流输入');
    console.log('  --allow-write         允许执行写入步骤');
    console.log('  --dry-run             跳过写入步骤，仅预演');
    console.log('  --limit <N>           读取最近执行记录数量（runs）');
    console.log('  --json                以 JSON 输出');
    console.log();
}

function parseWorkflowCliOptions(args = []) {
    const options = {
        inputRaw: '',
        allowWrite: false,
        dryRun: false,
        limit: 20,
        json: false
    };
    const rest = [];
    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i];
        if (arg === '--allow-write') {
            options.allowWrite = true;
            continue;
        }
        if (arg === '--dry-run') {
            options.dryRun = true;
            continue;
        }
        if (arg === '--json') {
            options.json = true;
            continue;
        }
        if (arg === '--input') {
            options.inputRaw = args[i + 1] || '';
            i += 1;
            continue;
        }
        if (arg.startsWith('--input=')) {
            options.inputRaw = arg.slice('--input='.length);
            continue;
        }
        if (arg === '--limit') {
            const raw = args[i + 1];
            i += 1;
            const value = parseInt(raw, 10);
            if (Number.isFinite(value)) {
                options.limit = value;
            }
            continue;
        }
        if (arg.startsWith('--limit=')) {
            const value = parseInt(arg.slice('--limit='.length), 10);
            if (Number.isFinite(value)) {
                options.limit = value;
            }
            continue;
        }
        rest.push(arg);
    }
    return { options, rest };
}

async function cmdWorkflow(args = []) {
    const argv = Array.isArray(args) ? args : [];
    if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
        printWorkflowHelp();
        return;
    }
    const subcommand = String(argv[0] || '').trim().toLowerCase();
    const parsed = parseWorkflowCliOptions(argv.slice(1));
    const options = parsed.options;
    const rest = parsed.rest;

    if (subcommand === 'list') {
        const result = listWorkflowDefinitions();
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
        }
        const workflows = Array.isArray(result.workflows) ? result.workflows : [];
        console.log('\n可用工作流:');
        for (const item of workflows) {
            const mode = item.readOnly ? 'read-only' : 'read-write';
            console.log(`  - ${item.id} (${mode}, steps=${item.stepCount})`);
            if (item.description) {
                console.log(`    ${item.description}`);
            }
        }
        if (Array.isArray(result.warnings) && result.warnings.length > 0) {
            console.log('\n警告:');
            result.warnings.forEach((msg) => console.log(`  - ${msg}`));
        }
        console.log();
        return;
    }

    if (subcommand === 'runs') {
        const limit = Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit)) : 20;
        const runs = listWorkflowRunRecords(limit);
        if (options.json) {
            console.log(JSON.stringify({ runs, limit }, null, 2));
            return;
        }
        console.log(`\n最近执行记录（${runs.length}/${limit}）:`);
        for (const item of runs) {
            const status = item && item.success ? 'OK' : 'FAIL';
            console.log(`  - [${status}] ${item.workflowId || '(unknown)'} runId=${item.runId || ''} duration=${item.durationMs || 0}ms`);
            if (item && item.error) {
                console.log(`    error: ${item.error}`);
            }
        }
        console.log();
        return;
    }

    const workflowId = typeof rest[0] === 'string' ? rest[0].trim() : '';
    if (!workflowId) {
        throw new Error('workflow id is required');
    }
    const input = parseWorkflowInputArg(options.inputRaw);

    if (subcommand === 'get') {
        const result = getWorkflowDefinitionById(workflowId);
        if (result.error) {
            throw new Error(result.error);
        }
        console.log(JSON.stringify(result, null, 2));
        return;
    }

    if (subcommand === 'validate') {
        const result = validateWorkflowById(workflowId, input);
        if (!result.ok) {
            throw new Error(result.error || 'workflow validate failed');
        }
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log(`✓ 工作流校验通过: ${workflowId}`);
            if (Array.isArray(result.warnings) && result.warnings.length > 0) {
                result.warnings.forEach((msg) => console.log(`  - ${msg}`));
            }
            console.log();
        }
        return;
    }

    if (subcommand === 'run') {
        const result = await runWorkflowById(workflowId, input, {
            allowWrite: options.allowWrite,
            dryRun: options.dryRun
        });
        if (options.json) {
            console.log(JSON.stringify(result, null, 2));
        } else {
            if (result.error) {
                console.error(`✗ 工作流执行失败: ${result.error}`);
            } else {
                console.log(`✓ 工作流执行完成: ${workflowId} (${result.durationMs || 0}ms)`);
            }
            const steps = Array.isArray(result.steps) ? result.steps : [];
            for (const step of steps) {
                const status = step.status || 'unknown';
                const label = step.id || step.tool || '(step)';
                console.log(`  - ${label}: ${status} (${step.durationMs || 0}ms)`);
                if (step.error) {
                    console.log(`    error: ${step.error}`);
                }
            }
            if (result.runId) {
                console.log(`  runId: ${result.runId}`);
            }
            console.log();
        }
        if (result.error) {
            throw new Error(result.error);
        }
        return;
    }

    throw new Error(`未知 workflow 子命令: ${subcommand}`);
}

// #region parseCodexProxyOptions
function parseCodexProxyOptions(args = []) {
    const options = {
        passthroughArgs: [],
        queuedFollowUps: []
    };
    const argv = Array.isArray(args) ? args : [];

    const pushFollowUp = (value, optionName) => {
        const raw = value === undefined || value === null ? '' : String(value);
        if (!raw.trim()) {
            throw new Error(`${optionName} 需要提供非空内容`);
        }
        options.queuedFollowUps.push(raw);
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === undefined || arg === null) {
            continue;
        }
        const text = String(arg);
        if (text === '--') {
            options.passthroughArgs.push(...argv.slice(i).map((item) => String(item)));
            break;
        }
        if (text === '--queued-follow-up' || text === '--follow-up') {
            const next = argv[i + 1];
            if (next === undefined) {
                throw new Error(`${text} 需要提供内容`);
            }
            pushFollowUp(next, text);
            i += 1;
            continue;
        }
        if (text.startsWith('--queued-follow-up=')) {
            pushFollowUp(text.slice('--queued-follow-up='.length), '--queued-follow-up');
            continue;
        }
        if (text.startsWith('--follow-up=')) {
            pushFollowUp(text.slice('--follow-up='.length), '--follow-up');
            continue;
        }
        options.passthroughArgs.push(text);
    }

    return options;
}
// #endregion parseCodexProxyOptions

function shellEscapePosixArg(value) {
    const text = value === undefined || value === null ? '' : String(value);
    return `'${text.replace(/'/g, `'\"'\"'`)}'`;
}

// #region buildScriptCommandArgs
function buildScriptCommandArgs(commandLine) {
    const platform = process.platform;
    // util-linux script needs -e/--return to propagate child exit code.
    if (platform === 'linux' || platform === 'android') {
        return ['-q', '-e', '-c', commandLine, '/dev/null'];
    }
    // NetBSD supports -e/-c, matching util-linux style contract.
    if (platform === 'netbsd') {
        return ['-q', '-e', '-c', commandLine, '/dev/null'];
    }
    // OpenBSD supports "-c <command>" with a trailing output file path.
    if (platform === 'openbsd') {
        return ['-c', commandLine, '/dev/null'];
    }
    // BSD/macOS script does not support util-linux "-c <cmd>" syntax.
    if (platform === 'darwin' || platform === 'freebsd') {
        return ['-q', '/dev/null', 'sh', '-lc', commandLine];
    }
    throw new Error(`当前平台暂不支持 --follow-up 自动排队（platform=${platform}）`);
}
// #endregion buildScriptCommandArgs

// #region runProxyCommandWithQueuedFollowUps
async function runProxyCommandWithQueuedFollowUps(selectedBin, finalArgs = [], queuedFollowUps = []) {
    if (!process.stdin || !process.stdin.isTTY) {
        throw new Error('当前 stdin 不是 TTY，无法使用 --follow-up 自动排队。');
    }

    const scriptPath = resolveCommandPath('script');
    if (!scriptPath) {
        throw new Error('未找到 script 命令，无法自动注入 queued follow-up 消息。');
    }

    const commandLine = [selectedBin, ...finalArgs].map((item) => shellEscapePosixArg(item)).join(' ');
    const scriptArgs = buildScriptCommandArgs(commandLine);

    return new Promise((resolve, reject) => {
        let settled = false;
        const child = spawn(scriptPath, scriptArgs, {
            stdio: ['pipe', 'pipe', 'pipe']
        });

        const stdin = process.stdin;
        const hadRawMode = !!stdin.isRaw;
        let cleanedUp = false;
        let waitingDrain = false;
        let followUpsFlushed = false;
        let outputReadyDetected = false;
        const timers = [];
        const pendingWrites = [];
        let onChildStdinDrain = null;
        let onChildStdinError = null;
        const resolveOnce = (code) => {
            if (settled) return;
            settled = true;
            resolve(code);
        };
        const rejectOnce = (error) => {
            if (settled) return;
            settled = true;
            reject(error);
        };
        const handleWriteFailure = (error) => {
            const err = error instanceof Error ? error : new Error(String(error || 'unknown'));
            cleanup();
            try {
                if (!child.killed) {
                    child.kill('SIGTERM');
                }
            } catch (_) {
                // Ignore failure to terminate child after stdin write failure.
            }
            rejectOnce(new Error(`写入 ${selectedBin} stdin 失败: ${err.message}`));
        };
        const flushPendingWrites = () => {
            if (cleanedUp || child.stdin.destroyed) {
                pendingWrites.length = 0;
                return;
            }
            while (pendingWrites.length > 0) {
                const chunk = pendingWrites[0];
                let canContinue = true;
                try {
                    canContinue = child.stdin.write(chunk, (error) => {
                        if (error) {
                            handleWriteFailure(error);
                        }
                    });
                } catch (error) {
                    handleWriteFailure(error);
                    return;
                }
                pendingWrites.shift();
                if (!canContinue) {
                    waitingDrain = true;
                    try {
                        stdin.pause();
                    } catch (_) {
                        // Ignore stdin pause failures.
                    }
                    return;
                }
            }
            waitingDrain = false;
            try {
                stdin.resume();
            } catch (_) {
                // Ignore stdin resume failures.
            }
        };
        const enqueueWrite = (chunk) => {
            if (cleanedUp) return;
            pendingWrites.push(chunk);
            flushPendingWrites();
        };
        const onInput = (chunk) => {
            if (!child.stdin.destroyed) {
                enqueueWrite(chunk);
            }
        };
        const flushQueuedFollowUps = () => {
            if (followUpsFlushed) return;
            followUpsFlushed = true;
            queuedFollowUps.forEach((message, index) => {
                const timer = setTimeout(() => {
                    if (!child.stdin.destroyed) {
                        // PTY submit should use CR instead of LF.
                        enqueueWrite(`${message}\r`);
                    }
                }, index * 80);
                timers.push(timer);
            });
        };
        const markOutputReady = () => {
            if (outputReadyDetected) return;
            outputReadyDetected = true;
            timers.push(setTimeout(() => {
                flushQueuedFollowUps();
            }, 120));
        };
        const onStdoutData = (chunk) => {
            process.stdout.write(chunk);
            markOutputReady();
        };
        const onStderrData = (chunk) => {
            process.stderr.write(chunk);
            markOutputReady();
        };
        const onProcessExit = () => {
            cleanup();
        };
        const onProcessSigint = () => {
            cleanup();
            try {
                if (!child.killed) {
                    child.kill('SIGINT');
                }
            } catch (_) {
                // Ignore forwarding failures and keep exit path deterministic.
            }
            process.exit(130);
        };
        const onProcessSigterm = () => {
            cleanup();
            try {
                if (!child.killed) {
                    child.kill('SIGTERM');
                }
            } catch (_) {
                // Ignore forwarding failures and keep exit path deterministic.
            }
            process.exit(143);
        };
        const cleanup = () => {
            if (cleanedUp) return;
            cleanedUp = true;
            stdin.removeListener('data', onInput);
            process.removeListener('exit', onProcessExit);
            process.removeListener('SIGINT', onProcessSigint);
            process.removeListener('SIGTERM', onProcessSigterm);
            child.stdout.removeListener('data', onStdoutData);
            child.stderr.removeListener('data', onStderrData);
            if (onChildStdinDrain) {
                child.stdin.removeListener('drain', onChildStdinDrain);
            }
            if (onChildStdinError) {
                child.stdin.removeListener('error', onChildStdinError);
            }
            while (timers.length > 0) {
                clearTimeout(timers.pop());
            }
            try {
                if (typeof stdin.setRawMode === 'function' && !hadRawMode) {
                    stdin.setRawMode(false);
                }
            } catch (_) {
                // Ignore raw mode restore failures at shutdown.
            }
        };

        process.on('exit', onProcessExit);
        process.on('SIGINT', onProcessSigint);
        process.on('SIGTERM', onProcessSigterm);
        child.stdout.on('data', onStdoutData);
        child.stderr.on('data', onStderrData);
        onChildStdinDrain = () => {
            waitingDrain = false;
            flushPendingWrites();
        };
        onChildStdinError = (error) => {
            handleWriteFailure(error);
        };
        child.stdin.on('drain', onChildStdinDrain);
        child.stdin.on('error', onChildStdinError);
        try {
            if (typeof stdin.setRawMode === 'function' && !hadRawMode) {
                stdin.setRawMode(true);
            }
        } catch (_) {
            // Keep graceful fallback if raw mode toggle is not supported.
        }

        stdin.resume();
        stdin.on('data', onInput);
        // Fallback in case the child stays silent before prompt render.
        timers.push(setTimeout(() => {
            flushQueuedFollowUps();
        }, 1500));

        child.on('error', (err) => {
            cleanup();
            rejectOnce(new Error(`运行 ${selectedBin} 失败: ${err.message}`));
        });

        child.on('close', (code, signal) => {
            cleanup();
            if (typeof code === 'number') {
                resolveOnce(code);
                return;
            }
            if (signal === 'SIGINT') {
                resolveOnce(130);
                return;
            }
            if (signal === 'SIGTERM') {
                resolveOnce(143);
                return;
            }
            resolveOnce(1);
        });
    });
}
// #endregion runProxyCommandWithQueuedFollowUps

async function runProxyCommand(displayName, binNames, args = [], installTip = '', runtimeOptions = {}) {
    const extraArgs = Array.isArray(args) ? args.filter(arg => arg !== undefined) : [];
    const autoFlag = typeof runtimeOptions.autoFlag === 'string' && runtimeOptions.autoFlag ? runtimeOptions.autoFlag : '--yolo';
    const hasAutoFlag = extraArgs.includes(autoFlag);
    const finalArgs = hasAutoFlag ? extraArgs : [autoFlag, ...extraArgs];

    const names = Array.isArray(binNames) ? binNames : [binNames];
    let selectedBin = names[0];
    let exists = false;

    // Detect if any of the bin names exist
    for (const name of names) {
        if (commandExists(name, '--version')) {
            selectedBin = name;
            exists = true;
            break;
        }
    }

    if (!exists) {
        let msg = `无法启动 ${displayName}，请确认已安装并在 PATH 中。`;
        if (installTip) {
            msg += `\n安装建议: ${installTip}`;
        }
        throw new Error(msg);
    }

    const queuedFollowUps = runtimeOptions && Array.isArray(runtimeOptions.queuedFollowUps)
        ? runtimeOptions.queuedFollowUps.filter((item) => typeof item === 'string' && item.trim())
        : [];

    if (queuedFollowUps.length > 0) {
        return runProxyCommandWithQueuedFollowUps(selectedBin, finalArgs, queuedFollowUps);
    }

    return new Promise((resolve, reject) => {
        const child = spawn(selectedBin, finalArgs, {
            stdio: 'inherit',
            shell: process.platform === 'win32'
        });

        child.on('error', (err) => {
            reject(new Error(`运行 ${selectedBin} 失败: ${err.message}`));
        });

        child.on('exit', (code, signal) => {
            if (typeof code === 'number') {
                resolve(code);
                return;
            }
            if (signal === 'SIGINT') {
                resolve(130);
                return;
            }
            if (signal === 'SIGTERM') {
                resolve(143);
                return;
            }
            resolve(1);
        });
    });
}

async function cmdCodex(args = []) {
    const parsed = parseCodexProxyOptions(args);
    return runProxyCommand('Codex', 'codex', parsed.passthroughArgs, '', {
        queuedFollowUps: parsed.queuedFollowUps
    });
}

async function cmdQwen(args = []) {
    return runProxyCommand('Qwen', ['qwen', 'qwen-code'], args, 'npm install -g @qwen-code/qwen-code');
}

function parseMcpOptions(args = []) {
    const options = {
        subcommand: 'serve',
        transport: 'stdio',
        allowWrite: false,
        help: false
    };

    const argv = Array.isArray(args) ? [...args] : [];
    if (argv.length > 0 && !argv[0].startsWith('-')) {
        options.subcommand = String(argv.shift() || '').trim().toLowerCase() || 'serve';
    }

    const envAllowWrite = typeof process.env.CODEXMATE_MCP_ALLOW_WRITE === 'string'
        && ['1', 'true', 'yes', 'on'].includes(process.env.CODEXMATE_MCP_ALLOW_WRITE.trim().toLowerCase());
    options.allowWrite = envAllowWrite;

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg) continue;
        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        if (arg === '--allow-write' || arg === '--allow-write-tools') {
            options.allowWrite = true;
            continue;
        }
        if (arg === '--read-only') {
            options.allowWrite = false;
            continue;
        }
        if (arg.startsWith('--transport=')) {
            options.transport = arg.slice('--transport='.length).trim().toLowerCase() || options.transport;
            continue;
        }
        if (arg === '--transport') {
            options.transport = String(argv[i + 1] || '').trim().toLowerCase() || options.transport;
            i += 1;
            continue;
        }
    }

    return options;
}

function toMcpToolResult(payload) {
    const structured = payload === undefined
        ? {}
        : (payload && typeof payload === 'object' ? payload : { value: payload });
    const hasError = !!(structured && typeof structured === 'object' && (
        (typeof structured.error === 'string' && structured.error.trim())
        || structured.success === false
    ));
    const text = JSON.stringify(structured, null, 2);
    const result = {
        content: [{ type: 'text', text }],
        structuredContent: structured
    };
    if (hasError) {
        result.isError = true;
    }
    return result;
}

function buildMcpStatusPayload() {
    const statusConfigResult = readConfigOrVirtualDefault();
    const config = statusConfigResult.config;
    const serviceTier = typeof config.service_tier === 'string' ? config.service_tier.trim() : '';
    const modelReasoningEffort = typeof config.model_reasoning_effort === 'string' ? config.model_reasoning_effort.trim() : '';
    const budgetReadOptions = {
        useDefaultsWhenMissing: !hasConfigLoadError(statusConfigResult)
    };
    const modelContextWindow = readPositiveIntegerConfigValue(
        config,
        'model_context_window',
        budgetReadOptions
    );
    const modelAutoCompactTokenLimit = readPositiveIntegerConfigValue(
        config,
        'model_auto_compact_token_limit',
        budgetReadOptions
    );
    return {
        provider: config.model_provider || '未设置',
        model: config.model || '未设置',
        serviceTier,
        modelReasoningEffort,
        modelContextWindow,
        modelAutoCompactTokenLimit,
        configReady: !statusConfigResult.isVirtual,
        configErrorType: statusConfigResult.errorType || '',
        configNotice: statusConfigResult.reason || '',
        initNotice: consumeInitNotice()
    };
}

function buildMcpProviderListPayload() {
    const listConfigResult = readConfigOrVirtualDefault();
    const listConfig = listConfigResult.config;
    const providers = listConfig.model_providers || {};
    const current = listConfig.model_provider;
    return {
        configReady: !listConfigResult.isVirtual,
        configErrorType: listConfigResult.errorType || '',
        configNotice: listConfigResult.reason || '',
        providers: Object.entries(providers).map(([name, p]) => {
            const bridge = typeof p.codexmate_bridge === 'string' ? p.codexmate_bridge.trim() : '';
            let upstreamUrl = '';
            if (bridge === 'openai') {
                const upstream = resolveOpenaiBridgeUpstream(OPENAI_BRIDGE_SETTINGS_FILE, name);
                if (upstream && !upstream.error && typeof upstream.baseUrl === 'string') {
                    upstreamUrl = upstream.baseUrl.trim();
                }
            }
            const openaiBridgeMaxRetries = resolveProviderOpenaiBridgeMaxRetries(p);
            return {
                name,
                url: p.base_url || '',
                upstreamUrl,
                codexmate_bridge: bridge,
                openaiBridgeMaxRetries,
                key: maskKey(p.preferred_auth_method || ''),
                hasKey: !!(p.preferred_auth_method && p.preferred_auth_method.trim()),
                models: Array.isArray(p.models)
                    ? p.models
                        .filter((model) => model && typeof model === 'object' && !Array.isArray(model))
                        .map((model) => ({
                            id: typeof model.id === 'string' ? model.id : '',
                            name: typeof model.name === 'string' ? model.name : '',
                            cost: model.cost && typeof model.cost === 'object' && !Array.isArray(model.cost)
                                ? {
                                    input: model.cost.input,
                                    output: model.cost.output,
                                    cacheRead: model.cost.cacheRead,
                                    cacheWrite: model.cost.cacheWrite
                                }
                                : null,
                            contextWindow: model.contextWindow,
                            maxTokens: model.maxTokens
                        }))
                        .filter((model) => model.id)
                    : [],
                current: name === current,
                readOnly: isBuiltinManagedProvider(name),
                nonDeletable: isNonDeletableProvider(name),
                nonEditable: isNonEditableProvider(name)
            };
        })
    };
}

function buildMcpClaudeSettingsPayload() {
    const info = readClaudeSettingsInfo();
    if (!info || typeof info !== 'object') {
        return { error: '读取 Claude 配置失败' };
    }
    if (info.error) {
        return info;
    }

    const apiKey = typeof info.apiKey === 'string' ? info.apiKey : '';
    const baseUrl = typeof info.baseUrl === 'string' ? info.baseUrl : '';
    const model = typeof info.model === 'string' ? info.model : '';
    const maskedApiKey = maskKey(apiKey);

    return {
        exists: !!info.exists,
        targetPath: info.targetPath || CLAUDE_SETTINGS_FILE,
        apiKey: maskedApiKey,
        apiKeyMasked: maskedApiKey,
        baseUrl,
        model,
        env: {
            ANTHROPIC_API_KEY: maskedApiKey,
            ANTHROPIC_BASE_URL: baseUrl,
            ANTHROPIC_MODEL: model
        },
        redacted: true
    };
}

function normalizeMcpSource(value) {
    const source = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!source) return '';
    if (source === 'codex' || source === 'claude' || source === 'gemini' || source === 'codebuddy' || source === 'pi' || source === 'all') {
        return source;
    }
    return null;
}

const BUILTIN_WORKFLOW_DEFINITIONS = Object.freeze({
    'diagnose-config': {
        id: 'diagnose-config',
        name: 'Diagnose Config',
        description: 'Collect status/providers/proxy snapshots for troubleshooting.',
        readOnly: true,
        inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false
        },
        steps: [
            { id: 'status', tool: 'codexmate.status.get', arguments: {} },
            { id: 'providers', tool: 'codexmate.provider.list', arguments: {} },
            { id: 'proxy', tool: 'codexmate.proxy.status', arguments: {} }
        ]
    },
    'safe-provider-switch': {
        id: 'safe-provider-switch',
        name: 'Safe Provider Switch',
        description: 'Build template for a provider switch and optionally apply it.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                provider: { type: 'string' },
                model: { type: 'string' },
                serviceTier: { type: 'string' },
                reasoningEffort: { type: 'string' },
                modelContextWindow: { type: ['string', 'number'] },
                modelAutoCompactTokenLimit: { type: ['string', 'number'] },
                apply: { type: 'boolean' }
            },
            required: ['provider'],
            additionalProperties: false
        },
        steps: [
            { id: 'providers', tool: 'codexmate.provider.list', arguments: {} },
            {
                id: 'template',
                tool: 'codexmate.config.template.get',
                arguments: {
                    provider: '{{input.provider}}',
                    model: '{{input.model}}',
                    serviceTier: '{{input.serviceTier}}',
                    reasoningEffort: '{{input.reasoningEffort}}',
                    modelContextWindow: '{{input.modelContextWindow}}',
                    modelAutoCompactTokenLimit: '{{input.modelAutoCompactTokenLimit}}'
                }
            },
            {
                id: 'apply',
                tool: 'codexmate.config.template.apply',
                when: { path: 'input.apply', equals: true },
                arguments: {
                    template: '{{steps.template.output.template}}'
                }
            },
            {
                id: 'statusAfter',
                tool: 'codexmate.status.get',
                when: { path: 'input.apply', equals: true },
                arguments: {}
            }
        ]
    },
    'session-issue-pack': {
        id: 'session-issue-pack',
        name: 'Session Issue Pack',
        description: 'Collect session detail and markdown export for issue reports.',
        readOnly: true,
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string' },
                sessionId: { type: 'string' },
                file: { type: 'string' },
                maxMessages: { type: ['string', 'number'] }
            },
            additionalProperties: true
        },
        steps: [
            {
                id: 'detail',
                tool: 'codexmate.session.detail',
                arguments: {
                    source: '{{input.source}}',
                    sessionId: '{{input.sessionId}}',
                    file: '{{input.file}}',
                    maxMessages: '{{input.maxMessages}}'
                }
            },
            {
                id: 'export',
                tool: 'codexmate.session.export',
                arguments: {
                    source: '{{input.source}}',
                    sessionId: '{{input.sessionId}}',
                    file: '{{input.file}}',
                    maxMessages: '{{input.maxMessages}}'
                }
            }
        ]
    }
});

function cloneJson(value, fallback) {
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return fallback;
    }
}

function normalizeWorkflowId(value) {
    const raw = typeof value === 'string' ? value.trim() : '';
    if (!raw) return '';
    if (!/^[a-zA-Z0-9._-]+$/.test(raw)) {
        return '';
    }
    return raw.toLowerCase();
}

function normalizeWorkflowDefinition(raw, idHint = '', source = 'custom') {
    const safe = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
    if (!safe) {
        return { ok: false, error: 'workflow must be an object' };
    }
    const id = normalizeWorkflowId(safe.id || idHint);
    if (!id) {
        return { ok: false, error: 'workflow id is invalid' };
    }
    const name = typeof safe.name === 'string' && safe.name.trim()
        ? safe.name.trim()
        : id;
    const description = typeof safe.description === 'string' ? safe.description.trim() : '';
    const inputSchema = safe.inputSchema && typeof safe.inputSchema === 'object'
        ? cloneJson(safe.inputSchema, { type: 'object', properties: {}, additionalProperties: true })
        : { type: 'object', properties: {}, additionalProperties: true };
    const stepsRaw = Array.isArray(safe.steps) ? safe.steps : [];
    if (stepsRaw.length === 0) {
        return { ok: false, error: 'workflow steps cannot be empty' };
    }

    const steps = [];
    for (let i = 0; i < stepsRaw.length; i += 1) {
        const item = stepsRaw[i];
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            return { ok: false, error: `workflow step #${i + 1} must be an object` };
        }
        const stepIdRaw = typeof item.id === 'string' && item.id.trim()
            ? item.id.trim()
            : `step${i + 1}`;
        const stepId = normalizeWorkflowId(stepIdRaw);
        if (!stepId) {
            return { ok: false, error: `workflow step id invalid at #${i + 1}` };
        }
        const toolName = typeof item.tool === 'string' ? item.tool.trim() : '';
        if (!toolName) {
            return { ok: false, error: `workflow step "${stepId}" missing tool` };
        }
        const args = item.arguments && typeof item.arguments === 'object' && !Array.isArray(item.arguments)
            ? cloneJson(item.arguments, {})
            : {};
        const when = item.when && typeof item.when === 'object' && !Array.isArray(item.when)
            ? cloneJson(item.when, {})
            : null;
        steps.push({
            id: stepId,
            name: typeof item.name === 'string' ? item.name.trim() : '',
            tool: toolName,
            arguments: args,
            when,
            continueOnError: item.continueOnError === true,
            write: item.write === true
        });
    }

    return {
        ok: true,
        data: {
            id,
            name,
            description,
            source,
            readOnly: safe.readOnly !== false,
            inputSchema,
            steps
        }
    };
}

function loadBuiltinWorkflowDefinitions() {
    const items = [];
    for (const [id, raw] of Object.entries(BUILTIN_WORKFLOW_DEFINITIONS)) {
        const normalized = normalizeWorkflowDefinition(raw, id, 'builtin');
        if (!normalized.ok) {
            continue;
        }
        items.push(normalized.data);
    }
    return items;
}

function loadCustomWorkflowDefinitions() {
    const parsed = readJsonObjectFromFile(WORKFLOW_DEFINITIONS_FILE, {});
    if (!parsed.ok || !parsed.exists) {
        return {
            items: [],
            warnings: parsed.ok ? [] : [parsed.error || 'workflow file parse failed']
        };
    }
    const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};
    let list = [];
    if (Array.isArray(data.workflows)) {
        list = data.workflows;
    } else if (data.workflows && typeof data.workflows === 'object') {
        list = Object.entries(data.workflows).map(([id, item]) => ({ ...(item || {}), id }));
    } else {
        list = Object.entries(data).map(([id, item]) => ({ ...(item || {}), id }));
    }

    const items = [];
    const warnings = [];
    for (const item of list) {
        const normalized = normalizeWorkflowDefinition(item, item && item.id ? item.id : '', 'custom');
        if (!normalized.ok) {
            warnings.push(normalized.error || 'invalid custom workflow');
            continue;
        }
        items.push(normalized.data);
    }
    return { items, warnings };
}

function buildWorkflowRegistry() {
    const registry = new Map();
    const warnings = [];
    const builtin = loadBuiltinWorkflowDefinitions();
    for (const item of builtin) {
        registry.set(item.id, item);
    }
    const custom = loadCustomWorkflowDefinitions();
    for (const item of custom.items) {
        if (registry.has(item.id)) {
            warnings.push(`custom workflow id duplicated with builtin and ignored: ${item.id}`);
            continue;
        }
        registry.set(item.id, item);
    }
    warnings.push(...custom.warnings);
    return { registry, warnings };
}

function listWorkflowDefinitions() {
    const { registry, warnings } = buildWorkflowRegistry();
    const workflows = Array.from(registry.values())
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((item) => ({
            id: item.id,
            name: item.name,
            description: item.description,
            source: item.source,
            readOnly: item.readOnly !== false,
            stepCount: Array.isArray(item.steps) ? item.steps.length : 0
        }));
    return {
        workflows,
        warnings
    };
}

function getWorkflowDefinitionById(rawId) {
    const id = normalizeWorkflowId(rawId);
    if (!id) {
        return { error: 'workflow id is required' };
    }
    const { registry, warnings } = buildWorkflowRegistry();
    const workflow = registry.get(id);
    if (!workflow) {
        return { error: `workflow not found: ${id}` };
    }
    return {
        workflow: cloneJson(workflow, {}),
        warnings
    };
}

function createWorkflowToolCatalog() {
    return {
        'codexmate.status.get': {
            readOnly: true,
            handler: async () => buildMcpStatusPayload()
        },
        'codexmate.provider.list': {
            readOnly: true,
            handler: async () => buildMcpProviderListPayload()
        },
        'codexmate.proxy.status': {
            readOnly: true,
            handler: async () => getBuiltinProxyStatus()
        },
        'codexmate.session.list': {
            readOnly: true,
            handler: async (args = {}) => {
                const source = normalizeMcpSource(args.source);
                if (source === null) {
                    return { error: 'Invalid source. Must be codex, claude, gemini, codebuddy, pi, or all' };
                }
                return {
                    source: source || 'all',
                    sessions: await listSessionBrowse({
                        ...args,
                        source: source || 'all'
                    })
                };
            }
        },
        'codexmate.session.detail': {
            readOnly: true,
            handler: async (args = {}) => readSessionDetail(args || {})
        },
        'codexmate.session.export': {
            readOnly: true,
            handler: async (args = {}) => exportSessionData(args || {})
        },
        'codexmate.config.template.get': {
            readOnly: true,
            handler: async (args = {}) => getConfigTemplate(args || {})
        },
        'codexmate.config.template.apply': {
            readOnly: false,
            handler: async (args = {}) => applyConfigTemplate(args || {})
        }
    };
}

function getWorkflowKnownToolsSet() {
    return new Set(Object.keys(createWorkflowToolCatalog()));
}

function resolveWorkflowDefinitionWithToolMeta(workflow) {
    const catalog = createWorkflowToolCatalog();
    const safe = cloneJson(workflow, {});
    safe.steps = (Array.isArray(safe.steps) ? safe.steps : []).map((step) => {
        const tool = catalog[step.tool];
        return {
            ...step,
            write: step.write === true || !!(tool && tool.readOnly === false)
        };
    });
    return safe;
}

function validateWorkflowInputBySchema(inputSchema, input) {
    const schema = inputSchema && typeof inputSchema === 'object' ? inputSchema : {};
    if (schema.type && schema.type !== 'object') {
        return { ok: false, error: `unsupported input schema type: ${schema.type}` };
    }
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
        return { ok: false, error: 'workflow input must be an object' };
    }
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
        if (!Object.prototype.hasOwnProperty.call(input, key)) {
            return { ok: false, error: `missing required input field: ${key}` };
        }
    }
    const properties = schema.properties && typeof schema.properties === 'object' ? schema.properties : {};
    for (const [key, expected] of Object.entries(properties)) {
        if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
        const value = input[key];
        if (!expected || typeof expected !== 'object') continue;
        const type = expected.type;
        if (!type) continue;
        const typeList = Array.isArray(type) ? type : [type];
        const actualType = value === null ? 'null' : (Array.isArray(value) ? 'array' : typeof value);
        const matched = typeList.some((candidate) => {
            if (candidate === 'number') return typeof value === 'number' && Number.isFinite(value);
            if (candidate === 'integer') return Number.isInteger(value);
            if (candidate === 'array') return Array.isArray(value);
            if (candidate === 'object') return value && typeof value === 'object' && !Array.isArray(value);
            if (candidate === 'null') return value === null;
            return actualType === candidate;
        });
        if (!matched) {
            return { ok: false, error: `input field "${key}" type mismatch` };
        }
    }
    return { ok: true };
}

function appendWorkflowRunRecord(record) {
    ensureDir(path.dirname(WORKFLOW_RUNS_FILE));
    const content = `${JSON.stringify(record)}\n`;
    fs.appendFileSync(WORKFLOW_RUNS_FILE, content, { encoding: 'utf-8', mode: 0o600 });
}

function listWorkflowRunRecords(limit = 20) {
    const max = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
    if (!fs.existsSync(WORKFLOW_RUNS_FILE)) {
        return [];
    }
    let content = '';
    try {
        content = fs.readFileSync(WORKFLOW_RUNS_FILE, 'utf-8');
    } catch (_) {
        return [];
    }
    const rows = content
        .split(/\r?\n/g)
        .map((line) => line.trim())
        .filter(Boolean);
    const parsed = [];
    for (let i = rows.length - 1; i >= 0; i -= 1) {
        try {
            const item = JSON.parse(rows[i]);
            parsed.push(item);
            if (parsed.length >= max) {
                break;
            }
        } catch (_) { }
    }
    return parsed;
}

function validateWorkflowById(workflowId, input = {}) {
    const definitionResult = getWorkflowDefinitionById(workflowId);
    if (definitionResult.error) {
        return { ok: false, error: definitionResult.error };
    }
    const workflow = resolveWorkflowDefinitionWithToolMeta(definitionResult.workflow);
    const knownTools = getWorkflowKnownToolsSet();
    const validation = validateWorkflowDefinition(workflow, { knownTools });
    if (!validation.ok) {
        return {
            ok: false,
            error: validation.error || 'workflow validation failed',
            issues: validation.issues || []
        };
    }
    const schemaValidation = validateWorkflowInputBySchema(workflow.inputSchema, input || {});
    if (!schemaValidation.ok) {
        return { ok: false, error: schemaValidation.error || 'workflow input validation failed' };
    }
    return {
        ok: true,
        workflow: {
            id: workflow.id,
            name: workflow.name,
            readOnly: workflow.readOnly !== false,
            stepCount: Array.isArray(workflow.steps) ? workflow.steps.length : 0
        },
        warnings: definitionResult.warnings || []
    };
}

async function runWorkflowById(workflowId, input = {}, options = {}) {
    const definitionResult = getWorkflowDefinitionById(workflowId);
    if (definitionResult.error) {
        return { error: definitionResult.error };
    }
    const workflow = resolveWorkflowDefinitionWithToolMeta(definitionResult.workflow);
    const knownTools = getWorkflowKnownToolsSet();
    const validation = validateWorkflowDefinition(workflow, { knownTools });
    if (!validation.ok) {
        return {
            error: validation.error || 'workflow validation failed',
            issues: validation.issues || []
        };
    }
    const schemaValidation = validateWorkflowInputBySchema(workflow.inputSchema, input || {});
    if (!schemaValidation.ok) {
        return { error: schemaValidation.error || 'workflow input validation failed' };
    }

    const catalog = createWorkflowToolCatalog();
    const allowWrite = options.allowWrite === true;
    const dryRun = options.dryRun === true;
    const runId = `wf-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const startedAt = toIsoTime(Date.now());

    const execution = await executeWorkflowDefinition(workflow, input || {}, {
        allowWrite,
        dryRun,
        invokeTool: async (toolName, args = {}) => {
            const tool = catalog[toolName];
            if (!tool) {
                return { error: `workflow tool not supported: ${toolName}` };
            }
            if (!tool.readOnly && !allowWrite) {
                return { error: `workflow requires write permission for tool: ${toolName}` };
            }
            return tool.handler(args || {});
        }
    });

    const endedAt = toIsoTime(Date.now());
    const record = {
        runId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        success: execution.success === true,
        error: execution.error || '',
        allowWrite,
        dryRun,
        startedAt,
        endedAt,
        durationMs: execution.durationMs || 0,
        steps: Array.isArray(execution.steps) ? execution.steps.map((step) => ({
            id: step.id,
            tool: step.tool,
            status: step.status,
            durationMs: step.durationMs || 0,
            error: step.error || ''
        })) : [],
        input: cloneJson(input || {}, {})
    };
    try {
        appendWorkflowRunRecord(record);
    } catch (_) { }

    return {
        success: execution.success === true,
        runId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        allowWrite,
        dryRun,
        startedAt: execution.startedAt || startedAt,
        endedAt: execution.endedAt || endedAt,
        durationMs: execution.durationMs || 0,
        steps: execution.steps || [],
        output: execution.output || null,
        warnings: definitionResult.warnings || [],
        ...(execution.error ? { error: execution.error } : {})
    };
}

function createMcpTools(options = {}) {
    const allowWrite = !!options.allowWrite;
    const tools = [];

    const pushTool = (tool) => {
        if (!tool || typeof tool !== 'object') return;
        if (!tool.readOnly && !allowWrite) return;
        tools.push({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema || { type: 'object', properties: {}, additionalProperties: false },
            annotations: {
                readOnlyHint: !!tool.readOnly
            },
            handler: async (args = {}) => {
                try {
                    const payload = await tool.handler(args || {});
                    return toMcpToolResult(payload);
                } catch (error) {
                    return toMcpToolResult({
                        error: error && error.message ? error.message : String(error || 'Tool execution failed')
                    });
                }
            }
        });
    };

    pushTool({
        name: 'codexmate.status.get',
        description: 'Get current provider/model status, config readiness and startup notice.',
        readOnly: true,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => buildMcpStatusPayload()
    });

    pushTool({
        name: 'codexmate.provider.list',
        description: 'List configured providers with masked key and active flags.',
        readOnly: true,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => buildMcpProviderListPayload()
    });

    pushTool({
        name: 'codexmate.model.list',
        description: 'List models from a provider. If provider is omitted, use current provider.',
        readOnly: true,
        inputSchema: {
            type: 'object',
            properties: {
                provider: { type: 'string' }
            },
            additionalProperties: false
        },
        handler: async (args = {}) => {
            const rawProvider = typeof args.provider === 'string' ? args.provider.trim() : '';
            let providerName = rawProvider;
            if (!providerName) {
                const cfg = readConfigOrVirtualDefault().config || {};
                providerName = typeof cfg.model_provider === 'string' ? cfg.model_provider.trim() : '';
            }
            if (!providerName) {
                return { error: 'Provider name is required' };
            }
            const res = await fetchProviderModels(providerName);
            if (res.error) {
                return { error: res.error, models: [], source: 'remote' };
            }
            if (res.unlimited) {
                return { models: [], source: 'remote', provider: res.provider || '', unlimited: true };
            }
            return { models: res.models || [], source: 'remote', provider: res.provider || '' };
        }
    });

    pushTool({
        name: 'codexmate.config.template.get',
        description: 'Get Codex config template with optional provider/model/service tier/reasoning effort/context budget.',
        readOnly: true,
        inputSchema: {
            type: 'object',
            properties: {
                provider: { type: 'string' },
                model: { type: 'string' },
                serviceTier: { type: 'string' },
                reasoningEffort: { type: 'string' },
                modelContextWindow: { type: ['string', 'number'] },
                modelAutoCompactTokenLimit: { type: ['string', 'number'] }
            },
            additionalProperties: false
        },
        handler: async (args = {}) => getConfigTemplate(args || {})
    });

    pushTool({
        name: 'codexmate.claude.settings.get',
        description: 'Read Claude settings.json env values managed by codexmate.',
        readOnly: true,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => buildMcpClaudeSettingsPayload()
    });

    pushTool({
        name: 'codexmate.openclaw.config.get',
        description: 'Read OpenClaw config file content and metadata.',
        readOnly: true,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => readOpenclawConfigFile()
    });

    pushTool({
        name: 'codexmate.session.list',
        description: 'List sessions from codex/claude/all with filters.',
        readOnly: true,
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string' },
                pathFilter: { type: 'string' },
                query: { type: 'string' },
                roleFilter: { type: 'string' },
                timeRangePreset: { type: 'string' },
                limit: { type: 'number' },
                forceRefresh: { type: 'boolean' },
                queryMode: { type: 'string' },
                queryScope: { type: 'string' },
                contentScanLimit: { type: 'number' }
            },
            additionalProperties: false
        },
        handler: async (args = {}) => {
            const input = args && typeof args === 'object' ? args : {};
            const source = normalizeMcpSource(input.source);
            if (source === null) {
                return { error: 'Invalid source. Must be codex, claude, gemini, codebuddy, pi, or all' };
            }
            const normalizedInput = {
                ...input,
                source: source || 'all'
            };
            return {
                sessions: await listSessionBrowse(normalizedInput),
                source: source || 'all'
            };
        }
    });

    pushTool({
        name: 'codexmate.session.detail',
        description: 'Read a session detail by source + sessionId/file.',
        readOnly: true,
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string' },
                sessionId: { type: 'string' },
                file: { type: 'string' },
                maxMessages: { type: ['string', 'number'] }
            },
            additionalProperties: true
        },
        handler: async (args = {}) => readSessionDetail(args || {})
    });

    pushTool({
        name: 'codexmate.session.export',
        description: 'Export session as markdown payload.',
        readOnly: true,
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string' },
                sessionId: { type: 'string' },
                file: { type: 'string' },
                maxMessages: { type: ['string', 'number'] }
            },
            additionalProperties: true
        },
        handler: async (args = {}) => exportSessionData(args || {})
    });

    pushTool({
        name: 'codexmate.auth.profile.list',
        description: 'List codex auth profiles.',
        readOnly: true,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => ({ profiles: listAuthProfilesInfo() })
    });

    pushTool({
        name: 'codexmate.proxy.status',
        description: 'Get builtin proxy runtime status and persisted config.',
        readOnly: true,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => getBuiltinProxyStatus()
    });

    pushTool({
        name: 'codexmate.claude_proxy.status',
        description: 'Get builtin Claude-compatible proxy runtime status and persisted config.',
        readOnly: true,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => getBuiltinClaudeProxyStatus()
    });

    pushTool({
        name: 'codexmate.workflow.list',
        description: 'List available workflows (builtin + custom).',
        readOnly: true,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => listWorkflowDefinitions()
    });

    pushTool({
        name: 'codexmate.workflow.get',
        description: 'Get one workflow definition by id.',
        readOnly: true,
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string' }
            },
            required: ['id'],
            additionalProperties: false
        },
        handler: async (args = {}) => {
            const id = typeof args.id === 'string' ? args.id.trim() : '';
            if (!id) {
                return { error: 'workflow id is required' };
            }
            return getWorkflowDefinitionById(id);
        }
    });

    pushTool({
        name: 'codexmate.workflow.validate',
        description: 'Validate workflow definition and input payload.',
        readOnly: true,
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                input: { type: 'object' }
            },
            required: ['id'],
            additionalProperties: false
        },
        handler: async (args = {}) => {
            const id = typeof args.id === 'string' ? args.id.trim() : '';
            if (!id) {
                return { ok: false, error: 'workflow id is required' };
            }
            const input = args.input && typeof args.input === 'object' && !Array.isArray(args.input)
                ? args.input
                : {};
            return validateWorkflowById(id, input);
        }
    });

    pushTool({
        name: 'codexmate.workflow.run',
        description: 'Run workflow by id. Write steps require allow-write mode.',
        readOnly: true,
        inputSchema: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                input: { type: 'object' },
                dryRun: { type: 'boolean' }
            },
            required: ['id'],
            additionalProperties: false
        },
        handler: async (args = {}) => {
            const id = typeof args.id === 'string' ? args.id.trim() : '';
            if (!id) {
                return { error: 'workflow id is required' };
            }
            const input = args.input && typeof args.input === 'object' && !Array.isArray(args.input)
                ? args.input
                : {};
            return runWorkflowById(id, input, {
                allowWrite,
                dryRun: args.dryRun === true
            });
        }
    });

    pushTool({
        name: 'codexmate.config.template.apply',
        description: 'Apply Codex TOML template and sync auth/model pointers.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                template: { type: 'string' }
            },
            required: ['template'],
            additionalProperties: false
        },
        handler: async (args = {}) => applyConfigTemplate(args || {})
    });

    pushTool({
        name: 'codexmate.provider.add',
        description: 'Add provider into config.toml model_providers.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                url: { type: 'string' },
                key: { type: 'string' }
            },
            required: ['name', 'url'],
            additionalProperties: false
        },
        handler: async (args = {}) => addProviderToConfig(args || {})
    });

    pushTool({
        name: 'codexmate.provider.update',
        description: 'Update provider url/key.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' },
                url: { type: 'string' },
                key: { type: 'string' }
            },
            required: ['name'],
            additionalProperties: false
        },
        handler: async (args = {}) => updateProviderInConfig(args || {})
    });

    pushTool({
        name: 'codexmate.provider.delete',
        description: 'Delete provider from config.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' }
            },
            required: ['name'],
            additionalProperties: false
        },
        handler: async (args = {}) => deleteProviderFromConfig(args || {})
    });

    pushTool({
        name: 'codexmate.claude.config.apply',
        description: 'Apply Claude env config into ~/.claude/settings.json.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                apiKey: { type: 'string' },
                baseUrl: { type: 'string' },
                model: { type: 'string' },
                name: { type: 'string' },
                targetApi: { type: 'string' }
            },
            allOf: [{
                if: {
                    not: {
                        type: 'object',
                        properties: { targetApi: { type: 'string', pattern: '^[\\s]*[oO][lL][lL][aA][mM][aA][\\s]*$' } },
                        required: ['targetApi']
                    }
                },
                then: { required: ['apiKey'] }
            }],
            additionalProperties: false
        },
        handler: async (args = {}) => applyToClaudeSettings(args || {})
    });

    pushTool({
        name: 'codexmate.openclaw.config.apply',
        description: 'Apply OpenClaw config content into ~/.openclaw/openclaw.json.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                content: { type: 'string' },
                lineEnding: { type: 'string' }
            },
            required: ['content'],
            additionalProperties: false
        },
        handler: async (args = {}) => applyOpenclawConfig(args || {})
    });

    pushTool({
        name: 'codexmate.session.trash',
        description: 'Move one entire session file into session trash.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string' },
                sessionId: { type: 'string' },
                filePath: { type: 'string' },
                file: { type: 'string' }
            },
            additionalProperties: true
        },
        handler: async (args = {}) => trashSessionData(args || {})
    });

    pushTool({
        name: 'codexmate.session.delete',
        description: 'Permanently delete one entire session file.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                source: { type: 'string' },
                sessionId: { type: 'string' },
                filePath: { type: 'string' },
                file: { type: 'string' }
            },
            additionalProperties: true
        },
        handler: async (args = {}) => deleteSessionData(args || {})
    });

    pushTool({
        name: 'codexmate.auth.profile.switch',
        description: 'Switch active auth profile by name.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' }
            },
            required: ['name'],
            additionalProperties: false
        },
        handler: async (args = {}) => {
            const profileName = typeof args.name === 'string' ? args.name.trim() : '';
            if (!profileName) return { error: '认证名称不能为空' };
            try {
                return switchAuthProfile(profileName, { silent: true });
            } catch (e) {
                return { error: e.message || '切换认证失败' };
            }
        }
    });

    pushTool({
        name: 'codexmate.auth.profile.delete',
        description: 'Delete an auth profile by name.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                name: { type: 'string' }
            },
            required: ['name'],
            additionalProperties: false
        },
        handler: async (args = {}) => deleteAuthProfile(typeof args.name === 'string' ? args.name : '')
    });

    pushTool({
        name: 'codexmate.proxy.start',
        description: 'Start builtin proxy runtime with optional overrides.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean' },
                host: { type: 'string' },
                port: { type: 'number' },
                provider: { type: 'string' },
                authSource: { type: 'string' },
                timeoutMs: { type: 'number' }
            },
            additionalProperties: false
        },
        handler: async (args = {}) => startBuiltinProxyRuntime(args || {})
    });

    pushTool({
        name: 'codexmate.claude_proxy.start',
        description: 'Start builtin Claude-compatible proxy runtime with optional overrides.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                enabled: { type: 'boolean' },
                host: { type: 'string' },
                port: { type: 'number' },
                provider: { type: 'string' },
                authSource: { type: 'string' },
                timeoutMs: { type: 'number' }
            },
            additionalProperties: false
        },
        handler: async (args = {}) => startBuiltinClaudeProxyRuntime(args || {})
    });

    pushTool({
        name: 'codexmate.proxy.stop',
        description: 'Stop builtin proxy runtime.',
        readOnly: false,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => stopBuiltinProxyRuntime()
    });

    pushTool({
        name: 'codexmate.claude_proxy.stop',
        description: 'Stop builtin Claude-compatible proxy runtime.',
        readOnly: false,
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        handler: async () => stopBuiltinClaudeProxyRuntime()
    });

    pushTool({
        name: 'codexmate.proxy.provider.apply',
        description: 'Apply builtin proxy provider into codex config.',
        readOnly: false,
        inputSchema: {
            type: 'object',
            properties: {
                switchToProxy: { type: 'boolean' },
                provider: { type: 'string' }
            },
            additionalProperties: true
        },
        handler: async (args = {}) => applyBuiltinProxyProvider(args || {})
    });

    return tools;
}

function createMcpResources() {
    return [
        {
            uri: 'codexmate://status',
            name: 'Status',
            description: 'Current provider/model status snapshot.',
            mimeType: 'application/json',
            read: async () => ({
                contents: [{
                    uri: 'codexmate://status',
                    mimeType: 'application/json',
                    text: JSON.stringify(buildMcpStatusPayload(), null, 2)
                }]
            })
        },
        {
            uri: 'codexmate://providers',
            name: 'Providers',
            description: 'Configured provider list (masked).',
            mimeType: 'application/json',
            read: async () => ({
                contents: [{
                    uri: 'codexmate://providers',
                    mimeType: 'application/json',
                    text: JSON.stringify(buildMcpProviderListPayload(), null, 2)
                }]
            })
        },
        {
            uri: 'codexmate://sessions',
            name: 'Sessions',
            description: 'Session listing resource. Query by source/query/pathFilter via URI params.',
            mimeType: 'application/json',
            read: async (params = {}) => {
                const uri = typeof params.uri === 'string' ? params.uri : 'codexmate://sessions';
                let source = '';
                let query = '';
                let pathFilter = '';
                let roleFilter = '';
                let timeRangePreset = '';
                try {
                    const parsed = new URL(uri);
                    source = parsed.searchParams.get('source') || '';
                    query = parsed.searchParams.get('query') || '';
                    pathFilter = parsed.searchParams.get('pathFilter') || '';
                    roleFilter = parsed.searchParams.get('roleFilter') || '';
                    timeRangePreset = parsed.searchParams.get('timeRangePreset') || '';
                } catch (_) { }
                const normalizedSource = normalizeMcpSource(source);
                if (normalizedSource === null) {
                    return {
                        contents: [{
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify({ error: 'Invalid source. Must be codex, claude, gemini, codebuddy, pi, or all' }, null, 2)
                        }]
                    };
                }
                const payload = {
                    source: normalizedSource || 'all',
                    sessions: await listSessionBrowse({
                        source: normalizedSource || 'all',
                        query,
                        pathFilter,
                        roleFilter,
                        timeRangePreset
                    })
                };
                return {
                    contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(payload, null, 2)
                    }]
                };
            }
        },
        {
            uri: 'codexmate://workflows',
            name: 'Workflows',
            description: 'Workflow list resource (builtin + custom).',
            mimeType: 'application/json',
            read: async () => ({
                contents: [{
                    uri: 'codexmate://workflows',
                    mimeType: 'application/json',
                    text: JSON.stringify(listWorkflowDefinitions(), null, 2)
                }]
            })
        },
        {
            uri: 'codexmate://workflow-runs',
            name: 'WorkflowRuns',
            description: 'Recent workflow execution records. Supports ?limit=<N>.',
            mimeType: 'application/json',
            read: async (params = {}) => {
                const uri = typeof params.uri === 'string' ? params.uri : 'codexmate://workflow-runs';
                let limit = 20;
                try {
                    const parsed = new URL(uri);
                    const rawLimit = parsed.searchParams.get('limit');
                    if (rawLimit) {
                        const parsedLimit = parseInt(rawLimit, 10);
                        if (Number.isFinite(parsedLimit)) {
                            limit = parsedLimit;
                        }
                    }
                } catch (_) { }
                const payload = {
                    runs: listWorkflowRunRecords(limit),
                    limit: Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20
                };
                return {
                    contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(payload, null, 2)
                    }]
                };
            }
        }
    ];
}

function createMcpPrompts() {
    return [
        {
            name: 'codexmate.diagnose_config',
            description: 'Generate troubleshooting guidance from current codexmate status/providers.',
            arguments: [],
            get: async () => {
                const status = buildMcpStatusPayload();
                const providers = buildMcpProviderListPayload();
                return {
                    messages: [{
                        role: 'user',
                        content: {
                            type: 'text',
                            text: [
                                '请根据以下配置快照进行故障诊断，并给出按优先级排序的修复步骤。',
                                '要求：先给结论，再给操作清单，最后给风险与回滚建议。',
                                '',
                                '[status]',
                                JSON.stringify(status, null, 2),
                                '',
                                '[providers]',
                                JSON.stringify(providers, null, 2)
                            ].join('\n')
                        }
                    }]
                };
            }
        },
        {
            name: 'codexmate.switch_provider_safely',
            description: 'Guide safe provider switch with pre-check and rollback plan.',
            arguments: [{
                name: 'provider',
                description: 'Target provider name',
                required: true
            }],
            get: async (args = {}) => {
                const provider = typeof args.provider === 'string' ? args.provider.trim() : '';
                return {
                    messages: [{
                        role: 'user',
                        content: {
                            type: 'text',
                            text: [
                                `请为 provider "${provider || '(missing)'}" 生成安全切换步骤。`,
                                '要求：',
                                '1) 先检查 provider 是否存在与 key 是否可用',
                                '2) 给出切换后验证项（模型拉取/健康检查）',
                                '3) 给出失败时回滚流程（回到旧 provider/model）'
                            ].join('\n')
                        }
                    }]
                };
            }
        },
        {
            name: 'codexmate.export_session_for_issue',
            description: 'Prepare issue report template from a selected session export.',
            arguments: [{
                name: 'source',
                description: 'Session source: codex or claude',
                required: true
            }, {
                name: 'sessionId',
                description: 'Session id',
                required: true
            }],
            get: async (args = {}) => {
                const source = typeof args.source === 'string' ? args.source.trim() : '';
                const sessionId = typeof args.sessionId === 'string' ? args.sessionId.trim() : '';
                return {
                    messages: [{
                        role: 'user',
                        content: {
                            type: 'text',
                            text: [
                                '请根据会话导出内容生成 issue 报告草稿。',
                                `source: ${source || '(missing)'}`,
                                `sessionId: ${sessionId || '(missing)'}`,
                                '',
                                '报告需包含：问题现象、复现步骤、预期行为、实际行为、可疑配置项。'
                            ].join('\n')
                        }
                    }]
                };
            }
        }
    ];
}

async function cmdMcp(args = []) {
    const options = parseMcpOptions(args);
    if (options.help) {
        console.log('\n用法: codexmate mcp [serve] [--transport stdio] [--allow-write|--read-only]');
        console.log('  默认 transport=stdio，默认 read-only。');
        console.log('  设置环境变量 CODEXMATE_MCP_ALLOW_WRITE=1 可默认开启写工具。');
        console.log();
        return;
    }

    if (options.subcommand !== 'serve') {
        throw new Error(`未知 mcp 子命令: ${options.subcommand}`);
    }
    if (options.transport !== 'stdio') {
        throw new Error(`当前仅支持 stdio 传输，收到: ${options.transport}`);
    }

    const packageVersion = (() => {
        try {
            const pkg = require('./package.json');
            return pkg && pkg.version ? pkg.version : '0.0.0';
        } catch (_) {
            return '0.0.0';
        }
    })();

    const server = createMcpStdioServer({
        protocolVersion: '2025-11-25',
        serverInfo: {
            name: 'codexmate-mcp',
            version: packageVersion
        },
        tools: createMcpTools({ allowWrite: options.allowWrite }),
        resources: createMcpResources(),
        prompts: createMcpPrompts(),
        logger: (level, message) => {
            const label = level === 'error' ? 'ERR' : 'INFO';
            console.error(`[MCP ${label}] ${message}`);
        }
    });

    server.start();

    await new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            server.stop();
            Promise.allSettled([
                stopBuiltinProxyRuntime(),
                stopBuiltinClaudeProxyRuntime()
            ]).finally(() => resolve());
        };
        process.once('SIGINT', finish);
        process.once('SIGTERM', finish);
        process.stdin.once('end', finish);
        process.stdin.once('close', finish);
    });
}

function printMainHelp() {
    console.log('\nCodex Mate - Codex 提供商管理工具');
    console.log('\n用法:');
    console.log('  codexmate status           显示当前状态');
    console.log('  codexmate doctor [--format json|md] [--lang zh|en] [--output <PATH>]  输出诊断报告');
    console.log('  codexmate import-skills <URL> [--target-app codex|claude] [--name <NAME>] [--timeout-ms <MS>]  从 URL 导入 skills');
    console.log('  codexmate setup            交互式配置向导');
    console.log('  codexmate list             列出所有提供商');
    console.log('  codexmate models           列出所有模型');
    console.log('  codexmate switch <名称>    切换提供商');
    console.log('  codexmate use <模型>       切换模型');
    console.log('  codexmate add <名称> <URL> [密钥] [--bridge <openai>]');
    console.log('  codexmate delete <名称>    删除提供商');
    console.log('  codexmate claude            等同于 claude --dangerously-skip-permissions');
    console.log('  codexmate claude <BaseURL> <API密钥> [模型] [--target-api responses|chat_completions|ollama]  写入 Claude Code 配置');
    console.log('  codexmate kilo [URL API密钥 模型] [--provider <id>]  配置后启动 KiloCode');
    console.log('  codexmate auth <list|import|switch|delete|status>  认证管理');
    console.log('  codexmate add-model <模型> 添加模型');
    console.log('  codexmate delete-model <模型> 删除模型');
    console.log('  codexmate workflow <list|get|validate|run|runs>  MCP 工作流中心');
    console.log('  codexmate analytics export [--format csv|json] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--model <MODEL>] [--output <PATH|->] [-o <PATH|->]  导出 Usage 数据');
    console.log('  codexmate run [--host <HOST>] [--no-browser]    启动 Web 界面');
    console.log('  codexmate update [--check] 检查并快速更新工具');
    console.log('  codexmate codex [参数...] [--follow-up <文本>|--queued-follow-up <文本> 可重复]  等同于 codex --yolo');
    console.log('    注: follow-up 自动排队仅支持 linux/android/netbsd/openbsd/darwin/freebsd 且 stdin 必须是 TTY，其他平台会报错');
    console.log('  codexmate qwen [参数...]   等同于 qwen --yolo');
    console.log('  codexmate mcp [serve] [--transport stdio] [--allow-write|--read-only]');
    console.log('  codexmate export-session --source <codex|claude|gemini|codebuddy|pi> (--session-id <ID>|--file <PATH>) [--output <PATH>] [--max-messages <N|all|Infinity>]');
    console.log('  codexmate convert-session --from <codex|claude> --to <codex|claude> (--session-id <ID>|--file <PATH>) [--output <PATH>] [--max-messages <N|all|Infinity>]');
    console.log('  codexmate zip <路径> [--max:级别]  压缩（系统 zip 优先，其次 zip-lib）');
    console.log('  codexmate unzip <zip文件> [输出目录]  解压（zip-lib）');
    console.log('  codexmate unzip-ext <zip目录> [输出目录] [--ext:后缀[,后缀...]] [--no-recursive]  批量提取 ZIP 指定后缀文件（默认递归）');
    console.log('');
}

// ============================================================================
// 主程序
// ============================================================================
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const isMcpCommand = command === 'mcp';
    const shouldGateInitialBootstrap = command === 'run' || isMcpCommand;
    const bootstrap = ensureManagedConfigBootstrap({
        allowWrite: shouldGateInitialBootstrap ? isToolConfigWriteAllowed('codex') : true
    });
    if (bootstrap && bootstrap.notice) {
        // MCP stdio transport requires stdout to be protocol-clean.
        if (!isMcpCommand) {
            console.log(`\n[Init] ${bootstrap.notice}`);
        }
    }

    if (args.length === 0 || command === '--help' || command === '-h' || command === 'help') {
        printMainHelp();
        process.exit(0);
    }

    const parseAddCommandArgs = (argv = []) => {
        const name = argv[0];
        const url = argv[1];
        let key = '';
        let cursor = 2;
        if (cursor < argv.length && argv[cursor] && !String(argv[cursor]).startsWith('--')) {
            key = String(argv[cursor]);
            cursor += 1;
        }
        let bridge = '';
        while (cursor < argv.length) {
            const token = String(argv[cursor] || '');
            if (token === '--bridge') {
                const nextValue = String(argv[cursor + 1] || '');
                if (!nextValue || nextValue.startsWith('--')) {
                    throw new Error('错误: --bridge 需要一个值（例如: --bridge openai）');
                }
                bridge = nextValue;
                cursor += 2;
                continue;
            }
            if (token === '--transform') {
                // legacy alias; equals openai bridge for now
                bridge = 'openai';
                cursor += 1;
                continue;
            }
            cursor += 1;
        }
        return { name, url, key, bridge };
    };

    switch (command) {
        case 'status': cmdStatus(); break;
        case 'doctor': await cmdDoctor(args.slice(1)); break;
        case 'import-skills': await cmdImportSkills(args.slice(1)); break;
        case 'setup': await cmdSetup(); break;
        case 'list': cmdList(); break;
        case 'models': await cmdModels(); break;
        case 'switch': cmdSwitch(args[1]); break;
        case 'use': cmdUseModel(args[1]); break;
        case 'add': {
            const parsed = parseAddCommandArgs(args.slice(1));
            cmdAdd(parsed.name, parsed.url, parsed.key, false, { bridge: parsed.bridge });
            break;
        }
        case 'delete': cmdDelete(args[1]); break;
        case 'claude': {
            const exitCode = await cmdClaude(args.slice(1));
            process.exit(exitCode);
        }
        case 'kilo':
        case 'kilocode': {
            const exitCode = await cmdKilocode(args.slice(1));
            process.exit(exitCode || 0);
        }
        case 'add-model': cmdAddModel(args[1]); break;
        case 'delete-model': cmdDeleteModel(args[1]); break;
        case 'auth': cmdAuth(args.slice(1)); break;
        case 'proxy': await cmdProxy(args.slice(1)); break;
        case 'workflow': await cmdWorkflow(args.slice(1)); break;
        case 'analytics': await cmdAnalytics(args.slice(1)); break;
        case 'run': await cmdStart(parseStartOptions(args.slice(1))); break;
        case 'update': await cmdToolUpdate(args.slice(1)); break;
        case 'start':
            console.error('错误: 命令已更名为 "run"，请使用: codexmate run');
            process.exit(1);
        case 'codex': {
            const exitCode = await cmdCodex(args.slice(1));
            process.exit(exitCode);
        }
        case 'qwen': {
            const exitCode = await cmdQwen(args.slice(1));
            process.exit(exitCode);
        }
        case 'mcp': await cmdMcp(args.slice(1)); break;
        case 'export-session': await cmdExportSession(args.slice(1)); break;
        case 'convert-session': await cmdConvertSession(args.slice(1), { resolveSessionFilePath }); break;
        case 'zip': {
            const { targetPath, options } = parseZipCommandArgs(args.slice(1));
            await cmdZip(targetPath, options);
            break;
        }
        case 'unzip': await cmdUnzip(args[1], args[2]); break;
        case 'unzip-ext': {
            const { zipDirPath, outputDir, options } = parseUnzipExtCommandArgs(args.slice(1));
            await cmdUnzipExt(zipDirPath, outputDir, options);
            break;
        }
        default:
            console.error('错误: 未知命令:', command);
            console.log('运行 "codexmate" 查看帮助');
            process.exit(1);
    }
}

main().catch((err) => {
    console.error('错误:', err && err.message ? err.message : err);
    process.exit(1);
});
