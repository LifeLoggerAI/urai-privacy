export const DELETION_FIRESTORE_SOURCES = [
  { collection: "privacyRequests", subjectField: "uid" },
  { collection: "exportJobs", subjectField: "uid" },
  { collection: "consentRecords", subjectField: "uid" },
  { collection: "consentEvents", subjectField: "uid" },
  { collection: "consentDecisions", subjectField: "uid" },
  { collection: "dataAccessEvents", subjectField: "uid" }
] as const;

export const DELETION_STORAGE_PREFIXES = ["exports"] as const;

export const DELETION_RETENTION_RULES = [
  {
    collection: "deletionRequests",
    legalBasis: "deletion-compliance-evidence",
    treatment: "minimized-receipt"
  },
  {
    collection: "auditLogs",
    legalBasis: "security-and-compliance-evidence",
    treatment: "minimized-integrity-record"
  },
  {
    collection: "adminActions",
    legalBasis: "security-and-compliance-evidence",
    treatment: "minimized-integrity-record"
  },
  {
    collection: "legalHoldRecords",
    legalBasis: "legal-obligation",
    treatment: "retain-only-when-required"
  }
] as const;

export function deletionStoragePaths(uid: string) {
  return DELETION_STORAGE_PREFIXES.map((prefix) => `${prefix}/${uid}/`);
}
