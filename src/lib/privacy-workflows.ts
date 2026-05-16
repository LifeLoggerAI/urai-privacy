import type {
  AuditAction,
  AuditLog,
  ConsentRecord,
  DeletionRequest,
  ExportJob,
  PrivacyHealthReport,
  PrivacyRequest,
  PrivacyRequestStatus,
  PrivacyRole,
  RetentionPolicy
} from "./privacy-types";

const iso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export interface ActorContext {
  uid: string;
  role: PrivacyRole;
  isAdmin?: boolean;
}

export function requireAuthenticated(actor: ActorContext | null | undefined): ActorContext {
  if (!actor?.uid) {
    throw new Error("AUTH_REQUIRED");
  }
  return actor;
}

export function requireOwner(actor: ActorContext | null | undefined, targetUid: string): ActorContext {
  const checked = requireAuthenticated(actor);
  if (checked.uid !== targetUid && !checked.isAdmin) {
    throw new Error("OWNER_OR_ADMIN_REQUIRED");
  }
  return checked;
}

export function requireAdmin(actor: ActorContext | null | undefined): ActorContext {
  const checked = requireAuthenticated(actor);
  if (!checked.isAdmin && checked.role !== "admin") {
    throw new Error("ADMIN_REQUIRED");
  }
  return checked;
}

export function createAuditLog(args: {
  actor: ActorContext;
  action: AuditAction;
  targetUid?: string;
  requestId?: string;
  metadata?: Record<string, string | number | boolean | null>;
  source: AuditLog["source"];
}): AuditLog {
  return {
    id: id("audit"),
    actorUid: args.actor.uid,
    actorRole: args.actor.role,
    action: args.action,
    targetUid: args.targetUid,
    requestId: args.requestId,
    timestamp: iso(),
    metadata: args.metadata ?? {},
    source: args.source
  };
}

export function createExportRequest(actor: ActorContext): { request: PrivacyRequest; job: ExportJob; audit: AuditLog } {
  const checked = requireAuthenticated(actor);
  const now = iso();
  const requestId = id("preq");
  const request: PrivacyRequest = {
    id: requestId,
    uid: checked.uid,
    type: "export",
    status: "pending",
    createdAt: now,
    updatedAt: now
  };
  const job: ExportJob = {
    id: id("export"),
    uid: checked.uid,
    requestId,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    recordCount: 0
  };
  return {
    request,
    job,
    audit: createAuditLog({ actor: checked, action: "export_request_created", targetUid: checked.uid, requestId, source: "web" })
  };
}

export function processExportRequest(actor: ActorContext, job: ExportJob, recordCount: number): { job: ExportJob; audit: AuditLog } {
  const checked = requireAdmin(actor);
  const processed: ExportJob = {
    ...job,
    status: "completed",
    updatedAt: iso(),
    recordCount,
    exportManifestPath: `exports/${job.uid}/${job.id}/manifest.json`
  };
  return {
    job: processed,
    audit: createAuditLog({
      actor: checked,
      action: "export_processed",
      targetUid: job.uid,
      requestId: job.requestId,
      metadata: { recordCount },
      source: "function"
    })
  };
}

export function createDeletionRequest(actor: ActorContext, reason: string): { request: DeletionRequest; audit: AuditLog } {
  const checked = requireAuthenticated(actor);
  const now = iso();
  const request: DeletionRequest = {
    id: id("del"),
    uid: checked.uid,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    scope: "account",
    reason,
    retainedData: ["auditLogs", "policyVersions", "legalHoldRecords"],
    deletedData: ["users", "privacyRequests", "exportJobs", "deletionRequests", "consentRecords", "dataAccessEvents"]
  };
  return {
    request,
    audit: createAuditLog({ actor: checked, action: "deletion_request_created", targetUid: checked.uid, requestId: request.id, source: "web" })
  };
}

export function transitionDeletionRequest(actor: ActorContext, request: DeletionRequest, status: PrivacyRequestStatus): { request: DeletionRequest; audit: AuditLog } {
  const checked = requireAdmin(actor);
  if (!["approved", "processing", "completed", "rejected", "failed"].includes(status)) {
    throw new Error("INVALID_DELETION_TRANSITION");
  }
  const updated: DeletionRequest = { ...request, status, updatedAt: iso() };
  return {
    request: updated,
    audit: createAuditLog({
      actor: checked,
      action: "deletion_processed",
      targetUid: request.uid,
      requestId: request.id,
      metadata: { status },
      source: "admin"
    })
  };
}

export function updateConsent(actor: ActorContext, previous: ConsentRecord, status: ConsentRecord["status"]): { consent: ConsentRecord; audit: AuditLog } {
  const checked = requireOwner(actor, previous.uid);
  const consent: ConsentRecord = { ...previous, status, updatedAt: iso() };
  return {
    consent,
    audit: createAuditLog({
      actor: checked,
      action: "consent_updated",
      targetUid: previous.uid,
      metadata: { purpose: previous.purpose, consentTier: previous.consentTier, status },
      source: checked.role === "admin" ? "admin" : "web"
    })
  };
}

export function updateRequestStatus(actor: ActorContext, request: PrivacyRequest, status: PrivacyRequestStatus): { request: PrivacyRequest; audit: AuditLog } {
  const checked = requireAdmin(actor);
  const updated: PrivacyRequest = { ...request, status, updatedAt: iso() };
  return {
    request: updated,
    audit: createAuditLog({
      actor: checked,
      action: "admin_changed_request_status",
      targetUid: request.uid,
      requestId: request.id,
      metadata: { status },
      source: "admin"
    })
  };
}

export const defaultRetentionPolicies: RetentionPolicy[] = [
  {
    id: "retention-audit-immutable",
    collection: "auditLogs",
    retentionClass: "R5",
    summary: "Audit logs are retained for legal, security, and abuse-prevention evidence and are not silently deleted during account deletion.",
    windowDays: 2555,
    legalHoldSupported: true,
    updatedAt: "2026-05-10T00:00:00.000Z"
  },
  {
    id: "retention-export-packages",
    collection: "exportJobs",
    retentionClass: "R2",
    summary: "Export metadata is retained long enough to prove fulfillment; downloadable files must expire separately in private storage.",
    windowDays: 30,
    legalHoldSupported: true,
    updatedAt: "2026-05-10T00:00:00.000Z"
  },
  {
    id: "retention-consent-records",
    collection: "consentRecords",
    retentionClass: "R4",
    summary: "Consent state and history are retained to prove lawful processing and support revocation history.",
    windowDays: 1095,
    legalHoldSupported: true,
    updatedAt: "2026-05-10T00:00:00.000Z"
  }
];

export function getPrivacyHealthReport(args: {
  exportRequests: PrivacyRequest[];
  deletionRequests: DeletionRequest[];
  policies: RetentionPolicy[];
  audits: AuditLog[];
}): PrivacyHealthReport {
  const openExportRequests = args.exportRequests.filter((request) => request.type === "export" && !["completed", "rejected", "failed"].includes(request.status)).length;
  const openDeletionRequests = args.deletionRequests.filter((request) => !["completed", "rejected", "failed"].includes(request.status)).length;
  const activePolicies = args.policies.length;
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const auditEventsLast24h = args.audits.filter((audit) => Date.parse(audit.timestamp) >= since).length;
  const verdict = openDeletionRequests > 25 || openExportRequests > 50 ? "needs_review" : "healthy";
  return { generatedAt: iso(), openExportRequests, openDeletionRequests, activePolicies, auditEventsLast24h, verdict };
}
