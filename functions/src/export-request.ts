import { createHash } from "node:crypto";
import { FieldPath, FieldValue, getFirestore, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { removeExportArtifacts } from "./export-artifact-cleanup";
import { collectNestedRows, collectPaginatedRows } from "./export-pagination";
import { EXPORT_PACKAGE_TTL_MS } from "./export-lifecycle-contract";

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
const sensitiveFieldMarkers = [
  "password",
  "token",
  "secret",
  "apikey",
  "privatekey",
  "credential",
  "authorization",
  "cookie",
  "sessionkey",
  "webhooksignature"
] as const;
const QUERY_PAGE_LIMIT = 450;
const NESTED_QUERY_CONCURRENCY = 8;
const EXPORT_PROCESSING_LEASE_MS = 15 * 60 * 1000;

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

export function shouldRedactExportField(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return sensitiveFieldMarkers.some((marker) => normalized.includes(marker));
}

export function scrubExportValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubExportValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !shouldRedactExportField(key))
        .map(([key, nested]) => [key, scrubExportValue(nested)])
    );
  }
  return value;
}

export function processingLeaseIsActive(value: unknown, nowMs = Date.now()) {
  if (!value || typeof value !== "object" || !("toMillis" in value) || typeof value.toMillis !== "function") {
    return false;
  }
  return value.toMillis() > nowMs;
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
  return collectPaginatedRows<DocumentData>(async (cursor, limit) => {
    let query = db.collection(collectionName)
      .where(field, "==", uid)
      .orderBy(FieldPath.documentId())
      .limit(limit);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  }, QUERY_PAGE_LIMIT);
}

async function listSubcollectionDocuments(parentCollection: string, parentId: string, subcollectionName: string) {
  const db = getFirestore();
  return collectPaginatedRows<DocumentData>(async (cursor, limit) => {
    let query = db.collection(parentCollection)
      .doc(parentId)
      .collection(subcollectionName)
      .orderBy(FieldPath.documentId())
      .limit(limit);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
  }, QUERY_PAGE_LIMIT);
}

async function collectRevocationAcknowledgements(outboxRows: ExportRow[]) {
  return collectNestedRows({
    parents: outboxRows,
    concurrency: NESTED_QUERY_CONCURRENCY,
    loadChildren: (outbox) => listSubcollectionDocuments("consentRevocationOutbox", outbox.id, "acknowledgements"),
    mapChild: (outbox, row) => ({
      ...(scrubExportValue(row.data) as Record<string, unknown>),
      id: row.id,
      eventId: outbox.id,
      parentPath: `consentRevocationOutbox/${outbox.id}`
    })
  });
}

