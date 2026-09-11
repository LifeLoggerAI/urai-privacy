import { EXPORT_SOURCES } from "./export-contract";

export const EXPORT_CONTRIBUTOR_REGISTRY_VERSION = "1.0.0";

export type ExportContributorStatus = "active" | "pending";

export type ExportContributor = {
  id: string;
  system: string;
  status: ExportContributorStatus;
  schemaVersion: string;
  sourceCollections: readonly string[];
  reason?: string;
};

export const EXPORT_CONTRIBUTORS: readonly ExportContributor[] = [
  {
    id: "urai-privacy-firestore",
    system: "urai-privacy",
    status: "active",
    schemaVersion: "1.0.0",
    sourceCollections: ["users", ...EXPORT_SOURCES.map((source) => source.collection)]
  },
  {
    id: "urai-spatial",
    system: "urai-spatial",
    status: "pending",
    schemaVersion: "unregistered",
    sourceCollections: [],
    reason: "CONTRIBUTOR_NOT_INTEGRATED"
  },
  {
    id: "urai-studio",
    system: "urai-studio",
    status: "pending",
    schemaVersion: "unregistered",
    sourceCollections: [],
    reason: "CONTRIBUTOR_NOT_INTEGRATED"
  },
  {
    id: "urai-analytics",
    system: "urai-analytics",
    status: "pending",
    schemaVersion: "unregistered",
    sourceCollections: [],
    reason: "CONTRIBUTOR_NOT_INTEGRATED"
  },
  {
    id: "urai-content",
    system: "urai-content",
    status: "pending",
    schemaVersion: "unregistered",
    sourceCollections: [],
    reason: "CONTRIBUTOR_NOT_INTEGRATED"
  },
  {
    id: "urai-jobs",
    system: "urai-jobs",
    status: "pending",
    schemaVersion: "unregistered",
    sourceCollections: [],
    reason: "CONTRIBUTOR_NOT_INTEGRATED"
  },
  {
    id: "asset-factory",
    system: "asset-factory",
    status: "pending",
    schemaVersion: "unregistered",
    sourceCollections: [],
    reason: "CONTRIBUTOR_NOT_INTEGRATED"
  },
  {
    id: "urai-communications",
    system: "urai-communications",
    status: "pending",
    schemaVersion: "unregistered",
    sourceCollections: [],
    reason: "CONTRIBUTOR_NOT_INTEGRATED"
  }
] as const;

export function exportContributorSummary() {
  const active = EXPORT_CONTRIBUTORS.filter((entry) => entry.status === "active");
  const pending = EXPORT_CONTRIBUTORS.filter((entry) => entry.status === "pending");
  return {
    registryVersion: EXPORT_CONTRIBUTOR_REGISTRY_VERSION,
    scope: "urai-privacy-local",
    localComplete: true,
    crossSystemComplete: pending.length === 0,
    activeContributors: active.map((entry) => ({
      id: entry.id,
      system: entry.system,
      schemaVersion: entry.schemaVersion,
      sourceCollections: [...entry.sourceCollections]
    })),
    pendingContributors: pending.map((entry) => ({
      id: entry.id,
      system: entry.system,
      reason: entry.reason
    }))
  };
}
