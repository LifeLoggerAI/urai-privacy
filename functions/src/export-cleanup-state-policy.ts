/** Source-pure fail-closed cleanup identity and state admission. */
export type ExportCleanupIdentity = Readonly<{
  uid: string; requestId: string; exportPath: string; manifestPath: string;
  exportGeneration: string; manifestGeneration: string; packageExpiresAtMillis: number;
}>;

export function sameCompletedExportForCleanup(
  current: Record<string, unknown>, expected: ExportCleanupIdentity, nowMillis: number,
  expiresAtMillis: number | null
): boolean {
  return current.status === "completed" && current.complete === true
    && current.uid === expected.uid && current.requestId === expected.requestId
    && current.exportPackagePath === expected.exportPath && current.exportManifestPath === expected.manifestPath
    && current.exportGeneration === expected.exportGeneration
    && current.manifestGeneration === expected.manifestGeneration
    && Number.isSafeInteger(nowMillis) && Number.isSafeInteger(expiresAtMillis)
    && expiresAtMillis === expected.packageExpiresAtMillis && expiresAtMillis <= nowMillis;
}

export function attemptCleanupBlockReason(args: {
  attempt: Record<string, unknown>; job: Record<string, unknown>;
  uid: string; jobId: string; requestId: string; token: string;
  exportPath: string; manifestPath: string;
  nowMillis: number; jobLeaseExpiresAtMillis: number | null;
  packageExpiresAtMillis: number | null;
}): string | null {
  const {attempt,job,uid,jobId,requestId,token,exportPath,manifestPath,nowMillis,
    jobLeaseExpiresAtMillis,packageExpiresAtMillis} = args;
  if (!["processing","completed","cleanup_pending","artifact_cleanup"].includes(String(attempt.status))
    || attempt.uid !== uid || attempt.jobId !== jobId || attempt.requestId !== requestId
    || attempt.token !== token || !token) return "ATTEMPT_IDENTITY_OR_STATE_CHANGED";
  if (job.uid !== uid || job.requestId !== requestId) return "JOB_OWNER_OR_REQUEST_CHANGED";
  if (job.status === "processing" && job.processingLeaseToken === token
    && Number.isSafeInteger(jobLeaseExpiresAtMillis) && jobLeaseExpiresAtMillis! <= nowMillis) {
    return null;
  }
  if (job.status === "completed" && job.complete === true
    && job.exportPackagePath === exportPath && job.exportManifestPath === manifestPath
    && job.exportGeneration === attempt.exportGeneration
    && job.manifestGeneration === attempt.manifestGeneration
    && Number.isSafeInteger(packageExpiresAtMillis) && packageExpiresAtMillis! <= nowMillis) {
    return null;
  }
  return "ACTIVE_SUPERSEDED_OR_UNEXPIRED_EXPORT";
}
