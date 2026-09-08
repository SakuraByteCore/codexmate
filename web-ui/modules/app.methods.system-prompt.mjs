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

        switchSysPromptScope(scope) {
            if (this.sysPromptLoading || this.sysPromptSaving) return;
            const normalized = scope === 'project' ? scope : 'global';
            if (normalized === this.sysPromptScope) return;
            this.sysPromptScope = normalized;
            this.loadSystemPrompt();
        },

        switchSysPromptMode(mode) {
            if (this.sysPromptLoading || this.sysPromptSaving) return;
            const normalized = mode === 'system' ? mode : 'append';
            if (normalized === this.sysPromptMode) return;
            this.sysPromptMode = normalized;
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
            return `${scope}::${mode}::${content.length}::${content}::${original.length}::${original}`;
        },

        async loadSystemPrompt() {
            const requestToken = issueLatestRequestToken(this, '_sysPromptOpenRequestToken');
            this.sysPromptLoading = true;
            this.resetSysPromptDiffState();
            try {
                const params = {
                    scope: this.sysPromptScope || 'global',
                    mode: this.sysPromptMode || 'append'
                };
                const res = await api('get-system-prompt', params);
                if (!isLatestRequestToken(this, '_sysPromptOpenRequestToken', requestToken)) return;
                if (res.error) {
                    this.showMessage(res.error, 'error');
                    return;
                }
                this.sysPromptContent = res.content || '';
                this.sysPromptOriginalContent = this.sysPromptContent;
                this.sysPromptPath = res.path || '';
                this.sysPromptExists = !!res.exists;
                this.sysPromptHash = res.hash || '';
            } catch (e) {
                if (!isLatestRequestToken(this, '_sysPromptOpenRequestToken', requestToken)) return;
                this.showMessage(this.t('toast.load.fail'), 'error');
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
                    scope: this.sysPromptScope || 'global',
                    mode: this.sysPromptMode || 'append'
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
            if (this.sysPromptSaving) return;
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
                    scope: this.sysPromptScope || 'global',
                    mode: this.sysPromptMode || 'append',
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
            const filename = (this.sysPromptMode === 'system' ? 'SYSTEM.md' : 'APPEND_SYSTEM.md');
            const blob = new Blob([content], { type: 'text/markdown' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
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
            const scope = this.sysPromptScope || 'global';
            return 'system_' + scope + '_global';
        },

        async openSysHistory() {
            if (this.sysHistoryLoading) return;
            const bucket = this.resolveSysHistoryBucket();
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
            this.sysHistoryLoading = true;
            this.sysHistoryError = '';
            this.sysHistoryItems = [];
            this.sysHistoryPreviewId = '';
            this.sysHistoryPreviewContent = '';
            try {
                const res = await api('list-prompt-history', { bucket });
                if (res && res.error) {
                    this.sysHistoryError = res.error;
                    return;
                }
                this.sysHistoryItems = Array.isArray(res) ? res : [];
            } catch (e) {
                this.sysHistoryError = this.t('toast.load.fail');
            } finally {
                this.sysHistoryLoading = false;
            }
        },

        closeSysHistory() {
            this.sysHistoryVisible = false;
            this.sysHistoryPreviewId = '';
            this.sysHistoryPreviewContent = '';
            this.sysHistoryError = '';
        },

        async viewSysHistoryItem(item) {
            if (!item || !item.id) return;
            if (this.sysHistoryLoading) return;
            if (this.sysHistoryPreviewId === item.id && this.sysHistoryPreviewContent) return;
            this.sysHistoryPreviewId = item.id;
            this.sysHistoryPreviewContent = '';
            try {
                const res = await api('get-prompt-history', { bucket: this.sysHistoryBucket, id: item.id });
                if (res && res.error) {
                    this.sysHistoryError = res.error;
                    this.sysHistoryPreviewId = '';
                    return;
                }
                this.sysHistoryPreviewContent = typeof res.content === 'string' ? res.content : '';
            } catch (e) {
                this.sysHistoryError = this.t('toast.load.fail');
                this.sysHistoryPreviewId = '';
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
