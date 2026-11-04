import { describe, expect, it } from "vitest";
import { checkedLifeMovieDeletionState } from "../../functions/src/life-movie-deletion-fence";
import { hashLifeMovieScopedReceipt } from "../../functions/src/life-movie-scoped-receipt";
import { evaluateLifeMovieRenderAuthorization } from "../../functions/src/life-movie-render-authorization";

const now = new Date("2026-11-01T15:00:00.000Z");
const scope = { projectId: "movie-1", renderPlanDigest: "a".repeat(64), sourceSetDigest: "b".repeat(64) };
const receipt = {
  uid: "owner-1", tenantId: "tenant-1",
  purpose: "life-movie.render" as const, consentTier: "C6" as const,
  status: "granted" as const, policyVersion: "1.1.0" as const,
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

  // A TypeScript boolean is not proof that the caller actually checked the
  // current deletion fence: untrusted runtime values must fail closed.
  it.each([
    ["missing", undefined],
    ["null", null],
    ["number zero", 0],
    ["string false", "false"],
    ["string true", "true"],
    ["empty object", {}],
    ["empty array", []]
  ])("denies unverified deletion state: %s", (_description, deletionState) => {
    const result = evaluateLifeMovieRenderAuthorization({
      ...base,
      deletionActive: deletionState as unknown as boolean
    });
    expect(result).toMatchObject({
      allowed: false,
      reason: "ACCOUNT_DELETION_STATE_UNVERIFIED"
    });
  });

  it.each([
    ["transactionally verified absence", { exists: false, data: () => { throw Error("missing must not call data"); } }, false, "ALLOWED"],
    ["verified inactive tombstone", { exists: true, data: () => ({ active: false }) }, false, "ALLOWED"],
    ["active deletion", { exists: true, data: () => ({ active: true }) }, true, "ACCOUNT_DELETED"],
    ["present tombstone with missing active", { exists: true, data: () => ({}) }, undefined, "ACCOUNT_DELETION_STATE_UNVERIFIED"],
    ["planning lease without active", { exists: true, data: () => ({ deletionPlanningLeaseToken: "lease" }) }, undefined, "ACCOUNT_DELETION_STATE_UNVERIFIED"],
    ["false with unfinished planning lease", { exists: true, data: () => ({ active: false, deletionPlanningLeaseUntil: 1000 }) }, undefined, "ACCOUNT_DELETION_STATE_UNVERIFIED"],
    ["string false is not clearance", { exists: true, data: () => ({ active: "false" }) }, undefined, "ACCOUNT_DELETION_STATE_UNVERIFIED"],
    ["numeric zero is not clearance", { exists: true, data: () => ({ active: 0 }) }, undefined, "ACCOUNT_DELETION_STATE_UNVERIFIED"],
    ["null is not clearance", { exists: true, data: () => ({ active: null }) }, undefined, "ACCOUNT_DELETION_STATE_UNVERIFIED"],
    ["unverified snapshot status", { exists: "false", data: () => ({ active: false }) }, undefined, "ACCOUNT_DELETION_STATE_UNVERIFIED"]
  ])("keeps transactional deletion state closed: %s", (_name, snapshot, expected, reason) => {
    const deletionActive = checkedLifeMovieDeletionState(snapshot as never);
    expect({ deletionActive }).toMatchObject({ deletionActive: expected });
    const decision = evaluateLifeMovieRenderAuthorization({ ...base, deletionActive });
    expect(decision).toMatchObject({ allowed: reason === "ALLOWED", reason });
  });


  // The development-only Firestore issuer adapter writes reviewOnlyEmulator
  // and productionAuthorized metadata into the same collection. Such
  // correctly hashed synthetic candidates are NEVER real render permission.
  it.each([
    ["review-only candidate", { ...record, reviewOnlyEmulator: true, productionAuthorized: false }],
    ["false review-only tag", { ...record, reviewOnlyEmulator: false }],
    ["explicitly denied production tag", { ...record, productionAuthorized: false }],
    ["caller-asserted production tag", { ...record, productionAuthorized: true }]
  ])("denies %s, even with valid C6 receipt hash", (_label, document) => {
    expect(evaluateLifeMovieRenderAuthorization({ ...base, record: document })).toMatchObject({
      allowed: false, reason: "REVIEW_ONLY_EVIDENCE"
    });
  });

  it("rejects inherited review-only marker without invoking its getter", () => {
    let getterCalls = 0;
    const prototype = Object.defineProperty({}, "reviewOnlyEmulator", {
      get() { getterCalls++; throw new Error("marker getter must not execute"); }
    });
    const inherited = Object.assign(Object.create(prototype), record);
    expect(evaluateLifeMovieRenderAuthorization({ ...base, record: inherited })).toMatchObject({
      allowed: false, reason: "REVIEW_ONLY_EVIDENCE"
    });
    expect(getterCalls).toBe(0);
  });

  it("preserves revocation reason priority for a review-only tagged record", () => {
    expect(evaluateLifeMovieRenderAuthorization({
      ...base, record: { ...record, reviewOnlyEmulator: true, status: "revoked" }
    })).toMatchObject({ allowed: false, reason: "REVOKED" });
  });

});