'use strict'
// R1584 review-only: native Auth/Functions/Firestore/Storage emulator consent revocation receipt/ACK acceptance.
// Synthetic identities and records ONLY. Does not certify cross-service effects or provider IAM.
const assert = require('node:assert/strict')
const { createHash, randomBytes } = require('node:crypto')
const { execFileSync } = require('node:child_process')
const { setTimeout: sleep } = require('node:timers/promises')
const { initializeApp, deleteApp } = require('firebase/app')
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require('firebase/auth')
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions')
const { initializeApp: initializeAdminApp, deleteApp: deleteAdminApp } = require('firebase-admin/app')
const { getAuth: getAdminAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

const PROJECT = 'urai-privacy-r1512-disposable'
const EXPECTED_SHA = process.env.URAI_EXACT_SHA
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const checks = []
const apps = []
let admin
function pass(label) { checks.push(label); console.log('R1584_PASS ' + label) }
const forbidden = [
  'GOOGLE_APPLICATION_CREDENTIALS', 'GITHUB_TOKEN', 'GH_TOKEN', 'RUNPOD_API_KEY',
  'FIREBASE_TOKEN', 'FIREBASE_CLI_TOKEN', 'GOOGLE_OAUTH_ACCESS_TOKEN',
  'GOOGLE_CLOUD_ACCESS_TOKEN', 'CLOUDSDK_AUTH_ACCESS_TOKEN', 'NODE_OPTIONS',
]
assert.match(EXPECTED_SHA || '', /^[a-f0-9]{40}$/)
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), EXPECTED_SHA)
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).trim(), '')
assert.equal(process.env.GCLOUD_PROJECT, PROJECT)
for (const [name, value] of Object.entries({
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
})) assert.equal(process.env[name], value, name)
for (const name of forbidden) assert.ok(!process.env[name], 'forbidden credential-bearing env ' + name)
if (process.env.FIREBASE_CONFIG) {
  const cfg = JSON.parse(process.env.FIREBASE_CONFIG)
  assert.equal(cfg.projectId, PROJECT)
}
pass('exact_git_head_clean_checkout_and_no_credentials')

