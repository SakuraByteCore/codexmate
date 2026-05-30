function normalizeTaskDraftLines(text) {
    return String(text || '')
        .split(/\r?\n/g)
        .map((item) => item.trim())
        .filter(Boolean);
}

function readTaskOrchestrationDraftMetrics(taskOrchestration) {
    const state = taskOrchestration && typeof taskOrchestration === 'object' ? taskOrchestration : {};
    const target = String(state.target || '').trim();
    const notes = String(state.notes || '').trim();
    const title = String(state.title || '').trim();
    const workflowIds = normalizeTaskDraftLines(state.workflowIdsText);
    const followUps = normalizeTaskDraftLines(state.followUpsText);
    const engine = String(state.selectedEngine || 'codex').trim().toLowerCase() === 'workflow' ? 'workflow' : 'codex';
    const runMode = String(state.runMode || 'write').trim().toLowerCase();
    const allowWrite = runMode === 'write';
    const dryRun = runMode === 'dry-run';
    const plan = state.plan && typeof state.plan === 'object' ? state.plan : null;
    const planNodes = Array.isArray(plan && plan.nodes) ? plan.nodes : [];
    const planIssues = Array.isArray(state.planIssues) ? state.planIssues : [];
    const planWarnings = Array.isArray(state.planWarnings) ? state.planWarnings : [];
    return {
        engine,
        runMode,
        title,
        target,
        notes,
        workflowIds,
        followUps,
        hasTarget: target.length > 0,
        hasNotes: notes.length > 0,
        hasTitle: title.length > 0,
        hasPlan: !!plan,
        planNodes,
        planIssues,
        planWarnings,
        workflowCount: workflowIds.length,
        followUpCount: followUps.length,
        planNodeCount: planNodes.length,
        allowWrite,
        dryRun
    };
}

function translateTaskText(t, key, fallback, params = null) {
    if (typeof t !== 'function') return fallback;
    const translated = t(key, params);
    return translated === key ? fallback : translated;
}

function createTaskDraftChecklist(metrics, t = null) {
    const workflowReady = metrics.engine !== 'workflow' || metrics.workflowCount > 0;
    const scopeReady = metrics.hasNotes || !metrics.allowWrite;
    const previewReady = metrics.hasPlan && metrics.planIssues.length === 0;
    return [
        {
            key: 'target',
            label: translateTaskText(t, 'orchestration.readiness.target.label', '目标'),
            done: metrics.hasTarget,
            detail: metrics.hasTarget ? translateTaskText(t, 'orchestration.readiness.target.done', '已写目标') : translateTaskText(t, 'orchestration.readiness.target.missing', '还没写目标')
        },
        {
            key: 'engine',
            label: metrics.engine === 'workflow' ? 'Workflow' : translateTaskText(t, 'orchestration.readiness.engine.label', '执行策略'),
            done: workflowReady,
            detail: metrics.engine === 'workflow'
                ? (metrics.workflowCount > 0 ? translateTaskText(t, 'orchestration.readiness.workflow.done', `已选 ${metrics.workflowCount} 个 Workflow`, { count: metrics.workflowCount }) : translateTaskText(t, 'orchestration.readiness.workflow.missing', '还没选 Workflow ID'))
                : translateTaskText(t, 'orchestration.readiness.engine.codex', '使用 Codex 规划节点')
        },
        {
            key: 'scope',
            label: translateTaskText(t, 'orchestration.readiness.scope.label', '边界'),
            done: scopeReady,
            detail: metrics.hasNotes
                ? translateTaskText(t, 'orchestration.readiness.scope.done', '已补充说明')
                : (metrics.allowWrite ? translateTaskText(t, 'orchestration.readiness.scope.writeHint', '建议补说明后再写入') : translateTaskText(t, 'orchestration.readiness.scope.readonlyHint', '当前是只读，可直接试'))
        },
        {
            key: 'preview',
            label: translateTaskText(t, 'orchestration.readiness.preview.label', '预览'),
            done: previewReady,
            detail: !metrics.hasPlan
                ? translateTaskText(t, 'orchestration.readiness.preview.missing', '还没生成计划')
                : (metrics.planIssues.length > 0 ? translateTaskText(t, 'orchestration.readiness.preview.blocked', `有 ${metrics.planIssues.length} 个阻塞项`, { count: metrics.planIssues.length }) : translateTaskText(t, 'orchestration.readiness.preview.ready', `计划可用，${metrics.planNodeCount} 个节点`, { count: metrics.planNodeCount }))
        }
    ];
}

