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
