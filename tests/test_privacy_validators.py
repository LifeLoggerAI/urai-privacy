"""Regression tests for URAI Privacy validation tooling."""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load_module(relative_path: str, module_name: str):
    spec = importlib.util.spec_from_file_location(module_name, ROOT / relative_path)
    if spec is None or spec.loader is None:  # pragma: no cover
        raise RuntimeError(f"Could not load {relative_path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[module_name] = module
    spec.loader.exec_module(module)
    return module


privacy_validator = load_module("tools/validate_privacy_package.py", "privacy_validator")
secret_scanner = load_module("tools/check_secrets.py", "secret_scanner")


class FeatureManifestValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.registries = {
            "data_classes": privacy_validator.load_yaml("policy/data-classes.yaml")["classes"],
            "consent_tiers": privacy_validator.load_yaml("policy/consent-tiers.yaml")["tiers"],
            "retention_classes": privacy_validator.load_yaml("policy/retention-classes.yaml")["classes"],
        }

    def test_valid_example_passes_policy_rules(self) -> None:
        manifest = privacy_validator.load_yaml("examples/valid-feature.privacy.yaml")
        self.assertEqual(
            privacy_validator.validate_feature_manifest("examples/valid-feature.privacy.yaml", manifest, self.registries),
            [],
        )

    def test_sensitive_fixture_requires_c4_consent(self) -> None:
        manifest = privacy_validator.load_yaml("tests/fixtures/invalid-sensitive-without-c4.privacy.yaml")
        errors = privacy_validator.validate_feature_manifest("invalid", manifest, self.registries)
        self.assertTrue(any("requires C4" in error for error in errors), errors)

    def test_data_sharing_fixture_requires_c8_controls(self) -> None:
        manifest = privacy_validator.load_yaml("tests/fixtures/invalid-data-sharing-without-c8.privacy.yaml")
        errors = privacy_validator.validate_feature_manifest("invalid", manifest, self.registries)
        self.assertTrue(any("requiresC8Consent=true" in error for error in errors), errors)
        self.assertTrue(any("minimumCohortSize >= 100" in error for error in errors), errors)


class SecretScannerTests(unittest.TestCase):
    def test_detects_common_secret_patterns(self) -> None:
        fake_path = ROOT / "tmp-secret-test.txt"
        fake_path.write_text('service_token = "ghp_abcdefghijklmnopqrstuvwxyzABCDE1234567890"\n', encoding="utf-8")
        try:
            findings = secret_scanner.scan_file(fake_path)
        finally:
            fake_path.unlink(missing_ok=True)
        self.assertTrue(any("GitHub token" in finding for finding in findings), findings)

    def test_ignores_placeholder_values(self) -> None:
        fake_path = ROOT / "tmp-placeholder-test.txt"
        fake_path.write_text('api_key = "${YOUR_API_KEY_PLACEHOLDER}"\n', encoding="utf-8")
        try:
            findings = secret_scanner.scan_file(fake_path)
        finally:
            fake_path.unlink(missing_ok=True)
        self.assertEqual(findings, [])


if __name__ == "__main__":
    unittest.main()
