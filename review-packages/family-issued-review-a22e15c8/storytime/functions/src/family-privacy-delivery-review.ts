/**
 * Isolated synthetic Privacy -> Storytime delivery proposal.
 * Export only from the disposable review fixture, never ordinary Functions.
 * No signer, production purpose registration, media access, or global deletion
 * authority is provided here. Storytime #120 remains the unchanged consumer.
 */
import { createHash, createPublicKey, verify } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue, Timestamp, getFirestore,
  type DocumentSnapshot, type Query, type Transaction,
} from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { requireCurrentStorytimeOwner } from "./privacy-actor.js";
import { verifyFamilyPrivacyReceiptSignature } from "./family-privacy-receipt-signature.js";

const PROJECT = "demo-urai-family-issued-review";
const AUDIENCE = "urai-storytime-review";
const DELIVERY_UID = "synthetic-family-privacy-delivery";
const MAX_TRANSACTION_GRANTS = 200;
const PURGE_PAGE_SIZE = 200;
const MAX_PURGE_PAGES_PER_QUERY = 25;
const ID = z.string().min(1).max(220).regex(/^[A-Za-z0-9._-]+$/);
const EVENT_ID = z.string().regex(/^review-event-[a-f0-9]{64}$/);
const RECEIPT_ID = z.string().regex(/^review-receipt-[a-f0-9]{64}$/);
const KEY_ID = z.string().min(8).max(100).regex(/^[A-Za-z0-9._-]+$/);
const NONNEGATIVE_INTEGER = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const SIGNATURE = z.string().regex(/^[A-Za-z0-9_-]{86}$/);

const ReceiptSchema = z.object({
  schemaVersion: z.literal("storytime-consent-decision-receipt-v1"),
  id: RECEIPT_ID,
  userId: ID,
  sourceSessionId: ID,
  recipientUid: ID,
  sourceVersionId: ID,
  shareEpoch: NONNEGATIVE_INTEGER,
  purpose: z.literal("storytime.family_share"),
  policyVersion: z.literal("family-story-share-v1"),
  decision: z.literal("authorized"),
  issuedBy: z.literal("urai-privacy"),
  approvedProjectionSha256: z.string().regex(/^[a-f0-9]{64}$/),
  expiresAtMs: NONNEGATIVE_INTEGER,
  issuerKeyId: KEY_ID,
  issuerSignature: SIGNATURE,
}).strict();
const EventSchema = z.object({
  schemaVersion: z.literal("family-review-event-v1"),
  eventId: EVENT_ID,
  kind: z.enum(["grant", "withdraw", "delete-subject"]),
  projectId: z.literal(PROJECT),
  audience: z.literal(AUDIENCE),
  subjectUid: z.union([ID, z.literal("")]),
  ownerUid: z.union([ID, z.literal("")]),
  recipientUid: z.union([ID, z.literal("")]),
  sessionId: z.union([ID, z.literal("")]),
  receiptId: z.union([RECEIPT_ID, z.literal("")]),
  revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  shareEpoch: NONNEGATIVE_INTEGER,
  issuedAtMs: NONNEGATIVE_INTEGER,
  receipt: ReceiptSchema.nullable(),
  issuerKeyId: KEY_ID,
  eventSignature: SIGNATURE,
}).strict();
const InputSchema = z.object({ event: EventSchema }).strict();
type ReviewEvent = z.infer<typeof EventSchema>;
type ReviewReceipt = z.infer<typeof ReceiptSchema>;
type ActorRequest = Parameters<typeof requireCurrentStorytimeOwner>[0];
type DeliveryStatus = "applied" | "duplicate" | "stale";
type DeliveryResult = {
  eventId: string;
  status: DeliveryStatus;
  revision: number;
  shareEpoch?: number;
  receiptId?: string;
};
type DeliveryScope = {
  ownerUid: string;
  sessionId: string;
  revision: number;
  shareEpoch: number;
  status: "active" | "withdrawn";
};

const adminApp = getApps().find((candidate) => candidate.name === "[DEFAULT]")
  ?? initializeApp({ projectId: PROJECT });
