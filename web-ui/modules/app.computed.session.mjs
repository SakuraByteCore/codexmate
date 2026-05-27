import {
    buildSessionTimelineNodes,
    buildUsageChartGroups,
    buildUsageHeatmap,
    buildUsageHourlyHeatmap,
    isSessionQueryEnabled
} from '../logic.mjs';
import { SESSION_TRASH_PAGE_SIZE } from './app.constants.mjs';

function formatUsageSummaryNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return '0';
    }
    return Math.floor(numeric).toLocaleString('en-US');
}

function formatCompactUsageSummaryNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
        return '0';
    }
    return new Intl.NumberFormat('en-US', {
        notation: 'compact',
        compactDisplay: 'short',
        maximumFractionDigits: 1
    }).format(Math.floor(numeric));
}

function formatSignedUsageSummaryNumber(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
        return '0';
    }
    const abs = Math.floor(Math.abs(numeric));
    const formatted = abs.toLocaleString('en-US');
    if (numeric > 0) return `+${formatted}`;
    if (numeric < 0) return `-${formatted}`;
    return '0';
}

function formatUsageRangeLabel(range, t) {
    const normalized = typeof range === 'string' ? range.trim().toLowerCase() : '7d';
    if (typeof t === 'function') {
        if (normalized === '30d') return t('usage.range.30d');
        if (normalized === 'all') return t('usage.range.all');
        return t('usage.range.7d');
    }
    if (normalized === '30d') return '近 30 天';
    if (normalized === 'all') return '全部';
    return '近 7 天';
}

function formatUsageDuration(value, options = {}) {
    const normalizedLang = typeof options.lang === 'string' ? options.lang.trim().toLowerCase() : '';
    const isEn = normalizedLang === 'en';
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return isEn ? '0m' : '0分';
    }
    const totalMinutes = Math.floor(numeric / 60000);
    if (totalMinutes <= 0) {
        return isEn ? '<1m' : '<1分';
    }
    const maxParts = Number.isFinite(Number(options.maxParts))
        ? Math.max(1, Math.floor(Number(options.maxParts)))
        : 2;
    const compact = options.compact !== false;
    const units = compact
        ? (
            isEn
                ? [
                    { label: 'd', value: 24 * 60 },
                    { label: 'h', value: 60 },
                    { label: 'm', value: 1 }
                ]
                : [
                    { label: '天', value: 24 * 60 },
                    { label: '时', value: 60 },
                    { label: '分', value: 1 }
                ]
        )
        : (
            isEn
                ? [
                    { label: 'day', value: 24 * 60 },
                    { label: 'hr', value: 60 },
                    { label: 'min', value: 1 }
                ]
                : [
                    { label: '天', value: 24 * 60 },
                    { label: '小时', value: 60 },
                    { label: '分', value: 1 }
                ]
        );
    let remainingMinutes = totalMinutes;
    const parts = [];
    for (const unit of units) {
        if (remainingMinutes < unit.value && unit.value !== 1) {
            continue;
        }
        const count = unit.value === 1 ? remainingMinutes : Math.floor(remainingMinutes / unit.value);
        if (count <= 0) {
            continue;
        }
        parts.push(compact ? `${count}${unit.label}` : (isEn ? `${count} ${unit.label}` : `${count}${unit.label}`));
        remainingMinutes -= count * unit.value;
        if (parts.length >= maxParts) {
            break;
        }
    }
    return parts.length ? parts.join(compact ? '' : ' ') : (isEn ? '0m' : '0分');
}

