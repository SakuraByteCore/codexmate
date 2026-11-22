# Skills 与提示词

两块本地优先能力:Skills Market 做跨 agent 应用导入导出;Prompt 文件编辑器管 `CLAUDE.md`/`AGENTS.md`。

## Skills Market

本地优先的 skills 市场,跨不同 agent 应用导入导出 skills。不依赖外部服务,数据在本地。

## Prompt 文件编辑器

编辑全局与项目级 `CLAUDE.md` / `AGENTS.md`:
- 自动检测项目路径并切换路径。
- Codex 的 `AGENTS.md` 与 OpenCode 的 `~/.config/opencode/AGENTS.md` 分页签独立编辑。
- 共享 preset 池复用提示词。
- 应用 preset 仅更新编辑器内容,**保存才写文件**——不会未经确认改盘。

> 区分:Prompt 模板是带变量的可复用提示词插件;Prompt 文件编辑器是给全局/项目级文件做编辑与 preset 应用。

## 模板变量

模板和 preset 支持 `{{project_path}}`、`{{git_diff}}` 等占位符。调用时，缺失变量会弹出填写窗口；取消不会修改编辑器或复制内容。`git_diff` 由用户粘贴，不会执行 Git 命令。调用弹窗中的填写值仅用于本次操作，模板原文保留占位符。

## 历史、Diff 与回滚

提示词文件历史保留内容预览和“恢复到编辑器”，还可查看历史与当前内容的 Diff，确认后直接回滚到文件。直接回滚先备份当前版本；写入失败或当前版本已变化时，不覆盖内容。

插件页可查看自定义提示词模板配置的历史与 Diff。配置保存在 `~/.codex/codexmate-plugin-config.json`，不包含调用弹窗填写值；首次保存会保留旧浏览器模板配置以便恢复。内置模板和其他插件的临时文本不写入该配置。

## 分享单个模板

在模板管理列表点击分享，复制可导入的单模板 JSON；复制不可用时下载 JSON。分享保留原占位符，不包含本次填充值。接收方在 Prompt 模板插件中导入，再填写变量使用。

## MCP 集成

MCP stdio 暴露本地工具与资源,按需开启写入工具。自动化场景可直接对接。

## 下一步
编排多步任务看 [任务编排](/guide/tasks),部署文档站看 [GitHub Pages 部署](/guide/github-pages)。
