import { describe, expect, it } from "vitest";

import { removeExportArtifacts } from "../../functions/src/export-artifact-cleanup";

describe("failed export artifact cleanup", () => {
  it("deduplicates targets and removes manifest before export package", async () => {
    const deleted: string[] = [];
    const result = await removeExportArtifacts(
      ["exports/u/job/export.json", "exports/u/job/manifest.json", "exports/u/job/export.json"],
      async (path) => {
        deleted.push(path);
      }
    );

    expect(result).toEqual({ targetCount: 2, pendingPaths: [] });
    expect(deleted).toEqual([
      "exports/u/job/manifest.json",
      "exports/u/job/export.json"
    ]);
  });

  it("continues cleanup and records only paths that could not be deleted", async () => {
    const attempted: string[] = [];
    const result = await removeExportArtifacts(
      ["export.json", "manifest.json"],
      async (path) => {
        attempted.push(path);
        if (path === "manifest.json") throw new Error("simulated storage failure");
      }
    );

    expect(attempted).toEqual(["manifest.json", "export.json"]);
    expect(result).toEqual({ targetCount: 2, pendingPaths: ["manifest.json"] });
  });

  it("returns an empty cleanup result without invoking storage", async () => {
    let calls = 0;
    const result = await removeExportArtifacts([], async () => {
      calls += 1;
    });

    expect(result).toEqual({ targetCount: 0, pendingPaths: [] });
    expect(calls).toBe(0);
  });
});
