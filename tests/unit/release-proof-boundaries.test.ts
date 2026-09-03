import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { test } from "vitest";

const proofVerifier = fileURLToPath(new URL("../../scripts/verify-authenticated-live-proof.mjs", import.meta.url));
const qaVerifier = fileURLToPath(new URL("../../scripts/urai-qa-checks.js", import.meta.url));

const workflowNames = [
  "public_route_smoke",
  "owner_export_request",
  "admin_process_export_job",
  "owner_export_download_link",
  "cross_user_export_denied",
  "owner_deletion_request",
  "admin_deletion_dry_run",
  "stale_deletion_hash_fails",
  "legal_hold_blocks_deletion",
  "admin_execute_deletion_current_hash",
  "consent_grant_deny_revoke",
  "user_audit_log_scope",
  "anonymous_access_denied",
  "admin_denied_without_claim",
  "admin_allowed_with_claim",
  "storage_owner_admin_scope",
  "firestore_deny_by_default",
  "monitoring_rollback_evidence",
];

function proof(commitSha: string, firebaseProjectAlias: string, baseUrl: string, deploymentEvidenceSha256 = "c".repeat(64)) {
  return {
    commitSha,
    environment: "production",
    baseUrl,
    firebaseProjectAlias,
    operator: "release-operator",
    generatedAt: "2026-07-13T20:00:00.000Z",
    redactionStatement: "Tokens, identities, personal data, and secret values were redacted.",
    deploymentEvidenceSha256,
    workflows: Object.fromEntries(
      workflowNames.map((name) => [
        name,
        {
          status: "pass",
          proof: `redacted-proof/${name}`,
          timestamp: "2026-07-13T20:00:00.000Z",
          expected: "The authorized workflow succeeds and unauthorized access fails closed.",
          actual: "Observed the expected authorized result and fail-closed denial behavior.",
        },
      ]),
    ),
  };
}

function runProofVerifier(proofPath: string, overrides: Record<string, string>) {
  return spawnSync(process.execPath, [proofVerifier], {
    encoding: "utf8",
    env: {
      ...process.env,
      URAI_PRIVACY_REQUIRE_AUTH_LIVE_PROOF: "1",
      URAI_PRIVACY_AUTH_LIVE_PROOF_PATH: proofPath,
      ...overrides,
    },
  });
}

test("strict authenticated proof accepts only the exact SHA, project, and deployment URL", () => {
  const dir = mkdtempSync(join(tmpdir(), "urai-privacy-proof-"));
  try {
    const expectedSha = "a".repeat(40);
    const proofPath = join(dir, "proof.json");
    const deploymentPath = join(dir, "provider-deployment.json");
    const deployment = JSON.stringify({source: "provider-api", revisionId: "privacy-rev-001", sourceCommitSha: expectedSha, firebaseProjectAlias: "urai-privacy-prod", baseUrl: "https://uraiprivacy.com", observedAt: "2026-07-13T20:00:00.000Z"});
    const deploymentDigest = createHash("sha256").update(deployment).digest("hex");
    writeFileSync(deploymentPath, deployment);
    writeFileSync(proofPath, JSON.stringify(proof(expectedSha, "urai-privacy-prod", "https://uraiprivacy.com/", deploymentDigest)));

    const success = runProofVerifier(proofPath, {
      URAI_PRIVACY_EXPECTED_COMMIT_SHA: expectedSha,
      URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT: "urai-privacy-prod",
      URAI_PRIVACY_BASE_URL: "https://uraiprivacy.com",
      URAI_PRIVACY_DEPLOYMENT_EVIDENCE_PATH: deploymentPath,
      URAI_PRIVACY_EXPECTED_DEPLOYMENT_EVIDENCE_SHA256: deploymentDigest,
      URAI_PRIVACY_EXPECTED_PROVIDER_REVISION: "privacy-rev-001",
    });
    assert.equal(success.status, 0, `${success.stdout}\n${success.stderr}`);

    const staleSha = runProofVerifier(proofPath, {
      URAI_PRIVACY_EXPECTED_COMMIT_SHA: "b".repeat(40),
      URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT: "urai-privacy-prod",
      URAI_PRIVACY_BASE_URL: "https://uraiprivacy.com",
      URAI_PRIVACY_DEPLOYMENT_EVIDENCE_PATH: deploymentPath,
      URAI_PRIVACY_EXPECTED_DEPLOYMENT_EVIDENCE_SHA256: deploymentDigest,
      URAI_PRIVACY_EXPECTED_PROVIDER_REVISION: "privacy-rev-001",
    });
    assert.notEqual(staleSha.status, 0);
    assert.match(`${staleSha.stdout}\n${staleSha.stderr}`, /commitSha mismatch/);

    const wrongProject = runProofVerifier(proofPath, {
      URAI_PRIVACY_EXPECTED_COMMIT_SHA: expectedSha,
      URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT: "other-project",
      URAI_PRIVACY_BASE_URL: "https://uraiprivacy.com",
      URAI_PRIVACY_DEPLOYMENT_EVIDENCE_PATH: deploymentPath,
      URAI_PRIVACY_EXPECTED_DEPLOYMENT_EVIDENCE_SHA256: deploymentDigest,
      URAI_PRIVACY_EXPECTED_PROVIDER_REVISION: "privacy-rev-001",
    });
    assert.notEqual(wrongProject.status, 0);
    assert.match(`${wrongProject.stdout}\n${wrongProject.stderr}`, /firebaseProjectAlias mismatch/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("strict authenticated proof requires explicit expected release identity", () => {
  const dir = mkdtempSync(join(tmpdir(), "urai-privacy-proof-required-"));
  try {
    const proofPath = join(dir, "proof.json");
    writeFileSync(proofPath, JSON.stringify(proof("a".repeat(40), "urai-privacy-prod", "https://uraiprivacy.com")));
    const result = runProofVerifier(proofPath, {
      URAI_PRIVACY_EXPECTED_COMMIT_SHA: "",
      URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT: "",
      URAI_PRIVACY_BASE_URL: "",
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /URAI_PRIVACY_EXPECTED_COMMIT_SHA/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rendered QA fails closed when no product routes are checked", () => {
  const dir = mkdtempSync(join(tmpdir(), "urai-privacy-qa-empty-"));
  try {
    writeFileSync(join(dir, "_global-error.html"), "<html><title>Internal error</title></html>");
    const result = spawnSync(process.execPath, [qaVerifier, dir], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /no rendered product HTML files were checked/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("rendered QA requires and accepts both public and protected product routes", () => {
  const dir = mkdtempSync(join(tmpdir(), "urai-privacy-qa-routes-"));
  try {
    writeFileSync(
      join(dir, "privacy.html"),
      '<html><head><title>URAI Privacy Center</title><meta name="description" content="Privacy controls"></head><body><a href="/privacy">Privacy</a></body></html>',
    );
    mkdirSync(join(dir, "privacy-center"));
    writeFileSync(
      join(dir, "privacy-center", "page.html"),
      '<html><head><title>Private Privacy Center</title><meta name="robots" content="noindex"></head><body>Owner controls</body></html>',
    );
    const result = spawnSync(process.execPath, [qaVerifier, dir], { encoding: "utf8" });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /1 public and 1 protected/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
