import { textTools, DEFAULT_TEXT_TOOL_ID } from './index.mjs';

export function createTextToolsComputed() {
    return {
        textToolsList() {
            const t = typeof this.t === 'function' ? this.t : null;
            return textTools.map((tool) => ({
                id: tool.id,
                labelKey: tool.labelKey,
                label: t ? t(tool.labelKey) : tool.labelKey
            }));
        },

        textToolsOutput() {
            const activeId = typeof this.textToolsActiveToolId === 'string' ? this.textToolsActiveToolId.trim() : '';
            const tool = textTools.find((item) => item && item.id === activeId)
                || textTools.find((item) => item && item.id === DEFAULT_TEXT_TOOL_ID)
                || null;
            const input = typeof this.textToolsInput === 'string' ? this.textToolsInput : '';
            return tool && typeof tool.run === 'function' ? tool.run(input) : '';
        }
    };
}
