const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn, exec } = require('child_process');
const toml = require('@iarna/toml');

// --- APP CONFIG ---
const TARGET_PORT = 8893;
const APP_NAME = "Codex Switcher Pro";

// 默认配置模版
const DEFAULT_CONFIG_CONTENT = `# Codex Configuration File
model_provider = "88code"
disable_response_storage = true

[model_providers.88code]
name = "88code"
base_url = "https://www.88code.ai/openai/v1"
wire_api = "responses"
requires_openai_auth = false
preferred_auth_method = ""
request_max_retries = 4
`;

// ==========================================
// [配置] 预设模板
// ==========================================
const PRESET_TEMPLATES = {
    "88code": {
        name: "88code",
        base_url: "https://www.88code.ai/openai/v1",
        wire_api: "responses",
        requires_openai_auth: false,
        request_max_retries: 4,
        stream_max_retries: 10,
        stream_idle_timeout_ms: 300000,
        preferred_auth_method: "" 
    }
};

// ==========================================
// 1. 管理员权限检查
// ==========================================
function checkAndElevate() {
    try {
        execSync('net session', { stdio: 'ignore' });
        console.log('[系统] ✅ 已获得管理员权限');
        return true;
    } catch (e) {
        console.log('[系统] ⚠️ 正在申请管理员权限...');
        const currentPath = process.execPath;
        const vbsPath = path.join(os.tmpdir(), 'codex_elevate.vbs');
        const vbsContent = `Set UAC = CreateObject("Shell.Application")\nUAC.ShellExecute "${currentPath}", "", "", "runas", 1`;

        try {
            fs.writeFileSync(vbsPath, vbsContent, { encoding: 'utf8' });
            const child = spawn('wscript', [vbsPath], { detached: true, stdio: 'ignore' });
            child.unref();
            setTimeout(() => process.exit(0), 1000);
        } catch (err) {
            process.exit(1);
        }
        throw new Error('ELEVATING'); 
    }
}

// ==========================================
// 2. 环境清理
// ==========================================
function cleanupEnvironment() {
    try {
        const stdout = execSync(`netstat -ano | findstr :${TARGET_PORT}`, { encoding: 'utf-8' });
        stdout.split('\n').forEach(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length > 4) {
                const pid = parts[parts.length - 1];
                if (pid && pid !== '0') execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            }
        });
    } catch (e) {}
}

// ==========================================
// 3. 路径解析与健壮性初始化
// ==========================================
function resolvePaths() {
    const homeDir = os.homedir();
    const codexPath = path.join(homeDir, '.codex');
    const localPath = process.cwd();
    
    let targetDir = codexPath;

    // 优先检测本地
    if (fs.existsSync(path.join(localPath, 'config.toml'))) {
        targetDir = localPath;
    } else {
        // 尝试创建 .codex
        if (!fs.existsSync(codexPath)) {
            try { fs.mkdirSync(codexPath, { recursive: true }); } 
            catch (e) { targetDir = localPath; }
        }
    }

    const configPath = path.join(targetDir, 'config.toml');
    const authPath = path.join(targetDir, 'auth.json');

    // 自动创建默认文件
    if (!fs.existsSync(configPath)) {
        try { fs.writeFileSync(configPath, DEFAULT_CONFIG_CONTENT, 'utf-8'); } catch (e) {}
    }
    if (!fs.existsSync(authPath)) {
        try { fs.writeFileSync(authPath, '{}', 'utf-8'); } catch (e) {}
    }
    
    return { config: configPath, auth: authPath, baseDir: targetDir };
}

