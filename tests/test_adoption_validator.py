"""Integration tests for the cross-repo privacy adoption validator."""

from __future__ import annotations

from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
VALIDATOR = ROOT / "adoption" / "ci" / "validate_repo_privacy.py"
SAMPLE_PRIVACY = ROOT / "adoption" / "ci" / "sample-privacy-folder"
SCHEMAS = ROOT / "schemas"


class AdoptionValidatorIntegrationTests(unittest.TestCase):
    def make_product_repo(self, tmp: Path) -> Path:
        product_repo = tmp / "product-repo"
        product_repo.mkdir()
        shutil.copytree(SCHEMAS, product_repo / "schemas")
        shutil.copytree(SAMPLE_PRIVACY, product_repo / "privacy")
        return product_repo

    def run_validator(self, product_repo: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(VALIDATOR)],
            cwd=product_repo,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_sample_product_privacy_folder_passes(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            product_repo = self.make_product_repo(Path(tmpdir))
            result = self.run_validator(product_repo)

        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("[repo-privacy] OK", result.stdout)

    def test_sensitive_inference_without_c4_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            product_repo = self.make_product_repo(Path(tmpdir))
            manifest = product_repo / "privacy" / "feature-manifests" / "mood-weather.privacy.yaml"
            manifest.write_text(
                manifest.read_text(encoding="utf-8").replace("consentTier: C4", "consentTier: C2", 1),
                encoding="utf-8",
            )
            result = self.run_validator(product_repo)

        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("L4 requires C4", result.stdout)

    def test_missing_privacy_version_fails_fast(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            product_repo = self.make_product_repo(Path(tmpdir))
            (product_repo / "privacy" / "PRIVACY_VERSION.md").unlink()
            result = self.run_validator(product_repo)

        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn("privacy/PRIVACY_VERSION.md is required", result.stdout)


if __name__ == "__main__":
    unittest.main()
