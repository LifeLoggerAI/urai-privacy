export type PrivacyRole = "user" | "admin" | "system";

export type PrivacyRequestStatus = "pending" | "approved" | "processing" | "completed" | "rejected" | "failed";

export type AuditAction =
  | "export_request_created"
  | "export_processed"
  | "deletion_request_created"
  | "deletion_processed"
  | "consent_updated"
  | "admin_viewed_request"
  | "admin_changed_request_status"
  | "policy_version_changed";

export interface PrivacyUser {
  uid: string;
  email?: string;
  displayName?: string;
  createdAt: string;
  markedForDeletion?: boolean;
  deletionMarkedAt?: string;
}

export interface PrivacyRequest {
  id: string;
  uid: string;
  type: "export" | "deletion";
  status: PrivacyRequestStatus;
  createdAt: string;
  updatedAt: string;
  reason?: string;
}

export interface ExportJob {
  id: string;
  uid: string;
  requestId: string;
  status: PrivacyRequestStatus;
  createdAt: string;
  updatedAt: string;
  exportManifestPath?: string;
  recordCount?: number;
  error?: string;
}

export interface DeletionRequest {
  id: string;
  uid: string;
  status: PrivacyRequestStatus;
  createdAt: string;
  updatedAt: string;
  scope: "account" | "privacy_data" | "consent_only";
  retainedData: string[];
  deletedData: string[];
  reason?: string;
}

export interface ConsentRecord {
  id: string;
  uid: string;
  purpose: string;
  status: "granted" | "denied" | "revoked";
  consentTier: "C0" | "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7" | "C8";
  policyVersion: string;
  updatedAt: string;
}

export interface RetentionPolicy {
  id: string;
  collection: string;
  retentionClass: "R0" | "R1" | "R2" | "R3" | "R4" | "R5" | "R6";
  summary: string;
  windowDays: number | null;
  legalHoldSupported: boolean;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorRole: PrivacyRole;
  action: AuditAction;
  targetUid?: string;
  timestamp: string;
  requestId?: string;
  metadata: Record<string, string | number | boolean | null>;
  source: "web" | "function" | "admin" | "system";
}

export interface AdminAction {
  id: string;
  adminUid: string;
  action: AuditAction;
  targetUid?: string;
  requestId?: string;
  timestamp: string;
  notes?: string;
}

export interface DataAccessEvent {
  id: string;
  uid: string;
  actorUid: string;
  actorRole: PrivacyRole;
  dataClass: string;
  purpose: string;
  outcome: "allowed" | "denied" | "failed";
  createdAt: string;
}

export interface PolicyVersion {
  id: string;
  version: string;
  title: string;
  status: "draft" | "published" | "archived";
  effectiveAt: string;
  createdAt: string;
}

export interface PrivacyHealthReport {
  generatedAt: string;
  openExportRequests: number;
  openDeletionRequests: number;
  activePolicies: number;
  auditEventsLast24h: number;
  verdict: "healthy" | "needs_review" | "blocked";
}

export const FIRESTORE_COLLECTIONS = [
  "users",
  "privacyRequests",
  "exportJobs",
  "deletionRequests",
  "consentRecords",
  "retentionPolicies",
  "auditLogs",
  "adminActions",
  "dataAccessEvents",
  "policyVersions"
] as const;

export type FirestoreCollection = (typeof FIRESTORE_COLLECTIONS)[number];
