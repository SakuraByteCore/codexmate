import {
    buildSessionFilterCacheState,
    isSessionQueryEnabled
} from '../logic.mjs';

export function normalizeSessionRoleFilter(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === 'user' || normalized === 'assistant' || normalized === 'system') {
        return normalized;
    }
    return 'all';
}

export function normalizeSessionTimePreset(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (normalized === '7d' || normalized === '30d' || normalized === '90d') {
        return normalized;
    }
    return 'all';
}

export function readSessionsFilterUrlState() {
    try {
        const url = new URL(window.location.href);
        if (url.pathname === '/session') return null;
        const source = (url.searchParams.get('s_source') || '').trim().toLowerCase();
        const pathFilter = url.searchParams.get('s_path') || '';
        const query = url.searchParams.get('s_query') || '';
        const roleFilter = url.searchParams.get('s_role') || 'all';
        const timeRangePreset = url.searchParams.get('s_time') || 'all';
        const hasAny = !!(source || pathFilter || query || roleFilter !== 'all' || timeRangePreset !== 'all');
        if (!hasAny) return null;
        return {
            source: source || 'all',
            pathFilter,
            query,
            roleFilter,
            timeRangePreset
        };
    } catch (_) {
        return null;
    }
}

export function applySessionsFilterUrlState(vm, state) {
    if (!vm || !state) return;
    const cached = buildSessionFilterCacheState(state.source, state.pathFilter);
    vm.sessionFilterSource = cached.source;
    vm.sessionPathFilter = cached.pathFilter;
    vm.sessionQuery = typeof state.query === 'string' ? state.query : '';
    vm.sessionRoleFilter = normalizeSessionRoleFilter(state.roleFilter);
    vm.sessionTimePreset = normalizeSessionTimePreset(state.timeRangePreset);
    if (typeof vm.refreshSessionPathOptions === 'function') {
        vm.refreshSessionPathOptions(vm.sessionFilterSource);
    }
}

export function canonicalizeWebUiUrl(url) {
    if (!url || typeof url !== 'object') return url;
    if (url.pathname === '/web-ui/index.html') {
        url.pathname = '/';
    }
    return url;
}

function canonicalizeWebUiHistoryUrl(value) {
    if (typeof window === 'undefined' || !window.location) return value;
    if (typeof value === 'undefined' || value === null) return value;
    try {
        const url = canonicalizeWebUiUrl(new URL(String(value), window.location.href));
        return url && url.pathname === '/' ? url.href : value;
    } catch (_) {
        return value;
    }
}

export function normalizeCurrentWebUiUrl() {
    try {
        const url = canonicalizeWebUiUrl(new URL(window.location.href));
        if (url && url.href !== window.location.href) {
            window.history.replaceState(null, '', url.href);
        }
        return url;
    } catch (_) {
        return null;
    }
}

export function installWebUiUrlCanonicalization() {
    if (typeof window === 'undefined' || !window.history) return false;
    if (window.__codexmateWebUiUrlCanonicalizationInstalled) {
        normalizeCurrentWebUiUrl();
        return true;
    }
    try {
        const originalReplaceState = window.history.replaceState;
        const originalPushState = window.history.pushState;
        if (typeof originalReplaceState === 'function') {
            window.history.replaceState = function replaceState(state, title, url) {
                return originalReplaceState.call(this, state, title, canonicalizeWebUiHistoryUrl(url));
            };
        }
        if (typeof originalPushState === 'function') {
            window.history.pushState = function pushState(state, title, url) {
                return originalPushState.call(this, state, title, canonicalizeWebUiHistoryUrl(url));
            };
        }
        window.__codexmateWebUiUrlCanonicalizationInstalled = true;
        normalizeCurrentWebUiUrl();
        return true;
    } catch (_) {
        normalizeCurrentWebUiUrl();
        return false;
    }
}

export function buildSessionsFilterShareUrl(vm) {
    try {
        // 使用干净的根路径作为基础 URL，避免把 /web-ui/index.html 或 /session 带进分享链接。
        const baseUrl = window.location.origin + '/';
        const url = canonicalizeWebUiUrl(new URL(baseUrl));
        url.searchParams.set('tab', 'sessions');
        url.searchParams.set('s_source', String(vm.sessionFilterSource || 'all'));
        if (vm.sessionPathFilter) url.searchParams.set('s_path', String(vm.sessionPathFilter || ''));
        if (vm.sessionQuery && isSessionQueryEnabled(vm.sessionFilterSource)) url.searchParams.set('s_query', String(vm.sessionQuery || ''));
        if (vm.sessionRoleFilter && vm.sessionRoleFilter !== 'all') url.searchParams.set('s_role', String(vm.sessionRoleFilter || 'all'));
        if (vm.sessionTimePreset && vm.sessionTimePreset !== 'all') url.searchParams.set('s_time', String(vm.sessionTimePreset || 'all'));
        return url.toString();
    } catch (_) {
        return '';
    }
}

export function syncSessionsFilterUrl(vm) {
    // URL 保持静态，不同步状态到 URL
    // 所有状态通过 localStorage 管理
}

