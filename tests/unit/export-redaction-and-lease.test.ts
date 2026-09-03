import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  processingLeaseIsActive,
  scrubExportValue,
  shouldRedactExportField
} from "../../functions/src/export-request";

describe("export redaction and processing lease", () => {
  it("normalizes sensitive field names before redaction", () => {
    for (const key of [
      "auth_token",
      "clientSecret",
      "API-KEY",
      "service_account_credential",
      "privateKey",
      "refresh-token",
      "authorizationHeader",
      "session_cookie",
      "webhook_signature"
    ]) {
      expect(shouldRedactExportField(key), key).toBe(true);
    }

    expect(shouldRedactExportField("consentStatus")).toBe(false);
    expect(shouldRedactExportField("policyVersion")).toBe(false);
  });

  it("recursively removes sensitive values without changing safe export fields", () => {
    expect(scrubExportValue({
      consentStatus: "granted",
      nested: {
        auth_token: "do-not-export",
        clientSecret: "do-not-export",
        policyVersion: "1.0.0"
      },
      rows: [
        { authorizationHeader: "do-not-export", eventId: "event-1" },
        { session_cookie: "do-not-export", status: "acknowledged" }
      ]
    })).toEqual({
      consentStatus: "granted",
      nested: { policyVersion: "1.0.0" },
      rows: [
        { eventId: "event-1" },
        { status: "acknowledged" }
      ]
    });
  });

  it("rejects only active processing leases and permits stale or malformed recovery", () => {
    const now = 1_000_000;
    expect(processingLeaseIsActive({ toMillis: () => now + 1 }, now)).toBe(true);
    expect(processingLeaseIsActive({ toMillis: () => now }, now)).toBe(false);
    expect(processingLeaseIsActive({ toMillis: () => now - 1 }, now)).toBe(false);
    expect(processingLeaseIsActive(null, now)).toBe(false);
    expect(processingLeaseIsActive({ toMillis: "invalid" }, now)).toBe(false);
  });
  it("coordinates export publication with the retained deletion fence", () => {
    const exportSource = readFileSync(new URL("../../functions/src/export-request.ts", import.meta.url), "utf8");
    const deletionSource = readFileSync(new URL("../../functions/src/index.ts", import.meta.url), "utf8");

    expect(exportSource).toMatch(/exportProcessingJobId/);
    expect(exportSource).toMatch(/Export processing lost its deletion-fence lease before publication/);
    expect(exportSource).toMatch(/deletionFence\.data\(\)\?\.active === true/);
    expect(deletionSource).toMatch(/Deletion is blocked while an export worker holds the subject fence/);
    expect(deletionSource).toMatch(/Account deletion is already fenced; another request cannot recreate subject data/);
    expect(deletionSource).not.toMatch(/markedForDeletion: true/);
  });

});