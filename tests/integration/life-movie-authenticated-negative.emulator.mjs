/**
 * Real Firebase Auth + Functions + Firestore emulator NEGATIVE admission proof.
 *
 * NONPRODUCTION ONLY. This never issues a C6 movie grant, never changes cloud
 * IAM, and never enables the Jobs render gate. Emulated system claims are
 * deliberately not a substitute for signed, non-revoked service identity.
 *
 * Run with the exact disposable Firebase project and local emulators only.
 */
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, connectAuthEmulator, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, getIdToken, signOut,
} from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = 'urai-privacy-integration-test';
const JOBS_UID = 'synthetic-jobs-verifier-uid';
const REQUIRED = {
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_FUNCTIONS_EMULATOR_HOST: '127.0.0.1:5001',
};
assert.equal(process.env.URAI_EMULATOR_PROJECT, PROJECT_ID, 'Disposable Firebase project required');
assert.equal(process.env.URAI_PRIVACY_JOBS_VERIFIER_UID, JOBS_UID, 'Synthetic Jobs pin must be configured before emulator start');
for (const [key, value] of Object.entries(REQUIRED)) {
  assert.equal(process.env[key], value, 'Required local-only emulator: ' + key);
}
for (const key of ['GOOGLE_APPLICATION_CREDENTIALS', 'FIREBASE_TOKEN']) {
  assert.equal(process.env[key] || '', '', 'Cloud credential forbidden: ' + key);
}

const config = {
  apiKey: 'synthetic-emulator-only-key',
  authDomain: PROJECT_ID + '.firebaseapp.com',
  projectId: PROJECT_ID,
  storageBucket: PROJECT_ID + '.appspot.com',
  appId: '1:1122334455:web:syntheticnegative',
};
const clients = [];
function newClient(name) {
  const app = initializeApp(config, name);
  clients.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const functions = getFunctions(app, 'us-central1');
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  const firestore = getFirestore(app);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  return { auth, functions, firestore };
}
const owner = newClient('privacy-negative-owner');
const foreign = newClient('privacy-negative-foreign');
const jobs = newClient('privacy-negative-claimed-jobs');
const anon = newClient('privacy-negative-anonymous');
const server = initializeAdminApp({ projectId: PROJECT_ID }, 'privacy-negative-admin');
const adminAuth = getAdminAuth(server);
const adminDb = getAdminFirestore(server);
const password = 'SyntheticEmulatorPasswordNeverUseOutsideLocal1!';
const checks = [];
function check(label) { checks.push(label); }
const call = (client, name, data) => httpsCallable(client.functions, name)(data);

async function mustDeny(label, promise, accepted = /permission-denied|unauthenticated|failed-precondition/) {
  let error;
  try { await promise; } catch (caught) { error = caught; }
  assert.ok(error, label + ': unsafe operation was accepted');
  const code = String(error.code || error.message || error);
  assert.match(code, accepted, label + ': unexpected failure type: ' + code);
  check(label);
}

