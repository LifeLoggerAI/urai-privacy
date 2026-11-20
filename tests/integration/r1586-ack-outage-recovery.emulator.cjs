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
const extraAdminCleanup=[]
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

  // R1586 review harness accepts only an explicit disposable loopback receiver.
  const jobsEndpoint = process.env.URAI_R1586_JOBS_ENDPOINT ||
    ('http://127.0.0.1:5001/' + PROJECT + '/us-central1/ingestConsentRevocation')
  const jobsEndpointUrl = new URL(jobsEndpoint)
  assert.equal(jobsEndpointUrl.protocol, 'http:')
  assert.equal(jobsEndpointUrl.hostname, '127.0.0.1')
  assert.match(jobsEndpointUrl.port, /^[1-9][0-9]{0,4}$/)
  assert.equal(jobsEndpointUrl.pathname, '/' + PROJECT + '/us-central1/ingestConsentRevocation')
  assert.equal(jobsEndpointUrl.username, '')
  assert.equal(jobsEndpointUrl.password, '')
  assert.equal(jobsEndpointUrl.search, '')
  assert.equal(jobsEndpointUrl.hash, '')
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
    correlationId: 'r1584-jobs-confirmed-' + suffix, detailHash: actualJobsReceiptHash,
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
  const acknowledgementRows = await outboxRef.collection('acknowledgements').get()
  // The native dispatcher may already have reconciled the legitimate Jobs ACK.
  // Denied calls must not add a second acknowledgement or alter its binding.
  assert.equal(acknowledgementRows.size, 1)
  const automaticAck = acknowledgementRows.docs[0].data()
  assert.equal(automaticAck.consumerId, 'urai-jobs')
  // The event is bound by its immutable outbox path and consumer document ID.
  // The receiver's actual system identity and receipt bind the body.
  assert.equal(automaticAck.actorUid, 'synthetic-jobs-consumer')
  assert.equal(automaticAck.actorRole, 'system')
  assert.equal(automaticAck.status, 'applied')
  assert.equal(automaticAck.correlationId, eventId)
  assert.equal(automaticAck.detailHash, actualJobsReceiptHash)
  assert.equal((await outboxRef.get()).data().lastAcknowledgedConsumer, 'urai-jobs')
  pass('denied_calls_preserved_the_single_legitimate_jobs_acknowledgement')

  // A different authenticated Jobs actor cannot overwrite the automatic
  // receiver ACK. HTTP replay above already exercised the receiver's own
  // idempotent delivery using its configured system identity.
  await denied(() => call(jobs, 'acknowledgeConsentRevocation', payload),
    'already-exists', 'different_authenticated_jobs_actor_cannot_replace_automatic_ack')
  assert.equal((await outboxRef.collection('acknowledgements').get()).size, 1)
  await denied(() => call(jobs, 'acknowledgeConsentRevocation', { ...payload, detailHash: 'f'.repeat(64) }),
    'already-exists', 'conflicting_immutable_acknowledgement_refused')
  pass('receiver_replay_keeps_one_immutable_provider_receipt')

  // Fixed-URL network outage, authenticated retry, native reconciliation.
  const callback='http://127.0.0.1:5003/'+PROJECT+'/us-central1/acknowledgeConsentRevocation';
  async function control(action) {
    const r=await fetch('http://127.0.0.1:5004/'+action,{method:action==='status'?'GET':'POST'});
    assert.equal(r.status,200); const v=await r.json(); assert.equal(v.endpoint,callback); return v;
  }
  const initial=await control('status');
  assert.equal(initial.listening,true); assert.ok(initial.successes>=1);
  const armed=await control('arm'); assert.equal(armed.listening,true); assert.equal(armed.armed,true);
  pass('same_ack_listener_armed_to_interrupt_after_durable_enforcement');
  const grant2=await call(stranger,'setCanonicalConsent',{purpose:'memory.storage',status:'granted',surface:'r1586-network-outage'});
  assert.equal(grant2.status,'granted');
  assert.equal((await call(stranger,'evaluateCanonicalConsent',{purpose:'memory.storage',correlationId:'outage-grant-'+suffix})).allowed,true);
  pass('outage_subject_has_genuine_authenticated_grant');
  const revoke2=await call(stranger,'setCanonicalConsent',{purpose:'memory.storage',status:'revoked',surface:'r1586-network-outage'});
  assert.equal(revoke2.status,'revoked');
  const record2=(await db.collection('consentRecords').doc(grant2.consentId).get()).data();
  const event2=digest({schemaVersion:'consent.revoked.v1',recordId:grant2.consentId,uid:strangerUid,purpose:record2.purpose,consentTier:record2.consentTier,policyVersion:record2.policyVersion,receiptHash:record2.receiptHash});
  const ref2=db.collection('consentRevocationOutbox').doc(event2);
  const pending=await waitFor(ref2,r=>r.jobsTransportStatus==='retry_pending','native dispatch network failure');
  assert.equal(pending.sourceReceiptHash,revoke2.receiptHash); assert.equal(pending.priorGrantReceiptHash,grant2.receiptHash);
  assert.ok(pending.jobsTransportAttempts>=1); assert.notEqual(pending.jobsAckStatus,'verified');
  const stopped=await control('status'); assert.equal(stopped.listening,false); assert.equal(stopped.dropped,initial.dropped+1);
  await assert.rejects(fetch(callback,{method:'POST',body:'{}'}),/fetch failed/);
  pass('native_dispatch_persists_retry_pending_after_network_failure');
  const blockRef2=db.collection('jobConsentBlocks').doc(createHash('sha256').update(strangerUid+'\n'+'memory.storage').digest('hex'));
  const receiptRef2=db.collection('jobConsentEventReceipts').doc(createHash('sha256').update(event2).digest('hex'));
  const block2=(await blockRef2.get()).data(), receipt2=(await receiptRef2.get()).data();
  assert.equal(block2.active,true); assert.equal(block2.schemaVersion,'consent.revoked.v2');
  assert.equal(receipt2.eventId,event2); assert.equal(receipt2.ownerUid,strangerUid); assert.notEqual(receipt2.privacyAckStatus,'applied');
  assert.equal((await ref2.collection('acknowledgements').get()).size,0);
  pass('durable_jobs_enforcement_receipt_precedes_ack_and_remains_active');
  const denial=await call(stranger,'evaluateCanonicalConsent',{purpose:'memory.storage',correlationId:'outage-denial-'+suffix});
  assert.equal(denial.allowed,false); assert.equal(denial.reason,'REVOKED');
  pass('canonical_access_stays_denied_through_ack_outage');
  const jobsRoot=process.env.URAI_JOBS_EXACT_ROOT;
  const jobsSha=process.env.URAI_JOBS_EXACT_SHA;
  assert.match(jobsSha||'',/^[a-f0-9]{40}$/);
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:jobsRoot,encoding:'utf8'}).trim(),jobsSha);
  assert.equal(execFileSync('git',['status','--porcelain','--untracked-files=no'],{cwd:jobsRoot,encoding:'utf8'}).trim(),'');
  const {createRequire}=require('node:module'), {pathToFileURL}=require('node:url');
  const requireJobs=createRequire(jobsRoot+'/functions/package.json');
  const jobsAdmin=requireJobs('firebase-admin/app');
  const existingJobAdmin=jobsAdmin.getApps().find(a=>a.name==='[DEFAULT]');
  const jobAdmin=existingJobAdmin||jobsAdmin.initializeApp({projectId:PROJECT});
  assert.equal(jobAdmin.options.projectId,PROJECT);
  if(!existingJobAdmin) extraAdminCleanup.push(()=>jobAdmin.delete());
  const {executeJob}=await import(pathToFileURL(jobsRoot+'/functions/lib/functions/jobs/executeJob.js').href);
  const paths=await import(pathToFileURL(jobsRoot+'/functions/lib/functions/core/firestore-paths.js').href);
  const jobId='synthetic-ack-outage-'+suffix, leaseToken='synthetic-lease-'+suffix;
  const jobRef=paths.jobDoc(jobId), queueRef=paths.jobQueueEntryDoc(jobId);
  await jobRef.set({jobId,ownerUid:strangerUid,type:'synthetic.no-provider',jobType:'synthetic.no-provider',status:'LEASED',payload:{},consent:{purpose:'memory.storage',policyVersion:record2.policyVersion,decisionReceiptId:grant2.receiptHash},lease:{leaseToken},execution:{attemptCount:0},retryCount:0});
  await queueRef.set({jobId,status:'LEASED',lease:{leaseToken}});
  await executeJob.run({data:{message:{json:{jobId,leaseToken}}}});
  assert.equal((await jobRef.get()).data().status,'CANCELLED'); assert.equal((await queueRef.get()).data().status,'CANCELLED');
  assert.equal((await jobRef.get()).data().execution.attemptCount,0);
  pass('actual_jobs_execute_handler_cancels_revoked_work_before_dispatch');
  const envelope2={type:'consent.revoked.v2',schemaVersion:pending.schemaVersion,eventId:event2,consentRecordId:pending.consentRecordId,uid:strangerUid,purpose:pending.purpose,consentTier:pending.consentTier,policyVersion:pending.policyVersion,sourceReceiptHash:pending.sourceReceiptHash,priorGrantReceiptHash:pending.priorGrantReceiptHash,priorGrantEvidenceState:pending.priorGrantEvidenceState,integrityHash:pending.integrityHash,correlationId:event2,revokedAt:pending.createdAt.toDate().toISOString()};
  const during=await postJobs(envelope2); assert.equal(during.status,503); assert.equal(during.body.error,'privacy-authenticated-ack-incomplete');
  assert.equal((await blockRef2.get()).data().active,true); assert.equal((await ref2.collection('acknowledgements').get()).size,0);
  pass('repeated_delivery_returns_retryable_503_without_clearing_block');
  assert.equal((await postJobs(envelope2,'synthetic-wrong-bearer')).status,401);
  assert.equal((await postJobs({...envelope2,uid:ownerUid})).status,400);
  assert.equal((await postJobs({...envelope2,revokedAt:'2026-11-18T00:00:00.000Z'})).status,409);
  assert.equal((await postJobs({type:'consent.revoked.v1',eventId:'legacy-outage-'+suffix,ownerUid:strangerUid,purpose:'memory.storage',policyVersion:'legacy',decisionReceiptId:'legacy',correlationId:'legacy',revokedAt:envelope2.revokedAt})).status,409);
  pass('during_outage_bad_bearer_cross_user_replay_conflict_and_downgrade_denied');
  await denied(()=>call(owner,'acknowledgeConsentRevocation',{eventId:event2,consumerId:'urai-jobs',status:'applied',correlationId:event2,detailHash:receipt2.integrityHash}),'permission-denied','unrelated_authenticated_user_cannot_finish_pending_ack');
  assert.equal((await ref2.collection('acknowledgements').get()).size,0);
  const restarted=await control('start'); assert.equal(restarted.listening,true); assert.equal(restarted.endpoint,initial.endpoint); assert.equal(restarted.starts,initial.starts+1);
  pass('original_ack_listener_recovered_at_unchanged_endpoint');
  // Deterministic at-least-once event redelivery; does not certify provider timing/backoff.
  const requirePrivacy=createRequire(require.resolve('../../functions/package.json'));
  const privacyAdmin=requirePrivacy('firebase-admin/app');
  const existingPrivacyDefault=privacyAdmin.getApps().find(a=>a.name==='[DEFAULT]');
  const privacyDefault=existingPrivacyDefault||privacyAdmin.initializeApp({projectId:PROJECT});
  assert.equal(privacyDefault.options.projectId,PROJECT);
  if(!existingPrivacyDefault) extraAdminCleanup.push(()=>privacyDefault.delete());
  const {dispatchConsentRevocationToJobs}=require('../../functions/lib/consent-revocation-dispatch.js');
  await dispatchConsentRevocationToJobs.run({params:{eventId:event2},data:await ref2.get()});
  const recovered=await waitFor(ref2,r=>r.jobsTransportStatus==='delivered'&&r.jobsAckStatus==='verified','native retry and terminal ACK reconciliation');
  assert.equal(recovered.jobsTransportReceiptHash,receipt2.integrityHash); assert.equal(recovered.jobsAckVerifiedReceiptHash,receipt2.integrityHash);
  assert.ok(recovered.jobsTransportAttempts>pending.jobsTransportAttempts);
  pass('native_dispatcher_redelivery_reaches_authenticated_ack_and_terminal_reconciliation');
  const ackRef2=ref2.collection('acknowledgements').doc('urai-jobs'), ack2=(await ackRef2.get()).data();
  assert.equal(ack2.actorUid,'synthetic-jobs-consumer'); assert.equal(ack2.actorRole,'system'); assert.equal(ack2.status,'applied'); assert.equal(ack2.correlationId,event2); assert.equal(ack2.detailHash,receipt2.integrityHash);
  assert.equal((await receiptRef2.get()).data().privacyAckStatus,'applied');
  pass('real_consumer_identity_reconciles_original_durable_receipt');
  const ackDigest=digest(ack2);
  for(let n=0;n<3;n++){const replay=await postJobs(envelope2);assert.equal(replay.status,200);assert.equal(replay.body.acknowledgement.integrityHash,receipt2.integrityHash);}
  await dispatchConsentRevocationToJobs.run({params:{eventId:event2},data:await ref2.get()});
  assert.equal((await ref2.collection('acknowledgements').get()).size,1); assert.equal(digest((await ackRef2.get()).data()),ackDigest);
  assert.equal((await receiptRef2.get()).data().receivedAt.toMillis(),receipt2.receivedAt.toMillis()); assert.equal((await blockRef2.get()).data().active,true);
  pass('repeated_delivery_preserves_single_immutable_ack_and_original_receipt');
  assert.equal((await call(stranger,'evaluateCanonicalConsent',{purpose:'memory.storage',correlationId:'outage-after-'+suffix})).allowed,false);
  pass('revoked_access_remains_denied_after_successful_ack_recovery');
  console.log('ACK_OUTAGE_RECOVERY_DETAILS '+JSON.stringify({privacyCommit:EXPECTED_SHA,jobsCommit:jobsSha,jobsTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{cwd:jobsRoot,encoding:'utf8'}).trim(),callbackEndpointChanged:false,retryDriver:'explicit original-event redelivery into actual compiled native dispatcher',nativeInitialDispatch:true,authenticatedAutomaticAck:true,nativeReconciliation:true,providerRetryScheduleVerified:false,liveCloudIAMVerified:false,productionWrites:false}));

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
const timer = setTimeout(() => { console.error('R1584_TIMEOUT'); process.exit(90) }, 240000)
timer.unref()
run().catch(error => {
  console.error('R1584_FAIL', error?.code ?? error?.name, error?.message)
  process.exitCode = 1
}).finally(async () => {
  clearTimeout(timer)
  await Promise.allSettled(apps.map(deleteApp))
  if (admin) await deleteAdminApp(admin)
  await Promise.allSettled(extraAdminCleanup.map(cleanup=>cleanup()))
})
