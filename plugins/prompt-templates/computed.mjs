function normalizePromptTemplateEntry(item) {
    const safe = item && typeof item === 'object' ? item : {};
    const id = typeof safe.id === 'string' ? safe.id.trim() : '';
    const name = typeof safe.name === 'string' ? safe.name.trim() : '';
    const description = typeof safe.description === 'string' ? safe.description.trim() : '';
    const template = typeof safe.template === 'string' ? safe.template : '';
    const updatedAt = typeof safe.updatedAt === 'string' ? safe.updatedAt : '';
    const createdAt = typeof safe.createdAt === 'string' ? safe.createdAt : updatedAt;
    const isBuiltin = safe.isBuiltin === true;
    const createdBy = typeof safe.createdBy === 'string' ? safe.createdBy.trim() : '';
    const maintainers = Array.isArray(safe.maintainers)
        ? safe.maintainers.map((m) => (typeof m === 'string' ? m.trim() : '')).filter(Boolean)
        : [];
    return {
        id,
        name,
        description,
        template,
        createdAt,
        updatedAt,
        isBuiltin,
        createdBy,
        maintainers
    };
}

const TEMPLATE_PARTS_CACHE = new Map();

function parseTemplateVariables(templateText) {
    const text = typeof templateText === 'string' ? templateText : '';
    const vars = new Set();
    const re = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
    for (;;) {
        const match = re.exec(text);
        if (!match) break;
        const name = String(match[1] || '').trim();
        if (name) vars.add(name);
    }
    return Array.from(vars).sort((a, b) => a.localeCompare(b, 'en-US'));
}

function parseTemplateParts(templateText) {
    const text = typeof templateText === 'string' ? templateText : '';
    const parts = [];
    const re = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
    let lastIndex = 0;
    for (;;) {
        const match = re.exec(text);
        if (!match) break;
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
            parts.push({ type: 'text', value: text.slice(lastIndex, matchIndex) });
        }
        const name = String(match[1] || '').trim();
        parts.push({ type: 'var', name: name || '' });
        lastIndex = matchIndex + match[0].length;
    }
    if (lastIndex < text.length) {
        parts.push({ type: 'text', value: text.slice(lastIndex) });
    }
    return parts.filter((part) => {
        if (!part) return false;
        if (part.type === 'text') return typeof part.value === 'string' && part.value.length > 0;
        if (part.type === 'var') return typeof part.name === 'string' && part.name.trim().length > 0;
        return false;
    });
}

function getCachedTemplateParts(templateKey, templateText) {
    const cacheKey = `${templateKey}::${templateText}`;
    if (TEMPLATE_PARTS_CACHE.has(cacheKey)) {
        return TEMPLATE_PARTS_CACHE.get(cacheKey);
    }
    const parts = parseTemplateParts(templateText);
    TEMPLATE_PARTS_CACHE.set(cacheKey, parts);
    if (TEMPLATE_PARTS_CACHE.size > 64) {
        const firstKey = TEMPLATE_PARTS_CACHE.keys().next().value;
        TEMPLATE_PARTS_CACHE.delete(firstKey);
    }
    return parts;
}

function formatIsoDateLabel(iso) {
    if (!iso) return '';
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return '';
    const date = new Date(ms);
    const y = String(date.getFullYear());
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function renderTemplate(templateText, values = {}) {
    const text = typeof templateText === 'string' ? templateText : '';
    const map = values && typeof values === 'object' ? values : {};
    return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_whole, key) => {
        const name = String(key || '').trim();
        if (!name) return '';
        const value = map[name];
        return value == null || String(value).trim() === '' ? _whole : String(value);
    });
}

function translate(t, key, fallback, params = null) {
    if (typeof t !== 'function') return fallback;
    const translated = t(key, params);
    return translated === key ? fallback : translated;
}

