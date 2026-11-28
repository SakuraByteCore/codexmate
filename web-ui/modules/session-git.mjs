export const sessionGitMixin = {
    data() { return { projectGitOpen: false, projectGit: null, projectGitCommit: null, projectGitBusy: false, projectGitError: '', projectGitSequence: 0 }; },
    beforeUnmount() { this.projectGitSequence++; },
    watch: {
        projectSelected() {
            this.projectGitSequence++; this.projectGit = null; this.projectGitCommit = null; this.projectGitError = ''; this.projectGitBusy = false;
            if (!this.projectSelected) this.projectGitOpen = false;
            else if (this.projectGitOpen) void this.loadProjectGit();
        }
    },
    methods: {
        toggleProjectGit(event) {
            if (event.target !== event.currentTarget) return;
            this.projectGitOpen = event.currentTarget.open;
            if (this.projectGitOpen && !this.projectGit) return this.loadProjectGit();
        },
        async loadProjectGit() {
            if (!this.projectSelected || this.projectGitBusy) return;
            const sequence = ++this.projectGitSequence;
            this.projectGitBusy = true; this.projectGitError = ''; this.projectGitCommit = null;
            try {
                const report = await this.featureCall('session-project-git', { project: this.projectSelected });
                if (sequence === this.projectGitSequence) this.projectGit = report;
            } catch (error) { if (sequence === this.projectGitSequence) this.projectGitError = error.message; }
            finally { if (sequence === this.projectGitSequence) this.projectGitBusy = false; }
        },
        async loadProjectGitCommit(sha) {
            const sequence = ++this.projectGitSequence;
            this.projectGitBusy = true; this.projectGitError = ''; this.projectGitCommit = null;
            try {
                const report = await this.featureCall('session-project-git-commit', { project: this.projectSelected, sha });
                if (sequence === this.projectGitSequence) this.projectGitCommit = report;
            } catch (error) { if (sequence === this.projectGitSequence) this.projectGitError = error.message; }
            finally { if (sequence === this.projectGitSequence) this.projectGitBusy = false; }
        }
    }
};
