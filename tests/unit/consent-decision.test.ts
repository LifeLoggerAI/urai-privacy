import { describe, expect, it, vi } from "vitest";
import {
  CONSENT_DECISION_POLICY_VERSION,
  evaluateConsentDecision,
  runWithConsent
} from "../../functions/src/consent-decision";

const now = new Date("2026-07-06T12:00:00.000Z");
const grantedMemory = {
  purpose: "memory.storage",
  consentTier: "C1",
  status: "granted",
  policyVersion: CONSENT_DECISION_POLICY_VERSION,
  expiresAt: "2026-08-06T12:00:00.000Z"
};

describe("canonical consent decision engine", () => {
  it("allows only an exact current grant", () => {
    expect(evaluateConsentDecision({ purpose: "memory.storage", record: grantedMemory, now })).toMatchObject({
      allowed: true,
      reason: "ALLOWED",
      requiredTier: "C1"
    });
  });

  it.each([
    ["missing", null, "MISSING_CONSENT"],
    ["denied", { ...grantedMemory, status: "denied" }, "DENIED"],
    ["revoked", { ...grantedMemory, status: "revoked" }, "REVOKED"],
    ["expired status", { ...grantedMemory, status: "expired" }, "EXPIRED"],
    ["expired timestamp", { ...grantedMemory, expiresAt: "2026-07-06T11:59:59.000Z" }, "EXPIRED"],
    ["missing expiry", { ...grantedMemory, expiresAt: null }, "EXPIRED"],
    ["wrong tier", { ...grantedMemory, consentTier: "C4" }, "TIER_MISMATCH"],
    ["wrong policy", { ...grantedMemory, policyVersion: "0.1.0-draft" }, "POLICY_VERSION_MISMATCH"],
    ["wrong purpose", { ...grantedMemory, purpose: "location.context" }, "PURPOSE_MISMATCH"]
  ])("denies %s consent", (_label, record, reason) => {
    expect(evaluateConsentDecision({ purpose: "memory.storage", record, now })).toMatchObject({ allowed: false, reason });
  });

  it("denies unknown purposes", () => {
    expect(evaluateConsentDecision({ purpose: "provider.unregistered", record: grantedMemory, now })).toMatchObject({
      allowed: false,
      reason: "UNKNOWN_PURPOSE",
      requiredTier: null
    });
  });

  it("prevents provider work after a denied decision", async () => {
    const providerCall = vi.fn(async () => "provider-result");
    await expect(runWithConsent({ purpose: "memory.storage", record: { ...grantedMemory, status: "revoked" }, now, operation: providerCall })).rejects.toThrow("CONSENT_REQUIRED:REVOKED");
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("runs protected work after an allowed decision", async () => {
    const protectedWork = vi.fn(async () => "ok");
    await expect(runWithConsent({ purpose: "memory.storage", record: grantedMemory, now, operation: protectedWork })).resolves.toBe("ok");
    expect(protectedWork).toHaveBeenCalledTimes(1);
  });
});
