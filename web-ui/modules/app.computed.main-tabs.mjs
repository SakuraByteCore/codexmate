export function createMainTabsComputed() {
    return {
        mainTabKicker() {
            if (this.mainTab === 'dashboard') return this.t('kicker.dashboard');
            if (this.mainTab === 'config') return this.t('kicker.config');
            if (this.mainTab === 'sessions') return this.t('kicker.sessions');
            if (this.mainTab === 'usage') return this.t('kicker.usage');
            if (this.mainTab === 'market') return this.t('kicker.market');
            if (this.mainTab === 'plugins') return this.t('kicker.plugins');
            if (this.mainTab === 'docs') return this.t('kicker.docs');
            if (this.mainTab === 'trash') return this.t('kicker.trash');
            if (this.mainTab === 'prompts') return this.t('kicker.prompts');
            return this.t('kicker.settings');
        },
        mainTabTitle() {
            if (this.mainTab === 'dashboard') return this.t('title.dashboard');
            if (this.mainTab === 'config') return this.t('title.config');
            if (this.mainTab === 'sessions') return this.t('title.sessions');
            if (this.mainTab === 'usage') return this.t('title.usage');
            if (this.mainTab === 'market') return this.t('title.market');
            if (this.mainTab === 'plugins') return this.t('title.plugins');
            if (this.mainTab === 'docs') return this.t('title.docs');
            if (this.mainTab === 'trash') return this.t('settings.trash.title');
            if (this.mainTab === 'prompts') return this.t('title.prompts');
            return this.t('title.settings');
        },
        mainTabSubtitle() {
            if (this.mainTab === 'dashboard') return this.t('subtitle.dashboard');
            if (this.mainTab === 'config') return this.t('subtitle.config');
            if (this.mainTab === 'sessions') return this.t('subtitle.sessions');
            if (this.mainTab === 'usage') return this.t('subtitle.usage');
            if (this.mainTab === 'market') return this.t('subtitle.market');
            if (this.mainTab === 'plugins') return this.t('subtitle.plugins');
            if (this.mainTab === 'docs') return this.t('subtitle.docs');
            if (this.mainTab === 'trash') return this.t('settings.trash.meta');
            if (this.mainTab === 'prompts') return this.t('subtitle.prompts');
            return this.t('subtitle.settings');
        }
    };
}
