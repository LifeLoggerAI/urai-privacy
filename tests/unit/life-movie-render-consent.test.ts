import { describe, expect, it } from "vitest";
import {
  CONSENT_DECISION_POLICY_VERSION,
  LIFE_MOVIE_RENDER_CONSENT_POLICY_VERSION,
  LIFE_MOVIE_RENDER_CONSENT_PURPOSE,
  canonicalConsentAuditMetadata, evaluateConsentDecision, policyVersionForPurpose
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
  it("keeps canonical audit metadata on the exact purpose-specific policy", () => {
    const input = {
      purpose: LIFE_MOVIE_RENDER_CONSENT_PURPOSE,
      status: "granted" as const,
      consentTier: "C6" as const,
      consentRecordId: "owner_life-movie_render",
      consentEventId: "consent-event-1",
      evidenceHash: "a".repeat(64),
      updatedAt: now.toISOString()
    };
    expect(canonicalConsentAuditMetadata(input)).toMatchObject({
      ...input,
      policyVersion: LIFE_MOVIE_RENDER_CONSENT_POLICY_VERSION
    });
    expect(canonicalConsentAuditMetadata({
      ...input, purpose: "ai.personalization"
    }).policyVersion).toBe(CONSENT_DECISION_POLICY_VERSION);
  });
});
