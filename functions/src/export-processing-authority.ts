import { timestampMillis } from "./export-lifecycle-contract";

export type ExportAttemptAuthority = {
  uid: string;
  jobId: string;
  requestId: string;
  actorUid: string;
  token: string;
};

export function exportAttemptPaths(uid: string, jobId: string, token: string) {
  if ([uid, jobId].some((part) => !part || part.includes("/") || part === "." || part.includes(".."))
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(token)) {
    throw new Error("Invalid export attempt identifiers.");
  }
  return {
    exportPath: `exports/${uid}/${jobId}/${token}/export.json`,
    manifestPath: `exports/${uid}/${jobId}/${token}/manifest.json`
  };
}

export function ownsExportAttempt(job: Record<string, unknown>, authority: ExportAttemptAuthority) {
  return job.uid === authority.uid
    && job.requestId === authority.requestId
    && job.status === "processing"
    && job.processingBy === authority.actorUid
    && job.processingLeaseToken === authority.token;
}

export function exportPublicationBlockReason(args: {
  job: Record<string, unknown>;
  fence: Record<string, unknown>;
  attempt: Record<string, unknown>;
  request: Record<string, unknown>;
  authority: ExportAttemptAuthority;
  nowMillis: number;
}): string | null {
  const { job, fence, attempt, request, authority, nowMillis } = args;
  if (!ownsExportAttempt(job, authority)) return "EXPORT_ATTEMPT_SUPERSEDED";
  if (request.uid !== authority.uid || request.type !== "export" || request.status !== "processing") {
    return "EXPORT_REQUEST_LINKAGE_CHANGED";
  }
  if (fence.active === true) return "ACCOUNT_DELETION_FENCED";
  if (fence.uid !== authority.uid || fence.exportProcessingJobId !== authority.jobId
    || fence.exportProcessingLeaseToken !== authority.token || fence.exportProcessingBy !== authority.actorUid) {
    return "EXPORT_FENCE_AUTHORITY_CHANGED";
  }
  if (attempt.uid !== authority.uid || attempt.jobId !== authority.jobId
    || attempt.requestId !== authority.requestId || attempt.token !== authority.token || attempt.status !== "processing") {
    return "EXPORT_ATTEMPT_LEDGER_CHANGED";
  }
  const expiries = [job.processingLeaseExpiresAt, fence.exportProcessingLeaseExpiresAt, attempt.cleanupDueAt];
  if (expiries.some((value) => (timestampMillis(value) ?? 0) <= nowMillis)) return "EXPORT_ATTEMPT_LEASE_EXPIRED";
  return null;
}
