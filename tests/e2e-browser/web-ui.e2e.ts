import { test, type Browser } from '@e2e-dev/web';
import { expect } from 'e2e';

// 桌面（≥721px）由侧栏导航，紧凑布局（≤720px）由顶栏标签页导航，
// 两者共用同一套 mainTab 状态，这里统一用“可见的那个导航入口”定位。
function navItem(browser: Browser, id: string) {
    return browser.locator(`#side-tab-${id}:visible, #tab-${id}:visible`);
}

function activeNavItem(browser: Browser, id: string) {
    return browser.locator(`#side-tab-${id}[aria-current="page"]:visible, #tab-${id}[aria-selected="true"]:visible`);
}

const NAV_PANELS = [
    { id: 'dashboard', panel: 'panel-dashboard' },
    { id: 'docs', panel: 'panel-docs' },
    { id: 'sessions', panel: 'panel-sessions' },
    { id: 'usage', panel: 'panel-usage' },
    { id: 'market', panel: 'panel-market' },
    { id: 'plugins', panel: 'panel-plugins' },
    { id: 'prompts', panel: 'panel-prompts' },
    { id: 'settings', panel: 'panel-settings' }
];

test('首页加载并渲染主导航', async ({ app, browser, screen }) => {
    await app.open('/');
    await expect(browser).toHaveTitle('Codex Mate');
    await expect(browser).toHaveURL('/');
    // #app 带有 v-cloak，Vue 挂载后移除，元素可见即表示前端已完成水合。
    await expect(screen.getByTestId('app')).toBeVisible();
    // 导航状态会持久化，首页用例显式切回概览，不依赖上次会话的标签页。
    await navItem(browser, 'dashboard').tap();
    await expect(screen.getByTestId('panel-dashboard')).toBeVisible();
    await expect(activeNavItem(browser, 'dashboard')).toBeVisible();
});

test('导航入口逐个切换并展示对应面板', async ({ app, browser, screen }) => {
    await app.open('/');
    for (const entry of NAV_PANELS) {
        await navItem(browser, entry.id).tap();
        await expect(activeNavItem(browser, entry.id)).toBeVisible();
        await expect(screen.getByTestId(entry.panel)).toBeVisible();
    }
});

test('设置面板二级标签页切换', async ({ app, browser, screen }) => {
    await app.open('/');
    await navItem(browser, 'settings').tap();
    // 二级标签页同样会持久化，先归一化到“通用”页再断言。
    const generalTab = screen.getByTestId('settings-tab-general');
    await generalTab.tap();
    await expect(generalTab).toHaveAttribute('aria-selected', 'true');
    await expect(screen.getByTestId('settings-panel-general')).toBeVisible();
    const dataTab = screen.getByTestId('settings-tab-data');
    await dataTab.tap();
    await expect(dataTab).toHaveAttribute('aria-selected', 'true');
    await expect(screen.getByTestId('settings-panel-data')).toBeVisible();
    await expect(screen.getByTestId('settings-panel-general')).toBeHidden();
});

test('语言切换后界面文案随 locale 更新', async ({ app, browser, screen }) => {
    await app.open('/');
    await navItem(browser, 'settings').tap();
    // 二级标签页会持久化，先归一化到“通用”页，语言下拉才可见。
    await screen.getByTestId('settings-tab-general').tap();
    const languageSelect = screen.getByTestId('settings-language-select');
    const languageTitle = browser.locator('#settings-language .settings-card-title');
    // 框架把字符串当 label 处理，这里按 option 的 value（语言码）选择。
    await languageSelect.selectOption({ value: 'en' });
    await expect(languageTitle).toHaveText('Language');
    await languageSelect.selectOption({ value: 'zh' });
    await expect(languageTitle).toHaveText('语言');
});
