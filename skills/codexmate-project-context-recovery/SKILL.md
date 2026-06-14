---
name: codexmate-project-context-recovery
description: Recovers project handoff context from local Codex, Claude Code, Gemini, CodeBuddy, and codexmate-derived sessions. Use when the user asks what happened in prior project/PR/branch/file/error work, needs a handoff brief, wants old decisions or validations recovered, or asks to summarize cross-session project activity with evidence.
---

# Codexmate Project Context Recovery

## Overview

Use this skill to build an evidence-first project handoff brief from local agent sessions. It is not semantic memory or a live GitHub source of truth. It works best with hard identifiers: `owner/repo`, branch names, file paths, commit hashes, exact errors, PR/issue numbers plus repo filters, or unique commands.

Old sessions are historical evidence. Mutable facts such as PR state, CI, releases, deployments, and current files still require live checks before action.

## Quick Start

Generate a context brief first. Resolve `scripts/search_sessions.py` relative to this skill directory; after npm installation the full package path is `node_modules/codexmate/skills/codexmate-project-context-recovery/scripts/search_sessions.py`.

```bash
python3 scripts/search_sessions.py "SakuraByteCore/codexmate feat/task-orchestration-tab" --mode brief --source all --path-filter codexmate --match all --format text --limit 8
```

Use plain search when you need raw candidates:

```bash
python3 scripts/search_sessions.py "exact error text" --mode search --source all --path-filter codexmate --format text --limit 10
```

## Workflow

1. **Confirm the object**: repo/project, PR/issue number, branch, file path, command, exact error text, person, or date range. If multiple projects match, state the chosen object before searching.
2. **Prefer hard identifiers**: exact `owner/repo`, short repo name, PR/issue number with repo filter, branch, file path, commit hash, exact error, then user wording.
3. **Generate a brief**: use `--mode brief`; add `--path-filter` for project/worktree isolation; use `--match all` when the query has strong identifiers.
4. **Check confidence**: `high` means multiple hard signals appeared; `medium/weak` means re-query with stronger identifiers before relying on it; `none` means no hits were found.
5. **Use the brief as a handoff**: extract timeline, decisions, validations, risks, files, commands, commits, and top evidence sessions.
6. **Live-check mutable facts**: before commenting, merging, releasing, or claiming current status, check GitHub/current files directly.

## What Good Output Looks Like

- **Target Object:** repo / PR / branch / file / error
- **Context Brief:** confidence, top sources, timeline, repos/branches/PRs/files
- **Historical Evidence:** session source/id/path + snippets
- **Handoff Summary:** decisions, validations, risks, commands, commits
- **Live Verification:** PR/check/review/release/current-file facts that still need live verification

## Optional codexmate MCP Path

If codexmate MCP is configured and healthy, use it to inspect strong candidates:

- `codexmate.session.list` with `source`, `query`, `queryScope: "all"`, `limit`, and `forceRefresh: true`.
- `codexmate.session.detail` for candidate session inspection.
- `codexmate.session.export` only when a markdown export is useful.

If MCP is unavailable, do not block; run `scripts/search_sessions.py`.

## Limits

- Generic natural-language queries can be noisy.
- Short PR numbers without repo/path filters are weak signals.
- Session logs may contain stale, failed, or speculative work.
- The brief should guide investigation; it must not replace current repo/GitHub verification.

## Privacy

Share only context relevant to the current task. Do not quote credentials, unrelated personal details, private memory, or large transcript chunks. In group chats, summarize narrowly and avoid exposing unrelated sessions.
