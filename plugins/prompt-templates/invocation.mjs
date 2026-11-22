import { parseTemplateVariables, renderTemplate } from './computed.mjs';

export function createPromptInvocationMethods() {
    return {
        resolvePromptTemplateInvocation(options = {}) {
            const template = typeof options.template === 'string' ? options.template : '';
            const names = parseTemplateVariables(template);
            const supplied = options.values || {};
            const values = Object.fromEntries(names.map((name) => [name,
                Object.prototype.hasOwnProperty.call(supplied, name) ? String(supplied[name] ?? '') : ''
            ]));
            if (names.every((name) => values[name].trim())) {
                return Promise.resolve(renderTemplate(template, values));
            }
            this.closePromptTemplateInvocation();
            this.promptInvocationTemplate = template;
            this.promptInvocationNames = names;
            this.promptInvocationValues = values;
            this.promptInvocationReturnFocus = typeof document === 'undefined' ? null : document.activeElement;
            this.promptInvocationVisible = true;
            return new Promise((resolve) => {
                this.promptInvocationResolve = resolve;
                this.$nextTick(() => this.$refs.promptInvocationDialog?.querySelector('textarea')?.focus());
            });
        },
        finishPromptTemplateInvocation() {
            const missing = this.promptInvocationNames.find((name) => !this.promptInvocationValues[name]?.trim());
            if (missing) {
                this.promptInvocationError = this.t('ecosystem.variablesRequired');
                const index = this.promptInvocationNames.indexOf(missing);
                this.$refs.promptInvocationDialog?.querySelectorAll('textarea')[index]?.focus();
                return;
            }
            const result = renderTemplate(this.promptInvocationTemplate, this.promptInvocationValues);
            const resolve = this.promptInvocationResolve;
            this.promptInvocationResolve = null;
            this.closePromptTemplateInvocation();
            if (resolve) resolve(result);
        },
        closePromptTemplateInvocation() {
            const resolve = this.promptInvocationResolve;
            const focus = this.promptInvocationReturnFocus;
            this.promptInvocationVisible = false;
            this.promptInvocationResolve = null;
            this.promptInvocationTemplate = '';
            this.promptInvocationNames = [];
            this.promptInvocationValues = {};
            this.promptInvocationError = '';
            this.promptInvocationReturnFocus = null;
            if (resolve) resolve(null);
            if (focus && typeof this.$nextTick === 'function') this.$nextTick(() => focus.focus());
        },
        onPromptInvocationKeydown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                this.closePromptTemplateInvocation();
                return;
            }
            if (event.key !== 'Tab') return;
            const fields = [...event.currentTarget.querySelectorAll('textarea, button:not(:disabled)')];
            const first = fields[0];
            const last = fields[fields.length - 1];
            if (event.shiftKey && event.target === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && event.target === last) {
                event.preventDefault();
                first.focus();
            }
        }
    };
}