function localizePluginMeta(meta, t) {
    const safe = meta && typeof meta === 'object' ? meta : {};
    const titleKey = typeof safe.titleKey === 'string' ? safe.titleKey : '';
    const descriptionKey = typeof safe.descriptionKey === 'string' ? safe.descriptionKey : '';
    const statusLabelKey = typeof safe.statusLabelKey === 'string' ? safe.statusLabelKey : '';
    return {
        ...safe,
        title: titleKey ? translate(t, titleKey, safe.title || '') : (safe.title || ''),
        description: descriptionKey ? translate(t, descriptionKey, safe.description || '') : (safe.description || ''),
        statusLabel: statusLabelKey ? translate(t, statusLabelKey, safe.statusLabel || '') : (safe.statusLabel || '')
    };
}

const BUILTIN_TEMPLATE_I18N = Object.freeze({
    builtin_comment_polish: Object.freeze({
        nameKey: 'plugins.builtin.commentPolish.name',
        descKey: 'plugins.builtin.commentPolish.desc',
        lineKey: 'plugins.builtin.commentPolish.line1',
        fallbackName: '代码注释润色',
        fallbackDesc: '轻微收敛以下代码注释 {{code}}',
        fallbackLine: '轻微收敛以下代码注释',
        vars: ['{{code}}']
    }),
    builtin_rule_ack: Object.freeze({
        nameKey: 'plugins.builtin.ruleAck.name',
        descKey: 'plugins.builtin.ruleAck.desc',
        lineKey: 'plugins.builtin.ruleAck.line1',
        fallbackName: '规则确认回复',
        fallbackDesc: '请根据【{{rule}}】，收到请回复',
        fallbackLine: '请根据【{{rule}}】，收到请回复',
        vars: []
    })
});

function localizeBuiltinPromptTemplate(item, t) {
    const safe = item && typeof item === 'object' ? item : {};
    if (safe.isBuiltin !== true) return safe;
    const spec = BUILTIN_TEMPLATE_I18N[safe.id];
    if (!spec) return safe;
    const line = translate(t, spec.lineKey, spec.fallbackLine);
    return {
        ...safe,
        name: translate(t, spec.nameKey, spec.fallbackName),
        description: translate(t, spec.descKey, spec.fallbackDesc),
        template: spec.vars && spec.vars.length ? [line, '', ...spec.vars].join('\n') : line
    };
}

import { pluginsRegistry } from '../registry.mjs';

