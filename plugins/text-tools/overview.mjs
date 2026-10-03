import { textTools, DEFAULT_TEXT_TOOL_ID } from './index.mjs';

export async function loadTextToolsOverview(ctx) {
    const app = ctx && typeof ctx === 'object' ? ctx : {};
    const activeId = typeof app.textToolsActiveToolId === 'string' ? app.textToolsActiveToolId.trim() : '';
    const exists = textTools.some((tool) => tool && tool.id === activeId);
    app.textToolsActiveToolId = exists ? activeId : DEFAULT_TEXT_TOOL_ID;
    if (typeof app.textToolsInput !== 'string') {
        app.textToolsInput = '';
    }
    return true;
}
