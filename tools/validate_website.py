#!/usr/bin/env python3
"""Smoke-test the static URAI Privacy website."""

from html.parser import HTMLParser
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
WEBSITE = ROOT / "website"
DOMAIN = "https://uraiprivacy.com"

PAGES = [
    "index.html",
    "principles.html",
    "rights.html",
    "governance.html",
    "legal.html",
    "contact.html",
    "404.html",
]


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.stylesheets: list[str] = []
        self.titles: list[str] = []
        self.meta_descriptions: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = {key: value for key, value in attrs}
        if tag == "a" and attrs_dict.get("href"):
            self.links.append(attrs_dict["href"] or "")
        if tag == "link" and attrs_dict.get("rel") == "stylesheet" and attrs_dict.get("href"):
            self.stylesheets.append(attrs_dict["href"] or "")
        if tag == "meta" and attrs_dict.get("name") == "description" and attrs_dict.get("content"):
            self.meta_descriptions.append(attrs_dict["content"] or "")
        if tag == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.titles.append(data.strip())


def fail(message: str) -> None:
    print(f"[website] FAIL: {message}")
    sys.exit(1)


def parse_page(path: Path) -> LinkParser:
    parser = LinkParser()
    parser.feed(path.read_text(encoding="utf-8"))
    return parser


def assert_file(path: Path) -> None:
    if not path.exists():
        fail(f"Missing required file: {path.relative_to(ROOT)}")


def validate_html_pages() -> None:
    for page in PAGES:
        path = WEBSITE / page
        assert_file(path)
        parser = parse_page(path)
        if not parser.titles or not parser.titles[0]:
            fail(f"{page} is missing a title")
        if not parser.meta_descriptions:
            fail(f"{page} is missing a meta description")
        if "404.html" != page and "./styles.css" not in parser.stylesheets:
            fail(f"{page} must use ./styles.css")
        for link in parser.links:
            if link.startswith("./"):
                target = WEBSITE / link[2:]
                if "#" in link:
                    target = WEBSITE / link[2:].split("#", 1)[0]
                if not target.exists():
                    fail(f"{page} links to missing local file: {link}")


def validate_static_files() -> None:
    for name in ["styles.css", "robots.txt", "sitemap.xml", "CNAME", ".nojekyll", "PUBLISHING.md", "README.md"]:
        assert_file(WEBSITE / name)

    cname = (WEBSITE / "CNAME").read_text(encoding="utf-8").strip()
    if cname != "uraiprivacy.com":
        fail("website/CNAME must contain exactly uraiprivacy.com")

    robots = (WEBSITE / "robots.txt").read_text(encoding="utf-8")
    if "Sitemap: https://uraiprivacy.com/sitemap.xml" not in robots:
        fail("robots.txt must reference the sitemap")

    try:
        tree = ET.parse(WEBSITE / "sitemap.xml")
    except ET.ParseError as exc:
        fail(f"sitemap.xml is invalid XML: {exc}")
    sitemap_text = ET.tostring(tree.getroot(), encoding="unicode")
    for page in ["", "principles.html", "rights.html", "governance.html", "legal.html", "contact.html"]:
        url = f"{DOMAIN}/{page}" if page else f"{DOMAIN}/"
        if url not in sitemap_text:
            fail(f"sitemap.xml missing {url}")


def main() -> None:
    validate_html_pages()
    validate_static_files()
    print("[website] OK: static website smoke tests passed")


if __name__ == "__main__":
    main()
