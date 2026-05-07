"""Regression tests for the privacy governance health report."""

from __future__ import annotations

from pathlib import Path
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "tools" / "privacy_health_report.py"


class PrivacyHealthReportTests(unittest.TestCase):
    def test_health_report_generates_expected_sections(self) -> None:
        result = subprocess.run(
            [sys.executable, str(REPORT)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("# URAI Privacy Health Report", result.stdout)
        self.assertIn("## Policy Registry Coverage", result.stdout)
        self.assertIn("## Test Coverage Snapshot", result.stdout)
        self.assertIn("## Release Gate Checklist", result.stdout)
        self.assertIn("## Manual Launch Blockers", result.stdout)
        self.assertIn("[privacy-health] OK: report generated", result.stdout)

    def test_health_report_keeps_manual_launch_blockers_visible(self) -> None:
        result = subprocess.run(
            [sys.executable, str(REPORT)],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertIn("Qualified legal review", result.stdout)
        self.assertIn("Branch protection", result.stdout)
        self.assertIn("DNS/HTTPS verification", result.stdout)
        self.assertIn("Cross-repo adoption", result.stdout)


if __name__ == "__main__":
    unittest.main()
