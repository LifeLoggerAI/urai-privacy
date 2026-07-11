from pathlib import Path
import re
import unittest


REQUIRED_WORKFLOWS = (
    ".github/workflows/privacy-package.yml",
    ".github/workflows/privacy-release-verification.yml",
    ".github/workflows/release-verification.yml",
    ".github/workflows/release-verify.yml",
    ".github/workflows/urai-production-verify.yml",
)


class WorkflowConcurrencyContractTests(unittest.TestCase):
    def test_required_workflows_cancel_superseded_pr_runs(self) -> None:
        for workflow_path in REQUIRED_WORKFLOWS:
            with self.subTest(workflow=workflow_path):
                source = Path(workflow_path).read_text(encoding="utf-8")
                match = re.search(
                    r"\nconcurrency:\n(?P<body>[\s\S]*?)(?=\nenv:|\njobs:)",
                    source,
                )
                self.assertIsNotNone(match, "workflow must define concurrency")
                body = match.group("body")
                self.assertIn(
                    "github.event.pull_request.number || github.ref",
                    body,
                    "concurrency must group by PR or ref",
                )
                self.assertIn(
                    "cancel-in-progress: true",
                    body,
                    "superseded runs must be cancelled",
                )
                self.assertNotIn(
                    "github.event.pull_request.head.sha",
                    body,
                    "commit-SHA concurrency preserves stale runs",
                )
                self.assertNotIn(
                    "github.sha",
                    body,
                    "commit-SHA concurrency preserves stale runs",
                )

    def test_required_workflows_keep_exact_head_checkout(self) -> None:
        for workflow_path in REQUIRED_WORKFLOWS:
            with self.subTest(workflow=workflow_path):
                source = Path(workflow_path).read_text(encoding="utf-8")
                self.assertIn("TARGET_SHA:", source)
                self.assertIn("ref: ${{ env.TARGET_SHA }}", source)
                self.assertIn("persist-credentials: false", source)


if __name__ == "__main__":
    unittest.main()
