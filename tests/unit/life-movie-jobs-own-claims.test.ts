import { describe, expect, it } from "vitest";
import { isTrustedActiveJobsConsentCaller, isTrustedJobsConsentCaller } from "../../functions/src/life-movie-jobs-identity";

const dedicatedUid = "jobs-system-001";
const claims = { system: true, role: "system", consumerId: "urai-jobs", firebase: { sign_in_provider: "custom" } };
const identity = { uid: dedicatedUid, token: claims };
const bearer = "Bearer AAA.BBB.CCC";

describe("dedicated Jobs consent identity requires own verified claims", () => {
  it("accepts valid owned claims", () => {
    expect(isTrustedJobsConsentCaller(identity, dedicatedUid)).toBe(true);
  });
  it("rejects all inherited privileged claims", () => {
    expect(isTrustedJobsConsentCaller({ uid: dedicatedUid, token: Object.create(claims) }, dedicatedUid)).toBe(false);
  });
  it("rejects inherited Firebase provider", () => {
    const provider = Object.create({ sign_in_provider: "custom" });
    expect(isTrustedJobsConsentCaller({ uid: dedicatedUid, token: { ...claims, firebase: provider } }, dedicatedUid)).toBe(false);
  });
  it("rejects each independently inherited role claim", () => {
    for (const key of ["system", "role", "consumerId", "firebase"] as const) {
      const candidate: Record<string, unknown> = { ...claims };
      delete candidate[key];
      Object.setPrototypeOf(candidate, { [key]: claims[key] });
      expect(isTrustedJobsConsentCaller({ uid: dedicatedUid, token: candidate }, dedicatedUid)).toBe(false);
    }
  });
  it("rejects inherited token envelope or UID", () => {
    expect(isTrustedJobsConsentCaller(Object.create(identity), dedicatedUid)).toBe(false);
    expect(isTrustedJobsConsentCaller(Object.assign(Object.create({ uid: dedicatedUid }), { token: claims }), dedicatedUid)).toBe(false);
    expect(isTrustedJobsConsentCaller(Object.assign(Object.create({ token: claims }), { uid: dedicatedUid }), dedicatedUid)).toBe(false);
  });
  it("rejects arrays masquerading as token claims", () => {
    const candidate = Object.assign([] as unknown[], claims) as unknown as Record<string, unknown>;
    expect(isTrustedJobsConsentCaller({ uid: dedicatedUid, token: candidate }, dedicatedUid)).toBe(false);
  });
  it("accepts own claims in a null-prototype record", () => {
    expect(isTrustedJobsConsentCaller({ uid: dedicatedUid, token: Object.assign(Object.create(null), claims) }, dedicatedUid)).toBe(true);
  });
  it("rejects inherited system claims after token revocation recheck", async () => {
    let calls = 0;
    const verifier = async (_token: string, checkRevoked: boolean) => {
      calls++;
      expect(checkRevoked).toBe(true);
      return Object.assign(Object.create(claims), { uid: dedicatedUid });
    };
    expect(await isTrustedActiveJobsConsentCaller(identity, dedicatedUid, bearer, verifier)).toBe(false);
    expect(calls).toBe(1);
  });
  it("rejects inherited UID after token recheck", async () => {
    const result = Object.assign(Object.create({ uid: dedicatedUid }), claims);
    expect(await isTrustedActiveJobsConsentCaller(identity, dedicatedUid, bearer, async () => result)).toBe(false);
  });
  it("accepts valid own UID and verified role claims after recheck", async () => {
    expect(await isTrustedActiveJobsConsentCaller(identity, dedicatedUid, bearer, async () => ({ uid: dedicatedUid, ...claims }))).toBe(true);
  });
});