// ==========================================
// 4. [核心修复] 强制同步 Auth 数据
// ==========================================
function syncAuthWithConfig(paths) {
    try {
        if (!fs.existsSync(paths.config)) return;
        const configRaw = fs.readFileSync(paths.config, 'utf-8');
        const config = toml.parse(configRaw);
        
        const currentProviderName = config.model_provider;
        if (!currentProviderName || !config.model_providers || !config.model_providers[currentProviderName]) {
            return;
        }

        const targetKey = config.model_providers[currentProviderName].preferred_auth_method || "";

        let authData = {};
        let needRewrite = false;

        if (fs.existsSync(paths.auth)) {
            try {
                const authContent = fs.readFileSync(paths.auth, 'utf-8');
                if (authContent.trim()) {
                    authData = JSON.parse(authContent);
                } else {
                    needRewrite = true;
                }
            } catch (e) {
                authData = {};
                needRewrite = true;
            }
        } else {
            needRewrite = true;
        }

        if (authData["OPENAI_API_KEY"] !== targetKey) {
            authData["OPENAI_API_KEY"] = targetKey;
            needRewrite = true;
        }

        if (needRewrite) {
            fs.writeFileSync(paths.auth, JSON.stringify(authData, null, 2), 'utf-8');
            console.log(`[同步] 已强制同步 auth.json`);
        }
    } catch (e) {
        console.error('[同步失败]', e.message);
    }
}

function updateAuthJson(authPath, apiKey) {
    let authData = {};
    if (fs.existsSync(authPath)) {
        try {
            const content = fs.readFileSync(authPath, 'utf-8');
            if (content.trim()) authData = JSON.parse(content);
        } catch (err) {}
    }
    authData["OPENAI_API_KEY"] = apiKey;
    try { fs.writeFileSync(authPath, JSON.stringify(authData, null, 2), 'utf-8'); } catch(e){}
}

try {
    cleanupEnvironment();
    const PATHS = resolvePaths();
    syncAuthWithConfig(PATHS);
    startServer(PATHS);
} catch (e) {
    if (e.message !== 'ELEVATING') console.error(e);
}

