import { describe, it, expect } from "vitest";
import { assembleLifeMovieScopedGrantProposal } from "../../functions/src/life-movie-scoped-grant-assembler";
import { evaluateLifeMovieRenderAuthorization } from "../../functions/src/life-movie-render-authorization";

const time = Date.parse("2026-11-02T15:00:00.000Z");
const when = (delta: number) => new Date(time + delta).toISOString();
const scope = { projectId: "movie-1", renderPlanDigest: "a".repeat(64), sourceSetDigest: "b".repeat(64) };
const notice = { reviewEventId: "notice-event-1", noticeVersion: "notice-v1", noticeHash: "c".repeat(64), policyVersion: "1.1.0", surface: "movie-selection" as const, jurisdiction: "US" };
const approval = { eventId: "approval-event-1", actorUid: "owner-1", ownerUid: "owner-1", tenantId: "tenant-1", purpose: "life-movie.render" as const, status: "granted" as const, noticeVersion: notice.noticeVersion, noticeHash: notice.noticeHash, renderScope: scope, approvedAt: when(-5000), expiresAt: when(3600000) };
const selection = { eventId: "selection-event-1", ownerUid: "owner-1", tenantId: "tenant-1", renderScope: scope, verifiedAt: when(-5000) };
const rights = { rightsEventId: "rights-event-1", ownerUid: "owner-1", tenantId: "tenant-1", renderScope: scope, verifiedAt: when(-5000) };
const evidence = { ownerUid: "owner-1", tenantId: "tenant-1", notice, approval, selection, rights, nowMs: time };

function candidate() {
  const result = assembleLifeMovieScopedGrantProposal(evidence);
  const record = { ...result.record, receiptHash: result.receiptHash };
  return { record, base: { record, subjectUid: evidence.ownerUid, tenantId: evidence.tenantId, renderScope: scope, decisionReceiptId: result.receiptHash, policyVersion: "1.1.0", deletionActive: false, now: new Date(time) } };
}

describe("candidate grant proposal -> verifier lifecycle (pure, never issuer)", () => {
  it("accepts matching candidate for pure evaluation, without persisting or issuing it", () => {
    const { base } = candidate();
    expect(evaluateLifeMovieRenderAuthorization(base)).toMatchObject({allowed:true,reason:"ALLOWED"});
  });

  it.each([
    ["active deletion", { deletionActive: true }, "ACCOUNT_DELETED"],
    ["revoked candidate", { record: { ...candidate().record, status: "revoked" } }, "REVOKED"],
    ["denied candidate", { record: { ...candidate().record, status: "denied" } }, "DENIED"],
    ["expired candidate", { now: new Date(time + 3600001) }, "EXPIRED"],
    ["different owner", { subjectUid: "owner-2" }, "SUBJECT_MISMATCH"],
    ["different tenant", { tenantId: "tenant-2" }, "SCOPED_RECEIPT_INTEGRITY_MISMATCH"],
    ["different movie", { renderScope: { ...scope, projectId: "movie-2" } }, "RENDER_SCOPE_MISMATCH"],
    ["different plan", { renderScope: { ...scope, renderPlanDigest: "d".repeat(64) } }, "RENDER_SCOPE_MISMATCH"],
    ["different source generations fingerprint", { renderScope: { ...scope, sourceSetDigest: "d".repeat(64) } }, "RENDER_SCOPE_MISMATCH"],
    ["wrong receipt ID", { decisionReceiptId: "d".repeat(64) }, "RECEIPT_MISMATCH"],
    ["wrong policy", { policyVersion: "1.0.0" }, "POLICY_VERSION_MISMATCH"]
  ])("rejects %s", (_name, change, reason) => {
    const { base } = candidate();
    expect(evaluateLifeMovieRenderAuthorization({ ...base, ...change })).toMatchObject({allowed:false,reason});
  });

  it("does not treat a recomputed receipt hash as authority after source rights evidence changes", () => {
    const { record, base } = candidate();
    const altered = { ...record, renderScope: { ...scope, sourceSetDigest: "0".repeat(64) } };
    expect(evaluateLifeMovieRenderAuthorization({ ...base, record: altered })).toMatchObject({allowed:false});
  });
});
