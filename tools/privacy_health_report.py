#!/usr/bin/env python3
"""Generate a governance health report for the URAI Privacy package.

The report is intentionally deterministic and dependency-light so it can be run
locally, in CI, or during release review. It summarizes package coverage without
calling external services.
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None


REPORT_SECTIONS = {
    "policy": ROOT / "policy",
    "docs": ROOT / "docs",
    "legal": ROOT / "legal",
    "architecture": ROOT / "architecture",
    "sops": ROOT / "sops",
    "schemas": ROOT / "schemas",
    "tests": ROOT / "tests",
    "website": ROOT / "website",
}

VALIDATION_TOOLS = [
    "tools/run_validation.py",
    "tools/check_secrets.py",
    "tools/check_markdown_links.py",
    "tools/check_website.py",
    "tools/validate_privacy_package.py",
    "adoption/ci/validate_repo_privacy.py",
]

RELEASE_GATES = [
    "Data classes for every collected or derived field",
    "Consent tiers for every collection, inference, sharing, and monetization purpose",
    "Retention and deletion behavior",
    "Export and explainability behavior where user-facing data or insights are created",
    "Audit logs for admin, system, sensitive, biometric, and monetization actions",
    "Privacy review approval",
]


def require_yaml() -> None:
    if yaml is None:
        print("[privacy-health] FAIL: PyYAML is required", file=sys.stderr)
        raise SystemExit(1)


def load_yaml(path: Path) -> dict:
    require_yaml()
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def count_files(path: Path, pattern: str) -> int:
    if not path.exists():
        return 0
    return sum(1 for item in path.rglob(pattern) if item.is_file())


def registry_counts() -> dict[str, int]:
    return {
        "data_classes": len(load_yaml(ROOT / "policy/data-classes.yaml").get("classes", {})),
        "consent_tiers": len(load_yaml(ROOT / "policy/consent-tiers.yaml").get("tiers", {})),
        "retention_classes": len(load_yaml(ROOT / "policy/retention-classes.yaml").get("classes", {})),
        "audit_event_types": len(load_yaml(ROOT / "policy/audit-event-types.yaml").get("eventTypes", {})),
        "blocked_data_uses": len(load_yaml(ROOT / "policy/blocked-data-uses.yaml").get("blockedUses", {})),
    }


def schema_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for schema_path in sorted((ROOT / "schemas").glob("*.json")):
        schema = load_json(schema_path)
        required = schema.get("required") or []
        counts[schema_path.name] = len(required)
    return counts


def test_counts() -> dict[str, int]:
    tests_dir = ROOT / "tests"
    test_files = sorted(tests_dir.glob("test_*.py"))
    assertions = 0
    test_methods = 0
    for path in test_files:
        text = path.read_text(encoding="utf-8")
        assertions += text.count("self.assert")
        test_methods += text.count("def test_")
    return {
        "test_files": len(test_files),
        "test_methods": test_methods,
        "assertions": assertions,
        "fixtures": count_files(tests_dir / "fixtures", "*.yaml"),
    }


def website_counts() -> dict[str, int]:
    website = ROOT / "website"
    return {
        "html_pages": count_files(website, "*.html"),
        "stylesheets": count_files(website, "*.css"),
        "sitemaps": count_files(website, "sitemap.xml"),
        "robots_files": count_files(website, "robots.txt"),
    }


def section_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for name, path in REPORT_SECTIONS.items():
        if name in {"policy", "schemas", "tests", "website"}:
            continue
        counts[name] = count_files(path, "*.md")
    return counts


def validation_tool_status() -> dict[str, bool]:
    return {tool: (ROOT / tool).exists() for tool in VALIDATION_TOOLS}


def print_table(title: str, rows: dict[str, int | bool]) -> None:
    print(f"\n## {title}")
    for key, value in rows.items():
        label = key.replace("_", " ")
        print(f"- {label}: {value}")


def main() -> int:
    print("# URAI Privacy Health Report")
    print("\nStatus: operational draft governance package")
    print("Version: " + (ROOT / "VERSION.md").read_text(encoding="utf-8").strip().splitlines()[0])

    print_table("Policy Registry Coverage", registry_counts())
    print_table("Documentation Coverage", section_counts())
    print_table("Schema Required Field Counts", schema_counts())
    print_table("Website Coverage", website_counts())
    print_table("Test Coverage Snapshot", test_counts())
    print_table("Validation Tooling", validation_tool_status())

    print("\n## Release Gate Checklist")
    for gate in RELEASE_GATES:
        print(f"- [ ] {gate}")

    print("\n## Manual Launch Blockers")
    print("- Qualified legal review of public legal templates and regulatory mappings")
    print("- Branch protection requiring the privacy validation workflow")
    print("- DNS/HTTPS verification for uraiprivacy.com")
    print("- Cross-repo adoption in production URAI product repositories")

    print("\n[privacy-health] OK: report generated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
