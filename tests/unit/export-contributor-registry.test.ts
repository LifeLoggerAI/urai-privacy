import { describe, expect, it } from "vitest";
import {
  COMMUNICATIONS_EXPORT_SOURCE_COLLECTIONS,
  EXPORT_CONTRIBUTORS,
  EXPORT_CONTRIBUTOR_REGISTRY_VERSION,
  JOBS_DATA_RIGHTS_REQUEST_COLLECTIONS,
  exportContributorSummary
} from "../../functions/src/export-contributor-registry";

describe("export contributor registry", () => {
  it("is versioned and has one active local contributor", () => {
    expect(EXPORT_CONTRIBUTOR_REGISTRY_VERSION).toBe("1.2.0");
    expect(EXPORT_CONTRIBUTORS.filter((entry) => entry.status === "active")).toHaveLength(1);
    expect(EXPORT_CONTRIBUTORS.find((entry) => entry.status === "active")?.id).toBe(
      "urai-privacy-firestore"
    );
  });

  it("reports the current cross-system boundary without falsely completing pending systems", () => {
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

  it("registers Communications source contract but keeps it pending until protected proof exists", () => {
    const communications = EXPORT_CONTRIBUTORS.find((entry) => entry.id === "urai-communications");
    expect(communications?.status).toBe("pending");
    expect(communications?.schemaVersion).toBe("1.0.0");
    expect(communications?.reason).toBe(
      "SOURCE_CONTRACT_REGISTERED_PROTECTED_STAGING_E2E_REQUIRED"
    );
    expect(communications?.sourceCollections).toEqual(COMMUNICATIONS_EXPORT_SOURCE_COLLECTIONS);
    expect(communications?.sourceCollections).toContain("calls/{callId}/scores");
    expect(communications?.sourceCollections).toContain("privacyOperations");
  });

  it("registers Jobs request-control-plane contract without claiming export execution", () => {
    const jobs = EXPORT_CONTRIBUTORS.find((entry) => entry.id === "urai-jobs");
    expect(jobs?.status).toBe("pending");
    expect(jobs?.schemaVersion).toBe("1.0.0");
    expect(jobs?.reason).toBe(
      "REQUEST_CONTROL_PLANE_REGISTERED_EXPORT_DELETE_EXECUTION_HARD_OFF"
    );
    expect(jobs?.sourceCollections).toEqual(JOBS_DATA_RIGHTS_REQUEST_COLLECTIONS);
    expect(jobs?.sourceCollections).toContain("dataRightsRequests");
  });
});
