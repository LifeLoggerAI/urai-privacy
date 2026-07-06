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

const processExportSchema = z.object({ jobId: z.string().trim().min(1).max(160) });

type RequestAuth = { uid?: string; token?: Record<string, unknown> };
type ClaimedExport = { uid: string; requestId: string };

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requireAdmin(auth?: RequestAuth) {
  const uid = auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  if (!(auth?.token?.admin === true || auth?.token?.role === "admin")) {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
  return uid;
}

function parseJobId(data: unknown) {
  const parsed = processExportSchema.safeParse(data ?? {});
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      parsed.error.issues.map((issue) => issue.message).join("; ")
    );
  }
  return parsed.data.jobId;
}

function stringField(value: unknown) {
  return typeof value === "string" ? value : "";
}

function exportRow(document: QueryDocumentSnapshot<DocumentData>) {
  const serialized = serializeForExport(document.data()) as Record<string, unknown>;
  return { id: document.id, ...serialized };
}

async function collectPaginated(baseQuery: Query<DocumentData>) {
  return collectAllPages<QueryDocumentSnapshot<DocumentData>, Record<string, unknown>>({
    fetchPage: async (cursor, pageSize) => {
      let pageQuery = baseQuery.orderBy(FieldPath.documentId()).limit(pageSize);
      if (cursor) pageQuery = pageQuery.startAfter(cursor);
      return (await pageQuery.get()).docs;
    },
    mapDocument: exportRow,
    pageSize: EXPORT_PAGE_SIZE
  });
}

async function collectCompleteExport(uid: string) {
  const collections: Record<string, Array<Record<string, unknown>>> = {};
  const user = await db.collection("users").doc(uid).get();
  collections.users = user.exists ? [exportRow(user)] : [];

  for (const source of EXPORT_SOURCES) {
    collections[source.collection] = await collectPaginated(
      db.collection(source.collection).where(source.field, "==", uid)
    );
  }

  const summary = summarizeExportCollections(collections);
  return { collections, ...summary };
}

async function writeJson(path: string, value: unknown) {
  const body = JSON.stringify(value, null, 2);
  const digest = sha256(body);
  await bucket.file(path).save(body, {
    resumable: false,
    contentType: "application/json",
    metadata: {
      cacheControl: "private, max-age=0, no-store",
      metadata: { sha256: digest, schemaVersion: EXPORT_SCHEMA_VERSION }
    }
  });
  return { path, sha256: digest, bytes: Buffer.byteLength(body, "utf8") };
}

async function claimExportJob(args: {
  jobId: string;
  adminUid: string;
}): Promise<ClaimedExport> {
  const jobRef = db.collection("exportJobs").doc(args.jobId);

  return db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef);
    if (!jobSnapshot.exists) throw new HttpsError("not-found", "Export job not found.");

    const job = jobSnapshot.data() ?? {};
    const uid = stringField(job.uid);
    const requestId = stringField(job.requestId);
    if (!uid || !requestId) {
      throw new HttpsError("failed-precondition", "Export job is missing uid or requestId.");
    }

    const status = stringField(job.status);
    if (status === "processing" || status === "completed") {
      throw new HttpsError("already-exists", "Export job is already processing or completed.");
    }

    const requestRef = db.collection("privacyRequests").doc(requestId);
    const requestSnapshot = await transaction.get(requestRef);
    if (!requestSnapshot.exists) {
      throw new HttpsError("failed-precondition", "Export request record is missing.");
    }

    const privacyRequest = requestSnapshot.data() ?? {};
    if (stringField(privacyRequest.uid) !== uid || privacyRequest.type !== "export") {
      throw new HttpsError("failed-precondition", "Export job and request do not match.");
    }
    if (["rejected", "completed"].includes(stringField(privacyRequest.status))) {
      throw new HttpsError("failed-precondition", "Export request cannot be processed.");
    }

    transaction.update(jobRef, {
      status: "processing",
      updatedAt: FieldValue.serverTimestamp(),
      processingStartedAt: FieldValue.serverTimestamp(),
      processingBy: args.adminUid,
      processingAttempt: FieldValue.increment(1),
      exportSchemaVersion: EXPORT_SCHEMA_VERSION
    });
    transaction.update(requestRef, {
      status: "processing",
      updatedAt: FieldValue.serverTimestamp()
    });

    return { uid, requestId };
  });
}

