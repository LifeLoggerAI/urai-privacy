"""Regression tests for branch protection governance documentation."""

from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
BRANCH_PROTECTION = ROOT / "docs" / "BRANCH_PROTECTION.md"
GOVERNANCE_INDEX = ROOT / "docs" / "GOVERNANCE_INDEX.md"


class BranchProtectionDocumentationTests(unittest.TestCase):
    def test_branch_protection_standard_lists_required_controls(self) -> None:
        text = BRANCH_PROTECTION.read_text(encoding="utf-8")

        required_terms = [
            "Require a pull request before merging",
            "Require at least one approving review",
            "Require status checks to pass before merging",
            "Block force pushes",
            "Block branch deletion",
            "Privacy package validation / validate",
            "Website validation / validate",
            "CodeQL analysis / Analyze Python",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_repository_security_settings_stay_visible(self) -> None:
        text = BRANCH_PROTECTION.read_text(encoding="utf-8")

        required_terms = [
            "Secret scanning",
            "Push protection for secrets",
            "Dependabot alerts",
            "Dependabot security updates",
            "Code scanning alerts",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_governance_index_links_branch_protection_standard(self) -> None:
        text = GOVERNANCE_INDEX.read_text(encoding="utf-8")
        self.assertIn("[Branch Protection Standard](./BRANCH_PROTECTION.md)", text)
        self.assertIn("branch-protection controls", text)


if __name__ == "__main__":
    unittest.main()
