import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync('functions/src/export-attempt-maintenance.ts','utf8');
const p=readFileSync('functions/src/export-cleanup-state-policy.ts','utf8');
const claim=s.slice(s.indexOf('const claim = await db.runTransaction('),s.indexOf('if (!claim) continue;'));
const result=s.slice(s.indexOf('const cleanup = await removeExportArtifacts'),s.indexOf('if (cleanup.pendingPaths.length) failed'));
test('parent job and attempt claim a single cleanup lease in the same transaction',()=>{
 assert.match(claim,/tx\.update\(jobRef,\s*\{\s*status:\s*"artifact_cleanup"/);
 assert.match(claim,/artifactCleanupLeaseToken:\s*cleanupToken/);
 assert.match(claim,/tx\.update\(document\.ref,\s*\{\s*status:\s*"artifact_cleanup",\s*cleanupLeaseToken:\s*cleanupToken/);
});
test('claim does not mark completed package expired before storage succeeds',()=>{
 assert.doesNotMatch(claim,/status:\s*"expired"/);
 assert.match(result,/claim\.originalCompleted\s*\?\s*"expired"\s*:\s*"failed"/);
});
test('attempt and job are read in one finalization transaction before update',()=>{
 assert.match(result,/const \[fresh, currentJob\] = await Promise\.all\(\[\s*tx\.get\(document\.ref\), tx\.get\(jobRef\)/);
 assert.match(result,/attemptCleanupFinalizationBlockReason\(\{/);
 assert.match(result,/if \(block\) throw new Error/);
});
test('changed generation and both lease expirations checked before completion',()=>{
 assert.match(result,/exportGeneration:\s*claim\.exportGeneration/);
 assert.match(result,/manifestGeneration:\s*claim\.manifestGeneration/);
 assert.match(result,/attemptLeaseExpiresAtMillis:\s*timestampMillis/);
 assert.match(result,/jobLeaseExpiresAtMillis:\s*timestampMillis/);
});
test('partial failures remain owned by failed-job recovery',()=>{
 assert.match(result,/status:\s*pending\s*\?\s*"failed"/);
 assert.match(result,/artifactCleanupPendingPaths:\s*cleanup\.pendingPaths/);
 assert.match(result,/cleanupDueAt:\s*FieldValue\.delete\(\)/);
});
test('destructive GCS delete stays exact-generation conditional',()=>{
 assert.match(result,/deleteApprovedExportArtifact\(\{\s*\.\.\.claim,\s*path\s*\}\)/);
 assert.doesNotMatch(s,/getStorage\(\)\.bucket\(\)\.file\(path\)\.delete/);
});
test('pure policy checks attempt and parent job tokens, generations and state',()=>{
 assert.match(p,/attempt\.cleanupLeaseToken !== authority\.cleanupToken/);
 assert.match(p,/job\.artifactCleanupLeaseToken !== authority\.cleanupToken/);
 assert.match(p,/job\.manifestGeneration !== authority\.manifestGeneration/);
 assert.match(p,/CLEANUP_LEASE_EXPIRED/);
});
