import { createHash, randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
import { FieldPath, FieldValue, getFirestore, type DocumentData, type Transaction, type Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { crossUserAuthority } from "./cross-user-authority";
import { approvedStorageGeneration, storageGenerationSubsetApproved } from "./deletion-storage-generation";
import { sameDeletionDocumentVersion, deletionDocumentBelongsToSubject } from "./deletion-document-version";
import { createPrivacyActorGuard } from "./privacy-actor-guard";
import { checkedLifeMovieDeletionState } from "./life-movie-deletion-fence";
import { evaluateConsentDecision, CONSENT_DECISION_POLICY_VERSION } from "./consent-decision";
import { deletionRequestAdmissionBlockReason, exportRequestAdmissionBlockReason } from "./request-admission-policy";
import { deletionExecutionAuthorityBlockReason, type DeletionExecutionBinding } from "./deletion-execution-lease-policy";

initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();
const auth = getAuth();

type Role = "user" | "admin" | "system";
type Status = "pending" | "approved" | "processing" | "completed" | "rejected" | "failed";

const deletionStatuses = ["approved", "processing", "completed", "rejected", "failed"] as const;
const exportCollections = [
  "users",
  "privacyRequests",
  "exportJobs",
  "deletionRequests",
  "consentRecords",
  "consentEvents",
  "consentRevocationOutbox",
  "dataAccessEvents",
  "auditLogs",
  "adminActions",
  "legalHoldRecords"
] as const;
const deletableUserCollections = ["privacyRequests", "exportJobs", "exportArtifactAttempts", "consentRecords", "dataAccessEvents"] as const;
const retainedDeletionCollections = [
  "auditLogs",
  "policyVersions",
  "adminActions",
  "retentionPolicies",
  "deletionRequests",
  "legalHoldRecords",
  "consentEvents",
  "consentRevocationOutbox"
] as const;
const redactedFields = new Set(["password", "token", "secret", "apikey", "privatekey", "refreshtoken", "idtoken"]);
const QUERY_PAGE_LIMIT = 450;
const DELETE_BATCH_LIMIT = 450;
const DELETION_EXECUTION_LEASE_MS = 15 * 60 * 1000;

const createDeletionSchema = z.object({ reason: z.string().trim().min(8).max(1000).default("User requested deletion") });
const processDeletionSchema = z.object({ requestId: z.string().min(1), status: z.enum(deletionStatuses).default("processing") });
const executeDeletionSchema = z.object({
  requestId: z.string().min(1),
  mode: z.enum(["dryRun", "execute"]).default("dryRun"),
  expectedPlanHash: z.string().regex(/^[0-9a-f]{64}$/).optional()
});
const deletionPlanSchema = z.object({
  version: z.literal("privacy-deletion-plan-v4"),
  authAccountCreatedAt: z.string().datetime().nullable(),
  targetVersions: z.record(z.string(), z.object({
    seconds: z.number().int().safe(), nanoseconds: z.number().int().min(0).max(999_999_999)
  })),
  uid: z.string().min(1),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  targets: z.record(z.string(), z.array(z.string())),
  storageObjects: z.array(z.string()),
  storageObjectGenerations: z.record(z.string(), z.string().regex(/^[0-9]+$/)),
  retainedData: z.array(z.string()),
  generatedAt: z.string().datetime(),
  mode: z.literal("safe-plan"),
  legalHold: z.boolean(),
  deletableCollections: z.array(z.string()),
  deleteAuthUser: z.literal(true)
});
type DeletionPlan = z.infer<typeof deletionPlanSchema>;

const auditLogSchema = z.object({
  action: z.string().trim().min(2).max(120),
  targetUid: z.string().trim().min(1).max(160).optional(),
  requestId: z.string().trim().min(1).max(160).optional()
});
const adminActionSchema = z.object({
  action: z.string().trim().min(2).max(120).default("admin_changed_request_status"),
  targetUid: z.string().trim().min(1).max(160).optional(),
  requestId: z.string().trim().min(1).max(160).optional(),
  notes: z.string().trim().max(2000).optional()
});

function uidFrom(request: { auth?: { uid?: string; token?: Record<string, unknown> } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  return uid;
}

function isAdmin(token?: Record<string, unknown>) {
  return crossUserAuthority(token)?.role === "admin";
}

async function requireAdmin(request: { auth?: { uid?: string; token?: Record<string, unknown> } }) {
  const uid = uidFrom(request);
  if (!isAdmin(request.auth?.token)) {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
  return uid;
}

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join("; "));
  return parsed.data;
}

function sha256(value: unknown) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function timestampMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toMillis" in value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !redactedFields.has(key.toLowerCase()))
        .map(([key, nested]) => [key, scrub(nested)])
    );
  }
  return value;
}

async function writeAudit(args: {
  actorUid: string;
  actorRole: Role;
  action: string;
  targetUid?: string;
  requestId?: string;
  source: "function" | "admin" | "web" | "system";
  metadata?: Record<string, unknown>;
}) {
  const ref = db.collection("auditLogs").doc();
  await ref.set({ ...args, timestamp: FieldValue.serverTimestamp(), metadata: args.metadata ?? {}, integrityHash: sha256({ ...args, id: ref.id }) });
  return ref.id;
}

