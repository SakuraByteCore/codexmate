export function createPromptsComputed() {
    return {
        promptsContextHint() {
            if (!this.agentsLoading && !this.agentsDiffVisible && this.hasAgentsContentChanged()) {
                return { text: this.t('modal.agents.unsaved.detectedHint'), warn: true };
            }
            if (this.agentsDiffVisible && (this.agentsDiffLoading || this.agentsSaving)) {
                return { text: this.t('diff.hint.busy'), warn: false };
            }
            if (this.agentsDiffVisible && this.agentsDiffError) {
                return { text: this.t('diff.hint.failedBack'), warn: false };
            }
            if (this.agentsDiffVisible && !this.agentsDiffHasChanges) {
                return { text: this.t('diff.hint.noChangesBack'), warn: false };
            }
            if (this.agentsDiffVisible && this.agentsDiffTruncated) {
                return { text: this.t('diff.viewHint.truncated'), warn: false };
            }
            if (this.agentsDiffVisible) {
                return { text: this.t('diff.viewHint.preview'), warn: false };
            }
            if (!this.agentsLoading) {
                return { text: this.t('modal.agents.hint.twoStepSave'), warn: false };
            }
            return null;
        }
    };
}
