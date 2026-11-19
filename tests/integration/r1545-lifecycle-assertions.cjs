'use strict'
const assert = require('node:assert/strict')

// Pure assertion helpers, not substitutes for native service execution.
function exactErrorCode(code) {
  return error => error !== null && typeof error === 'object' && error.code === code
}

function assertTerminalDeletion({ record, tombstone, audit, uid, requestId, operatorUid }) {
  assert.ok(record, 'Deletion request must still exist for terminal readback')
  assert.equal(record.uid, uid)
  assert.equal(record.status, 'completed', 'Mutation return is not terminal deletion evidence')
  assert.equal(record.deletionExecutionState, 'completed')
  assert.equal(record.deletionCompletionVerified, true)
  assert.equal(record.deletionCompletionVerificationRequired, false)
  assert.equal(record.deletionCompletionVerificationStatus, 'verified')
  assert.ok(record.destructiveDeletionCompletedAt)
  assert.ok(record.deletionCompletionVerifiedAt)
  assert.equal(record.destructiveDeletionBlocked, false)
  assert.equal(record.destructiveDeletionReady, false)
  assert.equal(typeof record.deletionCompletionVerificationAuditId, 'string')
  assert.ok(record.deletionCompletionVerificationAuditId.length > 0)
  const residual = record.deletionCompletionResidualSummary
  assert.ok(residual)
  assert.equal(residual.totalResidualTargets, 0)
  assert.equal(residual.storageObjectCount, 0)
  assert.equal(residual.authUserExists, false)
  assert.equal(residual.legalHold, false)
  assert.deepEqual(residual.firestoreCounts, {
    users: 0, privacyRequests: 0, exportJobs: 0, consentRecords: 0, dataAccessEvents: 0,
  })
  assert.ok(tombstone)
  assert.equal(tombstone.uid, uid)
  assert.equal(tombstone.requestId, requestId)
  assert.equal(tombstone.active, true)
  assert.equal(tombstone.status, 'completed')
  assert.ok(audit)
  assert.equal(audit.action, 'deletion_completion_verified')
  assert.equal(audit.targetUid, uid)
  assert.equal(audit.requestId, requestId)
  assert.equal(audit.actorUid, operatorUid)
  assert.equal(audit.metadata?.verified, true)
  assert.deepEqual(audit.metadata?.residualSummary, residual)
}

function buildReceipt({ checks, phases, source, harnessSha256, helperSha256, failed }) {
  // A successful subset is always PARTIAL while user-download is untested.
  return {
    outcome: failed ? 'FAIL' : 'PARTIAL',
    checksPassed: checks.length,
    checks: [...checks],
    source,
    harnessSha256,
    helperSha256,
    sourceIdentityBasis: 'Git HEAD matched to runner pin; clean tracked checkout; independent build custody still required',
    requestVsCompletion: { ...phases },
    downloadUrl: { status: 'not-attempted', reason: 'no-authorized-provider-signer-in-emulator-scope' },
    authorizedUserDownload: 'not-tested',
    adminStorageReadIsUserDownload: false,
    productionWrites: false,
    independentCloudIAMVerified: false,
    independentSecurityCertification: false,
    releaseApproved: false,
  }
}

module.exports = { exactErrorCode, assertTerminalDeletion, buildReceipt }