async function listScopedDocuments(collectionName: string, field: "uid" | "targetUid", uid: string) {
  const documents: Array<{ id: string; data: DocumentData; updateTime?: Timestamp }> = [];
  let cursor: string | null = null;
  while (true) {
    let query = db.collection(collectionName)
      .where(field, "==", uid)
      .orderBy(FieldPath.documentId())
      .limit(QUERY_PAGE_LIMIT);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    documents.push(...snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data(), updateTime: doc.updateTime })));
    if (snapshot.size < QUERY_PAGE_LIMIT) return documents;
    cursor = snapshot.docs.at(-1)?.id ?? null;
    if (!cursor) return documents;
  }
}

async function collectUserExport(uid: string) {
  const collections: Record<string, Array<Record<string, unknown>>> = {};
  let recordCount = 0;

  for (const name of exportCollections) {
    if (name === "users") {
      const userDoc = await db.collection("users").doc(uid).get();
      const docs = userDoc.exists ? [{ id: userDoc.id, ...(scrub(userDoc.data() ?? {}) as Record<string, unknown>) }] : [];
      collections[name] = docs;
      recordCount += docs.length;
      continue;
    }

    const field = name === "auditLogs" || name === "adminActions" ? "targetUid" : "uid";
    const rows = await listScopedDocuments(name, field, uid);
    const docs = rows.map((row) => ({ id: row.id, ...(scrub(row.data) as Record<string, unknown>) }));
    collections[name] = docs;
    recordCount += docs.length;
  }

  return { collections, recordCount };
}

async function writeJson(path: string, value: unknown) {
  const body = JSON.stringify(value, null, 2);
  await bucket.file(path).save(body, {
    resumable: false,
    contentType: "application/json",
    metadata: { cacheControl: "private, max-age=0, no-store", metadata: { sha256: sha256(body) } }
  });
  return { path, sha256: sha256(body), bytes: Buffer.byteLength(body, "utf8") };
}

async function hasLegalHold(uid: string) {
  const userDoc = await db.collection("users").doc(uid).get();
  const userHold = userDoc.exists && userDoc.data()?.legalHold === true;
  const holdSnap = await db.collection("legalHoldRecords").where("uid", "==", uid).where("status", "==", "active").limit(1).get();
  return userHold || !holdSnap.empty;
}

async function deletionAuthAccountCreatedAt(uid: string): Promise<string | null> {
  try {
    const account = await auth.getUser(uid);
    const millis = Date.parse(account.metadata.creationTime);
    if (account.uid !== uid || !Number.isFinite(millis)) {
      throw new HttpsError("failed-precondition", "Deletion subject Auth incarnation cannot be established.");
    }
    return new Date(millis).toISOString();
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "") : "";
    if (code === "auth/user-not-found") return null;
    throw error;
  }
}

type CurrentDeletionAuthority = {
  binding: DeletionExecutionBinding;
  actor: Awaited<ReturnType<typeof createPrivacyActorGuard>>;
};

async function requireCurrentDeletionExecution(authority: CurrentDeletionAuthority, tx?: Transaction): Promise<void> {
  await authority.actor.requireCurrent();
  const verify = async (transaction: Transaction) => {
    const b = authority.binding;
    // Every read must precede the caller's first transaction write.
    const [operation, fence, user, legalHolds] = await Promise.all([
      transaction.get(db.collection("deletionRequests").doc(b.requestId)),
      transaction.get(db.collection("privacyDeletionTombstones").doc(b.uid)),
      transaction.get(db.collection("users").doc(b.uid)),
      transaction.get(db.collection("legalHoldRecords").where("uid", "==", b.uid).where("status", "==", "active").limit(1))
    ]);
    const reason = deletionExecutionAuthorityBlockReason({
      binding: b,
      operation: operation.data() ?? {},
      fence: fence.data() ?? {},
      executionLeaseUntilMillis: timestampMillis(operation.data()?.deletionExecutionLeaseUntil),
      mutationLeaseUntilMillis: timestampMillis(operation.data()?.deletionMutationLeaseUntil),
      nowMillis: Date.now(),
      legalHold: (user.exists && user.data()?.legalHold === true) || !legalHolds.empty
    });
    if (reason) throw new HttpsError("failed-precondition", "Deletion authority changed: " + reason);
    await authority.actor.requireCurrent();
  };
  if (tx) await verify(tx);
  else await db.runTransaction(verify);
}

function approvedTargetVersion(value: Timestamp | undefined) {
  if (!value || !Number.isSafeInteger(value.seconds) || !Number.isSafeInteger(value.nanoseconds)
    || value.nanoseconds < 0 || value.nanoseconds >= 1_000_000_000) {
    throw new HttpsError("failed-precondition", "The exact deletion document update version is unavailable.");
  }
  return { seconds: value.seconds, nanoseconds: value.nanoseconds };
}

