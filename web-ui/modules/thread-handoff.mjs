import { api } from './api.mjs';

const STATUS_LABELS = Object.freeze({
    awaiting_read: '等待读取',
    file_ready: '文件已就绪',
    read_confirmed: '目标自报已读取（附证据）'
});
const CARD_FIELDS = Object.freeze([
    { key: 'goal', label: '交接目标', required: true },
    { key: 'completed', label: '已完成事项' },
    { key: 'blockers', label: '阻塞事项' },
    { key: 'nextSteps', label: '后续步骤' },
    { key: 'files', label: '相关文件' }
]);

function emptyDraft() {
    return { target: '', goal: '', completed: '', blockers: '', nextSteps: '', files: '' };
}

export const threadHandoffMixin = {
    data() {
        return {
            handoffRecords: [],
            handoffDraft: emptyDraft(),
            handoffFields: CARD_FIELDS,
            handoffLoading: false,
            handoffBusy: false,
            handoffError: '',
            handoffNotice: '',
            handoffCopyText: '',
            handoffRequestSeq: 0
        };
    },
    watch: {
        'activeSession.sessionId': {
            immediate: true,
            handler() {
                this.handoffRequestSeq++;
                this.handoffRecords = [];
                this.handoffDraft = emptyDraft();
                this.handoffError = '';
                this.handoffNotice = '';
                this.handoffCopyText = '';
                this.handoffLoading = false;
                void this.loadThreadHandoffs();
            }
        }
    },
    methods: {
        handoffStatusLabel(status) {
            return STATUS_LABELS[status] || '未知状态';
        },
        async loadThreadHandoffs() {
            const threadId = this.activeSession && this.activeSession.sessionId;
            if (!threadId) return;
            const requestSeq = ++this.handoffRequestSeq;
            this.handoffLoading = true;
            this.handoffError = '';
            try {
                const result = await api('thread-handoff-list', { threadId });
                if (requestSeq !== this.handoffRequestSeq) return;
                if (result.error) throw new Error(result.error);
                this.handoffRecords = result.records || [];
            } catch (error) {
                if (requestSeq === this.handoffRequestSeq) this.handoffError = '加载交接历史失败：' + error.message;
            } finally {
                if (requestSeq === this.handoffRequestSeq) this.handoffLoading = false;
            }
        },
        async createThreadHandoff() {
            const threadId = this.activeSession && this.activeSession.sessionId;
            if (!threadId || this.handoffBusy) return;
            const draft = this.handoffDraft;
            if (!draft.target.trim() || !draft.goal.trim()) {
                this.handoffError = '请填写目标代理与交接目标';
                return;
            }
            const card = { goal: draft.goal.trim() };
            for (const { key } of CARD_FIELDS.slice(1)) {
                card[key] = draft[key].split(/\r?\n/).map(line => line.trim()).filter(Boolean);
            }
            this.handoffBusy = true;
            this.handoffError = '';
            this.handoffNotice = '';
            try {
                const result = await api('thread-handoff-create', { threadId, target: draft.target.trim(), card });
                if (result.error) throw new Error(result.error);
                if (this.handoffDraft !== draft) return;
                this.handoffNotice = result.message || '已生成交接记录；读取状态以交接历史为准。';
                await this.loadThreadHandoffs();
            } catch (error) {
                if (this.handoffDraft === draft) this.handoffError = '生成交接失败：' + error.message;
            } finally {
                this.handoffBusy = false;
            }
        },
        async copyThreadHandoff(record) {
            const threadId = this.activeSession && this.activeSession.sessionId;
            if (!threadId || this.handoffBusy) return;
            const draft = this.handoffDraft;
            this.handoffBusy = true;
            this.handoffError = '';
            this.handoffNotice = '';
            this.handoffCopyText = '';
            try {
                const result = await api('thread-handoff-fallback', { threadId, handoffId: record.id });
                if (result.error) throw new Error(result.error);
                if (this.handoffDraft !== draft) return;
                if (result.record) {
                    this.handoffRecords = this.handoffRecords.map(item => item.id === record.id ? result.record : item);
                }
                if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('未返回卡片文本');
                this.handoffCopyText = result.text;
                if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('当前环境不支持剪贴板，请手动复制下方文本');
                await navigator.clipboard.writeText(result.text);
                if (this.handoffDraft === draft) this.handoffNotice = '已复制卡片文本；未发送给目标。请粘贴到目标会话。';
            } catch (error) {
                if (this.handoffDraft === draft) this.handoffError = '卡片复制未完成；未发送给目标：' + error.message;
            } finally {
                this.handoffBusy = false;
            }
        }
    }
};
