import { describe, expect, it } from "vitest";
import {
  buildDeletionMutationLeasePatch,
  deletionMutationBlockReason,
  deletionPlanningFenceBlockReason
} from "../../functions/src/deletion-mutation-policy";

const NOW = Date.parse("2026-07-11T17:15:00.000Z");

describe("deletion mutation lease policy", () => {
  it("blocks a second control-plane mutation while the wrapper lease is active", () => {
    expect(deletionMutationBlockReason({
      deletionMutationLeaseToken: "lease-1",
      deletionMutationLeaseUntil: new Date(NOW + 60_000),
      deletionExecutionState: "ready"
    }, NOW)).toEqual({
      code: "aborted",
      message: "Another deletion control-plane mutation is already in progress."
    });
  });

  it("blocks dry-run or status mutation during active destructive execution", () => {
    expect(deletionMutationBlockReason({
      deletionExecutionState: "executing",
      deletionExecutionLeaseUntil: { toMillis: () => NOW + 60_000 }
    }, NOW)).toEqual({
      code: "aborted",
      message: "Destructive deletion execution is already in progress."
    });
  });

  it("fails closed when a mutation lease token exists without a valid expiry", () => {
    expect(deletionMutationBlockReason({
      deletionMutationLeaseToken: "lease-1",
      deletionMutationLeaseUntil: "not-a-date"
    }, NOW)).toEqual({
      code: "failed-precondition",
      message: "Deletion mutation lease is malformed and requires recovery."
    });
  });

  it("fails closed when executing state lacks a valid execution lease", () => {
    expect(deletionMutationBlockReason({
      deletionExecutionState: "executing"
    }, NOW)).toEqual({
      code: "failed-precondition",
      message: "Deletion execution state has no valid lease and requires recovery."
    });
  });

  it("permits recovery after both leases expire", () => {
    expect(deletionMutationBlockReason({
      deletionMutationLeaseToken: "lease-1",
      deletionMutationLeaseUntil: new Date(NOW - 1),
      deletionExecutionState: "executing",
      deletionExecutionLeaseUntil: new Date(NOW - 1)
    }, NOW)).toBeNull();
  });

  it("builds a source-bound operation lease with the requested expiry", () => {
    const patch = buildDeletionMutationLeasePatch({
      token: "lease-1",
      actorUid: "admin-1",
      operation: "execute",
      NOW: NOW,
      leaseDurationMs: 60_000
    });
    expect(patch).toEqual({
      deletionMutationLeaseToken: "lease-1",
      deletionMutationLeaseUntil: new Date(NOW + 60_000),
      deletionMutationLeaseOperation: "execute",
      deletionMutationLeaseBy: "admin-1"
    });
  });
});

describe("subject deletion planning fence", () => {
  it("rejects plan creation after a deletion fence becomes active", () => {
    expect(deletionPlanningFenceBlockReason({ active: true }, NOW)).toMatchObject({
      code: "failed-precondition"
    });
  });

  it("serializes plan creation across requests for the same subject", () => {
    expect(
      deletionPlanningFenceBlockReason(
        {
          deletionPlanningLeaseToken: "other-request",
          deletionPlanningLeaseUntil: new Date(NOW + 1_000)
        },
        NOW
      )
    ).toMatchObject({ code: "aborted" });
  });

  it("fails closed on malformed planning fences and permits expired leases", () => {
    expect(
      deletionPlanningFenceBlockReason(
        { deletionPlanningLeaseToken: "orphaned-token" },
        NOW
      )
    ).toMatchObject({ code: "failed-precondition" });
    expect(
      deletionPlanningFenceBlockReason(
        {
          deletionPlanningLeaseToken: "expired",
          deletionPlanningLeaseUntil: new Date(NOW - 1)
        },
        NOW
      )
    ).toBeNull();
  });
});
