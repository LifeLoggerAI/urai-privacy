#!/usr/bin/env python3
"""Validate the URAI privacy governance package and policy registry."""

from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

try:
    from jsonschema import Draft202012Validator
except ImportError:  # pragma: no cover
    Draft202012Validator = None

REQUIRED_FILES = [
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "SUPPORT.md",
    "GOVERNANCE.md",
    "VERSION.md",
    "CHANGELOG.md",
    "RELEASE_PROCESS.md",
    "MIGRATION_GUIDE.md",
    "POLICY_VERSIONING.md",
    "LAUNCH_READINESS.md",
    ".gitignore",
    "CNAME",
    "website/CNAME",
    "website/.nojekyll",
    "website/index.html",
    "website/principles.html",
    "website/rights.html",
    "website/governance.html",
    "website/legal.html",
    "website/contact.html",
    "website/status.html",
    "website/404.html",
    "website/styles.css",
    "website/robots.txt",
    "website/sitemap.xml",
    "website/README.md",
    "website/PUBLISHING.md",
    "tools/check_website.py",
    "tools/check_secrets.py",
    "architecture/README.md",
    "architecture/CONSENT_LIFECYCLE.md",
    "architecture/DELETION_LIFECYCLE.md",
    "architecture/EXPORT_LIFECYCLE.md",
    "architecture/ANONYMIZATION_DATA_SHARING_LIFECYCLE.md",
    "architecture/AUDIT_LIFECYCLE.md",
    "architecture/INCIDENT_RESPONSE_LIFECYCLE.md",
    "sops/README.md",
    "sops/ADMIN_ACCESS_APPROVAL.md",
    "sops/BREAK_GLASS_ACCESS.md",
    "sops/AUDIT_REVIEW_CADENCE.md",
    "sops/EMPLOYEE_ACCESS_REMOVAL.md",
    "sops/INCIDENT_ESCALATION_MATRIX.md",
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
    "docs/SECURITY_PRIVACY_REVIEW.md",
    "schemas/firestore-privacy-schema.json",
    "schemas/data-inventory.schema.json",
    "schemas/feature-privacy-manifest.schema.json",
    "api/privacy-api.yaml",
    "legal/PRIVACY_POLICY_TEMPLATE.md",
    "legal/BIOMETRIC_AND_AI_INFERENCE_NOTICE_TEMPLATE.md",
    "legal/TERMS_PRIVACY_CLAUSES_TEMPLATE.md",
    "legal/DATA_SHARING_NOTICE_TEMPLATE.md",
    "legal/CHILDREN_AND_MINOR_PRIVACY_POLICY.md",
    "legal/COOKIE_AND_LOCAL_STORAGE_NOTICE.md",
    "legal/TRANSPARENCY_REPORT_TEMPLATE.md",
    "legal/USER_RIGHTS_REQUEST_NOTICE.md",
    "adoption/ADOPTION_GUIDE.md",
    "adoption/REPO_ROLLOUT_PLAN.md",
    "adoption/templates/PRIVACY_VERSION.md",
    "adoption/templates/data-inventory.yaml",
    "adoption/templates/feature.privacy.yaml",
    "adoption/templates/privacy-review-record.md",
    "adoption/ci/README.md",
    "adoption/ci/validate_repo_privacy.py",
    "adoption/ci/privacy-adoption-workflow.yml",
    "adoption/ci/sample-privacy-folder/PRIVACY_VERSION.md",
    "adoption/ci/sample-privacy-folder/data-inventory.yaml",
    "adoption/ci/sample-privacy-folder/feature-manifests/mood-weather.privacy.yaml",
    "policy/data-classes.yaml",
    "policy/consent-tiers.yaml",
    "policy/retention-classes.yaml",
    "policy/audit-event-types.yaml",
    "policy/blocked-data-uses.yaml",
    "examples/valid-feature.privacy.yaml",
    "tests/fixtures/invalid-sensitive-without-c4.privacy.yaml",
    "tests/fixtures/invalid-biometric-without-c5.privacy.yaml",
    "tests/fixtures/invalid-data-sharing-without-c8.privacy.yaml",
    "tests/test_privacy_validators.py",
    "tests/test_website_e2e.py",
    ".github/CODEOWNERS",
    ".github/dependabot.yml",
    ".github/pull_request_template.md",
    ".github/workflows/pages.yml",
    ".github/workflows/privacy-package.yml",
    ".github/workflows/website.yml",
    ".github/ISSUE_TEMPLATE/privacy_gap.md",
    ".github/ISSUE_TEMPLATE/adoption_rollout.md",
    ".github/ISSUE_TEMPLATE/dpia_review.md",
    ".github/ISSUE_TEMPLATE/vendor_review.md",
    ".github/ISSUE_TEMPLATE/release_tracking.md",
    ".github/ISSUE_TEMPLATE/legal_review.md",
]

