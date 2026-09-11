import { describe, expect, it } from "vitest";
import {
  EXPORT_CONTRIBUTORS,
  EXPORT_CONTRIBUTOR_REGISTRY_VERSION,
  exportContributorSummary
} from "../../functions/src/export-contributor-registry";

describe("export contributor registry", () => {
  it("is versioned and has one active local contributor", () => {
    expect(EXPORT_CONTRIBUTOR_REGISTRY_VERSION).toBe("1.0.0");
    expect(EXPORT_CONTRIBUTORS.filter((entry) => entry.status === "active")).toHaveLength(1);
    expect(EXPORT_CONTRIBUTORS.find((entry) => entry.status === "active")?.id).toBe(
      "urai-privacy-firestore"
    );
  });

  it("reports the current cross-system boundary", () => {
    const summary = exportContributorSummary();
    expect(summary.scope).toBe("urai-privacy-local");
    expect(summary.localComplete).toBe(true);
    expect(summary.crossSystemComplete).toBe(false);
    expect(summary.pendingContributors).toHaveLength(7);
  });

  it("includes consent evidence in the local source list", () => {
    const active = exportContributorSummary().activeContributors[0];
    expect(active.sourceCollections).toContain("consentEvents");
    expect(active.sourceCollections).toContain("consentDecisions");
  });
});
