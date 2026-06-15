import {
    buildAgentsDiffPreview,
    buildAgentsDiffPreviewRequest,
    isAgentsDiffPreviewPayloadTooLarge,
    shouldApplyAgentsDiffPreviewResponse
} from '../logic.mjs';

function isValidOpenclawWorkspaceFileName(fileName) {
    if (typeof fileName !== 'string') {
        return false;
    }
    const normalized = fileName.trim();
    if (!normalized || !normalized.endsWith('.md')) {
        return false;
    }
    if (normalized.startsWith('/') || normalized.includes('\\') || normalized.includes('/') || normalized.includes('..')) {
        return false;
    }
    return true;
}

function issueLatestRequestToken(context, key) {
    const token = (Number(context[key]) || 0) + 1;
    context[key] = token;
    return token;
}

function isLatestRequestToken(context, key, token) {
    return !!context && context[key] === token;
}

export function createAgentsMethods(options = {}) {
    const {
        api,
        apiWithMeta
    } = options;

    return {
        async openClaudeMdEditor() {
            this.setAgentsModalContext('claude-project');
            const requestToken = issueLatestRequestToken(this, '_agentsOpenRequestToken');
            this.agentsLoading = true;
            try {
                const rpcParams = {};
                var projectPath = (this.projectClaudeMdPath || '').trim();
                if (projectPath) {
                    rpcParams.baseDir = projectPath;
                }
                const res = await api('get-claude-md-file', rpcParams);
                if (!isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    return;
                }
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                this.agentsContent = res.content || '';
                this.agentsOriginalContent = this.agentsContent;
                this.agentsPath = res.path || '';
                this.agentsExists = !!res.exists;
                this.agentsLineEnding = res.lineEnding === '\r\n' ? '\r\n' : '\n';
                this.resetAgentsDiffState();
                this.showAgentsModal = true;
            } catch (e) {
                if (!isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    return;
                }
                this.showMessage(this.t('toast.load.fail'), 'error');
            } finally {
                if (isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    this.agentsLoading = false;
                }
            }
        },

        async openAgentsEditor() {
            this.setAgentsModalContext('codex');
            const requestToken = issueLatestRequestToken(this, '_agentsOpenRequestToken');
            this.agentsLoading = true;
            try {
                const res = await api('get-agents-file');
                if (!isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    return;
                }
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                this.agentsContent = res.content || '';
                this.agentsOriginalContent = this.agentsContent;
                this.agentsPath = res.path || '';
                this.agentsExists = !!res.exists;
                this.agentsLineEnding = res.lineEnding === '\r\n' ? '\r\n' : '\n';
                this.resetAgentsDiffState();
                this.showAgentsModal = true;
            } catch (e) {
                if (!isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    return;
                }
                this.showMessage(this.t('toast.load.fail'), 'error');
            } finally {
                if (isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    this.agentsLoading = false;
                }
            }
        },

        async openOpenclawAgentsEditor() {
            this.setAgentsModalContext('openclaw');
            const requestToken = issueLatestRequestToken(this, '_agentsOpenRequestToken');
            this.agentsLoading = true;
            try {
                const res = await api('get-openclaw-agents-file');
                if (!isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    return;
                }
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                if (res.configError) {
                    this.showMessage(`OpenClaw 配置解析失败，已使用默认 Workspace：${res.configError}`, 'error');
                }
                this.agentsContent = res.content || '';
                this.agentsOriginalContent = this.agentsContent;
                this.agentsPath = res.path || '';
                this.agentsExists = !!res.exists;
                this.agentsLineEnding = res.lineEnding === '\r\n' ? '\r\n' : '\n';
                this.resetAgentsDiffState();
                this.showAgentsModal = true;
            } catch (e) {
                if (!isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    return;
                }
                this.showMessage(this.t('toast.load.fail'), 'error');
            } finally {
                if (isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    this.agentsLoading = false;
                }
            }
        },

        async openOpenclawWorkspaceEditor() {
            const fileName = (this.openclawWorkspaceFileName || '').trim();
            if (!fileName) {
                this.showMessage('请输入文件名', 'error');
                return;
            }
            if (!isValidOpenclawWorkspaceFileName(fileName)) {
                this.showMessage('仅支持 OpenClaw Workspace 内的 `.md` 文件', 'error');
                return;
            }
            this.setAgentsModalContext('openclaw-workspace', { fileName });
            const requestToken = issueLatestRequestToken(this, '_agentsOpenRequestToken');
            this.agentsLoading = true;
            try {
                const res = await api('get-openclaw-workspace-file', { fileName });
                if (!isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    return;
                }
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                if (res.configError) {
                    this.showMessage(`OpenClaw 配置解析失败，已使用默认 Workspace：${res.configError}`, 'error');
                }
                this.agentsContent = res.content || '';
                this.agentsOriginalContent = this.agentsContent;
                this.agentsPath = res.path || '';
                this.agentsExists = !!res.exists;
                this.agentsLineEnding = res.lineEnding === '\r\n' ? '\r\n' : '\n';
                this.resetAgentsDiffState();
                this.showAgentsModal = true;
            } catch (e) {
                if (!isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    return;
                }
                this.showMessage(this.t('toast.load.fail'), 'error');
            } finally {
                if (isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    this.agentsLoading = false;
                }
            }
        },

        setAgentsModalContext(context, options = {}) {
            const t = typeof this.t === 'function' ? this.t : null;
            const tr = (key, fallback, params = null) => (t ? t(key, params) : fallback);
            if (context === 'claude-project') {
                var projectPath = (options.projectPath || this.projectClaudeMdPath || '').trim();
                this.agentsContext = 'claude-project';
                this.agentsWorkspaceFileName = '';
                this.projectClaudeMdPath = projectPath;
                if (projectPath) {
                    this.agentsModalTitle = tr('modal.agents.title.claudeProject', 'Project CLAUDE.md: ' + projectPath, { path: projectPath });
                    this.agentsModalHint = tr('modal.agents.hint.claudeProject', 'Saved content will be written to CLAUDE.md in: ' + projectPath, { path: projectPath });
                } else {
                    this.agentsModalTitle = tr('modal.agents.title.claudeProjectGlobal', 'Global CLAUDE.md');
                    this.agentsModalHint = tr('modal.agents.hint.claudeProjectGlobal', 'Saved content will be written to ~/.claude/CLAUDE.md.');
                }
                return;
            }
            if (context === 'openclaw-workspace') {
                const fileName = (options.fileName || this.openclawWorkspaceFileName || 'AGENTS.md').trim();
                this.agentsContext = 'openclaw-workspace';
                this.agentsWorkspaceFileName = fileName;
                this.agentsModalTitle = tr('modal.agents.title.openclawWorkspaceFile', `OpenClaw 工作区文件: ${fileName}`, { fileName });
                this.agentsModalHint = tr('modal.agents.hint.openclawWorkspaceFile', `保存后会写入 OpenClaw Workspace 下的 ${fileName}。`, { fileName });
                return;
            }
            this.agentsContext = context === 'openclaw' ? 'openclaw' : 'codex';
            if (this.agentsContext === 'openclaw') {
                this.agentsModalTitle = tr('modal.agents.title.openclaw', 'OpenClaw AGENTS.md 编辑器');
                this.agentsModalHint = tr('modal.agents.hint.openclaw', '保存后会写入 OpenClaw Workspace 下的 AGENTS.md。');
            } else {
                this.agentsModalTitle = tr('modal.agents.title.default', 'AGENTS.md 编辑器');
                this.agentsModalHint = tr('modal.agents.hint.default', '保存后会写入目标 AGENTS.md（与 config.toml 同级）。');
            }
            this.agentsWorkspaceFileName = '';
        },

        resetAgentsDiffState() {
            this.agentsDiffVisible = false;
            this.agentsDiffLoading = false;
            this.agentsDiffError = '';
            this.agentsDiffLines = [];
            this.agentsDiffStats = {
                added: 0,
                removed: 0,
                unchanged: 0
            };
            this.agentsDiffTruncated = false;
            this.agentsDiffHasChangesValue = false;
            this.agentsDiffFingerprint = '';
            this._agentsDiffPreviewRequestToken = null;
        },
        handleGlobalKeydown(event) {
            if (!event) {
                return;
            }
            const isCmdLike = !!(event.metaKey || event.ctrlKey);
            const key = typeof event.key === 'string' ? event.key : '';
            const isSearchHotkey = isCmdLike && !event.altKey && (key === 'k' || key === 'K');
            if (isSearchHotkey) {
                const target = event.target;
                const tag = target && target.tagName ? String(target.tagName).toUpperCase() : '';
                const isTypingTarget = !!(
                    tag === 'INPUT'
                    || tag === 'TEXTAREA'
                    || tag === 'SELECT'
                    || (target && target.isContentEditable)
                );
                if (!isTypingTarget) {
                    event.preventDefault();
                    event.stopPropagation();
                    try {
                        const focusSelector = (() => {
                            if (this.showSkillsModal) return '.skills-filter-row input.form-input';
                            if (this.mainTab === 'sessions') return '#panel-sessions .session-query-input';
                            if (this.mainTab === 'plugins' && this.pluginsActiveId === 'prompt-templates' && this.promptTemplatesMode !== 'compose') {
                                return '#panel-plugins .prompt-templates-toolbar input.form-input';
                            }
                            return '';
                        })();
                        if (focusSelector) {
                            const el = document.querySelector(focusSelector);
                            if (el && typeof el.focus === 'function') {
                                el.focus();
                                if (typeof el.select === 'function') {
                                    el.select();
                                }
                            }
                        }
                    } catch (_) {}
                }
                return;
            }
            if (key !== 'Escape') {
                return;
            }
            if (this.showConfirmDialog) {
                event.preventDefault();
                event.stopPropagation();
                this.resolveConfirmDialog(false);
                return;
            }
            if (this.showSkillsModal && typeof this.closeSkillsModal === 'function') {
                event.preventDefault();
                event.stopPropagation();
                this.closeSkillsModal();
                return;
            }
            if (this.showOpenclawConfigModal && typeof this.closeOpenclawConfigModal === 'function') {
                event.preventDefault();
                event.stopPropagation();
                this.closeOpenclawConfigModal();
                return;
            }
            if (this.showConfigTemplateModal && typeof this.closeConfigTemplateModal === 'function') {
                event.preventDefault();
                event.stopPropagation();
                this.closeConfigTemplateModal();
                return;
            }
            if (this.showEditConfigModal && typeof this.closeEditConfigModal === 'function') {
                event.preventDefault();
                event.stopPropagation();
                this.closeEditConfigModal();
                return;
            }
            if (this.showClaudeConfigModal && typeof this.closeClaudeConfigModal === 'function') {
                event.preventDefault();
                event.stopPropagation();
                this.closeClaudeConfigModal();
                return;
            }
            if (this.showModelModal && typeof this.closeModelModal === 'function') {
                event.preventDefault();
                event.stopPropagation();
                this.closeModelModal();
                return;
            }
            if (this.showAddModal && typeof this.closeAddModal === 'function') {
                event.preventDefault();
                event.stopPropagation();
                this.closeAddModal();
                return;
            }
            if (this.showEditModal && typeof this.closeEditModal === 'function') {
                event.preventDefault();
                event.stopPropagation();
                this.closeEditModal();
                return;
            }
            if (!this.showAgentsModal) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            if (this.agentsSaving || this.agentsDiffLoading) {
                return;
            }
            if (this.agentsDiffVisible) {
                this.resetAgentsDiffState();
                return;
            }
            this.closeAgentsModal();
        },
        hasPendingAgentsDraft() {
            if (!this.showAgentsModal || this.agentsLoading) {
                return false;
            }
            return !!this.agentsSaving || this.hasAgentsContentChanged() || this.agentsDiffVisible;
        },
        handleBeforeUnload(event) {
            if (!this.hasPendingAgentsDraft()) {
                return;
            }
            if (event && typeof event.preventDefault === 'function') {
                event.preventDefault();
                event.returnValue = '';
            }
            return '';
        },
        hasAgentsContentChanged() {
            const original = typeof this.agentsOriginalContent === 'string' ? this.agentsOriginalContent : '';
            const current = typeof this.agentsContent === 'string' ? this.agentsContent : '';
            return original !== current;
        },
        requestConfirmDialog(options = {}) {
            if (typeof this.confirmDialogResolver === 'function') {
                this.confirmDialogResolver(false);
            }
            const confirmDisabled = options.confirmDisabled;
            const t = typeof this.t === 'function' ? this.t : null;
            this.confirmDialogTitle = typeof options.title === 'string' && options.title.trim()
                ? options.title.trim()
                : (t ? t('confirm.title.default') : '请确认操作');
            this.confirmDialogMessage = typeof options.message === 'string' ? options.message : '';
            this.confirmDialogConfirmText = typeof options.confirmText === 'string' && options.confirmText.trim()
                ? options.confirmText.trim()
                : (t ? t('confirm.ok') : '确认');
            this.confirmDialogCancelText = typeof options.cancelText === 'string' && options.cancelText.trim()
                ? options.cancelText.trim()
                : (t ? t('confirm.cancel') : '取消');
            this.confirmDialogDanger = !!options.danger;
            this.confirmDialogConfirmDisabled = typeof confirmDisabled === 'function' ? false : !!confirmDisabled;
            this.confirmDialogDisableWhen = typeof confirmDisabled === 'function' ? confirmDisabled : null;
            this.showConfirmDialog = true;
            return new Promise((resolve) => {
                this.confirmDialogResolver = resolve;
            });
        },
        isConfirmDialogDisabled() {
            if (typeof this.confirmDialogDisableWhen === 'function') {
                try {
                    return !!this.confirmDialogDisableWhen.call(this);
                } catch (_) {
                    return true;
                }
            }
            return !!this.confirmDialogConfirmDisabled;
        },
        resolveConfirmDialog(confirmed) {
            const resolver = typeof this.confirmDialogResolver === 'function'
                ? this.confirmDialogResolver
                : null;
            this.showConfirmDialog = false;
            this.confirmDialogTitle = '';
            this.confirmDialogMessage = '';
            if (typeof this.t === 'function') {
                this.confirmDialogConfirmText = this.t('confirm.ok');
                this.confirmDialogCancelText = this.t('confirm.cancel');
            } else {
                this.confirmDialogConfirmText = '确认';
                this.confirmDialogCancelText = '取消';
            }
            this.confirmDialogDanger = false;
            this.confirmDialogConfirmDisabled = false;
            this.confirmDialogDisableWhen = null;
            this.confirmDialogResolver = null;
            if (resolver) {
                resolver(!!confirmed);
            }
        },
        closeConfirmDialog() {
            this.resolveConfirmDialog(false);
        },
        onAgentsContentInput() {
            if (this.agentsDiffVisible || this.agentsDiffLines.length) {
                this.resetAgentsDiffState();
            }
        },
        selectProjectClaudeMdPath(pathValue) {
            this.projectClaudeMdPath = (pathValue || '').trim();
            if (this.promptsSubTab === 'claude-project' && this.mainTab === 'prompts') {
                this.loadPromptsContent();
            }
        },
        setProjectClaudeMdPathManual(pathValue) {
            var trimmed = (pathValue || '').trim();
            if (trimmed === (this.projectClaudeMdPath || '').trim()) {
                return;
            }
            this.projectClaudeMdPath = trimmed;
            if (this.promptsSubTab === 'claude-project' && this.mainTab === 'prompts') {
                this.loadPromptsContent();
            }
        },
        async loadProjectPathOptions() {
            if (this.projectPathOptionsLoading) {
                return;
            }
            this.projectPathOptionsLoading = true;
            try {
                const res = await api('list-session-paths', { source: 'claude', limit: 100 });
                if (res && Array.isArray(res.paths)) {
                    this.projectPathOptions = res.paths
                        .map(function (p) { return (p && p.cwd) || p || ''; })
                        .filter(Boolean)
                        .filter(function (v, i, a) { return a.indexOf(v) === i; });
                }
            } catch (_) {
                // silent
            } finally {
                this.projectPathOptionsLoading = false;
            }
        },
        async pasteAgentsContent() {
            if (this.agentsLoading || this.agentsSaving || this.agentsDiffVisible) {
                return;
            }
            let text = '';
            try {
                text = await navigator.clipboard.readText();
            } catch (_) {
                this.showMessage('无法读取剪贴板', 'error');
                return;
            }
            if (typeof text !== 'string' || !text) {
                this.showMessage('剪贴板为空', 'info');
                return;
            }
            this.agentsContent = text;
            this.onAgentsContentInput();
            this.showMessage('已粘贴', 'success');
        },
        buildAgentsDiffFingerprint() {
            const context = this.agentsContext || 'codex';
            const fileName = context === 'openclaw-workspace'
                ? (this.agentsWorkspaceFileName || '')
                : '';
            const projectPath = context === 'claude-project' ? (this.projectClaudeMdPath || '') : '';
            const lineEnding = this.agentsLineEnding || '\n';
            const content = typeof this.agentsContent === 'string' ? this.agentsContent : '';
            const original = typeof this.agentsOriginalContent === 'string' ? this.agentsOriginalContent : '';
            return `${context}::${fileName}::${projectPath}::${lineEnding}::${content.length}::${content}::${original.length}::${original}`;
        },
        async prepareAgentsDiff() {
            const requestFingerprint = this.buildAgentsDiffFingerprint();
            const requestToken = Symbol('agents-diff-preview');
            this._agentsDiffPreviewRequestToken = requestToken;
            this.agentsDiffVisible = true;
            this.agentsDiffLoading = true;
            this.agentsDiffError = '';
            this.agentsDiffLines = [];
            this.agentsDiffStats = {
                added: 0,
                removed: 0,
                unchanged: 0
            };
            this.agentsDiffTruncated = false;
            this.agentsDiffHasChangesValue = false;
            try {
                const shouldApplyPreviewState = () => shouldApplyAgentsDiffPreviewResponse({
                    isVisible: this.agentsDiffVisible,
                    requestToken,
                    activeRequestToken: this._agentsDiffPreviewRequestToken,
                    requestFingerprint,
                    currentFingerprint: this.buildAgentsDiffFingerprint()
                });
                const applyPreviewState = (diff) => {
                    if (!shouldApplyPreviewState()) {
                        return false;
                    }
                    const normalizedDiff = diff && typeof diff === 'object' ? diff : {};
                    const rawLines = Array.isArray(normalizedDiff.lines) ? normalizedDiff.lines : [];
                    this.agentsDiffLines = rawLines.filter(line => line && line.type);
                    this.agentsDiffTruncated = !!normalizedDiff.truncated;
                    this.agentsDiffHasChangesValue = !!normalizedDiff.hasChanges;
                    if (normalizedDiff.stats && typeof normalizedDiff.stats === 'object') {
                        this.agentsDiffStats = {
                            added: Number(normalizedDiff.stats.added || 0),
                            removed: Number(normalizedDiff.stats.removed || 0),
                            unchanged: Number(normalizedDiff.stats.unchanged || 0)
                        };
                    } else {
                        const stats = { added: 0, removed: 0, unchanged: 0 };
                        for (const line of this.agentsDiffLines) {
                            if (line && line.type === 'add') stats.added += 1;
                            else if (line && line.type === 'del') stats.removed += 1;
                            else stats.unchanged += 1;
                        }
                        this.agentsDiffStats = stats;
                    }
                    this.agentsDiffFingerprint = requestFingerprint;
                    return true;
                };
                const previewRequest = buildAgentsDiffPreviewRequest({
                    baseContent: this.agentsOriginalContent,
                    content: this.agentsContent,
                    lineEnding: this.agentsLineEnding,
                    context: this.agentsContext,
                    fileName: this.agentsWorkspaceFileName,
                    baseDir: this.agentsContext === 'claude-project' ? this.projectClaudeMdPath : undefined
                });
                if (previewRequest.exceedsBodyLimit) {
                    applyPreviewState(buildAgentsDiffPreview({
                        baseContent: this.agentsOriginalContent,
                        content: this.agentsContent
                    }));
                    return;
                }
                const res = await apiWithMeta('preview-agents-diff', previewRequest.params);
                if (!shouldApplyPreviewState()) {
                    return;
                }
                if (res.error) {
                    if (isAgentsDiffPreviewPayloadTooLarge(res)) {
                        applyPreviewState(buildAgentsDiffPreview({
                            baseContent: this.agentsOriginalContent,
                            content: this.agentsContent
                        }));
                        return;
                    }
                    this.agentsDiffError = res.error;
                    return;
                }
                applyPreviewState(res.diff);
            } catch (e) {
                if (shouldApplyAgentsDiffPreviewResponse({
                    isVisible: this.agentsDiffVisible,
                    requestToken,
                    activeRequestToken: this._agentsDiffPreviewRequestToken,
                    requestFingerprint,
                    currentFingerprint: this.buildAgentsDiffFingerprint()
                })) {
                    this.agentsDiffError = '生成差异失败';
                }
            } finally {
                if (this._agentsDiffPreviewRequestToken === requestToken) {
                    this.agentsDiffLoading = false;
                }
            }
        },

        async closeAgentsModal(options = {}) {
            const force = !!(options && options.force);
            if (!force && (this.agentsSaving || this.agentsDiffLoading)) {
                return;
            }
            const shouldConfirmClose = !force
                && this.hasPendingAgentsDraft();
            if (shouldConfirmClose) {
                const message = this.agentsDiffVisible
                    ? '当前处于差异预览模式，改动尚未保存。确认放弃改动并关闭吗？'
                    : '存在未保存改动，确认放弃改动并关闭吗？（关闭页面或应用也会丢失改动）';
                const confirmed = await this.requestConfirmDialog({
                    title: '放弃未保存改动',
                    message,
                    confirmText: '放弃并关闭',
                    cancelText: '继续编辑',
                    danger: true
                });
                if (!confirmed) {
                    return;
                }
            }
            issueLatestRequestToken(this, '_agentsOpenRequestToken');
            this.agentsLoading = false;
            this.showAgentsModal = false;
            this.agentsContent = '';
            this.agentsOriginalContent = '';
            this.agentsPath = '';
            this.agentsExists = false;
            this.agentsLineEnding = '\n';
            this.agentsSaving = false;
            this.agentsWorkspaceFileName = '';
            this.resetAgentsDiffState();
            this.setAgentsModalContext('codex');
        },

        async applyAgentsContent() {
            if (this.agentsSaving) {
                return;
            }
            if (!this.agentsDiffVisible) {
                if (!this.hasAgentsContentChanged()) {
                    this.showMessage(this.t('toast.noChanges'), 'info');
                    return;
                }
                await this.prepareAgentsDiff();
                return;
            }
            if (this.agentsDiffLoading) {
                return;
            }
            if (this.agentsDiffError) {
                this.showMessage(this.agentsDiffError, 'error');
                return;
            }
            const fingerprint = this.buildAgentsDiffFingerprint();
            if (this.agentsDiffFingerprint !== fingerprint) {
                await this.prepareAgentsDiff();
                return;
            }
            if (!this.agentsDiffHasChanges) {
                this.showMessage('未检测到改动', 'info');
                return;
            }
            if (this.agentsContext === 'openclaw-workspace' && !isValidOpenclawWorkspaceFileName(this.agentsWorkspaceFileName)) {
                this.showMessage('仅支持 OpenClaw Workspace 内的 `.md` 文件', 'error');
                return;
            }
            this.agentsSaving = true;
            try {
                let action = 'apply-agents-file';
                const params = {
                    content: this.agentsContent,
                    lineEnding: this.agentsLineEnding
                };
                if (this.agentsContext === 'claude-project') {
                    action = 'apply-claude-md-file';
                    const projectPath = (this.projectClaudeMdPath || '').trim();
                    if (projectPath) {
                        params.baseDir = projectPath;
                    }
                } else if (this.agentsContext === 'openclaw') {
                    action = 'apply-openclaw-agents-file';
                } else if (this.agentsContext === 'openclaw-workspace') {
                    action = 'apply-openclaw-workspace-file';
                    params.fileName = this.agentsWorkspaceFileName;
                }
                const res = await api(action, params);
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                const successLabel = this.agentsContext === 'openclaw-workspace'
                    ? this.t('toast.agents.saved.workspace', { name: this.agentsWorkspaceFileName || '' }).replace(/:\s*$/, '')
                    : (this.agentsContext === 'claude-project'
                        ? this.t('toast.agents.saved.claudeProject')
                        : (this.agentsContext === 'openclaw' ? this.t('toast.agents.saved.openclaw') : this.t('toast.agents.saved.agents')));
                this.showMessage(successLabel, 'success');
                if (this.mainTab === 'prompts') {
                    this.loadPromptsContent();
                } else {
                    this.closeAgentsModal({ force: true });
                }
            } catch (e) {
                this.showMessage(this.t('toast.save.fail'), 'error');
            } finally {
                this.agentsSaving = false;
            }
        },

        switchPromptsSubTab(subTab) {
            const normalized = subTab === 'claude-project' ? 'claude-project' : 'codex';
            if (normalized === 'claude-project' && !this.projectPathOptions.length && !this.projectPathOptionsLoading) {
                this.loadProjectPathOptions();
            }
            if (this.promptsSubTab === normalized) {
                this.loadPromptsContent();
                return;
            }
            this.promptsSubTab = normalized;
        },

        async loadPromptsContent() {
            const requestToken = issueLatestRequestToken(this, '_agentsOpenRequestToken');
            this.agentsLoading = true;
            this.resetAgentsDiffState();
            try {
                const subTab = this.promptsSubTab;
                let action;
                const rpcParams = {};
                if (subTab === 'claude-project') {
                    action = 'get-claude-md-file';
                    if (!this.projectPathOptions.length && !this.projectPathOptionsLoading && typeof this.loadProjectPathOptions === 'function') {
                        this.loadProjectPathOptions();
                    }
                    const projectPath = (this.projectClaudeMdPath || '').trim();
                    if (projectPath) {
                        rpcParams.baseDir = projectPath;
                    }
                } else {
                    action = 'get-agents-file';
                }
                const res = await api(action, rpcParams);
                if (!isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    return;
                }
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                this.agentsContent = res.content || '';
                this.agentsOriginalContent = this.agentsContent;
                this.agentsPath = res.path || '';
                this.agentsExists = !!res.exists;
                this.agentsLineEnding = res.lineEnding === '\r\n' ? '\r\n' : '\n';
                this.agentsContext = subTab === 'claude-project' ? 'claude-project' : 'codex';
            } catch (e) {
                if (!isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    return;
                }
                this.showMessage(this.t('toast.load.fail'), 'error');
            } finally {
                if (isLatestRequestToken(this, '_agentsOpenRequestToken', requestToken)) {
                    this.agentsLoading = false;
                }
            }
        }
    };
}
