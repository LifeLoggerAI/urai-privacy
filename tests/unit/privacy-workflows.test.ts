import { describe, expect, it } from "vitest";
import type { ConsentRecord, PrivacyRequest } from "../../src/lib/privacy-types";
import { createDeletionRequest, createExportRequest, getPrivacyHealthReport, requireAdmin, requireOwner, transitionDeletionRequest, updateConsent, updateRequestStatus } from "../../src/lib/privacy-workflows";

describe("privacy workflow guards", () => {
  it("requires an authenticated owner or admin", () => {
    expect(() => requireOwner({ uid: "user-a", role: "user" }, "user-b")).toThrow("OWNER_OR_ADMIN_REQUIRED");
    expect(requireOwner({ uid: "admin-a", role: "admin", isAdmin: true }, "user-b").uid).toBe("admin-a");
  });

  it("rejects non-admin actors", () => {
    expect(() => requireAdmin({ uid: "user-a", role: "user" })).toThrow("ADMIN_REQUIRED");
  });
});

describe("privacy request workflows", () => {
  it("creates export request, job, and audit event", () => {
    const result = createExportRequest({ uid: "user-a", role: "user" });
    expect(result.request.uid).toBe("user-a");
    expect(result.job.requestId).toBe(result.request.id);
    expect(result.audit.action).toBe("export_request_created");
  });

  it("creates deletion request with retained and deleted data declarations", () => {
    const result = createDeletionRequest({ uid: "user-a", role: "user" }, "delete me");
    expect(result.request.status).toBe("pending");
    expect(result.request.retainedData).toContain("auditLogs");
    expect(result.request.deletedData).toContain("users");
    expect(result.audit.action).toBe("deletion_request_created");
  });

  it("requires admin for deletion transitions", () => {
    const created = createDeletionRequest({ uid: "user-a", role: "user" }, "delete me");
    const transitioned = transitionDeletionRequest({ uid: "admin-a", role: "admin", isAdmin: true }, created.request, "processing");
    expect(transitioned.request.status).toBe("processing");
    expect(transitioned.audit.action).toBe("deletion_processed");
  });

  it("requires admin for request status changes", () => {
    const request: PrivacyRequest = { id: "preq", uid: "user-a", type: "export", status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const updated = updateRequestStatus({ uid: "admin-a", role: "admin", isAdmin: true }, request, "approved");
    expect(updated.request.status).toBe("approved");
    expect(updated.audit.action).toBe("admin_changed_request_status");
  });
});

describe("consent and health", () => {
  it("updates consent and writes audit intent", () => {
    const consent: ConsentRecord = { id: "c1", uid: "user-a", purpose: "insights", status: "granted", consentTier: "C4", policyVersion: "0.1.0-draft", updatedAt: new Date().toISOString() };
    const result = updateConsent({ uid: "user-a", role: "user" }, consent, "revoked");
    expect(result.consent.status).toBe("revoked");
    expect(result.audit.action).toBe("consent_updated");
  });

  it("generates a privacy health report", () => {
    const report = getPrivacyHealthReport({ exportRequests: [], deletionRequests: [], policies: [], audits: [] });
    expect(report.verdict).toBe("healthy");
    expect(report.openExportRequests).toBe(0);
  });
});
