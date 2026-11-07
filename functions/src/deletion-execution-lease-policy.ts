/** Pure, fail-closed deletion execution state and lease admission. */
export type DeletionExecutionBinding = Readonly<{
  uid: string;
  requestId: string;
  adminUid: string;
  planHash: string;
  planPath: string;
  token: string;
  expiresAt: number;
  mutationToken: string;
}>;

export function deletionExecutionAuthorityBlockReason(args: {
  binding: DeletionExecutionBinding;
  operation: Readonly<Record<string, unknown>>;
  fence: Readonly<Record<string, unknown>>;
  executionLeaseUntilMillis: number;
  mutationLeaseUntilMillis: number;
  nowMillis: number;
  legalHold: boolean;
}): string | null {
  const { binding: b, operation: o, fence: f, executionLeaseUntilMillis: executionUntil,
    mutationLeaseUntilMillis: mutationUntil, nowMillis: now, legalHold } = args;
  if (!b || !o || !f || typeof o !== 'object' || typeof f !== 'object'
    || ![b.uid, b.requestId, b.adminUid, b.planHash, b.planPath, b.token, b.mutationToken]
      .every(x => typeof x === 'string' && x.trim().length > 0)) return 'invalid_execution_binding';
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(b.expiresAt)
    || !Number.isSafeInteger(executionUntil) || !Number.isSafeInteger(mutationUntil)
    || executionUntil !== b.expiresAt || executionUntil <= now || mutationUntil <= now) {
    return 'expired_or_replaced_lease';
  }
  if (o.uid !== b.uid || o.scope !== 'account' || o.status !== 'processing'
    || o.deletionExecutionState !== 'executing' || o.deletionExecutionAttemptToken !== b.token
    || o.deletionExecutionStartedBy !== b.adminUid || o.deletionExecutionPlanHash !== b.planHash
    || o.approvedPlanHash !== b.planHash || o.approvedDeletionPlanPath !== b.planPath) {
    return 'operation_authority_changed';
  }
  if (f.uid !== b.uid || f.requestId !== b.requestId || f.active !== true
    || f.deletionExecutionAttemptToken !== b.token) return 'subject_fence_changed';
  if (o.deletionMutationLeaseToken !== b.mutationToken || o.deletionMutationLeaseOperation !== 'execute'
    || o.deletionMutationLeaseBy !== b.adminUid) return 'mutation_lease_changed';
  if (legalHold !== false) return 'legal_hold_or_unknown';
  return null;
}
