---
name: codexmate-cross-session-search
description: Cross-session project search for codexmate/OpenClaw work. Use when the user asks to find prior project context across sessions, search old agent runs, locate which session/PR/branch/file mentioned something, recover task history, compare project activity across sessions, or build a project-centered answer from sessions_list/sessions_history evidence.
---

# Codexmate Cross-Session Search

## Purpose

Find project-specific context across visible OpenClaw sessions without confusing repositories, leaking private context, or treating memory as evidence. This skill is for codexmate-style project/search workflows: session discovery, task recovery, prior decision lookup, PR/branch mapping, and cross-session status reconstruction.

## Workflow

1. **Confirm the search object first.**
   - Identify repo/project, PR/issue number, branch, file path, command, error text, person, or date range.
   - If multiple projects are plausible, state the current object before searching and do not reuse conclusions from another project.

2. **Build 3-6 query variants.**
   - Exact repo: `owner/repo`, short repo name, PR/issue number, branch name, unique file path, error string.
   - Include both human terms and technical anchors, e.g. `codexmate PR 191`, `SakuraByteCore/codexmate`, `session search`, `headRefOid`.

3. **Search visible sessions.**
   - Use `sessions_list` with `search`, `includeDerivedTitles:true`, `includeLastMessage:true`, and a reasonable `limit`.
   - Retry with different anchors when results are empty or suspiciously narrow.
   - Prefer exact repo/PR/file matches over vague title matches.

4. **Inspect candidate sessions.**
   - Use `sessions_history` only for likely candidates.
   - Include tools when the answer depends on actual actions, commands, commits, PR state, or files.
   - Extract evidence: session key/label, timestamp if available, repo/object, action taken, artifact link, command result, blocker, and final status.

5. **Search local project context when useful.**
   - Use `rg`/file reads for workspace artifacts such as `HEARTBEAT.md`, local skill files, project notes, or checked-out repos.
   - In group/shared chats, do not read or quote private long-term memory unless the current context explicitly permits it.

6. **Synthesize with evidence boundaries.**
   - Separate confirmed facts from likely inferences.
   - Say when evidence comes from session history, local files, GitHub, or current workspace inspection.
   - Do not claim current remote state from old session history; re-check mutable state when it matters.

## Privacy and Safety

- In group chats, share only context relevant to the current group task. Do not expose private personal details, unrelated sessions, credentials, or hidden memory.
- Do not quote large private transcripts. Summarize narrowly and cite only the minimum evidence needed.
- If a search result crosses projects or people, ask/clarify before disclosing sensitive details.
- Never use cross-session memory as authority for mutable facts such as PR state, CI status, deployment, releases, or current files; verify live when needed.

## Output Pattern

For small searches, answer directly:

- **当前对象:** repo / PR / branch / file
- **找到的相关会话:** session label/key + short evidence
- **结论:** what the prior context means now
- **仍需实时确认:** mutable facts that need fresh checks

For larger searches, group results by project or task and list only the strongest matches. Avoid dumping raw transcript text.

## Stop Conditions

Stop when one of these is true:

- A high-confidence session or artifact answers the question.
- Multiple candidates remain but require user disambiguation.
- The search space is exhausted after varied query attempts and local context checks.

When blocked, report the exact missing anchor: repo, PR/issue number, branch, approximate date, keyword, or session label.
