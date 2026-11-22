export function createContextHealthMethods({ api }) {
    return {
        async loadSessionContextHealth(force = false) {
            if (!this.activeSession || (this.mainTab !== 'sessions' && !this.sessionStandalone)) return;
            const session = this.activeSession;
            const stamp = `${this.getSessionExportKey(session)}:${this.sessionDetailRequestSeq}`;
            if (force !== true && this.sessionContextHealthStamp === stamp) return;
            this.sessionContextHealthStamp = stamp;
            this.sessionContextHealth = null;
            this.sessionContextHealthError = '';
            this.sessionContextHealthFocusedNode = null;
            this.sessionContextHealthLoading = true;
            try {
                const result = await api('session-context-health', { source: session.source,
                    sessionId: session.sessionId, filePath: session.filePath, cwd: session.cwd });
                if (this.activeSession !== session || this.sessionContextHealthStamp !== stamp) return;
                if (result.error) throw new Error(result.error);
                this.sessionContextHealth = Object.freeze(result);
            } catch (error) {
                if (this.activeSession === session && this.sessionContextHealthStamp === stamp) {
                    this.sessionContextHealthError = error.message || this.t('toast.load.fail');
                }
            } finally {
                if (this.sessionContextHealthStamp === stamp) this.sessionContextHealthLoading = false;
            }
        },
        toggleContextHealthDetails() {
            this.sessionContextHealthPinned = !this.sessionContextHealthPinned;
            this.sessionContextHealthExpanded = this.sessionContextHealthPinned;
        },
        leaveContextHealthDetails() {
            if (!this.sessionContextHealthPinned) this.sessionContextHealthExpanded = false;
        },
        contextHealthReasonLabel(reason) {
            return this.t(`contextHealth.reason.${reason}`);
        },
        async jumpToContextHealthNode(node) {
            if (!this.activeSession || this.sessionContextHealthNodeLoading) return;
            const session = this.activeSession;
            const stamp = this.sessionContextHealthStamp;
            this.sessionContextHealthNodeLoading = true;
            this.sessionContextHealthError = '';
            try {
                const result = await api('session-context-node', { source: session.source,
                    sessionId: session.sessionId, filePath: session.filePath, cwd: session.cwd, nodeId: node.id });
                if (this.activeSession !== session || this.sessionContextHealthStamp !== stamp) return;
                if (result.error) throw new Error(result.error);
                this.sessionContextHealthFocusedNode = Object.freeze({ ...result.node,
                    estimatedTokens: node.estimatedTokens, percentage: node.percentage });
                const matching = node.id.includes('.') ? -1
                    : this.activeSessionMessages.findIndex((message) => message.recordLineIndex === result.node.recordLineIndex
                        && typeof message.text === 'string' && message.text.trim() === result.node.text.trim());
                if (matching >= 0 && this.sessionPreviewRenderEnabled) {
                    this.sessionPreviewVisibleCount = Math.max(this.sessionPreviewVisibleCount, matching + 1);
                }
                await this.$nextTick();
                const message = matching >= 0 ? this.activeSessionMessages[matching] : null;
                const key = message ? this.getRecordRenderKey(message, matching) : '';
                const original = key && this.sessionMessageRefMap[key];
                const target = original || this.$refs.contextHealthFocusedMessage;
                if (target) {
                    target.scrollIntoView({ block: 'start', behavior: 'auto' });
                    if (target === this.$refs.contextHealthFocusedMessage) target.focus();
                }
            } catch (error) {
                if (this.activeSession === session) this.sessionContextHealthError = error.message || this.t('toast.load.fail');
            } finally { this.sessionContextHealthNodeLoading = false; }
        }
    };
}
