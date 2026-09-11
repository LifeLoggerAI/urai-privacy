import { describe, expect, it } from "vitest";
import {
  MAX_CONSENT_GRANT_TTL_MS,
  resolveConsentExpiry
} from "../../functions/src/consent-expiry";

const nowMillis = Date.parse("2026-09-03T19:30:00.000Z");

describe("consent grant expiry authority", () => {
  it("assigns a bounded server-owned expiry when the client omits one", () => {
    expect(resolveConsentExpiry({ status: "granted", nowMillis })).toBe(
      new Date(nowMillis + MAX_CONSENT_GRANT_TTL_MS).toISOString()
    );
  });

  it("preserves a shorter requested expiry and clamps an overlong request", () => {
    const shorter = new Date(nowMillis + 60_000).toISOString();
    const overlong = new Date(nowMillis + MAX_CONSENT_GRANT_TTL_MS * 2).toISOString();
    expect(resolveConsentExpiry({ status: "granted", requestedExpiresAt: shorter, nowMillis })).toBe(shorter);
    expect(resolveConsentExpiry({ status: "granted", requestedExpiresAt: overlong, nowMillis })).toBe(
      new Date(nowMillis + MAX_CONSENT_GRANT_TTL_MS).toISOString()
    );
  });

  it("rejects stale grants and clears expiry from non-grants", () => {
    const stale = new Date(nowMillis - 1).toISOString();
    expect(() =>
      resolveConsentExpiry({ status: "granted", requestedExpiresAt: stale, nowMillis })
    ).toThrow(/future/);
    expect(resolveConsentExpiry({ status: "denied", requestedExpiresAt: stale, nowMillis })).toBeNull();
    expect(resolveConsentExpiry({ status: "revoked", nowMillis })).toBeNull();
  });
});