function createTaskDraftReadiness(metrics, t = null) {
    if (!metrics.hasTarget) {
        return {
            tone: 'neutral',
            title: translateTaskText(t, 'orchestration.readiness.empty.title', '先写目标'),
            summary: translateTaskText(t, 'orchestration.readiness.empty.summary', '先把想完成的结果写清楚，再让编排器拆节点。')
        };
    }
    if (metrics.engine === 'workflow' && metrics.workflowCount === 0) {
        return {
            tone: 'warn',
            title: translateTaskText(t, 'orchestration.readiness.workflow.title', '缺少 Workflow'),
            summary: translateTaskText(t, 'orchestration.readiness.workflow.summary', '你已经选了 Workflow 模式，但还没指定可复用流程。')
        };
    }
    if (!metrics.hasPlan) {
        return {
            tone: 'warn',
            title: translateTaskText(t, 'orchestration.readiness.preview.title', '建议先预览'),
            summary: translateTaskText(t, 'orchestration.readiness.preview.summary', '草稿已成形，先生成一次计划，确认节点和依赖再执行。')
        };
    }
    if (metrics.planIssues.length > 0) {
        return {
            tone: 'error',
            title: translateTaskText(t, 'orchestration.readiness.blocked.title', '预览有阻塞'),
            summary: translateTaskText(t, 'orchestration.readiness.blocked.summary', `当前计划里还有 ${metrics.planIssues.length} 个阻塞项，先处理它们。`, { count: metrics.planIssues.length })
        };
    }
    if (metrics.planWarnings.length > 0) {
        return {
            tone: 'warn',
            title: translateTaskText(t, 'orchestration.readiness.warn.title', '可以执行，但有提醒'),
            summary: translateTaskText(t, 'orchestration.readiness.warn.summary', `计划已生成，但还有 ${metrics.planWarnings.length} 条提醒值得先看一眼。`, { count: metrics.planWarnings.length })
        };
    }
    if (metrics.dryRun) {
        return {
            tone: 'success',
            title: translateTaskText(t, 'orchestration.readiness.dryRun.title', '适合先预演'),
            summary: translateTaskText(t, 'orchestration.readiness.dryRun.summary', '现在可以安全地跑一次仅预演，先看结果再决定是否真实执行。')
        };
    }
    return {
        tone: 'success',
        title: translateTaskText(t, 'orchestration.readiness.ready.title', '可以执行'),
        summary: metrics.followUpCount > 0
            ? translateTaskText(t, 'orchestration.readiness.ready.withFollowUps', `主目标和收尾动作都已具备，可以直接执行或入队。`)
            : translateTaskText(t, 'orchestration.readiness.ready.summary', '主目标已经够清楚了，可以直接执行或入队。')
    };
}

export function createMainTabsComputed() {
    return {
        mainTabKicker() {
            if (this.mainTab === 'dashboard') return this.t('kicker.dashboard');
            if (this.mainTab === 'config') return this.t('kicker.config');
            if (this.mainTab === 'sessions') return this.t('kicker.sessions');
            if (this.mainTab === 'usage') return this.t('kicker.usage');
            if (this.mainTab === 'orchestration') return this.t('kicker.orchestration');
            if (this.mainTab === 'market') return this.t('kicker.market');
            if (this.mainTab === 'plugins') return this.t('kicker.plugins');
            if (this.mainTab === 'docs') return this.t('kicker.docs');
            if (this.mainTab === 'trash') return this.t('kicker.trash');
            return this.t('kicker.settings');
        },
        mainTabTitle() {
            if (this.mainTab === 'dashboard') return this.t('title.dashboard');
            if (this.mainTab === 'config') return this.t('title.config');
            if (this.mainTab === 'sessions') return this.t('title.sessions');
            if (this.mainTab === 'usage') return this.t('title.usage');
            if (this.mainTab === 'orchestration') return this.t('title.orchestration');
            if (this.mainTab === 'market') return this.t('title.market');
            if (this.mainTab === 'plugins') return this.t('title.plugins');
            if (this.mainTab === 'docs') return this.t('title.docs');
            if (this.mainTab === 'trash') return this.t('settings.trash.title');
            return this.t('title.settings');
        },
        mainTabSubtitle() {
            if (this.mainTab === 'dashboard') return this.t('subtitle.dashboard');
            if (this.mainTab === 'config') return this.t('subtitle.config');
            if (this.mainTab === 'sessions') return this.t('subtitle.sessions');
            if (this.mainTab === 'usage') return this.t('subtitle.usage');
            if (this.mainTab === 'orchestration') return this.t('subtitle.orchestration');
            if (this.mainTab === 'market') return this.t('subtitle.market');
            if (this.mainTab === 'plugins') return this.t('subtitle.plugins');
            if (this.mainTab === 'docs') return this.t('subtitle.docs');
            if (this.mainTab === 'trash') return this.t('settings.trash.meta');
            return this.t('subtitle.settings');
        },
        taskOrchestrationSelectedRun() {
            return this.taskOrchestration && this.taskOrchestration.selectedRunDetail
                ? this.taskOrchestration.selectedRunDetail
                : null;
        },
        taskOrchestrationSelectedRunNodes() {
            const detail = this.taskOrchestrationSelectedRun;
            const run = detail && detail.run && typeof detail.run === 'object' ? detail.run : {};
            if (detail && Array.isArray(detail.nodes)) return detail.nodes;
            return Array.isArray(run.nodes) ? run.nodes : [];
        },
        taskOrchestrationQueueStats() {
            const queue = this.taskOrchestration && Array.isArray(this.taskOrchestration.queue)
                ? this.taskOrchestration.queue
                : [];
            const stats = { queued: 0, running: 0, failed: 0 };
            for (const item of queue) {
                const status = String(item && item.status || '').trim().toLowerCase();
                if (status === 'queued') stats.queued += 1;
                else if (status === 'running') stats.running += 1;
                else if (status === 'failed') stats.failed += 1;
            }
            return stats;
        },
        taskOrchestrationDraftMetrics() {
            return readTaskOrchestrationDraftMetrics(this.taskOrchestration);
        },
        taskOrchestrationDraftChecklist() {
            return createTaskDraftChecklist(this.taskOrchestrationDraftMetrics, this.t && this.t.bind(this));
        },
        taskOrchestrationDraftReadiness() {
            return createTaskDraftReadiness(this.taskOrchestrationDraftMetrics, this.t && this.t.bind(this));
        }
    };
}
