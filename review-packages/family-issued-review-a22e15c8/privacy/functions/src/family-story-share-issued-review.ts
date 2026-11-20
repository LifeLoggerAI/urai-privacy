/**
 * Isolated synthetic Family Stories issuance and delivery proposal.
 *
 * Import only from the disposable review fixture. Ordinary entrypoints and the
 * canonical purpose registry remain unchanged. Every callable requires the exact
 * demo project, emulator addresses and explicit synthetic policy fixture.
 * Keys are read only during guarded signing and must match the pinned public key.
 * This does not implement real purpose approval, cloud identity or media deletion.
 */
import {
  createHash, createPrivateKey, createPublicKey, sign, verify, type KeyObject,
} from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  canonicalReviewFamilyShareReceiptBytes,
  reviewFamilyShareIssuerAdmission,
  type ProposedFamilyStoryShareSignedFields,
} from "./family-story-share-wire-review";

const PROJECT = "demo-urai-family-issued-review";
const AUDIENCE = "urai-storytime-review";
const DELIVERY_UID = "synthetic-family-privacy-delivery";
const CONSUMER_URL = "http://127.0.0.1:30001/" + PROJECT
  + "/us-central1/reviewAcceptFamilyEvent";
const ID = z.string().min(1).max(220).regex(/^[A-Za-z0-9._-]+$/);
const EVENT_ID = z.string().regex(/^review-event-[a-f0-9]{64}$/);
const RECEIPT_ID = z.string().regex(/^review-receipt-[a-f0-9]{64}$/);
const DIGEST = z.string().regex(/^[a-f0-9]{64}$/);
const KEY_ID = z.string().min(8).max(100).regex(/^[A-Za-z0-9._-]+$/);
const SIGNATURE = z.string().regex(/^[A-Za-z0-9_-]{86}$/);
const COUNTER = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const OPTIONAL_ID = z.union([z.literal(""), ID]);

const issueInput = z.object({
  requestId: ID, sessionId: ID, recipientUid: ID, sourceVersionId: ID,
  approvedProjectionSha256: DIGEST,
  expiresInSeconds: z.number().int().min(60).max(3600),
  acceptSyntheticPolicy: z.literal(true),
}).strict();
const withdrawInput = z.object({ requestId: ID, receiptId: RECEIPT_ID }).strict();
const deleteInput = z.object({ requestId: ID }).strict();
const dispatchInput = z.object({ eventId: EVENT_ID }).strict();
const receiptSchema = z.object({
  schemaVersion: z.literal("storytime-consent-decision-receipt-v1"),
  id: RECEIPT_ID, userId: ID, sourceSessionId: ID, recipientUid: ID,
  sourceVersionId: ID, shareEpoch: COUNTER,
  purpose: z.literal("storytime.family_share"),
  policyVersion: z.literal("family-story-share-v1"),
  decision: z.literal("authorized"), issuedBy: z.literal("urai-privacy"),
  approvedProjectionSha256: DIGEST, expiresAtMs: COUNTER,
  issuerKeyId: KEY_ID, issuerSignature: SIGNATURE,
}).strict();
const eventSchema = z.object({
  schemaVersion: z.literal("family-review-event-v1"), eventId: EVENT_ID,
  kind: z.enum(["grant", "withdraw", "delete-subject"]),
  projectId: z.literal(PROJECT), audience: z.literal(AUDIENCE),
  subjectUid: OPTIONAL_ID, ownerUid: OPTIONAL_ID, recipientUid: OPTIONAL_ID,
  sessionId: OPTIONAL_ID, receiptId: z.union([z.literal(""), RECEIPT_ID]),
  revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  shareEpoch: COUNTER, issuedAtMs: COUNTER,
  receipt: receiptSchema.nullable(), issuerKeyId: KEY_ID,
  eventSignature: SIGNATURE,
}).strict();
type Receipt = z.infer<typeof receiptSchema>;
type ReviewEvent = z.infer<typeof eventSchema>;
type RequestContext = {
  auth?: { uid: string };
  rawRequest?: { headers: { authorization?: string | string[] } };
};
type Row = Record<string, unknown>;
type Trust = { keyId: string; publicKey: KeyObject };
type Signer = Trust & { privateKey: KeyObject };

