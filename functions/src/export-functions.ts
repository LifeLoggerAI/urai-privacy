import { createHash } from "node:crypto";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldPath,
  FieldValue,
  getFirestore,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  blockedExportFields,
  collectAllPages,
  EXPORT_PAGE_SIZE,
  EXPORT_SCHEMA_VERSION,
  EXPORT_SOURCES,
  serializeForExport,
  summarizeExportCollections
} from "./export-contract";

const app = getApps().length ? getApp() : initializeApp();
const db = getFirestore(app);
const bucket = getStorage(app).bucket();
const inputSchema = z.object({ jobId: z.string().trim().min(1).max(160) });

type RequestAuth = { uid?: string; token?: Record<string, unknown> };
type ExportClaim = { uid: string; requestId: string };
type ExportDoc = { id: string; data: () => DocumentData | undefined };

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function requireOperator(auth?: RequestAuth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  if (!(auth.token?.admin === true || auth.token?.role === "admin")) {
    throw new HttpsError("permission-denied", "Administrative access is required.");
  }
  return auth.uid;
}

function parseJobId(value: unknown) {
  const result = inputSchema.safeParse(value ?? {});
  if (!result.success) {
    throw new HttpsError(
      "invalid-argument",
      result.error.issues.map((issue) => issue.message).join("; ")
    );
  }
  return result.data.jobId;
}

function row(document: ExportDoc) {
  const value = serializeForExport(document.data() ?? {}) as Record<string, unknown>;
  return { id: document.id, ...value };
}

async function paged(query: Query<DocumentData>) {
  return collectAllPages<QueryDocumentSnapshot<DocumentData>, Record<string, unknown>>({
    pageSize: EXPORT_PAGE_SIZE,
    mapDocument: row,
    fetchPage: async (cursor, pageSize) => {
      let next = query.orderBy(FieldPath.documentId()).limit(pageSize);
      if (cursor) next = next.startAfter(cursor);
      return (await next.get()).docs;
    }
  });
}

async function collect(uid: string) {
  const collections: Record<string, Array<Record<string, unknown>>> = {};
  const user = await db.collection("users").doc(uid).get();
  collections.users = user.exists ? [row(user)] : [];

  for (const source of EXPORT_SOURCES) {
    collections[source.collection] = await paged(
      db.collection(source.collection).where(source.field, "==", uid)
    );
  }

  return { collections, ...summarizeExportCollections(collections) };
}

async function saveJson(path: string, value: unknown) {
  const body = JSON.stringify(value, null, 2);
  const sha256 = hash(body);
  await bucket.file(path).save(body, {
    resumable: false,
    contentType: "application/json",
    metadata: {
      cacheControl: "private, max-age=0, no-store",
      metadata: { sha256, schemaVersion: EXPORT_SCHEMA_VERSION }
    }
  });
  return { path, sha256, bytes: Buffer.byteLength(body, "utf8") };
}

async function claim(jobId: string, operatorUid: string): Promise<ExportClaim> {
  const jobRef = db.collection("exportJobs").doc(jobId);
  return db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    if (!jobSnap.exists) throw new HttpsError("not-found", "Export job not found.");

    const job = jobSnap.data() ?? {};
    const uid = text(job.uid);
    const requestId = text(job.requestId);
    if (!uid || !requestId) {
      throw new HttpsError("failed-precondition", "Export job is incomplete.");
    }
    if (["processing", "completed"].includes(text(job.status))) {
      throw new HttpsError("already-exists", "Export job is already active or complete.");
    }

    const requestRef = db.collection("privacyRequests").doc(requestId);
    const requestSnap = await tx.get(requestRef);
    const requestData = requestSnap.data() ?? {};
    if (
      !requestSnap.exists ||
      requestData.uid !== uid ||
      requestData.type !== "export" ||
      ["rejected", "completed"].includes(text(requestData.status))
    ) {
      throw new HttpsError("failed-precondition", "Export request is not processable.");
    }

    tx.update(jobRef, {
      status: "processing",
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.serverTimestamp(),
      processingBy: operatorUid,
      processingAttempt: FieldValue.increment(1),
      exportSchemaVersion: EXPORT_SCHEMA_VERSION
    });
    tx.update(requestRef, {
      status: "processing",
      updatedAt: FieldValue.serverTimestamp()
    });
    return { uid, requestId };
  });
}

