/**
 * R581 Jobs #264 frozen build acceptance: evidence from two independent
 * 2026-11-04 UTC Runpod CPU builders US-GA-2 and US-MO-1.
 * REVIEW ONLY: not signed CI, cloud IAM, C6 issuance, or a release GO.
 */
import assert from 'node:assert/strict';
import { assertPrivacyJobs264Checkout, EXACT_JOBS_SHA } from './assert-privacy-jobs264-checkout.mjs';
import { assertJobs264GeneratedManifest } from './attest-jobs264-generated.mjs';

export const R580_REVIEWED_JOBS264_MANIFEST_SHA256 =
  '82cb12511af2e1d800819e2ed73222cefabee43798d4ff3d60277f65656f4ba0';
export const R580_REVIEWED_JOBS264_TREE_SHA256 =
  'c7280667ade99c531a275b22cdd21fa39c058c18599e3137de35025825e36278';
export const R580_REVIEWED_JOBS264_FILE_COUNT = 70;
export const R580_REVIEWED_JOBS264_TREE_BYTES = 455148;

export function assertR583ReviewedPrivacyJobs264IndependentBuild({
  directory, declaredSha, generatedManifest, expectedGeneratedDigest,
}, git) {
  // Check checkout identity *before* accepting any compiled JS.
  assert.equal(declaredSha, EXACT_JOBS_SHA, 'R581_JOBS264_SHA_NOT_REVIEWED');
  assertPrivacyJobs264Checkout({ directory, declaredSha }, git);
  assert.equal(typeof generatedManifest, 'string', 'JOBS_GENERATED_BUILD_RECEIPT_REQUIRED');
  assert.equal(typeof expectedGeneratedDigest, 'string', 'JOBS_GENERATED_BUILD_DIGEST_REQUIRED');
  assert.ok(Buffer.byteLength(generatedManifest, 'utf8') < 4096, 'ARTIFACT_MANIFEST_INVALID');
  assert.equal(expectedGeneratedDigest, R580_REVIEWED_JOBS264_MANIFEST_SHA256,
    'JOBS264_INDEPENDENT_BUILD_DIGEST_MISMATCH');
  let parsed;
  try { parsed = JSON.parse(generatedManifest); }
  catch { throw new Error('JOBS264_INDEPENDENT_BUILD_MANIFEST_INVALID'); }
  assert.equal(parsed?.treeSha256, R580_REVIEWED_JOBS264_TREE_SHA256,
    'JOBS264_INDEPENDENT_BUILD_TREE_MISMATCH');
  assert.equal(parsed?.treeCount, R580_REVIEWED_JOBS264_FILE_COUNT,
    'JOBS264_INDEPENDENT_BUILD_COUNT_MISMATCH');
  assert.equal(parsed?.treeBytes, R580_REVIEWED_JOBS264_TREE_BYTES,
    'JOBS264_INDEPENDENT_BUILD_BYTES_MISMATCH');
  assertJobs264GeneratedManifest({
    directory, manifest: generatedManifest, digest: expectedGeneratedDigest,
  });
  return true;
}