const unavailable = () => new HttpsError("permission-denied", "This synthetic family scope is not available.");
const corrupt = () => new HttpsError("failed-precondition", "Review authority state is inconsistent.");
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const scopeId = (ownerUid: string, sessionId: string) => hash([ownerUid, sessionId]);
const eventIdFor = (kind: ReviewEvent["kind"], uid: string, requestId: string) =>
  "review-event-" + hash([kind, uid, requestId]);

function isolation() {
  const env = process.env;
  if (env.FAMILY_ISSUED_REVIEW_ENABLED !== "synthetic-only-v1"
    || env.FAMILY_ISSUED_REVIEW_POLICY !== "synthetic-explicit-text-consent-v1"
    || env.GCLOUD_PROJECT !== PROJECT
    || (env.GOOGLE_CLOUD_PROJECT !== undefined && env.GOOGLE_CLOUD_PROJECT !== PROJECT)
    || env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:30099"
    || env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:30080"
    || env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:30199"
    || env.FUNCTIONS_EMULATOR_HOST !== "127.0.0.1:30001"
    || env.FUNCTIONS_EMULATOR !== "true") {
    throw new HttpsError("failed-precondition", "The isolated synthetic family fixture is not enabled.");
  }
  if (env.FIREBASE_CONFIG !== undefined) {
    try {
      const config = JSON.parse(env.FIREBASE_CONFIG) as { projectId?: unknown };
      if (!config || config.projectId !== PROJECT) throw new Error("project");
    } catch {
      throw new HttpsError("failed-precondition", "The review Firebase configuration is not isolated.");
    }
  }
  const admission = reviewFamilyShareIssuerAdmission();
  if (admission.authorized !== false || admission.reason !== "PURPOSE_UNREGISTERED") {
    throw new HttpsError("failed-precondition", "The real canonical purpose must remain unregistered.");
  }
}

function reviewApp() {
  const app = getApps().find((candidate) => candidate.name === "[DEFAULT]")
    ?? initializeApp({ projectId: PROJECT });
  if (app.options.projectId !== PROJECT) {
    throw new HttpsError("failed-precondition", "The review Firebase app does not match the demo project.");
  }
  return app;
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new HttpsError("invalid-argument", "Invalid synthetic family request.");
  return parsed.data;
}

async function activeAccount(uid: string) {
  const account = await getAuth(reviewApp()).getUser(uid).catch(() => { throw unavailable(); });
  if (account.uid !== uid || account.disabled || !account.emailVerified) throw unavailable();
  return account;
}

/** Firebase context is necessary but does not replace fresh revocation checks. */
async function currentActor(request: RequestContext, delivery = false) {
  const header = request.rawRequest?.headers.authorization;
  const match = typeof header === "string"
    ? /^Bearer\s+(\S+)$/i.exec(header)
    : null;
  if (!request.auth?.uid || !ID.safeParse(request.auth.uid).success || !match
    || header!.length > 8192) {
    throw new HttpsError("unauthenticated", "Current Firebase authentication is required.");
  }
  const auth = getAuth(reviewApp());
  const token = match[1];
  try {
    const first = await auth.verifyIdToken(token, true);
    if (first.uid !== request.auth.uid || first.aud !== PROJECT
      || first.iss !== "https://securetoken.google.com/" + PROJECT
      || first.email_verified !== true) throw unavailable();
    const account = await activeAccount(first.uid);
    const second = await auth.verifyIdToken(token, true);
    if (second.uid !== first.uid || second.aud !== PROJECT
      || second.iss !== "https://securetoken.google.com/" + PROJECT
      || second.email_verified !== true) throw unavailable();
    if (delivery && (second.uid !== DELIVERY_UID
      || second.familyReviewDelivery !== true
      || account.customClaims?.familyReviewDelivery !== true)) throw unavailable();
    return { uid: second.uid, token };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("unauthenticated", "Current Firebase authentication is required.");
  }
}

