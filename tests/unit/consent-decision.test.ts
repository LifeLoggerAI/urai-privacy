import { describe, expect, it, vi } from "vitest";
import {
  CONSENT_DECISION_POLICY_VERSION,
  evaluateConsentDecision,
  isRegisteredConsentPurpose,
  runWithConsent
} from "../../functions/src/consent-decision";

const now = new Date("2026-07-06T12:00:00.000Z");
const grantedMemory = {
  uid: "user-expected",
  purpose: "memory.storage",
  consentTier: "C1",
  status: "granted",
  policyVersion: CONSENT_DECISION_POLICY_VERSION,
  expiresAt: "2026-08-06T12:00:00.000Z"
};

const grantedPublicGood = {
  uid: "user-expected",
  purpose: "research.public-good.aggregate",
  consentTier: "C8",
  status: "granted",
  policyVersion: CONSENT_DECISION_POLICY_VERSION,
  expiresAt: "2026-08-06T12:00:00.000Z"
};

describe("canonical consent decision engine", () => {
  it("allows only an exact current grant", () => {
    expect(evaluateConsentDecision({ subjectUid: "user-expected", purpose: "memory.storage", record: grantedMemory, now })).toMatchObject({
      allowed: true,
      reason: "ALLOWED",
      requiredTier: "C1"
    });
  });

  it("allows explicit public-good aggregate research consent", () => {
    expect(evaluateConsentDecision({ subjectUid: "user-expected",
      purpose: "research.public-good.aggregate",
      record: grantedPublicGood,
      now
    })).toMatchObject({
      allowed: true,
      reason: "ALLOWED",
      requiredTier: "C8"
    });
  });

  it("does not let public-good research consent authorize anonymized monetization", () => {
    expect(evaluateConsentDecision({ subjectUid: "user-expected",
      purpose: "data.monetization.anonymized",
      record: grantedPublicGood,
      now
    })).toMatchObject({
      allowed: false,
      reason: "PURPOSE_MISMATCH",
      requiredTier: "C8"
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
    expect(evaluateConsentDecision({ subjectUid: "user-expected", purpose: "memory.storage", record, now })).toMatchObject({ allowed: false, reason });
  });

  it("rejects a granted record for an unrelated owner", () => {
    const result = evaluateConsentDecision({
      subjectUid: "user-expected",
      purpose: "memory.storage",
      record: { ...grantedMemory, uid: "user-unrelated" },
      now
    });
    expect(result).toMatchObject({ allowed: false, reason: "SUBJECT_MISMATCH", requiredTier: "C1" });
  });

  it("fails closed on missing, empty or mismatched subject identity", () => {
    for (const subjectUid of ["", "other-user"]) {
      expect(evaluateConsentDecision({
        subjectUid, purpose: "memory.storage", record: grantedMemory, now
      })).toMatchObject({ allowed: false, reason: "SUBJECT_MISMATCH" });
    }
    expect(evaluateConsentDecision({
      subjectUid: "user-expected",
      purpose: "memory.storage",
      record: { ...grantedMemory, uid: undefined },
      now
    })).toMatchObject({ allowed: false, reason: "SUBJECT_MISMATCH" });
  });

  it("blocks a protected operation on a wrong-owner consent record", async () => {
    const protectedWork = vi.fn(async () => "unexpected");
    await expect(runWithConsent({
      subjectUid: "user-expected",
      purpose: "memory.storage",
      record: { ...grantedMemory, uid: "user-unrelated" },
      now,
      operation: protectedWork
    })).rejects.toThrow("CONSENT_REQUIRED:SUBJECT_MISMATCH");
    expect(protectedWork).not.toHaveBeenCalled();
  });

  it("denies unknown purposes", () => {
    expect(evaluateConsentDecision({ subjectUid: "user-expected", purpose: "provider.unregistered", record: grantedMemory, now })).toMatchObject({
      allowed: false,
      reason: "UNKNOWN_PURPOSE",
      requiredTier: null
    });
  });

  it.each([
    "toString", "constructor", "__proto__", "hasOwnProperty",
    "valueOf", "isPrototypeOf", "propertyIsEnumerable", "toLocaleString"
  ])("rejects inherited prototype name %s even with a matching granted record", (purpose) => {
    expect(isRegisteredConsentPurpose(purpose)).toBe(false);
    expect(evaluateConsentDecision({ subjectUid: "user-expected",
      purpose,
      record: {
        purpose,
        status: "granted",
        policyVersion: CONSENT_DECISION_POLICY_VERSION,
        expiresAt: "2099-01-01T00:00:00.000Z"
      },
      now
    })).toMatchObject({ allowed: false, reason: "UNKNOWN_PURPOSE", requiredTier: null });
  });

  it.each(["SOCIAL_PUBLICATION", "social.publication", "provider.unregistered"])(
    "does not accept unregistered social or provider purpose %s",
    (purpose) => {
      expect(isRegisteredConsentPurpose(purpose)).toBe(false);
      expect(evaluateConsentDecision({ subjectUid: "user-expected",
        purpose,
        record: { ...grantedMemory, purpose },
        now
      })).toMatchObject({ allowed: false, reason: "UNKNOWN_PURPOSE", requiredTier: null });
    }
  );

  it("blocks protected provider work for prototype-inherited purpose", async () => {
    const providerCall = vi.fn(async () => "unsafe");
    await expect(runWithConsent({ subjectUid: "user-expected",
      purpose: "toString",
      record: {
        purpose: "toString", status: "granted",
        policyVersion: CONSENT_DECISION_POLICY_VERSION,
        expiresAt: "2099-01-01T00:00:00.000Z"
      },
      now,
      operation: providerCall
    })).rejects.toThrow("CONSENT_REQUIRED:UNKNOWN_PURPOSE");
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("prevents provider work after a denied decision", async () => {
    const providerCall = vi.fn(async () => "provider-result");
    await expect(runWithConsent({ subjectUid: "user-expected", purpose: "memory.storage", record: { ...grantedMemory, status: "revoked" }, now, operation: providerCall })).rejects.toThrow("CONSENT_REQUIRED:REVOKED");
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("runs protected work after an allowed decision", async () => {
    const protectedWork = vi.fn(async () => "ok");
    await expect(runWithConsent({ subjectUid: "user-expected", purpose: "memory.storage", record: grantedMemory, now, operation: protectedWork })).resolves.toBe("ok");
    expect(protectedWork).toHaveBeenCalledTimes(1);
  });
});
