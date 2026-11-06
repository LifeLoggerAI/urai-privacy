/**
 * R818 — native Jobs identity/transport -> actual Privacy callable.
 * This is a *denial* acceptance against disposable Firebase emulators.
 * The imported Jobs source and Privacy Functions source are not modified,
 * mocked or granted production privileges.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from 'firebase/app';
import { getAuth as getClientAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

const PROJECT = 'urai-privacy-integration-test';
const JOBS_SHA = '14c7c0482833a915ed6b33da7836b536d4585f18';
const PRIVACY_SHA = process.env.URAI_EXPECTED_PRIVACY_SHA;
const JOBS_UID = 'synthetic-jobs-verifier-uid';
const API_KEY = 'R818_Synthetic_Emulator_Key_00000000';
const CALLABLE = 'verifyLifeMovieRenderConsent';
const IDENTITY_PUBLIC_URL =
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API_KEY;
const PRIVACY_PUBLIC_URL =
  'https://us-central1-' + PROJECT + '.cloudfunctions.net/' + CALLABLE;
const EMULATOR_AUTH_URL =
  'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=' + API_KEY;
const EMULATOR_PRIVACY_URL =
  'http://127.0.0.1:5001/' + PROJECT + '/us-central1/' + CALLABLE;
const REQUIRED = Object.freeze({
  URAI_EMULATOR_PROJECT: PROJECT,
  URAI_PRIVACY_JOBS_VERIFIER_UID: JOBS_UID,
  FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
  FIREBASE_FUNCTIONS_EMULATOR_HOST: '127.0.0.1:5001',
  FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
});
const FORBIDDEN = [
  'GITHUB_TOKEN', 'GH_TOKEN', 'RUNPOD_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS',
  'FIREBASE_TOKEN', 'FIREBASE_CLI_TOKEN', 'GOOGLE_OAUTH_ACCESS_TOKEN',
  'GOOGLE_CLOUD_ACCESS_TOKEN', 'GCS_BUCKET_NAME',
  'FIREBASE_STORAGE_BUCKET', 'GOOGLE_CLOUD_STORAGE_BUCKET',
];
function git(dir, ...args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
}
function pass(msg) { console.log('[R818 PASS] ' + msg); }
function pinOrThrow() {
  const privacy = process.cwd();
  const jobs = process.env.URAI_JOBS_SOURCE_DIR;
  assert.ok(jobs && isAbsolute(jobs) && resolve(jobs).startsWith('/tmp/'), 'disposable Jobs checkout is required');
  assert.equal(git(privacy, 'rev-parse', 'HEAD'), PRIVACY_SHA, 'Privacy source must be independently pinned');
  assert.equal(git(jobs, 'rev-parse', 'HEAD'), JOBS_SHA, 'Jobs source must be independently pinned');
  assert.equal(git(privacy, 'status', '--porcelain', '--untracked-files=all'), '', 'Privacy source must be clean');
  assert.equal(git(jobs, 'status', '--porcelain', '--untracked-files=all'), '', 'Jobs source must be clean');
  for (const [name, expected] of Object.entries(REQUIRED)) {
    assert.equal(process.env[name], expected, 'local-only emulator setting ' + name);
  }
  // firebase emulators:exec sets FIREBASE_CONFIG itself. Accept only the
  // generated disposable project/bucket, never inherited production metadata.
  const firebaseConfig = process.env.FIREBASE_CONFIG;
  if (firebaseConfig) {
    const parsed = JSON.parse(firebaseConfig);
    assert.equal(parsed.projectId, PROJECT, 'Firebase config must be demo project');
    assert.equal(parsed.storageBucket, PROJECT + '.appspot.com', 'Firebase bucket must be demo');
    assert.equal(parsed.databaseURL, 'https://' + PROJECT + '.firebaseio.com', 'Firebase database must be demo');
    assert.deepEqual(Object.keys(parsed).sort(), ['databaseURL', 'projectId', 'storageBucket'].sort());
  }
  for (const key of FORBIDDEN) assert.equal(process.env[key] || '', '', 'forbidden inherited authority: ' + key);
  for (const name of ['GOOGLE_CLOUD_PROJECT', 'GCLOUD_PROJECT', 'FIREBASE_PROJECT_ID']) {
    assert.ok(!process.env[name] || process.env[name] === PROJECT, 'non-demo project denied: ' + name);
  }
  return jobs;
}
const jobs = pinOrThrow();
pass('EXACT_PRIVACY_AND_JOBS_GIT_SHA_PINNED');

const jobsModulePath = join(jobs, 'functions/lib/functions/privacy/lifeMovieJobsPrivacyClient.js');
const { createAuthenticatedJobsPrivacyConsentClient } = await import(pathToFileURL(jobsModulePath).href);
assert.equal(typeof createAuthenticatedJobsPrivacyConsentClient, 'function');
pass('ORIGINAL_COMPILED_JOBS_IDENTITY_AND_TRANSPORT_IMPORTED');

const testKey = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
const adminApp = initializeAdminApp({
  projectId: PROJECT,
  credential: cert({
    projectId: PROJECT,
    clientEmail: 'r818-ephemeral-test@urai-privacy-integration-test.iam.gserviceaccount.com',
    privateKey: testKey.privateKey,
  }),
}, 'r818-native-jobs-admin');
const adminAuth = getAdminAuth(adminApp);
const adminDb = getAdminFirestore(adminApp);
const ownerApp = initializeClientApp({
  projectId: PROJECT,
  apiKey: API_KEY,
  authDomain: PROJECT + '.firebaseapp.com',
  appId: '1:12345:web:r818synthetic',
}, 'r818-owner-client');
const ownerAuth = getClientAuth(ownerApp);
connectAuthEmulator(ownerAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
const ownerFns = getFunctions(ownerApp, 'us-central1');
connectFunctionsEmulator(ownerFns, '127.0.0.1', 5001);

let identityCalls = 0;
let privacyCalls = 0;
let privacyStatus = 0;
const realFetch = globalThis.fetch.bind(globalThis);
async function emulatorOnlyTransport(input, init) {
  const target = String(input);
  if (target === IDENTITY_PUBLIC_URL) {
    identityCalls++;
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    const response = await realFetch(EMULATOR_AUTH_URL, { ...init, redirect: 'error' });
    assert.equal(response.status, 200, 'Actual Firebase Auth emulator must issue signed-in ID token');
    return response;
  }
  if (target === PRIVACY_PUBLIC_URL) {
    privacyCalls++;
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    assert.ok(String(init?.headers?.Authorization || '').startsWith('Bearer '), 'Jobs must provide its own bearer');
    const payload = JSON.parse(String(init?.body || '{}'));
    assert.equal(payload.data?.policyVersion, '1.1.0');
    assert.equal(payload.data?.subjectUid, ownerUid);
    const response = await realFetch(EMULATOR_PRIVACY_URL, { ...init, redirect: 'error' });
    privacyStatus = response.status;
    return response;
  }
  throw new Error('R818_FORBIDDEN_OUTBOUND_NETWORK_TARGET:' + target);
}
let ownerUid;
try {
  const signup = await createUserWithEmailAndPassword(
    ownerAuth, 'r818-owner@synthetic.invalid', 'R818SyntheticOnlyNoProductionCredential123!'
  );
  ownerUid = signup.user.uid;
  assert.ok(ownerUid);
  pass('REAL_FIREBASE_AUTH_EMULATOR_OWNER_CREATED');

  // The actual Privacy callable must reject a generic grant and store no C6 receipt.
  await assert.rejects(
    httpsCallable(ownerFns, 'setCanonicalConsent')({
      purpose: 'life-movie.render', status: 'granted', surface: 'movie-selection'
    }),
    error => { assert.equal(error?.code, 'functions/failed-precondition'); return true; }
  );
  const recordRef = adminDb.collection('consentRecords').doc(ownerUid + '_life-movie_render');
  assert.equal((await recordRef.get()).exists, false);
  pass('ACTUAL_PRIVACY_CALLABLE_DENIES_UNSCOPED_C6_ISSUANCE');

  const scope = Object.freeze({
    projectId: 'synthetic-r818-movie',
    renderPlanDigest: 'a'.repeat(64),
    sourceSetDigest: 'b'.repeat(64),
  });
  const expected = Object.freeze({
    subjectUid: ownerUid,
    tenantId: 'synthetic-tenant-r818',
    correlationId: 'synthetic-r818-callable-correlation',
    decisionReceiptId: 'c'.repeat(64),
    renderScope: scope,
  });
  let signingAttempts = 0;
  let signingSuccesses = 0;
  const tracedAdminAuth = {
    app: adminAuth.app,
    async createCustomToken(uid, claims) {
      signingAttempts++;
      try {
        const token = await adminAuth.createCustomToken(uid, claims);
        signingSuccesses++;
        assert.equal(typeof token, 'string');
        return token;
      } catch (error) {
        console.log('[R818 SIGNING_DIAGNOSTIC]', String(error?.code || error?.name || 'unknown'),
          String(error?.message || '').slice(0, 140));
        throw error;
      }
    },
  };
  const client = createAuthenticatedJobsPrivacyConsentClient({
    firebaseProjectId: PROJECT, dedicatedJobsUid: JOBS_UID,
    firebaseWebApiKey: API_KEY, region: 'us-central1',
  }, { adminAuth: tracedAdminAuth, fetchImpl: emulatorOnlyTransport });

  await assert.rejects(() => client(expected), error => {
    assert.match(String(error), /life_movie_consent_transport_unavailable|life_movie_consent_decision_denied|life_movie_consent_jobs_identity_unavailable/);
    return true;
  });
  console.log('[R818 TOKEN_STAGE_COUNTS]', JSON.stringify({ signingAttempts, signingSuccesses, identityCalls, privacyCalls }));
  assert.equal(identityCalls, 1, 'original Jobs provider must exchange its custom token via real Auth emulator');
  assert.equal(privacyCalls, 1, 'original Jobs transport must actually reach original Privacy callable');
  assert.equal(privacyStatus, 403, 'Privacy must explicitly reject the unapproved Jobs identity');
  pass('REAL_JOBS_IDENTITY_TO_PRIVACY_FUNCTIONS_HTTP_PERMISSION_DENIED');

  assert.equal((await recordRef.get()).exists, false, 'denied transport must never create a C6 consent grant');
  const [jobsSnapshot, queueSnapshot] = await Promise.all([
    adminDb.collection('jobs').get(), adminDb.collection('jobQueueEntries').get(),
  ]);
  assert.equal(jobsSnapshot.size, 0, 'no render Jobs created');
  assert.equal(queueSnapshot.size, 0, 'no render queue entries created');
  pass('NO_C6_GRANT_AND_NO_RENDER_QUEUE_ADMITTED');

  console.log('URAI_R818_REAL_JOBS_PRIVACY_CALLABLE_DENIAL_PASS ' + JSON.stringify({
    privacyHead: PRIVACY_SHA, jobsHead: JOBS_SHA,
    projectId: PROJECT, identityCalls, privacyCalls, privacyStatus,
    nativeJobsIdentityProvider: true, nativeJobsCallableTransport: true,
    nativePrivacyOnCall: true, mintedSignedProductionIdentity: false,
    approvedC6Issuer: false, movieRendered: false, productionAuthorized: false,
  }));
} finally {
  await Promise.allSettled([deleteClientApp(ownerApp), deleteAdminApp(adminApp)]);
}
