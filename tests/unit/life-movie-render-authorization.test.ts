import { describe, expect, it } from "vitest";
import { hashLifeMovieScopedReceipt } from "../../functions/src/life-movie-scoped-receipt";
import { evaluateLifeMovieRenderAuthorization } from "../../functions/src/life-movie-render-authorization";

const now = new Date("2026-11-01T15:00:00.000Z");
const scope = { projectId: "movie-1", renderPlanDigest: "a".repeat(64), sourceSetDigest: "b".repeat(64) };
const receipt = {
  uid: "owner-1", tenantId: "tenant-1",
  purpose: "life-movie.render" as const, consentTier: "C6" as const,
  status: "granted" as const, policyVersion: "1.1.0",
  expiresAt: "2026-11-30T15:00:00.000Z",
  surface: "movie-selection", jurisdiction: "US",
  noticeVersion: "movie-notice-v1", noticeHash: "c".repeat(64),
  evidenceHash: "d".repeat(64), renderScope: scope,
  updatedAt: "2026-11-01T14:00:00.000Z"
};
const record = { ...receipt, receiptHash: hashLifeMovieScopedReceipt(receipt) };
const base = {
  record, deletionActive: false, subjectUid: "owner-1", tenantId: "tenant-1",
  decisionReceiptId: record.receiptHash, policyVersion: "1.1.0",
  renderScope: scope, now
};

describe("pure Life Movie scoped verifier authorization", () => {
  it("matches the exact owner/tenant/selection/receipt only", () => {
    expect(evaluateLifeMovieRenderAuthorization(base)).toMatchObject({ allowed: true, reason: "ALLOWED" });
  });
  it.each([
    ["deletion", { deletionActive: true }, "ACCOUNT_DELETED"],
    ["revoked", { record: { ...record, status: "revoked" } }, "REVOKED"],
    ["denied", { record: { ...record, status: "denied" } }, "DENIED"],
    ["expired", { now: new Date("2026-12-01T15:00:00.000Z") }, "EXPIRED"],
    ["missing", { record: null }, "MISSING_CONSENT"],
    ["wrong purpose", { record: { ...record, purpose: "ai.personalization" } }, "PURPOSE_MISMATCH"],
    ["wrong owner", { subjectUid: "owner-2" }, "SUBJECT_MISMATCH"],
    ["wrong tenant", { tenantId: "tenant-2" }, "SCOPED_RECEIPT_INTEGRITY_MISMATCH"],
    ["wrong source set", { renderScope: { ...scope, sourceSetDigest: "e".repeat(64) } }, "RENDER_SCOPE_MISMATCH"],
    ["wrong movie", { renderScope: { ...scope, projectId: "movie-2" } }, "RENDER_SCOPE_MISMATCH"],
    ["wrong plan", { renderScope: { ...scope, renderPlanDigest: "e".repeat(64) } }, "RENDER_SCOPE_MISMATCH"],
    ["wrong policy", { policyVersion: "1.0.0" }, "POLICY_VERSION_MISMATCH"],
    ["wrong receipt", { decisionReceiptId: "f".repeat(64) }, "RECEIPT_MISMATCH"],
    ["mutated notice", { record: { ...record, noticeHash: "f".repeat(64) } }, "SCOPED_RECEIPT_INTEGRITY_MISMATCH"],
    ["hidden scope", { record: { ...record, renderScope: Object.defineProperty({ ...scope }, "hidden", { value: true }) } }, "RENDER_SCOPE_MISMATCH"]
  ])("denies %s", (_name, change, reason) => {
    expect(evaluateLifeMovieRenderAuthorization({ ...base, ...change })).toMatchObject({ allowed: false, reason });
  });
});