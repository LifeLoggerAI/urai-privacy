
// --- Core Enums ---

export enum DataClass {
  RAW_SIGNAL = 'RAW_SIGNAL',
  DERIVED_SIGNAL = 'DERIVED_SIGNAL',
  IDENTITY_VECTOR = 'IDENTITY_VECTOR',
  SOCIAL_GRAPH = 'SOCIAL_GRAPH',
  SHADOW_SIGNAL = 'SHADOW_SIGNAL',
  NARRATOR_OUTPUT = 'NARRATOR_OUTPUT',
  MONETIZATION_UNIT = 'MONETIZATION_UNIT',
  AUDIT_EVENT = 'AUDIT_EVENT',
  DATA_REQUEST = 'DATA_REQUEST',
  CONSENT_RECORD = 'CONSENT_RECORD',
  LINEAGE_RECORD = 'LINEAGE_RECORD',
  ANONYMIZED_UNIT = 'ANONYMIZED_UNIT',
  // System Types
  USER_PROFILE = 'USER_PROFILE',
  POLICY_VIOLATION = 'POLICY_VIOLATION',
  RETENTION_JOB = 'RETENTION_JOB',
  MONETIZATION_SALE = 'MONETIZATION_SALE',
}

export enum Sensitivity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// --- Universal Metadata ---

export type TimestampLike = 
  | Date 
  | { seconds: number; nanoseconds?: number } 
  | { _seconds: number; _nanoseconds?: number } 
  | string 
  | number 
  | null;

interface UniversalPolicyMetadata {
  userId: string;
  dataClass: DataClass;
  sensitivity: Sensitivity;
  createdAt: TimestampLike;
  updatedAt: TimestampLike;
  source: string;
  retentionUntil: TimestampLike;
  consentCategory: string;
  lineageId?: string;
}

// --- Canonical Data Type Interfaces ---

export interface UserProfile extends UniversalPolicyMetadata {
  payload: { [key: string]: any }; // e.g., displayName, photoURL
}

export interface ConsentRecord extends UniversalPolicyMetadata {
  payload: {
    enabled: boolean;
    scope: string;
    context: string;
    expiresAt?: TimestampLike;
  };
}

export interface RawSignal extends UniversalPolicyMetadata {
  payload: { [key: string]: any };
}

export interface DerivedSignal extends UniversalPolicyMetadata {
  payload: { [key: string]: any };
}

export interface LineageRecord extends UniversalPolicyMetadata {
  payload: {
    sourceRecordIds: string[];
    derivedRecordIds: string[];
    transformation: string;
    modelVersion?: string;
    explanation: string;
  };
}

export interface AuditEvent extends UniversalPolicyMetadata {
  payload: {
    actor: string;
    action: string;
    target: string;
    status: 'success' | 'failure';
    reason?: string;
  };
}

export interface DataRequest extends UniversalPolicyMetadata {
    payload: {
        type: 'export' | 'deletion';
        status: 'pending' | 'processing' | 'completed' | 'failed';
        requesterId: string;
        outputUrl?: string;
    };
}

export interface AnonymizedUnit extends UniversalPolicyMetadata {
    payload: { [key: string]: any };
    sourceRecordId: string;
    anonymizationMethod: string;
}

export interface MonetizationUnit extends UniversalPolicyMetadata {
    payload: { [key: string]: any };
    sourceAnonymizedUnitId: string;
}

// --- Collection to Policy Mapping ---

interface CollectionPolicy {
  dataClass: DataClass;
  sensitivity: Sensitivity;
  consentCategory?: string; // The consent required to WRITE to this collection
}

export const CollectionMap: { [key: string]: CollectionPolicy } = {
  users: { dataClass: DataClass.USER_PROFILE, sensitivity: Sensitivity.MEDIUM },
  consent_profiles: { dataClass: DataClass.CONSENT_RECORD, sensitivity: Sensitivity.HIGH },
  identity_vectors: { dataClass: DataClass.IDENTITY_VECTOR, sensitivity: Sensitivity.CRITICAL, consentCategory: 'identity' },
  raw_signals: { dataClass: DataClass.RAW_SIGNAL, sensitivity: Sensitivity.HIGH, consentCategory: 'signals_basic' },
  derived_signals: { dataClass: DataClass.DERIVED_SIGNAL, sensitivity: Sensitivity.HIGH, consentCategory: 'derivation' },
  social_graph: { dataClass: DataClass.SOCIAL_GRAPH, sensitivity: Sensitivity.CRITICAL, consentCategory: 'social' },
  shadow_signals: { dataClass: DataClass.SHADOW_SIGNAL, sensitivity: Sensitivity.CRITICAL, consentCategory: 'profiling' },
  narrator_outputs: { dataClass: DataClass.NARRATOR_OUTPUT, sensitivity: Sensitivity.HIGH, consentCategory: 'personalization' },
  data_lineage: { dataClass: DataClass.LINEAGE_RECORD, sensitivity: Sensitivity.MEDIUM },
  audit_logs: { dataClass: DataClass.AUDIT_EVENT, sensitivity: Sensitivity.HIGH },
  access_logs: { dataClass: DataClass.AUDIT_EVENT, sensitivity: Sensitivity.MEDIUM },
  data_requests: { dataClass: DataClass.DATA_REQUEST, sensitivity: Sensitivity.HIGH },
  deletion_requests: { dataClass: DataClass.DATA_REQUEST, sensitivity: Sensitivity.CRITICAL },
  anonymized_data_pool: { dataClass: DataClass.ANONYMIZED_UNIT, sensitivity: Sensitivity.LOW, consentCategory: 'anonymization' },
  monetization_units: { dataClass: DataClass.MONETIZATION_UNIT, sensitivity: Sensitivity.MEDIUM, consentCategory: 'monetization' },
  monetization_sales: { dataClass: DataClass.MONETIZATION_SALE, sensitivity: Sensitivity.HIGH },
  policy_violations: { dataClass: DataClass.POLICY_VIOLATION, sensitivity: Sensitivity.CRITICAL },
  retention_jobs: { dataClass: DataClass.RETENTION_JOB, sensitivity: Sensitivity.MEDIUM },
};

export const COLLECTIONS = {
  users: "users",
  privacyRequests: "privacyRequests",
  exportJobs: "exportJobs",
  deletionRequests: "deletionRequests",
  consentRecords: "consentRecords",
  retentionPolicies: "retentionPolicies",
  auditLogs: "auditLogs",
  adminActions: "adminActions",
  dataAccessEvents: "dataAccessEvents",
  policyVersions: "policyVersions"
} as const;
