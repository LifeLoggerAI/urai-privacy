"use strict";

/**
 * REVIEW-ONLY, isolated issued-grant path. The positive policy, signing key and
 * service identity are synthetic review fixtures, never production authority.
 *
 * The Admin SDK creates fake accounts/claims and inert story/chapter sources
 * ONLY. Positive receipts, outbox events, withdrawal and deletion fences, inbox
 * records, ACKs and purge transitions must be created by the actual HTTP
 * callables under test. This test never reads a private key or signs an event.
 * Public stored events may be read and deliberately altered to test rejection.
 *
 * Requires the exact disposable project/loopback configuration in CONTRACT.md.
 * No historical 664-test, 29-test or previous boundary suite is invoked.
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const { resolve, dirname } = require("node:path");
const fs = require("node:fs");

const projectId = "demo-urai-family-issued-review";
const expectedHosts = {
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:30099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:30080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:30199",
  FUNCTIONS_EMULATOR_HOST: "127.0.0.1:30001",
};
for (const [key, value] of Object.entries(expectedHosts)) {
  assert.equal(process.env[key], value, `Only the exact isolated ${key} is permitted.`);
}
assert.ok(process.env.GCLOUD_PROJECT === projectId || process.env.GOOGLE_CLOUD_PROJECT === projectId);
for (const key of ["GCLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT"]) {
  if (process.env[key]) assert.equal(process.env[key], projectId);
}
const firebaseConfig = process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG) : {};
if (firebaseConfig.projectId) assert.equal(firebaseConfig.projectId, projectId);
if (firebaseConfig.storageBucket) assert.equal(firebaseConfig.storageBucket, `${projectId}.appspot.com`);
assert.equal(process.env.FAMILY_ISSUED_REVIEW_ENABLED, "synthetic-only-v1");
assert.equal(process.env.FAMILY_ISSUED_REVIEW_POLICY, "synthetic-explicit-text-consent-v1");
for (const key of [
  "GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_OAUTH_ACCESS_TOKEN", "GOOGLE_CLOUD_ACCESS_TOKEN",
  "FIREBASE_TOKEN", "FIREBASE_CLI_TOKEN", "GITHUB_TOKEN", "GH_TOKEN", "RUNPOD_API_KEY",
]) assert.ok(!process.env[key], `Credential-bearing variable ${key} must not enter this test.`);

const storyRequire = createRequire(resolve(__dirname, "../storytime/functions/package.json"));
const { initializeApp, getApps, deleteApp } = storyRequire("firebase-admin/app");
const { getFirestore } = storyRequire("firebase-admin/firestore");
const { getAuth } = storyRequire("firebase-admin/auth");
const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
const db = getFirestore(app);
const auth = getAuth(app);
const functionsBase = `http://127.0.0.1:30001/${projectId}/us-central1`;
const authBase = `http://${expectedHosts.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
const suffix = `${process.pid}-${Date.now()}`;
const familyId = `synthetic-family-${suffix}`;
const purpose = "storytime.family_share";
const version = "synthetic-version-one";
const deliveryUid = "synthetic-family-privacy-delivery";
const reportPath = process.env.TEST_FAMILY_ISSUED_REPORT_FILE
  || resolve(__dirname, "../custody/family-issued-path-gates.json");
const evidence = {
  schemaVersion: "family-issued-review-evidence-v1",
  projectId,
  syntheticOnly: true,
  policyAuthority: "SYNTHETIC_REVIEW_POLICY_NOT_CANONICAL_REGISTRATION",
  signerAuthority: "EPHEMERAL_REVIEW_SIGNER_NOT_CLOUD_KMS",
  deliveryIdentityAuthority: "FIXED_EMULATOR_UID_AND_CURRENT_SYNTHETIC_CLAIM",
  adminFixtureWriteCollections: ["storySessions", "storyChapters"],
  testAdminCreatedPositiveReceipt: false,
  testAdminChangedWithdrawalFence: false,
  testAdminChangedDeletionFence: false,
  testReadSigningPrivateKey: false,
  productionTouched: false,
  realPermissionsGranted: false,
  productionHold: true,
  privateMemoryWrites: "OFF",
  canonicalProductionIssuance: false,
  cloudServiceIdentity: false,
  automaticOutboxScheduling: false,
  currentCanonicalReadRecheck: false,
  ownerWideWithdrawal: false,
  globalDeletionComplete: false,
  checks: [],
  blockers: [
    "CANONICAL_PURPOSE_UNREGISTERED_AND_PRODUCTION_ISSUER_UNAPPROVED",
    "CLOUD_SERVICE_IDENTITY_IAM_AND_SIGNER_CUSTODY_UNCERTIFIED",
    "WITHDRAWAL_IS_STORY_SCOPED_NOT_OWNER_WIDE",
    "WITHDRAWAL_AND_DELETION_ENFORCEMENT_PROVEN_AFTER_RECEIVER_ACK_ONLY_NOT_DURING_UNDELIVERED_EVENT_INTERVAL_DISPATCH_IS_SERVICE_DRIVEN_AND_STORYTIME_READS_DO_NOT_RECHECK_CANONICAL_PRIVACY",
    "PURGE_IS_FAMILY_AUTHORITY_ONLY_NOT_SOURCE_MEDIA_OR_GLOBAL_DELETION",
  ],
};
const accounts = {};
const stories = {};
const flow = {};

async function post(url, body, idToken) {
  const headers = { "content-type": "application/json" };
  if (idToken) headers.authorization = `Bearer ${idToken}`;
  const response = await fetch(url, {
    method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(25_000),
  });
  return { status: response.status, body: await response.json() };
}
async function login(account) {
  const response = await post(`${authBase}/accounts:signInWithPassword?key=synthetic-emulator-key`, {
    email: account.email, password: account.password, returnSecureToken: true,
  });
  assert.equal(response.status, 200, "Synthetic Auth emulator sign-in must succeed.");
  account.idToken = response.body.idToken;
  account.claims = await auth.verifyIdToken(account.idToken, true);
  assert.equal(account.claims.uid, account.uid);
  assert.equal(account.claims.email_verified, true);
  return account;
}
async function syntheticAccount(name, options = {}) {
  const email = options.uid ? `${options.uid}@example.test` : `synthetic-${name}-${suffix}@example.test`;
  const password = "SyntheticOnlyLocalPassword123!";
  let uid;
  if (options.uid) {
    const record = await auth.createUser({ uid: options.uid, email, password, emailVerified: true });
    uid = record.uid;
  } else {
    const response = await post(`${authBase}/accounts:signUp?key=synthetic-emulator-key`, {
      email, password, returnSecureToken: true,
    });
    assert.equal(response.status, 200, "Synthetic Auth emulator account creation must succeed.");
    uid = response.body.localId;
    await auth.updateUser(uid, { emailVerified: true });
  }
  await auth.setCustomUserClaims(uid, {
    familyId: options.outsider ? `synthetic-other-family-${suffix}` : familyId,
    familyRole: "member",
    ...(options.delivery ? { familyReviewDelivery: true } : {}),
  });
  return login({ uid, email, password });
}
async function call(name, actor, data) {
  return post(`${functionsBase}/${name}`, { data }, actor?.idToken);
}
async function success(name, actor, data) {
  const response = await call(name, actor, data);
  assert.equal(response.status, 200, `${name} must return HTTP 200.`);
  assert.equal(response.body.error, undefined, `${name} must not return a callable error.`);
  assert.ok(Object.hasOwn(response.body, "result"), `${name} must return a callable result.`);
  return response.body.result;
}
async function denied(name, actor, data, accepted = ["PERMISSION_DENIED", "FAILED_PRECONDITION"]) {
  const response = await call(name, actor, data);
  assert.ok(response.status >= 400 && response.status < 500, `${name} must return an intentional 4xx denial.`);
  assert.ok(accepted.includes(response.body.error?.status),
    `${name} must return one of ${accepted.join(", ")}; received ${response.body.error?.status}.`);
  assert.equal(Object.hasOwn(response.body, "result"), false);
  return response.body.error;
}
function projectionDigest(story) {
  return createHash("sha256").update(JSON.stringify({
    sourceSystem: "urai-storytime", ownerUid: story.owner.uid, sessionId: story.id,
    versionId: version, title: story.title, summary: story.summary,
  })).digest("hex");
}
async function seedInertStory(name, owner) {
  const story = {
    id: `synthetic-${name}-${suffix}`, chapterId: `synthetic-${name}-chapter-${suffix}`,
    owner, title: `Synthetic ${name} title`, summary: `Synthetic inert ${name} summary.`,
  };
  await db.collection("storySessions").doc(story.id).set({
    id: story.id, userId: owner.uid, title: story.title, status: "ready", safetyStatus: "approved",
    visibility: "private", deleted: false, retired: false, revoked: false,
    currentVersionId: version, chapterIds: [story.chapterId],
    consentSnapshot: { memoryUse: true, voiceover: false },
    provenance: { sourceType: "direct_storytime_input", factualStatus: "synthetic" },
  });
  await db.collection("storyChapters").doc(story.chapterId).set({
    id: story.chapterId, userId: owner.uid, sessionId: story.id, summary: story.summary,
  });
  return story;
}
function issueArgs(story, recipient, requestName) {
  return {
    requestId: `synthetic-${requestName}-${suffix}`,
    sessionId: story.id,
    recipientUid: recipient.uid,
    sourceVersionId: version,
    approvedProjectionSha256: projectionDigest(story),
    expiresInSeconds: 900,
    acceptSyntheticPolicy: true,
  };
}
function viewArgs(story) { return { sessionId: story.id, ownerUid: story.owner.uid }; }
function grantArgs(story, recipient, receiptId) {
  return { sessionId: story.id, recipientUid: recipient.uid, consentReceiptId: receiptId, expiresInDays: 1 };
}
async function eventFor(eventId) {
  const snap = await db.collection("familyReviewOutbox").doc(eventId).get();
  assert.equal(snap.exists, true, "The issuer must create an outbox document.");
  assert.deepEqual(Object.keys(snap.data()), ["event"], "Outbox event data must remain separate from ACK state.");
  return snap.data().event;
}
async function dispatch(eventId) {
  const result = await success("reviewDispatchFamilyEvent", accounts.delivery, { eventId });
  assert.equal(result.eventId, eventId);
  assert.ok(["applied", "duplicate", "stale"].includes(result.status));
  assert.equal((await db.collection("familyReviewDeliveryAcks").doc(eventId).get()).exists, true,
    "Authenticated dispatcher must record its separate delivery ACK.");
  return result;
}
async function issuedVisible(story, recipient, name, options = {}) {
  const input = issueArgs(story, recipient, name);
  let issued;
  let concurrentIssuance;
  if (options.concurrentIssue === true) {
    const responses = await Promise.all([
      success("reviewIssueFamilyGrant", story.owner, input),
      success("reviewIssueFamilyGrant", story.owner, input),
    ]);
    assert.equal(responses.filter(response => response.duplicate === false).length, 1,
      "Concurrent identical issuance must create exactly one new decision.");
    assert.equal(responses.filter(response => response.duplicate === true).length, 1,
      "The competing identical issuance must return the existing decision.");
    for (const key of ["receiptId", "eventId", "revision", "shareEpoch"]) {
      assert.equal(responses[0][key], responses[1][key], `Concurrent issuance must converge on ${key}.`);
    }
    issued = responses.find(response => response.duplicate === false);
    concurrentIssuance = {
      requests: 2,
      newResponses: 1,
      duplicateResponses: 1,
      sameReceiptId: true,
      sameEventId: true,
      sameRevision: true,
      sameShareEpoch: true,
      scope: "ACTUAL_CONCURRENT_AUTHENTICATED_HTTP_REQUESTS",
    };
  } else {
    issued = await success("reviewIssueFamilyGrant", story.owner, input);
  }
  assert.equal(issued.duplicate, false);
  assert.ok(Number.isSafeInteger(issued.revision) && issued.revision > 0);
  assert.equal((await db.collection("consentDecisionReceipts").doc(issued.receiptId).get()).exists, false,
    "Issuance must not pretend the consumer has received a receipt.");
  const delivery = await dispatch(issued.eventId);
  assert.equal(delivery.status, "applied");
  const receipt = await db.collection("consentDecisionReceipts").doc(issued.receiptId).get();
  assert.equal(receipt.exists, true, "Only the receiver creates the positive consumer receipt.");
  assert.equal(receipt.data().userId, story.owner.uid);
  assert.equal(receipt.data().recipientUid, recipient.uid);
  const grant = await success("grantFamilyStoryView", story.owner, grantArgs(story, recipient, issued.receiptId));
  assert.equal(grant.granted, true);
  const view = await success("getFamilyStoryView", recipient, viewArgs(story));
  assert.equal(view.title, story.title);
  assert.equal(view.summary, story.summary);
  assert.deepEqual(Object.keys(view).sort(), ["sessionId", "ownerUid", "title", "summary", "provenance"].sort());
  return { input, issued, event: await eventFor(issued.eventId), concurrentIssuance };
}
async function subjectAuthorityResiduals(uid) {
  const specs = [
    ["ownerReceipts", "consentDecisionReceipts", "userId"],
    ["recipientReceipts", "consentDecisionReceipts", "recipientUid"],
    ["ownerGrants", "familyStoryViewGrants", "ownerUid"],
    ["recipientGrants", "familyStoryViewGrants", "recipientUid"],
    ["ownerSharingStates", "familyStorySharingStates", "ownerUid"],
  ];
  const counts = {};
  for (const [name, collection, field] of specs) {
    counts[name] = (await db.collection(collection).where(field, "==", uid).get()).size;
  }
  return counts;
}
async function assertPurged(uid) {
  assert.equal((await db.collection("familyReviewSubjectFences").doc(uid).get()).data()?.active, true);
  assert.equal((await db.collection("privacyDeletionTombstones").doc(uid).get()).data()?.active, true);
  const residuals = await subjectAuthorityResiduals(uid);
  for (const [name, count] of Object.entries(residuals)) assert.equal(count, 0, `Scoped deletion residual ${name} must be zero.`);
  return residuals;
}
function check(name, operation) {
  test(name, { concurrency: false, timeout: 90_000 }, async () => {
    const result = { name, status: "RUNNING" };
    evidence.checks.push(result);
    try {
      await operation();
      result.status = "PASS";
    } catch (error) {
      result.status = "FAIL";
      result.errorType = error?.code || error?.name || "Error";
      throw error;
    }
  });
}

before(async () => {
  accounts.grandma = await syntheticAccount("grandma");
  accounts.mom = await syntheticAccount("mom");
  accounts.cousin = await syntheticAccount("cousin");
  accounts.outsider = await syntheticAccount("outsider", { outsider: true });
  accounts.deleteOwner = await syntheticAccount("deletion-owner");
  accounts.deleteRecipient = await syntheticAccount("deletion-recipient");
  accounts.delivery = await syntheticAccount("delivery", { uid: deliveryUid, delivery: true });
  accounts.deliveryImpostor = await syntheticAccount("delivery-impostor", { delivery: true });
  stories.main = await seedInertStory("one-shared-memory", accounts.grandma);
  stories.unshared = await seedInertStory("unshared-second-memory", accounts.grandma);
  stories.delayed = await seedInertStory("delayed-grant-memory", accounts.grandma);
  stories.ownerDelete = await seedInertStory("owner-deletion-memory", accounts.deleteOwner);
  stories.recipientDelete = await seedInertStory("recipient-deletion-memory", accounts.grandma);
  stories.foreignControl = await seedInertStory("unaffected-foreign-memory", accounts.grandma);
});

check("verified relatives share family claims but an unissued source grants no access", async () => {
  for (const name of ["grandma", "mom", "cousin"]) {
    assert.equal(accounts[name].claims.email_verified, true);
    assert.equal(accounts[name].claims.familyId, familyId);
  }
  assert.notEqual(accounts.outsider.claims.familyId, familyId);
  await denied("getFamilyStoryView", accounts.mom, viewArgs(stories.main));
  await denied("grantFamilyStoryView", accounts.grandma,
    grantArgs(stories.main, accounts.mom, `synthetic-nonexistent-receipt-${suffix}`));
  assert.equal((await db.collection("consentDecisionReceipts").where("userId", "==", accounts.grandma.uid).get()).size, 0);
});

check("unchanged canonical Privacy set and evaluate APIs still reject family purpose", async () => {
  const beforeReceipts = (await db.collection("consentDecisionReceipts").where("userId", "==", accounts.grandma.uid).get()).size;
  const setter = await denied("privacySetCanonicalConsent", accounts.grandma, {
    purpose, status: "granted", surface: "isolated-issued-review", jurisdiction: "synthetic",
  }, ["FAILED_PRECONDITION"]);
  assert.match(setter.message, /Unknown consent purpose/);
  const evaluator = await denied("privacyEvaluateCanonicalConsent", accounts.grandma, {
    purpose, targetUid: accounts.grandma.uid, correlationId: `synthetic-issued-${suffix}`,
  }, ["FAILED_PRECONDITION"]);
  assert.match(evaluator.message, /Unknown consent purpose/);
  assert.equal((await db.collection("consentRecords").doc(`${accounts.grandma.uid}_storytime_family_share`).get()).exists, false);
  assert.equal((await db.collection("consentDecisionReceipts").where("userId", "==", accounts.grandma.uid).get()).size, beforeReceipts);
});

check("concurrent identical owner issuance converges on one receipt and event before delivery enables Mom's exact view", async () => {
  flow.main = await issuedVisible(stories.main, accounts.mom, "main-issue", { concurrentIssue: true });
  evidence.concurrentIssuance = flow.main.concurrentIssuance;
  const event = flow.main.event;
  assert.equal(event.kind, "grant");
  assert.equal(event.projectId, projectId);
  assert.equal(event.audience, "urai-storytime-review");
  assert.equal(event.ownerUid, accounts.grandma.uid);
  assert.equal(event.recipientUid, accounts.mom.uid);
  assert.equal(event.receipt.approvedProjectionSha256, projectionDigest(stories.main));
  assert.equal((await db.collection("familyReviewDecisions").doc(flow.main.issued.receiptId).get()).exists, true);
});

check("exact issue and delivery retries are idempotent while conflicting issuance is denied", async () => {
  const repeated = await success("reviewIssueFamilyGrant", accounts.grandma, flow.main.input);
  assert.equal(repeated.duplicate, true);
  for (const key of ["receiptId", "eventId", "revision", "shareEpoch"]) assert.equal(repeated[key], flow.main.issued[key]);
  const repeatedDelivery = await dispatch(flow.main.issued.eventId);
  assert.equal(repeatedDelivery.status, "duplicate");
  await denied("reviewIssueFamilyGrant", accounts.grandma, {
    ...flow.main.input, recipientUid: accounts.cousin.uid,
  }, ["FAILED_PRECONDITION", "PERMISSION_DENIED", "ALREADY_EXISTS"]);
  assert.deepEqual(await eventFor(flow.main.issued.eventId), flow.main.event);
  assert.equal((await db.collection("consentDecisionReceipts").where("userId", "==", accounts.grandma.uid).get()).size, 1);
});

check("same-family cousin, outsider, second story and foreign-owner issuance deny", async () => {
  await denied("getFamilyStoryView", accounts.cousin, viewArgs(stories.main));
  await denied("getFamilyStoryView", accounts.outsider, viewArgs(stories.main));
  await denied("getFamilyStoryView", accounts.mom, viewArgs(stories.unshared));
  await denied("reviewIssueFamilyGrant", accounts.mom,
    issueArgs(stories.main, accounts.cousin, "foreign-owner-attempt"));
  await denied("reviewIssueFamilyGrant", accounts.grandma, {
    ...issueArgs(stories.unshared, accounts.mom, "owner-field-attempt"), ownerUid: accounts.grandma.uid,
  }, ["INVALID_ARGUMENT"]);
});

check("ordinary users cannot dispatch or accept an otherwise valid signed event", async () => {
  for (const actor of [accounts.grandma, accounts.cousin, accounts.outsider]) {
    await denied("reviewDispatchFamilyEvent", actor, { eventId: flow.main.issued.eventId }, ["PERMISSION_DENIED", "UNAUTHENTICATED"]);
    await denied("reviewAcceptFamilyEvent", actor, { event: flow.main.event }, ["PERMISSION_DENIED", "UNAUTHENTICATED"]);
  }
});

check("delivery requires its exact UID and current account claim rather than a copied token claim", async () => {
  assert.equal(accounts.deliveryImpostor.claims.familyReviewDelivery, true);
  await denied("reviewDispatchFamilyEvent", accounts.deliveryImpostor,
    { eventId: flow.main.issued.eventId }, ["PERMISSION_DENIED", "UNAUTHENTICATED"]);
  await auth.setCustomUserClaims(deliveryUid, { familyReviewDelivery: false });
  try {
    await denied("reviewDispatchFamilyEvent", accounts.delivery,
      { eventId: flow.main.issued.eventId }, ["PERMISSION_DENIED", "UNAUTHENTICATED"]);
  } finally {
    await auth.setCustomUserClaims(deliveryUid, { familyReviewDelivery: true });
    await login(accounts.delivery);
  }
});

check("altered public envelope cannot replace the immutable delivered event", async () => {
  const originalInbox = (await db.collection("familyReviewDeliveryEvents").doc(flow.main.issued.eventId).get()).data();
  for (const mutated of [
    { ...flow.main.event, recipientUid: accounts.cousin.uid },
    { ...flow.main.event, audience: "unapproved-consumer" },
    { ...flow.main.event, receipt: { ...flow.main.event.receipt, approvedProjectionSha256: "a".repeat(64) } },
  ]) {
    await denied("reviewAcceptFamilyEvent", accounts.delivery, { event: mutated },
      ["PERMISSION_DENIED", "INVALID_ARGUMENT", "FAILED_PRECONDITION", "ALREADY_EXISTS"]);
  }
  assert.deepEqual((await db.collection("familyReviewDeliveryEvents").doc(flow.main.issued.eventId).get()).data(), originalInbox);
  assert.deepEqual(await eventFor(flow.main.issued.eventId), flow.main.event);
});

check("same-version content change invalidates the issued projection until the source is restored", async () => {
  const chapter = db.collection("storyChapters").doc(stories.main.chapterId);
  await chapter.update({ summary: "Synthetic unapproved edit with the same source version" });
  try {
    await denied("getFamilyStoryView", accounts.mom, viewArgs(stories.main));
    await denied("reviewIssueFamilyGrant", accounts.grandma,
      issueArgs(stories.main, accounts.mom, "stale-digest-attempt"));
  } finally {
    await chapter.update({ summary: stories.main.summary });
  }
  assert.equal((await success("getFamilyStoryView", accounts.mom, viewArgs(stories.main))).summary, stories.main.summary);
});

check("owner withdrawal is issued and delivered, terminal, idempotent and replay resistant", async () => {
  const input = { requestId: `synthetic-main-withdraw-${suffix}`, receiptId: flow.main.issued.receiptId };
  const withdrawn = await success("reviewWithdrawFamilyGrant", accounts.grandma, input);
  assert.ok(withdrawn.revision > flow.main.issued.revision);
  assert.ok(withdrawn.shareEpoch > flow.main.issued.shareEpoch);
  const delivered = await dispatch(withdrawn.eventId);
  assert.equal(delivered.status, "applied");
  await denied("getFamilyStoryView", accounts.mom, viewArgs(stories.main));
  const repeated = await success("reviewWithdrawFamilyGrant", accounts.grandma, input);
  for (const key of ["eventId", "revision", "shareEpoch"]) assert.equal(repeated[key], withdrawn[key]);
  assert.equal((await dispatch(withdrawn.eventId)).status, "duplicate");
  await dispatch(flow.main.issued.eventId);
  await denied("getFamilyStoryView", accounts.mom, viewArgs(stories.main));
  await denied("grantFamilyStoryView", accounts.grandma,
    grantArgs(stories.main, accounts.mom, flow.main.issued.receiptId));
  await denied("reviewIssueFamilyGrant", accounts.grandma,
    issueArgs(stories.main, accounts.mom, "withdrawn-reissue-attempt"));
  assert.equal((await db.collection("familyStorySharingStates").doc(stories.main.id).get()).data().shareEpoch, withdrawn.shareEpoch);
});

check("withdrawal delivered before delayed grant prevents any later authorization", async () => {
  const input = issueArgs(stories.delayed, accounts.mom, "delayed-issue");
  const issued = await success("reviewIssueFamilyGrant", accounts.grandma, input);
  assert.equal((await db.collection("consentDecisionReceipts").doc(issued.receiptId).get()).exists, false);
  const withdrawn = await success("reviewWithdrawFamilyGrant", accounts.grandma, {
    requestId: `synthetic-delayed-withdraw-${suffix}`, receiptId: issued.receiptId,
  });
  assert.equal((await dispatch(withdrawn.eventId)).status, "applied");
  const late = await dispatch(issued.eventId);
  assert.equal(late.status, "stale");
  const receipt = await db.collection("consentDecisionReceipts").doc(issued.receiptId).get();
  assert.ok(!receipt.exists || receipt.data().revoked === true);
  await denied("grantFamilyStoryView", accounts.grandma, grantArgs(stories.delayed, accounts.mom, issued.receiptId));
  await denied("getFamilyStoryView", accounts.mom, viewArgs(stories.delayed));
  await dispatch(issued.eventId);
  await denied("getFamilyStoryView", accounts.mom, viewArgs(stories.delayed));
});

check("actual owner deletion propagates a fence and purges scoped authority without deleting foreign sources", async () => {
  flow.foreignControl = await issuedVisible(stories.foreignControl, accounts.cousin, "foreign-control-issue");
  flow.ownerDelete = await issuedVisible(stories.ownerDelete, accounts.mom, "owner-delete-issue");
  const foreignSourceBefore = (await db.collection("storySessions").doc(stories.foreignControl.id).get()).data();
  const foreignChapterBefore = (await db.collection("storyChapters").doc(stories.foreignControl.chapterId).get()).data();
  flow.ownerDelete.deleteInput = { requestId: `synthetic-owner-delete-${suffix}` };
  flow.ownerDelete.deletion = await success("reviewDeleteFamilySubject", accounts.deleteOwner, flow.ownerDelete.deleteInput);
  assert.equal((await db.collection("familyReviewSubjectFences").doc(accounts.deleteOwner.uid).get()).data()?.active, true);
  await dispatch(flow.ownerDelete.deletion.eventId);
  evidence.ownerDeletionResiduals = await assertPurged(accounts.deleteOwner.uid);
  await denied("getFamilyStoryView", accounts.mom, viewArgs(stories.ownerDelete));
  assert.deepEqual((await db.collection("storySessions").doc(stories.foreignControl.id).get()).data(), foreignSourceBefore);
  assert.deepEqual((await db.collection("storyChapters").doc(stories.foreignControl.chapterId).get()).data(), foreignChapterBefore);
  assert.equal((await success("getFamilyStoryView", accounts.cousin, viewArgs(stories.foreignControl))).summary, stories.foreignControl.summary);
  assert.equal((await db.collection("storySessions").doc(stories.ownerDelete.id).get()).exists, true,
    "This prototype's authority purge must not be presented as source/media deletion.");
});

check("actual recipient deletion purges its authority while preserving someone else's story and grants", async () => {
  flow.recipientDelete = await issuedVisible(stories.recipientDelete, accounts.deleteRecipient, "recipient-delete-issue");
  const sourceBefore = (await db.collection("storySessions").doc(stories.recipientDelete.id).get()).data();
  const chapterBefore = (await db.collection("storyChapters").doc(stories.recipientDelete.chapterId).get()).data();
  const otherOwnerState = db.collection("familyStorySharingStates").doc(stories.main.id);
  const otherOwnerStateBefore = (await otherOwnerState.get()).data();
  assert.equal(otherOwnerStateBefore.ownerUid, accounts.grandma.uid);
  flow.recipientDelete.deleteInput = { requestId: `synthetic-recipient-delete-${suffix}` };
  flow.recipientDelete.deletion = await success("reviewDeleteFamilySubject", accounts.deleteRecipient, flow.recipientDelete.deleteInput);
  await dispatch(flow.recipientDelete.deletion.eventId);
  evidence.recipientDeletionResiduals = await assertPurged(accounts.deleteRecipient.uid);
  await denied("getFamilyStoryView", accounts.deleteRecipient, viewArgs(stories.recipientDelete));
  assert.deepEqual((await db.collection("storySessions").doc(stories.recipientDelete.id).get()).data(), sourceBefore);
  assert.deepEqual((await db.collection("storyChapters").doc(stories.recipientDelete.chapterId).get()).data(), chapterBefore);
  assert.deepEqual((await otherOwnerState.get()).data(), otherOwnerStateBefore);
  assert.equal((await success("getFamilyStoryView", accounts.cousin, viewArgs(stories.foreignControl))).summary, stories.foreignControl.summary);
});

check("delayed grant replays and delete retries cannot restore deleted owner or recipient authority", async () => {
  for (const [name, subject, recipient, story] of [
    ["ownerDelete", accounts.deleteOwner, accounts.mom, stories.ownerDelete],
    ["recipientDelete", accounts.deleteRecipient, accounts.deleteRecipient, stories.recipientDelete],
  ]) {
    const entry = flow[name];
    await dispatch(entry.issued.eventId);
    await denied("getFamilyStoryView", recipient, viewArgs(story));
    await denied("grantFamilyStoryView", story.owner, grantArgs(story, recipient, entry.issued.receiptId));
    await denied("reviewIssueFamilyGrant", story.owner,
      issueArgs(story, recipient, `post-delete-${name}`));
    const retried = await success("reviewDeleteFamilySubject", subject, entry.deleteInput);
    assert.equal(retried.eventId, entry.deletion.eventId);
    await dispatch(entry.deletion.eventId);
    await assertPurged(subject.uid);
  }
  assert.equal((await success("getFamilyStoryView", accounts.cousin, viewArgs(stories.foreignControl))).summary, stories.foreignControl.summary);
});

after(async () => {
  evidence.finishedAt = new Date().toISOString();
  evidence.passedCheckCount = evidence.checks.filter(item => item.status === "PASS").length;
  evidence.failedCheckCount = evidence.checks.filter(item => item.status === "FAIL").length;
  evidence.executionComplete = evidence.checks.length === 14
    && evidence.checks.every(item => item.status === "PASS");
  // Success here describes this synthetic review implementation only. These
  // booleans never imply registration, live service identity or release approval.
  evidence.syntheticIssuer = evidence.executionComplete;
  evidence.syntheticDelivery = evidence.executionComplete;
  evidence.syntheticStoryScopedWithdrawalPropagation = evidence.executionComplete;
  evidence.syntheticFamilyAuthorityDeletionPropagation = evidence.executionComplete;
  fs.mkdirSync(dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(`FAMILY_ISSUED_GATE_REPORT ${JSON.stringify({
    executionComplete: evidence.executionComplete,
    passedCheckCount: evidence.passedCheckCount,
    failedCheckCount: evidence.failedCheckCount,
    syntheticIssuer: evidence.syntheticIssuer,
    syntheticDelivery: evidence.syntheticDelivery,
    syntheticStoryScopedWithdrawalPropagation: evidence.syntheticStoryScopedWithdrawalPropagation,
    syntheticFamilyAuthorityDeletionPropagation: evidence.syntheticFamilyAuthorityDeletionPropagation,
    canonicalProductionIssuance: false,
    cloudServiceIdentity: false,
    automaticOutboxScheduling: false,
    currentCanonicalReadRecheck: false,
    ownerWideWithdrawal: false,
    globalDeletionComplete: false,
  })}`);
  await db.terminate();
  await deleteApp(app);
});
