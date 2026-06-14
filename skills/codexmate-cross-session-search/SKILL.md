---
name: codexmate-cross-session-search
description: Searches local Codex, Claude Code, Gemini, CodeBuddy, and codexmate-derived sessions for project-specific history and evidence. Use when the user asks to find prior project context across sessions, recover old task/PR/branch/file decisions, locate which session mentioned an error or artifact, or summarize cross-session project activity.
---

# Codexmate Cross-Session Search

## Overview

Use this skill to recover project history from local agent sessions. Keep the answer evidence-based: old sessions explain prior work, but mutable facts such as PR state, CI, releases, deployments, and current files still need live verification.

## Quick Start

Run the bundled dependency-free search script first:

```bash
python3 scripts/search_sessions.py "SakuraByteCore/codexmate PR 197" --source all --path-filter codexmate --format text --limit 5
```

Use `--path-filter` when the project/worktree is known, `--match all` for precise searches, and `--format json` when another tool or script will consume the result.

## Workflow

1. **Confirm the object**: repo/project, PR/issue number, branch, file path, command, error text, person, or date range. If multiple projects match, state the chosen object before searching.
2. **Try query variants**: exact `owner/repo`, short repo name, PR/issue number, branch, unique file path, error string, and user wording.
3. **Search broadly then narrow**: start with `--source all`, add `--path-filter` for the project/worktree, then retry with `--source codex` or `--source claude` when hits are noisy.
4. **Inspect only strong hits**: use session file paths from script output, or codexmate MCP `codexmate.session.detail` if available.
5. **Synthesize with boundaries**: cite source/session/file snippets, separate confirmed facts from inference, and list anything needing fresh verification.

## Optional codexmate MCP Path

If codexmate MCP is configured and healthy, the read-only tools can replace or supplement the script:

- `codexmate.session.list` with `source`, `query`, `queryScope: "all"`, `limit`, and `forceRefresh: true`.
- `codexmate.session.detail` for candidate session inspection.
- `codexmate.session.export` only when a markdown export is useful.

If MCP is unavailable, do not block; use `scripts/search_sessions.py`.

## Output Pattern

- **当前对象:** repo / PR / branch / file / keyword
- **搜索方式:** query variants and sources checked
- **命中证据:** strongest sessions with source + session id/file + snippet/status
- **结论:** what the prior context means now
- **仍需实时确认:** mutable facts requiring live checks

## Privacy

Share only context relevant to the current task. Do not quote credentials, unrelated personal details, private memory, or large transcript chunks. In group chats, summarize narrowly and avoid exposing unrelated sessions.
