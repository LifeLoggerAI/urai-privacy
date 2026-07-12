export type DeletionCompletionAuthorityState = {
  uid?: unknown;
  status?: unknown;
  deletionExecutionState?: unknown;
  deletionCompletionVerificationRequired?: unknown;
  deletionCompletionVerified?: unknown;
  deletionMutationLeaseToken?: unknown;
  deletionMutationLeaseUntil?: unknown;
  deletionMutationLeaseOperation?: unknown;
  deletionMutationLeaseBy?: unknown;
};

export type DeletionCompletionAuthorityInput = {
  targetUid: string;
  actorUid: string;
  leaseToken: string;
  nowMillis: number;
};

export type DeletionCompletionAuthorityBlock = {
  code: "aborted" | "failed-precondition";
  message: string;
};

function timestampMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis === "function"
  ) {
    const millis = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  if (typeof value === "string" || typeof value === "number") {
    const millis = new Date(value).getTime();
    return Number.isFinite(millis) ? millis : null;
  }
  return null;
}

export function deletionCompletionAuthorityBlockReason(
  state: DeletionCompletionAuthorityState,
  input: DeletionCompletionAuthorityInput
): DeletionCompletionAuthorityBlock | null {
  if (!input.targetUid.trim() || !input.actorUid.trim() || !input.leaseToken.trim()) {
    return {
      code: "failed-precondition",
      message: "Deletion completion verification authority is incomplete."
    };
  }
  if (!Number.isFinite(input.nowMillis)) {
    return {
      code: "failed-precondition",
      message: "Deletion completion verification time is invalid."
    };
  }
  if (state.uid !== input.targetUid) {
    return {
      code: "failed-precondition",
      message: "Deletion request target changed during completion verification."
    };
  }
  if (
    state.deletionMutationLeaseToken !== input.leaseToken ||
    state.deletionMutationLeaseOperation !== "execute" ||
    state.deletionMutationLeaseBy !== input.actorUid
  ) {
    return {
      code: "aborted",
      message: "Deletion completion verifier no longer owns the execute lease."
    };
  }
  const leaseUntil = timestampMillis(state.deletionMutationLeaseUntil);
  if (leaseUntil === null || leaseUntil <= input.nowMillis) {
    return {
      code: "aborted",
      message: "Deletion completion execute lease expired before verification was recorded."
    };
  }
  if (state.status !== "processing" || state.deletionExecutionState !== "verifying") {
    return {
      code: "failed-precondition",
      message: "Deletion execution is not in the pending-verification mutation state."
    };
  }
  if (
    state.deletionCompletionVerificationRequired !== true ||
    state.deletionCompletionVerified === true
  ) {
    return {
      code: "failed-precondition",
      message: "Deletion completion verification state is no longer pending."
    };
  }
  return null;
}