function trust(): Trust {
  try {
    const keyId = process.env.STORYTIME_FAMILY_PRIVACY_ED25519_KEY_ID;
    const encoded = process.env.STORYTIME_FAMILY_PRIVACY_ED25519_PUBLIC_KEY_SPKI_B64;
    if (!KEY_ID.safeParse(keyId).success || !encoded || encoded.length > 1024) throw new Error("pin");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.toString("base64") !== encoded) throw new Error("encoding");
    const publicKey = createPublicKey({ key: bytes, type: "spki", format: "der" });
    if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("type");
    return { keyId: keyId as string, publicKey };
  } catch {
    throw new HttpsError("failed-precondition", "The synthetic public signing pin is unavailable.");
  }
}

function signer(): Signer {
  isolation();
  const pin = trust();
  try {
    const file = process.env.FAMILY_ISSUED_REVIEW_PRIVATE_KEY_FILE;
    if (!file || !isAbsolute(file)) throw new Error("file");
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.size < 1 || stat.size > 8192) throw new Error("file");
    const privateKey = createPrivateKey(readFileSync(file));
    if (privateKey.asymmetricKeyType !== "ed25519") throw new Error("type");
    const derived = createPublicKey(privateKey).export({ type: "spki", format: "der" });
    const expected = pin.publicKey.export({ type: "spki", format: "der" });
    if (!derived.equals(expected)) throw new Error("pin");
    return { ...pin, privateKey };
  } catch {
    throw new HttpsError("failed-precondition", "The matching ephemeral review signer is unavailable.");
  }
}

function signedFields(receipt: Receipt): ProposedFamilyStoryShareSignedFields {
  return {
    schemaVersion: receipt.schemaVersion, id: receipt.id, userId: receipt.userId,
    sourceSessionId: receipt.sourceSessionId, recipientUid: receipt.recipientUid,
    sourceVersionId: receipt.sourceVersionId, shareEpoch: receipt.shareEpoch,
    purpose: receipt.purpose, policyVersion: receipt.policyVersion,
    decision: receipt.decision, issuedBy: receipt.issuedBy,
    approvedProjectionSha256: receipt.approvedProjectionSha256,
    expiresAtMs: receipt.expiresAtMs,
  };
}

function receiptTuple(receipt: Receipt) {
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
    event.shareEpoch, event.issuedAtMs, event.receipt ? receiptTuple(event.receipt) : null,
    event.issuerKeyId,
  ]), "utf8");
}

function signEvent(
  fields: Omit<ReviewEvent, "schemaVersion" | "projectId" | "audience" | "issuerKeyId" | "eventSignature">,
  signing: Signer,
): ReviewEvent {
  const event: ReviewEvent = {
    schemaVersion: "family-review-event-v1", ...fields,
    projectId: PROJECT, audience: AUDIENCE,
    issuerKeyId: signing.keyId, eventSignature: "",
  };
  event.eventSignature = sign(null, eventBytes(event), signing.privateKey).toString("base64url");
  return eventSchema.parse(event);
}

function verifySignature(bytes: Buffer, signature: string, pin: Trust) {
  const raw = Buffer.from(signature, "base64url");
  return raw.length === 64 && raw.toString("base64url") === signature
    && verify(null, bytes, pin.publicKey, raw);
}

function verifiedOutbox(row: unknown, expectedId: string, pin: Trust): ReviewEvent {
  const result = z.object({ event: eventSchema }).strict().safeParse(row);
  if (!result.success) throw corrupt();
  const event = result.data.event;
  if (event.eventId !== expectedId || event.issuerKeyId !== pin.keyId
    || !verifySignature(eventBytes(event), event.eventSignature, pin)) throw corrupt();
  if (event.kind === "delete-subject") {
    if (!event.subjectUid || event.ownerUid || event.recipientUid || event.sessionId
      || event.receiptId || event.receipt !== null || event.shareEpoch !== 0) throw corrupt();
  } else {
    if (event.subjectUid || !event.ownerUid || !event.recipientUid || !event.sessionId
      || !event.receiptId || event.ownerUid === event.recipientUid) throw corrupt();
    if (event.kind === "withdraw" && event.receipt !== null) throw corrupt();
    if (event.kind === "grant") {
      const receipt = event.receipt;
      if (!receipt || receipt.id !== event.receiptId || receipt.userId !== event.ownerUid
        || receipt.recipientUid !== event.recipientUid || receipt.sourceSessionId !== event.sessionId
        || receipt.shareEpoch !== event.shareEpoch || receipt.issuerKeyId !== event.issuerKeyId
        || receipt.expiresAtMs < event.issuedAtMs + 60_000
        || receipt.expiresAtMs > event.issuedAtMs + 3_600_000
        || !verifySignature(canonicalReviewFamilyShareReceiptBytes(signedFields(receipt)),
          receipt.issuerSignature, pin)) throw corrupt();
    }
  }
  return event;
}