async function deletionPlan(uid: string): Promise<DeletionPlan> {
  const userDoc = await db.collection("users").doc(uid).get();
  const targets: Record<string, string[]> = { users: userDoc.exists ? [uid] : [] };
  const targetVersions: DeletionPlan["targetVersions"] = {};
  if (userDoc.exists) targetVersions[`users/${uid}`] = approvedTargetVersion(userDoc.updateTime);

  for (const collectionName of deletableUserCollections) {
    const rows = await listScopedDocuments(collectionName, "uid", uid);
    targets[collectionName] = rows.map(row => row.id).sort();
    for (const row of rows) targetVersions[`${collectionName}/${row.id}`] = approvedTargetVersion(row.updateTime);
  }

  const [files] = await bucket.getFiles({ prefix: `exports/${uid}/` });
  const storageObjects = files.map((file) => file.name).sort();
  const storageObjectGenerations: Record<string, string> = {};
  for (const file of files) {
    if (!file.name.startsWith(`exports/${uid}/`) || file.name.includes("..")) {
      throw new HttpsError("failed-precondition", "Unscoped export object encountered during deletion planning.");
    }
    const metadata = file.metadata.generation === undefined ? (await file.getMetadata())[0] : file.metadata;
    const generation = String(metadata.generation ?? "");
    if (!/^[0-9]+$/.test(generation)) {
      throw new HttpsError("failed-precondition", "The approved export object generation is missing.");
    }
    storageObjectGenerations[file.name] = generation;
  }
  const counts = Object.fromEntries(Object.entries(targets).map(([name, ids]) => [name, ids.length]));
  counts.storageObjects = storageObjects.length;

  return {
    version: "privacy-deletion-plan-v4",
    authAccountCreatedAt: await deletionAuthAccountCreatedAt(uid),
    targetVersions,
    uid,
    counts,
    targets,
    storageObjects,
    storageObjectGenerations,
    retainedData: [...retainedDeletionCollections],
    generatedAt: new Date().toISOString(),
    mode: "safe-plan",
    legalHold: await hasLegalHold(uid),
    deletableCollections: ["users", ...deletableUserCollections],
    deleteAuthUser: true
  };
}

function normalizedDeletionPlan(plan: DeletionPlan) {
  return {
    version: plan.version,
    authAccountCreatedAt: plan.authAccountCreatedAt,
    targetVersions: Object.fromEntries(Object.entries(plan.targetVersions).sort(([a], [b]) => a.localeCompare(b))),
    uid: plan.uid,
    counts: Object.fromEntries(Object.entries(plan.counts).sort(([left], [right]) => left.localeCompare(right))),
    targets: Object.fromEntries(
      Object.entries(plan.targets)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, ids]) => [name, [...ids].sort()])
    ),
    storageObjects: [...plan.storageObjects].sort(),
    storageObjectGenerations: Object.fromEntries(Object.entries(plan.storageObjectGenerations).sort(([a], [b]) => a.localeCompare(b))),
    retainedData: [...plan.retainedData].sort(),
    mode: plan.mode,
    legalHold: plan.legalHold,
    deletableCollections: [...plan.deletableCollections].sort(),
    deleteAuthUser: plan.deleteAuthUser
  };
}

function deletionPlanHash(plan: DeletionPlan) {
  return sha256(normalizedDeletionPlan(plan));
}

function deletionPlanArtifactPath(uid: string, requestId: string, planHash: string) {
  return `privacy-deletion-plans/${sha256(uid)}/${requestId}/${planHash}.json`;
}

async function writeDeletionPlanArtifact(uid: string, requestId: string, plan: DeletionPlan, planHash: string) {
  const path = deletionPlanArtifactPath(uid, requestId, planHash);
  const body = JSON.stringify(plan);
  await bucket.file(path).save(body, {
    resumable: false,
    contentType: "application/json",
    metadata: { cacheControl: "private, max-age=0, no-store", metadata: { sha256: sha256(body), planHash } }
  });
  return path;
}

async function readDeletionPlanArtifact(uid: string, requestId: string, planHash: string, path: unknown) {
  const expectedPath = deletionPlanArtifactPath(uid, requestId, planHash);
  if (path !== expectedPath) throw new HttpsError("failed-precondition", "Stored deletion-plan artifact path is invalid.");
  const [body] = await bucket.file(expectedPath).download();
  const parsed = deletionPlanSchema.safeParse(JSON.parse(body.toString("utf8")));
  if (!parsed.success || deletionPlanHash(parsed.data) !== planHash) {
    throw new HttpsError("failed-precondition", "Stored deletion-plan artifact failed integrity validation.");
  }
  return parsed.data;
}

function deletionPlanIsSubsetOfApproved(current: DeletionPlan, approved: DeletionPlan) {
  if (current.uid !== approved.uid || current.legalHold
    || current.authAccountCreatedAt !== approved.authAccountCreatedAt) return false;
  for (const [collectionName, currentIds] of Object.entries(current.targets)) {
    const approvedIds = new Set(approved.targets[collectionName] ?? []);
    if (currentIds.some((id) => !approvedIds.has(id)
      || !sameDeletionDocumentVersion(approved.targetVersions[`${collectionName}/${id}`], current.targetVersions[`${collectionName}/${id}`]))) return false;
  }
  if (!storageGenerationSubsetApproved(current.uid, approved, current)) return false;
  return true;
}

