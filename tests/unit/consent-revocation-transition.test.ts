import { describe, expect, it } from "vitest";
import { selectConsentRevocationSource } from "../../functions/src/consent-revocation-transition";

const granted = {
  uid: "subject-1",
  purpose: "memory.storage",
  consentTier: "C1",
  policyVersion: "2026-07-06",
  receiptHash: "a".repeat(64),
  status: "granted"
};

describe("consent revocation transition selection", () => {
  it("derives a deletion revocation from the last canonical grant", () => {
    expect(selectConsentRevocationSource(granted, null)).toEqual(granted);
  });

  it("publishes a granted-to-denied transition from the replacement record", () => {
    const denied = { ...granted, status: "denied", receiptHash: "b".repeat(64) };
    expect(selectConsentRevocationSource(granted, denied)).toEqual(denied);
  });

  it("publishes an explicit revocation", () => {
    const revoked = { ...granted, status: "revoked", receiptHash: "c".repeat(64) };
    expect(selectConsentRevocationSource(null, revoked)).toEqual(revoked);
  });

  it("keeps the prior valid grant when a replacement is malformed", () => {
    const malformedReplacements = [
      {},
      { ...granted, status: "denied", receiptHash: "invalid" },
      { ...granted, status: "denied", uid: "another-owner", receiptHash: "b".repeat(64) },
      { ...granted, status: "granted", uid: "another-owner", receiptHash: "b".repeat(64) },
      { ...granted, status: "granted", receiptHash: "not-hex" },
    ];
    for (const successor of malformedReplacements) {
      expect(selectConsentRevocationSource(granted, successor)).toEqual(granted);
    }
  });

  it("keeps successful renewal suppressing revocation for the same authority", () => {
    const renewed = { ...granted, status: "granted", receiptHash: "c".repeat(64) };
    expect(selectConsentRevocationSource(granted, renewed)).toBeNull();
  });

  it("does not suppress revocation when a newer grant changes the purpose", () => {
    const crossPurpose = { ...granted, purpose: "location.context", receiptHash: "d".repeat(64) };
    expect(selectConsentRevocationSource(granted, crossPurpose)).toEqual(granted);
  });

  it("suppresses replay of an unchanged non-grant and unrelated deletions", () => {
    const revoked = { ...granted, status: "revoked", receiptHash: "d".repeat(64) };
    expect(selectConsentRevocationSource(revoked, { ...revoked })).toBeNull();
    expect(selectConsentRevocationSource({ ...granted, status: "denied" }, null)).toBeNull();
  });
});
