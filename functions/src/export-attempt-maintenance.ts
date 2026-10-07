import { createHash, randomUUID } from "node:crypto";
import { FieldPath, FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { removeExportArtifacts } from "./export-artifact-cleanup";
import { EXPORT_CLEANUP_MAX_PAGES, EXPORT_CLEANUP_PAGE_SIZE, timestampMillis } from "./export-lifecycle-contract";
import { exportAttemptPaths } from "./export-processing-authority";

const CLEANUP_LEASE_MS = 15 * 60 * 1000;

export async function cleanupExportArtifactAttempts(now: number) {
  const db = getFirestore();
  const cursorRef = db.collection("privacyMaintenance").doc("exportArtifactAttemptsCursor");
  const savedCursor = (await cursorRef.get()).data() ?? {};
  let cursorTime = timestampMillis(savedCursor.lastDueAt);
  let cursorId = typeof savedCursor.lastDocumentId === "string" ? savedCursor.lastDocumentId : "";
  let reachedEnd = false;
  let cleaned = 0;
  let failed = 0;

  for (let pageNumber = 0; pageNumber < EXPORT_CLEANUP_MAX_PAGES; pageNumber += 1) {
    let query = db.collection("exportArtifactAttempts")
      .where("cleanupDueAt", "<=", Timestamp.fromMillis(now))
      .orderBy("cleanupDueAt").orderBy(FieldPath.documentId())
      .limit(EXPORT_CLEANUP_PAGE_SIZE);
    if (cursorTime && cursorId) query = query.startAfter(Timestamp.fromMillis(cursorTime), cursorId);
    const page = await query.get();
    if (page.empty) { reachedEnd = true; break; }

    for (const document of page.docs) {
      const cleanupToken = randomUUID();
      try {
        const claim = await db.runTransaction(async (tx) => {
          const fresh = await tx.get(document.ref);
          if (!fresh.exists) return null;
          const attempt = fresh.data() ?? {};
          if ((timestampMillis(attempt.cleanupDueAt) ?? Infinity) > now) return null;
          if ((timestampMillis(attempt.cleanupLeaseExpiresAt) ?? 0) > now) return null;
          const { uid, jobId, requestId, token } = attempt;
          let expectedPaths: string[] = [];
          if ([uid, jobId, requestId, token].every((value) => typeof value === "string" && value)) {
            try {
              const paths = exportAttemptPaths(uid, jobId, token);
              expectedPaths = [paths.exportPath, paths.manifestPath];
            } catch { /* Invalid metadata remains blocked and visible. */ }
          }
          const paths = Array.isArray(attempt.paths) ? attempt.paths : null;
          if (expectedPaths.length !== 2 || token !== document.id || !paths
            || paths.some((path) => typeof path !== "string" || !expectedPaths.includes(path))) {
            tx.update(document.ref, {
              status: "cleanup_blocked", cleanupDueAt: FieldValue.delete(),
              cleanupReason: "INVALID_EXPORT_ATTEMPT", updatedAt: FieldValue.serverTimestamp()
            });
            return null;
          }
          const jobRef = db.collection("exportJobs").doc(jobId);
          const requestRef = db.collection("privacyRequests").doc(requestId);
          const fenceRef = db.collection("privacyDeletionTombstones").doc(uid);
          const [job, fence, request] = await Promise.all([tx.get(jobRef), tx.get(fenceRef), tx.get(requestRef)]);
          const jobData = job.data() ?? {};
          const ownsProcessing = jobData.status === "processing" && jobData.processingLeaseToken === token
            && jobData.uid === uid && jobData.requestId === requestId;
          const ownsCompleted = jobData.status === "completed" && jobData.exportPackagePath === expectedPaths[0]
            && jobData.uid === uid && jobData.requestId === requestId;
          if (ownsProcessing) {
            tx.update(jobRef, {
              status: "failed", complete: false, processingLeaseToken: FieldValue.delete(),
              processingLeaseExpiresAt: FieldValue.delete(), processingBy: FieldValue.delete(),
              artifactCleanupStatus: "incomplete", artifactCleanupPendingPaths: paths,
              updatedAt: FieldValue.serverTimestamp()
            });
            if (request.exists && request.data()?.uid === uid && request.data()?.status === "processing") {
              tx.update(requestRef, { status: "failed", updatedAt: FieldValue.serverTimestamp() });
            }
          } else if (ownsCompleted) {
            tx.update(jobRef, { status: "expired", complete: false, updatedAt: FieldValue.serverTimestamp() });
          }
          if (fence.exists && fence.data()?.exportProcessingJobId === jobId && fence.data()?.exportProcessingLeaseToken === token) {
            tx.update(fenceRef, {
              exportProcessingJobId: FieldValue.delete(), exportProcessingLeaseToken: FieldValue.delete(),
              exportProcessingLeaseExpiresAt: FieldValue.delete(), exportProcessingBy: FieldValue.delete(),
              updatedAt: FieldValue.serverTimestamp()
            });
          }
          tx.update(document.ref, {
            status: "artifact_cleanup", cleanupLeaseToken: cleanupToken,
            cleanupLeaseExpiresAt: Timestamp.fromMillis(now + CLEANUP_LEASE_MS), updatedAt: FieldValue.serverTimestamp()
          });
          return { uid, jobId, requestId, paths: paths as string[] };
        });
        if (!claim) continue;
        const cleanup = await removeExportArtifacts(claim.paths, async (path) => {
          await getStorage().bucket().file(path).delete({ ignoreNotFound: true });
        });
        await db.runTransaction(async (tx) => {
          const fresh = await tx.get(document.ref);
          // Account deletion can remove the ledger while cleanup is in flight.
          if (!fresh.exists || fresh.data()?.cleanupLeaseToken !== cleanupToken) return;
          tx.update(document.ref, {
            status: cleanup.pendingPaths.length ? "cleanup_pending" : "cleaned",
            paths: cleanup.pendingPaths,
            cleanupFailureCount: cleanup.pendingPaths.length,
            cleanupDueAt: cleanup.pendingPaths.length ? Timestamp.fromMillis(now) : FieldValue.delete(),
            cleanupLeaseToken: FieldValue.delete(), cleanupLeaseExpiresAt: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp()
          });
          const auditRef = db.collection("auditLogs").doc();
          const audit = {
            actorUid: "system", actorRole: "system", source: "system",
            action: cleanup.pendingPaths.length ? "export_attempt_cleanup_incomplete" : "export_attempt_cleanup_completed",
            targetUid: claim.uid, requestId: claim.requestId,
            metadata: { jobId: claim.jobId, attemptToken: document.id, targetCount: cleanup.targetCount, pendingCount: cleanup.pendingPaths.length }
          };
          tx.create(auditRef, {
            ...audit, timestamp: FieldValue.serverTimestamp(),
            integrityHash: createHash("sha256").update(JSON.stringify({ ...audit, id: auditRef.id })).digest("hex")
          });
        });
        if (cleanup.pendingPaths.length) failed += 1; else cleaned += 1;
      } catch (error) {
        failed += 1;
        console.error("Export attempt maintenance failed", {
          attemptId: document.id,
          reasonHash: createHash("sha256").update(error instanceof Error ? error.message : "unknown").digest("hex")
        });
      }
    }
    const last = page.docs[page.docs.length - 1];
    cursorTime = timestampMillis(last?.data().cleanupDueAt);
    cursorId = last?.id ?? "";
    if (page.size < EXPORT_CLEANUP_PAGE_SIZE) { reachedEnd = true; break; }
  }
  await cursorRef.set({
    lastDueAt: !reachedEnd && cursorTime ? Timestamp.fromMillis(cursorTime) : FieldValue.delete(),
    lastDocumentId: !reachedEnd && cursorId ? cursorId : FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { cleaned, failed };
}
