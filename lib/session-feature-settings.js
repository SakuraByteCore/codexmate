'use strict';
const path = require('path');
const { createLocalFeatureStore } = require('./local-feature-store');
function createSessionFeatureSettings(root) {
    const store = createLocalFeatureStore(path.join(root, 'preferences.json'), { version: 1, windows: {}, dismissed: {} });
    function get() { const snapshot = store.read(); return { settings: snapshot.value, revision: snapshot.revision }; }
    function save(params) {
        const snapshot = store.read();
        if (snapshot.revision !== params.revision) throw new Error('feature-store-conflict');
        if (typeof params.key !== 'string' || !params.key || params.key.length > 1000
            || (params.window !== '' && (!Number.isSafeInteger(params.window) || params.window <= 0))
            || typeof params.dismissed !== 'boolean') throw new Error('context-window-invalid');
        if (params.window === '') delete snapshot.value.windows[params.key];
        else snapshot.value.windows[params.key] = params.window;
        snapshot.value.dismissed[params.key] = params.dismissed;
        store.write(snapshot.value, snapshot.revision);
        return get();
    }
    return { get, save };
}
module.exports = { createSessionFeatureSettings };
