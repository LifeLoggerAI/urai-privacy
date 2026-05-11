"""Regression tests for release and launch readiness governance docs."""

from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
LAUNCH_READINESS = ROOT / "LAUNCH_READINESS.md"
RELEASE_PROCESS = ROOT / "RELEASE_PROCESS.md"
POLICY_VERSIONING = ROOT / "POLICY_VERSIONING.md"


class ReleaseReadinessDocumentationTests(unittest.TestCase):
    def test_launch_readiness_keeps_critical_gate_sections(self) -> None:
        text = LAUNCH_READINESS.read_text(encoding="utf-8")

        required_sections = [
            "## Governance Package",
            "## Website and Public Notices",
            "## Product Repo Adoption",
            "## User Rights Implementation",
            "## Security and Operations",
            "## Launch Decision",
        ]
        for section in required_sections:
            with self.subTest(section=section):
                self.assertIn(section, text)

    def test_launch_readiness_keeps_manual_legal_and_adoption_gates_visible(self) -> None:
        text = LAUNCH_READINESS.read_text(encoding="utf-8")

        required_terms = [
            "Public privacy policy is reviewed by counsel",
            "Biometric and AI inference notice is reviewed by counsel",
            "Data-sharing / monetization notice is reviewed by counsel",
            "privacy/PRIVACY_VERSION.md exists",
            "privacy/data-inventory.yaml exists",
            "Feature manifests exist for data-processing features",
            "Deletion, export, revocation, explanation, and audit behavior are mapped",
            "GitHub branch protection is enabled for `main`",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_release_process_requires_validation_and_migration_review(self) -> None:
        text = RELEASE_PROCESS.read_text(encoding="utf-8")

        required_terms = [
            "tools/validate_privacy_package.py passes",
            "Policy registries are internally consistent",
            "Legal templates impacted by the release are marked for counsel review",
            "Migration impact on product repos is documented",
            "Merge after review and passing CI",
            "privacy/PRIVACY_VERSION.md",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_policy_versioning_keeps_semver_and_legal_markers_visible(self) -> None:
        text = POLICY_VERSIONING.read_text(encoding="utf-8")

        required_terms = [
            "MAJOR.MINOR.PATCH",
            "Version Adoption",
            "Legal Review Marker",
            "product repos",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)


if __name__ == "__main__":
    unittest.main()
