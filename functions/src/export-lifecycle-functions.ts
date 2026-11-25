import { once } from "node:events";
import { createHash, randomUUID } from "node:crypto";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
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
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  EXPORT_CLEANUP_MAX_PAGES,
  EXPORT_CLEANUP_PAGE_SIZE,
  EXPORT_DOWNLOAD_URL_TTL_MS,
  EXPORT_PACKAGE_TTL_MS,
  currentExportDownloadMatches,
  signedExportObjectGeneration,
  resolveExportPackageExpiry,
  timestampMillis,
  validExportObjectPath
} from "./export-lifecycle-contract";
import { removeExportArtifacts } from "./export-artifact-cleanup";
import { exportBearerToken, verifyActiveExportCaller } from "./export-active-caller";
import { requireExportConsent } from "./export-consent-authority";

const app = getApps().length ? getApp() : initializeApp();
const db = getFirestore(app);
const bucket = getStorage(app).bucket();
const FAILED_ARTIFACT_CLEANUP_LEASE_MS = 15 * 60 * 1000;

const documentId = z.string().min(1).max(160).regex(/^[^/\s]+$/).refine(id => id !== "." && id !== "..");
const downloadFile = z.enum(["export", "manifest"]);
const downloadSchema = z.object({ jobId: documentId, file: downloadFile.default("export") }).strict();
const deliverySchema = z.object({
  jobId: documentId, file: downloadFile, auditId: documentId,
  authorityHash: z.string().regex(/^[0-9a-f]{64}$/), expiresAt: z.string().regex(/^[1-9]\d{0,14}$/)
}).strict();
const DESCRIPTOR_SCHEMA = "urai-canonical-export-download-v1";
// Gen 2 limits each streamed HTTP response to 10 MB.
const SINGLE_RESPONSE_BYTES = 10_000_000;
const CHUNK_BYTES = 64 * 1024;
type DownloadFile = z.infer<typeof downloadFile>;
type RequestAuth = { uid?: string; token?: Record<string, unknown> };

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value) ?? String(value)).digest("hex");
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function unavailable() {
  return new HttpsError("failed-precondition", "Check current data export consent and request a fresh export package.");
}

function requireOwnerOrAdmin(auth: RequestAuth | undefined, ownerUid: string) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  const elevated = auth.token?.admin === true || auth.token?.role === "admin";
  if (auth.uid !== ownerUid && !elevated) throw new HttpsError("permission-denied", "Owner or administrative access is required.");
  return { actorUid: auth.uid, actorRole: auth.uid === ownerUid ? "user" : "admin" };
}

function localAuthEmulator() {
  return process.env.FUNCTIONS_EMULATOR === "true" &&
    /^(?:localhost|127\.0\.0\.1):[1-9]\d{0,4}$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "");
}

async function authenticatedActor(header: unknown, expectedUid?: string) {
  const bearer = exportBearerToken(header, localAuthEmulator());
  if (!bearer) throw new HttpsError("unauthenticated", "Current authentication is required.");
  const token = await getAuth(app).verifyIdToken(bearer, true).catch(() => null);
  if (!token?.uid || (expectedUid !== undefined && token.uid !== expectedUid)) {
    throw new HttpsError("unauthenticated", "Current authentication is required.");
  }
  return { uid: token.uid, token };
}

async function verifyAccounts(uid: string, actorUid: string) {
  const owner = await getAuth(app).getUser(uid).catch(() => null);
  if (!owner || owner.disabled) throw unavailable();
  if (actorUid === uid) return;
  const actor = await getAuth(app).getUser(actorUid).catch(() => null);
  if (!actor || actor.disabled || !(actor.customClaims?.admin === true || actor.customClaims?.role === "admin")) {
    throw new HttpsError("permission-denied", "Current administrative authority is required.");
  }
}