const scope = {
  projectId: 'synthetic-movie-1',
  renderPlanDigest: 'a'.repeat(64),
  sourceSetDigest: 'b'.repeat(64),
};
function verification(subjectUid, extra = {}) {
  return {
    subjectUid, tenantId: 'synthetic-tenant-1',
    correlationId: 'synthetic-correlation-1',
    decisionReceiptId: 'c'.repeat(64),
    policyVersion: '1.1.0', renderScope: scope,
    ...extra,
  };
}
try {
  const [owned, other] = await Promise.all([
    createUserWithEmailAndPassword(owner.auth, 'privacy-movie-owner@example.test', password),
    createUserWithEmailAndPassword(foreign.auth, 'privacy-movie-foreign@example.test', password),
  ]);
  assert.ok(owned.user.uid && other.user.uid && owned.user.uid !== other.user.uid);
  check('real-auth-emulator-creates-distinct-synthetic-users');

  // Prove this is running the actual Privacy Functions and persisting into
  // the real Firestore emulator; it is not just a mocked consent function.
  const ordinary = (await call(owner, 'setCanonicalConsent', {
    purpose: 'memory.storage', status: 'granted',
  })).data;
  assert.equal(ordinary.status, 'granted');
  const memoryGrant = await getDoc(doc(owner.firestore, 'consentRecords', owned.user.uid + '_memory_storage'));
  assert.equal(memoryGrant.data()?.uid, owned.user.uid);
  assert.equal(memoryGrant.data()?.purpose, 'memory.storage');
  assert.equal(memoryGrant.data()?.status, 'granted');
  check('actual-privacy-callable-persists-ordinary-memory-consent');

  await mustDeny('global-life-movie-grant-not-issuable',
    call(owner, 'setCanonicalConsent', { purpose: 'life-movie.render', status: 'granted' }),
    /failed-precondition/);
  const movieBefore = await adminDb.collection('consentRecords')
    .doc(owned.user.uid + '_life-movie_render').get();
  assert.equal(movieBefore.exists, false, 'Rejected grant must not create movie consent');
  check('failed-life-movie-grant-does-not-create-firestore-record');

  await mustDeny('generic-purpose-evaluator-cannot-authorize-movie',
    call(owner, 'evaluateCanonicalConsent', {
      purpose: 'life-movie.render', correlationId: 'synthetic-eval-1',
    }), /failed-precondition/);

  await mustDeny('anonymous-movie-verification-denied',
    call(anon, 'verifyLifeMovieRenderConsent', verification(owned.user.uid)),
    /unauthenticated/);
  await mustDeny('ordinary-owner-movie-verification-denied',
    call(owner, 'verifyLifeMovieRenderConsent', verification(owned.user.uid)),
    /permission-denied/);
  await mustDeny('foreign-user-movie-verification-denied',
    call(foreign, 'verifyLifeMovieRenderConsent', verification(owned.user.uid)),
    /permission-denied/);
  await mustDeny('caller-supplied-system-claims-ignored',
    call(owner, 'verifyLifeMovieRenderConsent', {
      ...verification(owned.user.uid),
      auth: { uid: JOBS_UID, role: 'system', consumerId: 'urai-jobs' },
      system: true, consumerId: 'urai-jobs',
    }), /permission-denied/);

  await mustDeny('client-cannot-write-privileged-movie-receipt',
    setDoc(doc(owner.firestore, 'consentRecords', owned.user.uid + '_life-movie_render'), {
      uid: owned.user.uid, tenantId: 'synthetic-tenant-1', purpose: 'life-movie.render',
      consentTier: 'C6', status: 'granted', policyVersion: '1.1.0',
      renderScope: scope, receiptHash: 'c'.repeat(64),
    }), /permission-denied/);
  await mustDeny('foreign-client-cannot-read-ordinary-consent',
    getDoc(doc(foreign.firestore, 'consentRecords', owned.user.uid + '_memory_storage')),
    /permission-denied/);

  // Admin API used only inside local Auth emulator to simulate a hostile
  // user who has privileged-looking claims. Password provider and emulator
  // unsigned ID tokens must NEVER qualify as a verified Jobs workload token.
  await adminAuth.createUser({
    uid: JOBS_UID, email: 'privacy-fake-jobs@example.test', password,
  });
  await adminAuth.setCustomUserClaims(JOBS_UID, {
    system: true, role: 'system', consumerId: 'urai-jobs',
  });
  const spoofed = await signInWithEmailAndPassword(
    jobs.auth, 'privacy-fake-jobs@example.test', password);
  assert.equal(spoofed.user.uid, JOBS_UID);
  await getIdToken(spoofed.user, true);
  await mustDeny('password-provider-with-system-claims-is-not-jobs-identity',
    call(jobs, 'verifyLifeMovieRenderConsent', verification(owned.user.uid)),
    /permission-denied/);

  const denial = (await call(owner, 'setCanonicalConsent', {
    purpose: 'life-movie.render', status: 'denied',
  })).data;
  assert.equal(denial.status, 'denied');
  const movieAfter = await adminDb.collection('consentRecords')
    .doc(owned.user.uid + '_life-movie_render').get();
  assert.equal(movieAfter.data()?.status, 'denied');
  check('explicit-movie-denial-is-stored-but-not-a-grant');

  // Deletion state outranks otherwise valid ordinary consent updates.
  await adminDb.collection('privacyDeletionTombstones').doc(owned.user.uid)
    .set({ active: true, uid: owned.user.uid });
  await mustDeny('active-deletion-tombstone-blocks-consent-update',
    call(owner, 'setCanonicalConsent', { purpose: 'memory.storage', status: 'revoked' }),
    /failed-precondition/);
  const stillOrdinary = await getDoc(doc(owner.firestore, 'consentRecords',
    owned.user.uid + '_memory_storage'));
  assert.equal(stillOrdinary.data()?.status, 'granted');
  check('failed-transaction-does-not-mutate-consent-record');

  const output = {
    schemaVersion: 'urai-privacy-life-movie-negative-emulator-1',
    environment: 'disposable-firebase-emulators-only',
    projectId: PROJECT_ID,
    checksPassed: checks.length,
    checks,
    originalPrivacyCallableExecuted: true,
    firebaseEmulatorsUsed: ['Auth', 'Firestore', 'Functions'],
    jobsWorkerRuntimeIntegrated: false,
    signedJobsServiceIdentityVerified: false,
    positiveLifeMovieGrantIssued: false,
    renderActivated: false,
    productionAuthorized: false,
    finalReleaseAccepted: false,
  };
  console.log('R450_PRIVACY_MOVIE_DENIAL_PASS ' + JSON.stringify(output));
} finally {
  await Promise.allSettled([signOut(owner.auth), signOut(foreign.auth), signOut(jobs.auth)]);
  for (const app of clients) await deleteApp(app).catch(() => {});
  await deleteAdminApp(server).catch(() => {});
}
