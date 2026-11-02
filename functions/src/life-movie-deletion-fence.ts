/**
 * Interpret the authoritative Firestore tombstone read inside the same
 * transaction as the consent record. A missing document is a verified absence;
 * a present tombstone must contain its own literal boolean `active` field.
 * Unknown, malformed or unreadable state must never be treated as a clear fence.
 * This is a pure classifier, not proof of source rights or consent issuance.
 */
export type LifeMovieDeletionTombstoneSnapshot = Readonly<{
  exists: boolean;
  data: () => unknown;
}>;

export function checkedLifeMovieDeletionState(
  snapshot: LifeMovieDeletionTombstoneSnapshot | null | undefined,
): boolean | undefined {
  if (!snapshot || typeof snapshot !== "object") return undefined;
  if (snapshot.exists === false) return false;
  if (snapshot.exists !== true || typeof snapshot.data !== "function") return undefined;
  try {
    const record = snapshot.data();
    if (!record || typeof record !== "object" || Array.isArray(record)) return undefined;
    const field = Object.getOwnPropertyDescriptor(record, "active");
    if (!field || !Object.prototype.hasOwnProperty.call(field, "value") ||
        typeof field.value !== "boolean") return undefined;
    if (field.value === true) return true;
    // An in-flight deletion dry-run lease must not turn a literal `false`
    // into render clearance until the lease has been reconciled.
    const planningFields = [
      "deletionPlanningLeaseToken", "deletionPlanningLeaseUntil", "deletionPlanningLeaseRequestId",
      "deletionPlanningLeaseOperation", "deletionPlanningLeaseBy"
    ];
    if (planningFields.some(key => Object.prototype.hasOwnProperty.call(record, key))) return undefined;
    return false;
  } catch {
    return undefined;
  }
}
