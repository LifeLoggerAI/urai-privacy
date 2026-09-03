import { createHash, randomUUID } from "node:crypto";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import {
  FieldPath,
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentData,
  type QueryDocumentSnapshot
} from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  EXPORT_CLEANUP_MAX_PAGES,
  EXPORT_CLEANUP_PAGE_SIZE,
  EXPORT_DOWNLOAD_URL_TTL_MS,
  EXPORT_PACKAGE_TTL_MS,
  resolveExportPackageExpiry,
  timestampMillis,
  validExportObjectPath
} from "./export-lifecycle-contract";
import { removeExportArtifacts } from "./export-artifact-cleanup";

const app = getApps().length ? getApp() : initializeApp();
const db = getFirestore(app);
const bucket = getStorage(app).bucket();
const FAILED_ARTIFACT_CLEANUP_LEASE_MS = 15 * 60 * 1000;

const downloadSchema = z.object({
  jobId: z.string().trim().min(1).max(160),
  file: z.enum(["export", "manifest"]).default("export")
});

type RequestAuth = { uid?: string; token?: Record<string, unknown> };

function digest(value: unknown) {
  const serialized = JSON.stringify(value) ?? String(value);
  return createHash("sha256").update(serialized).digest("hex");
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function requireOwnerOrAdmin(auth: RequestAuth | undefined, ownerUid: string) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  const elevated = auth.token?.admin === true || auth.token?.role === "admin";
  if (auth.uid !== ownerUid && !elevated) {
    throw new HttpsError("permission-denied", "Owner or administrative access is required.");
  }
  return { actorUid: auth.uid, actorRole: auth.uid === ownerUid ? "user" : "admin" };
}

async function writeAudit(args: {
  actorUid: string;
  actorRole: string;
  action: string;
  targetUid: string;
  requestId: string;
  metadata: Record<string, unknown>;
}) {
  const ref = db.collection("auditLogs").doc();
  await ref.set({
    ...args,
    source: "function",
    timestamp: FieldValue.serverTimestamp(),
    integrityHash: digest({ auditId: ref.id, ...args })
  });
  return ref.id;
}

export const getExportDownloadUrl = onCall(async (request) => {
  const parsed = downloadSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      parsed.error.issues.map((issue) => issue.message).join("; ")
    );
  }

  const { jobId, file } = parsed.data;
  const jobRef = db.collection("exportJobs").doc(jobId);
  const jobSnap = await jobRef.get();
  if (!jobSnap.exists) throw new HttpsError("not-found", "Export job not found.");

  const job = jobSnap.data() ?? {};
  const uid = text(job.uid);
  const requestId = text(job.requestId);
  if (!uid || !requestId || job.status !== "completed" || job.complete !== true) {
    throw new HttpsError("failed-precondition", "Export package is not available.");
  }

  const actor = requireOwnerOrAdmin(request.auth, uid);
  const packageExpiresAt = resolveExportPackageExpiry(job);
  if (!packageExpiresAt) {
    throw new HttpsError("failed-precondition", "Export package expiry is unavailable.");
  }
  if (packageExpiresAt <= Date.now()) {
    throw new HttpsError("failed-precondition", "Export package has expired.");
  }

  const path = file === "manifest" ? job.exportManifestPath : job.exportPackagePath;
  if (!validExportObjectPath({ uid, jobId, path })) {
    throw new HttpsError("failed-precondition", "Export package path is invalid.");
  }

  const object = bucket.file(path as string);
  const [exists] = await object.exists();
  if (!exists) throw new HttpsError("not-found", "Export package file is missing.");

  const signedUrlExpiresAt = Math.min(
    Date.now() + EXPORT_DOWNLOAD_URL_TTL_MS,
    packageExpiresAt
  );
  const [url] = await object.getSignedUrl({ action: "read", expires: signedUrlExpiresAt });

  if (!job.packageExpiresAt) {
    await jobRef.update({ packageExpiresAt: Timestamp.fromMillis(packageExpiresAt) });
  }

  const auditId = await writeAudit({
    actorUid: actor.actorUid,
    actorRole: actor.actorRole,
    action: "export_download_url_created",
    targetUid: uid,
    requestId,
    metadata: { jobId, file, path, signedUrlExpiresAt, packageExpiresAt }
  });

  return {
    jobId,
    requestId,
    file,
    url,
    signedUrlExpiresAt,
    packageExpiresAt,
    expiresInSeconds: Math.max(0, Math.floor((signedUrlExpiresAt - Date.now()) / 1000)),
    auditId
  };
});