const db = getFirestore(adminApp);

function denied() {
  return new HttpsError("permission-denied", "This synthetic family authority event is not available.");
}
function assertIsolation() {
  const env = process.env;
  if (adminApp.options.projectId !== PROJECT) {
    throw new HttpsError("failed-precondition", "The review Firebase app does not match the demo project.");
  }
  if (env.FAMILY_ISSUED_REVIEW_ENABLED !== "synthetic-only-v1"
    || env.FAMILY_ISSUED_REVIEW_POLICY !== "synthetic-explicit-text-consent-v1"
    || (env.GCLOUD_PROJECT !== PROJECT && env.GOOGLE_CLOUD_PROJECT !== PROJECT)
    || (env.GCLOUD_PROJECT !== undefined && env.GCLOUD_PROJECT !== PROJECT)
    || (env.GOOGLE_CLOUD_PROJECT !== undefined && env.GOOGLE_CLOUD_PROJECT !== PROJECT)
    || env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:30099"
    || env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:30080"
    || env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:30199"
    || env.FUNCTIONS_EMULATOR !== "true"
    || env.FUNCTIONS_EMULATOR_HOST !== "127.0.0.1:30001"
    || (env.STORAGE_EMULATOR_HOST !== undefined && env.STORAGE_EMULATOR_HOST !== "http://127.0.0.1:30199")) {
    throw new HttpsError("failed-precondition", "Exact isolated family review emulators and synthetic policy are required.");
  }
  let config: Record<string, unknown> = {};
  try { config = env.FIREBASE_CONFIG ? JSON.parse(env.FIREBASE_CONFIG) : {}; }
  catch { throw new HttpsError("failed-precondition", "Invalid isolated Firebase configuration."); }
  if (!config || typeof config !== "object" || Array.isArray(config)
    || (config.projectId !== undefined && config.projectId !== PROJECT)
    || (config.storageBucket !== undefined && config.storageBucket !== `${PROJECT}.appspot.com`)) {
    throw new HttpsError("failed-precondition", "Unexpected isolated Firebase configuration.");
  }
  for (const name of ["GOOGLE_APPLICATION_CREDENTIALS", "GOOGLE_OAUTH_ACCESS_TOKEN", "GOOGLE_CLOUD_ACCESS_TOKEN", "FIREBASE_TOKEN", "FIREBASE_CLI_TOKEN"]) {
    if (env[name]) throw new HttpsError("failed-precondition", "Cloud credentials are forbidden in this synthetic receiver.");
  }
}

async function requireDeliveryActor(request: ActorRequest) {
  const uid = await requireCurrentStorytimeOwner(request);
  if (uid !== DELIVERY_UID || request.auth?.token?.familyReviewDelivery !== true) throw denied();
  const bearer = request.rawRequest?.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!bearer) throw denied();
  try {
    const auth = getAuth();
    const account = await auth.getUser(uid);
    const current = await auth.verifyIdToken(bearer, true);
    if (account.uid !== uid || account.disabled || !account.emailVerified
      || account.customClaims?.familyReviewDelivery !== true
      || current.uid !== uid || current.email_verified !== true
      || current.familyReviewDelivery !== true) throw denied();
  } catch { throw denied(); }
}

async function requireActiveAccount(uid: string) {
  const account = await getAuth().getUser(uid).catch(() => { throw denied(); });
  if (account.uid !== uid || account.disabled || !account.emailVerified) throw denied();
}

