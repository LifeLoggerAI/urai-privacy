import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  EXPORT_DOWNLOAD_URL_TTL_MS,
  EXPORT_PACKAGE_TTL_MS,
  currentExportDownloadMatches,
  signedExportObjectGeneration,
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

  it("rejects stale signed export state after signing or audit", () => {
    const now = Date.parse("2026-11-22T22:00:00Z");
    const job = {
      uid: "owner-a", requestId: "req-a", status: "completed", complete: true,
      exportPackagePath: "exports/owner-a/job-a/export.json",
      exportManifestPath: "exports/owner-a/job-a/manifest.json",
      exportSha256: "a".repeat(64), manifestSha256: "b".repeat(64),
      packageExpiresAt: now + 300000
    };
    expect(currentExportDownloadMatches(job, { ...job }, now)).toBe(true);
    expect(currentExportDownloadMatches(job, { ...job,
      packageExpiresAt: { toMillis: () => now + 300000 } }, now)).toBe(true);
    for (const changed of [
      null, { ...job, status: "expired" }, { ...job, complete: false },
      { ...job, uid: "foreign" }, { ...job, requestId: "different" },
      { ...job, exportPackagePath: "exports/owner-a/job-a/new.json" },
      { ...job, exportManifestPath: "exports/owner-a/job-a/new-manifest.json" },
      { ...job, exportSha256: "c".repeat(64) },
      { ...job, manifestSha256: "d".repeat(64) },
      { ...job, packageExpiresAt: now - 1 },
      { ...job, packageExpiresAt: now + 400000 }
    ]) expect(currentExportDownloadMatches(job, changed, now)).toBe(false);
    expect(currentExportDownloadMatches(job, { ...job }, now + 300000)).toBe(false);
  });

  it("only signs the committed export object generation and digest", () => {
    const digest = "a".repeat(64);
    const manifest = "b".repeat(64);
    const job = { exportSha256: digest, manifestSha256: manifest };
    const meta = { generation: "1712345678901234", metadata: { sha256: digest } };
    expect(signedExportObjectGeneration(job, "export", meta)).toBe(meta.generation);
    expect(signedExportObjectGeneration(job, "manifest",
      { generation: "99", metadata: { sha256: manifest } })).toBe("99");
    for (const changed of [
      null, { generation: "10", metadata: { sha256: "f".repeat(64) } },
      { generation: "10", metadata: {} },
      { generation: "0", metadata: { sha256: digest } },
      { generation: "-1", metadata: { sha256: digest } },
      { generation: "1.5", metadata: { sha256: digest } },
      { generation: "abc", metadata: { sha256: digest } },
      { generation: 9007199254740992, metadata: { sha256: digest } }
    ]) expect(signedExportObjectGeneration(job, "export", changed)).toBeNull();
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

  it("persists a rotating cursor so persistent failures cannot starve later retries", () => {
    const source = readFileSync(
      new URL("../../functions/src/export-lifecycle-functions.ts", import.meta.url),
      "utf8"
    );
    expect(source).toContain('doc("exportFailedArtifactCleanupCursor")');
    expect(source).toContain("failedCleanupStartAfter");
    expect(source).toContain("lastFailedCleanupDocumentId");
    expect(source).toContain("reachedFailedCleanupEnd");
    expect(source).toContain("query = query.startAfter(failedCleanupStartAfter)");
  });
});
