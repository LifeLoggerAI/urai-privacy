'use strict';

// This disposable Privacy test supplies a synthetic Jobs-origin audit.
// Governed Jobs execution is verified separately.
const assert = require('node:assert/strict');
const { createHash, randomBytes, generateKeyPairSync } = require('node:crypto');
const { initializeApp, deleteApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, signInWithCustomToken } = require('firebase/auth');
const { getFunctions, connectFunctionsEmulator, httpsCallable } = require('firebase/functions');
const { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, updateDoc } = require('firebase/firestore');
const { initializeApp: adminApp, deleteApp: deleteAdmin, cert } = require('firebase-admin/app');
const { getAuth: adminAuth } = require('firebase-admin/auth');
const { getFirestore: adminDb, FieldValue } = require('firebase-admin/firestore');

const project = 'urai-privacy-r1512-disposable';
const jobsProject = 'urai-jobs-r1624-disposable';
assert.equal(process.env.GCLOUD_PROJECT, project);
assert.equal(process.env.URAI_JOBS_DELETION_SOURCE_PROJECT, jobsProject);
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199');
const serviceUid = process.env.URAI_JOBS_PRIVACY_DELETION_SERVICE_UID;
assert.match(serviceUid || '', /^[a-zA-Z0-9._:-]{3,127}$/);
for (const name of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN', 'RUNPOD_API_KEY', 'VERCEL_TOKEN']) {
  assert.equal(process.env[name], undefined, name);
}

const id = randomBytes(8).toString('hex');
const sha = value => createHash('sha256').update(value).digest('hex');
const key = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ format: 'pem', type: 'pkcs8' });
const sdk = adminApp({ projectId: project, credential: cert({
  projectId: project, clientEmail: 'review@' + project + '.iam.gserviceaccount.com', privateKey: key
}) }, id + '-privacy');
const sourceSdk = adminApp({ projectId: jobsProject }, id + '-jobs');
const db = adminDb(sdk);
const source = adminDb(sourceSdk);
const clients = [];
const checks = [];
const pass = name => checks.push(name);
const checked = (who, name, payload) => httpsCallable(who.fn, name, { timeout: 45000 })(payload).then(reply => reply.data);
const denied = (promise, code) => assert.rejects(promise, error => {
  assert.equal(error.code, code);
  return true;
});

async function client(uid, claims = {}) {
  const app = initializeApp({ projectId: project, appId: '1:123:web:review', apiKey: 'disposable' }, id + uid);
  clients.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  await signInWithCustomToken(auth, await adminAuth(sdk).createCustomToken(uid, claims));
  const fn = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(fn, '127.0.0.1', 5001);
  const store = getFirestore(app);
  connectFirestoreEmulator(store, '127.0.0.1', 8080);
  return { fn, store };
}

