import { createHash } from "node:crypto";

export const DELETION_MANIFEST_VERSION = "1.0.0";
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
  { id: "urai-spatial", system: "urai-spatial", status: "pending" },
  { id: "urai-studio", system: "urai-studio", status: "pending" },
  { id: "urai-analytics", system: "urai-analytics", status: "pending" },
  { id: "urai-content", system: "urai-content", status: "pending" },
  { id: "urai-jobs", system: "urai-jobs", status: "pending" },
  { id: "asset-factory", system: "asset-factory", status: "pending" },
  { id: "urai-communications", system: "urai-communications", status: "pending" }
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

export function deletionExecutionBlockers(value: DeletionManifest) {
  const blockers: string[] = [];
  if (value.legalHold) blockers.push("ACTIVE_LEGAL_HOLD");
  if (value.adapters.some((adapter) => adapter.status !== "active")) {
    blockers.push("PENDING_ADAPTERS");
  }
  if (value.adapters.length === 0) blockers.push("NO_ADAPTERS_REGISTERED");
  return blockers;
}

export function canExecuteDeletion(value: DeletionManifest) {
  return deletionExecutionBlockers(value).length === 0;
}

export function nextDeletionFailureState(attempt: number): DeletionExecutionState {
  return attempt >= DELETION_MAX_ATTEMPTS ? "dead_letter" : "retry_wait";
}
