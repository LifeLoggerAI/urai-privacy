/**
 * R561 review-only bridge source + generated JS integrity gate.
 * Must run BEFORE loading any generated Jobs functions/lib module.
 * Expected digest is supplied by a separately retained, approved frozen-build
 * receipt. The emulator may not self-issue its expected digest during verify.
 * This checks review source/artifacts, not production credentials or rights.
 */
import assert from 'node:assert/strict';
import { assertPrivacyJobs261Checkout } from './assert-privacy-jobs261-checkout.mjs';
import { assertJobs261GeneratedManifest } from './attest-jobs261-generated.mjs';

export function assertPrivacyJobs261BuildBridge({
  directory, declaredSha, generatedManifest, expectedGeneratedDigest,
}, git) {
  // Preserve all R548-R552 actual source and checkout invariants unchanged.
  assertPrivacyJobs261Checkout({ directory, declaredSha }, git);
  // Both must be present; the expected digest comes from an independent
  // build receipt rather than being calculated during this verification.
  assert.equal(typeof generatedManifest, 'string', 'JOBS_GENERATED_BUILD_RECEIPT_REQUIRED');
  assert.equal(typeof expectedGeneratedDigest, 'string', 'JOBS_GENERATED_BUILD_DIGEST_REQUIRED');
  assertJobs261GeneratedManifest({
    directory, manifest: generatedManifest, digest: expectedGeneratedDigest,
  });
  return true;
}

/**
 * R565: independent *review-only* Jobs #261 compiled-artifact anchor.
 * The two fixed values were observed in separate frozen source builds on
 * US-MO-2 (R561) and US-GA-2 (R562). They cannot be supplied or replaced by
 * the emulator caller. A new Jobs source revision requires a new reviewed pin.
 *
 * This is a reproducibility check, NOT a signed trusted-builder attestation,
 * real-cloud GCS/IAM approval, a C6 grant, or permission to render.
 */
export const R562_REVIEWED_JOBS261_TREE_SHA256 =
  'd4add7024e9754b2a2938e8f58562cc0fd4870cd4d54d5a4c562a0fd12d037cd';
export const R562_REVIEWED_JOBS261_MANIFEST_SHA256 =
  '6fa8b9e6ea767c0d709be46d718ebcf29f3fdb5ad1bb7961669c0a12edba7a96';
export const R562_REVIEWED_JOBS261_FILE_COUNT = 69;

/**
 * Only this stricter entrypoint is used by the disposable 4-emulator bridge.
 * Keep the original R561 generic function exported for synthetic negative
 * testing, but do not trust the generic caller-selected digest for acceptance.
 */
export function assertR562ReviewedPrivacyJobs261BuildBridge({
  directory, declaredSha, generatedManifest, expectedGeneratedDigest,
}, git) {
  // Immutable Jobs #261 source and clean detached checkout are checked FIRST.
  assertPrivacyJobs261Checkout({ directory, declaredSha }, git);
  assert.equal(typeof generatedManifest, 'string', 'JOBS_GENERATED_BUILD_RECEIPT_REQUIRED');
  assert.equal(typeof expectedGeneratedDigest, 'string', 'JOBS_GENERATED_BUILD_DIGEST_REQUIRED');
  assert.ok(Buffer.byteLength(generatedManifest, 'utf8') < 4096, 'ARTIFACT_MANIFEST_INVALID');
  assert.equal(expectedGeneratedDigest, R562_REVIEWED_JOBS261_MANIFEST_SHA256,
    'JOBS_INDEPENDENT_BUILD_DIGEST_MISMATCH');
  // The tree digest/count are checked against the independently rebuilt R562
  // values before accepting the full manifest and the actual filesystem.
  let parsed;
  try { parsed = JSON.parse(generatedManifest); }
  catch { throw new Error('JOBS_INDEPENDENT_BUILD_MANIFEST_INVALID'); }
  assert.equal(parsed?.treeSha256, R562_REVIEWED_JOBS261_TREE_SHA256,
    'JOBS_INDEPENDENT_BUILD_TREE_MISMATCH');
  assert.equal(parsed?.treeCount, R562_REVIEWED_JOBS261_FILE_COUNT,
    'JOBS_INDEPENDENT_BUILD_COUNT_MISMATCH');
  assertJobs261GeneratedManifest({
    directory, manifest: generatedManifest, digest: expectedGeneratedDigest,
  });
  return true;
}