async function main() {
  const uid = 'owner-' + id;
  const [owner, operator, jobs, other] = await Promise.all([
    client(uid), client('admin-' + id, { admin: true }),
    client(serviceUid, { system: true, role: 'system', consumerId: 'urai-jobs' }), client('other-' + id)
  ]);
  const { requestId } = await checked(owner, 'createDeletionRequest', { reason: 'Disposable progress verification' });
  await checked(operator, 'processDeletionRequest', { requestId, status: 'processing' });
  const central = db.collection('deletionRequests').doc(requestId);
  const subjectRef = doc(owner.store, central.path);
  const priorRequest = (await getDocFromServer(subjectRef)).data();
  assert.equal(priorRequest.scope, 'account');
  assert.equal(priorRequest.uid, uid);
  assert.equal(priorRequest.jobsDeletionEvidenceState, undefined);
  pass('owner submitted a real account deletion request without participant progress');

  const jobsRequestId = 'jobs-' + id;
  const job = source.collection('dataRightsRequests').doc(jobsRequestId);
  await job.set({ requestId: jobsRequestId, ownerUid: uid, requestType: 'DELETE', status: 'APPROVED',
    executionState: 'PENDING', createdAt: FieldValue.serverTimestamp() });
  await job.collection('audit').doc('submitted').set({ event: 'DATA_RIGHTS_REQUEST_SUBMITTED',
    actorUid: uid, status: 'PENDING', createdAt: FieldValue.serverTimestamp() });
  const binding = { centralRequestId: requestId, jobsRequestId };
  const authorized = await checked(operator, 'authorizeJobsDeletionBinding', binding);
  assert.equal(authorized.authorized, true);
  assert.equal(authorized.globalDeletionComplete, false);
  pass('canonical Privacy binding callable admitted the matching synthetic Jobs submission');

  const result = { jobResultDeletes: 1, jobsAnonymized: 1, logDeletes: 0, queueDeletes: 0,
    unresolvedDomains: ['cross-system-data-owned-by-other-urai-services', 'orphan-job-results-without-parent-job'] };
  const sourceRef = job.collection('audit').doc('execution-' + sha(id).slice(0, 24));
  const receipt = { schemaVersion: 'urai-jobs-data-rights-execution-v1', event: 'DATA_RIGHTS_EXECUTION_FINISHED',
    requestId: jobsRequestId, requestType: 'DELETE', ownerHash: sha(uid), resultDigest: sha(JSON.stringify(result)),
    terminalState: 'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED', result };
  await job.update({ status: 'IN_REVIEW', executionState: receipt.terminalState, executionReceiptPath: sourceRef.path });
  const send = (who, value = receipt) => checked(who, 'recordJobsDeletionParticipantEvidence', { ...binding, receipt: value });
  await denied(send(jobs), 'functions/failed-precondition');
  assert.equal((await central.get()).get('jobsDeletionEvidenceState'), undefined);
  pass('missing independent Jobs audit kept the request unchanged');
  await sourceRef.set(receipt);
  await denied(send(owner), 'functions/permission-denied');
  await denied(send(jobs, { ...receipt, ownerHash: sha('different synthetic owner') }), 'functions/failed-precondition');
  pass('ordinary owner and mismatched subject evidence rejected');

  const answers = await Promise.all([send(jobs), send(jobs)]);
  assert.deepEqual(answers.map(x => x.idempotent).sort(), [false, true]);
  assert.ok(answers.every(x => x.accepted && x.globalDeletionComplete === false && x.acknowledgmentState === 'evidence-received-verification-pending'));
  pass('simultaneous deliveries produced a single immutable receipt');
  const saved = (await getDocFromServer(subjectRef)).data();
  assert.deepEqual(saved, { ...priorRequest, jobsDeletionEvidenceState: 'source-receipt-matched' });
  pass('owner read exactly one new status field without IDs, paths, counters or digests');
  const hidden = central.collection('participantEvidence').doc('urai-jobs');
  await denied(getDocFromServer(doc(owner.store, hidden.path)), 'permission-denied');
  await denied(getDocFromServer(doc(other.store, central.path)), 'permission-denied');
  await denied(updateDoc(subjectRef, { jobsDeletionEvidenceState: 'different' }), 'permission-denied');
  pass('Firestore rules kept the private receipt, foreign request and server-written progress restricted');

  const raw = (await hidden.get()).data();
  const priorWrite = (await central.get()).updateTime;
  assert.equal((await send(jobs)).idempotent, true);
  assert.ok((await central.get()).updateTime.isEqual(priorWrite));
  assert.deepEqual((await hidden.get()).data(), raw);
  pass('exact replay preserved request version and immutable receipt');
  await central.update({ jobsDeletionEvidenceState: FieldValue.delete() });
  await hidden.update({ originVerificationState: FieldValue.delete(), sourceProject: FieldValue.delete(), sourceReceiptPath: FieldValue.delete() });
  const legacy = (await hidden.get()).data();
  await sourceRef.delete();
  await denied(send(jobs), 'functions/failed-precondition');
  assert.equal((await central.get()).get('jobsDeletionEvidenceState'), undefined);
  await sourceRef.set(receipt);
  assert.equal((await send(jobs)).idempotent, true);
  assert.equal((await central.get()).get('jobsDeletionEvidenceState'), 'source-receipt-matched');
  assert.deepEqual((await hidden.get()).data(), legacy);
  pass('historical receipt regained progress after fresh independent read and kept its original fields');
  await central.update({ jobsDeletionEvidenceState: FieldValue.delete() });
  await hidden.update({ sourceProject: jobsProject });
  await denied(send(jobs), 'functions/already-exists');
  assert.equal((await central.get()).get('jobsDeletionEvidenceState'), undefined);
  await hidden.set(raw);
  await hidden.update({ jobsResultDigest: sha('conflicting synthetic evidence') });
  await denied(send(jobs), 'functions/already-exists');
  assert.equal((await central.get()).get('jobsDeletionEvidenceState'), undefined);
  pass('partially populated provenance and conflicting immutable result preserved pending state');
  await hidden.set(raw);
  await central.update({ scope: 'privacy-data' });
  await denied(send(jobs), 'functions/failed-precondition');
  assert.equal((await central.get()).get('jobsDeletionEvidenceState'), undefined);
  await central.update({ scope: 'account' });
  await send(jobs);
  pass('non-account scope cannot acquire Jobs progress');

  const plan = await checked(operator, 'executeDeletionRequest', { requestId, mode: 'dryRun' });
  assert.match(plan.planHash, /^[0-9a-f]{64}$/);
  await assert.rejects(checked(operator, 'executeDeletionRequest', { requestId, mode: 'execute', expectedPlanHash: plan.planHash }), error => {
    assert.equal(error.code, 'functions/failed-precondition');
    assert.equal(error.details?.blocker, 'PENDING_DOWNSTREAM_DELETION_CONTRIBUTORS');
    return true;
  });
  const final = (await central.get()).data();
  assert.equal(final.status, 'processing');
  assert.equal(final.deletionCompletionVerified, false);
  assert.equal(final.deletionCompletionResidualSummary.totalResidualTargets, 0);
  const audit = (await db.collection('auditLogs').doc(final.deletionCompletionVerificationAuditId).get()).data();
  assert.equal(audit.metadata.jobsSourceReceiptMatchedAtIntake, true);
  assert.equal(audit.metadata.verified, false);
  pass('guarded execution recorded the scoped observation and kept global deletion blocked after zero local residuals');
  console.log('PRIVACY_JOBS_PARTICIPANT_PROGRESS ' + JSON.stringify({ count: checks.length, checks,
    jobsOrigin: 'synthetic protected-source fixture', hosted: false, globalDeletionComplete: false }));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await Promise.all(clients.map(app => deleteApp(app)));
  await Promise.all([deleteAdmin(sdk), deleteAdmin(sourceSdk)]);
});
