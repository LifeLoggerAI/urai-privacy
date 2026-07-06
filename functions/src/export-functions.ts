import { createHash } from "node:crypto";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldPath,
  FieldValue,
  getFirestore,
  type DocumentData,
  type Query
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

const app = getApps().length ? getApp() : initializeApp();
const db = getFirestore(app);
const bucket = getStorage(app).bucket();

const PAGE_SIZE = 500;
const EXPORT_SCHEMA_VERSION = "1.0.0";
const redactedFields = new Set([
  "password",
  "token",
  "secret",
  "apiKey",
  "privateKey",
  "refreshToken",
  "idToken"
]);

const exportSources = [
  { collection: "privacyRequests", field: "uid" },
  { collection: "exportJobs", field: "uid" },
  { collection: "deletionRequests", field: "uid" },
  { collection: "consentRecords", field: "uid" },
  { collection: "consentEvents", field: "uid" },
  { collection: "consentDecisions", field: "uid" },
  { collection: "dataAccessEvents", field: "uid" },
  { collection: "auditLogs", field: "targetUid" },
  { collection: "adminActions", field: "targetUid" },
  { collection: "legalHoldRecords", field: "uid" }
] as const;

const processExportSchema = z.object({ jobId: z.string().trim().min(1).max(160) });

type RequestAuth = { uid?: string; token?: Record<string, unknown> };

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

function scrub(value: DocumentData): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !redactedFields.has(key))
      .map(([key, item]) => {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          if (typeof item.toDate === "function") return [key, item.toDate().toISOString()];
          return [key, scrub(item)];
        }
        if (Array.isArray(item)) {
          return [
            key,
            item.map((entry) =>
              entry && typeof entry === "object" && typeof entry.toDate === "function"
                ? entry.toDate().toISOString()
                : entry
            )
          ];
        }
        return [key, item];
      })
  );
}

async function collectPaginated(baseQuery: Query): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let pageQuery = baseQuery.orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const page = await pageQuery.get();
    if (page.empty) break;
    for (const document of page.docs) {
      rows.push({ id: document.id, ...scrub(document.data()) });
    }
    cursor = page.docs[page.docs.length - 1] ?? null;
    if (page.size < PAGE_SIZE) break;
  }

  return rows;
}

async function collectCompleteExport(uid: string) {
  const collections: Record<string, Array<Record<string, unknown>>> = {};
  const user = await db.collection("users").doc(uid).get();
  collections.users = user.exists ? [{ id: user.id, ...scrub(user.data() ?? {}) }] : [];

  for (const source of exportSources) {
    collections[source.collection] = await collectPaginated(
      db.collection(source.collection).where(source.field, "==", uid)
    );
  }

  const counts = Object.fromEntries(
    Object.entries(collections).map(([name, rows]) => [name, rows.length])
  );
  const recordCount = Object.values(counts).reduce((total, count) => total + count, 0);
  return { collections, counts, recordCount };
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

async function writeAudit(args: {
  actorUid: string;
  targetUid: string;
  requestId: string;
  metadata: Record<string, unknown>;
}) {
  const ref = db.collection("auditLogs").doc();
  const integrityHash = sha256(JSON.stringify({ ...args, auditId: ref.id }));
  await ref.set({
    ...args,
    actorRole: "admin",
    action: "complete_export_processed",
    source: "function",
    timestamp: FieldValue.serverTimestamp(),
    integrityHash
  });
  return ref.id;
}

export const processExportRequest = onCall(async (request) => {
  const adminUid = requireAdmin(request.auth);
  const jobId = parseJobId(request.data);
  const jobRef = db.collection("exportJobs").doc(jobId);
  const jobSnapshot = await jobRef.get();
  if (!jobSnapshot.exists) throw new HttpsError("not-found", "Export job not found.");

  const job = jobSnapshot.data() ?? {};
  const uid = typeof job.uid === "string" ? job.uid : "";
  const requestId = typeof job.requestId === "string" ? job.requestId : "";
  if (!uid || !requestId) {
    throw new HttpsError("failed-precondition", "Export job is missing uid or requestId.");
  }
  if (["processing", "completed"].includes(String(job.status))) {
    throw new HttpsError("already-exists", "Export job is already processing or completed.");
  }

  await jobRef.update({
    status: "processing",
    updatedAt: FieldValue.serverTimestamp(),
    exportSchemaVersion: EXPORT_SCHEMA_VERSION
  });

  try {
    const exported = await collectCompleteExport(uid);
    const generatedAt = new Date().toISOString();
    const exportPath = `exports/${uid}/${jobId}/export.json`;
    const manifestPath = `exports/${uid}/${jobId}/manifest.json`;
    const exportFile = await writeJson(exportPath, {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      uid,
      requestId,
      jobId,
      generatedAt,
      data: exported.collections
    });
    const manifestFile = await writeJson(manifestPath, {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      uid,
      requestId,
      jobId,
      generatedAt,
      complete: true,
      paginationPageSize: PAGE_SIZE,
      recordCount: exported.recordCount,
      collectionCounts: exported.counts,
      includedCollections: ["users", ...exportSources.map((source) => source.collection)],
      excludedFields: [...redactedFields],
      files: [exportFile]
    });

    await db.runTransaction(async (transaction) => {
      transaction.update(jobRef, {
        status: "completed",
        updatedAt: FieldValue.serverTimestamp(),
        exportSchemaVersion: EXPORT_SCHEMA_VERSION,
        exportManifestPath: manifestPath,
        exportPackagePath: exportPath,
        recordCount: exported.recordCount,
        collectionCounts: exported.counts,
        complete: true,
        manifestSha256: manifestFile.sha256,
        exportSha256: exportFile.sha256
      });
      transaction.update(db.collection("privacyRequests").doc(requestId), {
        status: "completed",
        updatedAt: FieldValue.serverTimestamp(),
        exportSchemaVersion: EXPORT_SCHEMA_VERSION,
        recordCount: exported.recordCount,
        complete: true
      });
    });

    const auditId = await writeAudit({
      actorUid: adminUid,
      targetUid: uid,
      requestId,
      metadata: {
        jobId,
        exportSchemaVersion: EXPORT_SCHEMA_VERSION,
        recordCount: exported.recordCount,
        collectionCounts: exported.counts,
        manifestPath,
        exportPath,
        manifestSha256: manifestFile.sha256,
        exportSha256: exportFile.sha256
      }
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
      collectionCounts: exported.counts
    };
  } catch (error) {
    await jobRef.update({
      status: "failed",
      updatedAt: FieldValue.serverTimestamp(),
      failureCode: "EXPORT_PROCESSING_FAILED",
      failureMessage: error instanceof Error ? error.message.slice(0, 500) : "Export failed"
    });
    throw error instanceof HttpsError
      ? error
      : new HttpsError("internal", "Complete export processing failed.");
  }
});