async function readAuthority(tx: FirebaseFirestore.Transaction, jobId: string, file: DownloadFile, auth: RequestAuth) {
  const job = (await tx.get(db.collection("exportJobs").doc(jobId))).data();
  if (!job) throw new HttpsError("not-found", "Export job is unavailable.");
  const uid = text(job.uid);
  const requestId = text(job.requestId);
  if (!documentId.safeParse(uid).success || !documentId.safeParse(requestId).success ||
      job.status !== "completed" || job.complete !== true || !currentExportDownloadMatches(job, job)) throw unavailable();
  const actor = requireOwnerOrAdmin(auth, uid);
  const [parent, consent, accountFence, tombstone] = await Promise.all([
    tx.get(db.collection("privacyRequests").doc(requestId)),
    tx.get(db.collection("consentRecords").doc(`${uid}_data_export`)),
    tx.get(db.collection("accountDeletionFences").doc(uid)),
    tx.get(db.collection("privacyDeletionTombstones").doc(uid))
  ]);
  const subjectRequest = parent.data();
  if (accountFence.exists || tombstone.exists || subjectRequest?.uid !== uid ||
      subjectRequest.type !== "export" || subjectRequest.status !== "completed") throw unavailable();
  const grant = requireExportConsent(uid, consent.data(), job, subjectRequest);
  const packageExpiresAt = resolveExportPackageExpiry(job);
  const path = file === "manifest" ? job.exportManifestPath : job.exportPackagePath;
  if (!packageExpiresAt || packageExpiresAt <= Date.now() || !validExportObjectPath({ uid, jobId, path }) ||
      typeof path !== "string" || !path.endsWith(`/${file}.json`)) throw unavailable();
  const sha256 = text(file === "manifest" ? job.manifestSha256 : job.exportSha256);
  const rowHash = digest([uid, requestId, jobId, job.exportPackagePath, job.exportManifestPath,
    job.exportSha256, job.manifestSha256, packageExpiresAt, grant.consentReceiptHash, grant.exportConsentExpiresAt]);
  return { uid, requestId, jobId, file, path: String(path), sha256, job, actor, rowHash,
    packageExpiresAt, consentExpiresAt: Date.parse(grant.exportConsentExpiresAt) };
}

type Authority = Awaited<ReturnType<typeof readAuthority>>;

async function readObject(authority: Authority) {
  const [metadata] = await bucket.file(authority.path).getMetadata().catch(() => [null]);
  if (!metadata) throw new HttpsError("not-found", "Export package file is unavailable.");
  const generation = signedExportObjectGeneration(authority.job, authority.file, metadata);
  const size = String(metadata.size ?? "");
  const byteLength = Number(size);
  // The Storage SDK converts generation to a JS number before sending it.
  if (!generation || !Number.isSafeInteger(Number(generation)) || !/^[1-9]\d*$/.test(size) ||
      !Number.isSafeInteger(byteLength) ||
      metadata.contentType?.split(";")[0].trim().toLowerCase() !== "application/json") throw unavailable();
  return { generation, byteLength };
}

// One audit document can hold this bounded digest index. The current producer
// serializes a single JSON string, well below the 16 GiB covered by the index.
const RANGE_SIZE = 4 * 1024 * 1024;
const MAX_RANGE_PARTS = 4096;

async function indexRanges(authority: Authority, object: { generation: string; byteLength: number }, check: () => Promise<void>) {
  if (object.byteLength <= SINGLE_RESPONSE_BYTES) return null;
  if (Math.ceil(object.byteLength / RANGE_SIZE) > MAX_RANGE_PARTS) {
    throw new HttpsError("resource-exhausted", "This export exceeds the authenticated range index capacity.");
  }
  const rangeHashes: string[] = [];
  const full = createHash("sha256");
  let partial = createHash("sha256");
  let remaining = RANGE_SIZE;
  let total = 0;
  const stream = bucket.file(authority.path, { generation: object.generation }).createReadStream();
  try {
    for await (const part of stream) {
      const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
      total += chunk.length;
      if (total > object.byteLength) throw unavailable();
      full.update(chunk);
      let start = 0;
      while (start < chunk.length) {
        const size = Math.min(remaining, chunk.length - start);
        partial.update(chunk.subarray(start, start + size));
        start += size;
        remaining -= size;
        if (!remaining) {
          rangeHashes.push(partial.digest("hex"));
          partial = createHash("sha256");
          remaining = RANGE_SIZE;
          await check();
        }
      }
    }
    if (total !== object.byteLength || full.digest("hex") !== authority.sha256) throw unavailable();
    if (remaining < RANGE_SIZE) rangeHashes.push(partial.digest("hex"));
    return { rangeSize: RANGE_SIZE, rangeHashes, rangeRoot: digest(rangeHashes) };
  } finally { stream.destroy(); }
}

