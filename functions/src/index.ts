import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { initializeApp } from "firebase-admin/app";
import { FieldPath, FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

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
const deletableUserCollections = ["privacyRequests", "exportJobs", "consentRecords", "dataAccessEvents"] as const;
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
const EXPORT_SIGNED_URL_TTL_MS = 15 * 60 * 1000;
const QUERY_PAGE_LIMIT = 450;
const DELETE_BATCH_LIMIT = 450;
const DELETION_EXECUTION_LEASE_MS = 15 * 60 * 1000;

const processExportSchema = z.object({ jobId: z.string().min(1) });
const getExportDownloadSchema = z.object({ jobId: z.string().min(1), file: z.enum(["export", "manifest"]).default("export") });
const createDeletionSchema = z.object({ reason: z.string().trim().min(8).max(1000).default("User requested deletion") });
const processDeletionSchema = z.object({ requestId: z.string().min(1), status: z.enum(deletionStatuses).default("processing") });
const executeDeletionSchema = z.object({
  requestId: z.string().min(1),
  mode: z.enum(["dryRun", "execute"]).default("dryRun"),
  expectedPlanHash: z.string().regex(/^[0-9a-f]{64}$/).optional()
});
const deletionPlanSchema = z.object({
  uid: z.string().min(1),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  targets: z.record(z.string(), z.array(z.string())),
  storageObjects: z.array(z.string()),
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
  return token?.admin === true || token?.role === "admin";
}

async function requireAdmin(request: { auth?: { uid?: string; token?: Record<string, unknown> } }) {
  const uid = uidFrom(request);
  if (!isAdmin(request.auth?.token)) {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
  return uid;
}

async function requireOwnerOrAdmin(request: { auth?: { uid?: string; token?: Record<string, unknown> } }, targetUid: string) {
  const uid = uidFrom(request);
  if (uid !== targetUid && !isAdmin(request.auth?.token)) {
    throw new HttpsError("permission-denied", "Owner or admin access is required.");
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
  const documents: Array<{ id: string; data: DocumentData }> = [];
  let cursor: string | null = null;
  while (true) {
    let query = db.collection(collectionName)
      .where(field, "==", uid)
      .orderBy(FieldPath.documentId())
      .limit(QUERY_PAGE_LIMIT);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    documents.push(...snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() })));
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

async function listUserScopedIds(collectionName: string, uid: string) {
  const rows = await listScopedDocuments(collectionName, "uid", uid);
  return rows.map((row) => row.id).sort();
}

async function deletionPlan(uid: string): Promise<DeletionPlan> {
  const userDoc = await db.collection("users").doc(uid).get();
  const targets: Record<string, string[]> = { users: userDoc.exists ? [uid] : [] };

  for (const collectionName of deletableUserCollections) {
    targets[collectionName] = await listUserScopedIds(collectionName, uid);
  }

  const [files] = await bucket.getFiles({ prefix: `exports/${uid}/` });
  const storageObjects = files.map((file) => file.name).sort();
  const counts = Object.fromEntries(Object.entries(targets).map(([name, ids]) => [name, ids.length]));
  counts.storageObjects = storageObjects.length;

  return {
    uid,
    counts,
    targets,
    storageObjects,
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
    uid: plan.uid,
    counts: Object.fromEntries(Object.entries(plan.counts).sort(([left], [right]) => left.localeCompare(right))),
    targets: Object.fromEntries(
      Object.entries(plan.targets)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([name, ids]) => [name, [...ids].sort()])
    ),
    storageObjects: [...plan.storageObjects].sort(),
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

function deletionPlanIsSubsetOfApproved(current: DeletionPlan, approved: DeletionPlan) {
  if (current.uid !== approved.uid || current.legalHold) return false;
  for (const [collectionName, currentIds] of Object.entries(current.targets)) {
    const approvedIds = new Set(approved.targets[collectionName] ?? []);
    if (currentIds.some((id) => !approvedIds.has(id))) return false;
  }
  const approvedStorageObjects = new Set(approved.storageObjects);
  if (current.storageObjects.some((name) => !approvedStorageObjects.has(name))) return false;
  return true;
}

async function deleteDocumentIds(collectionName: string, ids: string[]) {
  let deleted = 0;
  for (let start = 0; start < ids.length; start += DELETE_BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = ids.slice(start, start + DELETE_BATCH_LIMIT);
    for (const id of chunk) batch.delete(db.collection(collectionName).doc(id));
    await batch.commit();
    deleted += chunk.length;
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
}) {
  const { plan, currentPlan, planHash } = args;
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
    deleted[collectionName] = await deleteDocumentIds(collectionName, currentPlan.targets[collectionName] ?? []);
  }

  deleted.users = await deleteDocumentIds("users", currentPlan.targets.users ?? []);

  let deletedStorageObjects = 0;
  for (const objectName of currentPlan.storageObjects) {
    await bucket.file(objectName).delete({ ignoreNotFound: true });
    deletedStorageObjects += 1;
  }
  deleted.storageObjects = deletedStorageObjects;

  try {
    await auth.deleteUser(args.uid);
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
  const uid = uidFrom(request);
  const now = FieldValue.serverTimestamp();
  const reqRef = db.collection("privacyRequests").doc();
  const jobRef = db.collection("exportJobs").doc();
  await db.runTransaction(async (tx) => {
    const deletionFence = await tx.get(db.collection("privacyDeletionTombstones").doc(uid));
    if (deletionFence.data()?.active === true) {
      throw new HttpsError("failed-precondition", "Account deletion is in progress or completed; new export requests are blocked.");
    }
    tx.set(reqRef, { uid, type: "export", status: "pending", createdAt: now, updatedAt: now });
    tx.set(jobRef, { uid, requestId: reqRef.id, status: "pending", createdAt: now, updatedAt: now, recordCount: 0 });
  });
  const auditId = await writeAudit({ actorUid: uid, actorRole: "user", action: "export_request_created", targetUid: uid, requestId: reqRef.id, source: "function" });
  return { requestId: reqRef.id, exportJobId: jobRef.id, auditId, status: "pending" };
});

export const processExportRequest = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const { jobId } = parseOrThrow(processExportSchema, request.data);
  const jobRef = db.collection("exportJobs").doc(jobId);

  const claim = await db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) throw new HttpsError("not-found", "Export job not found.");
    const job = jobSnap.data() ?? {};
    const uid = String(job.uid ?? "");
    const requestId = String(job.requestId ?? "");
    if (!uid || !requestId) throw new HttpsError("failed-precondition", "Export job is missing uid or requestId.");
    if (["processing", "completed"].includes(String(job.status))) {
      throw new HttpsError("failed-precondition", "Export job is already processing or complete.");
    }

    const requestRef = db.collection("privacyRequests").doc(requestId);
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists || requestSnap.data()?.uid !== uid || requestSnap.data()?.type !== "export") {
      throw new HttpsError("failed-precondition", "Export request linkage is invalid.");
    }

    tx.update(jobRef, { status: "processing", updatedAt: FieldValue.serverTimestamp(), processingBy: adminUid });
    tx.update(requestRef, { status: "processing", updatedAt: FieldValue.serverTimestamp() });
    return { uid, requestId, requestRef };
  });

  try {
    const exportData = await collectUserExport(claim.uid);
    const exportPath = `exports/${claim.uid}/${jobId}/export.json`;
    const manifestPath = `exports/${claim.uid}/${jobId}/manifest.json`;
    const exportFile = await writeJson(exportPath, { uid: claim.uid, requestId: claim.requestId, jobId, generatedAt: new Date().toISOString(), data: exportData.collections });
    const manifestFile = await writeJson(manifestPath, {
      uid: claim.uid,
      requestId: claim.requestId,
      jobId,
      generatedAt: new Date().toISOString(),
      recordCount: exportData.recordCount,
      files: [exportFile],
      excludedFields: [...redactedFields]
    });

    await db.runTransaction(async (tx) => {
      tx.update(jobRef, {
        status: "completed",
        updatedAt: FieldValue.serverTimestamp(),
        exportManifestPath: manifestPath,
        exportPackagePath: exportPath,
        recordCount: exportData.recordCount,
        manifestSha256: manifestFile.sha256,
        exportSha256: exportFile.sha256
      });
      tx.update(claim.requestRef, { status: "completed", updatedAt: FieldValue.serverTimestamp() });
    });

    const auditId = await writeAudit({
      actorUid: adminUid,
      actorRole: "admin",
      action: "export_processed",
      targetUid: claim.uid,
      requestId: claim.requestId,
      source: "function",
      metadata: { jobId, recordCount: exportData.recordCount, manifestPath, exportPath }
    });
    return { jobId, status: "completed", auditId, manifestPath, exportPath, recordCount: exportData.recordCount };
  } catch (error) {
    await db.runTransaction(async (tx) => {
      tx.update(jobRef, { status: "failed", updatedAt: FieldValue.serverTimestamp() });
      tx.update(claim.requestRef, { status: "failed", updatedAt: FieldValue.serverTimestamp() });
    });
    const auditId = await writeAudit({
      actorUid: adminUid,
      actorRole: "admin",
      action: "export_processing_failed",
      targetUid: claim.uid,
      requestId: claim.requestId,
      source: "function",
      metadata: { jobId, error: error instanceof Error ? error.message : "unknown" }
    });
    throw new HttpsError("internal", "Export processing failed.", { auditId });
  }
});

