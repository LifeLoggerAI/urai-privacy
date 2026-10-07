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
import { getAuth } from "firebase-admin/auth";
import { pipeline } from "node:stream/promises";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
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
import { cleanupExportArtifactAttempts } from "./export-attempt-maintenance";
import { evaluateConsentDecision, CONSENT_DECISION_POLICY_VERSION } from "./consent-decision";

const app = getApps().length ? getApp() : initializeApp();
const db = getFirestore(app);
const bucket = getStorage(app).bucket();
const FAILED_ARTIFACT_CLEANUP_LEASE_MS = 15 * 60 * 1000;

const downloadSchema = z.object({
  jobId: z.string().trim().min(1).max(160).regex(/^[^/]+$/),
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

async function readExportDownloadAuthority(transaction: FirebaseFirestore.Transaction, auth: RequestAuth | undefined, jobId: string, file: "export" | "manifest") {
  const jobRef = db.collection("exportJobs").doc(jobId);
  const jobSnap = await transaction.get(jobRef);
  if (!jobSnap.exists) throw new HttpsError("not-found", "Export job not found.");
  const job = jobSnap.data() ?? {};
  const uid = text(job.uid);
  const requestId = text(job.requestId);
  if (!uid || !requestId || job.status !== "completed" || job.complete !== true) {
    throw new HttpsError("failed-precondition", "Export package is not available.");
  }
  const actor = requireOwnerOrAdmin(auth, uid);
  const [consentSnap, fenceSnap, requestSnap] = await Promise.all([
    transaction.get(db.collection("consentRecords").doc(`${uid}_data_export`)),
    transaction.get(db.collection("privacyDeletionTombstones").doc(uid)),
    transaction.get(db.collection("privacyRequests").doc(requestId))
  ]);
  const consent = consentSnap.data() ?? {};
  const fence = fenceSnap.data() ?? {};
  const consentExpiresAt = timestampMillis(consent.expiresAt);
  const packageExpiresAt = resolveExportPackageExpiry(job);
  const now = Date.now();
  if (fence.active === true || fence.uid !== uid
    || requestSnap.data()?.uid !== uid || requestSnap.data()?.type !== "export" || requestSnap.data()?.status !== "completed"
    || consent.uid !== uid || !evaluateConsentDecision({ purpose: "data.export", record: consent }).allowed
    || !/^[0-9a-f]{64}$/.test(text(job.consentReceiptHash)) || consent.receiptHash !== job.consentReceiptHash
    || consentExpiresAt === null || consentExpiresAt !== timestampMillis(job.exportConsentExpiresAt)
    || fence.exportConsentStatus !== "granted" || fence.exportConsentReceiptHash !== job.consentReceiptHash
    || fence.exportConsentPolicyVersion !== CONSENT_DECISION_POLICY_VERSION
    || timestampMillis(fence.exportConsentExpiresAt) !== consentExpiresAt
    || packageExpiresAt === null || packageExpiresAt <= now) {
    throw new HttpsError("failed-precondition", "Current export authority is unavailable. Create a new export after granting current consent.");
  }
  const path = file === "manifest" ? job.exportManifestPath : job.exportPackagePath;
  if (!validExportObjectPath({ uid, jobId, path })) {
    throw new HttpsError("failed-precondition", "Export package path is invalid.");
  }
  const identityHash = digest({ uid, requestId, path, file, packageExpiresAt, consentExpiresAt,
    receiptHash: job.consentReceiptHash, exportHash: job.exportSha256 ?? null, manifestHash: job.manifestSha256 ?? null });
  return { uid, requestId, path: path as string, actor, packageExpiresAt, consentExpiresAt, identityHash };
}

function exportDownloadEndpoint(rawHost: string | undefined) {
  const projectId = app.options.projectId ?? process.env.GCLOUD_PROJECT;
  if (!projectId || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)) {
    throw new HttpsError("failed-precondition", "The current Firebase project is unavailable.");
  }
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    if (!rawHost || !/^(?:localhost|127\.0\.0\.1):[0-9]{2,5}$/.test(rawHost)) {
      throw new HttpsError("failed-precondition", "The current Functions emulator endpoint is unavailable.");
    }
    return `http://${rawHost}/${projectId}/us-central1/downloadExportPackage`;
  }
  return `https://us-central1-${projectId}.cloudfunctions.net/downloadExportPackage`;
}

