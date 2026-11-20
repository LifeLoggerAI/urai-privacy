'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { exactErrorCode, assertTerminalDeletion, assertPendingDownstreamDeletion, buildReceipt } = require('./integration/r1545-lifecycle-assertions.cjs')

// Synthetic assertion inputs ONLY. These tests do not claim Firebase behavior.
function evidence() {
  const residual = { totalResidualTargets: 0, storageObjectCount: 0, authUserExists: false, legalHold: false,
    firestoreCounts: { users: 0, privacyRequests: 0, exportJobs: 0, consentRecords: 0, dataAccessEvents: 0 } }
  return {
    uid: 'owner', requestId: 'request', operatorUid: 'operator',
    record: { uid: 'owner', status: 'completed', deletionExecutionState: 'completed', deletionCompletionVerified: true,
      deletionCompletionVerificationRequired: false, deletionCompletionVerificationStatus: 'verified',
      destructiveDeletionCompletedAt: { seconds: 1 }, deletionCompletionVerifiedAt: { seconds: 1 },
      destructiveDeletionBlocked: false, destructiveDeletionReady: false,
      deletionCompletionVerificationAuditId: 'audit', deletionCompletionResidualSummary: residual },
    tombstone: { uid: 'owner', requestId: 'request', active: true, status: 'completed' },
    audit: { action: 'deletion_completion_verified', targetUid: 'owner', requestId: 'request', actorUid: 'operator', metadata: { verified: true, residualSummary: structuredClone(residual) } },
  }
}
test('accepts fully linked terminal assertion input', () => assertTerminalDeletion(evidence()))
const corruptions = {
  'truthy mutation response': e => { e.record = { status: 'processing' } },
  'nonterminal persisted status': e => { e.record.status = 'processing' },
  'pending verification': e => { e.record.deletionCompletionVerificationStatus = 'pending' },
  'verification still required': e => { e.record.deletionCompletionVerificationRequired = true },
  'missing verification flag': e => { delete e.record.deletionCompletionVerified },
  'missing completion timestamp': e => { delete e.record.destructiveDeletionCompletedAt },
  'wrong subject': e => { e.record.uid = 'foreign' },
  'auth user remains': e => { e.record.deletionCompletionResidualSummary.authUserExists = true },
  'storage remains despite zero total': e => { e.record.deletionCompletionResidualSummary.storageObjectCount = 1 },
  'record remains despite zero total': e => { e.record.deletionCompletionResidualSummary.firestoreCounts.users = 1 },
  'missing collection count': e => { delete e.record.deletionCompletionResidualSummary.firestoreCounts.exportJobs },
  'active legal hold': e => { e.record.deletionCompletionResidualSummary.legalHold = true },
  'missing audit linkage': e => { e.record.deletionCompletionVerificationAuditId = '' },
  'wrong audit actor': e => { e.audit.actorUid = 'owner' },
  'wrong audit request': e => { e.audit.requestId = 'foreign' },
  'unverified audit': e => { e.audit.metadata.verified = false },
  'wrong tombstone request': e => { e.tombstone.requestId = 'foreign' },
  'inactive tombstone': e => { e.tombstone.active = false },
  'nonterminal tombstone': e => { e.tombstone.status = 'verification_required' },
}
for (const [name, corrupt] of Object.entries(corruptions)) test('rejects ' + name, () => {
  const e = evidence(); corrupt(e); assert.throws(() => assertTerminalDeletion(e), { code: 'ERR_ASSERTION' })
})
test('auth deletion check rejects network, permissions and malformed errors', async () => {
  const predicate = exactErrorCode('auth/user-not-found')
  await assert.rejects(Promise.reject({ code: 'auth/user-not-found' }), predicate)
  for (const error of [{ code: 'auth/internal-error' }, { code: 'auth/insufficient-permission' }, new Error('timeout'), {}, null]) {
    assert.equal(predicate(error), false)
    await assert.rejects(assert.rejects(Promise.reject(error), predicate))
  }
})
test('foreign denial predicate rejects internal and signing errors', () => {
  const predicate = exactErrorCode('functions/permission-denied')
  assert.equal(predicate({ code: 'functions/permission-denied' }), true)
  for (const code of ['functions/internal', 'functions/unavailable', 'functions/deadline-exceeded', 'functions/not-found']) assert.equal(predicate({ code }), false)
})
test('receipt never promotes untested download or entire lifecycle to PASS', () => {
  const args = { checks: ['one-real-check'], phases: { deletion: 'not-verified', exportPackage: 'not-verified' }, source: 'pinned', harnessSha256: 'hash', helperSha256: 'hash' }
  const partial = buildReceipt(args)
  assert.equal(partial.outcome, 'PARTIAL')
  assert.equal(partial.requestVsCompletion.deletion, 'not-verified')
  assert.equal(partial.downloadUrl.status, 'not-attempted')
  assert.equal(partial.authorizedUserDownload, 'not-tested')
  assert.equal(partial.checksPassed, 1)
  assert.equal(partial.independentSecurityCertification, false)
  assert.equal(buildReceipt({ ...args, failed: true }).outcome, 'FAIL')
})


function downstreamEvidence() {
  const e = evidence()
  e.record.status = 'processing'
  e.record.deletionExecutionState = 'verification_required'
  e.record.deletionCompletionVerified = false
  e.record.deletionCompletionVerificationRequired = true
  e.record.deletionCompletionVerificationStatus = 'failed'
  e.record.destructiveDeletionBlocked = true
  delete e.record.destructiveDeletionCompletedAt
  e.record.deletionCompletionVerificationReason = 'PENDING_DOWNSTREAM_DELETION_CONTRIBUTORS'
  e.tombstone.status = 'verification_required'
  e.audit.action = 'deletion_completion_reopened'
  e.audit.metadata.verified = false
  e.audit.metadata.reason = 'PENDING_DOWNSTREAM_DELETION_CONTRIBUTORS'
  return e
}
test('R1579 accepts local zero-residual state only as pending downstream completion', () =>
  assertPendingDownstreamDeletion(downstreamEvidence()))
for (const [name, mutate] of Object.entries({
  'falsely completed request': e => { e.record.status = 'completed' },
  'falsely verified request': e => { e.record.deletionCompletionVerified = true },
  'falsely completed tombstone': e => { e.tombstone.status = 'completed' },
  'falsely verified audit': e => { e.audit.metadata.verified = true },
  'missing downstream reason': e => { delete e.record.deletionCompletionVerificationReason },
  'reappearing Auth account': e => { e.record.deletionCompletionResidualSummary.authUserExists = true },
  'missing audit linkage': e => { e.record.deletionCompletionVerificationAuditId = '' },
  'foreign actor': e => { e.audit.actorUid = 'stranger' },
})) test('R1579 denies ' + name, () => {
  const e = downstreamEvidence()
  mutate(e)
  assert.throws(() => assertPendingDownstreamDeletion(e), { code: 'ERR_ASSERTION' })
})