function counter(value: unknown, zeroAllowed = true): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)
    || value < (zeroAllowed ? 0 : 1)) throw corrupt();
  return value;
}

function increment(value: number) {
  const next = value + 1;
  if (!Number.isSafeInteger(next)) throw corrupt();
  return next;
}

function scopeState(row: Row | undefined, ownerUid: string, sessionId: string) {
  if (!row) return null;
  if (row.ownerUid !== ownerUid || row.sessionId !== sessionId
    || (row.status !== "active" && row.status !== "withdrawn")) throw corrupt();
  return {
    revision: counter(row.revision, false), shareEpoch: counter(row.shareEpoch),
    status: row.status,
  };
}

function storyEpoch(row: Row | undefined, ownerUid: string, sessionId: string) {
  if (!row) return 0;
  if (row.ownerUid !== ownerUid || row.sessionId !== sessionId) throw corrupt();
  return counter(row.shareEpoch);
}

async function noSubjectFences(tx: Transaction, ownerUid: string, recipientUid: string) {
  const db = getFirestore(reviewApp());
  const snapshots = await Promise.all([ownerUid, recipientUid].flatMap((uid) => [
    tx.get(db.collection("familyReviewSubjectFences").doc(uid)),
    tx.get(db.collection("privacyDeletionTombstones").doc(uid)),
  ]));
  if (snapshots.some((snapshot) => snapshot.data()?.active === true)) throw unavailable();
}

function sourceProjection(story: Row, chapter: Row, ownerUid: string, sessionId: string, versionId: string) {
  const consent = story.consentSnapshot;
  if (story.userId !== ownerUid || story.safetyStatus !== "approved"
    || story.visibility !== "private" || story.deleted === true || story.revoked === true
    || story.retired === true || story.status !== "ready" || story.currentVersionId !== versionId
    || !consent || typeof consent !== "object" || Array.isArray(consent)
    || (consent as Row).memoryUse !== true
    || typeof story.title !== "string" || !story.title.trim() || story.title.length > 200
    || chapter.userId !== ownerUid || chapter.sessionId !== sessionId
    || typeof chapter.summary !== "string" || !chapter.summary.trim()
    || chapter.summary.length > 4000) throw unavailable();
  return hash({
    sourceSystem: "urai-storytime", ownerUid, sessionId,
    versionId, title: story.title, summary: chapter.summary,
  });
}

