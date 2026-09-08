# 任务编排

基于 DAG 的任务队列,支持依赖追踪、执行与日志,适合编排多次调用、多步依赖的复杂任务。

## 命令入口

```bash
codexmate workflow <list|get|validate|run|runs>
```

- `list`:列出可用 workflow。
- `get <name>`:查看某 workflow 详情。
- `validate <name>`:校验定义合法性。
- `run <name>`:执行。
- `runs`:查看历史执行记录与日志。

## 典型用法

```bash
codexmate workflow list
codexmate workflow get <name>
codexmate workflow validate <name>
codexmate workflow run <name>
codexmate workflow runs
```

## 下一步
部署文档站去 [GitHub Pages 部署](/guide/github-pages),或了解 [设计边界](/guide/limits)。
