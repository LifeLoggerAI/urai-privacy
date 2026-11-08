import test from 'node:test';
import assert from 'node:assert/strict';
import { attemptCleanupFinalizationBlockReason as block } from '../functions/src/export-cleanup-state-policy.ts';
const authority = () => ({
  uid: 'u', jobId: 'j', requestId: 'r', attemptToken: 'attempt', cleanupToken: 'cleanup',
  exportPath: 'exports/u/j/uuid/export.json', manifestPath: 'exports/u/j/uuid/manifest.json',
  exportGeneration: '9007199254740993', manifestGeneration: '9007199254740994',
  paths: ['exports/u/j/uuid/export.json', 'exports/u/j/uuid/manifest.json']
});
const fixture = () => {
  const a = authority();
  return { authority: a, nowMillis: 1000, attemptLeaseExpiresAtMillis: 2000,
    jobLeaseExpiresAtMillis: 2000,
    attempt: {status: 'artifact_cleanup', uid: a.uid, jobId: a.jobId, requestId: a.requestId,
      token: a.attemptToken, cleanupLeaseToken: a.cleanupToken, exportGeneration: a.exportGeneration,
      manifestGeneration: a.manifestGeneration, paths: [...a.paths]},
    job: {status: 'artifact_cleanup', artifactCleanupStatus: 'processing', uid: a.uid, requestId: a.requestId,
      artifactCleanupLeaseToken: a.cleanupToken, exportPackagePath: a.exportPath,
      exportManifestPath: a.manifestPath, exportGeneration: a.exportGeneration,
      manifestGeneration: a.manifestGeneration, artifactCleanupPendingPaths: [...a.paths]}
  };
};
test('current exact job, attempt and cleanup lease may finalize', () => assert.equal(block(fixture()), null));
test('old worker cleanup token is rejected by attempt', () => {const x=fixture();x.attempt.cleanupLeaseToken='next';assert.equal(block(x),'ATTEMPT_CLEANUP_AUTHORITY_CHANGED')});
test('old worker cleanup token is rejected by job', () => {const x=fixture();x.job.artifactCleanupLeaseToken='next';assert.equal(block(x),'JOB_CLEANUP_AUTHORITY_CHANGED')});
test('newer job generation cannot be finalized by old attempt', () => {const x=fixture();x.job.exportGeneration='9007199254740999';assert.equal(block(x),'JOB_CLEANUP_AUTHORITY_CHANGED')});
test('newer attempt generation cannot be finalized by stale worker', () => {const x=fixture();x.attempt.manifestGeneration='9007199254740999';assert.equal(block(x),'ATTEMPT_CLEANUP_AUTHORITY_CHANGED')});
test('cross-owner job cannot be finalized', () => {const x=fixture();x.job.uid='other';assert.equal(block(x),'JOB_CLEANUP_AUTHORITY_CHANGED')});
test('changed request cannot be finalized', () => {const x=fixture();x.attempt.requestId='other';assert.equal(block(x),'ATTEMPT_CLEANUP_AUTHORITY_CHANGED')});
test('different artifact path cannot be finalized', () => {const x=fixture();x.job.exportManifestPath='other';assert.equal(block(x),'JOB_CLEANUP_AUTHORITY_CHANGED')});
test('reordered pending paths are denied', () => {const x=fixture();x.job.artifactCleanupPendingPaths.reverse();assert.equal(block(x),'JOB_CLEANUP_AUTHORITY_CHANGED')});
test('superseded attempt status is denied', () => {const x=fixture();x.attempt.status='cleaned';assert.equal(block(x),'ATTEMPT_CLEANUP_AUTHORITY_CHANGED')});
test('superseded job status is denied', () => {const x=fixture();x.job.status='expired';assert.equal(block(x),'JOB_CLEANUP_AUTHORITY_CHANGED')});
test('expired attempt lease is denied', () => {const x=fixture();x.attemptLeaseExpiresAtMillis=999;assert.equal(block(x),'CLEANUP_LEASE_EXPIRED')});
test('expired job lease is denied', () => {const x=fixture();x.jobLeaseExpiresAtMillis=1000;assert.equal(block(x),'CLEANUP_LEASE_EXPIRED')});
test('missing attempt or job lease is denied', () => {const x=fixture();x.jobLeaseExpiresAtMillis=null;assert.equal(block(x),'CLEANUP_LEASE_EXPIRED');x.jobLeaseExpiresAtMillis=2000;x.attemptLeaseExpiresAtMillis=null;assert.equal(block(x),'CLEANUP_LEASE_EXPIRED')});
test('malformed pending-path array is denied', () => {const x=fixture();x.attempt.paths=null;assert.equal(block(x),'ATTEMPT_CLEANUP_AUTHORITY_CHANGED')});