// Independently encoded from CONTRACT.md; do not trust caller serialization.
function receiptTuple(receipt: ReviewReceipt) {
  return [
    receipt.schemaVersion, receipt.id, receipt.userId, receipt.sourceSessionId,
    receipt.recipientUid, receipt.sourceVersionId, receipt.shareEpoch,
    receipt.purpose, receipt.policyVersion, receipt.decision, receipt.issuedBy,
    receipt.approvedProjectionSha256, receipt.expiresAtMs,
    receipt.issuerKeyId, receipt.issuerSignature,
  ];
}
function eventBytes(event: ReviewEvent) {
  return Buffer.from(JSON.stringify([
    "urai-family-review-event-v1", event.schemaVersion, event.eventId, event.kind,
    event.projectId, event.audience, event.subjectUid, event.ownerUid,
    event.recipientUid, event.sessionId, event.receiptId, event.revision,
    event.shareEpoch, event.issuedAtMs,
    event.receipt === null ? null : receiptTuple(event.receipt), event.issuerKeyId,
  ]), "utf8");
}
function validateEnvelope(event: ReviewEvent) {
  if (event.kind === "delete-subject") {
    if (!event.subjectUid || event.ownerUid || event.recipientUid || event.sessionId
      || event.receiptId || event.receipt !== null || event.shareEpoch !== 0) throw denied();
  } else {
    if (event.subjectUid || !event.ownerUid || !event.recipientUid || !event.sessionId
      || !event.receiptId || event.ownerUid === event.recipientUid) throw denied();
    if (event.kind === "withdraw") {
      if (event.receipt !== null || event.shareEpoch < 1) throw denied();
    } else {
      const receipt = event.receipt;
      if (!receipt || receipt.id !== event.receiptId || receipt.userId !== event.ownerUid
        || receipt.recipientUid !== event.recipientUid || receipt.sourceSessionId !== event.sessionId
        || receipt.shareEpoch !== event.shareEpoch || receipt.issuerKeyId !== event.issuerKeyId
        || receipt.expiresAtMs - event.issuedAtMs < 60_000
        || receipt.expiresAtMs - event.issuedAtMs > 3_600_000
        || !verifyFamilyPrivacyReceiptSignature(receipt, receipt.issuerSignature, receipt.issuerKeyId)) throw denied();
    }
  }
  try {
    const keyId = process.env.STORYTIME_FAMILY_PRIVACY_ED25519_KEY_ID;
    const keyBase64 = process.env.STORYTIME_FAMILY_PRIVACY_ED25519_PUBLIC_KEY_SPKI_B64;
    if (keyId !== event.issuerKeyId || !keyBase64) throw denied();
    const der = Buffer.from(keyBase64, "base64");
    if (der.toString("base64") !== keyBase64) throw denied();
    const publicKey = createPublicKey({ key: der, format: "der", type: "spki" });
    const signature = Buffer.from(event.eventSignature, "base64url");
    if (publicKey.asymmetricKeyType !== "ed25519" || signature.length !== 64
      || signature.toString("base64url") !== event.eventSignature
      || !verify(null, eventBytes(event), publicKey, signature)) throw denied();
  } catch { throw denied(); }
}
function digestEvent(event: ReviewEvent) {
  return createHash("sha256").update(eventBytes(event)).update("\0").update(event.eventSignature).digest("hex");
}
function scopeId(event: ReviewEvent) {
  return createHash("sha256").update(JSON.stringify([event.ownerUid, event.sessionId])).digest("hex");
}
function grantId(event: ReviewEvent) {
  return createHash("sha256").update(JSON.stringify([event.sessionId, event.recipientUid])).digest("hex");
}
function readEpoch(snapshot: DocumentSnapshot) {
  if (!snapshot.exists) return 0;
  const epoch = snapshot.data()?.shareEpoch;
  if (!Number.isSafeInteger(epoch) || epoch < 0) throw denied();
  return epoch as number;
}
function readScope(snapshot: DocumentSnapshot, event: ReviewEvent): DeliveryScope | null {
  if (!snapshot.exists) return null;
  const scope = snapshot.data();
  if (!scope || scope.ownerUid !== event.ownerUid || scope.sessionId !== event.sessionId
    || !Number.isSafeInteger(scope.revision) || scope.revision < 1
    || !Number.isSafeInteger(scope.shareEpoch) || scope.shareEpoch < 0
    || !["active", "withdrawn"].includes(scope.status)) throw denied();
  return scope as DeliveryScope;
}
function isDuplicate(snapshot: DocumentSnapshot, event: ReviewEvent, digest: string) {
  if (!snapshot.exists) return false;
  const stored = snapshot.data();
  if (stored?.digest !== digest || stored.kind !== event.kind
    || !["applied", "stale"].includes(stored.status)) throw denied();
  return true;
}
function recordEvent(tx: Transaction, event: ReviewEvent, digest: string,
  status: "applied" | "stale", extra: Record<string, unknown> = {}) {
  tx.create(db.collection("familyReviewDeliveryEvents").doc(event.eventId), {
    digest, kind: event.kind, status, revision: event.revision,
    scopeId: event.kind === "delete-subject" ? null : scopeId(event),
    createdAt: FieldValue.serverTimestamp(), reviewOnly: true, ...extra,
  });
}
function result(event: ReviewEvent, status: DeliveryStatus, revision = event.revision, shareEpoch = event.shareEpoch): DeliveryResult {
  return { eventId: event.eventId, status, revision, shareEpoch,
    ...(event.receiptId ? { receiptId: event.receiptId } : {}) };
}
function activeSource(story: Record<string, any>, ownerUid: string) {
  return story.userId === ownerUid && story.safetyStatus === "approved"
    && story.visibility === "private" && story.deleted !== true
    && story.revoked !== true && story.retired !== true && story.status === "ready"
    && typeof story.currentVersionId === "string" && story.currentVersionId.length > 0
    && story.consentSnapshot?.memoryUse === true;
}
function projectionDigest(story: Record<string, any>, chapter: Record<string, any>, event: ReviewEvent) {
  if (typeof story.title !== "string" || !story.title.trim() || story.title.length > 200
    || chapter.userId !== event.ownerUid || chapter.sessionId !== event.sessionId
    || typeof chapter.summary !== "string" || !chapter.summary.trim() || chapter.summary.length > 4000) throw denied();
  return createHash("sha256").update(JSON.stringify({
    sourceSystem: "urai-storytime", ownerUid: event.ownerUid, sessionId: event.sessionId,
    versionId: story.currentVersionId, title: story.title, summary: chapter.summary,
  })).digest("hex");
}
function sameStoredReceipt(snapshot: DocumentSnapshot, receipt: ReviewReceipt) {
  const stored = snapshot.data();
  if (!stored || !(stored.expiresAt instanceof Timestamp)) return false;
  const candidate = ReceiptSchema.safeParse({
    schemaVersion: stored.schemaVersion, id: stored.id, userId: stored.userId,
    sourceSessionId: stored.sourceSessionId, recipientUid: stored.recipientUid,
    sourceVersionId: stored.sourceVersionId, shareEpoch: stored.shareEpoch,
    purpose: stored.purpose, policyVersion: stored.policyVersion,
    decision: stored.decision, issuedBy: stored.issuedBy,
    approvedProjectionSha256: stored.approvedProjectionSha256,
    expiresAtMs: stored.expiresAt.toMillis(),
    issuerKeyId: stored.issuerKeyId, issuerSignature: stored.issuerSignature,
  });
  return candidate.success && JSON.stringify(receiptTuple(candidate.data)) === JSON.stringify(receiptTuple(receipt));
}

