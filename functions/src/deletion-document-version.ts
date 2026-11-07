/** Pure, side-effect-free Firestore deletion owner and update-time safeguards. */
export type DeletionDocumentVersion = Readonly<{ seconds: number; nanoseconds: number }>;

function versionFields(value: unknown): DeletionDocumentVersion | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    const seconds = Object.getOwnPropertyDescriptor(value, 'seconds');
    const nanoseconds = Object.getOwnPropertyDescriptor(value, 'nanoseconds');
    if (!seconds || !nanoseconds || !Object.hasOwn(seconds, 'value') || !Object.hasOwn(nanoseconds, 'value')) return null;
    if (!Number.isSafeInteger(seconds.value) || !Number.isSafeInteger(nanoseconds.value)
      || nanoseconds.value < 0 || nanoseconds.value >= 1_000_000_000) return null;
    return { seconds: seconds.value, nanoseconds: nanoseconds.value };
  } catch { return null; }
}

export function sameDeletionDocumentVersion(approved: unknown, current: unknown): boolean {
  const left = versionFields(approved), right = versionFields(current);
  return left !== null && right !== null
    && left.seconds === right.seconds && left.nanoseconds === right.nanoseconds;
}

export function deletionDocumentBelongsToSubject(
  collection: string, documentId: string, subjectUid: string, storedOwner: unknown
): boolean {
  if (!subjectUid || subjectUid.includes('/') || subjectUid.includes('..')
    || !collection || collection.includes('/') || collection.includes('..')
    || !documentId || documentId.includes('/') || documentId.includes('..')) return false;
  if (collection === 'users') return documentId === subjectUid
    && (storedOwner === undefined || storedOwner === subjectUid);
  return typeof storedOwner === 'string' && storedOwner === subjectUid;
}
