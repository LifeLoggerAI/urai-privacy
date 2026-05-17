import { describe, expect, it } from "vitest";
import type { ConsentRecord } from "../../src/lib/privacy-types";
import {
  createDeletionRequest,
  createExportRequest,
  getPrivacyHealthReport,
  processExportRequest,
  transitionDeletionRequest,
  updateConsent
} from "../../src/lib/privacy-workflows";

const owner = { uid: "integration-owner", role: "user" as const };
const admin = { uid: "integration-admin", role: "admin" as const, isAdmin: true };

describe("privacy integration smoke coverage", () => {
  it("connects owner export, deletion, consent, processing, and health workflows", () => {
    const exportResult = createExportRequest(owner);
    expect(exportResult.request.uid).toBe(owner.uid);
    expect(exportResult.job.requestId).toBe(exportResult.request.id);
    expect(exportResult.audit.action).toBe("export_request_created");

    const processedExport = processExportRequest(admin, exportResult.job, 2);
    expect(processedExport.job.status).toBe("completed");
    expect(processedExport.job.exportManifestPath).toContain("manifest.json");
    expect(processedExport.audit.action).toBe("export_processed");

    const deletionResult = createDeletionRequest(owner, "Integration deletion request");
    expect(deletionResult.request.uid).toBe(owner.uid);
    expect(deletionResult.request.status).toBe("pending");
    expect(deletionResult.request.retainedData).toContain("auditLogs");
    expect(deletionResult.request.deletedData).toContain("users");

    const transitionedDeletion = transitionDeletionRequest(admin, deletionResult.request, "processing");
    expect(transitionedDeletion.request.status).toBe("processing");
    expect(transitionedDeletion.audit.action).toBe("deletion_processed");

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
    expect(consentResult.audit.action).toBe("consent_updated");

    const health = getPrivacyHealthReport({
      exportRequests: [exportResult.request],
      deletionRequests: [transitionedDeletion.request],
      policies: [],
      audits: [exportResult.audit, processedExport.audit, deletionResult.audit, transitionedDeletion.audit, consentResult.audit]
    });
    expect(health.openExportRequests).toBe(1);
    expect(health.openDeletionRequests).toBe(1);
    expect(health.verdict).toBe("healthy");
  });

  it("keeps admin-only transitions explicit", () => {
    const exportResult = createExportRequest(owner);
    expect(() => processExportRequest(owner, exportResult.job, 1)).toThrow("ADMIN_REQUIRED");
    expect(() => processExportRequest(admin, exportResult.job, 1)).not.toThrow();
  });
});