export function createSessionComputed() {
    return {
        isSessionQueryEnabled() {
            return isSessionQueryEnabled(this.sessionFilterSource);
        },
        sessionSourceOptions() {
            return [
                { value: "all", label: this.t("common.all") },
                { value: "codex", label: this.t("sessions.source.codex") },
                { value: "claude", label: this.t("sessions.source.claudeCode") },
                { value: "gemini", label: this.t("sessions.source.gemini") },
                { value: "codebuddy", label: this.t("sessions.source.codebuddy") }
            ];
        },
        activeSessionExportKey() {
            return this.activeSession ? this.getSessionExportKey(this.activeSession) : '';
        },
        sortedSessionsList() {
            const list = Array.isArray(this.sessionsList) ? this.sessionsList : [];
            if (list.length === 0) return [];
            const pinnedMap = (this.sessionPinnedMap && typeof this.sessionPinnedMap === 'object')
                ? this.sessionPinnedMap
                : {};
            const sortMode = typeof this.sessionSortMode === 'string'
                ? this.sessionSortMode.trim().toLowerCase()
                : 'time';
            if (sortMode !== 'hot' && Object.keys(pinnedMap).length === 0) {
                return list;
            }
            const now = Date.now();
            let hasPinned = false;
            const decorated = list.map((session, index) => {
                const key = session ? this.getSessionExportKey(session) : '';
                const rawPinnedAt = key ? pinnedMap[key] : 0;
                const pinnedAt = Number.isFinite(Number(rawPinnedAt))
                    ? Math.floor(Number(rawPinnedAt))
                    : 0;
                const isPinned = pinnedAt > 0;
                if (isPinned) {
                    hasPinned = true;
                }
                const updatedAtMs = session ? Date.parse(session.updatedAt || '') : NaN;
                const safeUpdatedAtMs = Number.isFinite(updatedAtMs) ? updatedAtMs : 0;
                const messageCount = session && Number.isFinite(Number(session.messageCount))
                    ? Math.max(0, Math.floor(Number(session.messageCount)))
                    : 0;
                const totalTokens = session && Number.isFinite(Number(session.totalTokens))
                    ? Math.max(0, Math.floor(Number(session.totalTokens)))
                    : 0;
                const ageHours = safeUpdatedAtMs > 0 ? Math.max(0, (now - safeUpdatedAtMs) / 3600000) : 1e9;
                const activity = Math.sqrt(Math.max(1, totalTokens || (messageCount * 120)));
                const hotScore = activity / (1 + (ageHours / 24));
                return { session, index, pinnedAt, isPinned, safeUpdatedAtMs, hotScore };
            });
            if (!hasPinned && sortMode !== 'hot') {
                return list;
            }
            decorated.sort((a, b) => {
                if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
                if (a.isPinned && a.pinnedAt !== b.pinnedAt) return b.pinnedAt - a.pinnedAt;
                if (sortMode === 'hot') {
                    if (a.hotScore !== b.hotScore) return b.hotScore - a.hotScore;
                }
                return a.index - b.index;
            });
            return decorated.map(item => item.session);
        },
        visibleSessionsList() {
            if (!this.sessionListRenderEnabled) {
                return [];
            }
            const list = Array.isArray(this.sortedSessionsList) ? this.sortedSessionsList : [];
            if (list.length === 0) {
                return [];
            }
            const rawVisibleCount = Number(this.sessionListVisibleCount);
            const visibleCount = Number.isFinite(rawVisibleCount)
                ? Math.max(0, Math.floor(rawVisibleCount))
                : 0;
            let targetCount = visibleCount > 0 ? Math.min(visibleCount, list.length) : Math.min(list.length, 1);
            const activeKey = this.activeSession ? this.getSessionExportKey(this.activeSession) : '';
            if (activeKey) {
                const activeIndex = list.findIndex((session) => this.getSessionExportKey(session) === activeKey);
                if (activeIndex >= 0) {
                    targetCount = Math.max(targetCount, activeIndex + 1);
                }
            }
            if (targetCount >= list.length) {
                return list;
            }
            return list.slice(0, targetCount);
        },
        activeSessionVisibleMessages() {
            if (this.mainTab !== 'sessions' || !this.sessionPreviewRenderEnabled) {
                return [];
            }
            const list = Array.isArray(this.activeSessionMessages) ? this.activeSessionMessages : [];
            const rawCount = Number(this.sessionPreviewVisibleCount);
            const visibleCount = Number.isFinite(rawCount)
                ? Math.max(0, Math.floor(rawCount))
                : 0;
            if (visibleCount <= 0) {
                const initialBatchSize = Number.isFinite(this.sessionPreviewInitialBatchSize)
                    ? Math.max(1, Math.floor(this.sessionPreviewInitialBatchSize))
                    : 12;
                return list.slice(0, Math.min(initialBatchSize, list.length));
            }
            if (visibleCount >= list.length) return list;
            return list.slice(0, visibleCount);
        },
        canLoadMoreSessionMessages() {
            if (this.mainTab !== 'sessions' || !this.sessionPreviewRenderEnabled) {
                return false;
            }
            const total = Array.isArray(this.activeSessionMessages) ? this.activeSessionMessages.length : 0;
            const visible = Array.isArray(this.activeSessionVisibleMessages) ? this.activeSessionVisibleMessages.length : 0;
            return total > visible;
        },
        sessionPreviewRemainingCount() {
            const total = Array.isArray(this.activeSessionMessages) ? this.activeSessionMessages.length : 0;
            const visible = Array.isArray(this.activeSessionVisibleMessages) ? this.activeSessionVisibleMessages.length : 0;
            return Math.max(0, total - visible);
        },
        sessionTimelineNodes() {
            if (this.mainTab !== 'sessions' || !this.sessionPreviewRenderEnabled) {
                return [];
            }
            return buildSessionTimelineNodes(this.activeSessionVisibleMessages, {
                getKey: (message, index) => this.getRecordRenderKey(message, index)
            });
        },
        sessionTimelineNodeKeyMap() {
            const nodes = Array.isArray(this.sessionTimelineNodes) ? this.sessionTimelineNodes : [];
            if (!nodes.length) {
                return Object.create(null);
            }
            const map = Object.create(null);
            for (const node of nodes) {
                if (!node || !node.key) continue;
                map[node.key] = true;
            }
            return map;
        },
        sessionTimelineActiveTitle() {
            if (!this.sessionTimelineActiveKey) return '';
            const nodes = Array.isArray(this.sessionTimelineNodes) ? this.sessionTimelineNodes : [];
            const matched = nodes.find(node => node.key === this.sessionTimelineActiveKey);
            return matched ? matched.title : '';
        },
        sessionQueryPlaceholder() {
            if (this.isSessionQueryEnabled) {
                return typeof this.t === 'function'
                    ? this.t('sessions.query.placeholder.enabled')
                    : '关键词检索（支持 Codex/Claude，例：claude code）';
            }
            return typeof this.t === 'function'
                ? this.t('sessions.query.placeholder.disabled')
                : '当前来源暂不支持关键词检索';
        },
        sessionUsageCharts() {
            return buildUsageChartGroups(this.sessionsUsageList, {
                range: this.sessionsUsageTimeRange
            });
        },
        sessionUsageHeatmap() {
            const sessions = this.sessionUsageCharts && Array.isArray(this.sessionUsageCharts.filteredSessions)
                ? this.sessionUsageCharts.filteredSessions
                : this.sessionsUsageList;
            const heatmap = buildUsageHeatmap(sessions, { range: this.sessionsUsageTimeRange });
            const t = typeof this.t === 'function' ? this.t : null;
            const lang = typeof this.lang === 'string' ? this.lang.trim().toLowerCase() : '';
            const weekdayAxis = lang === 'en'
                ? ['Mon', '', 'Wed', '', 'Fri', '', '']
                : ['周一', '', '周三', '', '周五', '', ''];
            const months = lang === 'en'
                ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                : ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
            const windowWeeks = 52;
            const allWeeks = Array.isArray(heatmap.weeks) ? heatmap.weeks : [];
            const safeWindowWeeks = Math.max(1, Math.min(windowWeeks, allWeeks.length));
            const startIndex = Math.max(0, allWeeks.length - safeWindowWeeks);
            const displayWeeksRaw = allWeeks.slice(startIndex);
            let max = 0;
            for (const week of displayWeeksRaw) {
                const days = Array.isArray(week.days) ? week.days : [];
                for (const cell of days) {
                    if (cell && cell.isInRange) {
                        max = Math.max(max, cell.sessionCount || 0);
                    }
                }
            }
            max = Math.max(1, max);
            const dayMs = 24 * 60 * 60 * 1000;
            let lastMonth = -1;
            const weeks = displayWeeksRaw.map((week) => {
                const idx = Number.isFinite(Number(week.weekIndex)) ? Number(week.weekIndex) : 0;
                const weekStartMs = (Number.isFinite(Number(heatmap.alignedStart)) ? Number(heatmap.alignedStart) : 0) + (idx * 7 * dayMs);
                const month = Number.isFinite(weekStartMs) ? new Date(weekStartMs).getUTCMonth() : -1;
                const monthLabel = (month >= 0 && month <= 11 && month !== lastMonth) ? months[month] : '';
                if (month >= 0 && month <= 11) {
                    lastMonth = month;
                }
                return {
                    ...week,
                    monthLabel,
                    days: (Array.isArray(week.days) ? week.days : []).map((cell) => {
                    if (!cell) return null;
                    if (!cell.isInRange) {
                        return {
                            ...cell,
                            level: -1,
                            title: '',
                            ariaLabel: ''
                        };
                    }
                    const ratio = cell.sessionCount > 0 ? (cell.sessionCount / max) : 0;
                    const level = cell.sessionCount <= 0
                        ? 0
                        : (ratio <= 0.25 ? 1 : (ratio <= 0.5 ? 2 : (ratio <= 0.75 ? 3 : 4)));
                    const tokensTitle = formatUsageSummaryNumber(cell.tokenTotal || 0);
                    const title = t
                        ? t('usage.heatmap.tooltip', {
                            date: cell.dateKey,
                            sessions: cell.sessionCount,
                            messages: cell.messageCount,
                            tokens: tokensTitle
                        })
                        : `${cell.dateKey} · sessions ${cell.sessionCount} · messages ${cell.messageCount} · tokens ${tokensTitle}`;
                    const ariaLabel = t
                        ? t('usage.heatmap.aria', {
                            date: cell.dateKey,
                            sessions: cell.sessionCount
                        })
                        : `${cell.dateKey} sessions ${cell.sessionCount}`;
                    return {
                        ...cell,
                        level,
                        title,
                        ariaLabel
                    };
                })
                };
            });
            return {
                ...heatmap,
                weeks,
                weekdayAxis
            };
        },
        sessionUsageHourlyHeatmap() {
            const sessions = this.sessionUsageCharts && Array.isArray(this.sessionUsageCharts.filteredSessions)
                ? this.sessionUsageCharts.filteredSessions
                : this.sessionsUsageList;
            const result = buildUsageHourlyHeatmap(sessions, { range: this.sessionsUsageTimeRange });
            const t = typeof this.t === 'function' ? this.t : null;
            const lang = typeof this.lang === 'string' ? this.lang.trim().toLowerCase() : '';
            const weekdayLabelsZh = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
            const weekdayLabelsEn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const weekdayLabels = lang === 'en' ? weekdayLabelsEn : weekdayLabelsZh;
            const max = Math.max(1, result.maxSessionCount);
            const grid = Array.isArray(result.grid) ? result.grid : [];
            const rows = grid.map((cells, dayIndex) => ({
                weekday: weekdayLabels[dayIndex] || '',
                cells: cells.map((cell, hourIndex) => {
                    const ratio = cell.sessionCount > 0 ? (cell.sessionCount / max) : 0;
                    const level = cell.sessionCount <= 0
                        ? 0
                        : (ratio <= 0.25 ? 1 : (ratio <= 0.5 ? 2 : (ratio <= 0.75 ? 3 : 4)));
                    const hourLabel = String(hourIndex).padStart(2, '0');
                    const tooltipText = t
                        ? t('usage.hourlyHeatmap.tooltip', {
                            weekday: weekdayLabels[dayIndex],
                            hour: hourLabel,
                            sessions: cell.sessionCount,
                            messages: cell.messageCount,
                            tokens: (cell.tokenTotal || 0).toLocaleString('en-US')
                        })
                        : `${weekdayLabels[dayIndex] || ''} ${hourLabel}:00 · ${cell.sessionCount} sessions · ${cell.messageCount} messages · ${(cell.tokenTotal || 0).toLocaleString('en-US')} tokens`;
                    return {
                        hour: hourIndex,
                        hourLabel,
                        sessionCount: cell.sessionCount,
                        messageCount: cell.messageCount,
                        tokenTotal: cell.tokenTotal,
                        level,
                        tooltip: tooltipText
                    };
                })
            }));
            return {
                range: result.range,
                rows,
                hourLabels: result.hourLabels,
                maxSessionCount: result.maxSessionCount
            };
        },
        sessionUsageSummaryCards() {
            const summary = this.sessionUsageCharts && this.sessionUsageCharts.summary
                ? this.sessionUsageCharts.summary
                : { totalSessions: 0, totalMessages: 0, totalTokens: 0, totalContextWindow: 0, activeDurationMs: 0, totalDurationMs: 0, activeDays: 0, avgMessagesPerSession: 0, busiestDay: null, busiestHour: null };
            const filteredUsageSessions = this.sessionUsageCharts && Array.isArray(this.sessionUsageCharts.filteredSessions)
                ? this.sessionUsageCharts.filteredSessions
                : this.sessionsUsageList;
            const t = typeof this.t === 'function' ? this.t : null;
            const usageRangeLabel = formatUsageRangeLabel(this.sessionsUsageTimeRange, t);
            const noneLabel = t ? t('common.none') : '暂无';

            return [
                { key: 'sessions', label: t ? t('usage.summary.sessions') : '总会话数', value: formatUsageSummaryNumber(summary.totalSessions || 0) },
                { key: 'messages', label: t ? t('usage.summary.messages') : '总消息数', value: formatUsageSummaryNumber(summary.totalMessages || 0) },
                {
                    key: 'tokens',
                    label: t ? t('usage.summary.tokens') : '总 token 数',
                    value: formatCompactUsageSummaryNumber(summary.totalTokens || 0),
                    title: formatUsageSummaryNumber(summary.totalTokens || 0)
                },
                {
                    key: 'context-window',
                    label: t ? t('usage.summary.contextWindow') : '总上下文数',
                    value: formatCompactUsageSummaryNumber(summary.totalContextWindow || 0),
                    title: formatUsageSummaryNumber(summary.totalContextWindow || 0)
                },
                {
                    key: 'active-duration',
                    label: t ? t('usage.summary.activeDuration') : '活跃时长',
                    value: formatUsageDuration(summary.activeDurationMs || 0, { compact: true, lang: this.lang }),
                    title: t
                        ? t('usage.summary.activeDuration.title', {
                            value: formatUsageDuration(summary.activeDurationMs || 0, { maxParts: 3, compact: false, lang: this.lang })
                        })
                        : `累计会话跨度 ${formatUsageDuration(summary.activeDurationMs || 0, { maxParts: 3, compact: false, lang: this.lang })}`
                },
                {
                    key: 'total-duration',
                    label: t ? t('usage.summary.totalDuration') : '总时长',
                    value: formatUsageDuration(summary.totalDurationMs || 0, { compact: true, lang: this.lang }),
                    title: t
                        ? t('usage.summary.totalDuration.title', {
                            value: formatUsageDuration(summary.totalDurationMs || 0, { maxParts: 3, compact: false, lang: this.lang })
                        })
                        : `整体时间跨度 ${formatUsageDuration(summary.totalDurationMs || 0, { maxParts: 3, compact: false, lang: this.lang })}`
                },
                { key: 'days', label: t ? t('usage.summary.activeDays') : '活跃天数', value: formatUsageSummaryNumber(summary.activeDays || 0) },
                { key: 'avg-messages', label: t ? t('usage.summary.avgMessagesPerSession') : '平均每会话消息', value: summary.avgMessagesPerSession || 0 },
                {
                    key: 'busiest-day',
                    label: t ? t('usage.summary.busiestDay') : '最忙日',
                    value: summary.busiestDay && summary.busiestDay.totalSessions > 0
                        ? `${summary.busiestDay.label} · ${summary.busiestDay.totalSessions}`
                        : noneLabel
                },
                {
                    key: 'busiest-hour',
                    label: t ? t('usage.summary.busiestHour') : '高峰时段',
                    value: summary.busiestHour && summary.busiestHour.count > 0
                        ? `${summary.busiestHour.label} · ${summary.busiestHour.count}`
                        : noneLabel
                }
            ];
        },

        usageCurrentSessionStats() {
            const summary = this.sessionUsageCharts && this.sessionUsageCharts.summary
                ? this.sessionUsageCharts.summary
                : null;
            if (!summary) return null;
            const t = typeof this.t === 'function' ? this.t : null;
            return {
                apiDurationLabel: formatUsageDuration(summary.activeDurationMs || 0, { compact: true, lang: this.lang }),
                totalDurationLabel: formatUsageDuration(summary.totalDurationMs || 0, { compact: true, lang: this.lang }),
                tokenLabel: formatCompactUsageSummaryNumber(summary.totalTokens || 0),
                label: t ? t('usage.currentSession.title') : '当前会话',
                apiDurationText: t ? t('usage.currentSession.apiDuration') : 'API时长',
                totalDurationText: t ? t('usage.currentSession.totalDuration') : '总时长',
                tokenText: t ? t('usage.currentSession.tokens') : 'Token'
            };
        },

        sessionUsageDaily() {
            const baseBuckets = this.sessionUsageCharts && Array.isArray(this.sessionUsageCharts.buckets)
                ? this.sessionUsageCharts.buckets
                : [];
            const compareEnabled = this.sessionsUsageCompareEnabled === true && this.sessionsUsageTimeRange !== 'all';
            const sessions = compareEnabled
                ? this.sessionsUsageList
                : (this.sessionUsageCharts && Array.isArray(this.sessionUsageCharts.filteredSessions)
                    ? this.sessionUsageCharts.filteredSessions
                    : this.sessionsUsageList);
            const rangeDays = this.sessionsUsageTimeRange === '30d' ? 30 : 7;
            const dayMs = 24 * 60 * 60 * 1000;
            const byDay = new Map();

            for (const bucket of baseBuckets) {
                if (!bucket || !bucket.key) continue;
                byDay.set(bucket.key, {
                    key: bucket.key,
                    label: bucket.label || bucket.key.slice(5),
                    sessionCount: 0,
                    messageCount: 0,
                    tokenTotal: 0,

                });
                if (compareEnabled) {
                    const baseMs = Date.parse(`${bucket.key}T00:00:00.000Z`);
                    if (Number.isFinite(baseMs)) {
                        const prevKey = new Date(baseMs - (rangeDays * dayMs)).toISOString().slice(0, 10);
                        if (!byDay.has(prevKey)) {
                            byDay.set(prevKey, {
                                key: prevKey,
                                label: prevKey.slice(5),
                                sessionCount: 0,
                                messageCount: 0,
                                tokenTotal: 0,

                            });
                        }
                    }
                }
            }

            for (const session of (Array.isArray(sessions) ? sessions : [])) {
                if (!session || typeof session !== 'object') continue;
                const updatedAtMs = Date.parse(session.updatedAt || '');
                if (!Number.isFinite(updatedAtMs)) continue;
                const dayKey = new Date(updatedAtMs).toISOString().slice(0, 10);
                const row = byDay.get(dayKey);
                if (!row) continue;

                const messageCount = Number.isFinite(Number(session.messageCount))
                    ? Math.max(0, Math.floor(Number(session.messageCount)))
                    : 0;
                const tokenTotal = Number.isFinite(Number(session.totalTokens))
                    ? Math.max(0, Math.floor(Number(session.totalTokens)))
                    : 0;
                row.sessionCount += 1;
                row.messageCount += messageCount;
                row.tokenTotal += tokenTotal;

                            }

            const currentKeys = baseBuckets.map((bucket) => bucket && bucket.key).filter(Boolean);
            const rows = currentKeys
                .map((key) => byDay.get(key))
                .filter(Boolean)
                .sort((a, b) => b.key.localeCompare(a.key, 'en-US'));
            const rowsWithCompare = rows.map((row) => {
                if (!compareEnabled) {
                    return { ...row, compareEnabled: false, prevKey: '', prevTokenTotal: 0 };
                }
                const baseMs = Date.parse(`${row.key}T00:00:00.000Z`);
                const prevKey = Number.isFinite(baseMs)
                    ? new Date(baseMs - (rangeDays * dayMs)).toISOString().slice(0, 10)
                    : '';
                const prevRow = prevKey ? byDay.get(prevKey) : null;
                return {
                    ...row,
                    compareEnabled: true,
                    prevKey,
                    prevTokenTotal: prevRow ? prevRow.tokenTotal : 0,
                };
            });
            const maxTokens = rowsWithCompare.reduce((max, item) => Math.max(max, item.tokenTotal, item.prevTokenTotal || 0), 0);

            return {
                rows: rowsWithCompare.map((row) => ({
                    ...row,
                    tokenLabel: formatCompactUsageSummaryNumber(row.tokenTotal),
                    tokenTitle: formatUsageSummaryNumber(row.tokenTotal),
                    tokenPercent: maxTokens > 0 ? Math.round((row.tokenTotal / maxTokens) * 1000) / 10 : 0,
                    prevTokenPercent: row.compareEnabled && maxTokens > 0 ? Math.round(((row.prevTokenTotal || 0) / maxTokens) * 1000) / 10 : 0,
                    prevTokenTitle: row.compareEnabled ? formatUsageSummaryNumber(row.prevTokenTotal || 0) : '',
                    prevCostTitle: row.compareEnabled ? formatUsageSummaryNumber(row.prevTokenTotal || 0) : '',
                })),
                maxTokens,
            };
        },

        sessionUsageDailyTableRows() {
            const daily = this.sessionUsageDaily && typeof this.sessionUsageDaily === 'object'
                ? this.sessionUsageDaily
                : null;
            return daily && Array.isArray(daily.rows) ? daily.rows : [];
        },

        sessionsUsageSelectedDaySummary() {
            const dayKey = typeof this.sessionsUsageSelectedDayKey === 'string' ? this.sessionsUsageSelectedDayKey.trim() : '';
            if (!dayKey) return null;
            const sessions = this.sessionUsageCharts && Array.isArray(this.sessionUsageCharts.filteredSessions)
                ? this.sessionUsageCharts.filteredSessions
                : this.sessionsUsageList;
            const rangeDays = this.sessionsUsageTimeRange === '30d' ? 30 : 7;
            const dayMs = 24 * 60 * 60 * 1000;
            const baseMs = Date.parse(`${dayKey}T00:00:00.000Z`);
            const prevKey = Number.isFinite(baseMs)
                ? new Date(baseMs - (rangeDays * dayMs)).toISOString().slice(0, 10)
                : '';
            let sessionCount = 0;
            let messageCount = 0;
            let tokenTotal = 0;
            let prevTokenTotal = 0;
            const modelMap = new Map();
            const sessionRows = [];
            for (const session of (Array.isArray(sessions) ? sessions : [])) {
                if (!session || typeof session !== 'object') continue;
                const updatedAtMs = Date.parse(session.updatedAt || '');
                if (!Number.isFinite(updatedAtMs)) continue;
                const key = new Date(updatedAtMs).toISOString().slice(0, 10);
                const isCurrent = key === dayKey;
                const isPrev = !!prevKey && key === prevKey;
                if (!isCurrent && !isPrev) continue;
                const msgCount = Number.isFinite(Number(session.messageCount))
                    ? Math.max(0, Math.floor(Number(session.messageCount)))
                    : 0;
                const sessionTokens = Number.isFinite(Number(session.totalTokens))
                    ? Math.max(0, Math.floor(Number(session.totalTokens)))
                    : 0;
                if (isCurrent) {
                    sessionCount += 1;
                    messageCount += msgCount;
                    tokenTotal += sessionTokens;
                } else if (isPrev) {
                    prevTokenTotal += sessionTokens;
                }
                const model = typeof session.model === 'string' ? session.model.trim() : '';
                if (isCurrent && model) {
                    modelMap.set(model, (modelMap.get(model) || 0) + 1);
                }
                const title = typeof session.title === 'string' && session.title.trim()
                    ? session.title.trim()
                    : (typeof session.sessionId === 'string' && session.sessionId.trim() ? session.sessionId.trim() : '未命名会话');
                if (isCurrent) {
                    sessionRows.push({
                        key: this.getSessionExportKey(session) || `${title}:${sessionCount}`,
                        title,
                        messageCount: msgCount
                    });
                }
            }
            sessionRows.sort((a, b) => b.messageCount - a.messageCount);
            const lang = typeof this.lang === 'string' ? this.lang.trim().toLowerCase() : '';
            const suffix = lang === 'en' ? 'msgs' : '条';
            const topSessions = sessionRows.slice(0, 8).map((item) => ({
                ...item,
                messageCountLabel: `${item.messageCount} ${suffix}`
            }));
            const topModels = [...modelMap.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([model, count]) => ({
                    key: model,
                    label: `${model} · ${count}`
                }));
            return {
                dayKey,
                prevKey,
                sessionCount,
                messageCount,
                tokenTotal,
                tokenLabel: formatUsageSummaryNumber(tokenTotal),
                prevTokenTotal,
                prevTokenLabel: prevKey ? formatUsageSummaryNumber(prevTokenTotal) : null,
                deltaTokenLabel: prevKey ? formatSignedUsageSummaryNumber(tokenTotal - prevTokenTotal) : null,
                topSessions,
                topModels
            };
        },

        usageHeroMainValue() {
            const summary = this.sessionUsageCharts && this.sessionUsageCharts.summary
                ? this.sessionUsageCharts.summary
                : null;
            if (!summary) return '0';
            return formatCompactUsageSummaryNumber(summary.totalTokens || 0);
        },

        usageHeroSubLabel() {
            const summary = this.sessionUsageCharts && this.sessionUsageCharts.summary
                ? this.sessionUsageCharts.summary
                : null;
            if (!summary) return '';
            const t = typeof this.t === 'function' ? this.t : null;
            const sessionCount = summary.totalSessions || 0;
            const rangeLabel = this.sessionsUsageTimeRange === '30d' ? '30天' : (this.sessionsUsageTimeRange === 'all' ? '全部' : '7天');
            const rangeText = t ? t('usage.range.' + this.sessionsUsageTimeRange) : rangeLabel;
            return `${formatUsageSummaryNumber(sessionCount)} sessions · ${rangeText}`;
        },

        usageHeroDelta() {
            const range = this.sessionsUsageTimeRange;
            if (range === 'all') return null;
            const summary = this.sessionUsageCharts && this.sessionUsageCharts.summary
                ? this.sessionUsageCharts.summary
                : null;
            if (!summary || !summary.totalTokens) return null;

            const rangeDays = range === '30d' ? 30 : 7;
            const dayMs = 24 * 60 * 60 * 1000;
            const nowMs = Date.now();
            const prevStartMs = nowMs - (rangeDays * 2 * dayMs);
            const prevEndMs = nowMs - (rangeDays * dayMs);

            let prevTokens = 0;
            for (const session of (Array.isArray(this.sessionsUsageList) ? this.sessionsUsageList : [])) {
                if (!session || typeof session !== 'object') continue;
                const updatedAtMs = Date.parse(session.updatedAt || '');
                if (!Number.isFinite(updatedAtMs)) continue;
                if (updatedAtMs >= prevStartMs && updatedAtMs < prevEndMs) {
                    const sessionTokens = Number.isFinite(Number(session.totalTokens))
                        ? Math.max(0, Math.floor(Number(session.totalTokens)))
                        : 0;
                    prevTokens += sessionTokens;
                }
            }

            if (prevTokens === 0) return null;
            const currentTokens = summary.totalTokens;
            const delta = currentTokens - prevTokens;
            const deltaPercent = prevTokens > 0 ? Math.round((delta / prevTokens) * 100) : 0;
            const arrow = delta > 0 ? '↑' : (delta < 0 ? '↓' : '–');
            const sign = delta >= 0 ? '+' : '';
            return `${arrow} ${sign}${deltaPercent}%`;
        },

        usageHeroDeltaClass() {
            const summary = this.sessionUsageCharts && this.sessionUsageCharts.summary
                ? this.sessionUsageCharts.summary
                : null;
            if (!summary || !summary.totalTokens) return '';

            const range = this.sessionsUsageTimeRange;
            if (range === 'all') return '';

            const rangeDays = range === '30d' ? 30 : 7;
            const dayMs = 24 * 60 * 60 * 1000;
            const nowMs = Date.now();
            const prevStartMs = nowMs - (rangeDays * 2 * dayMs);
            const prevEndMs = nowMs - (rangeDays * dayMs);

            let prevTokens = 0;
            for (const session of (Array.isArray(this.sessionsUsageList) ? this.sessionsUsageList : [])) {
                if (!session || typeof session !== 'object') continue;
                const updatedAtMs = Date.parse(session.updatedAt || '');
                if (!Number.isFinite(updatedAtMs)) continue;
                if (updatedAtMs >= prevStartMs && updatedAtMs < prevEndMs) {
                    const sessionTokens = Number.isFinite(Number(session.totalTokens))
                        ? Math.max(0, Math.floor(Number(session.totalTokens)))
                        : 0;
                    prevTokens += sessionTokens;
                }
            }

            if (prevTokens === 0) return '';
            const currentTokens = summary.totalTokens;
            return currentTokens >= prevTokens ? 'delta-up' : 'delta-down';
        },

        sessionsUsageSelectedDay() {
            return this.sessionsUsageSelectedDayKey || '';
        },

        sessionUsageWave() {
            const daily = this.sessionUsageDaily && typeof this.sessionUsageDaily === 'object'
                ? this.sessionUsageDaily
                : null;
            if (!daily || !Array.isArray(daily.rows) || daily.rows.length === 0) {
                return { points: [], labels: [], linePath: '', areaPath: '', width: 800, maxTokens: 0 };
            }

            const rows = daily.rows;
            const maxTokens = daily.maxTokens || 1;
            const width = 800;
            const height = 140;
            const padding = { top: 10, bottom: 30, left: 0, right: 0 };
            const chartWidth = width - padding.left - padding.right;
            const chartHeight = height - padding.top - padding.bottom;

            const points = rows.map((row, index) => {
                const x = padding.left + (index / (rows.length - 1 || 1)) * chartWidth;
                const normalizedValue = maxTokens > 0 ? (row.tokenTotal / maxTokens) : 0;
                const y = padding.top + chartHeight - (normalizedValue * chartHeight);
                return { x, y, key: row.key, value: row.tokenTotal, label: row.label };
            });

            const linePath = points.length > 1
                ? `M ${points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`
                : '';

            const areaPath = points.length > 1
                ? `${linePath} L ${points[points.length - 1].x.toFixed(1)},${(padding.top + chartHeight).toFixed(1)} L ${points[0].x.toFixed(1)},${(padding.top + chartHeight).toFixed(1)} Z`
                : '';

            const selectedKey = this.sessionsUsageSelectedDayKey;
            const selectedPoint = points.find(p => p.key === selectedKey) || points[points.length - 1] || null;

            return {
                points,
                labels: rows.map((row, index) => ({
                    key: row.key,
                    text: row.label
                })),
                linePath,
                areaPath,
                width,
                height,
                maxTokens,
                hoverX: selectedPoint ? selectedPoint.x : 0,
                hoverY: selectedPoint ? selectedPoint.y : 0
            };
        },

        visibleSessionTrashItems() {
            const items = Array.isArray(this.sessionTrashItems) ? this.sessionTrashItems : [];
            const visibleCount = Number(this.sessionTrashVisibleCount);
            const safeVisibleCount = Number.isFinite(visibleCount) && visibleCount > 0
                ? Math.floor(visibleCount)
                : SESSION_TRASH_PAGE_SIZE;
            return items.slice(0, safeVisibleCount);
        },
        sessionTrashHasMoreItems() {
            return this.visibleSessionTrashItems.length < this.sessionTrashCount;
        },
        sessionTrashHiddenCount() {
            return Math.max(0, this.sessionTrashCount - this.visibleSessionTrashItems.length);
        },
        sessionTrashCount() {
            const totalCount = Number(this.sessionTrashTotalCount);
            if (Number.isFinite(totalCount) && totalCount >= 0) {
                return Math.max(0, Math.floor(totalCount));
            }
            return Array.isArray(this.sessionTrashItems) ? this.sessionTrashItems.length : 0;
        },

        sessionContextUtilization() {
            const list = Array.isArray(this.sessionsList) ? this.sessionsList : [];
            const utilizationMap = {};
            for (const session of list) {
                if (!session || typeof session !== 'object') continue;
                const key = this.getSessionExportKey(session);
                if (!key) continue;
                const totalTokens = Number.isFinite(Number(session.totalTokens))
                    ? Math.max(0, Math.floor(Number(session.totalTokens)))
                    : 0;
                const contextWindow = Number.isFinite(Number(session.contextWindow))
                    ? Math.max(0, Math.floor(Number(session.contextWindow)))
                    : 0;
                if (contextWindow <= 0) {
                    utilizationMap[key] = { percent: 0, level: 'normal' };
                    continue;
                }
                const percent = Math.min(100, Math.round((totalTokens / contextWindow) * 100));
                let level = 'normal';
                if (percent >= 95) {
                    level = 'critical';
                } else if (percent >= 80) {
                    level = 'warning';
                }
                utilizationMap[key] = { percent, level };
            }
            return utilizationMap;
        }
    };
}