export const getExportDownloadUrl = onCall(async (request) => {
  const parsed = downloadSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", "A valid export job and file are required.");
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  const { jobId, file } = parsed.data;
  const authority = await db.runTransaction((transaction) => readExportDownloadAuthority(transaction, request.auth, jobId, file));
  const { uid, requestId, path, packageExpiresAt, consentExpiresAt } = authority;
  const [exists] = await bucket.file(path).exists();
  if (!exists) throw new HttpsError("not-found", "Export package file is missing.");
  const downloadExpiresAt = Math.min(Date.now() + EXPORT_DOWNLOAD_URL_TTL_MS, packageExpiresAt, consentExpiresAt);
  const url = new URL(exportDownloadEndpoint(request.rawRequest?.get("host")));
  url.searchParams.set("jobId", jobId);
  url.searchParams.set("file", file);
  url.searchParams.set("expiresAt", String(downloadExpiresAt));
  url.searchParams.set("authorityHash", authority.identityHash);

  const auditRef = db.collection("auditLogs").doc();
  await db.runTransaction(async (transaction) => {
    const current = await readExportDownloadAuthority(transaction, request.auth, jobId, file);
    if (current.identityHash !== authority.identityHash || downloadExpiresAt <= Date.now()) {
      throw new HttpsError("failed-precondition", "Export authority changed while preparing the download.");
    }
    const audit = {
      actorUid: current.actor.actorUid, actorRole: current.actor.actorRole,
      action: "export_download_url_created", targetUid: uid, requestId,
      metadata: { jobId, file, downloadExpiresAt, packageExpiresAt, consentExpiresAt,
        authorityHash: authority.identityHash, transport: "authenticated-function" }, source: "function"
    };
    transaction.create(auditRef, {
      ...audit, timestamp: FieldValue.serverTimestamp(), integrityHash: digest({ auditId: auditRef.id, ...audit })
    });
  });
  return { jobId, requestId, file, url: url.toString(), downloadExpiresAt, packageExpiresAt,
    requiresAuthorization: true,
    expiresInSeconds: Math.max(0, Math.floor((downloadExpiresAt - Date.now()) / 1000)), auditId: auditRef.id };
});

const deliverySchema = downloadSchema.extend({
  expiresAt: z.coerce.number().finite().int().positive(),
  authorityHash: z.string().regex(/^[0-9a-f]{64}$/)
});

// No Cloud Storage signed URL is minted. The endpoint requires a current,
// revocation-checked Firebase ID token and rereads consent/fence/receipt for every
// request, including URLs issued before withdrawal or deletion.
export const downloadExportPackage = onRequest({ cors: true, timeoutSeconds: 540, memory: "1GiB" }, async (request, response) => {
  response.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
  if (request.method !== "GET") { response.set("Allow", "GET").status(405).json({ error: "method_not_allowed" }); return; }
  try {
    const bearer = request.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (!bearer) throw new HttpsError("unauthenticated", "Authentication is required.");
    let verified;
    try { verified = await getAuth(app).verifyIdToken(bearer, true); }
    catch { throw new HttpsError("unauthenticated", "Current authentication is required."); }
    const parsed = deliverySchema.safeParse(request.query);
    if (!parsed.success) throw new HttpsError("invalid-argument", "A valid export download request is required.");
    const { jobId, file, expiresAt, authorityHash } = parsed.data;
    const actorAuth = { uid: verified.uid, token: verified };
    const authority = await db.runTransaction((transaction) => readExportDownloadAuthority(transaction, actorAuth, jobId, file));
    if (authority.identityHash !== authorityHash || expiresAt <= Date.now()
      || expiresAt > Math.min(Date.now() + EXPORT_DOWNLOAD_URL_TTL_MS, authority.packageExpiresAt, authority.consentExpiresAt)) {
      throw new HttpsError("failed-precondition", "Export download authority has expired or changed.");
    }
    const object = bucket.file(authority.path);
    const [exists] = await object.exists();
    if (!exists) throw new HttpsError("not-found", "Export package file is missing.");
    const auditRef = db.collection("auditLogs").doc();
    await db.runTransaction(async (transaction) => {
      const current = await readExportDownloadAuthority(transaction, actorAuth, jobId, file);
      if (current.identityHash !== authorityHash || expiresAt <= Date.now()) {
        throw new HttpsError("failed-precondition", "Export download authority changed before delivery.");
      }
      const audit = {
        actorUid: current.actor.actorUid, actorRole: current.actor.actorRole,
        action: "export_download_authorized", targetUid: current.uid, requestId: current.requestId, source: "function",
        metadata: { jobId, file, authorityHash, downloadExpiresAt: expiresAt, transport: "authenticated-function" }
      };
      transaction.create(auditRef, { ...audit, timestamp: FieldValue.serverTimestamp(), integrityHash: digest({ auditId: auditRef.id, ...audit }) });
    });
    response.set({ "Content-Type": "application/json", "Content-Disposition": `attachment; filename="urai-${file}.json"` });
    const stream = object.createReadStream();
    response.once("close", () => { if (!response.writableFinished) stream.destroy(); });
    await pipeline(stream, response);
  } catch (error) {
    if (response.headersSent || response.destroyed) return;
    const status = error instanceof HttpsError
      ? ({ "unauthenticated": 401, "permission-denied": 403, "not-found": 404, "invalid-argument": 400, "failed-precondition": 409 } as Record<string, number>)[error.code] ?? 500
      : 500;
    response.status(status).json({ error: "export_download_unavailable" });
  }
});

