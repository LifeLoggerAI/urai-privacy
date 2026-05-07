#!/usr/bin/env python3
"""Validate the URAI privacy governance package structure."""

from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = [
    "README.md",
    "VERSION.md",
    "CHANGELOG.md",
    "docs/GOVERNANCE_INDEX.md",
    "docs/DATA_CLASSIFICATION.md",
    "docs/DATA_COLLECTION_BOUNDARIES.md",
    "docs/CONSENT_TIERS.md",
    "docs/RETENTION_AND_DELETION.md",
    "docs/DATA_EXPORT_STANDARD.md",
    "docs/ANONYMIZATION_STANDARD.md",
    "docs/REGULATORY_ALIGNMENT.md",
    "docs/INCIDENT_RESPONSE.md",
    "docs/AUDIT_LOGGING_STANDARD.md",
    "docs/PRIVACY_REVIEW_CHECKLIST.md",
    "docs/DPIA_TEMPLATE.md",
    "docs/LAW_ENFORCEMENT_REQUEST_POLICY.md",
    "docs/VENDOR_AND_PROCESSOR_REVIEW.md",
    "schemas/firestore-privacy-schema.json",
    "api/privacy-api.yaml",
    "legal/PRIVACY_POLICY_TEMPLATE.md",
    "legal/BIOMETRIC_AND_AI_INFERENCE_NOTICE_TEMPLATE.md",
    "adoption/ADOPTION_GUIDE.md",
    "adoption/REPO_ROLLOUT_PLAN.md",
    "adoption/templates/PRIVACY_VERSION.md",
    "adoption/templates/data-inventory.yaml",
    "adoption/templates/feature.privacy.yaml",
    "adoption/templates/privacy-review-record.md",
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/privacy_gap.md",
]

REQUIRED_TERMS = {
    "docs/CONSENT_TIERS.md": ["C0", "C4", "C5", "C8", "revoked"],
    "docs/DATA_CLASSIFICATION.md": ["L4", "L5", "L6", "Default Deny"],
    "docs/RETENTION_AND_DELETION.md": ["R0", "R6", "derived", "biometric"],
    "docs/ANONYMIZATION_STANDARD.md": ["cohort", "re-identification", "opt"],
    "docs/AUDIT_LOGGING_STANDARD.md": ["Consent", "Admin", "audit"],
    "adoption/templates/feature.privacy.yaml": ["dataProcessing", "consentTier", "retentionClass", "deletionSupported"],
    ".github/pull_request_template.md": ["Privacy Impact", "No silent escalation", "Validator passes"],
    "docs/DPIA_TEMPLATE.md": ["Risk Assessment", "Safeguards", "Decision"],
    "docs/VENDOR_AND_PROCESSOR_REVIEW.md": ["Vendor Risk Levels", "data classes", "deletion support"],
}


def fail(message: str) -> None:
    print(f"[privacy-package] FAIL: {message}")
    sys.exit(1)


def main() -> None:
    missing = [path for path in REQUIRED_FILES if not (ROOT / path).exists()]
    if missing:
        fail("Missing required files: " + ", ".join(missing))

    for path, terms in REQUIRED_TERMS.items():
        text = (ROOT / path).read_text(encoding="utf-8")
        missing_terms = [term for term in terms if term not in text]
        if missing_terms:
            fail(f"{path} missing required terms: {', '.join(missing_terms)}")

    schema_path = ROOT / "schemas/firestore-privacy-schema.json"
    try:
        schema = json.loads(schema_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"Invalid JSON schema: {exc}")

    if schema.get("version") != "0.1.0-draft":
        fail("Schema version must match 0.1.0-draft")

    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    if "Release Gate" not in readme:
        fail("README must document the release gate")

    print("[privacy-package] OK: governance package structure validated")


if __name__ == "__main__":
    main()