async function deleteDocumentIds(collectionName: string, ids: string[], subjectUid: string,
  versions: DeletionPlan["targetVersions"], authority: CurrentDeletionAuthority) {
  let deleted = 0;
  for (let start = 0; start < ids.length; start += DELETE_BATCH_LIMIT) {
    const chunk = ids.slice(start, start + DELETE_BATCH_LIMIT);
    // Re-read identity and version within the SAME Firestore transaction that
    // erases documents. A stale approved ID must never delete a replacement.
    deleted += await db.runTransaction(async (transaction) => {
      await requireCurrentDeletionExecution(authority, transaction);
      const references = chunk.map((id) => db.collection(collectionName).doc(id));
      const snapshots = await Promise.all(references.map(ref => transaction.get(ref)));
      for (const snapshot of snapshots) {
        if (!snapshot.exists) continue;
        const storedOwner = snapshot.data()?.uid;
        const ownerMatches = deletionDocumentBelongsToSubject(
          collectionName, snapshot.id, subjectUid, storedOwner);
        if (!ownerMatches || !sameDeletionDocumentVersion(
          versions[`${collectionName}/${snapshot.id}`], approvedTargetVersion(snapshot.updateTime))) {
          throw new HttpsError("failed-precondition", "Deletion document owner or update version changed after approval.");
        }
      }
      await authority.actor.requireCurrent();
      let count = 0;
      snapshots.forEach((snapshot, i) => {
        if (snapshot.exists) {
          transaction.delete(references[i], { lastUpdateTime: snapshot.updateTime });
          count += 1;
        }
      });
      return count;
    });
  }
  return deleted;
}

async function executeDeletion(args: {
  adminUid: string;
  uid: string;
  requestId: string;
  plan: DeletionPlan;
  currentPlan: DeletionPlan;
  planHash: string;
  authority: CurrentDeletionAuthority;
}) {
  const { plan, currentPlan, planHash, authority } = args;
  if (plan.uid !== args.uid) {
    throw new HttpsError("failed-precondition", "Deletion plan subject does not match the requested account.");
  }
  if (deletionPlanHash(plan) !== planHash) {
    throw new HttpsError("failed-precondition", "Deletion plan integrity check failed.");
  }
  if (plan.legalHold || await hasLegalHold(args.uid)) {
    throw new HttpsError("failed-precondition", "Deletion is blocked by active legal hold.");
  }

  const deleted: Record<string, number> = {};
  await requireCurrentDeletionExecution(authority);
  await writeAudit({
    actorUid: args.adminUid,
    actorRole: "admin",
    action: "deletion_execute_started",
    targetUid: args.uid,
    requestId: args.requestId,
    source: "function",
    metadata: { planHash, approvedTargetCounts: plan.counts, remainingTargetCounts: currentPlan.counts }
  });

  for (const collectionName of deletableUserCollections) {
    deleted[collectionName] = await deleteDocumentIds(collectionName,
      currentPlan.targets[collectionName] ?? [], args.uid, plan.targetVersions, authority);
  }

  deleted.users = await deleteDocumentIds("users", currentPlan.targets.users ?? [], args.uid, plan.targetVersions, authority);

  let deletedStorageObjects = 0;
  for (const objectName of currentPlan.storageObjects) {
    // A previously approved name is not permission to delete a replacement.
    // The provider must enforce the precise generation at deletion time.
    const generation = approvedStorageGeneration(args.uid, objectName, plan, currentPlan);
    if (generation === null) {
      throw new HttpsError("failed-precondition", "Export object generation changed after deletion approval.");
    }
    try {
      await requireCurrentDeletionExecution(authority);
      await bucket.file(objectName).delete({ ignoreNotFound: true, ifGenerationMatch: generation });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && Number(error.code) === 412) {
        throw new HttpsError("failed-precondition", "A replacement export generation was encountered during deletion.");
      }
      throw error;
    }
    await requireCurrentDeletionExecution(authority);
    deletedStorageObjects += 1;
  }
  deleted.storageObjects = deletedStorageObjects;

  try {
    await requireCurrentDeletionExecution(authority);
    if (await deletionAuthAccountCreatedAt(args.uid) !== plan.authAccountCreatedAt) {
      throw new HttpsError("failed-precondition", "Deletion subject Auth incarnation changed after approval.");
    }
    await requireCurrentDeletionExecution(authority);
    await auth.deleteUser(args.uid);
    await requireCurrentDeletionExecution(authority);
    deleted.authUsers = 1;
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
    if (code === "auth/user-not-found") {
      deleted.authUsers = 0;
    } else {
      throw error;
    }
  }

  return { plan, planHash, deleted };
}

