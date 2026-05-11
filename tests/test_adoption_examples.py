"""Regression tests for downstream product repo adoption examples."""

from __future__ import annotations

from pathlib import Path
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]
EXAMPLES = ROOT / "adoption" / "examples"


class AdoptionExamplesTests(unittest.TestCase):
    def example_dirs(self) -> list[Path]:
        return [
            EXAMPLES / "admin-repo",
            EXAMPLES / "analytics-repo",
            EXAMPLES / "product-app-repo",
        ]

    def load_yaml(self, path: Path) -> dict:
        return yaml.safe_load(path.read_text(encoding="utf-8"))

    def test_expected_example_repos_exist(self) -> None:
        for example_dir in self.example_dirs():
            with self.subTest(example=example_dir.name):
                self.assertTrue((example_dir / "PRIVACY_VERSION.md").exists())
                self.assertTrue((example_dir / "data-inventory.yaml").exists())
                self.assertTrue((example_dir / "feature-manifests").is_dir())
                self.assertGreater(len(list((example_dir / "feature-manifests").glob("*.privacy.yaml"))), 0)

    def test_examples_pin_current_governance_version(self) -> None:
        for example_dir in self.example_dirs():
            with self.subTest(example=example_dir.name):
                inventory = self.load_yaml(example_dir / "data-inventory.yaml")
                self.assertEqual(inventory["privacyGovernanceVersion"], "0.1.0-draft")
                version_text = (example_dir / "PRIVACY_VERSION.md").read_text(encoding="utf-8")
                self.assertIn("0.1.0-draft", version_text)

    def test_data_inventories_include_required_field_controls(self) -> None:
        required_keys = {
            "name",
            "collectionOrTable",
            "source",
            "dataClass",
            "purpose",
            "consentTier",
            "retentionClass",
            "exportable",
            "deletable",
            "monetizable",
            "aiTrainingAllowed",
            "adminAccessible",
            "auditRequired",
        }
        for example_dir in self.example_dirs():
            inventory = self.load_yaml(example_dir / "data-inventory.yaml")
            for field in inventory["fields"]:
                with self.subTest(example=example_dir.name, field=field.get("name")):
                    self.assertTrue(required_keys.issubset(field.keys()))

    def test_admin_example_keeps_admin_access_and_audit_controls_visible(self) -> None:
        manifest = self.load_yaml(EXAMPLES / "admin-repo" / "feature-manifests" / "admin-audit-access.privacy.yaml")
        self.assertTrue(manifest["adminAccess"]["allowed"])
        self.assertIn("privacy-admin", manifest["adminAccess"]["roles"])
        self.assertIn("admin.user_data_accessed", manifest["adminAccess"]["auditEventTypes"])
        self.assertFalse(manifest["monetization"]["participatesInDataSharing"])

    def test_analytics_example_keeps_c8_and_cohort_controls_visible(self) -> None:
        manifest = self.load_yaml(
            EXAMPLES / "analytics-repo" / "feature-manifests" / "anonymized-cohort-analytics.privacy.yaml"
        )
        self.assertTrue(manifest["monetization"]["participatesInDataSharing"])
        self.assertTrue(manifest["monetization"]["requiresC8Consent"])
        self.assertTrue(manifest["monetization"]["anonymizationBatchRequired"])
        self.assertGreaterEqual(manifest["monetization"]["minimumCohortSize"], 100)
        self.assertEqual(manifest["dataProcessing"]["derivedFields"][0]["consentTier"], "C8")

    def test_product_app_example_keeps_sensitive_inference_controls_visible(self) -> None:
        manifest = self.load_yaml(EXAMPLES / "product-app-repo" / "feature-manifests" / "journal-insight.privacy.yaml")
        derived = manifest["dataProcessing"]["derivedFields"][0]
        self.assertEqual(derived["dataClass"], "L4")
        self.assertEqual(derived["consentTier"], "C4")
        self.assertTrue(derived["explainabilityRequired"])
        self.assertTrue(manifest["userRights"]["deletionSupported"])
        self.assertTrue(manifest["userRights"]["consentRevocationSupported"])
        self.assertTrue(manifest["userRights"]["explanationSupported"])


if __name__ == "__main__":
    unittest.main()
