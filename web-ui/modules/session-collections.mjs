export const sessionCollectionsMixin = {
    data() {
        return { collectionsOpen: false, collections: [], collectionRevision: '', collectionId: '', collectionName: '',
            collectionBusy: false, collectionError: '', collectionSequence: 0 };
    },
    beforeUnmount() { this.collectionSequence++; },
    methods: {
        async toggleCollections(event) {
            if (event.target !== event.currentTarget) return;
            this.collectionsOpen = event.currentTarget.open;
            if (this.collectionsOpen) await this.loadEvidenceCollections();
        },
        async loadEvidenceCollections() {
            const sequence = ++this.collectionSequence;
            this.collectionBusy = true; this.collectionError = '';
            try {
                const report = await this.featureCall('session-collections-list');
                if (sequence !== this.collectionSequence) return;
                this.collections = report.items; this.collectionRevision = report.revision;
            } catch (error) { if (sequence === this.collectionSequence) this.collectionError = this.featureErrorText(error); }
            finally { if (sequence === this.collectionSequence) this.collectionBusy = false; }
        },
        async openEvidenceCollection(item) {
            if (this.collectionBusy || this.evidenceBusy) return;
            const sequence = ++this.collectionSequence;
            this.collectionBusy = true; this.collectionError = '';
            try {
                const report = await this.featureCall('session-collection-open', { id: item.id });
                if (sequence !== this.collectionSequence) return;
                this.evidenceSequence++; this.evidencePack = ''; this.evidenceError = '';
                this.evidenceSelections = report.items; this.evidenceGoal = report.item.goal; this.evidenceNote = '';
                this.collectionId = report.item.id; this.collectionName = report.item.name; this.collectionRevision = report.revision;
            } catch (error) { if (sequence === this.collectionSequence) this.collectionError = this.featureErrorText(error); }
            finally { if (sequence === this.collectionSequence) this.collectionBusy = false; }
        },
        async saveEvidenceCollection(asNew = false) {
            if (this.collectionBusy || this.evidenceBusy || !this.evidenceSelections.length) return;
            const sequence = ++this.collectionSequence;
            this.collectionBusy = true; this.collectionError = '';
            const references = this.evidenceSelections.map(item => ({ nodeId: item.nodeId, textHash: item.textHash,
                session: { source: item.session.source, sessionId: item.session.sessionId || '', filePath: item.session.filePath || '',
                    cwd: item.session.cwd || '', title: item.session.title || '' } }));
            try {
                const report = await this.featureCall('session-collection-save', { id: asNew ? '' : this.collectionId,
                    name: this.collectionName, goal: this.evidenceGoal, references, revision: this.collectionRevision });
                if (sequence !== this.collectionSequence) return;
                this.collections = report.items; this.collectionRevision = report.revision;
                this.collectionId = report.item.id; this.collectionName = report.item.name; this.collectionsOpen = true;
            } catch (error) { if (sequence === this.collectionSequence) this.collectionError = this.featureErrorText(error); }
            finally { if (sequence === this.collectionSequence) this.collectionBusy = false; }
        },
        async removeEvidenceCollection(item) {
            if (this.collectionBusy) return;
            const sequence = ++this.collectionSequence;
            this.collectionBusy = true; this.collectionError = '';
            try {
                const report = await this.featureCall('session-collection-remove', { id: item.id, revision: this.collectionRevision });
                if (sequence !== this.collectionSequence) return;
                this.collections = report.items; this.collectionRevision = report.revision;
                if (this.collectionId === item.id) { this.collectionId = ''; this.collectionName = ''; }
            } catch (error) { if (sequence === this.collectionSequence) this.collectionError = this.featureErrorText(error); }
            finally { if (sequence === this.collectionSequence) this.collectionBusy = false; }
        }
    }
};
