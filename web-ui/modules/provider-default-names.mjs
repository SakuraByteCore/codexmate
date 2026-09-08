export function nextNumericProviderName(existingNames) {
    const used = new Set();
    const list = Array.isArray(existingNames) ? existingNames : [];
    for (const item of list) {
        const name = typeof item === 'string'
            ? item.trim()
            : (item && typeof item.name === 'string' ? item.name.trim() : '');
        if (!/^\d+$/.test(name)) continue;
        const value = Number(name);
        if (Number.isSafeInteger(value) && value > 0) {
            used.add(value);
        }
    }
    let next = 1;
    while (used.has(next)) next += 1;
    return String(next);
}

export function nextCodexProviderName(providers) {
    return nextNumericProviderName(Array.isArray(providers) ? providers : []);
}

export function nextClaudeConfigName(configs) {
    return nextNumericProviderName(Object.keys(configs && typeof configs === 'object' ? configs : {}));
}
