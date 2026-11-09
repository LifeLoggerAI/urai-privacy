import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { crossUserAuthority } from "../../functions/src/cross-user-authority";
import { isRegisteredConsentPurpose } from "../../functions/src/consent-decision";
import { checkedLifeMovieDeletionState } from "../../functions/src/life-movie-deletion-fence";
import { isTrustedActiveJobsConsentCaller, isTrustedJobsConsentCaller } from "../../functions/src/life-movie-jobs-identity";
import { evaluateLifeMovieRenderAuthorization } from "../../functions/src/life-movie-render-authorization";
import { hashLifeMovieScopedReceipt, verifiesLifeMovieScopedReceipt } from "../../functions/src/life-movie-scoped-receipt";

const scope = {
  projectId: "movie-1",
  renderPlanDigest: "a".repeat(64),
  sourceSetDigest: "b".repeat(64)
};
const receipt = {
  uid: "owner-1",
  tenantId: "tenant-1",
  purpose: "life-movie.render" as const,
  consentTier: "C6" as const,
  status: "granted" as const,
  policyVersion: "1.1.0" as const,
  expiresAt: "2099-01-01T00:00:00.000Z",
  surface: "movie-selection",
  jurisdiction: "US",
  noticeVersion: "movie-notice-v1",
  noticeHash: "c".repeat(64),
  evidenceHash: "d".repeat(64),
  renderScope: scope,
  updatedAt: "2026-11-09T10:00:00.000Z"
};
const scopedRecord = { ...receipt, receiptHash: hashLifeMovieScopedReceipt(receipt) };