function client(label, suffix) {
  const app = initializeApp({
    apiKey: 'R1584_Emulator_Only_No_Production_Key', projectId: PROJECT,
    appId: '1:1584:web:only', authDomain: PROJECT + '.firebaseapp.com',
  }, label + '-' + suffix)
  apps.push(app)
  const auth = getAuth(app)
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  const functions = getFunctions(app, 'us-central1')
  connectFunctionsEmulator(functions, '127.0.0.1', 5001)
  return { auth, functions }
}
async function call(who, name, payload = {}) {
  return (await httpsCallable(who.functions, name, { timeout: 25000 })(payload)).data
}
async function denied(action, code, label) {
  await assert.rejects(action, err => {
    assert.equal(err?.code, 'functions/' + code, label + ': expected Firebase code ' + code)
    return true
  })
  pass(label)
}
async function waitFor(ref, predicate, label) {
  for (let n = 0; n < 90; n++) {
    const snap = await ref.get()
    if (snap.exists && predicate(snap.data())) return snap.data()
    await sleep(125)
  }
  throw new Error('Timed out waiting for ' + label)
}
async function run() {
  const suffix = randomBytes(5).toString('hex')
  const owner = client('owner', suffix)
  const jobs = client('jobs', suffix)
  const stranger = client('stranger', suffix)
  const analytics = client('analytics', suffix)
  const anonymous = client('anonymous', suffix)
  admin = initializeAdminApp({ projectId: PROJECT }, 'r1584-admin-' + suffix)
  const adminAuth = getAdminAuth(admin)
  const db = getFirestore(admin)
  const credentials = await Promise.all([owner, jobs, stranger, analytics].map((c, i) =>
    createUserWithEmailAndPassword(c.auth, 'r1584-' + suffix + '-' + i + '@example.test', 'SyntheticOnly1234!')))
  const [ownerUid, jobsUid, strangerUid, analyticsUid] = credentials.map(x => x.user.uid)
  assert.equal(new Set([ownerUid, jobsUid, strangerUid, analyticsUid]).size, 4)
  await adminAuth.setCustomUserClaims(jobsUid, { system: true, consumerId: 'urai-jobs' })
  await adminAuth.setCustomUserClaims(analyticsUid, { system: true, consumerId: 'urai-analytics' })
  await Promise.all([jobs.auth.currentUser.getIdToken(true), analytics.auth.currentUser.getIdToken(true)])
  pass('distinct_authenticated_owner_foreign_and_system_bound_consumers')

  const grant = await call(owner, 'setCanonicalConsent', {
    purpose: 'memory.storage', status: 'granted', surface: 'r1584-synthetic-grant',
  })
  assert.equal(grant.status, 'granted')
  assert.equal(grant.consentTier, 'C1')
  assert.match(grant.receiptHash, /^[a-f0-9]{64}$/)
  const consentRef = db.collection('consentRecords').doc(grant.consentId)
  assert.equal((await consentRef.get()).data()?.uid, ownerUid)
  const allowed = await call(owner, 'evaluateCanonicalConsent', {
    purpose: 'memory.storage', correlationId: 'r1584-before-revoke',
  })
  assert.equal(allowed.allowed, true)
  pass('real_owner_grant_receipt_and_positive_consent')

  const revoke = await call(owner, 'setCanonicalConsent', {
    purpose: 'memory.storage', status: 'revoked', surface: 'r1584-synthetic-revoke',
  })
  assert.equal(revoke.status, 'revoked')
  assert.equal((await consentRef.get()).data()?.status, 'revoked')
  const denyAfter = await call(owner, 'evaluateCanonicalConsent', {
    purpose: 'memory.storage', correlationId: 'r1584-after-revoke',
  })
  assert.equal(denyAfter.allowed, false)
  assert.equal(denyAfter.reason, 'REVOKED')
  pass('actual_owner_revocation_denies_future_consent_decisions')

  const revokedRecord = (await consentRef.get()).data()
  assert.equal(revokedRecord.uid, ownerUid)
  const eventId = digest({
    schemaVersion: 'consent.revoked.v1',
    recordId: grant.consentId,
    uid: ownerUid,
    purpose: revokedRecord.purpose,
    consentTier: revokedRecord.consentTier,
    policyVersion: revokedRecord.policyVersion,
    receiptHash: revokedRecord.receiptHash,
  })
  const outboxRef = db.collection('consentRevocationOutbox').doc(eventId)
  const outbox = await waitFor(outboxRef, x => x.status === 'pending', 'authentic revocation outbox')
  assert.equal(outbox.eventId, eventId)
  assert.equal(outbox.uid, ownerUid)
  assert.equal(outbox.schemaVersion, 'consent.revoked.v1')
  assert.equal(outbox.sourceReceiptHash, revoke.receiptHash)
  assert.equal(outbox.priorGrantReceiptHash, grant.receiptHash)
  assert.equal(outbox.priorGrantEvidenceState, 'present')
  assert.equal(outbox.integrityHash, digest({
    eventId, recordId: grant.consentId, uid: ownerUid,
    purpose: 'memory.storage',
    priorGrantReceiptHash: grant.receiptHash,
    priorGrantEvidenceState: 'present',
  }))
  pass('native_trigger_outbox_subject_and_immutable_prior_grant_lineage')

  // R1586: no client HTTP call precedes this assertion. The Firestore trigger
  // must automatically send the new outbox to the real compiled Jobs receiver.
  const automatic = await waitFor(outboxRef, x => x.jobsTransportStatus === 'delivered', 'automatic Jobs v2 transport')
  assert.match(automatic.jobsTransportReceiptHash,/^[a-f0-9]{64}$/)
  assert.ok(automatic.jobsTransportAttempts >= 1)
  const automaticBlockId = createHash('sha256').update(ownerUid + String.fromCharCode(10) + 'memory.storage').digest('hex')
  const automaticBlock = await db.collection('jobConsentBlocks').doc(automaticBlockId).get()
  assert.equal(automaticBlock.exists,true)
  assert.equal(automaticBlock.data().schemaVersion,'consent.revoked.v2')
  assert.equal(automaticBlock.data().active,true)
  pass('automatic_privacy_outbox_trigger_delivers_real_jobs_v2_event_and_block')
  assert.notEqual((await outboxRef.get()).data().jobsAckStatus,'verified')
  pass('transport_receipt_alone_cannot_set_verified_consumer_ack')

  // R1586: actual Jobs HTTP handler in the same four-emulator project. This is a
  // *manual synthetic bridge* and does not represent an implemented dispatcher.
  const jobsEndpoint = 'http://127.0.0.1:5127/ingestConsentRevocation'
  const nativeEnvelope = {
    type: 'consent.revoked.v2',
    schemaVersion: outbox.schemaVersion,
    eventId: outbox.eventId,
    consentRecordId: outbox.consentRecordId,
    uid: outbox.uid,
    purpose: outbox.purpose,
    consentTier: outbox.consentTier,
    policyVersion: outbox.policyVersion,
    sourceReceiptHash: outbox.sourceReceiptHash,
    priorGrantReceiptHash: outbox.priorGrantReceiptHash,
    priorGrantEvidenceState: outbox.priorGrantEvidenceState,
    integrityHash: outbox.integrityHash,
    correlationId: outbox.eventId,
    revokedAt: outbox.createdAt.toDate().toISOString(),
  }
  const syntheticBearer = 'R1586_Synthetic_Emulator_Event_Only'
  async function postJobs(data, bearer=syntheticBearer) {
    const response = await fetch(jobsEndpoint, {
      method: 'POST',
      headers: { authorization: 'Bearer ' + bearer, 'content-type': 'application/json' },
      body: JSON.stringify(data),
    })
    const body = await response.json()
    return {status:response.status, body}
  }
  const deniedBearer = await postJobs(nativeEnvelope,'wrong-synthetic-token')
  assert.equal(deniedBearer.status,401)
  pass('actual_jobs_http_wrong_bearer_denied')
  const corruptIntegrity = await postJobs({...nativeEnvelope,integrityHash:'f'.repeat(64)})
  assert.equal(corruptIntegrity.status,400)
  pass('actual_jobs_http_corrupt_prior_grant_integrity_denied')
  const delivered = await postJobs(nativeEnvelope)
  assert.equal(delivered.status,200,JSON.stringify(delivered.body))
  assert.equal(delivered.body.ok,true)
  assert.equal(delivered.body.acknowledgement.schemaVersion,'consent.revoked.v2')
  assert.equal(delivered.body.acknowledgement.sourceReceiptHash,outbox.sourceReceiptHash)
  const blockId=createHash('sha256').update(ownerUid + String.fromCharCode(10) + 'memory.storage').digest('hex')
  const jobsBlock = await db.collection('jobConsentBlocks').doc(blockId).get()
  assert.equal(jobsBlock.exists,true)
  assert.equal(jobsBlock.data().active,true)
  assert.equal(jobsBlock.data().schemaVersion,'consent.revoked.v2')
  pass('actual_jobs_v2_delivery_receipt_and_active_block_persisted')
  const retry = await postJobs(nativeEnvelope)
  assert.equal(retry.status,200,JSON.stringify(retry.body))
  assert.equal(retry.body.acknowledgement.eventId,eventId)
  const collisions = await postJobs({...nativeEnvelope,revokedAt:'2026-11-19T00:00:00.000Z'})
  assert.equal(collisions.status,409)
  pass('actual_jobs_v2_replay_idempotent_timestamp_collision_denied')
  const v1AfterV2 = await postJobs({
    type:'consent.revoked.v1', eventId:'legacy-after-v2',
    ownerUid, purpose:'memory.storage', policyVersion:'legacy',
    decisionReceiptId:'legacy-source', correlationId:'legacy-correlation',
    revokedAt:nativeEnvelope.revokedAt,
  })
  assert.equal(v1AfterV2.status,409)
  pass('actual_jobs_v1_cannot_downgrade_v2_enforced_block')
  const actualJobsReceiptHash = delivered.body.acknowledgement.integrityHash
  assert.match(actualJobsReceiptHash,/^[a-f0-9]{64}$/)

  const payload = {
    eventId, consumerId: 'urai-jobs', status: 'applied',
    correlationId: eventId, detailHash: actualJobsReceiptHash,
  }
  await denied(() => call(anonymous, 'acknowledgeConsentRevocation', payload),
    'unauthenticated', 'anonymous_acknowledgement_denied')
  await denied(() => call(owner, 'acknowledgeConsentRevocation', payload),
    'permission-denied', 'ordinary_owner_cannot_self_acknowledge_provider')
  await denied(() => call(stranger, 'acknowledgeConsentRevocation', payload),
    'permission-denied', 'stranger_cannot_acknowledge_provider')
  await denied(() => call(analytics, 'acknowledgeConsentRevocation', payload),
    'permission-denied', 'cross_consumer_id_claim_cannot_ack_for_jobs')
  await denied(() => call(jobs, 'acknowledgeConsentRevocation', { ...payload, eventId: 'b'.repeat(64) }),
    'not-found', 'no_ack_for_unknown_event_id')
  assert.equal((await outboxRef.collection('acknowledgements').get()).size, 0)
  pass('denied_calls_did_not_create_any_acknowledgement')

  const ack = await call(jobs, 'acknowledgeConsentRevocation', payload)
  assert.equal(ack.eventId, eventId)
  assert.equal(ack.consumerId, 'urai-jobs')
  assert.equal(ack.status, 'applied')
  assert.equal(ack.idempotent, false)
  assert.ok(ack.auditId)
  const jobsAck = (await outboxRef.collection('acknowledgements').doc('urai-jobs').get()).data()
  assert.equal(jobsAck.actorUid, jobsUid)
  assert.equal(jobsAck.consumerId, 'urai-jobs')
  assert.equal(jobsAck.status, 'applied')
  assert.equal(jobsAck.detailHash, payload.detailHash)
  const audit = (await db.collection('auditLogs').doc(ack.auditId).get()).data()
  assert.equal(audit.action, 'consent_revocation_acknowledged')
  assert.equal(audit.targetUid, ownerUid)
  assert.equal(audit.metadata.eventId, eventId)
  assert.equal(audit.metadata.consumerId, 'urai-jobs')
  assert.equal((await outboxRef.get()).data().lastAcknowledgedConsumer, 'urai-jobs')
  pass('authenticated_system_bound_jobs_acknowledgement_persists_audit_and_receipt')
  const terminalAck = await waitFor(outboxRef, x => x.jobsAckStatus === 'verified', 'native consumer ACK reconciliation')
  assert.equal(terminalAck.jobsAckConsumer, 'urai-jobs')
  assert.equal(terminalAck.jobsAckVerifiedReceiptHash, actualJobsReceiptHash)
  pass('authenticated_jobs_consumer_ack_automatically_reconciles_receipt_to_terminal_verified')

  const repeated = await call(jobs, 'acknowledgeConsentRevocation', payload)
  assert.equal(repeated.idempotent, true)
  assert.equal(repeated.auditId, null)
  assert.equal((await outboxRef.collection('acknowledgements').get()).size, 1)
  await denied(() => call(jobs, 'acknowledgeConsentRevocation', { ...payload, detailHash: 'f'.repeat(64) }),
    'already-exists', 'conflicting_immutable_acknowledgement_refused')
  pass('idempotent_retry_keeps_one_immutable_provider_receipt')

  // Adversarial independent synthetic outbox: privileged emulator seed must NOT
  // be mistaken for trustworthy canonical revocation publication.
  const forgedId = 'e'.repeat(64)
  const forgedRef = db.collection('consentRevocationOutbox').doc(forgedId)
  await forgedRef.create({
    schemaVersion: 'consent.revoked.v1',
    eventId: forgedId,
    uid: strangerUid,
    status: 'pending',
    // Missing consentRecordId, purpose, receipt hashes, lineage, integrityHash.
  })
  await denied(() => call(jobs, 'acknowledgeConsentRevocation', { ...payload, eventId: forgedId }),
    'failed-precondition', 'forged_incomplete_outbox_cannot_be_accepted_as_acknowledgeable')
  assert.equal((await forgedRef.collection('acknowledgements').get()).size, 0)
  pass('no_provider_ack_or_audit_written_for_incomplete_outbox')
  const quarantined = await waitFor(forgedRef, x => x.jobsTransportStatus === 'quarantined', 'forged outbox quarantine')
  assert.equal(quarantined.jobsTransportReason,'invalid-canonical-outbox')
  pass('malformed_outbox_quarantined_without_jobs_transport_or_consumer_ack')

  const current = (await consentRef.get()).data()
  assert.equal(current.status, 'revoked')
  assert.equal(current.uid, ownerUid)
  console.log('R1584_NATIVE_CONSENT_REVOCATION_ACK_RESULT ' + JSON.stringify({
    source: EXPECTED_SHA, projectId: PROJECT, checksPassed: checks.length,
    checks, ownerUidVerified: !!ownerUid, consumerClaimVerified: true,
    providerDeliveryVerified: false, emulatedAutomatedDeliveryVerified: true, providerActualEffectVerified: false,
    emulatorIdentityOnly: true, productionWrites: false, cloudIAMVerified: false,
    independentSecurityApproval: false, releaseApproved: false,
  }))
}
const timer = setTimeout(() => { console.error('R1584_TIMEOUT'); process.exit(90) }, 165000)
timer.unref()
run().catch(error => {
  console.error('R1584_FAIL', error?.code ?? error?.name, error?.message)
  process.exitCode = 1
}).finally(async () => {
  clearTimeout(timer)
  await Promise.allSettled(apps.map(deleteApp))
  if (admin) await deleteAdminApp(admin)
})
