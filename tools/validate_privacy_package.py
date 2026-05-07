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
    "schemas/firestore-privacy-schema.json",
    "api/privacy-api.yaml",
    "legal/PRIVACY_POLICY_TEMPLATE.md",
    "legal/BIOMETRIC_AND_AI_INFERENCE_NOTICE_TEMPLATE.md",
]

REQUIRED_TERMS = {
    "docs/CONSENT_TIERS.md": ["C0", "C4", "C5", "C8", "revoked"],
    "docs/DATA_CLASSIFICATION.md": ["L4", "L5", "L6", "Default Deny"],
    "docs/RETENTION_AND_DELETION.md": ["R0", "R6", "derived", "biometric"],
    "docs/ANONYMIZATION_STANDARD.md": ["cohort", "re-identification", "opt"],
    "docs/AUDIT_LOGGING_STANDARD.md": ["Consent", "Admin", "audit"],
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

    print("[privacy-package] OK: governance package structure validated")


if __name__ == "__main__":
    main()