export const getExportDownloadUrl = onCall(async (request) => {
  const { jobId, file } = parseOrThrow(getExportDownloadSchema, request.data);
  const jobRef = db.collection("exportJobs").doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Export job not found.");

  const job = snap.data() ?? {};
  const uid = String(job.uid ?? "");
  const requestId = String(job.requestId ?? "");
  if (!uid || !requestId) throw new HttpsError("failed-precondition", "Export job is missing uid or requestId.");
  await requireOwnerOrAdmin(request, uid);

  if (job.status !== "completed") {
    throw new HttpsError("failed-precondition", "Export job is not complete yet.");
  }

  const path = file === "manifest" ? String(job.exportManifestPath ?? "") : String(job.exportPackagePath ?? "");
  if (!path || !path.startsWith(`exports/${uid}/${jobId}/`)) {
    throw new HttpsError("failed-precondition", "Export file path is missing or invalid.");
  }

  const expiresAt = Date.now() + EXPORT_SIGNED_URL_TTL_MS;
  const [url] = await bucket.file(path).getSignedUrl({ action: "read", expires: expiresAt });
  const auditId = await writeAudit({
    actorUid: request.auth?.uid ?? uid,
    actorRole: request.auth?.uid === uid ? "user" : "admin",
    action: "export_download_url_created",
    targetUid: uid,
    requestId,
    source: "function",
    metadata: { jobId, file, path, expiresAt }
  });

  return { jobId, requestId, file, url, expiresAt, expiresInSeconds: Math.floor(EXPORT_SIGNED_URL_TTL_MS / 1000), auditId };
});

