"""Regression tests for public legal/privacy notice templates."""

from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
LEGAL = ROOT / "legal"


class LegalTemplateDocumentationTests(unittest.TestCase):
    def test_privacy_policy_template_keeps_user_rights_and_contact_visible(self) -> None:
        text = (LEGAL / "PRIVACY_POLICY_TEMPLATE.md").read_text(encoding="utf-8")

        required_terms = [
            "reviewed by qualified counsel",
            "Data We Collect",
            "Why We Use Data",
            "User Controls",
            "grant or revoke consent tiers",
            "export data",
            "delete records",
            "opt out of anonymized data-sharing participation",
            "Privacy contact: privacy@urai.app",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_biometric_and_ai_notice_keeps_sensitive_controls_visible(self) -> None:
        text = (LEGAL / "BIOMETRIC_AND_AI_INFERENCE_NOTICE_TEMPLATE.md").read_text(encoding="utf-8")

        required_terms = [
            "reviewed by qualified counsel",
            "Optional Biometric Features",
            "These features are off unless you choose to enable them",
            "must not sell raw biometric identifiers",
            "delete biometric templates",
            "disable sensitive AI insights",
            "see an explanation for why an insight was generated",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_data_sharing_notice_keeps_opt_in_and_prohibited_data_visible(self) -> None:
        text = (LEGAL / "DATA_SHARING_NOTICE_TEMPLATE.md").read_text(encoding="utf-8")

        required_terms = [
            "reviewed by qualified counsel",
            "Separate Opt-In Required",
            "off by default",
            "must not be bundled",
            "What Must Not Be Shared",
            "raw audio",
            "raw biometric templates",
            "user-linked sensitive inference records",
            "Cohort and Re-Identification Controls",
            "Opt-Out",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_user_rights_notice_keeps_export_deletion_revocation_review_visible(self) -> None:
        text = (LEGAL / "USER_RIGHTS_REQUEST_NOTICE.md").read_text(encoding="utf-8")

        required_terms = [
            "Data Export",
            "Deletion",
            "Consent Revocation",
            "Human Review",
            "privacy@urai.app",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_transparency_report_keeps_external_request_and_incident_sections_visible(self) -> None:
        text = (LEGAL / "TRANSPARENCY_REPORT_TEMPLATE.md").read_text(encoding="utf-8")

        required_terms = [
            "User Rights Requests",
            "Government / Law Enforcement Requests",
            "Privacy Incidents",
            "Data-Sharing Participation",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)


if __name__ == "__main__":
    unittest.main()