function selectRange(header: string | undefined, total: number, hashes: unknown, sha256: string) {
  if (total <= SINGLE_RESPONSE_BYTES) {
    if (header !== undefined) throw new HttpsError("out-of-range", "The complete small package is required.");
    return { start: 0, end: total - 1, checksum: sha256, partial: false };
  }
  const match = /^bytes=(0|[1-9]\d{0,15})-(0|[1-9]\d{0,15})$/.exec(header ?? "");
  if (!match) throw new HttpsError("out-of-range", "A single aligned export byte range is required.");
  const start = Number(match[1]), end = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start % RANGE_SIZE !== 0 ||
      start >= total || end !== Math.min(start + RANGE_SIZE, total) - 1) throw new HttpsError("out-of-range", "Invalid export byte range.");
  const checksum = Array.isArray(hashes) ? hashes[start / RANGE_SIZE] : undefined;
  if (typeof checksum !== "string" || !/^[0-9a-f]{64}$/.test(checksum)) throw unavailable();
  return { start, end, checksum, partial: true };
}

function exportDownloadEndpoint(rawHost: string | undefined) {
  const projectId = app.options.projectId ?? process.env.GCLOUD_PROJECT;
  if (!projectId || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId)) throw unavailable();
  if (process.env.FUNCTIONS_EMULATOR === "true") {
    if (!rawHost || !/^(?:localhost|127\.0\.0\.1):[1-9]\d{0,4}$/.test(rawHost)) throw unavailable();
    return `http://${rawHost}/${projectId}/us-central1/downloadExportPackage`;
  }
  return `https://us-central1-${projectId}.cloudfunctions.net/downloadExportPackage`;
}

function receiptIdentity(authority: Authority, object: { generation: string; byteLength: number; rangeRoot?: string }, auditId: string, expiresAt: number) {
  return digest([DESCRIPTOR_SCHEMA, auditId, expiresAt, authority.actor.actorUid, authority.rowHash,
    authority.file, authority.sha256, object.generation, object.byteLength, ...(object.rangeRoot ? [object.rangeRoot] : [])]);
}

async function writeAudit(args: {
  actorUid: string; actorRole: string; action: string; targetUid: string;
  requestId: string; metadata: Record<string, unknown>;
}) {
  const ref = db.collection("auditLogs").doc();
  await ref.set({ ...args, source: "function", timestamp: FieldValue.serverTimestamp(), integrityHash: digest({ auditId: ref.id, ...args }) });
  return ref.id;
}

