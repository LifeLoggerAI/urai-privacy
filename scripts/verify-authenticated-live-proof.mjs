#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";

const requireProof = process.env.URAI_PRIVACY_REQUIRE_AUTH_LIVE_PROOF === "1";
const proofPath = process.env.URAI_PRIVACY_AUTH_LIVE_PROOF_PATH || "release-evidence/authenticated-live/AUTHENTICATED_LIVE_WORKFLOW_PROOF.json";
const expectedCommitSha = String(process.env.URAI_PRIVACY_EXPECTED_COMMIT_SHA || "").trim().toLowerCase();
const expectedFirebaseProject = String(process.env.URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT || "").trim();
const expectedBaseUrl = normalizeUrl(process.env.URAI_PRIVACY_BASE_URL || "");
const expectedDeploymentEvidenceSha256 = String(process.env.URAI_PRIVACY_EXPECTED_DEPLOYMENT_EVIDENCE_SHA256 || "").trim().toLowerCase();
const expectedProviderRevision = String(process.env.URAI_PRIVACY_EXPECTED_PROVIDER_REVISION || "").trim();

const requiredWorkflows = [
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
  "monitoring_rollback_evidence"
];

function fail(message) {
  console.error(`[authenticated-live-proof] ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`[authenticated-live-proof] ${message}`);
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.replace(/\/$/, "");
  }
}

if (requireProof) {
  if (!/^[0-9a-f]{40}$/.test(expectedCommitSha)) {
    fail("URAI_PRIVACY_EXPECTED_COMMIT_SHA must be the exact 40-character lowercase hexadecimal release SHA in strict mode.");
  }
  if (expectedFirebaseProject.length < 2) {
    fail("URAI_PRIVACY_EXPECTED_FIREBASE_PROJECT is required in strict mode.");
  }
  if (!/^https:\/\//.test(expectedBaseUrl)) {
    fail("URAI_PRIVACY_BASE_URL must be the exact expected HTTPS deployment URL in strict mode.");
  }
  if (!/^[0-9a-f]{64}$/.test(expectedDeploymentEvidenceSha256)) {
    fail("URAI_PRIVACY_EXPECTED_DEPLOYMENT_EVIDENCE_SHA256 must bind the separately obtained provider deployment evidence.");
  }
  if (expectedProviderRevision.length < 6) fail("URAI_PRIVACY_EXPECTED_PROVIDER_REVISION is required in strict mode.");

  fail(
    "Strict authenticated live proof is blocked: provider/runtime identity and workflow results must be obtained through an authenticated protected workflow or provider-issued attestation; caller-supplied proof files, digests, revisions, and status fields are not release authority."
  );
}

if (!existsSync(proofPath)) {
  const message = `Proof file not found at ${proofPath}. Set URAI_PRIVACY_AUTH_LIVE_PROOF_PATH or create the default proof artifact.`;
  warn(`${message} Skipping because URAI_PRIVACY_REQUIRE_AUTH_LIVE_PROOF is not 1.`);
  process.exit(0);
}

let proof;
try {
  proof = JSON.parse(readFileSync(proofPath, "utf8"));
} catch (error) {
  fail(`Unable to parse proof JSON: ${error instanceof Error ? error.message : String(error)}`);
}

const failures = [];
const proofCommitSha = String(proof?.commitSha || "").trim().toLowerCase();
const proofFirebaseProject = String(proof?.firebaseProjectAlias || "").trim();
const proofBaseUrl = normalizeUrl(proof?.baseUrl || "");

if (!proof || typeof proof !== "object") failures.push("proof root must be a JSON object");
if (!/^[0-9a-f]{40}$/.test(proofCommitSha)) failures.push("commitSha must be a full 40-character hexadecimal Git SHA");
if (!proof.environment || String(proof.environment).trim().length < 2) failures.push("environment is required");
if (!/^https:\/\//.test(proofBaseUrl)) failures.push("baseUrl must be HTTPS");
if (proofFirebaseProject.length < 2) failures.push("firebaseProjectAlias is required");
if (!proof.operator || String(proof.operator).trim().length < 2) failures.push("operator is required");
if (!proof.generatedAt || Number.isNaN(Date.parse(String(proof.generatedAt)))) failures.push("generatedAt must be an ISO-like timestamp");
if (!proof.redactionStatement || String(proof.redactionStatement).trim().length < 20) failures.push("redactionStatement is required and must describe redaction");

const workflows = proof?.workflows && typeof proof.workflows === "object" ? proof.workflows : null;
if (!workflows) {
  failures.push("workflows object is required");
} else {
  for (const name of requiredWorkflows) {
    const item = workflows[name];
    if (!item || typeof item !== "object") {
      failures.push(`${name}: missing workflow proof`);
      continue;
    }
    if (item.status !== "pass") failures.push(`${name}: status must be pass`);
    if (!item.proof || String(item.proof).trim().length < 8) failures.push(`${name}: redacted proof reference is required`);
    if (!item.timestamp || Number.isNaN(Date.parse(String(item.timestamp)))) failures.push(`${name}: timestamp is required`);
    if (!item.expected || String(item.expected).trim().length < 8) failures.push(`${name}: expected result is required`);
    if (!item.actual || String(item.actual).trim().length < 8) failures.push(`${name}: actual result is required`);
  }
}

if (failures.length > 0) {
  console.error("[authenticated-live-proof] FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`[authenticated-live-proof] OK: ${requiredWorkflows.length} authenticated live workflow proofs validated from ${proofPath}`);