export const createExportRequest = onCall(async (request) => {
  const actor = await createPrivacyActorGuard(request);
  const uid = actor.uid;
  const now = FieldValue.serverTimestamp();
  const reqRef = db.collection("privacyRequests").doc();
  const jobRef = db.collection("exportJobs").doc();
  await db.runTransaction(async (tx) => {
    const [deletionFence, consentSnapshot] = await Promise.all([
      tx.get(db.collection("privacyDeletionTombstones").doc(uid)),
      tx.get(db.collection("consentRecords").doc(`${uid}_data_export`))
    ]);
    const consent = consentSnapshot.data() ?? {};
    const fence = deletionFence.exists ? deletionFence.data() : null;
    const current = Date.now();
    const consentExpiresAtMillis = timestampMillis(consent.expiresAt);
    const projectedExpiresAtMillis = timestampMillis(fence?.exportConsentExpiresAt);
    const admitted = exportRequestAdmissionBlockReason({
      uid,
      deletionState: checkedLifeMovieDeletionState(deletionFence),
      tombstone: fence,
      consent,
      canonicalConsentAllowed: evaluateConsentDecision({ purpose: "data.export", record: consent, now: new Date(current) }).allowed,
      consentExpiresAtMillis,
      projectedExpiresAtMillis,
      nowMillis: current
    });
    if (admitted || fence?.exportConsentPolicyVersion !== CONSENT_DECISION_POLICY_VERSION) {
      throw new HttpsError("failed-precondition", "Current owner export consent and deletion clearance are required.");
    }
    await actor.requireCurrent();
    tx.set(reqRef, { uid, type: "export", status: "pending", createdAt: now, updatedAt: now });
    tx.set(jobRef, { uid, requestId: reqRef.id, status: "pending", createdAt: now, updatedAt: now, recordCount: 0 });
  });
  await actor.requireCurrent();
  const auditId = await writeAudit({ actorUid: uid, actorRole: "user", action: "export_request_created", targetUid: uid, requestId: reqRef.id, source: "function" });
  return { requestId: reqRef.id, exportJobId: jobRef.id, auditId, status: "pending" };
});

// Legacy unsafely exposed export-processing and GCS signed-URL callables were
// retired from this module. The only deployable export processing and
// consent-bound streaming download paths live in export-request.ts and
// export-lifecycle-functions.ts, explicitly exported by functions-entry.ts.
// Never reintroduce or publish a direct Storage signed URL. (R849)

