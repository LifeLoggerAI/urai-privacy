#!/usr/bin/env python3
"""Run the full local/CI validation suite for URAI Privacy.

This is the single entrypoint developers and CI can use to avoid drift between
README instructions and GitHub Actions. It intentionally avoids external task
runners so the governance package stays lightweight.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Check:
    name: str
    command: tuple[str, ...]


CHECKS = (
    Check("unit and smoke tests", (sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py")),
    Check("committed secret scan", (sys.executable, "tools/check_secrets.py")),
    Check("local Markdown link validation", (sys.executable, "tools/check_markdown_links.py")),
    Check("static website validation", (sys.executable, "tools/check_website.py")),
    Check("privacy health report", (sys.executable, "tools/privacy_health_report.py")),
    Check("privacy package validation", (sys.executable, "tools/validate_privacy_package.py")),
)


def run_check(check: Check) -> int:
    print(f"\n[validation] START: {check.name}", flush=True)
    started = time.monotonic()
    result = subprocess.run(check.command, cwd=ROOT, check=False)
    duration = time.monotonic() - started
    status = "OK" if result.returncode == 0 else "FAIL"
    print(f"[validation] {status}: {check.name} ({duration:.1f}s)", flush=True)
    return result.returncode


def main() -> int:
    failures: list[str] = []
    for check in CHECKS:
        if run_check(check) != 0:
            failures.append(check.name)

    if failures:
        print("\n[validation] FAIL: " + ", ".join(failures), flush=True)
        return 1

    print("\n[validation] OK: all checks passed", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
