export function getProviderDisplayUrl(provider) {
    if (!provider) return '';
    const bridge = typeof provider.codexmate_bridge === 'string' ? provider.codexmate_bridge.trim() : '';
    if (bridge === 'openai') {
        const upstream = typeof provider.upstreamUrl === 'string' ? provider.upstreamUrl.trim() : '';
        if (upstream) return upstream;
    }
    return provider.url || '';
}

export function checkIsTransformProvider(provider) {
    if (!provider || typeof provider !== 'object') return false;
    const bridge = typeof provider.codexmate_bridge === 'string' ? provider.codexmate_bridge.trim() : '';
    if (bridge === 'openai') return true;
    const url = String(provider.url || '');
    return url.includes('/bridge/openai/');
}
