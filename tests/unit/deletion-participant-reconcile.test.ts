import { beforeEach, expect, test, vi } from 'vitest';
vi.mock('../../functions/src/jobs-deletion-origin', () => ({ readJobsDeletionOrigin: vi.fn() }));
import { readJobsDeletionOrigin } from '../../functions/src/jobs-deletion-origin';
import { reconcileDeletionParticipantSources } from '../../functions/src/deletion-participant-reconcile';
import { terminalOwnerHash } from '../../functions/src/deletion-terminal-contract';
const origin = vi.mocked(readJobsDeletionOrigin), central = 'deletionRequests/central-request', uid = 'synthetic-owner';
function fixture() {
  const rows = new Map<string, any>([
    [central, { uid, scope: 'account', status: 'processing', createdAt: { seconds: 1 } }],
    [`${central}/participantBindings/urai-jobs`, { schemaVersion: 'urai-privacy-jobs-deletion-binding-v1', centralRequestId: 'central-request', jobsRequestId: 'jobs-request', ownerHash: terminalOwnerHash(uid), sourceProject: 'source-jobs', state: 'authorized-pending-verification', globalDeletionComplete: false }],
    [`${central}/participantEvidence/urai-jobs`, { centralRequestId: 'central-request', jobsRequestId: 'jobs-request', ownerHash: terminalOwnerHash(uid), sourceProject: 'source-jobs', sourceReceiptPath: 'source/path', evidenceHash: 'a'.repeat(64), acknowledgmentState: 'evidence-received-verification-pending', globalDeletionComplete: false }],
  ]);
  const ref = (path: string): any => ({ path, collection: (name: string) => ({ doc: (id: string) => ref(`${path}/${name}/${id}`) }) });
  const db: any = { doc: ref, runTransaction: async (fn: any) => fn({
    get: async (r: any) => ({ data: () => rows.has(r.path) ? { ...rows.get(r.path) } : undefined }),
    set: (r: any, value: any) => rows.set(r.path, { ...rows.get(r.path), ...value }),
  }) };
  return { rows, db, progress: `${central}/participantVerification/urai-jobs` };
}
beforeEach(() => origin.mockReset().mockResolvedValue({ sourceProject: 'source-jobs', sourceReceiptPath: 'source/path', sourceEvidenceHash: 'a'.repeat(64) }));
test('reads source and persists partial progress, never terminal', async () => {
  const f = fixture(), result = await reconcileDeletionParticipantSources(f.db, 'central-request');
  expect(origin).toHaveBeenCalledWith(uid, 'jobs-request'); expect(result.globalDeletionComplete).toBe(false);
  expect(result.participants.filter(p => p.state === 'pending')).toHaveLength(7);
  expect(f.rows.get(f.progress)).toMatchObject({ state: 'source-partial-verified', attempts: 1, leaseUntilMillis: 0 });
});
test('missing binding stays pending without source calls', async () => {
  const f = fixture(); f.rows.delete(`${central}/participantBindings/urai-jobs`);
  await reconcileDeletionParticipantSources(f.db, 'central-request');
  expect(origin).not.toHaveBeenCalled(); expect(f.rows.get(f.progress).state).toBe('pending');
});
test('failed source read retries and resumes durably', async () => {
  const f = fixture(); origin.mockResolvedValueOnce(null);
  await reconcileDeletionParticipantSources(f.db, 'central-request'); expect(f.rows.get(f.progress).state).toBe('retry_wait');
  await reconcileDeletionParticipantSources(f.db, 'central-request');
  expect(f.rows.get(f.progress)).toMatchObject({ state: 'source-partial-verified', attempts: 2 });
});
test('active lease rejects duplicate work', async () => {
  const f = fixture(); f.rows.set(f.progress, { leaseUntilMillis: Date.now() + 60000 });
  await expect(reconcileDeletionParticipantSources(f.db, 'central-request')).rejects.toThrow('already running');
  expect(origin).not.toHaveBeenCalled();
});
test('changed central authority cannot commit source observation', async () => {
  const f = fixture(); origin.mockImplementationOnce(async () => {
    f.rows.get(central).uid = 'another-owner';
    return { sourceProject: 'source-jobs', sourceReceiptPath: 'source/path', sourceEvidenceHash: 'a'.repeat(64) };
  });
  await expect(reconcileDeletionParticipantSources(f.db, 'central-request')).rejects.toThrow('canonical');
  expect(f.rows.get(f.progress).state).toBe('verifying');
});
test('owner mismatch never calls source', async () => {
  const f = fixture(); f.rows.get(`${central}/participantEvidence/urai-jobs`).ownerHash = 'b'.repeat(64);
  await reconcileDeletionParticipantSources(f.db, 'central-request');
  expect(origin).not.toHaveBeenCalled(); expect(f.rows.get(f.progress).state).toBe('retry_wait');
});
test.each(['token', 'lease', 'binding'])('rejects %s change during source read', async change => {
  const f = fixture(); origin.mockImplementationOnce(async () => {
    if (change === 'token') f.rows.get(f.progress).token = 'another-worker';
    if (change === 'lease') f.rows.get(f.progress).leaseUntilMillis = 0;
    if (change === 'binding') f.rows.get(`${central}/participantBindings/urai-jobs`).jobsRequestId = 'changed-request';
    return { sourceProject: 'source-jobs', sourceReceiptPath: 'source/path', sourceEvidenceHash: 'a'.repeat(64) };
  });
  await expect(reconcileDeletionParticipantSources(f.db, 'central-request')).rejects.toThrow();
  expect(f.rows.get(f.progress).state).toBe('verifying');
});