REQUIRED_TERMS = {
    "README.md": ["https://uraiprivacy.com", "website/", "policy/", "check_secrets.py", "unittest"],
    "CONTRIBUTING.md": ["Contribution Rules", "Sensitive Change Areas", "Legal Review"],
    "SECURITY.md": ["Reporting Security or Privacy Issues", "High-Risk Report Categories", "S0-S4"],
    "SUPPORT.md": ["https://uraiprivacy.com", "What to Open as a GitHub Issue", "What Not to Open Publicly"],
    "GOVERNANCE.md": ["Governance Principles", "Decision Bias", "Prohibited Governance Patterns"],
    ".gitignore": [".env", "*.pem", "node_modules/"],
    "schemas/data-inventory.schema.json": ["URAI Privacy Data Inventory", "privacyGovernanceVersion", "L0", "C8", "R6"],
    "schemas/feature-privacy-manifest.schema.json": ["URAI Privacy Feature Manifest", "dataProcessing", "userRights", "monetization"],
    "RELEASE_PROCESS.md": ["Release Requirements", "Release Steps", "privacy-vX.Y.Z"],
    "MIGRATION_GUIDE.md": ["Migration Checklist", "Breaking-Change Examples", "Rollback"],
    "POLICY_VERSIONING.md": ["MAJOR.MINOR.PATCH", "Version Adoption", "Legal Review Marker"],
    "LAUNCH_READINESS.md": ["Governance Package", "Website and Public Notices", "Product Repo Adoption", "Launch Decision"],
    ".github/CODEOWNERS": ["@LifeLoggerAI", "/policy/", "/legal/"],
    ".github/dependabot.yml": ["package-ecosystem", "pip", "github-actions", "security"],
    ".github/workflows/pages.yml": ["Deploy URAI Privacy website", "actions/deploy-pages", "path: website"],
    ".github/workflows/privacy-package.yml": ["Privacy package validation", "check_secrets.py", "unittest discover", "validate_privacy_package.py"],
    ".github/workflows/website.yml": ["Website validation", "check_website.py"],
    ".github/ISSUE_TEMPLATE/adoption_rollout.md": ["Privacy adoption rollout", "privacy/PRIVACY_VERSION.md", "L6/data-sharing uses C8"],
    ".github/ISSUE_TEMPLATE/dpia_review.md": ["DPIA review", "Sensitive AI inference", "Decision"],
    ".github/ISSUE_TEMPLATE/vendor_review.md": ["Vendor / processor review", "Risk Level", "Data Classes"],
    ".github/ISSUE_TEMPLATE/release_tracking.md": ["Privacy release tracking", "VERSION.md", "Product Repo Adoption"],
    ".github/ISSUE_TEMPLATE/legal_review.md": ["Legal review", "Review Trigger", "Needs external counsel"],
    "website/index.html": ["URAI Privacy", "canonical", "./styles.css", "principles.html", "rights.html", "governance.html", "legal.html", "contact.html", "status.html"],
    "website/principles.html": ["Privacy is not a feature", "Default decision bias", "./styles.css"],
    "website/rights.html": ["User rights", "Data export", "Consent Revocation", "./styles.css"],
    "website/governance.html": ["The repo is built to be enforceable", "Policy registry", "Release gate", "./styles.css"],
    "website/legal.html": ["Legal notices", "Privacy policy", "Data-sharing notice", "qualified counsel"],
    "website/contact.html": ["Contact", "privacy@urai.app", "security@urai.app", "Do not post sensitive data publicly"],
    "website/status.html": ["Status", "Operational governance draft", "Launch blockers to clear"],
    "website/404.html": ["Page not found", "Return home", "Report a broken link"],
    "website/styles.css": ["--accent", "site-header", "card-grid", "site-footer", "focus-visible", "prefers-reduced-motion"],
    "website/robots.txt": ["Sitemap: https://uraiprivacy.com/sitemap.xml"],
    "website/sitemap.xml": ["https://uraiprivacy.com/", "principles.html", "status.html"],
    "website/README.md": ["Pages", "Static Files", "GitHub Pages"],
    "website/PUBLISHING.md": ["GitHub Pages Setup", "DNS Notes", "Pre-Publish Checklist"],
    "tools/check_website.py": ["Static health checks", "REQUIRED_PAGES", "sitemap"],
    "tools/check_secrets.py": ["Lightweight repository secret scanner", "GitHub token", "Private key block"],
    "tests/test_privacy_validators.py": ["Regression tests", "FeatureManifestValidationTests", "SecretScannerTests"],
    "tests/test_website_e2e.py": ["Static end-to-end smoke tests", "WebsiteStaticE2ETests", "404 edge path"],
    "architecture/README.md": ["Consent Lifecycle", "Deletion Lifecycle", "Export Lifecycle"],
    "architecture/CONSENT_LIFECYCLE.md": ["flowchart TD", "consent.changed", "Revocation"],
    "architecture/DELETION_LIFECYCLE.md": ["flowchart TD", "deletionJobs", "derived_records_deleted_or_recomputed"],
    "architecture/EXPORT_LIFECYCLE.md": ["flowchart TD", "exportJobs", "Integrity manifest"],
    "architecture/ANONYMIZATION_DATA_SHARING_LIFECYCLE.md": ["flowchart TD", "C8", "minimum cohort"],
    "architecture/AUDIT_LIFECYCLE.md": ["flowchart TD", "dataAccessLogs", "append-only"],
    "architecture/INCIDENT_RESPONSE_LIFECYCLE.md": ["flowchart TD", "incidentReports", "Postmortem"],
    "sops/README.md": ["Admin Access Approval", "Break-Glass Access", "Audit Review Cadence"],
    "sops/ADMIN_ACCESS_APPROVAL.md": ["Approval Requirements", "Curiosity access is prohibited", "admin.user_data_accessed"],
    "sops/BREAK_GLASS_ACCESS.md": ["When Allowed", "When Not Allowed", "post-access review"],
    "sops/AUDIT_REVIEW_CADENCE.md": ["Review Cadence", "Required Review Questions", "Escalation"],
    "sops/EMPLOYEE_ACCESS_REMOVAL.md": ["Required Removal Checklist", "High-Risk Access", "credential"],
    "sops/INCIDENT_ESCALATION_MATRIX.md": ["Severity Matrix", "Escalation Triggers", "Required First Hour Actions"],
    "adoption/ci/README.md": ["Cross-Repo Privacy CI Enforcement", "validate_repo_privacy.py", "privacy/"],
    "adoption/ci/validate_repo_privacy.py": ["Validate a URAI product repo privacy adoption folder", "jsonschema", "minimumCohortSize"],
    "adoption/ci/privacy-adoption-workflow.yml": ["Privacy adoption validation", "validate_repo_privacy.py", "PyYAML"],
    "adoption/ci/sample-privacy-folder/PRIVACY_VERSION.md": ["0.1.0-draft", "LifeLoggerAI/urai-privacy"],
    "adoption/ci/sample-privacy-folder/data-inventory.yaml": ["privacyGovernanceVersion", "L4", "C4"],
    "adoption/ci/sample-privacy-folder/feature-manifests/mood-weather.privacy.yaml": ["mood-weather-report", "deletionSupported", "consentRevocationSupported"],
    "legal/TERMS_PRIVACY_CLAUSES_TEMPLATE.md": ["User Consent", "User Control", "Sensitive AI Inference", "Data-Sharing Restrictions"],
    "legal/DATA_SHARING_NOTICE_TEMPLATE.md": ["Separate Opt-In Required", "What Must Not Be Shared", "Cohort and Re-Identification Controls", "Opt-Out"],
    "legal/CHILDREN_AND_MINOR_PRIVACY_POLICY.md": ["Current Position", "Default Restrictions", "Consent and Guardian Controls", "Launch Requirement"],
    "legal/COOKIE_AND_LOCAL_STORAGE_NOTICE.md": ["Essential Storage", "Preference Storage", "No Silent Escalation", "User Controls"],
    "legal/TRANSPARENCY_REPORT_TEMPLATE.md": ["User Rights Requests", "Government / Law Enforcement Requests", "Privacy Incidents", "Data-Sharing Participation"],
    "legal/USER_RIGHTS_REQUEST_NOTICE.md": ["Data Export", "Deletion", "Consent Revocation", "Human Review"],
    "docs/CONSENT_TIERS.md": ["C0", "C4", "C5", "C8", "revoked"],
    "docs/DATA_CLASSIFICATION.md": ["L4", "L5", "L6", "Default Deny"],
    "docs/RETENTION_AND_DELETION.md": ["R0", "R6", "derived", "biometric"],
    "docs/ANONYMIZATION_STANDARD.md": ["cohort", "re-identification", "opt"],
    "docs/AUDIT_LOGGING_STANDARD.md": ["Consent", "Admin", "audit"],
    "adoption/templates/feature.privacy.yaml": ["dataProcessing", "consentTier", "retentionClass", "deletionSupported"],
    ".github/pull_request_template.md": ["Privacy Impact", "No silent escalation", "Validator passes"],
    "docs/DPIA_TEMPLATE.md": ["Risk Assessment", "Safeguards", "Decision"],
    "docs/VENDOR_AND_PROCESSOR_REVIEW.md": ["Vendor Risk Levels", "data classes", "deletion support"],
    "docs/SECURITY_PRIVACY_REVIEW.md": ["Access Control", "Threats and Controls", "Logging and Monitoring"],
}

