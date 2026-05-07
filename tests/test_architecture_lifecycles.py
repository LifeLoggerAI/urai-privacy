"""Regression tests for privacy architecture lifecycle documentation."""

from __future__ import annotations

from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
ARCHITECTURE = ROOT / "architecture"


class ArchitectureLifecycleDocumentationTests(unittest.TestCase):
    def read_doc(self, filename: str) -> str:
        return (ARCHITECTURE / filename).read_text(encoding="utf-8")

    def test_lifecycle_docs_keep_mermaid_flowcharts(self) -> None:
        docs = [
            "CONSENT_LIFECYCLE.md",
            "DELETION_LIFECYCLE.md",
            "EXPORT_LIFECYCLE.md",
            "ANONYMIZATION_DATA_SHARING_LIFECYCLE.md",
            "AUDIT_LIFECYCLE.md",
            "INCIDENT_RESPONSE_LIFECYCLE.md",
        ]
        for filename in docs:
            with self.subTest(filename=filename):
                text = self.read_doc(filename)
                self.assertIn("```mermaid", text)
                self.assertIn("flowchart TD", text)

    def test_consent_lifecycle_keeps_revocation_and_audit_events_visible(self) -> None:
        text = self.read_doc("CONSENT_LIFECYCLE.md")
        required_terms = [
            "consent.changed",
            "Revocation",
            "Consent Registry",
            "Audit Log",
            "No downstream processor may continue",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_deletion_lifecycle_keeps_derived_and_biometric_cleanup_visible(self) -> None:
        text = self.read_doc("DELETION_LIFECYCLE.md")
        required_terms = [
            "deletionJobs",
            "derived_records_deleted_or_recomputed",
            "biometric",
            "deletion.completed",
            "Verification",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_export_lifecycle_keeps_integrity_and_status_tracking_visible(self) -> None:
        text = self.read_doc("EXPORT_LIFECYCLE.md")
        required_terms = [
            "exportJobs",
            "Integrity manifest",
            "Export bundle",
            "request.completed",
            "C7",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_anonymization_data_sharing_lifecycle_keeps_c8_and_cohort_controls_visible(self) -> None:
        text = self.read_doc("ANONYMIZATION_DATA_SHARING_LIFECYCLE.md")
        required_terms = [
            "C8",
            "minimum cohort",
            "re-identification",
            "Data-sharing ledger",
            "Opt-out",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_audit_lifecycle_keeps_append_only_and_review_controls_visible(self) -> None:
        text = self.read_doc("AUDIT_LIFECYCLE.md")
        required_terms = [
            "dataAccessLogs",
            "append-only",
            "audit.review",
            "Admin",
            "Escalation",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)

    def test_incident_response_lifecycle_keeps_containment_and_postmortem_visible(self) -> None:
        text = self.read_doc("INCIDENT_RESPONSE_LIFECYCLE.md")
        required_terms = [
            "incidentReports",
            "Containment",
            "Severity",
            "Notification",
            "Postmortem",
        ]
        for term in required_terms:
            with self.subTest(term=term):
                self.assertIn(term, text)


if __name__ == "__main__":
    unittest.main()
