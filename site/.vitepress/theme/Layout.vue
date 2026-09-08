<script setup>
import { computed } from "vue";
import DefaultTheme from "vitepress/theme";
import { useData } from "vitepress";
import "./style.css";

const { Layout } = DefaultTheme;

const CHAPTERS = [
  { link: "/guide/start-here", title: "从这里开始" },
  { link: "/guide/capabilities", title: "它能做什么" },
  { link: "/guide/quick-start", title: "快速开始" },
  { link: "/guide/workflow", title: "核心工作流" },
  { link: "/guide/web-ui", title: "Web UI 集中管理" },
  { link: "/guide/sessions", title: "会话管理" },
  { link: "/guide/skills-prompt", title: "Skills 与提示词" },
  { link: "/guide/tasks", title: "任务编排" },
  { link: "/guide/architecture", title: "架构总览" },
  { link: "/guide/limits", title: "设计边界" },
  { link: "/guide/github-pages", title: "GitHub Pages 部署" },
];

const { page } = useData();

const nav = computed(() => {
  const raw = (page.value.relativePath || "").replace(/\.md$/, "");
  const path = "/" + raw;
  const idx = CHAPTERS.findIndex((c) => c.link === path);
  if (idx < 0) return null;
  return {
    prev: idx > 0 ? CHAPTERS[idx - 1] : null,
    next: idx < CHAPTERS.length - 1 ? CHAPTERS[idx + 1] : null,
  };
});
</script>

<template>
  <Layout>
    <template #doc-after>
      <nav v-if="nav" class="book-nav-bottom">
        <a v-if="nav.prev" :href="nav.prev.link">
          <span aria-hidden="true">←</span>
          {{ nav.prev.title }}
        </a>
        <span v-else class="placeholder">.</span>
        <a class="to-toc" href="/">回到目录</a>
        <a v-if="nav.next" :href="nav.next.link">
          {{ nav.next.title }}
          <span aria-hidden="true">→</span>
        </a>
        <span v-else class="placeholder">.</span>
      </nav>
    </template>
  </Layout>
</template>
