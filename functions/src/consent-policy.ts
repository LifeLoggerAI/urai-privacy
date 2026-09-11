export const CONSENT_POLICY_VERSION = "1.0.0";

export const consentTiers = ["C0", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"] as const;
export type ConsentTier = (typeof consentTiers)[number];
export type ConsentStatus = "granted" | "denied" | "revoked";

export type ConsentPurpose = {
  purpose: string;
  label: string;
  consentTier: ConsentTier;
  grantDurationDays: number;
  description: string;
};

export const consentPurposeRegistry = [
  {
    purpose: "audio_transcription",
    label: "Audio transcription",
    consentTier: "C3",
    grantDurationDays: 365,
    description: "Convert user-provided audio into text for the user's requested experience."
  },
  {
    purpose: "gps_context",
    label: "GPS context",
    consentTier: "C2",
    grantDurationDays: 180,
    description: "Use location context for private place and memory features."
  },
  {
    purpose: "ai_insights",
    label: "AI insights",
    consentTier: "C4",
    grantDurationDays: 180,
    description: "Process user-authorized data to generate private AI-supported reflections."
  },
  {
    purpose: "deidentified_analytics",
    label: "De-identified analytics",
    consentTier: "C5",
    grantDurationDays: 365,
    description: "Use approved de-identified events to improve reliability and product quality."
  },
  {
    purpose: "data_monetization",
    label: "Data monetization",
    consentTier: "C8",
    grantDurationDays: 90,
    description: "Permit a separately disclosed monetization use only after explicit opt-in."
  }
] as const satisfies readonly ConsentPurpose[];

const purposes = new Map<string, ConsentPurpose>(
  consentPurposeRegistry.map((entry) => [entry.purpose, entry])
);

export type ConsentRecordSnapshot = {
  uid?: string;
  purpose?: string;
  consentTier?: string;
  status?: string;
  policyVersion?: string;
  expiresAt?: string | null;
  receiptHash?: string | null;
};

export type ConsentDecisionInput = {
  subjectUid: string;
  purpose: string;
  requestedTier: string;
  record: ConsentRecordSnapshot | null;
  evaluatedAt: string;
};

export type ConsentDecision = {
  allowed: boolean;
  reason:
    | "ALLOWED"
    | "UNKNOWN_PURPOSE"
    | "REQUESTED_TIER_MISMATCH"
    | "MISSING_CONSENT"
    | "SUBJECT_MISMATCH"
    | "PURPOSE_MISMATCH"
    | "STATUS_NOT_GRANTED"
    | "CONSENT_TIER_MISMATCH"
    | "POLICY_VERSION_MISMATCH"
    | "MISSING_RECEIPT_HASH"
    | "MISSING_EXPIRY"
    | "EXPIRED";
  policyVersion: string;
  purpose: string;
  requiredTier: ConsentTier | null;
  expiresAt: string | null;
};

export function getConsentPurpose(purpose: string): ConsentPurpose | null {
  return purposes.get(purpose) ?? null;
}

export function evaluateConsentDecision(input: ConsentDecisionInput): ConsentDecision {
  const purpose = getConsentPurpose(input.purpose);
  const deny = (
    reason: ConsentDecision["reason"],
    expiresAt: string | null = input.record?.expiresAt ?? null
  ): ConsentDecision => ({
    allowed: false,
    reason,
    policyVersion: CONSENT_POLICY_VERSION,
    purpose: input.purpose,
    requiredTier: purpose?.consentTier ?? null,
    expiresAt
  });

  if (!purpose) return deny("UNKNOWN_PURPOSE");
  if (input.requestedTier !== purpose.consentTier) return deny("REQUESTED_TIER_MISMATCH");
  if (!input.record) return deny("MISSING_CONSENT");
  if (input.record.uid !== input.subjectUid) return deny("SUBJECT_MISMATCH");
  if (input.record.purpose !== input.purpose) return deny("PURPOSE_MISMATCH");
  if (input.record.status !== "granted") return deny("STATUS_NOT_GRANTED");
  if (input.record.consentTier !== purpose.consentTier) return deny("CONSENT_TIER_MISMATCH");
  if (input.record.policyVersion !== CONSENT_POLICY_VERSION) return deny("POLICY_VERSION_MISMATCH");
  if (!input.record.receiptHash) return deny("MISSING_RECEIPT_HASH");
  if (!input.record.expiresAt) return deny("MISSING_EXPIRY");

  const evaluatedAt = Date.parse(input.evaluatedAt);
  const expiresAt = Date.parse(input.record.expiresAt);
  if (!Number.isFinite(evaluatedAt) || !Number.isFinite(expiresAt) || expiresAt <= evaluatedAt) {
    return deny("EXPIRED", input.record.expiresAt);
  }

  return {
    allowed: true,
    reason: "ALLOWED",
    policyVersion: CONSENT_POLICY_VERSION,
    purpose: input.purpose,
    requiredTier: purpose.consentTier,
    expiresAt: input.record.expiresAt
  };
}
