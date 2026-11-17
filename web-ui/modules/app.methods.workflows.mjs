export function createWorkflowMethods({ api }) {
    return {
        async refreshWorkflowRuns() {
            try {
                const [definitions, result] = await Promise.all([api('workflow-list'), api('workflow-active-runs')]);
                if (result.error || definitions.error) throw new Error(result.error || definitions.error);
                this.workflowDefinitions = definitions.workflows || [];
                this.workflowRuns = (result.runs || []).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
                this.workflowError = '';
            } catch (error) { this.workflowError = error.message; }
        },
        async submitWorkflowRun() {
            this.workflowBusy = true;
            try {
                const input = JSON.parse(this.workflowInput);
                const result = await api('workflow-submit', { id: this.workflowId, input, allowWrite: this.workflowAllowWrite });
                if (result.error || result.ok === false) throw new Error(result.error || this.t('workflow.submitFailed'));
                await this.refreshWorkflowRuns();
            } catch (error) { this.workflowError = error instanceof SyntaxError ? this.t('workflow.invalidJson') : error.message; }
            finally { this.workflowBusy = false; }
        },
        async controlWorkflowRun(run, action) {
            this.workflowBusy = true;
            try {
                const params = { runId: run.id };
                if (action === 'resume') {
                    params.input = JSON.parse(this.workflowInput);
                    params.allowWrite = this.workflowAllowWrite;
                }
                const result = await api(`workflow-${action}`, params);
                if (result.error && !result.id) throw new Error(result.error);
                await this.refreshWorkflowRuns();
            } catch (error) { this.workflowError = error instanceof SyntaxError ? this.t('workflow.invalidJson') : error.message; }
            finally { this.workflowBusy = false; }
        },
        workflowStatusLabel(status) {
            return ['queued', 'running', 'waiting', 'completed', 'failed', 'cancelling', 'cancelled'].includes(status)
                ? this.t(`workflow.status.${status}`) : status;
        }
    };
}
