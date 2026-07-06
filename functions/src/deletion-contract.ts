import { createHash } from "node:crypto";

export const PRIMARY_DELETION_ADAPTERS = [
  "firestore-primary",
  "storage-user-prefixes",
  "firebase-auth"
] as const;

export const DEFAULT_REQUIRED_DOWNSTREAM_SYSTEMS = [
  "urai-spatial",
  "urai-jobs",
  "urai-analytics",
  "urai-content",
  "urai-communications"
] as const;

export type PrimaryDeletionAdapterId = (typeof PRIMARY_DELETION_ADAPTERS)[number];

export type DeletionPlanInput = {
  uid: string;
  requestId: string;
  legalHold: boolean;
  firestoreCounts: Record<string, number>;
  storageCounts: Record<string, number>;
  authAccountExists: boolean;
  requiredDownstreamSystems: string[];
};

export function normalizeRequiredDownstreamSystems(raw: string | undefined, productionRuntime: boolean): string[] {
  if (!raw || !raw.trim()) {
    return productionRuntime ? [...DEFAULT_REQUIRED_DOWNSTREAM_SYSTEMS] : [];
  }

  const normalized = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (normalized.length === 1 && normalized[0].toLowerCase() === "none") {
    if (productionRuntime) {
      throw new Error("Production deletion cannot disable downstream acknowledgements with 'none'.");
    }
    return [];
  }

  return [...new Set(normalized)].sort();
}

export function deletionPlanHash(plan: DeletionPlanInput): string {
  const stable = {
    uid: plan.uid,
    requestId: plan.requestId,
    legalHold: plan.legalHold,
    firestoreCounts: Object.fromEntries(Object.entries(plan.firestoreCounts).sort(([a], [b]) => a.localeCompare(b))),
    storageCounts: Object.fromEntries(Object.entries(plan.storageCounts).sort(([a], [b]) => a.localeCompare(b))),
    authAccountExists: plan.authAccountExists,
    requiredDownstreamSystems: [...plan.requiredDownstreamSystems].sort()
  };

  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export function deletionCompletionStatus(args: {
  primaryStoresVerified: boolean;
  downstreamPending: string[];
}): "completed" | "primary_stores_verified_downstream_pending" | "failed" {
  if (!args.primaryStoresVerified) return "failed";
  if (args.downstreamPending.length > 0) return "primary_stores_verified_downstream_pending";
  return "completed";
}
