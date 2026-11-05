import { createHash } from "node:crypto";

export const DELETION_MANIFEST_VERSION = "1.9.0";
export const DELETION_MAX_ATTEMPTS = 5;

export type DeletionExecutionState =
  | "pending"
  | "preparing"
  | "blocked"
  | "prepared"
  | "executing"
  | "verifying"
  | "retry_wait"
  | "failed"
  | "dead_letter"
  | "completed";

export type DeletionAdapterStatus = "active" | "pending";

export type DeletionAdapterPlan = {
  adapterId: string;
  system: string;
  status: DeletionAdapterStatus;
  itemCount: number | null;
  reason?: string;
};

export type DeletionManifest = {
  version: string;
  subjectHash: string;
  requestId: string;
  legalHold: boolean;
  adapters: DeletionAdapterPlan[];
};

export const DELETION_ADAPTERS = [
  { id: "urai-privacy-firestore", system: "urai-privacy", status: "active" },
  { id: "urai-privacy-storage", system: "urai-privacy", status: "active" },
  { id: "firebase-auth", system: "firebase-auth", status: "active" },
  {
    id: "urai-spatial",
    system: "urai-spatial",
    status: "pending",
    schemaVersion: "1.0.0",
    operations: ["source_plan_delete", "source_plan_delete_biometric"] as const,
    reason: "DETERMINISTIC_DELETE_PLANNER_REGISTERED_PRODUCTION_WORKER_E2E_REQUIRED"
  },
  {
    id: "urai-studio",
    system: "urai-studio",
    status: "pending",
    schemaVersion: "data-rights-v1",
    operations: ["export", "delete", "restore_cancel", "legal_hold_guard", "verified_backup", "purge_receipt"] as const,
    reason: "SOURCE_DATA_RIGHTS_LIFECYCLE_IMPLEMENTED_PROTECTED_STAGING_E2E_REQUIRED"
  },
  {
    id: "urai-analytics",
    system: "urai-analytics",
    status: "pending",
    schemaVersion: "data-rights-v1",
    operations: ["export", "delete", "retention_guard", "legal_hold_guard"] as const,
    reason: "SOURCE_DATA_RIGHTS_LIFECYCLE_IMPLEMENTED_PROTECTED_STAGING_E2E_REQUIRED"
  },
  {
    id: "urai-content",
    system: "urai-content",
    status: "pending",
    schemaVersion: "1.0.0",
    operations: ["source_lifecycle_only"] as const,
    reason: "TOMBSTONE_RESTORE_PROVIDER_RECEIPT_PURGE_SOURCE_REGISTERED_RUNTIME_E2E_PENDING"
  },
  {
    id: "urai-jobs",
    system: "urai-jobs",
    status: "pending",
    schemaVersion: "1.0.0",
    operations: ["request_delete", "protected_staging_delete_anonymize"] as const,
    reason: "SOURCE_GOVERNED_EXECUTOR_IMPLEMENTED_PROTECTED_STAGING_E2E_REQUIRED"
  },
  {
    id: "asset-factory",
    system: "asset-factory",
    status: "pending",
    schemaVersion: "1.0.0",
    operations: ["request_delete"] as const,
    reason: "DELETE_REQUEST_RECORDED_MANUAL_REVIEW_EXECUTION_PENDING"
  },
  {
    id: "urai-communications",
    system: "urai-communications",
    status: "pending",
    schemaVersion: "1.0.0",
    operations: ["delete", "tenant_delete", "retention_purge"] as const,
    reason: "SOURCE_CONTRACT_REGISTERED_PROTECTED_STAGING_E2E_REQUIRED"
  },
  {
    // RuAi is a separately governed B2B tenant boundary. No consumer memory
    // or medical content is authorized to flow to RuAi merely by this entry.
    // A no-subject-data attestation OR verified restricted-data disposition,
    // including central-analytics retraction, is still missing. Stay hard-off.
    id: "ruai-b2bportal",
    system: "ruai-b2bportal",
    status: "pending",
    schemaVersion: "1.0.0",
    operations: ["subject_linkage_review", "tenant_access_withdrawal", "central_analytics_retraction", "disposition_receipt"] as const,
    reason: "RUAi_CONSUMER_DATA_DISPOSITION_AND_RETRACTION_STAGING_E2E_REQUIRED"
  }
] as const;