export function createPluginsComputed() {
    return {
        pluginsCatalog() {
            return pluginsRegistry
                .map((entry) => entry && entry.meta)
                .filter(Boolean)
                .map((meta) => localizePluginMeta(meta, this.t));
        },

        pluginsActiveMeta() {
            const id = typeof this.pluginsActiveId === 'string' ? this.pluginsActiveId.trim() : '';
            const entry = pluginsRegistry.find((item) => item && item.id === id) || null;
            return entry && entry.meta ? localizePluginMeta(entry.meta, this.t) : null;
        },

        pluginsActiveAttribution() {
            const meta = this.pluginsActiveMeta;
            if (!meta || typeof meta !== 'object') return '';
            const createdBy = typeof meta.createdBy === 'string' ? meta.createdBy.trim() : '';
            const maintainers = Array.isArray(meta.maintainers)
                ? meta.maintainers.map((m) => (typeof m === 'string' ? m.trim() : '')).filter(Boolean).join(', ')
                : '';
            if (!createdBy && !maintainers) return '';
            if (typeof this.t !== 'function') {
                if (createdBy && maintainers) return `Created by ${createdBy} · Maintained by ${maintainers}`;
                if (createdBy) return `Created by ${createdBy}`;
                return `Maintained by ${maintainers}`;
            }
            if (createdBy && maintainers) return this.t('plugins.meta.attribution', { createdBy, maintainers });
            if (createdBy) return this.t('plugins.meta.createdBy', { createdBy });
            return this.t('plugins.meta.maintainedBy', { maintainers });
        },

        promptTemplatesList() {
            const list = Array.isArray(this.promptTemplatesListRaw) ? this.promptTemplatesListRaw : [];
            return list
                .map((item) => normalizePromptTemplateEntry(item))
                .map((item) => localizeBuiltinPromptTemplate(item, this.t))
                .filter((item) => item.id && item.name)
                .map((item) => {
                    const vars = parseTemplateVariables(item.template);
                    const updatedLabel = formatIsoDateLabel(item.updatedAt || item.createdAt);
                    return {
                        ...item,
                        vars,
                        varCount: vars.length,
                        updatedLabel: updatedLabel || '—'
                    };
                })
                .sort((a, b) => {
                    const aTime = Date.parse(a.updatedAt || a.createdAt || '') || 0;
                    const bTime = Date.parse(b.updatedAt || b.createdAt || '') || 0;
                    if (bTime !== aTime) return bTime - aTime;
                    return a.name.localeCompare(b.name, 'en-US');
                });
        },

        filteredPromptTemplates() {
            const keyword = typeof this.promptTemplatesKeyword === 'string'
                ? this.promptTemplatesKeyword.trim().toLowerCase()
                : '';
            const list = this.promptTemplatesList;
            if (!keyword) return list;
            return list.filter((item) => {
                return (
                    item.name.toLowerCase().includes(keyword)
                    || (item.description && item.description.toLowerCase().includes(keyword))
                    || item.vars.some((v) => v.toLowerCase().includes(keyword))
                );
            });
        },

        promptTemplateDraft() {
            const draft = this.promptTemplateDraftRaw;
            if (!draft || typeof draft !== 'object') return null;
            const id = typeof draft.id === 'string' ? draft.id : '';
            const name = typeof draft.name === 'string' ? draft.name : '';
            if (!id && !name) return null;
            return localizeBuiltinPromptTemplate(normalizePromptTemplateEntry(draft), this.t);
        },

        promptTemplateVars() {
            const draft = this.promptTemplateDraft;
            if (!draft) return [];
            return parseTemplateVariables(draft.template);
        },

        promptTemplateVarValues() {
            const values = this.promptTemplateVarValuesRaw;
            return values && typeof values === 'object' ? values : {};
        },

        renderedPrompt() {
            const draft = this.promptTemplateDraft;
            if (!draft) return '';
            return renderTemplate(draft.template, this.promptTemplateVarValues);
        },

        promptComposerVarValues() {
            const values = this.promptComposerVarValuesRaw;
            return values && typeof values === 'object' ? values : {};
        },

        promptComposerActiveTemplate() {
            const id = typeof this.promptComposerSelectedTemplateId === 'string'
                ? this.promptComposerSelectedTemplateId.trim()
                : '';
            if (!id) return null;
            const list = this.promptTemplatesList;
            return list.find((item) => item.id === id) || null;
        },

        promptComposerParts() {
            const tpl = this.promptComposerActiveTemplate;
            if (!tpl) return [];
            const key = tpl.id || tpl.name || 'template';
            return getCachedTemplateParts(key, tpl.template);
        },

        promptComposerRendered() {
            const tpl = this.promptComposerActiveTemplate;
            if (!tpl) return '';
            return renderTemplate(tpl.template, this.promptComposerVarValues);
        },

        promptComposerPickerList() {
            const keyword = typeof this.promptComposerPickerKeyword === 'string'
                ? this.promptComposerPickerKeyword.trim().toLowerCase()
                : '';
            const list = this.promptTemplatesList;
            if (!keyword) return list;
            return list.filter((item) => {
                return (
                    item.name.toLowerCase().includes(keyword)
                    || (item.description && item.description.toLowerCase().includes(keyword))
                    || item.vars.some((v) => v.toLowerCase().includes(keyword))
                );
            });
        },

        promptComposerMissingVars() {
            const tpl = this.promptComposerActiveTemplate;
            if (!tpl || !Array.isArray(tpl.vars) || tpl.vars.length === 0) return [];
            const values = this.promptComposerVarValues;
            return tpl.vars.filter((name) => {
                const raw = values && Object.prototype.hasOwnProperty.call(values, name) ? values[name] : '';
                return !String(raw || '').trim();
            });
        }
    };
}
