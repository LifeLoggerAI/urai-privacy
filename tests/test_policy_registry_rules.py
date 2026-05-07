"""Regression tests for canonical privacy policy registries."""

from __future__ import annotations

from pathlib import Path
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]
POLICY = ROOT / "policy"


class PolicyRegistryRuleTests(unittest.TestCase):
    def setUp(self) -> None:
        self.data_classes = yaml.safe_load((POLICY / "data-classes.yaml").read_text(encoding="utf-8"))["classes"]
        self.consent_tiers = yaml.safe_load((POLICY / "consent-tiers.yaml").read_text(encoding="utf-8"))["tiers"]
        self.retention_classes = yaml.safe_load((POLICY / "retention-classes.yaml").read_text(encoding="utf-8"))["classes"]

    def test_registry_ids_remain_complete_and_ordered(self) -> None:
        self.assertEqual(list(self.data_classes.keys()), [f"L{i}" for i in range(8)])
        self.assertEqual(list(self.consent_tiers.keys()), [f"C{i}" for i in range(9)])
        self.assertEqual(list(self.retention_classes.keys()), [f"R{i}" for i in range(7)])

    def test_sensitive_inference_requires_c4_and_explainability(self) -> None:
        l4 = self.data_classes["L4"]
        c4 = self.consent_tiers["C4"]

        self.assertEqual(l4["defaultConsentTier"], "C4")
        self.assertTrue(l4["explainabilityRequired"])
        self.assertTrue(c4["separatePromptRequired"])
        self.assertTrue(c4["explainabilityRequired"])
        self.assertTrue(c4["revocable"])

    def test_biometric_identity_requires_c5_and_restricted_retention(self) -> None:
        l5 = self.data_classes["L5"]
        c5 = self.consent_tiers["C5"]
        r6 = self.retention_classes["R6"]

        self.assertEqual(l5["defaultConsentTier"], "C5")
        self.assertTrue(l5["separateConsentRequired"])
        self.assertTrue(c5["separatePromptRequired"])
        self.assertTrue(c5["biometricDeletionRequired"])
        self.assertTrue(r6["biometricDeletionRequired"])
        self.assertEqual(r6["defaultDuration"], "P90D")

    def test_anonymized_data_products_require_c8_and_cohort_controls(self) -> None:
        l6 = self.data_classes["L6"]
        c8 = self.consent_tiers["C8"]
        r5 = self.retention_classes["R5"]

        self.assertEqual(l6["defaultConsentTier"], "C8")
        self.assertGreaterEqual(l6["minimumCohortSize"], 100)
        self.assertTrue(c8["separatePromptRequired"])
        self.assertTrue(c8["monetizationLedgerRequired"])
        self.assertTrue(c8["revocable"])
        self.assertTrue(r5["reidentificationReviewRequired"])

    def test_prohibited_data_class_remains_blocked(self) -> None:
        l7 = self.data_classes["L7"]
        self.assertFalse(l7["allowed"])
        self.assertIn("hidden_collection", l7["examples"])
        self.assertIn("small_cohort_sensitive_sale", l7["examples"])

    def test_required_user_rights_consent_tiers_are_not_revocable_processing_gates(self) -> None:
        self.assertFalse(self.consent_tiers["C0"]["revocable"])
        self.assertFalse(self.consent_tiers["C7"]["revocable"])
        self.assertIn("Export", self.consent_tiers["C7"]["name"])
        self.assertIn("Portability", self.consent_tiers["C7"]["name"])


if __name__ == "__main__":
    unittest.main()
