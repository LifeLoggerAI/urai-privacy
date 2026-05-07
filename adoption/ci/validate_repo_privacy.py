#!/usr/bin/env python3
"""Validate a URAI product repo privacy adoption folder.

This script is meant to be copied into product repos as:

    tools/validate_repo_privacy.py

It validates the local `privacy/` folder against URAI Privacy governance version 0.1.0-draft.
"""

from pathlib import Path
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    print("[repo-privacy] FAIL: PyYAML is required")
    sys.exit(1)

ROOT = Path.cwd()
PRIVACY_DIR = ROOT / "privacy"

DATA_CLASSES = {"L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7"}
CONSENT_TIERS = {"C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"}
RETENTION_CLASSES = {"R0", "R1", "R2", "R3", "R4", "R5", "R6"}
GOVERNANCE_VERSION = "0.1.0-draft"


def fail(message: str) -> None:
    print(f"[repo-privacy] FAIL: {message}")
    sys.exit(1)


def load_yaml(path: Path):
    try:
        return yaml.safe_load(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        fail(f"Invalid YAML in {path}: {exc}")


def validate_field(path: Path, field: dict) -> list[str]:
    errors: list[str] = []
    name = field.get("name", "<unnamed>")
    data_class = field.get("dataClass")
    consent_tier = field.get("consentTier")
    retention_class = field.get("retentionClass")

    if data_class not in DATA_CLASSES:
        errors.append(f"{path}: {name} has unknown dataClass {data_class}")
    if consent_tier not in CONSENT_TIERS:
        errors.append(f"{path}: {name} has unknown consentTier {consent_tier}")
    if retention_class not in RETENTION_CLASSES:
        errors.append(f"{path}: {name} has unknown retentionClass {retention_class}")

    required_by_class = {
        "L1": "C0",
        "L2": "C2",
        "L3": "C1",
        "L4": "C4",
        "L5": "C5",
        "L6": "C8",
    }
    required_tier = required_by_class.get(data_class)
    if required_tier and consent_tier != required_tier:
        errors.append(f"{path}: {name} {data_class} requires {required_tier}, got {consent_tier}")

    if data_class == "L5" and retention_class != "R6":
        errors.append(f"{path}: {name} L5 biometric fields require R6 retention")

    if data_class == "L7":
        errors.append(f"{path}: {name} L7 restricted/prohibited data is not allowed")

    return errors


def validate_data_inventory() -> list[str]:
    path = PRIVACY_DIR / "data-inventory.yaml"
    if not path.exists():
        return ["privacy/data-inventory.yaml is required"]

    data = load_yaml(path)
    errors: list[str] = []

    if data.get("privacyGovernanceVersion") != GOVERNANCE_VERSION:
        errors.append("data-inventory.yaml must use privacyGovernanceVersion 0.1.0-draft")

    fields = data.get("fields") or []
    if not fields:
        errors.append("data-inventory.yaml must declare at least one field")

    for field in fields:
        errors.extend(validate_field(path, field))

    return errors


def collect_manifest_fields(manifest: dict) -> list[dict]:
    processing = manifest.get("dataProcessing") or {}
    return list(processing.get("collectedFields") or []) + list(processing.get("derivedFields") or [])


def validate_feature_manifest(path: Path) -> list[str]:
    manifest = load_yaml(path)
    errors: list[str] = []

    if manifest.get("privacyGovernanceVersion") != GOVERNANCE_VERSION:
        errors.append(f"{path}: privacyGovernanceVersion must be {GOVERNANCE_VERSION}")

    fields = collect_manifest_fields(manifest)
    if not fields:
        errors.append(f"{path}: must declare at least one collected or derived field")

    for field in fields:
        errors.extend(validate_field(path, field))

    user_rights = manifest.get("userRights") or {}
    if any(field.get("dataClass") in {"L3", "L4", "L5"} for field in fields):
        if user_rights.get("deletionSupported") is not True:
            errors.append(f"{path}: L3-L5 features require deletionSupported=true")
        if user_rights.get("consentRevocationSupported") is not True:
            errors.append(f"{path}: L3-L5 features require consentRevocationSupported=true")

    monetization = manifest.get("monetization") or {}
    participates = monetization.get("participatesInDataSharing") is True
    has_l6 = any(field.get("dataClass") == "L6" for field in fields)
    if participates or has_l6:
        if monetization.get("requiresC8Consent") is not True:
            errors.append(f"{path}: data-sharing requires requiresC8Consent=true")
        if monetization.get("anonymizationBatchRequired") is not True:
            errors.append(f"{path}: data-sharing requires anonymizationBatchRequired=true")
        if int(monetization.get("minimumCohortSize") or 0) < 100:
            errors.append(f"{path}: data-sharing requires minimumCohortSize >= 100")

    return errors


def validate_feature_manifests() -> list[str]:
    manifest_dir = PRIVACY_DIR / "feature-manifests"
    if not manifest_dir.exists():
        return ["privacy/feature-manifests/ directory is required"]

    manifests = sorted(manifest_dir.glob("*.privacy.yaml"))
    if not manifests:
        return ["At least one privacy feature manifest is required"]

    errors: list[str] = []
    for path in manifests:
        errors.extend(validate_feature_manifest(path))
    return errors


def main() -> None:
    if not PRIVACY_DIR.exists():
        fail("privacy/ folder is required")

    version_path = PRIVACY_DIR / "PRIVACY_VERSION.md"
    if not version_path.exists():
        fail("privacy/PRIVACY_VERSION.md is required")
    if GOVERNANCE_VERSION not in version_path.read_text(encoding="utf-8"):
        fail("privacy/PRIVACY_VERSION.md must reference 0.1.0-draft")

    errors = []
    errors.extend(validate_data_inventory())
    errors.extend(validate_feature_manifests())

    if errors:
        for error in errors:
            print(f"[repo-privacy] FAIL: {error}")
        sys.exit(1)

    print("[repo-privacy] OK: privacy adoption folder validated")


if __name__ == "__main__":
    main()