EXPECTED_INVALID_FIXTURES = {
    "tests/fixtures/invalid-sensitive-without-c4.privacy.yaml",
    "tests/fixtures/invalid-biometric-without-c5.privacy.yaml",
    "tests/fixtures/invalid-data-sharing-without-c8.privacy.yaml",
}


def fail(message: str) -> None:
    print(f"[privacy-package] FAIL: {message}")
    sys.exit(1)


def load_yaml(path: str):
    if yaml is None:
        fail("PyYAML is required for registry validation")
    try:
        return yaml.safe_load((ROOT / path).read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        fail(f"Invalid YAML in {path}: {exc}")


def load_json(path: str):
    try:
        return json.loads((ROOT / path).read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        fail(f"Invalid JSON in {path}: {exc}")


def validate_json_schema(schema_path: str, instance_path: str, instance: dict | None = None) -> None:
    if Draft202012Validator is None:
        fail("jsonschema is required for JSON Schema validation")
    schema = load_json(schema_path)
    try:
        Draft202012Validator.check_schema(schema)
    except Exception as exc:  # noqa: BLE001
        fail(f"Invalid JSON Schema {schema_path}: {exc}")
    if instance_path:
        data = instance if instance is not None else load_yaml(instance_path)
        errors = sorted(Draft202012Validator(schema).iter_errors(data), key=lambda err: list(err.path))
        if errors:
            first = errors[0]
            fail(f"{instance_path} failed {schema_path}: {first.message}")


def collect_feature_fields(feature: dict) -> list[dict]:
    processing = feature.get("dataProcessing") or {}
    return list(processing.get("collectedFields") or []) + list(processing.get("derivedFields") or [])


def validate_feature_manifest(path: str, feature: dict, registries: dict) -> list[str]:
    errors: list[str] = []
    data_classes = registries["data_classes"]
    consent_tiers = registries["consent_tiers"]
    retention_classes = registries["retention_classes"]

    if feature.get("privacyGovernanceVersion") != "0.1.0-draft":
        errors.append("privacyGovernanceVersion must be 0.1.0-draft")

    fields = collect_feature_fields(feature)
    if not fields:
        errors.append("feature manifest must declare at least one collected or derived field")

    for field in fields:
        field_name = field.get("name", "<unnamed>")
        data_class = field.get("dataClass")
        consent_tier = field.get("consentTier")
        retention_class = field.get("retentionClass")

        if data_class not in data_classes:
            errors.append(f"{field_name}: unknown dataClass {data_class}")
            continue
        if consent_tier not in consent_tiers:
            errors.append(f"{field_name}: unknown consentTier {consent_tier}")
        if retention_class not in retention_classes:
            errors.append(f"{field_name}: unknown retentionClass {retention_class}")

        class_policy = data_classes[data_class]
        if class_policy.get("allowed") is False:
            errors.append(f"{field_name}: dataClass {data_class} is prohibited")

        required_tier = class_policy.get("defaultConsentTier")
        if required_tier and consent_tier != required_tier:
            errors.append(f"{field_name}: {data_class} requires {required_tier}, got {consent_tier}")

        if class_policy.get("explainabilityRequired") and field.get("explainabilityRequired") is not True:
            errors.append(f"{field_name}: {data_class} requires explainabilityRequired=true")

        if data_class == "L5" and retention_class != "R6":
            errors.append(f"{field_name}: L5 biometric fields require R6 retention")

    user_rights = feature.get("userRights") or {}
    if any(field.get("dataClass") in {"L3", "L4", "L5"} for field in fields):
        if user_rights.get("deletionSupported") is not True:
            errors.append("L3-L5 features require deletionSupported=true")
        if user_rights.get("consentRevocationSupported") is not True:
            errors.append("L3-L5 features require consentRevocationSupported=true")

    monetization = feature.get("monetization") or {}
    participates = monetization.get("participatesInDataSharing") is True
    has_l6 = any(field.get("dataClass") == "L6" for field in fields)
    if participates or has_l6:
        if monetization.get("requiresC8Consent") is not True:
            errors.append("data-sharing features require requiresC8Consent=true")
        if monetization.get("anonymizationBatchRequired") is not True:
            errors.append("data-sharing features require anonymizationBatchRequired=true")
        if int(monetization.get("minimumCohortSize") or 0) < 100:
            errors.append("data-sharing features require minimumCohortSize >= 100")

    return [f"{path}: {error}" for error in errors]


def validate_registry_consistency(registries: dict) -> None:
    required_classes = {"L0", "L1", "L2", "L3", "L4", "L5", "L6", "L7"}
    required_tiers = {"C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"}
    required_retention = {"R0", "R1", "R2", "R3", "R4", "R5", "R6"}

    if set(registries["data_classes"].keys()) != required_classes:
        fail("data-classes.yaml must define exactly L0-L7")
    if set(registries["consent_tiers"].keys()) != required_tiers:
        fail("consent-tiers.yaml must define exactly C0-C8")
    if set(registries["retention_classes"].keys()) != required_retention:
        fail("retention-classes.yaml must define exactly R0-R6")

    for class_id, policy in registries["data_classes"].items():
        tier = policy.get("defaultConsentTier")
        if tier and tier not in registries["consent_tiers"]:
            fail(f"{class_id} references unknown defaultConsentTier {tier}")


def validate_domain_files() -> None:
    for path in ["CNAME", "website/CNAME"]:
        domain = (ROOT / path).read_text(encoding="utf-8").strip()
        if domain != "uraiprivacy.com":
            fail(f"{path} must contain exactly uraiprivacy.com")


def main() -> None:
    missing = [path for path in REQUIRED_FILES if not (ROOT / path).exists()]
    if missing:
        fail("Missing required files: " + ", ".join(missing))

    validate_domain_files()

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

    registries = {
        "data_classes": load_yaml("policy/data-classes.yaml")["classes"],
        "consent_tiers": load_yaml("policy/consent-tiers.yaml")["tiers"],
        "retention_classes": load_yaml("policy/retention-classes.yaml")["classes"],
        "audit_event_types": load_yaml("policy/audit-event-types.yaml")["eventTypes"],
        "blocked_uses": load_yaml("policy/blocked-data-uses.yaml")["blockedUses"],
    }
    validate_registry_consistency(registries)

    validate_json_schema("schemas/data-inventory.schema.json", "adoption/ci/sample-privacy-folder/data-inventory.yaml")
    validate_json_schema("schemas/feature-privacy-manifest.schema.json", "examples/valid-feature.privacy.yaml")
    validate_json_schema("schemas/feature-privacy-manifest.schema.json", "adoption/ci/sample-privacy-folder/feature-manifests/mood-weather.privacy.yaml")

    valid_feature = load_yaml("examples/valid-feature.privacy.yaml")
    valid_errors = validate_feature_manifest("examples/valid-feature.privacy.yaml", valid_feature, registries)
    if valid_errors:
        fail("Valid example failed validation: " + "; ".join(valid_errors))

    sample_feature = load_yaml("adoption/ci/sample-privacy-folder/feature-manifests/mood-weather.privacy.yaml")
    sample_errors = validate_feature_manifest("adoption/ci/sample-privacy-folder/feature-manifests/mood-weather.privacy.yaml", sample_feature, registries)
    if sample_errors:
        fail("Sample adoption manifest failed validation: " + "; ".join(sample_errors))

    for fixture_path in sorted(EXPECTED_INVALID_FIXTURES):
        fixture = load_yaml(fixture_path)
        errors = validate_feature_manifest(fixture_path, fixture, registries)
        if not errors:
            fail(f"Invalid fixture unexpectedly passed: {fixture_path}")

    print("[privacy-package] OK: governance package, dependency automation, tests, static E2E smoke tests, secret scanning, website deploy/status, expanded website, repo quality templates, JSON Schemas, cross-repo toolkit, SOPs, architecture lifecycles, legal notices, website domain, release docs, policy registry, and fixtures validated")


if __name__ == "__main__":
    main()