export const reviewIssueFamilyGrant = onCall({ region: "us-central1" }, async (request) => {
  isolation();
  const actor = await currentActor(request);
  const input = parse(issueInput, request.data);
  if (input.recipientUid === actor.uid) throw new HttpsError("invalid-argument", "A distinct named recipient is required.");
  await activeAccount(input.recipientUid);
  const signing = signer(), db = getFirestore(reviewApp());
  const receiptId = "review-receipt-" + hash([actor.uid, input.requestId]);
  const eventId = eventIdFor("grant", actor.uid, input.requestId);
  const fingerprint = hash([
    "family-review-issue-request-v1", actor.uid, input.requestId, input.sessionId,
    input.recipientUid, input.sourceVersionId, input.approvedProjectionSha256,
    input.expiresInSeconds, input.acceptSyntheticPolicy,
  ]);
  const decisionRef = db.collection("familyReviewDecisions").doc(receiptId);
  const outboxRef = db.collection("familyReviewOutbox").doc(eventId);
  const scopeRef = db.collection("familyReviewScopes").doc(scopeId(actor.uid, input.sessionId));
  const result = await db.runTransaction(async (tx) => {
    const [decision, outbox, scope, state, source] = await Promise.all([
      tx.get(decisionRef), tx.get(outboxRef), tx.get(scopeRef),
      tx.get(db.collection("familyStorySharingStates").doc(input.sessionId)),
      tx.get(db.collection("storySessions").doc(input.sessionId)),
    ]);
    await noSubjectFences(tx, actor.uid, input.recipientUid);
    const story = source.data() as Row | undefined;
    if (!source.exists || !story || !Array.isArray(story.chapterIds)
      || story.chapterIds.length !== 1 || !ID.safeParse(story.chapterIds[0]).success) throw unavailable();
    const chapter = await tx.get(db.collection("storyChapters").doc(story.chapterIds[0] as string));
    if (!chapter.exists || sourceProjection(story, chapter.data() as Row,
      actor.uid, input.sessionId, input.sourceVersionId) !== input.approvedProjectionSha256) throw unavailable();
    const current = scopeState(scope.data(), actor.uid, input.sessionId);
    const epoch = storyEpoch(state.data(), actor.uid, input.sessionId);
    if (current && (current.status === "withdrawn" || current.shareEpoch !== epoch)) throw unavailable();
    const now = Date.now();
    if (decision.exists) {
      const previous = decision.data() ?? {};
      if (previous.requestFingerprint !== fingerprint) {
        throw new HttpsError("already-exists", "This request ID is bound to a different synthetic request.");
      }
      const event = verifiedOutbox(outbox.data(), eventId, signing);
      const previousReceipt = receiptSchema.safeParse(previous.receipt);
      if (!current || previous.status !== "issued" || previous.ownerUid !== actor.uid
        || previous.recipientUid !== input.recipientUid || previous.sessionId !== input.sessionId
        || event.kind !== "grant" || event.receiptId !== receiptId
        || event.ownerUid !== actor.uid || event.recipientUid !== input.recipientUid
        || event.sessionId !== input.sessionId || event.shareEpoch !== epoch
        || !event.receipt || !previousReceipt.success
        || hash(receiptTuple(previousReceipt.data)) !== hash(receiptTuple(event.receipt))
        || event.receipt.sourceVersionId !== input.sourceVersionId
        || event.receipt.approvedProjectionSha256 !== input.approvedProjectionSha256
        || event.receipt.expiresAtMs <= now
        || event.revision > current.revision) throw unavailable();
      await currentActor(request);
      await activeAccount(input.recipientUid);
      return { receiptId, eventId, revision: event.revision, shareEpoch: epoch, duplicate: true };
    }
    if (outbox.exists) throw corrupt();
    const revision = increment(current?.revision ?? 0);
    const fields: ProposedFamilyStoryShareSignedFields = {
      schemaVersion: "storytime-consent-decision-receipt-v1",
      id: receiptId, userId: actor.uid, sourceSessionId: input.sessionId,
      recipientUid: input.recipientUid, sourceVersionId: input.sourceVersionId,
      shareEpoch: epoch, purpose: "storytime.family_share",
      policyVersion: "family-story-share-v1", decision: "authorized", issuedBy: "urai-privacy",
      approvedProjectionSha256: input.approvedProjectionSha256,
      expiresAtMs: now + input.expiresInSeconds * 1000,
    };
    const receipt = receiptSchema.parse({
      ...fields, issuerKeyId: signing.keyId,
      issuerSignature: sign(null, canonicalReviewFamilyShareReceiptBytes(fields),
        signing.privateKey).toString("base64url"),
    });
    const event = signEvent({
      eventId, kind: "grant", subjectUid: "", ownerUid: actor.uid,
      recipientUid: input.recipientUid, sessionId: input.sessionId, receiptId,
      revision, shareEpoch: epoch, issuedAtMs: now, receipt,
    }, signing);
    await currentActor(request);
    await activeAccount(input.recipientUid);
    // Every transaction read, including source/chapter/fences, precedes writes.
    tx.create(decisionRef, {
      receipt, requestFingerprint: fingerprint, ownerUid: actor.uid,
      recipientUid: input.recipientUid, sessionId: input.sessionId,
      status: "issued", eventId, revision, shareEpoch: epoch,
      createdAt: FieldValue.serverTimestamp(),
    });
    tx.set(scopeRef, {
      ownerUid: actor.uid, sessionId: input.sessionId,
      revision, shareEpoch: epoch, status: "active", updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(outboxRef, { event });
    return { receiptId, eventId, revision, shareEpoch: epoch, duplicate: false };
  });
  await currentActor(request);
  await activeAccount(input.recipientUid);
  return result;
});

export const reviewWithdrawFamilyGrant = onCall({ region: "us-central1" }, async (request) => {
  isolation();
  const actor = await currentActor(request);
  const input = parse(withdrawInput, request.data);
  const signing = signer(), db = getFirestore(reviewApp());
  const eventId = eventIdFor("withdraw", actor.uid, input.requestId);
  const outboxRef = db.collection("familyReviewOutbox").doc(eventId);
  const decisionRef = db.collection("familyReviewDecisions").doc(input.receiptId);
  const result = await db.runTransaction(async (tx) => {
    const [decision, existing] = await Promise.all([tx.get(decisionRef), tx.get(outboxRef)]);
    const previous = decision.data() ?? {};
    if (!decision.exists || previous.ownerUid !== actor.uid
      || !ID.safeParse(previous.sessionId).success
      || !ID.safeParse(previous.recipientUid).success) throw unavailable();
    const sessionId = previous.sessionId as string, recipientUid = previous.recipientUid as string;
    const scopeRef = db.collection("familyReviewScopes").doc(scopeId(actor.uid, sessionId));
    const [scope, state] = await Promise.all([
      tx.get(scopeRef), tx.get(db.collection("familyStorySharingStates").doc(sessionId)),
    ]);
    const current = scopeState(scope.data(), actor.uid, sessionId);
    if (!current) throw corrupt();
    if (existing.exists) {
      const event = verifiedOutbox(existing.data(), eventId, signing);
      if (event.kind !== "withdraw" || event.ownerUid !== actor.uid
        || event.receiptId !== input.receiptId || event.sessionId !== sessionId
        || event.recipientUid !== recipientUid) {
        throw new HttpsError("already-exists", "This request ID is bound to a different synthetic withdrawal.");
      }
      return { eventId, revision: event.revision, shareEpoch: event.shareEpoch };
    }
    if (current.status !== "active" || previous.status !== "issued") throw unavailable();
    const revision = increment(current.revision);
    const epoch = increment(Math.max(current.shareEpoch, storyEpoch(state.data(), actor.uid, sessionId)));
    const event = signEvent({
      eventId, kind: "withdraw", subjectUid: "", ownerUid: actor.uid,
      recipientUid, sessionId, receiptId: input.receiptId,
      revision, shareEpoch: epoch, issuedAtMs: Date.now(), receipt: null,
    }, signing);
    await currentActor(request);
    tx.update(decisionRef, {
      status: "withdrawn", withdrawalEventId: eventId, withdrawnAt: FieldValue.serverTimestamp(),
    });
    tx.set(scopeRef, {
      ownerUid: actor.uid, sessionId, revision, shareEpoch: epoch,
      status: "withdrawn", updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(outboxRef, { event });
    return { eventId, revision, shareEpoch: epoch };
  });
  await currentActor(request);
  return result;
});

export const reviewDeleteFamilySubject = onCall({ region: "us-central1" }, async (request) => {
  isolation();
  const actor = await currentActor(request);
  const input = parse(deleteInput, request.data);
  const signing = signer(), db = getFirestore(reviewApp());
  const eventId = eventIdFor("delete-subject", actor.uid, input.requestId);
  const outboxRef = db.collection("familyReviewOutbox").doc(eventId);
  const fenceRef = db.collection("familyReviewSubjectFences").doc(actor.uid);
  const result = await db.runTransaction(async (tx) => {
    const [existing, fence] = await Promise.all([tx.get(outboxRef), tx.get(fenceRef)]);
    if (existing.exists) {
      const event = verifiedOutbox(existing.data(), eventId, signing);
      if (event.kind !== "delete-subject" || event.subjectUid !== actor.uid
        || !fence.exists || fence.data()?.active !== true) throw corrupt();
      return { eventId };
    }
    const prior = fence.data();
    if (prior && (prior.subjectUid !== actor.uid || prior.active !== true)) throw corrupt();
    const revision = increment(prior ? counter(prior.revision, false) : 0);
    const event = signEvent({
      eventId, kind: "delete-subject", subjectUid: actor.uid,
      ownerUid: "", recipientUid: "", sessionId: "", receiptId: "",
      revision, shareEpoch: 0, issuedAtMs: Date.now(), receipt: null,
    }, signing);
    await currentActor(request);
    tx.set(fenceRef, {
      subjectUid: actor.uid, active: true, revision, latestEventId: eventId,
      status: "synthetic-deletion-requested", updatedAt: FieldValue.serverTimestamp(),
    });
    tx.create(outboxRef, { event });
    return { eventId };
  });
  await currentActor(request);
  return result;
});

async function responseJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error("missing-body");
  const reader = response.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 65_536) throw new Error("response-limit");
      parts.push(part.value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}

export const reviewDispatchFamilyEvent = onCall({ region: "us-central1" }, async (request) => {
  isolation();
  const actor = await currentActor(request, true);
  const input = parse(dispatchInput, request.data);
  const pin = trust(), db = getFirestore(reviewApp());
  const outboxRef = db.collection("familyReviewOutbox").doc(input.eventId);
  const outbox = await outboxRef.get();
  if (!outbox.exists) throw new HttpsError("not-found", "The synthetic outbox event does not exist.");
  const event = verifiedOutbox(outbox.data(), input.eventId, pin);
  const eventDigest = hash(event);
  let result: Row & { eventId: string; status: "applied" | "duplicate" | "stale" };
  try {
    const response = await fetch(CONSUMER_URL, {
      method: "POST", redirect: "error",
      headers: { authorization: "Bearer " + actor.token, "content-type": "application/json" },
      body: JSON.stringify({ data: { event } }), signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("consumer-rejected");
    const body = await responseJson(response) as { result?: unknown };
    const parsed = z.object({
      eventId: z.literal(input.eventId), status: z.enum(["applied", "duplicate", "stale"]),
    }).passthrough().safeParse(body?.result);
    if (!parsed.success) throw new Error("consumer-result");
    result = parsed.data;
  } catch {
    throw new HttpsError("unavailable", "Synthetic family delivery has not been acknowledged.");
  }
  await currentActor(request, true);
  const ackRef = db.collection("familyReviewDeliveryAcks").doc(input.eventId);
  await db.runTransaction(async (tx) => {
    const [current, acknowledgement] = await Promise.all([tx.get(outboxRef), tx.get(ackRef)]);
    const unchanged = verifiedOutbox(current.data(), input.eventId, pin);
    if (hash(unchanged) !== eventDigest) throw corrupt();
    const previous = acknowledgement.data();
    if (previous && (previous.eventDigest !== eventDigest || previous.eventId !== input.eventId
      || previous.consumerId !== AUDIENCE || previous.deliveryActorUid !== actor.uid)) throw corrupt();
    const attempts = increment(previous ? counter(previous.acknowledgedAttempts, false) : 0);
    tx.set(ackRef, {
      schemaVersion: "family-review-delivery-ack-v1",
      eventId: input.eventId, eventDigest, consumerId: AUDIENCE,
      deliveryActorUid: actor.uid, status: result.status, consumerResult: result,
      acknowledgedAttempts: attempts,
      firstAcknowledgedAt: previous?.firstAcknowledgedAt ?? FieldValue.serverTimestamp(),
      lastAcknowledgedAt: FieldValue.serverTimestamp(),
      // ACK describes this scoped consumer result only, never media/global deletion.
      canonicalPurposeApproved: false, productionAuthority: false,
    });
  });
  return result;
});
