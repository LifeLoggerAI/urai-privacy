import { describe, expect, it } from 'vitest';
import type { DocumentReference } from 'firebase-admin/firestore';
import { listDeletionDescendantResiduals } from '../../functions/src/deletion-descendant-residuals';

function document(path: string, exists: boolean, children: ReturnType<typeof document>[] = []): DocumentReference {
  return {
    path,
    get: async () => ({ exists }),
    listCollections: async () => children.length ? [{ listDocuments: async () => children }] : [],
  } as unknown as DocumentReference;
}
describe('deletion descendant residual scan', () => {
  it('does not count the root document twice', async () => {
    expect(await listDeletionDescendantResiduals(document('users/owner', true))).toEqual([]);
  });
  it('finds nested residuals even when root and intermediate documents are missing', async () => {
    const leaf = document('users/owner/memories/missing/parts/retained', true);
    const missing = document('users/owner/memories/missing', false, [leaf]);
    const other = document('users/owner/settings/current', true);
    expect(await listDeletionDescendantResiduals(document('users/owner', false, [other, missing])))
      .toEqual([leaf.path, other.path]);
  });
  it('does not claim a clean scan if a subtree read fails', async () => {
    const root = document('users/owner', false);
    root.listCollections = async () => { throw new Error('unavailable'); };
    await expect(listDeletionDescendantResiduals(root)).rejects.toThrow('unavailable');
  });
  it('fails closed at the reference budget rather than truncating', async () => {
    const root = document('users/owner', false, [document('users/owner/a/one', true), document('users/owner/a/two', true)]);
    await expect(listDeletionDescendantResiduals(root, 1)).rejects.toThrow('limit reached');
  });
  it('rejects a subtree that escapes the deletion subject', async () => {
    await expect(listDeletionDescendantResiduals(document('users/owner', false, [document('users/other/a/one', true)])))
      .rejects.toThrow('invalid path');
  });
});
