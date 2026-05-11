#!/usr/bin/env python3
"""Static health checks for the URAI Privacy website."""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
WEBSITE = ROOT / "website"

REQUIRED_PAGES = [
    "index.html",
    "principles.html",
    "rights.html",
    "governance.html",
    "legal.html",
    "contact.html",
    "status.html",
    "404.html",
]

REQUIRED_STATIC = [
    "styles.css",
    "robots.txt",
    "sitemap.xml",
    "CNAME",
    ".nojekyll",
    "README.md",
    "PUBLISHING.md",
]


def fail(message: str) -> None:
    print(f"[website] FAIL: {message}")
    sys.exit(1)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def main() -> None:
    for rel in REQUIRED_PAGES + REQUIRED_STATIC:
        if not (WEBSITE / rel).exists():
            fail(f"missing website/{rel}")

    sitemap = read(WEBSITE / "sitemap.xml")
    for rel in REQUIRED_PAGES:
        if rel == "404.html":
            continue
        expected = "https://uraiprivacy.com/" if rel == "index.html" else f"https://uraiprivacy.com/{rel}"
        if expected not in sitemap:
            fail(f"sitemap missing {expected}")

    robots = read(WEBSITE / "robots.txt")
    if "Sitemap: https://uraiprivacy.com/sitemap.xml" not in robots:
        fail("robots.txt must reference canonical sitemap")

    for rel in REQUIRED_PAGES:
        html = read(WEBSITE / rel)
        if "./styles.css" not in html:
            fail(f"{rel} must link shared stylesheet")
        if "URAI Privacy" not in html:
            fail(f"{rel} must mention URAI Privacy")
        for href in re.findall(r'href="(\./[^"]+)"', html):
            target = href.replace("./", "", 1).split("#", 1)[0]
            if target and not (WEBSITE / target).exists():
                fail(f"{rel} links missing file {target}")

    domain = read(WEBSITE / "CNAME").strip()
    if domain != "uraiprivacy.com":
        fail("website/CNAME must contain uraiprivacy.com")

    print("[website] OK: static website checks passed")


if __name__ == "__main__":
    main()
