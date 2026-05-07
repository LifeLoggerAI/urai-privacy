"""Static end-to-end smoke tests for the URAI Privacy website.

The website is a static GitHub Pages surface, so these tests validate the core
user journeys without adding a browser dependency: homepage navigation, user
rights/contact path, status path, and 404 recovery.
"""

from __future__ import annotations

from html.parser import HTMLParser
from pathlib import Path
import unittest
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
WEBSITE = ROOT / "website"

CORE_PAGES = {
    "index.html",
    "principles.html",
    "rights.html",
    "governance.html",
    "legal.html",
    "contact.html",
    "status.html",
}


class LinkCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[str] = []
        self.main_ids: set[str] = set()
        self.skip_links: list[str] = []
        self.titles: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag == "a" and attr.get("href"):
            href = attr["href"] or ""
            self.links.append(href)
            if "skip-link" in (attr.get("class") or ""):
                self.skip_links.append(href)
        if attr.get("id") == "main":
            self.main_ids.add("main")
        if tag == "title":
            self._in_title = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.titles.append(data.strip())


def parse_page(page: str) -> LinkCollector:
    parser = LinkCollector()
    parser.feed((WEBSITE / page).read_text(encoding="utf-8"))
    return parser


def local_target(href: str) -> str | None:
    parsed = urlparse(href)
    if parsed.scheme or parsed.netloc:
        return None
    target = parsed.path.removeprefix("./")
    return target or "index.html"


class WebsiteStaticE2ETests(unittest.TestCase):
    def test_homepage_navigation_reaches_core_pages(self) -> None:
        parser = parse_page("index.html")
        local_links = {target for href in parser.links if (target := local_target(href))}
        self.assertTrue(CORE_PAGES.issubset(local_links | {"index.html"}), local_links)
        self.assertIn("#main", parser.skip_links)
        self.assertIn("main", parser.main_ids)
        self.assertTrue(any("URAI Privacy" in title for title in parser.titles), parser.titles)

    def test_all_internal_links_resolve(self) -> None:
        pages = CORE_PAGES | {"404.html"}
        for page in pages:
            with self.subTest(page=page):
                parser = parse_page(page)
                for href in parser.links:
                    target = local_target(href)
                    if not target or target.startswith("#"):
                        continue
                    self.assertTrue((WEBSITE / target).exists(), f"{page} links missing {target}")

    def test_user_rights_to_contact_happy_path(self) -> None:
        rights = parse_page("rights.html")
        rights_links = {target for href in rights.links if (target := local_target(href))}
        self.assertIn("contact.html", rights_links)

        contact_html = (WEBSITE / "contact.html").read_text(encoding="utf-8")
        self.assertIn("privacy@urai.app", contact_html)
        self.assertIn("security@urai.app", contact_html)
        self.assertIn("Do not post sensitive data publicly", contact_html)

    def test_status_path_exposes_launch_blockers(self) -> None:
        index_html = (WEBSITE / "index.html").read_text(encoding="utf-8")
        status_html = (WEBSITE / "status.html").read_text(encoding="utf-8")
        self.assertIn("status.html", index_html)
        self.assertIn("Launch blockers to clear", status_html)
        self.assertIn("qualified legal review", status_html)

    def test_404_edge_path_recovers_to_safe_destinations(self) -> None:
        parser = parse_page("404.html")
        local_links = {target for href in parser.links if (target := local_target(href))}
        self.assertIn("index.html", local_links)
        self.assertIn("contact.html", local_links)
        self.assertIn("#main", parser.skip_links)


if __name__ == "__main__":
    unittest.main()
