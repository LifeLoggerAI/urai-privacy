import { createHash, randomUUID } from "node:crypto";
import { FieldPath, FieldValue, getFirestore, Timestamp, type DocumentData } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import { removeExportArtifacts } from "./export-artifact-cleanup";
import { collectNestedRows, collectPaginatedRows } from "./export-pagination";
import { EXPORT_PACKAGE_TTL_MS } from "./export-lifecycle-contract";
import { exportAttemptPaths, exportPublicationBlockReason, ownsExportAttempt } from "./export-processing-authority";
import { evaluateConsentDecision } from "./consent-decision";

const exportCollections = [
  "users",
  "privacyRequests",
  "exportJobs",
  "exportArtifactAttempts",
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

const processExportSchema = z.object({ jobId: z.string().trim().min(1).max(160).regex(/^[^/]+$/) });

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
  try {
    const expiry = value.toMillis();
    return Number.isFinite(expiry) && expiry > nowMs;
  } catch {
    return false;
  }
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
  const token = randomUUID();
  const attemptRef = db.collection("exportArtifactAttempts").doc(token);

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
    if (status === "artifact_cleanup") {
      throw new HttpsError("failed-precondition", "Export artifacts are being cleaned up; retry after cleanup completes.");
    }
    if (status === "processing" && processingLeaseIsActive(job.processingLeaseExpiresAt)) {
      throw new HttpsError("failed-precondition", "Export job is already processing under an active lease.");
    }

    const requestRef = db.collection("privacyRequests").doc(requestId);
    const deletionFenceRef = db.collection("privacyDeletionTombstones").doc(uid);
    const consentRef = db.collection("consentRecords").doc(`${uid}_data_export`);
    const [requestSnap, deletionFence, consentSnap] = await Promise.all([
      tx.get(requestRef),
      tx.get(deletionFenceRef),
      tx.get(consentRef)
    ]);
    if (!requestSnap.exists || requestSnap.data()?.uid !== uid || requestSnap.data()?.type !== "export") {
      throw new HttpsError("failed-precondition", "Export request linkage is invalid.");
    }
    const consent = consentSnap.data() ?? {};
    const consentReceiptHash = consent.receiptHash;
    if (consent.uid !== uid || !/^[0-9a-f]{64}$/.test(String(consentReceiptHash ?? ""))
      || !evaluateConsentDecision({ purpose: "data.export", record: consent }).allowed) {
      throw new HttpsError("failed-precondition", "Current export consent is required before processing.");
    }
    if (deletionFence.data()?.active === true) {
      throw new HttpsError("failed-precondition", "Account deletion is fenced; export processing is blocked.");
    }
    if (
      deletionFence.data()?.exportProcessingJobId !== jobId &&
      processingLeaseIsActive(deletionFence.data()?.exportProcessingLeaseExpiresAt)
    ) {
      throw new HttpsError("failed-precondition", "Another export is processing for this account.");
    }

    const { exportPath, manifestPath } = exportAttemptPaths(uid, jobId, token);
    const processingLeaseExpiresAt = Timestamp.fromMillis(Date.now() + EXPORT_PROCESSING_LEASE_MS);
    tx.set(deletionFenceRef, {
      uid,
      exportProcessingJobId: jobId,
      exportProcessingLeaseToken: token,
      exportProcessingLeaseExpiresAt: processingLeaseExpiresAt,
      exportProcessingBy: adminUid,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.update(jobRef, {
      status: "processing",
      complete: false,
      updatedAt: FieldValue.serverTimestamp(),
      processingBy: adminUid,
      processingLeaseToken: token,
      processingLeaseExpiresAt,
      processingAttempt: FieldValue.increment(1),
      artifactCleanupLeaseToken: FieldValue.delete(),
      artifactCleanupLeaseExpiresAt: FieldValue.delete()
    });
    tx.create(attemptRef, {
      uid, jobId, requestId, token,
      consentReceiptHash,
      status: "processing",
      paths: [exportPath, manifestPath],
      cleanupDueAt: processingLeaseExpiresAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.update(requestRef, { status: "processing", updatedAt: FieldValue.serverTimestamp() });
    return { uid, requestId, requestRef, exportPath, manifestPath, consentRef, consentReceiptHash };
  });

  const { exportPath, manifestPath } = claim;
  const authority = { uid: claim.uid, jobId, requestId: claim.requestId, actorUid: adminUid, token };

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

    const auditRef = db.collection("auditLogs").doc();
    await db.runTransaction(async (tx) => {
      const deletionFenceRef = db.collection("privacyDeletionTombstones").doc(claim.uid);
      const [jobSnap, deletionFence, attemptSnap, requestSnap, consentSnap] = await Promise.all([
        tx.get(jobRef), tx.get(deletionFenceRef), tx.get(attemptRef), tx.get(claim.requestRef), tx.get(claim.consentRef)
      ]);
      const blocked = exportPublicationBlockReason({
        job: jobSnap.data() ?? {}, fence: deletionFence.data() ?? {},
        attempt: attemptSnap.data() ?? {}, request: requestSnap.data() ?? {},
        authority, nowMillis: Date.now()
      });
      if (blocked) {
        throw new HttpsError("aborted", "Export processing lost its deletion-fence lease before publication.");
      }
      const consent = consentSnap.data() ?? {};
      if (consent.uid !== claim.uid || consent.receiptHash !== claim.consentReceiptHash
        || !evaluateConsentDecision({ purpose: "data.export", record: consent }).allowed) {
        throw new HttpsError("aborted", "Export consent changed before publication.");
      }
      const completedAt = Date.now();
      tx.update(jobRef, {
        status: "completed",
        complete: true,
        completedAt: FieldValue.serverTimestamp(),
        packageExpiresAt: Timestamp.fromMillis(completedAt + EXPORT_PACKAGE_TTL_MS),
        updatedAt: FieldValue.serverTimestamp(),
        processingBy: FieldValue.delete(),
        processingLeaseToken: FieldValue.delete(),
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
      tx.set(deletionFenceRef, {
        exportProcessingJobId: FieldValue.delete(),
        exportProcessingLeaseToken: FieldValue.delete(),
        exportProcessingLeaseExpiresAt: FieldValue.delete(),
        exportProcessingBy: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      tx.update(attemptRef, {
        status: "completed",
        cleanupDueAt: Timestamp.fromMillis(completedAt + EXPORT_PACKAGE_TTL_MS),
        updatedAt: FieldValue.serverTimestamp()
      });
      const audit = {
        actorUid: adminUid, actorRole: "admin", action: "export_processed",
        targetUid: claim.uid, requestId: claim.requestId, source: "function",
        metadata: { jobId, attemptToken: token, recordCount: exportData.recordCount }
      };
      tx.create(auditRef, {
        ...audit, timestamp: FieldValue.serverTimestamp(), integrityHash: sha256({ ...audit, id: auditRef.id })
      });
    });
    return { jobId, status: "completed", auditId: auditRef.id, manifestPath, exportPath, recordCount: exportData.recordCount };
  } catch (error) {
    // Serialize cleanup against publication even when the publication RPC outcome
    // is uncertain. The ledger write invalidates any older publication transaction.
    const cleanupToken = randomUUID();
    const cleanupClaim = await db.runTransaction(async (tx) => {
      const [attemptSnap, jobSnap] = await Promise.all([tx.get(attemptRef), tx.get(jobRef)]);
      if (attemptSnap.data()?.status === "completed") return false;
      if (!attemptSnap.exists) return true; // Removed subject data cannot be republished.
      if (attemptSnap.data()?.token !== token || attemptSnap.data()?.uid !== claim.uid
        || attemptSnap.data()?.jobId !== jobId || attemptSnap.data()?.requestId !== claim.requestId) {
        throw new HttpsError("aborted", "Export cleanup authority changed.");
      }
      if (processingLeaseIsActive(attemptSnap.data()?.cleanupLeaseExpiresAt)) {
        throw new HttpsError("aborted", "Another worker owns export cleanup.");
      }
      const cleanupLeaseExpiresAt = Timestamp.fromMillis(Date.now() + EXPORT_PROCESSING_LEASE_MS);
      tx.update(attemptRef, {
        status: "artifact_cleanup", cleanupLeaseToken: cleanupToken,
        cleanupLeaseExpiresAt, cleanupDueAt: Timestamp.fromMillis(Date.now()),
        updatedAt: FieldValue.serverTimestamp()
      });
      if (ownsExportAttempt(jobSnap.data() ?? {}, authority)) {
        tx.update(jobRef, {
          status: "artifact_cleanup", complete: false,
          artifactCleanupStatus: "processing", artifactCleanupPendingPaths: [exportPath, manifestPath],
          artifactCleanupLeaseToken: cleanupToken, artifactCleanupLeaseExpiresAt: cleanupLeaseExpiresAt,
          updatedAt: FieldValue.serverTimestamp()
        });
      }
      return true;
    }).catch(() => {
      // No cleanup runs without committed ownership; maintenance can recover later.
      throw new HttpsError("unavailable", "Export outcome is unavailable; retry the job status later.");
    });
    if (!cleanupClaim) {
      throw new HttpsError("unavailable", "Export publication completed; retry the job status later.");
    }
    const cleanup = await removeExportArtifacts([exportPath, manifestPath], deleteExportArtifact);
    const cleanupStatus = cleanup.pendingPaths.length > 0 ? "incomplete" : "completed";

    const auditRef = db.collection("auditLogs").doc();
    await db.runTransaction(async (tx) => {
      const deletionFenceRef = db.collection("privacyDeletionTombstones").doc(claim.uid);
      const [jobSnap, deletionFence, attemptSnap] = await Promise.all([
        tx.get(jobRef), tx.get(deletionFenceRef), tx.get(attemptRef)
      ]);
      if (!attemptSnap.exists || attemptSnap.data()?.status !== "artifact_cleanup"
        || attemptSnap.data()?.cleanupLeaseToken !== cleanupToken) return;
      tx.update(attemptRef, {
        status: cleanup.pendingPaths.length ? "cleanup_pending" : "cleaned",
        paths: cleanup.pendingPaths,
        cleanupDueAt: Timestamp.fromMillis(Date.now()),
        cleanupFailureCount: cleanup.pendingPaths.length,
        cleanupLeaseToken: FieldValue.delete(), cleanupLeaseExpiresAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });
      const job = jobSnap.data() ?? {};
      const ownsJob = job.uid === claim.uid && job.requestId === claim.requestId
        && job.status === "artifact_cleanup" && job.processingLeaseToken === token
        && job.artifactCleanupLeaseToken === cleanupToken;
      if (ownsJob) tx.update(jobRef, {
        status: "failed",
        complete: false,
        updatedAt: FieldValue.serverTimestamp(),
        processingBy: FieldValue.delete(),
        processingLeaseToken: FieldValue.delete(),
        processingLeaseExpiresAt: FieldValue.delete(),
        exportManifestPath: manifestPath,
        exportPackagePath: exportPath,
        artifactCleanupStatus: cleanupStatus,
        artifactCleanupTargetCount: cleanup.targetCount,
        artifactCleanupFailureCount: cleanup.pendingPaths.length,
        artifactCleanupPendingPaths: cleanup.pendingPaths,
        artifactCleanupLeaseToken: FieldValue.delete(),
        artifactCleanupLeaseExpiresAt: FieldValue.delete()
      });
      if (ownsJob) tx.update(claim.requestRef, { status: "failed", updatedAt: FieldValue.serverTimestamp() });
      if (deletionFence.data()?.exportProcessingJobId === jobId && deletionFence.data()?.exportProcessingLeaseToken === token) {
        tx.set(deletionFenceRef, {
          exportProcessingJobId: FieldValue.delete(),
          exportProcessingLeaseToken: FieldValue.delete(),
          exportProcessingLeaseExpiresAt: FieldValue.delete(),
          exportProcessingBy: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
      }
      const audit = {
        actorUid: adminUid, actorRole: "admin", action: "export_processing_failed",
        targetUid: claim.uid, requestId: claim.requestId, source: "function",
        metadata: {
          jobId, attemptToken: token, reasonHash: sha256(error instanceof Error ? error.message : "unknown"),
          artifactCleanupStatus: cleanupStatus, artifactCleanupTargetCount: cleanup.targetCount,
          artifactCleanupFailureCount: cleanup.pendingPaths.length, superseded: !ownsJob
        }
      };
      tx.create(auditRef, {
        ...audit, timestamp: FieldValue.serverTimestamp(), integrityHash: sha256({ ...audit, id: auditRef.id })
      });
    }).catch(() => {
      // The claim ledger survives audit/Firestore outages and is retried by maintenance.
      throw new HttpsError("unavailable", "Export failure recovery is pending; retry the job status later.");
    });
    throw new HttpsError("internal", "Export processing failed.", { auditId: auditRef.id, artifactCleanupStatus: cleanupStatus });
  }
});
