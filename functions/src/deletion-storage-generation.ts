/**
 * Exact GCS-generation admission for a subject-scoped deletion plan.
 * Pure source policy only: the actual bucket delete MUST use ifGenerationMatch.
 */
export type StorageGenerationPlan = Readonly<{
  storageObjects: readonly string[];
  storageObjectGenerations: Readonly<Record<string, string>>;
}>;

function ownGeneration(record: Readonly<Record<string, string>>, path: string): string | null {
  try {
    const field = Object.getOwnPropertyDescriptor(record, path);
    const value = field && Object.hasOwn(field, 'value') ? field.value : undefined;
    return typeof value === 'string' && /^[0-9]+$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

/** No numeric conversions: GCS generations can exceed JS safe integers. */
export function approvedStorageGeneration(
  subjectUid: string,
  objectName: string,
  approved: StorageGenerationPlan,
  current: StorageGenerationPlan,
): string | null {
  if (!subjectUid || subjectUid.includes('/') || subjectUid.includes('..')
    || typeof objectName !== 'string' || objectName.includes('..')) return null;
  const prefix = `exports/${subjectUid}/`;
  if (!objectName.startsWith(prefix) || objectName.length <= prefix.length) return null;
  try {
    if (!approved.storageObjects.includes(objectName) || !current.storageObjects.includes(objectName)) return null;
    const signed = ownGeneration(approved.storageObjectGenerations, objectName);
    const observed = ownGeneration(current.storageObjectGenerations, objectName);
    return signed !== null && signed === observed ? signed : null;
  } catch {
    return null;
  }
}

/**
 * A partially completed deletion may have fewer targets, but no newly-created,
 * changed-generation, duplicated, or wrong-owner object may join that subset.
 */
export function storageGenerationSubsetApproved(
  subjectUid: string,
  approved: StorageGenerationPlan,
  current: StorageGenerationPlan,
): boolean {
  if (!approved || !current || !Array.isArray(approved.storageObjects)
    || !Array.isArray(current.storageObjects)) return false;
  try {
    if (new Set(approved.storageObjects).size !== approved.storageObjects.length
      || new Set(current.storageObjects).size !== current.storageObjects.length) return false;
    return current.storageObjects.every((name) =>
      approvedStorageGeneration(subjectUid, name, approved, current) !== null);
  } catch {
    return false;
  }
}
