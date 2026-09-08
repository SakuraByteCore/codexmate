#!/usr/bin/env python3
"""Search local agent sessions and build project context briefs.

This script is intentionally dependency-free so Claude Code/Codex can run it from a skill.
It supports two modes:
- search: locate matching sessions and snippets
- brief: synthesize a structured, evidence-first context brief from matching sessions
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

SESSION_EXTS = {".jsonl", ".json", ".md", ".txt"}
DEFAULT_LIMIT = 20
DEFAULT_MAX_BYTES = 1024 * 1024
SYSTEM_NOISE = (
    "<permissions instructions>",
    "# agents.md instructions",
    "<instructions>",
    "available_skills",
    "<environment_context>",
    "$codex_home/skills",
    "skill-installer:",
    "skill-creator:",
    "trigger rules:",
    "missing/blocked:",
    "base_instructions",
    "truncation_policy",
    "you are codex",
    "you are an ai",
    "filesystem sandboxing",
    "output verbosity",
    "token_count",
    "rate_limits",
)
VALIDATION_TERMS = (
    "npm run", "pnpm", "yarn", "pytest", "vitest", "test", "lint", "build",
    "passed", "failed", "packaging skill", "skill is valid", "all ", "checks",
)
RISK_TERMS = (
    "failed", "failure", "error", "blocker", "pending", "review_required", "not logged in",
    "no matching", "cannot", "can't", "skipped", "risk", "todo", "unverified",
)
DECISION_TERMS = (
    "add", "added", "fix", "fixed", "update", "updated", "remove", "removed",
    "rename", "renamed", "implement", "implemented", "decided", "must", "should",
)


@dataclass
class Hit:
    source: str
    file: str
    session_id: str
    updated_at: float
    score: int
    snippets: list[str]
    cwd: str = ""
    title: str = ""
    metadata: dict[str, list[str]] | None = None


def home() -> Path:
    return Path(os.path.expanduser("~"))


def positive_int(value: str) -> int:
    try:
        parsed = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(f"{value!r} is not an integer") from exc
    if parsed <= 0:
        raise argparse.ArgumentTypeError(f"{value!r} must be greater than 0")
    return parsed


def candidate_roots(selected: str) -> list[tuple[str, Path]]:
    h = home()
    roots = [
        ("codex", h / ".codex" / "sessions"),
        ("claude", h / ".claude" / "projects"),
        ("codexmate-derived-codex", h / ".codexmate" / "sessions" / "derived" / "codex"),
        ("codexmate-derived-claude", h / ".codexmate" / "sessions" / "derived" / "claude"),
        ("gemini", h / ".gemini"),
        ("codebuddy", h / ".codebuddy"),
    ]
    if selected == "all":
        return roots
    return [(name, path) for name, path in roots if name == selected or name.startswith(f"{selected}-")]


def iter_files(root: Path, max_files: int) -> Iterable[Path]:
    if not root.exists():
        return
    count = 0
    for path in root.rglob("*"):
        if count >= max_files:
            return
        if not path.is_file() or path.suffix.lower() not in SESSION_EXTS:
            continue
        name = path.name.lower()
        if name in {"sessions-index.json", "settings.json"}:
            continue
        count += 1
        yield path


def read_tail(path: Path, max_bytes: int) -> str:
    try:
        size = path.stat().st_size
        with path.open("rb") as f:
            if size > max_bytes:
                f.seek(max(0, size - max_bytes))
            data = f.read(max_bytes)
        return data.decode("utf-8", errors="replace")
    except OSError:
        return ""


def token_groups(query: str) -> list[list[str]]:
    groups: list[list[str]] = []
    for raw in [t.lower() for t in re.split(r"\s+", query.strip()) if t.strip()]:
        variants = [raw]
        if "-" in raw:
            variants.append(raw.replace("-", ""))
            variants.extend(part for part in raw.split("-") if part)
        if "/" in raw:
            variants.extend(part for part in raw.split("/") if part)
        seen = set()
        groups.append([v for v in variants if v and not (v in seen or seen.add(v))])
    return groups


def flatten_groups(groups: list[list[str]]) -> list[str]:
    seen = set()
    tokens: list[str] = []
    for group in groups:
        for token in group:
            if token not in seen:
                seen.add(token)
                tokens.append(token)
    return tokens


def contains_token(lower: str, path_text: str, token: str) -> bool:
    return token in lower or token in path_text


def group_matches_all(lower: str, path_text: str, group: list[str]) -> bool:
    raw = group[0]
    if contains_token(lower, path_text, raw):
        return True
    if "-" in raw or "/" in raw:
        parts = [part for part in re.split(r"[-/]", raw) if part]
        if parts and all(contains_token(lower, path_text, part) for part in parts):
            return True
    return False


def noisy_string(value: str) -> bool:
    lower = value.lower()
    return any(noise in lower for noise in SYSTEM_NOISE)


def collect_strings(value: Any, out: list[str], key: str = "") -> None:
    if value is None:
        return
    if isinstance(value, str):
        if value.strip() and not noisy_string(value):
            out.append(value)
        return
    if isinstance(value, list):
        for item in value:
            collect_strings(item, out, key)
        return
    if isinstance(value, dict):
        for child_key, child_value in value.items():
            if child_key in {"base_instructions", "truncation_policy", "permissions"}:
                continue
            collect_strings(child_value, out, child_key)


def json_role(obj: dict[str, Any]) -> str:
    role = obj.get("role")
    if isinstance(role, str):
        return role.lower()
    message = obj.get("message")
    if isinstance(message, dict) and isinstance(message.get("role"), str):
        return message["role"].lower()
    payload = obj.get("payload")
    if isinstance(payload, dict):
        payload_role = payload.get("role")
        if isinstance(payload_role, str):
            return payload_role.lower()
        payload_msg = payload.get("message")
        if isinstance(payload_msg, dict) and isinstance(payload_msg.get("role"), str):
            return payload_msg["role"].lower()
    return ""


def useful_json_record(obj: dict[str, Any]) -> bool:
    role = json_role(obj)
    if role in {"system", "developer"}:
        return False
    typ = str(obj.get("type", "")).lower()
    subtype = str(obj.get("subtype", "")).lower()
    if typ in {"system"} or subtype in {"init"}:
        return False
    return True


def extract_search_text(raw: str) -> str:
    records: list[str] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        parsed: Any | None = None
        if stripped.startswith("{"):
            try:
                parsed = json.loads(stripped)
            except json.JSONDecodeError:
                parsed = None
        if isinstance(parsed, dict):
            strings: list[str] = []
            # Preserve useful metadata even when a record is otherwise noisy.
            for key in ("cwd", "working_dir", "workingDirectory", "title", "summary"):
                if isinstance(parsed.get(key), str):
                    strings.append(parsed[key])
            git = parsed.get("git")
            if isinstance(git, dict):
                for key in ("branch", "repository_url", "commit_hash"):
                    if isinstance(git.get(key), str):
                        strings.append(git[key])
            if useful_json_record(parsed):
                collect_strings(parsed, strings)
            clean_strings = [value for value in strings if not noisy_string(value)]
            if clean_strings:
                records.append(" ".join(clean_strings))
        else:
            records.append(stripped)
    text = "\n".join(records) if records else raw
    cleaned_lines = []
    for line in text.splitlines():
        lower = line.lower()
        if any(noise in lower for noise in SYSTEM_NOISE):
            continue
        cleaned_lines.append(line)
    return "\n".join(cleaned_lines) or raw


def extract_json_field(text: str, names: list[str]) -> str:
    for name in names:
        m = re.search(rf'"{re.escape(name)}"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', text)
        if m:
            try:
                return json.loads('"' + m.group(1) + '"')
            except Exception:
                return m.group(1)
    return ""


def make_snippets(text: str, tokens: list[str], max_snippets: int, phrase: str = "") -> list[str]:
    lower = text.lower()
    snippets: list[str] = []
    ordered_tokens = ([phrase] if phrase else []) + tokens
    for token in ordered_tokens:
        if not token:
            continue
        start = lower.find(token)
        if start < 0:
            continue
        lo = max(0, start - 120)
        hi = min(len(text), start + len(token) + 240)
        snippet = re.sub(r"\s+", " ", text[lo:hi]).strip()
        if snippet and snippet not in snippets:
            snippets.append(snippet)
        if len(snippets) >= max_snippets:
            break
    return snippets


def score_text(lower: str, tokens: list[str], path_text: str, phrase: str = "") -> int:
    score = 0
    if phrase and phrase in lower:
        score += 1000
    if phrase and phrase in path_text:
        score += 100
    for token in tokens:
        if token in lower:
            score += lower.count(token)
        if token in path_text:
            score += 2
    return score


def unique(items: Iterable[str], limit: int = 20) -> list[str]:
    seen = set()
    out: list[str] = []
    for item in items:
        value = item.strip().strip('"\'`,.;:()[]{}')
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
        if len(out) >= limit:
            break
    return out


def extract_metadata(text: str, path_text: str = "") -> dict[str, list[str]]:
    combined = f"{text}\n{path_text}"
    github_repo = re.findall(r"github\.com[:/]+([A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+?)(?:\.git|/|\s|\"|'|$)", combined)
    # Avoid treating arbitrary paths like `cli/file.js` or `site/assets` as repositories.
    # Repository identity is high-value only when it comes from a GitHub URL.
    owner_repo: list[str] = []
    branch_refs = re.findall(r"[\"'](?:branch|headRefName|gitBranch|baseRefName)[\"']\s*:\s*[\"']([A-Za-z0-9._/-]+)[\"']", combined, flags=re.IGNORECASE)
    branch_like = re.findall(r"\b(?:feat|fix|chore|docs|refactor|test|release|hotfix)/[A-Za-z0-9._/-]+", combined)
    pr_refs = re.findall(r"github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/(\d+)", combined)
    issue_refs = re.findall(r"github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/issues/(\d+)", combined)
    pr_words = re.findall(r"\b(?:PR|pull request|pull|issue)\s*#?(\d{1,6})\b", combined, flags=re.IGNORECASE)
    commits = re.findall(r"\b[0-9a-f]{7,40}\b", combined, flags=re.IGNORECASE)
    files = re.findall(r"(?:^|[\s\"'`])([A-Za-z0-9_./-]+\.(?:js|mjs|cjs|ts|tsx|jsx|py|md|json|ya?ml|sh|css|html|toml|lock))\b", combined)
    commands = re.findall(r"(?:^|\s)((?:npm|pnpm|yarn|python3?|node|gh|git|npx)\s+[^\n\r`]{1,160})", combined)
    return {
        "repos": unique(github_repo + owner_repo, 12),
        "branches": unique(branch_refs + branch_like, 12),
        "prs": unique(pr_refs + pr_words, 12),
        "issues": unique(issue_refs, 12),
        "commits": unique(commits, 12),
        "files": unique(files, 20),
        "commands": unique(commands, 12),
    }


def select_sentences(text: str, terms: tuple[str, ...], limit: int) -> list[str]:
    candidates = re.split(r"(?<=[.!?。！？])\s+|\n+", text)
    selected: list[str] = []
    for sentence in candidates:
        clean = re.sub(r"\s+", " ", sentence).strip()
        if len(clean) < 12 or len(clean) > 500:
            continue
        lower = clean.lower()
        if any(term in lower for term in terms):
            selected.append(clean)
        if len(selected) >= limit:
            break
    return unique(selected, limit)


def search(args: argparse.Namespace) -> list[Hit]:
    groups = token_groups(args.query)
    tokens = flatten_groups(groups)
    phrase = re.sub(r"\s+", " ", args.query.strip().lower())
    if not tokens:
        raise SystemExit("query is required")
    hits: list[Hit] = []
    for source, root in candidate_roots(args.source):
        for path in iter_files(root, args.max_files_per_root):
            raw_text = read_tail(path, args.max_bytes)
            if not raw_text:
                continue
            text = extract_search_text(raw_text)
            lower = text.lower()
            path_text = str(path).lower()
            path_filter = (args.path_filter or "").strip().lower()
            if path_filter and path_filter not in path_text and path_filter not in lower:
                continue
            if args.match == "all" and not all(group_matches_all(lower, path_text, group) for group in groups):
                continue
            if args.match == "any" and not any(contains_token(lower, path_text, t) for t in tokens):
                continue
            score = score_text(lower, tokens, path_text, phrase)
            if score <= 0:
                continue
            try:
                stat = path.stat()
                updated_at = stat.st_mtime
            except OSError:
                updated_at = 0
            hits.append(Hit(
                source=source,
                file=str(path),
                session_id=path.stem,
                updated_at=updated_at,
                score=score,
                snippets=make_snippets(text, tokens, args.snippets, phrase),
                cwd=extract_json_field(raw_text[:65536], ["cwd", "working_dir", "workingDirectory"]),
                title=extract_json_field(raw_text[:65536], ["title", "summary", "firstPrompt"]),
                metadata=extract_metadata(text, str(path)),
            ))
    hits.sort(key=lambda h: (h.score, h.updated_at), reverse=True)
    return hits[: args.limit]


def build_brief(args: argparse.Namespace, hits: list[Hit]) -> dict[str, Any]:
    aggregate: dict[str, list[str]] = {
        "repos": [], "branches": [], "prs": [], "issues": [], "commits": [], "files": [], "commands": [],
        "validations": [], "decisions": [], "risks": [],
    }
    timeline = []
    for hit in hits:
        meta = hit.metadata or {}
        for key in ("repos", "branches", "prs", "issues", "commits", "files", "commands"):
            aggregate[key].extend(meta.get(key, []))
        session_text = extract_search_text(read_tail(Path(hit.file), args.max_bytes))
        aggregate["validations"].extend(select_sentences(session_text, VALIDATION_TERMS, 4))
        aggregate["decisions"].extend(select_sentences(session_text, DECISION_TERMS, 4))
        aggregate["risks"].extend(select_sentences(session_text, RISK_TERMS, 4))
        timeline.append({
            "updatedAt": datetime.fromtimestamp(hit.updated_at, timezone.utc).isoformat() if hit.updated_at else "",
            "source": hit.source,
            "sessionId": hit.session_id,
            "cwd": hit.cwd,
            "title": hit.title,
            "score": hit.score,
            "evidence": hit.snippets[:2],
            "file": hit.file,
        })
    for key in aggregate:
        aggregate[key] = unique(aggregate[key], 20)
    hard_signal_count = sum(1 for key in ("repos", "branches", "commits", "files") if aggregate[key])
    confidence = "none"
    if hits:
        confidence = "high" if hard_signal_count >= 2 and hits[0].score >= 20 else "medium" if hits[0].score >= 5 else "weak"
    return {
        "query": args.query,
        "source": args.source,
        "pathFilter": args.path_filter,
        "match": args.match,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "confidence": confidence,
        "summary": {
            "hitCount": len(hits),
            "topSources": unique([hit.source for hit in hits], 8),
            "repos": aggregate["repos"][:8],
            "branches": aggregate["branches"][:8],
            "prs": aggregate["prs"][:8],
            "files": aggregate["files"][:10],
        },
        "timeline": timeline[: args.brief_items],
        "evidence": {
            "commits": aggregate["commits"][:10],
            "commands": aggregate["commands"][:10],
            "validations": aggregate["validations"][:8],
            "decisions": aggregate["decisions"][:8],
            "risks": aggregate["risks"][:8],
        },
        "handoff": [
            "Use the listed sessions as historical evidence, not current truth.",
            "Live-check GitHub PR/issue/check/release state before acting on mutable facts.",
            "Re-query with stronger identifiers if confidence is weak or hits are generic.",
        ],
    }


def emit_json(hits: list[Hit]) -> None:
    print(json.dumps({"hits": [hit.__dict__ for hit in hits]}, ensure_ascii=False, indent=2))


def emit_text(hits: list[Hit]) -> None:
    if not hits:
        print("No matching sessions found.")
        return
    for index, hit in enumerate(hits, 1):
        print(f"{index}. [{hit.source}] score={hit.score} session={hit.session_id}")
        print(f"   file: {hit.file}")
        if hit.cwd:
            print(f"   cwd: {hit.cwd}")
        if hit.title:
            print(f"   title: {hit.title}")
        for snippet in hit.snippets:
            print(f"   - {snippet}")


def emit_brief_text(brief: dict[str, Any]) -> None:
    print(f"# Project Context Brief: {brief['query']}")
    print(f"confidence: {brief['confidence']} | hits: {brief['summary']['hitCount']} | source: {brief['source']}")
    if brief.get("pathFilter"):
        print(f"path-filter: {brief['pathFilter']}")
    summary = brief["summary"]
    for label, key in (("repos", "repos"), ("branches", "branches"), ("prs", "prs"), ("files", "files")):
        values = summary.get(key) or []
        if values:
            print(f"\n## {label}")
            for value in values:
                print(f"- {value}")
    print("\n## timeline")
    if not brief["timeline"]:
        print("- No matching sessions found.")
    for item in brief["timeline"]:
        print(f"- {item['updatedAt']} [{item['source']}] {item['sessionId']} score={item['score']}")
        if item.get("cwd"):
            print(f"  cwd: {item['cwd']}")
        if item.get("file"):
            print(f"  file: {item['file']}")
        for evidence in item.get("evidence", []):
            print(f"  evidence: {evidence}")
    evidence = brief["evidence"]
    for label, key in (("validations", "validations"), ("decisions", "decisions"), ("risks", "risks"), ("commands", "commands"), ("commits", "commits")):
        values = evidence.get(key) or []
        if values:
            print(f"\n## {label}")
            for value in values:
                print(f"- {value}")
    print("\n## handoff")
    for item in brief["handoff"]:
        print(f"- {item}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Search local agent sessions and build project context briefs.")
    parser.add_argument("query", help="Search query, e.g. owner/repo, PR number, branch, file path, or exact error text")
    parser.add_argument("--mode", default="search", choices=["search", "brief"], help="search returns hits; brief returns a structured handoff summary")
    parser.add_argument("--source", default="all", choices=["all", "codex", "claude", "gemini", "codebuddy", "codexmate-derived", "codexmate-derived-codex", "codexmate-derived-claude"], help="Session source to search")
    parser.add_argument("--match", default="any", choices=["any", "all"], help="Whether any or all query tokens must match")
    parser.add_argument("--path-filter", default="", help="Optional substring that must appear in the session path or content, useful for project/worktree filtering")
    parser.add_argument("--limit", type=positive_int, default=DEFAULT_LIMIT, help="Maximum hits to scan/print")
    parser.add_argument("--brief-items", type=positive_int, default=8, help="Maximum timeline items in brief mode")
    parser.add_argument("--snippets", type=positive_int, default=2, help="Maximum snippets per hit")
    parser.add_argument("--max-bytes", type=positive_int, default=DEFAULT_MAX_BYTES, help="Tail bytes to scan per session file")
    parser.add_argument("--max-files-per-root", type=positive_int, default=5000, help="Maximum files to scan per root")
    parser.add_argument("--format", choices=["json", "text"], default="json")
    args = parser.parse_args()
    hits = search(args)
    if args.mode == "brief":
        brief = build_brief(args, hits)
        if args.format == "text":
            emit_brief_text(brief)
        else:
            print(json.dumps(brief, ensure_ascii=False, indent=2))
        return 0
    if args.format == "text":
        emit_text(hits)
    else:
        emit_json(hits)
    return 0


if __name__ == "__main__":
    sys.exit(main())
