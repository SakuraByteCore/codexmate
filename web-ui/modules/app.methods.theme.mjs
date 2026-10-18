const THEME_STORAGE_CACHE_KEY = 'codexmateThemeCache';

export function createThemeMethods() {
    return {
        normalizeTheme(value) {
            return value === 'dark' ? 'dark' : 'light';
        },
        applyDocumentTheme() {
            try {
                if (typeof document === 'undefined' || !document.documentElement) return;
                const next = this.normalizeTheme(this.theme);
                if (next === 'dark') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                } else {
                    document.documentElement.removeAttribute('data-theme');
                }
                // Render hint only: lets the inline head script skip the light
                // flash before server preferences arrive. Source of truth is
                // the server-side webUi preference store.
                const storage = typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
                if (storage && typeof storage.setItem === 'function' && typeof storage.removeItem === 'function') {
                    if (next === 'dark') storage.setItem(THEME_STORAGE_CACHE_KEY, 'dark');
                    else storage.removeItem(THEME_STORAGE_CACHE_KEY);
                }
            } catch (_) {}
        },
        setTheme(theme) {
            const next = this.normalizeTheme(theme);
            if (next !== this.theme) {
                this.theme = next;
                this.applyDocumentTheme();
            }
            if (typeof this.persistWebUiPreferences === 'function') {
                this.persistWebUiPreferences({ theme: next });
            }
        }
    };
}
