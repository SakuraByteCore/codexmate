window.__CODEXMATE_WEB_UI_RENDER__ = (() => {
const { toDisplayString: _toDisplayString, normalizeClass: _normalizeClass, createElementVNode: _createElementVNode, openBlock: _openBlock, createElementBlock: _createElementBlock, createCommentVNode: _createCommentVNode, Transition: _Transition, withCtx: _withCtx, createVNode: _createVNode, createTextVNode: _createTextVNode, Fragment: _Fragment, renderList: _renderList, vShow: _vShow, withDirectives: _withDirectives, vModelSelect: _vModelSelect, vModelText: _vModelText, withKeys: _withKeys, withModifiers: _withModifiers, isMemoSame: _isMemoSame, withMemo: _withMemo, normalizeStyle: _normalizeStyle, vModelCheckbox: _vModelCheckbox, vModelDynamic: _vModelDynamic } = Vue

return function render(_ctx, _cache) {
  return (_openBlock(), _createElementBlock(_Fragment, null, [
    (!_ctx.sessionStandalone)
      ? (_openBlock(), _createElementBlock("div", {
          key: 0,
          class: "top-tabs",
          role: "tablist",
          "aria-label": _ctx.t('nav.topTabs.aria')
        }, [
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["top-tab", { active: _ctx.isMainTabNavActive('dashboard') }]),
            id: "tab-dashboard",
            role: "tab",
            "data-main-tab": "dashboard",
            tabindex: _ctx.mainTab === 'dashboard' ? 0 : -1,
            "aria-selected": _ctx.mainTab === 'dashboard',
            "aria-controls": "panel-dashboard",
            onPointerdown: $event => (_ctx.onMainTabPointerDown('dashboard', $event)),
            onClick: $event => (_ctx.onMainTabClick('dashboard', $event))
          }, _toDisplayString(_ctx.t('tab.dashboard')), 43 /* TEXT, CLASS, PROPS, NEED_HYDRATION */, ["tabindex", "aria-selected", "onPointerdown", "onClick"]),
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["top-tab", { active: _ctx.isMainTabNavActive('docs') }]),
            id: "tab-docs",
            role: "tab",
            "data-main-tab": "docs",
            tabindex: _ctx.mainTab === 'docs' ? 0 : -1,
            "aria-selected": _ctx.mainTab === 'docs',
            "aria-controls": "panel-docs",
            onPointerdown: $event => (_ctx.onMainTabPointerDown('docs', $event)),
            onClick: $event => (_ctx.onMainTabClick('docs', $event))
          }, _toDisplayString(_ctx.t('tab.docs')), 43 /* TEXT, CLASS, PROPS, NEED_HYDRATION */, ["tabindex", "aria-selected", "onPointerdown", "onClick"]),
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["top-tab", { active: _ctx.isMainTabNavActive('config') }]),
            id: "tab-config",
            role: "tab",
            "data-main-tab": "config",
            "data-config-mode": _ctx.configMode,
            tabindex: _ctx.mainTab === 'config' ? 0 : -1,
            "aria-selected": _ctx.mainTab === 'config',
            "aria-controls": _ctx.configMode === 'claude' ? 'panel-config-claude' : (_ctx.configMode === 'openclaw' ? 'panel-config-openclaw' : 'panel-config-provider'),
            onPointerdown: $event => (_ctx.onMainTabPointerDown('config', $event)),
            onClick: $event => (_ctx.onMainTabClick('config', $event))
          }, _toDisplayString(_ctx.t('tab.config')), 43 /* TEXT, CLASS, PROPS, NEED_HYDRATION */, ["data-config-mode", "tabindex", "aria-selected", "aria-controls", "onPointerdown", "onClick"]),
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["top-tab", { active: _ctx.isMainTabNavActive('sessions') }]),
            id: "tab-sessions",
            role: "tab",
            "data-main-tab": "sessions",
            tabindex: _ctx.mainTab === 'sessions' ? 0 : -1,
            "aria-selected": _ctx.mainTab === 'sessions',
            "aria-controls": "panel-sessions",
            onPointerdown: $event => (_ctx.onMainTabPointerDown('sessions', $event)),
            onClick: $event => (_ctx.onMainTabClick('sessions', $event))
          }, _toDisplayString(_ctx.t('tab.sessions')), 43 /* TEXT, CLASS, PROPS, NEED_HYDRATION */, ["tabindex", "aria-selected", "onPointerdown", "onClick"]),
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["top-tab", { active: _ctx.isMainTabNavActive('usage') }]),
            id: "tab-usage",
            role: "tab",
            "data-main-tab": "usage",
            tabindex: _ctx.mainTab === 'usage' ? 0 : -1,
            "aria-selected": _ctx.mainTab === 'usage',
            "aria-controls": "panel-usage",
            onPointerdown: $event => (_ctx.onMainTabPointerDown('usage', $event)),
            onClick: $event => (_ctx.onMainTabClick('usage', $event))
          }, _toDisplayString(_ctx.t('tab.usage')), 43 /* TEXT, CLASS, PROPS, NEED_HYDRATION */, ["tabindex", "aria-selected", "onPointerdown", "onClick"]),
          (_ctx.taskOrchestrationTabEnabled)
            ? (_openBlock(), _createElementBlock("button", {
                key: 0,
                type: "button",
                class: _normalizeClass(["top-tab", { active: _ctx.isMainTabNavActive('orchestration') }]),
                id: "tab-orchestration",
                role: "tab",
                "data-main-tab": "orchestration",
                tabindex: _ctx.mainTab === 'orchestration' ? 0 : -1,
                "aria-selected": _ctx.mainTab === 'orchestration',
                "aria-controls": "panel-orchestration",
                onPointerdown: $event => (_ctx.onMainTabPointerDown('orchestration', $event)),
                onClick: $event => (_ctx.onMainTabClick('orchestration', $event))
              }, _toDisplayString(_ctx.t('tab.orchestration')), 43 /* TEXT, CLASS, PROPS, NEED_HYDRATION */, ["tabindex", "aria-selected", "onPointerdown", "onClick"]))
            : _createCommentVNode("v-if", true),
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["top-tab", { active: _ctx.isMainTabNavActive('market') }]),
            id: "tab-market",
            role: "tab",
            "data-main-tab": "market",
            tabindex: _ctx.mainTab === 'market' ? 0 : -1,
            "aria-selected": _ctx.mainTab === 'market',
            "aria-controls": "panel-market",
            onPointerdown: $event => (_ctx.onMainTabPointerDown('market', $event)),
            onClick: $event => (_ctx.onMainTabClick('market', $event))
          }, _toDisplayString(_ctx.t('tab.market')), 43 /* TEXT, CLASS, PROPS, NEED_HYDRATION */, ["tabindex", "aria-selected", "onPointerdown", "onClick"]),
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["top-tab", { active: _ctx.isMainTabNavActive('plugins') }]),
            id: "tab-plugins",
            role: "tab",
            "data-main-tab": "plugins",
            tabindex: _ctx.mainTab === 'plugins' ? 0 : -1,
            "aria-selected": _ctx.mainTab === 'plugins',
            "aria-controls": "panel-plugins",
            onPointerdown: $event => (_ctx.onMainTabPointerDown('plugins', $event)),
            onClick: $event => (_ctx.onMainTabClick('plugins', $event))
          }, _toDisplayString(_ctx.t('tab.plugins')), 43 /* TEXT, CLASS, PROPS, NEED_HYDRATION */, ["tabindex", "aria-selected", "onPointerdown", "onClick"]),
          _createElementVNode("button", {
            type: "button",
            class: _normalizeClass(["top-tab", { active: _ctx.isMainTabNavActive('settings') }]),
            id: "tab-settings",
            role: "tab",
            "data-main-tab": "settings",
            tabindex: _ctx.mainTab === 'settings' ? 0 : -1,
            "aria-selected": _ctx.mainTab === 'settings',
            "aria-controls": "panel-settings",
            onPointerdown: $event => (_ctx.onMainTabPointerDown('settings', $event)),
            onClick: $event => (_ctx.onMainTabClick('settings', $event))
          }, _toDisplayString(_ctx.t('tab.settings')), 43 /* TEXT, CLASS, PROPS, NEED_HYDRATION */, ["tabindex", "aria-selected", "onPointerdown", "onClick"])
        ], 8 /* PROPS */, ["aria-label"]))
      : _createCommentVNode("v-if", true),
    (!_ctx.sessionStandalone)
      ? (_openBlock(), _createElementBlock("div", {
          key: 1,
          class: "lang-fab",
          role: "group",
          "aria-label": _ctx.t('lang.label')
        }, [
          _createElementVNode("div", {
            class: "lang-choice",
            role: "group",
            "aria-label": _ctx.t('lang.label')
          }, [
            _createElementVNode("button", {
              type: "button",
              class: _normalizeClass(["lang-choice-btn", { active: (_ctx.lang || 'zh') === 'zh' }]),
              "aria-pressed": (_ctx.lang || 'zh') === 'zh',
              onClick: $event => (_ctx.setLang('zh'))
            }, "ZH", 10 /* CLASS, PROPS */, ["aria-pressed", "onClick"]),
            _createElementVNode("button", {
              type: "button",
              class: _normalizeClass(["lang-choice-btn", { active: (_ctx.lang || 'zh') === 'en' }]),
              "aria-pressed": (_ctx.lang || 'zh') === 'en',
              onClick: $event => (_ctx.setLang('en'))
            }, "EN", 10 /* CLASS, PROPS */, ["aria-pressed", "onClick"]),
            _createElementVNode("button", {
              type: "button",
              class: _normalizeClass(["lang-choice-btn", { active: (_ctx.lang || 'zh') === 'ja' }]),
              "aria-pressed": (_ctx.lang || 'zh') === 'ja',
              onClick: $event => (_ctx.setLang('ja'))
            }, "日本語", 10 /* CLASS, PROPS */, ["aria-pressed", "onClick"])
          ], 8 /* PROPS */, ["aria-label"])
        ], 8 /* PROPS */, ["aria-label"]))
      : _createCommentVNode("v-if", true),
    _createElementVNode("div", {
      class: _normalizeClass(['app-shell', { standalone: _ctx.sessionStandalone }])
    }, [
      (!_ctx.sessionStandalone)
        ? (_openBlock(), _createElementBlock("aside", {
            key: 0,
            class: "side-rail"
          }, [
            _createElementVNode("div", {
              class: "brand-block",
              tabindex: "0",
              onMouseenter: $event => (_ctx.brandHovered = true),
              onMouseleave: $event => (_ctx.brandHovered = false),
              onFocus: $event => (_ctx.brandHovered = true),
              onBlur: $event => (_ctx.brandHovered = false)
            }, [
              _createElementVNode("div", { class: "brand-head" }, [
                _createElementVNode("img", {
                  class: "brand-logo",
                  src: "/res/logo-pack.webp",
                  alt: "Codex Mate logo"
                }),
                _createElementVNode("div", { class: "brand-copy" }, [
                  _createElementVNode("div", { class: "brand-kicker" }, [
                    _createTextVNode("Codex Mate"),
                    _createVNode(_Transition, { name: "brand-version-fade" }, {
                      default: _withCtx(() => [
                        (_ctx.appVersion && _ctx.brandHovered)
                          ? (_openBlock(), _createElementBlock("span", {
                              key: 0,
                              class: "brand-version"
                            }, " v" + _toDisplayString(_ctx.appVersion), 1 /* TEXT */))
                          : _createCommentVNode("v-if", true)
                      ]),
                      _: 1 /* STABLE */
                    })
                  ])
                ])
              ])
            ], 40 /* PROPS, NEED_HYDRATION */, ["onMouseenter", "onMouseleave", "onFocus", "onBlur"]),
            _createElementVNode("div", { class: "side-rail-nav" }, [
              _createElementVNode("div", {
                class: "side-section",
                role: "navigation",
                "aria-label": _ctx.t('side.overview')
              }, [
                _createElementVNode("div", { class: "side-section-title" }, _toDisplayString(_ctx.t('side.overview')), 1 /* TEXT */),
                _createElementVNode("button", {
                  id: "side-tab-dashboard",
                  "data-main-tab": "dashboard",
                  "aria-current": _ctx.mainTab === 'dashboard' ? 'page' : null,
                  class: _normalizeClass(['side-item', { active: _ctx.isMainTabNavActive('dashboard') }]),
                  onPointerdown: $event => (_ctx.onMainTabPointerDown('dashboard', $event)),
                  onClick: $event => (_ctx.onMainTabClick('dashboard', $event))
                }, [
                  _createElementVNode("div", { class: "side-item-title" }, _toDisplayString(_ctx.t('side.overview.doctor')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "side-item-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('side.overview.doctor.meta')), 1 /* TEXT */),
                    _createElementVNode("span", null, _toDisplayString(_ctx.inspectorHealthStatus), 1 /* TEXT */)
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"])
              ], 8 /* PROPS */, ["aria-label"]),
              _createElementVNode("div", {
                class: "side-section",
                role: "navigation",
                "aria-label": _ctx.t('side.docs')
              }, [
                _createElementVNode("div", { class: "side-section-title" }, _toDisplayString(_ctx.t('side.docs')), 1 /* TEXT */),
                _createElementVNode("button", {
                  id: "side-tab-docs",
                  "data-main-tab": "docs",
                  "aria-current": _ctx.mainTab === 'docs' ? 'page' : null,
                  class: _normalizeClass(['side-item', { active: _ctx.isMainTabNavActive('docs') }]),
                  onPointerdown: $event => (_ctx.onMainTabPointerDown('docs', $event)),
                  onClick: $event => (_ctx.onMainTabClick('docs', $event))
                }, [
                  _createElementVNode("div", { class: "side-item-title" }, _toDisplayString(_ctx.t('side.docs.cliInstall')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "side-item-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('side.docs.cliInstall.meta')), 1 /* TEXT */),
                    _createElementVNode("span", null, _toDisplayString(String(_ctx.installPackageManager || 'npm').toUpperCase()) + " · " + _toDisplayString(_ctx.installCommandAction === 'update' ? _ctx.t('common.update') : (_ctx.installCommandAction === 'uninstall' ? _ctx.t('common.uninstall') : _ctx.t('common.install'))), 1 /* TEXT */)
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"])
              ], 8 /* PROPS */, ["aria-label"]),
              _createElementVNode("div", {
                class: "side-section",
                role: "navigation",
                "aria-label": _ctx.t('side.config')
              }, [
                _createElementVNode("div", { class: "side-section-title" }, _toDisplayString(_ctx.t('side.config')), 1 /* TEXT */),
                _createElementVNode("button", {
                  id: "side-tab-config-codex",
                  "data-main-tab": "config",
                  "data-config-mode": "codex",
                  "aria-current": _ctx.mainTab === 'config' && _ctx.configMode === 'codex' ? 'page' : null,
                  class: _normalizeClass(['side-item', { active: _ctx.isConfigModeNavActive('codex') }]),
                  onPointerdown: $event => (_ctx.onConfigTabPointerDown('codex', $event)),
                  onClick: $event => (_ctx.onConfigTabClick('codex', $event))
                }, [
                  _createElementVNode("div", { class: "side-item-title" }, _toDisplayString(_ctx.t('side.config.codex')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "side-item-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('side.config.codex.meta')), 1 /* TEXT */),
                    (_ctx.currentProvider)
                      ? (_openBlock(), _createElementBlock("span", { key: 0 }, _toDisplayString(_ctx.t('common.current', { value: _ctx.currentProvider })), 1 /* TEXT */))
                      : _createCommentVNode("v-if", true)
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"]),
                _createElementVNode("button", {
                  id: "side-tab-config-claude",
                  "data-main-tab": "config",
                  "data-config-mode": "claude",
                  "aria-current": _ctx.mainTab === 'config' && _ctx.configMode === 'claude' ? 'page' : null,
                  class: _normalizeClass(['side-item', { active: _ctx.isConfigModeNavActive('claude') }]),
                  onPointerdown: $event => (_ctx.onConfigTabPointerDown('claude', $event)),
                  onClick: $event => (_ctx.onConfigTabClick('claude', $event))
                }, [
                  _createElementVNode("div", { class: "side-item-title" }, _toDisplayString(_ctx.t('side.config.claude')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "side-item-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('side.config.claude.meta')), 1 /* TEXT */),
                    (_ctx.currentClaudeConfig)
                      ? (_openBlock(), _createElementBlock("span", { key: 0 }, _toDisplayString(_ctx.t('common.current', { value: _ctx.currentClaudeConfig })), 1 /* TEXT */))
                      : _createCommentVNode("v-if", true)
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"]),
                _createElementVNode("button", {
                  id: "side-tab-config-openclaw",
                  "data-main-tab": "config",
                  "data-config-mode": "openclaw",
                  "aria-current": _ctx.mainTab === 'config' && _ctx.configMode === 'openclaw' ? 'page' : null,
                  class: _normalizeClass(['side-item', { active: _ctx.isConfigModeNavActive('openclaw') }]),
                  onPointerdown: $event => (_ctx.onConfigTabPointerDown('openclaw', $event)),
                  onClick: $event => (_ctx.onConfigTabClick('openclaw', $event))
                }, [
                  _createElementVNode("div", { class: "side-item-title" }, _toDisplayString(_ctx.t('side.config.openclaw')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "side-item-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('side.config.openclaw.meta')), 1 /* TEXT */),
                    (_ctx.currentOpenclawConfig)
                      ? (_openBlock(), _createElementBlock("span", { key: 0 }, _toDisplayString(_ctx.t('common.current', { value: _ctx.currentOpenclawConfig })), 1 /* TEXT */))
                      : _createCommentVNode("v-if", true)
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"])
              ], 8 /* PROPS */, ["aria-label"]),
              _createElementVNode("div", {
                class: "side-section",
                role: "navigation",
                "aria-label": _ctx.t('side.sessions')
              }, [
                _createElementVNode("div", { class: "side-section-title" }, _toDisplayString(_ctx.t('side.sessions')), 1 /* TEXT */),
                _createElementVNode("button", {
                  id: "side-tab-sessions",
                  "data-main-tab": "sessions",
                  "aria-current": _ctx.mainTab === 'sessions' ? 'page' : null,
                  class: _normalizeClass(['side-item', { active: _ctx.isMainTabNavActive('sessions') }]),
                  onPointerdown: $event => (_ctx.onMainTabPointerDown('sessions', $event)),
                  onClick: $event => (_ctx.onMainTabClick('sessions', $event))
                }, [
                  _createElementVNode("div", { class: "side-item-title" }, _toDisplayString(_ctx.t('side.sessions.browser')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "side-item-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('side.sessions.browser.meta')), 1 /* TEXT */),
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('sessions.sourceLabel', { value: (_ctx.sessionFilterSource === 'all' ? _ctx.t('sessions.source.all') : (_ctx.sessionFilterSource === 'claude' ? 'Claude Code' : (_ctx.sessionFilterSource === 'gemini' ? 'Gemini CLI' : (_ctx.sessionFilterSource === 'codebuddy' ? 'CodeBuddy Code' : 'Codex')))) })), 1 /* TEXT */)
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"]),
                _createElementVNode("button", {
                  id: "side-tab-usage",
                  "data-main-tab": "usage",
                  "aria-current": _ctx.mainTab === 'usage' ? 'page' : null,
                  class: _normalizeClass(['side-item', { active: _ctx.isMainTabNavActive('usage') }]),
                  onPointerdown: $event => (_ctx.onMainTabPointerDown('usage', $event)),
                  onClick: $event => (_ctx.onMainTabClick('usage', $event))
                }, [
                  _createElementVNode("div", { class: "side-item-title" }, _toDisplayString(_ctx.t('tab.usage')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "side-item-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('side.usage.meta')), 1 /* TEXT */),
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('usage.rangeLabel', { value: (_ctx.sessionsUsageTimeRange === 'all' ? _ctx.t('usage.range.all') : (_ctx.sessionsUsageTimeRange === '30d' ? _ctx.t('usage.range.30d.short') : _ctx.t('usage.range.7d.short'))) })), 1 /* TEXT */)
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"])
              ], 8 /* PROPS */, ["aria-label"]),
              (_ctx.taskOrchestrationTabEnabled)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "side-section",
                    role: "navigation",
                    "aria-label": _ctx.t('side.orchestration')
                  }, [
                    _createElementVNode("div", { class: "side-section-title" }, _toDisplayString(_ctx.t('side.orchestration')), 1 /* TEXT */),
                    _createElementVNode("button", {
                      id: "side-tab-orchestration",
                      "data-main-tab": "orchestration",
                      "aria-current": _ctx.mainTab === 'orchestration' ? 'page' : null,
                      class: _normalizeClass(['side-item', { active: _ctx.isMainTabNavActive('orchestration') }]),
                      onPointerdown: $event => (_ctx.onMainTabPointerDown('orchestration', $event)),
                      onClick: $event => (_ctx.onMainTabClick('orchestration', $event))
                    }, [
                      _createElementVNode("div", { class: "side-item-title" }, _toDisplayString(_ctx.t('tab.orchestration')), 1 /* TEXT */),
                      _createElementVNode("div", { class: "side-item-meta" }, [
                        _createElementVNode("span", null, _toDisplayString(_ctx.t('side.orchestration.meta')), 1 /* TEXT */),
                        _createElementVNode("span", null, _toDisplayString(_ctx.t('orchestration.queueStats', { running: _ctx.taskOrchestrationQueueStats.running, queued: _ctx.taskOrchestrationQueueStats.queued })), 1 /* TEXT */)
                      ])
                    ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"])
                  ], 8 /* PROPS */, ["aria-label"]))
                : _createCommentVNode("v-if", true),
              _createElementVNode("div", {
                class: "side-section",
                role: "navigation",
                "aria-label": _ctx.t('side.skills')
              }, [
                _createElementVNode("div", { class: "side-section-title" }, _toDisplayString(_ctx.t('side.skills')), 1 /* TEXT */),
                _createElementVNode("button", {
                  id: "side-tab-market",
                  "data-main-tab": "market",
                  "aria-current": _ctx.mainTab === 'market' ? 'page' : null,
                  class: _normalizeClass(['side-item', { active: _ctx.isMainTabNavActive('market') }]),
                  onPointerdown: $event => (_ctx.onMainTabPointerDown('market', $event)),
                  onClick: $event => (_ctx.onMainTabClick('market', $event))
                }, [
                  _createElementVNode("div", { class: "side-item-title" }, _toDisplayString(_ctx.t('tab.market')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "side-item-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('skills.localLabel', { target: _ctx.skillsTargetLabel })), 1 /* TEXT */),
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('skills.counts', { installed: _ctx.skillsList.length, importable: _ctx.skillsImportList.length })), 1 /* TEXT */)
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"])
              ], 8 /* PROPS */, ["aria-label"]),
              _createElementVNode("div", {
                class: "side-section",
                role: "navigation",
                "aria-label": _ctx.t('side.plugins')
              }, [
                _createElementVNode("div", { class: "side-section-title" }, _toDisplayString(_ctx.t('side.plugins')), 1 /* TEXT */),
                _createElementVNode("button", {
                  id: "side-tab-plugins",
                  "data-main-tab": "plugins",
                  "aria-current": _ctx.mainTab === 'plugins' ? 'page' : null,
                  class: _normalizeClass(['side-item', { active: _ctx.isMainTabNavActive('plugins') }]),
                  onPointerdown: $event => (_ctx.onMainTabPointerDown('plugins', $event)),
                  onClick: $event => (_ctx.onMainTabClick('plugins', $event))
                }, [
                  _createElementVNode("div", { class: "side-item-title" }, _toDisplayString(_ctx.t('side.plugins.tools')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "side-item-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('side.plugins.tools.meta')), 1 /* TEXT */),
                    _createElementVNode("span", null, _toDisplayString(_ctx.promptTemplatesList.length) + " templates", 1 /* TEXT */)
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"])
              ], 8 /* PROPS */, ["aria-label"]),
              _createElementVNode("div", {
                class: "side-section",
                role: "navigation",
                "aria-label": _ctx.t('side.system')
              }, [
                _createElementVNode("div", { class: "side-section-title" }, _toDisplayString(_ctx.t('side.system')), 1 /* TEXT */),
                _createElementVNode("button", {
                  id: "side-tab-settings",
                  "data-main-tab": "settings",
                  "aria-current": _ctx.mainTab === 'settings' ? 'page' : null,
                  class: _normalizeClass(['side-item', { active: _ctx.isMainTabNavActive('settings') }]),
                  onPointerdown: $event => (_ctx.onMainTabPointerDown('settings', $event)),
                  onClick: $event => (_ctx.onMainTabClick('settings', $event))
                }, [
                  _createElementVNode("div", { class: "side-item-title" }, _toDisplayString(_ctx.t('side.system.settings')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "side-item-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('side.system.settings.meta')), 1 /* TEXT */)
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"]),
                _createElementVNode("button", {
                  id: "side-tab-trash",
                  "data-main-tab": "trash",
                  "aria-current": _ctx.mainTab === 'trash' ? 'page' : null,
                  class: _normalizeClass(['side-item', { active: _ctx.isMainTabNavActive('trash') }]),
                  onPointerdown: $event => (_ctx.onMainTabPointerDown('trash', $event)),
                  onClick: $event => (_ctx.onMainTabClick('trash', $event))
                }, [
                  _createElementVNode("div", { class: "side-item-title" }, "回收站"),
                  _createElementVNode("div", { class: "side-item-meta" }, [
                    _createElementVNode("span", null, "已删除会话"),
                    (_ctx.sessionTrashCount > 0)
                      ? (_openBlock(), _createElementBlock("span", {
                          key: 0,
                          class: "side-item-badge"
                        }, _toDisplayString(_ctx.sessionTrashCount), 1 /* TEXT */))
                      : _createCommentVNode("v-if", true)
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["aria-current", "onPointerdown", "onClick"])
              ], 8 /* PROPS */, ["aria-label"])
            ]),
            _createElementVNode("div", {
              class: "side-rail-lang",
              role: "group",
              "aria-label": _ctx.t('lang.label')
            }, [
              _createElementVNode("div", {
                class: "lang-choice",
                role: "group",
                "aria-label": _ctx.t('lang.label')
              }, [
                _createElementVNode("button", {
                  type: "button",
                  class: _normalizeClass(["lang-choice-btn", { active: (_ctx.lang || 'zh') === 'zh' }]),
                  "aria-pressed": (_ctx.lang || 'zh') === 'zh',
                  onClick: $event => (_ctx.setLang('zh'))
                }, "ZH", 10 /* CLASS, PROPS */, ["aria-pressed", "onClick"]),
                _createElementVNode("button", {
                  type: "button",
                  class: _normalizeClass(["lang-choice-btn", { active: (_ctx.lang || 'zh') === 'en' }]),
                  "aria-pressed": (_ctx.lang || 'zh') === 'en',
                  onClick: $event => (_ctx.setLang('en'))
                }, "EN", 10 /* CLASS, PROPS */, ["aria-pressed", "onClick"]),
                _createElementVNode("button", {
                  type: "button",
                  class: _normalizeClass(["lang-choice-btn", { active: (_ctx.lang || 'zh') === 'ja' }]),
                  "aria-pressed": (_ctx.lang || 'zh') === 'ja',
                  onClick: $event => (_ctx.setLang('ja'))
                }, "日本語", 10 /* CLASS, PROPS */, ["aria-pressed", "onClick"])
              ], 8 /* PROPS */, ["aria-label"])
            ], 8 /* PROPS */, ["aria-label"])
          ]))
        : _createCommentVNode("v-if", true),
      _createElementVNode("main", { class: "main-panel" }, [
        _createElementVNode("div", { class: "main-panel-topbar" }, [
          (!_ctx.sessionStandalone)
            ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "panel-header panel-header-refined"
              }, [
                _createElementVNode("div", { class: "panel-header-copy" }, [
                  _createElementVNode("div", { class: "panel-kicker" }, _toDisplayString(_ctx.mainTabKicker), 1 /* TEXT */),
                  _createElementVNode("h1", { class: "main-title" }, _toDisplayString(_ctx.mainTabTitle), 1 /* TEXT */),
                  _createElementVNode("p", { class: "subtitle" }, _toDisplayString(_ctx.mainTabSubtitle), 1 /* TEXT */)
                ])
              ]))
            : _createCommentVNode("v-if", true),
          (!_ctx.sessionStandalone && _ctx.mainTab === 'config')
            ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "status-strip"
              }, [
                (_ctx.isProviderConfigMode)
                  ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                      _createElementVNode("div", { class: "status-chip" }, [
                        _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.activeProviderConfigChipLabel), 1 /* TEXT */),
                        _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.currentProvider || _ctx.t('common.notSelected')), 1 /* TEXT */)
                      ]),
                      _createElementVNode("div", { class: "status-chip" }, [
                        _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.activeProviderModelChipLabel), 1 /* TEXT */),
                        _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.currentModel || _ctx.t('common.notSelected')), 1 /* TEXT */)
                      ])
                    ], 64 /* STABLE_FRAGMENT */))
                  : (_ctx.configMode === 'claude')
                    ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                        _createElementVNode("div", { class: "status-chip" }, [
                          _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.claudeConfig')), 1 /* TEXT */),
                          _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.currentClaudeConfig || _ctx.t('common.notSelected')), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", { class: "status-chip" }, [
                          _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.claudeModel')), 1 /* TEXT */),
                          _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.currentClaudeModel || _ctx.t('common.notSelected')), 1 /* TEXT */)
                        ])
                      ], 64 /* STABLE_FRAGMENT */))
                    : (_ctx.configMode === 'openclaw')
                      ? (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                          _createElementVNode("div", { class: "status-chip" }, [
                            _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.openclawConfig')), 1 /* TEXT */),
                            _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.currentOpenclawConfig || _ctx.t('common.notSelected')), 1 /* TEXT */)
                          ]),
                          _createElementVNode("div", { class: "status-chip" }, [
                            _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.workspaceFile')), 1 /* TEXT */),
                            _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.openclawWorkspaceFileName || _ctx.t('common.notSelected')), 1 /* TEXT */)
                          ])
                        ], 64 /* STABLE_FRAGMENT */))
                      : (_openBlock(), _createElementBlock("div", {
                          key: 3,
                          class: "status-chip"
                        }, [
                          _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.configMode')), 1 /* TEXT */),
                          _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.t('common.notSelected')), 1 /* TEXT */)
                        ]))
              ]))
            : (!_ctx.sessionStandalone && _ctx.mainTab === 'sessions')
              ? (_openBlock(), _createElementBlock("div", {
                  key: 2,
                  class: "status-strip"
                }, [
                  _createElementVNode("div", { class: "status-chip" }, [
                    _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.currentSource')), 1 /* TEXT */),
                    _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.sessionFilterSource === 'all'
                                    ? _ctx.t('sessions.source.all')
                                    : (_ctx.sessionFilterSource === 'codex'
                                        ? _ctx.t('sessions.source.codex')
                                        : (_ctx.sessionFilterSource === 'claude'
                                            ? _ctx.t('sessions.source.claudeCode')
                                            : (_ctx.sessionFilterSource === 'gemini'
                                                ? _ctx.t('sessions.source.gemini')
                                                : (_ctx.sessionFilterSource === 'codebuddy'
                                                    ? _ctx.t('sessions.source.codebuddy')
                                                    : _ctx.t('sessions.source.codex')))))), 1 /* TEXT */)
                  ]),
                  _createElementVNode("div", { class: "status-chip" }, [
                    _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.sessionCount')), 1 /* TEXT */),
                    _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.sessionsList.length), 1 /* TEXT */)
                  ])
                ]))
              : (!_ctx.sessionStandalone && _ctx.mainTab === 'usage')
                ? (_openBlock(), _createElementBlock("div", {
                    key: 3,
                    class: "status-strip"
                  }, [
                    _createElementVNode("div", { class: "status-chip" }, [
                      _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.range')), 1 /* TEXT */),
                      _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.sessionsUsageTimeRange === 'all' ? _ctx.t('usage.range.all') : (_ctx.sessionsUsageTimeRange === '30d' ? _ctx.t('usage.range.30d.short') : _ctx.t('usage.range.7d.short'))), 1 /* TEXT */)
                    ]),
                    _createElementVNode("div", { class: "status-chip" }, [
                      _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.totalSessions')), 1 /* TEXT */),
                      _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.sessionUsageSummaryCards[0] ? _ctx.sessionUsageSummaryCards[0].value : 0), 1 /* TEXT */)
                    ]),
                    _createElementVNode("div", { class: "status-chip" }, [
                      _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.totalMessages')), 1 /* TEXT */),
                      _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.sessionUsageSummaryCards[1] ? _ctx.sessionUsageSummaryCards[1].value : 0), 1 /* TEXT */)
                    ])
                  ]))
                : (!_ctx.sessionStandalone && _ctx.taskOrchestrationTabEnabled && _ctx.mainTab === 'orchestration')
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 4,
                      class: "status-strip"
                    }, [
                      _createElementVNode("div", { class: "status-chip" }, [
                        _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.engine')), 1 /* TEXT */),
                        _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.taskOrchestration.selectedEngine === 'workflow' ? 'Workflow' : 'Codex'), 1 /* TEXT */)
                      ]),
                      _createElementVNode("div", { class: "status-chip" }, [
                        _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.concurrency')), 1 /* TEXT */),
                        _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.taskOrchestration.concurrency), 1 /* TEXT */)
                      ]),
                      _createElementVNode("div", { class: "status-chip" }, [
                        _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.running')), 1 /* TEXT */),
                        _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.taskOrchestrationQueueStats.running), 1 /* TEXT */)
                      ]),
                      _createElementVNode("div", { class: "status-chip" }, [
                        _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.queued')), 1 /* TEXT */),
                        _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.taskOrchestrationQueueStats.queued), 1 /* TEXT */)
                      ]),
                      _createElementVNode("div", { class: "status-chip" }, [
                        _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.runs')), 1 /* TEXT */),
                        _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.taskOrchestration.runs.length), 1 /* TEXT */)
                      ])
                    ]))
                  : (!_ctx.sessionStandalone && _ctx.mainTab === 'market')
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 5,
                        class: "status-strip"
                      }, [
                        _createElementVNode("div", { class: "status-chip" }, [
                          _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.currentTarget')), 1 /* TEXT */),
                          _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.skillsTargetLabel), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", { class: "status-chip" }, [
                          _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.localSkills')), 1 /* TEXT */),
                          _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.skillsList.length), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", { class: "status-chip" }, [
                          _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.importable')), 1 /* TEXT */),
                          _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.skillsImportList.length), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", { class: "status-chip" }, [
                          _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.importableDirect')), 1 /* TEXT */),
                          _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.skillsImportConfiguredCount), 1 /* TEXT */)
                        ])
                      ]))
                    : (!_ctx.sessionStandalone && _ctx.mainTab === 'docs')
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 6,
                          class: "status-strip"
                        }, [
                          _createElementVNode("div", { class: "status-chip" }, [
                            _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.pm')), 1 /* TEXT */),
                            _createElementVNode("span", { class: "value" }, _toDisplayString(String(_ctx.installPackageManager || 'npm').toUpperCase()), 1 /* TEXT */)
                          ]),
                          _createElementVNode("div", { class: "status-chip" }, [
                            _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.action')), 1 /* TEXT */),
                            _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.installCommandAction === 'update' ? _ctx.t('common.update') : (_ctx.installCommandAction === 'uninstall' ? _ctx.t('common.uninstall') : _ctx.t('common.install'))), 1 /* TEXT */)
                          ]),
                          _createElementVNode("div", { class: "status-chip" }, [
                            _createElementVNode("span", { class: "label" }, _toDisplayString(_ctx.t('status.registry')), 1 /* TEXT */),
                            _createElementVNode("span", { class: "value" }, _toDisplayString(_ctx.installRegistryPreview || _ctx.t('common.defaultOfficial')), 1 /* TEXT */)
                          ])
                        ]))
                      : (!_ctx.sessionStandalone)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 7,
                            class: "status-strip status-strip-placeholder",
                            "aria-hidden": "true"
                          }, [
                            _createElementVNode("div", { class: "status-chip" }, [
                              _createElementVNode("span", { class: "label" }, " "),
                              _createElementVNode("span", { class: "value" }, " ")
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
          (!_ctx.sessionStandalone && _ctx.mainTab === 'config' && _ctx.isProviderConfigMode && _ctx.forceCompactLayout && !_ctx.loading && !_ctx.initError && _ctx.displayProvidersList.length > 1)
            ? (_openBlock(), _createElementBlock("div", {
                key: 8,
                class: "provider-fast-switch"
              }, [
                _createElementVNode("label", {
                  class: "provider-fast-switch-label",
                  for: "provider-fast-switch-select"
                }, _toDisplayString(_ctx.t('status.quickSwitchProvider')), 1 /* TEXT */),
                _createElementVNode("select", {
                  id: "provider-fast-switch-select",
                  class: "provider-fast-switch-select",
                  value: _ctx.displayCurrentProvider,
                  onChange: $event => (_ctx.quickSwitchProvider($event.target.value))
                }, [
                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.displayProvidersList, (provider) => {
                    return (_openBlock(), _createElementBlock("option", {
                      key: 'quick-switch-' + provider.name,
                      value: provider.name
                    }, _toDisplayString(provider.name), 9 /* TEXT, PROPS */, ["value"]))
                  }), 128 /* KEYED_FRAGMENT */))
                ], 40 /* PROPS, NEED_HYDRATION */, ["value", "onChange"])
              ]))
            : _createCommentVNode("v-if", true)
        ]),
        _createCommentVNode(" 内容包裹器 - 稳定布局 "),
        _createElementVNode("div", { class: "content-wrapper" }, [
          _withDirectives(_createElementVNode("div", {
            class: "mode-content",
            id: "panel-dashboard",
            role: "tabpanel",
            "aria-labelledby": 'tab-dashboard'
          }, [
            _createElementVNode("div", { class: "selector-section doctor-hero" }, [
              _createElementVNode("div", { class: "selector-header" }, [
                _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('dashboard.doctor.title')), 1 /* TEXT */),
                _createElementVNode("div", { class: "selector-actions" }, [
                  _createElementVNode("button", {
                    class: "btn-tool btn-tool-compact",
                    onClick: _ctx.runHealthCheck,
                    disabled: _ctx.loading || !!_ctx.initError || _ctx.healthCheckLoading
                  }, _toDisplayString(_ctx.healthCheckLoading ? _ctx.t('dashboard.doctor.checking') : _ctx.t('dashboard.doctor.runChecks')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                ])
              ]),
              _createElementVNode("div", { class: "doctor-grid" }, [
                _createElementVNode("button", {
                  type: "button",
                  class: "doctor-card",
                  onClick: $event => (_ctx.switchMainTab('config')),
                  disabled: _ctx.loading || !!_ctx.initError
                }, [
                  _createElementVNode("div", { class: "doctor-card-title" }, _toDisplayString(_ctx.t('dashboard.card.config')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "doctor-card-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.inspectorConfigModeLabel), 1 /* TEXT */),
                    _createElementVNode("span", null, "·"),
                    _createElementVNode("span", null, _toDisplayString(_ctx.inspectorCurrentConfigLabel), 1 /* TEXT */)
                  ]),
                  _createElementVNode("div", { class: "doctor-card-kv" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.kv.model')), 1 /* TEXT */),
                    _createElementVNode("span", null, _toDisplayString(_ctx.inspectorCurrentModelLabel), 1 /* TEXT */)
                  ])
                ], 8 /* PROPS */, ["onClick", "disabled"]),
                _createElementVNode("button", {
                  type: "button",
                  class: "doctor-card",
                  onClick: $event => (_ctx.switchMainTab('sessions')),
                  disabled: _ctx.loading || !!_ctx.initError
                }, [
                  _createElementVNode("div", { class: "doctor-card-title" }, _toDisplayString(_ctx.t('dashboard.card.sessions')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "doctor-card-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.sessionsLoading ? _ctx.t('dashboard.state.loading') : (_ctx.sessionsLoadedOnce ? _ctx.t('dashboard.state.ready') : _ctx.t('dashboard.state.idle'))), 1 /* TEXT */),
                    _createElementVNode("span", null, "·"),
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.sessions.count', { count: _ctx.sessionsList.length })), 1 /* TEXT */)
                  ]),
                  (_ctx.activeSessionDetailError)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "doctor-card-kv"
                      }, [
                        _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.kv.issue')), 1 /* TEXT */),
                        _createElementVNode("span", { class: "doctor-kv-error" }, _toDisplayString(_ctx.activeSessionDetailError), 1 /* TEXT */)
                      ]))
                    : (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "doctor-card-kv"
                      }, [
                        _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.kv.active')), 1 /* TEXT */),
                        _createElementVNode("span", null, _toDisplayString(_ctx.activeSession ? (_ctx.activeSession.title || _ctx.activeSession.sessionId) : _ctx.t('dashboard.none')), 1 /* TEXT */)
                      ]))
                ], 8 /* PROPS */, ["onClick", "disabled"]),
                _createElementVNode("button", {
                  type: "button",
                  class: "doctor-card",
                  onClick: $event => (_ctx.switchMainTab('usage')),
                  disabled: _ctx.loading || !!_ctx.initError
                }, [
                  _createElementVNode("div", { class: "doctor-card-title" }, _toDisplayString(_ctx.t('dashboard.card.usage')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "doctor-card-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.sessionsUsageLoading ? _ctx.t('dashboard.state.loading') : (_ctx.sessionsUsageLoadedOnce ? _ctx.t('dashboard.state.ready') : _ctx.t('dashboard.state.idle'))), 1 /* TEXT */),
                    _createElementVNode("span", null, "·"),
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.usage.range', { value: (_ctx.sessionsUsageTimeRange === 'all' ? _ctx.t('usage.range.all') : (_ctx.sessionsUsageTimeRange === '30d' ? _ctx.t('usage.range.30d.short') : _ctx.t('usage.range.7d.short'))) })), 1 /* TEXT */)
                  ]),
                  (_ctx.sessionsUsageError)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "doctor-card-kv"
                      }, [
                        _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.kv.issue')), 1 /* TEXT */),
                        _createElementVNode("span", { class: "doctor-kv-error" }, _toDisplayString(_ctx.sessionsUsageError), 1 /* TEXT */)
                      ]))
                    : (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "doctor-card-kv"
                      }, [
                        _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.kv.sessions')), 1 /* TEXT */),
                        _createElementVNode("span", null, _toDisplayString(_ctx.sessionUsageSummaryCards[0] ? _ctx.sessionUsageSummaryCards[0].value : 0), 1 /* TEXT */)
                      ])),
                  (_ctx.sessionsUsageLoadedOnce
                                        && _ctx.sessionsUsageList.filter(session => !(session && typeof session.model === 'string' && session.model.trim())).length)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 2,
                        class: "doctor-card-kv"
                      }, [
                        _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.kv.missingModel')), 1 /* TEXT */),
                        _createElementVNode("span", null, _toDisplayString(_ctx.sessionsUsageList.filter(session => !(session && typeof session.model === 'string' && session.model.trim())).length), 1 /* TEXT */)
                      ]))
                    : _createCommentVNode("v-if", true)
                ], 8 /* PROPS */, ["onClick", "disabled"]),
                (_ctx.taskOrchestrationTabEnabled)
                  ? (_openBlock(), _createElementBlock("button", {
                      key: 0,
                      type: "button",
                      class: "doctor-card",
                      onClick: $event => (_ctx.switchMainTab('orchestration')),
                      disabled: _ctx.loading || !!_ctx.initError
                    }, [
                      _createElementVNode("div", { class: "doctor-card-title" }, _toDisplayString(_ctx.t('dashboard.card.tasks')), 1 /* TEXT */),
                      _createElementVNode("div", { class: "doctor-card-meta" }, [
                        _createElementVNode("span", null, _toDisplayString(_ctx.taskOrchestration && _ctx.taskOrchestration.loading ? _ctx.t('dashboard.state.loading') : _ctx.t('dashboard.state.ready')), 1 /* TEXT */),
                        _createElementVNode("span", null, "·"),
                        _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.tasks.queue', { running: _ctx.taskOrchestrationQueueStats.running, queued: _ctx.taskOrchestrationQueueStats.queued })), 1 /* TEXT */)
                      ]),
                      (_ctx.taskOrchestration && _ctx.taskOrchestration.planIssues && _ctx.taskOrchestration.planIssues.length)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 0,
                            class: "doctor-card-kv"
                          }, [
                            _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.kv.blockers')), 1 /* TEXT */),
                            _createElementVNode("span", null, _toDisplayString(_ctx.taskOrchestration.planIssues.length), 1 /* TEXT */)
                          ]))
                        : (_openBlock(), _createElementBlock("div", {
                            key: 1,
                            class: "doctor-card-kv"
                          }, [
                            _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.kv.runs')), 1 /* TEXT */),
                            _createElementVNode("span", null, _toDisplayString(_ctx.taskOrchestration && _ctx.taskOrchestration.runs ? _ctx.taskOrchestration.runs.length : 0), 1 /* TEXT */)
                          ]))
                    ], 8 /* PROPS */, ["onClick", "disabled"]))
                  : _createCommentVNode("v-if", true),
                _createElementVNode("button", {
                  type: "button",
                  class: "doctor-card",
                  onClick: $event => (_ctx.switchMainTab('market')),
                  disabled: _ctx.loading || !!_ctx.initError
                }, [
                  _createElementVNode("div", { class: "doctor-card-title" }, _toDisplayString(_ctx.t('dashboard.card.skills')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "doctor-card-meta" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.skillsMarketBusy ? _ctx.t('dashboard.state.loading') : _ctx.t('dashboard.state.ready')), 1 /* TEXT */),
                    _createElementVNode("span", null, "·"),
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.skills.count', { installed: _ctx.skillsList.length, importable: _ctx.skillsImportList.length })), 1 /* TEXT */)
                  ]),
                  _createElementVNode("div", { class: "doctor-card-kv" }, [
                    _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.kv.target')), 1 /* TEXT */),
                    _createElementVNode("span", null, _toDisplayString(_ctx.skillsTargetLabel), 1 /* TEXT */)
                  ]),
                  (_ctx.skillsRootPath)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "doctor-card-kv"
                      }, [
                        _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.kv.root')), 1 /* TEXT */),
                        _createElementVNode("span", null, _toDisplayString(_ctx.skillsRootPath), 1 /* TEXT */)
                      ]))
                    : _createCommentVNode("v-if", true)
                ], 8 /* PROPS */, ["onClick", "disabled"])
              ]),
              _createElementVNode("div", { class: "doctor-status-row" }, [
                _createElementVNode("div", {
                  class: _normalizeClass(["doctor-status-chip", _ctx.inspectorHealthTone])
                }, [
                  _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.status.health')), 1 /* TEXT */),
                  _createElementVNode("strong", null, _toDisplayString(_ctx.inspectorHealthStatus), 1 /* TEXT */)
                ], 2 /* CLASS */),
                _createElementVNode("div", { class: "doctor-status-chip" }, [
                  _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.status.busy')), 1 /* TEXT */),
                  _createElementVNode("strong", null, _toDisplayString(_ctx.inspectorBusyStatus), 1 /* TEXT */)
                ]),
                _createElementVNode("div", { class: "doctor-status-chip" }, [
                  _createElementVNode("span", null, _toDisplayString(_ctx.t('dashboard.status.models')), 1 /* TEXT */),
                  _createElementVNode("strong", null, _toDisplayString(_ctx.inspectorModelLoadStatus), 1 /* TEXT */)
                ])
              ]),
              (_ctx.healthCheckResult)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: _normalizeClass(["doctor-health-result", _ctx.healthCheckResult.ok ? 'ok' : 'error'])
                  }, [
                    _createElementVNode("div", { class: "doctor-health-title" }, [
                      _createTextVNode(_toDisplayString(_ctx.healthCheckResult.ok ? _ctx.t('dashboard.health.ok') : _ctx.t('dashboard.health.fail')) + " ", 1 /* TEXT */),
                      (_ctx.healthCheckResult.issues && _ctx.healthCheckResult.issues.length)
                        ? (_openBlock(), _createElementBlock("span", { key: 0 }, "（" + _toDisplayString(_ctx.t('dashboard.health.issues', { count: _ctx.healthCheckResult.issues.length })) + "）", 1 /* TEXT */))
                        : _createCommentVNode("v-if", true)
                    ])
                  ], 2 /* CLASS */))
                : _createCommentVNode("v-if", true),
              (_ctx.healthCheckResult && _ctx.healthCheckResult.report && _ctx.healthCheckResult.report.issues && _ctx.healthCheckResult.report.issues.length)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "doctor-action-list"
                  }, [
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.healthCheckResult.report.issues, (issue) => {
                      return (_openBlock(), _createElementBlock("div", {
                        key: issue.id,
                        class: "doctor-action-card"
                      }, [
                        _createElementVNode("div", { class: "doctor-action-head" }, [
                          _createElementVNode("div", { class: "doctor-action-title" }, _toDisplayString(issue.problem || (issue.problemKey ? _ctx.t(issue.problemKey, issue.problemParams) : '')), 1 /* TEXT */),
                          _createElementVNode("div", {
                            class: _normalizeClass(['doctor-action-severity', issue.severity])
                          }, _toDisplayString(issue.severityLabel || issue.severity), 3 /* TEXT, CLASS */)
                        ]),
                        _createElementVNode("div", { class: "doctor-action-impact" }, _toDisplayString(issue.impact || (issue.impactKey ? _ctx.t(issue.impactKey, issue.impactParams) : '')), 1 /* TEXT */),
                        (issue.actions && issue.actions.length)
                          ? (_openBlock(), _createElementBlock("div", {
                              key: 0,
                              class: "doctor-action-buttons"
                            }, [
                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(issue.actions, (action, index) => {
                                return (_openBlock(), _createElementBlock(_Fragment, {
                                  key: issue.id + '-action-' + index
                                }, [
                                  (action.type === 'navigate')
                                    ? (_openBlock(), _createElementBlock("button", {
                                        key: 0,
                                        type: "button",
                                        class: "btn-tool btn-tool-compact",
                                        onClick: $event => (_ctx.switchMainTab(action.target))
                                      }, _toDisplayString(action.label || (action.labelKey ? _ctx.t(action.labelKey, action.labelParams) : _ctx.t('dashboard.doctor.open'))), 9 /* TEXT, PROPS */, ["onClick"]))
                                    : (action.type === 'run-check')
                                      ? (_openBlock(), _createElementBlock("button", {
                                          key: 1,
                                          type: "button",
                                          class: "btn-tool btn-tool-compact",
                                          onClick: $event => (_ctx.runHealthCheck({ doctor: true, forceRefresh: true })),
                                          disabled: _ctx.healthCheckLoading
                                        }, _toDisplayString(_ctx.t('dashboard.doctor.runChecks')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]))
                                      : (action.type === 'export')
                                        ? (_openBlock(), _createElementBlock("button", {
                                            key: 2,
                                            type: "button",
                                            class: "btn-tool btn-tool-compact",
                                            onClick: $event => {_ctx.healthCheckResult && _ctx.healthCheckResult.report
                                                ? (action.format === 'md'
                                                    ? _ctx.downloadTextFile('codexmate-doctor.md', String(_ctx.healthCheckResult.markdown || ''), 'text/markdown;charset=utf-8')
                                                    : _ctx.downloadTextFile('codexmate-doctor.json', JSON.stringify(_ctx.healthCheckResult.report, null, 2), 'application/json;charset=utf-8'))
                                                : null}
                                          }, _toDisplayString(action.format === 'md' ? _ctx.t('dashboard.doctor.export.md') : _ctx.t('dashboard.doctor.export.json')), 9 /* TEXT, PROPS */, ["onClick"]))
                                        : _createCommentVNode("v-if", true)
                                ], 64 /* STABLE_FRAGMENT */))
                              }), 128 /* KEYED_FRAGMENT */))
                            ]))
                          : _createCommentVNode("v-if", true)
                      ]))
                    }), 128 /* KEYED_FRAGMENT */)),
                    _createElementVNode("div", { class: "doctor-action-footer" }, [
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-tool btn-tool-compact",
                        onClick: $event => {_ctx.healthCheckResult && _ctx.healthCheckResult.report
                                        ? _ctx.downloadTextFile('codexmate-doctor.json', JSON.stringify(_ctx.healthCheckResult.report, null, 2), 'application/json;charset=utf-8')
                                        : null}
                      }, _toDisplayString(_ctx.t('dashboard.doctor.export.json')), 9 /* TEXT, PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-tool btn-tool-compact",
                        onClick: $event => {_ctx.healthCheckResult && _ctx.healthCheckResult.report
                                        ? _ctx.downloadTextFile('codexmate-doctor.md', String(_ctx.healthCheckResult.markdown || ''), 'text/markdown;charset=utf-8')
                                        : null}
                      }, _toDisplayString(_ctx.t('dashboard.doctor.export.md')), 9 /* TEXT, PROPS */, ["onClick"])
                    ])
                  ]))
                : _createCommentVNode("v-if", true)
            ])
          ], 512 /* NEED_PATCH */), [
            [_vShow, _ctx.mainTab === 'dashboard']
          ]),
          _createCommentVNode(" Codex 配置 "),
          _withDirectives(_createElementVNode("div", {
            class: "mode-content mode-cards",
            id: "panel-config-provider",
            role: "tabpanel",
            "aria-labelledby": _ctx.forceCompactLayout ? 'tab-config' : ('side-tab-config-' + _ctx.configMode)
          }, [
            (_ctx.forceCompactLayout && !_ctx.sessionStandalone)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "segmented-control"
                }, [
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['segment', { active: _ctx.configMode === 'codex' }]),
                    onClick: $event => (_ctx.switchConfigMode('codex'))
                  }, _toDisplayString(_ctx.t('tab.config.codex')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['segment', { active: _ctx.configMode === 'claude' }]),
                    onClick: $event => (_ctx.switchConfigMode('claude'))
                  }, _toDisplayString(_ctx.t('tab.config.claude')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['segment', { active: _ctx.configMode === 'openclaw' }]),
                    onClick: $event => (_ctx.switchConfigMode('openclaw'))
                  }, _toDisplayString(_ctx.t('tab.config.openclaw')), 11 /* TEXT, CLASS, PROPS */, ["onClick"])
                ]))
              : _createCommentVNode("v-if", true),
            (_ctx.isCodexConfigMode && _ctx.shouldShowCliInstallPlaceholder('codex'))
              ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "selector-section"
                }, [
                  _createElementVNode("div", { class: "empty-state" }, [
                    _createElementVNode("div", { class: "empty-state-title" }, _toDisplayString(_ctx.t('cli.missing.title', { name: 'Codex' })), 1 /* TEXT */),
                    _createElementVNode("div", { class: "empty-state-subtitle" }, _toDisplayString(_ctx.t('cli.missing.subtitle', { name: 'Codex' })), 1 /* TEXT */),
                    _createElementVNode("div", { class: "docs-command-row" }, [
                      _createElementVNode("div", {
                        class: "docs-command-box",
                        role: "group",
                        "aria-label": _ctx.t('cli.missing.commandAria', { name: 'Codex' })
                      }, [
                        _createElementVNode("code", { class: "install-command" }, _toDisplayString(_ctx.getInstallCommand('codex', 'install')), 1 /* TEXT */),
                        _createElementVNode("button", {
                          type: "button",
                          class: "btn-mini docs-copy-btn",
                          disabled: !_ctx.getInstallCommand('codex', 'install'),
                          onClick: $event => (_ctx.copyInstallCommand(_ctx.getInstallCommand('codex', 'install')))
                        }, _toDisplayString(_ctx.t('common.copy')), 9 /* TEXT, PROPS */, ["disabled", "onClick"])
                      ], 8 /* PROPS */, ["aria-label"])
                    ]),
                    _createElementVNode("button", {
                      type: "button",
                      class: "btn-tool btn-tool-compact",
                      onClick: $event => {_ctx.mainTab = 'docs'; _ctx.setInstallCommandAction('install')}
                    }, _toDisplayString(_ctx.t('cli.missing.openDocs')), 9 /* TEXT, PROPS */, ["onClick"])
                  ])
                ]))
              : (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                  (!_ctx.loading && !_ctx.initError)
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        class: "btn-add",
                        onClick: $event => (_ctx.showAddModal = true)
                      }, [
                        (_openBlock(), _createElementBlock("svg", {
                          class: "icon",
                          viewBox: "0 0 20 20",
                          fill: "none",
                          stroke: "currentColor",
                          "stroke-width": "2"
                        }, [
                          _createElementVNode("path", { d: "M10 4v12M4 10h12" })
                        ])),
                        _createTextVNode(" " + _toDisplayString(_ctx.t('config.addProvider')), 1 /* TEXT */)
                      ], 8 /* PROPS */, ["onClick"]))
                    : _createCommentVNode("v-if", true),
                  (_ctx.isCodexConfigMode && _ctx.codexProviderTemplates.length)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "selector-section"
                      }, [
                        _createElementVNode("div", { class: "selector-header" }, [
                          _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('config.providerTemplate.title')), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", {
                          class: "btn-group",
                          style: {"flex-wrap":"wrap","gap":"8px","margin-top":"0"}
                        }, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.codexProviderTemplates, (tpl) => {
                            return (_openBlock(), _createElementBlock("button", {
                              key: tpl.name,
                              type: "button",
                              class: "btn-mini",
                              onClick: $event => {_ctx.newProvider.name = tpl.name; _ctx.newProvider.url = tpl.url; _ctx.newProvider._suggestedModel = tpl.model || ''; _ctx.newProvider.useTransform = !!tpl.useTransform; _ctx.showAddModal = true}
                            }, _toDisplayString(tpl.label), 9 /* TEXT, PROPS */, ["onClick"]))
                          }), 128 /* KEYED_FRAGMENT */))
                        ])
                      ]))
                    : _createCommentVNode("v-if", true),
                  _createElementVNode("div", { class: "selector-section" }, [
                    _createElementVNode("div", { class: "selector-header" }, [
                      _createElementVNode("span", { class: "selector-title" }, "AGENTS.md")
                    ]),
                    _createElementVNode("button", {
                      class: "btn-tool",
                      onClick: _ctx.openAgentsEditor,
                      disabled: _ctx.loading || !!_ctx.initError || _ctx.agentsLoading
                    }, _toDisplayString(_ctx.agentsLoading ? _ctx.t('config.modelLoading') : _ctx.t('config.agents.open')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                  ]),
                  _createElementVNode("div", { class: "selector-section" }, [
                    _createElementVNode("div", { class: "selector-header" }, [
                      _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('config.models')), 1 /* TEXT */),
                      _createElementVNode("div", { class: "selector-actions" }, [
                        (_ctx.modelsSource === 'legacy')
                          ? (_openBlock(), _createElementBlock("button", {
                              key: 0,
                              class: "btn-icon",
                              onClick: $event => (_ctx.showModelModal = true),
                              "aria-label": _ctx.t('modal.modelAdd.title'),
                              title: _ctx.t('modal.modelAdd.title')
                            }, "+", 8 /* PROPS */, ["onClick", "aria-label", "title"]))
                          : _createCommentVNode("v-if", true),
                        (_ctx.modelsSource === 'legacy')
                          ? (_openBlock(), _createElementBlock("button", {
                              key: 1,
                              class: "btn-icon",
                              onClick: $event => (_ctx.showModelListModal = true),
                              "aria-label": _ctx.t('modal.modelManage.title'),
                              title: _ctx.t('modal.modelManage.title')
                            }, "≡", 8 /* PROPS */, ["onClick", "aria-label", "title"]))
                          : _createCommentVNode("v-if", true)
                      ])
                    ]),
                    (_ctx.codexModelsLoading || _ctx.modelsSource === 'remote')
                      ? _withDirectives((_openBlock(), _createElementBlock("select", {
                          key: 0,
                          class: "model-select",
                          "onUpdate:modelValue": $event => ((_ctx.currentModel) = $event),
                          onChange: _ctx.onModelChange,
                          disabled: _ctx.codexModelsLoading
                        }, [
                          (_ctx.codexModelsLoading)
                            ? (_openBlock(), _createElementBlock("option", {
                                key: 0,
                                value: ""
                              }, _toDisplayString(_ctx.t('config.modelLoading')), 1 /* TEXT */))
                            : (_openBlock(true), _createElementBlock(_Fragment, { key: 1 }, _renderList(_ctx.codexModelOptions, (model) => {
                                return (_openBlock(), _createElementBlock("option", {
                                  key: model,
                                  value: model
                                }, _toDisplayString(model), 9 /* TEXT, PROPS */, ["value"]))
                              }), 128 /* KEYED_FRAGMENT */))
                        ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange", "disabled"])), [
                          [_vModelSelect, _ctx.currentModel]
                        ])
                      : _createCommentVNode("v-if", true),
                    (!_ctx.codexModelsLoading && (_ctx.modelsSource !== 'remote' || !_ctx.modelsHasCurrent))
                      ? _withDirectives((_openBlock(), _createElementBlock("input", {
                          key: 1,
                          class: "model-input",
                          "onUpdate:modelValue": $event => ((_ctx.currentModel) = $event),
                          onBlur: _ctx.onModelChange,
                          onKeyup: _withKeys(_ctx.onModelChange, ["enter"]),
                          placeholder: _ctx.activeProviderModelPlaceholder,
                          list: _ctx.codexModelHasList ? 'codex-model-options' : null
                        }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onBlur", "onKeyup", "placeholder", "list"])), [
                          [_vModelText, _ctx.currentModel]
                        ])
                      : _createCommentVNode("v-if", true),
                    (_ctx.codexModelHasList)
                      ? (_openBlock(), _createElementBlock("datalist", {
                          key: 2,
                          id: "codex-model-options"
                        }, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.codexModelOptions, (model) => {
                            return (_openBlock(), _createElementBlock("option", {
                              key: model,
                              value: model
                            }, null, 8 /* PROPS */, ["value"]))
                          }), 128 /* KEYED_FRAGMENT */))
                        ]))
                      : _createCommentVNode("v-if", true),
                    (_ctx.modelsSource === 'unlimited')
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 3,
                          class: "config-template-hint"
                        }, _toDisplayString(_ctx.t('config.models.unlimited')), 1 /* TEXT */))
                      : _createCommentVNode("v-if", true),
                    (_ctx.modelsSource === 'error')
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 4,
                          class: "config-template-hint"
                        }, _toDisplayString(_ctx.t('config.models.error')), 1 /* TEXT */))
                      : _createCommentVNode("v-if", true),
                    (_ctx.modelsSource === 'remote' && !_ctx.modelsHasCurrent)
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 5,
                          class: "config-template-hint"
                        }, _toDisplayString(_ctx.isCodexConfigMode ? _ctx.t('config.models.notInList.codex') : _ctx.t('config.models.notInList.other')), 1 /* TEXT */))
                      : _createCommentVNode("v-if", true),
                    (_ctx.isCodexConfigMode)
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 6,
                          class: "config-template-hint"
                        }, _toDisplayString(_ctx.t('config.template.editFirst')), 1 /* TEXT */))
                      : (_ctx.activeProviderBridgeHint)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 7,
                            class: "config-template-hint"
                          }, _toDisplayString(_ctx.t('config.template.bridgeCodexOnly', { hint: _ctx.activeProviderBridgeHint })), 1 /* TEXT */))
                        : _createCommentVNode("v-if", true),
                    (_ctx.isCodexConfigMode)
                      ? (_openBlock(), _createElementBlock("button", {
                          key: 8,
                          class: "btn-tool btn-template-editor",
                          onClick: _ctx.openConfigTemplateEditor,
                          disabled: _ctx.loading || !!_ctx.initError
                        }, _toDisplayString(_ctx.t('config.template.openEditor')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]))
                      : _createCommentVNode("v-if", true)
                  ]),
                  (_ctx.isCodexConfigMode)
                    ? (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                        _createElementVNode("div", { class: "config-row" }, [
                          _createElementVNode("div", {
                            class: "selector-section",
                            style: {"flex":"1"}
                          }, [
                            _createElementVNode("div", { class: "selector-header" }, [
                              _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('config.serviceTier')), 1 /* TEXT */)
                            ]),
                            _withDirectives(_createElementVNode("select", {
                              class: "model-select",
                              "onUpdate:modelValue": $event => ((_ctx.serviceTier) = $event),
                              onChange: _ctx.onServiceTierChange
                            }, [
                              _createElementVNode("option", { value: "fast" }, _toDisplayString(_ctx.t('config.serviceTier.fast')), 1 /* TEXT */),
                              _createElementVNode("option", { value: "standard" }, _toDisplayString(_ctx.t('config.serviceTier.standard')), 1 /* TEXT */)
                            ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                              [_vModelSelect, _ctx.serviceTier]
                            ]),
                            _createElementVNode("div", { class: "config-template-hint" }, _toDisplayString(_ctx.t('config.serviceTier.hint', { field: 'service_tier' })), 1 /* TEXT */)
                          ]),
                          _createElementVNode("div", {
                            class: "selector-section",
                            style: {"flex":"1"}
                          }, [
                            _createElementVNode("div", { class: "selector-header" }, [
                              _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('config.reasoningEffort')), 1 /* TEXT */)
                            ]),
                            _withDirectives(_createElementVNode("select", {
                              class: "model-select",
                              "onUpdate:modelValue": $event => ((_ctx.modelReasoningEffort) = $event),
                              onChange: _ctx.onReasoningEffortChange
                            }, [
                              _createElementVNode("option", { value: "high" }, "high"),
                              _createElementVNode("option", { value: "medium" }, _toDisplayString(_ctx.t('config.reasoningEffort.medium')), 1 /* TEXT */),
                              _createElementVNode("option", { value: "low" }, "low"),
                              _createElementVNode("option", { value: "xhigh" }, "xhigh")
                            ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange"]), [
                              [_vModelSelect, _ctx.modelReasoningEffort]
                            ]),
                            _createElementVNode("div", { class: "config-template-hint" }, _toDisplayString(_ctx.t('config.reasoningEffort.hint')), 1 /* TEXT */)
                          ])
                        ]),
                        _createElementVNode("div", { class: "selector-section" }, [
                          _createElementVNode("div", { class: "selector-header" }, [
                            _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('config.contextBudget')), 1 /* TEXT */),
                            _createElementVNode("div", { class: "selector-actions" }, [
                              _createElementVNode("button", {
                                class: "btn-tool btn-tool-compact",
                                onClick: _ctx.resetCodexContextBudgetDefaults,
                                disabled: _ctx.loading || !!_ctx.initError || _ctx.codexApplying
                              }, _toDisplayString(_ctx.t('config.reset')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                            ])
                          ]),
                          _createElementVNode("div", { class: "codex-config-grid" }, [
                            _createElementVNode("div", { class: "form-group codex-config-field" }, [
                              _createElementVNode("label", {
                                class: "form-label",
                                for: "codex-model-context-window"
                              }, "model_context_window"),
                              _withDirectives(_createElementVNode("input", {
                                id: "codex-model-context-window",
                                "onUpdate:modelValue": $event => ((_ctx.modelContextWindowInput) = $event),
                                class: "form-input",
                                inputmode: "numeric",
                                autocomplete: "off",
                                placeholder: _ctx.t('config.example', { value: 190000 }),
                                onFocus: $event => (_ctx.editingCodexBudgetField = 'modelContextWindowInput'),
                                onInput: $event => (_ctx.sanitizePositiveIntegerDraft('modelContextWindowInput')),
                                onBlur: _ctx.onModelContextWindowBlur,
                                onKeydown: _withKeys(_withModifiers(_ctx.onModelContextWindowBlur, ["prevent"]), ["enter"])
                              }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "placeholder", "onFocus", "onInput", "onBlur", "onKeydown"]), [
                                [_vModelText, _ctx.modelContextWindowInput]
                              ]),
                              _createElementVNode("div", { class: "form-hint" }, _toDisplayString(_ctx.t('config.contextWindow.hint')), 1 /* TEXT */)
                            ]),
                            _createElementVNode("div", { class: "form-group codex-config-field" }, [
                              _createElementVNode("label", {
                                class: "form-label",
                                for: "codex-model-auto-compact-token-limit"
                              }, "model_auto_compact_token_limit"),
                              _withDirectives(_createElementVNode("input", {
                                id: "codex-model-auto-compact-token-limit",
                                "onUpdate:modelValue": $event => ((_ctx.modelAutoCompactTokenLimitInput) = $event),
                                class: "form-input",
                                inputmode: "numeric",
                                autocomplete: "off",
                                placeholder: _ctx.t('config.example', { value: 185000 }),
                                onFocus: $event => (_ctx.editingCodexBudgetField = 'modelAutoCompactTokenLimitInput'),
                                onInput: $event => (_ctx.sanitizePositiveIntegerDraft('modelAutoCompactTokenLimitInput')),
                                onBlur: _ctx.onModelAutoCompactTokenLimitBlur,
                                onKeydown: _withKeys(_withModifiers(_ctx.onModelAutoCompactTokenLimitBlur, ["prevent"]), ["enter"])
                              }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "placeholder", "onFocus", "onInput", "onBlur", "onKeydown"]), [
                                [_vModelText, _ctx.modelAutoCompactTokenLimitInput]
                              ]),
                              _createElementVNode("div", { class: "form-hint" }, _toDisplayString(_ctx.t('config.autoCompact.hint')), 1 /* TEXT */)
                            ])
                          ])
                        ]),
                        _createElementVNode("div", { class: "selector-section" }, [
                          _createElementVNode("div", { class: "selector-header" }, [
                            _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('config.health.title')), 1 /* TEXT */)
                          ]),
                          _createElementVNode("button", {
                            class: "btn-tool",
                            onClick: _ctx.runHealthCheck,
                            disabled: _ctx.healthCheckLoading || _ctx.loading || !!_ctx.initError
                          }, _toDisplayString(_ctx.healthCheckLoading ? _ctx.t('config.health.running') : _ctx.t('config.health.run')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                          _createElementVNode("div", { class: "config-template-hint" }, _toDisplayString(_ctx.t('config.health.hint')), 1 /* TEXT */)
                        ])
                      ], 64 /* STABLE_FRAGMENT */))
                    : _createCommentVNode("v-if", true),
                  (!_ctx.loading && !_ctx.initError)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 3,
                        class: "card-list"
                      }, [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.displayProvidersList, (provider) => {
                          return (_openBlock(), _createElementBlock("div", {
                            key: provider.name,
                            class: _normalizeClass(['card', { active: _ctx.displayCurrentProvider === provider.name, disabled: provider.name === 'local' && _ctx.isLocalProviderDisabled }]),
                            onClick: $event => ((provider.name === 'local' && _ctx.isLocalProviderDisabled) ? null : _ctx.switchProvider(provider.name)),
                            onKeydown: [
                              _withKeys(_withModifiers($event => ((provider.name === 'local' && _ctx.isLocalProviderDisabled) ? null : _ctx.switchProvider(provider.name)), ["self","prevent"]), ["enter"]),
                              _withKeys(_withModifiers($event => ((provider.name === 'local' && _ctx.isLocalProviderDisabled) ? null : _ctx.switchProvider(provider.name)), ["self","prevent"]), ["space"])
                            ],
                            tabindex: provider.name === 'local' && _ctx.isLocalProviderDisabled ? -1 : 0,
                            role: "button",
                            "aria-current": _ctx.displayCurrentProvider === provider.name ? 'true' : null
                          }, [
                            _createElementVNode("div", { class: "card-leading" }, [
                              _createElementVNode("div", { class: "card-icon" }, [
                                _createTextVNode(_toDisplayString(provider.name.charAt(0).toUpperCase()), 1 /* TEXT */),
                                (_ctx.isTransformProvider(provider))
                                  ? (_openBlock(), _createElementBlock("span", {
                                      key: 0,
                                      class: "card-icon-dot",
                                      title: "通过内建转换适配"
                                    }))
                                  : _createCommentVNode("v-if", true)
                              ]),
                              _createElementVNode("div", { class: "card-content" }, [
                                (provider.name === 'local')
                                  ? (_openBlock(), _createElementBlock("div", {
                                      key: 0,
                                      class: "bridge-pool-summary"
                                    }, [
                                      (_openBlock(), _createElementBlock("svg", {
                                        class: "bridge-pool-summary-icon",
                                        viewBox: "0 0 24 24",
                                        fill: "none",
                                        stroke: "currentColor",
                                        "stroke-width": "2",
                                        width: "12",
                                        height: "12"
                                      }, [
                                        _createElementVNode("circle", {
                                          cx: "6",
                                          cy: "6",
                                          r: "2"
                                        }),
                                        _createElementVNode("circle", {
                                          cx: "18",
                                          cy: "6",
                                          r: "2"
                                        }),
                                        _createElementVNode("circle", {
                                          cx: "12",
                                          cy: "18",
                                          r: "2"
                                        }),
                                        _createElementVNode("path", { d: "M6 8v4h6v4" }),
                                        _createElementVNode("path", { d: "M18 8v4h-6v4" })
                                      ])),
                                      _createElementVNode("span", { class: "bridge-pool-summary-text" }, "已启用 " + _toDisplayString(_ctx.localBridgeCandidateProviders().filter(cp => !_ctx.isLocalBridgeExcluded(cp.name)).length) + " / " + _toDisplayString(_ctx.localBridgeCandidateProviders().length), 1 /* TEXT */)
                                    ]))
                                  : _createCommentVNode("v-if", true),
                                _createElementVNode("div", { class: "card-title" }, [
                                  _createElementVNode("span", null, _toDisplayString(provider.name), 1 /* TEXT */),
                                  (provider.readOnly)
                                    ? (_openBlock(), _createElementBlock("span", {
                                        key: 0,
                                        class: "provider-readonly-badge"
                                      }, _toDisplayString(_ctx.t('config.badge.system')), 1 /* TEXT */))
                                    : _createCommentVNode("v-if", true)
                                ]),
                                (provider.name !== 'local')
                                  ? (_openBlock(), _createElementBlock("div", {
                                      key: 1,
                                      class: "card-subtitle card-subtitle-model"
                                    }, _toDisplayString(_ctx.activeProviderModel(provider.name) || _ctx.t('config.model.unset')), 1 /* TEXT */))
                                  : _createCommentVNode("v-if", true),
                                (provider.name !== 'local')
                                  ? (_openBlock(), _createElementBlock("div", {
                                      key: 2,
                                      class: "card-subtitle card-subtitle-url"
                                    }, _toDisplayString(_ctx.displayProviderUrl(provider) || _ctx.t('config.url.unset')), 1 /* TEXT */))
                                  : _createCommentVNode("v-if", true)
                              ])
                            ]),
                            _createElementVNode("div", { class: "card-trailing" }, [
                              (_ctx.speedResults[provider.name])
                                ? (_openBlock(), _createElementBlock("span", {
                                    key: 0,
                                    class: _normalizeClass(['latency', _ctx.speedResults[provider.name].ok ? 'ok' : 'error'])
                                  }, _toDisplayString(_ctx.formatLatency(_ctx.speedResults[provider.name])), 3 /* TEXT, CLASS */))
                                : _createCommentVNode("v-if", true),
                              _createElementVNode("span", {
                                class: _normalizeClass(['pill', _ctx.providerPillConfigured(provider) ? 'configured' : 'empty'])
                              }, _toDisplayString(_ctx.providerPillText(provider)), 3 /* TEXT, CLASS */),
                              _createElementVNode("div", {
                                class: "card-actions",
                                onClick: _withModifiers(() => {}, ["stop"])
                              }, [
                                (provider.name === 'local')
                                  ? (_openBlock(), _createElementBlock("button", {
                                      key: 0,
                                      class: "card-action-btn bridge-pool-trigger",
                                      onClick: $event => (_ctx.showCodexBridgePoolModal = true),
                                      "aria-label": '轮询池设置',
                                      title: '轮询池设置'
                                    }, [
                                      (_openBlock(), _createElementBlock("svg", {
                                        viewBox: "0 0 24 24",
                                        fill: "none",
                                        stroke: "currentColor",
                                        "stroke-width": "2"
                                      }, [
                                        _createElementVNode("circle", {
                                          cx: "6",
                                          cy: "6",
                                          r: "2"
                                        }),
                                        _createElementVNode("circle", {
                                          cx: "18",
                                          cy: "6",
                                          r: "2"
                                        }),
                                        _createElementVNode("circle", {
                                          cx: "12",
                                          cy: "18",
                                          r: "2"
                                        }),
                                        _createElementVNode("path", { d: "M6 8v4h6v4" }),
                                        _createElementVNode("path", { d: "M18 8v4h-6v4" })
                                      ]))
                                    ], 8 /* PROPS */, ["onClick"]))
                                  : _createCommentVNode("v-if", true),
                                _createElementVNode("button", {
                                  class: _normalizeClass(["card-action-btn", { loading: _ctx.speedLoading[provider.name] }]),
                                  disabled: !!_ctx.speedLoading[provider.name],
                                  onClick: $event => (_ctx.runSpeedTest(provider.name, { silent: true })),
                                  "aria-label": _ctx.t('config.availabilityTestAria', { name: provider.name }),
                                  title: _ctx.t('config.availabilityTest')
                                }, [
                                  (_openBlock(), _createElementBlock("svg", {
                                    viewBox: "0 0 24 24",
                                    fill: "none",
                                    stroke: "currentColor",
                                    "stroke-width": "2"
                                  }, [
                                    _createElementVNode("path", { d: "M13 2L3 14h9l-1 8 10-12h-9l1-8z" })
                                  ]))
                                ], 10 /* CLASS, PROPS */, ["disabled", "onClick", "aria-label", "title"]),
                                _createElementVNode("button", {
                                  class: "card-action-btn",
                                  disabled: !_ctx.shouldShowProviderEdit(provider),
                                  onClick: $event => (_ctx.openEditModal(provider)),
                                  "aria-label": _ctx.t('config.provider.edit.aria', { name: provider.name }),
                                  title: _ctx.shouldShowProviderEdit(provider) ? _ctx.t('common.edit') : _ctx.t('common.notEditable')
                                }, [
                                  (_openBlock(), _createElementBlock("svg", {
                                    viewBox: "0 0 24 24",
                                    fill: "none",
                                    stroke: "currentColor",
                                    "stroke-width": "2"
                                  }, [
                                    _createElementVNode("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
                                    _createElementVNode("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })
                                  ]))
                                ], 8 /* PROPS */, ["disabled", "onClick", "aria-label", "title"]),
                                (!provider.readOnly)
                                  ? (_openBlock(), _createElementBlock("button", {
                                      key: 1,
                                      class: "card-action-btn",
                                      onClick: $event => (_ctx.openCloneProviderModal(provider)),
                                      "aria-label": _ctx.t('config.provider.clone.aria', { name: provider.name }),
                                      title: _ctx.t('config.provider.clone')
                                    }, [
                                      (_openBlock(), _createElementBlock("svg", {
                                        viewBox: "0 0 24 24",
                                        fill: "none",
                                        stroke: "currentColor",
                                        "stroke-width": "2"
                                      }, [
                                        _createElementVNode("rect", {
                                          x: "9",
                                          y: "9",
                                          width: "13",
                                          height: "13",
                                          rx: "2"
                                        }),
                                        _createElementVNode("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
                                      ]))
                                    ], 8 /* PROPS */, ["onClick", "aria-label", "title"]))
                                  : _createCommentVNode("v-if", true),
                                (!provider.readOnly)
                                  ? (_openBlock(), _createElementBlock("button", {
                                      key: 2,
                                      class: _normalizeClass(["card-action-btn", { loading: _ctx.providerShareLoading[provider.name], disabled: !_ctx.shouldAllowProviderShare(provider) }]),
                                      disabled: _ctx.providerShareLoading[provider.name] || !_ctx.shouldAllowProviderShare(provider),
                                      onClick: $event => (_ctx.copyProviderShareCommand(provider)),
                                      title: _ctx.shouldAllowProviderShare(provider) ? _ctx.t('config.shareCommand') : _ctx.t('config.shareDisabled'),
                                      "aria-label": _ctx.t('config.shareCommand.aria')
                                    }, [
                                      (_openBlock(), _createElementBlock("svg", {
                                        viewBox: "0 0 24 24",
                                        fill: "none",
                                        stroke: "currentColor",
                                        "stroke-width": "2"
                                      }, [
                                        _createElementVNode("path", { d: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" }),
                                        _createElementVNode("path", { d: "M16 6l-4-4-4 4" }),
                                        _createElementVNode("path", { d: "M12 2v14" })
                                      ]))
                                    ], 10 /* CLASS, PROPS */, ["disabled", "onClick", "title", "aria-label"]))
                                  : _createCommentVNode("v-if", true),
                                (!provider.readOnly)
                                  ? (_openBlock(), _createElementBlock("button", {
                                      key: 3,
                                      class: _normalizeClass(["card-action-btn delete", { disabled: !_ctx.shouldShowProviderDelete(provider) }]),
                                      disabled: !_ctx.shouldShowProviderDelete(provider),
                                      onClick: $event => (_ctx.deleteProvider(provider.name)),
                                      "aria-label": _ctx.t('config.provider.delete.aria', { name: provider.name }),
                                      title: _ctx.shouldShowProviderDelete(provider) ? _ctx.t('common.delete') : _ctx.t('common.notDeletable')
                                    }, [
                                      (_openBlock(), _createElementBlock("svg", {
                                        viewBox: "0 0 24 24",
                                        fill: "none",
                                        stroke: "currentColor",
                                        "stroke-width": "2"
                                      }, [
                                        _createElementVNode("path", { d: "M3 6h18" }),
                                        _createElementVNode("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })
                                      ]))
                                    ], 10 /* CLASS, PROPS */, ["disabled", "onClick", "aria-label", "title"]))
                                  : _createCommentVNode("v-if", true)
                              ], 8 /* PROPS */, ["onClick"])
                            ])
                          ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["onClick", "onKeydown", "tabindex", "aria-current"]))
                        }), 128 /* KEYED_FRAGMENT */))
                      ]))
                    : _createCommentVNode("v-if", true)
                ], 64 /* STABLE_FRAGMENT */))
          ], 8 /* PROPS */, ["aria-labelledby"]), [
            [_vShow, _ctx.mainTab === 'config' && _ctx.isProviderConfigMode]
          ]),
          _createCommentVNode(" Claude Code 配置 "),
          _withDirectives(_createElementVNode("div", {
            class: "mode-content mode-cards",
            id: "panel-config-claude",
            role: "tabpanel",
            "aria-labelledby": _ctx.forceCompactLayout ? 'tab-config' : 'side-tab-config-claude'
          }, [
            (_ctx.forceCompactLayout && !_ctx.sessionStandalone)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "segmented-control"
                }, [
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['segment', { active: _ctx.configMode === 'codex' }]),
                    onClick: $event => (_ctx.switchConfigMode('codex'))
                  }, _toDisplayString(_ctx.t('tab.config.codex')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['segment', { active: _ctx.configMode === 'claude' }]),
                    onClick: $event => (_ctx.switchConfigMode('claude'))
                  }, _toDisplayString(_ctx.t('tab.config.claude')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['segment', { active: _ctx.configMode === 'openclaw' }]),
                    onClick: $event => (_ctx.switchConfigMode('openclaw'))
                  }, _toDisplayString(_ctx.t('tab.config.openclaw')), 11 /* TEXT, CLASS, PROPS */, ["onClick"])
                ]))
              : _createCommentVNode("v-if", true),
            (_ctx.shouldShowCliInstallPlaceholder('claude'))
              ? (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "selector-section"
                }, [
                  _createElementVNode("div", { class: "empty-state" }, [
                    _createElementVNode("div", { class: "empty-state-title" }, _toDisplayString(_ctx.t('cli.missing.title', { name: 'Claude' })), 1 /* TEXT */),
                    _createElementVNode("div", { class: "empty-state-subtitle" }, _toDisplayString(_ctx.t('cli.missing.subtitle', { name: 'Claude' })), 1 /* TEXT */),
                    _createElementVNode("div", { class: "docs-command-row" }, [
                      _createElementVNode("div", {
                        class: "docs-command-box",
                        role: "group",
                        "aria-label": _ctx.t('cli.missing.commandAria', { name: 'Claude' })
                      }, [
                        _createElementVNode("code", { class: "install-command" }, _toDisplayString(_ctx.getInstallCommand('claude', 'install')), 1 /* TEXT */),
                        _createElementVNode("button", {
                          type: "button",
                          class: "btn-mini docs-copy-btn",
                          disabled: !_ctx.getInstallCommand('claude', 'install'),
                          onClick: $event => (_ctx.copyInstallCommand(_ctx.getInstallCommand('claude', 'install')))
                        }, _toDisplayString(_ctx.t('common.copy')), 9 /* TEXT, PROPS */, ["disabled", "onClick"])
                      ], 8 /* PROPS */, ["aria-label"])
                    ]),
                    _createElementVNode("button", {
                      type: "button",
                      class: "btn-tool btn-tool-compact",
                      onClick: $event => {_ctx.mainTab = 'docs'; _ctx.setInstallCommandAction('install')}
                    }, _toDisplayString(_ctx.t('cli.missing.openDocs')), 9 /* TEXT, PROPS */, ["onClick"])
                  ])
                ]))
              : (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                  (!_ctx.loading && !_ctx.initError)
                    ? (_openBlock(), _createElementBlock("button", {
                        key: 0,
                        class: "btn-add",
                        onClick: _ctx.openClaudeConfigModal
                      }, [
                        (_openBlock(), _createElementBlock("svg", {
                          class: "icon",
                          viewBox: "0 0 20 20",
                          fill: "none",
                          stroke: "currentColor",
                          "stroke-width": "2"
                        }, [
                          _createElementVNode("path", { d: "M10 4v12M4 10h12" })
                        ])),
                        _createTextVNode(" " + _toDisplayString(_ctx.t('claude.addProvider')), 1 /* TEXT */)
                      ], 8 /* PROPS */, ["onClick"]))
                    : _createCommentVNode("v-if", true),
                  _createElementVNode("div", { class: "config-template-hint" }, _toDisplayString(_ctx.t('claude.applyDefault')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "selector-section" }, [
                    _createElementVNode("div", { class: "selector-header" }, [
                      _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('claude.presetProviders')), 1 /* TEXT */)
                    ]),
                    _createElementVNode("div", {
                      class: "btn-group",
                      style: {"flex-wrap":"wrap","gap":"8px","margin-top":"0"}
                    }, [
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'Claude Official'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://api.anthropic.com'; _ctx.newClaudeConfig.model = 'claude-sonnet-4'; _ctx.showClaudeConfigModal = true}
                      }, "Claude Official", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'DeepSeek'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://api.deepseek.com/anthropic'; _ctx.newClaudeConfig.model = 'DeepSeek-V3.2'; _ctx.showClaudeConfigModal = true}
                      }, "DeepSeek", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'Zhipu GLM'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://open.bigmodel.cn/api/anthropic'; _ctx.newClaudeConfig.model = 'glm-5'; _ctx.showClaudeConfigModal = true}
                      }, "Zhipu GLM", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'Z.ai GLM'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://api.z.ai/api/anthropic'; _ctx.newClaudeConfig.model = 'glm-5'; _ctx.showClaudeConfigModal = true}
                      }, "Z.ai GLM", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'Qwen Coder'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://coding.dashscope.aliyuncs.com/apps/anthropic'; _ctx.newClaudeConfig.model = 'qwen3-coder'; _ctx.showClaudeConfigModal = true}
                      }, "Qwen Coder", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'Kimi k2'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://api.moonshot.cn/anthropic'; _ctx.newClaudeConfig.model = 'kimi-k2.5'; _ctx.showClaudeConfigModal = true}
                      }, "Kimi k2", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'Kimi For Coding'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://api.kimi.com/coding/'; _ctx.newClaudeConfig.model = 'kimi-k2.5'; _ctx.showClaudeConfigModal = true}
                      }, "Kimi For Coding", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'KAT-Coder'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://vanchin.streamlake.ai/api/gateway/v1/endpoints/${ENDPOINT_ID}/claude-code-proxy'; _ctx.newClaudeConfig.model = 'KAT-Coder-Pro V1'; _ctx.showClaudeConfigModal = true}
                      }, "KAT-Coder", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'Longcat'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://api.longcat.chat/anthropic'; _ctx.newClaudeConfig.model = 'LongCat-Flash-Chat'; _ctx.showClaudeConfigModal = true}
                      }, "Longcat", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'MiniMax'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://api.minimaxi.com/anthropic'; _ctx.newClaudeConfig.model = 'MiniMax-M2.7'; _ctx.showClaudeConfigModal = true}
                      }, "MiniMax", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'MiniMax en'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://api.minimax.io/anthropic'; _ctx.newClaudeConfig.model = 'MiniMax-M2.7'; _ctx.showClaudeConfigModal = true}
                      }, "MiniMax en", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'DouBaoSeed'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://ark.cn-beijing.volces.com/api/coding'; _ctx.newClaudeConfig.model = 'doubao-seed-2-0-code-preview-latest'; _ctx.showClaudeConfigModal = true}
                      }, "DouBaoSeed", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'BaiLing'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://api.tbox.cn/api/anthropic'; _ctx.newClaudeConfig.model = 'Ling-2.5-1T'; _ctx.showClaudeConfigModal = true}
                      }, "BaiLing", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'ModelScope'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://api-inference.modelscope.cn'; _ctx.newClaudeConfig.model = 'ZhipuAI/GLM-5'; _ctx.showClaudeConfigModal = true}
                      }, "ModelScope", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'AiHubMix'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://aihubmix.com'; _ctx.newClaudeConfig.model = 'glm-4.7'; _ctx.showClaudeConfigModal = true}
                      }, "AiHubMix", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'DMXAPI'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://www.dmxapi.cn'; _ctx.newClaudeConfig.model = 'glm-4.7'; _ctx.showClaudeConfigModal = true}
                      }, "DMXAPI", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'PackyCode'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://www.packyapi.com'; _ctx.newClaudeConfig.model = 'glm-4.7'; _ctx.showClaudeConfigModal = true}
                      }, "PackyCode", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'AnyRouter'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://anyrouter.top'; _ctx.newClaudeConfig.model = 'claude-opus-4-7[1m]'; _ctx.showClaudeConfigModal = true}
                      }, "AnyRouter", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'Xiaomi MiMo'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://api.xiaomimimo.com/anthropic'; _ctx.newClaudeConfig.model = 'mimo-v2.5-pro'; _ctx.showClaudeConfigModal = true}
                      }, "Xiaomi MiMo", 8 /* PROPS */, ["onClick"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-mini",
                        onClick: $event => {_ctx.newClaudeConfig.name = 'Xiaomi Token Plan'; _ctx.newClaudeConfig.apiKey = ''; _ctx.newClaudeConfig.baseUrl = 'https://token-plan-cn.xiaomimimo.com/anthropic'; _ctx.newClaudeConfig.model = 'mimo-v2.5-pro'; _ctx.showClaudeConfigModal = true}
                      }, "Xiaomi Token Plan", 8 /* PROPS */, ["onClick"])
                    ])
                  ]),
                  _createElementVNode("div", { class: "selector-section" }, [
                    _createElementVNode("div", { class: "selector-header" }, [
                      _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('claude.model')), 1 /* TEXT */)
                    ]),
                    (_ctx.claudeModelHasList)
                      ? _withDirectives((_openBlock(), _createElementBlock("input", {
                          key: 0,
                          class: "model-input",
                          "onUpdate:modelValue": $event => ((_ctx.currentClaudeModel) = $event),
                          onChange: _ctx.onClaudeModelChange,
                          onBlur: _ctx.onClaudeModelChange,
                          onKeyup: _withKeys(_ctx.onClaudeModelChange, ["enter"]),
                          placeholder: _ctx.t('claude.model.placeholder'),
                          readonly: _ctx.currentClaudeConfig === 'claude-local',
                          list: "claude-model-options"
                        }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange", "onBlur", "onKeyup", "placeholder", "readonly"])), [
                          [_vModelText, _ctx.currentClaudeModel]
                        ])
                      : _createCommentVNode("v-if", true),
                    (_ctx.claudeModelHasList)
                      ? (_openBlock(), _createElementBlock("datalist", {
                          key: 1,
                          id: "claude-model-options"
                        }, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.claudeModelOptions, (model) => {
                            return (_openBlock(), _createElementBlock("option", {
                              key: model,
                              value: model
                            }, null, 8 /* PROPS */, ["value"]))
                          }), 128 /* KEYED_FRAGMENT */))
                        ]))
                      : _withDirectives((_openBlock(), _createElementBlock("input", {
                          key: 2,
                          class: "model-input",
                          "onUpdate:modelValue": $event => ((_ctx.currentClaudeModel) = $event),
                          onBlur: _ctx.onClaudeModelChange,
                          onKeyup: _withKeys(_ctx.onClaudeModelChange, ["enter"]),
                          placeholder: _ctx.t('claude.model.placeholder'),
                          readonly: _ctx.currentClaudeConfig === 'claude-local'
                        }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onBlur", "onKeyup", "placeholder", "readonly"])), [
                          [_vModelText, _ctx.currentClaudeModel]
                        ]),
                    _createElementVNode("div", { class: "config-template-hint" }, _toDisplayString(_ctx.t('claude.model.hint')), 1 /* TEXT */),
                    _createElementVNode("button", {
                      class: "btn-tool btn-template-editor",
                      onClick: _ctx.openClaudeConfigTemplateEditor,
                      disabled: _ctx.loading || !!_ctx.initError
                    }, _toDisplayString(_ctx.t('config.template.openEditor')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                  ]),
                  _createElementVNode("div", { class: "selector-section" }, [
                    _createElementVNode("div", { class: "selector-header" }, [
                      _createElementVNode("span", { class: "selector-title" }, "CLAUDE.md")
                    ]),
                    _createElementVNode("button", {
                      class: "btn-tool",
                      onClick: _ctx.openClaudeMdEditor,
                      disabled: _ctx.loading || !!_ctx.initError || _ctx.agentsLoading
                    }, _toDisplayString(_ctx.agentsLoading ? _ctx.t('config.modelLoading') : _ctx.t('claude.md.open')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                    _createElementVNode("div", { class: "config-template-hint" }, _toDisplayString(_ctx.t('claude.md.hint')), 1 /* TEXT */)
                  ]),
                  _createElementVNode("div", { class: "selector-section" }, [
                    _createElementVNode("div", { class: "selector-header" }, [
                      _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('config.health.title')), 1 /* TEXT */)
                    ]),
                    _createElementVNode("button", {
                      class: "btn-tool",
                      onClick: _ctx.runHealthCheck,
                      disabled: _ctx.healthCheckLoading || _ctx.loading || !!_ctx.initError
                    }, _toDisplayString(_ctx.healthCheckLoading ? _ctx.t('config.health.running') : _ctx.t('config.health.run')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                    _createElementVNode("div", { class: "config-template-hint" }, _toDisplayString(_ctx.t('config.health.hint')), 1 /* TEXT */)
                  ]),
                  _createElementVNode("div", { class: "card-list" }, [
                    _createElementVNode("div", {
                      class: _normalizeClass(['card', { active: _ctx.currentClaudeConfig === 'claude-local', disabled: _ctx.isClaudeLocalBridgeDisabled() }]),
                      onClick: $event => (_ctx.isClaudeLocalBridgeDisabled() ? null : _ctx.applyClaudeLocalBridge()),
                      onKeydown: [
                        _withKeys(_withModifiers($event => (_ctx.isClaudeLocalBridgeDisabled() ? null : _ctx.applyClaudeLocalBridge()), ["self","prevent"]), ["enter"]),
                        _withKeys(_withModifiers($event => (_ctx.isClaudeLocalBridgeDisabled() ? null : _ctx.applyClaudeLocalBridge()), ["self","prevent"]), ["space"])
                      ],
                      tabindex: _ctx.isClaudeLocalBridgeDisabled() ? -1 : 0,
                      role: "button",
                      "aria-current": _ctx.currentClaudeConfig === 'claude-local' ? 'true' : null
                    }, [
                      _createElementVNode("div", { class: "card-leading" }, [
                        _createElementVNode("div", { class: "card-icon" }, "L"),
                        _createElementVNode("div", { class: "card-content" }, [
                          _createElementVNode("div", { class: "bridge-pool-summary" }, [
                            (_openBlock(), _createElementBlock("svg", {
                              class: "bridge-pool-summary-icon",
                              viewBox: "0 0 24 24",
                              fill: "none",
                              stroke: "currentColor",
                              "stroke-width": "2",
                              width: "12",
                              height: "12"
                            }, [
                              _createElementVNode("circle", {
                                cx: "6",
                                cy: "6",
                                r: "2"
                              }),
                              _createElementVNode("circle", {
                                cx: "18",
                                cy: "6",
                                r: "2"
                              }),
                              _createElementVNode("circle", {
                                cx: "12",
                                cy: "18",
                                r: "2"
                              }),
                              _createElementVNode("path", { d: "M6 8v4h6v4" }),
                              _createElementVNode("path", { d: "M18 8v4h-6v4" })
                            ])),
                            _createElementVNode("span", { class: "bridge-pool-summary-text" }, _toDisplayString(_ctx.t('claude.localBridge.enabled')) + " " + _toDisplayString(_ctx.claudeLocalBridgeCandidateProviders().filter(cp => !_ctx.isClaudeLocalBridgeExcluded(cp.name)).length) + " / " + _toDisplayString(_ctx.claudeLocalBridgeCandidateProviders().length), 1 /* TEXT */)
                          ]),
                          _createElementVNode("div", { class: "card-title" }, [
                            _createElementVNode("span", null, "local"),
                            _createElementVNode("span", { class: "provider-readonly-badge" }, _toDisplayString(_ctx.t('config.badge.system')), 1 /* TEXT */)
                          ])
                        ])
                      ]),
                      _createElementVNode("div", { class: "card-trailing" }, [
                        _createElementVNode("span", {
                          class: _normalizeClass(['pill', _ctx.claudeLocalBridgeConfigured() ? 'configured' : 'empty'])
                        }, _toDisplayString(_ctx.claudeLocalBridgeConfigured() ? _ctx.t('claude.configured') : _ctx.t('claude.notConfigured')), 3 /* TEXT, CLASS */),
                        _createElementVNode("div", {
                          class: "card-actions",
                          onClick: _withModifiers(() => {}, ["stop"])
                        }, [
                          _createElementVNode("button", {
                            class: "card-action-btn bridge-pool-trigger",
                            onClick: $event => (_ctx.showClaudeBridgePoolModal = true),
                            "aria-label": _ctx.t('claude.localBridge.poolTitle'),
                            title: _ctx.t('claude.localBridge.poolTitle')
                          }, [
                            (_openBlock(), _createElementBlock("svg", {
                              viewBox: "0 0 24 24",
                              fill: "none",
                              stroke: "currentColor",
                              "stroke-width": "2"
                            }, [
                              _createElementVNode("circle", {
                                cx: "6",
                                cy: "6",
                                r: "2"
                              }),
                              _createElementVNode("circle", {
                                cx: "18",
                                cy: "6",
                                r: "2"
                              }),
                              _createElementVNode("circle", {
                                cx: "12",
                                cy: "18",
                                r: "2"
                              }),
                              _createElementVNode("path", { d: "M6 8v4h6v4" }),
                              _createElementVNode("path", { d: "M18 8v4h-6v4" })
                            ]))
                          ], 8 /* PROPS */, ["onClick", "aria-label", "title"])
                        ], 8 /* PROPS */, ["onClick"])
                      ])
                    ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["onClick", "onKeydown", "tabindex", "aria-current"]),
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.claudeConfigs, (config, name) => {
                      return (_openBlock(), _createElementBlock("div", {
                        key: name,
                        class: _normalizeClass(['card', { active: _ctx.currentClaudeConfig === name }]),
                        onClick: $event => (_ctx.applyClaudeConfig(name)),
                        onKeydown: [
                          _withKeys(_withModifiers($event => (_ctx.applyClaudeConfig(name)), ["self","prevent"]), ["enter"]),
                          _withKeys(_withModifiers($event => (_ctx.applyClaudeConfig(name)), ["self","prevent"]), ["space"])
                        ],
                        tabindex: "0",
                        role: "button",
                        "aria-current": _ctx.currentClaudeConfig === name ? 'true' : null
                      }, [
                        _createElementVNode("div", { class: "card-leading" }, [
                          _createElementVNode("div", { class: "card-icon" }, _toDisplayString(name.charAt(0).toUpperCase()), 1 /* TEXT */),
                          _createElementVNode("div", { class: "card-content" }, [
                            _createElementVNode("div", { class: "card-title" }, _toDisplayString(name), 1 /* TEXT */),
                            _createElementVNode("div", { class: "card-subtitle card-subtitle-model" }, _toDisplayString(config.model || _ctx.t('claude.model.unset')), 1 /* TEXT */),
                            (config.baseUrl)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  class: "card-subtitle card-subtitle-url"
                                }, _toDisplayString(config.baseUrl), 1 /* TEXT */))
                              : _createCommentVNode("v-if", true)
                          ])
                        ]),
                        _createElementVNode("div", { class: "card-trailing" }, [
                          (_ctx.claudeSpeedResults[name])
                            ? (_openBlock(), _createElementBlock("span", {
                                key: 0,
                                class: _normalizeClass(['latency', _ctx.claudeSpeedResults[name].ok ? 'ok' : 'error'])
                              }, _toDisplayString(_ctx.formatLatency(_ctx.claudeSpeedResults[name])), 3 /* TEXT, CLASS */))
                            : _createCommentVNode("v-if", true),
                          _createElementVNode("span", {
                            class: _normalizeClass(['pill', config.hasKey ? 'configured' : 'empty'])
                          }, _toDisplayString(config.hasKey ? _ctx.t('claude.configured') : _ctx.t('claude.notConfigured')), 3 /* TEXT, CLASS */),
                          _createElementVNode("div", {
                            class: "card-actions",
                            onClick: _withModifiers(() => {}, ["stop"])
                          }, [
                            _createElementVNode("button", {
                              class: "card-action-btn",
                              onClick: $event => (_ctx.openEditConfigModal(name)),
                              "aria-label": _ctx.t('claude.action.editAria', { name }),
                              title: _ctx.t('claude.action.edit')
                            }, [
                              (_openBlock(), _createElementBlock("svg", {
                                viewBox: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                "stroke-width": "2"
                              }, [
                                _createElementVNode("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
                                _createElementVNode("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })
                              ]))
                            ], 8 /* PROPS */, ["onClick", "aria-label", "title"]),
                            _createElementVNode("button", {
                              class: "card-action-btn",
                              onClick: $event => (_ctx.openCloneClaudeConfigModal(name, config)),
                              "aria-label": _ctx.t('claude.action.cloneAria', { name }),
                              title: _ctx.t('claude.action.clone')
                            }, [
                              (_openBlock(), _createElementBlock("svg", {
                                viewBox: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                "stroke-width": "2"
                              }, [
                                _createElementVNode("rect", {
                                  x: "9",
                                  y: "9",
                                  width: "13",
                                  height: "13",
                                  rx: "2"
                                }),
                                _createElementVNode("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
                              ]))
                            ], 8 /* PROPS */, ["onClick", "aria-label", "title"]),
                            _createElementVNode("button", {
                              class: _normalizeClass(["card-action-btn", { loading: _ctx.claudeShareLoading[name] }]),
                              onClick: $event => (_ctx.copyClaudeShareCommand(name)),
                              title: _ctx.t('config.shareCommand'),
                              "aria-label": _ctx.t('config.shareCommand.aria')
                            }, [
                              (_openBlock(), _createElementBlock("svg", {
                                viewBox: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                "stroke-width": "2"
                              }, [
                                _createElementVNode("path", { d: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" }),
                                _createElementVNode("path", { d: "M16 6l-4-4-4 4" }),
                                _createElementVNode("path", { d: "M12 2v14" })
                              ]))
                            ], 10 /* CLASS, PROPS */, ["onClick", "title", "aria-label"]),
                            _createElementVNode("button", {
                              class: "card-action-btn delete",
                              onClick: $event => (_ctx.deleteClaudeConfig(name)),
                              "aria-label": _ctx.t('claude.action.deleteAria', { name }),
                              title: _ctx.t('claude.action.delete')
                            }, [
                              (_openBlock(), _createElementBlock("svg", {
                                viewBox: "0 0 24 24",
                                fill: "none",
                                stroke: "currentColor",
                                "stroke-width": "2"
                              }, [
                                _createElementVNode("path", { d: "M3 6h18" }),
                                _createElementVNode("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })
                              ]))
                            ], 8 /* PROPS */, ["onClick", "aria-label", "title"])
                          ], 8 /* PROPS */, ["onClick"])
                        ])
                      ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["onClick", "onKeydown", "aria-current"]))
                    }), 128 /* KEYED_FRAGMENT */))
                  ])
                ], 64 /* STABLE_FRAGMENT */))
          ], 8 /* PROPS */, ["aria-labelledby"]), [
            [_vShow, _ctx.mainTab === 'config' && _ctx.configMode === 'claude']
          ]),
          _createCommentVNode(" OpenClaw 配置模式 "),
          _withDirectives(_createElementVNode("div", {
            class: "mode-content mode-cards",
            id: "panel-config-openclaw",
            role: "tabpanel",
            "aria-labelledby": _ctx.forceCompactLayout ? 'tab-config' : 'side-tab-config-openclaw'
          }, [
            (_ctx.forceCompactLayout && !_ctx.sessionStandalone)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "segmented-control"
                }, [
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['segment', { active: _ctx.configMode === 'codex' }]),
                    onClick: $event => (_ctx.switchConfigMode('codex'))
                  }, _toDisplayString(_ctx.t('tab.config.codex')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['segment', { active: _ctx.configMode === 'claude' }]),
                    onClick: $event => (_ctx.switchConfigMode('claude'))
                  }, _toDisplayString(_ctx.t('tab.config.claude')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['segment', { active: _ctx.configMode === 'openclaw' }]),
                    onClick: $event => (_ctx.switchConfigMode('openclaw'))
                  }, _toDisplayString(_ctx.t('tab.config.openclaw')), 11 /* TEXT, CLASS, PROPS */, ["onClick"])
                ]))
              : _createCommentVNode("v-if", true),
            _createElementVNode("div", { class: "config-template-hint" }, _toDisplayString(_ctx.t('openclaw.applyHint')), 1 /* TEXT */),
            _createElementVNode("div", { class: "selector-section" }, [
              _createElementVNode("div", { class: "selector-header" }, [
                _createElementVNode("span", { class: "selector-title" }, "AGENTS.md")
              ]),
              _createElementVNode("div", { class: "config-template-hint" }, _toDisplayString(_ctx.t('openclaw.agents.hint')), 1 /* TEXT */),
              _createElementVNode("button", {
                class: "btn-tool",
                onClick: _ctx.openOpenclawAgentsEditor,
                disabled: _ctx.loading || !!_ctx.initError || _ctx.agentsLoading
              }, _toDisplayString(_ctx.agentsLoading ? _ctx.t('config.modelLoading') : _ctx.t('openclaw.agents.open')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
            ]),
            _createElementVNode("div", { class: "selector-section" }, [
              _createElementVNode("div", { class: "selector-header" }, [
                _createElementVNode("label", {
                  class: "selector-title",
                  for: "openclaw-workspace-file"
                }, _toDisplayString(_ctx.t('openclaw.workspaceFile')), 1 /* TEXT */)
              ]),
              _withDirectives(_createElementVNode("input", {
                id: "openclaw-workspace-file",
                class: "form-input",
                "onUpdate:modelValue": $event => ((_ctx.openclawWorkspaceFileName) = $event),
                placeholder: _ctx.t('openclaw.workspace.placeholder')
              }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                [_vModelText, _ctx.openclawWorkspaceFileName]
              ]),
              _createElementVNode("div", { class: "config-template-hint" }, _toDisplayString(_ctx.t('openclaw.workspace.hint')), 1 /* TEXT */),
              _createElementVNode("button", {
                class: "btn-tool",
                onClick: _ctx.openOpenclawWorkspaceEditor,
                disabled: _ctx.loading || !!_ctx.initError || _ctx.agentsLoading
              }, _toDisplayString(_ctx.agentsLoading ? _ctx.t('config.modelLoading') : _ctx.t('openclaw.workspace.open')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
            ]),
            _createElementVNode("div", { class: "card-list" }, [
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.openclawConfigs, (config, name) => {
                return (_openBlock(), _createElementBlock("div", {
                  key: name,
                  class: _normalizeClass(['card', { active: _ctx.currentOpenclawConfig === name }]),
                  onClick: $event => (_ctx.applyOpenclawConfig(name)),
                  onKeydown: [
                    _withKeys(_withModifiers($event => (_ctx.applyOpenclawConfig(name)), ["self","prevent"]), ["enter"]),
                    _withKeys(_withModifiers($event => (_ctx.applyOpenclawConfig(name)), ["self","prevent"]), ["space"])
                  ],
                  tabindex: "0",
                  role: "button",
                  "aria-current": _ctx.currentOpenclawConfig === name ? 'true' : null
                }, [
                  _createElementVNode("div", { class: "card-leading" }, [
                    _createElementVNode("div", { class: "card-icon" }, _toDisplayString(name.charAt(0).toUpperCase()), 1 /* TEXT */),
                    _createElementVNode("div", { class: "card-content" }, [
                      _createElementVNode("div", { class: "card-title" }, _toDisplayString(name), 1 /* TEXT */),
                      _createElementVNode("div", { class: "card-subtitle" }, _toDisplayString(_ctx.openclawSubtitle(config)), 1 /* TEXT */)
                    ])
                  ]),
                  _createElementVNode("div", { class: "card-trailing" }, [
                    _createElementVNode("span", {
                      class: _normalizeClass(['pill', _ctx.openclawHasContent(config) ? 'configured' : 'empty'])
                    }, _toDisplayString(_ctx.openclawHasContent(config) ? _ctx.t('openclaw.configured') : _ctx.t('openclaw.notConfigured')), 3 /* TEXT, CLASS */),
                    _createElementVNode("div", {
                      class: "card-actions",
                      onClick: _withModifiers(() => {}, ["stop"])
                    }, [
                      _createElementVNode("button", {
                        class: "card-action-btn",
                        onClick: $event => (_ctx.openOpenclawEditModal(name)),
                        "aria-label": _ctx.t('openclaw.action.editAria', { name }),
                        title: _ctx.t('openclaw.action.edit')
                      }, [
                        (_openBlock(), _createElementBlock("svg", {
                          viewBox: "0 0 24 24",
                          fill: "none",
                          stroke: "currentColor",
                          "stroke-width": "2"
                        }, [
                          _createElementVNode("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
                          _createElementVNode("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })
                        ]))
                      ], 8 /* PROPS */, ["onClick", "aria-label", "title"]),
                      (name !== '默认配置')
                        ? (_openBlock(), _createElementBlock("button", {
                            key: 0,
                            class: "card-action-btn delete",
                            onClick: $event => (_ctx.deleteOpenclawConfig(name)),
                            "aria-label": _ctx.t('openclaw.action.deleteAria', { name }),
                            title: _ctx.t('openclaw.action.delete')
                          }, [
                            (_openBlock(), _createElementBlock("svg", {
                              viewBox: "0 0 24 24",
                              fill: "none",
                              stroke: "currentColor",
                              "stroke-width": "2"
                            }, [
                              _createElementVNode("path", { d: "M3 6h18" }),
                              _createElementVNode("path", { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" })
                            ]))
                          ], 8 /* PROPS */, ["onClick", "aria-label", "title"]))
                        : _createCommentVNode("v-if", true)
                    ], 8 /* PROPS */, ["onClick"])
                  ])
                ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["onClick", "onKeydown", "aria-current"]))
              }), 128 /* KEYED_FRAGMENT */))
            ])
          ], 8 /* PROPS */, ["aria-labelledby"]), [
            [_vShow, _ctx.mainTab === 'config' && _ctx.configMode === 'openclaw']
          ]),
          _createCommentVNode(" 会话浏览模式 "),
          _withDirectives(_createElementVNode("div", {
            class: "mode-content",
            id: "panel-sessions",
            role: "tabpanel",
            "aria-labelledby": 'tab-sessions'
          }, [
            (_ctx.sessionStandalone)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "session-standalone-page"
                }, [
                  (_ctx.sessionStandaloneLoading)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "state-message"
                      }, _toDisplayString(_ctx.t('sessions.loading')), 1 /* TEXT */))
                    : (_ctx.sessionStandaloneError)
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 1,
                          class: "state-message error"
                        }, _toDisplayString(_ctx.sessionStandaloneError), 1 /* TEXT */))
                      : (_openBlock(), _createElementBlock("div", { key: 2 }, [
                          _createElementVNode("div", { class: "session-standalone-title" }, [
                            _createTextVNode(_toDisplayString(_ctx.sessionStandaloneTitle) + " ", 1 /* TEXT */),
                            (_ctx.sessionStandaloneSourceLabel)
                              ? (_openBlock(), _createElementBlock("span", { key: 0 }, " · " + _toDisplayString(_ctx.sessionStandaloneSourceLabel), 1 /* TEXT */))
                              : _createCommentVNode("v-if", true)
                          ]),
                          _createElementVNode("pre", { class: "session-standalone-text" }, _toDisplayString(_ctx.sessionStandaloneText), 1 /* TEXT */)
                        ]))
                ]))
              : (_openBlock(), _createElementBlock("div", { key: 1 }, [
                  _createElementVNode("div", { class: "selector-section" }, [
                    _createElementVNode("div", {
                      class: "selector-header",
                      style: {"display":"none"}
                    }, [
                      _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('sessions.sourceTitle')), 1 /* TEXT */),
                      _createElementVNode("div", { class: "selector-actions sessions-header-actions" })
                    ]),
                    _createElementVNode("div", { class: "session-toolbar" }, [
                      _createElementVNode("div", { class: "session-toolbar-group session-toolbar-primary" }, [
                        _createElementVNode("div", {
                          class: "session-source-pills",
                          role: "radiogroup",
                          "aria-label": "Session source"
                        }, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.sessionSourceOptions, (src) => {
                            return (_openBlock(), _createElementBlock("button", {
                              key: src.value,
                              class: _normalizeClass(['session-source-pill', { active: _ctx.sessionFilterSource === src.value }]),
                              "data-source": src.value,
                              onClick: $event => (_ctx.setSessionSource(src.value)),
                              disabled: _ctx.sessionsLoading,
                              "aria-pressed": _ctx.sessionFilterSource === src.value,
                              role: "radio",
                              type: "button"
                            }, [
                              _createElementVNode("span", { class: "session-source-pill-dot" }),
                              _createElementVNode("span", { class: "session-source-pill-label" }, _toDisplayString(src.label), 1 /* TEXT */)
                            ], 10 /* CLASS, PROPS */, ["data-source", "onClick", "disabled", "aria-pressed"]))
                          }), 128 /* KEYED_FRAGMENT */))
                        ]),
                        _withDirectives(_createElementVNode("select", {
                          class: "session-path-select",
                          "onUpdate:modelValue": $event => ((_ctx.sessionPathFilter) = $event),
                          onChange: _ctx.onSessionPathFilterChange,
                          onFocus: $event => (_ctx.loadSessionPathOptions({ source: _ctx.sessionFilterSource })),
                          disabled: _ctx.sessionsLoading
                        }, [
                          _createElementVNode("option", { value: "" }, _toDisplayString(_ctx.t('sessions.allPaths')), 1 /* TEXT */),
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.sessionPathOptions, (cwd) => {
                            return (_openBlock(), _createElementBlock("option", {
                              key: cwd,
                              value: cwd
                            }, _toDisplayString(cwd), 9 /* TEXT, PROPS */, ["value"]))
                          }), 128 /* KEYED_FRAGMENT */))
                        ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange", "onFocus", "disabled"]), [
                          [_vModelSelect, _ctx.sessionPathFilter]
                        ])
                      ]),
                      _createElementVNode("div", { class: "session-toolbar-group session-toolbar-grow" }, [
                        _withDirectives(_createElementVNode("input", {
                          class: "session-query-input",
                          "onUpdate:modelValue": $event => ((_ctx.sessionQuery) = $event),
                          onKeyup: _withKeys(_ctx.onSessionFilterChange, ["enter"]),
                          disabled: _ctx.sessionsLoading || !_ctx.isSessionQueryEnabled,
                          placeholder: _ctx.sessionQueryPlaceholder
                        }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onKeyup", "disabled", "placeholder"]), [
                          [_vModelText, _ctx.sessionQuery]
                        ])
                      ]),
                      _createElementVNode("div", { class: "session-toolbar-group session-toolbar-secondary" }, [
                        _withDirectives(_createElementVNode("select", {
                          class: "session-role-select",
                          "onUpdate:modelValue": $event => ((_ctx.sessionRoleFilter) = $event),
                          onChange: _ctx.onSessionFilterChange,
                          disabled: _ctx.sessionsLoading
                        }, [
                          _createElementVNode("option", { value: "all" }, _toDisplayString(_ctx.t('sessions.role.all')), 1 /* TEXT */),
                          _createElementVNode("option", { value: "user" }, _toDisplayString(_ctx.t('sessions.role.user')), 1 /* TEXT */),
                          _createElementVNode("option", { value: "assistant" }, _toDisplayString(_ctx.t('sessions.role.assistant')), 1 /* TEXT */),
                          _createElementVNode("option", { value: "system" }, _toDisplayString(_ctx.t('sessions.role.system')), 1 /* TEXT */)
                        ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange", "disabled"]), [
                          [_vModelSelect, _ctx.sessionRoleFilter]
                        ]),
                        _withDirectives(_createElementVNode("select", {
                          class: "session-time-select",
                          "onUpdate:modelValue": $event => ((_ctx.sessionTimePreset) = $event),
                          onChange: _ctx.onSessionFilterChange,
                          disabled: _ctx.sessionsLoading
                        }, [
                          _createElementVNode("option", { value: "all" }, _toDisplayString(_ctx.t('sessions.time.all')), 1 /* TEXT */),
                          _createElementVNode("option", { value: "7d" }, _toDisplayString(_ctx.t('sessions.time.7d')), 1 /* TEXT */),
                          _createElementVNode("option", { value: "30d" }, _toDisplayString(_ctx.t('sessions.time.30d')), 1 /* TEXT */),
                          _createElementVNode("option", { value: "90d" }, _toDisplayString(_ctx.t('sessions.time.90d')), 1 /* TEXT */)
                        ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange", "disabled"]), [
                          [_vModelSelect, _ctx.sessionTimePreset]
                        ]),
                        _withDirectives(_createElementVNode("select", {
                          class: "session-time-select",
                          "onUpdate:modelValue": $event => ((_ctx.sessionSortMode) = $event),
                          onChange: _ctx.onSessionSortChange,
                          disabled: _ctx.sessionsLoading
                        }, [
                          _createElementVNode("option", { value: "time" }, _toDisplayString(_ctx.t('sessions.sort.time')), 1 /* TEXT */),
                          _createElementVNode("option", { value: "hot" }, _toDisplayString(_ctx.t('sessions.sort.hot')), 1 /* TEXT */)
                        ], 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "onChange", "disabled"]), [
                          [_vModelSelect, _ctx.sessionSortMode]
                        ]),
                        _createElementVNode("button", {
                          class: "btn-tool btn-tool-compact",
                          onClick: $event => (_ctx.loadSessions({ forceRefresh: true })),
                          disabled: _ctx.sessionsLoading,
                          title: _ctx.t('sessions.refresh')
                        }, [
                          (_openBlock(), _createElementBlock("svg", {
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            "stroke-width": "2",
                            class: "btn-icon-sm"
                          }, [
                            _createElementVNode("path", { d: "M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" })
                          ]))
                        ], 8 /* PROPS */, ["onClick", "disabled", "title"]),
                        _createElementVNode("button", {
                          class: "btn-tool btn-tool-compact",
                          type: "button",
                          onClick: $event => (_ctx.switchMainTab('dashboard')),
                          title: _ctx.t('dashboard.doctor.title')
                        }, [
                          (_openBlock(), _createElementBlock("svg", {
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            "stroke-width": "2",
                            class: "btn-icon-sm"
                          }, [
                            _createElementVNode("path", { d: "M22 12h-4l-3 9L9 3l-3 9H2" })
                          ]))
                        ], 8 /* PROPS */, ["onClick", "title"]),
                        _createElementVNode("button", {
                          class: "btn-tool btn-tool-compact",
                          type: "button",
                          onClick: _ctx.copySessionsFilterShareUrl,
                          disabled: _ctx.sessionsLoading
                        }, _toDisplayString(_ctx.t('sessions.filters.copyLink')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                        _createElementVNode("button", {
                          class: "btn-tool btn-tool-compact",
                          type: "button",
                          onClick: _ctx.clearSessionFilters,
                          disabled: _ctx.sessionsLoading
                        }, _toDisplayString(_ctx.t('common.resetFilters')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                      ])
                    ]),
                    (_ctx.hasActiveSessionFilters())
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "session-filter-chips",
                          "aria-label": _ctx.t('sessions.filters.copyLink')
                        }, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.getSessionFilterChips(), (chip) => {
                            return (_openBlock(), _createElementBlock("button", {
                              key: 'chip-' + chip.key,
                              type: "button",
                              class: "session-filter-chip",
                              onClick: $event => (_ctx.clearSessionFilterChip(chip.key)),
                              title: `${chip.title}: ${chip.value}`
                            }, [
                              _createElementVNode("span", { class: "session-filter-chip-title" }, _toDisplayString(chip.title), 1 /* TEXT */),
                              _createElementVNode("span", { class: "session-filter-chip-value" }, _toDisplayString(chip.value), 1 /* TEXT */),
                              _createElementVNode("span", { class: "session-filter-chip-close" }, "×")
                            ], 8 /* PROPS */, ["onClick", "title"]))
                          }), 128 /* KEYED_FRAGMENT */))
                        ], 8 /* PROPS */, ["aria-label"]))
                      : _createCommentVNode("v-if", true)
                  ]),
                  (_ctx.sessionsLoading)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "state-message"
                      }, _toDisplayString(_ctx.t('sessions.loadingList')), 1 /* TEXT */))
                    : (_ctx.sessionsList.length === 0)
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 1,
                          class: "session-empty"
                        }, _toDisplayString(_ctx.t('sessions.empty')), 1 /* TEXT */))
                      : (_openBlock(), _createElementBlock("div", {
                          key: 2,
                          class: "session-layout"
                        }, [
                          (_ctx.sessionListRenderEnabled)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 0,
                                class: "session-list",
                                ref: _ctx.setSessionListRef,
                                onScrollPassive: _ctx.onSessionListScroll
                              }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.visibleSessionsList, (session, __, ___, _cached) => {
                                  const _memo = ([_ctx.activeSessionExportKey === _ctx.getSessionExportKey(session), session.messageCount, session.updatedAt, session.title, session.sourceLabel, session.cwd, _ctx.isSessionPinned(session), _ctx.sessionsLoading, session.match && session.match.count])
                                  if (_cached && _cached.key === session.source + '-' + session.sessionId + '-' + session.filePath && _isMemoSame(_cached, _memo)) return _cached
                                  const _item = (_openBlock(), _createElementBlock("div", {
                                    key: session.source + '-' + session.sessionId + '-' + session.filePath,
                                    class: _normalizeClass([
                                'session-item',
                                {
                                    active: _ctx.activeSessionExportKey === _ctx.getSessionExportKey(session),
                                    pinned: _ctx.isSessionPinned(session)
                                }
                            ]),
                                    onClick: $event => (_ctx.selectSession(session)),
                                    onKeydown: [
                                      _withKeys(_withModifiers($event => (_ctx.selectSession(session)), ["self","prevent"]), ["enter"]),
                                      _withKeys(_withModifiers($event => (_ctx.selectSession(session)), ["self","prevent"]), ["space"])
                                    ],
                                    tabindex: "0",
                                    role: "button",
                                    "aria-current": _ctx.activeSessionExportKey === _ctx.getSessionExportKey(session) ? 'true' : null
                                  }, [
                                    _createElementVNode("div", { class: "session-item-header" }, [
                                      _createElementVNode("div", { class: "session-item-main" }, [
                                        _createElementVNode("div", { class: "session-item-title" }, _toDisplayString(session.title || session.sessionId), 1 /* TEXT */),
                                        _createElementVNode("span", { class: "session-count-badge" }, _toDisplayString(session.messageCount == null ? '...' : session.messageCount), 1 /* TEXT */),
                                        (session.match && session.match.hit)
                                          ? (_openBlock(), _createElementBlock("span", {
                                              key: 0,
                                              class: "session-match-badge"
                                            }, _toDisplayString(session.match.count), 1 /* TEXT */))
                                          : _createCommentVNode("v-if", true),
                                        (_ctx.sessionContextUtilization[_ctx.getSessionExportKey(session)] && _ctx.sessionContextUtilization[_ctx.getSessionExportKey(session)].percent > 0)
                                          ? (_openBlock(), _createElementBlock("span", {
                                              key: 1,
                                              class: _normalizeClass(['session-context-badge', 'session-context-' + _ctx.sessionContextUtilization[_ctx.getSessionExportKey(session)].level]),
                                              title: 'Context: ' + _ctx.sessionContextUtilization[_ctx.getSessionExportKey(session)].percent + '%'
                                            }, _toDisplayString(_ctx.sessionContextUtilization[_ctx.getSessionExportKey(session)].percent) + "% ", 11 /* TEXT, CLASS, PROPS */, ["title"]))
                                          : _createCommentVNode("v-if", true)
                                      ]),
                                      _createElementVNode("div", { class: "session-item-actions" }, [
                                        _createElementVNode("button", {
                                          class: "session-item-copy session-item-pin",
                                          onClick: _withModifiers($event => (_ctx.toggleSessionPin(session)), ["stop"]),
                                          disabled: _ctx.sessionsLoading,
                                          "aria-label": _ctx.isSessionPinned(session) ? _ctx.t('sessions.unpin') : _ctx.t('sessions.pin'),
                                          title: _ctx.isSessionPinned(session) ? _ctx.t('sessions.unpin') : _ctx.t('sessions.pin'),
                                          "aria-pressed": _ctx.isSessionPinned(session)
                                        }, [
                                          (_ctx.isSessionPinned(session))
                                            ? (_openBlock(), _createElementBlock("svg", {
                                                key: 0,
                                                class: "pin-icon",
                                                viewBox: "0 0 24 24",
                                                fill: "currentColor",
                                                stroke: "currentColor",
                                                "stroke-width": "1.6"
                                              }, [
                                                _createElementVNode("path", { d: "M12 22s8-6 8-12a8 8 0 1 0-16 0c0 6 8 12 8 12z" })
                                              ]))
                                            : (_openBlock(), _createElementBlock("svg", {
                                                key: 1,
                                                class: "pin-icon",
                                                viewBox: "0 0 24 24",
                                                fill: "none",
                                                stroke: "currentColor",
                                                "stroke-width": "1.6"
                                              }, [
                                                _createElementVNode("path", { d: "M12 22s8-6 8-12a8 8 0 1 0-16 0c0 6 8 12 8 12z" })
                                              ]))
                                        ], 8 /* PROPS */, ["onClick", "disabled", "aria-label", "title", "aria-pressed"]),
                                        (_ctx.isResumeCommandAvailable(session))
                                          ? (_openBlock(), _createElementBlock("button", {
                                              key: 0,
                                              class: "session-item-copy",
                                              onClick: _withModifiers($event => (_ctx.copyResumeCommand(session)), ["stop"]),
                                              disabled: _ctx.sessionsLoading,
                                              "aria-label": _ctx.getResumeCommandTitle(session),
                                              title: _ctx.getResumeCommandTitle(session)
                                            }, [
                                              (_openBlock(), _createElementBlock("svg", {
                                                viewBox: "0 0 24 24",
                                                fill: "none",
                                                stroke: "currentColor",
                                                "stroke-width": "2"
                                              }, [
                                                _createElementVNode("rect", {
                                                  x: "8",
                                                  y: "8",
                                                  width: "12",
                                                  height: "12",
                                                  rx: "2"
                                                }),
                                                _createElementVNode("path", { d: "M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" })
                                              ]))
                                            ], 8 /* PROPS */, ["onClick", "disabled", "aria-label", "title"]))
                                          : _createCommentVNode("v-if", true)
                                      ])
                                    ]),
                                    _createElementVNode("div", { class: "session-item-meta" }, [
                                      _createElementVNode("span", {
                                        class: "session-source",
                                        "data-source": session.source
                                      }, _toDisplayString(session.sourceLabel), 9 /* TEXT, PROPS */, ["data-source"]),
                                      _createElementVNode("span", { class: "session-item-time" }, _toDisplayString(session.updatedAtLabel || session.updatedAt || _ctx.t('sessions.unknownTime')), 1 /* TEXT */),
                                      (_ctx.getSessionHotLabel(session))
                                        ? (_openBlock(), _createElementBlock("span", {
                                            key: 0,
                                            class: "session-item-hot"
                                          }, _toDisplayString(_ctx.getSessionHotLabel(session)), 1 /* TEXT */))
                                        : _createCommentVNode("v-if", true),
                                      (session.cwd)
                                        ? (_openBlock(), _createElementBlock("span", {
                                            key: 1,
                                            class: "session-item-cwd session-item-sub"
                                          }, _toDisplayString(session.cwd), 1 /* TEXT */))
                                        : _createCommentVNode("v-if", true),
                                      (session.match && session.match.snippets && session.match.snippets.length)
                                        ? (_openBlock(), _createElementBlock("div", {
                                            key: 2,
                                            class: "session-match-snippets"
                                          }, [
                                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(session.match.snippets.slice(0, 2), (snip, si) => {
                                              return (_openBlock(), _createElementBlock("div", {
                                                key: si,
                                                class: "session-match-snippet"
                                              }, _toDisplayString(snip), 1 /* TEXT */))
                                            }), 128 /* KEYED_FRAGMENT */))
                                          ]))
                                        : _createCommentVNode("v-if", true)
                                    ])
                                  ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["onClick", "onKeydown", "aria-current"]))
                                  _item.memo = _memo
                                  return _item
                                }, _cache, 0), 128 /* KEYED_FRAGMENT */))
                              ], 40 /* PROPS, NEED_HYDRATION */, ["onScrollPassive"]))
                            : (_openBlock(), _createElementBlock("div", {
                                key: 1,
                                class: "session-list session-list-placeholder"
                              })),
                          _createElementVNode("div", {
                            class: _normalizeClass(['session-preview', { active: !!_ctx.activeSession }]),
                            ref: _ctx.setSessionPreviewContainerRef
                          }, [
                            (_ctx.activeSession)
                              ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                                  _createElementVNode("div", {
                                    class: "session-preview-scroll",
                                    ref: _ctx.setSessionPreviewScrollRef,
                                    onScroll: _ctx.onSessionPreviewScroll
                                  }, [
                                    _createElementVNode("div", {
                                      class: "session-preview-header",
                                      ref: _ctx.setSessionPreviewHeaderRef
                                    }, [
                                      _createElementVNode("div", null, [
                                        _createElementVNode("div", { class: "session-preview-title" }, _toDisplayString(_ctx.activeSession.title || _ctx.activeSession.sessionId), 1 /* TEXT */),
                                        _createElementVNode("div", { class: "session-preview-meta" }, [
                                          _createElementVNode("span", {
                                            class: "session-preview-meta-item session-source",
                                            "data-source": _ctx.activeSession.source
                                          }, _toDisplayString(_ctx.activeSession.sourceLabel), 9 /* TEXT, PROPS */, ["data-source"]),
                                          _createElementVNode("span", { class: "session-preview-meta-item" }, _toDisplayString(_ctx.activeSession.updatedAtLabel || _ctx.activeSession.updatedAt || _ctx.t('sessions.unknownTime')), 1 /* TEXT */)
                                        ]),
                                        (_ctx.activeSession.cwd)
                                          ? (_openBlock(), _createElementBlock("div", {
                                              key: 0,
                                              class: "session-preview-meta"
                                            }, [
                                              _createElementVNode("span", { class: "session-preview-meta-item" }, _toDisplayString(_ctx.activeSession.cwd), 1 /* TEXT */)
                                            ]))
                                          : _createCommentVNode("v-if", true)
                                      ]),
                                      _createElementVNode("div", { class: "session-actions" }, [
                                        _createElementVNode("button", {
                                          class: "btn-session-refresh",
                                          onClick: _ctx.loadActiveSessionDetail,
                                          disabled: _ctx.sessionDetailLoading || !_ctx.activeSession
                                        }, _toDisplayString(_ctx.sessionDetailLoading ? _ctx.t('sessions.preview.loading') : _ctx.t('sessions.preview.refresh')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                                        (_ctx.isDeleteAvailable(_ctx.activeSession))
                                          ? (_openBlock(), _createElementBlock("button", {
                                              key: 0,
                                              class: "btn-session-delete",
                                              onClick: $event => (_ctx.deleteSession(_ctx.activeSession)),
                                              disabled: !_ctx.activeSession || _ctx.sessionsLoading || _ctx.sessionDeleting[_ctx.getSessionExportKey(_ctx.activeSession)]
                                            }, _toDisplayString((_ctx.activeSession && _ctx.sessionDeleting[_ctx.getSessionExportKey(_ctx.activeSession)]) ? (_ctx.sessionTrashEnabled === false ? _ctx.t('sessions.preview.deleting') : _ctx.t('sessions.preview.moving')) : (_ctx.sessionTrashEnabled === false ? _ctx.t('sessions.preview.deleteHard') : _ctx.t('sessions.preview.moveToTrash'))), 9 /* TEXT, PROPS */, ["onClick", "disabled"]))
                                          : _createCommentVNode("v-if", true),
                                        _createElementVNode("button", {
                                          class: "btn-session-export",
                                          onClick: $event => (_ctx.exportSession(_ctx.activeSession)),
                                          disabled: !_ctx.activeSession || _ctx.sessionExporting[_ctx.getSessionExportKey(_ctx.activeSession)]
                                        }, _toDisplayString((_ctx.activeSession && _ctx.sessionExporting[_ctx.getSessionExportKey(_ctx.activeSession)]) ? _ctx.t('sessions.preview.exporting') : _ctx.t('sessions.preview.export')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                                        _createElementVNode("button", {
                                          class: "btn-session-open",
                                          onClick: $event => (_ctx.copySessionLink(_ctx.activeSession)),
                                          disabled: !_ctx.activeSession
                                        }, _toDisplayString(_ctx.t('sessions.preview.copyLink')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                      ])
                                    ], 512 /* NEED_PATCH */),
                                    (_ctx.sessionDetailLoading && !_ctx.sessionPreviewLoadingMore)
                                      ? (_openBlock(), _createElementBlock("div", {
                                          key: 0,
                                          class: "session-preview-empty"
                                        }, _toDisplayString(_ctx.t('sessions.preview.loadingBody')), 1 /* TEXT */))
                                      : (_ctx.activeSessionDetailError)
                                        ? (_openBlock(), _createElementBlock("div", {
                                            key: 1,
                                            class: "session-preview-empty"
                                          }, _toDisplayString(_ctx.activeSessionDetailError), 1 /* TEXT */))
                                        : (!_ctx.activeSessionMessages.length)
                                          ? (_openBlock(), _createElementBlock("div", {
                                              key: 2,
                                              class: "session-preview-empty"
                                            }, _toDisplayString(_ctx.t('sessions.preview.emptyMsgs')), 1 /* TEXT */))
                                          : (_ctx.sessionPreviewRenderEnabled && !_ctx.activeSessionVisibleMessages.length)
                                            ? (_openBlock(), _createElementBlock("div", {
                                                key: 3,
                                                class: "session-preview-empty"
                                              }, [
                                                _createElementVNode("span", null, _toDisplayString(_ctx.t('sessions.preview.rendering')), 1 /* TEXT */),
                                                _createElementVNode("button", {
                                                  class: "btn-session-refresh",
                                                  onClick: _ctx.primeSessionPreviewMessageRender,
                                                  disabled: _ctx.sessionDetailLoading
                                                }, _toDisplayString(_ctx.t('sessions.preview.rerender')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                              ]))
                                            : (!_ctx.sessionPreviewRenderEnabled)
                                              ? (_openBlock(), _createElementBlock("div", {
                                                  key: 4,
                                                  class: "session-preview-empty"
                                                }, _toDisplayString(_ctx.t('sessions.preview.preparing')), 1 /* TEXT */))
                                              : (_openBlock(), _createElementBlock("div", {
                                                  key: 5,
                                                  class: "session-preview-body"
                                                }, [
                                                  _createElementVNode("div", { class: "session-preview-messages" }, [
                                                    (_ctx.activeSessionDetailClipped)
                                                      ? (_openBlock(), _createElementBlock("div", {
                                                          key: 0,
                                                          class: "session-item-sub session-item-wrap"
                                                        }, _toDisplayString(_ctx.t('sessions.preview.clipped', { count: _ctx.activeSessionMessages.length })), 1 /* TEXT */))
                                                      : _createCommentVNode("v-if", true),
                                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.activeSessionMessages, (msg, idx, ___, _cached) => {
                                                      const _memo = ([msg.text, msg.timestamp, msg.roleLabel, msg.normalizedRole])
                                                      if (_cached && _cached.key === _ctx.getRecordRenderKey(msg, idx) && _isMemoSame(_cached, _memo)) return _cached
                                                      const _item = (_openBlock(), _createElementBlock("div", {
                                                        key: _ctx.getRecordRenderKey(msg, idx),
                                                        "data-message-key": _ctx.getRecordRenderKey(msg, idx),
                                                        ref_for: true,
                                                        ref: _ctx.getSessionMessageRefBinder(_ctx.getRecordRenderKey(msg, idx)),
                                                        class: _normalizeClass(['session-msg', msg.normalizedRole === 'user' ? 'user' : (msg.normalizedRole === 'system' ? 'system' : 'assistant')])
                                                      }, [
                                                        _createElementVNode("div", { class: "session-msg-header" }, [
                                                          _createElementVNode("div", { class: "session-msg-meta" }, [
                                                            _createElementVNode("span", { class: "session-msg-role" }, _toDisplayString(msg.roleLabel || (msg.normalizedRole === 'user' ? _ctx.t('sessions.roleLabel.user') : (msg.normalizedRole === 'system' ? _ctx.t('sessions.roleLabel.system') : _ctx.t('sessions.roleLabel.assistant')))), 1 /* TEXT */),
                                                            _createElementVNode("span", { class: "session-msg-time" }, _toDisplayString(msg.timestamp || ''), 1 /* TEXT */)
                                                          ])
                                                        ]),
                                                        _createElementVNode("div", {
                                                          class: "session-msg-content",
                                                          innerHTML: _ctx.highlightQueryText(msg.text) || ''
                                                        }, null, 8 /* PROPS */, ["innerHTML"])
                                                      ], 10 /* CLASS, PROPS */, ["data-message-key"]))
                                                      _item.memo = _memo
                                                      return _item
                                                    }, _cache, 2), 128 /* KEYED_FRAGMENT */))
                                                  ])
                                                ]))
                                  ], 40 /* PROPS, NEED_HYDRATION */, ["onScroll"]),
                                  (_ctx.sessionPreviewRenderEnabled && _ctx.sessionTimelineNodes.length)
                                    ? (_openBlock(), _createElementBlock("aside", {
                                        key: 0,
                                        class: "session-timeline",
                                        "aria-label": _ctx.t('sessions.timeline.aria')
                                      }, [
                                        _createElementVNode("div", { class: "session-timeline-track" }),
                                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.sessionTimelineNodes, (node, __, ___, _cached) => {
                                          const _memo = ([_ctx.sessionTimelineActiveKey === node.key, node.safePercent, node.title])
                                          if (_cached && _cached.key === 'timeline-' + node.key && _isMemoSame(_cached, _memo)) return _cached
                                          const _item = (_openBlock(), _createElementBlock("button", {
                                            key: 'timeline-' + node.key,
                                            type: "button",
                                            class: _normalizeClass(['session-timeline-node', { active: _ctx.sessionTimelineActiveKey === node.key }]),
                                            "aria-current": _ctx.sessionTimelineActiveKey === node.key ? 'true' : null,
                                            style: _normalizeStyle({ top: `${node.safePercent}%` }),
                                            title: node.title,
                                            onClick: $event => (_ctx.jumpToSessionTimelineNode(node.key))
                                          }, [
                                            _createElementVNode("span", { class: "sr-only" }, _toDisplayString(node.title), 1 /* TEXT */)
                                          ], 14 /* CLASS, STYLE, PROPS */, ["aria-current", "title", "onClick"]))
                                          _item.memo = _memo
                                          return _item
                                        }, _cache, 4), 128 /* KEYED_FRAGMENT */)),
                                        (_ctx.sessionTimelineActiveTitle)
                                          ? (_openBlock(), _createElementBlock("div", {
                                              key: 0,
                                              class: "session-timeline-current"
                                            }, _toDisplayString(_ctx.sessionTimelineActiveTitle), 1 /* TEXT */))
                                          : _createCommentVNode("v-if", true)
                                      ], 8 /* PROPS */, ["aria-label"]))
                                    : _createCommentVNode("v-if", true)
                                ], 64 /* STABLE_FRAGMENT */))
                              : (_openBlock(), _createElementBlock("div", {
                                  key: 1,
                                  class: "session-preview-empty"
                                }, [
                                  _createElementVNode("span", null, _toDisplayString(_ctx.t('sessions.selectHint')), 1 /* TEXT */)
                                ]))
                          ], 2 /* CLASS */)
                        ]))
                ]))
          ], 512 /* NEED_PATCH */), [
            [_vShow, _ctx.mainTab === 'sessions']
          ]),
          _createCommentVNode(" Usage 统计 - 流光设计 "),
          _withDirectives(_createElementVNode("div", {
            class: "mode-content",
            id: "panel-usage",
            role: "tabpanel",
            "aria-labelledby": 'tab-usage'
          }, [
            _createElementVNode("div", { class: "usage-toolbar" }, [
              _createElementVNode("span", { class: "usage-toolbar-title" }, _toDisplayString(_ctx.t('usage.overview')), 1 /* TEXT */),
              _createElementVNode("div", {
                class: "usage-range-group",
                role: "group",
                "aria-label": _ctx.t('usage.range.aria')
              }, [
                _createElementVNode("button", {
                  type: "button",
                  class: _normalizeClass(["usage-range-btn", { active: _ctx.sessionsUsageTimeRange === '7d' }]),
                  onClick: $event => (_ctx.setSessionsUsageTimeRange('7d'))
                }, _toDisplayString(_ctx.t('usage.range.7d')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                _createElementVNode("button", {
                  type: "button",
                  class: _normalizeClass(["usage-range-btn", { active: _ctx.sessionsUsageTimeRange === '30d' }]),
                  onClick: $event => (_ctx.setSessionsUsageTimeRange('30d'))
                }, _toDisplayString(_ctx.t('usage.range.30d')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                _createElementVNode("button", {
                  type: "button",
                  class: _normalizeClass(["usage-range-btn", { active: _ctx.sessionsUsageTimeRange === 'all' }]),
                  onClick: $event => (_ctx.setSessionsUsageTimeRange('all'))
                }, _toDisplayString(_ctx.t('usage.range.all')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                _createElementVNode("button", {
                  type: "button",
                  class: "usage-range-btn usage-range-btn-icon",
                  onClick: $event => (_ctx.loadSessionsUsage({ forceRefresh: true, range: _ctx.sessionsUsageTimeRange })),
                  disabled: _ctx.sessionsUsageLoading,
                  title: _ctx.t('usage.refresh')
                }, [
                  (_openBlock(), _createElementBlock("svg", {
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    "stroke-width": "2",
                    class: "btn-icon-sm"
                  }, [
                    _createElementVNode("path", { d: "M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" })
                  ]))
                ], 8 /* PROPS */, ["onClick", "disabled", "title"])
              ], 8 /* PROPS */, ["aria-label"])
            ]),
            (_ctx.sessionsUsageLoading && !_ctx.sessionsUsageList.length)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "usage-empty-state"
                }, [
                  _createElementVNode("div", { class: "usage-empty-illustration" }, [
                    (_openBlock(), _createElementBlock("svg", {
                      viewBox: "0 0 64 64",
                      fill: "none",
                      xmlns: "http://www.w3.org/2000/svg"
                    }, [
                      _createElementVNode("circle", {
                        cx: "32",
                        cy: "32",
                        r: "28",
                        stroke: "currentColor",
                        "stroke-width": "2",
                        "stroke-dasharray": "4 4",
                        opacity: "0.3"
                      }),
                      _createElementVNode("circle", {
                        cx: "32",
                        cy: "32",
                        r: "20",
                        stroke: "currentColor",
                        "stroke-width": "2",
                        opacity: "0.5"
                      }),
                      _createElementVNode("path", {
                        d: "M32 20V32L40 36",
                        stroke: "currentColor",
                        "stroke-width": "2",
                        "stroke-linecap": "round"
                      })
                    ]))
                  ]),
                  _createElementVNode("p", { class: "usage-empty-text" }, _toDisplayString(_ctx.t('usage.loading')), 1 /* TEXT */)
                ]))
              : (_ctx.sessionsUsageError && !_ctx.sessionsUsageList.length)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 1,
                    class: "usage-empty-state"
                  }, [
                    _createElementVNode("div", { class: "usage-empty-illustration" }, [
                      (_openBlock(), _createElementBlock("svg", {
                        viewBox: "0 0 64 64",
                        fill: "none",
                        xmlns: "http://www.w3.org/2000/svg"
                      }, [
                        _createElementVNode("path", {
                          d: "M20 20L44 44M44 20L20 44",
                          stroke: "currentColor",
                          "stroke-width": "2",
                          "stroke-linecap": "round"
                        })
                      ]))
                    ]),
                    _createElementVNode("p", { class: "usage-empty-text" }, _toDisplayString(_ctx.sessionsUsageError), 1 /* TEXT */)
                  ]))
                : (!_ctx.sessionsUsageList.length)
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 2,
                      class: "usage-empty-state"
                    }, [
                      _createElementVNode("div", { class: "usage-empty-illustration" }, [
                        (_openBlock(), _createElementBlock("svg", {
                          viewBox: "0 0 64 64",
                          fill: "none",
                          xmlns: "http://www.w3.org/2000/svg"
                        }, [
                          _createElementVNode("rect", {
                            x: "12",
                            y: "16",
                            width: "40",
                            height: "32",
                            rx: "2",
                            stroke: "currentColor",
                            "stroke-width": "2"
                          }),
                          _createElementVNode("path", {
                            d: "M20 26H44M20 32H36M20 38H32",
                            stroke: "currentColor",
                            "stroke-width": "2",
                            "stroke-linecap": "round"
                          })
                        ]))
                      ]),
                      _createElementVNode("p", { class: "usage-empty-text" }, _toDisplayString(_ctx.t('usage.empty')), 1 /* TEXT */)
                    ]))
                  : (_openBlock(), _createElementBlock("div", {
                      key: 3,
                      class: _normalizeClass(["usage-content", { 'usage-content-loading': _ctx.sessionsUsageLoading }])
                    }, [
                      (_ctx.sessionsUsageLoading)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 0,
                            class: "usage-content-overlay",
                            "aria-live": "polite"
                          }, [
                            _createElementVNode("span", {
                              class: "usage-spinner",
                              "aria-hidden": "true"
                            })
                          ]))
                        : _createCommentVNode("v-if", true),
                      _createCommentVNode(" Hero 区域：合并当前会话条 + 主要指标 "),
                      _createElementVNode("div", { class: "usage-hero" }, [
                        (_ctx.usageCurrentSessionStats)
                          ? (_openBlock(), _createElementBlock("div", {
                              key: 0,
                              class: "usage-hero-active"
                            }, [
                              _createElementVNode("span", { class: "usage-hero-active-dot" }),
                              _createElementVNode("span", { class: "usage-hero-active-label" }, _toDisplayString(_ctx.usageCurrentSessionStats.label), 1 /* TEXT */),
                              _createElementVNode("span", { class: "usage-hero-active-stat" }, _toDisplayString(_ctx.usageCurrentSessionStats.tokenLabel) + " tokens", 1 /* TEXT */),
                              _createElementVNode("span", { class: "usage-hero-active-stat" }, _toDisplayString(_ctx.usageCurrentSessionStats.apiDurationLabel) + " API", 1 /* TEXT */),
                              _createElementVNode("span", { class: "usage-hero-active-stat" }, _toDisplayString(_ctx.usageCurrentSessionStats.totalDurationLabel) + " total", 1 /* TEXT */)
                            ]))
                          : _createCommentVNode("v-if", true),
                        _createElementVNode("div", { class: "usage-hero-metrics" }, [
                          _createElementVNode("div", { class: "usage-hero-main" }, _toDisplayString(_ctx.usageHeroMainValue), 1 /* TEXT */),
                          _createElementVNode("div", { class: "usage-hero-sub" }, [
                            _createElementVNode("span", null, _toDisplayString(_ctx.usageHeroSubLabel), 1 /* TEXT */),
                            (_ctx.usageHeroDelta)
                              ? (_openBlock(), _createElementBlock("span", {
                                  key: 0,
                                  class: _normalizeClass(['usage-hero-delta', _ctx.usageHeroDeltaClass])
                                }, _toDisplayString(_ctx.usageHeroDelta), 3 /* TEXT, CLASS */))
                              : _createCommentVNode("v-if", true)
                          ])
                        ])
                      ]),
                      _createCommentVNode(" 波浪图 "),
                      (_ctx.sessionUsageWave.points && _ctx.sessionUsageWave.points.length)
                        ? (_openBlock(), _createElementBlock("section", {
                            key: 1,
                            class: "usage-wave-section"
                          }, [
                            _createElementVNode("div", { class: "usage-card-title" }, _toDisplayString(_ctx.t('usage.daily.title')), 1 /* TEXT */),
                            _createElementVNode("div", { class: "usage-wave-container" }, [
                              (_openBlock(), _createElementBlock("svg", {
                                class: "usage-wave-chart",
                                viewBox: "0 0 800 140",
                                preserveAspectRatio: "none"
                              }, [
                                _createElementVNode("defs", null, [
                                  _createElementVNode("linearGradient", {
                                    id: 'wave-gradient-' + _ctx.sessionsUsageTimeRange,
                                    x1: "0",
                                    y1: "0",
                                    x2: "0",
                                    y2: "1"
                                  }, [
                                    _createElementVNode("stop", {
                                      offset: "0%",
                                      "stop-color": 'var(--color-brand)',
                                      "stop-opacity": "0.35"
                                    }),
                                    _createElementVNode("stop", {
                                      offset: "100%",
                                      "stop-color": 'var(--color-brand)',
                                      "stop-opacity": "0"
                                    })
                                  ], 8 /* PROPS */, ["id"])
                                ]),
                                _createElementVNode("path", {
                                  d: _ctx.sessionUsageWave.areaPath,
                                  fill: 'url(#wave-gradient-' + _ctx.sessionsUsageTimeRange + ')',
                                  class: "usage-wave-area"
                                }, null, 8 /* PROPS */, ["d", "fill"]),
                                _createElementVNode("path", {
                                  d: _ctx.sessionUsageWave.linePath,
                                  fill: "none",
                                  stroke: 'var(--color-brand)',
                                  "stroke-width": "2.5",
                                  "stroke-linecap": "round",
                                  "stroke-linejoin": "round",
                                  class: "usage-wave-line"
                                }, null, 8 /* PROPS */, ["d"]),
                                (_ctx.sessionsUsageSelectedDay)
                                  ? (_openBlock(), _createElementBlock("line", {
                                      key: 0,
                                      x1: "0",
                                      x2: _ctx.sessionUsageWave.width,
                                      y1: _ctx.sessionUsageWave.hoverY,
                                      y2: _ctx.sessionUsageWave.hoverY,
                                      stroke: "currentColor",
                                      "stroke-width": "1",
                                      "stroke-dasharray": "4 4",
                                      opacity: "0.5",
                                      class: "usage-wave-hover-line"
                                    }, null, 8 /* PROPS */, ["x2", "y1", "y2"]))
                                  : _createCommentVNode("v-if", true),
                                (_ctx.sessionsUsageSelectedDay)
                                  ? (_openBlock(), _createElementBlock("circle", {
                                      key: 1,
                                      cx: _ctx.sessionUsageWave.hoverX,
                                      cy: _ctx.sessionUsageWave.hoverY,
                                      r: "5",
                                      fill: 'var(--color-surface)',
                                      stroke: 'var(--color-brand)',
                                      "stroke-width": "2.5",
                                      class: "usage-wave-hover-point"
                                    }, null, 8 /* PROPS */, ["cx", "cy"]))
                                  : _createCommentVNode("v-if", true)
                              ])),
                              _createElementVNode("div", { class: "usage-wave-labels" }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.sessionUsageWave.labels, (label) => {
                                  return (_openBlock(), _createElementBlock("span", {
                                    key: label.key,
                                    class: _normalizeClass(["usage-wave-label", { active: _ctx.sessionsUsageSelectedDay === label.key }]),
                                    onClick: $event => (_ctx.selectSessionsUsageDay(label.key))
                                  }, _toDisplayString(label.text), 11 /* TEXT, CLASS, PROPS */, ["onClick"]))
                                }), 128 /* KEYED_FRAGMENT */))
                              ])
                            ]),
                            (_ctx.sessionsUsageSelectedDaySummary)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  class: "usage-daydetail"
                                }, [
                                  _createElementVNode("div", { class: "usage-daydetail-header" }, [
                                    _createElementVNode("span", { class: "usage-daydetail-date" }, _toDisplayString(_ctx.sessionsUsageSelectedDaySummary.dayKey), 1 /* TEXT */),
                                    _createElementVNode("span", { class: "usage-daydetail-stats" }, _toDisplayString(_ctx.sessionsUsageSelectedDaySummary.sessionCount) + " sessions · " + _toDisplayString(_ctx.sessionsUsageSelectedDaySummary.tokenLabel) + " tokens", 1 /* TEXT */)
                                  ]),
                                  (_ctx.sessionsUsageSelectedDaySummary.prevTokenLabel !== null)
                                    ? (_openBlock(), _createElementBlock("div", {
                                        key: 0,
                                        class: "usage-daydetail-compare"
                                      }, _toDisplayString(_ctx.t('usage.compare.prev')) + " " + _toDisplayString(_ctx.sessionsUsageSelectedDaySummary.prevTokenLabel) + " tokens · " + _toDisplayString(_ctx.t('usage.compare.delta')) + " " + _toDisplayString(_ctx.sessionsUsageSelectedDaySummary.deltaTokenLabel), 1 /* TEXT */))
                                    : _createCommentVNode("v-if", true)
                                ]))
                              : _createCommentVNode("v-if", true)
                          ]))
                        : _createCommentVNode("v-if", true),
                      _createElementVNode("div", { class: "usage-chart-grid" }, [
                        _createCommentVNode(" 热力图 "),
                        _createElementVNode("section", { class: "usage-card-hourly-heatmap" }, [
                          _createElementVNode("div", { class: "usage-card-title" }, _toDisplayString(_ctx.t('usage.hourlyHeatmap.title')), 1 /* TEXT */),
                          _createElementVNode("div", { class: "hourly-heatmap-wrapper" }, [
                            _createElementVNode("div", { class: "hourly-heatmap-header" }, [
                              _createElementVNode("div", { class: "hourly-heatmap-corner" }),
                              (_openBlock(), _createElementBlock(_Fragment, null, _renderList(24, (h) => {
                                return _createElementVNode("div", {
                                  key: 'hdr-' + h,
                                  class: "hourly-heatmap-hour-label"
                                }, _toDisplayString(h - 1), 1 /* TEXT */)
                              }), 64 /* STABLE_FRAGMENT */))
                            ]),
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.sessionUsageHourlyHeatmap.rows, (row) => {
                              return (_openBlock(), _createElementBlock("div", {
                                key: row.weekday,
                                class: "hourly-heatmap-row"
                              }, [
                                _createElementVNode("div", { class: "hourly-heatmap-weekday-label" }, _toDisplayString(row.weekday), 1 /* TEXT */),
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(row.cells, (cell) => {
                                  return (_openBlock(), _createElementBlock("div", {
                                    key: 'cell-' + row.weekday + '-' + cell.hour,
                                    class: _normalizeClass(['hourly-heatmap-cell', 'level-' + cell.level]),
                                    title: cell.tooltip
                                  }, null, 10 /* CLASS, PROPS */, ["title"]))
                                }), 128 /* KEYED_FRAGMENT */))
                              ]))
                            }), 128 /* KEYED_FRAGMENT */))
                          ]),
                          _createElementVNode("div", { class: "hourly-heatmap-legend" }, [
                            _createElementVNode("span", { class: "hourly-heatmap-legend-label" }, _toDisplayString(_ctx.t('usage.hourlyHeatmap.legend.less')), 1 /* TEXT */),
                            _createElementVNode("span", { class: "hourly-heatmap-cell level-1" }),
                            _createElementVNode("span", { class: "hourly-heatmap-cell level-2" }),
                            _createElementVNode("span", { class: "hourly-heatmap-cell level-3" }),
                            _createElementVNode("span", { class: "hourly-heatmap-cell level-4" }),
                            _createElementVNode("span", { class: "hourly-heatmap-legend-label" }, _toDisplayString(_ctx.t('usage.hourlyHeatmap.legend.more')), 1 /* TEXT */)
                          ])
                        ]),
                        _createCommentVNode(" Top Sessions "),
                        _createElementVNode("section", { class: "usage-card" }, [
                          _createElementVNode("div", { class: "usage-card-title" }, _toDisplayString(_ctx.t('usage.sessions.topDensity')), 1 /* TEXT */),
                          (!_ctx.sessionUsageCharts.topSessionsByMessages.length)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 0,
                                class: "usage-list-value"
                              }, _toDisplayString(_ctx.t('usage.sessions.empty')), 1 /* TEXT */))
                            : (_openBlock(), _createElementBlock("div", {
                                key: 1,
                                class: "usage-list-compact"
                              }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.sessionUsageCharts.topSessionsByMessages, (item) => {
                                  return (_openBlock(), _createElementBlock("div", {
                                    key: item.key + '-dense',
                                    class: "usage-list-compact-item",
                                    onClick: $event => (_ctx.selectSession(item)),
                                    title: item.title
                                  }, [
                                    _createElementVNode("span", { class: "usage-list-bullet" }, "·"),
                                    _createElementVNode("div", { class: "usage-list-compact-content" }, [
                                      _createElementVNode("div", { class: "usage-list-title" }, _toDisplayString(item.title), 1 /* TEXT */),
                                      _createElementVNode("div", { class: "usage-list-meta" }, _toDisplayString(item.messageCount) + " msgs · " + _toDisplayString(item.sourceLabel) + " · " + _toDisplayString(item.updatedAtLabel), 1 /* TEXT */)
                                    ])
                                  ], 8 /* PROPS */, ["onClick", "title"]))
                                }), 128 /* KEYED_FRAGMENT */))
                              ]))
                        ]),
                        _createCommentVNode(" Recent Activity "),
                        _createElementVNode("section", { class: "usage-card" }, [
                          _createElementVNode("div", { class: "usage-card-title" }, _toDisplayString(_ctx.t('usage.recent.title')), 1 /* TEXT */),
                          (!_ctx.sessionUsageCharts.recentSessions.length)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 0,
                                class: "usage-list-value"
                              }, _toDisplayString(_ctx.t('usage.sessions.empty')), 1 /* TEXT */))
                            : (_openBlock(), _createElementBlock("div", {
                                key: 1,
                                class: "usage-list-compact"
                              }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.sessionUsageCharts.recentSessions, (item) => {
                                  return (_openBlock(), _createElementBlock("div", {
                                    key: item.key,
                                    class: "usage-list-compact-item",
                                    onClick: $event => (_ctx.selectSession(item))
                                  }, [
                                    _createElementVNode("span", { class: "usage-list-bullet" }, "·"),
                                    _createElementVNode("div", { class: "usage-list-compact-content" }, [
                                      _createElementVNode("div", { class: "usage-list-title" }, _toDisplayString(item.title), 1 /* TEXT */),
                                      _createElementVNode("div", { class: "usage-list-meta" }, _toDisplayString(item.messageCount) + " msgs · " + _toDisplayString(item.sourceLabel) + " · " + _toDisplayString(item.updatedAtLabel), 1 /* TEXT */)
                                    ])
                                  ], 8 /* PROPS */, ["onClick"]))
                                }), 128 /* KEYED_FRAGMENT */))
                              ]))
                        ]),
                        _createCommentVNode(" Top Paths "),
                        _createElementVNode("section", { class: "usage-paths-section" }, [
                          _createElementVNode("div", { class: "usage-card-title" }, _toDisplayString(_ctx.t('usage.paths.title')), 1 /* TEXT */),
                          (!_ctx.sessionUsageCharts.topPaths.length)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 0,
                                class: "usage-list-value"
                              }, _toDisplayString(_ctx.t('usage.paths.empty')), 1 /* TEXT */))
                            : (_openBlock(), _createElementBlock("div", {
                                key: 1,
                                class: "usage-list-paths"
                              }, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.sessionUsageCharts.topPaths, (item, index) => {
                                  return (_openBlock(), _createElementBlock("div", {
                                    key: item.path,
                                    class: "usage-list-path-row"
                                  }, [
                                    _createElementVNode("span", { class: "usage-list-path-rank" }, _toDisplayString(index + 1), 1 /* TEXT */),
                                    _createElementVNode("div", { class: "usage-list-path-content" }, [
                                      _createElementVNode("div", {
                                        class: "usage-list-path",
                                        title: item.path
                                      }, _toDisplayString(item.path), 9 /* TEXT, PROPS */, ["title"]),
                                      _createElementVNode("div", { class: "usage-list-path-stat" }, _toDisplayString(item.count), 1 /* TEXT */)
                                    ])
                                  ]))
                                }), 128 /* KEYED_FRAGMENT */))
                              ]))
                        ])
                      ])
                    ], 2 /* CLASS */))
          ], 512 /* NEED_PATCH */), [
            [_vShow, _ctx.mainTab === 'usage']
          ]),
          (_ctx.taskOrchestrationTabEnabled)
            ? _withDirectives((_openBlock(), _createElementBlock("div", {
                key: 0,
                class: "mode-content",
                id: "panel-orchestration",
                role: "tabpanel",
                "aria-labelledby": "tab-orchestration"
              }, [
                _createElementVNode("section", { class: "selector-section task-hero-card" }, [
                  _createElementVNode("div", { class: "task-hero-main" }, [
                    _createElementVNode("div", null, [
                      _createElementVNode("div", { class: "task-hero-kicker" }, _toDisplayString(_ctx.t('orchestration.hero.kicker')), 1 /* TEXT */),
                      _createElementVNode("div", { class: "selector-title" }, _toDisplayString(_ctx.t('orchestration.hero.title')), 1 /* TEXT */),
                      _createElementVNode("div", { class: "skills-panel-note task-hero-copy" }, _toDisplayString(_ctx.t('orchestration.hero.subtitle')), 1 /* TEXT */)
                    ]),
                    _createElementVNode("div", { class: "task-hero-actions settings-tab-actions task-header-actions" }, [
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-tool btn-tool-compact",
                        onClick: $event => (_ctx.loadTaskOrchestrationOverview({ forceRefresh: true, includeDetail: true })),
                        disabled: _ctx.taskOrchestration.loading
                      }, _toDisplayString(_ctx.taskOrchestration.loading ? _ctx.t('common.refreshing') : _ctx.t('common.refresh')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-tool btn-tool-compact",
                        onClick: $event => (_ctx.resetTaskOrchestrationDraft()),
                        disabled: _ctx.taskOrchestration.running || _ctx.taskOrchestration.queueAdding || _ctx.taskOrchestration.planning
                      }, _toDisplayString(_ctx.t('orchestration.draft.reset')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                      _createElementVNode("button", {
                        type: "button",
                        class: "btn-tool btn-tool-compact",
                        onClick: $event => (_ctx.switchMainTab('dashboard')),
                        disabled: _ctx.loading || !!_ctx.initError
                      }, _toDisplayString(_ctx.t('dashboard.doctor.title')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                    ])
                  ]),
                  (_ctx.taskOrchestrationQueueStats.running || _ctx.taskOrchestrationQueueStats.queued || _ctx.taskOrchestration.runs.length)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "task-hero-meta-strip",
                        "aria-label": _ctx.t('orchestration.summary.aria')
                      }, [
                        _createElementVNode("div", { class: "task-hero-meta" }, [
                          _createTextVNode(_toDisplayString(_ctx.t('orchestration.summary.running')) + " ", 1 /* TEXT */),
                          _createElementVNode("strong", null, _toDisplayString(_ctx.taskOrchestrationQueueStats.running), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", { class: "task-hero-meta" }, [
                          _createTextVNode(_toDisplayString(_ctx.t('orchestration.summary.queued')) + " ", 1 /* TEXT */),
                          _createElementVNode("strong", null, _toDisplayString(_ctx.taskOrchestrationQueueStats.queued), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", { class: "task-hero-meta" }, [
                          _createTextVNode(_toDisplayString(_ctx.t('orchestration.summary.runs')) + " ", 1 /* TEXT */),
                          _createElementVNode("strong", null, _toDisplayString(_ctx.taskOrchestration.runs.length), 1 /* TEXT */)
                        ])
                      ], 8 /* PROPS */, ["aria-label"]))
                    : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("div", { class: "task-layout-grid task-layout-grid-primary" }, [
                  _createElementVNode("section", { class: "selector-section task-compose-flow-card" }, [
                    _createElementVNode("div", { class: "task-flow-section task-flow-section-compact" }, [
                      _createElementVNode("div", { class: "task-flow-head" }, [
                        _createElementVNode("div", { class: "task-flow-step" }, "1"),
                        _createElementVNode("div", null, [
                          _createElementVNode("div", { class: "task-flow-title" }, _toDisplayString(_ctx.t('orchestration.step1.title')), 1 /* TEXT */),
                          _createElementVNode("div", { class: "task-flow-copy" }, _toDisplayString(_ctx.t('orchestration.step1.subtitle')), 1 /* TEXT */)
                        ])
                      ]),
                      (!_ctx.taskOrchestration.target.trim())
                        ? (_openBlock(), _createElementBlock("details", {
                            key: 0,
                            class: "task-template-panel"
                          }, [
                            _createElementVNode("summary", { class: "task-advanced-summary" }, _toDisplayString(_ctx.t('orchestration.templates.title')), 1 /* TEXT */),
                            _createElementVNode("div", { class: "task-template-block" }, [
                              _createElementVNode("div", { class: "task-template-chip-group" }, [
                                _createElementVNode("button", {
                                  type: "button",
                                  class: "task-template-chip",
                                  onClick: $event => {_ctx.taskOrchestration.target = _ctx.t('orchestration.templates.reviewFix.target'); _ctx.taskOrchestration.selectedEngine = 'codex'; _ctx.taskOrchestration.workflowIdsText = ''; _ctx.taskOrchestration.notes = _ctx.t('orchestration.templates.reviewFix.notes'); _ctx.taskOrchestration.followUpsText = _ctx.t('orchestration.templates.reviewFix.followUps')}
                                }, _toDisplayString(_ctx.t('orchestration.templates.reviewFix.label')), 9 /* TEXT, PROPS */, ["onClick"]),
                                _createElementVNode("button", {
                                  type: "button",
                                  class: "task-template-chip",
                                  onClick: $event => {_ctx.taskOrchestration.target = _ctx.t('orchestration.templates.planOnly.target'); _ctx.taskOrchestration.selectedEngine = 'codex'; _ctx.taskOrchestration.workflowIdsText = ''; _ctx.taskOrchestration.notes = _ctx.t('orchestration.templates.planOnly.notes'); _ctx.taskOrchestration.followUpsText = ''}
                                }, _toDisplayString(_ctx.t('orchestration.templates.planOnly.label')), 9 /* TEXT, PROPS */, ["onClick"]),
                                _createElementVNode("button", {
                                  type: "button",
                                  class: "task-template-chip",
                                  onClick: $event => {_ctx.taskOrchestration.target = _ctx.t('orchestration.templates.workflowBatch.target'); _ctx.taskOrchestration.selectedEngine = 'workflow'; _ctx.taskOrchestration.workflowIdsText = _ctx.t('orchestration.templates.workflowBatch.workflowIds'); _ctx.taskOrchestration.notes = _ctx.t('orchestration.templates.workflowBatch.notes'); _ctx.taskOrchestration.followUpsText = ''}
                                }, _toDisplayString(_ctx.t('orchestration.templates.workflowBatch.label')), 9 /* TEXT, PROPS */, ["onClick"])
                              ])
                            ])
                          ]))
                        : _createCommentVNode("v-if", true),
                      _createElementVNode("div", { class: "selector-grid task-composer-grid task-composer-grid-primary" }, [
                        _createElementVNode("label", { class: "selector-field task-field task-field-wide task-goal-field" }, [
                          _createElementVNode("span", { class: "selector-label" }, _toDisplayString(_ctx.t('orchestration.fields.target')), 1 /* TEXT */),
                          _withDirectives(_createElementVNode("textarea", {
                            "onUpdate:modelValue": $event => ((_ctx.taskOrchestration.target) = $event),
                            class: "task-textarea task-textarea-goal",
                            rows: "5",
                            placeholder: _ctx.t('orchestration.fields.target.placeholder')
                          }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                            [_vModelText, _ctx.taskOrchestration.target]
                          ]),
                          _createElementVNode("span", { class: "task-field-hint" }, _toDisplayString(_ctx.t('orchestration.fields.target.hint')), 1 /* TEXT */)
                        ])
                      ]),
                      _createElementVNode("div", { class: "task-draft-overview task-draft-inline" }, [
                        _createElementVNode("div", { class: "task-draft-inline-head" }, [
                          _createElementVNode("span", {
                            class: _normalizeClass(['pill', _ctx.taskOrchestrationDraftReadiness.tone])
                          }, _toDisplayString(_ctx.taskOrchestrationDraftReadiness.title), 3 /* TEXT, CLASS */),
                          _createElementVNode("div", { class: "task-readiness-copy task-draft-inline-copy" }, _toDisplayString(_ctx.taskOrchestrationDraftReadiness.summary), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", { class: "task-config-strip" }, [
                          _createElementVNode("div", { class: "task-config-pill" }, _toDisplayString(_ctx.taskOrchestration.selectedEngine === 'workflow' ? _ctx.t('orchestration.engine.workflow') : _ctx.t('orchestration.engine.codex')), 1 /* TEXT */),
                          _createElementVNode("div", { class: "task-config-pill" }, _toDisplayString(_ctx.taskOrchestration.runMode === 'dry-run' ? _ctx.t('orchestration.runMode.dryRun') : (_ctx.taskOrchestration.runMode === 'read' ? _ctx.t('orchestration.runMode.readOnly') : _ctx.t('orchestration.runMode.write'))), 1 /* TEXT */),
                          (_ctx.taskOrchestration.title.trim())
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 0,
                                class: "task-config-pill"
                              }, _toDisplayString(_ctx.t('orchestration.pills.hasTitle')), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true),
                          (_ctx.taskOrchestration.selectedEngine === 'workflow' && _ctx.taskOrchestrationDraftMetrics.workflowCount > 0)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 1,
                                class: "task-config-pill"
                              }, _toDisplayString(_ctx.t('orchestration.pills.workflowCount', { count: _ctx.taskOrchestrationDraftMetrics.workflowCount })), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true),
                          (_ctx.taskOrchestration.plan)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 2,
                                class: "task-config-pill"
                              }, _toDisplayString(_ctx.t('orchestration.pills.planNodes', { count: _ctx.taskOrchestrationDraftMetrics.planNodeCount })), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true)
                        ])
                      ])
                    ]),
                    _createElementVNode("div", { class: "task-flow-section task-flow-section-compact" }, [
                      _createElementVNode("div", { class: "task-flow-head" }, [
                        _createElementVNode("div", { class: "task-flow-step" }, "2"),
                        _createElementVNode("div", null, [
                          _createElementVNode("div", { class: "task-flow-title" }, _toDisplayString(_ctx.t('orchestration.step2.title')), 1 /* TEXT */),
                          _createElementVNode("div", { class: "task-flow-copy" }, _toDisplayString(_ctx.t('orchestration.step2.subtitle')), 1 /* TEXT */)
                        ])
                      ]),
                      _createElementVNode("div", { class: "selector-grid task-composer-grid task-composer-grid-compact task-composer-grid-inline" }, [
                        _createElementVNode("label", { class: "selector-field" }, [
                          _createElementVNode("span", { class: "selector-label" }, _toDisplayString(_ctx.t('orchestration.fields.engine')), 1 /* TEXT */),
                          _withDirectives(_createElementVNode("select", {
                            "onUpdate:modelValue": $event => ((_ctx.taskOrchestration.selectedEngine) = $event),
                            class: "provider-fast-switch-select",
                            disabled: ""
                          }, [
                            _createElementVNode("option", { value: "codex" }, _toDisplayString(_ctx.t('orchestration.engine.codex')), 1 /* TEXT */),
                            _createElementVNode("option", { value: "workflow" }, _toDisplayString(_ctx.t('orchestration.engine.workflow')), 1 /* TEXT */)
                          ], 8 /* PROPS */, ["onUpdate:modelValue"]), [
                            [_vModelSelect, _ctx.taskOrchestration.selectedEngine]
                          ])
                        ]),
                        _createElementVNode("label", { class: "selector-field" }, [
                          _createElementVNode("span", { class: "selector-label" }, _toDisplayString(_ctx.t('orchestration.fields.runMode')), 1 /* TEXT */),
                          _withDirectives(_createElementVNode("select", {
                            "onUpdate:modelValue": $event => ((_ctx.taskOrchestration.runMode) = $event),
                            class: "provider-fast-switch-select",
                            disabled: ""
                          }, [
                            _createElementVNode("option", { value: "write" }, _toDisplayString(_ctx.t('orchestration.runMode.write')), 1 /* TEXT */),
                            _createElementVNode("option", { value: "read" }, _toDisplayString(_ctx.t('orchestration.runMode.readOnly')), 1 /* TEXT */),
                            _createElementVNode("option", { value: "dry-run" }, _toDisplayString(_ctx.t('orchestration.runMode.dryRun')), 1 /* TEXT */)
                          ], 8 /* PROPS */, ["onUpdate:modelValue"]), [
                            [_vModelSelect, _ctx.taskOrchestration.runMode]
                          ])
                        ])
                      ]),
                      _createElementVNode("details", { class: "task-advanced-panel" }, [
                        _createElementVNode("summary", { class: "task-advanced-summary" }, _toDisplayString(_ctx.t('orchestration.advanced.title')), 1 /* TEXT */),
                        _createElementVNode("div", { class: "selector-grid task-composer-grid task-composer-grid-secondary" }, [
                          _createElementVNode("label", { class: "selector-field task-field-wide" }, [
                            _createElementVNode("span", { class: "selector-label" }, _toDisplayString(_ctx.t('orchestration.fields.title')), 1 /* TEXT */),
                            _withDirectives(_createElementVNode("input", {
                              "onUpdate:modelValue": $event => ((_ctx.taskOrchestration.title) = $event),
                              class: "model-input",
                              type: "text",
                              placeholder: _ctx.t('orchestration.fields.title.placeholder')
                            }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                              [_vModelText, _ctx.taskOrchestration.title]
                            ])
                          ]),
                          _createElementVNode("label", { class: "selector-field task-field-wide" }, [
                            _createElementVNode("span", { class: "selector-label" }, _toDisplayString(_ctx.t('orchestration.fields.notes')), 1 /* TEXT */),
                            _withDirectives(_createElementVNode("textarea", {
                              "onUpdate:modelValue": $event => ((_ctx.taskOrchestration.notes) = $event),
                              class: "task-textarea",
                              rows: "3",
                              placeholder: _ctx.t('orchestration.fields.notes.placeholder')
                            }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                              [_vModelText, _ctx.taskOrchestration.notes]
                            ]),
                            _createElementVNode("span", { class: "task-field-hint" }, _toDisplayString(_ctx.t('orchestration.fields.notes.hint')), 1 /* TEXT */)
                          ]),
                          _createElementVNode("label", { class: "selector-field task-field-wide" }, [
                            _createElementVNode("span", { class: "selector-label" }, _toDisplayString(_ctx.t('orchestration.fields.followUps')), 1 /* TEXT */),
                            _withDirectives(_createElementVNode("textarea", {
                              "onUpdate:modelValue": $event => ((_ctx.taskOrchestration.followUpsText) = $event),
                              class: "task-textarea",
                              rows: "3",
                              placeholder: _ctx.t('orchestration.fields.followUps.placeholder')
                            }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                              [_vModelText, _ctx.taskOrchestration.followUpsText]
                            ])
                          ]),
                          _createElementVNode("label", { class: "selector-field" }, [
                            _createElementVNode("span", { class: "selector-label" }, _toDisplayString(_ctx.t('orchestration.fields.concurrency')), 1 /* TEXT */),
                            _withDirectives(_createElementVNode("input", {
                              "onUpdate:modelValue": $event => ((_ctx.taskOrchestration.concurrency) = $event),
                              class: "model-input",
                              type: "number",
                              min: "1",
                              max: "8"
                            }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                              [_vModelText, _ctx.taskOrchestration.concurrency]
                            ]),
                            _createElementVNode("span", { class: "task-field-hint" }, _toDisplayString(_ctx.t('orchestration.fields.concurrency.hint')), 1 /* TEXT */)
                          ]),
                          _createElementVNode("label", { class: "selector-field" }, [
                            _createElementVNode("span", { class: "selector-label" }, _toDisplayString(_ctx.t('orchestration.fields.autoFixRounds')), 1 /* TEXT */),
                            _withDirectives(_createElementVNode("input", {
                              "onUpdate:modelValue": $event => ((_ctx.taskOrchestration.autoFixRounds) = $event),
                              class: "model-input",
                              type: "number",
                              min: "0",
                              max: "5"
                            }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                              [_vModelText, _ctx.taskOrchestration.autoFixRounds]
                            ]),
                            _createElementVNode("span", { class: "task-field-hint" }, _toDisplayString(_ctx.t('orchestration.fields.autoFixRounds.hint')), 1 /* TEXT */)
                          ]),
                          (_ctx.taskOrchestration.selectedEngine === 'workflow')
                            ? (_openBlock(), _createElementBlock("label", {
                                key: 0,
                                class: "selector-field task-field-wide"
                              }, [
                                _createElementVNode("span", { class: "selector-label" }, _toDisplayString(_ctx.t('orchestration.fields.workflowIds')), 1 /* TEXT */),
                                _withDirectives(_createElementVNode("textarea", {
                                  "onUpdate:modelValue": $event => ((_ctx.taskOrchestration.workflowIdsText) = $event),
                                  class: "task-textarea",
                                  rows: "3",
                                  placeholder: _ctx.t('orchestration.fields.workflowIds.placeholder')
                                }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                                  [_vModelText, _ctx.taskOrchestration.workflowIdsText]
                                ]),
                                _createElementVNode("span", { class: "task-field-hint" }, _toDisplayString(_ctx.t('orchestration.fields.workflowIds.hint', { count: _ctx.taskOrchestration.workflows.length })), 1 /* TEXT */),
                                (_ctx.taskOrchestration.workflows.length)
                                  ? (_openBlock(), _createElementBlock("div", {
                                      key: 0,
                                      class: "task-workflow-suggestions"
                                    }, [
                                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.taskOrchestration.workflows, (workflow) => {
                                        return (_openBlock(), _createElementBlock("button", {
                                          key: workflow.id || workflow.name,
                                          type: "button",
                                          class: "task-workflow-chip",
                                          onClick: $event => (_ctx.appendTaskWorkflowId(workflow.id || workflow.name))
                                        }, [
                                          _createElementVNode("span", null, _toDisplayString(workflow.name || workflow.id), 1 /* TEXT */),
                                          (workflow.stepCount)
                                            ? (_openBlock(), _createElementBlock("small", { key: 0 }, _toDisplayString(_ctx.t('orchestration.workflow.stepCount', { count: workflow.stepCount })), 1 /* TEXT */))
                                            : _createCommentVNode("v-if", true)
                                        ], 8 /* PROPS */, ["onClick"]))
                                      }), 128 /* KEYED_FRAGMENT */))
                                    ]))
                                  : _createCommentVNode("v-if", true)
                              ]))
                            : _createCommentVNode("v-if", true)
                        ])
                      ])
                    ]),
                    _createElementVNode("div", { class: "task-flow-section task-flow-section-actions task-flow-section-compact" }, [
                      _createElementVNode("div", { class: "task-flow-head" }, [
                        _createElementVNode("div", { class: "task-flow-step" }, "3"),
                        _createElementVNode("div", null, [
                          _createElementVNode("div", { class: "task-flow-title" }, _toDisplayString(_ctx.t('orchestration.step3.title')), 1 /* TEXT */),
                          _createElementVNode("div", { class: "task-flow-copy" }, _toDisplayString(_ctx.t('orchestration.step3.subtitle')), 1 /* TEXT */)
                        ])
                      ]),
                      _createElementVNode("div", { class: "task-action-row task-action-row-prominent" }, [
                        _createElementVNode("button", {
                          type: "button",
                          class: "btn-tool task-action-preview",
                          onClick: $event => (_ctx.previewTaskPlan()),
                          disabled: _ctx.taskOrchestration.planning || _ctx.taskOrchestration.running || !_ctx.taskOrchestration.target.trim()
                        }, _toDisplayString(_ctx.taskOrchestration.planning ? _ctx.t('orchestration.actions.planning') : _ctx.t('orchestration.actions.previewOnly')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                        _createElementVNode("div", { class: "task-action-row-right task-action-row-right-prominent" }, [
                          _createElementVNode("button", {
                            type: "button",
                            class: "btn-tool btn-primary",
                            onClick: $event => (_ctx.planAndRunTaskOrchestration()),
                            disabled: _ctx.taskOrchestration.running || _ctx.taskOrchestration.planning || !_ctx.taskOrchestration.target.trim()
                          }, _toDisplayString((_ctx.taskOrchestration.running || _ctx.taskOrchestration.planning) ? _ctx.t('orchestration.actions.preparing') : (_ctx.taskOrchestration.runMode === 'dry-run' ? _ctx.t('orchestration.actions.generatePlan') : _ctx.t('orchestration.actions.planAndRun'))), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                          _createElementVNode("button", {
                            type: "button",
                            class: "btn-tool",
                            onClick: $event => (_ctx.queueTaskOrchestrationAndStart()),
                            disabled: _ctx.taskOrchestration.queueAdding || _ctx.taskOrchestration.queueStarting || _ctx.taskOrchestration.planning || !_ctx.taskOrchestration.target.trim()
                          }, _toDisplayString((_ctx.taskOrchestration.queueAdding || _ctx.taskOrchestration.queueStarting) ? _ctx.t('orchestration.actions.processing') : _ctx.t('orchestration.actions.queueAndStart')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                        ])
                      ]),
                      _createElementVNode("div", { class: "task-action-caption" }, _toDisplayString(_ctx.t('orchestration.actions.caption')), 1 /* TEXT */)
                    ])
                  ])
                ]),
                (!(_ctx.taskOrchestration.plan || _ctx.taskOrchestration.planIssues.length || _ctx.taskOrchestration.planWarnings.length || _ctx.taskOrchestration.lastError || _ctx.taskOrchestration.queue.length || _ctx.taskOrchestration.runs.length || _ctx.taskOrchestration.selectedRunId || _ctx.taskOrchestration.selectedRunError))
                  ? (_openBlock(), _createElementBlock("section", {
                      key: 0,
                      class: "selector-section task-stage-card"
                    }, [
                      _createElementVNode("div", { class: "task-stage-empty" }, [
                        _createElementVNode("div", null, [
                          _createElementVNode("div", { class: "selector-title" }, _toDisplayString(_ctx.t('orchestration.stage.title')), 1 /* TEXT */),
                          _createElementVNode("div", { class: "skills-panel-note" }, _toDisplayString(_ctx.t('orchestration.stage.subtitle')), 1 /* TEXT */)
                        ]),
                        _createElementVNode("div", { class: "task-stage-strip" }, [
                          _createElementVNode("div", { class: "task-stage-pill" }, _toDisplayString(_ctx.t('orchestration.stage.pill.target')), 1 /* TEXT */),
                          _createElementVNode("div", { class: "task-stage-pill" }, _toDisplayString(_ctx.t('orchestration.stage.pill.preview')), 1 /* TEXT */),
                          _createElementVNode("div", { class: "task-stage-pill" }, _toDisplayString(_ctx.t('orchestration.stage.pill.run')), 1 /* TEXT */)
                        ])
                      ])
                    ]))
                  : (_openBlock(), _createElementBlock("div", {
                      key: 1,
                      class: "task-layout-grid task-layout-grid-secondary"
                    }, [
                      (_ctx.taskOrchestration.plan || _ctx.taskOrchestration.planIssues.length || _ctx.taskOrchestration.planWarnings.length || _ctx.taskOrchestration.lastError)
                        ? (_openBlock(), _createElementBlock("section", {
                            key: 0,
                            class: "selector-section task-plan-card"
                          }, [
                            (_ctx.taskOrchestration.lastError)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  class: "task-issue-item"
                                }, _toDisplayString(_ctx.taskOrchestration.lastError), 1 /* TEXT */))
                              : _createCommentVNode("v-if", true),
                            _createElementVNode("div", { class: "selector-header task-section-header" }, [
                              _createElementVNode("div", null, [
                                _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('orchestration.plan.title')), 1 /* TEXT */),
                                _createElementVNode("div", { class: "skills-panel-note" }, _toDisplayString(_ctx.t('orchestration.plan.subtitle')), 1 /* TEXT */)
                              ])
                            ]),
                            (_ctx.taskOrchestration.planIssues.length)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 1,
                                  class: "task-issues-list"
                                }, [
                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.taskOrchestration.planIssues, (issue) => {
                                    return (_openBlock(), _createElementBlock("div", {
                                      key: issue.code + issue.message,
                                      class: "task-issue-item"
                                    }, _toDisplayString(issue.message), 1 /* TEXT */))
                                  }), 128 /* KEYED_FRAGMENT */))
                                ]))
                              : _createCommentVNode("v-if", true),
                            (_ctx.taskOrchestration.planWarnings.length)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 2,
                                  class: "task-warning-list"
                                }, [
                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.taskOrchestration.planWarnings, (warning) => {
                                    return (_openBlock(), _createElementBlock("div", {
                                      key: warning,
                                      class: "task-warning-item"
                                    }, _toDisplayString(warning), 1 /* TEXT */))
                                  }), 128 /* KEYED_FRAGMENT */))
                                ]))
                              : _createCommentVNode("v-if", true),
                            (_ctx.taskOrchestration.plan)
                              ? (_openBlock(), _createElementBlock(_Fragment, { key: 3 }, [
                                  _createElementVNode("div", { class: "task-plan-summary-strip" }, [
                                    _createElementVNode("div", { class: "task-plan-summary-item" }, [
                                      _createElementVNode("span", { class: "task-plan-summary-label" }, _toDisplayString(_ctx.t('orchestration.plan.summary.nodes')), 1 /* TEXT */),
                                      _createElementVNode("strong", null, _toDisplayString(_ctx.taskOrchestration.plan.nodes.length), 1 /* TEXT */)
                                    ]),
                                    _createElementVNode("div", { class: "task-plan-summary-item" }, [
                                      _createElementVNode("span", { class: "task-plan-summary-label" }, _toDisplayString(_ctx.t('orchestration.plan.summary.waves')), 1 /* TEXT */),
                                      _createElementVNode("strong", null, _toDisplayString(_ctx.taskOrchestration.plan.waves.length), 1 /* TEXT */)
                                    ]),
                                    _createElementVNode("div", { class: "task-plan-summary-item" }, [
                                      _createElementVNode("span", { class: "task-plan-summary-label" }, _toDisplayString(_ctx.t('orchestration.plan.summary.engine')), 1 /* TEXT */),
                                      _createElementVNode("strong", null, _toDisplayString(_ctx.taskOrchestration.plan.engine), 1 /* TEXT */)
                                    ])
                                  ]),
                                  _createElementVNode("div", { class: "task-wave-list" }, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.taskOrchestration.plan.waves, (wave) => {
                                      return (_openBlock(), _createElementBlock("div", {
                                        key: wave.label,
                                        class: "task-wave-card"
                                      }, [
                                        _createElementVNode("div", { class: "task-wave-title" }, _toDisplayString(wave.label), 1 /* TEXT */),
                                        _createElementVNode("div", { class: "task-wave-nodes" }, _toDisplayString(wave.nodeIds.join(', ')), 1 /* TEXT */)
                                      ]))
                                    }), 128 /* KEYED_FRAGMENT */))
                                  ]),
                                  _createElementVNode("div", { class: "task-node-list" }, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.taskOrchestration.plan.nodes, (node) => {
                                      return (_openBlock(), _createElementBlock("div", {
                                        key: node.id,
                                        class: "task-node-card"
                                      }, [
                                        _createElementVNode("div", { class: "task-node-head" }, [
                                          _createElementVNode("div", null, [
                                            _createElementVNode("div", { class: "task-node-title" }, _toDisplayString(node.title || node.id), 1 /* TEXT */),
                                            _createElementVNode("div", { class: "task-node-meta" }, [
                                              _createTextVNode(_toDisplayString(node.id) + " · " + _toDisplayString(node.kind), 1 /* TEXT */),
                                              (node.workflowId)
                                                ? (_openBlock(), _createElementBlock("span", { key: 0 }, " · " + _toDisplayString(node.workflowId), 1 /* TEXT */))
                                                : _createCommentVNode("v-if", true)
                                            ])
                                          ]),
                                          _createElementVNode("span", {
                                            class: _normalizeClass(['pill', node.write ? 'configured' : 'empty'])
                                          }, _toDisplayString(node.write ? _ctx.t('orchestration.plan.node.write') : _ctx.t('orchestration.plan.node.readOnly')), 3 /* TEXT, CLASS */)
                                        ]),
                                        _createElementVNode("div", { class: "task-node-deps" }, _toDisplayString(_ctx.t('orchestration.labels.dependencies')) + _toDisplayString(_ctx.formatTaskNodeDependencies(node)), 1 /* TEXT */)
                                      ]))
                                    }), 128 /* KEYED_FRAGMENT */))
                                  ])
                                ], 64 /* STABLE_FRAGMENT */))
                              : _createCommentVNode("v-if", true)
                          ]))
                        : _createCommentVNode("v-if", true),
                      (_ctx.taskOrchestration.queue.length || _ctx.taskOrchestration.runs.length || _ctx.taskOrchestration.selectedRunId || _ctx.taskOrchestration.selectedRunError)
                        ? (_openBlock(), _createElementBlock("section", {
                            key: 1,
                            class: "selector-section task-workbench-card"
                          }, [
                            _createElementVNode("div", { class: "selector-header task-section-header" }, [
                              _createElementVNode("div", null, [
                                _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('orchestration.workbench.title')), 1 /* TEXT */),
                                _createElementVNode("div", { class: "skills-panel-note" }, _toDisplayString(_ctx.t('orchestration.workbench.subtitle')), 1 /* TEXT */)
                              ]),
                              _createElementVNode("div", { class: "settings-tab-actions task-header-actions" }, [
                                _createElementVNode("button", {
                                  type: "button",
                                  class: "btn-tool btn-tool-compact",
                                  onClick: $event => (_ctx.loadTaskOrchestrationOverview({ forceRefresh: true, includeDetail: true })),
                                  disabled: _ctx.taskOrchestration.loading
                                }, _toDisplayString(_ctx.taskOrchestration.loading ? _ctx.t('common.refreshing') : _ctx.t('common.refresh')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                                (_ctx.taskOrchestration.queue.length)
                                  ? (_openBlock(), _createElementBlock("button", {
                                      key: 0,
                                      type: "button",
                                      class: "btn-tool btn-tool-compact",
                                      onClick: $event => (_ctx.startTaskQueueRunner()),
                                      disabled: _ctx.taskOrchestration.queueStarting
                                    }, _toDisplayString(_ctx.taskOrchestration.queueStarting ? _ctx.t('orchestration.queue.starting') : _ctx.t('orchestration.queue.start')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]))
                                  : _createCommentVNode("v-if", true)
                              ])
                            ]),
                            ((_ctx.taskOrchestration.queue.length ? 1 : 0) + (_ctx.taskOrchestration.runs.length ? 1 : 0) + ((_ctx.taskOrchestration.selectedRunId || _ctx.taskOrchestration.selectedRunError) ? 1 : 0) > 1)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  class: "task-workbench-tabs",
                                  role: "group",
                                  "aria-label": _ctx.t('orchestration.workbench.tabs.aria')
                                }, [
                                  (_ctx.taskOrchestration.queue.length)
                                    ? (_openBlock(), _createElementBlock("button", {
                                        key: 0,
                                        type: "button",
                                        class: _normalizeClass(["task-workbench-tab", { active: _ctx.taskOrchestration.workspaceTab === 'queue' }]),
                                        onClick: $event => (_ctx.taskOrchestration.workspaceTab = 'queue')
                                      }, _toDisplayString(_ctx.t('orchestration.workbench.tabs.queue', { count: _ctx.taskOrchestration.queue.length })), 11 /* TEXT, CLASS, PROPS */, ["onClick"]))
                                    : _createCommentVNode("v-if", true),
                                  (_ctx.taskOrchestration.runs.length)
                                    ? (_openBlock(), _createElementBlock("button", {
                                        key: 1,
                                        type: "button",
                                        class: _normalizeClass(["task-workbench-tab", { active: _ctx.taskOrchestration.workspaceTab === 'runs' }]),
                                        onClick: $event => (_ctx.taskOrchestration.workspaceTab = 'runs')
                                      }, _toDisplayString(_ctx.t('orchestration.workbench.tabs.runs', { count: _ctx.taskOrchestration.runs.length })), 11 /* TEXT, CLASS, PROPS */, ["onClick"]))
                                    : _createCommentVNode("v-if", true),
                                  (_ctx.taskOrchestration.selectedRunId || _ctx.taskOrchestration.selectedRunError)
                                    ? (_openBlock(), _createElementBlock("button", {
                                        key: 2,
                                        type: "button",
                                        class: _normalizeClass(["task-workbench-tab", { active: _ctx.taskOrchestration.workspaceTab === 'detail' }]),
                                        onClick: $event => (_ctx.taskOrchestration.workspaceTab = 'detail')
                                      }, _toDisplayString(_ctx.t('orchestration.workbench.tabs.detail')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]))
                                    : _createCommentVNode("v-if", true)
                                ], 8 /* PROPS */, ["aria-label"]))
                              : _createCommentVNode("v-if", true),
                            (_ctx.taskOrchestration.workspaceTab === 'queue' || (!_ctx.taskOrchestration.runs.length && !_ctx.taskOrchestration.selectedRunId && !_ctx.taskOrchestration.selectedRunError))
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 1,
                                  class: "task-workbench-panel"
                                }, [
                                  (!_ctx.taskOrchestration.queue.length)
                                    ? (_openBlock(), _createElementBlock("div", {
                                        key: 0,
                                        class: "task-empty-state"
                                      }, [
                                        _createElementVNode("div", { class: "task-empty-title" }, _toDisplayString(_ctx.t('orchestration.queue.empty.title')), 1 /* TEXT */),
                                        _createElementVNode("div", { class: "task-empty-copy" }, _toDisplayString(_ctx.t('orchestration.queue.empty.subtitle')), 1 /* TEXT */)
                                      ]))
                                    : (_openBlock(), _createElementBlock("div", {
                                        key: 1,
                                        class: "task-runtime-list"
                                      }, [
                                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.taskOrchestration.queue, (item) => {
                                          return (_openBlock(), _createElementBlock("div", {
                                            key: item.taskId,
                                            class: _normalizeClass(['task-runtime-item', { active: item.lastRunId && _ctx.taskOrchestration.selectedRunId === item.lastRunId, clickable: !!item.lastRunId }]),
                                            role: item.lastRunId ? 'button' : null,
                                            tabindex: item.lastRunId ? 0 : -1,
                                            "aria-disabled": item.lastRunId ? null : 'true',
                                            onClick: $event => (item.lastRunId ? (_ctx.taskOrchestration.workspaceTab = 'detail', _ctx.selectTaskRun(item.lastRunId)) : null),
                                            onKeydown: [
                                              _withKeys(_withModifiers($event => (item.lastRunId ? (_ctx.taskOrchestration.workspaceTab = 'detail', _ctx.selectTaskRun(item.lastRunId)) : null), ["self","prevent"]), ["enter"]),
                                              _withKeys(_withModifiers($event => (item.lastRunId ? (_ctx.taskOrchestration.workspaceTab = 'detail', _ctx.selectTaskRun(item.lastRunId)) : null), ["self","prevent"]), ["space"])
                                            ]
                                          }, [
                                            _createElementVNode("div", { class: "task-runtime-item-main" }, [
                                              _createElementVNode("div", { class: "task-runtime-item-title" }, _toDisplayString(item.title || item.target || item.taskId), 1 /* TEXT */),
                                              _createElementVNode("div", { class: "task-runtime-item-meta" }, _toDisplayString(item.taskId) + " · " + _toDisplayString(item.updatedAt || item.createdAt), 1 /* TEXT */),
                                              (item.lastSummary)
                                                ? (_openBlock(), _createElementBlock("div", {
                                                    key: 0,
                                                    class: "task-runtime-item-summary"
                                                  }, _toDisplayString(item.lastSummary), 1 /* TEXT */))
                                                : _createCommentVNode("v-if", true)
                                            ]),
                                            _createElementVNode("div", { class: "task-runtime-item-actions" }, [
                                              _createElementVNode("span", {
                                                class: _normalizeClass(['pill', _ctx.taskRunStatusTone(item.status)])
                                              }, _toDisplayString(item.status), 3 /* TEXT, CLASS */),
                                              _createElementVNode("button", {
                                                type: "button",
                                                class: "btn-mini",
                                                onClick: _withModifiers($event => (_ctx.cancelTaskRunFromUi(item.taskId)), ["stop"]),
                                                disabled: item.status !== 'queued' && item.status !== 'running'
                                              }, _toDisplayString(_ctx.t('common.cancel')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                            ])
                                          ], 42 /* CLASS, PROPS, NEED_HYDRATION */, ["role", "tabindex", "aria-disabled", "onClick", "onKeydown"]))
                                        }), 128 /* KEYED_FRAGMENT */))
                                      ]))
                                ]))
                              : (_ctx.taskOrchestration.workspaceTab === 'runs' || (!_ctx.taskOrchestration.queue.length && _ctx.taskOrchestration.runs.length && !_ctx.taskOrchestration.selectedRunId && !_ctx.taskOrchestration.selectedRunError))
                                ? (_openBlock(), _createElementBlock("div", {
                                    key: 2,
                                    class: "task-workbench-panel"
                                  }, [
                                    (!_ctx.taskOrchestration.runs.length)
                                      ? (_openBlock(), _createElementBlock("div", {
                                          key: 0,
                                          class: "task-empty-state"
                                        }, [
                                          _createElementVNode("div", { class: "task-empty-title" }, _toDisplayString(_ctx.t('orchestration.runs.empty.title')), 1 /* TEXT */),
                                          _createElementVNode("div", { class: "task-empty-copy" }, _toDisplayString(_ctx.t('orchestration.runs.empty.subtitle')), 1 /* TEXT */)
                                        ]))
                                      : (_openBlock(), _createElementBlock("div", {
                                          key: 1,
                                          class: "task-runtime-list"
                                        }, [
                                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.taskOrchestration.runs, (item) => {
                                            return (_openBlock(), _createElementBlock("button", {
                                              key: item.runId,
                                              type: "button",
                                              class: _normalizeClass(['task-runtime-item', { active: _ctx.taskOrchestration.selectedRunId === item.runId }]),
                                              onClick: $event => {_ctx.taskOrchestration.workspaceTab = 'detail'; _ctx.selectTaskRun(item.runId)}
                                            }, [
                                              _createElementVNode("div", { class: "task-runtime-item-main" }, [
                                                _createElementVNode("div", { class: "task-runtime-item-title" }, _toDisplayString(item.title || item.taskId || item.runId), 1 /* TEXT */),
                                                _createElementVNode("div", { class: "task-runtime-item-meta" }, _toDisplayString(item.runId) + " · " + _toDisplayString(item.durationMs || 0) + "ms", 1 /* TEXT */),
                                                (item.summary)
                                                  ? (_openBlock(), _createElementBlock("div", {
                                                      key: 0,
                                                      class: "task-runtime-item-summary"
                                                    }, _toDisplayString(item.summary), 1 /* TEXT */))
                                                  : _createCommentVNode("v-if", true)
                                              ]),
                                              _createElementVNode("div", { class: "task-runtime-item-actions" }, [
                                                _createElementVNode("span", {
                                                  class: _normalizeClass(['pill', _ctx.taskRunStatusTone(item.status)])
                                                }, _toDisplayString(item.status), 3 /* TEXT, CLASS */)
                                              ])
                                            ], 10 /* CLASS, PROPS */, ["onClick"]))
                                          }), 128 /* KEYED_FRAGMENT */))
                                        ]))
                                  ]))
                                : (_openBlock(), _createElementBlock("div", {
                                    key: 3,
                                    class: "task-workbench-panel"
                                  }, [
                                    _createElementVNode("div", { class: "task-detail-toolbar settings-tab-actions" }, [
                                      _createElementVNode("button", {
                                        type: "button",
                                        class: "btn-tool btn-tool-compact",
                                        onClick: $event => (_ctx.taskOrchestration.selectedRunId ? _ctx.loadTaskRunDetail(_ctx.taskOrchestration.selectedRunId) : null),
                                        disabled: !_ctx.taskOrchestration.selectedRunId || _ctx.taskOrchestration.selectedRunLoading
                                      }, _toDisplayString(_ctx.taskOrchestration.selectedRunLoading ? _ctx.t('common.refreshing') : _ctx.t('orchestration.detail.refresh')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                                      _createElementVNode("button", {
                                        type: "button",
                                        class: "btn-tool btn-tool-compact",
                                        onClick: $event => (_ctx.retryTaskRunFromUi(_ctx.taskOrchestration.selectedRunId)),
                                        disabled: !_ctx.taskOrchestration.selectedRunId || _ctx.taskOrchestration.retrying
                                      }, _toDisplayString(_ctx.taskOrchestration.retrying ? _ctx.t('orchestration.detail.retrying') : _ctx.t('orchestration.detail.retry')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                                      _createElementVNode("button", {
                                        type: "button",
                                        class: "btn-tool btn-tool-compact",
                                        onClick: $event => (_ctx.cancelTaskRunFromUi(_ctx.taskOrchestration.selectedRunId)),
                                        disabled: !_ctx.taskOrchestrationSelectedRun || !_ctx.taskOrchestrationSelectedRun.run || !_ctx.isTaskRunActive(_ctx.taskOrchestrationSelectedRun.run.status)
                                      }, _toDisplayString(_ctx.t('common.cancel')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                    ]),
                                    (_ctx.taskOrchestration.selectedRunError)
                                      ? (_openBlock(), _createElementBlock("div", {
                                          key: 0,
                                          class: "task-issue-item"
                                        }, _toDisplayString(_ctx.taskOrchestration.selectedRunError), 1 /* TEXT */))
                                      : _createCommentVNode("v-if", true),
                                    (!_ctx.taskOrchestrationSelectedRun)
                                      ? (_openBlock(), _createElementBlock("div", {
                                          key: 1,
                                          class: "task-empty-state"
                                        }, [
                                          _createElementVNode("div", { class: "task-empty-title" }, _toDisplayString(_ctx.t('orchestration.detail.empty.title')), 1 /* TEXT */),
                                          _createElementVNode("div", { class: "task-empty-copy" }, _toDisplayString(_ctx.t('orchestration.detail.empty.subtitle')), 1 /* TEXT */)
                                        ]))
                                      : (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                                          _createElementVNode("div", { class: "task-detail-summary-strip" }, [
                                            _createElementVNode("div", { class: "task-plan-summary-item" }, [
                                              _createElementVNode("span", { class: "task-plan-summary-label" }, _toDisplayString(_ctx.t('orchestration.detail.summary.status')), 1 /* TEXT */),
                                              _createElementVNode("strong", null, _toDisplayString(_ctx.taskOrchestrationSelectedRun.run.status), 1 /* TEXT */)
                                            ]),
                                            _createElementVNode("div", { class: "task-plan-summary-item" }, [
                                              _createElementVNode("span", { class: "task-plan-summary-label" }, _toDisplayString(_ctx.t('orchestration.detail.summary.duration')), 1 /* TEXT */),
                                              _createElementVNode("strong", null, _toDisplayString(_ctx.taskOrchestrationSelectedRun.run.durationMs || 0) + "ms", 1 /* TEXT */)
                                            ]),
                                            _createElementVNode("div", { class: "task-plan-summary-item" }, [
                                              _createElementVNode("span", { class: "task-plan-summary-label" }, _toDisplayString(_ctx.t('orchestration.detail.summary.nodes')), 1 /* TEXT */),
                                              _createElementVNode("strong", null, _toDisplayString(_ctx.taskOrchestrationSelectedRunNodes.length), 1 /* TEXT */)
                                            ]),
                                            _createElementVNode("div", { class: "task-plan-summary-item" }, [
                                              _createElementVNode("span", { class: "task-plan-summary-label" }, _toDisplayString(_ctx.t('orchestration.detail.summary.summary')), 1 /* TEXT */),
                                              _createElementVNode("strong", null, _toDisplayString(_ctx.taskOrchestrationSelectedRun.run.summary || _ctx.t('common.none')), 1 /* TEXT */)
                                            ])
                                          ]),
                                          (_ctx.taskOrchestrationSelectedRun.run.error)
                                            ? (_openBlock(), _createElementBlock("div", {
                                                key: 0,
                                                class: "task-issue-item"
                                              }, _toDisplayString(_ctx.taskOrchestrationSelectedRun.run.error), 1 /* TEXT */))
                                            : _createCommentVNode("v-if", true),
                                          _createElementVNode("div", { class: "task-node-list" }, [
                                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.taskOrchestrationSelectedRunNodes, (node) => {
                                              return (_openBlock(), _createElementBlock("div", {
                                                key: node.id,
                                                class: "task-node-card task-node-card-detail"
                                              }, [
                                                _createElementVNode("div", { class: "task-node-head" }, [
                                                  _createElementVNode("div", null, [
                                                    _createElementVNode("div", { class: "task-node-title" }, _toDisplayString(node.title || node.id), 1 /* TEXT */),
                                                    _createElementVNode("div", { class: "task-node-meta" }, _toDisplayString(_ctx.t('orchestration.detail.node.meta', { id: node.id, attempts: (node.attemptCount || 0), autoFix: (node.autoFixRounds || 0) })), 1 /* TEXT */)
                                                  ]),
                                                  _createElementVNode("span", {
                                                    class: _normalizeClass(['pill', _ctx.taskRunStatusTone(node.status)])
                                                  }, _toDisplayString(node.status), 3 /* TEXT, CLASS */)
                                                ]),
                                                (node.summary)
                                                  ? (_openBlock(), _createElementBlock("div", {
                                                      key: 0,
                                                      class: "task-runtime-item-summary"
                                                    }, _toDisplayString(node.summary), 1 /* TEXT */))
                                                  : _createCommentVNode("v-if", true),
                                                (node.error && node.error !== node.summary)
                                                  ? (_openBlock(), _createElementBlock("div", {
                                                      key: 1,
                                                      class: "task-node-deps"
                                                    }, _toDisplayString(_ctx.t('orchestration.labels.error')) + _toDisplayString(node.error), 1 /* TEXT */))
                                                  : _createCommentVNode("v-if", true),
                                                _createElementVNode("div", { class: "task-node-deps" }, _toDisplayString(_ctx.t('orchestration.labels.dependencies')) + _toDisplayString(_ctx.formatTaskNodeDependencies(node)), 1 /* TEXT */),
                                                _createElementVNode("pre", { class: "task-log-block" }, _toDisplayString(_ctx.formatTaskNodeLogs(node.logs)), 1 /* TEXT */)
                                              ]))
                                            }), 128 /* KEYED_FRAGMENT */))
                                          ])
                                        ], 64 /* STABLE_FRAGMENT */))
                                  ]))
                          ]))
                        : _createCommentVNode("v-if", true)
                    ]))
              ], 512 /* NEED_PATCH */)), [
                [_vShow, _ctx.mainTab === 'orchestration']
              ])
            : _createCommentVNode("v-if", true),
          _withDirectives(_createElementVNode("div", {
            class: "mode-content docs-mode-content",
            id: "panel-docs",
            role: "tabpanel",
            "aria-labelledby": "tab-docs"
          }, [
            _createElementVNode("div", { class: "selector-section" }, [
              _createElementVNode("div", { class: "selector-header" }, [
                _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('docs.title')), 1 /* TEXT */),
                _createElementVNode("div", { class: "skills-panel-note docs-section-note" }, _toDisplayString(_ctx.t('docs.subtitle')), 1 /* TEXT */)
              ]),
              _createElementVNode("div", { class: "docs-toolbar-grid" }, [
                _createElementVNode("div", { class: "docs-toolbar-card" }, [
                  _createElementVNode("label", {
                    class: "form-label",
                    for: "docs-install-package-manager"
                  }, _toDisplayString(_ctx.t('common.packageManager')), 1 /* TEXT */),
                  _withDirectives(_createElementVNode("select", {
                    id: "docs-install-package-manager",
                    class: "form-input",
                    "onUpdate:modelValue": $event => ((_ctx.installPackageManager) = $event)
                  }, [
                    _createElementVNode("option", { value: "npm" }, "npm"),
                    _createElementVNode("option", { value: "pnpm" }, "pnpm"),
                    _createElementVNode("option", { value: "bun" }, "bun")
                  ], 8 /* PROPS */, ["onUpdate:modelValue"]), [
                    [_vModelSelect, _ctx.installPackageManager]
                  ])
                ]),
                _createElementVNode("div", { class: "docs-toolbar-card docs-toolbar-card-wide" }, [
                  _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('common.mirror')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "install-action-tabs" }, [
                    _createElementVNode("button", {
                      type: "button",
                      class: _normalizeClass(["btn-mini", { active: _ctx.installRegistryPreset === 'default' }]),
                      onClick: $event => (_ctx.setInstallRegistryPreset('default'))
                    }, _toDisplayString(_ctx.t('common.official')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                    _createElementVNode("button", {
                      type: "button",
                      class: _normalizeClass(["btn-mini", { active: _ctx.installRegistryPreset === 'npmmirror' }]),
                      onClick: $event => (_ctx.setInstallRegistryPreset('npmmirror'))
                    }, "npmmirror", 10 /* CLASS, PROPS */, ["onClick"]),
                    _createElementVNode("button", {
                      type: "button",
                      class: _normalizeClass(["btn-mini", { active: _ctx.installRegistryPreset === 'tencent' }]),
                      onClick: $event => (_ctx.setInstallRegistryPreset('tencent'))
                    }, _toDisplayString(_ctx.t('docs.registry.tencent')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                    _createElementVNode("button", {
                      type: "button",
                      class: _normalizeClass(["btn-mini", { active: _ctx.installRegistryPreset === 'custom' }]),
                      onClick: $event => (_ctx.setInstallRegistryPreset('custom'))
                    }, _toDisplayString(_ctx.t('common.custom')), 11 /* TEXT, CLASS, PROPS */, ["onClick"])
                  ]),
                  (_ctx.installRegistryPreset === 'custom')
                    ? _withDirectives((_openBlock(), _createElementBlock("input", {
                        key: 0,
                        "onUpdate:modelValue": $event => ((_ctx.installRegistryCustom) = $event),
                        class: "form-input install-registry-input",
                        placeholder: "https://registry.example.com"
                      }, null, 8 /* PROPS */, ["onUpdate:modelValue"])), [
                        [_vModelText, _ctx.installRegistryCustom]
                      ])
                    : _createCommentVNode("v-if", true),
                  (_ctx.installRegistryPreview)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "form-hint install-registry-hint"
                      }, _toDisplayString(_ctx.t('docs.registryHintPrefix')) + " --registry=" + _toDisplayString(_ctx.installRegistryPreview), 1 /* TEXT */))
                    : (_ctx.installRegistryPreset === 'custom')
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 2,
                          class: "form-hint install-registry-hint"
                        }, _toDisplayString(_ctx.t('docs.registryHintCustom')), 1 /* TEXT */))
                      : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("div", { class: "docs-toolbar-card docs-toolbar-card-wide" }, [
                  _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('common.action')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "install-action-tabs" }, [
                    _createElementVNode("button", {
                      type: "button",
                      class: _normalizeClass(["btn-mini", { active: _ctx.installCommandAction === 'install' }]),
                      onClick: $event => (_ctx.setInstallCommandAction('install'))
                    }, _toDisplayString(_ctx.t('common.install')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                    _createElementVNode("button", {
                      type: "button",
                      class: _normalizeClass(["btn-mini", { active: _ctx.installCommandAction === 'update' }]),
                      onClick: $event => (_ctx.setInstallCommandAction('update'))
                    }, _toDisplayString(_ctx.t('common.update')), 11 /* TEXT, CLASS, PROPS */, ["onClick"]),
                    _createElementVNode("button", {
                      type: "button",
                      class: _normalizeClass(["btn-mini", { active: _ctx.installCommandAction === 'uninstall' }]),
                      onClick: $event => (_ctx.setInstallCommandAction('uninstall'))
                    }, _toDisplayString(_ctx.t('common.uninstall')), 11 /* TEXT, CLASS, PROPS */, ["onClick"])
                  ])
                ])
              ]),
              _createElementVNode("div", { class: "docs-summary-strip" }, [
                _createElementVNode("div", { class: "docs-summary-item" }, [
                  _createElementVNode("span", { class: "docs-summary-label" }, _toDisplayString(_ctx.t('common.targets')), 1 /* TEXT */),
                  _createElementVNode("strong", { class: "docs-summary-value" }, _toDisplayString(_ctx.installTargetCards.length), 1 /* TEXT */)
                ]),
                _createElementVNode("div", { class: "docs-summary-item" }, [
                  _createElementVNode("span", { class: "docs-summary-label" }, _toDisplayString(_ctx.t('common.currentPm')), 1 /* TEXT */),
                  _createElementVNode("strong", { class: "docs-summary-value" }, _toDisplayString(String(_ctx.installPackageManager || 'npm').toUpperCase()), 1 /* TEXT */)
                ]),
                _createElementVNode("div", { class: "docs-summary-item docs-summary-item-wide" }, [
                  _createElementVNode("span", { class: "docs-summary-label" }, _toDisplayString(_ctx.t('common.registry')), 1 /* TEXT */),
                  _createElementVNode("strong", { class: "docs-summary-value" }, _toDisplayString(_ctx.installRegistryPreview || _ctx.t('common.defaultOfficial')), 1 /* TEXT */)
                ])
              ])
            ]),
            _createElementVNode("div", { class: "selector-section" }, [
              _createElementVNode("div", { class: "selector-header" }, [
                _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('docs.section.commands')), 1 /* TEXT */),
                _createElementVNode("div", { class: "skills-panel-note docs-section-note" }, _toDisplayString(_ctx.t('docs.section.commandsNote')), 1 /* TEXT */)
              ]),
              _createElementVNode("div", { class: "install-list docs-install-list" }, [
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.installTargetCards, (target) => {
                  return (_openBlock(), _createElementBlock("div", {
                    class: "install-row docs-install-row",
                    key: 'docs-install-command-' + target.id + '-' + _ctx.installCommandAction
                  }, [
                    _createElementVNode("div", { class: "install-row-main" }, [
                      _createElementVNode("div", { class: "docs-command-head" }, [
                        _createElementVNode("div", { class: "install-row-title" }, _toDisplayString(target.name), 1 /* TEXT */),
                        _createElementVNode("div", { class: "docs-command-meta" }, [
                          _createElementVNode("span", { class: "docs-meta-pill" }, _toDisplayString(target.packageName), 1 /* TEXT */),
                          _createElementVNode("span", { class: "docs-meta-pill" }, "bin: " + _toDisplayString(target.bin), 1 /* TEXT */)
                        ])
                      ]),
                      _createElementVNode("div", { class: "docs-command-row" }, [
                        _createElementVNode("div", {
                          class: "docs-command-box",
                          role: "group",
                          "aria-label": _ctx.t('docs.command.aria', { name: target.name })
                        }, [
                          _createElementVNode("code", { class: "install-command" }, _toDisplayString(target.command), 1 /* TEXT */),
                          _createElementVNode("button", {
                            type: "button",
                            class: "btn-mini docs-copy-btn",
                            disabled: !target.command,
                            onClick: $event => (_ctx.copyInstallCommand(target.command))
                          }, _toDisplayString(_ctx.t('common.copy')), 9 /* TEXT, PROPS */, ["disabled", "onClick"])
                        ], 8 /* PROPS */, ["aria-label"])
                      ]),
                      (target.id === 'codex' && target.termuxCommand && target.termuxCommand !== target.command)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 0,
                            class: "docs-command-row docs-command-row-secondary"
                          }, [
                            _createElementVNode("div", {
                              class: "docs-command-box",
                              role: "group",
                              "aria-label": _ctx.t('docs.termuxAria')
                            }, [
                              _createElementVNode("code", { class: "install-command" }, [
                                _createElementVNode("span", { class: "docs-command-prefix" }, _toDisplayString(_ctx.t('docs.termuxLabel')), 1 /* TEXT */),
                                _createTextVNode(_toDisplayString(target.termuxCommand), 1 /* TEXT */)
                              ]),
                              _createElementVNode("button", {
                                type: "button",
                                class: "btn-mini docs-copy-btn",
                                onClick: $event => (_ctx.copyInstallCommand(target.termuxCommand))
                              }, _toDisplayString(_ctx.t('common.copy')), 9 /* TEXT, PROPS */, ["onClick"])
                            ], 8 /* PROPS */, ["aria-label"])
                          ]))
                        : _createCommentVNode("v-if", true)
                    ])
                  ]))
                }), 128 /* KEYED_FRAGMENT */))
              ])
            ]),
            _createElementVNode("div", { class: "selector-section" }, [
              _createElementVNode("div", { class: "selector-header" }, [
                _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('docs.section.faq')), 1 /* TEXT */),
                _createElementVNode("div", { class: "skills-panel-note docs-section-note" }, _toDisplayString(_ctx.t('docs.section.faqNote')), 1 /* TEXT */)
              ]),
              _createElementVNode("div", { class: "docs-help-grid" }, [
                _createElementVNode("div", { class: "docs-note-card" }, [
                  _createElementVNode("div", { class: "docs-note-title" }, _toDisplayString(_ctx.t('common.troubleshooting')), 1 /* TEXT */),
                  _createElementVNode("ul", { class: "install-help-list docs-help-list" }, [
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.installTroubleshootingTips, (tip) => {
                      return (_openBlock(), _createElementBlock("li", { key: tip }, _toDisplayString(tip), 1 /* TEXT */))
                    }), 128 /* KEYED_FRAGMENT */))
                  ])
                ]),
                _createElementVNode("div", { class: "docs-note-card" }, [
                  _createElementVNode("div", { class: "docs-note-title" }, _toDisplayString(_ctx.t('common.rules')), 1 /* TEXT */),
                  _createElementVNode("ul", { class: "docs-static-list" }, [
                    _createElementVNode("li", null, _toDisplayString(_ctx.t('docs.rule.1')), 1 /* TEXT */),
                    _createElementVNode("li", null, _toDisplayString(_ctx.t('docs.rule.2')), 1 /* TEXT */)
                  ])
                ])
              ])
            ])
          ], 512 /* NEED_PATCH */), [
            [_vShow, _ctx.mainTab === 'docs']
          ]),
          _createCommentVNode(" 设置面板 "),
          _withDirectives(_createElementVNode("div", {
            class: "mode-content",
            id: "panel-settings",
            role: "tabpanel",
            "aria-labelledby": 'tab-settings'
          }, [
            _createElementVNode("div", { class: "settings-tab-header" }, [
              _createElementVNode("div", {
                class: "segmented-control",
                role: "tablist",
                "aria-label": _ctx.t('settings.tabs.aria')
              }, [
                _createElementVNode("button", {
                  id: "settings-tab-general",
                  type: "button",
                  role: "tab",
                  "aria-controls": "settings-panel-general",
                  "aria-selected": _ctx.settingsTab === 'general',
                  tabindex: _ctx.settingsTab === 'general' ? 0 : -1,
                  class: _normalizeClass(['segmented-option', { active: _ctx.settingsTab === 'general' }]),
                  onClick: $event => (_ctx.onSettingsTabClick('general')),
                  onKeydown: $event => (_ctx.onSettingsTabKeydown($event, 'general'))
                }, _toDisplayString(_ctx.t('settings.tab.general')), 43 /* TEXT, CLASS, PROPS, NEED_HYDRATION */, ["aria-selected", "tabindex", "onClick", "onKeydown"]),
                _createElementVNode("button", {
                  id: "settings-tab-data",
                  type: "button",
                  role: "tab",
                  "aria-controls": "settings-panel-data",
                  "aria-selected": _ctx.settingsTab === 'data',
                  tabindex: _ctx.settingsTab === 'data' ? 0 : -1,
                  class: _normalizeClass(['segmented-option', { active: _ctx.settingsTab === 'data' }]),
                  onClick: $event => (_ctx.onSettingsTabClick('data')),
                  onKeydown: $event => (_ctx.onSettingsTabKeydown($event, 'data'))
                }, _toDisplayString(_ctx.t('settings.tab.data')), 43 /* TEXT, CLASS, PROPS, NEED_HYDRATION */, ["aria-selected", "tabindex", "onClick", "onKeydown"])
              ], 8 /* PROPS */, ["aria-label"])
            ]),
            _withDirectives(_createElementVNode("div", {
              id: "settings-panel-general",
              role: "tabpanel",
              "aria-labelledby": "settings-tab-general"
            }, [
              _createElementVNode("div", { class: "settings-grid" }, [
                _createElementVNode("section", {
                  class: "settings-card",
                  "aria-label": _ctx.t('settings.sharePrefix.title')
                }, [
                  _createElementVNode("div", { class: "settings-card-main" }, [
                    _createElementVNode("div", { class: "settings-card-content" }, [
                      _createElementVNode("div", { class: "settings-card-title" }, _toDisplayString(_ctx.t('settings.sharePrefix.title')), 1 /* TEXT */),
                      _createElementVNode("p", { class: "settings-card-desc" }, _toDisplayString(_ctx.t('settings.sharePrefix.meta')), 1 /* TEXT */),
                      _createElementVNode("label", {
                        class: "selector-label",
                        for: "settings-share-prefix"
                      }, _toDisplayString(_ctx.t('settings.sharePrefix.label')), 1 /* TEXT */),
                      _createElementVNode("select", {
                        id: "settings-share-prefix",
                        class: "model-select",
                        value: _ctx.shareCommandPrefix,
                        onChange: $event => (_ctx.setShareCommandPrefix($event.target.value))
                      }, [
                        _createElementVNode("option", { value: "npm start" }, "npm start"),
                        _createElementVNode("option", { value: "codexmate" }, "codexmate")
                      ], 40 /* PROPS, NEED_HYDRATION */, ["value", "onChange"]),
                      _createElementVNode("p", { class: "settings-card-hint" }, _toDisplayString(_ctx.t('settings.sharePrefix.hint')), 1 /* TEXT */)
                    ])
                  ])
                ], 8 /* PROPS */, ["aria-label"]),
                _createElementVNode("section", {
                  class: "settings-card",
                  "aria-label": _ctx.t('settings.templateConfirm.title')
                }, [
                  _createElementVNode("div", { class: "settings-card-main" }, [
                    _createElementVNode("div", { class: "settings-card-content" }, [
                      _createElementVNode("div", { class: "settings-card-title" }, _toDisplayString(_ctx.t('settings.templateConfirm.title')), 1 /* TEXT */),
                      _createElementVNode("p", { class: "settings-card-desc" }, _toDisplayString(_ctx.t('settings.templateConfirm.meta')), 1 /* TEXT */),
                      _createElementVNode("label", { class: "settings-toggle-row" }, [
                        _createElementVNode("input", {
                          type: "checkbox",
                          checked: _ctx.configTemplateDiffConfirmEnabled,
                          onChange: $event => (_ctx.setConfigTemplateDiffConfirmEnabled($event.target.checked))
                        }, null, 40 /* PROPS, NEED_HYDRATION */, ["checked", "onChange"]),
                        _createElementVNode("span", { class: "toggle-track" }, [
                          _createElementVNode("span", { class: "toggle-thumb" })
                        ]),
                        _createElementVNode("span", null, _toDisplayString(_ctx.t('settings.templateConfirm.toggle')), 1 /* TEXT */)
                      ]),
                      _createElementVNode("p", { class: "settings-card-hint" }, _toDisplayString(_ctx.t('settings.templateConfirm.hint')), 1 /* TEXT */)
                    ])
                  ])
                ], 8 /* PROPS */, ["aria-label"]),
                _createElementVNode("section", {
                  class: "settings-card",
                  "aria-label": 'Webhook'
                }, [
                  _createElementVNode("div", { class: "settings-card-main" }, [
                    _createElementVNode("div", { class: "settings-card-content" }, [
                      _createElementVNode("div", { class: "settings-card-title" }, "Webhook"),
                      _createElementVNode("p", { class: "settings-card-desc" }, "配置变更时外发通知"),
                      _createElementVNode("div", { class: "webhook-status" }, [
                        _createElementVNode("span", {
                          class: _normalizeClass(["webhook-status-dot", { active: _ctx.webhookConfig.enabled }])
                        }, null, 2 /* CLASS */),
                        _createElementVNode("span", { class: "webhook-status-label" }, _toDisplayString(_ctx.webhookConfig.enabled ? '已启用' : '已禁用'), 1 /* TEXT */),
                        (_ctx.webhookConfig.url)
                          ? (_openBlock(), _createElementBlock("code", {
                              key: 0,
                              class: "webhook-url"
                            }, _toDisplayString(_ctx.webhookConfig.url), 1 /* TEXT */))
                          : _createCommentVNode("v-if", true)
                      ])
                    ])
                  ]),
                  _createElementVNode("button", {
                    class: _normalizeClass(["settings-card-action", { 'settings-card-action--active': _ctx.webhookConfig.enabled }]),
                    onClick: _ctx.openWebhookModal
                  }, [
                    (_ctx.webhookConfig.enabled)
                      ? (_openBlock(), _createElementBlock("span", { key: 0 }, _toDisplayString(_ctx.webhookConfig.url ? '编辑' : '配置'), 1 /* TEXT */))
                      : (_openBlock(), _createElementBlock("span", { key: 1 }, "启用"))
                  ], 10 /* CLASS, PROPS */, ["onClick"])
                ])
              ])
            ], 512 /* NEED_PATCH */), [
              [_vShow, _ctx.settingsTab === 'general']
            ]),
            _withDirectives(_createElementVNode("div", {
              id: "settings-panel-data",
              role: "tabpanel",
              "aria-labelledby": "settings-tab-data"
            }, [
              _createElementVNode("div", { class: "settings-grid" }, [
                _createElementVNode("section", {
                  class: "settings-card",
                  "aria-label": _ctx.t('settings.backup.title')
                }, [
                  _createElementVNode("div", { class: "settings-card-main" }, [
                    _createElementVNode("div", { class: "settings-card-content" }, [
                      _createElementVNode("div", { class: "settings-card-title" }, _toDisplayString(_ctx.t('settings.backup.title')), 1 /* TEXT */),
                      _createElementVNode("p", { class: "settings-card-desc" }, _toDisplayString(_ctx.t('settings.backup.meta')), 1 /* TEXT */)
                    ])
                  ]),
                  _createElementVNode("div", { class: "settings-card-actions" }, [
                    _createElementVNode("button", {
                      class: "settings-card-action",
                      onClick: _ctx.downloadClaudeDirectory,
                      disabled: _ctx.claudeDownloadLoading
                    }, [
                      _createElementVNode("span", null, _toDisplayString(_ctx.claudeDownloadLoading ? _ctx.t('settings.importing') : _ctx.t('settings.backup.oneClickClaude')), 1 /* TEXT */)
                    ], 8 /* PROPS */, ["onClick", "disabled"]),
                    _createElementVNode("button", {
                      class: "settings-card-action",
                      onClick: _ctx.downloadCodexDirectory,
                      disabled: _ctx.codexDownloadLoading
                    }, [
                      _createElementVNode("span", null, _toDisplayString(_ctx.codexDownloadLoading ? _ctx.t('settings.importing') : _ctx.t('settings.backup.oneClickCodex')), 1 /* TEXT */)
                    ], 8 /* PROPS */, ["onClick", "disabled"])
                  ]),
                  _createElementVNode("input", {
                    ref: "claudeImportInput",
                    class: "sr-only",
                    type: "file",
                    accept: ".zip",
                    onChange: _ctx.handleClaudeImportChange
                  }, null, 40 /* PROPS, NEED_HYDRATION */, ["onChange"]),
                  _createElementVNode("input", {
                    ref: "codexImportInput",
                    class: "sr-only",
                    type: "file",
                    accept: ".zip",
                    onChange: _ctx.handleCodexImportChange
                  }, null, 40 /* PROPS, NEED_HYDRATION */, ["onChange"])
                ], 8 /* PROPS */, ["aria-label"]),
                _createElementVNode("section", {
                  class: "settings-card",
                  "aria-label": _ctx.t('settings.trashConfig.title')
                }, [
                  _createElementVNode("div", { class: "settings-card-main" }, [
                    _createElementVNode("div", { class: "settings-card-content" }, [
                      _createElementVNode("div", { class: "settings-card-title" }, _toDisplayString(_ctx.t('settings.trashConfig.title')), 1 /* TEXT */),
                      _createElementVNode("p", { class: "settings-card-desc" }, _toDisplayString(_ctx.t('settings.trashConfig.meta')), 1 /* TEXT */),
                      _createElementVNode("label", { class: "settings-toggle-row" }, [
                        _createElementVNode("input", {
                          type: "checkbox",
                          checked: _ctx.sessionTrashEnabled,
                          onChange: $event => (_ctx.setSessionTrashEnabled($event.target.checked))
                        }, null, 40 /* PROPS, NEED_HYDRATION */, ["checked", "onChange"]),
                        _createElementVNode("span", { class: "toggle-track" }, [
                          _createElementVNode("span", { class: "toggle-thumb" })
                        ]),
                        _createElementVNode("span", null, _toDisplayString(_ctx.t('settings.deleteBehavior.toggle')), 1 /* TEXT */)
                      ]),
                      _createElementVNode("div", { class: "settings-retention" }, [
                        _createElementVNode("label", { for: "settings-trash-retention-days" }, _toDisplayString(_ctx.t('settings.trash.retentionLabel')), 1 /* TEXT */),
                        _createElementVNode("input", {
                          id: "settings-trash-retention-days",
                          type: "number",
                          min: "1",
                          max: "365",
                          value: _ctx.sessionTrashRetentionDays,
                          onChange: $event => (_ctx.setSessionTrashRetentionDays(Number($event.target.value))),
                          class: "settings-retention-input"
                        }, null, 40 /* PROPS, NEED_HYDRATION */, ["value", "onChange"]),
                        _createElementVNode("span", null, "天")
                      ]),
                      _createElementVNode("p", { class: "settings-card-hint" }, _toDisplayString(_ctx.t('settings.trash.retentionHint')), 1 /* TEXT */)
                    ])
                  ])
                ], 8 /* PROPS */, ["aria-label"]),
                _createElementVNode("section", {
                  class: "settings-card settings-card--destructive",
                  "aria-label": _ctx.t('settings.reset.title')
                }, [
                  _createElementVNode("div", { class: "settings-card-main" }, [
                    _createElementVNode("div", { class: "settings-card-content" }, [
                      _createElementVNode("div", { class: "settings-card-title" }, _toDisplayString(_ctx.t('settings.reset.title')), 1 /* TEXT */),
                      _createElementVNode("p", { class: "settings-card-desc" }, _toDisplayString(_ctx.t('settings.reset.meta')), 1 /* TEXT */),
                      _createElementVNode("p", { class: "settings-card-hint" }, _toDisplayString(_ctx.t('settings.reset.hint')), 1 /* TEXT */)
                    ])
                  ]),
                  _createElementVNode("button", {
                    class: "settings-card-action settings-card-action--danger",
                    onClick: _ctx.resetConfig,
                    disabled: _ctx.resetConfigLoading || _ctx.loading || !!_ctx.initError
                  }, _toDisplayString(_ctx.resetConfigLoading ? _ctx.t('settings.reset.loading') : _ctx.t('settings.reset.button')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                ], 8 /* PROPS */, ["aria-label"])
              ])
            ], 512 /* NEED_PATCH */), [
              [_vShow, _ctx.settingsTab === 'data']
            ])
          ], 512 /* NEED_PATCH */), [
            [_vShow, _ctx.mainTab === 'settings']
          ]),
          _createCommentVNode(" 回收站面板 "),
          _withDirectives(_createElementVNode("div", {
            class: "mode-content",
            id: "panel-trash",
            role: "tabpanel",
            "aria-labelledby": "tab-trash"
          }, [
            (!_ctx.loading)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "trash-panel-shell"
                }, [
                  _createCommentVNode(" 空态 "),
                  (_ctx.getSessionTrashViewState() === 'empty')
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "trash-empty-state"
                      }, [
                        (_openBlock(), _createElementBlock("svg", {
                          class: "trash-empty-svg",
                          viewBox: "0 0 64 64",
                          fill: "none",
                          stroke: "currentColor",
                          "stroke-width": "1.2"
                        }, [
                          _createElementVNode("path", { d: "M20 22l4 32h16l4-32" }),
                          _createElementVNode("path", { d: "M14 22h36" }),
                          _createElementVNode("path", { d: "M24 22v-4a4 4 0 014-4h8a4 4 0 014 4v4" }),
                          _createElementVNode("path", {
                            d: "M28 30v16M36 30v16",
                            "stroke-width": "1.6",
                            "stroke-linecap": "round"
                          })
                        ])),
                        _createElementVNode("div", { class: "trash-empty-title" }, _toDisplayString(_ctx.t('settings.trash.empty')), 1 /* TEXT */),
                        _createElementVNode("div", { class: "trash-empty-hint" }, "删除的会话保留 " + _toDisplayString(_ctx.sessionTrashRetentionDays) + " 天后自动清理", 1 /* TEXT */)
                      ]))
                    : (_ctx.getSessionTrashViewState() === 'loading')
                      ? (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                          _createCommentVNode(" 加载态 "),
                          _createElementVNode("div", { class: "trash-empty-state" }, [
                            _createElementVNode("div", { class: "trash-spinner" }),
                            _createElementVNode("div", { class: "trash-empty-title" }, _toDisplayString(_ctx.t('settings.trash.loading')), 1 /* TEXT */)
                          ])
                        ], 2112 /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */))
                      : (_ctx.getSessionTrashViewState() === 'retry')
                        ? (_openBlock(), _createElementBlock(_Fragment, { key: 2 }, [
                            _createCommentVNode(" 错误态 "),
                            _createElementVNode("div", { class: "trash-empty-state" }, [
                              (_openBlock(), _createElementBlock("svg", {
                                class: "trash-empty-svg",
                                viewBox: "0 0 64 64",
                                fill: "none",
                                stroke: "currentColor",
                                "stroke-width": "1.2"
                              }, [
                                _createElementVNode("circle", {
                                  cx: "32",
                                  cy: "32",
                                  r: "22"
                                }),
                                _createElementVNode("path", {
                                  d: "M32 20v16M32 44v2",
                                  "stroke-width": "2",
                                  "stroke-linecap": "round"
                                })
                              ])),
                              _createElementVNode("div", { class: "trash-empty-title" }, _toDisplayString(_ctx.t('settings.trash.retry')), 1 /* TEXT */),
                              _createElementVNode("button", {
                                class: "btn-tool",
                                onClick: $event => (_ctx.loadSessionTrash({ forceRefresh: true }))
                              }, "重试", 8 /* PROPS */, ["onClick"])
                            ])
                          ], 2112 /* STABLE_FRAGMENT, DEV_ROOT_FRAGMENT */))
                        : (_openBlock(), _createElementBlock(_Fragment, { key: 3 }, [
                            _createCommentVNode(" 列表态 "),
                            _createElementVNode("div", { class: "trash-toolbar" }, [
                              _createElementVNode("div", { class: "trash-toolbar-left" }, [
                                _createElementVNode("span", { class: "trash-toolbar-count" }, _toDisplayString(_ctx.sessionTrashCount) + " 个已删除会话", 1 /* TEXT */),
                                _createElementVNode("span", { class: "trash-toolbar-retention" }, _toDisplayString(_ctx.sessionTrashRetentionDays) + " 天后自动清理", 1 /* TEXT */)
                              ]),
                              _createElementVNode("div", { class: "trash-toolbar-right" }, [
                                _createElementVNode("button", {
                                  class: "btn-mini",
                                  onClick: $event => (_ctx.loadSessionTrash({ forceRefresh: true })),
                                  disabled: _ctx.sessionTrashLoading,
                                  title: _ctx.t('sessions.refresh')
                                }, [
                                  (_openBlock(), _createElementBlock("svg", {
                                    viewBox: "0 0 24 24",
                                    fill: "none",
                                    stroke: "currentColor",
                                    "stroke-width": "2",
                                    class: "btn-icon-sm"
                                  }, [
                                    _createElementVNode("path", { d: "M21 2v6h-6M3 12a9 9 0 0115-6.7L21 8M3 22v-6h6M21 12a9 9 0 01-15 6.7L3 16" })
                                  ]))
                                ], 8 /* PROPS */, ["onClick", "disabled", "title"]),
                                _createElementVNode("button", {
                                  class: "btn-mini delete",
                                  onClick: _ctx.clearSessionTrash,
                                  disabled: _ctx.sessionTrashClearing || _ctx.sessionTrashLoading || !(Number(_ctx.sessionTrashCount) > 0)
                                }, _toDisplayString(_ctx.sessionTrashClearing ? '清空中…' : '清空'), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                              ])
                            ]),
                            _createElementVNode("div", { class: "trash-list" }, [
                              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.visibleSessionTrashItems, (item) => {
                                return (_openBlock(), _createElementBlock("div", {
                                  key: item.trashId,
                                  class: "trash-item"
                                }, [
                                  _createElementVNode("div", { class: "trash-item-body" }, [
                                    _createElementVNode("div", { class: "trash-item-main" }, [
                                      _createElementVNode("div", { class: "trash-item-title" }, _toDisplayString(item.title || item.sessionId), 1 /* TEXT */),
                                      _createElementVNode("div", { class: "trash-item-meta" }, [
                                        _createElementVNode("span", {
                                          class: "session-source",
                                          "data-source": item.source
                                        }, _toDisplayString(item.sourceLabel), 9 /* TEXT, PROPS */, ["data-source"]),
                                        _createElementVNode("span", { class: "trash-item-time" }, _toDisplayString(item.deletedAt || item.updatedAt || _ctx.t('sessions.unknownTime')), 1 /* TEXT */),
                                        (item.cwd)
                                          ? (_openBlock(), _createElementBlock("span", {
                                              key: 0,
                                              class: "trash-item-cwd"
                                            }, _toDisplayString(item.cwd), 1 /* TEXT */))
                                          : _createCommentVNode("v-if", true)
                                      ])
                                    ]),
                                    _createElementVNode("div", { class: "trash-item-actions" }, [
                                      _createElementVNode("button", {
                                        class: "trash-action-btn restore",
                                        onClick: $event => (_ctx.restoreSessionTrash(item)),
                                        disabled: _ctx.sessionTrashLoading || _ctx.sessionTrashClearing || _ctx.isSessionTrashActionBusy(item),
                                        title: _ctx.sessionTrashRestoring[_ctx.getSessionTrashActionKey(item)] ? '恢复中…' : '恢复'
                                      }, [
                                        (_openBlock(), _createElementBlock("svg", {
                                          viewBox: "0 0 24 24",
                                          fill: "none",
                                          stroke: "currentColor",
                                          "stroke-width": "2"
                                        }, [
                                          _createElementVNode("path", { d: "M3 12a9 9 0 119 9" }),
                                          _createElementVNode("path", { d: "M3 4v6h6" })
                                        ]))
                                      ], 8 /* PROPS */, ["onClick", "disabled", "title"]),
                                      _createElementVNode("button", {
                                        class: "trash-action-btn delete",
                                        onClick: $event => (_ctx.purgeSessionTrash(item)),
                                        disabled: _ctx.sessionTrashLoading || _ctx.sessionTrashClearing || _ctx.isSessionTrashActionBusy(item),
                                        title: _ctx.sessionTrashPurging[_ctx.getSessionTrashActionKey(item)] ? '删除中…' : '彻底删除'
                                      }, [
                                        (_openBlock(), _createElementBlock("svg", {
                                          viewBox: "0 0 24 24",
                                          fill: "none",
                                          stroke: "currentColor",
                                          "stroke-width": "2"
                                        }, [
                                          _createElementVNode("path", { d: "M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6" })
                                        ]))
                                      ], 8 /* PROPS */, ["onClick", "disabled", "title"])
                                    ])
                                  ])
                                ]))
                              }), 128 /* KEYED_FRAGMENT */)),
                              (_ctx.sessionTrashHasMoreItems)
                                ? (_openBlock(), _createElementBlock("div", {
                                    key: 0,
                                    class: "trash-list-footer"
                                  }, [
                                    _createElementVNode("button", {
                                      class: "btn-tool btn-tool-compact",
                                      onClick: _ctx.loadMoreSessionTrashItems,
                                      disabled: _ctx.sessionTrashLoading || _ctx.sessionTrashClearing
                                    }, " 加载更多（" + _toDisplayString(_ctx.sessionTrashHiddenCount) + " 条） ", 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                  ]))
                                : _createCommentVNode("v-if", true)
                            ])
                          ], 64 /* STABLE_FRAGMENT */))
                ]))
              : _createCommentVNode("v-if", true)
          ], 512 /* NEED_PATCH */), [
            [_vShow, _ctx.mainTab === 'trash']
          ]),
          _withDirectives(_createElementVNode("div", {
            class: "mode-content",
            id: "panel-market",
            role: "tabpanel",
            "aria-labelledby": "tab-market"
          }, [
            _createCommentVNode(" Minimalist header with target switch "),
            _createElementVNode("div", { class: "skills-minimal-header" }, [
              _createElementVNode("div", { class: "skills-header-left" }, [
                _createElementVNode("span", { class: "skills-header-title" }, _toDisplayString(_ctx.t('market.title')), 1 /* TEXT */),
                _createElementVNode("div", {
                  class: "skills-target-switch",
                  role: "group",
                  "aria-label": _ctx.t('market.target.aria')
                }, [
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['skills-target-chip', { active: _ctx.skillsTargetApp === 'codex' }]),
                    "aria-pressed": _ctx.skillsTargetApp === 'codex',
                    disabled: _ctx.loading || !!_ctx.initError || _ctx.skillsMarketBusy,
                    onClick: $event => (_ctx.setSkillsTargetApp('codex', { silent: false }))
                  }, " Codex ", 10 /* CLASS, PROPS */, ["aria-pressed", "disabled", "onClick"]),
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['skills-target-chip', { active: _ctx.skillsTargetApp === 'claude' }]),
                    "aria-pressed": _ctx.skillsTargetApp === 'claude',
                    disabled: _ctx.loading || !!_ctx.initError || _ctx.skillsMarketBusy,
                    onClick: $event => (_ctx.setSkillsTargetApp('claude', { silent: false }))
                  }, " Claude Code ", 10 /* CLASS, PROPS */, ["aria-pressed", "disabled", "onClick"])
                ], 8 /* PROPS */, ["aria-label"])
              ]),
              _createElementVNode("div", { class: "skills-header-actions" }, [
                _createElementVNode("button", {
                  type: "button",
                  class: "btn-icon",
                  onClick: _ctx.openSkillsMenu,
                  "aria-label": _ctx.t('common.menu'),
                  title: _ctx.t('common.menu')
                }, [
                  (_openBlock(), _createElementBlock("svg", {
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    "stroke-width": "2",
                    width: "20",
                    height: "20"
                  }, [
                    _createElementVNode("circle", {
                      cx: "12",
                      cy: "12",
                      r: "1"
                    }),
                    _createElementVNode("circle", {
                      cx: "12",
                      cy: "5",
                      r: "1"
                    }),
                    _createElementVNode("circle", {
                      cx: "12",
                      cy: "19",
                      r: "1"
                    })
                  ]))
                ], 8 /* PROPS */, ["onClick", "aria-label", "title"])
              ])
            ]),
            _createCommentVNode(" Installed skills panel "),
            _createElementVNode("div", { class: "skills-flow-panel" }, [
              _createElementVNode("div", { class: "skills-flow-header" }, [
                _createElementVNode("div", { class: "skills-flow-title-wrap" }, [
                  _createElementVNode("span", { class: "skills-flow-title" }, _toDisplayString(_ctx.t('market.installed.title')), 1 /* TEXT */),
                  _createElementVNode("span", { class: "skills-flow-count" }, _toDisplayString(_ctx.skillsList.length), 1 /* TEXT */)
                ]),
                _createElementVNode("button", {
                  type: "button",
                  class: "btn-mini",
                  onClick: $event => (_ctx.refreshSkillsList({ silent: false })),
                  disabled: _ctx.loading || !!_ctx.initError || _ctx.skillsMarketBusy
                }, [
                  (!_ctx.skillsLoading)
                    ? (_openBlock(), _createElementBlock("svg", {
                        key: 0,
                        viewBox: "0 0 20 20",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "1.8",
                        width: "14",
                        height: "14"
                      }, [
                        _createElementVNode("path", { d: "M17 1l4 4-4 4" }),
                        _createElementVNode("path", { d: "M3 11V9a4 4 0 014-4h14" }),
                        _createElementVNode("path", { d: "M3 19l-4-4 4-4" }),
                        _createElementVNode("path", { d: "M17 9v2a4 4 0 01-4 4H3" })
                      ]))
                    : (_openBlock(), _createElementBlock("svg", {
                        key: 1,
                        viewBox: "0 0 20 20",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "1.8",
                        width: "14",
                        height: "14",
                        class: "spin"
                      }, [
                        _createElementVNode("path", { d: "M10 2v4m0 8v4M2 10h4m8 0h4m-3.5-6.5l2.5 2.5M4 4l2.5 2.5M16 16l-2.5-2.5M4 16l2.5-2.5" })
                      ]))
                ], 8 /* PROPS */, ["onClick", "disabled"])
              ]),
              (_ctx.skillsLoading && !_ctx.skillsMarketLocalLoadedOnce)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "skills-flow-loading"
                  }, _toDisplayString(_ctx.t('market.local.loading')), 1 /* TEXT */))
                : (_ctx.skillsList.length === 0)
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 1,
                      class: "skills-flow-empty"
                    }, _toDisplayString(_ctx.t('market.local.empty')), 1 /* TEXT */))
                  : (_openBlock(), _createElementBlock("div", {
                      key: 2,
                      class: "skills-flow-list"
                    }, [
                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.skillsList, (skill) => {
                        return (_openBlock(), _createElementBlock("div", {
                          key: 'skill-' + skill.name,
                          class: _normalizeClass(["skills-flow-item", { 'has-issue': !skill.hasSkillFile }])
                        }, [
                          _createElementVNode("div", { class: "skills-flow-main" }, [
                            _createElementVNode("span", { class: "skills-flow-name" }, _toDisplayString(skill.displayName || skill.name), 1 /* TEXT */),
                            _createElementVNode("span", { class: "skills-flow-path" }, _toDisplayString(skill.path), 1 /* TEXT */)
                          ]),
                          _createElementVNode("span", {
                            class: _normalizeClass(['skills-flow-status', skill.hasSkillFile ? 'success' : 'warning'])
                          }, _toDisplayString(skill.hasSkillFile ? _ctx.t('market.pill.verified') : _ctx.t('market.pill.missingSkill')), 3 /* TEXT, CLASS */)
                        ], 2 /* CLASS */))
                      }), 128 /* KEYED_FRAGMENT */))
                    ]))
            ]),
            _createCommentVNode(" Importable skills panel "),
            _createElementVNode("div", { class: "skills-flow-panel" }, [
              _createElementVNode("div", { class: "skills-flow-header" }, [
                _createElementVNode("div", { class: "skills-flow-title-wrap" }, [
                  _createElementVNode("span", { class: "skills-flow-title" }, _toDisplayString(_ctx.t('market.import.title')), 1 /* TEXT */),
                  _createElementVNode("span", { class: "skills-flow-count" }, _toDisplayString(_ctx.skillsImportList.length), 1 /* TEXT */)
                ]),
                _createElementVNode("button", {
                  type: "button",
                  class: "btn-mini",
                  onClick: $event => (_ctx.scanImportableSkills({ silent: false })),
                  disabled: _ctx.loading || !!_ctx.initError || _ctx.skillsMarketBusy
                }, [
                  (!_ctx.skillsScanningImports)
                    ? (_openBlock(), _createElementBlock("svg", {
                        key: 0,
                        viewBox: "0 0 20 20",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "1.8",
                        width: "14",
                        height: "14"
                      }, [
                        _createElementVNode("path", { d: "M17 1l4 4-4 4" }),
                        _createElementVNode("path", { d: "M3 11V9a4 4 0 014-4h14" }),
                        _createElementVNode("path", { d: "M3 19l-4-4 4-4" }),
                        _createElementVNode("path", { d: "M17 9v2a4 4 0 01-4 4H3" })
                      ]))
                    : (_openBlock(), _createElementBlock("svg", {
                        key: 1,
                        viewBox: "0 0 20 20",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "1.8",
                        width: "14",
                        height: "14",
                        class: "spin"
                      }, [
                        _createElementVNode("path", { d: "M10 2v4m0 8v4M2 10h4m8 0h4m-3.5-6.5l2.5 2.5M4 4l2.5 2.5M16 16l-2.5-2.5M4 16l2.5-2.5" })
                      ]))
                ], 8 /* PROPS */, ["onClick", "disabled"])
              ]),
              (_ctx.skillsScanningImports && !_ctx.skillsMarketImportLoadedOnce)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "skills-flow-loading"
                  }, _toDisplayString(_ctx.t('market.import.loading')), 1 /* TEXT */))
                : (_ctx.skillsImportList.length === 0)
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 1,
                      class: "skills-flow-empty"
                    }, _toDisplayString(_ctx.t('market.import.empty')), 1 /* TEXT */))
                  : (_openBlock(), _createElementBlock("div", { key: 2 }, [
                      _createCommentVNode(" Quick actions "),
                      _createElementVNode("div", { class: "skills-flow-actions" }, [
                        _createElementVNode("button", {
                          type: "button",
                          class: "skills-action-btn",
                          onClick: _ctx.openSkillsManager,
                          disabled: _ctx.loading || !!_ctx.initError || _ctx.skillsMarketBusy
                        }, [
                          (_openBlock(), _createElementBlock("svg", {
                            viewBox: "0 0 20 20",
                            fill: "none",
                            stroke: "currentColor",
                            "stroke-width": "1.8",
                            width: "16",
                            height: "16"
                          }, [
                            _createElementVNode("rect", {
                              x: "3",
                              y: "3",
                              width: "14",
                              height: "14",
                              rx: "3"
                            }),
                            _createElementVNode("path", { d: "M7 7h6M7 10h4" })
                          ])),
                          _createTextVNode(" " + _toDisplayString(_ctx.t('market.action.manage.title')), 1 /* TEXT */)
                        ], 8 /* PROPS */, ["onClick", "disabled"]),
                        _createElementVNode("button", {
                          type: "button",
                          class: "skills-action-btn",
                          onClick: _ctx.triggerSkillsZipImport,
                          disabled: _ctx.loading || !!_ctx.initError || _ctx.skillsMarketBusy
                        }, [
                          (_openBlock(), _createElementBlock("svg", {
                            viewBox: "0 0 20 20",
                            fill: "none",
                            stroke: "currentColor",
                            "stroke-width": "1.8",
                            width: "16",
                            height: "16"
                          }, [
                            _createElementVNode("path", { d: "M4 14l3-3 3 3" }),
                            _createElementVNode("path", { d: "M7 4v7" }),
                            _createElementVNode("rect", {
                              x: "12",
                              y: "4",
                              width: "5",
                              height: "12",
                              rx: "1"
                            })
                          ])),
                          _createTextVNode(" " + _toDisplayString(_ctx.t('market.action.zipImport.title')), 1 /* TEXT */)
                        ], 8 /* PROPS */, ["onClick", "disabled"])
                      ]),
                      _createCommentVNode(" Import list "),
                      _createElementVNode("div", { class: "skills-flow-list" }, [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.skillsImportList, (skill) => {
                          return (_openBlock(), _createElementBlock("div", {
                            key: 'import-' + _ctx.buildSkillImportKey(skill),
                            class: "skills-flow-item"
                          }, [
                            _createElementVNode("div", { class: "skills-flow-main" }, [
                              _createElementVNode("span", { class: "skills-flow-name" }, _toDisplayString(skill.displayName || skill.name), 1 /* TEXT */),
                              _createElementVNode("span", { class: "skills-flow-meta" }, _toDisplayString(skill.sourceLabel), 1 /* TEXT */)
                            ]),
                            _createElementVNode("button", {
                              type: "button",
                              class: "skills-flow-add",
                              onClick: $event => (_ctx.importSingleSkill(skill)),
                              disabled: _ctx.loading || !!_ctx.initError || _ctx.skillsMarketBusy
                            }, [
                              (_openBlock(), _createElementBlock("svg", {
                                viewBox: "0 0 20 20",
                                fill: "none",
                                stroke: "currentColor",
                                "stroke-width": "1.8",
                                width: "16",
                                height: "16"
                              }, [
                                _createElementVNode("path", { d: "M10 4v6m3-3l-3 3-3-3" })
                              ]))
                            ], 8 /* PROPS */, ["onClick", "disabled"])
                          ]))
                        }), 128 /* KEYED_FRAGMENT */))
                      ])
                    ]))
            ])
          ], 512 /* NEED_PATCH */), [
            [_vShow, _ctx.mainTab === 'market']
          ]),
          _withDirectives(_createElementVNode("div", {
            class: "mode-content",
            id: "panel-plugins",
            role: "tabpanel",
            "aria-labelledby": "tab-plugins"
          }, [
            _createElementVNode("div", { class: "plugins-layout" }, [
              _createElementVNode("aside", {
                class: "plugins-sidebar",
                "aria-label": _ctx.t('plugins.sidebar.ariaList')
              }, [
                _createElementVNode("div", { class: "selector-header plugins-sidebar-header" }, [
                  _createElementVNode("div", null, [
                    _createElementVNode("span", { class: "selector-title" }, _toDisplayString(_ctx.t('plugins.sidebar.title')), 1 /* TEXT */),
                    _createElementVNode("div", { class: "plugins-panel-note" }, _toDisplayString(_ctx.t('plugins.sidebar.note')), 1 /* TEXT */)
                  ]),
                  _createElementVNode("div", { class: "settings-tab-actions" }, [
                    _createElementVNode("button", {
                      type: "button",
                      class: "btn-tool btn-tool-compact",
                      onClick: $event => (_ctx.loadPluginsOverview({ forceRefresh: true, silent: false })),
                      disabled: _ctx.loading || !!_ctx.initError || _ctx.pluginsLoading
                    }, _toDisplayString(_ctx.pluginsLoading ? _ctx.t('plugins.refreshing') : _ctx.t('plugins.refresh')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                  ])
                ]),
                _createElementVNode("div", {
                  class: "plugins-list",
                  role: "list"
                }, [
                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.pluginsCatalog, (plugin) => {
                    return (_openBlock(), _createElementBlock("button", {
                      key: 'plugin-' + plugin.id,
                      type: "button",
                      class: _normalizeClass(['plugins-item', { active: _ctx.pluginsActiveId === plugin.id }]),
                      "aria-current": _ctx.pluginsActiveId === plugin.id ? 'page' : null,
                      disabled: _ctx.loading || !!_ctx.initError || _ctx.pluginsLoading,
                      onClick: $event => (_ctx.selectPlugin(plugin.id))
                    }, [
                      _createElementVNode("div", { class: "plugins-item-main" }, [
                        _createElementVNode("div", { class: "plugins-item-title" }, _toDisplayString(plugin.title), 1 /* TEXT */),
                        _createElementVNode("div", { class: "plugins-item-meta" }, _toDisplayString(plugin.description), 1 /* TEXT */)
                      ]),
                      _createElementVNode("span", {
                        class: _normalizeClass(['pill', plugin.tone])
                      }, _toDisplayString(plugin.statusLabel), 3 /* TEXT, CLASS */)
                    ], 10 /* CLASS, PROPS */, ["aria-current", "disabled", "onClick"]))
                  }), 128 /* KEYED_FRAGMENT */))
                ])
              ], 8 /* PROPS */, ["aria-label"]),
              _createElementVNode("section", {
                class: "plugins-main",
                "aria-label": _ctx.t('plugins.main.ariaWorkspace')
              }, [
                (_ctx.pluginsLoading)
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "skills-empty-state"
                    }, _toDisplayString(_ctx.t('common.loading')), 1 /* TEXT */))
                  : (_ctx.pluginsError)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "skills-empty-state"
                      }, [
                        _createElementVNode("div", { class: "plugins-panel-note" }, _toDisplayString(_ctx.pluginsError), 1 /* TEXT */),
                        _createElementVNode("button", {
                          type: "button",
                          class: "btn-mini",
                          onClick: $event => (_ctx.loadPluginsOverview({ forceRefresh: true, silent: false })),
                          disabled: _ctx.loading || !!_ctx.initError || _ctx.pluginsLoading
                        }, _toDisplayString(_ctx.t('common.refresh')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                      ]))
                    : (_ctx.pluginsActiveId === 'prompt-templates')
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 2,
                          class: "plugins-panel"
                        }, [
                          _createElementVNode("div", { class: "plugins-panel-head" }, [
                            _createElementVNode("div", { class: "plugins-panel-title" }, _toDisplayString(_ctx.t('plugins.promptTemplates.title')), 1 /* TEXT */),
                            (_ctx.pluginsActiveAttribution)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  class: "plugins-panel-note"
                                }, _toDisplayString(_ctx.pluginsActiveAttribution), 1 /* TEXT */))
                              : _createCommentVNode("v-if", true)
                          ]),
                          _createElementVNode("div", {
                            class: "prompt-templates-modebar",
                            role: "tablist",
                            "aria-label": _ctx.t('plugins.promptTemplates.mode.aria')
                          }, [
                            _createElementVNode("button", {
                              type: "button",
                              role: "tab",
                              "aria-selected": _ctx.promptTemplatesMode === 'compose',
                              class: _normalizeClass(['mode-pill', { active: _ctx.promptTemplatesMode === 'compose' }]),
                              onClick: $event => {_ctx.promptTemplatesMode = 'compose'; if(typeof _ctx.saveNavState==='function')_ctx.saveNavState()}
                            }, [
                              (_openBlock(), _createElementBlock("svg", {
                                style: {"width":"12px","height":"12px","vertical-align":"-1px","margin-right":"4px"},
                                viewBox: "0 0 20 20",
                                fill: "none",
                                stroke: "currentColor",
                                "stroke-width": "2",
                                "stroke-linecap": "round"
                              }, [
                                _createElementVNode("path", { d: "M4 4h12v12H4z" }),
                                _createElementVNode("path", { d: "M8 8h4M8 11h2" })
                              ])),
                              _createTextVNode(_toDisplayString(_ctx.t('plugins.promptTemplates.mode.compose')), 1 /* TEXT */)
                            ], 10 /* CLASS, PROPS */, ["aria-selected", "onClick"]),
                            _createElementVNode("button", {
                              type: "button",
                              role: "tab",
                              "aria-selected": _ctx.promptTemplatesMode !== 'compose',
                              class: _normalizeClass(['mode-pill', { active: _ctx.promptTemplatesMode !== 'compose' }]),
                              onClick: $event => {_ctx.promptTemplatesMode = 'manage'; if(typeof _ctx.saveNavState==='function')_ctx.saveNavState()}
                            }, [
                              (_openBlock(), _createElementBlock("svg", {
                                style: {"width":"12px","height":"12px","vertical-align":"-1px","margin-right":"4px"},
                                viewBox: "0 0 20 20",
                                fill: "none",
                                stroke: "currentColor",
                                "stroke-width": "2",
                                "stroke-linecap": "round"
                              }, [
                                _createElementVNode("path", { d: "M3 5h14M3 10h10M3 15h12" })
                              ])),
                              _createTextVNode(_toDisplayString(_ctx.t('plugins.promptTemplates.mode.manage')), 1 /* TEXT */)
                            ], 10 /* CLASS, PROPS */, ["aria-selected", "onClick"])
                          ], 8 /* PROPS */, ["aria-label"]),
                          (_ctx.promptTemplatesMode === 'compose')
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 0,
                                class: "prompt-compose"
                              }, [
                                _createElementVNode("div", { class: "prompt-compose-workspace" }, [
                                  _createElementVNode("div", { class: "prompt-compose-selected" }, [
                                    _createElementVNode("div", { class: "prompt-compose-selected-title" }, _toDisplayString((_ctx.promptComposerActiveTemplate && _ctx.promptComposerActiveTemplate.name) ? _ctx.promptComposerActiveTemplate.name : _ctx.t('plugins.promptTemplates.compose.chooseTemplate')), 1 /* TEXT */),
                                    _createElementVNode("div", { class: "prompt-compose-selected-meta" }, _toDisplayString((_ctx.promptComposerActiveTemplate && _ctx.promptComposerActiveTemplate.description) ? _ctx.promptComposerActiveTemplate.description : _ctx.t('plugins.promptTemplates.compose.chooseTemplateHint')), 1 /* TEXT */),
                                    (_ctx.promptComposerActiveTemplate && _ctx.promptComposerActiveTemplate.isBuiltin && (_ctx.promptComposerActiveTemplate.createdBy || (_ctx.promptComposerActiveTemplate.maintainers && _ctx.promptComposerActiveTemplate.maintainers.length)))
                                      ? (_openBlock(), _createElementBlock("div", {
                                          key: 0,
                                          class: "plugins-panel-note"
                                        }, _toDisplayString(_ctx.t('plugins.meta.attribution', { createdBy: _ctx.promptComposerActiveTemplate.createdBy || '', maintainers: (_ctx.promptComposerActiveTemplate.maintainers || []).join(', ') })), 1 /* TEXT */))
                                      : _createCommentVNode("v-if", true)
                                  ]),
                                  _createElementVNode("div", { class: "prompt-compose-form" }, [
                                    _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('plugins.promptTemplates.compose.selectTemplate')), 1 /* TEXT */),
                                    _createElementVNode("select", {
                                      class: "form-select prompt-compose-template-select",
                                      value: _ctx.promptComposerSelectedTemplateId,
                                      onChange: $event => (_ctx.selectPromptComposerTemplate($event.target.value)),
                                      disabled: _ctx.pluginsLoading || !_ctx.promptTemplatesList.length
                                    }, [
                                      (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.promptTemplatesList, (tpl) => {
                                        return (_openBlock(), _createElementBlock("option", {
                                          key: 'compose-tpl-' + tpl.id,
                                          value: tpl.id
                                        }, _toDisplayString(tpl.name) + _toDisplayString(tpl.isBuiltin ? _ctx.t('plugins.promptTemplates.compose.builtinSuffix') : ''), 9 /* TEXT, PROPS */, ["value"]))
                                      }), 128 /* KEYED_FRAGMENT */))
                                    ], 40 /* PROPS, NEED_HYDRATION */, ["value", "onChange", "disabled"]),
                                    (!_ctx.promptComposerActiveTemplate)
                                      ? (_openBlock(), _createElementBlock("div", {
                                          key: 0,
                                          class: "plugins-panel-note"
                                        }, _toDisplayString(_ctx.t('plugins.promptTemplates.compose.empty')), 1 /* TEXT */))
                                      : (!_ctx.promptComposerActiveTemplate.isBuiltin)
                                        ? (_openBlock(), _createElementBlock("div", {
                                            key: 1,
                                            class: "plugins-panel-note"
                                          }, _toDisplayString(_ctx.t('plugins.promptTemplates.compose.varsHint')), 1 /* TEXT */))
                                        : _createCommentVNode("v-if", true),
                                    (_ctx.promptComposerActiveTemplate && !_ctx.promptComposerActiveTemplate.isBuiltin)
                                      ? (_openBlock(), _createElementBlock("div", {
                                          key: 2,
                                          class: "prompt-compose-actions"
                                        }, [
                                          _createElementVNode("button", {
                                            type: "button",
                                            class: "btn-mini",
                                            onClick: $event => (_ctx.selectPromptTemplate(_ctx.promptComposerSelectedTemplateId)),
                                            disabled: _ctx.pluginsLoading || !_ctx.promptComposerSelectedTemplateId
                                          }, _toDisplayString(_ctx.t('plugins.promptTemplates.compose.goManage')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                        ]))
                                      : _createCommentVNode("v-if", true)
                                  ]),
                                  (_ctx.promptComposerActiveTemplate && _ctx.promptComposerActiveTemplate.vars && _ctx.promptComposerActiveTemplate.vars.length)
                                    ? (_openBlock(), _createElementBlock("div", {
                                        key: 0,
                                        class: "prompt-vars-block"
                                      }, [
                                        _createElementVNode("div", { class: "prompt-vars-head" }, [
                                          _createElementVNode("div", null, [
                                            _createElementVNode("div", { class: "prompt-vars-title" }, _toDisplayString(_ctx.t('plugins.promptTemplates.vars.title')), 1 /* TEXT */),
                                            (!_ctx.promptComposerActiveTemplate.isBuiltin)
                                              ? (_openBlock(), _createElementBlock("div", {
                                                  key: 0,
                                                  class: "plugins-panel-note"
                                                }, _toDisplayString(_ctx.t('plugins.promptTemplates.compose.varsHint')), 1 /* TEXT */))
                                              : _createCommentVNode("v-if", true),
                                            (_ctx.promptComposerMissingVars.length)
                                              ? (_openBlock(), _createElementBlock("div", {
                                                  key: 1,
                                                  class: "plugins-panel-note"
                                                }, _toDisplayString(_ctx.t('plugins.promptTemplates.compose.missingCount', { count: _ctx.promptComposerMissingVars.length })), 1 /* TEXT */))
                                              : _createCommentVNode("v-if", true)
                                          ]),
                                          _createElementVNode("div", { class: "prompt-editor-actions" }, [
                                            (_ctx.promptComposerMissingVars.length)
                                              ? (_openBlock(), _createElementBlock("button", {
                                                  key: 0,
                                                  type: "button",
                                                  class: "btn-mini",
                                                  onClick: _ctx.focusPromptComposerFirstMissingVar,
                                                  disabled: _ctx.pluginsLoading
                                                }, _toDisplayString(_ctx.t('plugins.promptTemplates.compose.jumpToMissing')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]))
                                              : _createCommentVNode("v-if", true),
                                            _createElementVNode("button", {
                                              type: "button",
                                              class: "btn-mini",
                                              onClick: _ctx.resetPromptComposerVarValues,
                                              disabled: _ctx.pluginsLoading
                                            }, _toDisplayString(_ctx.t('plugins.promptTemplates.vars.reset')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                          ])
                                        ]),
                                        _createElementVNode("div", { class: "prompt-vars-grid" }, [
                                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.promptComposerActiveTemplate.vars, (name, idx) => {
                                            return (_openBlock(), _createElementBlock("label", {
                                              key: 'prompt-compose-var-' + name,
                                              class: "prompt-var-row"
                                            }, [
                                              _createElementVNode("span", { class: "prompt-var-label mono" }, _toDisplayString(name), 1 /* TEXT */),
                                              (idx === 0)
                                                ? (_openBlock(), _createElementBlock("input", {
                                                    key: 0,
                                                    ref_for: true,
                                                    ref: "promptComposerFirstField",
                                                    class: _normalizeClass(['form-input', 'prompt-var-input', { 'is-missing': _ctx.promptComposerMissingVars.includes(name) }]),
                                                    type: "text",
                                                    value: _ctx.promptComposerVarValues[name] || '',
                                                    onInput: $event => (_ctx.setPromptComposerVarValue(name, $event.target.value)),
                                                    placeholder: _ctx.t('plugins.promptTemplates.vars.valuePlaceholder', { name })
                                                  }, null, 42 /* CLASS, PROPS, NEED_HYDRATION */, ["value", "onInput", "placeholder"]))
                                                : (_openBlock(), _createElementBlock("input", {
                                                    key: 1,
                                                    class: _normalizeClass(['form-input', 'prompt-var-input', { 'is-missing': _ctx.promptComposerMissingVars.includes(name) }]),
                                                    type: "text",
                                                    value: _ctx.promptComposerVarValues[name] || '',
                                                    onInput: $event => (_ctx.setPromptComposerVarValue(name, $event.target.value)),
                                                    placeholder: _ctx.t('plugins.promptTemplates.vars.valuePlaceholder', { name })
                                                  }, null, 42 /* CLASS, PROPS, NEED_HYDRATION */, ["value", "onInput", "placeholder"]))
                                            ]))
                                          }), 128 /* KEYED_FRAGMENT */))
                                        ])
                                      ]))
                                    : _createCommentVNode("v-if", true),
                                  _createElementVNode("div", { class: "prompt-preview-block prompt-compose-preview" }, [
                                    _createElementVNode("div", { class: "prompt-vars-head" }, [
                                      _createElementVNode("div", null, [
                                        _createElementVNode("div", { class: "prompt-vars-title" }, _toDisplayString(_ctx.t('plugins.promptTemplates.compose.outputTitle')), 1 /* TEXT */),
                                        _createElementVNode("div", { class: "plugins-panel-note" }, _toDisplayString(_ctx.t('plugins.promptTemplates.compose.outputHint')), 1 /* TEXT */)
                                      ]),
                                      _createElementVNode("button", {
                                        type: "button",
                                        class: "btn-mini",
                                        onClick: _ctx.copyPromptComposerRendered,
                                        disabled: _ctx.pluginsLoading || !_ctx.promptComposerRendered
                                      }, _toDisplayString(_ctx.t('plugins.promptTemplates.compose.copy')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                    ]),
                                    _createElementVNode("textarea", {
                                      class: "form-input prompt-preview-textarea",
                                      value: _ctx.promptComposerRendered,
                                      rows: "10",
                                      readonly: "",
                                      spellcheck: "false",
                                      "aria-label": _ctx.t('plugins.promptTemplates.compose.outputAria')
                                    }, null, 8 /* PROPS */, ["value", "aria-label"])
                                  ])
                                ])
                              ]))
                            : (_openBlock(), _createElementBlock("div", {
                                key: 1,
                                class: "prompt-templates-grid"
                              }, [
                                _createElementVNode("div", { class: "prompt-templates-pane prompt-templates-pane-list" }, [
                                  _createElementVNode("div", { class: "prompt-templates-toolbar" }, [
                                    _withDirectives(_createElementVNode("input", {
                                      class: "form-input",
                                      type: "text",
                                      "onUpdate:modelValue": $event => ((_ctx.promptTemplatesKeyword) = $event),
                                      "aria-label": _ctx.t('plugins.promptTemplates.manage.searchAria'),
                                      placeholder: _ctx.t('plugins.promptTemplates.manage.searchPlaceholder')
                                    }, null, 8 /* PROPS */, ["onUpdate:modelValue", "aria-label", "placeholder"]), [
                                      [
                                        _vModelText,
                                        _ctx.promptTemplatesKeyword,
                                        void 0,
                                        { trim: true }
                                      ]
                                    ]),
                                    _createElementVNode("button", {
                                      type: "button",
                                      class: "btn-mini",
                                      onClick: _ctx.createPromptTemplate,
                                      disabled: _ctx.pluginsLoading
                                    }, _toDisplayString(_ctx.t('plugins.promptTemplates.manage.create')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                                    _createElementVNode("button", {
                                      type: "button",
                                      class: "btn-mini",
                                      onClick: _ctx.exportPromptTemplates,
                                      disabled: _ctx.pluginsLoading || !_ctx.promptTemplatesList.length
                                    }, _toDisplayString(_ctx.t('plugins.promptTemplates.manage.export')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                                    _createElementVNode("button", {
                                      type: "button",
                                      class: "btn-mini",
                                      onClick: _ctx.triggerPromptTemplatesImport,
                                      disabled: _ctx.pluginsLoading
                                    }, _toDisplayString(_ctx.t('plugins.promptTemplates.manage.import')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                  ]),
                                  (_ctx.pluginsLoading && !_ctx.promptTemplatesLoadedOnce)
                                    ? (_openBlock(), _createElementBlock("div", {
                                        key: 0,
                                        class: "skills-empty-state"
                                      }, _toDisplayString(_ctx.t('plugins.promptTemplates.manage.loading')), 1 /* TEXT */))
                                    : (!_ctx.filteredPromptTemplates.length)
                                      ? (_openBlock(), _createElementBlock("div", {
                                          key: 1,
                                          class: "skills-empty-state"
                                        }, _toDisplayString(_ctx.t('plugins.promptTemplates.manage.empty')), 1 /* TEXT */))
                                      : (_openBlock(), _createElementBlock("div", {
                                          key: 2,
                                          class: "prompt-templates-list",
                                          role: "list"
                                        }, [
                                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.filteredPromptTemplates, (tpl) => {
                                            return (_openBlock(), _createElementBlock("button", {
                                              key: 'prompt-template-' + tpl.id,
                                              type: "button",
                                              class: _normalizeClass(['prompt-template-item', { active: _ctx.promptTemplateSelectedId === tpl.id }]),
                                              "aria-current": _ctx.promptTemplateSelectedId === tpl.id ? 'page' : null,
                                              onClick: $event => (_ctx.selectPromptTemplate(tpl.id))
                                            }, [
                                              _createElementVNode("div", { class: "prompt-template-item-main" }, [
                                                _createElementVNode("div", { class: "prompt-template-item-title" }, _toDisplayString(tpl.name), 1 /* TEXT */),
                                                _createElementVNode("div", { class: "prompt-template-item-meta" }, [
                                                  _createElementVNode("span", { class: "mono" }, _toDisplayString(_ctx.t('plugins.promptTemplates.manage.vars', { count: tpl.varCount })), 1 /* TEXT */),
                                                  _createElementVNode("span", null, "·"),
                                                  _createElementVNode("span", { class: "mono" }, _toDisplayString(tpl.updatedLabel), 1 /* TEXT */)
                                                ])
                                              ]),
                                              _createElementVNode("span", {
                                                class: _normalizeClass(['pill', tpl.isBuiltin ? 'configured' : 'source'])
                                              }, _toDisplayString(tpl.isBuiltin ? _ctx.t('plugins.promptTemplates.manage.builtin') : _ctx.t('plugins.promptTemplates.manage.custom')), 3 /* TEXT, CLASS */)
                                            ], 10 /* CLASS, PROPS */, ["aria-current", "onClick"]))
                                          }), 128 /* KEYED_FRAGMENT */))
                                        ]))
                                ]),
                                _createElementVNode("div", { class: "prompt-templates-pane prompt-templates-pane-editor" }, [
                                  (!_ctx.promptTemplateDraft)
                                    ? (_openBlock(), _createElementBlock("div", {
                                        key: 0,
                                        class: "skills-empty-state"
                                      }, _toDisplayString(_ctx.t('plugins.promptTemplates.editor.selectHint')), 1 /* TEXT */))
                                    : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                                        _createElementVNode("div", { class: "prompt-editor-head" }, [
                                          _createElementVNode("div", { class: "prompt-editor-title-row" }, [
                                            _withDirectives(_createElementVNode("input", {
                                              class: "form-input prompt-editor-name",
                                              type: "text",
                                              "onUpdate:modelValue": $event => ((_ctx.promptTemplateDraftRaw.name) = $event),
                                              disabled: _ctx.promptTemplateDraft.isBuiltin,
                                              placeholder: _ctx.t('plugins.promptTemplates.editor.namePlaceholder'),
                                              "aria-label": _ctx.t('plugins.promptTemplates.editor.nameAria')
                                            }, null, 8 /* PROPS */, ["onUpdate:modelValue", "disabled", "placeholder", "aria-label"]), [
                                              [
                                                _vModelText,
                                                _ctx.promptTemplateDraftRaw.name,
                                                void 0,
                                                { trim: true }
                                              ]
                                            ]),
                                            (!_ctx.promptTemplateDraft.isBuiltin)
                                              ? (_openBlock(), _createElementBlock("div", {
                                                  key: 0,
                                                  class: "prompt-editor-actions"
                                                }, [
                                                  _createElementVNode("button", {
                                                    type: "button",
                                                    class: "btn-mini",
                                                    onClick: _ctx.duplicatePromptTemplate,
                                                    disabled: _ctx.pluginsLoading
                                                  }, _toDisplayString(_ctx.t('plugins.promptTemplates.editor.duplicate')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                                                  _createElementVNode("button", {
                                                    type: "button",
                                                    class: "btn-mini delete",
                                                    onClick: _ctx.deletePromptTemplate,
                                                    disabled: _ctx.pluginsLoading
                                                  }, _toDisplayString(_ctx.t('plugins.promptTemplates.editor.delete')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                                                  _createElementVNode("button", {
                                                    type: "button",
                                                    class: "btn-mini",
                                                    onClick: _ctx.savePromptTemplate,
                                                    disabled: _ctx.pluginsLoading
                                                  }, _toDisplayString(_ctx.t('plugins.promptTemplates.editor.save')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                                ]))
                                              : _createCommentVNode("v-if", true)
                                          ]),
                                          (_ctx.promptTemplateDraft.isBuiltin)
                                            ? (_openBlock(), _createElementBlock("div", {
                                                key: 0,
                                                class: "plugins-panel-note"
                                              }, _toDisplayString(_ctx.t('plugins.promptTemplates.editor.builtinReadOnly')), 1 /* TEXT */))
                                            : _createCommentVNode("v-if", true),
                                          (_ctx.promptTemplateDraft.isBuiltin && (_ctx.promptTemplateDraft.createdBy || (_ctx.promptTemplateDraft.maintainers && _ctx.promptTemplateDraft.maintainers.length)))
                                            ? (_openBlock(), _createElementBlock("div", {
                                                key: 1,
                                                class: "plugins-panel-note"
                                              }, _toDisplayString(_ctx.t('plugins.meta.attribution', { createdBy: _ctx.promptTemplateDraft.createdBy || '', maintainers: (_ctx.promptTemplateDraft.maintainers || []).join(', ') })), 1 /* TEXT */))
                                            : _createCommentVNode("v-if", true),
                                          _withDirectives(_createElementVNode("input", {
                                            class: "form-input",
                                            type: "text",
                                            "onUpdate:modelValue": $event => ((_ctx.promptTemplateDraftRaw.description) = $event),
                                            disabled: _ctx.promptTemplateDraft.isBuiltin,
                                            placeholder: _ctx.t('plugins.promptTemplates.editor.descPlaceholder'),
                                            "aria-label": _ctx.t('plugins.promptTemplates.editor.descAria')
                                          }, null, 8 /* PROPS */, ["onUpdate:modelValue", "disabled", "placeholder", "aria-label"]), [
                                            [
                                              _vModelText,
                                              _ctx.promptTemplateDraftRaw.description,
                                              void 0,
                                              { trim: true }
                                            ]
                                          ])
                                        ]),
                                        _createElementVNode("div", { class: "prompt-editor-body" }, [
                                          _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('plugins.promptTemplates.editor.templateLabel')), 1 /* TEXT */),
                                          _withDirectives(_createElementVNode("textarea", {
                                            class: "form-input prompt-editor-textarea",
                                            "onUpdate:modelValue": $event => ((_ctx.promptTemplateDraftRaw.template) = $event),
                                            disabled: _ctx.promptTemplateDraft.isBuiltin,
                                            rows: "10",
                                            spellcheck: "false",
                                            "aria-label": _ctx.t('plugins.promptTemplates.editor.templateAria'),
                                            placeholder: _ctx.t('plugins.promptTemplates.editor.templatePlaceholder')
                                          }, null, 8 /* PROPS */, ["onUpdate:modelValue", "disabled", "aria-label", "placeholder"]), [
                                            [_vModelText, _ctx.promptTemplateDraftRaw.template]
                                          ]),
                                          _createElementVNode("div", { class: "prompt-vars-block" }, [
                                            _createElementVNode("div", { class: "prompt-vars-head" }, [
                                              _createElementVNode("div", null, [
                                                _createElementVNode("div", { class: "prompt-vars-title" }, _toDisplayString(_ctx.t('plugins.promptTemplates.vars.title')), 1 /* TEXT */),
                                                _createElementVNode("div", { class: "plugins-panel-note" }, _toDisplayString(_ctx.t('plugins.promptTemplates.vars.hint')), 1 /* TEXT */)
                                              ]),
                                              (!_ctx.promptTemplateDraft.isBuiltin)
                                                ? (_openBlock(), _createElementBlock("div", {
                                                    key: 0,
                                                    class: "prompt-editor-actions"
                                                  }, [
                                                    _createElementVNode("button", {
                                                      type: "button",
                                                      class: "btn-mini",
                                                      onClick: _ctx.resetPromptVariableValues,
                                                      disabled: _ctx.pluginsLoading
                                                    }, _toDisplayString(_ctx.t('plugins.promptTemplates.vars.reset')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                                  ]))
                                                : _createCommentVNode("v-if", true)
                                            ]),
                                            (!_ctx.promptTemplateVars.length)
                                              ? (_openBlock(), _createElementBlock("div", {
                                                  key: 0,
                                                  class: "prompt-vars-empty"
                                                }, _toDisplayString(_ctx.t('plugins.promptTemplates.vars.empty')), 1 /* TEXT */))
                                              : (_openBlock(), _createElementBlock("div", {
                                                  key: 1,
                                                  class: "prompt-vars-grid"
                                                }, [
                                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.promptTemplateVars, (name) => {
                                                    return (_openBlock(), _createElementBlock("label", {
                                                      key: 'prompt-var-' + name,
                                                      class: "prompt-var-row"
                                                    }, [
                                                      _createElementVNode("span", { class: "prompt-var-label mono" }, _toDisplayString(name), 1 /* TEXT */),
                                                      _createElementVNode("input", {
                                                        class: "form-input prompt-var-input",
                                                        type: "text",
                                                        readonly: _ctx.promptTemplateDraft.isBuiltin,
                                                        value: _ctx.promptTemplateVarValues[name] || '',
                                                        onInput: $event => (_ctx.setPromptVariableValue(name, $event.target.value)),
                                                        placeholder: _ctx.t('plugins.promptTemplates.vars.valuePlaceholder', { name })
                                                      }, null, 40 /* PROPS, NEED_HYDRATION */, ["readonly", "value", "onInput", "placeholder"])
                                                    ]))
                                                  }), 128 /* KEYED_FRAGMENT */))
                                                ]))
                                          ]),
                                          _createElementVNode("div", { class: "prompt-preview-block" }, [
                                            _createElementVNode("div", { class: "prompt-vars-head" }, [
                                              _createElementVNode("div", null, [
                                                _createElementVNode("div", { class: "prompt-vars-title" }, _toDisplayString(_ctx.t('plugins.promptTemplates.preview.title')), 1 /* TEXT */),
                                                _createElementVNode("div", { class: "plugins-panel-note" }, _toDisplayString(_ctx.t('plugins.promptTemplates.preview.hint')), 1 /* TEXT */)
                                              ]),
                                              _createElementVNode("button", {
                                                type: "button",
                                                class: "btn-mini",
                                                onClick: _ctx.copyRenderedPrompt,
                                                disabled: _ctx.pluginsLoading
                                              }, _toDisplayString(_ctx.t('plugins.promptTemplates.preview.copy')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                                            ]),
                                            _createElementVNode("textarea", {
                                              class: "form-input prompt-preview-textarea",
                                              value: _ctx.renderedPrompt,
                                              rows: "10",
                                              readonly: "",
                                              spellcheck: "false",
                                              "aria-label": _ctx.t('plugins.promptTemplates.preview.outputAria')
                                            }, null, 8 /* PROPS */, ["value", "aria-label"])
                                          ])
                                        ])
                                      ], 64 /* STABLE_FRAGMENT */))
                                ])
                              ]))
                        ]))
                      : (_openBlock(), _createElementBlock("div", {
                          key: 3,
                          class: "skills-empty-state"
                        }, _toDisplayString(_ctx.t('plugins.promptTemplates.noPluginSelected')), 1 /* TEXT */))
              ], 8 /* PROPS */, ["aria-label"])
            ])
          ], 512 /* NEED_PATCH */), [
            [_vShow, _ctx.mainTab === 'plugins']
          ]),
          _createElementVNode("input", {
            ref: "promptTemplatesImportInput",
            type: "file",
            accept: ".json,application/json",
            style: {"display":"none"},
            onChange: _ctx.handlePromptTemplatesImportChange
          }, null, 40 /* PROPS, NEED_HYDRATION */, ["onChange"]),
          _createCommentVNode(" 加载状态 "),
          (_ctx.loading)
            ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "state-message"
              }, _toDisplayString(_ctx.t('app.loadingConfig')), 1 /* TEXT */))
            : (_ctx.initError)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 2,
                  class: "state-message error"
                }, [
                  _createCommentVNode(" 错误状态 "),
                  _createTextVNode(" " + _toDisplayString(_ctx.initError), 1 /* TEXT */)
                ]))
              : _createCommentVNode("v-if", true)
        ])
      ])
    ], 2 /* CLASS */),
    _createCommentVNode(" 添加提供商模态框 "),
    (_ctx.showAddModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 2,
          class: "modal-overlay",
          onClick: _withModifiers(_ctx.closeAddModal, ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "add-provider-modal-title"
          }, [
            _createElementVNode("div", {
              class: "modal-title",
              id: "add-provider-modal-title"
            }, _toDisplayString(_ctx.t('modal.providerAdd.title')), 1 /* TEXT */),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.name')), 1 /* TEXT */),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.newProvider.name) = $event),
                class: _normalizeClass(['form-input', { invalid: !!_ctx.providerFieldError('add', 'name') }]),
                placeholder: _ctx.t('placeholder.providerNameExample'),
                autocomplete: "off",
                spellcheck: "false",
                onBlur: $event => (_ctx.normalizeProviderDraft('add'))
              }, null, 42 /* CLASS, PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "placeholder", "onBlur"]), [
                [_vModelText, _ctx.newProvider.name]
              ]),
              (_ctx.providerFieldError('add', 'name'))
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "form-hint form-error"
                  }, _toDisplayString(_ctx.providerFieldError('add', 'name')), 1 /* TEXT */))
                : _createCommentVNode("v-if", true)
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.apiEndpoint')), 1 /* TEXT */),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.newProvider.url) = $event),
                class: _normalizeClass(['form-input', { invalid: !!_ctx.providerFieldError('add', 'url') }]),
                placeholder: _ctx.t('placeholder.apiEndpointExample'),
                autocomplete: "off",
                spellcheck: "false",
                onBlur: $event => (_ctx.normalizeProviderDraft('add'))
              }, null, 42 /* CLASS, PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "placeholder", "onBlur"]), [
                [_vModelText, _ctx.newProvider.url]
              ]),
              (_ctx.providerFieldError('add', 'url'))
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "form-hint form-error"
                  }, _toDisplayString(_ctx.providerFieldError('add', 'url')), 1 /* TEXT */))
                : _createCommentVNode("v-if", true)
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.apiKey')), 1 /* TEXT */),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.newProvider.key) = $event),
                class: "form-input",
                type: "password",
                placeholder: "sk-..."
              }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.newProvider.key]
              ])
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, [
                _withDirectives(_createElementVNode("input", {
                  type: "checkbox",
                  "onUpdate:modelValue": $event => ((_ctx.newProvider.useTransform) = $event)
                }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                  [_vModelCheckbox, _ctx.newProvider.useTransform]
                ]),
                _createTextVNode(" " + _toDisplayString(_ctx.t('field.useBuiltinTransform')), 1 /* TEXT */)
              ])
            ]),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-cancel",
                onClick: _ctx.closeAddModal
              }, _toDisplayString(_ctx.t('common.cancel')), 9 /* TEXT, PROPS */, ["onClick"]),
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: _ctx.addProvider,
                disabled: !_ctx.canSubmitProvider('add')
              }, _toDisplayString(_ctx.t('common.add')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    _createCommentVNode(" 编辑提供商模态框 "),
    (_ctx.showEditModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 3,
          class: "modal-overlay",
          onClick: _withModifiers(_ctx.closeEditModal, ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "edit-provider-modal-title"
          }, [
            _createElementVNode("div", {
              class: "modal-title",
              id: "edit-provider-modal-title"
            }, _toDisplayString(_ctx.t('modal.providerEdit.title')), 1 /* TEXT */),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.name')), 1 /* TEXT */),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.editingProvider.name) = $event),
                class: "form-input",
                placeholder: _ctx.t('placeholder.providerName'),
                readonly: ""
              }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                [_vModelText, _ctx.editingProvider.name]
              ])
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.apiEndpoint')), 1 /* TEXT */),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.editingProvider.url) = $event),
                class: _normalizeClass(['form-input', { invalid: !!_ctx.providerFieldError('edit', 'url') }]),
                placeholder: _ctx.t('placeholder.apiEndpointExample'),
                autocomplete: "off",
                spellcheck: "false",
                onBlur: $event => (_ctx.normalizeProviderDraft('edit'))
              }, null, 42 /* CLASS, PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "placeholder", "onBlur"]), [
                [_vModelText, _ctx.editingProvider.url]
              ]),
              (_ctx.providerFieldError('edit', 'url'))
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "form-hint form-error"
                  }, _toDisplayString(_ctx.providerFieldError('edit', 'url')), 1 /* TEXT */))
                : _createCommentVNode("v-if", true)
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.apiKey')), 1 /* TEXT */),
              _createElementVNode("div", { class: "input-with-toggle" }, [
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": $event => ((_ctx.editingProvider.key) = $event),
                  class: "form-input",
                  type: _ctx.showEditProviderKey ? 'text' : 'password',
                  placeholder: "sk-...",
                  autocomplete: "off",
                  spellcheck: "false"
                }, null, 8 /* PROPS */, ["onUpdate:modelValue", "type"]), [
                  [_vModelDynamic, _ctx.editingProvider.key]
                ]),
                _createElementVNode("button", {
                  type: "button",
                  class: "input-toggle-btn",
                  onClick: _ctx.toggleEditProviderKey,
                  title: _ctx.showEditProviderKey ? _ctx.t('common.hide') : _ctx.t('common.show')
                }, [
                  (!_ctx.showEditProviderKey)
                    ? (_openBlock(), _createElementBlock("svg", {
                        key: 0,
                        viewBox: "0 0 20 20",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "1.5",
                        width: "16",
                        height: "16"
                      }, [
                        _createElementVNode("path", { d: "M10 4C5 4 1.73 8.11 1 10c.73 1.89 4 6 9 6s8.27-4.11 9-6c-.73-1.89-4-6-9-6z" }),
                        _createElementVNode("circle", {
                          cx: "10",
                          cy: "10",
                          r: "3"
                        })
                      ]))
                    : (_openBlock(), _createElementBlock("svg", {
                        key: 1,
                        viewBox: "0 0 20 20",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "1.5",
                        width: "16",
                        height: "16"
                      }, [
                        _createElementVNode("path", { d: "M2 2l16 16M8.2 4.2A9.9 9.9 0 0 1 10 4c5 0 8.27 4.11 9 6-.44.94-1.5 2.7-3.2 4.2M14.5 14.5A5.9 5.9 0 0 1 10 16c-5 0-8.27-4.11-9-6 .76-1.66 2.2-3.6 4.3-5" })
                      ]))
                ], 8 /* PROPS */, ["onClick", "title"])
              ])
            ]),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-cancel",
                onClick: _ctx.closeEditModal
              }, _toDisplayString(_ctx.t('common.cancel')), 9 /* TEXT, PROPS */, ["onClick"]),
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: _ctx.updateProvider,
                disabled: !_ctx.canSubmitProvider('edit')
              }, _toDisplayString(_ctx.t('common.save')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    _createCommentVNode(" 添加模型模态框 "),
    (_ctx.showModelModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 4,
          class: "modal-overlay",
          onClick: _withModifiers(_ctx.closeModelModal, ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "add-model-modal-title"
          }, [
            _createElementVNode("div", {
              class: "modal-title",
              id: "add-model-modal-title"
            }, _toDisplayString(_ctx.t('modal.modelAdd.title')), 1 /* TEXT */),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.modelName')), 1 /* TEXT */),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.newModelName) = $event),
                class: "form-input",
                placeholder: _ctx.t('placeholder.modelExample')
              }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                [_vModelText, _ctx.newModelName]
              ])
            ]),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-cancel",
                onClick: _ctx.closeModelModal
              }, _toDisplayString(_ctx.t('common.cancel')), 9 /* TEXT, PROPS */, ["onClick"]),
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: _ctx.addModel
              }, _toDisplayString(_ctx.t('common.add')), 9 /* TEXT, PROPS */, ["onClick"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    _createCommentVNode(" 模型列表模态框 "),
    (_ctx.showModelListModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 5,
          class: "modal-overlay",
          onClick: _withModifiers($event => (_ctx.showModelListModal = false), ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "manage-models-modal-title"
          }, [
            _createElementVNode("div", {
              class: "modal-title",
              id: "manage-models-modal-title"
            }, _toDisplayString(_ctx.t('modal.modelManage.title')), 1 /* TEXT */),
            _createElementVNode("div", { class: "model-list" }, [
              (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.models, (model) => {
                return (_openBlock(), _createElementBlock("div", {
                  key: model,
                  class: "model-item"
                }, [
                  _createElementVNode("span", null, _toDisplayString(model), 1 /* TEXT */),
                  _createElementVNode("button", {
                    type: "button",
                    class: "btn-remove-model",
                    onClick: $event => (_ctx.removeModel(model))
                  }, _toDisplayString(_ctx.t('common.delete')), 9 /* TEXT, PROPS */, ["onClick"])
                ]))
              }), 128 /* KEYED_FRAGMENT */))
            ]),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: $event => (_ctx.showModelListModal = false)
              }, _toDisplayString(_ctx.t('common.close')), 9 /* TEXT, PROPS */, ["onClick"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    _createCommentVNode(" 添加Claude配置模态框 "),
    (_ctx.showClaudeConfigModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 6,
          class: "modal-overlay",
          onClick: _withModifiers(_ctx.closeClaudeConfigModal, ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "add-claude-config-modal-title"
          }, [
            _createElementVNode("div", {
              class: "modal-title",
              id: "add-claude-config-modal-title"
            }, _toDisplayString(_ctx.t('modal.claudeConfigAdd.title')), 1 /* TEXT */),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.configName')), 1 /* TEXT */),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.newClaudeConfig.name) = $event),
                class: "form-input",
                placeholder: _ctx.t('placeholder.configNameExample')
              }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                [_vModelText, _ctx.newClaudeConfig.name]
              ])
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, "API Key"),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.newClaudeConfig.apiKey) = $event),
                class: "form-input",
                type: "password",
                autocomplete: "off",
                spellcheck: "false",
                placeholder: _ctx.t('placeholder.apiKeyExampleClaude')
              }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                [_vModelText, _ctx.newClaudeConfig.apiKey]
              ])
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.baseUrl')), 1 /* TEXT */),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.newClaudeConfig.baseUrl) = $event),
                class: "form-input",
                placeholder: _ctx.t('placeholder.baseUrlExampleClaude')
              }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                [_vModelText, _ctx.newClaudeConfig.baseUrl]
              ])
            ]),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-cancel",
                onClick: _ctx.closeClaudeConfigModal
              }, _toDisplayString(_ctx.t('common.cancel')), 9 /* TEXT, PROPS */, ["onClick"]),
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: _ctx.addClaudeConfig
              }, _toDisplayString(_ctx.t('common.add')), 9 /* TEXT, PROPS */, ["onClick"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    _createCommentVNode(" 编辑Claude配置模态框 "),
    (_ctx.showEditConfigModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 7,
          class: "modal-overlay",
          onClick: _withModifiers(_ctx.closeEditConfigModal, ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "edit-claude-config-modal-title"
          }, [
            _createElementVNode("div", {
              class: "modal-title",
              id: "edit-claude-config-modal-title"
            }, _toDisplayString(_ctx.t('modal.claudeConfigEdit.title')), 1 /* TEXT */),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.configName')), 1 /* TEXT */),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.editingConfig.name) = $event),
                class: "form-input",
                placeholder: _ctx.t('field.configName'),
                readonly: ""
              }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                [_vModelText, _ctx.editingConfig.name]
              ])
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, "API Key"),
              _createElementVNode("div", { class: "input-with-toggle" }, [
                _withDirectives(_createElementVNode("input", {
                  "onUpdate:modelValue": $event => ((_ctx.editingConfig.apiKey) = $event),
                  class: "form-input",
                  type: _ctx.showEditClaudeConfigKey ? 'text' : 'password',
                  autocomplete: "off",
                  spellcheck: "false",
                  placeholder: _ctx.t('placeholder.apiKeyExampleClaude')
                }, null, 8 /* PROPS */, ["onUpdate:modelValue", "type", "placeholder"]), [
                  [_vModelDynamic, _ctx.editingConfig.apiKey]
                ]),
                _createElementVNode("button", {
                  type: "button",
                  class: "input-toggle-btn",
                  onClick: _ctx.toggleEditClaudeConfigKey,
                  title: _ctx.showEditClaudeConfigKey ? _ctx.t('common.hide') : _ctx.t('common.show')
                }, [
                  (!_ctx.showEditClaudeConfigKey)
                    ? (_openBlock(), _createElementBlock("svg", {
                        key: 0,
                        viewBox: "0 0 20 20",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "1.5",
                        width: "16",
                        height: "16"
                      }, [
                        _createElementVNode("path", { d: "M10 4C5 4 1.73 8.11 1 10c.73 1.89 4 6 9 6s8.27-4.11 9-6c-.73-1.89-4-6-9-6z" }),
                        _createElementVNode("circle", {
                          cx: "10",
                          cy: "10",
                          r: "3"
                        })
                      ]))
                    : (_openBlock(), _createElementBlock("svg", {
                        key: 1,
                        viewBox: "0 0 20 20",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "1.5",
                        width: "16",
                        height: "16"
                      }, [
                        _createElementVNode("path", { d: "M2 2l16 16M8.2 4.2A9.9 9.9 0 0 1 10 4c5 0 8.27 4.11 9 6-.44.94-1.5 2.7-3.2 4.2M14.5 14.5A5.9 5.9 0 0 1 10 16c-5 0-8.27-4.11-9-6 .76-1.66 2.2-3.6 4.3-5" })
                      ]))
                ], 8 /* PROPS */, ["onClick", "title"])
              ])
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.baseUrl')), 1 /* TEXT */),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.editingConfig.baseUrl) = $event),
                class: "form-input",
                placeholder: _ctx.t('placeholder.baseUrlExampleClaude')
              }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                [_vModelText, _ctx.editingConfig.baseUrl]
              ])
            ]),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-cancel",
                onClick: _ctx.closeEditConfigModal
              }, _toDisplayString(_ctx.t('common.cancel')), 9 /* TEXT, PROPS */, ["onClick"]),
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: _ctx.saveAndApplyConfig
              }, _toDisplayString(_ctx.t('common.saveApply')), 9 /* TEXT, PROPS */, ["onClick"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    _createCommentVNode(" Codex 轮询池控制模态框 "),
    (_ctx.showCodexBridgePoolModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 8,
          class: "modal-overlay",
          onClick: _withModifiers($event => (_ctx.showCodexBridgePoolModal = false), ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal modal-bridge-pool",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "codex-bridge-pool-modal-title"
          }, [
            _createElementVNode("div", {
              class: "modal-title",
              id: "codex-bridge-pool-modal-title"
            }, [
              (_openBlock(), _createElementBlock("svg", {
                class: "modal-title-icon",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2",
                width: "18",
                height: "18"
              }, [
                _createElementVNode("circle", {
                  cx: "6",
                  cy: "6",
                  r: "2"
                }),
                _createElementVNode("circle", {
                  cx: "18",
                  cy: "6",
                  r: "2"
                }),
                _createElementVNode("circle", {
                  cx: "12",
                  cy: "18",
                  r: "2"
                }),
                _createElementVNode("path", { d: "M6 8v4h6v4" }),
                _createElementVNode("path", { d: "M18 8v4h-6v4" })
              ])),
              _createTextVNode(" 轮询池设置 ")
            ]),
            _createElementVNode("div", { class: "bridge-pool-modal-hint" }, "勾选参与负载均衡的提供商"),
            (_ctx.localBridgeCandidateProviders().length === 0)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "bridge-pool-empty"
                }, [
                  (_openBlock(), _createElementBlock("svg", {
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    "stroke-width": "1.5",
                    width: "16",
                    height: "16"
                  }, [
                    _createElementVNode("path", { d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" })
                  ])),
                  _createElementVNode("span", null, "暂无可用上游 provider，请先添加直连 provider")
                ]))
              : (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "bridge-pool-list"
                }, [
                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.localBridgeCandidateProviders(), (cp) => {
                    return (_openBlock(), _createElementBlock("label", {
                      key: cp.name,
                      class: "bridge-pool-item"
                    }, [
                      _createElementVNode("span", { class: "bridge-pool-item-name" }, _toDisplayString(cp.name), 1 /* TEXT */),
                      _createElementVNode("span", {
                        class: _normalizeClass(["bridge-pool-item-status", { active: !_ctx.isLocalBridgeExcluded(cp.name) }])
                      }, _toDisplayString(_ctx.isLocalBridgeExcluded(cp.name) ? '未启用' : '已启用'), 3 /* TEXT, CLASS */),
                      _createElementVNode("input", {
                        type: "checkbox",
                        checked: !_ctx.isLocalBridgeExcluded(cp.name),
                        onChange: $event => (_ctx.toggleLocalBridgeExcluded(cp.name))
                      }, null, 40 /* PROPS, NEED_HYDRATION */, ["checked", "onChange"])
                    ]))
                  }), 128 /* KEYED_FRAGMENT */))
                ])),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: $event => (_ctx.showCodexBridgePoolModal = false)
              }, _toDisplayString(_ctx.t('common.close')), 9 /* TEXT, PROPS */, ["onClick"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    (_ctx.showClaudeBridgePoolModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 9,
          class: "modal-overlay",
          onClick: _withModifiers($event => (_ctx.showClaudeBridgePoolModal = false), ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal modal-bridge-pool",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "claude-bridge-pool-modal-title"
          }, [
            _createElementVNode("div", {
              class: "modal-title",
              id: "claude-bridge-pool-modal-title"
            }, [
              (_openBlock(), _createElementBlock("svg", {
                class: "modal-title-icon",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2",
                width: "18",
                height: "18"
              }, [
                _createElementVNode("circle", {
                  cx: "6",
                  cy: "6",
                  r: "2"
                }),
                _createElementVNode("circle", {
                  cx: "18",
                  cy: "6",
                  r: "2"
                }),
                _createElementVNode("circle", {
                  cx: "12",
                  cy: "18",
                  r: "2"
                }),
                _createElementVNode("path", { d: "M6 8v4h6v4" }),
                _createElementVNode("path", { d: "M18 8v4h-6v4" })
              ])),
              _createTextVNode(" " + _toDisplayString(_ctx.t('claude.localBridge.poolTitle')), 1 /* TEXT */)
            ]),
            _createElementVNode("div", { class: "bridge-pool-modal-hint" }, _toDisplayString(_ctx.t('claude.localBridge.poolHint')), 1 /* TEXT */),
            (_ctx.claudeLocalBridgeCandidateProviders().length === 0)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "bridge-pool-empty"
                }, [
                  (_openBlock(), _createElementBlock("svg", {
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    "stroke-width": "1.5",
                    width: "16",
                    height: "16"
                  }, [
                    _createElementVNode("path", { d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" })
                  ])),
                  _createElementVNode("span", null, _toDisplayString(_ctx.t('claude.localBridge.noProviders')), 1 /* TEXT */)
                ]))
              : (_openBlock(), _createElementBlock("div", {
                  key: 1,
                  class: "bridge-pool-list"
                }, [
                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.claudeLocalBridgeCandidateProviders(), (cp) => {
                    return (_openBlock(), _createElementBlock("label", {
                      key: cp.name,
                      class: "bridge-pool-item"
                    }, [
                      _createElementVNode("span", { class: "bridge-pool-item-name" }, _toDisplayString(cp.name), 1 /* TEXT */),
                      _createElementVNode("span", {
                        class: _normalizeClass(["bridge-pool-item-status", { active: !_ctx.isClaudeLocalBridgeExcluded(cp.name) }])
                      }, _toDisplayString(_ctx.isClaudeLocalBridgeExcluded(cp.name) ? _ctx.t('claude.localBridge.disabled') : _ctx.t('claude.localBridge.enabled')), 3 /* TEXT, CLASS */),
                      _createElementVNode("input", {
                        type: "checkbox",
                        checked: !_ctx.isClaudeLocalBridgeExcluded(cp.name),
                        onChange: $event => (_ctx.toggleClaudeLocalBridgeExcluded(cp.name))
                      }, null, 40 /* PROPS, NEED_HYDRATION */, ["checked", "onChange"])
                    ]))
                  }), 128 /* KEYED_FRAGMENT */))
                ])),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: $event => (_ctx.showClaudeBridgePoolModal = false)
              }, _toDisplayString(_ctx.t('common.close')), 9 /* TEXT, PROPS */, ["onClick"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    _createCommentVNode(" Webhook 配置模态框 "),
    (_ctx.showWebhookModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 10,
          class: "modal-overlay",
          onClick: _withModifiers(_ctx.closeWebhookModal, ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "webhook-modal-title"
          }, [
            _createElementVNode("div", {
              class: "modal-title",
              id: "webhook-modal-title"
            }, "Webhook 配置"),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, "启用状态"),
              _createElementVNode("label", { class: "settings-toggle" }, [
                _withDirectives(_createElementVNode("input", {
                  type: "checkbox",
                  "onUpdate:modelValue": $event => ((_ctx.webhookConfig.enabled) = $event)
                }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                  [_vModelCheckbox, _ctx.webhookConfig.enabled]
                ]),
                _createElementVNode("span", null, "启用 Webhook")
              ])
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, "URL"),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.webhookConfig.url) = $event),
                class: "form-input",
                type: "url",
                placeholder: "https://example.com/webhook",
                autocomplete: "off",
                spellcheck: "false"
              }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                [_vModelText, _ctx.webhookConfig.url]
              ])
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, "事件"),
              _createElementVNode("div", { class: "webhook-events-checkbox-list" }, [
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.webhookEventOptions, (ev) => {
                  return (_openBlock(), _createElementBlock("label", {
                    key: ev,
                    class: "webhook-event-checkbox-item"
                  }, [
                    _createElementVNode("input", {
                      type: "checkbox",
                      checked: _ctx.webhookConfig.events.includes(ev),
                      onChange: $event => (_ctx.toggleWebhookEvent(ev))
                    }, null, 40 /* PROPS, NEED_HYDRATION */, ["checked", "onChange"]),
                    _createElementVNode("span", null, _toDisplayString(ev), 1 /* TEXT */)
                  ]))
                }), 128 /* KEYED_FRAGMENT */))
              ])
            ]),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-cancel",
                onClick: _ctx.closeWebhookModal
              }, "取消", 8 /* PROPS */, ["onClick"]),
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: _ctx.saveWebhookSettings,
                disabled: _ctx.webhookSaving
              }, _toDisplayString(_ctx.webhookSaving ? '保存中...' : '保存'), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    (_ctx.showOpenclawConfigModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 11,
          class: "modal-overlay",
          onClick: _withModifiers($event => (!(_ctx.openclawSaving || _ctx.openclawApplying) && _ctx.closeOpenclawConfigModal()), ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal modal-wide",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "openclaw-config-modal-title"
          }, [
            _createElementVNode("div", {
              class: "modal-title",
              id: "openclaw-config-modal-title"
            }, _toDisplayString(_ctx.openclawEditorTitle), 1 /* TEXT */),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.configName')), 1 /* TEXT */),
              _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": $event => ((_ctx.openclawEditing.name) = $event),
                class: "form-input",
                readonly: _ctx.openclawEditing.lockName,
                placeholder: _ctx.t('placeholder.openclawConfigNameExample')
              }, null, 8 /* PROPS */, ["onUpdate:modelValue", "readonly", "placeholder"]), [
                [_vModelText, _ctx.openclawEditing.name]
              ])
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.targetFile')), 1 /* TEXT */),
              _createElementVNode("div", { class: "form-hint" }, [
                _createTextVNode(_toDisplayString(_ctx.openclawConfigPath || _ctx.t('common.notLoaded')) + " ", 1 /* TEXT */),
                (_ctx.openclawConfigPath)
                  ? (_openBlock(), _createElementBlock("span", { key: 0 }, " （" + _toDisplayString(_ctx.openclawConfigExists ? _ctx.t('common.exists') : _ctx.t('common.notExistsWillCreateOnApply')) + "） ", 1 /* TEXT */))
                  : _createCommentVNode("v-if", true)
              ]),
              _createElementVNode("div", {
                class: "btn-group",
                style: {"justify-content":"flex-start"}
              }, [
                _createElementVNode("button", {
                  class: "btn btn-confirm secondary",
                  onClick: _ctx.loadOpenclawConfigFromFile,
                  disabled: _ctx.openclawFileLoading
                }, _toDisplayString(_ctx.openclawFileLoading ? _ctx.t('common.loading') : _ctx.t('modal.openclaw.loadCurrent')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
              ])
            ]),
            _createElementVNode("div", { class: "quick-section" }, [
              _createElementVNode("div", { class: "quick-header" }, [
                _createElementVNode("div", null, [
                  _createElementVNode("div", { class: "quick-title" }, _toDisplayString(_ctx.t('modal.openclaw.quick.title')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "form-hint" }, _toDisplayString(_ctx.t('modal.openclaw.quick.subtitle')), 1 /* TEXT */)
                ]),
                _createElementVNode("div", { class: "quick-actions" }, [
                  _createElementVNode("button", {
                    class: "btn-mini",
                    onClick: _ctx.syncOpenclawQuickFromText
                  }, _toDisplayString(_ctx.t('modal.openclaw.quick.readFromEditor')), 9 /* TEXT, PROPS */, ["onClick"]),
                  _createElementVNode("button", {
                    class: "btn-mini",
                    onClick: _ctx.resetOpenclawQuick
                  }, _toDisplayString(_ctx.t('common.clear')), 9 /* TEXT, PROPS */, ["onClick"])
                ])
              ]),
              _createElementVNode("div", { class: "quick-steps" }, [
                _createElementVNode("div", { class: "quick-step" }, [
                  _createElementVNode("span", { class: "step-badge" }, "1"),
                  _createElementVNode("span", null, _toDisplayString(_ctx.t('modal.openclaw.quick.step1')), 1 /* TEXT */)
                ]),
                _createElementVNode("div", { class: "quick-step" }, [
                  _createElementVNode("span", { class: "step-badge" }, "2"),
                  _createElementVNode("span", null, _toDisplayString(_ctx.t('modal.openclaw.quick.step2')), 1 /* TEXT */)
                ]),
                _createElementVNode("div", { class: "quick-step" }, [
                  _createElementVNode("span", { class: "step-badge" }, "3"),
                  _createElementVNode("span", null, _toDisplayString(_ctx.t('modal.openclaw.quick.step3')), 1 /* TEXT */)
                ])
              ]),
              _createElementVNode("div", { class: "quick-grid" }, [
                _createElementVNode("div", { class: "quick-card" }, [
                  _createElementVNode("div", { class: "structured-card-title" }, "Provider"),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.providerName')), 1 /* TEXT */),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": $event => ((_ctx.openclawQuick.providerName) = $event),
                      class: "form-input",
                      placeholder: "例如: custom-myapi"
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.openclawQuick.providerName]
                    ]),
                    _createElementVNode("div", { class: "form-hint" }, _toDisplayString(_ctx.t('modal.openclaw.quick.providerHint')), 1 /* TEXT */)
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.baseUrl')), 1 /* TEXT */),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": $event => ((_ctx.openclawQuick.baseUrl) = $event),
                      class: "form-input",
                      placeholder: "https://api.example.com/v1",
                      readonly: _ctx.openclawQuick.baseUrlReadOnly
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue", "readonly"]), [
                      [_vModelText, _ctx.openclawQuick.baseUrl]
                    ]),
                    (_ctx.openclawQuick.baseUrlDisplayKind === 'builtin-default')
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "form-hint"
                        }, _toDisplayString(_ctx.t('modal.openclaw.quick.baseUrlHintDefault')), 1 /* TEXT */))
                      : (_ctx.openclawQuick.baseUrlReadOnly)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 1,
                            class: "form-hint"
                          }, _toDisplayString(_ctx.t('modal.openclaw.quick.baseUrlHintReadonly')), 1 /* TEXT */))
                        : _createCommentVNode("v-if", true)
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, "API Key"),
                    _createElementVNode("div", { class: "list-row" }, [
                      _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": $event => ((_ctx.openclawQuick.apiKey) = $event),
                        class: "form-input",
                        readonly: _ctx.openclawQuick.apiKeyReadOnly,
                        type: (_ctx.openclawQuick.apiKeyReadOnly || _ctx.openclawQuick.showKey) ? 'text' : 'password',
                        placeholder: "sk-..."
                      }, null, 8 /* PROPS */, ["onUpdate:modelValue", "readonly", "type"]), [
                        [_vModelDynamic, _ctx.openclawQuick.apiKey]
                      ]),
                      (!_ctx.openclawQuick.apiKeyReadOnly)
                        ? (_openBlock(), _createElementBlock("button", {
                            key: 0,
                            class: "btn-mini",
                            onClick: _ctx.toggleOpenclawQuickKey
                          }, _toDisplayString(_ctx.openclawQuick.showKey ? _ctx.t('common.hide') : _ctx.t('common.show')), 9 /* TEXT, PROPS */, ["onClick"]))
                        : _createCommentVNode("v-if", true)
                    ]),
                    (_ctx.openclawQuick.apiKeyDisplayKind === 'auth-profile-value')
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "form-hint"
                        }, _toDisplayString(_ctx.t('modal.openclaw.quick.apiKeyHintFromAuth')), 1 /* TEXT */))
                      : (_ctx.openclawQuick.apiKeyReadOnly)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 1,
                            class: "form-hint"
                          }, _toDisplayString(_ctx.t('modal.openclaw.quick.apiKeyHintReadonly')), 1 /* TEXT */))
                        : (_openBlock(), _createElementBlock("div", {
                            key: 2,
                            class: "form-hint"
                          }, _toDisplayString(_ctx.t('modal.openclaw.quick.apiKeyHintKeep')), 1 /* TEXT */))
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.apiType')), 1 /* TEXT */),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": $event => ((_ctx.openclawQuick.apiType) = $event),
                      class: "form-input",
                      list: "openclawApiTypeList",
                      placeholder: _ctx.t('placeholder.apiTypeExample')
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                      [_vModelText, _ctx.openclawQuick.apiType]
                    ]),
                    _createElementVNode("datalist", { id: "openclawApiTypeList" }, [
                      _createElementVNode("option", { value: "openai-responses" }),
                      _createElementVNode("option", { value: "openai-chat" }),
                      _createElementVNode("option", { value: "anthropic" }),
                      _createElementVNode("option", { value: "custom" })
                    ])
                  ])
                ]),
                _createElementVNode("div", { class: "quick-card" }, [
                  _createElementVNode("div", { class: "structured-card-title" }, _toDisplayString(_ctx.t('modal.openclaw.quick.modelTitle')), 1 /* TEXT */),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.modelId')), 1 /* TEXT */),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": $event => ((_ctx.openclawQuick.modelId) = $event),
                      class: "form-input",
                      placeholder: _ctx.t('placeholder.modelIdExample')
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                      [_vModelText, _ctx.openclawQuick.modelId]
                    ])
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.displayName')), 1 /* TEXT */),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": $event => ((_ctx.openclawQuick.modelName) = $event),
                      class: "form-input",
                      placeholder: _ctx.t('placeholder.modelNameOptional')
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                      [_vModelText, _ctx.openclawQuick.modelName]
                    ])
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('field.contextAndMaxOutput')), 1 /* TEXT */),
                    _createElementVNode("div", { class: "list-row" }, [
                      _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": $event => ((_ctx.openclawQuick.contextWindow) = $event),
                        class: "form-input",
                        placeholder: _ctx.t('field.contextWindow')
                      }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                        [_vModelText, _ctx.openclawQuick.contextWindow]
                      ]),
                      _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": $event => ((_ctx.openclawQuick.maxTokens) = $event),
                        class: "form-input",
                        placeholder: _ctx.t('field.maxOutput')
                      }, null, 8 /* PROPS */, ["onUpdate:modelValue", "placeholder"]), [
                        [_vModelText, _ctx.openclawQuick.maxTokens]
                      ])
                    ]),
                    _createElementVNode("div", { class: "form-hint" }, _toDisplayString(_ctx.t('hint.emptyNoChange')), 1 /* TEXT */)
                  ])
                ]),
                _createElementVNode("div", { class: "quick-card" }, [
                  _createElementVNode("div", { class: "structured-card-title" }, _toDisplayString(_ctx.t('modal.openclaw.quick.optionsTitle')), 1 /* TEXT */),
                  _createElementVNode("label", { class: "quick-option" }, [
                    _withDirectives(_createElementVNode("input", {
                      type: "checkbox",
                      "onUpdate:modelValue": $event => ((_ctx.openclawQuick.setPrimary) = $event)
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                      [_vModelCheckbox, _ctx.openclawQuick.setPrimary]
                    ]),
                    _createTextVNode(" " + _toDisplayString(_ctx.t('modal.openclaw.quick.setPrimary')), 1 /* TEXT */)
                  ]),
                  _createElementVNode("label", { class: "quick-option" }, [
                    _withDirectives(_createElementVNode("input", {
                      type: "checkbox",
                      "onUpdate:modelValue": $event => ((_ctx.openclawQuick.overrideProvider) = $event)
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                      [_vModelCheckbox, _ctx.openclawQuick.overrideProvider]
                    ]),
                    _createTextVNode(" " + _toDisplayString(_ctx.t('modal.openclaw.quick.overrideProvider')), 1 /* TEXT */)
                  ]),
                  _createElementVNode("label", { class: "quick-option" }, [
                    _withDirectives(_createElementVNode("input", {
                      type: "checkbox",
                      "onUpdate:modelValue": $event => ((_ctx.openclawQuick.overrideModels) = $event)
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                      [_vModelCheckbox, _ctx.openclawQuick.overrideModels]
                    ]),
                    _createTextVNode(" " + _toDisplayString(_ctx.t('modal.openclaw.quick.overrideModels')), 1 /* TEXT */)
                  ]),
                  _createElementVNode("div", { class: "form-hint" }, _toDisplayString(_ctx.t('modal.openclaw.quick.optionsHint')), 1 /* TEXT */)
                ])
              ]),
              _createElementVNode("div", { class: "btn-group" }, [
                _createElementVNode("button", {
                  class: "btn btn-confirm",
                  onClick: _ctx.applyOpenclawQuickToText
                }, _toDisplayString(_ctx.t('modal.openclaw.quick.writeToEditor')), 9 /* TEXT, PROPS */, ["onClick"])
              ])
            ]),
            _createElementVNode("div", { class: "structured-section" }, [
              _createElementVNode("div", { class: "structured-header" }, [
                _createElementVNode("span", { class: "structured-title" }, "结构化配置（高级）"),
                _createElementVNode("span", { class: "form-hint" }, _toDisplayString(_ctx.t('modal.openclaw.structured.writeHint')), 1 /* TEXT */)
              ]),
              _createElementVNode("div", { class: "structured-grid" }, [
                _createElementVNode("div", { class: "structured-card" }, [
                  _createElementVNode("div", { class: "structured-card-title" }, "Agents Defaults"),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, "主模型"),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": $event => ((_ctx.openclawStructured.agentPrimary) = $event),
                      class: "form-input",
                      placeholder: "例如: provider/model"
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.openclawStructured.agentPrimary]
                    ])
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, "备选模型"),
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.openclawStructured.agentFallbacks, (item, index) => {
                      return (_openBlock(), _createElementBlock("div", {
                        class: "list-row",
                        key: 'fallback-' + index
                      }, [
                        _withDirectives(_createElementVNode("input", {
                          "onUpdate:modelValue": $event => ((_ctx.openclawStructured.agentFallbacks[index]) = $event),
                          class: "form-input",
                          placeholder: "例如: provider/model"
                        }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                          [_vModelText, _ctx.openclawStructured.agentFallbacks[index]]
                        ]),
                        _createElementVNode("button", {
                          class: "btn-mini delete",
                          onClick: $event => (_ctx.removeOpenclawFallback(index))
                        }, "删除", 8 /* PROPS */, ["onClick"])
                      ]))
                    }), 128 /* KEYED_FRAGMENT */)),
                    _createElementVNode("button", {
                      class: "btn-mini",
                      onClick: _ctx.addOpenclawFallback
                    }, "添加备选", 8 /* PROPS */, ["onClick"])
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, "Workspace"),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": $event => ((_ctx.openclawStructured.workspace) = $event),
                      class: "form-input",
                      placeholder: "例如: ~/.openclaw/workspace"
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.openclawStructured.workspace]
                    ])
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, "Timeout(s)"),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": $event => ((_ctx.openclawStructured.timeout) = $event),
                      class: "form-input",
                      placeholder: "例如: 600"
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.openclawStructured.timeout]
                    ])
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, "Context Tokens"),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": $event => ((_ctx.openclawStructured.contextTokens) = $event),
                      class: "form-input",
                      placeholder: "例如: 4096"
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.openclawStructured.contextTokens]
                    ])
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, "Max Concurrent"),
                    _withDirectives(_createElementVNode("input", {
                      "onUpdate:modelValue": $event => ((_ctx.openclawStructured.maxConcurrent) = $event),
                      class: "form-input",
                      placeholder: "例如: 2"
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                      [_vModelText, _ctx.openclawStructured.maxConcurrent]
                    ])
                  ])
                ]),
                _createElementVNode("div", { class: "structured-card" }, [
                  _createElementVNode("div", { class: "structured-card-title" }, "Env"),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, "环境变量"),
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.openclawStructured.envItems, (item, index) => {
                      return (_openBlock(), _createElementBlock("div", {
                        class: "list-row",
                        key: 'env-' + index
                      }, [
                        _withDirectives(_createElementVNode("input", {
                          "onUpdate:modelValue": $event => ((item.key) = $event),
                          class: "form-input",
                          placeholder: "KEY"
                        }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                          [_vModelText, item.key]
                        ]),
                        _withDirectives(_createElementVNode("input", {
                          "onUpdate:modelValue": $event => ((item.value) = $event),
                          class: "form-input",
                          type: item.show ? 'text' : 'password',
                          placeholder: "VALUE"
                        }, null, 8 /* PROPS */, ["onUpdate:modelValue", "type"]), [
                          [_vModelDynamic, item.value]
                        ]),
                        _createElementVNode("button", {
                          class: "btn-mini",
                          onClick: $event => (_ctx.toggleOpenclawEnvItem(index))
                        }, _toDisplayString(item.show ? '隐藏' : '显示'), 9 /* TEXT, PROPS */, ["onClick"]),
                        _createElementVNode("button", {
                          class: "btn-mini delete",
                          onClick: $event => (_ctx.removeOpenclawEnvItem(index))
                        }, "删除", 8 /* PROPS */, ["onClick"])
                      ]))
                    }), 128 /* KEYED_FRAGMENT */)),
                    _createElementVNode("button", {
                      class: "btn-mini",
                      onClick: _ctx.addOpenclawEnvItem
                    }, "添加变量", 8 /* PROPS */, ["onClick"])
                  ])
                ]),
                _createElementVNode("div", { class: "structured-card" }, [
                  _createElementVNode("div", { class: "structured-card-title" }, "Tools"),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, "Profile"),
                    _withDirectives(_createElementVNode("select", {
                      "onUpdate:modelValue": $event => ((_ctx.openclawStructured.toolsProfile) = $event),
                      class: "form-input"
                    }, [
                      _createElementVNode("option", { value: "default" }, "default"),
                      _createElementVNode("option", { value: "strict" }, "strict"),
                      _createElementVNode("option", { value: "permissive" }, "permissive"),
                      _createElementVNode("option", { value: "custom" }, "custom")
                    ], 8 /* PROPS */, ["onUpdate:modelValue"]), [
                      [_vModelSelect, _ctx.openclawStructured.toolsProfile]
                    ])
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, "Allow"),
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.openclawStructured.toolsAllow, (item, index) => {
                      return (_openBlock(), _createElementBlock("div", {
                        class: "list-row",
                        key: 'allow-' + index
                      }, [
                        _withDirectives(_createElementVNode("input", {
                          "onUpdate:modelValue": $event => ((_ctx.openclawStructured.toolsAllow[index]) = $event),
                          class: "form-input",
                          placeholder: "例如: fs.read*"
                        }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                          [_vModelText, _ctx.openclawStructured.toolsAllow[index]]
                        ]),
                        _createElementVNode("button", {
                          class: "btn-mini delete",
                          onClick: $event => (_ctx.removeOpenclawToolsAllow(index))
                        }, "删除", 8 /* PROPS */, ["onClick"])
                      ]))
                    }), 128 /* KEYED_FRAGMENT */)),
                    _createElementVNode("button", {
                      class: "btn-mini",
                      onClick: _ctx.addOpenclawToolsAllow
                    }, "添加 allow", 8 /* PROPS */, ["onClick"])
                  ]),
                  _createElementVNode("div", { class: "form-group" }, [
                    _createElementVNode("label", { class: "form-label" }, "Deny"),
                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.openclawStructured.toolsDeny, (item, index) => {
                      return (_openBlock(), _createElementBlock("div", {
                        class: "list-row",
                        key: 'deny-' + index
                      }, [
                        _withDirectives(_createElementVNode("input", {
                          "onUpdate:modelValue": $event => ((_ctx.openclawStructured.toolsDeny[index]) = $event),
                          class: "form-input",
                          placeholder: "例如: net.*"
                        }, null, 8 /* PROPS */, ["onUpdate:modelValue"]), [
                          [_vModelText, _ctx.openclawStructured.toolsDeny[index]]
                        ]),
                        _createElementVNode("button", {
                          class: "btn-mini delete",
                          onClick: $event => (_ctx.removeOpenclawToolsDeny(index))
                        }, "删除", 8 /* PROPS */, ["onClick"])
                      ]))
                    }), 128 /* KEYED_FRAGMENT */)),
                    _createElementVNode("button", {
                      class: "btn-mini",
                      onClick: _ctx.addOpenclawToolsDeny
                    }, "添加 deny", 8 /* PROPS */, ["onClick"])
                  ])
                ]),
                _createElementVNode("div", { class: "structured-card" }, [
                  _createElementVNode("div", { class: "structured-card-title" }, "Providers（只读）"),
                  (_ctx.openclawProviders.length === 0)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "form-hint"
                      }, " 未发现 providers 配置（可能使用环境变量或外部配置）。 "))
                    : (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "provider-list"
                      }, [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.openclawProviders, (provider, index) => {
                          return (_openBlock(), _createElementBlock("div", {
                            class: "provider-item",
                            key: provider.key + '-' + provider.source + '-' + index
                          }, [
                            _createElementVNode("div", { class: "provider-header" }, [
                              _createElementVNode("span", { class: "provider-name" }, _toDisplayString(provider.key), 1 /* TEXT */),
                              _createElementVNode("span", { class: "provider-source" }, "来源: " + _toDisplayString(provider.source), 1 /* TEXT */),
                              (provider.isActive)
                                ? (_openBlock(), _createElementBlock("span", {
                                    key: 0,
                                    class: "pill configured"
                                  }, "使用中"))
                                : _createCommentVNode("v-if", true)
                            ]),
                            (provider.fields.length === 0)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  class: "form-hint"
                                }, "未配置字段"))
                              : (_openBlock(), _createElementBlock("div", {
                                  key: 1,
                                  class: "provider-fields"
                                }, [
                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(provider.fields, (field) => {
                                    return (_openBlock(), _createElementBlock("div", {
                                      class: "provider-field",
                                      key: provider.key + '-' + field.key
                                    }, [
                                      _createElementVNode("span", { class: "provider-field-key" }, _toDisplayString(field.key), 1 /* TEXT */),
                                      _createElementVNode("span", { class: "provider-field-value" }, _toDisplayString(field.value), 1 /* TEXT */)
                                    ]))
                                  }), 128 /* KEYED_FRAGMENT */))
                                ]))
                          ]))
                        }), 128 /* KEYED_FRAGMENT */))
                      ])),
                  (_ctx.openclawMissingProviders.length)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 2,
                        class: "form-hint"
                      }, " 使用中的 provider 未在配置中显示：" + _toDisplayString(_ctx.openclawMissingProviders.join(', ')) + "。 ", 1 /* TEXT */))
                    : _createCommentVNode("v-if", true)
                ]),
                _createElementVNode("div", { class: "structured-card" }, [
                  _createElementVNode("div", { class: "structured-card-title" }, "Agents（只读）"),
                  (_ctx.openclawAgentsList.length === 0)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "form-hint"
                      }, " 未发现 agents.list 配置。 "))
                    : (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "agent-list"
                      }, [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.openclawAgentsList, (agent, index) => {
                          return (_openBlock(), _createElementBlock("div", {
                            class: "agent-item",
                            key: agent.key + '-' + index
                          }, [
                            _createElementVNode("div", { class: "agent-header" }, [
                              _createElementVNode("span", { class: "agent-name" }, _toDisplayString(agent.name), 1 /* TEXT */),
                              _createElementVNode("span", { class: "agent-id" }, "ID: " + _toDisplayString(agent.id), 1 /* TEXT */)
                            ]),
                            (agent.theme || agent.emoji || agent.avatar)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 0,
                                  class: "agent-meta"
                                }, [
                                  (agent.theme)
                                    ? (_openBlock(), _createElementBlock("span", { key: 0 }, "主题: " + _toDisplayString(agent.theme), 1 /* TEXT */))
                                    : _createCommentVNode("v-if", true),
                                  (agent.emoji)
                                    ? (_openBlock(), _createElementBlock("span", { key: 1 }, "表情: " + _toDisplayString(agent.emoji), 1 /* TEXT */))
                                    : _createCommentVNode("v-if", true),
                                  (agent.avatar)
                                    ? (_openBlock(), _createElementBlock("span", { key: 2 }, "头像: " + _toDisplayString(agent.avatar), 1 /* TEXT */))
                                    : _createCommentVNode("v-if", true)
                                ]))
                              : _createCommentVNode("v-if", true)
                          ]))
                        }), 128 /* KEYED_FRAGMENT */))
                      ]))
                ])
              ]),
              _createElementVNode("div", { class: "btn-group" }, [
                _createElementVNode("button", {
                  class: "btn btn-confirm secondary",
                  onClick: _ctx.syncOpenclawStructuredFromText
                }, "从文本刷新", 8 /* PROPS */, ["onClick"]),
                _createElementVNode("button", {
                  class: "btn btn-confirm",
                  onClick: _ctx.applyOpenclawStructuredToText
                }, _toDisplayString(_ctx.t('common.writeToEditor')), 9 /* TEXT, PROPS */, ["onClick"])
              ])
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, "OpenClaw 配置（JSON5）"),
              _withDirectives(_createElementVNode("textarea", {
                "onUpdate:modelValue": $event => ((_ctx.openclawEditing.content) = $event),
                class: "form-input template-editor",
                spellcheck: "false",
                readonly: _ctx.openclawSaving || _ctx.openclawApplying,
                placeholder: "在这里编辑 OpenClaw 配置（JSON5）"
              }, null, 8 /* PROPS */, ["onUpdate:modelValue", "readonly"]), [
                [_vModelText, _ctx.openclawEditing.content]
              ]),
              _createElementVNode("div", { class: "template-editor-warning" }, [
                (_ctx.openclawEditing.lockName && _ctx.openclawEditing.name === '默认配置')
                  ? (_openBlock(), _createElementBlock("span", { key: 0 }, "默认配置始终映射当前 openclaw.json，请直接使用“保存并应用”。"))
                  : (_openBlock(), _createElementBlock("span", { key: 1 }, "保存仅写入本地配置库。点击“保存并应用”后会写入 openclaw.json。"))
              ])
            ]),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-cancel",
                onClick: _ctx.closeOpenclawConfigModal,
                disabled: _ctx.openclawSaving || _ctx.openclawApplying
              }, "取消", 8 /* PROPS */, ["onClick", "disabled"]),
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: _ctx.saveOpenclawConfig,
                disabled: _ctx.openclawSaving || _ctx.openclawApplying || (_ctx.openclawEditing.lockName && _ctx.openclawEditing.name === '默认配置')
              }, _toDisplayString(_ctx.openclawSaving ? '保存中...' : '保存'), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
              _createElementVNode("button", {
                class: "btn btn-confirm secondary",
                onClick: _ctx.saveAndApplyOpenclawConfig,
                disabled: _ctx.openclawSaving || _ctx.openclawApplying
              }, _toDisplayString(_ctx.openclawApplying ? '应用中...' : '保存并应用'), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    (_ctx.showConfigTemplateModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 12,
          class: "modal-overlay",
          onClick: _withModifiers($event => (!_ctx.configTemplateApplying && _ctx.closeConfigTemplateModal()), ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal modal-wide",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "config-template-modal-title"
          }, [
            _createElementVNode("div", { class: "modal-header modal-editor-header" }, [
              _createElementVNode("div", {
                class: "modal-title",
                id: "config-template-modal-title"
              }, _toDisplayString(_ctx.t('modal.configTemplate.title')), 1 /* TEXT */),
              _createElementVNode("div", { class: "modal-header-actions" }, [
                _createElementVNode("button", {
                  class: "btn-mini btn-modal-copy",
                  onClick: _ctx.pasteConfigTemplateContent,
                  disabled: _ctx.configTemplateApplying || _ctx.configTemplateDiffLoading || _ctx.configTemplateDiffVisible
                }, _toDisplayString(_ctx.t('common.paste')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
              ])
            ]),
            _createElementVNode("div", { class: "form-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('modal.configTemplate.label')), 1 /* TEXT */),
              (_ctx.configTemplateDiffVisible)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 0,
                    class: "agents-diff-container"
                  }, [
                    _createElementVNode("div", { class: "agents-diff-header" }, [
                      _createElementVNode("div", { class: "agents-diff-title" }, [
                        _createTextVNode(_toDisplayString(_ctx.t('diff.title.configTemplate')) + " ", 1 /* TEXT */),
                        (_ctx.configTemplateDiffLoading)
                          ? (_openBlock(), _createElementBlock("span", {
                              key: 0,
                              class: "agents-diff-subtitle"
                            }, _toDisplayString(_ctx.t('diff.generating')), 1 /* TEXT */))
                          : (_ctx.configTemplateDiffError)
                            ? (_openBlock(), _createElementBlock("span", {
                                key: 1,
                                class: "agents-diff-subtitle"
                              }, _toDisplayString(_ctx.t('diff.failed')), 1 /* TEXT */))
                            : (!_ctx.configTemplateDiffHasChanges)
                              ? (_openBlock(), _createElementBlock("span", {
                                  key: 2,
                                  class: "agents-diff-subtitle"
                                }, _toDisplayString(_ctx.t('diff.noChanges')), 1 /* TEXT */))
                              : _createCommentVNode("v-if", true)
                      ]),
                      _createElementVNode("div", { class: "agents-diff-stats" }, [
                        _createElementVNode("span", { class: "agents-diff-stat add" }, "+" + _toDisplayString(_ctx.configTemplateDiffStats.added || 0), 1 /* TEXT */),
                        _createElementVNode("span", { class: "agents-diff-stat del" }, "-" + _toDisplayString(_ctx.configTemplateDiffStats.removed || 0), 1 /* TEXT */),
                        _createElementVNode("span", { class: "agents-diff-stat" }, "=" + _toDisplayString(_ctx.configTemplateDiffStats.unchanged || 0), 1 /* TEXT */)
                      ])
                    ]),
                    (_ctx.configTemplateDiffError)
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 0,
                          class: "agents-diff-error"
                        }, _toDisplayString(_ctx.configTemplateDiffError), 1 /* TEXT */))
                      : (_openBlock(), _createElementBlock("div", {
                          key: 1,
                          class: "agents-diff-lines"
                        }, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.configTemplateDiffLines, (line, index) => {
                            return (_openBlock(), _createElementBlock("div", {
                              key: line.key || (line.type + '-' + index),
                              class: _normalizeClass(['agents-diff-line', line.type])
                            }, [
                              _createElementVNode("span", { class: "agents-diff-line-sign" }, _toDisplayString(line.type === 'add' ? '+' : (line.type === 'del' ? '-' : ' ')), 1 /* TEXT */),
                              _createElementVNode("span", { class: "agents-diff-line-text" }, _toDisplayString(line.value), 1 /* TEXT */)
                            ], 2 /* CLASS */))
                          }), 128 /* KEYED_FRAGMENT */))
                        ]))
                  ]))
                : _withDirectives((_openBlock(), _createElementBlock("textarea", {
                    key: 1,
                    "onUpdate:modelValue": $event => ((_ctx.configTemplateContent) = $event),
                    class: "form-input template-editor",
                    spellcheck: "false",
                    readonly: _ctx.configTemplateApplying || _ctx.configTemplateDiffLoading,
                    onInput: _ctx.onConfigTemplateContentInput,
                    placeholder: _ctx.t('modal.configTemplate.placeholder')
                  }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "readonly", "onInput", "placeholder"])), [
                    [_vModelText, _ctx.configTemplateContent]
                  ]),
              _createElementVNode("div", { class: "template-editor-warning" }, [
                (_ctx.configTemplateDiffConfirmEnabled)
                  ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                      _createTextVNode(_toDisplayString(_ctx.t('modal.configTemplate.mode.twoStep')), 1 /* TEXT */)
                    ], 64 /* STABLE_FRAGMENT */))
                  : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                      _createTextVNode(_toDisplayString(_ctx.t('modal.configTemplate.mode.oneStep')), 1 /* TEXT */)
                    ], 64 /* STABLE_FRAGMENT */)),
                (_ctx.configTemplateDiffVisible && (_ctx.configTemplateDiffLoading || _ctx.configTemplateApplying))
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 2,
                      class: "agents-diff-hint"
                    }, _toDisplayString(_ctx.t('diff.hint.busy')), 1 /* TEXT */))
                  : (_ctx.configTemplateDiffVisible && _ctx.configTemplateDiffError)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 3,
                        class: "agents-diff-hint"
                      }, _toDisplayString(_ctx.t('diff.hint.failedBack')), 1 /* TEXT */))
                    : (_ctx.configTemplateDiffVisible && !_ctx.configTemplateDiffHasChanges)
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 4,
                          class: "agents-diff-hint"
                        }, _toDisplayString(_ctx.t('diff.hint.noChangesBack')), 1 /* TEXT */))
                      : (_ctx.configTemplateDiffVisible)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 5,
                            class: "agents-diff-hint"
                          }, _toDisplayString(_ctx.t('diff.hint.previewMode')), 1 /* TEXT */))
                        : _createCommentVNode("v-if", true)
              ])
            ]),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-cancel",
                onClick: _ctx.closeConfigTemplateModal,
                disabled: _ctx.configTemplateApplying || _ctx.configTemplateDiffLoading
              }, _toDisplayString(_ctx.t('common.cancel')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
              (_ctx.configTemplateDiffVisible)
                ? (_openBlock(), _createElementBlock("button", {
                    key: 0,
                    class: "btn",
                    onClick: _ctx.resetConfigTemplateDiffState,
                    disabled: _ctx.configTemplateApplying || _ctx.configTemplateDiffLoading
                  }, _toDisplayString(_ctx.t('common.backToEdit')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]))
                : _createCommentVNode("v-if", true),
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: _ctx.applyConfigTemplate,
                disabled: _ctx.configTemplateApplying || _ctx.configTemplateDiffLoading || (_ctx.configTemplateDiffVisible && !_ctx.configTemplateDiffHasChanges)
              }, _toDisplayString(_ctx.configTemplateApplying
                            ? (_ctx.configTemplateDiffVisible || !_ctx.configTemplateDiffConfirmEnabled ? _ctx.t('common.applying') : _ctx.t('common.confirming'))
                            : (_ctx.configTemplateDiffVisible || !_ctx.configTemplateDiffConfirmEnabled ? _ctx.t('common.apply') : _ctx.t('common.confirm'))), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    (_ctx.showAgentsModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 13,
          class: "modal-overlay",
          onClick: _withModifiers(_ctx.closeAgentsModal, ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal modal-wide modal-editor agents-modal",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "agents-modal-title"
          }, [
            _createElementVNode("div", { class: "modal-header modal-editor-header" }, [
              _createElementVNode("div", {
                class: "modal-title",
                id: "agents-modal-title"
              }, _toDisplayString(_ctx.agentsModalTitle), 1 /* TEXT */),
              _createElementVNode("div", { class: "modal-header-actions" }, [
                _createElementVNode("button", {
                  class: "btn-mini btn-modal-copy",
                  onClick: _ctx.exportAgentsContent,
                  disabled: _ctx.agentsLoading
                }, _toDisplayString(_ctx.t('modal.agents.export')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                _createElementVNode("button", {
                  class: "btn-mini btn-modal-copy",
                  onClick: _ctx.copyAgentsContent,
                  disabled: _ctx.agentsLoading
                }, _toDisplayString(_ctx.t('modal.agents.copy')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                _createElementVNode("button", {
                  class: "btn-mini btn-modal-copy",
                  onClick: _ctx.pasteAgentsContent,
                  disabled: _ctx.agentsLoading || _ctx.agentsSaving || _ctx.agentsDiffVisible
                }, _toDisplayString(_ctx.t('common.paste')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
              ])
            ]),
            _createElementVNode("div", { class: "modal-editor-body" }, [
              _createElementVNode("div", { class: "form-group" }, [
                _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('modal.agents.targetFile')), 1 /* TEXT */),
                _createElementVNode("div", { class: "form-hint" }, [
                  _createTextVNode(_toDisplayString(_ctx.agentsPath || _ctx.t('common.notLoaded')) + " ", 1 /* TEXT */),
                  (_ctx.agentsPath)
                    ? (_openBlock(), _createElementBlock("span", { key: 0 }, " （" + _toDisplayString(_ctx.agentsExists ? _ctx.t('common.exists') : _ctx.t('common.notExistsWillCreateOnSave')) + "） ", 1 /* TEXT */))
                    : _createCommentVNode("v-if", true)
                ])
              ]),
              _createElementVNode("div", { class: "form-group" }, [
                _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t(_ctx.agentsContext === 'claude-md' ? 'modal.agents.contentLabel.claudeMd' : 'modal.agents.contentLabel')), 1 /* TEXT */),
                (!_ctx.agentsLoading && (_ctx.hasAgentsContentChanged() || _ctx.agentsDiffVisible))
                  ? (_openBlock(), _createElementBlock("div", {
                      key: 0,
                      class: "agents-diff-save-alert"
                    }, _toDisplayString(_ctx.agentsDiffVisible ? _ctx.t('modal.agents.unsaved.previewModeHint') : _ctx.t('modal.agents.unsaved.detectedHint')), 1 /* TEXT */))
                  : _createCommentVNode("v-if", true),
                (_ctx.agentsDiffVisible)
                  ? (_openBlock(), _createElementBlock("div", { key: 1 }, [
                      (!_ctx.agentsDiffLoading && !_ctx.agentsDiffError && !_ctx.agentsDiffTruncated && (_ctx.agentsDiffStats.added || _ctx.agentsDiffStats.removed))
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 0,
                            class: "agents-diff-summary"
                          }, [
                            _createElementVNode("span", { class: "agents-diff-stat add" }, "+" + _toDisplayString(_ctx.agentsDiffStats.added), 1 /* TEXT */),
                            _createElementVNode("span", { class: "agents-diff-stat del" }, "-" + _toDisplayString(_ctx.agentsDiffStats.removed), 1 /* TEXT */)
                          ]))
                        : _createCommentVNode("v-if", true),
                      (_ctx.agentsDiffLoading)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 1,
                            class: "state-message"
                          }, _toDisplayString(_ctx.t('diff.generating')), 1 /* TEXT */))
                        : (_ctx.agentsDiffError)
                          ? (_openBlock(), _createElementBlock("div", {
                              key: 2,
                              class: "state-message error"
                            }, _toDisplayString(_ctx.agentsDiffError), 1 /* TEXT */))
                          : (_ctx.agentsDiffTruncated)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 3,
                                class: "agents-diff-empty"
                              }, _toDisplayString(_ctx.t('diff.tooLargeSkip')), 1 /* TEXT */))
                            : (!_ctx.agentsDiffHasChanges)
                              ? (_openBlock(), _createElementBlock("div", {
                                  key: 4,
                                  class: "agents-diff-empty"
                                }, _toDisplayString(_ctx.t('diff.noChanges')), 1 /* TEXT */))
                              : (_openBlock(), _createElementBlock("div", {
                                  key: 5,
                                  class: "agents-diff-view agents-diff-editor"
                                }, [
                                  (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.agentsDiffLines, (line, index) => {
                                    return (_openBlock(), _createElementBlock("div", {
                                      key: line.key || (line.type + '-' + index),
                                      class: _normalizeClass(['agents-diff-line', line.type])
                                    }, [
                                      _createElementVNode("span", { class: "agents-diff-line-sign" }, _toDisplayString(line.type === 'add' ? '+' : (line.type === 'del' ? '-' : ' ')), 1 /* TEXT */),
                                      _createElementVNode("span", { class: "agents-diff-line-text" }, _toDisplayString(line.value), 1 /* TEXT */)
                                    ], 2 /* CLASS */))
                                  }), 128 /* KEYED_FRAGMENT */))
                                ]))
                    ]))
                  : _createCommentVNode("v-if", true),
                _withDirectives(_createElementVNode("textarea", {
                  "onUpdate:modelValue": $event => ((_ctx.agentsContent) = $event),
                  class: "form-input template-editor",
                  spellcheck: "false",
                  readonly: _ctx.agentsLoading || _ctx.agentsSaving || _ctx.agentsDiffVisible,
                  onInput: _ctx.onAgentsContentInput,
                  placeholder: _ctx.t(_ctx.agentsContext === 'claude-md' ? 'modal.agents.placeholder.claudeMd' : 'modal.agents.placeholder')
                }, null, 40 /* PROPS, NEED_HYDRATION */, ["onUpdate:modelValue", "readonly", "onInput", "placeholder"]), [
                  [_vModelText, _ctx.agentsContent]
                ]),
                _createElementVNode("div", { class: "template-editor-warning" }, [
                  _createTextVNode(_toDisplayString(_ctx.agentsModalHint) + " ", 1 /* TEXT */),
                  _createElementVNode("div", { class: "agents-diff-hint" }, _toDisplayString(_ctx.t('modal.agents.hint.shortcuts')), 1 /* TEXT */),
                  (!_ctx.agentsDiffVisible)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "agents-diff-hint"
                      }, _toDisplayString(_ctx.t('modal.agents.hint.twoStepSave')), 1 /* TEXT */))
                    : (_ctx.agentsDiffLoading || _ctx.agentsSaving)
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 1,
                          class: "agents-diff-hint"
                        }, _toDisplayString(_ctx.t('diff.hint.busy')), 1 /* TEXT */))
                      : (_ctx.agentsDiffError)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 2,
                            class: "agents-diff-hint"
                          }, _toDisplayString(_ctx.t('diff.hint.failedBack')), 1 /* TEXT */))
                        : (!_ctx.agentsDiffHasChanges)
                          ? (_openBlock(), _createElementBlock("div", {
                              key: 3,
                              class: "agents-diff-hint"
                            }, _toDisplayString(_ctx.t('diff.hint.noChangesBack')), 1 /* TEXT */))
                          : (_ctx.agentsDiffTruncated)
                            ? (_openBlock(), _createElementBlock("div", {
                                key: 4,
                                class: "agents-diff-hint"
                              }, _toDisplayString(_ctx.t('diff.viewHint.truncated')), 1 /* TEXT */))
                            : (_openBlock(), _createElementBlock("div", {
                                key: 5,
                                class: "agents-diff-hint"
                              }, _toDisplayString(_ctx.t('diff.viewHint.preview')), 1 /* TEXT */))
                ])
              ])
            ]),
            _createElementVNode("div", { class: "btn-group modal-editor-footer" }, [
              _createElementVNode("button", {
                class: "btn btn-cancel",
                onClick: _ctx.closeAgentsModal,
                disabled: _ctx.agentsSaving || _ctx.agentsDiffLoading
              }, _toDisplayString(_ctx.t('common.cancel')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
              (_ctx.agentsDiffVisible)
                ? (_openBlock(), _createElementBlock("button", {
                    key: 0,
                    class: "btn",
                    onClick: _ctx.resetAgentsDiffState,
                    disabled: _ctx.agentsSaving || _ctx.agentsDiffLoading
                  }, _toDisplayString(_ctx.t('common.backToEdit')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]))
                : _createCommentVNode("v-if", true),
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: _ctx.applyAgentsContent,
                disabled: _ctx.agentsSaving || _ctx.agentsLoading || _ctx.agentsDiffLoading || (_ctx.agentsDiffVisible && !_ctx.agentsDiffHasChanges)
              }, _toDisplayString(_ctx.agentsSaving ? (_ctx.agentsDiffVisible ? _ctx.t('common.applying') : _ctx.t('common.confirming')) : (_ctx.agentsDiffVisible ? _ctx.t('common.apply') : _ctx.t('common.confirm'))), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    (_ctx.showSkillsModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 14,
          class: "modal-overlay",
          onClick: _withModifiers(_ctx.closeSkillsModal, ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal modal-wide skills-modal",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "skills-modal-title"
          }, [
            _createElementVNode("div", { class: "modal-header skills-modal-header" }, [
              _createElementVNode("div", null, [
                _createElementVNode("div", {
                  class: "modal-title",
                  id: "skills-modal-title"
                }, _toDisplayString(_ctx.t('modal.skills.title')), 1 /* TEXT */),
                _createElementVNode("div", { class: "skills-modal-subtitle" }, _toDisplayString(_ctx.t('modal.skills.subtitle')), 1 /* TEXT */)
              ]),
              _createElementVNode("div", { class: "modal-header-actions skills-modal-actions" }, [
                _createElementVNode("div", {
                  class: "market-target-switch market-target-switch-compact",
                  role: "group",
                  "aria-label": _ctx.t('modal.skills.target.aria')
                }, [
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['market-target-chip', { active: _ctx.skillsTargetApp === 'codex' }]),
                    "aria-pressed": _ctx.skillsTargetApp === 'codex',
                    disabled: _ctx.loading || !!_ctx.initError || _ctx.skillsMarketBusy,
                    onClick: $event => (_ctx.setSkillsTargetApp('codex', { silent: false }))
                  }, " Codex ", 10 /* CLASS, PROPS */, ["aria-pressed", "disabled", "onClick"]),
                  _createElementVNode("button", {
                    type: "button",
                    class: _normalizeClass(['market-target-chip', { active: _ctx.skillsTargetApp === 'claude' }]),
                    "aria-pressed": _ctx.skillsTargetApp === 'claude',
                    disabled: _ctx.loading || !!_ctx.initError || _ctx.skillsMarketBusy,
                    onClick: $event => (_ctx.setSkillsTargetApp('claude', { silent: false }))
                  }, " Claude Code ", 10 /* CLASS, PROPS */, ["aria-pressed", "disabled", "onClick"])
                ], 8 /* PROPS */, ["aria-label"]),
                _createElementVNode("button", {
                  class: "btn-mini",
                  onClick: $event => (_ctx.refreshSkillsList({ silent: false })),
                  disabled: _ctx.skillsLoading || _ctx.skillsDeleting || _ctx.skillsScanningImports || _ctx.skillsImporting || _ctx.skillsZipImporting || _ctx.skillsExporting
                }, _toDisplayString(_ctx.skillsLoading ? _ctx.t('common.refreshing') : _ctx.t('common.refresh')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
              ])
            ]),
            _createElementVNode("div", { class: "form-group skills-root-group" }, [
              _createElementVNode("label", { class: "form-label" }, _toDisplayString(_ctx.t('modal.skills.rootDir', { label: _ctx.skillsTargetLabel })), 1 /* TEXT */),
              _createElementVNode("div", { class: "skills-root-box" }, _toDisplayString(_ctx.skillsRootPath || _ctx.skillsDefaultRootPath), 1 /* TEXT */)
            ]),
            _createElementVNode("div", { class: "skills-summary-strip" }, [
              _createElementVNode("div", { class: "skills-summary-item" }, [
                _createElementVNode("span", { class: "skills-summary-label" }, _toDisplayString(_ctx.t('modal.skills.summary.target')), 1 /* TEXT */),
                _createElementVNode("strong", { class: "skills-summary-value" }, _toDisplayString(_ctx.skillsTargetLabel), 1 /* TEXT */)
              ]),
              _createElementVNode("div", { class: "skills-summary-item" }, [
                _createElementVNode("span", { class: "skills-summary-label" }, _toDisplayString(_ctx.t('modal.skills.summary.total')), 1 /* TEXT */),
                _createElementVNode("strong", { class: "skills-summary-value" }, _toDisplayString(_ctx.skillsList.length), 1 /* TEXT */)
              ]),
              _createElementVNode("div", { class: "skills-summary-item" }, [
                _createElementVNode("span", { class: "skills-summary-label" }, _toDisplayString(_ctx.t('modal.skills.summary.withSkill')), 1 /* TEXT */),
                _createElementVNode("strong", { class: "skills-summary-value" }, _toDisplayString(_ctx.skillsConfiguredCount), 1 /* TEXT */)
              ]),
              _createElementVNode("div", { class: "skills-summary-item" }, [
                _createElementVNode("span", { class: "skills-summary-label" }, _toDisplayString(_ctx.t('modal.skills.summary.missingSkill')), 1 /* TEXT */),
                _createElementVNode("strong", { class: "skills-summary-value" }, _toDisplayString(_ctx.skillsMissingSkillFileCount), 1 /* TEXT */)
              ]),
              _createElementVNode("div", { class: "skills-summary-item" }, [
                _createElementVNode("span", { class: "skills-summary-label" }, _toDisplayString(_ctx.t('modal.skills.summary.importable')), 1 /* TEXT */),
                _createElementVNode("strong", { class: "skills-summary-value" }, _toDisplayString(_ctx.skillsImportList.length), 1 /* TEXT */)
              ])
            ]),
            _createElementVNode("div", {
              class: "skills-manager-grid",
              "aria-label": _ctx.t('modal.skills.panel.aria')
            }, [
              _createElementVNode("div", { class: "skills-manager-col skills-manager-left" }, [
                _createElementVNode("div", { class: "skills-panel" }, [
                  _createElementVNode("div", { class: "skills-panel-header" }, [
                    _createElementVNode("div", { class: "skills-panel-title-wrap" }, [
                      _createElementVNode("div", { class: "skills-panel-title" }, _toDisplayString(_ctx.t('modal.skills.local.title')), 1 /* TEXT */),
                      _createElementVNode("div", { class: "skills-panel-note" }, _toDisplayString(_ctx.t('modal.skills.local.note')), 1 /* TEXT */)
                    ]),
                    _createElementVNode("button", {
                      class: "btn-mini",
                      onClick: _ctx.resetSkillsFilters,
                      disabled: _ctx.skillsLoading || _ctx.skillsDeleting || !_ctx.skillsFilterDirty
                    }, _toDisplayString(_ctx.t('common.resetFilters')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                  ]),
                  _createElementVNode("div", { class: "skills-filter-row" }, [
                    _withDirectives(_createElementVNode("input", {
                      class: "form-input",
                      type: "text",
                      "onUpdate:modelValue": $event => ((_ctx.skillsKeyword) = $event),
                      "aria-label": _ctx.t('modal.skills.filter.keywordAria'),
                      placeholder: _ctx.t('modal.skills.filter.keywordPlaceholder')
                    }, null, 8 /* PROPS */, ["onUpdate:modelValue", "aria-label", "placeholder"]), [
                      [
                        _vModelText,
                        _ctx.skillsKeyword,
                        void 0,
                        { trim: true }
                      ]
                    ]),
                    _withDirectives(_createElementVNode("select", {
                      class: "form-select skills-status-select",
                      "onUpdate:modelValue": $event => ((_ctx.skillsStatusFilter) = $event),
                      "aria-label": _ctx.t('modal.skills.filter.statusAria')
                    }, [
                      _createElementVNode("option", { value: "all" }, _toDisplayString(_ctx.t('modal.skills.filter.status.all')), 1 /* TEXT */),
                      _createElementVNode("option", { value: "with-skill-file" }, _toDisplayString(_ctx.t('modal.skills.filter.status.withSkill')), 1 /* TEXT */),
                      _createElementVNode("option", { value: "missing-skill-file" }, _toDisplayString(_ctx.t('modal.skills.filter.status.missingSkill')), 1 /* TEXT */)
                    ], 8 /* PROPS */, ["onUpdate:modelValue", "aria-label"]), [
                      [_vModelSelect, _ctx.skillsStatusFilter]
                    ])
                  ]),
                  _createElementVNode("div", { class: "skill-toolbar" }, [
                    _createElementVNode("label", { class: "skill-select-all" }, [
                      _createElementVNode("input", {
                        type: "checkbox",
                        checked: _ctx.skillsAllSelected,
                        onChange: _ctx.toggleAllSkillsSelection,
                        disabled: _ctx.skillsLoading || _ctx.skillsDeleting || _ctx.skillsSelectableNames.length === 0
                      }, null, 40 /* PROPS, NEED_HYDRATION */, ["checked", "onChange", "disabled"]),
                      _createElementVNode("span", null, _toDisplayString(_ctx.skillsAllSelected ? _ctx.t('common.unselectAll') : _ctx.t('common.selectAll')), 1 /* TEXT */)
                    ]),
                    _createElementVNode("span", { class: "skill-toolbar-count" }, _toDisplayString(_ctx.t('modal.skills.selection.stats', { selected: _ctx.skillsSelectedCount, filtered: _ctx.filteredSkillsList.length, total: _ctx.skillsList.length, visibleSelected: _ctx.skillsVisibleSelectedCount })), 1 /* TEXT */)
                  ]),
                  (_ctx.skillsList.length === 0)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "skills-empty-state"
                      }, _toDisplayString(_ctx.t('modal.skills.empty.local')), 1 /* TEXT */))
                    : (_ctx.filteredSkillsList.length === 0)
                      ? (_openBlock(), _createElementBlock("div", {
                          key: 1,
                          class: "skills-empty-state"
                        }, _toDisplayString(_ctx.t('modal.skills.empty.filtered')), 1 /* TEXT */))
                      : (_openBlock(), _createElementBlock("div", {
                          key: 2,
                          class: "skill-list"
                        }, [
                          (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.filteredSkillsList, (skill) => {
                            return (_openBlock(), _createElementBlock("label", {
                              class: _normalizeClass(["skill-item", { selected: _ctx.skillsSelectedNames.includes(skill.name) }]),
                              key: 'skill-' + skill.name
                            }, [
                              _withDirectives(_createElementVNode("input", {
                                type: "checkbox",
                                "onUpdate:modelValue": $event => ((_ctx.skillsSelectedNames) = $event),
                                value: skill.name,
                                disabled: _ctx.skillsDeleting
                              }, null, 8 /* PROPS */, ["onUpdate:modelValue", "value", "disabled"]), [
                                [_vModelCheckbox, _ctx.skillsSelectedNames]
                              ]),
                              _createElementVNode("div", { class: "skill-item-main" }, [
                                _createElementVNode("div", { class: "skill-item-title" }, _toDisplayString(skill.displayName || skill.name), 1 /* TEXT */),
                                (skill.description)
                                  ? (_openBlock(), _createElementBlock("div", {
                                      key: 0,
                                      class: "skill-item-description"
                                    }, _toDisplayString(skill.description), 1 /* TEXT */))
                                  : _createCommentVNode("v-if", true),
                                _createElementVNode("div", { class: "skill-item-meta" }, [
                                  _createElementVNode("span", {
                                    class: "skill-item-path",
                                    title: skill.path
                                  }, _toDisplayString(skill.path), 9 /* TEXT, PROPS */, ["title"]),
                                  _createElementVNode("span", {
                                    class: _normalizeClass(['pill', skill.hasSkillFile ? 'configured' : 'empty'])
                                  }, _toDisplayString(skill.hasSkillFile ? _ctx.t('modal.skills.pill.hasSkillFile') : _ctx.t('modal.skills.pill.missingSkillFile')), 3 /* TEXT, CLASS */),
                                  _createElementVNode("span", { class: "pill source" }, _toDisplayString(skill.sourceType === 'symlink' ? _ctx.t('modal.skills.pill.symlink') : _ctx.t('modal.skills.pill.dir')), 1 /* TEXT */)
                                ])
                              ])
                            ], 2 /* CLASS */))
                          }), 128 /* KEYED_FRAGMENT */))
                        ]))
                ])
              ]),
              _createElementVNode("div", { class: "skills-manager-col skills-manager-right" }, [
                _createElementVNode("div", { class: "skills-panel skills-import-block" }, [
                  _createElementVNode("div", { class: "skills-panel-header" }, [
                    _createElementVNode("div", { class: "skills-panel-title-wrap" }, [
                      _createElementVNode("div", { class: "skills-import-title" }, _toDisplayString(_ctx.t('modal.skills.import.title')), 1 /* TEXT */),
                      _createElementVNode("div", { class: "skills-panel-note" }, _toDisplayString(_ctx.t('modal.skills.import.note', { label: _ctx.skillsTargetLabel })), 1 /* TEXT */)
                    ]),
                    _createElementVNode("button", {
                      class: "btn-mini",
                      onClick: _ctx.scanImportableSkills,
                      disabled: _ctx.skillsLoading || _ctx.skillsDeleting || _ctx.skillsScanningImports || _ctx.skillsImporting || _ctx.skillsZipImporting || _ctx.skillsExporting
                    }, _toDisplayString(_ctx.skillsScanningImports ? _ctx.t('common.scanning') : _ctx.t('modal.skills.import.scan')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                  ]),
                  _createElementVNode("div", { class: "skill-toolbar" }, [
                    _createElementVNode("label", { class: "skill-select-all" }, [
                      _createElementVNode("input", {
                        type: "checkbox",
                        checked: _ctx.skillsImportAllSelected,
                        onChange: _ctx.toggleAllSkillsImportSelection,
                        disabled: _ctx.skillsScanningImports || _ctx.skillsImporting || _ctx.skillsImportSelectableKeys.length === 0
                      }, null, 40 /* PROPS, NEED_HYDRATION */, ["checked", "onChange", "disabled"]),
                      _createElementVNode("span", null, _toDisplayString(_ctx.skillsImportAllSelected ? _ctx.t('common.unselectAll') : _ctx.t('common.selectAll')), 1 /* TEXT */)
                    ]),
                    _createElementVNode("span", { class: "skill-toolbar-count" }, _toDisplayString(_ctx.t('modal.skills.import.stats', { selected: _ctx.skillsImportSelectedCount, total: _ctx.skillsImportSelectableKeys.length, configured: _ctx.skillsImportConfiguredCount, missing: _ctx.skillsImportMissingSkillFileCount })), 1 /* TEXT */)
                  ]),
                  (_ctx.skillsImportList.length === 0)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "skills-empty-state skills-import-empty"
                      }, _toDisplayString(_ctx.t('modal.skills.import.emptyHint')), 1 /* TEXT */))
                    : (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "skill-list skills-import-list"
                      }, [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.skillsImportList, (skill) => {
                          return (_openBlock(), _createElementBlock("label", {
                            class: _normalizeClass(["skill-item", { selected: _ctx.skillsImportSelectedKeys.includes(_ctx.buildSkillImportKey(skill)) }]),
                            key: 'import-skill-' + _ctx.buildSkillImportKey(skill)
                          }, [
                            _withDirectives(_createElementVNode("input", {
                              type: "checkbox",
                              "onUpdate:modelValue": $event => ((_ctx.skillsImportSelectedKeys) = $event),
                              value: _ctx.buildSkillImportKey(skill),
                              disabled: _ctx.skillsImporting
                            }, null, 8 /* PROPS */, ["onUpdate:modelValue", "value", "disabled"]), [
                              [_vModelCheckbox, _ctx.skillsImportSelectedKeys]
                            ]),
                            _createElementVNode("div", { class: "skill-item-main" }, [
                              _createElementVNode("div", { class: "skill-item-title" }, _toDisplayString(skill.displayName || skill.name), 1 /* TEXT */),
                              (skill.description)
                                ? (_openBlock(), _createElementBlock("div", {
                                    key: 0,
                                    class: "skill-item-description"
                                  }, _toDisplayString(skill.description), 1 /* TEXT */))
                                : _createCommentVNode("v-if", true),
                              _createElementVNode("div", { class: "skill-item-meta" }, [
                                _createElementVNode("span", {
                                  class: "skill-item-path",
                                  title: skill.sourcePath
                                }, _toDisplayString(skill.sourcePath), 9 /* TEXT, PROPS */, ["title"]),
                                _createElementVNode("span", { class: "pill source" }, _toDisplayString(skill.sourceLabel), 1 /* TEXT */),
                                _createElementVNode("span", {
                                  class: _normalizeClass(['pill', skill.hasSkillFile ? 'configured' : 'empty'])
                                }, _toDisplayString(skill.hasSkillFile ? _ctx.t('modal.skills.pill.hasSkillFile') : _ctx.t('modal.skills.pill.missingSkillFile')), 3 /* TEXT, CLASS */)
                              ])
                            ])
                          ], 2 /* CLASS */))
                        }), 128 /* KEYED_FRAGMENT */))
                      ]))
                ]),
                _createElementVNode("div", { class: "skills-panel skills-actions-panel" }, [
                  _createElementVNode("div", { class: "skills-panel-header" }, [
                    _createElementVNode("div", { class: "skills-panel-title-wrap" }, [
                      _createElementVNode("div", { class: "skills-panel-title" }, _toDisplayString(_ctx.t('modal.skills.bulk.title')), 1 /* TEXT */),
                      _createElementVNode("div", { class: "skills-panel-note" }, _toDisplayString(_ctx.t('modal.skills.bulk.note')), 1 /* TEXT */)
                    ])
                  ]),
                  _createElementVNode("div", { class: "skills-actions-grid" }, [
                    _createElementVNode("button", {
                      class: "btn btn-cancel",
                      onClick: _ctx.triggerSkillsZipImport,
                      disabled: _ctx.skillsZipImporting || _ctx.skillsDeleting || _ctx.skillsImporting || _ctx.skillsScanningImports || _ctx.skillsExporting
                    }, _toDisplayString(_ctx.skillsZipImporting ? _ctx.t('modal.skills.actions.zipImporting') : _ctx.t('modal.skills.actions.zipImport')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                    _createElementVNode("button", {
                      class: "btn btn-confirm",
                      onClick: _ctx.exportSelectedSkills,
                      disabled: _ctx.skillsExporting || _ctx.skillsSelectedCount === 0 || _ctx.skillsDeleting || _ctx.skillsImporting || _ctx.skillsScanningImports || _ctx.skillsZipImporting
                    }, _toDisplayString(_ctx.skillsExporting ? _ctx.t('modal.skills.actions.exporting') : _ctx.t('modal.skills.actions.exportSelected')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                    _createElementVNode("button", {
                      class: "btn btn-confirm secondary",
                      onClick: _ctx.importSelectedSkills,
                      disabled: _ctx.skillsImporting || _ctx.skillsScanningImports || _ctx.skillsImportSelectedCount === 0 || _ctx.skillsZipImporting || _ctx.skillsExporting || _ctx.skillsDeleting
                    }, _toDisplayString(_ctx.skillsImporting ? _ctx.t('modal.skills.actions.importing') : _ctx.t('modal.skills.actions.importSelected')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                    _createElementVNode("button", {
                      class: "btn btn-confirm btn-danger",
                      onClick: _ctx.deleteSelectedSkills,
                      disabled: _ctx.skillsDeleting || _ctx.skillsSelectedCount === 0 || _ctx.skillsImporting || _ctx.skillsZipImporting || _ctx.skillsExporting
                    }, _toDisplayString(_ctx.skillsDeleting ? _ctx.t('modal.skills.actions.deleting') : _ctx.t('modal.skills.actions.deleteSelected')), 9 /* TEXT, PROPS */, ["onClick", "disabled"]),
                    _createElementVNode("button", {
                      class: "btn btn-cancel skills-close-btn",
                      onClick: _ctx.closeSkillsModal,
                      disabled: _ctx.skillsLoading || _ctx.skillsDeleting || _ctx.skillsImporting || _ctx.skillsScanningImports || _ctx.skillsZipImporting || _ctx.skillsExporting
                    }, _toDisplayString(_ctx.t('common.close')), 9 /* TEXT, PROPS */, ["onClick", "disabled"])
                  ])
                ])
              ])
            ], 8 /* PROPS */, ["aria-label"])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    _createElementVNode("input", {
      ref: "skillsZipImportInput",
      type: "file",
      accept: ".zip,application/zip",
      style: {"display":"none"},
      onChange: _ctx.handleSkillsZipImportChange
    }, null, 40 /* PROPS, NEED_HYDRATION */, ["onChange"]),
    (_ctx.showHealthCheckModal)
      ? (_openBlock(), _createElementBlock("div", {
          key: 15,
          class: "modal-overlay",
          onClick: _withModifiers($event => (_ctx.showHealthCheckModal = false), ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal",
            role: "dialog",
            "aria-modal": "true",
            "aria-labelledby": "health-check-modal-title"
          }, [
            _createElementVNode("div", {
              class: "modal-title",
              id: "health-check-modal-title"
            }, _toDisplayString(_ctx.t('config.health.title')), 1 /* TEXT */),
            (!_ctx.healthCheckResult)
              ? (_openBlock(), _createElementBlock("div", {
                  key: 0,
                  class: "state-message"
                }, _toDisplayString(_ctx.t('common.notLoaded')), 1 /* TEXT */))
              : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                  _createElementVNode("div", { class: "form-hint" }, [
                    _createTextVNode(_toDisplayString(_ctx.healthCheckResult.ok ? _ctx.t('config.health.ok') : _ctx.t('config.health.fail')) + " ", 1 /* TEXT */),
                    (_ctx.healthCheckResult.issues)
                      ? (_openBlock(), _createElementBlock("span", { key: 0 }, "（" + _toDisplayString(_ctx.t('config.health.issues', { count: _ctx.healthCheckResult.issues.length })) + "）", 1 /* TEXT */))
                      : _createCommentVNode("v-if", true)
                  ]),
                  (_ctx.healthCheckResult.remote && _ctx.healthCheckResult.remote.type === 'remote-health-check')
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "form-hint"
                      }, [
                        _createTextVNode(_toDisplayString(_ctx.healthCheckResult.remote.endpoint || '') + " ", 1 /* TEXT */),
                        (_ctx.healthCheckResult.remote.statusCode)
                          ? (_openBlock(), _createElementBlock("span", { key: 0 }, " · " + _toDisplayString(_ctx.healthCheckResult.remote.statusCode), 1 /* TEXT */))
                          : _createCommentVNode("v-if", true),
                        (_ctx.healthCheckResult.remote.message)
                          ? (_openBlock(), _createElementBlock("span", { key: 1 }, " · " + _toDisplayString(_ctx.healthCheckResult.remote.message), 1 /* TEXT */))
                          : _createCommentVNode("v-if", true)
                      ]))
                    : _createCommentVNode("v-if", true),
                  (_ctx.healthCheckResult.remote && _ctx.healthCheckResult.remote.speedTests)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "model-list"
                      }, [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.healthCheckResult.remote.speedTests, (result, name) => {
                          return (_openBlock(), _createElementBlock("div", {
                            key: 'health-speed-' + name,
                            class: "model-item"
                          }, [
                            _createElementVNode("span", null, _toDisplayString(name), 1 /* TEXT */),
                            (result && result.ok)
                              ? (_openBlock(), _createElementBlock("span", {
                                  key: 0,
                                  class: "latency ok"
                                }, _toDisplayString(_ctx.formatLatency(result)), 1 /* TEXT */))
                              : (_openBlock(), _createElementBlock("span", {
                                  key: 1,
                                  class: "latency error"
                                }, _toDisplayString((result && result.error) ? result.error : _ctx.t('config.health.fail')), 1 /* TEXT */))
                          ]))
                        }), 128 /* KEYED_FRAGMENT */))
                      ]))
                    : _createCommentVNode("v-if", true),
                  (_ctx.healthCheckResult.issues && _ctx.healthCheckResult.issues.length)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 2,
                        class: "model-list"
                      }, [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(_ctx.healthCheckResult.issues, (issue, index) => {
                          return (_openBlock(), _createElementBlock("div", {
                            key: issue.code || ('health-issue-' + index),
                            class: "model-item"
                          }, [
                            _createElementVNode("span", null, _toDisplayString(issue.message || issue.code || ''), 1 /* TEXT */)
                          ]))
                        }), 128 /* KEYED_FRAGMENT */))
                      ]))
                    : _createCommentVNode("v-if", true)
                ], 64 /* STABLE_FRAGMENT */)),
            _createElementVNode("div", { class: "btn-group" }, [
              _createElementVNode("button", {
                class: "btn btn-confirm",
                onClick: $event => (_ctx.showHealthCheckModal = false)
              }, _toDisplayString(_ctx.t('common.close')), 9 /* TEXT, PROPS */, ["onClick"])
            ])
          ])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    (_ctx.showConfirmDialog)
      ? (_openBlock(), _createElementBlock("div", {
          key: 16,
          class: "modal-overlay",
          onClick: _withModifiers(_ctx.closeConfirmDialog, ["self"])
        }, [
          _createElementVNode("div", {
            class: "modal confirm-dialog",
            role: "alertdialog",
            "aria-modal": "true",
            "aria-describedby": "confirm-dialog-message",
            "aria-labelledby": _ctx.confirmDialogTitle ? 'confirm-dialog-title' : null,
            "aria-label": _ctx.confirmDialogTitle ? null : _ctx.t('confirm.aria')
          }, [
            _createElementVNode("div", {
              id: "confirm-dialog-title",
              class: "modal-title"
            }, _toDisplayString(_ctx.confirmDialogTitle), 1 /* TEXT */),
            _createElementVNode("div", {
              id: "confirm-dialog-message",
              class: "confirm-dialog-message"
            }, _toDisplayString(_ctx.confirmDialogMessage), 1 /* TEXT */),
            _createElementVNode("div", { class: "btn-group confirm-dialog-actions" }, [
              _createElementVNode("button", {
                class: "btn btn-cancel",
                onClick: _ctx.closeConfirmDialog
              }, _toDisplayString(_ctx.confirmDialogCancelText), 9 /* TEXT, PROPS */, ["onClick"]),
              _createElementVNode("button", {
                class: _normalizeClass(['btn', 'btn-confirm', _ctx.confirmDialogDanger ? 'btn-danger' : '']),
                disabled: _ctx.isConfirmDialogDisabled(),
                onClick: $event => (_ctx.resolveConfirmDialog(true))
              }, _toDisplayString(_ctx.confirmDialogConfirmText), 11 /* TEXT, CLASS, PROPS */, ["disabled", "onClick"])
            ])
          ], 8 /* PROPS */, ["aria-labelledby", "aria-label"])
        ], 8 /* PROPS */, ["onClick"]))
      : _createCommentVNode("v-if", true),
    _createCommentVNode(" Toast通知 "),
    _createCommentVNode(" Toast "),
    (_ctx.message)
      ? (_openBlock(), _createElementBlock("div", {
          key: 17,
          class: _normalizeClass(['toast', _ctx.messageType]),
          role: "status",
          "aria-live": "polite",
          "aria-atomic": "true"
        }, _toDisplayString(_ctx.message), 3 /* TEXT, CLASS */))
      : _createCommentVNode("v-if", true)
  ], 64 /* STABLE_FRAGMENT */))
}
})();