async function cleanupJob(document: QueryDocumentSnapshot<DocumentData>, now: number) {
  const job = document.data();
  const uid = text(job.uid);
  const requestId = text(job.requestId);
  const jobId = document.id;
  const packageExpiresAt = resolveExportPackageExpiry(job);
  if (!packageExpiresAt || packageExpiresAt > now) return false;
  if (!uid || !requestId) {
    await document.ref.update({
      status: "cleanup_blocked",
      complete: false,
      cleanupStatus: "failed",
      cleanupUpdatedAt: FieldValue.serverTimestamp(),
      cleanupReason: "INVALID_EXPORT_IDENTIFIERS"
    });
    return false;
  }

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
    await cleanupExportArtifactAttempts(now);

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
          const paths = [job.exportPackagePath, job.exportManifestPath]
            .filter((value): value is string => typeof value === "string");
          if (uid && requestId && paths.length > 0
            && paths.every((value) => validExportObjectPath({ uid, jobId: document.id, path: value }))) {
            await document.ref.update({
              status: "failed",
              complete: false,
              artifactCleanupStatus: "incomplete",
              artifactCleanupPendingPaths: paths,
              artifactCleanupFailureCount: paths.length,
              artifactCleanupUpdatedAt: FieldValue.serverTimestamp()
            });
          } else {
            await document.ref.update({
              status: "cleanup_blocked",
              complete: false,
              cleanupStatus: "failed",
              cleanupReason: "INVALID_EXPORT_CLEANUP_FAILURE",
              cleanupUpdatedAt: FieldValue.serverTimestamp()
            });
          }
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

    const failedCleanupCursorRef = db.collection("privacyMaintenance").doc("exportFailedArtifactCleanupCursor");
    const failedCleanupCursorSnap = await failedCleanupCursorRef.get();
    const failedCleanupStartAfter = text(failedCleanupCursorSnap.data()?.lastDocumentId);
    cursor = null;
    let lastFailedCleanupDocumentId = "";
    let reachedFailedCleanupEnd = false;
    for (let pageNumber = 0; pageNumber < EXPORT_CLEANUP_MAX_PAGES; pageNumber += 1) {
      let query = db.collection("exportJobs")
        .where("status", "==", "failed")
        .where("artifactCleanupStatus", "==", "incomplete")
        .orderBy(FieldPath.documentId())
        .limit(EXPORT_CLEANUP_PAGE_SIZE);
      if (cursor) {
        query = query.startAfter(cursor);
      } else if (failedCleanupStartAfter) {
        query = query.startAfter(failedCleanupStartAfter);
      }
      const page = await query.get();
      if (page.empty) {
        reachedFailedCleanupEnd = true;
        break;
      }
      for (const document of page.docs) {
        try {
          await cleanupFailedJob(document);
        } catch (error) {
          console.error("Failed export artifact cleanup retry", { jobId: document.id, reasonHash: digest(error) });
        }
      }
      cursor = page.docs[page.docs.length - 1] ?? null;
      lastFailedCleanupDocumentId = cursor?.id ?? lastFailedCleanupDocumentId;
      if (page.size < EXPORT_CLEANUP_PAGE_SIZE) {
        reachedFailedCleanupEnd = true;
        break;
      }
    }
    await failedCleanupCursorRef.set({
      lastDocumentId: reachedFailedCleanupEnd || !lastFailedCleanupDocumentId
        ? FieldValue.delete()
        : lastFailedCleanupDocumentId,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    void scanned;
    void deleted;
  }
);
