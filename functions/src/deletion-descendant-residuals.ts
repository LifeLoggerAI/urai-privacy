import type { DocumentReference } from 'firebase-admin/firestore';

/**
 * Parent-document deletion does not remove Firestore subcollections. Inspect
 * missing intermediate documents too: a normal collection query omits them.
 * This is observation only, not authority to recursively delete retained data.
 * The limit caps inspected document references. SDK collection enumeration
 * auto-paginates before that check, so this is not a strict RPC or memory cap.
 */
export async function listDeletionDescendantResiduals(
  root: DocumentReference,
  maximumReferences = 10000
): Promise<string[]> {
  if (!Number.isSafeInteger(maximumReferences) || maximumReferences < 1) {
    throw new Error('Deletion descendant scan limit is invalid.');
  }
  const pending = [root];
  const visited = new Set<string>([root.path]);
  const residuals: string[] = [];
  while (pending.length) {
    const parent = pending.pop()!;
    for (const collection of await parent.listCollections()) {
      // listDocuments includes missing documents that still own descendants.
      for (const child of await collection.listDocuments()) {
        if (!child.path.startsWith(`${root.path}/`) || visited.has(child.path)) {
          throw new Error('Deletion descendant scan returned an invalid path.');
        }
        if (visited.size > maximumReferences) {
          throw new Error('Deletion descendant scan limit reached; absence is unverified.');
        }
        visited.add(child.path);
        if ((await child.get()).exists) residuals.push(child.path);
        pending.push(child);
      }
    }
  }
  return residuals.sort();
}
