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

  it.each([
    ["owner", "uid", "subject-other"],
    ["purpose", "purpose", "data.export"],
    ["tier", "consentTier", "C7"],
    ["policy version", "policyVersion", "1.1.0"]
  ])("revokes the preceding owner-bound grant when %s changes", (_label, field, value) => {
    for (const status of ["granted", "denied", "revoked"]) {
      const replacement = { ...granted, [field]: value, status, receiptHash: "e".repeat(64) };
      expect(selectConsentRevocationSource(granted, replacement)).toEqual(granted);
    }
  });

  it("uses the new receipt only for same-identity grant-to-denied transitions", () => {
    const replacement = { ...granted, status: "denied", receiptHash: "f".repeat(64) };
    expect(selectConsentRevocationSource(granted, replacement)).toEqual(replacement);
  });

  it("does not interpret unchanged-identity grant renewal as revocation", () => {
    const replacement = { ...granted, status: "granted", receiptHash: "f".repeat(64) };
    expect(selectConsentRevocationSource(granted, replacement)).toBeNull();
  });

  it("suppresses replay of an unchanged non-grant and unrelated deletions", () => {
    const revoked = { ...granted, status: "revoked", receiptHash: "d".repeat(64) };
    expect(selectConsentRevocationSource(revoked, { ...revoked })).toBeNull();
    expect(selectConsentRevocationSource({ ...granted, status: "denied" }, null)).toBeNull();
  });
});
