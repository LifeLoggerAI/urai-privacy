export const CONSENT_DECISION_POLICY_VERSION = "1.0.0";

export const consentPurposeRegistry = {
  "memory.storage": { requiredTier: "C1", dataCategories: ["memories", "user-content"] },
  "behavior.passive-context": { requiredTier: "C2", dataCategories: ["app-metadata", "interaction-rhythms"] },
  "location.context": { requiredTier: "C3", dataCategories: ["location", "place-categories"] },
  "inference.sensitive": { requiredTier: "C4", dataCategories: ["sensitive-inference"] },
  "biometric.identity": { requiredTier: "C5", dataCategories: ["biometric-identity"] },
  "ai.personalization": { requiredTier: "C6", dataCategories: ["companion-memory", "personalization"] },
  "data.export": { requiredTier: "C7", dataCategories: ["structured-records", "consent-history"] },
  "data.monetization.anonymized": { requiredTier: "C8", dataCategories: ["de-identified-patterns"] }
} as const;

export type ConsentPurpose = keyof typeof consentPurposeRegistry;
export type ConsentTier = (typeof consentPurposeRegistry)[ConsentPurpose]["requiredTier"];
export type ConsentRecordSnapshot = {
  purpose?: unknown;
  consentTier?: unknown;
  status?: unknown;
  policyVersion?: unknown;
  expiresAt?: unknown;
};

export type ConsentDecisionReason =
  | "ALLOWED"
  | "UNKNOWN_PURPOSE"
  | "MISSING_CONSENT"
  | "PURPOSE_MISMATCH"
  | "TIER_MISMATCH"
  | "POLICY_VERSION_MISMATCH"
  | "DENIED"
  | "REVOKED"
  | "EXPIRED"
  | "INVALID_STATUS";

export type ConsentDecision = {
  allowed: boolean;
  reason: ConsentDecisionReason;
  purpose: string;
  requiredTier: ConsentTier | null;
  policyVersion: string;
  evaluatedAt: string;
};

function epoch(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object") {
    const candidate = value as { toMillis?: () => number; seconds?: unknown; nanoseconds?: unknown };
    if (typeof candidate.toMillis === "function") return candidate.toMillis();
    if (typeof candidate.seconds === "number") {
      const nanos = typeof candidate.nanoseconds === "number" ? candidate.nanoseconds : 0;
      return candidate.seconds * 1000 + Math.floor(nanos / 1_000_000);
    }
  }
  return null;
}

function deny(purpose: string, reason: Exclude<ConsentDecisionReason, "ALLOWED">, requiredTier: ConsentTier | null, evaluatedAt: string): ConsentDecision {
  return { allowed: false, reason, purpose, requiredTier, policyVersion: CONSENT_DECISION_POLICY_VERSION, evaluatedAt };
}

export function evaluateConsentDecision(args: { purpose: string; record: ConsentRecordSnapshot | null | undefined; now?: Date }): ConsentDecision {
  const now = args.now ?? new Date();
  const evaluatedAt = now.toISOString();
  const definition = consentPurposeRegistry[args.purpose as ConsentPurpose];
  if (!definition) return deny(args.purpose, "UNKNOWN_PURPOSE", null, evaluatedAt);
  if (!args.record) return deny(args.purpose, "MISSING_CONSENT", definition.requiredTier, evaluatedAt);
  if (args.record.purpose !== args.purpose) return deny(args.purpose, "PURPOSE_MISMATCH", definition.requiredTier, evaluatedAt);
  if (args.record.consentTier !== definition.requiredTier) return deny(args.purpose, "TIER_MISMATCH", definition.requiredTier, evaluatedAt);
  if (args.record.policyVersion !== CONSENT_DECISION_POLICY_VERSION) return deny(args.purpose, "POLICY_VERSION_MISMATCH", definition.requiredTier, evaluatedAt);
  if (args.record.status === "denied") return deny(args.purpose, "DENIED", definition.requiredTier, evaluatedAt);
  if (args.record.status === "revoked") return deny(args.purpose, "REVOKED", definition.requiredTier, evaluatedAt);
  if (args.record.status === "expired") return deny(args.purpose, "EXPIRED", definition.requiredTier, evaluatedAt);
  if (args.record.status !== "granted") return deny(args.purpose, "INVALID_STATUS", definition.requiredTier, evaluatedAt);
  const expiresAt = epoch(args.record.expiresAt);
  if (expiresAt !== null && expiresAt <= now.getTime()) return deny(args.purpose, "EXPIRED", definition.requiredTier, evaluatedAt);
  return { allowed: true, reason: "ALLOWED", purpose: args.purpose, requiredTier: definition.requiredTier, policyVersion: CONSENT_DECISION_POLICY_VERSION, evaluatedAt };
}

export async function runWithConsent<T>(args: { purpose: string; record: ConsentRecordSnapshot | null | undefined; now?: Date; operation: () => Promise<T> | T }): Promise<T> {
  const decision = evaluateConsentDecision(args);
  if (!decision.allowed) throw new Error(`CONSENT_REQUIRED:${decision.reason}`);
  return await args.operation();
}
