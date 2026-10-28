const base = process.env.VITEPRESS_BASE || "/codexmate/";

export default {
  title: "Codex Mate",
  description: "找回散落在不同 AI 编程工具里的对话。本地查看、筛选与导出会话，集中管理 Provider、Skills 与任务。",
  base,
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    nav: [
      { text: "目录", link: "/" },
      { text: "从这里开始", link: "/guide/start-here" },
      { text: "架构", link: "/guide/architecture" },
      { text: "GitHub", link: "https://github.com/SakuraByteCore/codexmate" }
    ],
    sidebar: [
      {
        text: "目录",
        items: [
          { text: "从这里开始", link: "/guide/start-here" },
          { text: "它能做什么", link: "/guide/capabilities" },
          { text: "快速开始", link: "/guide/quick-start" },
          { text: "核心工作流", link: "/guide/workflow" },
          { text: "Web UI 集中管理", link: "/guide/web-ui" },
          { text: "会话管理", link: "/guide/sessions" },
          { text: "Skills 与提示词", link: "/guide/skills-prompt" },
          { text: "任务编排", link: "/guide/tasks" },
          { text: "架构总览", link: "/guide/architecture" },
          { text: "设计边界", link: "/guide/limits" },
          { text: "GitHub Pages 部署", link: "/guide/github-pages" }
        ]
      }
    ],
    socialLinks: [
      { icon: "github", link: "https://github.com/SakuraByteCore/codexmate" }
    ],
    footer: {
      message: "Released under the Apache-2.0 License.",
      copyright: "Copyright © Codex Mate contributors"
    }
  }
};