export const createDeletionRequest = onCall(async (request) => {
  const actor = await createPrivacyActorGuard(request);
  const uid = actor.uid;
  const { reason } = parseOrThrow(createDeletionSchema, request.data);
  const ref = db.collection("deletionRequests").doc();
  await db.runTransaction(async (tx) => {
    const deletionFence = await tx.get(db.collection("privacyDeletionTombstones").doc(uid));
    const blockReason = deletionRequestAdmissionBlockReason({
      uid,
      deletionState: checkedLifeMovieDeletionState(deletionFence),
      tombstone: deletionFence.exists ? deletionFence.data() : null
    });
    if (blockReason) {
      throw new HttpsError("failed-precondition", "Current owner and deletion clearance are required.");
    }
    await actor.requireCurrent();
    tx.create(ref, {
      uid,
      status: "pending",
      scope: "account",
      reason,
      retainedData: [...retainedDeletionCollections],
      deletedData: ["users", ...deletableUserCollections, "storage:exports", "firebaseAuth"],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  await actor.requireCurrent();
  const auditId = await writeAudit({ actorUid: uid, actorRole: "user", action: "deletion_request_created", targetUid: uid, requestId: ref.id, source: "function" });
  return { requestId: ref.id, status: "pending", auditId };
});

export const processDeletionRequest = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { requestId, status } = parseOrThrow(processDeletionSchema, request.data);
  const ref = db.collection("deletionRequests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Deletion request not found.");
  const deletion = snap.data() ?? {};
  const uid = String(deletion.uid ?? "");
  if (!uid) throw new HttpsError("failed-precondition", "Deletion request is missing uid.");

  const candidatePlan = await deletionPlan(uid);
  const candidatePlanHash = deletionPlanHash(candidatePlan);
  const candidatePlanPath = await writeDeletionPlanArtifact(uid, requestId, candidatePlan, candidatePlanHash);
  const safeStatus = status === "completed" ? "processing" : status;
  await db.runTransaction(async (tx) => {
    const [current, deletionFence] = await Promise.all([
      tx.get(ref),
      tx.get(db.collection("privacyDeletionTombstones").doc(uid))
    ]);
    if (!current.exists) throw new HttpsError("not-found", "Deletion request not found.");
    if (["completed", "rejected", "failed"].includes(String(current.data()?.status))) {
      throw new HttpsError("failed-precondition", "Deletion request is already in a terminal state.");
    }
    if (deletionFence.data()?.active === true) {
      throw new HttpsError("failed-precondition", "Account deletion is already fenced; another request cannot recreate subject data.");
    }
    tx.update(ref, {
      status: safeStatus,
      updatedAt: FieldValue.serverTimestamp(),
      candidateDeletionPlan: FieldValue.delete(),
      candidateDeletionPlanPath: candidatePlanPath,
      candidatePlanCounts: candidatePlan.counts,
      candidatePlanHash,
      approvedDeletionPlan: FieldValue.delete(),
      approvedPlanHash: FieldValue.delete(),
      destructiveDeletionDryRunAt: FieldValue.delete(),
      destructiveDeletionReady: false,
      destructiveDeletionBlocked: candidatePlan.legalHold || status === "completed",
      destructiveDeletionReason: candidatePlan.legalHold
        ? "Active legal hold blocks destructive deletion."
        : "Run executeDeletionRequest with mode=dryRun before destructive execution.",
      deletionExecutionState: "not_ready"
    });
  });

  const auditId = await writeAudit({
    actorUid: adminUid,
    actorRole: "admin",
    action: "deletion_processed",
    targetUid: uid,
    requestId,
    source: "function",
    metadata: { requestedStatus: status, appliedStatus: safeStatus, candidatePlanHash, destructiveDeletionReady: false }
  });
  return { requestId, status: safeStatus, requestedStatus: status, auditId, plan: candidatePlan, planHash: candidatePlanHash, destructiveDeletionReady: false };
});

export const executeDeletionRequest = onCall(async (request) => {
  const actor = await createPrivacyActorGuard(request, true);
  const adminUid = actor.uid;
  const { requestId, mode, expectedPlanHash } = parseOrThrow(executeDeletionSchema, request.data);
  const ref = db.collection("deletionRequests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Deletion request not found.");

  const deletion = snap.data() ?? {};
  const uid = String(deletion.uid ?? "");
  if (!uid) throw new HttpsError("failed-precondition", "Deletion request is missing uid.");
  if (["rejected", "failed", "completed"].includes(String(deletion.status))) {
    throw new HttpsError("failed-precondition", "Deletion request is not executable in its current status.");
  }

  if (mode === "dryRun") {
    const plan = await deletionPlan(uid);
    const planHash = deletionPlanHash(plan);
    const planPath = await writeDeletionPlanArtifact(uid, requestId, plan, planHash);
    if (plan.legalHold) {
      await ref.update({
        status: "processing",
        updatedAt: FieldValue.serverTimestamp(),
        candidateDeletionPlan: FieldValue.delete(),
        candidateDeletionPlanPath: planPath,
        candidatePlanCounts: plan.counts,
        candidatePlanHash: planHash,
        approvedDeletionPlan: FieldValue.delete(),
        approvedPlanHash: FieldValue.delete(),
        destructiveDeletionDryRunAt: FieldValue.delete(),
        destructiveDeletionReady: false,
        destructiveDeletionBlocked: true,
        destructiveDeletionReason: "Active legal hold blocks destructive deletion.",
        deletionExecutionState: "blocked"
      });
      const auditId = await writeAudit({
        actorUid: adminUid,
        actorRole: "admin",
        action: "deletion_execute_blocked_legal_hold",
        targetUid: uid,
        requestId,
        source: "function",
        metadata: { planHash }
      });
      return { requestId, status: "processing", mode, auditId, plan, planHash, destructiveDeletionBlocked: true, destructiveDeletionReady: false };
    }

    await ref.update({
      status: "processing",
      updatedAt: FieldValue.serverTimestamp(),
      deletionPlan: FieldValue.delete(),
      deletionPlanPath: planPath,
      deletionPlanCounts: plan.counts,
      planHash,
      approvedDeletionPlan: FieldValue.delete(),
      approvedDeletionPlanPath: planPath,
      approvedPlanCounts: plan.counts,
      approvedPlanHash: planHash,
      destructiveDeletionBlocked: false,
      destructiveDeletionReason: null,
      destructiveDeletionDryRunAt: FieldValue.serverTimestamp(),
      destructiveDeletionDryRunBy: adminUid,
      destructiveDeletionReady: true,
      deletionExecutionState: "ready"
    });
    const auditId = await writeAudit({
      actorUid: adminUid,
      actorRole: "admin",
      action: "deletion_execute_dry_run",
      targetUid: uid,
      requestId,
      source: "function",
      metadata: { planHash, targetCounts: plan.counts }
    });
    return { requestId, status: "processing", mode, auditId, plan, planHash, destructiveDeletionReady: true };
  }

  if (!expectedPlanHash) {
    const auditId = await writeAudit({
      actorUid: adminUid,
      actorRole: "admin",
      action: "deletion_execute_blocked_missing_plan_hash",
      targetUid: uid,
      requestId,
      source: "function"
    });
    throw new HttpsError("failed-precondition", "A current dry-run plan hash is required before destructive deletion.", { auditId });
  }

  const approvedPlanHash = String(deletion.approvedPlanHash ?? "");
  if (!approvedPlanHash || !deletion.approvedDeletionPlanPath || !deletion.destructiveDeletionDryRunAt) {
    const auditId = await writeAudit({
      actorUid: adminUid,
      actorRole: "admin",
      action: "deletion_execute_blocked_missing_approved_plan",
      targetUid: uid,
      requestId,
      source: "function",
      metadata: { expectedPlanHash }
    });
    throw new HttpsError("failed-precondition", "A stored approved dry-run plan is required before destructive deletion.", { auditId });
  }

  const approvedPlan = await readDeletionPlanArtifact(uid, requestId, approvedPlanHash, deletion.approvedDeletionPlanPath);
  if (approvedPlan.uid !== uid || deletionPlanHash(approvedPlan) !== approvedPlanHash) {
    const auditId = await writeAudit({
      actorUid: adminUid,
      actorRole: "admin",
      action: "deletion_execute_blocked_corrupt_approved_plan",
      targetUid: uid,
      requestId,
      source: "function",
      metadata: { expectedPlanHash, approvedPlanHash }
    });
    throw new HttpsError("failed-precondition", "Stored deletion approval is invalid.", { auditId });
  }

  if (expectedPlanHash !== approvedPlanHash) {
    const auditId = await writeAudit({
      actorUid: adminUid,
      actorRole: "admin",
      action: "deletion_execute_blocked_stale_plan_hash",
      targetUid: uid,
      requestId,
      source: "function",
      metadata: { expectedPlanHash, approvedPlanHash }
    });
    throw new HttpsError("failed-precondition", "Deletion plan changed. Re-run dry run and retry with the latest plan hash.", { auditId });
  }

  const mutationToken = typeof deletion.deletionMutationLeaseToken === "string"
    ? deletion.deletionMutationLeaseToken.trim() : "";
  if (!mutationToken || deletion.deletionMutationLeaseOperation !== "execute"
    || deletion.deletionMutationLeaseBy !== adminUid
    || timestampMillis(deletion.deletionMutationLeaseUntil) <= Date.now()) {
    throw new HttpsError("failed-precondition", "Current deletion mutation lease is required.");
  }
  const authority: CurrentDeletionAuthority = {
    actor,
    binding: {
      uid, requestId, adminUid, planHash: approvedPlanHash,
      planPath: String(deletion.approvedDeletionPlanPath),
      token: randomUUID(),
      expiresAt: Date.now() + DELETION_EXECUTION_LEASE_MS,
      mutationToken
    }
  };
  await actor.requireCurrent();
  await db.runTransaction(async (tx) => {
    const tombstoneRef = db.collection("privacyDeletionTombstones").doc(uid);
    const [current, tombstone] = await Promise.all([
      tx.get(ref),
      tx.get(tombstoneRef)
    ]);
    if (!current.exists) throw new HttpsError("not-found", "Deletion request not found.");
    const state = current.data() ?? {};
    const tombstoneState = tombstone.data() ?? {};
    if (state.uid !== uid || state.scope !== "account"
      || state.approvedDeletionPlanPath !== authority.binding.planPath
      || (tombstone.exists && tombstoneState.uid !== uid)
      || state.deletionMutationLeaseToken !== mutationToken
      || state.deletionMutationLeaseOperation !== "execute"
      || state.deletionMutationLeaseBy !== adminUid
      || timestampMillis(state.deletionMutationLeaseUntil) <= Date.now()) {
      throw new HttpsError("failed-precondition", "Subject or deletion mutation authority changed before execution.");
    }
    if (tombstoneState.active === true && tombstoneState.requestId !== requestId) {
      throw new HttpsError("failed-precondition", "Account deletion is already fenced by another deletion request.");
    }
    if (timestampMillis(tombstoneState.exportProcessingLeaseExpiresAt) > Date.now()) {
      throw new HttpsError("aborted", "Deletion is blocked while an export worker holds the subject fence.");
    }
    const planningToken = typeof tombstoneState.deletionPlanningLeaseToken === "string"
      ? String(tombstoneState.deletionPlanningLeaseToken).trim()
      : "";
    const planningLeaseValue = tombstoneState.deletionPlanningLeaseUntil;
    const planningLeasePresent = planningLeaseValue !== undefined && planningLeaseValue !== null;
    const planningLeaseUntil = timestampMillis(planningLeaseValue);
    if ((planningToken || planningLeasePresent) && (!planningToken || !planningLeaseUntil)) {
      throw new HttpsError("failed-precondition", "Subject deletion-planning fence is malformed and requires recovery.");
    }
    if (planningLeaseUntil > Date.now()) {
      throw new HttpsError("aborted", "Deletion is blocked while another request prepares a subject deletion plan.");
    }
    if (["rejected", "failed", "completed"].includes(String(state.status))) {
      throw new HttpsError("failed-precondition", "Deletion request is not executable in its current status.");
    }
    const activeLeaseUntil = timestampMillis(state.deletionExecutionLeaseUntil);
    if (state.deletionExecutionState === "executing" && activeLeaseUntil > Date.now()) {
      throw new HttpsError("aborted", "Deletion execution is already in progress.");
    }
    if (String(state.approvedPlanHash ?? "") !== approvedPlanHash) {
      throw new HttpsError("failed-precondition", "Deletion approval changed before execution.");
    }
    await actor.requireCurrent();
    tx.update(ref, {
      deletionExecutionState: "executing",
      deletionExecutionAttemptToken: authority.binding.token,
      deletionExecutionStartedAt: FieldValue.serverTimestamp(),
      deletionExecutionStartedBy: adminUid,
      deletionExecutionPlanHash: approvedPlanHash,
      deletionExecutionLeaseUntil: new Date(authority.binding.expiresAt),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(tombstoneRef, {
      uid,
      requestId,
      active: true,
      status: "deletion_in_progress",
      deletionExecutionAttemptToken: authority.binding.token,
      fencedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  try {
    await requireCurrentDeletionExecution(authority);
    const currentPlan = await deletionPlan(uid);
    await requireCurrentDeletionExecution(authority);
    const currentPlanHash = deletionPlanHash(currentPlan);
    if (currentPlan.legalHold) {
      throw new HttpsError("failed-precondition", "Deletion is blocked by active legal hold.");
    }
    const resumedFromPartialState = currentPlanHash !== approvedPlanHash;
    if (resumedFromPartialState && !deletionPlanIsSubsetOfApproved(currentPlan, approvedPlan)) {
      throw new HttpsError("failed-precondition", "Deletion targets changed after dry run. Re-run dry run before execution.");
    }

    const result = await executeDeletion({ adminUid, uid, requestId, plan: approvedPlan,
      currentPlan, planHash: approvedPlanHash, authority });
    await db.runTransaction(async (tx) => {
      await requireCurrentDeletionExecution(authority, tx);
      tx.update(ref, {
        status: "processing",
        updatedAt: FieldValue.serverTimestamp(),
        deletionPlanCounts: result.plan.counts,
        planHash: result.planHash,
        deletedCounts: result.deleted,
        retainedData: [...retainedDeletionCollections],
        destructiveDeletionBlocked: false,
        destructiveDeletionReady: false,
        destructiveDeletionMutationCompletedAt: FieldValue.serverTimestamp(),
        destructiveDeletionCompletedAt: FieldValue.delete(),
        deletionExecutionState: "verification_required",
        deletionCompletionVerificationRequired: true,
        deletionCompletionVerified: false,
        deletionCompletionVerificationStatus: "pending",
        deletionExecutionLeaseUntil: FieldValue.delete()
      });
    });
    const auditId = await writeAudit({
      actorUid: adminUid,
      actorRole: "admin",
      action: "deletion_execute_mutation_completed",
      targetUid: uid,
      requestId,
      source: "function",
      metadata: { planHash: result.planHash, deletedCounts: result.deleted, resumedFromPartialState, verificationRequired: true }
    });
    return { requestId, status: "processing", mode, auditId, planCounts: result.plan.counts, planHash: result.planHash, deletedCounts: result.deleted, verificationRequired: true };
  } catch (error) {
    const isPrecondition = error instanceof HttpsError && error.code === "failed-precondition";
    // A stale worker must not alter another worker's newer state or lease.
    await db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (!current.exists || current.data()?.uid !== uid || current.data()?.status !== "processing"
        || current.data()?.deletionExecutionAttemptToken !== authority.binding.token
        || current.data()?.deletionExecutionState !== "executing") return;
      tx.update(ref, {
        status: "processing",
        updatedAt: FieldValue.serverTimestamp(),
        destructiveDeletionBlocked: true,
        destructiveDeletionReady: false,
        destructiveDeletionReason: error instanceof Error ? error.message : "Deletion execution failed.",
        deletionExecutionState: isPrecondition ? "blocked" : "retry_required",
        deletionExecutionLeaseUntil: FieldValue.delete()
      });
    });
    const auditId = await writeAudit({
      actorUid: adminUid,
      actorRole: "admin",
      action: isPrecondition ? "deletion_execute_blocked_precondition" : "deletion_execute_failed",
      targetUid: uid,
      requestId,
      source: "function",
      metadata: { error: error instanceof Error ? error.message : "unknown", approvedPlanHash }
    });
    if (error instanceof HttpsError) {
      throw new HttpsError(error.code, error.message, { auditId });
    }
    throw new HttpsError("internal", "Deletion execution failed.", { auditId });
  }
});

export const writeAuditLog = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { action, targetUid, requestId } = parseOrThrow(auditLogSchema, request.data);
  const auditId = await writeAudit({ actorUid: adminUid, actorRole: "admin", action, targetUid, requestId, source: "admin", metadata: { manual: true } });
  return { auditId };
});

export const recordAdminAction = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { action, targetUid, requestId, notes } = parseOrThrow(adminActionSchema, request.data);
  const ref = db.collection("adminActions").doc();
  await ref.set({ adminUid, action, targetUid: targetUid ?? null, requestId: requestId ?? null, notes: notes ?? null, timestamp: FieldValue.serverTimestamp() });
  const auditId = await writeAudit({ actorUid: adminUid, actorRole: "admin", action: "admin_changed_request_status", targetUid, requestId, source: "admin", metadata: { adminActionId: ref.id } });
  return { adminActionId: ref.id, auditId };
});

export const getPrivacyHealthReport = onCall(async (request) => {
  await requireAdmin(request);
  const [exportsSnap, deletionsSnap, policiesSnap, auditsSnap, revocationsSnap] = await Promise.all([
    db.collection("privacyRequests").where("type", "==", "export").where("status", "in", ["pending", "approved", "processing"]).get(),
    db.collection("deletionRequests").where("status", "in", ["pending", "approved", "processing"]).get(),
    db.collection("retentionPolicies").get(),
    db.collection("auditLogs").limit(100).get(),
    // A bounded sample is operational evidence, not global delivery certification.
    db.collection("consentRevocationOutbox").limit(101).get()
  ]);
  // Missing fields include legacy outbox records created before scheduling existed.
  // Never report nominal while the sampled revocation queue is unresolved.
  const jobsRevocationUnresolvedSampled = revocationsSnap.docs.filter((entry) =>
    entry.data()?.jobsDeliveryState !== "applied").length;
  const revocationSampleIncomplete = revocationsSnap.size >= 101;
  const operationalState =
    exportsSnap.size > 50 || deletionsSnap.size > 25 ||
    jobsRevocationUnresolvedSampled > 0 || revocationSampleIncomplete
      ? "needs_review" : "nominal";
  return {
    generatedAt: new Date().toISOString(),
    openExportRequests: exportsSnap.size,
    openDeletionRequests: deletionsSnap.size,
    activePolicies: policiesSnap.size,
    auditEventsSampled: auditsSnap.size,
    jobsRevocationRecordsSampled: revocationsSnap.size,
    jobsRevocationUnresolvedSampled,
    revocationSampleIncomplete,
    operationalState,
    verdict: "evidence_incomplete",
    certification: "not_certified"
  };
});