// ==========================================
// 5. HTTP 服务 (Zen-iOS UI)
// ==========================================
function startServer(PATHS) {
    const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${APP_NAME}</title>
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #F2F2F7;
            --bg-card: rgba(255, 255, 255, 0.72);
            --bg-input: #E5E5EA;
            --border-glass: rgba(255, 255, 255, 0.6);
            --border-outer: rgba(0, 0, 0, 0.05);
            --color-primary: #1C1C1E;
            --color-text-main: #1C1C1E;
            --color-text-sub: #8E8E93;
            --shadow-float: 0 24px 48px -12px rgba(0, 0, 0, 0.12), 0 8px 16px -4px rgba(0,0,0,0.04);
            --shadow-inner: inset 0 2px 4px 0 rgba(0,0,0,0.06);
            --radius-xl: 32px;
            --radius-lg: 20px;
            --radius-md: 12px;
        }

        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
            background-color: var(--bg-base);
            color: var(--color-text-main);
            margin: 0;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 40px 20px;
            box-sizing: border-box;
            -webkit-font-smoothing: antialiased;
        }

        .glass-panel {
            background: var(--bg-card);
            backdrop-filter: blur(50px);
            -webkit-backdrop-filter: blur(50px);
            border-radius: var(--radius-xl);
            box-shadow: 
                inset 0 1px 0 0 var(--border-glass), 
                0 0 0 1px var(--border-outer),
                var(--shadow-float);
            width: 100%;
            max-width: 580px;
            padding: 40px;
            position: relative;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .header { display: flex; justify-content: space-between; align-items: center; }
        h1 { font-weight: 800; font-size: 24px; letter-spacing: -0.03em; margin: 0; color: var(--color-primary); }
        .micro-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--color-text-sub); margin-bottom: 8px; display: block; }

        .status-slot { background: var(--bg-input); border-radius: var(--radius-md); padding: 16px; box-shadow: var(--shadow-inner); display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .status-value { font-weight: 600; color: #007AFF; font-size: 15px; }
        .path-text { font-family: 'SF Mono', 'Menlo', monospace; font-size: 11px; color: var(--color-text-sub); opacity: 0.8; word-break: break-all; text-align: center; }

        .provider-list { display: flex; flex-direction: column; gap: 12px; max-height: 50vh; overflow-y: auto; padding: 4px; }
        .provider-list::-webkit-scrollbar { width: 0; }

        .tile {
            background: #FFFFFF; border-radius: var(--radius-lg); padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; position: relative;
            box-shadow: 0 2px 8px rgba(0,0,0,0.02), 0 0 0 1px rgba(0,0,0,0.04); transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .tile:hover { transform: translateY(-1px); box-shadow: 0 8px 16px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04); }
        .tile:active { transform: scale(0.98); }
        .tile.active { box-shadow: 0 0 0 2px var(--color-primary), 0 8px 20px rgba(0,0,0,0.1); }

        .tile-content { display: flex; align-items: center; gap: 12px; flex-grow: 1; }
        .indicator { width: 8px; height: 8px; border-radius: 50%; background: #E5E5EA; transition: 0.3s; }
        .tile.active .indicator { background: #34C759; box-shadow: 0 0 8px rgba(52, 199, 89, 0.4); }
        .tile-name { font-weight: 600; font-size: 15px; letter-spacing: -0.01em; }

        .key-wrapper { position: relative; z-index: 2; }
        .key-badge { background: #F2F2F7; padding: 6px 12px; border-radius: 8px; font-family: 'SF Mono', monospace; font-size: 11px; color: var(--color-text-sub); border: 1px solid transparent; transition: 0.2s; }
        .key-badge:hover { background: #E5E5EA; color: var(--color-text-main); }
        .key-input { background: #F2F2F7; border: none; border-radius: 8px; padding: 6px 10px; font-family: 'SF Mono', monospace; font-size: 11px; width: 140px; color: var(--color-text-main); box-shadow: var(--shadow-inner); outline: none; }
        .key-input:focus { box-shadow: inset 0 0 0 2px #007AFF; }

        .btn-icon { width: 36px; height: 36px; border-radius: 12px; border: none; background: var(--color-primary); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; font-size: 20px; }
        .btn-icon:hover { opacity: 0.85; transform: translateY(-1px); }
        .btn-icon:active { transform: scale(0.92); }

        .btn-del { color: #FF3B30; opacity: 0; font-weight: 600; padding: 4px 10px; font-size: 12px; transition: 0.2s; margin-left: 8px; }
        .tile:hover .btn-del { opacity: 1; }
        .btn-del:hover { background: #FFE5E5; border-radius: 6px; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(242, 242, 247, 0.6); backdrop-filter: blur(20px); z-index: 100; display: flex; justify-content: center; align-items: center; animation: fadeIn 0.3s ease; }
        .modal { background: #FFFFFF; width: 90%; max-width: 400px; border-radius: 28px; padding: 32px; box-shadow: 0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05); animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }

        .form-group { margin-bottom: 20px; }
        .form-input { width: 100%; padding: 14px 16px; background: #F2F2F7; border: none; border-radius: 14px; font-size: 15px; color: var(--color-text-main); box-shadow: var(--shadow-inner); box-sizing: border-box; outline: none; transition: 0.2s; }
        .form-input:focus { background: #FFFFFF; box-shadow: 0 0 0 2px #007AFF, 0 4px 12px rgba(0,122,255,0.1); }

        .btn-group { display: flex; gap: 12px; margin-top: 32px; }
        .btn { flex: 1; padding: 16px; border-radius: 16px; border: none; font-size: 15px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .btn:active { transform: scale(0.96); }
        .btn-cancel { background: #F2F2F7; color: var(--color-text-sub); }
        .btn-confirm { background: var(--color-primary); color: white; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .btn-preset { width: 100%; background: linear-gradient(135deg, #007AFF, #5856D6); color: white; margin-bottom: 24px; font-weight: 600; letter-spacing: 0.02em; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleUp { from { transform: scale(0.92); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .toast { position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%); background: rgba(28, 28, 30, 0.85); backdrop-filter: blur(12px); color: white; padding: 12px 24px; border-radius: 50px; font-size: 14px; font-weight: 500; box-shadow: 0 10px 30px rgba(0,0,0,0.15); z-index: 200; }
        .toast.error { background: rgba(255, 59, 48, 0.9); }
    </style>
</head>
<body>
    <div id="app" class="glass-panel">
        <header class="header">
            <div>
                <h1>Model Switcher</h1>
                <span class="micro-label" style="margin-top:4px;">PRO CONFIGURATION TOOL</span>
            </div>
            <button class="btn-icon" @click="openModal" title="Create New">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
        </header>
        
        <div class="status-slot">
            <span class="micro-label">Active Provider</span>
            <div class="status-value">{{ currentProvider || 'NOT DETECTED' }}</div>
            <div class="path-text">{{ configPath }}</div>
        </div>

        <div v-if="loading" style="text-align:center; padding:40px; color:var(--color-text-sub);">
            Loading configuration...
        </div>

        <div v-else-if="initError" style="text-align:center; padding:20px; color:#FF3B30; font-weight:500;">
            {{ initError }}
            <div style="font-size:12px; margin-top:8px; color:var(--color-text-sub);">Please check the file manually</div>
        </div>

        <div v-else class="provider-list">
            <div v-for="(info, name) in providers" :key="name" 
                 :class="['tile', { active: currentProvider === name }]"
            >
                <div class="tile-content" @click="switchProvider(name)">
                    <div class="indicator"></div>
                    <span class="tile-name">{{ name }}</span>
                </div>
                
                <div class="tile-actions" style="display:flex; align-items:center;">
                    <div class="key-wrapper" @dblclick.stop="startEdit(name, info.preferred_auth_method)">
                        <input v-if="editingProvider === name" 
                               v-model="editValue" 
                               class="key-input" 
                               ref="editInput"
                               @click.stop 
                               @keyup.enter="saveEdit(name)" 
                               @keyup.esc="cancelEdit" 
                               @blur="saveEdit(name)"
                               placeholder="Enter API Key">
                        <div v-else class="key-badge" title="Double click to edit">
                            {{ info.auth_method_preview }}
                        </div>
                    </div>
                    <div class="btn-del" @click.stop="deleteProvider(name)">DELETE</div>
                </div>
            </div>
        </div>

        <div v-if="showAddModal" class="modal-overlay">
            <div class="modal">
                <div style="margin-bottom:24px;">
                    <h2 style="margin:0; font-size:20px; font-weight:700;">Add Provider</h2>
                    <span class="micro-label" style="margin-top:8px; color:#8E8E93;">CONFIGURATION SETUP</span>
                </div>
                
                <button class="btn btn-preset" @click="fillTemplate('88code')">
                    Apply 88code Template
                </button>
                
                <div class="form-group">
                    <span class="micro-label">IDENTIFIER NAME</span>
                    <input v-model="newProvider.name" class="form-input" placeholder="e.g. gpt-4-turbo">
                </div>
                <div class="form-group">
                    <span class="micro-label">API ENDPOINT</span>
                    <input v-model="newProvider.base_url" class="form-input" placeholder="https://api.example.com/v1">
                </div>
                <div class="form-group">
                    <span class="micro-label">AUTHENTICATION KEY</span>
                    <input v-model="newProvider.api_key" class="form-input" placeholder="sk-...">
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-cancel" @click="showAddModal = false">Cancel</button>
                    <button class="btn btn-confirm" @click="addProvider">Confirm</button>
                </div>
            </div>
        </div>

        <div v-if="message" :class="['toast', messageType]">{{ message }}</div>
    </div>

    <script>
        const { createApp, nextTick } = Vue;
        createApp({
            data() {
                return {
                    currentProvider: '',
                    providers: {},
                    configPath: '',
                    loading: true,
                    initError: '',
                    message: '',
                    messageType: '',
                    editingProvider: null,
                    editValue: '',
                    showAddModal: false,
                    newProvider: { name: '', base_url: '', api_key: '', from_template: null }
                }
            },
            mounted() { this.fetchConfig(); },
            methods: {
                openModal() { this.showAddModal = true; },
                
                async fetchConfig() {
                    this.loading = true;
                    this.initError = '';
                    try {
                        const res = await fetch('/api/config');
                        const data = await res.json();
                        if(data.error) {
                            this.initError = 'Config File Error: ' + data.error;
                        } else {
                            this.currentProvider = data.current;
                            this.providers = data.providers;
                            this.configPath = data.path;
                        }
                    } catch (e) { this.showMessage(e.message, 'error'); } 
                    finally { this.loading = false; }
                },
                
                async fillTemplate(templateName) {
                    try {
                        const res = await fetch('/api/get-template?name=' + templateName);
                        const data = await res.json();
                        if (data.success) {
                            this.newProvider.name = data.template.name;
                            this.newProvider.base_url = data.template.base_url;
                            this.newProvider.api_key = data.template.preferred_auth_method;
                            this.newProvider.from_template = templateName;
                            this.showMessage('Template applied');
                        }
                    } catch(e) { this.showMessage('Failed to load template', 'error'); }
                },

                async addProvider() {
                    if(!this.newProvider.name || !this.newProvider.base_url) return this.showMessage('Name & URL required', 'error');
                    this.loading = true;
                    try {
                        const res = await fetch('/api/add', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify(this.newProvider)
                        });
                        const ret = await res.json();
                        if(ret.success) {
                            this.showMessage('Provider added');
                            this.showAddModal = false;
                            this.newProvider = { name: '', base_url: '', api_key: '', from_template: null };
                            await this.fetchConfig();
                        } else throw new Error(ret.error);
                    } catch(e) { this.showMessage(e.message, 'error'); }
                    finally { this.loading = false; }
                },

                async deleteProvider(name) {
                    if(!confirm(\`Delete configuration "\${name}"?\`)) return;
                    this.loading = true;
                    try {
                        const res = await fetch('/api/delete', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ provider: name })
                        });
                        const ret = await res.json();
                        if(ret.success) {
                            this.showMessage('Deleted successfully');
                            await this.fetchConfig();
                        } else throw new Error(ret.error);
                    } catch(e) { this.showMessage(e.message, 'error'); }
                    finally { this.loading = false; }
                },

                async switchProvider(targetName) {
                    if (this.editingProvider) return;
                    this.loading = true;
                    try {
                        const res = await fetch('/api/switch', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ provider: targetName })
                        });
                        const result = await res.json();
                        if (result.success) {
                            this.currentProvider = targetName;
                            this.showMessage(\`Switched to \${targetName}\`);
                        } else throw new Error(result.error);
                    } catch (e) { this.showMessage(e.message, 'error'); } finally { this.loading = false; }
                },

                startEdit(name, currentVal) { 
                    this.editingProvider = name; 
                    this.editValue = currentVal; 
                    nextTick(() => { if (this.$refs.editInput && this.$refs.editInput[0]) this.$refs.editInput[0].focus(); }); 
                },
                cancelEdit() { this.editingProvider = null; this.editValue = ''; },
                async saveEdit(name) {
                    if (this.editingProvider !== name) return;
                    const newValue = this.editValue.trim();
                    if (newValue === this.providers[name].preferred_auth_method) { this.cancelEdit(); return; }
                    try {
                        const res = await fetch('/api/update-key', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ provider: name, newKey: newValue })
                        });
                        if ((await res.json()).success) {
                            this.providers[name].preferred_auth_method = newValue;
                            let preview = newValue || 'N/A';
                            if (preview.length > 12) preview = preview.substring(0, 4) + '...' + preview.substring(preview.length - 4);
                            else if (preview.length > 8) preview = preview.substring(0, 8) + '...';
                            this.providers[name].auth_method_preview = preview;
                            this.showMessage('API Key updated');
                        }
                    } catch (e) { this.showMessage(e.message, 'error'); } 
                    finally { this.cancelEdit(); }
                },
                showMessage(text, type = 'info') { 
                    this.message = text; 
                    this.messageType = type;
                    setTimeout(() => this.message = '', 3000); 
                }
            }
        }).mount('#app');
    </script>
</body>
</html>
`;

    const server = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        const sendJSON = (data, status = 200) => {
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
        };

        try {
            if (req.method === 'GET' && req.url === '/') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(HTML_TEMPLATE);
                return;
            }

            if (!fs.existsSync(PATHS.config)) {
                if (req.url.startsWith('/api')) return sendJSON({ error: `Config file missing: ${PATHS.config}` }, 500);
                res.writeHead(500, {'Content-Type': 'text/plain;charset=utf-8'});
                return res.end(`Critical Error: Config file not found.\nPath: ${PATHS.config}`);
            }

            // --- API Handlers ---
            if (req.method === 'GET' && req.url === '/api/config') {
                try {
                    const configRaw = fs.readFileSync(PATHS.config, 'utf-8');
                    const config = toml.parse(configRaw);
                    const providers = {};
                    if (config.model_providers) {
                        for (const [key, val] of Object.entries(config.model_providers)) {
                            let preview = val.preferred_auth_method || 'N/A';
                            if (preview.length > 12) preview = preview.substring(0, 4) + '...' + preview.substring(preview.length - 4);
                            else if (preview.length > 8) preview = preview.substring(0, 8) + '...';
                            providers[key] = { preferred_auth_method: val.preferred_auth_method || '', auth_method_preview: preview };
                        }
                    }
                    sendJSON({ current: config.model_provider || '', providers, path: PATHS.config });
                } catch (e) { sendJSON({ error: "Malformed content (Invalid TOML)" }); }
                return;
            }

            if (req.method === 'GET' && req.url.startsWith('/api/get-template')) {
                const url = new URL(req.url, `http://127.0.0.1:${TARGET_PORT}`);
                const name = url.searchParams.get('name');
                if (PRESET_TEMPLATES[name]) {
                    sendJSON({ success: true, template: PRESET_TEMPLATES[name] });
                } else {
                    sendJSON({ success: false, error: 'Template not found' });
                }
                return;
            }

            if (req.method === 'POST' && req.url === '/api/switch') {
                let body = ''; req.on('data', c => body += c);
                req.on('end', () => {
                    try {
                        const { provider } = JSON.parse(body);
                        const configRaw = fs.readFileSync(PATHS.config, 'utf-8');
                        const config = toml.parse(configRaw);
                        if (!config.model_providers?.[provider]) throw new Error(`Provider does not exist`);
                        
                        const newRaw = configRaw.replace(/^(model_provider\s*=\s*)(["']).*?(["'])/m, `$1$2${provider}$3`);
                        fs.writeFileSync(PATHS.config, newRaw, 'utf-8');
                        
                        // [关键点]：切换后，强制更新 Auth 数据
                        const authKey = config.model_providers[provider].preferred_auth_method;
                        updateAuthJson(PATHS.auth, authKey);
                        
                        sendJSON({ success: true });
                    } catch (e) { sendJSON({ error: e.message }, 500); }
                });
                return;
            }

            if (req.method === 'POST' && req.url === '/api/update-key') {
                let body = ''; req.on('data', c => body += c);
                req.on('end', () => {
                    try {
                        const { provider, newKey } = JSON.parse(body);
                        const configRaw = fs.readFileSync(PATHS.config, 'utf-8');
                        const safeName = provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const sectionRegex = new RegExp(`\\[\\s*model_providers\\s*\\.\\s*${safeName}\\s*\\]`);
                        const match = configRaw.match(sectionRegex);
                        if (!match) throw new Error('Section not found');
                        
                        const startIdx = match.index + match[0].length;
                        const rest = configRaw.slice(startIdx);
                        const nextIdx = rest.indexOf('[');
                        const scope = nextIdx === -1 ? rest : rest.slice(0, nextIdx);
                        
                        const keyRegex = /(preferred_auth_method\s*=\s*)(["']).*?(["'])/;
                        const keyMatch = scope.match(keyRegex);
                        if (!keyMatch) throw new Error('Key field missing in config');

                        const absStart = startIdx + keyMatch.index;
                        const newRaw = configRaw.slice(0, absStart) + `${keyMatch[1]}${keyMatch[2]}${newKey}${keyMatch[3]}` + configRaw.slice(absStart + keyMatch[0].length);
                        fs.writeFileSync(PATHS.config, newRaw, 'utf-8');

                        try {
                            const newParsed = toml.parse(newRaw);
                            if (newParsed.model_provider === provider) updateAuthJson(PATHS.auth, newKey);
                        } catch (e) { }
                        
                        sendJSON({ success: true });
                    } catch (e) { sendJSON({ error: e.message }, 500); }
                });
                return;
            }

            if (req.method === 'POST' && req.url === '/api/add') {
                let body = ''; req.on('data', c => body += c);
                req.on('end', () => {
                    try {
                        const { name, base_url, api_key, from_template } = JSON.parse(body);
                        const configRaw = fs.readFileSync(PATHS.config, 'utf-8');
                        const config = toml.parse(configRaw);
                        
                        if (config.model_providers && config.model_providers[name]) throw new Error(`Provider "${name}" exists`);

                        let defaults = { wire_api: "responses", requires_openai_auth: false, request_max_retries: 4, stream_max_retries: 10, stream_idle_timeout_ms: 300000 };
                        if (from_template && PRESET_TEMPLATES[from_template]) {
                            const t = PRESET_TEMPLATES[from_template];
                            defaults = { ...defaults, ...t };
                        }

                        const newBlock = `
[model_providers.${name}]
name = "${name}"
base_url = "${base_url}"
wire_api = "${defaults.wire_api}"
requires_openai_auth = ${defaults.requires_openai_auth}
preferred_auth_method = "${api_key}"
request_max_retries = ${defaults.request_max_retries}
stream_max_retries = ${defaults.stream_max_retries}
stream_idle_timeout_ms = ${defaults.stream_idle_timeout_ms}
`;
                        const appendRaw = configRaw.trimEnd() + "\n" + newBlock;
                        fs.writeFileSync(PATHS.config, appendRaw, 'utf-8');
                        sendJSON({ success: true });
                    } catch (e) { sendJSON({ error: e.message }, 500); }
                });
                return;
            }

            if (req.method === 'POST' && req.url === '/api/delete') {
                let body = ''; req.on('data', c => body += c);
                req.on('end', () => {
                    try {
                        const { provider } = JSON.parse(body);
                        const configRaw = fs.readFileSync(PATHS.config, 'utf-8');
                        
                        const safeName = provider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const sectionRegex = new RegExp(`\\[\\s*model_providers\\s*\\.\\s*${safeName}\\s*\\]`);
                        const match = configRaw.match(sectionRegex);
                        if (!match) throw new Error(`Provider block not found`);

                        const startIdx = match.index;
                        const rest = configRaw.slice(startIdx + match[0].length);
                        const nextSectionRelativeIdx = rest.indexOf('[');
                        let endIdx = nextSectionRelativeIdx === -1 ? configRaw.length : (startIdx + match[0].length + nextSectionRelativeIdx);

                        const newRaw = configRaw.slice(0, startIdx) + configRaw.slice(endIdx);
                        fs.writeFileSync(PATHS.config, newRaw.trim(), 'utf-8');
                        sendJSON({ success: true });
                    } catch (e) { sendJSON({ error: e.message }, 500); }
                });
                return;
            }
            res.writeHead(404); res.end();
        } catch (err) { console.error(err); sendJSON({ error: 'Internal Error' }, 500); }
    });

    server.listen(TARGET_PORT, '127.0.0.1', () => {
        console.log(`\n🚀 ${APP_NAME} 已启动`);
        console.log(`👉 http://localhost:${TARGET_PORT}`);
        exec(`start http://localhost:${TARGET_PORT}`);
    });
}
