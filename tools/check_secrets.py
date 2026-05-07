#!/usr/bin/env python3
"""Lightweight repository secret scanner for URAI Privacy.

This intentionally avoids external dependencies so it can run in CI and during
local governance reviews. It is not a replacement for GitHub secret scanning or
a commercial scanner, but it catches common dangerous patterns before review.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import sys

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

SKIP_FILES = {
    "tools/check_secrets.py",  # contains detector regexes by design
}

TEXT_EXTENSIONS = {
    "",
    ".css",
    ".html",
    ".json",
    ".md",
    ".py",
    ".txt",
    ".yaml",
    ".yml",
    ".xml",
}

PLACEHOLDER_MARKERS = (
    "${",
    "<",
    "example",
    "placeholder",
    "changeme",
    "change-me",
    "your_",
    "your-",
    "dummy",
    "redacted",
    "xxxx",
)


@dataclass(frozen=True)
class Rule:
    name: str
    pattern: re.Pattern[str]


RULES = [
    Rule("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    Rule("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{36,}\b")),
    Rule("Google API key", re.compile(r"\bAIza[0-9A-Za-z\-_]{35}\b")),
    Rule("Private key block", re.compile(r"-----BEGIN (?:RSA |DSA |EC |OPENSSH |PGP )?PRIVATE KEY-----")),
    Rule(
        "Secret assignment",
        re.compile(
            r"(?i)\b(?:secret|api[_-]?key|token|password|private[_-]?key)\b\s*[:=]\s*['\"][^'\"]{12,}['\"]"
        ),
    ),
]


def is_placeholder(line: str) -> bool:
    lowered = line.lower()
    return any(marker in lowered for marker in PLACEHOLDER_MARKERS)


def iter_text_files(root: Path):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(root)
        if any(part in SKIP_DIRS for part in relative.parts):
            continue
        if relative.as_posix() in SKIP_FILES:
            continue
        if path.suffix.lower() not in TEXT_EXTENSIONS:
            continue
        yield path


def scan_file(path: Path) -> list[str]:
    findings: list[str] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except UnicodeDecodeError:
        return findings

    rel = path.relative_to(ROOT)
    for line_number, line in enumerate(lines, start=1):
        if is_placeholder(line):
            continue
        for rule in RULES:
            if rule.pattern.search(line):
                findings.append(f"{rel}:{line_number}: {rule.name}")
    return findings


def main() -> int:
    findings: list[str] = []
    for path in iter_text_files(ROOT):
        findings.extend(scan_file(path))

    if findings:
        print("[secrets] FAIL: potential secrets found")
        for finding in findings:
            print(f"- {finding}")
        return 1

    print("[secrets] OK: no obvious committed secrets detected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
