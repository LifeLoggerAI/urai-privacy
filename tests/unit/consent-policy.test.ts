import { describe, expect, it } from "vitest";
import {
  CONSENT_POLICY_VERSION,
  evaluateConsentDecision,
  getConsentPurpose
} from "../../functions/src/consent-policy";

const future = "2099-01-01T00:00:00.000Z";
const now = "2026-07-06T06:00:00.000Z";

function grantedRecord(overrides: Record<string, unknown> = {}) {
  return {
    uid: "user-1",
    purpose: "ai_insights",
    consentTier: "C4",
    status: "granted",
    policyVersion: CONSENT_POLICY_VERSION,
    expiresAt: future,
    receiptHash: "receipt-hash",
    ...overrides
  };
}

describe("consent policy", () => {
  it("registers the public consent purpose and exact tier", () => {
    expect(getConsentPurpose("ai_insights")).toMatchObject({
      purpose: "ai_insights",
      consentTier: "C4"
    });
  });

  it("allows only a current exact-purpose grant", () => {
    expect(
      evaluateConsentDecision({
        subjectUid: "user-1",
        purpose: "ai_insights",
        requestedTier: "C4",
        record: grantedRecord(),
        evaluatedAt: now
      })
    ).toMatchObject({ allowed: true, reason: "ALLOWED", requiredTier: "C4" });
  });

  it.each([
    ["unknown purpose", "unknown", "C4", grantedRecord(), "UNKNOWN_PURPOSE"],
    ["wrong requested tier", "ai_insights", "C3", grantedRecord(), "REQUESTED_TIER_MISMATCH"],
    ["missing record", "ai_insights", "C4", null, "MISSING_CONSENT"],
    ["wrong subject", "ai_insights", "C4", grantedRecord({ uid: "other" }), "SUBJECT_MISMATCH"],
    ["wrong purpose", "ai_insights", "C4", grantedRecord({ purpose: "gps_context" }), "PURPOSE_MISMATCH"],
    ["denied", "ai_insights", "C4", grantedRecord({ status: "denied" }), "STATUS_NOT_GRANTED"],
    ["revoked", "ai_insights", "C4", grantedRecord({ status: "revoked" }), "STATUS_NOT_GRANTED"],
    ["wrong record tier", "ai_insights", "C4", grantedRecord({ consentTier: "C3" }), "CONSENT_TIER_MISMATCH"],
    ["stale policy", "ai_insights", "C4", grantedRecord({ policyVersion: "0.1.0-draft" }), "POLICY_VERSION_MISMATCH"],
    ["missing receipt", "ai_insights", "C4", grantedRecord({ receiptHash: null }), "MISSING_RECEIPT_HASH"],
    ["missing expiry", "ai_insights", "C4", grantedRecord({ expiresAt: null }), "MISSING_EXPIRY"],
    ["expired", "ai_insights", "C4", grantedRecord({ expiresAt: "2026-01-01T00:00:00.000Z" }), "EXPIRED"]
  ])("denies %s", (_label, purpose, requestedTier, record, reason) => {
    expect(
      evaluateConsentDecision({
        subjectUid: "user-1",
        purpose,
        requestedTier,
        record,
        evaluatedAt: now
      })
    ).toMatchObject({ allowed: false, reason });
  });
});