export const getExportDownloadUrl = onCall({ timeoutSeconds: 540, memory: "512MiB", concurrency: 4 }, async (request) => {
  const parsed = downloadSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", "A valid export job and file are required.");
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  const { jobId, file } = parsed.data;
  const header = request.rawRequest.headers.authorization;
  const auth = await authenticatedActor(header, request.auth.uid);
  const authority = await db.runTransaction(tx => readAuthority(tx, jobId, file, auth), { readOnly: true });
  const { uid, requestId, packageExpiresAt, sha256 } = authority;
  requireOwnerOrAdmin(request.auth, uid);
  await verifyAccounts(uid, auth.uid);
  const object = await readObject(authority);
  const verifyIssuance = async () => {
    await verifyAccounts(uid, auth.uid);
    const latest = await db.runTransaction(tx => readAuthority(tx, jobId, file, auth), { readOnly: true });
    const valid = await verifyActiveExportCaller(auth.uid, header, (token, revoked) => getAuth(app).verifyIdToken(token, revoked), localAuthEmulator());
    if (!valid || latest.rowHash !== authority.rowHash) throw unavailable();
  };
  const index = await indexRanges(authority, object, verifyIssuance);
  const downloadExpiresAt = Math.min(Date.now() + EXPORT_DOWNLOAD_URL_TTL_MS, packageExpiresAt, authority.consentExpiresAt);
  const ref = db.collection("auditLogs").doc();
  const authorityHash = receiptIdentity(authority, { ...object, rangeRoot: index?.rangeRoot }, ref.id, downloadExpiresAt);
  const url = new URL(exportDownloadEndpoint(request.rawRequest.get("host")));
  url.search = new URLSearchParams({ jobId, file, expiresAt: String(downloadExpiresAt), authorityHash, auditId: ref.id }).toString();
  const metadata = { schemaVersion: DESCRIPTOR_SCHEMA, transport: "authenticated-function", jobId, file,
    authorityHash, packageExpiresAt, downloadExpiresAt, sha256, ...object, ...(index ?? {}) };
  await db.runTransaction(async tx => {
    const current = await readAuthority(tx, jobId, file, auth);
    if (current.rowHash !== authority.rowHash || downloadExpiresAt <= Date.now()) throw unavailable();
    const audit = { ...current.actor, action: "export_download_url_created", targetUid: uid, requestId, metadata, source: "function" };
    tx.create(ref, { ...audit, timestamp: FieldValue.serverTimestamp(), integrityHash: digest({ auditId: ref.id, ...audit }) });
  });
  const lastObject = await readObject(authority);
  if (lastObject.generation !== object.generation || lastObject.byteLength !== object.byteLength) throw unavailable();
  await verifyIssuance();
  if (downloadExpiresAt <= Date.now()) throw unavailable();
  return { schemaVersion: DESCRIPTOR_SCHEMA, requiresAuthorization: true, uid, jobId, requestId, file, url: url.toString(),
    downloadExpiresAt, packageExpiresAt, authorityHash, auditId: ref.id, sha256, ...object, ...(index ? { rangeSize: RANGE_SIZE } : {}) };
});