export function deletionSubjectHash(uid: string) {
  return createHash("sha256").update(`urai-deletion-subject:${uid}`).digest("hex");
}

export function canonicalDeletionManifest(value: DeletionManifest) {
  return {
    version: value.version,
    subjectHash: value.subjectHash,
    requestId: value.requestId,
    legalHold: value.legalHold,
    adapters: [...value.adapters].sort((left, right) =>
      left.adapterId.localeCompare(right.adapterId)
    )
  };
}

export function deletionManifestHash(value: DeletionManifest) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalDeletionManifest(value)))
    .digest("hex");
}

/** A stored or caller-assembled plan is never itself contributor authority.
 * Exact registry admission remains required even when a manifest claims every
 * downstream system is active. Do not mark cross-system deletion executable
 * by omitting a pending system, duplicating one, or forging its status.
 */
export function deletionExecutionBlockers(value: DeletionManifest) {
  try {
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        value.version !== DELETION_MANIFEST_VERSION ||
        typeof value.subjectHash !== "string" || !/^[0-9a-f]{64}$/.test(value.subjectHash) ||
        typeof value.requestId !== "string" || !value.requestId.trim() ||
        value.requestId.length > 160 || typeof value.legalHold !== "boolean" ||
        !Array.isArray(value.adapters)) {
      return ["INVALID_DELETION_MANIFEST"];
    }
    const blockers: string[] = [];
    if (value.legalHold) blockers.push("ACTIVE_LEGAL_HOLD");
    if (value.adapters.length === 0) blockers.push("NO_ADAPTERS_REGISTERED");

    const registered = new Map(DELETION_ADAPTERS.map((adapter) => [adapter.id, adapter]));
    const seen = new Set<string>();
    let mismatch = value.adapters.length !== registered.size;
    let pending = false;
    for (const adapter of value.adapters) {
      if (!adapter || typeof adapter !== "object" || Array.isArray(adapter) ||
          typeof adapter.adapterId !== "string" || seen.has(adapter.adapterId)) {
        mismatch = true;
        continue;
      }
      seen.add(adapter.adapterId);
      const expected = registered.get(adapter.adapterId);
      if (!expected || adapter.system !== expected.system ||
          adapter.status !== expected.status ||
          (adapter.status === "active"
            ? !Number.isSafeInteger(adapter.itemCount) || (adapter.itemCount as number) < 0
            : adapter.itemCount !== null)) mismatch = true;
      if (adapter.status !== "active") pending = true;
    }
    if (mismatch || seen.size !== registered.size) blockers.push("ADAPTER_REGISTRY_MISMATCH");
    if (pending) blockers.push("PENDING_ADAPTERS");
    return blockers;
  } catch {
    return ["INVALID_DELETION_MANIFEST"];
  }
}

export function canExecuteDeletion(value: DeletionManifest) {
  return deletionExecutionBlockers(value).length === 0;
}

export function nextDeletionFailureState(attempt: number): DeletionExecutionState {
  return attempt >= DELETION_MAX_ATTEMPTS ? "dead_letter" : "retry_wait";
}


export function deletionAdapterSummary() {
  const active = DELETION_ADAPTERS.filter((adapter) => adapter.status === "active");
  const pending = DELETION_ADAPTERS.filter((adapter) => adapter.status === "pending");
  return {
    manifestVersion: DELETION_MANIFEST_VERSION,
    activeAdapters: active.map((adapter) => ({ id: adapter.id, system: adapter.system })),
    pendingAdapters: pending.map((adapter) => ({
      id: adapter.id,
      system: adapter.system,
      reason: "reason" in adapter ? adapter.reason : "CONTRIBUTOR_NOT_INTEGRATED"
    })),
    executableCrossSystemDelete: pending.length === 0
  };
}
