export const CONSENT_DECISION_POLICY_VERSION = "1.0.0";
// A purpose-scoped policy revision avoids silently invalidating unrelated grants.
export const LIFE_MOVIE_RENDER_CONSENT_PURPOSE = "life-movie.render";
export const LIFE_MOVIE_RENDER_CONSENT_POLICY_VERSION = "1.1.0";

/**
 * A Life Movie receipt must identify the selected movie and exact immutable media
 * selection, not merely the global purpose. The trusted Jobs consumer must
 * independently recompute/verify these digests and check source ownership.
 */
export type LifeMovieRenderScope = Readonly<{
  projectId: string;
  renderPlanDigest: string;
  sourceSetDigest: string;
}>;

export function matchesLifeMovieRenderScope(recordScope: unknown, requestedScope: LifeMovieRenderScope): boolean {
  if (!recordScope || typeof recordScope !== "object" || Array.isArray(recordScope)) return false;
  const scoped = recordScope as Record<string, unknown>;
  // Reject additional critical fields, including non-enumerable and symbol keys.
  // A Life Movie scope is precisely the three contract-defined own properties.
  if (Reflect.ownKeys(scoped).length !== 3) return false;
  return Object.prototype.hasOwnProperty.call(scoped, "projectId")
    && Object.prototype.hasOwnProperty.call(scoped, "renderPlanDigest")
    && Object.prototype.hasOwnProperty.call(scoped, "sourceSetDigest")
    && scoped.projectId === requestedScope.projectId
    && scoped.renderPlanDigest === requestedScope.renderPlanDigest
    && scoped.sourceSetDigest === requestedScope.sourceSetDigest;
}

export const consentPurposeRegistry = {
  "memory.storage": { requiredTier: "C1", dataCategories: ["memories", "user-content"] },
  "behavior.passive-context": { requiredTier: "C2", dataCategories: ["app-metadata", "interaction-rhythms"] },
  "location.context": { requiredTier: "C3", dataCategories: ["location", "place-categories"] },
  "inference.sensitive": { requiredTier: "C4", dataCategories: ["sensitive-inference"] },
  "biometric.identity": { requiredTier: "C5", dataCategories: ["biometric-identity"] },
  "ai.personalization": { requiredTier: "C6", dataCategories: ["companion-memory", "personalization"] },
  // Independent opt-in: private rendering is not authorized by storage or personalization consent.
  "life-movie.render": { requiredTier: "C6", dataCategories: ["owner-selected-private-media", "derived-private-movie"] },
  "data.export": { requiredTier: "C7", dataCategories: ["structured-records", "consent-history"] },
  "research.public-good.aggregate": {
    requiredTier: "C8",
    dataCategories: ["de-identified-patterns", "public-good-research"]
  },
  "data.monetization.anonymized": { requiredTier: "C8", dataCategories: ["de-identified-patterns", "monetization"] }
} as const;

export type ConsentPurpose = keyof typeof consentPurposeRegistry;

/** Reject inherited Object prototype members as unknown consent purposes. */
export function isCanonicalConsentPurpose(value: string): value is ConsentPurpose {
  return Object.prototype.hasOwnProperty.call(consentPurposeRegistry, value);
}
export type ConsentTier = (typeof consentPurposeRegistry)[ConsentPurpose]["requiredTier"];

export function policyVersionForPurpose(purpose: string): string {
  return purpose === LIFE_MOVIE_RENDER_CONSENT_PURPOSE
    ? LIFE_MOVIE_RENDER_CONSENT_POLICY_VERSION
    : CONSENT_DECISION_POLICY_VERSION;
}
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

function validEpochMillis(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number.isFinite(new Date(value).getTime()) ? value : null;
}

function epoch(value: unknown): number | null {
  if (value == null) return null;
  if (value instanceof Date) return validEpochMillis(value.getTime());
  if (typeof value === "string" || typeof value === "number") {
    return validEpochMillis(new Date(value).getTime());
  }
  if (typeof value === "object") {
    const candidate = value as { toMillis?: () => unknown; seconds?: unknown; nanoseconds?: unknown };
    if (typeof candidate.toMillis === "function") return validEpochMillis(candidate.toMillis());
    if ("seconds" in candidate) {
      if (typeof candidate.seconds !== "number" || !Number.isSafeInteger(candidate.seconds)) return null;
      const nanos = candidate.nanoseconds === undefined ? 0 : candidate.nanoseconds;
      if (typeof nanos !== "number" || !Number.isInteger(nanos) || nanos < 0 || nanos >= 1_000_000_000) return null;
      return validEpochMillis(candidate.seconds * 1000 + Math.floor(nanos / 1_000_000));
    }
  }
  return null;
}

function deny(purpose: string, reason: Exclude<ConsentDecisionReason, "ALLOWED">, requiredTier: ConsentTier | null, evaluatedAt: string): ConsentDecision {
  return { allowed: false, reason, purpose, requiredTier, policyVersion: policyVersionForPurpose(purpose), evaluatedAt };
}

export function evaluateConsentDecision(args: { purpose: string; record: ConsentRecordSnapshot | null | undefined; now?: Date }): ConsentDecision {
  const now = args.now ?? new Date();
  const evaluatedAt = now.toISOString();
  const definition = isCanonicalConsentPurpose(args.purpose)
    ? consentPurposeRegistry[args.purpose]
    : undefined;
  if (!definition) return deny(args.purpose, "UNKNOWN_PURPOSE", null, evaluatedAt);
  if (!args.record) return deny(args.purpose, "MISSING_CONSENT", definition.requiredTier, evaluatedAt);
  if (args.record.purpose !== args.purpose) return deny(args.purpose, "PURPOSE_MISMATCH", definition.requiredTier, evaluatedAt);
  if (args.record.consentTier !== definition.requiredTier) return deny(args.purpose, "TIER_MISMATCH", definition.requiredTier, evaluatedAt);
  if (args.record.policyVersion !== policyVersionForPurpose(args.purpose)) return deny(args.purpose, "POLICY_VERSION_MISMATCH", definition.requiredTier, evaluatedAt);
  if (args.record.status === "denied") return deny(args.purpose, "DENIED", definition.requiredTier, evaluatedAt);
  if (args.record.status === "revoked") return deny(args.purpose, "REVOKED", definition.requiredTier, evaluatedAt);
  if (args.record.status === "expired") return deny(args.purpose, "EXPIRED", definition.requiredTier, evaluatedAt);
  if (args.record.status !== "granted") return deny(args.purpose, "INVALID_STATUS", definition.requiredTier, evaluatedAt);
  const expiresAt = epoch(args.record.expiresAt);
  if (expiresAt === null || expiresAt <= now.getTime()) return deny(args.purpose, "EXPIRED", definition.requiredTier, evaluatedAt);
  return { allowed: true, reason: "ALLOWED", purpose: args.purpose, requiredTier: definition.requiredTier, policyVersion: policyVersionForPurpose(args.purpose), evaluatedAt };
}

export async function runWithConsent<T>(args: { purpose: string; record: ConsentRecordSnapshot | null | undefined; now?: Date; operation: () => Promise<T> | T }): Promise<T> {
  const decision = evaluateConsentDecision(args);
  if (!decision.allowed) throw new Error(`CONSENT_REQUIRED:${decision.reason}`);
  return await args.operation();
}
