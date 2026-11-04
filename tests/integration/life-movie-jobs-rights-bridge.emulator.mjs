/**
 * Disposable Firebase Auth + Firestore transaction tests. No cloud credentials,
 * no issued production grants, and NO Jobs worker activation. Original unexported
 * Privacy review module, not an actual independently approved grant issuer.
 */
import assert from "node:assert/strict";
import { generateKeyPairSync, createHash } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth, connectAuthEmulator, createUserWithEmailAndPassword,
  getIdToken, signInWithCustomToken,
} from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator, httpsCallable } from "firebase/functions";
import { initializeApp as initializeAdminApp, deleteApp as deleteAdminApp, cert } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import { createEmulatorOnlyReviewMovieGrantBackend } from "../../functions/lib/life-movie-scoped-issuer-firestore-emulator.js";
import { writeReviewOnlyScopedGrantCandidate } from "../../functions/lib/life-movie-scoped-issuer-review.js";
import { evaluateLifeMovieRenderAuthorization } from "../../functions/lib/life-movie-render-authorization.js";

const PROJECT = "urai-privacy-integration-test";
const EXACT_JOBS_SOURCE = "b7a498e543160e64748a0679469a1fc1550acb3b";
assert.equal(process.env.URAI_JOBS_SOURCE_SHA, EXACT_JOBS_SOURCE);
assert.ok(process.env.URAI_JOBS_DIR?.startsWith("/tmp/"), "Jobs must be disposable clone");
const jobsRequire = createRequire(resolve(process.env.URAI_JOBS_DIR, "functions/package.json"));
const jobsAdmin = jobsRequire("firebase-admin/app");
const jobsApp = jobsAdmin.initializeApp({ projectId: PROJECT }); // original Jobs getApp() reads default
const jobsDb = jobsRequire("firebase-admin/firestore").getFirestore(jobsApp);
const jobsStorage = jobsRequire("firebase-admin/storage").getStorage(jobsApp);
const { deriveStudioLifeMovieRenderScope } = jobsRequire("./lib/functions/jobs/studioLifeMovieContract.js");
const { createReviewOnlyFirebaseLifeMovieOwnerVerifier } =
  jobsRequire("./lib/functions/privacy/lifeMovieFirebaseOwnerState.js");
const { createFirebaseLifeMovieSourceRightsVerifier } =
  jobsRequire("./lib/functions/privacy/lifeMovieFirebaseSourceRightsAdapter.js");
const { invalidateLifeMovieDerivativesForConsent } =
  jobsRequire("./lib/functions/privacy/lifeMovieDerivativeRevocation.js");
const EXPECTED = {
  URAI_EMULATOR_PROJECT: PROJECT,
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  FIREBASE_FUNCTIONS_EMULATOR_HOST: "127.0.0.1:5001",
  URAI_PRIVACY_JOBS_VERIFIER_UID: "synthetic-jobs-verifier-uid",
};
for (const [key, value] of Object.entries(EXPECTED)) assert.equal(process.env[key], value);
for (const name of ["GOOGLE_APPLICATION_CREDENTIALS", "FIREBASE_TOKEN"]) {
  assert.equal(process.env[name] ?? "", "", name + " must not be set");
}
for (const name of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"]) {
  if (process.env[name]) assert.equal(process.env[name], PROJECT, name + " must refer to the disposable project");
}
const config = {
  apiKey: "local-synthetic-emulator-only",
  projectId: PROJECT,
  authDomain: PROJECT + ".firebaseapp.com",
  appId: "1:123:web:review",
};
// Ephemeral TEST-ONLY RSA key: no real service-account credentials or production IAM.
// Firebase Auth emulator accepts a custom-token sign-in to exercise the onCall
// role, identity and current-consent checks. This is NOT production token proof.
const key = generateKeyPairSync("rsa", { modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});
const adminApp = initializeAdminApp({ projectId: PROJECT, credential: cert({
  projectId: PROJECT,
  clientEmail: "synthetic-verifier@urai-privacy-integration-test.iam.gserviceaccount.com",
  privateKey: key.privateKey,
}) }, "review-issuer-admin");
const adminDb = getAdminFirestore(adminApp);
const adminAuth = getAdminAuth(adminApp);
const clients = [];
const checks = [];
// Keep synthetic grant unexpired while testing the original Privacy callable.
let now = Date.now();
const iso = (delta = 0) => new Date(now + delta).toISOString();
let scope = {
  projectId: "synthetic-movie-1",
  renderPlanDigest: "a".repeat(64),
  sourceSetDigest: "b".repeat(64),
};
const password = "LocalReviewOnlySyntheticPassword!1234";

