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

export type DeletionPlanningFenceState = {
  active?: unknown;
  deletionPlanningLeaseToken?: unknown;
  deletionPlanningLeaseUntil?: unknown;
};

export function deletionPlanningFenceBlockReason(
  state: DeletionPlanningFenceState,
  nowMillis: number
): DeletionMutationBlock | null {
  if (state.active === true) {
    return {
      code: "failed-precondition",
      message: "Account deletion is already fenced; another request cannot create deletion-plan data."
    };
  }

  const tokenPresent =
    typeof state.deletionPlanningLeaseToken === "string" &&
    state.deletionPlanningLeaseToken.trim().length > 0;
  const leasePresent =
    state.deletionPlanningLeaseUntil !== undefined &&
    state.deletionPlanningLeaseUntil !== null;
  const leaseUntil = timestampMillis(state.deletionPlanningLeaseUntil);

  if (tokenPresent || leasePresent) {
    if (!tokenPresent || leaseUntil === null) {
      return {
        code: "failed-precondition",
        message: "Subject deletion-planning fence is malformed and requires recovery."
      };
    }
    if (leaseUntil > nowMillis) {
      return {
        code: "aborted",
        message: "Another deletion plan is already being prepared for this subject."
      };
    }
  }

  return null;
}

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
