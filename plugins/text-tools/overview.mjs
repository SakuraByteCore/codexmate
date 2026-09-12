import { readTextToolsInputFromStorage } from './storage.mjs';

export async function loadTextToolsOverview(ctx, options = {}) {
    const app = ctx && typeof ctx === 'object' ? ctx : {};
    const forceRefresh = !!(options && options.forceRefresh);

    const shouldReload = forceRefresh || app.textToolsLoadedOnce !== true;
    if (!shouldReload) return true;

    if (typeof app.textToolsInput !== 'string' || app.textToolsInput === '') {
        app.textToolsInput = readTextToolsInputFromStorage(localStorage);
    }
    if (typeof app.textToolsOutput !== 'string') {
        app.textToolsOutput = '';
    }

    app.textToolsLoadedOnce = true;
    return true;
}