describe("R27 scoped Life Movie verifier — denial-only integration candidate", () => {
  it("keeps Life Movie purpose out of the canonical registry pending policy approval", () => {
    expect(isRegisteredConsentPurpose("life-movie.render")).toBe(false);
  });

  it("verifies the historical receipt shape and exact owner/tenant/render scope", () => {
    expect(verifiesLifeMovieScopedReceipt(scopedRecord, {
      subjectUid: "owner-1",
      tenantId: "tenant-1",
      decisionReceiptId: scopedRecord.receiptHash,
      renderScope: scope
    })).toBe(true);
    expect(verifiesLifeMovieScopedReceipt(scopedRecord, {
      subjectUid: "owner-2",
      tenantId: "tenant-1",
      decisionReceiptId: scopedRecord.receiptHash,
      renderScope: scope
    })).toBe(false);
    expect(verifiesLifeMovieScopedReceipt(scopedRecord, {
      subjectUid: "owner-1",
      tenantId: "tenant-2",
      decisionReceiptId: scopedRecord.receiptHash,
      renderScope: scope
    })).toBe(false);
    expect(verifiesLifeMovieScopedReceipt(scopedRecord, {
      subjectUid: "owner-1",
      tenantId: "tenant-1",
      decisionReceiptId: scopedRecord.receiptHash,
      renderScope: { ...scope, sourceSetDigest: "e".repeat(64) }
    })).toBe(false);
  });

  it("fails closed on loose, extended or missing render scope fields", () => {
    expect(verifiesLifeMovieScopedReceipt(
      { ...scopedRecord, renderScope: { ...scope, hidden: true } },
      { subjectUid: "owner-1", tenantId: "tenant-1", decisionReceiptId: scopedRecord.receiptHash, renderScope: scope }
    )).toBe(false);
    expect(verifiesLifeMovieScopedReceipt(
      { ...scopedRecord, renderScope: null },
      { subjectUid: "owner-1", tenantId: "tenant-1", decisionReceiptId: scopedRecord.receiptHash, renderScope: scope }
    )).toBe(false);
  });

  it("never returns allow while Life Movie remains unregistered", () => {
    const result = evaluateLifeMovieRenderAuthorization({
      record: scopedRecord,
      deletionActive: false,
      subjectUid: "owner-1",
      tenantId: "tenant-1",
      decisionReceiptId: scopedRecord.receiptHash,
      policyVersion: "1.1.0",
      renderScope: scope,
      now: new Date("2026-11-09T10:30:00.000Z")
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("UNKNOWN_PURPOSE");
  });

  it("treats an absent tombstone as clear but rejects unknown or leased state", () => {
    expect(checkedLifeMovieDeletionState({ exists: false, data: () => { throw Error("not read"); } })).toBe(false);
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => ({ active: true }) })).toBe(true);
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => ({}) })).toBeUndefined();
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => ({ active: false, deletionPlanningLeaseToken: "lease" }) })).toBeUndefined();
    expect(checkedLifeMovieDeletionState({ exists: true, data: () => ({ active: "false" }) })).toBeUndefined();
    expect(checkedLifeMovieDeletionState(undefined)).toBeUndefined();
  });

  it("requires a dedicated own-claims Jobs identity", () => {
    const claims = {
      system: true,
      role: "system",
      consumerId: "urai-jobs",
      firebase: { sign_in_provider: "custom" }
    };
    expect(isTrustedJobsConsentCaller({ uid: "jobs-verifier-uid", token: claims }, "jobs-verifier-uid")).toBe(true);
    expect(isTrustedJobsConsentCaller({ uid: "jobs-verifier-uid", token: { ...claims, consumerId: "studio" } }, "jobs-verifier-uid")).toBe(false);
    const inherited = Object.create({ system: true, role: "system", consumerId: "urai-jobs", firebase: claims.firebase });
    expect(isTrustedJobsConsentCaller({ uid: "jobs-verifier-uid", token: inherited }, "jobs-verifier-uid")).toBe(false);
    expect(isTrustedJobsConsentCaller({ uid: "other-uid", token: claims }, "jobs-verifier-uid")).toBe(false);
  });

  it("rechecks the Jobs bearer with revocation checking", async () => {
    const claims = {
      uid: "jobs-verifier-uid",
      system: true,
      role: "system",
      consumerId: "urai-jobs",
      firebase: { sign_in_provider: "custom" }
    };
    let checkRevoked: boolean | undefined;
    const valid = await isTrustedActiveJobsConsentCaller(
      { uid: claims.uid, token: claims },
      claims.uid,
      "Bearer header.payload.signature",
      async (_token, check) => { checkRevoked = check; return claims; }
    );
    expect(valid).toBe(true);
    expect(checkRevoked).toBe(true);
    const invalid = await isTrustedActiveJobsConsentCaller(
      { uid: claims.uid, token: claims },
      claims.uid,
      "Bearer header.payload.signature",
      async () => { throw new Error("revoked"); }
    );
    expect(invalid).toBe(false);
  });

  it("keeps system cross-user authority bound to own claims", () => {
    expect(crossUserAuthority({ system: true, role: "system", consumerId: "urai-jobs" }))
      .toEqual({ role: "system", consumerId: "urai-jobs" });
    expect(crossUserAuthority(Object.create({ system: true, role: "system", consumerId: "urai-jobs" }))).toBe(null);
  });

  it("routes the generic cross-user consent endpoint through the own-claims guard", () => {
    const api = readFileSync("functions/src/consent-api.ts", "utf8");
    expect(api).toContain("crossUserAuthorityOwnClaims(request.auth?.token)");
    expect(api).not.toContain("function crossUserAuthority(");
  });

  it("exports the verifier only as a denial-only callable, never as a grant writer", () => {
    const api = readFileSync("functions/src/consent-api.ts", "utf8");
    const entry = readFileSync("functions/src/functions-entry.ts", "utf8");
    const start = api.indexOf("export const verifyLifeMovieRenderConsent = onCall");
    expect(start).toBeGreaterThanOrEqual(0);
    const verifier = api.slice(start);
    const identityCheck = verifier.indexOf("isTrustedActiveJobsConsentCaller");
    const parsed = verifier.indexOf("lifeMovieVerificationSchema.safeParse");
    const recordRead = verifier.indexOf("transaction.get(recordRef)");
    const tombstoneRead = verifier.indexOf("transaction.get(tombstoneRef)");
    expect(identityCheck).toBeGreaterThanOrEqual(0);
    expect(parsed).toBeGreaterThan(identityCheck);
    expect(recordRead).toBeGreaterThan(parsed);
    expect(tombstoneRead).toBeGreaterThan(parsed);
    expect(verifier).toContain("const allowed = false");
    expect(verifier).toContain("LIFE_MOVIE_CONSENT_POLICY_NOT_APPROVED");
    expect(verifier).not.toContain("transaction.set(recordRef");
    expect(verifier).not.toContain("transaction.create(recordRef");
    expect(entry).toContain("verifyLifeMovieRenderConsent");
    expect(entry).not.toContain("life-movie-scoped-grant-assembler");
  });
});
