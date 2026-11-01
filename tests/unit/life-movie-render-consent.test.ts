import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONSENT_DECISION_POLICY_VERSION,
  LIFE_MOVIE_RENDER_CONSENT_POLICY_VERSION,
  LIFE_MOVIE_RENDER_CONSENT_PURPOSE,
  evaluateConsentDecision, policyVersionForPurpose, matchesLifeMovieRenderScope
} from "../../functions/src/consent-decision";

const now = new Date("2026-11-01T08:00:00.000Z");
const grant = {
  uid: "subject-1",
  purpose: LIFE_MOVIE_RENDER_CONSENT_PURPOSE,
  consentTier: "C6",
  status: "granted",
  policyVersion: LIFE_MOVIE_RENDER_CONSENT_POLICY_VERSION,
  expiresAt: "2026-12-01T08:00:00.000Z"
};

describe("separate Life Movie render grant", () => {
  it("registers a separate C6 render purpose, without upgrading ordinary preferences", () => {
    expect(policyVersionForPurpose(LIFE_MOVIE_RENDER_CONSENT_PURPOSE)).toBe(LIFE_MOVIE_RENDER_CONSENT_POLICY_VERSION);
    expect(policyVersionForPurpose("ai.personalization")).toBe(CONSENT_DECISION_POLICY_VERSION);
    expect(evaluateConsentDecision({ purpose: LIFE_MOVIE_RENDER_CONSENT_PURPOSE, record: grant, now })).toMatchObject({
      allowed: true, requiredTier: "C6", policyVersion: LIFE_MOVIE_RENDER_CONSENT_POLICY_VERSION
    });
  });
  it.each([
    ["storage consent", { ...grant, purpose: "memory.storage" }, "PURPOSE_MISMATCH"],
    ["personalization consent", { ...grant, purpose: "ai.personalization" }, "PURPOSE_MISMATCH"],
    ["revoked", { ...grant, status: "revoked" }, "REVOKED"],
    ["denied", { ...grant, status: "denied" }, "DENIED"],
    ["stale version", { ...grant, policyVersion: CONSENT_DECISION_POLICY_VERSION }, "POLICY_VERSION_MISMATCH"],
    ["wrong tier", { ...grant, consentTier: "C1" }, "TIER_MISMATCH"],
    ["expired", { ...grant, expiresAt: "2026-10-01T00:00:00.000Z" }, "EXPIRED"]
  ])("rejects %s", (_label, record, reason) => {
    expect(evaluateConsentDecision({ purpose: LIFE_MOVIE_RENDER_CONSENT_PURPOSE, record, now }))
      .toMatchObject({ allowed: false, reason });
  });
  it("rejects absent grants", () => {
    expect(evaluateConsentDecision({ purpose: LIFE_MOVIE_RENDER_CONSENT_PURPOSE, record: null, now }))
      .toMatchObject({ allowed: false, reason: "MISSING_CONSENT" });
  });
});


describe("Life Movie movie/source scope fence", () => {
  const requestedScope = {
    projectId: "movie-owner-one",
    renderPlanDigest: "a".repeat(64),
    sourceSetDigest: "b".repeat(64)
  };
  it("matches only an exact, own-field scope", () => {
    expect(matchesLifeMovieRenderScope({ ...requestedScope }, requestedScope)).toBe(true);
    expect(matchesLifeMovieRenderScope(null, requestedScope)).toBe(false);
    expect(matchesLifeMovieRenderScope({ ...requestedScope, sourceSetDigest: "c".repeat(64) }, requestedScope)).toBe(false);
    expect(matchesLifeMovieRenderScope({ ...requestedScope, projectId: "different-movie" }, requestedScope)).toBe(false);
    expect(matchesLifeMovieRenderScope(Object.create(requestedScope), requestedScope)).toBe(false);
  });
  it("does not allow purpose-wide grant issuance or verification without matching stored selection", () => {
    const source = readFileSync(new URL("../../functions/src/consent-api.ts", import.meta.url), "utf8");
    expect(source).toContain('purpose === LIFE_MOVIE_RENDER_CONSENT_PURPOSE && parsed.data.status === "granted"');
    expect(source).toContain("const scopeMatches = matchesLifeMovieRenderScope(record?.renderScope, renderScope)");
    expect(source).toContain("evaluated.allowed && receiptMatches && subjectMatches && scopeMatches && policyMatches && !deleted");
    expect(source).toContain('RENDER_SCOPE_MISMATCH');
    const ui = readFileSync(new URL("../../app/privacy-center/consent/page.tsx", import.meta.url), "utf8");
    expect(ui).toContain('item.purpose === "life-movie.render"');
    expect(ui).toContain("movie-specific media selection and authorization flow");
  });
});

describe("canonical Life Movie audit receipt policy linkage", () => {
  it("records the purpose-specific receipt policy version in consent-update audit metadata", () => {
    const source = readFileSync(new URL("../../functions/src/consent-api.ts", import.meta.url), "utf8");
    const auditMetadata = source.match(/action: "canonical_consent_updated"[\s\S]*?metadata: \{([\s\S]*?)\n      \},/);
    expect(auditMetadata?.[1]).toContain("policyVersion: receipt.policyVersion");
    expect(auditMetadata?.[1]).not.toContain("policyVersion: CONSENT_DECISION_POLICY_VERSION");
  });
});
