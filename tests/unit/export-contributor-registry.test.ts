import { describe, expect, it } from "vitest";
import {
  ASSET_FACTORY_EXPORT_SOURCE_COLLECTIONS,
  ANALYTICS_EXPORT_SOURCE_COLLECTIONS,
  CONTENT_EXPORT_SOURCE_COLLECTIONS,
  SPATIAL_EXPORT_SOURCE_COLLECTIONS,
  STUDIO_EXPORT_SOURCE_COLLECTIONS,
  COMMUNICATIONS_EXPORT_SOURCE_COLLECTIONS,
  EXPORT_CONTRIBUTORS,
  EXPORT_CONTRIBUTOR_REGISTRY_VERSION,
  JOBS_DATA_RIGHTS_REQUEST_COLLECTIONS,
  exportContributorSummary
} from "../../functions/src/export-contributor-registry";

describe("export contributor registry", () => {
  it("is versioned and has one active local contributor", () => {
    expect(EXPORT_CONTRIBUTOR_REGISTRY_VERSION).toBe("1.8.0");
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
  it("registers Asset Factory export and deletion-request control plane without claiming destructive execution", () => {
    const assetFactory = EXPORT_CONTRIBUTORS.find((entry) => entry.id === "asset-factory");
    expect(assetFactory?.status).toBe("pending");
    expect(assetFactory?.schemaVersion).toBe("1.0.0");
    expect(assetFactory?.reason).toBe(
      "EXPORT_REGISTERED_DELETE_REQUEST_ONLY_PROTECTED_STAGING_E2E_REQUIRED"
    );
    expect(assetFactory?.sourceCollections).toEqual(ASSET_FACTORY_EXPORT_SOURCE_COLLECTIONS);
    expect(assetFactory?.sourceCollections).toEqual([
      "assetFactoryJobs",
      "assetFactoryAssets",
      "assetFactoryUsage"
    ]);
  });
  it("registers Content source lifecycle without claiming deployed cross-system execution", () => {
    const content = EXPORT_CONTRIBUTORS.find((entry) => entry.id === "urai-content");
    expect(content?.status).toBe("pending");
    expect(content?.schemaVersion).toBe("1.0.0");
    expect(content?.reason).toBe("SOURCE_LIFECYCLE_REGISTERED_PROTECTED_STAGING_E2E_REQUIRED");
    expect(content?.sourceCollections).toEqual(CONTENT_EXPORT_SOURCE_COLLECTIONS);
    expect(content?.sourceCollections).toContain("contentItems");
    expect(content?.sourceCollections).toContain("creatorSubmissions");
    expect(content?.sourceCollections).toContain("exportTemplates");
  });
  it("registers Spatial Studio and Analytics source contracts without claiming runtime completion", () => {
    const spatial = EXPORT_CONTRIBUTORS.find((entry) => entry.id === "urai-spatial");
    expect(spatial?.status).toBe("pending");
    expect(spatial?.reason).toBe("SOURCE_OPERATIONAL_DATA_RIGHTS_IMPLEMENTED_PROTECTED_STAGING_E2E_REQUIRED");
    expect(spatial?.sourceCollections).toEqual(SPATIAL_EXPORT_SOURCE_COLLECTIONS);
    expect(spatial?.sourceCollections).toContain("voiceEvents");
    expect(spatial?.sourceCollections).toContain("scenarios");
    expect(spatial?.sourceCollections).toContain("scenarios/{scenarioId}/basis");
    expect(spatial?.sourceCollections).toContain("scenarios/{scenarioId}/branches");
    expect(spatial?.sourceCollections).toContain("scenarios/{scenarioId}/outcomeObservations");
    expect(spatial?.sourceCollections).toContain("aiLedger");
    expect(spatial?.sourceCollections).toContain("lifeCausalEdges");
    expect(spatial?.sourceCollections).toContain("capturedRealityAssets");

    const studio = EXPORT_CONTRIBUTORS.find((entry) => entry.id === "urai-studio");
    expect(studio?.status).toBe("pending");
    expect(studio?.schemaVersion).toBe("data-rights-v1");
    expect(studio?.reason).toBe("SOURCE_DATA_RIGHTS_LIFECYCLE_IMPLEMENTED_PROTECTED_STAGING_E2E_REQUIRED");
    expect(studio?.sourceCollections).toEqual(STUDIO_EXPORT_SOURCE_COLLECTIONS);
    expect(studio?.sourceCollections).toContain("users");
    expect(studio?.sourceCollections).toContain("voiceoverJobs");
    expect(studio?.sourceCollections).toContain("studioEvents");
    expect(studio?.sourceCollections).toContain("xrSessions");
    expect(studio?.sourceCollections).toContain("studioExports");

    const analytics = EXPORT_CONTRIBUTORS.find((entry) => entry.id === "urai-analytics");
    expect(analytics?.status).toBe("pending");
    expect(analytics?.reason).toBe("SOURCE_DATA_RIGHTS_LIFECYCLE_IMPLEMENTED_PROTECTED_STAGING_E2E_REQUIRED");
    expect(analytics?.sourceCollections).toEqual(ANALYTICS_EXPORT_SOURCE_COLLECTIONS);
  });
});
