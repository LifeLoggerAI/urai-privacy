#!/usr/bin/env python3
"""Validate local links in Markdown files.

The governance package relies heavily on Markdown as a public operating manual.
This checker catches broken relative links before docs or release-gate references
ship to the public website or downstream product teams.
"""

from __future__ import annotations

from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {
    ".git",
    ".venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    ".mypy_cache",
    ".pytest_cache",
}

LINK_PATTERN = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")
AUTOLINK_PATTERN = re.compile(r"<((?:https?|mailto):[^>]+)>")


def iter_markdown_files(root: Path):
    for path in root.rglob("*.md"):
        relative = path.relative_to(root)
        if any(part in SKIP_DIRS for part in relative.parts):
            continue
        yield path


def is_external_link(target: str) -> bool:
    parsed = urlparse(target)
    return parsed.scheme in {"http", "https", "mailto", "tel"}


def normalize_target(raw_target: str) -> str:
    target = raw_target.strip()
    if " " in target and not target.startswith("<"):
        target = target.split(" ", 1)[0]
    return target.strip("<>")


def local_path_for_link(markdown_file: Path, raw_target: str) -> Path | None:
    target = normalize_target(raw_target)
    if not target or target.startswith("#") or is_external_link(target):
        return None

    path_part = unquote(target.split("#", 1)[0])
    if not path_part:
        return None

    if path_part.startswith("/"):
        return (ROOT / path_part.lstrip("/")).resolve()
    return (markdown_file.parent / path_part).resolve()


def find_broken_links(markdown_file: Path) -> list[str]:
    text = markdown_file.read_text(encoding="utf-8")
    findings: list[str] = []

    for line_number, line in enumerate(text.splitlines(), start=1):
        if AUTOLINK_PATTERN.search(line):
            # Autolinks are external by convention and should not be treated as
            # local Markdown link syntax by the broader regex below.
            line = AUTOLINK_PATTERN.sub("", line)

        for match in LINK_PATTERN.finditer(line):
            target_path = local_path_for_link(markdown_file, match.group(1))
            if target_path is None:
                continue
            try:
                target_path.relative_to(ROOT)
            except ValueError:
                findings.append(
                    f"{markdown_file.relative_to(ROOT)}:{line_number}: link escapes repository: {match.group(1)}"
                )
                continue
            if not target_path.exists():
                findings.append(
                    f"{markdown_file.relative_to(ROOT)}:{line_number}: missing link target: {match.group(1)}"
                )

    return findings


def main() -> int:
    findings: list[str] = []
    for markdown_file in iter_markdown_files(ROOT):
        findings.extend(find_broken_links(markdown_file))

    if findings:
        print("[markdown-links] FAIL: broken local Markdown links found")
        for finding in findings:
            print(f"- {finding}")
        return 1

    print("[markdown-links] OK: local Markdown links resolve")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
