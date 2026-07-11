import { describe, expect, it } from "vitest";
import {
  deletionCompletionBlockReason,
  type DeletionCompletionResiduals
} from "../../functions/src/deletion-completion-verifier";

function residuals(
  overrides: Partial<DeletionCompletionResiduals> = {}
): DeletionCompletionResiduals {
  return {
    uid: "user-1",
    firestoreTargets: {
      users: [],
      privacyRequests: [],
      exportJobs: [],
      consentRecords: [],
      dataAccessEvents: []
    },
    storageObjects: [],
    authUserExists: false,
    legalHold: false,
    totalResidualTargets: 0,
    ...overrides
  };
}

describe("deletion completion residual policy", () => {
  it("allows completion only when every destructive target is absent", () => {
    expect(deletionCompletionBlockReason(residuals())).toBeNull();
  });

  it("blocks completion when a Firestore target remains or is created during execution", () => {
    expect(deletionCompletionBlockReason(residuals({
      firestoreTargets: {
        users: [],
        privacyRequests: ["new-request"],
        exportJobs: [],
        consentRecords: [],
        dataAccessEvents: []
      },
      totalResidualTargets: 1
    }))).toMatchObject({ code: "failed-precondition" });
  });

  it("blocks completion when an export object remains", () => {
    expect(deletionCompletionBlockReason(residuals({
      storageObjects: ["exports/user-1/job/export.json"],
      totalResidualTargets: 1
    }))).toMatchObject({ code: "failed-precondition" });
  });

  it("blocks completion when the Firebase Auth identity remains", () => {
    expect(deletionCompletionBlockReason(residuals({
      authUserExists: true,
      totalResidualTargets: 1
    }))).toMatchObject({ code: "failed-precondition" });
  });

  it("blocks completion when an active legal hold appears", () => {
    expect(deletionCompletionBlockReason(residuals({ legalHold: true })))
      .toEqual({
        code: "failed-precondition",
        message: "Deletion completion cannot be verified because an active legal hold exists."
      });
  });
});
