/**
 * R575 Jobs264 test-only source & generated JS gate.
 * Separate US-GA-2 and US-MO-2 frozen builds matched exactly.
 * No production signed provenance, consent grant, cloud IAM or rendering.
 * Historical Jobs261 verifier remains byte-identical.
 */
import assert from 'node:assert/strict';
import { assertPrivacyJobs264Checkout } from './assert-privacy-jobs264-checkout.mjs';
import { assertJobs261GeneratedManifest } from './attest-jobs261-generated.mjs';

// Reuse the original inventory serializer's v2 schema; Jobs264 source identity
// is independently pinned by the R575 checkout guard and 70-file digest.
export const R575_REVIEWED_JOBS264_TREE_SHA256 = 'c7280667ade99c531a275b22cdd21fa39c058c18599e3137de35025825e36278';
export const R575_REVIEWED_JOBS264_MANIFEST_SHA256 = '423d58cb656b7545c1951a8338e5f6bce3bb53eccabec3879374970bdbc02049';
export const R575_REVIEWED_JOBS264_FILE_COUNT = 70;
export function assertR575ReviewedPrivacyJobs264BuildBridge({directory,declaredSha,generatedManifest,expectedGeneratedDigest},git) {
  // Validate detached immutable source BEFORE importing any generated JS.
  assertPrivacyJobs264Checkout({directory,declaredSha},git);
  assert.equal(typeof generatedManifest,'string','JOBS_GENERATED_BUILD_RECEIPT_REQUIRED');
  assert.equal(typeof expectedGeneratedDigest,'string','JOBS_GENERATED_BUILD_DIGEST_REQUIRED');
  assert.ok(Buffer.byteLength(generatedManifest,'utf8')<4096,'ARTIFACT_MANIFEST_INVALID');
  assert.equal(expectedGeneratedDigest,R575_REVIEWED_JOBS264_MANIFEST_SHA256,'JOBS_INDEPENDENT_BUILD_DIGEST_MISMATCH');
  let parsed;
  try {parsed=JSON.parse(generatedManifest);} catch {throw Error('JOBS_INDEPENDENT_BUILD_MANIFEST_INVALID');}
  assert.equal(parsed?.treeSha256,R575_REVIEWED_JOBS264_TREE_SHA256,'JOBS_INDEPENDENT_BUILD_TREE_MISMATCH');
  assert.equal(parsed?.treeCount,R575_REVIEWED_JOBS264_FILE_COUNT,'JOBS_INDEPENDENT_BUILD_COUNT_MISMATCH');
  assertJobs261GeneratedManifest({directory,manifest:generatedManifest,digest:expectedGeneratedDigest});
  return true;
}