async function cleanupJob(document: QueryDocumentSnapshot<DocumentData>, now: number) {
  const job = document.data();
  const uid = text(job.uid);
  const requestId = text(job.requestId);
  const jobId = document.id;
  const packageExpiresAt = resolveExportPackageExpiry(job);
  if (!uid || !requestId || !packageExpiresAt || packageExpiresAt > now) return false;

  const paths = [job.exportPackagePath, job.exportManifestPath];
  if (!paths.every((path) => validExportObjectPath({ uid, jobId, path }))) {
    await document.ref.update({
      status: "cleanup_blocked",
      complete: false,
      cleanupStatus: "failed",
      cleanupUpdatedAt: FieldValue.serverTimestamp(),
      cleanupReason: "INVALID_EXPORT_PATH"
    });
    await writeAudit({
      actorUid: "system",
      actorRole: "system",
      action: "export_cleanup_failed",
      targetUid: uid,
      requestId,
      metadata: { jobId, reason: "INVALID_EXPORT_PATH" }
    });
    return false;
  }

  for (const path of paths as string[]) {
    await bucket.file(path).delete({ ignoreNotFound: true });
  }

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(document.ref);
    if (!fresh.exists || fresh.data()?.status !== "completed") return;
    tx.update(document.ref, {
      status: "expired",
      cleanupStatus: "completed",
      cleanupUpdatedAt: FieldValue.serverTimestamp(),
      packageDeletedAt: FieldValue.serverTimestamp(),
      packageExpiresAt: Timestamp.fromMillis(packageExpiresAt)
    });
  });

  await writeAudit({
    actorUid: "system",
    actorRole: "system",
    action: "export_package_expired_and_deleted",
    targetUid: uid,
    requestId,
    metadata: { jobId, packageExpiresAt, paths }
  });
  return true;
}

async function cleanupFailedJob(document: QueryDocumentSnapshot<DocumentData>) {
  const cleanupToken = randomUUID();
  const claim = await db.runTransaction(async (tx) => {
    const fresh = await tx.get(document.ref);
    if (!fresh.exists || fresh.data()?.status !== "failed" || fresh.data()?.artifactCleanupStatus !== "incomplete") return null;
    const job = fresh.data() ?? {};
    const uid = text(job.uid);
    const requestId = text(job.requestId);
    const pendingPaths = Array.isArray(job.artifactCleanupPendingPaths)
      ? job.artifactCleanupPendingPaths.filter((path): path is string => typeof path === "string")
      : [];
    if (!uid || !requestId || pendingPaths.length === 0 || !pendingPaths.every((path) => validExportObjectPath({ uid, jobId: document.id, path }))) {
      tx.update(document.ref, {
        artifactCleanupStatus: "blocked",
        artifactCleanupFailureCount: pendingPaths.length,
        artifactCleanupUpdatedAt: FieldValue.serverTimestamp()
      });
      return null;
    }
    tx.update(document.ref, {
      status: "artifact_cleanup",
      artifactCleanupStatus: "processing",
      artifactCleanupLeaseToken: cleanupToken,
      artifactCleanupLeaseExpiresAt: Timestamp.fromMillis(Date.now() + FAILED_ARTIFACT_CLEANUP_LEASE_MS),
      artifactCleanupUpdatedAt: FieldValue.serverTimestamp()
    });
    return {uid, requestId, pendingPaths};
  });
  if (!claim) return false;

  const cleanup = await removeExportArtifacts(claim.pendingPaths, async (path) => {
    await bucket.file(path).delete({ ignoreNotFound: true });
  });
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(document.ref);
    if (!fresh.exists || fresh.data()?.status !== "artifact_cleanup" || fresh.data()?.artifactCleanupLeaseToken !== cleanupToken) {
      throw new Error("failed export cleanup claim changed before completion");
    }
    tx.update(document.ref, {
      status: "failed",
      artifactCleanupStatus: cleanup.pendingPaths.length ? "incomplete" : "completed",
      artifactCleanupPendingPaths: cleanup.pendingPaths,
      artifactCleanupFailureCount: cleanup.pendingPaths.length,
      artifactCleanupUpdatedAt: FieldValue.serverTimestamp(),
      artifactCleanupLeaseToken: FieldValue.delete(),
      artifactCleanupLeaseExpiresAt: FieldValue.delete()
    });
  });
  await writeAudit({
    actorUid: "system",
    actorRole: "system",
    action: cleanup.pendingPaths.length ? "export_artifact_cleanup_retry_incomplete" : "export_artifact_cleanup_retry_completed",
    targetUid: claim.uid,
    requestId: claim.requestId,
    metadata: { jobId: document.id, targetCount: cleanup.targetCount, pendingCount: cleanup.pendingPaths.length }
  });
  return cleanup.pendingPaths.length === 0;
}

