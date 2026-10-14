import { describe, expect, it } from "vitest";
import { exportAttemptPaths, exportPublicationBlockReason, ownsExportAttempt } from "../../functions/src/export-processing-authority";

const token = "00000000-0000-4000-8000-000000000001";
const successor = "00000000-0000-4000-8000-000000000002";
const nowMillis = 1_000_000;
const authority = { uid: "user-a", jobId: "job-a", requestId: "request-a", actorUid: "admin-a", token };
function valid() {
  return {
    authority, nowMillis,
    job: { uid: "user-a", requestId: "request-a", status: "processing", processingBy: "admin-a", processingLeaseToken: token, processingLeaseExpiresAt: nowMillis + 1 },
    request: { uid: "user-a", type: "export", status: "processing" },
    fence: { uid: "user-a", active: false, exportProcessingJobId: "job-a", exportProcessingBy: "admin-a", exportProcessingLeaseToken: token, exportProcessingLeaseExpiresAt: nowMillis + 1 },
    attempt: { uid: "user-a", jobId: "job-a", requestId: "request-a", token, status: "processing", cleanupDueAt: nowMillis + 1 }
  };
}

describe("export attempt authority", () => {
  it("publishes only while every exact-attempt authority agrees", () => {
    expect(exportPublicationBlockReason(valid())).toBeNull();
  });
  it("rejects a successor lease even when the job and admin are unchanged", () => {
    const state = valid();
    state.job.processingLeaseToken = successor;
    expect(ownsExportAttempt(state.job, authority)).toBe(false);
    expect(exportPublicationBlockReason(state)).toBe("EXPORT_ATTEMPT_SUPERSEDED");
  });
  it("rejects a replaced subject fence", () => {
    const state = valid(); state.fence.exportProcessingLeaseToken = successor;
    expect(exportPublicationBlockReason(state)).toBe("EXPORT_FENCE_AUTHORITY_CHANGED");
  });
  it("blocks publication when deletion begins during processing", () => {
    const state = valid(); state.fence.active = true;
    expect(exportPublicationBlockReason(state)).toBe("ACCOUNT_DELETION_FENCED");
  });
  it.each(["job", "fence", "attempt"] as const)("rejects %s expiry at the boundary", (kind) => {
    const state = valid();
    if (kind === "job") state.job.processingLeaseExpiresAt = nowMillis;
    if (kind === "fence") state.fence.exportProcessingLeaseExpiresAt = nowMillis;
    if (kind === "attempt") state.attempt.cleanupDueAt = nowMillis;
    expect(exportPublicationBlockReason(state)).toBe("EXPORT_ATTEMPT_LEASE_EXPIRED");
  });
  it("fails closed on missing metadata and changed owner/request linkage", () => {
    const state = valid(); state.request.uid = "other-user";
    expect(exportPublicationBlockReason(state)).toBe("EXPORT_REQUEST_LINKAGE_CHANGED");
    expect(exportPublicationBlockReason({ ...valid(), attempt: {} })).toBe("EXPORT_ATTEMPT_LEDGER_CHANGED");
  });
  it("gives concurrent attempts disjoint object paths", () => {
    expect(exportAttemptPaths("user-a", "job-a", token).exportPath).not.toBe(exportAttemptPaths("user-a", "job-a", successor).exportPath);
  });
  it.each(["../other", "user/other", "..", ""])("rejects invalid subject identifier %s", (uid) => {
    expect(() => exportAttemptPaths(uid, "job-a", token)).toThrow("Invalid export attempt identifiers");
  });
});
