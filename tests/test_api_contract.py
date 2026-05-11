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

    def schemas(self) -> dict:
        return self.contract["components"]["schemas"]

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

    def test_mutating_endpoints_require_json_request_bodies(self) -> None:
        expected_refs = {
            ("/consent", "post"): "#/components/schemas/ConsentEventRequest",
            ("/requests/export", "post"): "#/components/schemas/ExportRequest",
            ("/requests/delete", "post"): "#/components/schemas/DeletionRequest",
            ("/data-sharing/opt-out", "post"): "#/components/schemas/DataSharingOptOutRequest",
        }
        paths = self.contract["paths"]
        for (path, method), schema_ref in expected_refs.items():
            with self.subTest(path=path, method=method):
                request_body = paths[path][method]["requestBody"]
                self.assertTrue(request_body["required"])
                self.assertEqual(
                    request_body["content"]["application/json"]["schema"]["$ref"],
                    schema_ref,
                )

    def test_user_rights_endpoints_return_async_acceptance(self) -> None:
        paths = self.contract["paths"]
        for path in ["/requests/export", "/requests/delete", "/data-sharing/opt-out"]:
            with self.subTest(path=path):
                response = paths[path]["post"]["responses"]["202"]
                self.assertEqual(
                    response["content"]["application/json"]["schema"]["$ref"],
                    "#/components/schemas/UserRightsRequestResponse",
                )

    def test_audit_and_explanation_endpoints_return_successful_reads(self) -> None:
        paths = self.contract["paths"]
        self.assertEqual(
            paths["/audit/history"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"],
            "#/components/schemas/AuditHistoryResponse",
        )
        self.assertEqual(
            paths["/explain/{insightId}"]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"],
            "#/components/schemas/InsightExplanationResponse",
        )

    def test_explanation_endpoint_requires_insight_id_path_parameter(self) -> None:
        parameters = self.contract["paths"]["/explain/{insightId}"]["get"]["parameters"]
        self.assertEqual(len(parameters), 1)
        parameter = parameters[0]
        self.assertEqual(parameter["name"], "insightId")
        self.assertEqual(parameter["in"], "path")
        self.assertTrue(parameter["required"])
        self.assertEqual(parameter["schema"]["type"], "string")

    def test_core_enums_remain_complete(self) -> None:
        schemas = self.schemas()
        self.assertEqual(schemas["ConsentTier"]["enum"], [f"C{i}" for i in range(9)])
        self.assertEqual(schemas["DataClass"]["enum"], [f"L{i}" for i in range(8)])
        self.assertEqual(schemas["ConsentStatus"]["enum"], ["granted", "denied", "revoked", "expired"])
        self.assertEqual(
            schemas["RequestStatus"]["enum"],
            ["received", "validated", "queued", "processing", "completed", "failed", "cancelled"],
        )
        self.assertEqual(schemas["PolicyVersion"]["const"], "0.1.0-draft")

    def test_request_schemas_reject_unknown_properties_and_pin_policy_version(self) -> None:
        schemas = self.schemas()
        for schema_name in ["ConsentEventRequest", "ExportRequest", "DeletionRequest", "DataSharingOptOutRequest"]:
            with self.subTest(schema=schema_name):
                schema = schemas[schema_name]
                self.assertFalse(schema["additionalProperties"])
                self.assertIn("policyVersion", schema["required"])
                self.assertEqual(schema["properties"]["policyVersion"]["$ref"], "#/components/schemas/PolicyVersion")

    def test_user_rights_request_response_requires_async_tracking_fields(self) -> None:
        schema = self.schemas()["UserRightsRequestResponse"]
        self.assertFalse(schema["additionalProperties"])
        self.assertEqual(set(schema["required"]), {"requestId", "status", "receivedAt", "policyVersion"})
        self.assertEqual(schema["properties"]["status"]["$ref"], "#/components/schemas/RequestStatus")

    def test_audit_and_explanation_schemas_keep_user_visible_privacy_metadata(self) -> None:
        schemas = self.schemas()
        audit_event = schemas["AuditHistoryEvent"]
        explanation = schemas["InsightExplanationResponse"]

        self.assertEqual(
            set(audit_event["required"]),
            {"eventId", "userId", "eventType", "actorType", "occurredAt", "summary", "policyVersion"},
        )
        self.assertFalse(audit_event["additionalProperties"])
        self.assertEqual(audit_event["properties"]["actorType"]["enum"], ["user", "admin", "system"])

        self.assertEqual(
            set(explanation["required"]),
            {"insightId", "userId", "summary", "sourceFields", "dataClasses", "consentTiers", "generatedAt", "policyVersion"},
        )
        self.assertFalse(explanation["additionalProperties"])
        self.assertEqual(explanation["properties"]["dataClasses"]["items"]["$ref"], "#/components/schemas/DataClass")
        self.assertEqual(explanation["properties"]["consentTiers"]["items"]["$ref"], "#/components/schemas/ConsentTier")


if __name__ == "__main__":
    unittest.main()