export const downloadExportPackage = onRequest({ cors: true, timeoutSeconds: 540, memory: "1GiB", concurrency: 4 }, async (request, response) => {
  response.set({ "Cache-Control": "private, no-store, no-transform", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer",
    "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, ETag, Content-Encoding" });
  if (request.method !== "GET") { response.set("Allow", "GET").status(405).end(); return; }
  try {
    const query = deliverySchema.safeParse(request.query);
    if (!query.success) throw new HttpsError("invalid-argument", "Invalid export download descriptor.");
    const { jobId, file, auditId, authorityHash } = query.data;
    const expiresAt = Number(query.data.expiresAt);
    const header = request.get("authorization");
    const original = await authenticatedActor(header);
    const auditRef = db.collection("auditLogs").doc(auditId);
    const checkConnection = () => {
      if (Date.now() >= expiresAt || request.aborted || response.destroyed) throw unavailable();
    };
    const checkAuthority = async () => {
      checkConnection();
      const auth = await authenticatedActor(header, original.uid);
      const current = await db.runTransaction(async tx => {
        const authority = await readAuthority(tx, jobId, file, auth);
        const audit = (await tx.get(auditRef)).data();
        const meta = audit?.metadata;
        if (audit?.source !== "function" || audit.action !== "export_download_url_created" ||
            audit.actorUid !== original.uid || audit.targetUid !== authority.uid || audit.requestId !== authority.requestId ||
            meta?.schemaVersion !== DESCRIPTOR_SCHEMA || meta.transport !== "authenticated-function" ||
            meta.jobId !== jobId || meta.file !== file || meta.sha256 !== authority.sha256 || meta.authorityHash !== authorityHash ||
            meta.downloadExpiresAt !== expiresAt || meta.packageExpiresAt !== authority.packageExpiresAt ||
            expiresAt > Math.min(authority.packageExpiresAt, authority.consentExpiresAt) ||
            receiptIdentity(authority, meta, auditId, expiresAt) !== authorityHash) throw unavailable();
        if (meta.byteLength > SINGLE_RESPONSE_BYTES && (meta.rangeSize !== RANGE_SIZE || !Array.isArray(meta.rangeHashes) ||
            meta.rangeHashes.length !== Math.ceil(meta.byteLength / RANGE_SIZE) || digest(meta.rangeHashes) !== meta.rangeRoot)) throw unavailable();
        return { authority, generation: text(meta.generation), byteLength: Number(meta.byteLength), rangeHashes: meta.rangeHashes };

      }, { readOnly: true });
      const object = await readObject(current.authority);
      if (object.generation !== current.generation || object.byteLength !== current.byteLength) throw unavailable();
      await verifyAccounts(current.authority.uid, original.uid);
      // Storage and Auth are independent authorities. Reread C7 after their awaited
      // checks, then verify the original bearer again before returning a chunk.
      const latest = await db.runTransaction(tx => readAuthority(tx, jobId, file, auth), { readOnly: true });
      if (latest.rowHash !== current.authority.rowHash) throw unavailable();
      requireOwnerOrAdmin(await authenticatedActor(header, original.uid), current.authority.uid);
      checkConnection();
      return current;
    };
    const current = await checkAuthority();
    const object = bucket.file(current.authority.path, { generation: current.generation });
    const range = selectRange(request.get("range"), current.byteLength, current.rangeHashes, current.authority.sha256);
    const stream = range.partial ? object.createReadStream({ start: range.start, end: range.end, validation: false }) : object.createReadStream();
    const disconnect = new AbortController();
    const abort = () => {
      if (!response.writableFinished) { disconnect.abort(); stream.destroy(); }
    };
    response.once("close", abort);
    // Verify the actual content before releasing any bytes. No bearer Storage URL is issued.
    const bytes = Buffer.alloc(range.end - range.start + 1);
    let length = 0;
    try {
      for await (const part of stream) {
        checkConnection();
        const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
        if (chunk.length > bytes.length - length) throw unavailable();
        chunk.copy(bytes, length);
        length += chunk.length;
      }
      if (length !== bytes.length || createHash("sha256").update(bytes).digest("hex") !== range.checksum) throw unavailable();
      for (let offset = 0; offset < bytes.length; offset += CHUNK_BYTES) {
        await checkAuthority();
        if (!offset) response.status(range.partial ? 206 : 200).set({
          "Accept-Ranges": range.partial ? "bytes" : "none", "ETag": `"${current.generation}"`,
          ...(range.partial ? { "Content-Range": `bytes ${range.start}-${range.end}/${current.byteLength}` } : {}),
          "Content-Type": "application/json", "Content-Length": String(length), "Content-Encoding": "identity",
          "Content-Disposition": `attachment; filename="urai-${file}.json"` });
        const chunk = bytes.subarray(offset, offset + CHUNK_BYTES);
        if (!response.write(chunk)) await once(response, "drain", { signal: disconnect.signal });
      }
      response.end();
    } finally {
      stream.destroy();
      response.removeListener("close", abort);
    }
  } catch (error) {
    if (response.destroyed) return;
    if (response.headersSent) { response.destroy(); return; }
    const codes: Record<string, number> = { "unauthenticated": 401, "permission-denied": 403, "not-found": 404, "invalid-argument": 400, "failed-precondition": 409, "resource-exhausted": 413, "out-of-range": 416 };
    response.status(error instanceof HttpsError ? codes[error.code] ?? 500 : 500).json({ error: "export_download_unavailable" });
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