async function reclaimExpiredCleanupClaim(document: QueryDocumentSnapshot<DocumentData>, now: number) {
  return db.runTransaction(async (tx) => {
    const fresh = await tx.get(document.ref);
    if (!fresh.exists || fresh.data()?.status !== "artifact_cleanup" || fresh.data()?.artifactCleanupStatus !== "processing") return false;
    const expiry = fresh.data()?.artifactCleanupLeaseExpiresAt;
    const expiryMillis = expiry && typeof expiry.toMillis === "function" ? expiry.toMillis() : Number.NaN;
    if (Number.isFinite(expiryMillis) && expiryMillis > now) return false;
    tx.update(document.ref, {
      status: "failed",
      artifactCleanupStatus: "incomplete",
      artifactCleanupUpdatedAt: FieldValue.serverTimestamp(),
      artifactCleanupLeaseToken: FieldValue.delete(),
      artifactCleanupLeaseExpiresAt: FieldValue.delete()
    });
    return true;
  });
}

async function backfillLegacyExportPackageExpiry(now: number) {
  const cursorRef = db.collection("privacyMaintenance").doc("exportLifecycleLegacyMigration");
  const cursorSnap = await cursorRef.get();
  const lastDocumentId = text(cursorSnap.data()?.lastDocumentId);

  let query = db
    .collection("exportJobs")
    .where("status", "==", "completed")
    .orderBy(FieldPath.documentId())
    .limit(EXPORT_CLEANUP_PAGE_SIZE);
  if (lastDocumentId) query = query.startAfter(lastDocumentId);

  const page = await query.get();
  for (const document of page.docs) {
    const result = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(document.ref);
      const job = fresh.data() ?? {};
      if (!fresh.exists || job.status !== "completed" || job.packageExpiresAt) return null;

      const uid = text(job.uid);
      const requestId = text(job.requestId);
      const paths = [job.exportPackagePath, job.exportManifestPath];
      if (!uid || !requestId || !paths.every((path) => validExportObjectPath({ uid, jobId: document.id, path }))) {
        tx.update(document.ref, {
          status: "cleanup_blocked",
          complete: false,
          cleanupStatus: "failed",
          cleanupReason: "INVALID_LEGACY_EXPORT",
          cleanupUpdatedAt: FieldValue.serverTimestamp()
        });
        return uid && requestId
          ? { uid, requestId, action: "export_legacy_cleanup_blocked", expiry: null }
          : null;
      }

      const completedAt =
        timestampMillis(job.completedAt) ??
        timestampMillis(job.updatedAt) ??
        timestampMillis(job.createdAt) ??
        now;
      const expiry = completedAt + EXPORT_PACKAGE_TTL_MS;
      tx.update(document.ref, {
        complete: true,
        completedAt: Timestamp.fromMillis(completedAt),
        packageExpiresAt: Timestamp.fromMillis(expiry),
        lifecycleMigratedAt: FieldValue.serverTimestamp()
      });
      return { uid, requestId, action: "export_legacy_lifecycle_backfilled", expiry };
    });

    if (result) {
      await writeAudit({
        actorUid: "system",
        actorRole: "system",
        action: result.action,
        targetUid: result.uid,
        requestId: result.requestId,
        metadata: { jobId: document.id, packageExpiresAt: result.expiry }
      });
    }
  }

  const last = page.docs[page.docs.length - 1];
  await cursorRef.set({
    lastDocumentId: page.size === EXPORT_CLEANUP_PAGE_SIZE && last
      ? last.id
      : FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return page.size;
}

export const cleanupExpiredExportPackages = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "Etc/UTC",
    timeoutSeconds: 540,
    memory: "256MiB"
  },
  async () => {
    let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
    let scanned = 0;
    let deleted = 0;
    const now = Date.now();

    await backfillLegacyExportPackageExpiry(now);

    for (let pageNumber = 0; pageNumber < EXPORT_CLEANUP_MAX_PAGES; pageNumber += 1) {
      let query = db
        .collection("exportJobs")
        .where("status", "==", "completed")
        .where("packageExpiresAt", "<=", Timestamp.fromMillis(now))
        .orderBy("packageExpiresAt")
        .orderBy(FieldPath.documentId())
        .limit(EXPORT_CLEANUP_PAGE_SIZE);
      if (cursor) query = query.startAfter(cursor);

      const page = await query.get();
      if (page.empty) break;

      for (const document of page.docs) {
        scanned += 1;
        try {
          if (await cleanupJob(document, now)) deleted += 1;
        } catch (error) {
          const job = document.data();
          const uid = text(job.uid);
          const requestId = text(job.requestId);
          if (uid && requestId) {
            await writeAudit({
              actorUid: "system",
              actorRole: "system",
              action: "export_cleanup_failed",
              targetUid: uid,
              requestId,
              metadata: { jobId: document.id, reasonHash: digest(error) }
            }).catch(() => undefined);
          }
        }
      }

      cursor = page.docs[page.docs.length - 1] ?? null;
      if (page.size < EXPORT_CLEANUP_PAGE_SIZE) break;
    }

    cursor = null;
    for (let pageNumber = 0; pageNumber < EXPORT_CLEANUP_MAX_PAGES; pageNumber += 1) {
      let query = db.collection("exportJobs")
        .where("status", "==", "artifact_cleanup")
        .where("artifactCleanupStatus", "==", "processing")
        .orderBy(FieldPath.documentId())
        .limit(EXPORT_CLEANUP_PAGE_SIZE);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      if (page.empty) break;
      for (const document of page.docs) {
        try {
          await reclaimExpiredCleanupClaim(document, now);
        } catch (error) {
          console.error("Failed to reclaim expired export cleanup claim", { jobId: document.id, reasonHash: digest(error) });
        }
      }
      cursor = page.docs[page.docs.length - 1] ?? null;
      if (page.size < EXPORT_CLEANUP_PAGE_SIZE) break;
    }

    cursor = null;
    for (let pageNumber = 0; pageNumber < EXPORT_CLEANUP_MAX_PAGES; pageNumber += 1) {
      let query = db.collection("exportJobs")
        .where("status", "==", "failed")
        .where("artifactCleanupStatus", "==", "incomplete")
        .orderBy(FieldPath.documentId())
        .limit(EXPORT_CLEANUP_PAGE_SIZE);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      if (page.empty) break;
      for (const document of page.docs) {
        try {
          await cleanupFailedJob(document);
        } catch (error) {
          console.error("Failed export artifact cleanup retry", { jobId: document.id, reasonHash: digest(error) });
        }
      }
      cursor = page.docs[page.docs.length - 1] ?? null;
      if (page.size < EXPORT_CLEANUP_PAGE_SIZE) break;
    }

    void scanned;
    void deleted;
  }
);
