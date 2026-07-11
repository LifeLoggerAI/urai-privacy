import { describe, expect, it } from "vitest";
import {
  deletionCompletionAuthorityBlockReason,
  type DeletionCompletionAuthorityState
} from "../../functions/src/deletion-completion-authority";

const nowMillis = Date.parse("2026-07-11T19:55:00.000Z");
const input = {
  targetUid: "user-1",
  actorUid: "admin-1",
  leaseToken: "lease-token-1",
  nowMillis
};

function state(overrides: Partial<DeletionCompletionAuthorityState> = {}): DeletionCompletionAuthorityState {
  return {
    uid: "user-1",
    status: "completed",
    deletionExecutionState: "completed",
    deletionCompletionVerificationRequired: true,
    deletionCompletionVerified: false,
    deletionMutationLeaseToken: "lease-token-1",
    deletionMutationLeaseUntil: new Date(nowMillis + 60_000),
    deletionMutationLeaseOperation: "execute",
    deletionMutationLeaseBy: "admin-1",
    ...overrides
  };
}

describe("deletion completion authority", () => {
  it("allows only the exact unexpired execute lease on the completed pending state", () => {
    expect(deletionCompletionAuthorityBlockReason(state(), input)).toBeNull();
  });

  it("rejects target UID drift", () => {
    expect(deletionCompletionAuthorityBlockReason(state({ uid: "user-2" }), input))
      .toMatchObject({ code: "failed-precondition" });
  });

  it("rejects a superseded lease token", () => {
    expect(deletionCompletionAuthorityBlockReason(
      state({ deletionMutationLeaseToken: "lease-token-2" }),
      input
    )).toMatchObject({ code: "aborted" });
  });

  it("rejects wrong operation or actor authority", () => {
    expect(deletionCompletionAuthorityBlockReason(
      state({ deletionMutationLeaseOperation: "dryRun" }),
      input
    )).toMatchObject({ code: "aborted" });
    expect(deletionCompletionAuthorityBlockReason(
      state({ deletionMutationLeaseBy: "admin-2" }),
      input
    )).toMatchObject({ code: "aborted" });
  });

  it("rejects an expired or malformed lease", () => {
    expect(deletionCompletionAuthorityBlockReason(
      state({ deletionMutationLeaseUntil: new Date(nowMillis) }),
      input
    )).toMatchObject({ code: "aborted" });
    expect(deletionCompletionAuthorityBlockReason(
      state({ deletionMutationLeaseUntil: "invalid" }),
      input
    )).toMatchObject({ code: "aborted" });
  });

  it("rejects a request that is no longer in completed mutation state", () => {
    expect(deletionCompletionAuthorityBlockReason(
      state({ status: "processing" }),
      input
    )).toMatchObject({ code: "failed-precondition" });
    expect(deletionCompletionAuthorityBlockReason(
      state({ deletionExecutionState: "verification_required" }),
      input
    )).toMatchObject({ code: "failed-precondition" });
  });

  it("rejects verification that is no longer pending", () => {
    expect(deletionCompletionAuthorityBlockReason(
      state({ deletionCompletionVerificationRequired: false }),
      input
    )).toMatchObject({ code: "failed-precondition" });
    expect(deletionCompletionAuthorityBlockReason(
      state({ deletionCompletionVerified: true }),
      input
    )).toMatchObject({ code: "failed-precondition" });
  });
});