export const createDeletionRequest = onCall(async (request) => {
  const uid = uidFrom(request);
  const { reason } = parseOrThrow(createDeletionSchema, request.data);
  const ref = db.collection("deletionRequests").doc();
  await db.runTransaction(async (tx) => {
    const deletionFence = await tx.get(db.collection("privacyDeletionTombstones").doc(uid));
    if (deletionFence.data()?.active === true) {
      throw new HttpsError("failed-precondition", "Account deletion is in progress or completed; new deletion requests are blocked.");
    }
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
  if (["completed", "rejected", "failed"].includes(String(deletion.status))) {
    throw new HttpsError("failed-precondition", "Deletion request is already in a terminal state.");
  }

  const candidatePlan = await deletionPlan(uid);
  const candidatePlanHash = deletionPlanHash(candidatePlan);
  const safeStatus = status === "completed" ? "processing" : status;
  await ref.update({
    status: safeStatus,
    updatedAt: FieldValue.serverTimestamp(),
    candidateDeletionPlan: candidatePlan,
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

  if (safeStatus === "approved" || safeStatus === "processing") {
    await db.collection("users").doc(uid).set({ markedForDeletion: true, deletionMarkedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

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
  const adminUid = await requireAdmin(request);
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
    if (plan.legalHold) {
      await ref.update({
        status: "processing",
        updatedAt: FieldValue.serverTimestamp(),
        candidateDeletionPlan: plan,
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
      deletionPlan: plan,
      planHash,
      approvedDeletionPlan: plan,
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

  const approvedPlanResult = deletionPlanSchema.safeParse(deletion.approvedDeletionPlan);
  const approvedPlanHash = String(deletion.approvedPlanHash ?? "");
  if (!approvedPlanResult.success || !approvedPlanHash || !deletion.destructiveDeletionDryRunAt) {
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

  const approvedPlan = approvedPlanResult.data;
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

  await db.runTransaction(async (tx) => {
    const current = await tx.get(ref);
    if (!current.exists) throw new HttpsError("not-found", "Deletion request not found.");
    const state = current.data() ?? {};
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
    tx.update(ref, {
      deletionExecutionState: "executing",
      deletionExecutionStartedAt: FieldValue.serverTimestamp(),
      deletionExecutionStartedBy: adminUid,
      deletionExecutionPlanHash: approvedPlanHash,
      deletionExecutionLeaseUntil: new Date(Date.now() + DELETION_EXECUTION_LEASE_MS),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(db.collection("privacyDeletionTombstones").doc(uid), {
      uid,
      requestId,
      active: true,
      status: "deletion_in_progress",
      fencedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  try {
    const currentPlan = await deletionPlan(uid);
    const currentPlanHash = deletionPlanHash(currentPlan);
    if (currentPlan.legalHold) {
      throw new HttpsError("failed-precondition", "Deletion is blocked by active legal hold.");
    }
    const resumedFromPartialState = currentPlanHash !== approvedPlanHash;
    if (resumedFromPartialState && !deletionPlanIsSubsetOfApproved(currentPlan, approvedPlan)) {
      throw new HttpsError("failed-precondition", "Deletion targets changed after dry run. Re-run dry run before execution.");
    }

    const result = await executeDeletion({ adminUid, uid, requestId, plan: approvedPlan, currentPlan, planHash: approvedPlanHash });
    await ref.update({
      status: "processing",
      updatedAt: FieldValue.serverTimestamp(),
      deletionPlan: result.plan,
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
    const auditId = await writeAudit({
      actorUid: adminUid,
      actorRole: "admin",
      action: "deletion_execute_mutation_completed",
      targetUid: uid,
      requestId,
      source: "function",
      metadata: { planHash: result.planHash, deletedCounts: result.deleted, resumedFromPartialState, verificationRequired: true }
    });
    return { requestId, status: "processing", mode, auditId, plan: result.plan, planHash: result.planHash, deletedCounts: result.deleted, verificationRequired: true };
  } catch (error) {
    const isPrecondition = error instanceof HttpsError && error.code === "failed-precondition";
    await ref.update({
      status: "processing",
      updatedAt: FieldValue.serverTimestamp(),
      destructiveDeletionBlocked: true,
      destructiveDeletionReady: false,
      destructiveDeletionReason: error instanceof Error ? error.message : "Deletion execution failed.",
      deletionExecutionState: isPrecondition ? "blocked" : "retry_required",
      deletionExecutionLeaseUntil: FieldValue.delete()
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
  const [exportsSnap, deletionsSnap, policiesSnap, auditsSnap] = await Promise.all([
    db.collection("privacyRequests").where("type", "==", "export").where("status", "in", ["pending", "approved", "processing"]).get(),
    db.collection("deletionRequests").where("status", "in", ["pending", "approved", "processing"]).get(),
    db.collection("retentionPolicies").get(),
    db.collection("auditLogs").limit(100).get()
  ]);
  const operationalState = exportsSnap.size > 50 || deletionsSnap.size > 25 ? "needs_review" : "nominal";
  return {
    generatedAt: new Date().toISOString(),
    openExportRequests: exportsSnap.size,
    openDeletionRequests: deletionsSnap.size,
    activePolicies: policiesSnap.size,
    auditEventsSampled: auditsSnap.size,
    operationalState,
    verdict: "evidence_incomplete",
    certification: "not_certified"
  };
});
