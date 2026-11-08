import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const lifecycle = readFileSync('functions/src/export-lifecycle-functions.ts','utf8');
const attempt = readFileSync('functions/src/export-attempt-maintenance.ts','utf8');
const policy = readFileSync('functions/src/export-cleanup-state-policy.ts','utf8');
const expiry = lifecycle.slice(lifecycle.indexOf('async function cleanupJob('),lifecycle.indexOf('async function cleanupFailedJob('));
const scheduler = lifecycle.slice(lifecycle.indexOf('for (const document of page.docs) {',lifecycle.indexOf('await cleanupExportArtifactAttempts(now)')),lifecycle.indexOf('cursor = page.docs[page.docs.length - 1]',lifecycle.indexOf('await cleanupExportArtifactAttempts(now)')));
test('expired completed cleanup obtains a fresh transactional lease before deleting',()=>{
  assert.match(expiry,/const claim = await db\.runTransaction\(async \(tx\)/);
  assert.match(expiry,/sameCompletedExportForCleanup\(job,\s*expected,\s*now,\s*packageExpiresAt\)/);
  assert.match(expiry,/artifactCleanupLeaseToken:\s*cleanupToken/);
  assert.ok(expiry.indexOf('artifactCleanupLeaseToken: cleanupToken') < expiry.indexOf('removeExportArtifacts('));
});
test('expiry cleanup verifies exact lease identity before marking expired',()=>{
  assert.match(expiry,/current\.artifactCleanupLeaseToken !== cleanupToken/);
  assert.match(expiry,/current\.exportGeneration !== claim\.exportGeneration/);
  assert.match(expiry,/current\.manifestGeneration !== claim\.manifestGeneration/);
  assert.match(expiry,/resolveExportPackageExpiry\(current\) !== claim\.packageExpiresAt/);
});
test('partial cleanup stays failed with pending artifact identities for retry',()=>{
  assert.match(expiry,/if \(cleanup\.pendingPaths\.length === 0\)/);
  assert.match(expiry,/artifactCleanupStatus:\s*"incomplete"/);
  assert.match(expiry,/artifactCleanupPendingPaths:\s*cleanup\.pendingPaths/);
});
test('scheduler must not overwrite stale failure using old page snapshot',()=>{
  assert.doesNotMatch(scheduler,/document\.ref\.update\(\{\s*status:\s*"failed"/);
  assert.match(scheduler,/console\.error\("Export expiry cleanup failed without state overwrite"/);
});
test('attempt cleanup requires current eligible request/job and lease',()=>{
  assert.match(attempt,/attemptCleanupBlockReason\(\{/);
  assert.match(attempt,/jobLeaseExpiresAtMillis/);
  assert.match(attempt,/packageExpiresAtMillis/);
  assert.ok(attempt.indexOf('if (block) {') < attempt.indexOf('await deleteApprovedExportArtifact('));
});
test('attempt state deferral preserves pending evidence, never erases by name',()=>{
  assert.match(attempt,/cleanupReason:\s*block/);
  assert.match(attempt,/cleanupDueAt:\s*Timestamp\.fromMillis\(Math\.max\(/);
  assert.doesNotMatch(attempt,/getStorage\(\)\.bucket\(\)\.file\(path\)\.delete\(/);
});
test('policy refuses stale job generations and active leases',()=>{
  assert.match(policy,/export function sameCompletedExportForCleanup/);
  assert.match(policy,/export function attemptCleanupBlockReason/);
  assert.match(policy,/job\.manifestGeneration === attempt\.manifestGeneration/);
  assert.match(policy,/jobLeaseExpiresAtMillis! <= nowMillis/);
});
