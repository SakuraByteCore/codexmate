#!/usr/bin/env python3
"""Search local Codex/Claude/Codexmate-derived session files.

This script is intentionally dependency-free so Claude Code can run it from a skill.
It prints JSON by default and a compact text report with --format text.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

SESSION_EXTS = {".jsonl", ".json", ".md", ".txt"}
DEFAULT_LIMIT = 20
DEFAULT_MAX_BYTES = 512 * 1024


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


def home() -> Path:
    return Path(os.path.expanduser("~"))


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
        hi = min(len(text), start + len(token) + 220)
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


def search(args: argparse.Namespace) -> list[Hit]:
    groups = token_groups(args.query)
    tokens = flatten_groups(groups)
    phrase = re.sub(r"\s+", " ", args.query.strip().lower())
    if not tokens:
        raise SystemExit("query is required")
    hits: list[Hit] = []
    for source, root in candidate_roots(args.source):
        for path in iter_files(root, args.max_files_per_root):
            text = read_tail(path, args.max_bytes)
            if not text:
                continue
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
                cwd=extract_json_field(text[:65536], ["cwd", "working_dir", "workingDirectory"]),
                title=extract_json_field(text[:65536], ["title", "summary", "firstPrompt"]),
            ))
    hits.sort(key=lambda h: (h.score, h.updated_at), reverse=True)
    return hits[: args.limit]


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


def main() -> int:
    parser = argparse.ArgumentParser(description="Search local agent session files for project context.")
    parser.add_argument("query", help="Search query, e.g. owner/repo, PR number, branch, file path, or error text")
    parser.add_argument("--source", default="all", choices=["all", "codex", "claude", "gemini", "codebuddy", "codexmate-derived-codex", "codexmate-derived-claude"], help="Session source to search")
    parser.add_argument("--match", default="any", choices=["any", "all"], help="Whether any or all query tokens must match")
    parser.add_argument("--path-filter", default="", help="Optional substring that must appear in the session path or content, useful for project/worktree filtering")
    parser.add_argument("--limit", type=int, default=DEFAULT_LIMIT, help="Maximum hits to print")
    parser.add_argument("--snippets", type=int, default=2, help="Maximum snippets per hit")
    parser.add_argument("--max-bytes", type=int, default=DEFAULT_MAX_BYTES, help="Tail bytes to scan per session file")
    parser.add_argument("--max-files-per-root", type=int, default=5000, help="Maximum files to scan per root")
    parser.add_argument("--format", choices=["json", "text"], default="json")
    args = parser.parse_args()
    hits = search(args)
    if args.format == "text":
        emit_text(hits)
    else:
        emit_json(hits)
    return 0


if __name__ == "__main__":
    sys.exit(main())
