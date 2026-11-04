import { describe, expect, it } from "vitest";
import { hashLifeMovieScopedReceipt, verifiesLifeMovieScopedReceipt } from "../../functions/src/life-movie-scoped-receipt";

const scope = {
  projectId: "movie-1", renderPlanDigest: "a".repeat(64), sourceSetDigest: "b".repeat(64)
};
const receipt = {
  uid: "owner-1", tenantId: "tenant-1", purpose: "life-movie.render" as const,
  consentTier: "C6" as const, status: "granted" as const,
  policyVersion: "1.1.0" as const, expiresAt: "2026-11-30T15:00:00.000Z",
  surface: "movie-selection", jurisdiction: "US", noticeVersion: "movie-notice-v1",
  noticeHash: "c".repeat(64), evidenceHash: "d".repeat(64), renderScope: scope,
  updatedAt: "2026-11-01T14:00:00.000Z"
};
const record = { ...receipt, receiptHash: hashLifeMovieScopedReceipt(receipt) };
const expected = {
  subjectUid: receipt.uid, tenantId: receipt.tenantId,
  decisionReceiptId: record.receiptHash, renderScope: scope
};
const verifies = (candidate: unknown, request: typeof expected = expected) =>
  verifiesLifeMovieScopedReceipt(candidate, request);

// This is integrity-only testing: it never authenticates a real owner or issues consent.
describe("R454 scoped receipt exact own-data boundary (review-only)", () => {
  it("accepts an exact ordinary receipt", () => expect(verifies(record)).toBe(true));
  it("accepts plain Firestore-like null-prototype data", () => {
    const s = Object.assign(Object.create(null), scope);
    const r = Object.assign(Object.create(null), record, { renderScope: s });
    expect(verifies(r)).toBe(true);
  });

  it.each([
    ["surplus root authority field", { ...record, forceGrant: true }],
    ["unreviewed root metadata", { ...record, metadata: "ignored" }],
    ["hidden root symbol", { ...record, [Symbol("override")]: true }],
    ["inherited root metadata", Object.assign(Object.create({ bypass: true }), record)],
    ["accessor-backed owner", Object.defineProperty({ ...record }, "uid", {
      enumerable: true, get: () => receipt.uid
    })],
    ["accessor-backed receipt hash", Object.defineProperty({ ...record }, "receiptHash", {
      enumerable: true, get: () => record.receiptHash
    })],
    ["accessor-backed evidence hash", Object.defineProperty({ ...record }, "evidenceHash", {
      enumerable: true, get: () => receipt.evidenceHash
    })],
    ["accessor-backed nested movie", { ...record, renderScope: Object.defineProperty({ ...scope }, "projectId", {
      enumerable: true, get: () => scope.projectId
    }) }],
    ["inherited nested scope", { ...record, renderScope: Object.assign(Object.create({ bypass: true }), scope) }],
    ["symbol in movie scope", { ...record, renderScope: { ...scope, [Symbol("extra")]: true } }],
    ["revoked grant", { ...record, status: "revoked" }],
    ["foreign tenant", { ...record, tenantId: "tenant-2" }],
    ["different selected sources", { ...record, renderScope: { ...scope, sourceSetDigest: "e".repeat(64) } }]
  ])("denies %s", (_name, candidate) => expect(verifies(candidate)).toBe(false));

  it("rejects getters on expected owner evidence without evaluating them", () => {
    let getterCalls = 0;
    const request = Object.defineProperty({ ...expected }, "tenantId", {
      enumerable: true, get: () => { getterCalls++; return expected.tenantId; }
    });
    expect(verifies(record, request)).toBe(false);
    expect(getterCalls).toBe(0);
  });
  it("rejects an unexpected expected-scope field", () => {
    const malicious = { ...expected, renderScope: { ...scope, force: true } };
    expect(verifies(record, malicious)).toBe(false);
  });
  it("turns hostile proxy traps into a denial, never a thrown error", () => {
    const hostile = new Proxy(record, { ownKeys: () => { throw new Error("hostile trap"); } });
    expect(verifies(hostile)).toBe(false);
  });
});
