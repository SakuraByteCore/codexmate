import assert from 'assert';
import {
    readBundledWebUiCss,
    readBundledWebUiHtml,
    readBundledWebUiScript,
    readProjectFile
} from './helpers/web-ui-source.mjs';

test('config template keeps expected config tabs in top and side navigation', () => {
    const html = readBundledWebUiHtml();
    const modalsBasic = readProjectFile('web-ui/partials/index/modals-basic.html');
    const templateAgentModals = readProjectFile('web-ui/partials/index/modal-config-template-agents.html');
    const openclawModal = readProjectFile('web-ui/partials/index/modal-openclaw-config.html');
    const sessionsPanel = readProjectFile('web-ui/partials/index/panel-sessions.html');
    const usagePanel = readProjectFile('web-ui/partials/index/panel-usage.html');
    const orchestrationPanel = readProjectFile('web-ui/partials/index/panel-orchestration.html');
    const bundledScript = readBundledWebUiScript();
    const baseTheme = readProjectFile('web-ui/styles/base-theme.css');
    const controlsForms = readProjectFile('web-ui/styles/controls-forms.css');
    const taskOrchestrationStyles = readProjectFile('web-ui/styles/task-orchestration.css');
    const layoutShell = readProjectFile('web-ui/styles/layout-shell.css');
    const bundledStyles = readBundledWebUiCss();
    const sideRail = html.match(/<aside class="side-rail"[\s\S]*?<\/aside>/)?.[0] || '';
    const sideTabModes = [...html.matchAll(/id="side-tab-config-([a-z]+)"/g)]
        .map((match) => match[1]);

    assert.deepStrictEqual(sideTabModes, ['codex', 'claude', 'openclaw', 'opencode', 'kilocode']);
    assert.match(html, /id="tab-dashboard"/);
    assert.match(html, /v-if="healthCheckResult && healthCheckResult\.report" class="doctor-action-list"/);
    assert.match(html, /v-if="healthCheckResult\.report\.issues && healthCheckResult\.report\.issues\.length"/);
    assert.match(html, /action\.type === 'navigate' && action\.target/);
    assert.match(html, /@click="action\.target \? switchMainTab\(action\.target\) : null"/);
    assert.match(html, /id="tab-config"/);
    assert.match(html, /:data-config-mode="configMode"/);
    assert.doesNotMatch(html, /id="tab-config-codex"/);
    assert.doesNotMatch(html, /id="tab-config-claude"/);
    assert.doesNotMatch(html, /id="tab-config-openclaw"/);
    assert.match(html, /activeProviderBridgeHint/);
    assert.match(html, /isProviderConfigMode/);
    assert.match(html, /provider-fast-switch-select/);
    assert.match(html, /forceCompactLayout/);
    assert.match(html, /<script src="\/res\/vue\.runtime\.global\.prod\.js"><\/script>/);
    assert.doesNotMatch(html, /<script src="\/res\/vue\.global\.prod\.js"><\/script>/);
    assert.match(html, /quickSwitchProvider\(\$event\.target\.value\)/);
    assert.match(html, /newProvider\.model = tpl\.model \|\| ''/);
    assert.match(html, /onMainTabPointerDown\('sessions', \$event\)/);
    assert.match(html, /onConfigTabPointerDown\('codex', \$event\)/);
    assert.match(html, /onMainTabClick\('sessions', \$event\)/);
    assert.match(html, /onConfigTabClick\('codex', \$event\)/);
    assert.match(html, /<span class="selector-title">\{\{\s*t\('config\.contextBudget'\)\s*\}\}<\/span>/);
    assert.match(html, /v-model="modelContextWindowInput"/);
    assert.match(html, /v-model="modelAutoCompactTokenLimitInput"/);
    assert.match(html, /@focus="editingCodexBudgetField = 'modelContextWindowInput'"/);
    assert.match(html, /@focus="editingCodexBudgetField = 'modelAutoCompactTokenLimitInput'"/);
    assert.match(html, /@blur="onModelContextWindowBlur"/);
    assert.match(html, /@blur="onModelAutoCompactTokenLimitBlur"/);
    assert.match(html, /@keydown\.enter\.prevent="onModelContextWindowBlur"/);
    assert.match(html, /@keydown\.enter\.prevent="onModelAutoCompactTokenLimitBlur"/);
    assert.doesNotMatch(html, /使用自定义数字输入框；失焦或回车后会按当前 Codex 配置规范写入模板。/);
    assert.match(
        html,
        /<button[^>]*@click="resetCodexContextBudgetDefaults"[^>]*>[\s\S]*?t\('config\.reset'\)[\s\S]*?<\/button>/
    );
    assert.match(html, /class="codex-config-grid"/);
    assert.match(html, /onSettingsTabClick\('general'\)/);
    assert.match(html, /onSettingsTabClick\('data'\)/);
    assert.match(html, /onSettingsTabKeydown\(\$event, 'general'\)/);
    assert.match(html, /onSettingsTabKeydown\(\$event, 'data'\)/);
    assert.match(html, /settingsTab === 'general'/);
    assert.match(html, /settingsTab === 'data'/);
    assert.match(html, /setConfigTemplateDiffConfirmEnabled/);
    assert.match(html, /configTemplateDiffConfirmEnabled/);
    assert.match(html, /sessionTrashCount/);
    assert.match(html, /v-if="taskOrchestrationTabEnabled"[^>]*class="top-tab top-tab-disabled"[\s\S]*id="tab-orchestration"/);
    assert.match(html, /id="tab-orchestration"[\s\S]*aria-disabled="true"[\s\S]*disabled/);
    assert.match(html, /v-if="taskOrchestrationTabEnabled" class="side-section" role="navigation" :aria-label="t\('side\.orchestration'\)"/);
    assert.match(html, /v-if="taskOrchestrationTabEnabled"[\s\S]*id="panel-orchestration"/);
    assert.match(html, /taskOrchestrationTabEnabled && mainTab === 'orchestration'/);
    assert.match(bundledScript, /taskOrchestrationTabEnabled:\s*true/);
    assert.match(bundledScript, /codexmateTaskOrchestrationTabEnabled/);
    assert.match(bundledScript, /taskOrchestration/);
    const webUiRedirectBlock = bundledScript.match(/pathname === '\/web-ui'[\s\S]*?window\.location\.replace\(url\.toString\(\)\);/)?.[0] || '';
    assert.match(webUiRedirectBlock, /url\.pathname\s*=\s*'\/'/);
    assert.doesNotMatch(webUiRedirectBlock, /url\.search\s*=/);
    assert.doesNotMatch(webUiRedirectBlock, /url\.hash\s*=/);
    assert.match(html, /id="side-tab-prompts"/);
    assert.doesNotMatch(html, /<div class="side-section-title">\{\{ t\('side\.prompts'\) \}\}<\/div>/);
    assert.doesNotMatch(html, /<div class="side-section" role="navigation" :aria-label="t\('side\.prompts'\)">/);
    assert.doesNotMatch(html, /id="side-tab-prompts-agents"/);
    assert.doesNotMatch(html, /id="side-tab-prompts-project"/);
    assert.doesNotMatch(html, /id="side-tab-prompts-presets"/);
    assert.match(html, /@click="onMainTabClick\('prompts', \$event\)"/);
    assert.match(html, /t\('side\.prompts'\)/);
    assert.match(html, /t\('side\.prompts\.meta'\)/);
    const configSectionIndex = sideRail.indexOf(':aria-label="t(\'side.config\')"');
    const workspaceSectionIndex = sideRail.indexOf(':aria-label="t(\'side.workspace\')"');
    const promptsSideTabIndex = sideRail.indexOf('id="side-tab-prompts"');
    assert.ok(configSectionIndex >= 0, 'config side section should exist');
    assert.ok(workspaceSectionIndex > configSectionIndex, 'workspace side section should follow config section');
    assert.ok(promptsSideTabIndex > workspaceSectionIndex, 'Prompts should live inside the workspace section, not config');
    assert.match(sideRail, /:aria-label="t\('side\.workspace'\)"[\s\S]*id="side-tab-sessions"[\s\S]*id="side-tab-prompts"[\s\S]*id="side-tab-usage"/);
    assert.doesNotMatch(html, /promptsSubTab === 'presets'/);
    assert.doesNotMatch(html, /switchPromptsSubTab\('presets'\)/);
    assert.match(html, /<details class="prompt-presets-panel">/);
    assert.match(html, /class="form-input prompt-presets-select"/);
    assert.match(html, /@change="applyPromptPresetSelection\(\$event\)"/);
    assert.match(html, /t\('prompts\.presets\.selectPlaceholder'\)/);
    assert.match(html, /v-model="promptPresetNameDraft"/);
    assert.match(html, /@keydown.enter.prevent="saveCurrentPromptAsPreset"/);
    assert.match(html, /@click="saveCurrentPromptAsPreset"/);
    assert.match(html, /@click="applyPromptPresetToEditor\(preset\)"/);
    assert.doesNotMatch(html, /@click="applyPromptPresetToEditor\(preset, 'codex'\)"/);
    assert.doesNotMatch(html, /@click="applyPromptPresetToEditor\(preset, 'claude-project'\)"/);
    assert.match(html, /class="form-group prompt-presets-body"/);
    assert.match(html, /class="editor-frame prompt-presets-frame"/);
    assert.match(html, /id="side-tab-orchestration"/);
    assert.match(html, /id="tab-orchestration"/);
    assert.match(html, /data-main-tab="orchestration"/);
    assert.doesNotMatch(html, /onMainTabPointerDown\('orchestration', \$event\)/);
    assert.doesNotMatch(html, /onMainTabClick\('orchestration', \$event\)/);
    assert.match(html, /aria-disabled="true"/);
    assert.match(html, /aria-selected="false"/);
    assert.match(html, /id="panel-orchestration"/);
    assert.match(html, /v-show="mainTab === 'orchestration'"/);
    assert.match(orchestrationPanel, /t\('orchestration\.hero\.kicker'\)/);
    assert.match(orchestrationPanel, /t\('orchestration\.hero\.title'\)/);
    assert.doesNotMatch(orchestrationPanel, /@click="previewTaskPlan\(\)"/);
    assert.doesNotMatch(orchestrationPanel, /@click="planAndRunTaskOrchestration\(\)"/);
    assert.doesNotMatch(orchestrationPanel, /orchestration\.actions\.generatePlan/);
    assert.match(orchestrationPanel, /@click="queueTaskOrchestrationAndStart\(\)"/);
    assert.match(orchestrationPanel, /@click="startTaskQueueRunner\(\)"/);
    assert.match(orchestrationPanel, /@click="retryTaskRunFromUi\(taskOrchestration.selectedRunId\)"/);
    assert.match(orchestrationPanel, /class="selector-section task-hero-card"/);
    assert.match(orchestrationPanel, /class="[^"]*task-layout-grid task-layout-grid-primary[^"]*"/);
    assert.match(orchestrationPanel, /class="[^"]*task-quick-card[^"]*"/);
    assert.doesNotMatch(orchestrationPanel, /class="task-panel-toolbar"/);
    assert.doesNotMatch(orchestrationPanel, /class="task-chat-status-strip"/);
    assert.doesNotMatch(orchestrationPanel, /class="task-quick-input-card task-chat-panel"[\s\S]*配置 \{\{ taskOrchestrationEngineLabel \}\}/);
    assert.doesNotMatch(orchestrationPanel, /class="task-quick-input-card task-chat-panel"[\s\S]*运行中 \{\{ taskOrchestrationQueueStats\.running \}\}/);
    assert.doesNotMatch(orchestrationPanel, /class="task-quick-input-card task-chat-panel"[\s\S]*历史 RUNS \{\{ taskOrchestration\.runs\.length \}\}/);
    assert.match(orchestrationPanel, /class="task-quick-input-card task-chat-panel"\s*>\s*<div class="task-chat-thread" role="log" :aria-label="t\('orchestration\.chat\.thread\.aria'\)"/);
    assert.match(orchestrationPanel, /class="task-agent-cockpit" :aria-label="t\('orchestration\.agent\.aria'\)"/);
    assert.match(orchestrationPanel, /t\('orchestration\.agent\.title'\)/);
    assert.match(orchestrationPanel, /class="task-agent-surface-grid"/);
    assert.match(orchestrationPanel, /class="task-chat-thread" role="log" :aria-label="t\('orchestration\.chat\.thread\.aria'\)"/);
    assert.match(orchestrationPanel, /class="task-thread-composer"/);
    assert.match(orchestrationPanel, /class="task-chat-action-buttons task-chat-primary-action"/);
    assert.doesNotMatch(orchestrationPanel, /@click="previewTaskPlanFromChat\(\)"/);
    assert.match(orchestrationPanel, /@click="planAndRunTaskOrchestrationFromChat\(\)"/);
    assert.doesNotMatch(orchestrationPanel, /t\('orchestration\.chat\.input\.discuss'\)/);
    assert.match(orchestrationPanel, /t\('orchestration\.chat\.input\.work'\)/);
    assert.match(orchestrationPanel, /t\('orchestration\.chat\.input\.workCaption'\)/);
    assert.match(orchestrationPanel, /class="[^\"]*task-thread-message-card[^\"]*task-thread-plan-card[^\"]*"/);
    assert.doesNotMatch(orchestrationPanel, /class="[^\"]*task-thread-message-card[^\"]*task-thread-workbench-card[^\"]*"/);
    assert.match(orchestrationPanel, /class="task-project-sidebar" :aria-label="t\('orchestration\.workspace\.aria'\)"/);
    assert.match(orchestrationPanel, /<div class="task-project-list" :aria-label="t\('orchestration\.workspace\.selector'\)">/);
    assert.doesNotMatch(orchestrationPanel, /class="task-project-list" role="listbox"/);
    assert.match(orchestrationPanel, /v-for="workspace in taskOrchestrationWorkspaceItems"/);
    assert.match(orchestrationPanel, /:aria-selected="workspace\.active \? 'true' : 'false'"/);
    assert.match(orchestrationPanel, /@click="selectTaskWorkspace\(workspace\.path\)"/);
    assert.match(orchestrationPanel, /@click="startNewTaskWorkspaceSession\(\)"/);
    assert.match(orchestrationPanel, /v-for="session in taskOrchestrationWorkspaceSessions\.slice\(0, 8\)"/);
    assert.match(orchestrationPanel, /@click="continueTaskWorkspaceSession\(session\)"/);
    assert.match(orchestrationPanel, /<aside class="task-quick-side-card">/);
    assert.match(orchestrationPanel, /class="[^\"]*task-side-workbench-card[^\"]*"/);
    assert.match(orchestrationPanel, /class="task-agent-trace-grid"/);
    assert.match(orchestrationPanel, /<summary>\{\{ t\('orchestration\.agent\.trace\.title'\) \}\}<\/summary>/);
    assert.match(orchestrationPanel, /class="task-thread-card-label">AI · \{\{ t\('orchestration\.plan\.title'\) \}\}/);
    assert.match(orchestrationPanel, /class="task-chat-bubble-row is-user task-thread-plan-request"/);
    assert.match(orchestrationPanel, /You · \/plan/);
    assert.match(orchestrationPanel, /\/plan \{\{ taskOrchestration\.target \}\}/);
    assert.match(orchestrationPanel, /v-for="message in taskOrchestrationConversationMessages"/);
    assert.match(orchestrationPanel, /message\.role === 'user' \? 'is-user' : 'is-assistant'/);
    assert.match(orchestrationPanel, /class="[^"]*task-chat-composer[^"]*"/);
    assert.match(orchestrationPanel, /v-model="taskOrchestration\.chatDraft"/);
    assert.match(orchestrationPanel, /@keydown\.enter\.exact\.prevent="submitTaskOrchestrationChatMessage\(\)"/);
    assert.doesNotMatch(orchestrationPanel, /@click="submitTaskOrchestrationChatMessage\(\)"/);
    assert.match(orchestrationPanel, /t\('orchestration\.chat\.input\.label'\)/);
    assert.match(orchestrationPanel, /t\('orchestration\.chat\.input\.placeholder'\)/);
    assert.match(orchestrationPanel, /t\('orchestration\.chat\.context\.workspace\.auto'\)/);
    assert.match(orchestrationPanel, /t\('orchestration\.chat\.context\.thread\.auto'\)/);
    assert.match(orchestrationPanel, /class="task-chat-context-row task-chat-context-row-primary" role="group" :aria-label="t\('orchestration\.chat\.context\.aria'\)"/);
    assert.match(orchestrationPanel, /class="task-chat-context-chip task-chat-context-chip-strong"/);
    assert.doesNotMatch(orchestrationPanel, />配置<\/button>/);
    assert.doesNotMatch(orchestrationPanel, /<strong>\{\{ taskOrchestrationWorkspacePath \|\| taskOrchestration\.workspacePath\.trim\(\)/);
    assert.doesNotMatch(orchestrationPanel, /taskOrchestration\.openAiChatStatus\.endpoint \|\| t\('common\.none'\)/);
    assert.doesNotMatch(orchestrationPanel, /taskOrchestration\.openAiChatStatus\.model \|\| t\('common\.none'\)/);
    assert.doesNotMatch(orchestrationPanel, /session\.title/);
    assert.doesNotMatch(orchestrationPanel, /session\.meta \|\| session\.id/);
    assert.match(orchestrationPanel, /class="task-chat-context-chip task-chat-context-action" @click="taskOrchestration\.settingsOpen = true">\{\{ t\('orchestration\.advanced\.open'\) \}\}<\/button>/);
    assert.match(orchestrationPanel, /@change="taskOrchestration\.selectedEngine === 'workflow' \? null : taskOrchestration\.workflowIdsText = ''"/);
    assert.doesNotMatch(orchestrationPanel, /task-thread-suggestion-card/);
    assert.doesNotMatch(orchestrationPanel, /task-thread-readiness-card/);
    assert.doesNotMatch(orchestrationPanel, /class="task-quick-template-grid"/);
    assert.doesNotMatch(orchestrationPanel, /orchestration\.templates\.reviewFix\.label/);
    assert.doesNotMatch(orchestrationPanel, /orchestration\.quick\.templates\.planOnly\.meta/);
    assert.match(orchestrationPanel, /class="task-workflow-suggestions"/);
    assert.match(orchestrationPanel, /@click="appendTaskWorkflowId\(workflow.id \|\| workflow.name\)"/);
    assert.doesNotMatch(orchestrationPanel, /class="[^"]*task-draft-overview[^"]*"/);
    assert.doesNotMatch(orchestrationPanel, /task-quick-readiness/);
    assert.match(orchestrationPanel, /class="[^"]*task-side-settings-card[^"]*task-advanced-panel[^"]*" :open="taskOrchestration\.settingsOpen" @toggle="taskOrchestration\.settingsOpen = \$event\.target\.open"/);
    assert.doesNotMatch(orchestrationPanel, /class="[^"]*task-thread-message-card[^"]*task-thread-settings-card[^"]*"/);
    assert.match(orchestrationPanel, /taskOrchestrationDraftReadiness.summary/);
    assert.match(orchestrationPanel, /taskOrchestrationDraftReadiness.title/);
    assert.doesNotMatch(orchestrationPanel, /class="task-config-strip"/);
    assert.match(orchestrationPanel, /taskOrchestrationWorkspaceQueue/);
    assert.match(orchestrationPanel, /taskOrchestrationWorkspaceRuns/);
    assert.match(orchestrationPanel, /t\('orchestration\.workbench\.queueCount', \{ count: taskOrchestrationWorkspaceQueue\.length \}\)/);
    assert.match(orchestrationPanel, /t\('orchestration\.workbench\.ready'\)/);
    assert.doesNotMatch(orchestrationPanel, />\{\{ taskOrchestrationWorkspaceQueue\.length \}\} queued</);
    assert.doesNotMatch(orchestrationPanel, />Ready</);
    assert.match(orchestrationPanel, /taskOrchestration.workspaceTab === 'queue'/);
    assert.match(orchestrationPanel, /taskOrchestration.workspaceTab === 'runs'/);
    assert.match(orchestrationPanel, /taskOrchestration.workspaceTab === 'detail'/);
    assert.match(orchestrationPanel, /taskOrchestrationWorkspaceSessions\.length/);
    assert.match(orchestrationPanel, /taskOrchestration\.plan \|\| taskOrchestration\.planIssues\.length \|\| taskOrchestration\.planWarnings\.length \|\| taskOrchestration\.lastError/);
    assert.match(orchestrationPanel, /class="selector-section task-stage-card"/);
    assert.match(orchestrationPanel, /t\('orchestration\.stage\.title'\)/);
    assert.doesNotMatch(orchestrationPanel, /class="btn-tool task-action-preview" @click="previewTaskPlan\(\)"/);
    assert.doesNotMatch(orchestrationPanel, /orchestration\.actions\.previewOnly/);
    assert.doesNotMatch(orchestrationPanel, /class="task-action-row-right task-action-row-right-prominent"/);
    assert.match(orchestrationPanel, /class="task-action-caption"/);
    assert.match(orchestrationPanel, /class="task-empty-state"/);
    assert.match(orchestrationPanel, /taskOrchestration.selectedRunError/);
    assert.match(orchestrationPanel, /taskOrchestrationSelectedRunNodes/);
    assert.match(orchestrationPanel, /taskOrchestration\.openAiChatStatus/);
    assert.match(orchestrationPanel, /t\('orchestration\.openai\.status\.title'\)/);
    assert.match(orchestrationPanel, /@click="openTaskOpenAiChatConfig\(\)"/);
    assert.match(orchestrationPanel, /node\.output && typeof node\.output === 'object'/);
    assert.match(orchestrationPanel, /formatTaskNodeOutputText\(node\)/);
    assert.match(orchestrationPanel, /node\.output\.materializedFiles/);
    assert.match(bundledScript, /openAiChatStatus:\s*null/);
    assert.match(bundledScript, /openTaskOpenAiChatConfig\(\)/);
    assert.match(bundledScript, /formatTaskNodeOutputText\(node\)/);
    assert.match(bundledScript, /openAiChatStatus\s*=\s*res && res\.openAiChatStatus/);
    assert.match(bundledScript, /'orchestration\.openai\.status\.title'/);
    assert.match(bundledScript, /'orchestration\.detail\.node\.output'/);
    assert.match(orchestrationPanel, /:data-active="mainTab === 'orchestration' \? 'true' : 'false'"/);
    assert.match(html, /:data-active="mainTab === 'orchestration' \? 'true' : 'false'"/);
    for (const styles of [taskOrchestrationStyles, bundledStyles]) {
        assert.match(styles, /\.task-layout-grid-primary\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);
        assert.match(styles, /\.task-layout-grid-secondary\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\);/);
        assert.match(styles, /#panel-orchestration\s*\{[\s\S]*--task-orchestration-main-width:\s*1360px;[\s\S]*--task-orchestration-project-width:\s*260px;[\s\S]*--task-orchestration-records-width:\s*320px;/);
        assert.match(styles, /#panel-orchestration \.task-hero-card,[\s\S]*#panel-orchestration \.task-quick-copy,[\s\S]*#panel-orchestration \.task-stage-card\s*\{[\s\S]*display:\s*none;/);
        assert.doesNotMatch(styles, /#panel-orchestration \.task-hero-card,[\s\S]*#panel-orchestration \.task-quick-side-card,[\s\S]*#panel-orchestration \.task-quick-advanced,[\s\S]*#panel-orchestration \.task-template-block,[\s\S]*display:\s*none;/);
        assert.match(styles, /#panel-orchestration \.task-layout-grid,[\s\S]*#panel-orchestration \.task-layout-grid-primary,[\s\S]*#panel-orchestration \.task-layout-grid-secondary,[\s\S]*#panel-orchestration \.task-quick-card\s*\{[\s\S]*width:\s*min\(100%, var\(--task-orchestration-main-width\)\);/);
        assert.match(styles, /#panel-orchestration \.task-quick-card\s*\{[\s\S]*display:\s*grid;[\s\S]*grid-template-columns:\s*var\(--task-orchestration-project-width\) minmax\(0, 1fr\) var\(--task-orchestration-records-width\);/);
        assert.match(styles, /#panel-orchestration \.task-project-sidebar,[\s\S]*#panel-orchestration \.task-quick-side-card\s*\{[\s\S]*position:\s*sticky;[\s\S]*max-height:\s*calc\(100vh - 112px\);/);
        assert.match(styles, /#panel-orchestration \.task-project-item\.active\s*\{[\s\S]*box-shadow:\s*inset 3px 0 0 rgba\(199, 116, 98, 0\.56\);/);
        assert.match(styles, /#panel-orchestration \.task-chat-panel\s*\{[\s\S]*border:\s*0;[\s\S]*background:\s*transparent;[\s\S]*box-shadow:\s*none;/);
        assert.match(styles, /#panel-orchestration \.task-chat-thread\s*\{[\s\S]*padding:\s*8px 8px 188px;[\s\S]*scroll-padding-bottom:\s*188px;/);
        assert.match(styles, /#panel-orchestration \.task-thread-composer\s*\{[\s\S]*position:\s*fixed;[\s\S]*bottom:\s*16px;[\s\S]*width:\s*min\(872px, calc\(100vw - 48px\)\);/);
        assert.match(styles, /#panel-orchestration \.task-thread-message-card\s*\{[\s\S]*width:\s*min\(100%, 660px\);/);
        assert.doesNotMatch(styles, /task-panel-toolbar/);
        assert.doesNotMatch(styles, /task-panel-config-action/);
        assert.doesNotMatch(styles, /task-chat-status-strip/);
        assert.doesNotMatch(styles, /task-chat-config-link/);
        assert.doesNotMatch(styles, /task-thread-suggestion-card/);
        assert.doesNotMatch(styles, /task-thread-readiness-card/);
        assert.doesNotMatch(styles, /task-thread-checklist/);
        assert.match(styles, /\.task-chat-context-action\s*\{[\s\S]*cursor:\s*pointer;/);
        assert.doesNotMatch(styles, /#panel-orchestration \.task-quick-side-card\s*\{\s*display:\s*none;\s*\}/);
        assert.match(styles, /#panel-orchestration \.task-side-workbench-card,[\s\S]*#panel-orchestration \.task-side-settings-card\s*\{[\s\S]*max-height:\s*min\(560px, calc\(100vh - 220px\)\);[\s\S]*overflow:\s*auto;/);
        assert.match(styles, /#panel-orchestration \.task-side-workbench-card \.task-node-list\s*\{[\s\S]*max-height:\s*320px;[\s\S]*overflow:\s*auto;/);
        assert.doesNotMatch(styles, /#panel-orchestration \.task-thread-workbench-card\s*\{/);
        assert.match(styles, /#panel-orchestration \.task-thread-plan-card \.task-wave-list\s*\{[\s\S]*display:\s*none;/);
        assert.match(styles, /#panel-orchestration \.task-thread-plan-card \.task-node-list\s*\{[\s\S]*display:\s*none;/);
        assert.match(styles, /@media \(max-width:\s*760px\)\s*\{[\s\S]*#panel-orchestration\s*\{[\s\S]*--task-orchestration-main-width:\s*100%;/);
        assert.match(styles, /@media \(max-width:\s*760px\)\s*\{[\s\S]*#panel-orchestration \.task-quick-card,[\s\S]*#panel-orchestration \.task-quick-side-card\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/);
        assert.match(styles, /@media \(max-width:\s*760px\)\s*\{[\s\S]*#panel-orchestration \.task-chat-thread\s*\{[\s\S]*padding-bottom:\s*208px;[\s\S]*scroll-padding-bottom:\s*208px;/);
        assert.match(styles, /@media \(max-width:\s*760px\)\s*\{[\s\S]*#panel-orchestration \.task-thread-composer\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto;[\s\S]*right:\s*10px;[\s\S]*bottom:\s*calc\(env\(safe-area-inset-bottom, 0px\) \+ 8px\);[\s\S]*left:\s*10px;/);
        assert.match(styles, /#panel-orchestration \.task-thread-composer \.task-chat-send-row\s*\{[\s\S]*grid-row:\s*1 \/ span 2;[\s\S]*align-self:\s*center;/);
        assert.doesNotMatch(styles, /\.container:has\(#panel-orchestration\[data-active="true"\]\)\s*\{[\s\S]*background:\s*#F6F8FB;/);
        assert.doesNotMatch(styles, /body:has\(#panel-orchestration\[data-active="true"\]\)\s*\{[\s\S]*background:\s*#F6F8FB;/);
        assert.doesNotMatch(styles, /body:has\(#panel-orchestration\[data-active="true"\]\)::before\s*\{[\s\S]*background:\s*none;/);
        assert.match(styles, /\.task-hero-card,[\s\S]*\.task-empty-state\s*\{[\s\S]*border:\s*1px solid/);
        assert.match(styles, /\.task-hero-card\s*\{[\s\S]*background:\s*linear-gradient\(180deg, rgba\(199, 116, 98, 0\.10\) 0%, rgba\(199, 116, 98, 0\.03\) 100%\), var\(--color-surface\);/);
        assert.match(styles, /\.task-quick-input-card\s*\{[\s\S]*background:\s*#F8FAFC;/);
        assert.match(styles, /\.task-template-chip-group,[\s\S]*\.task-workflow-suggestions\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*wrap;/);
        assert.match(styles, /\.task-checklist-inline\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
        assert.match(styles, /\.task-chat-thread\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;[\s\S]*overflow-y:\s*auto;[\s\S]*scrollbar-width:\s*thin;/);
        assert.match(styles, /\.task-chat-thread:hover,[\s\S]*\.task-chat-thread:focus-within\s*\{[\s\S]*scrollbar-color:\s*rgba\(100, 116, 139, 0\.28\) transparent;/);
        assert.match(styles, /\.task-chat-thread::-webkit-scrollbar-thumb\s*\{[\s\S]*background:\s*transparent;/);
        assert.match(styles, /\.task-chat-bubble-row\.is-user\s*\{[\s\S]*justify-content:\s*flex-end;/);
        assert.match(styles, /\.task-chat-bubble-row\.is-assistant\s*\{[\s\S]*justify-content:\s*flex-start;/);
        assert.match(styles, /\.task-chat-context-row\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*wrap;/);
        assert.match(styles, /\.task-chat-context-chip\s*\{[\s\S]*border-radius:\s*999px;[\s\S]*text-overflow:\s*ellipsis;/);
        assert.match(styles, /\.task-stage-empty\s*\{[\s\S]*display:\s*flex;/);
        assert.match(styles, /\.task-workbench-tabs\s*\{[\s\S]*display:\s*flex;/);
        assert.match(styles, /\.task-action-row-right\s*\{[\s\S]*display:\s*flex;[\s\S]*flex-wrap:\s*wrap;/);
        assert.match(styles, /\.task-runtime-item-actions\s*\{[\s\S]*flex-direction:\s*row;[\s\S]*align-items:\s*center;/);
        assert.match(styles, /\.task-provider-status-card\s*\{[\s\S]*background:\s*#FFFFFF;/);
        assert.match(styles, /\.task-provider-status-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/);
        assert.match(styles, /\.task-node-output-card\s*\{[\s\S]*background:\s*#F8FAFC;/);
        assert.match(styles, /\.task-output-block\s*\{[\s\S]*max-height:\s*260px;/);
    }
    for (const styles of [bundledStyles]) {
        assert.match(styles, /\.health-failed-provider-main input\s*\{[\s\S]*flex:\s*0 0 auto;[\s\S]*width:\s*13px;[\s\S]*height:\s*13px;[\s\S]*accent-color:\s*var\(--color-brand-dark\);/);
        assert.match(styles, /\.health-failed-provider-main > span\s*\{[\s\S]*min-width:\s*0;/);
    }
    const sideGhostTab = sideRail.match(/<div id="side-tab-new"[\s\S]*?<\/div>\s*<\/div>/)?.[0] || '';
    assert.match(sideGhostTab, /class="side-item side-item-ghost"/);
    assert.match(sideGhostTab, /tabindex="-1"/);
    assert.match(sideGhostTab, /aria-hidden="true"/);
    assert.doesNotMatch(sideGhostTab, /data-main-tab=/);
    assert.doesNotMatch(sideGhostTab, /@click=/);
    assert.doesNotMatch(sideGhostTab, /@keydown/);
    assert.ok(html.indexOf('id="side-tab-trash"') < html.indexOf('id="side-tab-new"'), 'ghost side tab should remain after trash tab to reserve end scroll space');
    assert.match(html, /<div class="brand-kicker">Codex Mate<\/div>/);
    assert.match(html, /v-if="isAppVersionStatusVisible\(\)"[\s\S]*side-update-notice--'[\s\S]*appVersionStatusKind\(\)[\s\S]*@click="handleAppVersionStatusClick"/);
    assert.match(html, /<span class="side-update-title">\{\{\s*appUpdateNoticeText\(\)\s*\}\}<\/span>/);
    assert.match(html, /<span class="side-update-meta">\{\{\s*appUpdateNoticeMeta\(\)\s*\}\}<\/span>/);
    assert.doesNotMatch(html, /class="brand-block" tabindex="0"/);
    assert.doesNotMatch(html, /appVersion && brandHovered/);
    assert.doesNotMatch(html, /brandHovered = true/);
    for (const styles of [layoutShell, bundledStyles]) {
        assert.match(styles, /\.side-item-ghost\s*\{[\s\S]*opacity:\s*0;[\s\S]*pointer-events:\s*none;[\s\S]*user-select:\s*none;/);
        assert.match(styles, /\.brand-kicker\s*\{[\s\S]*font-size:\s*15px;/);
        assert.match(styles, /\.brand-version\s*\{[\s\S]*font-size:\s*13px;/);
        assert.match(styles, /\.side-update-notice\s*\{[\s\S]*margin-top:\s*12px;[\s\S]*background:\s*rgba\(255, 255, 255, 0\.52\);/);
        assert.match(styles, /\.side-update-meta\s*\{[\s\S]*text-overflow:\s*ellipsis;/);
    }
    assert.match(html, /id="side-tab-market"/);
    assert.match(html, /id="tab-market"/);
    assert.match(html, /id="side-tab-docs"/);
    assert.match(html, /id="tab-docs"/);
    assert.match(html, /id="side-tab-usage"/);
    assert.match(html, /id="tab-usage"/);
    assert.match(html, /data-main-tab="usage"/);
    assert.match(html, /onMainTabPointerDown\('usage', \$event\)/);
    assert.match(html, /onMainTabClick\('usage', \$event\)/);
    assert.match(html, /aria-controls="panel-usage"/);
    assert.match(html, /:aria-selected="mainTab === 'usage'"/);
    assert.match(html, /id="panel-usage"/);
    assert.match(html, /v-show="mainTab === 'usage'"/);
    assert.match(usagePanel, /sessionsUsageLoading && !sessionsUsageList\.length" class="usage-empty-state">/);
    assert.match(usagePanel, /class="usage-empty-text">\{\{\s*t\('usage\.loading'\)\s*\}\}<\/p>/);
    assert.match(usagePanel, /sessionsUsageError && !sessionsUsageList\.length" class="usage-empty-state">/);
    assert.match(usagePanel, /v-else-if="!sessionsUsageList\.length" class="usage-empty-state">/);
    assert.match(usagePanel, /class="usage-empty-text">\{\{\s*t\('usage\.empty'\)\s*\}\}<\/p>/);
    assert.match(usagePanel, /sessionUsageCharts\.topPaths/);
    assert.match(usagePanel, /sessionUsageHourlyHeatmap/);
    assert.match(html, /data-main-tab="market"/);
    assert.match(html, /onMainTabPointerDown\('market', \$event\)/);
    assert.match(html, /onMainTabClick\('market', \$event\)/);
    assert.match(html, /aria-controls="panel-market"/);
    assert.match(html, /:aria-selected="mainTab === 'market'"/);
    assert.match(html, /id="panel-market"/);
    assert.match(html, /v-show="mainTab === 'market'"/);
    assert.match(html, /data-main-tab="docs"/);
    assert.match(html, /onMainTabPointerDown\('docs', \$event\)/);
    assert.match(html, /onMainTabClick\('docs', \$event\)/);
    assert.match(html, /aria-controls="panel-docs"/);
    assert.match(html, /:aria-selected="mainTab === 'docs'"/);
    assert.match(html, /id="panel-docs"/);
    assert.match(html, /v-show="mainTab === 'docs'"/);
    assert.match(html, /\{\{\s*t\('docs\.title'\)\s*\}\}/);
    assert.match(html, /installTargetCards/);
    assert.match(html, /installTroubleshootingTips/);
    assert.doesNotMatch(html, /<span class="selector-title">Skills<\/span>/);
    assert.doesNotMatch(html, /openSkillsManager\(\{ targetApp: 'codex' \}\)/);
    assert.match(html, /class="skills-flow-panel"/);
    assert.match(html, /skillsTargetApp === 'codex'/);
    assert.match(html, /skillsTargetApp === 'claude'/);
    assert.match(html, /setSkillsTargetApp\('codex', \{ silent: false \}\)/);
    assert.match(html, /setSkillsTargetApp\('claude', \{ silent: false \}\)/);
    const targetSwitchButtons = [...html.matchAll(
        /<button[\s\S]*?:class="\['skills-target-chip', \{ active: skillsTargetApp === '(codex|claude)' \}\]"[\s\S]*?@click="setSkillsTargetApp\('\1', \{ silent: false \}\)"[\s\S]*?>/g
    )];
    assert.strictEqual(targetSwitchButtons.length, 2);
    for (const [buttonMarkup] of targetSwitchButtons) {
        assert.match(buttonMarkup, /:disabled="loading \|\| !!initError \|\| skillsMarketBusy"/);
    }
    assert.match(html, /<button type="button" class="btn-icon" @click="openSkillsMenu"/);
    assert.match(html, /<button type="button" class="btn-mini" @click="refreshSkillsList\(\{ silent: false \}\)"/);
    assert.match(html, /class="skills-target-switch" role="group" :aria-label="t\('market\.target\.aria'\)"/);
    assert.match(html, /class="side-section" role="navigation" :aria-label="t\('side\.config'\)"/);
    assert.match(html, /class="side-section" role="navigation" :aria-label="t\('side\.workspace'\)"/);
    assert.match(html, /class="side-section" role="navigation" :aria-label="t\('side\.orchestration'\)"/);
    assert.match(html, /class="side-section" role="navigation" :aria-label="t\('side\.skills'\)"/);
    assert.match(html, /class="side-section" role="navigation" :aria-label="t\('side\.docs'\)"/);
    assert.match(html, /class="side-section" role="navigation" :aria-label="t\('side\.system'\)"/);
    assert.match(html, /class="segmented-control"[\s\S]*@click="switchConfigMode\('codex'\)"/);
    assert.match(html, /class="segmented-control"[\s\S]*@click="switchConfigMode\('claude'\)"/);
    assert.match(html, /class="segmented-control"[\s\S]*@click="switchConfigMode\('openclaw'\)"/);
    assert.match(html, /class="segmented-control"[\s\S]*@click="switchConfigMode\('opencode'\)"/);
    assert.doesNotMatch(sideRail, /role="tablist"/);
    assert.doesNotMatch(sideRail, /role="tab"/);
    assert.match(sideRail, /id="side-tab-config-codex"[\s\S]*:aria-current="mainTab === 'config' && configMode === 'codex' \? 'page' : null"/);
    assert.match(sideRail, /id="side-tab-config-opencode"[\s\S]*:aria-current="mainTab === 'config' && configMode === 'opencode' \? 'page' : null"/);
    for (const mode of ['codex', 'claude', 'openclaw', 'opencode', 'kilocode']) {
        assert.match(sideRail, new RegExp(`id=\"side-tab-config-${mode}\"[\\s\\S]*?side\\.config\\.${mode}\\.meta`));
    }
    assert.doesNotMatch(sideRail, /currentProvider|currentClaudeConfig|currentOpenclawConfig|opencodeModel|kilocodeModel/);
    for (const mode of ['codex', 'claude', 'openclaw', 'opencode', 'kilocode']) {
        assert.match(sideRail, new RegExp(`id=\"side-tab-config-${mode}\"[\\s\\S]*?:class=\"\\['side-item', 'side-item-compact'`));
    }
    assert.match(layoutShell, /\.side-item-compact\s*\{[\s\S]*padding-top:\s*7px;[\s\S]*padding-bottom:\s*7px;[\s\S]*gap:\s*2px;/);
    assert.match(sideRail, /id="side-tab-docs"[\s\S]*:aria-current="mainTab === 'docs' \? 'page' : null"/);
    assert.match(sideRail, /id="side-tab-settings"[\s\S]*:aria-current="mainTab === 'settings' \? 'page' : null"/);
    assert.match(html, /skillsDefaultRootPath/);
    assert.doesNotMatch(html, /在线生态目录/);
    assert.doesNotMatch(html, /查看在线目录/);
    assert.doesNotMatch(html, /skillsMarketRemoteCount/);
    assert.doesNotMatch(html, /loadOnlineSkillsMarket\(\{ forceRefresh: true, silent: false \}\)/);
    assert.doesNotMatch(html, /resetOnlineSkillsMarketSearch/);
    assert.doesNotMatch(html, /class="market-online-list"/);
    assert.doesNotMatch(html, /class="market-ecosystem-grid"/);
    assert.match(html, /id="settings-tab-general"/);
    assert.match(html, /id="settings-tab-data"/);
    assert.match(html, /role="tab"/);
    assert.match(html, /aria-controls="settings-panel-general"/);
    assert.match(html, /aria-controls="settings-panel-data"/);
    assert.match(html, /:aria-selected="settingsTab === 'general'"/);
    assert.match(html, /:aria-selected="settingsTab === 'data'"/);
    assert.match(html, /id="settings-tab-general"[\s\S]*:tabindex="settingsTab === 'general' \? 0 : -1"/);
    assert.match(html, /id="settings-tab-data"[\s\S]*:tabindex="settingsTab === 'data' \? 0 : -1"/);
    assert.match(html, /id="settings-panel-general"/);
    assert.match(html, /id="settings-panel-data"/);
    assert.match(html, /<div[\s\S]*v-show="settingsTab === 'general'"[\s\S]*id="settings-panel-general"[\s\S]*aria-labelledby="settings-tab-general">/);
    assert.match(html, /<div[\s\S]*v-show="settingsTab === 'data'"[\s\S]*id="settings-panel-data"[\s\S]*aria-labelledby="settings-tab-data">/);
    assert.match(html, /id="settings-panel-general"[\s\S]*?<div class="settings-card-title">[\s\S]*?\{\{\s*t\('settings\.sharePrefix\.title'\)\s*\}\}[\s\S]*?<\/div>/);
    assert.match(html, /id="settings-share-prefix"[\s\S]*class="model-select"[\s\S]*:value="shareCommandPrefix"[\s\S]*@change="setShareCommandPrefix\(\$event\.target\.value\)"/);
    assert.match(html, /<option value="npm start">npm start<\/option>/);
    assert.match(html, /<option value="codexmate">codexmate<\/option>/);
    assert.match(html, /id="settings-panel-data"[\s\S]*?<div class="settings-card-title">[\s\S]*?\{\{\s*t\('settings\.reset\.title'\)\s*\}\}[\s\S]*?<\/div>/);
    assert.match(html, /id="settings-panel-data"[\s\S]*?@click="resetConfig"/);
    assert.doesNotMatch(
        html.match(/id="panel-config-provider"[\s\S]*?<\/template>/)?.[0] || '',
        /<span class="selector-title">配置重置<\/span>/
    );
    assert.match(html, /<div class="settings-card-title">[\s\S]*?\{\{\s*t\('settings.trashConfig.title'\)\s*\}\}[\s\S]*?<\/div>/);
    assert.match(html, /<input type="checkbox" :checked="sessionTrashEnabled" @change="setSessionTrashEnabled\(\$event\.target\.checked\)">/);
    assert.match(html, /\{\{\s*t\('settings.trash.retentionHint'\)\s*\}\}/);
    assert.doesNotMatch(html, /<span class="selector-title">会话回收站<\/span>/);
    assert.match(html, /role="tabpanel"/);
    assert.doesNotMatch(html, /v-if="settingsTab === 'general'"/);
    assert.match(html, /class="trash-item-cwd"/);
    assert.match(html, /v-for="item in visibleSessionTrashItems"/);
    assert.match(html, /class="session-source"/);
    assert.match(html, /@click="loadMoreSessionTrashItems"/);
    assert.match(html, /\{\{\s*t\('settings\.trash\.retry'\)\s*\}\}/);
    assert.match(html, /data-main-tab=\"sessions\"/);
    assert.match(html, /data-main-tab=\"market\"/);
    assert.match(html, /data-config-mode=\"codex\"/);
    assert.match(html, /data-config-mode=\"opencode\"/);
    assert.match(html, /isMainTabNavActive\('settings'\)/);
    assert.match(html, /isMainTabNavActive\('market'\)/);
    assert.match(html, /isConfigModeNavActive\('codex'\)/);
    assert.match(html, /:aria-pressed="isSessionPinned\(session\)"/);
    assert.match(
        sessionsPanel,
        /:class="\[[\s\S]*'session-item'[\s\S]*@click="selectSession\(session\)"[\s\S]*@keydown\.enter\.self\.prevent="selectSession\(session\)"[\s\S]*@keydown\.space\.self\.prevent="selectSession\(session\)"[\s\S]*tabindex="0"[\s\S]*role="button"[\s\S]*:aria-current="activeSessionExportKey === getSessionExportKey\(session\) \? 'true' : null"/
    );
    assert.doesNotMatch(sessionsPanel, /!sessionStandalone/);
    assert.doesNotMatch(sessionsPanel, /<span v-if="sessionStandaloneError">{{ sessionStandaloneError }}<\/span>/);
    assert.match(
        sessionsPanel,
        /<div v-else class="session-preview-empty">[\s\S]*?<span>\{\{\s*t\('sessions\.selectHint'\)\s*\}\}<\/span>[\s\S]*?<\/div>/
    );
    assert.match(
        html,
        /:class="\['card', \{ active: displayCurrentProvider === provider\.name, disabled: provider\.name === 'local' && isLocalProviderDisabled \}\]"[\s\S]*@click="\(provider\.name === 'local' && isLocalProviderDisabled\) \? null : switchProvider\(provider\.name\)"[\s\S]*@keydown\.enter\.self\.prevent="\([^)]+\) \? null : switchProvider\(provider\.name\)"[\s\S]*:tabindex="provider\.name === 'local' && isLocalProviderDisabled \? -1 : 0"[\s\S]*role="button"[\s\S]*:aria-current="displayCurrentProvider === provider\.name \? 'true' : null"/
    );
    assert.match(
        html,
        /<span v-if="speedResults\[provider\.name\]"[\s\S]*class="\['latency', speedResults\[provider\.name\]\.ok \? 'ok' : 'error'\]"[\s\S]*>\s*\{\{\s*formatLatency\(speedResults\[provider\.name\]\)\s*\}\}\s*<\/span>[\s\S]*<span :class="\['pill', providerPillConfigured\(provider\) \? 'configured' : 'empty'\]">/
    );
    assert.match(
        html,
        /:class="\['card', \{ active: currentClaudeConfig === name \}\]"[\s\S]*@click="applyClaudeConfig\(name\)"[\s\S]*@keydown\.enter\.self\.prevent="applyClaudeConfig\(name\)"[\s\S]*@keydown\.space\.self\.prevent="applyClaudeConfig\(name\)"[\s\S]*tabindex="0"[\s\S]*role="button"[\s\S]*:aria-current="currentClaudeConfig === name \? 'true' : null"/
    );
    assert.match(
        html,
        /<div class="card-icon">\{\{\s*name\.charAt\(0\)\.toUpperCase\(\)\s*\}\}<span v-if="config\.targetApi === 'chat_completions' \|\| config\.targetApi === 'ollama'" class="card-icon-dot" :title="t\('config\.transformProvider\.title'\)"><\/span><\/div>/
    );
    assert.match(
        html,
        /<option value="ollama">\{\{\s*t\('claude\.targetApi\.ollama'\)\s*\}\}<\/option>/
    );
    assert.match(
        html,
        /type="checkbox"\s+autocomplete="off"\s+:checked="isToolConfigWriteAllowed\('codex'\)"[\s\S]*@change="setToolConfigPermission\('codex', \$event\.target\.checked\)"/
    );
    assert.match(
        html,
        /type="checkbox"\s+autocomplete="off"\s+:checked="isToolConfigWriteAllowed\('claude'\)"[\s\S]*@change="setToolConfigPermission\('claude', \$event\.target\.checked\)"/
    );
    assert.match(
        html,
        /id="panel-config-opencode"[\s\S]*:checked="isToolConfigWriteAllowed\('opencode'\)"[\s\S]*@change="setToolConfigPermission\('opencode', \$event\.target\.checked\)"/
    );
    assert.match(html, /id="opencode-provider"[\s\S]*v-model="opencodeProvider"/);
    assert.match(html, /id="opencode-model"[\s\S]*v-model="opencodeModel"/);
    assert.match(html, /@change="handleOpencodeImportChange"/);
    assert.match(html, /@click="saveOpencodeConfig"/);
    assert.match(html, /@click="applyOpencodeSelection"/);
    assert.match(
        html,
        /<span v-if="claudeSpeedResults\[name\]"[\s\S]*class="\['latency', claudeSpeedResults\[name\]\.ok \? 'ok' : 'error'\]"[\s\S]*>\s*\{\{\s*formatLatency\(claudeSpeedResults\[name\]\)\s*\}\}\s*<\/span>[\s\S]*<span :class="\['pill', config\.hasKey \? 'configured' : 'empty'\]">/
    );
    assert.match(
        html,
        /:class="\['card', \{ active: currentOpenclawConfig === name \}\]"[\s\S]*@click="applyOpenclawConfig\(name\)"[\s\S]*@keydown\.enter\.self\.prevent="applyOpenclawConfig\(name\)"[\s\S]*@keydown\.space\.self\.prevent="applyOpenclawConfig\(name\)"[\s\S]*tabindex="0"[\s\S]*role="button"[\s\S]*:aria-current="currentOpenclawConfig === name \? 'true' : null"/
    );
    assert.match(html, /class="session-item-copy session-item-pin"/);
    assert.doesNotMatch(sessionsPanel, /sessionsViewMode/);
    assert.doesNotMatch(sessionsPanel, /sessionUsageSummaryCards/);
    assert.match(usagePanel, /sessionsUsageTimeRange === '7d'/);
    assert.match(usagePanel, /sessionsUsageTimeRange === '30d'/);
    assert.match(usagePanel, /sessionsUsageTimeRange === 'all'/);
    assert.match(usagePanel, />\{\{\s*t\('usage\.range\.all'\)\s*\}\}<\/button>/);
    assert.match(usagePanel, /sessionsUsageList\.length/);
    assert.match(usagePanel, /loadSessionsUsage\(\{ forceRefresh: true, range: sessionsUsageTimeRange \}\)/);
    assert.match(usagePanel, /sessionUsageWave\.points/);
    assert.match(usagePanel, /usage-hero/);
    assert.match(usagePanel, /usage-hero-main/);
    assert.match(usagePanel, /sessionUsageCharts\.topPaths/);
    assert.match(usagePanel, /sessionUsageCharts\.topSessionsByMessages/);
    assert.match(usagePanel, /usage\.sessions\.topDensity/);
    assert.match(usagePanel, /usage-card-title/);
    assert.match(usagePanel, /usage-wave-chart/);
    assert.match(usagePanel, /sessionUsageHourlyHeatmap\.rows/);
    assert.doesNotMatch(usagePanel, /sessionUsageCharts\.topPaths\[0\]\?\.count/);
    assert.doesNotMatch(html, /sessionUsageSummaryCards\[0\]\?\.value/);
    assert.doesNotMatch(html, /sessionUsageSummaryCards\[1\]\?\.value/);
    assert.match(html, /class="pin-icon"/);
    assert.match(html, /:aria-selected="mainTab === 'sessions'"/);
    assert.match(html, /:aria-selected="mainTab === 'usage'"/);
    assert.match(html, /:aria-selected="mainTab === 'config'"/);
    assert.match(html, /v-for="session in visibleSessionsList"/);
    assert.match(html, /<div[\s\S]*v-if="sessionListRenderEnabled"[\s\S]*class="session-list"/);
    assert.match(html, /:ref="setSessionListRef"/);
    assert.match(html, /@scroll\.passive="onSessionListScroll"/);
    assert.match(html, /class="selector-section session-selector-section"/);
    assert.match(html, /class="session-source-tabs-row"[\s\S]*class="session-toolbar"/);
    assert.match(html, /class="session-source-tabs-row"[\s\S]*class="session-source-pills"/);
    assert.match(html, /class="session-source-pills" role="group" :aria-label="t\('sessions\.sourceTitle'\)"/);
    assert.doesNotMatch(sessionsPanel, /aria-label="Session source"/);
    assert.doesNotMatch(sessionsPanel, /role="radio"/);
    assert.doesNotMatch(html, /class="session-toolbar-group session-toolbar-primary"[\s\S]*class="session-source-pills"[\s\S]*class="session-path-select"/);
    assert.match(html, /v-memo="\[activeSessionExportKey === getSessionExportKey\(session\)/);
    assert.match(html, /v-for="\(msg, idx\) in activeSessionVisibleMessages"/);
    assert.match(html, /canLoadMoreSessionMessages/);
    assert.match(html, /v-memo="\[msg\.text,\s*msg\.timestamp,\s*msg\.roleLabel,\s*msg\.normalizedRole\]"/);
    assert.match(html, /v-memo="\[sessionTimelineActiveKey === node\.key,\s*node\.safePercent,\s*node\.title\]"/);
    const providerShareButton = html.match(
        /<button[\s\S]*?@click="copyProviderShareCommand\(provider\)"[\s\S]*?:aria-label="t\('config\.shareCommand\.aria'\)">/
    );
    assert(providerShareButton, 'provider share button should exist');
    assert.match(providerShareButton[0], /:class="\{ loading: providerShareLoading\[provider\.name\], disabled: !shouldAllowProviderShare\(provider\) \}"/);
    assert.match(providerShareButton[0], /:disabled="providerShareLoading\[provider\.name\] \|\| !shouldAllowProviderShare\(provider\)"/);
    assert.match(providerShareButton[0], /:title="shouldAllowProviderShare\(provider\) \? t\('config\.shareCommand'\) : t\('config\.shareDisabled'\)"/);
    assert.doesNotMatch(html, /<span class="selector-title">local 本地端口<\/span>/);
    assert.match(html, /<button class="btn-icon" @click="showModelModal = true" :aria-label="t\('modal\.modelAdd\.title'\)" :title="t\('modal\.modelAdd\.title'\)" v-if="modelsSource === 'legacy'">\+<\/button>/);
    assert.match(html, /<button class="btn-icon" @click="showModelListModal = true" :aria-label="t\('modal\.modelManage\.title'\)" :title="t\('modal\.modelManage\.title'\)" v-if="modelsSource === 'legacy'">≡<\/button>/);
    assert.match(
        html,
        /<button class="btn-tool" @click="runHealthCheck" :disabled="healthCheckLoading \|\| loading \|\| !!initError">/
    );
    assert.match(
        html,
        /<button[\s\S]*class="card-action-btn"[\s\S]*@click="runSpeedTest\(provider\.name, \{ silent: true \}\)"[\s\S]*:aria-label="t\('config\.availabilityTestAria', \{ name: provider\.name \}\)"[\s\S]*:title="t\('config\.availabilityTest'\)"/
    );
    assert.match(html, /<button[\s\S]*?@click="openEditModal\(provider\)"[\s\S]*?:aria-label="t\('config\.provider\.edit\.aria', \{ name: provider\.name \}\)"[\s\S]*?:title="shouldShowProviderEdit\(provider\) \? t\('common\.edit'\) : t\('common\.notEditable'\)">/);
    assert.match(html, /<button[\s\S]*?@click="deleteProvider\(provider\.name\)"[\s\S]*?:aria-label="t\('config\.provider\.delete\.aria', \{ name: provider\.name \}\)"[\s\S]*?:title="shouldShowProviderDelete\(provider\) \? t\('common\.delete'\) : t\('common\.notDeletable'\)">/);
    assert.match(html, /<button class="card-action-btn"[^>]*@click="openEditConfigModal\(name\)"[^>]*:aria-label="t\('claude\.action\.editAria', \{ name \}\)"[^>]*:title="t\('claude\.action\.edit'\)">/);
    assert.match(html, /<button class="card-action-btn delete"[^>]*@click="deleteClaudeConfig\(name\)"[^>]*:aria-label="t\('claude\.action\.deleteAria', \{ name \}\)"[^>]*:title="t\('claude\.action\.delete'\)">/);
    assert.match(html, /<button class="card-action-btn"[^>]*@click="copyClaudeShareCommand\(name\)"[^>]*>/);
    assert.match(html, /<button class="card-action-btn"[^>]*@click="openOpenclawEditModal\(name\)"[^>]*:aria-label="t\('openclaw\.action\.editAria', \{ name \}\)"[^>]*:title="t\('openclaw\.action\.edit'\)">/);
    assert.match(
        html,
        /<div class="docs-command-row">[\s\S]*<div class="docs-command-box"[\s\S]*<code class="install-command">\{\{ target\.command \}\}<\/code>[\s\S]*<button[\s\S]*class="btn-mini docs-copy-btn"/
    );
    assert.match(html, /<button v-if="!isDefaultOpenclawConfig\(name, config\)" class="card-action-btn delete"[^>]*@click="deleteOpenclawConfig\(name\)"[^>]*:aria-label="t\('openclaw\.action\.deleteAria', \{ name \}\)"[^>]*:title="t\('openclaw\.action\.delete'\)">/);
    assert.match(modalsBasic, /<div v-if="showAddModal" class="modal-overlay" @click\.self="closeAddModal">/);
    assert.match(modalsBasic, /<div v-if="showModelModal" class="modal-overlay" @click\.self="closeModelModal">/);
    assert.match(modalsBasic, /<div v-if="showClaudeConfigModal" class="modal-overlay" @click\.self="closeClaudeConfigModal">/);
    for (const modalTitleId of [
        'add-provider-modal-title',
        'edit-provider-modal-title',
        'add-model-modal-title',
        'manage-models-modal-title',
        'add-claude-config-modal-title',
        'edit-claude-config-modal-title'
    ]) {
        assert.match(modalsBasic, new RegExp(`aria-labelledby="${modalTitleId}"`));
        assert.match(modalsBasic, new RegExp(`id="${modalTitleId}"`));
    }
    assert.doesNotMatch(modalsBasic, /install-cli-modal-title/);
    assert.doesNotMatch(modalsBasic, /showInstallModal/);
    assert.match(modalsBasic, /<input[\s\S]*v-model="newProvider\.model"[\s\S]*:placeholder="t\('placeholder\.modelExample'\)"[\s\S]*@blur="normalizeProviderDraft\('add'\)">/);
    assert.match(modalsBasic, /<input v-model="newProvider\.key"[^>]*:class="\['form-input', \{ invalid: !!providerFieldError\('add', 'key'\) \}\]"[^>]*:type="showAddProviderKey \? 'text' : 'password'"[^>]*placeholder="sk-\.\.\."[^>]*autocomplete="off"[^>]*spellcheck="false"[^>]*@blur="normalizeProviderDraft\('add'\)">/);
    assert.match(modalsBasic, /<div v-if="providerFieldError\('add', 'key'\)" class="form-hint form-error">\{\{ providerFieldError\('add', 'key'\) \}\}<\/div>/);
    assert.match(modalsBasic, /<input v-model="editingProvider\.key" class="form-input" :type="showEditProviderKey \? 'text' : 'password'" placeholder="sk-\.\.\." autocomplete="off" spellcheck="false">/);
    assert.match(modalsBasic, /<input v-model="newClaudeConfig\.apiKey"[^>]*:class="\['form-input', \{ invalid: !!claudeConfigFieldError\('add', 'apiKey'\) \}\]"[^>]*:type="showAddClaudeConfigKey \? 'text' : 'password'"[^>]*autocomplete="off"[^>]*spellcheck="false"[^>]*:placeholder="t\('placeholder\.apiKeyExampleClaude'\)">/);
    assert.match(modalsBasic, /<div v-if="claudeConfigFieldError\('add', 'apiKey'\)" class="form-hint form-error">\{\{ claudeConfigFieldError\('add', 'apiKey'\) \}\}<\/div>/);
    assert.match(modalsBasic, /<input v-model="newClaudeConfig\.model"[^>]*:class="\['form-input', \{ invalid: !!claudeConfigFieldError\('add', 'model'\) \}\]"[^>]*:placeholder="t\('placeholder\.modelExample'\)"[^>]*autocomplete="off"[^>]*spellcheck="false">/);
    assert.match(modalsBasic, /<div v-if="claudeConfigFieldError\('add', 'model'\)" class="form-hint form-error">\{\{ claudeConfigFieldError\('add', 'model'\) \}\}<\/div>/);
    assert.match(modalsBasic, /<button class="btn btn-confirm" @click="addClaudeConfig" :disabled="!canSubmitClaudeConfig\('add'\)">/);
    assert.match(modalsBasic, /<input v-model="editingConfig\.apiKey"[^>]*:class="\['form-input', \{ invalid: !!claudeConfigFieldError\('edit', 'apiKey'\) \}\]"[^>]*:type="showEditClaudeConfigKey \? 'text' : 'password'"[^>]*autocomplete="off"[^>]*spellcheck="false"[^>]*:placeholder="t\('placeholder\.apiKeyExampleClaude'\)">/);
    assert.match(modalsBasic, /<div v-if="claudeConfigFieldError\('edit', 'apiKey'\)" class="form-hint form-error">\{\{ claudeConfigFieldError\('edit', 'apiKey'\) \}\}<\/div>/);
    assert.match(modalsBasic, /<input v-model="editingConfig\.model"[^>]*:class="\['form-input', \{ invalid: !!claudeConfigFieldError\('edit', 'model'\) \}\]"[^>]*:placeholder="t\('placeholder\.modelExample'\)"[^>]*autocomplete="off"[^>]*spellcheck="false">/);
    assert.match(modalsBasic, /<div v-if="claudeConfigFieldError\('edit', 'model'\)" class="form-hint form-error">\{\{ claudeConfigFieldError\('edit', 'model'\) \}\}<\/div>/);
    assert.match(modalsBasic, /<button class="btn btn-confirm" @click="saveAndApplyConfig" :disabled="!canSubmitClaudeConfig\('edit'\)">/);
    assert.strictEqual([...modalsBasic.matchAll(/\? 'text' : 'password'/g)].length, 4);
    assert.match(templateAgentModals, /<div v-if="showConfigTemplateModal" class="modal-overlay" @click\.self="!configTemplateApplying && closeConfigTemplateModal\(\)">/);
    assert.match(templateAgentModals, /<div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="config-template-modal-title">/);
    assert.match(templateAgentModals, /<div class="modal-title" id="config-template-modal-title">\{\{\s*t\('modal\.configTemplate\.title'\)\s*\}\}<\/div>/);
    assert.match(templateAgentModals, /<div v-if="showAgentsModal" class="modal-overlay" @click\.self="closeAgentsModal">/);
    assert.match(templateAgentModals, /<div class="modal modal-wide modal-editor agents-modal" role="dialog" aria-modal="true" aria-labelledby="agents-modal-title">/);
    assert.match(templateAgentModals, /<div class="modal-title" id="agents-modal-title">{{ agentsModalTitle }}<\/div>/);
    assert.match(modalsBasic, /<button type="button" class="btn-remove-model" @click="removeModel\(model\)">\{\{\s*t\('common\.delete'\)\s*\}\}<\/button>/);
    assert.doesNotMatch(modalsBasic, /<span class="btn-remove-model" @click="removeModel\(model\)">删除<\/span>/);
    assert.match(openclawModal, /<div v-if="showOpenclawConfigModal" class="modal-overlay" @click\.self="!\(openclawSaving \|\| openclawApplying\) && closeOpenclawConfigModal\(\)">/);
    assert.match(openclawModal, /<div class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="openclaw-config-modal-title">/);
    assert.match(openclawModal, /<div class="modal-title" id="openclaw-config-modal-title">{{ openclawEditorTitle }}<\/div>/);
    assert.match(openclawModal, /:readonly="openclawSaving \|\| openclawApplying"/);
    assert.match(openclawModal, /<button class="btn btn-cancel" @click="closeOpenclawConfigModal" :disabled="openclawSaving \|\| openclawApplying">取消<\/button>/);
    assert.match(openclawModal, /<button class="btn btn-confirm" @click="saveOpenclawConfig" :disabled="openclawSaving \|\| openclawApplying \|\| \(openclawEditing\.lockName && isDefaultOpenclawConfig\(openclawEditing\.name\)\)">/);
    assert.match(openclawModal, /<button class="btn btn-confirm secondary" @click="saveAndApplyOpenclawConfig" :disabled="openclawSaving \|\| openclawApplying">/);
    assert.doesNotMatch(baseTheme, /fonts\.googleapis\.com/);
    assert.match(controlsForms, /\.btn-tool-compact:disabled:hover,\s*\.btn-tool-compact\[disabled\]:hover/);
});

test('web ui script defines provider mode metadata for codex only', () => {
    const appScript = readBundledWebUiScript();
    const constantsSource = readProjectFile('web-ui/modules/app.constants.mjs');
    const configModeComputed = readProjectFile('web-ui/modules/config-mode.computed.mjs');

    assert.match(appScript, /CONFIG_MODE_SET/);
    assert.match(appScript, /getProviderConfigModeMeta/);
    assert.match(appScript, /createConfigModeComputed/);
    assert.match(appScript, /\.\.\.createConfigModeComputed\(\)/);
    assert.match(appScript, /switchConfigMode\(mode\)/);
    assert.match(appScript, /mode\.trim\(\)\.toLowerCase\(\)/);
    assert.match(appScript, /this\.switchMainTab\('config'\);/);
    assert.match(appScript, /if \(this\.mainTab === 'config'\) {/);
    assert.match(appScript, /this\.clearMainTabSwitchIntent\('config'\);/);
    assert.match(appScript, /__mainTabSwitchState:\s*\{[\s\S]*intent:\s*''[\s\S]*pendingTarget:\s*''[\s\S]*pendingConfigMode:\s*''[\s\S]*ticket:\s*0[\s\S]*\}/);
    assert.match(appScript, /setMainTabSwitchIntent\(tab\)/);
    assert.match(appScript, /ensureMainTabSwitchState\(\)/);
    assert.match(appScript, /ensureImmediateNavDomState\(\)/);
    assert.match(appScript, /applyImmediateNavIntent\(tab,\s*configMode = ''\)/);
    assert.match(appScript, /clearImmediateNavIntent\(\)/);
    assert.match(appScript, /setSessionPanelFastHidden\(hidden\)/);
    assert.match(appScript, /isSessionPanelFastHidden\(\)/);
    assert.match(appScript, /recordPointerNavCommit\(kind,\s*value\)/);
    assert.match(appScript, /consumePointerNavCommit\(kind,\s*value\)/);
    assert.match(appScript, /onMainTabPointerDown\(tab\)/);
    assert.match(appScript, /onConfigTabPointerDown\(mode\)/);
    assert.match(appScript, /onMainTabClick\(tab\)/);
    assert.match(appScript, /onConfigTabClick\(mode\)/);
    assert.match(appScript, /if \(pointerType === 'touch'\) {/);
    assert.match(appScript, /node\.classList\.toggle\('nav-intent-active'/);
    assert.match(appScript, /node\.classList\.toggle\('nav-intent-inactive'/);
    assert.match(appScript, /node\.classList\.remove\('nav-intent-active'\)/);
    assert.match(appScript, /node\.classList\.remove\('nav-intent-inactive'\)/);
    assert.match(appScript, /isMainTabNavActive\(tab\)/);
    assert.match(appScript, /isConfigModeNavActive\(mode\)/);
    assert.match(appScript, /const isLeavingSessions = previousTab === 'sessions' && targetTab !== 'sessions';/);
    assert.match(appScript, /const enteringSessionsTab = nextTab === 'sessions';/);
    assert.match(appScript, /const enteringUsageTab = nextTab === 'usage';/);
    assert.match(appScript, /this\.loadSessionsUsage\(\);/);
    assert.match(appScript, /if \(targetTab === previousTab\) {/);
    assert.match(appScript, /const shouldPreserveSessionRender = isLeavingSessions && this\.preserveSessionRenderOnTabLeave === true;/);
    assert.match(appScript, /const shouldDeferApply = isLeavingSessions && !shouldPreserveSessionRender;/);
    assert.match(appScript, /if \(isLeavingSessions && !this\.isSessionPanelFastHidden\(\)\) {/);
    assert.match(appScript, /switchState\.pendingTarget = targetTab;/);
    assert.match(appScript, /if \(ticket !== liveState\.ticket\) return;/);
    assert.match(appScript, /activeSessionExportKey\(\)/);
    assert.match(appScript, /if \(this\.mainTab !== 'sessions' \|\| !this\.sessionPreviewRenderEnabled\) {/);
    assert.match(appScript, /const scrollRect = scrollEl && typeof scrollEl\.getBoundingClientRect === 'function'/);
    assert.match(appScript, /top = scrollTop \+ \(messageRect\.top - scrollRect\.top\);/);
    assert.match(appScript, /if \(!current \|\| current\.ticket !== this\.sessionTabRenderTicket\) {/);
    assert.match(appScript, /bindSessionMessageRef\(messageKey,\s*el,\s*ticket = this\.sessionTabRenderTicket\)/);
    assert.match(appScript, /this\.getMainTabForNav\(\) !== 'sessions'/);
    assert.match(appScript, /scheduleIdleTask\(task,\s*timeoutMs = 160\)/);
    assert.match(appScript, /scheduleSessionTabDeferredTeardown\(task\)/);
    assert.match(appScript, /cancelScheduledSessionTabDeferredTeardown\(\)/);
    assert.match(appScript, /suspendSessionTabRender\(\)/);
    assert.match(appScript, /finalizeSessionTabTeardown\(\)/);
    assert.match(appScript, /ensureSessionTimelineMeasurementCache\(\)/);
    assert.match(appScript, /invalidateSessionTimelineMeasurementCache\(resetOffset = false\)/);
    assert.match(appScript, /getCachedSessionTimelineMeasuredNodes\(nodes\)/);
    assert.match(appScript, /quickSwitchProvider\(name\)/);
    assert.match(appScript, /performProviderSwitch\(name\)/);
    assert.match(appScript, /waitForCodexApplyIdle\(maxWaitMs = 20000\)/);
    assert.match(appScript, /target === this\.pendingProviderSwitch/);
    assert.match(appScript, /!this\.providerSwitchInProgress && target === this\.currentProvider/);
    assert.match(appScript, /await this\.waitForCodexApplyIdle\(\);/);
    assert.match(appScript, /runLatestOnlyQueue\(/);
    assert.match(appScript, /providerSwitchInProgress:\s*false/);
    assert.match(appScript, /pendingProviderSwitch:\s*''/);
    assert.match(appScript, /providerSwitchDisplayTarget:\s*''/);
    assert.match(appScript, /const switching = String\(this\.providerSwitchDisplayTarget \|\| ''\)\.trim\(\);/);
    assert.match(appScript, /if \(switching\) return switching;/);
    assert.match(appScript, /modelContextWindowInput:\s*String\(DEFAULT_MODEL_CONTEXT_WINDOW\)/);
    assert.match(appScript, /modelAutoCompactTokenLimitInput:\s*String\(DEFAULT_MODEL_AUTO_COMPACT_TOKEN_LIMIT\)/);
    assert.match(appScript, /editingCodexBudgetField:\s*''/);
    assert.match(appScript, /statusRes\.modelContextWindow/);
    assert.match(appScript, /statusRes\.modelAutoCompactTokenLimit/);
    assert.match(appScript, /onModelContextWindowBlur\(\)/);
    assert.match(appScript, /onModelAutoCompactTokenLimitBlur\(\)/);
    assert.match(appScript, /resetCodexContextBudgetDefaults\(\)/);
    assert.match(appScript, /normalizePositiveIntegerInput\(/);
    assert.match(constantsSource, /export const SESSION_TRASH_LIST_LIMIT = 500;/);
    assert.match(constantsSource, /export const SESSION_TRASH_PAGE_SIZE = 200;/);
    assert.match(appScript, /settingsTab:\s*'general'/);
    assert.match(appScript, /skillsTargetApp:\s*'codex'/);
    assert.match(appScript, /skillsMarketLoading:\s*false/);
    assert.match(appScript, /skillsMarketLocalLoadedOnce:\s*false/);
    assert.match(appScript, /skillsMarketImportLoadedOnce:\s*false/);
    assert.doesNotMatch(appScript, /skillsMarketRemoteLoading:\s*false/);
    assert.doesNotMatch(appScript, /skillsMarketRemoteLoadedOnce:\s*false/);
    assert.doesNotMatch(appScript, /skillsMarketRemoteItems:\s*\[\]/);
    assert.doesNotMatch(appScript, /skillsMarketRemoteLatestOnly:\s*true/);
    assert.doesNotMatch(appScript, /skillsMarketEcosystems:\s*\[\]/);
    assert.match(appScript, /sessionTrashItems:\s*\[\]/);
    assert.match(appScript, /sessionTrashVisibleCount:\s*SESSION_TRASH_PAGE_SIZE/);
    assert.match(appScript, /sessionTrashTotalCount:\s*0/);
    assert.match(appScript, /sessionTrashLoadedOnce:\s*false/);
    assert.match(appScript, /sessionTrashLoading:\s*false/);
    assert.match(appScript, /const totalCount = Number\(this\.sessionTrashTotalCount\);/);
    assert.match(appScript, /visibleSessionTrashItems\(\)/);
    assert.match(appScript, /sessionTrashHasMoreItems\(\)/);
    assert.match(appScript, /sessionTrashHiddenCount\(\)/);
    assert.match(appScript, /normalizeSettingsTab\(tab\)/);
    assert.match(appScript, /tab === 'general' \|\| tab === 'data'/);
    assert.match(appScript, /switchSettingsTab\(tab,\s*options = \{\}\)/);
    assert.match(appScript, /loadSessionTrash\(options = \{\}\)/);
    assert.match(appScript, /loadMoreSessionTrashItems\(\)/);
    assert.match(appScript, /restoreSessionTrash\(item\)/);
    assert.match(appScript, /purgeSessionTrash\(item\)/);
    assert.match(appScript, /clearSessionTrash\(\)/);
    assert.match(appScript, /buildSessionTrashItemFromSession\(session,\s*result = \{\}\)/);
    assert.match(appScript, /prependSessionTrashItem\(item,\s*options = \{\}\)/);
    assert.match(appScript, /resetSessionTrashVisibleCount\(\)/);
    assert.match(appScript, /normalizeSessionTrashTotalCount\(totalCount,\s*fallbackItems = this\.sessionTrashItems\)/);
    assert.match(appScript, /getSessionTrashViewState\(\)/);
    assert.match(appScript, /this\.sessionTrashTotalCount = this\.normalizeSessionTrashTotalCount\(res\.totalCount,\s*nextItems\);/);
    assert.match(appScript, /this\.sessionTrashTotalCount = this\.normalizeSessionTrashTotalCount\(\s*res && res\.totalCount !== undefined/);
    assert.match(appScript, /messageCount:\s*Number\.isFinite\(Number\(result && result\.messageCount\)\)/);
    assert.match(appScript, /clearActiveSessionState\(\)/);
    assert.match(appScript, /removeSessionFromCurrentList\(session\)/);
    assert.match(appScript, /await this\.removeSessionFromCurrentList\(session\);/);

    assert.match(configModeComputed, /const PROVIDER_CONFIG_MODE_META = Object\.freeze\(/);
    const providerModeKeys = [...configModeComputed.matchAll(/^\s*([a-z]+):\s*Object\.freeze\(/gm)]
        .map((match) => match[1]);
    assert.deepStrictEqual(providerModeKeys, ['codex']);
    assert.match(configModeComputed, /export const CONFIG_MODE_SET = new Set\(/);
    assert.match(configModeComputed, /isProviderConfigMode\(\)/);
    assert.match(configModeComputed, /activeProviderModelPlaceholder\(\)/);
});

test('session helper deferred claude refresh validates live tab and mode before running', () => {
    const helperScript = readProjectFile('web-ui/session-helpers.mjs');
    assert.match(helperScript, /const expectedTab = nextTab;/);
    assert.match(helperScript, /const expectedConfigMode = this\.configMode;/);
    assert.match(helperScript, /if \(this\.mainTab !== expectedTab \|\| this\.configMode !== expectedConfigMode\) return;/);
    assert.match(helperScript, /const shouldLoadTrashListOnSettingsEnter = nextTab === 'settings'/);
    assert.match(helperScript, /this\.settingsTab === 'data'/);
    assert.match(helperScript, /forceRefresh: !!this\.sessionTrashLoadedOnce/);
    assert.match(helperScript, /const shouldPrimeTrashCountOnSettingsEnter = nextTab === 'settings'/);
    assert.match(helperScript, /this\.settingsTab !== 'data'/);
    assert.match(helperScript, /this\.sessionTrashLoadedOnce = false;/);
    assert.match(helperScript, /this\.loadSessionTrashCount\(\{ silent: true \}\);/);
    assert.match(helperScript, /const shouldLoadSkillsMarketOnEnter = nextTab === 'market'/);
    assert.match(helperScript, /previousTab !== 'market'/);
    assert.match(helperScript, /let marketOverviewLoad = null;/);
    assert.match(helperScript, /marketOverviewLoad = this\.loadSkillsMarketOverview\(\{ silent: true \}\);/);
    assert.match(helperScript, /void Promise\.resolve\(marketOverviewLoad\)\.catch\(\(\) => \{\}\);/);
});

test('trash item styles stay aligned', () => {
    const styles = readBundledWebUiCss();
    assert.match(styles, /\.session-source\s*\{/);
    assert.match(styles, /\.trash-item\s*\{/);
    assert.match(styles, /\.trash-item-title\s*\{/);
    assert.match(styles, /\.trash-item-actions\s*\{/);
    assert.match(styles, /\.trash-action-btn\s*\{/);
    assert.match(styles, /\.trash-item-cwd\s*\{/);
    assert.match(styles, /\.trash-empty-state\s*\{/);
    assert.match(styles, /@media \(max-width: 540px\)\s*\{[\s\S]*\.trash-header-actions\s*\{[\s\S]*display:\s*grid;/);
    assert.match(styles, /@media \(max-width: 540px\)\s*\{[\s\S]*\.trash-header-actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    assert.match(styles, /@media \(max-width: 540px\)\s*\{[\s\S]*\.trash-header-actions\s*\{[\s\S]*width:\s*100%;/);
    assert.match(
        styles,
        /@media \(max-width: 540px\)\s*\{[\s\S]*\.selector-header \.trash-header-actions > \.btn-tool,\s*[\s\S]*width:\s*100%;[\s\S]*min-width:\s*0;[\s\S]*min-height:\s*44px;/
    );
    assert.doesNotMatch(styles, /@media \(max-width: 540px\)\s*\{[\s\S]*\.session-item-copy\.session-item-pin\s*\{[\s\S]*width:\s*44px;/);
    assert.doesNotMatch(
        styles,
        /@media \(max-width: 540px\)\s*\{[\s\S]*\.session-item-copy\.session-item-pin svg,\s*[\s\S]*width:\s*16px;/
    );
    assert.match(styles, /@media \(max-width: 540px\)\s*\{[\s\S]*\.session-item-copy\s*\{[\s\S]*width:\s*36px;[\s\S]*height:\s*36px;[\s\S]*min-width:\s*36px;[\s\S]*min-height:\s*36px;/);
    assert.match(styles, /\.codex-config-grid\s*\{/);
    assert.match(styles, /\.codex-config-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(240px,\s*100%\),\s*1fr\)\);/);
    assert.match(styles, /\.codex-config-field\s*\{/);
    assert.match(styles, /\.codex-config-field\s*\{[\s\S]*min-width:\s*0;/);
    assert.match(styles, /#panel-config-provider \.card-list > \.card,\s*#panel-config-claude \.card-list > \.card\s*\{[\s\S]*min-height:\s*88px;[\s\S]*padding-top:\s*22px;[\s\S]*padding-bottom:\s*22px;/);
    assert.match(styles, /@media \(max-width: 540px\)\s*\{[\s\S]*#panel-config-provider \.card-list > \.card,\s*#panel-config-claude \.card-list > \.card\s*\{[\s\S]*min-height:\s*84px;[\s\S]*padding-top:\s*18px;[\s\S]*padding-bottom:\s*18px;/);
    assert.match(styles, /@media \(hover: none\) and \(pointer: coarse\)\s*\{[\s\S]*#panel-config-provider \.card-list,\s*#panel-config-claude \.card-list\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
    assert.match(styles, /@media \(hover: none\) and \(pointer: coarse\)\s*\{[\s\S]*#panel-config-provider \.card-list > \.card,\s*#panel-config-claude \.card-list > \.card\s*\{[\s\S]*min-height:\s*96px;[\s\S]*padding-top:\s*24px;[\s\S]*padding-bottom:\s*24px;/);
    assert.match(styles, /#panel-config-provider \.card-list > \.card \.card-title,\s*#panel-config-claude \.card-list > \.card \.card-title\s*\{[\s\S]*flex-wrap:\s*wrap;[\s\S]*white-space:\s*normal;[\s\S]*overflow-wrap:\s*anywhere;/);
    assert.match(styles, /#panel-config-provider \.card-list > \.card \.card-title > span:first-child,\s*#panel-config-claude \.card-list > \.card \.card-title > span:first-child\s*\{[\s\S]*white-space:\s*normal;[\s\S]*overflow-wrap:\s*anywhere;/);
});

test('settings tab header actions keep compact tool buttons inline on wider screens', () => {
    const styles = readBundledWebUiCss();

    assert.match(styles, /\.settings-tab-header\s*\{[\s\S]*justify-content:\s*flex-end;/);
    assert.match(styles, /\.settings-tab-header\s*\{[\s\S]*align-items:\s*center;/);
    assert.match(styles, /\.settings-tab-actions\s*\{[\s\S]*display:\s*flex;/);
    assert.match(
        styles,
        /\.settings-tab-actions \.btn-tool,\s*\.settings-tab-actions \.btn-tool-compact\s*\{[\s\S]*width:\s*auto;/
    );
    assert.match(styles, /\.trash-header-actions\s*\{[\s\S]*display:\s*flex;/);
    assert.match(styles, /\.trash-header-actions\s*\{[\s\S]*flex-direction:\s*row;/);
    assert.match(styles, /\.trash-header-actions\s*\{[\s\S]*flex-wrap:\s*nowrap;/);
    assert.match(styles, /\.trash-header-actions\s*\{[\s\S]*align-items:\s*stretch;/);
    assert.match(styles, /\.trash-header-actions\s*\{[\s\S]*justify-content:\s*flex-end;/);
    assert.match(styles, /\.trash-header-actions\s*\{[\s\S]*max-width:\s*100%;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*display:\s*flex;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*align-self:\s*stretch;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*margin:\s*0;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*width:\s*auto;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*min-width:\s*0;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*max-width:\s*100%;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*height:\s*32px;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*min-height:\s*32px;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*line-height:\s*1;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*vertical-align:\s*top;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*top:\s*0;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact\s*\{[\s\S]*white-space:\s*nowrap;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool \+ \.btn-tool\s*\{[\s\S]*margin-top:\s*0;/);
    assert.match(styles, /\.selector-header \.trash-header-actions > \.btn-tool:not\(:disabled\):hover,\s*\.selector-header \.trash-header-actions > \.btn-tool-compact:not\(:disabled\):hover\s*\{[\s\S]*transform:\s*none;/);
    assert.match(styles, /\.btn-tool:disabled,\s*\.btn-tool\[disabled\]\s*\{[\s\S]*cursor:\s*not-allowed;/);
    assert.match(styles, /\.btn-tool:disabled:hover,\s*\.btn-tool\[disabled\]:hover,\s*\.btn-tool:disabled:active,\s*\.btn-tool\[disabled\]:active,\s*\.btn-tool-compact:disabled:hover,\s*\.btn-tool-compact\[disabled\]:hover,\s*\.btn-tool-compact:disabled:active,\s*\.btn-tool-compact\[disabled\]:active\s*\{[\s\S]*transform:\s*none;/);
    assert.match(styles, /\.market-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
    assert.match(styles, /\.market-action-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
    assert.match(styles, /\.market-target-switch\s*\{/);
    assert.match(styles, /\.market-target-chip\.active\s*\{/);
    assert.match(styles, /\.market-target-chip:disabled,\s*\.market-target-chip\[disabled\]\s*\{/);
    assert.match(styles, /@keyframes modalFadeIn/);
    assert.match(styles, /@keyframes modalSlideUp/);
    assert.match(styles, /\.modal-overlay\s*\{[\s\S]*animation:\s*modalFadeIn/);
    assert.match(styles, /\.modal\s*\{[\s\S]*animation:\s*modalSlideUp/);
    assert.match(styles, /\.market-panel-wide\s*\{/);
    assert.match(styles, /--radius-md:\s*[0-9.]+(?:px|rem);/);
    assert.match(styles, /--font-weight-primary:\s*[0-9]+;/);
    assert.match(styles, /--font-size-large:\s*[0-9.]+(?:px|rem);/);
    assert.doesNotMatch(styles, /\.market-online-list\s*\{/);
    assert.doesNotMatch(styles, /\.market-ecosystem-grid\s*\{/);
});

test('session responsive styles keep mobile toolbar reachable without deprecated wrapping', () => {
    const toolbarStyles = readProjectFile('web-ui/styles/sessions-toolbar-trash.css');
    const responsiveStyles = readProjectFile('web-ui/styles/responsive.css');

    assert.match(
        toolbarStyles,
        /\.session-toolbar-secondary\s*\{[\s\S]*?justify-content:\s*flex-start;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?\}/
    );
    assert.match(
        toolbarStyles,
        /@media \(min-width: 1101px\) \{[\s\S]*?\.session-toolbar-secondary\s*\{[\s\S]*?justify-content:\s*flex-end;[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?\}/
    );
    assert.doesNotMatch(responsiveStyles, /word-break:\s*break-word/);
    assert.match(responsiveStyles, /\.session-preview-title\s*\{[\s\S]*?overflow-wrap:\s*anywhere;[\s\S]*?\}/);
});