function duplicateResult(event: ReviewEvent, inbox: DocumentSnapshot) {
  const revision = inbox.data()?.appliedRevision ?? event.revision;
  const epoch = inbox.data()?.appliedShareEpoch ?? event.shareEpoch;
  if (!Number.isSafeInteger(revision) || revision < 1 || !Number.isSafeInteger(epoch) || epoch < 0) throw denied();
  return result(event, "duplicate", revision, epoch);
}

async function applyGrant(event: ReviewEvent, digest: string, request: ActorRequest) {
  const receipt = event.receipt!;
  const outcome = await db.runTransaction(async (tx) => {
    const iRef = db.collection("familyReviewDeliveryEvents").doc(event.eventId);
    const dRef = db.collection("familyReviewDeliveryScopes").doc(scopeId(event));
    const eRef = db.collection("familyStorySharingStates").doc(event.sessionId);
    const pRef = db.collection("consentDecisionReceipts").doc(event.receiptId);
    const gRef = db.collection("familyStoryViewGrants").doc(grantId(event));
    const sRef = db.collection("storySessions").doc(event.sessionId);
    const [inbox, scopeSnapshot, epochSnapshot, previousReceipt, grant, source, ownerFence, recipientFence] = await Promise.all([
      tx.get(iRef), tx.get(dRef), tx.get(eRef), tx.get(pRef), tx.get(gRef), tx.get(sRef),
      tx.get(db.collection("privacyDeletionTombstones").doc(event.ownerUid)),
      tx.get(db.collection("privacyDeletionTombstones").doc(event.recipientUid)),
    ]);
    if (isDuplicate(inbox, event, digest)) return duplicateResult(event, inbox);
    const scope = readScope(scopeSnapshot, event);
    const epoch = readEpoch(epochSnapshot);
    if (previousReceipt.exists && !sameStoredReceipt(previousReceipt, receipt)) throw denied();
    if (ownerFence.data()?.active === true || recipientFence.data()?.active === true
      || scope?.status === "withdrawn" || (scope && event.revision < scope.revision)
      || epoch !== event.shareEpoch || grant.data()?.status === "revoked"
      || previousReceipt.data()?.revoked === true || receipt.expiresAtMs <= Date.now()) {
      const revision = Math.max(event.revision, scope?.revision ?? 0);
      recordEvent(tx, event, digest, "stale", { appliedRevision: revision, appliedShareEpoch: epoch });
      return result(event, "stale", revision, epoch);
    }
    if (scope && event.revision === scope.revision) throw denied();
    if (epochSnapshot.exists && (epochSnapshot.data()?.ownerUid !== event.ownerUid
      || epochSnapshot.data()?.sessionId !== event.sessionId)) throw denied();
    const story = source.data() ?? {};
    if (!source.exists || !activeSource(story, event.ownerUid)
      || story.currentVersionId !== receipt.sourceVersionId
      || !Array.isArray(story.chapterIds) || story.chapterIds.length !== 1
      || !ID.safeParse(story.chapterIds[0]).success) throw denied();
    const chapter = await tx.get(db.collection("storyChapters").doc(story.chapterIds[0] as string));
    if (!chapter.exists || projectionDigest(story, chapter.data() ?? {}, event) !== receipt.approvedProjectionSha256) throw denied();
    await requireActiveAccount(event.ownerUid);
    await requireActiveAccount(event.recipientUid);
    await requireDeliveryActor(request);
    // Every Firestore read above precedes the first transaction write.
    if (!previousReceipt.exists) {
      const { expiresAtMs, ...signedFields } = receipt;
      tx.create(pRef, { ...signedFields, expiresAt: Timestamp.fromMillis(expiresAtMs), revoked: false,
        reviewDeliveryEventId: event.eventId, reviewOnly: true });
    }
    tx.set(dRef, { ownerUid: event.ownerUid, sessionId: event.sessionId,
      revision: event.revision, shareEpoch: epoch, status: "active",
      updatedAt: FieldValue.serverTimestamp(), reviewOnly: true });
    recordEvent(tx, event, digest, "applied", { appliedRevision: event.revision, appliedShareEpoch: epoch });
    return result(event, "applied");
  });
  if (outcome.status === "applied") {
    await requireActiveAccount(event.ownerUid);
    await requireActiveAccount(event.recipientUid);
  }
  return outcome;
}

