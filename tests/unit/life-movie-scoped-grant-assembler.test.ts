import { describe, expect, it } from "vitest";
import { assembleLifeMovieScopedGrantProposal } from "../../functions/src/life-movie-scoped-grant-assembler";
import { verifiesLifeMovieScopedReceipt } from "../../functions/src/life-movie-scoped-receipt";

const t = Date.parse("2026-11-01T15:30:00.000Z");
const at = (delta = 0) => new Date(t + delta).toISOString();
const scope = { projectId: "movie-a", renderPlanDigest: "a".repeat(64), sourceSetDigest: "b".repeat(64) };
const notice = { reviewEventId: "notice-event-1", noticeVersion: "notice-v1", noticeHash: "c".repeat(64), policyVersion: "1.1.0", surface: "movie-selection" as const, jurisdiction: "US" };
const approval = { eventId: "approval-event-1", actorUid: "owner-1", ownerUid: "owner-1", tenantId: "tenant-1", purpose: "life-movie.render" as const, status: "granted" as const, noticeVersion: notice.noticeVersion, noticeHash: notice.noticeHash, renderScope: scope, approvedAt: at(-5000), expiresAt: at(3600000) };
const selection = { eventId: "selected-event-1", ownerUid: "owner-1", tenantId: "tenant-1", renderScope: scope, verifiedAt: at(-5000) };
const rights = { rightsEventId: "rights-event-1", ownerUid: "owner-1", tenantId: "tenant-1", renderScope: scope, verifiedAt: at(-5000) };
const base = { ownerUid: "owner-1", tenantId: "tenant-1", notice, approval, selection, rights, nowMs: t };
const deny = (value: unknown) => expect(() => assembleLifeMovieScopedGrantProposal(value as typeof base)).toThrow("life_movie_scoped_grant_evidence_unverified");

describe("source-only Life Movie grant proposal assembly", () => {
  it("constructs an exact scope-bound receipt without issuing a grant", () => {
    const result = assembleLifeMovieScopedGrantProposal(base);
    expect(result.record.renderScope).toEqual(scope);
    expect(verifiesLifeMovieScopedReceipt({ ...result.record, receiptHash: result.receiptHash }, { subjectUid: base.ownerUid, tenantId: base.tenantId, decisionReceiptId: result.receiptHash, renderScope: scope })).toBe(true);
  });
  it.each([
    ["missing evidence", { rights: null }],
    ["wrong owner", { approval: { ...approval, actorUid: "other" } }],
    ["wrong tenant", { rights: { ...rights, tenantId: "other" } }],
    ["wrong movie", { selection: { ...selection, renderScope: { ...scope, projectId: "other" } } }],
    ["wrong source set", { rights: { ...rights, renderScope: { ...scope, sourceSetDigest: "d".repeat(64) } } }],
    ["hidden selection", { selection: { ...selection, renderScope: Object.defineProperty({ ...scope }, "hidden", { value: 1 }) } }],
    ["wrong policy", { notice: { ...notice, policyVersion: "1.0.0" } }],
    ["wrong notice", { approval: { ...approval, noticeHash: "d".repeat(64) } }],
    ["denied approval", { approval: { ...approval, status: "denied" } }],
    ["stale approval", { approval: { ...approval, approvedAt: at(-400000) } }],
    ["future approval", { approval: { ...approval, approvedAt: at(5000) } }],
    ["stale rights", { rights: { ...rights, verifiedAt: at(-40000) } }],
    ["stale selection", { selection: { ...selection, verifiedAt: at(-40000) } }],
    ["expired", { approval: { ...approval, expiresAt: at(-1000) } }],
    ["excessive lifetime", { approval: { ...approval, expiresAt: at(90000000) } }],
    ["missing review", { notice: { ...notice, reviewEventId: "" } }]
  ])("rejects %s", (_name, change) => deny({ ...base, ...change }));
});