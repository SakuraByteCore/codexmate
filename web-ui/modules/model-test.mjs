import { api } from './api.mjs';
import { buildMarkdownPreviewHtml } from '../logic.markdown-editor.mjs';

const MAX_PROMPT_LENGTH = 8000;

export function modelTestData() {
    return {
        modelTestTarget: 'codex', modelTestCatalogs: { codex: [], pi: [] }, modelTestProvider: '', modelTestModel: '',
        modelTestPrompt: '', modelTestLoading: false, modelTestRunning: false, modelTestError: '', modelTestResult: null
    };
}

export function createModelTestMethods({ request }) {
    return {
        async loadModelTestCatalog() {
            if (this.modelTestLoading || this.modelTestRunning) return;
            this.modelTestLoading = true;
            this.modelTestError = '';
            try {
                const state = await request('model-test-catalog');
                if (state.error) throw new Error(typeof state.error === 'string' ? state.error : state.error.message);
                this.modelTestCatalogs = state.catalogs;
                this.selectModelTestProvider();
            } catch (error) { this.modelTestError = error.message; }
            finally { this.modelTestLoading = false; }
        },
        modelTestProviders() { return this.modelTestCatalogs[this.modelTestTarget]; },
        modelTestModels() { return this.modelTestProviders().find(entry => entry.name === this.modelTestProvider)?.models || []; },
        selectModelTestProvider() {
            const providers = this.modelTestProviders();
            const current = this.modelTestTarget === 'codex' ? this.currentProvider : this.piActiveProvider;
            if (!providers.some(entry => entry.name === this.modelTestProvider)) {
                this.modelTestProvider = providers.find(entry => entry.name === current)?.name || providers[0]?.name || '';
            }
            const models = this.modelTestModels();
            const currentModel = this.modelTestTarget === 'codex' ? this.currentModels?.[this.modelTestProvider] || this.currentModel : this.piActiveModel;
            if (!models.includes(this.modelTestModel)) this.modelTestModel = models.includes(currentModel) ? currentModel : models[0] || '';
        },
        setModelTestTarget(target) {
            if (this.modelTestRunning) return;
            this.modelTestTarget = target;
            this.modelTestProvider = '';
            this.modelTestModel = '';
            this.selectModelTestProvider();
            if (!this.__webUiPreferencesApplying && typeof this.persistWebUiPreferences === 'function') {
                this.persistWebUiPreferences({ navigation: { modelTestTarget: target } });
            }
        },
        modelTestDuration(result = this.modelTestResult) {
            return this.t('modelTest.seconds', { seconds: (result.durationMs / 1000).toFixed(2) });
        },
        modelTestPreview() {
            return buildMarkdownPreviewHtml(this.modelTestResult?.text, globalThis.marked, globalThis.DOMPurify);
        },
        async runModelTest() {
            if (this.modelTestRunning || this.modelTestLoading) return;
            const prompt = this.modelTestPrompt.trim();
            if (!prompt || this.modelTestPrompt.length > MAX_PROMPT_LENGTH || !this.modelTestModels().includes(this.modelTestModel)) {
                this.modelTestError = this.t('modelTest.required'); return;
            }
            this.modelTestRunning = true;
            this.modelTestError = '';
            this.modelTestResult = { target: this.modelTestTarget, provider: this.modelTestProvider, model: this.modelTestModel, prompt };
            const started = Date.now();
            try {
                const result = await request('model-test-run', {
                    target: this.modelTestTarget, provider: this.modelTestProvider, model: this.modelTestModel, prompt
                });
                this.modelTestResult = { ...this.modelTestResult, durationMs: Date.now() - started, ...result };
            } catch (error) {
                this.modelTestResult = { ...this.modelTestResult, ok: false, error: error.message, durationMs: Date.now() - started };
            } finally { this.modelTestRunning = false; }
        }
    };
}

export const modelTestMixin = {
    data: modelTestData,
    computed: { modelTestRenderedResponse() { return this.modelTestPreview(); } },
    watch: { mainTab(tab) { if (tab === 'routing') this.loadModelTestCatalog(); } },
    methods: createModelTestMethods({ request: api })
};
