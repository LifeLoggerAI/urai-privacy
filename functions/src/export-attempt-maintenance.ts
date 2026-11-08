import { createHash, randomUUID } from "node:crypto";
import { FieldPath, FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { removeExportArtifacts } from "./export-artifact-cleanup";
import { EXPORT_CLEANUP_MAX_PAGES, EXPORT_CLEANUP_PAGE_SIZE, timestampMillis, resolveExportPackageExpiry } from "./export-lifecycle-contract";
import { attemptCleanupBlockReason, attemptCleanupFinalizationBlockReason } from "./export-cleanup-state-policy";
import { exportAttemptPaths } from "./export-processing-authority";
import { approvedExportCleanupGeneration } from "./export-object-generation-policy";
import { deleteApprovedExportArtifact } from "./export-generation-cleanup";

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
          const binding = {
            uid, jobId, exportPath: expectedPaths[0], manifestPath: expectedPaths[1],
            exportGeneration: attempt.exportGeneration, manifestGeneration: attempt.manifestGeneration
          };
          if (paths.some((path) => !approvedExportCleanupGeneration({ ...binding, path }))) {
            tx.update(document.ref, {
              status: "cleanup_blocked", cleanupDueAt: FieldValue.delete(),
              cleanupReason: "MISSING_EXACT_EXPORT_GENERATION", updatedAt: FieldValue.serverTimestamp()
            });
            return null;
          }
          const jobRef = db.collection("exportJobs").doc(jobId);
          const requestRef = db.collection("privacyRequests").doc(requestId);
          const fenceRef = db.collection("privacyDeletionTombstones").doc(uid);
          const [job, fence, request] = await Promise.all([tx.get(jobRef), tx.get(fenceRef), tx.get(requestRef)]);
          const jobData = job.data() ?? {};
          const jobLeaseExpiresAtMillis = timestampMillis(jobData.processingLeaseExpiresAt);
          const packageExpiresAtMillis = resolveExportPackageExpiry(jobData);
          const block = attemptCleanupBlockReason({
            attempt, job: jobData, uid, jobId, requestId, token,
            exportPath: expectedPaths[0], manifestPath: expectedPaths[1],
            nowMillis: now, jobLeaseExpiresAtMillis, packageExpiresAtMillis
          });
          if (block) {
            // Reevaluate after a lease/expiry. Never delete an active or
            // superseded job's objects because an old attempt became due.
            tx.update(document.ref, {
              cleanupReason: block,
              cleanupDueAt: Timestamp.fromMillis(Math.max(
                now + CLEANUP_LEASE_MS,
                jobLeaseExpiresAtMillis ?? 0,
                packageExpiresAtMillis ?? 0
              )),
              updatedAt: FieldValue.serverTimestamp()
            });
            return null;
          }
          const ownsProcessing = jobData.status === "processing";
          // The claim policy above established either an expired matching
          // processing attempt or an expired matching completed package.
          const cleanupLeaseExpiresAt = Timestamp.fromMillis(now + CLEANUP_LEASE_MS);
          tx.update(jobRef, {
            status: "artifact_cleanup", complete: false,
            artifactCleanupStatus: "processing",
            artifactCleanupLeaseToken: cleanupToken,
            artifactCleanupLeaseExpiresAt: cleanupLeaseExpiresAt,
            artifactCleanupPendingPaths: paths,
            artifactCleanupUpdatedAt: FieldValue.serverTimestamp(),
            exportPackagePath: expectedPaths[0],
            exportManifestPath: expectedPaths[1],
            exportGeneration: attempt.exportGeneration,
            manifestGeneration: attempt.manifestGeneration,
            ...(ownsProcessing ? {
              processingLeaseToken: FieldValue.delete(),
              processingLeaseExpiresAt: FieldValue.delete(),
              processingBy: FieldValue.delete()
            } : {})
          });
          if (ownsProcessing && request.exists && request.data()?.uid === uid
            && request.data()?.status === "processing") {
            tx.update(requestRef, { status: "failed", updatedAt: FieldValue.serverTimestamp() });
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
            cleanupLeaseExpiresAt, updatedAt: FieldValue.serverTimestamp()
          });
          return { ...binding, requestId, paths: paths as string[],
            attemptToken: token, cleanupToken, originalCompleted: !ownsProcessing };
        });
        if (!claim) continue;
        const cleanup = await removeExportArtifacts(claim.paths, async (path) => {
          await deleteApprovedExportArtifact({ ...claim, path });
        });
        await db.runTransaction(async (tx) => {
          const jobRef = db.collection("exportJobs").doc(claim.jobId);
          const [fresh, currentJob] = await Promise.all([
            tx.get(document.ref), tx.get(jobRef)
          ]);
          if (!fresh.exists || !currentJob.exists) {
            // Deletion may have erased both records; never re-create them.
            return;
          }
          const block = attemptCleanupFinalizationBlockReason({
            attempt: fresh.data() ?? {}, job: currentJob.data() ?? {},
            authority: {
              uid: claim.uid, jobId: claim.jobId, requestId: claim.requestId,
              attemptToken: claim.attemptToken, cleanupToken,
              exportPath: claim.exportPath, manifestPath: claim.manifestPath,
              exportGeneration: claim.exportGeneration, manifestGeneration: claim.manifestGeneration,
              paths: claim.paths
            },
            nowMillis: Date.now(),
            attemptLeaseExpiresAtMillis: timestampMillis(fresh.data()?.cleanupLeaseExpiresAt),
            jobLeaseExpiresAtMillis: timestampMillis(currentJob.data()?.artifactCleanupLeaseExpiresAt)
          });
          if (block) throw new Error("Export attempt cleanup finalization authority changed: " + block);
          const pending = cleanup.pendingPaths.length !== 0;
          tx.update(jobRef, {
            status: pending ? "failed" : (claim.originalCompleted ? "expired" : "failed"),
            complete: false,
            artifactCleanupStatus: pending ? "incomplete" : "completed",
            artifactCleanupPendingPaths: cleanup.pendingPaths,
            artifactCleanupFailureCount: cleanup.pendingPaths.length,
            artifactCleanupLeaseToken: FieldValue.delete(),
            artifactCleanupLeaseExpiresAt: FieldValue.delete(),
            artifactCleanupUpdatedAt: FieldValue.serverTimestamp()
          });
          tx.update(document.ref, {
            status: pending ? "cleanup_pending" : "cleaned",
            paths: cleanup.pendingPaths,
            cleanupFailureCount: cleanup.pendingPaths.length,
            // Failed-job recovery owns any remaining paths; do not repeatedly
            // claim an attempt that can no longer have processing/completed status.
            cleanupDueAt: FieldValue.delete(),
            cleanupLeaseToken: FieldValue.delete(), cleanupLeaseExpiresAt: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp()
          });
          const auditRef = db.collection("auditLogs").doc();
          const audit = {
            actorUid: "system", actorRole: "system", source: "system",
            action: pending ? "export_attempt_cleanup_incomplete" : "export_attempt_cleanup_completed",
            targetUid: claim.uid, requestId: claim.requestId,
            metadata: { jobId: claim.jobId, attemptToken: document.id,
              targetCount: cleanup.targetCount, pendingCount: cleanup.pendingPaths.length }
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
