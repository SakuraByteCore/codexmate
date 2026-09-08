# Skills 与提示词

两块本地优先能力:Skills Market 做跨 agent 应用导入导出;Prompt 文件编辑器管 `CLAUDE.md`/`AGENTS.md`。

## Skills Market

本地优先的 skills 市场,跨不同 agent 应用导入导出 skills。不依赖外部服务,数据在本地。

## Prompt 文件编辑器

编辑全局与项目级 `CLAUDE.md` / `AGENTS.md`:
- 自动检测项目路径并切换路径。
- 共享 preset 池复用提示词。
- 应用 preset 仅更新编辑器内容,**保存才写文件**——不会未经确认改盘。

> 区分:Prompt 模板是带变量的可复用提示词插件;Prompt 文件编辑器是给全局/项目级文件做编辑与 preset 应用。

## MCP 集成

MCP stdio 暴露本地工具与资源,按需开启写入工具。自动化场景可直接对接。

## 下一步
编排多步任务看 [任务编排](/guide/tasks),部署文档站看 [GitHub Pages 部署](/guide/github-pages)。
