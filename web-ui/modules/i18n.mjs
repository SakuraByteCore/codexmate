import { DICT } from './i18n.dict.mjs';

const I18N_STORAGE_KEY = 'codexmateLang';

const LANGUAGE_META = Object.freeze([
    Object.freeze({ code: 'zh', nativeName: '中文', englishName: 'Chinese', htmlLang: 'zh-CN', dir: 'ltr' }),
    Object.freeze({ code: 'en', nativeName: 'English', englishName: 'English', htmlLang: 'en', dir: 'ltr' }),
    Object.freeze({ code: 'ja', nativeName: '日本語', englishName: 'Japanese', htmlLang: 'ja', dir: 'ltr' }),
    Object.freeze({ code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', htmlLang: 'vi', dir: 'ltr' })
]);

function getAvailableLanguages() {
    return LANGUAGE_META.filter((item) => item && item.code && DICT[item.code]);
}

function getDefaultLanguageMeta() {
    const available = getAvailableLanguages();
    return available[0] || LANGUAGE_META[0];
}

function getLanguageMeta(code) {
    const normalized = typeof code === 'string' ? code.trim().toLowerCase() : '';
    return getAvailableLanguages().find((item) => item.code === normalized) || getDefaultLanguageMeta();
}

function normalizeLang(value) {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
    const available = getAvailableLanguages();
    const fallback = available[0] && available[0].code ? available[0].code : 'zh';
    return available.some((item) => item.code === normalized) ? normalized : fallback;
}

function applyDocumentLanguage(next) {
    try {
        if (typeof document === 'undefined' || !document.documentElement) return;
        const meta = getLanguageMeta(next);
        document.documentElement.lang = meta.htmlLang || meta.code || 'zh-CN';
        document.documentElement.dir = meta.dir || 'ltr';
    } catch (_) {}
}

function interpolate(template, params) {
    if (!params || typeof params !== 'object') return template;
    return String(template).replace(/\{(\w+)\}/g, (_, key) => {
        const value = params[key];
        return value === undefined || value === null ? '' : String(value);
    });
}

export function createI18nMethods() {
    return {
        normalizeLang,
        initI18n() {
            const saved = typeof localStorage !== 'undefined'
                ? localStorage.getItem(I18N_STORAGE_KEY)
                : '';
            const next = normalizeLang(saved);
            this.lang = next;
            applyDocumentLanguage(next);
        },
        languageOptions() {
            return getAvailableLanguages();
        },
        currentLanguageLabel() {
            return getLanguageMeta(this.lang).nativeName || '中文';
        },
        openLanguageSettings() {
            if (typeof this.switchMainTab === 'function') {
                this.switchMainTab('settings');
            } else {
                this.mainTab = 'settings';
                if (typeof this.saveNavState === 'function') {
                    this.saveNavState();
                }
            }
            this.settingsTab = 'general';
            this.$nextTick(() => {
                const target = typeof document !== 'undefined'
                    ? document.getElementById('settings-language')
                    : null;
                if (target && typeof target.scrollIntoView === 'function') {
                    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
                const select = typeof document !== 'undefined'
                    ? document.getElementById('settings-language-select')
                    : null;
                if (select && typeof select.focus === 'function') {
                    select.focus();
                }
            });
        },
        setLang(nextLang) {
            const next = normalizeLang(nextLang);
            this.lang = next;
            try {
                if (typeof localStorage !== 'undefined') {
                    localStorage.setItem(I18N_STORAGE_KEY, next);
                }
            } catch (_) {}
            applyDocumentLanguage(next);
        },
        t(key, params = null) {
            const lang = normalizeLang(this.lang);
            const table = DICT[lang] || DICT.zh;
            const fallbackEn = DICT.en;
            const fallbackZh = DICT.zh;
            const raw = (table && table[key]) || (fallbackEn && fallbackEn[key]) || (fallbackZh && fallbackZh[key]) || key;
            return interpolate(raw, params);
        }
    };
}
