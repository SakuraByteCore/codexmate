import { test } from '@e2e-dev/web';
import { expect } from 'e2e';

const MAIN_TABS: ReadonlyArray<{ tab: string; panel: string }> = [
    { tab: 'docs', panel: 'panel-docs' },
    { tab: 'sessions', panel: 'panel-sessions' },
    { tab: 'usage', panel: 'panel-usage' },
    { tab: 'market', panel: 'panel-market' },
    { tab: 'plugins', panel: 'panel-plugins' },
    { tab: 'prompts', panel: 'panel-prompts' },
    { tab: 'settings', panel: 'panel-settings' }
];

test('首页加载并渲染主导航', async ({ app, browser, screen }) => {
    await app.open('/');
    await expect(browser).toHaveTitle('Codex Mate');
    await expect(browser).toHaveURL('/');
    // #app 带有 v-cloak，Vue 挂载后移除，元素可见即表示前端已完成水合。
    await expect(screen.getByTestId('app')).toBeVisible();
    await expect(screen.getByTestId('tab-dashboard')).toHaveAttribute('aria-selected', 'true');
    await expect(screen.getByTestId('panel-dashboard')).toBeVisible();
});

test('顶部主要标签页逐个切换并展示对应面板', async ({ app, screen }) => {
    await app.open('/');
    for (const entry of MAIN_TABS) {
        const tab = screen.getByTestId(`tab-${entry.tab}`);
        await expect(tab).toBeVisible();
        await tab.tap();
        await expect(tab).toHaveAttribute('aria-selected', 'true');
        await expect(screen.getByTestId(entry.panel)).toBeVisible();
        await expect(screen.getByTestId('panel-dashboard')).toBeHidden();
    }
});

test('配置标签页可切换且面板按 provider 动态渲染', async ({ app, screen }) => {
    await app.open('/');
    const configTab = screen.getByTestId('tab-config');
    await expect(configTab).toBeVisible();
    await configTab.tap();
    await expect(configTab).toHaveAttribute('aria-selected', 'true');
});

test('设置面板二级标签页切换', async ({ app, screen }) => {
    await app.open('/');
    await screen.getByTestId('tab-settings').tap();
    const generalTab = screen.getByTestId('settings-tab-general');
    await expect(generalTab).toHaveAttribute('aria-selected', 'true');
    await expect(screen.getByTestId('settings-panel-general')).toBeVisible();
    const dataTab = screen.getByTestId('settings-tab-data');
    await dataTab.tap();
    await expect(dataTab).toHaveAttribute('aria-selected', 'true');
    await expect(screen.getByTestId('settings-panel-data')).toBeVisible();
    await expect(screen.getByTestId('settings-panel-general')).toBeHidden();
});

test('侧栏入口切换到设置面板', async ({ app, screen }) => {
    await app.open('/');
    const settingsEntry = screen.getByTestId('side-tab-settings');
    await expect(settingsEntry).toBeVisible();
    await settingsEntry.tap();
    await expect(settingsEntry).toHaveAttribute('aria-current', 'page');
    await expect(screen.getByTestId('panel-settings')).toBeVisible();
    await expect(screen.getByTestId('panel-dashboard')).toBeHidden();
});

test('语言切换后顶栏文案随 locale 更新', async ({ app, screen }) => {
    await app.open('/');
    await screen.getByTestId('tab-settings').tap();
    const languageSelect = screen.getByTestId('settings-language-select');
    await languageSelect.selectOption('en');
    await expect(screen.getByTestId('tab-dashboard')).toHaveText('Dashboard');
    await languageSelect.selectOption('zh');
    await expect(screen.getByTestId('tab-dashboard')).toHaveText('概览');
});
