import { sessionCollectionsMixin } from './session-collections.mjs';
const MAX_SELECTIONS = 100;
const selectionKey = result => JSON.stringify([result.session.source, result.session.sessionId, result.session.filePath, result.nodeId]);

export const sessionEvidenceMixin = {
    mixins: [sessionCollectionsMixin],
    data() {
        return { evidenceSelections: [], evidenceGoal: '', evidencePack: '', evidenceBusy: false, evidenceError: '', evidenceSequence: 0 };
    },
    beforeUnmount() { this.evidenceSequence++; },
    watch: { evidenceGoal() { this.evidenceSequence++; this.evidencePack = ''; } },
    methods: {
        evidenceKey: selectionKey,
        isEvidenceSelected(result) { return this.evidenceSelections.some(item => selectionKey(item) === selectionKey(result)); },
        toggleEvidence(result) {
            this.evidenceSequence++;
            this.evidencePack = ''; this.evidenceError = '';
            const key = selectionKey(result);
            if (this.isEvidenceSelected(result)) {
                this.evidenceSelections = this.evidenceSelections.filter(item => selectionKey(item) !== key);
                return;
            }
            if (this.evidenceSelections.length >= MAX_SELECTIONS) { this.evidenceError = this.t('evidence.limit'); return; }
            this.evidenceSelections = [...this.evidenceSelections, { ...result, session: { ...result.session } }];
        },
        async generateEvidencePack() {
            if (this.evidenceBusy || !this.evidenceSelections.length) return;
            const sequence = ++this.evidenceSequence;
            const selections = [...this.evidenceSelections];
            const groups = new Map();
            for (const item of selections) {
                const key = JSON.stringify([item.session.source, item.session.sessionId, item.session.filePath]);
                if (!groups.has(key)) groups.set(key, []);
                groups.get(key).push(item);
            }
            this.evidenceBusy = true; this.evidenceError = ''; this.evidencePack = '';
            try {
                const evidence = new Map();
                for (const group of groups.values()) {
                    const draft = await this.featureCall('session-handoff-draft', { ...group[0].session, goal: this.evidenceGoal,
                        selections: group.map(item => item.nodeId) });
                    if (sequence !== this.evidenceSequence) return;
                    for (const item of group) {
                        const found = draft.evidence.find(entry => entry.nodeId === item.nodeId);
                        if (!found || found.textHash !== item.textHash) throw new Error(this.t('evidence.changed'));
                        evidence.set(selectionKey(item), found);
                    }
                }
                const lines = [`# ${this.t('evidence.title')}`, '', this.t('evidence.scope'), '', this.evidenceGoal.trim()];
                for (const [index, item] of selections.entries()) {
                    const found = evidence.get(selectionKey(item));
                    lines.push('', `## ${index + 1}. ${item.session.title || item.session.sessionId}`, '',
                        `${item.session.source} · ${item.session.sessionId} · ${found.nodeId}`,
                        `${this.t('evidence.path')}: ${JSON.stringify(item.session.filePath || item.session.cwd || '')}`,
                        `SHA-256: ${found.textHash}`, `${this.t('evidence.status')}: ${this.t('evidence.' + found.status)}`, '',
                        ...found.excerpt.split('\n').map(line => '> ' + line));
                }
                this.evidencePack = lines.join('\n').trim() + '\n';
            } catch (error) { if (sequence === this.evidenceSequence) this.evidenceError = error.message; }
            finally { this.evidenceBusy = false; }
        },
        downloadEvidencePack() {
            if (this.evidencePack) this.downloadTextFile('codexmate-evidence.md', this.evidencePack);
        }
    }
};
