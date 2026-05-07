"""Regression tests for JSON Schema contract guardrails."""

from __future__ import annotations

import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / "schemas"


class SchemaContractTests(unittest.TestCase):
    def load_schema(self, name: str) -> dict:
        return json.loads((SCHEMAS / name).read_text(encoding="utf-8"))

    def test_feature_manifest_requires_core_governance_sections(self) -> None:
        schema = self.load_schema("feature-privacy-manifest.schema.json")
        required = set(schema["required"])

        expected = {
            "feature",
            "repo",
            "owner",
            "privacyGovernanceVersion",
            "status",
            "lastReviewed",
            "dataProcessing",
            "userRights",
            "adminAccess",
            "monetization",
            "review",
        }
        self.assertTrue(expected.issubset(required), required)
        self.assertFalse(schema["additionalProperties"])

    def test_feature_manifest_field_contracts_reject_unknown_policy_ids(self) -> None:
        schema = self.load_schema("feature-privacy-manifest.schema.json")
        defs = schema["$defs"]

        self.assertEqual(defs["dataClass"]["enum"], [f"L{i}" for i in range(8)])
        self.assertEqual(defs["consentTier"]["enum"], [f"C{i}" for i in range(9)])
        self.assertEqual(defs["retentionClass"]["enum"], [f"R{i}" for i in range(7)])
        self.assertEqual(defs["source"]["enum"], ["user", "device", "system", "model", "admin", "partner"])

    def test_feature_manifest_requires_user_rights_admin_and_monetization_controls(self) -> None:
        schema = self.load_schema("feature-privacy-manifest.schema.json")
        properties = schema["properties"]

        self.assertEqual(
            set(properties["userRights"]["required"]),
            {"exportSupported", "deletionSupported", "consentRevocationSupported", "explanationSupported"},
        )
        self.assertEqual(set(properties["adminAccess"]["required"]), {"allowed", "roles", "auditEventTypes"})
        self.assertEqual(
            set(properties["monetization"]["required"]),
            {"participatesInDataSharing", "requiresC8Consent", "anonymizationBatchRequired", "minimumCohortSize"},
        )
        self.assertEqual(properties["monetization"]["properties"]["minimumCohortSize"]["minimum"], 0)

    def test_feature_manifest_collected_and_derived_fields_require_privacy_metadata(self) -> None:
        schema = self.load_schema("feature-privacy-manifest.schema.json")
        defs = schema["$defs"]

        self.assertEqual(
            set(defs["collectedField"]["required"]),
            {
                "name",
                "dataClass",
                "source",
                "purpose",
                "consentTier",
                "retentionClass",
                "exportable",
                "deletable",
                "auditRequired",
            },
        )
        self.assertEqual(
            set(defs["derivedField"]["required"]),
            {
                "name",
                "dataClass",
                "sourceFields",
                "purpose",
                "consentTier",
                "retentionClass",
                "explainabilityRequired",
            },
        )
        self.assertFalse(defs["collectedField"]["additionalProperties"])
        self.assertFalse(defs["derivedField"]["additionalProperties"])

    def test_data_inventory_requires_field_level_rights_and_access_metadata(self) -> None:
        schema = self.load_schema("data-inventory.schema.json")
        field = schema["$defs"]["inventoryField"]

        expected_required = {
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
        self.assertEqual(set(field["required"]), expected_required)
        self.assertFalse(schema["additionalProperties"])
        self.assertFalse(field["additionalProperties"])
        self.assertGreaterEqual(schema["properties"]["fields"]["minItems"], 1)

    def test_schema_versions_remain_pinned_to_current_draft(self) -> None:
        for name in ["feature-privacy-manifest.schema.json", "data-inventory.schema.json"]:
            with self.subTest(schema=name):
                schema = self.load_schema(name)
                self.assertEqual(schema["properties"]["privacyGovernanceVersion"]["const"], "0.1.0-draft")


if __name__ == "__main__":
    unittest.main()
