
export enum DataClass {
  RAW_SIGNAL = "RAW_SIGNAL",
  DERIVED_SIGNAL = "DERIVED_SIGNAL",
  IDENTITY_VECTOR = "IDENTITY_VECTOR",
  SOCIAL_GRAPH = "SOCIAL_GRAPH",
  SHADOW_SIGNAL = "SHADOW_SIGNAL",
  NARRATOR_OUTPUT = "NARRATOR_OUTPUT",
  MONETIZATION_UNIT = "MONETIZATION_UNIT",
  AUDIT_EVENT = "AUDIT_EVENT",
  DATA_REQUEST = "DATA_REQUEST",
  CONSENT_RECORD = "CONSENT_RECORD",
  LINEAGE_RECORD = "LINEAGE_RECORD",
  ANONYMIZED_UNIT = "ANONYMIZED_UNIT",
}

export enum Sensitivity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export interface BaseRecord {
  userId: string;
  dataClass: DataClass;
  sensitivity: Sensitivity;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  source: string;
  retentionUntil: FirebaseFirestore.Timestamp | null;
  consentCategory: string | null;
  lineageId: string | null;
}

export interface User {
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  status: "active" | "suspended" | "deleted";
  tier: string;
  privacyVersion: string;
  region: string;
  deletionState: "none" | "pending" | "completed";
  exportState: "none" | "pending" | "completed";
}

export interface ConsentCategory {
  enabled: boolean;
  scope: "foreground" | "background" | "both";
  contexts: string[];
  grantedAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp | null;
  revokedAt: FirebaseFirestore.Timestamp | null;
  renewalRequired: boolean;
  captureMode: "local_only" | "server_allowed" | "anonymized_only";
}

export interface ConsentProfile {
  userId: string;
  categories: { [key: string]: ConsentCategory };
}

export interface IdentityVector extends BaseRecord {
  voiceprintHash: string;
  faceEmbeddingHash: string;
  vectorVersion: string;
}

export interface RawSignal extends BaseRecord {
  signalType: string;
  storageRef: string | null;
  metadata: any;
  ingestionContext: string;
}

export interface DerivedSignal extends BaseRecord {
  signalType: string;
  value: any;
  confidence: number;
  modelVersion: string;
}

export interface SocialGraph extends BaseRecord {
  counterpartHash: string;
  interactionType: string;
  metrics: any;
}

export interface ShadowSignal extends BaseRecord {
  metricType: string;
  score: number;
  metadata: any;
}

export interface NarratorOutput extends BaseRecord {
  outputType: string;
  content: string;
  sourceInsightIds: string[];
}

export interface DataLineage extends BaseRecord {
  sourceRecordIds: string[];
  sourceCollections: string[];
  derivedRecordIds: string[];
  derivedCollections: string[];
  transformationType: string;
  modelVersion: string;
  explanationSummary: string;
}

export interface AuditLog extends BaseRecord {
  actorType: "user" | "system" | "admin" | "buyer";
  actorId: string;
  action: string;
  targetCollection: string;
  targetId: string;
  result: "allowed" | "denied" | "error";
  reason: string;
  requestMetadata: any;
}

export interface AccessLog extends BaseRecord {
  requesterId: string;
  requesterType: string;
  targetCollection: string;
  targetId: string;
  accessType: "read" | "write" | "export" | "delete" | "monetize";
  result: "allowed" | "denied" | "error";
}

export interface AnonymizedDataPool extends BaseRecord {
  originatingUserId: string;
  sourceIds: string[];
  anonymizedPayload: any;
  anonymizationMethod: string;
  riskScore: number;
  approvedForSale: boolean;
  expiresAt: FirebaseFirestore.Timestamp | null;
}

export interface MonetizationUnit extends BaseRecord {
  anonymizedRef: string;
  category: string;
  title: string;
  description: string;
  pricing: any;
  availabilityStatus: "available" | "sold";
  soldCount: number;
  allowedBuyerUses: string[];
  accessPolicy: any;
}

export interface MonetizationSale extends BaseRecord {
  unitId: string;
  sellerUserId: string;
  buyerId: string;
  accessTokenHash: string;
  accessExpiresAt: FirebaseFirestore.Timestamp;
  saleAmount: number;
  revenueSplit: any;
}

export interface DataRequest extends BaseRecord {
  type: "export" | "delete" | "rectify" | "access_report";
  scope: any;
  status: "pending" | "completed" | "error";
  completedAt: FirebaseFirestore.Timestamp | null;
  outputRef: string | null;
}

export interface DeletionRequest extends BaseRecord {
  scope: any;
  hardDelete: boolean;
  status: "pending" | "completed" | "error";
  completedAt: FirebaseFirestore.Timestamp | null;
}

export interface PolicyViolation extends BaseRecord {
    violationType: string;
    severity: "low" | "medium" | "high" | "critical";
    source: string;
    details: any;
    autoActionTaken: string | null;
}

export interface RetentionJob extends BaseRecord {
    targetCollection: string;
    targetId: string;
    status: "pending" | "completed" | "error";
}