async function createOwner(label) {
  const app = initializeApp(config, "review-client-" + label);
  clients.push(app);
  const clientAuth = getAuth(app);
  connectAuthEmulator(clientAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const result = await createUserWithEmailAndPassword(
    clientAuth, label + "@local-review.example.test", password);
  const uid = result.user.uid;
  const token = await getIdToken(result.user, true);
  const req = {
    ownerUid: uid, tenantId: "tenant-1",
    noticeReviewEventId: "notice-event-1",
    approvalEventId: "approval-event-1-" + label,
    selectionEventId: "selection-event-1-" + label,
    rightsEventId: "rights-event-1-" + label,
  };
  await adminDb.collection("users").doc(uid).set({
    uid, tenantId: "tenant-1", accountStatus: "active",
    deleted: false, markedForDeletion: false,
  });
  const notice = {
    reviewEventId: req.noticeReviewEventId, noticeVersion: "notice-v1",
    noticeHash: "c".repeat(64), policyVersion: "1.1.0",
    surface: "movie-selection", jurisdiction: "US",
  };
  const approval = {
    eventId: req.approvalEventId, actorUid: uid, ownerUid: uid,
    tenantId: "tenant-1", purpose: "life-movie.render", status: "granted",
    noticeVersion: notice.noticeVersion, noticeHash: notice.noticeHash,
    renderScope: scope, approvedAt: iso(-5000), expiresAt: iso(3600000),
  };
  const selection = {
    eventId: req.selectionEventId, ownerUid: uid, tenantId: "tenant-1",
    renderScope: scope, verifiedAt: iso(-5000),
  };
  const rights = {
    rightsEventId: req.rightsEventId, ownerUid: uid, tenantId: "tenant-1",
    renderScope: scope, verifiedAt: iso(-5000),
  };
  for (const [name, key, value] of [
    ["reviewOnlyMovieNotices", req.noticeReviewEventId, notice],
    ["reviewOnlyMovieApprovals", req.approvalEventId, approval],
    ["reviewOnlyMovieSelections", req.selectionEventId, selection],
    ["reviewOnlyMovieRights", req.rightsEventId, rights],
  ]) await adminDb.collection(name).doc(key).set(value);
  const backend = createEmulatorOnlyReviewMovieGrantBackend({
    app: adminApp, ownerIdToken: token, nowMs: () => now,
  });
  return { uid, req, backend, clientAuth, app };
}
async function expectDeny(label, action) {
  await assert.rejects(action, /life_movie_review_only_issuer_evidence_unverified/);
  checks.push(label);
}
async function noGrant(uid) {
  const result = await adminDb.collection("consentRecords").doc(uid + "_life-movie_render").get();
  assert.equal(result.exists, false, "denied attempt must not create C6 grant");
}
async function auditCount(uid) {
  const snap = await adminDb.collection("auditLogs").where("ownerUid", "==", uid).get();
  return snap.size;
}

try {
  // This synthetic 1px source is uploaded into the ACTUAL Storage emulator.
  // The original Jobs modules independently derive its immutable generation
  // and scope, reread server-owned rights, check current owner, and durably
  // audit. Nothing here constitutes independently issued/legal source rights.
  const bucket = "urai-privacy-integration-test.appspot.com";
  const path = "tenants/tenant-1/sources/bridge-review-synthetic.png";
  const sourceFile = jobsStorage.bucket(bucket).file(path);
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/U5YAAAAASUVORK5CYII=",
    "base64",
  );
  await sourceFile.save(png, { resumable: false, metadata: { contentType: "image/png" } });
  const [metadata] = await sourceFile.getMetadata();
  const originalSource = {
    id: "synthetic-source-1",
    bucket, objectPath: path, generation: String(metadata.generation),
    mimeType: "image/png", provenance: "original-source",
    sourceRefs: ["synthetic-record-1"], consentRef: "synthetic-consent-ref-1",
    ownerOrRightsRef: "synthetic-server-rights-ref-1",
  };
  const selection = {
    projectId: scope.projectId, renderPlanDigest: scope.renderPlanDigest,
    sources: [originalSource],
  };
  scope = deriveStudioLifeMovieRenderScope(selection);
  assert.match(scope.sourceSetDigest, /^[0-9a-f]{64}$/);
  checks.push("Jobs-original-scope-derived-from-actual-Storage-generation");

  const first = await createOwner("positive");
  const realRightsRef = jobsDb.collection("lifeMovieSourceRights").doc(originalSource.ownerOrRightsRef);
  await realRightsRef.set({
    schemaVersion: "urai-life-movie-source-rights-v1",
    issuer: "trusted-server-source-rights-v1", // TEST FIXTURE. NOT a real reviewed issuer.
    status: "approved", purpose: "life-movie.render",
    ownerUid: first.uid, tenantId: "tenant-1",
    projectId: selection.projectId, sourceId: originalSource.id,
    bucket, objectPath: path, generation: originalSource.generation,
    mimeType: originalSource.mimeType,
    consentRef: originalSource.consentRef,
    ownerOrRightsRef: originalSource.ownerOrRightsRef,
    provenance: originalSource.provenance,
    sourceRefs: originalSource.sourceRefs, thirdPartyClearance: "verified",
    evidenceHash: "f".repeat(64),
    reviewedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 60 * 60_000).toISOString(),
  });
  const verifyCurrentOwner = createReviewOnlyFirebaseLifeMovieOwnerVerifier({
    firebaseProjectId: PROJECT,
  });
  const verifySourceRights = createFirebaseLifeMovieSourceRightsVerifier({
    firebaseProjectId: PROJECT, allowedBuckets: [bucket],
    assertCurrentOwner: verifyCurrentOwner, nowMs: () => Date.now(),
  });
  const verifyInput = {
    ownerUid: first.uid, tenantId: "tenant-1", selection, renderScope: scope,
  };
  const jobsRightsEvidence = await verifySourceRights(verifyInput);
  assert.deepEqual(jobsRightsEvidence.renderScope, scope);
  const originalJobsAudit = await jobsDb.collection("lifeMovieSourceRightsDecisions")
    .doc(jobsRightsEvidence.rightsEventId).get();
  assert.equal(originalJobsAudit.exists, true);
  assert.equal(originalJobsAudit.data()?.ownerUid, first.uid);
  assert.equal(originalJobsAudit.data()?.renderPlanDigest, scope.renderPlanDigest);
  assert.equal(originalJobsAudit.data()?.sourceSetDigest, scope.sourceSetDigest);
  assert.equal(originalJobsAudit.data()?.action, "life_movie_source_rights_preflight_verified");
  checks.push("original-Jobs-owner-and-rights-audit-verified-on-real-Auth-Firestore-Storage");

  // Explicit review-only TEST PROJECTION from a real Jobs audit ID to the
  // Privacy synthetic evidence collection. A trusted production projector
  // DOES NOT EXIST and this test code MUST NEVER be used as that issuer.
  await adminDb.collection("reviewOnlyMovieRights").doc(first.req.rightsEventId).delete();
  first.req.rightsEventId = jobsRightsEvidence.rightsEventId;
  await adminDb.collection("reviewOnlyMovieRights").doc(jobsRightsEvidence.rightsEventId).set({
    rightsEventId: jobsRightsEvidence.rightsEventId,
    ownerUid: first.uid, tenantId: "tenant-1",
    renderScope: scope, verifiedAt: jobsRightsEvidence.verifiedAt,
  });
  now = Date.now(); // Privacy's frozen transaction clock AFTER Jobs' real audit.
  const result = await writeReviewOnlyScopedGrantCandidate(first.req, first.backend);
  assert.match(result.receiptHash, /^[0-9a-f]{64}$/);
  assert.equal(result.recordId, first.uid + "_life-movie_render");
  const stored = await adminDb.collection("consentRecords").doc(result.recordId).get();
  assert.equal(stored.data()?.receiptHash, result.receiptHash);
  assert.equal(stored.data()?.reviewOnlyEmulator, true);
  assert.equal(stored.data()?.productionAuthorized, false);
  assert.equal(await auditCount(first.uid), 1);
  checks.push("matching-synthetic-transaction-created-review-only-record-and-audit");

  assert.equal(stored.data()?.renderScope.sourceSetDigest, jobsRightsEvidence.renderScope.sourceSetDigest);
  assert.equal(stored.data()?.reviewOnlyEmulator, true);
  assert.equal(stored.data()?.productionAuthorized, false);
  checks.push("real-Jobs-source-audit-bound-to-Privacy-review-only-grant");

  // Original Jobs must reject revoked server rights even though a historical
  // review-only grant/receipt is present. It never creates a render capability.
  await realRightsRef.update({ status: "revoked" });
  await assert.rejects(() => verifySourceRights(verifyInput), /life_movie_source_rights_unverified/);
  checks.push("original-Jobs-refuses-rights-after-review-only-consent-creation");

  // R506: real source-to-derivative deletion chain on the SAME disposable
  // Auth/Firestore/Storage/Functions emulator environment. The derivative is
  // manually seeded with SYNTHETIC bytes, NOT rendered under an active C6 grant.
  // A revoked Privacy-side review record must never revive output access, and
  // the original Jobs revocation code must delete only the pinned GCS generation.
  const syntheticJobId = "review-revoked-derivative-" + first.uid;
  const derivativePath = "tenants/tenant-1/life-movies/" +
    scope.projectId + "/render/" + syntheticJobId + ".mp4";
  const derivative = jobsStorage.bucket(bucket).file(derivativePath);
  await derivative.save(Buffer.from("R506-SYNTHETIC-NOT-A-RENDER"), {
    resumable: false, metadata: { contentType: "video/mp4" },
  });
  const [derivativeBefore] = await derivative.getMetadata();
  assert.match(String(derivativeBefore.generation), /^[1-9][0-9]*$/);
  const derivativeJob = jobsDb.collection("jobs").doc(syntheticJobId);
  await derivativeJob.set({
    jobId: syntheticJobId, ownerUid: first.uid, tenantId: "tenant-1",
    sourceSystem: "urai-studio", jobType: "studio.render.video",
    status: "SUCCESS", payload: { projectId: scope.projectId },
    output: { outputs: [{
      kind: "mp4", ref: "gs://" + bucket + "/" + derivativePath,
      generation: String(derivativeBefore.generation), mimeType: "video/mp4",
    }] },
  });
  checks.push("synthetic-derivative-generation-seeded-after-review-rights-revocation");

  const revokeEvent = {
    eventId: "r506-synthetic-rights-revoked-" + first.uid,
    ownerUid: first.uid, purpose: "life-movie.render",
    revokedAt: new Date().toISOString(),
  };
  await jobsDb.collection("jobConsentEventReceipts")
    .doc(createHash("sha256").update(revokeEvent.eventId).digest("hex"))
    .set({ ...revokeEvent, status: "blocked", consumerId: "urai-jobs" });
  const previousBucketName = process.env.GCS_BUCKET_NAME;
  process.env.GCS_BUCKET_NAME = bucket;
  let cleanup;
  try {
    cleanup = await invalidateLifeMovieDerivativesForConsent(revokeEvent);
  } finally {
    if (previousBucketName === undefined) delete process.env.GCS_BUCKET_NAME;
    else process.env.GCS_BUCKET_NAME = previousBucketName;
  }
  assert.equal(cleanup.jobsInvalidated, 1);
  assert.equal(cleanup.storageObjectsDeleted, 1);
  await assert.rejects(() => derivative.getMetadata(),
    (error) => error?.code === 404);
  checks.push("original-Jobs-erases-pinned-private-generation-after-review-revocation");

  const revokedJob = (await derivativeJob.get()).data();
  assert.equal(revokedJob?.derivativeAccessState, "REVOKED");
  assert.equal(revokedJob?.output, undefined);
  assert.ok(revokedJob?.outputDeletedAt);
  const reviewAfterCleanup = await adminDb.collection("consentRecords")
    .doc(result.recordId).get();
  assert.equal(reviewAfterCleanup.data()?.reviewOnlyEmulator, true);
  assert.equal(reviewAfterCleanup.data()?.productionAuthorized, false);
  checks.push("original-Jobs-retains-revocation-fence-without-promoting-review-consent");


  await expectDeny("duplicate-grant-denied", () =>
    writeReviewOnlyScopedGrantCandidate(first.req, first.backend));
  assert.equal(await auditCount(first.uid), 1);

  const race = await createOwner("race");
  const attempts = await Promise.allSettled([
    writeReviewOnlyScopedGrantCandidate(race.req, race.backend),
    writeReviewOnlyScopedGrantCandidate(race.req, race.backend),
  ]);
  assert.equal(attempts.filter(x => x.status === "fulfilled").length, 1,
    "concurrent transactions must not both win");
  assert.equal(await auditCount(race.uid), 1);
  checks.push("competing-grant-transactions-commit-exactly-once");

  const deleted = await createOwner("deleted");
  await adminDb.collection("privacyDeletionTombstones").doc(deleted.uid)
    .set({ active: true, uid: deleted.uid });
  await expectDeny("active-deletion-tombstone-denied", () =>
    writeReviewOnlyScopedGrantCandidate(deleted.req, deleted.backend));
  await noGrant(deleted.uid);
  assert.equal(await auditCount(deleted.uid), 0);

  const planning = await createOwner("planning");
  await adminDb.collection("privacyDeletionTombstones").doc(planning.uid)
    .set({ active: false, deletionPlanningLeaseToken: "pending-lease" });
  await expectDeny("in-flight-deletion-lease-denied", () =>
    writeReviewOnlyScopedGrantCandidate(planning.req, planning.backend));
  await noGrant(planning.uid);

  const invalidRights = await createOwner("rights");
  await adminDb.collection("reviewOnlyMovieRights").doc(invalidRights.req.rightsEventId)
    .update({ renderScope: { ...scope, sourceSetDigest: "d".repeat(64) } });
  await expectDeny("mismatched-source-rights-denied", () =>
    writeReviewOnlyScopedGrantCandidate(invalidRights.req, invalidRights.backend));
  await noGrant(invalidRights.uid);

  const stale = await createOwner("stale");
  await adminDb.collection("reviewOnlyMovieApprovals").doc(stale.req.approvalEventId)
    .update({ approvedAt: iso(-600000) });
  await expectDeny("stale-owner-approval-denied", () =>
    writeReviewOnlyScopedGrantCandidate(stale.req, stale.backend));
  await noGrant(stale.uid);

  const foreign = await createOwner("foreign");
  await expectDeny("cross-user-owner-identity-denied", () =>
    writeReviewOnlyScopedGrantCandidate({ ...foreign.req, ownerUid: first.uid }, foreign.backend));
  await noGrant(foreign.uid);

  const disabled = await createOwner("disabled");
  await adminAuth.updateUser(disabled.uid, { disabled: true });
  await expectDeny("disabled-firebase-auth-owner-denied", () =>
    writeReviewOnlyScopedGrantCandidate(disabled.req, disabled.backend));
  await noGrant(disabled.uid);

  // Actual client SDK, real Firestore rules, not an Admin SDK simulation.
  const firestore = getFirestore(first.app);
  connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
  await assert.rejects(setDoc(doc(firestore, "consentRecords",
    first.uid + "_life-movie_render"), { status: "granted", consentTier: "C6" }),
    /permission-denied/);
  checks.push("firebase-client-cannot-forge-review-only-consent");

  // The adapter MUST NOT be able to run outside the approved disposable project.
  const before = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8081";
  assert.throws(() => createEmulatorOnlyReviewMovieGrantBackend({
    app: adminApp, ownerIdToken: "fake-token-long-enough", nowMs: () => now,
  }), /life_movie_review_only_emulator_authority_unavailable/);
  process.env.FIRESTORE_EMULATOR_HOST = before;
  checks.push("non-disposable-backend-endpoint-rejected");

  // ACTUAL Privacy Functions callable with emulated dedicated custom sign-in:
  // exercise owner-scoped transaction decisions end-to-end, but NEVER accept
  // a proposal as production permission. No Jobs worker or signed IAM proof.
  const jobsApp = initializeApp(config, "review-synthetic-jobs");
  clients.push(jobsApp);
  const jobsAuth = getAuth(jobsApp);
  connectAuthEmulator(jobsAuth, "http://127.0.0.1:9099", { disableWarnings: true });
  const customToken = await adminAuth.createCustomToken("synthetic-jobs-verifier-uid", {
    system: true, role: "system", consumerId: "urai-jobs",
  });
  const jobsSignIn = await signInWithCustomToken(jobsAuth, customToken);
  assert.equal(jobsSignIn.user.uid, "synthetic-jobs-verifier-uid");
  const jobsFunctions = getFunctions(jobsApp, "us-central1");
  connectFunctionsEmulator(jobsFunctions, "127.0.0.1", 5001);
  const verify = httpsCallable(jobsFunctions, "verifyLifeMovieRenderConsent");
  const request = {
    subjectUid: first.uid, tenantId: "tenant-1",
    correlationId: "synthetic-jobs-review-verifier-01",
    decisionReceiptId: result.receiptHash,
    policyVersion: "1.1.0", renderScope: scope,
  };
  // The emulator custom-token sign-in has the correct superficial claims but
  // is NOT a verified production Jobs service identity. Real callable rejects
  // before reading grant data. Never weaken it just for a green test.
  const requireCallableDeny = async (label) => {
    await assert.rejects(() => verify(request), error => {
      assert.match(String(error?.code || error), /permission-denied|unauthenticated/);
      return true;
    });
    checks.push(label);
  };
  await requireCallableDeny("actual-privacy-callable-rejects-untrusted-emulator-jobs-login");

  // Independently prove the actual server policy classifies the persisted
  // review-only candidate as a denial, even with correct digest + owner.
  const policy = evaluateLifeMovieRenderAuthorization({
    record: stored.data(), deletionActive: false,
    subjectUid: first.uid, tenantId: "tenant-1",
    decisionReceiptId: result.receiptHash,
    policyVersion: "1.1.0", renderScope: scope,
    now: new Date(now),
  });
  assert.equal(policy.allowed, false);
  assert.equal(policy.reason, "REVIEW_ONLY_EVIDENCE");
  checks.push("original-policy-denies-correctly-hashed-review-only-record");

  await adminDb.collection("privacyDeletionTombstones").doc(first.uid)
    .set({ active: true, uid: first.uid });
  await requireCallableDeny("untrusted-jobs-identity-still-denied-after-owner-deletion");
  const deletedPolicy = evaluateLifeMovieRenderAuthorization({
    record: stored.data(), deletionActive: true,
    subjectUid: first.uid, tenantId: "tenant-1",
    decisionReceiptId: result.receiptHash,
    policyVersion: "1.1.0", renderScope: scope,
    now: new Date(now),
  });
  assert.equal(deletedPolicy.allowed, false);
  assert.equal(deletedPolicy.reason, "ACCOUNT_DELETED");
  checks.push("original-policy-prioritizes-active-owner-deletion");

  await adminAuth.updateUser("synthetic-jobs-verifier-uid", { disabled: true });
  await requireCallableDeny("original-privacy-callable-rejects-disabled-custom-jobs-login");

  console.log("R454_REVIEW_ONLY_FIRESTORE_PASS " + JSON.stringify({
    schemaVersion: "urai-review-only-firestore-emulator-1",
    projectId: PROJECT, checksPassed: checks.length, checks,
    authEmulator: true, firestoreEmulator: true, functionsEmulator: true,
    jobsIdentityEmulatorOnly: true, productionSignedJobsIdentityVerified: false,
    jobSourceAuditReadFromRealAuthFirestoreStorage: true,
    syntheticReviewProjectionOnly: true,
    approvedOwnerC6ConsentIssuer: false,
    independentlyApprovedJobsRightsIssuer: false,
    deployedIssuer: false, approvedEvidenceIssuer: false,
    jobsWorkerRuntimeIntegrated: false, renderEnabled: false,
    productionAuthorized: false, finalReleaseAccepted: false,
  }));
} finally {
  for (const app of clients) await deleteApp(app).catch(() => {});
  await deleteAdminApp(adminApp).catch(() => {});
  await jobsAdmin.deleteApp(jobsApp).catch(() => {});
}
