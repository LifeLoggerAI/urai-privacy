"""Regression tests for security and support disclosure guidance."""

from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SECURITY = ROOT / "SECURITY.md"
SUPPORT = ROOT / "SUPPORT.md"
INCIDENT_RESPONSE = ROOT / "docs" / "INCIDENT_RESPONSE.md"
ESCALATION_MATRIX = ROOT / "sops" / "INCIDENT_ESCALATION_MATRIX.md"


class SecuritySupportDocumentationTests(unittest.TestCase):
    def test_security_policy_keeps_private_reporting_channels_visible(self) -> None:
        text = SECURITY.read_text(encoding="utf-8")

        required_terms = [
            "privacy@urai.app",
            "security@urai.app",
            "Do not open a public GitHub issue",
            "exposed secrets",
            "sensitive data exposure",
            "privacy-impacting incidents",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_security_policy_keeps_high_risk_categories_visible(self) -> None:
        text = SECURITY.read_text(encoding="utf-8")

        required_terms = [
            "unauthorized access to user data",
            "admin access misuse",
            "consent bypass",
            "deletion or export failure",
            "biometric or identity signal exposure",
            "sensitive inference exposure",
            "data-sharing or monetization without consent",
            "law enforcement request mishandling",
            "vendor or processor misuse",
            "exposed credentials, tokens, or service accounts",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_support_doc_keeps_public_vs_private_boundary_visible(self) -> None:
        text = SUPPORT.read_text(encoding="utf-8")

        allowed_public_terms = [
            "missing governance docs",
            "policy clarification requests",
            "adoption questions",
            "broken links or documentation problems",
        ]
        private_terms = [
            "security vulnerabilities",
            "exposed credentials",
            "private user data",
            "suspected breaches",
            "biometric exposure",
            "law enforcement requests",
            "specific user-rights requests",
            "sensitive operational incidents",
        ]
        for term in allowed_public_terms + private_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_incident_docs_keep_severity_model_and_first_hour_actions_visible(self) -> None:
        incident_text = INCIDENT_RESPONSE.read_text(encoding="utf-8")
        escalation_text = ESCALATION_MATRIX.read_text(encoding="utf-8")

        for severity in ["S0", "S1", "S2", "S3", "S4"]:
            with self.subTest(severity=severity):
                self.assertIn(severity, incident_text)
                self.assertIn(severity, escalation_text)

        for term in ["Required First Hour Actions", "Containment", "Evidence", "Postmortem"]:
            with self.subTest(term=term):
                self.assertIn(term, escalation_text + incident_text)


if __name__ == "__main__":
    unittest.main()
