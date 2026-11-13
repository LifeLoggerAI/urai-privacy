/**
 * R1122: actual Firebase Auth + Functions + Firestore emulator positive C1
 * owner-consent acceptance. Synthetic account/data ONLY. No Life Movie C6
 * grants, no Storage objects, and no production authorization.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

const PROJECT = 'urai-privacy-integration-test';
const EXPECTED = process.env.URAI_EXPECTED_PRIVACY_SHA;
const REQUIRED = {
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_FUNCTIONS_EMULATOR_HOST: '127.0.0.1:5001',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
};
const FORBIDDEN = [
  'RUNPOD_API_KEY','GITHUB_TOKEN','GH_TOKEN','GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_TOKEN','FIREBASE_CLI_TOKEN','GOOGLE_OAUTH_ACCESS_TOKEN',
  'GOOGLE_CLOUD_ACCESS_TOKEN','GCS_BUCKET_NAME','FIREBASE_STORAGE_BUCKET',
  'GOOGLE_CLOUD_STORAGE_BUCKET',
];
function pass(message) { console.log('[R1122 PASS] ' + message); }
assert.match(EXPECTED || '', /^[a-f0-9]{40}$/, 'exact Privacy SHA required');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), EXPECTED);
assert.equal(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' }).trim(), '');
for (const [name, value] of Object.entries(REQUIRED)) assert.equal(process.env[name], value, 'missing emulator: ' + name);
for (const name of FORBIDDEN) assert.equal(process.env[name] || '', '', 'credential or provider target present: ' + name);
for (const name of ['GCLOUD_PROJECT','GOOGLE_CLOUD_PROJECT','CLOUDSDK_CORE_PROJECT','FIREBASE_PROJECT_ID']) {
  assert.ok(!process.env[name] || process.env[name] === PROJECT, 'non-disposable project: ' + name);
}
assert.equal(process.env.URAI_EMULATOR_PROJECT, PROJECT, 'disposable project selection required');
if (process.env.FIREBASE_CONFIG) {
  const cfg = JSON.parse(process.env.FIREBASE_CONFIG);
  assert.equal(cfg.projectId, PROJECT, 'Firebase config project mismatch');
  assert.equal(cfg.storageBucket, PROJECT + '.appspot.com', 'Firebase config bucket mismatch');
}
pass('DISPOSABLE_EMULATOR_AND_SOURCE_GUARDS');

const clientApp = initializeClientApp({
  projectId: PROJECT, apiKey: 'R1122_Local_Emulator_Only_Key',
  authDomain: PROJECT + '.firebaseapp.com', appId: '1:12345:web:r1122synthetic',
}, 'r1122-owner-client');
const ownerAuth = getAuth(clientApp);
connectAuthEmulator(ownerAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
const ownerFunctions = getFunctions(clientApp, 'us-central1');
connectFunctionsEmulator(ownerFunctions, '127.0.0.1', 5001);
const adminApp = initializeAdminApp({ projectId: PROJECT }, 'r1122-local-admin');
const db = getAdminFirestore(adminApp);
const setConsent = httpsCallable(ownerFunctions, 'setCanonicalConsent');
const evaluateConsent = httpsCallable(ownerFunctions, 'evaluateCanonicalConsent');
let ownerUid = '';

try {
  const signup = await createUserWithEmailAndPassword(
    ownerAuth, 'r1122-owner@synthetic.invalid', 'R1122EmulatorOnlyNotARealPassword123!'
  );
  ownerUid = signup.user.uid;
  assert.ok(ownerUid);
  pass('ACTUAL_AUTH_EMULATOR_OWNER_CREATED');

  const grant = (await setConsent({
    purpose: 'memory.storage', status: 'granted',
    surface: 'r1122-emulator-consent', jurisdiction: 'synthetic-test',
  })).data;
  assert.equal(grant.status, 'granted');
  assert.equal(grant.consentTier, 'C1');
  assert.match(grant.receiptHash, /^[0-9a-f]{64}$/);
  assert.equal(grant.consentId, ownerUid + '_memory_storage');
  const consentRef = db.collection('consentRecords').doc(grant.consentId);
  const record = await consentRef.get();
  assert.equal(record.exists, true);
  assert.equal(record.data()?.uid, ownerUid);
  assert.equal(record.data()?.status, 'granted');
  assert.equal(record.data()?.receiptHash, grant.receiptHash);
  assert.equal((await db.collection('consentEvents').doc(grant.consentEventId).get()).exists, true);
  assert.equal((await db.collection('auditLogs').doc(grant.auditId).get()).exists, true);
  pass('OWNER_C1_GRANT_TRANSACTION_AND_AUDIT_CONFIRMED');

  const allowed = (await evaluateConsent({
    purpose: 'memory.storage', correlationId: 'r1122-allowed-correlation',
  })).data;
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.reason, 'ALLOWED');
  assert.equal(allowed.targetUid, ownerUid);
  assert.equal((await db.collection('dataAccessEvents').doc(allowed.decisionEventId).get()).data()?.decision, 'allow');
  pass('REAL_CALLABLE_OWNER_POSITIVE_CONSENT_ALLOW');

  await assert.rejects(
    evaluateConsent({ purpose: 'memory.storage', targetUid: 'other-synthetic-owner',
      correlationId: 'r1122-cross-owner-denial' }),
    e => { assert.equal(e?.code, 'functions/permission-denied'); return true; }
  );
  pass('CROSS_OWNER_EVALUATION_DENIED');

  const revoke = (await setConsent({
    purpose: 'memory.storage', status: 'revoked',
    surface: 'r1122-emulator-withdrawal', jurisdiction: 'synthetic-test',
  })).data;
  assert.equal(revoke.status, 'revoked');
  assert.equal(revoke.expiresAt, null);
  assert.equal((await consentRef.get()).data()?.status, 'revoked');
  assert.equal((await db.collection('consentEvents').doc(revoke.consentEventId).get()).exists, true);
  assert.equal((await db.collection('auditLogs').doc(revoke.auditId).get()).exists, true);
  const after = (await evaluateConsent({
    purpose: 'memory.storage', correlationId: 'r1122-after-revocation',
  })).data;
  assert.equal(after.allowed, false);
  assert.equal(after.reason, 'REVOKED');
  assert.equal((await db.collection('dataAccessEvents').doc(after.decisionEventId).get()).data()?.decision, 'deny');
  pass('REVOCATION_TRANSACTION_AND_SUBSEQUENT_DENIAL_CONFIRMED');

  await db.collection('privacyDeletionTombstones').doc(ownerUid).set({active:true, source:'r1122-disposable-emulator'});
  await assert.rejects(
    setConsent({ purpose: 'memory.storage', status: 'granted',
      surface: 'r1122-after-deletion-fence', jurisdiction: 'synthetic-test' }),
    e => { assert.equal(e?.code, 'functions/failed-precondition'); return true; }
  );
  assert.equal((await consentRef.get()).data()?.status, 'revoked', 'failed grant must not replace revoked record');
  pass('ACTIVE_DELETION_FENCE_BLOCKS_NEW_CONSENT_GRANT');

  await assert.rejects(
    setConsent({ purpose: 'life-movie.render', status: 'granted',
      surface: 'r1122-unapproved-c6', jurisdiction: 'synthetic-test' }),
    e => { assert.equal(e?.code, 'functions/failed-precondition'); return true; }
  );
  assert.equal((await db.collection('consentRecords').doc(ownerUid + '_life-movie_render').get()).exists, false);
  for (const name of ['jobs','jobQueueEntries']) assert.equal((await db.collection(name).get()).size, 0);
  pass('LIFE_MOVIE_C6_UNAPPROVED_AND_RENDER_QUEUE_EMPTY');

  console.log('R1122_CANONICAL_C1_NATIVE_POSITIVE_REVOKE_FENCE_PASS privacy=' + EXPECTED +
    ' purpose=memory.storage positiveC1=true revoked=true deletionFence=true lifeMovieC6=false render=false privateWrites=false productionAuthorized=false');
} finally {
  await Promise.allSettled([deleteClientApp(clientApp), deleteAdminApp(adminApp)]);
}