async function collectUserExport(uid: string) {
  const db = getFirestore();
  const collections: Record<string, Array<Record<string, unknown>>> = {};
  let recordCount = 0;

  for (const name of exportCollections) {
    if (name === "users") {
      const userDoc = await db.collection("users").doc(uid).get();
      const docs = userDoc.exists ? [{ id: userDoc.id, ...(scrubExportValue(userDoc.data() ?? {}) as Record<string, unknown>) }] : [];
      collections[name] = docs;
      recordCount += docs.length;
      continue;
    }

    const field = name === "auditLogs" || name === "adminActions" ? "targetUid" : "uid";
    const rows = await listScopedDocuments(name, field, uid);
    const docs = rows.map((row) => ({ id: row.id, ...(scrubExportValue(row.data) as Record<string, unknown>) }));
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

async function deleteExportArtifact(path: string) {
  await getStorage().bucket().file(path).delete({ ignoreNotFound: true });
}

export const processExportRequest = onCall({ timeoutSeconds: 540, memory: "1GiB" }, async (request) => {
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

    const status = String(job.status ?? "");
    if (status === "completed") {
      throw new HttpsError("failed-precondition", "Export job is already complete.");
    }
    if (status === "processing" && processingLeaseIsActive(job.processingLeaseExpiresAt)) {
      throw new HttpsError("failed-precondition", "Export job is already processing under an active lease.");
    }

    const requestRef = db.collection("privacyRequests").doc(requestId);
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists || requestSnap.data()?.uid !== uid || requestSnap.data()?.type !== "export") {
      throw new HttpsError("failed-precondition", "Export request linkage is invalid.");
    }

    tx.update(jobRef, {
      status: "processing",
      updatedAt: FieldValue.serverTimestamp(),
      processingBy: adminUid,
      processingLeaseExpiresAt: Timestamp.fromMillis(Date.now() + EXPORT_PROCESSING_LEASE_MS),
      processingAttempt: FieldValue.increment(1)
    });
    tx.update(requestRef, { status: "processing", updatedAt: FieldValue.serverTimestamp() });
    return { uid, requestId, requestRef };
  });

  const exportPath = `exports/${claim.uid}/${jobId}/export.json`;
  const manifestPath = `exports/${claim.uid}/${jobId}/manifest.json`;

  try {
    const exportData = await collectUserExport(claim.uid);
    const exportFile = await writeJson(exportPath, { uid: claim.uid, requestId: claim.requestId, jobId, generatedAt: new Date().toISOString(), data: exportData.collections });
    const manifestFile = await writeJson(manifestPath, {
      uid: claim.uid,
      requestId: claim.requestId,
      jobId,
      generatedAt: new Date().toISOString(),
      recordCount: exportData.recordCount,
      files: [exportFile],
      excludedFieldMarkers: [...sensitiveFieldMarkers]
    });

    await db.runTransaction(async (tx) => {
      const completedAt = Date.now();
      tx.update(jobRef, {
        status: "completed",
        complete: true,
        completedAt: FieldValue.serverTimestamp(),
        packageExpiresAt: Timestamp.fromMillis(completedAt + EXPORT_PACKAGE_TTL_MS),
        updatedAt: FieldValue.serverTimestamp(),
        processingBy: FieldValue.delete(),
        processingLeaseExpiresAt: FieldValue.delete(),
        exportManifestPath: manifestPath,
        exportPackagePath: exportPath,
        recordCount: exportData.recordCount,
        manifestSha256: manifestFile.sha256,
        exportSha256: exportFile.sha256,
        artifactCleanupStatus: FieldValue.delete(),
        artifactCleanupTargetCount: FieldValue.delete(),
        artifactCleanupFailureCount: FieldValue.delete(),
        artifactCleanupPendingPaths: FieldValue.delete()
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
    const cleanup = await removeExportArtifacts([exportPath, manifestPath], deleteExportArtifact);
    const cleanupStatus = cleanup.pendingPaths.length > 0 ? "incomplete" : "completed";

    await db.runTransaction(async (tx) => {
      tx.update(jobRef, {
        status: "failed",
        updatedAt: FieldValue.serverTimestamp(),
        processingBy: FieldValue.delete(),
        processingLeaseExpiresAt: FieldValue.delete(),
        exportManifestPath: manifestPath,
        exportPackagePath: exportPath,
        artifactCleanupStatus: cleanupStatus,
        artifactCleanupTargetCount: cleanup.targetCount,
        artifactCleanupFailureCount: cleanup.pendingPaths.length,
        artifactCleanupPendingPaths: cleanup.pendingPaths
      });
      tx.update(claim.requestRef, { status: "failed", updatedAt: FieldValue.serverTimestamp() });
    });
    const auditId = await writeAudit({
      actorUid: adminUid,
      actorRole: "admin",
      action: "export_processing_failed",
      targetUid: claim.uid,
      requestId: claim.requestId,
      source: "function",
      metadata: {
        jobId,
        error: error instanceof Error ? error.message : "unknown",
        artifactCleanupStatus: cleanupStatus,
        artifactCleanupTargetCount: cleanup.targetCount,
        artifactCleanupFailureCount: cleanup.pendingPaths.length
      }
    });
    throw new HttpsError("internal", "Export processing failed.", { auditId, artifactCleanupStatus: cleanupStatus });
  }
});
