"""Regression tests for the URAI Privacy OpenAPI contract."""

from __future__ import annotations

from pathlib import Path
import unittest

import yaml

ROOT = Path(__file__).resolve().parents[1]
API_CONTRACT = ROOT / "api" / "privacy-api.yaml"


class PrivacyApiContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.contract = yaml.safe_load(API_CONTRACT.read_text(encoding="utf-8"))

    def test_contract_version_and_description_stay_aligned(self) -> None:
        self.assertEqual(self.contract["openapi"], "3.1.0")
        self.assertEqual(self.contract["info"]["version"], "0.1.0-draft")
        self.assertIn("consent", self.contract["info"]["description"])
        self.assertIn("user rights", self.contract["info"]["description"])
        self.assertIn("data-sharing controls", self.contract["info"]["description"])

    def test_required_privacy_paths_remain_present(self) -> None:
        paths = self.contract["paths"]
        expected_paths = {
            "/consent",
            "/requests/export",
            "/requests/delete",
            "/data-sharing/opt-out",
            "/audit/history",
            "/explain/{insightId}",
        }
        self.assertTrue(expected_paths.issubset(paths.keys()), paths.keys())

    def test_required_operation_ids_remain_stable(self) -> None:
        paths = self.contract["paths"]
        expected_operations = {
            ("/consent", "get", "getConsentState"),
            ("/consent", "post", "recordConsentEvent"),
            ("/requests/export", "post", "requestDataExport"),
            ("/requests/delete", "post", "requestDeletion"),
            ("/data-sharing/opt-out", "post", "optOutOfDataSharing"),
            ("/audit/history", "get", "getPrivacyAuditHistory"),
            ("/explain/{insightId}", "get", "explainInsight"),
        }
        for path, method, operation_id in expected_operations:
            with self.subTest(path=path, method=method):
                self.assertEqual(paths[path][method]["operationId"], operation_id)

    def test_user_rights_endpoints_return_async_acceptance(self) -> None:
        paths = self.contract["paths"]
        for path in ["/requests/export", "/requests/delete", "/data-sharing/opt-out"]:
            with self.subTest(path=path):
                self.assertIn("202", paths[path]["post"]["responses"])

    def test_audit_and_explanation_endpoints_return_successful_reads(self) -> None:
        paths = self.contract["paths"]
        self.assertIn("200", paths["/audit/history"]["get"]["responses"])
        self.assertIn("200", paths["/explain/{insightId}"]["get"]["responses"])

    def test_explanation_endpoint_requires_insight_id_path_parameter(self) -> None:
        parameters = self.contract["paths"]["/explain/{insightId}"]["get"]["parameters"]
        self.assertEqual(len(parameters), 1)
        parameter = parameters[0]
        self.assertEqual(parameter["name"], "insightId")
        self.assertEqual(parameter["in"], "path")
        self.assertTrue(parameter["required"])
        self.assertEqual(parameter["schema"]["type"], "string")

    def test_core_enums_remain_complete(self) -> None:
        schemas = self.contract["components"]["schemas"]
        self.assertEqual(schemas["ConsentTier"]["enum"], [f"C{i}" for i in range(9)])
        self.assertEqual(schemas["ConsentStatus"]["enum"], ["granted", "denied", "revoked", "expired"])
        self.assertEqual(
            schemas["RequestStatus"]["enum"],
            ["received", "validated", "queued", "processing", "completed", "failed", "cancelled"],
        )


if __name__ == "__main__":
    unittest.main()
