import { createHash } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

initializeApp();
const db = getFirestore();
const bucket = getStorage().bucket();

type Role = "user" | "admin" | "system";
type Status = "pending" | "approved" | "processing" | "completed" | "rejected" | "failed";

const deletionStatuses = ["approved", "processing", "completed", "rejected", "failed"] as const;
const consentStatuses = ["granted", "denied", "revoked"] as const;
const consentTiers = ["C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"] as const;
const exportCollections = ["users", "privacyRequests", "exportJobs", "deletionRequests", "consentRecords", "dataAccessEvents", "auditLogs", "adminActions"];
const redactedFields = ["password", "token", "secret", "apiKey", "privateKey", "refreshToken", "idToken"];
const EXPORT_SIGNED_URL_TTL_MS = 15 * 60 * 1000;

const processExportSchema = z.object({ jobId: z.string().min(1) });
const getExportDownloadSchema = z.object({ jobId: z.string().min(1), file: z.enum(["export", "manifest"]).default("export") });
const createDeletionSchema = z.object({ reason: z.string().trim().min(8).max(1000).default("User requested deletion") });
const processDeletionSchema = z.object({ requestId: z.string().min(1), status: z.enum(deletionStatuses).default("processing") });
const updateConsentSchema = z.object({
  purpose: z.string().trim().min(2).max(120).regex(/^[a-zA-Z0-9_.:-]+$/),
  consentTier: z.enum(consentTiers).default("C1"),
  status: z.enum(consentStatuses).default("denied")
});
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

async function isAdmin(uid: string, token?: Record<string, unknown>) {
  if (token?.admin === true || token?.role === "admin") return true;
  const snap = await db.collection("users").doc(uid).get();
  return snap.exists && snap.data()?.role === "admin";
}