async function completeExport(args: {
  adminUid: string;
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
  const integrityHash = sha256(
    JSON.stringify({
      auditId: auditRef.id,
      actorUid: args.adminUid,
      targetUid: args.uid,
      requestId: args.requestId,
      metadata
    })
  );

  await db.runTransaction(async (transaction) => {
    transaction.update(jobRef, {
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
    transaction.update(requestRef, {
      status: "completed",
      updatedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
      exportSchemaVersion: EXPORT_SCHEMA_VERSION,
      recordCount: args.recordCount,
      complete: true
    });
    transaction.set(auditRef, {
      actorUid: args.adminUid,
      actorRole: "admin",
      targetUid: args.uid,
      requestId: args.requestId,
      action: "complete_export_processed",
      source: "function",
      timestamp: FieldValue.serverTimestamp(),
      metadata,
      integrityHash
    });
  });

  return auditRef.id;
}

async function failClaimedExport(args: {
  adminUid: string;
  uid: string;
  requestId: string;
  jobId: string;
  error: unknown;
}) {
  const jobRef = db.collection("exportJobs").doc(args.jobId);
  const requestRef = db.collection("privacyRequests").doc(args.requestId);
  const auditRef = db.collection("auditLogs").doc();
  const errorMessage = args.error instanceof Error ? args.error.message : "Unknown export error";
  const failureDetailHash = sha256(errorMessage);

  await db.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef);
    const requestSnapshot = await transaction.get(requestRef);
    const job = jobSnapshot.data() ?? {};

    if (
      jobSnapshot.exists &&
      job.status === "processing" &&
      job.processingBy === args.adminUid
    ) {
      transaction.update(jobRef, {
        status: "failed",
        updatedAt: FieldValue.serverTimestamp(),
        failedAt: FieldValue.serverTimestamp(),
        failureCode: "EXPORT_PROCESSING_FAILED",
        failureMessage: "Complete export processing failed.",
        failureDetailHash
      });
      if (requestSnapshot.exists) {
        transaction.update(requestRef, {
          status: "failed",
          updatedAt: FieldValue.serverTimestamp()
        });
      }
      transaction.set(auditRef, {
        actorUid: args.adminUid,
        actorRole: "admin",
        targetUid: args.uid,
        requestId: args.requestId,
        action: "complete_export_failed",
        source: "function",
        timestamp: FieldValue.serverTimestamp(),
        metadata: { jobId: args.jobId, failureDetailHash },
        integrityHash: sha256(
          JSON.stringify({
            auditId: auditRef.id,
            actorUid: args.adminUid,
            targetUid: args.uid,
            requestId: args.requestId,
            jobId: args.jobId,
            failureDetailHash
          })
        )
      });
    }
  });
}

export const processExportRequest = onCall(async (request) => {
  const adminUid = requireAdmin(request.auth);
  const jobId = parseJobId(request.data);
  const claimed = await claimExportJob({ jobId, adminUid });

  try {
    const exported = await collectCompleteExport(claimed.uid);
    const generatedAt = new Date().toISOString();
    const exportPath = `exports/${claimed.uid}/${jobId}/export.json`;
    const manifestPath = `exports/${claimed.uid}/${jobId}/manifest.json`;
    const exportFile = await writeJson(exportPath, {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      uid: claimed.uid,
      requestId: claimed.requestId,
      jobId,
      generatedAt,
      data: exported.collections
    });
    const manifestFile = await writeJson(manifestPath, {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      uid: claimed.uid,
      requestId: claimed.requestId,
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

    const auditId = await completeExport({
      adminUid,
      uid: claimed.uid,
      requestId: claimed.requestId,
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
  } catch (error) {
    await failClaimedExport({
      adminUid,
      uid: claimed.uid,
      requestId: claimed.requestId,
      jobId,
      error
    });
    throw error instanceof HttpsError
      ? error
      : new HttpsError("internal", "Complete export processing failed.");
  }
});
