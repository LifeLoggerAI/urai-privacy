import { createHash } from "node:crypto";
import { FieldPath, FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

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
const revocationAcknowledgementExportKey = "consentRevocationAcknowledgements";
const redactedFields = new Set(["password", "token", "secret", "apikey", "privatekey", "refreshtoken", "idtoken"]);
const QUERY_PAGE_LIMIT = 450;

const processExportSchema = z.object({ jobId: z.string().min(1) });

type Role = "user" | "admin" | "system";
type ExportRow = { id: string; data: DocumentData };

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

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join("; "));
  return parsed.data;
}

function sha256(value: unknown) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
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
  const db = getFirestore();
  const ref = db.collection("auditLogs").doc();
  await ref.set({ ...args, timestamp: FieldValue.serverTimestamp(), metadata: args.metadata ?? {}, integrityHash: sha256({ ...args, id: ref.id }) });
  return ref.id;
}

async function listScopedDocuments(collectionName: string, field: "uid" | "targetUid", uid: string) {
  const db = getFirestore();
  const documents: ExportRow[] = [];
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

async function listSubcollectionDocuments(parentCollection: string, parentId: string, subcollectionName: string) {
  const db = getFirestore();
  const documents: ExportRow[] = [];
  let cursor: string | null = null;
  while (true) {
    let query = db.collection(parentCollection)
      .doc(parentId)
      .collection(subcollectionName)
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

async function collectRevocationAcknowledgements(outboxRows: ExportRow[]) {
  const acknowledgements: Array<Record<string, unknown>> = [];
  for (const outbox of outboxRows) {
    const rows = await listSubcollectionDocuments("consentRevocationOutbox", outbox.id, "acknowledgements");
    acknowledgements.push(...rows.map((row) => ({
      ...(scrub(row.data) as Record<string, unknown>),
      id: row.id,
      eventId: outbox.id,
      parentPath: `consentRevocationOutbox/${outbox.id}`
    })));
  }
  return acknowledgements;
}

async function collectUserExport(uid: string) {
  const db = getFirestore();
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

    if (name === "consentRevocationOutbox") {
      const acknowledgements = await collectRevocationAcknowledgements(rows);
      collections[revocationAcknowledgementExportKey] = acknowledgements;
      recordCount += acknowledgements.length;
    }
  }

  if (!(revocationAcknowledgementExportKey in collections)) {
    collections[revocationAcknowledgementExportKey] = [];
  }

  return { collections, recordCount };
}

async function writeJson(path: string, value: unknown) {
  const bucket = getStorage().bucket();
  const body = JSON.stringify(value, null, 2);
  await bucket.file(path).save(body, {
    resumable: false,
    contentType: "application/json",
    metadata: { cacheControl: "private, max-age=0, no-store", metadata: { sha256: sha256(body) } }
  });
  return { path, sha256: sha256(body), bytes: Buffer.byteLength(body, "utf8") };
}

export const processExportRequest = onCall(async (request) => {
  const db = getFirestore();
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