async function requireAdmin(request: { auth?: { uid?: string; token?: Record<string, unknown> } }) {
  const uid = uidFrom(request);
  if (!(await isAdmin(uid, request.auth?.token))) {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
  return uid;
}

async function requireOwnerOrAdmin(request: { auth?: { uid?: string; token?: Record<string, unknown> } }, targetUid: string) {
  const uid = uidFrom(request);
  if (uid !== targetUid && !(await isAdmin(uid, request.auth?.token))) {
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

function scrub(value: DocumentData) {
  const blocked = new Set(redactedFields);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !blocked.has(key)));
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

async function collectUserExport(uid: string) {
  const collections: Record<string, Array<Record<string, unknown>>> = {};
  let recordCount = 0;
  for (const name of exportCollections) {
    if (name === "users") {
      const userDoc = await db.collection("users").doc(uid).get();
      const docs = userDoc.exists ? [{ id: userDoc.id, ...scrub(userDoc.data() ?? {}) }] : [];
      collections[name] = docs;
      recordCount += docs.length;
      continue;
    }
    const query = name === "auditLogs" || name === "adminActions" ? db.collection(name).where("targetUid", "==", uid).limit(1000) : db.collection(name).where("uid", "==", uid).limit(1000);
    const snap = await query.get();
    const docs = snap.docs.map((doc) => ({ id: doc.id, ...scrub(doc.data()) }));
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

async function deletionPlan(uid: string) {
  const planCollections = ["users", "privacyRequests", "exportJobs", "consentRecords", "dataAccessEvents"];
  const counts: Record<string, number> = {};
  for (const collectionName of planCollections) {
    if (collectionName === "users") {
      counts.users = (await db.collection("users").doc(uid).get()).exists ? 1 : 0;
    } else {
      counts[collectionName] = (await db.collection(collectionName).where("uid", "==", uid).get()).size;
    }
  }
  return { uid, counts, retainedData: ["auditLogs", "policyVersions", "adminActions", "retentionPolicies"], generatedAt: new Date().toISOString(), mode: "safe-plan" };
}

export const createExportRequest = onCall(async (request) => {
  const uid = uidFrom(request);
  const now = FieldValue.serverTimestamp();
  const reqRef = db.collection("privacyRequests").doc();
  const jobRef = db.collection("exportJobs").doc();
  await db.runTransaction(async (tx) => {
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
  const snap = await jobRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Export job not found.");
  const job = snap.data() ?? {};
  const uid = String(job.uid ?? "");
  const requestId = String(job.requestId ?? "");
  if (!uid || !requestId) throw new HttpsError("failed-precondition", "Export job is missing uid or requestId.");

  await jobRef.update({ status: "processing", updatedAt: FieldValue.serverTimestamp() });
  const exportData = await collectUserExport(uid);
  const exportPath = `exports/${uid}/${jobId}/export.json`;
  const manifestPath = `exports/${uid}/${jobId}/manifest.json`;
  const exportFile = await writeJson(exportPath, { uid, requestId, jobId, generatedAt: new Date().toISOString(), data: exportData.collections });
  const manifestFile = await writeJson(manifestPath, { uid, requestId, jobId, generatedAt: new Date().toISOString(), recordCount: exportData.recordCount, files: [exportFile], excludedFields: redactedFields });

  await db.runTransaction(async (tx) => {
    tx.update(jobRef, { status: "completed", updatedAt: FieldValue.serverTimestamp(), exportManifestPath: manifestPath, exportPackagePath: exportPath, recordCount: exportData.recordCount, manifestSha256: manifestFile.sha256, exportSha256: exportFile.sha256 });
    tx.update(db.collection("privacyRequests").doc(requestId), { status: "completed", updatedAt: FieldValue.serverTimestamp() });
  });
  const auditId = await writeAudit({ actorUid: adminUid, actorRole: "admin", action: "export_processed", targetUid: uid, requestId, source: "function", metadata: { jobId, recordCount: exportData.recordCount, manifestPath, exportPath } });
  return { jobId, status: "completed", auditId, manifestPath, exportPath, recordCount: exportData.recordCount };
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
  await ref.set({ uid, status: "pending", scope: "account", reason, retainedData: ["auditLogs", "policyVersions", "adminActions", "retentionPolicies"], deletedData: ["users", "privacyRequests", "exportJobs", "consentRecords", "dataAccessEvents"], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
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
  const plan = await deletionPlan(uid);
  const safeStatus = status === "completed" ? "processing" : status;
  await ref.update({
    status: safeStatus,
    updatedAt: FieldValue.serverTimestamp(),
    deletionPlan: plan,
    planHash: sha256(plan),
    destructiveDeletionBlocked: true,
    destructiveDeletionReason: "Final destructive deletion requires the production executor, legal-hold verification, retry handling, and release evidence before a request can be marked completed."
  });
  if (safeStatus === "processing") await db.collection("users").doc(uid).set({ markedForDeletion: true, deletionMarkedAt: FieldValue.serverTimestamp() }, { merge: true });
  const auditId = await writeAudit({ actorUid: adminUid, actorRole: "admin", action: "deletion_processed", targetUid: uid, requestId, source: "function", metadata: { requestedStatus: status, appliedStatus: safeStatus, planHash: sha256(plan), destructiveDeletionBlocked: true } });
  return { requestId, status: safeStatus, requestedStatus: status, auditId, plan, destructiveDeletionBlocked: true };
});

export const updateConsent = onCall(async (request) => {
  const uid = uidFrom(request);
  const { purpose, consentTier, status } = parseOrThrow(updateConsentSchema, request.data);
  const ref = db.collection("consentRecords").doc(`${uid}_${purpose.replace(/[^a-zA-Z0-9_-]/g, "_")}`);
  const receipt = { uid, purpose, consentTier, status, policyVersion: "0.1.0-draft", updatedAt: new Date().toISOString() };
  await ref.set({ ...receipt, updatedAt: FieldValue.serverTimestamp(), receiptHash: sha256(receipt) }, { merge: true });
  const eventRef = db.collection("consentEvents").doc();
  await eventRef.set({ ...receipt, actorUid: uid, consentRecordId: ref.id, createdAt: FieldValue.serverTimestamp(), receiptHash: sha256({ ...receipt, eventId: eventRef.id }) });
  const auditId = await writeAudit({ actorUid: uid, actorRole: "user", action: "consent_updated", targetUid: uid, source: "function", metadata: { purpose, consentTier, status, consentRecordId: ref.id, consentEventId: eventRef.id } });
  return { consentId: ref.id, consentEventId: eventRef.id, status, auditId, receiptHash: sha256(receipt) };
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
  return { generatedAt: new Date().toISOString(), openExportRequests: exportsSnap.size, openDeletionRequests: deletionsSnap.size, activePolicies: policiesSnap.size, auditEventsSampled: auditsSnap.size, verdict: exportsSnap.size > 50 || deletionsSnap.size > 25 ? "needs_review" : "healthy" };
});
