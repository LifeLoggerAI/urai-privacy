import { describe, expect, it } from "vitest";
import type { ConsentRecord, PrivacyRequest } from "../../src/lib/privacy-types";
import { completeDeletionExecutor, createDeletionRequest, createExportRequest, dryRunDeletionExecutor, getPrivacyHealthReport, requireAdmin, requireOwner, transitionDeletionRequest, updateConsent, updateRequestStatus } from "../../src/lib/privacy-workflows";

const admin = { uid: "admin-a", role: "admin" as const, isAdmin: true };
const user = { uid: "user-a", role: "user" as const };

describe("privacy workflow guards", () => {
  it("requires an authenticated owner or admin", () => {
    expect(() => requireOwner({ uid: "user-a", role: "user" }, "user-b")).toThrow("OWNER_OR_ADMIN_REQUIRED");
    expect(requireOwner(admin, "user-b").uid).toBe("admin-a");
  });

  it("rejects non-admin actors", () => {
    expect(() => requireAdmin(user)).toThrow("ADMIN_REQUIRED");
  });
});

describe("privacy request workflows", () => {
  it("creates export request, job, and audit event", () => {
    const result = createExportRequest(user);
    expect(result.request.uid).toBe("user-a");
    expect(result.job.requestId).toBe(result.request.id);
    expect(result.audit.action).toBe("export_request_created");
  });

  it("creates deletion request with retained and deleted data declarations", () => {
    const result = createDeletionRequest(user, "delete me");
    expect(result.request.status).toBe("pending");
    expect(result.request.retainedData).toContain("auditLogs");
    expect(result.request.retainedData).toContain("legalHoldRecords");
    expect(result.request.deletedData).toContain("users");
    expect(result.audit.action).toBe("deletion_request_created");
  });

  it("requires admin for deletion transitions and blocks direct completed state", () => {
    const created = createDeletionRequest(user, "delete me");
    const transitioned = transitionDeletionRequest(admin, created.request, "completed");
    expect(transitioned.request.status).toBe("processing");
    expect(transitioned.request.destructiveDeletionBlocked).toBe(true);
    expect(transitioned.audit.action).toBe("deletion_processed");
  });

  it("requires admin for request status changes", () => {
    const request: PrivacyRequest = { id: "preq", uid: "user-a", type: "export", status: "pending", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const updated = updateRequestStatus(admin, request, "approved");
    expect(updated.request.status).toBe("approved");
    expect(updated.audit.action).toBe("admin_changed_request_status");
  });
});

describe("destructive deletion executor", () => {
  it("produces a dry-run deletion plan without completing the request", () => {
    const created = createDeletionRequest(user, "delete me");
    const result = dryRunDeletionExecutor(admin, { request: created.request, collectionCounts: { users: 1, privacyRequests: 2, exportJobs: 1, consentRecords: 3, dataAccessEvents: 4 } });
    expect(result.request.status).toBe("processing");
    expect(result.plan.counts.users).toBe(1);
    expect(result.plan.retainedData).toContain("auditLogs");
    expect(result.audit.action).toBe("deletion_execute_dry_run");
  });

  it("blocks execution when legal hold is active", () => {
    const created = createDeletionRequest(user, "delete me");
    const result = dryRunDeletionExecutor(admin, { request: created.request, collectionCounts: { users: 1 }, legalHold: true });
    expect(result.request.status).toBe("failed");
    expect(result.request.destructiveDeletionBlocked).toBe(true);
    expect(result.audit.action).toBe("deletion_execute_blocked_legal_hold");
    expect(() => completeDeletionExecutor(admin, { request: created.request, collectionCounts: { users: 1 }, legalHold: true }, "anything")).toThrow("LEGAL_HOLD_BLOCKS_DELETION");
  });

  it("requires a matching dry-run plan hash before completion", () => {
    const created = createDeletionRequest(user, "delete me");
    expect(() => completeDeletionExecutor(admin, { request: created.request, collectionCounts: { users: 1 } }, "stale-plan")).toThrow("DELETION_PLAN_CHANGED");
  });

  it("completes execution with retained evidence and deleted counts", () => {
    const created = createDeletionRequest(user, "delete me");
    const dryRun = dryRunDeletionExecutor(admin, { request: created.request, collectionCounts: { users: 1, privacyRequests: 2, exportJobs: 1, consentRecords: 3, dataAccessEvents: 4 } });
    const completed = completeDeletionExecutor(admin, { request: created.request, collectionCounts: { users: 1, privacyRequests: 2, exportJobs: 1, consentRecords: 3, dataAccessEvents: 4 } }, dryRun.request.planHash ?? "");
    expect(completed.request.status).toBe("completed");
    expect(completed.request.retainedData).toContain("auditLogs");
    expect(completed.deletedCounts.users).toBe(1);
    expect(completed.audit.action).toBe("deletion_execute_completed");
  });
});

describe("consent and health", () => {
  it("updates consent and writes audit intent", () => {
    const consent: ConsentRecord = { id: "c1", uid: "user-a", purpose: "insights", status: "granted", consentTier: "C4", policyVersion: "0.1.0-draft", updatedAt: new Date().toISOString() };
    const result = updateConsent(user, consent, "revoked");
    expect(result.consent.status).toBe("revoked");
    expect(result.audit.action).toBe("consent_updated");
  });

  it("generates a privacy health report", () => {
    const report = getPrivacyHealthReport({ exportRequests: [], deletionRequests: [], policies: [], audits: [] });
    expect(report.verdict).toBe("healthy");
    expect(report.openExportRequests).toBe(0);
  });
});