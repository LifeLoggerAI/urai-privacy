import { describe, expect, it } from "vitest";
import type { ConsentRecord } from "../../src/lib/privacy-types";
import {
  completeDeletionExecutor,
  createDeletionRequest,
  createExportRequest,
  dryRunDeletionExecutor,
  getPrivacyHealthReport,
  processExportRequest,
  transitionDeletionRequest,
  updateConsent
} from "../../src/lib/privacy-workflows";

const owner = { uid: "integration-owner", role: "user" as const };
const admin = { uid: "integration-admin", role: "admin" as const, isAdmin: true };

describe("privacy integration smoke coverage", () => {
  it("connects owner export, deletion, consent, executor, and health workflows", () => {
    const exportResult = createExportRequest(owner);
    expect(exportResult.request.uid).toBe(owner.uid);

    const processedExport = processExportRequest(admin, exportResult.job, 2);
    expect(processedExport.job.status).toBe("completed");
    expect(processedExport.job.exportManifestPath).toContain("manifest.json");
    expect(processedExport.job.exportPackagePath).toContain("export.json");

    const deletionResult = createDeletionRequest(owner, "Integration deletion request");
    expect(deletionResult.request.retainedData).toContain("auditLogs");
    expect(deletionResult.request.retainedData).toContain("legalHoldRecords");

    const transitionedDeletion = transitionDeletionRequest(admin, deletionResult.request, "processing");
    expect(transitionedDeletion.request.status).toBe("processing");

    const dryRun = dryRunDeletionExecutor(admin, {
      request: transitionedDeletion.request,
      collectionCounts: { users: 1, privacyRequests: 2, exportJobs: 1, consentRecords: 1, dataAccessEvents: 1 }
    });
    expect(dryRun.request.status).toBe("processing");
    expect(dryRun.audit.action).toBe("deletion_execute_dry_run");

    const completedDeletion = completeDeletionExecutor(admin, {
      request: transitionedDeletion.request,
      collectionCounts: { users: 1, privacyRequests: 2, exportJobs: 1, consentRecords: 1, dataAccessEvents: 1 }
    }, dryRun.request.planHash ?? "");
    expect(completedDeletion.request.status).toBe("completed");
    expect(completedDeletion.deletedCounts.users).toBe(1);
    expect(completedDeletion.audit.action).toBe("deletion_execute_completed");

    const consent: ConsentRecord = {
      id: "integration-consent",
      uid: owner.uid,
      purpose: "analytics",
      status: "granted",
      consentTier: "C4",
      policyVersion: "0.1.0-draft",
      updatedAt: new Date().toISOString()
    };
    const consentResult = updateConsent(owner, consent, "revoked");
    expect(consentResult.consent.status).toBe("revoked");

    const health = getPrivacyHealthReport({
      exportRequests: [exportResult.request],
      deletionRequests: [completedDeletion.request],
      policies: [],
      audits: [exportResult.audit, processedExport.audit, deletionResult.audit, transitionedDeletion.audit, dryRun.audit, completedDeletion.audit, consentResult.audit]
    });
    expect(health.openDeletionRequests).toBe(0);
    expect(health.verdict).toBe("healthy");
  });

  it("keeps admin-only transitions explicit", () => {
    const exportResult = createExportRequest(owner);
    expect(() => processExportRequest(owner, exportResult.job, 1)).toThrow("ADMIN_REQUIRED");
    expect(() => processExportRequest(admin, exportResult.job, 1)).not.toThrow();
  });

  it("blocks executor work when legal hold exists", () => {
    const deletionResult = createDeletionRequest(owner, "Integration legal hold request");
    const dryRun = dryRunDeletionExecutor(admin, { request: deletionResult.request, collectionCounts: { users: 1 }, legalHold: true });
    expect(dryRun.request.status).toBe("failed");
    expect(dryRun.request.destructiveDeletionBlocked).toBe(true);
    expect(dryRun.audit.action).toBe("deletion_execute_blocked_legal_hold");
  });
});