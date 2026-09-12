const INPUT_STORAGE_KEY = 'codexmate.plugins.textTools.input.v1';

export function readTextToolsInputFromStorage(storage = localStorage) {
    if (!storage) return '';
    try {
        const raw = storage.getItem(INPUT_STORAGE_KEY) || '';
        return typeof raw === 'string' ? raw : '';
    } catch (_) {
        return '';
    }
}

export function persistTextToolsInputToStorage(text, storage = localStorage) {
    if (!storage) return false;
    try {
        storage.setItem(INPUT_STORAGE_KEY, typeof text === 'string' ? text : '');
        return true;
    } catch (_) {
        return false;
    }
}

export function clearTextToolsStorage(storage = localStorage) {
    if (!storage) return;
    try {
        storage.removeItem(INPUT_STORAGE_KEY);
    } catch (_) {}
}