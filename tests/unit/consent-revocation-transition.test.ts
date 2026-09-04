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

  it("suppresses replay of an unchanged non-grant and unrelated deletions", () => {
    const revoked = { ...granted, status: "revoked", receiptHash: "d".repeat(64) };
    expect(selectConsentRevocationSource(revoked, { ...revoked })).toBeNull();
    expect(selectConsentRevocationSource({ ...granted, status: "denied" }, null)).toBeNull();
  });
});
