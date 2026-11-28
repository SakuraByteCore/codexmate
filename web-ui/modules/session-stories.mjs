export const sessionStoriesMixin = {
    data() {
        return { stories: [], storySessions: [], storyRevision: '', storySession: '', storyNote: '', storyBusy: false,
            storyError: '', storySequence: 0 };
    },
    computed: {
        commitStories() { return this.stories.filter(item => item.sha === this.projectGitCommit?.sha); }
    },
    beforeUnmount() { this.storySequence++; },
    watch: {
        projectSelected() {
            this.storySequence++; this.stories = []; this.storySessions = []; this.storySession = ''; this.storyNote = '';
            this.storyError = ''; this.storyBusy = false; this.storyRevision = '';
        },
        projectGitCommit(commit) {
            this.storySequence++; this.storySession = ''; this.storyNote = ''; this.storyError = ''; this.storyBusy = false;
            if (commit) void this.loadProjectStories();
        },
        storySession(key) {
            const existing = this.commitStories.find(item => this.storySessionKey(item.session) === key);
            this.storyNote = existing?.note || '';
        }
    },
    methods: {
        storySessionKey(session) { return JSON.stringify([session.source, session.sessionId, session.filePath]); },
        async loadProjectStories() {
            if (!this.projectSelected || !this.projectGitCommit) return;
            const sequence = ++this.storySequence;
            this.storyBusy = true; this.storyError = '';
            try {
                const report = await this.featureCall('session-stories-list', { project: this.projectSelected });
                if (sequence !== this.storySequence) return;
                this.stories = report.items; this.storySessions = report.sessions; this.storyRevision = report.revision;
            } catch (error) { if (sequence === this.storySequence) this.storyError = this.featureErrorText(error); }
            finally { if (sequence === this.storySequence) this.storyBusy = false; }
        },
        async saveProjectStory() {
            if (this.storyBusy || !this.projectGitCommit) return;
            const session = this.storySessions.find(item => this.storySessionKey(item) === this.storySession);
            if (!session) return;
            const sequence = ++this.storySequence;
            this.storyBusy = true; this.storyError = '';
            try {
                const report = await this.featureCall('session-story-save', { project: this.projectSelected,
                    sha: this.projectGitCommit.sha, session, note: this.storyNote, revision: this.storyRevision });
                if (sequence !== this.storySequence) return;
                this.stories = report.items; this.storySessions = report.sessions; this.storyRevision = report.revision;
            } catch (error) { if (sequence === this.storySequence) this.storyError = this.featureErrorText(error); }
            finally { if (sequence === this.storySequence) this.storyBusy = false; }
        },
        async removeProjectStory(item) {
            if (this.storyBusy) return;
            const sequence = ++this.storySequence;
            this.storyBusy = true; this.storyError = '';
            try {
                const report = await this.featureCall('session-story-remove', { project: this.projectSelected, id: item.id, revision: this.storyRevision });
                if (sequence !== this.storySequence) return;
                this.stories = report.items; this.storySessions = report.sessions; this.storyRevision = report.revision;
                if (this.storySession === this.storySessionKey(item.session)) { this.storySession = ''; this.storyNote = ''; }
            } catch (error) { if (sequence === this.storySequence) this.storyError = this.featureErrorText(error); }
            finally { if (sequence === this.storySequence) this.storyBusy = false; }
        }
    }
};
