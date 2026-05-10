import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();
const db = getFirestore();

type Role = "user" | "admin" | "system";

type Status = "pending" | "approved" | "processing" | "completed" | "rejected" | "failed";

function uidFrom(request: { auth?: { uid?: string; token?: Record<string, unknown> } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  return uid;
}

async function isAdmin(uid: string, token?: Record<string, unknown>) {
  if (token?.admin === true) return true;
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
  await ref.set({ ...args, timestamp: FieldValue.serverTimestamp(), metadata: args.metadata ?? {} });
  return ref.id;
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
  const jobId = String(request.data?.jobId ?? "");
  if (!jobId) throw new HttpsError("invalid-argument", "jobId is required.");
  const jobRef = db.collection("exportJobs").doc(jobId);
  const snap = await jobRef.get();
  if (!snap.exists) throw new HttpsError("not-found", "Export job not found.");
  const job = snap.data() ?? {};
  await jobRef.update({ status: "completed", updatedAt: FieldValue.serverTimestamp(), exportManifestPath: `exports/${job.uid}/${jobId}/manifest.json` });
  const auditId = await writeAudit({ actorUid: adminUid, actorRole: "admin", action: "export_processed", targetUid: String(job.uid), requestId: String(job.requestId), source: "function", metadata: { jobId } });
  return { jobId, status: "completed", auditId };
});

export const createDeletionRequest = onCall(async (request) => {
  const uid = uidFrom(request);
  const reason = String(request.data?.reason ?? "User requested deletion");
  const ref = db.collection("deletionRequests").doc();
  await ref.set({ uid, status: "pending", scope: "account", reason, retainedData: ["auditLogs", "policyVersions", "legalHoldRecords"], deletedData: ["users", "privacyRequests", "exportJobs", "deletionRequests", "consentRecords", "dataAccessEvents"], createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  const auditId = await writeAudit({ actorUid: uid, actorRole: "user", action: "deletion_request_created", targetUid: uid, requestId: ref.id, source: "function" });
  return { requestId: ref.id, status: "pending", auditId };
});

export const processDeletionRequest = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const requestId = String(request.data?.requestId ?? "");
  const status = String(request.data?.status ?? "processing") as Status;
  if (!requestId) throw new HttpsError("invalid-argument", "requestId is required.");
  if (!["approved", "processing", "completed", "rejected", "failed"].includes(status)) throw new HttpsError("invalid-argument", "Invalid deletion status.");
  const ref = db.collection("deletionRequests").doc(requestId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Deletion request not found.");
  const deletion = snap.data() ?? {};
  await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
  if (status === "processing" || status === "completed") {
    await db.collection("users").doc(String(deletion.uid)).set({ markedForDeletion: true, deletionMarkedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  const auditId = await writeAudit({ actorUid: adminUid, actorRole: "admin", action: "deletion_processed", targetUid: String(deletion.uid), requestId, source: "function", metadata: { status } });
  return { requestId, status, auditId };
});

export const updateConsent = onCall(async (request) => {
  const uid = uidFrom(request);
  const purpose = String(request.data?.purpose ?? "");
  const consentTier = String(request.data?.consentTier ?? "C1");
  const status = String(request.data?.status ?? "denied");
  if (!purpose) throw new HttpsError("invalid-argument", "purpose is required.");
  if (!["granted", "denied", "revoked"].includes(status)) throw new HttpsError("invalid-argument", "Invalid consent status.");
  const ref = db.collection("consentRecords").doc(`${uid}_${purpose.replace(/[^a-zA-Z0-9_-]/g, "_")}`);
  await ref.set({ uid, purpose, consentTier, status, policyVersion: "0.1.0-draft", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const auditId = await writeAudit({ actorUid: uid, actorRole: "user", action: "consent_updated", targetUid: uid, source: "function", metadata: { purpose, consentTier, status } });
  return { consentId: ref.id, status, auditId };
});

export const writeAuditLog = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const action = String(request.data?.action ?? "admin_viewed_request");
  const targetUid = request.data?.targetUid ? String(request.data.targetUid) : undefined;
  const requestId = request.data?.requestId ? String(request.data.requestId) : undefined;
  const auditId = await writeAudit({ actorUid: adminUid, actorRole: "admin", action, targetUid, requestId, source: "admin", metadata: { manual: true } });
  return { auditId };
});

export const recordAdminAction = onCall(async (request) => {
  const adminUid = await requireAdmin(request);
  const action = String(request.data?.action ?? "admin_changed_request_status");
  const ref = db.collection("adminActions").doc();
  await ref.set({ adminUid, action, targetUid: request.data?.targetUid ?? null, requestId: request.data?.requestId ?? null, notes: request.data?.notes ?? null, timestamp: FieldValue.serverTimestamp() });
  const auditId = await writeAudit({ actorUid: adminUid, actorRole: "admin", action: "admin_changed_request_status", targetUid: request.data?.targetUid, requestId: request.data?.requestId, source: "admin", metadata: { adminActionId: ref.id } });
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
