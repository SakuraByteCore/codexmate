import { TEXT_TOOL_GROUPS, TEXT_TOOLS } from './tools.mjs';

function translate(t, key, fallback) {
    if (typeof t !== 'function') return fallback;
    const translated = t(key);
    return translated === key ? fallback : translated;
}

function countWords(text) {
    const raw = typeof text === 'string' ? text : '';
    const trimmed = raw.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
}

function byteLength(text) {
    const raw = typeof text === 'string' ? text : '';
    return new TextEncoder().encode(raw).length;
}

export function createPluginsComputed() {
    return {
        textToolsGroups() {
            const t = this.t;
            return TEXT_TOOL_GROUPS.map((group) => {
                const tools = TEXT_TOOLS
                    .filter((tool) => tool && tool.group === group.id)
                    .map((tool) => ({
                        id: tool.id,
                        label: translate(t, tool.labelKey, tool.id)
                    }));
                return {
                    id: group.id,
                    label: translate(t, group.labelKey, group.id),
                    tools
                };
            });
        },

        textToolsStats() {
            const text = typeof this.textToolsInput === 'string' ? this.textToolsInput : '';
            const t = this.t;
            const lines = text === '' ? 0 : text.split(/\r?\n/).length;
            return [
                { label: translate(t, 'plugins.textTools.stats.chars', 'Characters'), value: Array.from(text).length },
                { label: translate(t, 'plugins.textTools.stats.lines', 'Lines'), value: lines },
                { label: translate(t, 'plugins.textTools.stats.words', 'Words'), value: countWords(text) },
                { label: translate(t, 'plugins.textTools.stats.bytes', 'Bytes'), value: byteLength(text) }
            ];
        }
    };
}