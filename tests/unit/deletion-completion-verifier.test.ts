import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  deletionCompletionBlockReason,
  type DeletionCompletionResiduals
} from "../../functions/src/deletion-completion-verifier";

import { DELETION_ADAPTERS, deletionEcosystemCompletionBlockReason } from "../../functions/src/deletion-contract";

const deletionMutationGuard = readFileSync(
  "functions/src/deletion-mutation-guard.ts",
  "utf8"
);
const deletionCompletionVerifier = readFileSync(
  "functions/src/deletion-completion-verifier.ts",
  "utf8"
);
const privacyFunctions = readFileSync("functions/src/index.ts", "utf8");

function residuals(
  overrides: Partial<DeletionCompletionResiduals> = {}
): DeletionCompletionResiduals {
  return {
    uid: "user-1",
    firestoreTargets: {
      users: [],
      privacyRequests: [],
      exportJobs: [],
      exportArtifactAttempts: [],
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
        exportArtifactAttempts: [],
        consentRecords: [],
        dataAccessEvents: []
      },
      totalResidualTargets: 1
    }))).toMatchObject({ code: "failed-precondition" });
  });

  it("includes generation-scoped export attempts in deletion residuals and plans", () => {
    expect(deletionCompletionVerifier).toContain('"exportArtifactAttempts"');
    expect(privacyFunctions).toContain('const deletableUserCollections = ["privacyRequests", "exportJobs", "exportArtifactAttempts"');
    expect(deletionCompletionBlockReason(residuals({
      firestoreTargets: {
        ...residuals().firestoreTargets,
        exportArtifactAttempts: ["uncollected-attempt"]
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

  it("atomically records final verification, reopening, and verifier failure evidence", () => {
    expect(deletionMutationGuard).toContain("deletion_completion_verified");
    expect(deletionMutationGuard).toContain("deletion_completion_reopened");
    expect(deletionMutationGuard).toContain("deletion_completion_verification_failed");
    expect(deletionMutationGuard).toContain("deletionCompletionVerificationAuditId");
    expect(deletionMutationGuard).toContain("tx.set(auditRef");
    expect(deletionMutationGuard).toContain("integrityHash");
  });

  it("erases and certifies deletion-plan artifacts without retaining full plans in Firestore", () => {
    expect(deletionMutationGuard).toContain("removeDeletionPlanArtifacts(uid)");
    expect(deletionMutationGuard).toContain("privacy-deletion-plans/");
    expect(deletionCompletionVerifier).toContain("privacy-deletion-plans/");
    expect(deletionCompletionVerifier).toContain("storageResults.flatMap");
    expect(privacyFunctions).not.toContain("deletionPlan: result.plan");
    expect(privacyFunctions).toContain("deletionPlanCounts: result.plan.counts");
  });
});

describe("cross-system deletion completion authority (R704 fail-closed)", () => {
  it("cannot certify global completion while independent contributors remain pending", () => {
    const pending = DELETION_ADAPTERS.filter((adapter) => adapter.status === "pending");
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.some((adapter) => adapter.id === "ruai-b2bportal")).toBe(true);
    expect(pending.some((adapter) => adapter.id === "urai-jobs")).toBe(true);
    expect(deletionEcosystemCompletionBlockReason()).toBe(
      "PENDING_DOWNSTREAM_DELETION_CONTRIBUTORS"
    );
  });

  it("keeps global completion blocked even after local Privacy residual verification is clean", () => {
    expect(deletionCompletionBlockReason(residuals())).toBeNull();
    expect(deletionEcosystemCompletionBlockReason()).not.toBe("");
  });

  it("places a trusted downstream-denial audit before the completed-state write", () => {
    const gate = deletionMutationGuard.indexOf(
      "const downstreamReason = deletionEcosystemCompletionBlockReason();"
    );
    expect(gate).toBeGreaterThan(0);
    const blockedAudit = deletionMutationGuard.indexOf("verified: false", gate);
    const completionWrite = deletionMutationGuard.indexOf("verified: true", gate);
    expect(blockedAudit).toBeGreaterThan(gate);
    expect(completionWrite).toBeGreaterThan(blockedAudit);
    expect(deletionMutationGuard.slice(gate, completionWrite)).toContain(
      '"failed-precondition"'
    );
    expect(deletionMutationGuard.slice(gate, completionWrite)).toContain(
      "throw new HttpsError"
    );
  });
});
