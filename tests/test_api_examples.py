"""Regression tests for URAI Privacy API payload examples."""

from __future__ import annotations

import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "api" / "examples"


class PrivacyApiExampleTests(unittest.TestCase):
    def load_example(self, name: str) -> dict:
        return json.loads((EXAMPLES / name).read_text(encoding="utf-8"))

    def test_required_examples_exist_and_are_valid_json(self) -> None:
        expected_files = [
            "consent-event.json",
            "export-request.json",
            "deletion-request.json",
            "data-sharing-opt-out.json",
            "audit-history-event.json",
            "insight-explanation.json",
        ]
        for filename in expected_files:
            with self.subTest(filename=filename):
                payload = self.load_example(filename)
                self.assertIsInstance(payload, dict)
                self.assertEqual(payload["policyVersion"], "0.1.0-draft")

    def test_consent_event_example_keeps_required_fields(self) -> None:
        payload = self.load_example("consent-event.json")
        self.assertEqual(payload["consentTier"], "C4")
        self.assertEqual(payload["status"], "granted")
        self.assertEqual(payload["source"], "user")
        self.assertIn("purpose", payload)
        self.assertIn("recordedAt", payload)

    def test_user_rights_request_examples_keep_policy_version_and_user_context(self) -> None:
        for filename in ["export-request.json", "deletion-request.json", "data-sharing-opt-out.json"]:
            with self.subTest(filename=filename):
                payload = self.load_example(filename)
                self.assertIn("userId", payload)
                self.assertEqual(payload["policyVersion"], "0.1.0-draft")

    def test_audit_history_example_keeps_user_visible_event_context(self) -> None:
        payload = self.load_example("audit-history-event.json")
        self.assertIn("eventId", payload)
        self.assertIn("eventType", payload)
        self.assertIn("actorType", payload)
        self.assertIn("occurredAt", payload)
        self.assertIn("summary", payload)

    def test_insight_explanation_example_keeps_explainability_metadata(self) -> None:
        payload = self.load_example("insight-explanation.json")
        self.assertIn("insightId", payload)
        self.assertIn("summary", payload)
        self.assertIn("sourceFields", payload)
        self.assertIn("dataClasses", payload)
        self.assertIn("consentTiers", payload)
        self.assertIn("L4", payload["dataClasses"])
        self.assertIn("C4", payload["consentTiers"])


if __name__ == "__main__":
    unittest.main()
