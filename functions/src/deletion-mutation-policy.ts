export type DeletionMutationBlock = {
  code: "aborted" | "failed-precondition";
  message: string;
};

export type DeletionMutationLeaseState = {
  deletionMutationLeaseToken?: unknown;
  deletionMutationLeaseUntil?: unknown;
  deletionExecutionState?: unknown;
  deletionExecutionLeaseUntil?: unknown;
};

export type DeletionMutationLeasePatch = {
  deletionMutationLeaseToken: string;
  deletionMutationLeaseUntil: Date;
  deletionMutationLeaseOperation: "process" | "dryRun" | "execute";
  deletionMutationLeaseBy: string;
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

export function deletionMutationBlockReason(
  state: DeletionMutationLeaseState,
  nowMillis: number
): DeletionMutationBlock | null {
  const mutationTokenPresent =
    typeof state.deletionMutationLeaseToken === "string" &&
    state.deletionMutationLeaseToken.trim().length > 0;
  const mutationLeasePresent = state.deletionMutationLeaseUntil !== undefined && state.deletionMutationLeaseUntil !== null;
  const mutationLeaseUntil = timestampMillis(state.deletionMutationLeaseUntil);

  if (mutationTokenPresent || mutationLeasePresent) {
    if (!mutationTokenPresent || mutationLeaseUntil === null) {
      return {
        code: "failed-precondition",
        message: "Deletion mutation lease is malformed and requires recovery."
      };
    }
    if (mutationLeaseUntil > nowMillis) {
      return {
        code: "aborted",
        message: "Another deletion control-plane mutation is already in progress."
      };
    }
  }

  if (state.deletionExecutionState === "executing") {
    const executionLeaseUntil = timestampMillis(state.deletionExecutionLeaseUntil);
    if (executionLeaseUntil === null) {
      return {
        code: "failed-precondition",
        message: "Deletion execution state has no valid lease and requires recovery."
      };
    }
    if (executionLeaseUntil > nowMillis) {
      return {
        code: "aborted",
        message: "Destructive deletion execution is already in progress."
      };
    }
  }

  return null;
}

export function buildDeletionMutationLeasePatch(args: {
  token: string;
  actorUid: string;
  operation: "process" | "dryRun" | "execute";
  nowMillis: number;
  leaseDurationMs: number;
}): DeletionMutationLeasePatch {
  if (!args.token.trim()) throw new Error("Deletion mutation lease token is required.");
  if (!args.actorUid.trim()) throw new Error("Deletion mutation lease actor is required.");
  if (!Number.isFinite(args.nowMillis)) throw new Error("Deletion mutation lease start time is invalid.");
  if (!Number.isFinite(args.leaseDurationMs) || args.leaseDurationMs <= 0) {
    throw new Error("Deletion mutation lease duration must be positive.");
  }
  return {
    deletionMutationLeaseToken: args.token,
    deletionMutationLeaseUntil: new Date(args.nowMillis + args.leaseDurationMs),
    deletionMutationLeaseOperation: args.operation,
    deletionMutationLeaseBy: args.actorUid
  };
}
