import { readFileSync } from "node:fs";
import { Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";

import {
  processingLeaseIsActive,
  scrubExportValue,
  shouldRedactExportField
} from "../../functions/src/export-request";

describe("export redaction and processing lease", () => {
  it("preserves Date instants using the existing ISO export convention", () => {
    expect(scrubExportValue(new Date("2026-07-06T08:00:00.123Z")))
      .toBe("2026-07-06T08:00:00.123Z");
  });

  it("retains adopted fail-stop handling for an invalid Date", () => {
    expect(() => scrubExportValue(new Date(Number.NaN))).toThrow(RangeError);
  });

  it("does not bypass redaction when structural temporal conversion is malformed or throws", () => {
    for (const toDate of [() => { throw new Error("synthetic conversion failure"); },
      () => new Date(Number.NaN), () => "invalid"]) {
      expect(JSON.parse(JSON.stringify(scrubExportValue({
        toDate, label: "synthetic", accessToken: "synthetic-redaction-fixture"
      })))).toEqual({ label: "synthetic" });
    }
  });

  it("preserves installed Firestore Timestamp instants without internal SDK fields", () => {
    const instant = Timestamp.fromDate(new Date("2026-07-06T08:00:00.123Z"));
    expect(scrubExportValue(instant)).toBe("2026-07-06T08:00:00.123Z");
  });

  it("preserves nested temporal values while retaining recursive credential redaction", () => {
    const date = new Date("2026-07-06T08:00:00.123Z");
    expect(scrubExportValue({
      at: date,
      accessToken: "synthetic-redaction-fixture",
      nested: [{ at: Timestamp.fromDate(date), clientSecret: "synthetic-redaction-fixture" }],
      ordinary: { seconds: 42, nanoseconds: 3 }
    })).toEqual({
      at: "2026-07-06T08:00:00.123Z",
      nested: [{ at: "2026-07-06T08:00:00.123Z" }],
      ordinary: { seconds: 42, nanoseconds: 3 }
    });
  });
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