/**
 * R834 — native Jobs R833 identity/transport -> actual Privacy callable.
 * This is a *denial* acceptance against disposable Firebase emulators.
 * The imported Jobs source and Privacy Functions source are not modified,
 * mocked or granted production privileges.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, isAbsolute, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { initializeApp as initializeClientApp, deleteApp as deleteClientApp } from 'firebase/app';
import { getAuth as getClientAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp, cert } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';

const PROJECT = 'demo-urai-privacy-integration-test';
const JOBS_SHA = '8baaf008d021eeebe5ba425e4d8308a5cd99c87a';
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
    clientEmail: 'r818-ephemeral-test@demo-urai-privacy-integration-test.iam.gserviceaccount.com',
    privateKey: testKey.privateKey,
  }),
}, 'r818-native-jobs-admin');
// Only this process holds this freshly generated private key, never a production
// service-account credential or a downloadable long-lived key file.
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
function signEphemeralJwt(header, payload) {
  const message = encode(header) + '.' + encode(payload);
  const signer = createSign('RSA-SHA256');
  signer.update(message);
  signer.end();
  return message + '.' + signer.sign(testKey.privateKey).toString('base64url');
}
function shapeOnly(jwt) {
  const pieces = String(jwt || '').split('.');
  let header = {};
  try { header = JSON.parse(Buffer.from(pieces[0] || '', 'base64url').toString('utf8')); } catch { /* deny */ }
  return { segments: pieces.length, alg: header.alg || 'unknown', hasSignature: Boolean(pieces[2]) };
}
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
let privacyResponseText = '';
let emulatorIdTokenShape = null;
let reviewOnlySignedIdToken = false;
let syntheticSignedIdTokenCount = 0;
let responseShapeDiagnostic = null;
let signedTokenClaimsDiagnostic = null;
let firstErrorCode = '';
let secondErrorCode = '';
let syntheticSignedCustomTokenCount = 0;
const realFetch = globalThis.fetch.bind(globalThis);
async function emulatorOnlyTransport(input, init) {
  const target = String(input);
  if (target === IDENTITY_PUBLIC_URL) {
    identityCalls++;
    assert.equal(init?.method, 'POST');
    assert.equal(init?.redirect, 'error');
    const response = await realFetch(EMULATOR_AUTH_URL, { ...init, redirect: 'error' });
    assert.equal(response.status, 200, 'Actual Firebase Auth emulator must issue signed-in ID token');
    if (!reviewOnlySignedIdToken) return response;
    // The Firebase Auth emulator deliberately returns an unsigned ID token.
    // Never modify Jobs or Privacy production authentication to accept it.
    // In a separately labeled *synthetic negative-only* stage, re-sign only
    // the verified local emulator claims with our one-use test key so the
    // original Jobs transport can issue a request. This token is NOT issued
    // by Google, cannot establish production IAM, and MUST NOT yield a grant.
    const json = await response.json();
    const rawIdToken = String(json.idToken || '');
    const segments = rawIdToken.split('.');
    const rawHeader = JSON.parse(Buffer.from(segments[0] || '', 'base64url').toString('utf8'));
    const rawClaims = JSON.parse(Buffer.from(segments[1] || '', 'base64url').toString('utf8'));
    responseShapeDiagnostic = { status: response.status, contentType: response.headers.get('content-type'),
      keys: Object.keys(json).sort(), localIdMatches: json.localId === JOBS_UID,
      expiresInType: typeof json.expiresIn, expiresInValue: String(json.expiresIn || '').slice(0, 12) };
    signedTokenClaimsDiagnostic = { audienceMatches: rawClaims.aud === PROJECT,
      issuerMatches: rawClaims.iss === 'https://securetoken.google.com/' + PROJECT,
      uidMatches: rawClaims.sub === JOBS_UID,
      claimsPresent: rawClaims.system === true && rawClaims.role === 'system' && rawClaims.consumerId === 'urai-jobs',
      signInProvider: rawClaims.firebase?.sign_in_provider,
      issuedAtType: typeof rawClaims.iat, expiryType: typeof rawClaims.exp,
      lifetimeSeconds: Number(rawClaims.exp) - Number(rawClaims.iat),
      ageSeconds: Math.floor(Date.now()/1000) - Number(rawClaims.iat) };
    emulatorIdTokenShape = shapeOnly(rawIdToken);
    assert.equal(rawHeader.alg, 'none', 'only unsigned Firebase emulator ID tokens may be adapted');
    assert.equal(segments.length, 3);
    assert.equal(segments[2], '');
    assert.equal(rawClaims.aud, PROJECT);
    assert.equal(rawClaims.iss, 'https://securetoken.google.com/' + PROJECT);
    assert.equal(rawClaims.sub, JOBS_UID);
    assert.equal(rawClaims.system, true);
    assert.equal(rawClaims.role, 'system');
    assert.equal(rawClaims.consumerId, 'urai-jobs');
    assert.equal(rawClaims.firebase?.sign_in_provider, 'custom');
    // Firebase Auth emulator omits REST localId for a custom-token sign-in;
    // recover ONLY the already verified UID in this in-process test adapter.
    // The original Jobs provider still requires localId and is not modified.
    assert.equal(json.localId, undefined);
    json.localId = rawClaims.sub;
    json.idToken = signEphemeralJwt({ alg: 'RS256', typ: 'JWT' }, rawClaims);
    syntheticSignedIdTokenCount++;
    return new Response(JSON.stringify(json), { status: response.status,
      headers: { 'content-type': 'application/json' } });
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
    privacyResponseText = await response.clone().text();
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
        const shape = shapeOnly(token);
        console.log('[R818 CUSTOM_TOKEN_SHAPE]', JSON.stringify(shape));
        if (shape.hasSignature && shape.alg === 'RS256') return token;
        // The Firebase Admin Auth emulator may use alg=none for local tests.
        // Only an exact local unsigned token can trigger the review-only
        // ephemeral signer. No production credential/provider is touched.
        assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
        assert.equal(shape.alg, 'none');
        assert.equal(shape.segments, 3);
        const originalPieces = token.split('.');
        assert.equal(originalPieces[2], '');
        const unsignedClaims = JSON.parse(Buffer.from(originalPieces[1], 'base64url').toString('utf8'));
        assert.equal(unsignedClaims.uid, uid);
        assert.equal(unsignedClaims.claims?.system, true);
        assert.equal(unsignedClaims.claims?.consumerId, 'urai-jobs');
        const signerEmail = 'r818-ephemeral-test@' + PROJECT + '.iam.gserviceaccount.com';
        const iat = Math.floor(Date.now() / 1000);
        const fixture = signEphemeralJwt({ alg: 'RS256', typ: 'JWT' }, {
          iss: signerEmail, sub: signerEmail,
          aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
          iat, exp: iat + 3600, uid, claims,
        });
        syntheticSignedCustomTokenCount++;
        return fixture;
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

  // Stage 1: original unsigned Auth-emulator ID token MUST fail within Jobs.
  await assert.rejects(() => client(expected), error => {
    assert.match(String(error), /life_movie_consent_transport_unavailable|life_movie_consent_decision_denied|life_movie_consent_jobs_identity_unavailable/);
    return true;
  });
  console.log('[R818 ORIGINAL_EMULATOR_TOKEN_STAGE]', JSON.stringify({
    signingAttempts, signingSuccesses, identityCalls, privacyCalls,
    syntheticSignedCustomTokenCount,
  }));
  assert.equal(identityCalls, 1, 'original Jobs token provider must call real Auth emulator');
  assert.equal(privacyCalls, 0, 'original Jobs transport must reject unsigned emulator ID token');
  pass('ORIGINAL_JOBS_TRANSPORT_REJECTS_UNSIGNED_EMULATOR_ID_TOKEN');

  // Stage 2 is explicitly NOT a production-identity acceptance. Repack
  // emulator ID claims using ephemeral in-process RSA only for an authenticated
  // NEGATIVE test of the original callable's current grant/identity denial.
  reviewOnlySignedIdToken = true;
  await assert.rejects(() => client(expected), error => {
    secondErrorCode = String(error?.message || error);
    assert.match(String(error), /life_movie_consent_transport_unavailable|life_movie_consent_decision_denied|life_movie_consent_jobs_identity_unavailable/);
    return true;
  });
  console.log('[R818 SYNTHETIC_RESPONSE_DIAGNOSTICS]', JSON.stringify({ responseShapeDiagnostic, signedTokenClaimsDiagnostic, secondErrorCode }));
  console.log('[R818 TOKEN_STAGE_COUNTS]', JSON.stringify({ signingAttempts,
    signingSuccesses, identityCalls, privacyCalls, privacyStatus,
    emulatorIdTokenShape, syntheticSignedCustomTokenCount, syntheticSignedIdTokenCount }));
  assert.equal(identityCalls, 2, 'two real Auth emulator custom-token exchanges required');
  assert.equal(privacyCalls, 1, 'original Jobs consent transport must reach real Privacy emulator');
  assert.equal(syntheticSignedIdTokenCount, 1);
  assert.ok([200, 401, 403].includes(privacyStatus), 'Privacy must respond with explicit authentication/consent result');
  if (privacyStatus === 200) {
    const decisionEnvelope = JSON.parse(privacyResponseText);
    assert.equal(decisionEnvelope?.result?.allowed, false, 'Privacy never grants without real C6 consent');
    pass('ORIGINAL_PRIVACY_CALLABLE_DENIES_UNISSUED_C6_GRANT');
  } else {
    const denialEnvelope = JSON.parse(privacyResponseText);
    assert.ok(denialEnvelope?.error?.status === 'PERMISSION_DENIED' ||
      denialEnvelope?.error?.status === 'UNAUTHENTICATED' ||
      denialEnvelope?.error?.code === 401 || denialEnvelope?.error?.code === 403,
      'Must be explicit Firebase auth denial, not a generic infrastructure error');
    pass('PRIVACY_FUNCTIONS_AUTHENTICATION_REJECTS_SYNTHETIC_IDENTITY');
  }
  pass('REAL_JOBS_TO_PRIVACY_HTTP_NEGATIVE_TRANSPORT_REACHED');

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
    syntheticEmulatorSignatureFixture: true, productionServiceIdentityAccepted: false,
    nativeJobsIdentityProvider: true, nativeJobsCallableTransport: true,
    nativePrivacyOnCall: true, mintedSignedProductionIdentity: false,
    approvedC6Issuer: false, movieRendered: false, productionAuthorized: false,
  }));
} finally {
  await Promise.allSettled([deleteClientApp(ownerApp), deleteAdminApp(adminApp)]);
}