async function finish(args: {
  operatorUid: string;
  uid: string;
  requestId: string;
  jobId: string;
  manifestPath: string;
  exportPath: string;
  manifestSha256: string;
  exportSha256: string;
  recordCount: number;
  collectionCounts: Record<string, number>;
}) {
  const jobRef = db.collection("exportJobs").doc(args.jobId);
  const requestRef = db.collection("privacyRequests").doc(args.requestId);
  const auditRef = db.collection("auditLogs").doc();
  const metadata = {
    jobId: args.jobId,
    exportSchemaVersion: EXPORT_SCHEMA_VERSION,
    recordCount: args.recordCount,
    collectionCounts: args.collectionCounts,
    manifestPath: args.manifestPath,
    exportPath: args.exportPath,
    manifestSha256: args.manifestSha256,
    exportSha256: args.exportSha256
  };

  await db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    const requestSnap = await tx.get(requestRef);
    const job = jobSnap.data() ?? {};
    const requestData = requestSnap.data() ?? {};
    if (
      !jobSnap.exists ||
      !requestSnap.exists ||
      job.status !== "processing" ||
      job.processingBy !== args.operatorUid ||
      job.uid !== args.uid ||
      job.requestId !== args.requestId ||
      requestData.status !== "processing" ||
      requestData.uid !== args.uid ||
      requestData.type !== "export"
    ) {
      throw new HttpsError("failed-precondition", "Export claim changed before completion.");
    }

    tx.update(jobRef, {
      status: "completed",
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
      exportSchemaVersion: EXPORT_SCHEMA_VERSION,
      exportManifestPath: args.manifestPath,
      exportPackagePath: args.exportPath,
      recordCount: args.recordCount,
      collectionCounts: args.collectionCounts,
      complete: true,
      manifestSha256: args.manifestSha256,
      exportSha256: args.exportSha256
    });
    tx.update(requestRef, {
      status: "completed",
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
      exportSchemaVersion: EXPORT_SCHEMA_VERSION,
      recordCount: args.recordCount,
      complete: true
    });
    tx.set(auditRef, {
      actorUid: args.operatorUid,
      actorRole: "admin",
      targetUid: args.uid,
      requestId: args.requestId,
      action: "complete_export_processed",
      source: "function",
      timestamp: FieldValue.serverTimestamp(),
      metadata,
      integrityHash: hash(JSON.stringify({ auditId: auditRef.id, ...metadata }))
    });
  });

  return auditRef.id;
}

async function markFailed(args: {
  operatorUid: string;
  uid: string;
  requestId: string;
  jobId: string;
  reason: unknown;
}) {
  const jobRef = db.collection("exportJobs").doc(args.jobId);
  const requestRef = db.collection("privacyRequests").doc(args.requestId);
  const reasonHash = hash(args.reason instanceof Error ? args.reason.message : "unknown");

  await db.runTransaction(async (tx) => {
    const jobSnap = await tx.get(jobRef);
    const requestSnap = await tx.get(requestRef);
    const job = jobSnap.data() ?? {};
    if (jobSnap.exists && job.status === "processing" && job.processingBy === args.operatorUid) {
      tx.update(jobRef, {
        status: "failed",
        updatedAt: FieldValue.serverTimestamp(),
        failedAt: FieldValue.serverTimestamp(),
        failureCode: "EXPORT_PROCESSING_FAILED",
        failureMessage: "Complete export processing failed.",
        failureDetailHash: reasonHash
      });
      if (requestSnap.exists) {
        tx.update(requestRef, { status: "failed", updatedAt: FieldValue.serverTimestamp() });
      }
    }
  });
}

export const processExportRequest = onCall(async (request) => {
  const operatorUid = requireOperator(request.auth);
  const jobId = parseJobId(request.data);
  const active = await claim(jobId, operatorUid);

  try {
    const exported = await collect(active.uid);
    const generatedAt = new Date().toISOString();
    const exportPath = `exports/${active.uid}/${jobId}/export.json`;
    const manifestPath = `exports/${active.uid}/${jobId}/manifest.json`;
    const exportFile = await saveJson(exportPath, {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      uid: active.uid,
      requestId: active.requestId,
      jobId,
      generatedAt,
      data: exported.collections
    });
    const manifestFile = await saveJson(manifestPath, {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      uid: active.uid,
      requestId: active.requestId,
      jobId,
      generatedAt,
      complete: true,
      paginationPageSize: EXPORT_PAGE_SIZE,
      recordCount: exported.recordCount,
      collectionCounts: exported.collectionCounts,
      includedCollections: ["users", ...EXPORT_SOURCES.map((source) => source.collection)],
      excludedFieldNamesNormalized: blockedExportFields(),
      files: [exportFile]
    });

    const auditId = await finish({
      operatorUid,
      uid: active.uid,
      requestId: active.requestId,
      jobId,
      manifestPath,
      exportPath,
      manifestSha256: manifestFile.sha256,
      exportSha256: exportFile.sha256,
      recordCount: exported.recordCount,
      collectionCounts: exported.collectionCounts
    });

    return {
      jobId,
      status: "completed",
      complete: true,
      exportSchemaVersion: EXPORT_SCHEMA_VERSION,
      auditId,
      manifestPath,
      exportPath,
      recordCount: exported.recordCount,
      collectionCounts: exported.collectionCounts
    };
  } catch (reason) {
    await markFailed({
      operatorUid,
      uid: active.uid,
      requestId: active.requestId,
      jobId,
      reason
    }).catch(() => undefined);
    throw reason instanceof HttpsError
      ? reason
      : new HttpsError("internal", "Complete export processing failed.");
  }
});
