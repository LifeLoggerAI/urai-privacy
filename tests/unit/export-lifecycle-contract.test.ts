import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXPORT_DOWNLOAD_URL_TTL_MS,
  EXPORT_PACKAGE_TTL_MS,
  isExportPackageExpired,
  resolveExportPackageExpiry,
  timestampMillis,
  validExportObjectPath
} from "../../functions/src/export-lifecycle-contract";

describe("export package lifecycle contract", () => {
  it("uses bounded download and package lifetimes", () => {
    expect(EXPORT_DOWNLOAD_URL_TTL_MS).toBe(15 * 60 * 1000);
    expect(EXPORT_PACKAGE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("normalizes supported timestamp shapes", () => {
    const expected = Date.parse("2026-07-06T08:00:00.000Z");
    expect(timestampMillis("2026-07-06T08:00:00.000Z")).toBe(expected);
    expect(timestampMillis(new Date(expected))).toBe(expected);
    expect(timestampMillis({ toMillis: () => expected })).toBe(expected);
    expect(timestampMillis({ toDate: () => new Date(expected) })).toBe(expected);
    expect(timestampMillis({ seconds: expected / 1000, nanoseconds: 0 })).toBe(expected);
    expect(timestampMillis("not-a-date")).toBeNull();
  });

  it("prefers explicit expiry and otherwise derives expiry from completion", () => {
    const completedAt = Date.parse("2026-07-01T00:00:00.000Z");
    const explicit = Date.parse("2026-07-03T00:00:00.000Z");

    expect(resolveExportPackageExpiry({ packageExpiresAt: explicit, completedAt })).toBe(explicit);
    expect(resolveExportPackageExpiry({ completedAt })).toBe(completedAt + EXPORT_PACKAGE_TTL_MS);
    expect(resolveExportPackageExpiry({})).toBeNull();
  });

  it("marks packages expired at or after their expiry boundary", () => {
    const expiresAt = Date.parse("2026-07-06T08:00:00.000Z");
    expect(isExportPackageExpired({ packageExpiresAt: expiresAt }, expiresAt - 1)).toBe(false);
    expect(isExportPackageExpired({ packageExpiresAt: expiresAt }, expiresAt)).toBe(true);
  });

  it("accepts only job-scoped export object paths", () => {
    expect(
      validExportObjectPath({
        uid: "user-1",
        jobId: "job-1",
        path: "exports/user-1/job-1/export.json"
      })
    ).toBe(true);
    expect(
      validExportObjectPath({
        uid: "user-1",
        jobId: "job-1",
        path: "exports/user-2/job-1/export.json"
      })
    ).toBe(false);
    expect(
      validExportObjectPath({
        uid: "user-1",
        jobId: "job-1",
        path: "exports/user-1/job-1/../other.json"
      })
    ).toBe(false);
  });
});


describe("expired export cleanup source boundary", () => {
  it("moves identifier-invalid expired jobs out of completed pagination", () => {
    const source = readFileSync(
      new URL("../../functions/src/export-lifecycle-functions.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain('cleanupReason: "INVALID_EXPORT_IDENTIFIERS"');
    expect(source).toMatch(/if \(!uid \|\| !requestId\) \{[\s\S]*status: "cleanup_blocked"[\s\S]*complete: false/);
    expect(source).toMatch(/catch \(error\) \{[\s\S]*artifactCleanupStatus: "incomplete"[\s\S]*artifactCleanupPendingPaths: paths/);
  });
});