async function applyWithdrawal(event: ReviewEvent, digest: string, request: ActorRequest) {
  return db.runTransaction(async (tx) => {
    const iRef = db.collection("familyReviewDeliveryEvents").doc(event.eventId);
    const dRef = db.collection("familyReviewDeliveryScopes").doc(scopeId(event));
    const eRef = db.collection("familyStorySharingStates").doc(event.sessionId);
    const pRef = db.collection("consentDecisionReceipts").doc(event.receiptId);
    const [inbox, scopeSnapshot, epochSnapshot, previousReceipt, source, ownerFence, grants] = await Promise.all([
      tx.get(iRef), tx.get(dRef), tx.get(eRef), tx.get(pRef),
      tx.get(db.collection("storySessions").doc(event.sessionId)),
      tx.get(db.collection("privacyDeletionTombstones").doc(event.ownerUid)),
      tx.get(db.collection("familyStoryViewGrants").where("sessionId", "==", event.sessionId).limit(MAX_TRANSACTION_GRANTS + 1)),
    ]);
    if (isDuplicate(inbox, event, digest)) return duplicateResult(event, inbox);
    const scope = readScope(scopeSnapshot, event);
    const epoch = readEpoch(epochSnapshot);
    if (ownerFence.data()?.active === true) {
      // Never recreate purged sharing state after an owner deletion barrier.
      const revision = Math.max(event.revision, scope?.revision ?? 0);
      recordEvent(tx, event, digest, "stale", { appliedRevision: revision, appliedShareEpoch: epoch });
      return result(event, "stale", revision, epoch);
    }
    if (scope && event.revision === scope.revision) throw denied();
    if ((source.exists && source.data()?.userId !== event.ownerUid)
      || (epochSnapshot.exists && (epochSnapshot.data()?.ownerUid !== event.ownerUid
        || epochSnapshot.data()?.sessionId !== event.sessionId))
      || (previousReceipt.exists && (previousReceipt.data()?.userId !== event.ownerUid
        || previousReceipt.data()?.sourceSessionId !== event.sessionId
        || previousReceipt.data()?.recipientUid !== event.recipientUid))) throw denied();
    if (grants.size > MAX_TRANSACTION_GRANTS) {
      throw new HttpsError("failed-precondition", "Synthetic story grant inventory exceeds the bounded atomic withdrawal scope.");
    }
    if (grants.docs.some((grant) => grant.data().ownerUid !== event.ownerUid)) throw denied();
    // Withdrawal is terminal in this narrow proposal, even when delivery is
    // reordered. An already-withdrawn scope never becomes active again.
    const nextEpoch = Math.max(event.shareEpoch, scope?.shareEpoch ?? 0,
      scope?.status === "withdrawn" ? epoch : epoch + 1);
    if (!Number.isSafeInteger(nextEpoch)) throw denied();
    const revision = Math.max(event.revision, scope?.revision ?? 0);
    await requireDeliveryActor(request);
    tx.set(dRef, { ownerUid: event.ownerUid, sessionId: event.sessionId,
      revision, shareEpoch: nextEpoch, status: "withdrawn",
      updatedAt: FieldValue.serverTimestamp(), reviewOnly: true });
    tx.set(eRef, { ownerUid: event.ownerUid, sessionId: event.sessionId,
      shareEpoch: nextEpoch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (previousReceipt.exists) tx.update(pRef, { revoked: true, reviewWithdrawalEventId: event.eventId });
    for (const grant of grants.docs) tx.update(grant.ref, { status: "revoked", updatedAt: FieldValue.serverTimestamp() });
    recordEvent(tx, event, digest, "applied", { appliedRevision: revision, appliedShareEpoch: nextEpoch });
    return result(event, "applied", revision, nextEpoch);
  });
}

function purgeQueries(subjectUid: string): Record<string, Query> {
  // This adapter owns only the family-sharing authority slice. Other consent
  // purposes and other people's source stories are outside its purge authority.
  const receipts = db.collection("consentDecisionReceipts").where("purpose", "==", "storytime.family_share");
  return {
    consentReceiptsOwned: receipts.where("userId", "==", subjectUid),
    consentReceiptsReceived: receipts.where("recipientUid", "==", subjectUid),
    viewGrantsOwned: db.collection("familyStoryViewGrants").where("ownerUid", "==", subjectUid),
    viewGrantsReceived: db.collection("familyStoryViewGrants").where("recipientUid", "==", subjectUid),
    sharingStatesOwned: db.collection("familyStorySharingStates").where("ownerUid", "==", subjectUid),
  };
}
async function purgeSubjectAuthority(subjectUid: string, request: ActorRequest) {
  for (const query of Object.values(purgeQueries(subjectUid))) {
    for (let page = 0; page < MAX_PURGE_PAGES_PER_QUERY; page++) {
      await requireDeliveryActor(request);
      const snapshot = await query.limit(PURGE_PAGE_SIZE).get();
      if (snapshot.empty) break;
      const batch = db.batch();
      for (const doc of snapshot.docs) {
        if (!doc.updateTime) throw denied();
        batch.delete(doc.ref, { lastUpdateTime: doc.updateTime });
      }
      await batch.commit();
    }
  }
}
async function applyDeletion(event: ReviewEvent, digest: string, request: ActorRequest) {
  const iRef = db.collection("familyReviewDeliveryEvents").doc(event.eventId);
  const fRef = db.collection("privacyDeletionTombstones").doc(event.subjectUid);
  const wasDuplicate = await db.runTransaction(async (tx) => {
    const [inbox, fence] = await Promise.all([tx.get(iRef), tx.get(fRef)]);
    const duplicate = isDuplicate(inbox, event, digest);
    const oldRevision = fence.data()?.familyReviewRevision ?? 0;
    if (!Number.isSafeInteger(oldRevision) || oldRevision < 0) throw denied();
    await requireDeliveryActor(request);
    // This durable barrier commits BEFORE any purge. Never clear it on retry.
    tx.set(fRef, { active: true, familyReviewRevision: Math.max(oldRevision, event.revision),
      familyReviewEventId: event.eventId, familyReviewOnly: true,
      familyReviewUpdatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (!duplicate) recordEvent(tx, event, digest, "applied", {
      subjectUid: event.subjectUid, purgeStatus: "pending",
    });
    return duplicate;
  });

  let cleanupErrorObserved = false;
  try { await purgeSubjectAuthority(event.subjectUid, request); }
  catch { cleanupErrorObserved = true; }
  // Exact retries always reach cleanup, including an inbox left by a failed
  // first attempt. No source story, chapter, or raw media is purged here.
  const completion = await db.runTransaction(async (tx) => {
    const [inbox, fence] = await Promise.all([tx.get(iRef), tx.get(fRef)]);
    if (!isDuplicate(inbox, event, digest) || fence.data()?.active !== true) throw denied();
    const inventories = await Promise.all(Object.entries(purgeQueries(event.subjectUid)).map(async ([name, query]) => ({
      name, snapshot: await tx.get(query),
    })));
    const residualCounts = Object.fromEntries(inventories.map(({ name, snapshot }) => [name, snapshot.size]));
    const distinct = new Set(inventories.flatMap(({ snapshot }) => snapshot.docs.map((doc) => doc.ref.path)));
    const purgeStatus = distinct.size === 0 ? "complete" : "pending";
    await requireDeliveryActor(request);
    tx.update(iRef, { purgeStatus, residualCounts, remainingAuthorityRecords: distinct.size,
      cleanupErrorObserved, updatedAt: FieldValue.serverTimestamp() });
    return { purgeStatus, residualCounts, remainingAuthorityRecords: distinct.size };
  });
  return {
    eventId: event.eventId, status: wasDuplicate ? "duplicate" as const : "applied" as const,
    revision: event.revision, subjectUid: event.subjectUid, fenced: true,
    cleanupScope: "family-authority-records-only", ...completion,
    cleanupErrorObserved, sourceStoryOrMediaPurged: false, globalDeletionComplete: false,
  };
}

export const reviewAcceptFamilyEvent = onCall(async (request) => {
  assertIsolation();
  await requireDeliveryActor(request);
  const parsed = InputSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Provide one strict synthetic family authority event.");
  const event = parsed.data.event;
  validateEnvelope(event);
  const digest = digestEvent(event);
  const response = event.kind === "grant" ? await applyGrant(event, digest, request)
    : event.kind === "withdraw" ? await applyWithdrawal(event, digest, request)
      : await applyDeletion(event, digest, request);
  await requireDeliveryActor(request);
  return response;
});
