const accessTokenLocation = typeof location !== 'undefined' ? location : null;
const initialAccessToken = (() => {
    try { return accessTokenLocation ? new URL(accessTokenLocation.href).searchParams.get('token') || '' : ''; }
    catch (_) { return ''; }
})();

export function getAccessToken() {
    if (!accessTokenLocation) return '';
    try {
        return new URL(accessTokenLocation.href).searchParams.get('token') || initialAccessToken;
    } catch (_) {
        return '';
    }
}

export function withAccessToken(url) {
    const token = getAccessToken();
    if (!token) return url;
    try {
        const parsed = new URL(url, accessTokenLocation && accessTokenLocation.origin ? accessTokenLocation.origin : 'http://localhost');
        parsed.searchParams.set('token', token);
        return parsed.pathname.startsWith('/') && accessTokenLocation && accessTokenLocation.origin
            ? `${parsed.pathname}${parsed.search}${parsed.hash}`
            : parsed.toString();
    } catch (_) {
        return url;
    }
}

export function authorizationHeaders(extra = {}) {
    const token = getAccessToken();
    return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}
