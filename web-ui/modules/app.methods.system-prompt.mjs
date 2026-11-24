import {
    buildAgentsDiffPreview,
    buildAgentsDiffPreviewRequest,
    isAgentsDiffPreviewPayloadTooLarge,
    shouldApplyAgentsDiffPreviewResponse
} from '../logic.mjs';
import { issueLatestRequestToken, isLatestRequestToken } from './request-token.mjs';

export function createSystemPromptMethods(options = {}) {
    const {
        api,
        apiWithMeta
    } = options;

    return {

        currentSysPromptFileName() {
            return this.sysPromptFileName || (this.sysPromptMode === 'append' ? 'APPEND_SYSTEM.md' : 'SYSTEM.md');
        },

        isSysPromptCustomFile() {
            return !['SYSTEM.md', 'APPEND_SYSTEM.md'].includes(this.currentSysPromptFileName());
        },

        sysPromptTargetParams() {
            return {
                scope: this.sysPromptScope || 'global', mode: this.sysPromptMode || 'append',
                ...(this.sysPromptFileName ? { fileName: this.sysPromptFileName } : {})
            };
        },

        canSwitchSysPromptTarget() {
            if (this.sysPromptLoading || this.sysPromptSaving || this.sysPromptDiffVisible) return false;
            if (!this.hasSysPromptContentChanged()) return true;
            this.showMessage(this.t('sysPrompt.fileUnsaved'), 'info');
            return false;
        },

        async loadSystemPromptFiles() {
            if (this.sysPromptFilesLoading) return;
            const scope = this.sysPromptScope || 'global';
            const token = issueLatestRequestToken(this, '_sysPromptFilesRequestToken');
            this.sysPromptFilesLoading = true;
            try {
                const result = await api('list-system-prompt-files', { scope });
                if (!isLatestRequestToken(this, '_sysPromptFilesRequestToken', token) || scope !== this.sysPromptScope) return;
                if (result.error) throw new Error(result.error);
                this.sysPromptFiles = result.files;
                const isListed = result.files.some(file => file.filename === this.currentSysPromptFileName());
                if (!isListed) this.sysPromptFileMissing = true;
                this.sysPromptFilesError = !isListed ? this.t('sysPrompt.fileMissing')
                    : (this.sysPromptFileMissing ? this.sysPromptFilesError : '');
            } catch (error) {
                if (isLatestRequestToken(this, '_sysPromptFilesRequestToken', token) && scope === this.sysPromptScope) {
                    this.sysPromptFilesError = error.message || this.t('toast.load.fail');
                }
            } finally {
                if (isLatestRequestToken(this, '_sysPromptFilesRequestToken', token)) this.sysPromptFilesLoading = false;
            }
        },

        switchSysPromptFileName(filename, event) {
            if (event) event.target.value = this.currentSysPromptFileName();
            if (filename === this.currentSysPromptFileName() || !this.canSwitchSysPromptTarget()) return;
            if (!this.sysPromptFiles.some(file => file.filename === filename)) return;
            this.sysPromptFileName = filename;
            if (filename === 'SYSTEM.md') this.sysPromptMode = 'system';
            if (filename === 'APPEND_SYSTEM.md') this.sysPromptMode = 'append';
            this.closeSysHistory();
            this.loadSystemPrompt();
        },

        switchSysPromptScope(scope) {
            if (!this.canSwitchSysPromptTarget()) return;
            const normalized = scope === 'project' ? scope : 'global';
            if (normalized === this.sysPromptScope) return;
            this.sysPromptScope = normalized;
            this.sysPromptFileName = '';
            this.sysPromptFiles = [];
            this._sysPromptFilesRequestToken = null;
            this.sysPromptFilesLoading = false;
            this.closeSysHistory();
            this.loadSystemPromptFiles();
            this.loadSystemPrompt();
        },

        switchSysPromptMode(mode) {
            if (!this.canSwitchSysPromptTarget()) return;
            const normalized = mode === 'system' ? mode : 'append';
            if (normalized === this.sysPromptMode) return;
            this.sysPromptMode = normalized;
            this.sysPromptFileName = normalized === 'system' ? 'SYSTEM.md' : 'APPEND_SYSTEM.md';
            this.closeSysHistory();
            this.loadSystemPrompt();
        },

        resetSysPromptDiffState() {
            this.sysPromptDiffVisible = false;
            this.sysPromptDiffLoading = false;
            this.sysPromptDiffError = '';
            this.sysPromptDiffLines = [];
            this.sysPromptDiffStats = { added: 0, removed: 0, unchanged: 0 };
            this.sysPromptDiffTruncated = false;
            this.sysPromptDiffHasChangesValue = false;
            this.sysPromptDiffFingerprint = '';
            this._sysPromptDiffPreviewRequestToken = null;
        },

        hasSysPromptContentChanged() {
            const original = typeof this.sysPromptOriginalContent === 'string' ? this.sysPromptOriginalContent : '';
            const current = typeof this.sysPromptContent === 'string' ? this.sysPromptContent : '';
            return original !== current;
        },

        buildSysPromptDiffFingerprint() {
            const scope = this.sysPromptScope || 'global';
            const mode = this.sysPromptMode || 'append';
            const content = typeof this.sysPromptContent === 'string' ? this.sysPromptContent : '';
            const original = typeof this.sysPromptOriginalContent === 'string' ? this.sysPromptOriginalContent : '';
            return `${scope}::${mode}::${this.currentSysPromptFileName()}::${content.length}::${content}::${original.length}::${original}`;
        },

        async loadSystemPrompt() {
            const requestToken = issueLatestRequestToken(this, '_sysPromptOpenRequestToken');
            const filename = this.currentSysPromptFileName();
            this.sysPromptLoading = true;
            this.sysPromptFileMissing = true;
            this.resetSysPromptDiffState();
            try {
                const params = this.sysPromptTargetParams();
                const res = await api('get-system-prompt', params);
                if (!isLatestRequestToken(this, '_sysPromptOpenRequestToken', requestToken)
                    || params.scope !== this.sysPromptScope || filename !== this.currentSysPromptFileName()) return;
                if (res.error || (this.isSysPromptCustomFile() && !res.exists)) {
                    this.sysPromptFileMissing = true;
                    this.sysPromptFilesError = res.error || this.t('sysPrompt.fileMissing');
                    this.showMessage(this.sysPromptFilesError, 'error');
                    return;
                }
                this.sysPromptFileName = res.filename || this.currentSysPromptFileName();
                this.sysPromptFileMissing = false;
                this.sysPromptFilesError = '';
                this.sysPromptContent = res.content || '';
                this.sysPromptOriginalContent = this.sysPromptContent;
                this.sysPromptPath = res.path || '';
                this.sysPromptExists = !!res.exists;
                this.sysPromptHash = res.hash || '';
                this.sysHistoryBucket = res.historyBucket || '';
            } catch (e) {
                if (!isLatestRequestToken(this, '_sysPromptOpenRequestToken', requestToken)) return;
                this.sysPromptFileMissing = true;
                this.sysPromptFilesError = this.t('toast.load.fail');
                this.showMessage(this.sysPromptFilesError, 'error');
            } finally {
                if (isLatestRequestToken(this, '_sysPromptOpenRequestToken', requestToken)) {
                    this.sysPromptLoading = false;
                }
            }
        },

        async prepareSysPromptDiff() {
            const requestFingerprint = this.buildSysPromptDiffFingerprint();
            const requestToken = Symbol('sys-prompt-diff-preview');
            this._sysPromptDiffPreviewRequestToken = requestToken;
            this.sysPromptDiffVisible = true;
            this.sysPromptDiffLoading = true;
            this.sysPromptDiffError = '';
            this.sysPromptDiffLines = [];
            this.sysPromptDiffStats = { added: 0, removed: 0, unchanged: 0 };
            this.sysPromptDiffTruncated = false;
            this.sysPromptDiffHasChangesValue = false;
            try {
                const shouldApplyPreviewState = () => shouldApplyAgentsDiffPreviewResponse({
                    isVisible: this.sysPromptDiffVisible,
                    requestToken,
                    activeRequestToken: this._sysPromptDiffPreviewRequestToken,
                    requestFingerprint,
                    currentFingerprint: this.buildSysPromptDiffFingerprint()
                });
                const applyPreviewState = (diff) => {
                    if (!shouldApplyPreviewState()) return false;
                    const normalizedDiff = diff && typeof diff === 'object' ? diff : {};
                    const rawLines = Array.isArray(normalizedDiff.lines) ? normalizedDiff.lines : [];
                    this.sysPromptDiffLines = rawLines.filter(line => line && line.type);
                    this.sysPromptDiffTruncated = !!normalizedDiff.truncated;
                    this.sysPromptDiffHasChangesValue = !!normalizedDiff.hasChanges;
                    if (normalizedDiff.stats && typeof normalizedDiff.stats === 'object') {
                        this.sysPromptDiffStats = {
                            added: Number(normalizedDiff.stats.added || 0),
                            removed: Number(normalizedDiff.stats.removed || 0),
                            unchanged: Number(normalizedDiff.stats.unchanged || 0)
                        };
                    } else {
                        const stats = { added: 0, removed: 0, unchanged: 0 };
                        for (const line of this.sysPromptDiffLines) {
                            if (line && line.type === 'add') stats.added += 1;
                            else if (line && line.type === 'del') stats.removed += 1;
                            else stats.unchanged += 1;
                        }
                        this.sysPromptDiffStats = stats;
                    }
                    this.sysPromptDiffFingerprint = requestFingerprint;
                    return true;
                };
                const previewRequest = buildAgentsDiffPreviewRequest({
                    baseContent: this.sysPromptOriginalContent,
                    content: this.sysPromptContent,
                    lineEnding: '\n',
                    context: 'sys-prompt',
                    baseDir: undefined
                });
                if (previewRequest.exceedsBodyLimit) {
                    applyPreviewState(buildAgentsDiffPreview({
                        baseContent: this.sysPromptOriginalContent,
                        content: this.sysPromptContent
                    }));
                    return;
                }
                const rpcParams = {
                    ...previewRequest.params,
                    ...this.sysPromptTargetParams()
                };
                const res = await apiWithMeta('preview-system-prompt-diff', rpcParams);
                if (!shouldApplyPreviewState()) return;
                if (res.error) {
                    if (isAgentsDiffPreviewPayloadTooLarge(res)) {
                        applyPreviewState(buildAgentsDiffPreview({
                            baseContent: this.sysPromptOriginalContent,
                            content: this.sysPromptContent
                        }));
                        return;
                    }
                    this.sysPromptDiffError = res.error;
                    return;
                }
                applyPreviewState(res.diff);
            } catch (e) {
                if (shouldApplyAgentsDiffPreviewResponse({
                    isVisible: this.sysPromptDiffVisible,
                    requestToken,
                    activeRequestToken: this._sysPromptDiffPreviewRequestToken,
                    requestFingerprint,
                    currentFingerprint: this.buildSysPromptDiffFingerprint()
                })) {
                    this.sysPromptDiffError = '生成差异失败';
                }
            } finally {
                if (this._sysPromptDiffPreviewRequestToken === requestToken) {
                    this.sysPromptDiffLoading = false;
                }
            }
        },

        cancelSysPromptEdit() {
            if (this.sysPromptSaving || this.sysPromptDiffLoading) return;
            this.resetSysPromptDiffState();
            this.loadSystemPrompt();
        },

        async applySystemPrompt() {
            if (this.sysPromptSaving || this.sysPromptFileMissing) return;
            if (!this.sysPromptDiffVisible) {
                if (!this.hasSysPromptContentChanged()) {
                    this.showMessage(this.t('toast.noChanges'), 'info');
                    return;
                }
                await this.prepareSysPromptDiff();
                return;
            }
            if (this.sysPromptDiffLoading) return;
            if (this.sysPromptDiffError) {
                this.showMessage(this.sysPromptDiffError, 'error');
                return;
            }
            const fingerprint = this.buildSysPromptDiffFingerprint();
            if (this.sysPromptDiffFingerprint !== fingerprint) {
                await this.prepareSysPromptDiff();
                return;
            }
            if (!this.sysPromptDiffHasChangesValue) {
                this.showMessage(this.t('toast.noChanges'), 'info');
                return;
            }
            this.sysPromptSaving = true;
            try {
                const params = {
                    ...this.sysPromptTargetParams(),
                    content: this.sysPromptContent,
                    baseHash: this.sysPromptHash
                };
                const res = await api('apply-system-prompt', params);
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                if (typeof res.historyBucket === 'string' && res.historyBucket) {
                    this.sysHistoryBucket = res.historyBucket;
                }
                this.showMessage(this.t('sysPrompt.toast.saved'), 'success');
                await this.loadSystemPrompt();
            } catch (e) {
                this.showMessage(this.t('toast.save.fail'), 'error');
            } finally {
                this.sysPromptSaving = false;
            }
        },

        copySysPromptContent() {
            const content = typeof this.sysPromptContent === 'string' ? this.sysPromptContent : '';
            if (!content) return;
            try {
                navigator.clipboard?.writeText(content);
                this.showMessage(this.t('common.copy'), 'success');
            } catch (_) {}
        },

        exportSysPromptContent() {
            const content = typeof this.sysPromptContent === 'string' ? this.sysPromptContent : '';
            if (!content) return;
            const filename = this.sysPromptFileName || (this.sysPromptMode === 'system' ? 'SYSTEM.md' : 'APPEND_SYSTEM.md');
            this.downloadTextFile(filename, content, 'text/markdown;charset=utf-8');
        },

        async pasteSysPromptContent() {
            if (this.sysPromptLoading || this.sysPromptSaving || this.sysPromptDiffVisible) return;
            try {
                const text = await navigator.clipboard.readText();
                if (text) {
                    this.sysPromptContent = text;
                    this.showMessage(this.t('common.paste'), 'success');
                }
            } catch (_) {}
        },

        sysPromptContextHint() {
            if (!this.sysPromptLoading && !this.sysPromptDiffVisible && this.hasSysPromptContentChanged()) {
                return { text: this.t('sysPrompt.hint.unsaved'), warn: true };
            }
            if (this.sysPromptDiffVisible && (this.sysPromptDiffLoading || this.sysPromptSaving)) {
                return { text: this.t('diff.hint.busy'), warn: false };
            }
            if (this.sysPromptDiffVisible && this.sysPromptDiffError) {
                return { text: this.t('diff.hint.failedBack'), warn: false };
            }
            if (this.sysPromptDiffVisible && !this.sysPromptDiffHasChangesValue) {
                return { text: this.t('diff.hint.noChangesBack'), warn: false };
            }
            if (this.sysPromptDiffVisible && this.sysPromptDiffTruncated) {
                return { text: this.t('diff.viewHint.truncated'), warn: false };
            }
            if (this.sysPromptDiffVisible) {
                return { text: this.t('diff.viewHint.preview'), warn: false };
            }
            if (!this.sysPromptLoading) {
                return { text: this.t('sysPrompt.hint.twoStepSave'), warn: false };
            }
            return null;
        },

        resolveSysHistoryBucket() {
            if (typeof this.sysHistoryBucket === 'string' && this.sysHistoryBucket) {
                return this.sysHistoryBucket;
            }
            if (this.isSysPromptCustomFile()) return '';
            const scope = this.sysPromptScope || 'global';
            return 'system_' + scope + '_global';
        },

        async openSysHistory() {
            if (this.sysHistoryLoading) return;
            const bucket = this.resolveSysHistoryBucket();
            if (!bucket || this.sysPromptFileMissing) return;
            this.sysHistoryVisible = true;
            this.sysHistoryError = '';
            await this.loadSysHistory(bucket);
        },

        async loadSysHistory(bucketArg) {
            if (this.sysHistoryLoading) return;
            const bucket = typeof bucketArg === 'string' && bucketArg.trim()
                ? bucketArg.trim()
                : this.resolveSysHistoryBucket();
            this.sysHistoryBucket = bucket;
            const requestToken = Symbol('history-list');
            this._sysHistoryRequestToken = requestToken;
            this.sysHistoryLoading = true;
            this.sysHistoryError = '';
            this.sysHistoryItems = [];
            this.sysHistoryPreviewId = '';
            this.sysHistoryPreviewContent = '';
            try {
                const res = await api('list-prompt-history', { bucket });
                if (this._sysHistoryRequestToken !== requestToken || !this.sysHistoryVisible || this.sysHistoryBucket !== bucket) return;
                if (res && res.error) {
                    this.sysHistoryError = res.error;
                    return;
                }
                this.sysHistoryItems = Array.isArray(res) ? res : [];
            } catch (e) {
                if (this._sysHistoryRequestToken !== requestToken) return;
                this.sysHistoryError = this.t('toast.load.fail');
            } finally {
                if (this._sysHistoryRequestToken === requestToken) this.sysHistoryLoading = false;
            }
        },

        closeSysHistory() {
            this.sysHistoryVisible = false;
            this._sysHistoryRequestToken = null;
            this.sysHistoryLoading = false;
            this.sysHistoryPreviewId = '';
            this.sysHistoryPreviewContent = '';
            this.sysHistoryError = '';
        },

        async viewSysHistoryItem(item) {
            if (!item || !item.id) return;
            if (this.sysHistoryLoading) return;
            if (this.sysHistoryPreviewId === item.id && this.sysHistoryPreviewContent) return;
            const bucket = this.sysHistoryBucket;
            const requestToken = Symbol('history-preview');
            this._sysHistoryRequestToken = requestToken;
            this.sysHistoryLoading = true;
            this.sysHistoryPreviewId = item.id;
            this.sysHistoryPreviewContent = '';
            try {
                const res = await api('get-prompt-history', { bucket, id: item.id });
                if (this._sysHistoryRequestToken !== requestToken || !this.sysHistoryVisible || this.sysHistoryBucket !== bucket) return;
                if (res && res.error) {
                    this.sysHistoryError = res.error;
                    this.sysHistoryPreviewId = '';
                    return;
                }
                this.sysHistoryPreviewContent = typeof res.content === 'string' ? res.content : '';
            } catch (e) {
                if (this._sysHistoryRequestToken !== requestToken) return;
                this.sysHistoryError = this.t('toast.load.fail');
                this.sysHistoryPreviewId = '';
            } finally {
                if (this._sysHistoryRequestToken === requestToken) this.sysHistoryLoading = false;
            }
        },

        applySysHistoryToEditor() {
            if (!this.sysHistoryPreviewContent) return;
            if (this.sysPromptSaving || this.sysPromptDiffVisible) return;
            this.sysPromptContent = this.sysHistoryPreviewContent;
            this.sysHistoryVisible = false;
            this.sysHistoryPreviewId = '';
            this.sysHistoryPreviewContent = '';
            this.showMessage(this.t('toast.history.restored'), 'success');
        }
    };
}
