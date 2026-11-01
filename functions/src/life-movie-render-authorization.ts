import {
  LIFE_MOVIE_RENDER_CONSENT_PURPOSE,
  evaluateConsentDecision,
  matchesLifeMovieRenderScope,
  policyVersionForPurpose,
  type ConsentDecision,
  type LifeMovieRenderScope
} from "./consent-decision";
import { verifiesLifeMovieScopedReceipt } from "./life-movie-scoped-receipt";

/**
 * Pure policy decision used by the Jobs-only Firebase callable.
 *
 * Caller identity/revocation, the Firestore transaction, tenant membership,
 * actual media rights and generation verification are separate mandatory gates.
 * This function cannot issue consent, start rendering or mint access links.
 */
export type LifeMovieRenderAuthorizationRequest = Readonly<{
  record: unknown;
  deletionActive: boolean;
  subjectUid: string;
  tenantId: string;
  decisionReceiptId: string;
  policyVersion: string;
  renderScope: LifeMovieRenderScope;
  now?: Date;
}>;

export type LifeMovieRenderAuthorizationResult = Readonly<{
  allowed: boolean;
  reason: string;
  evaluated: ConsentDecision;
}>;

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function evaluateLifeMovieRenderAuthorization(
  input: LifeMovieRenderAuthorizationRequest
): LifeMovieRenderAuthorizationResult {
  const purpose = LIFE_MOVIE_RENDER_CONSENT_PURPOSE;
  const record = input.record && typeof input.record === "object" && !Array.isArray(input.record)
    ? input.record as Record<string, unknown> : null;
  const evaluated = evaluateConsentDecision({ purpose, record, now: input.now });

  const subjectMatches = record?.uid === input.subjectUid;
  const receiptMatches = typeof record?.receiptHash === "string"
    && SHA256_HEX.test(record.receiptHash)
    && record.receiptHash === input.decisionReceiptId;
  // Require exactly the requested movie, plan and immutable selected-source set.
  const scopeMatches = matchesLifeMovieRenderScope(record?.renderScope, input.renderScope);
  // Matching loose scope fields are not sufficient: the receipt must bind them.
  const receiptBindsScope = verifiesLifeMovieScopedReceipt(record, {
    subjectUid: input.subjectUid,
    tenantId: input.tenantId,
    decisionReceiptId: input.decisionReceiptId,
    renderScope: input.renderScope
  });
  const policyMatches = input.policyVersion === policyVersionForPurpose(purpose);
  const deletionActive = input.deletionActive === true;
  const allowed = evaluated.allowed && receiptMatches && subjectMatches
    && scopeMatches && receiptBindsScope && policyMatches && !deletionActive;

  // Preserve the actual revocation/expiry/denial reason in the audit record,
  // rather than incorrectly reporting an integrity mismatch for every denial.
  const reason = deletionActive ? "ACCOUNT_DELETED"
    : !evaluated.allowed ? evaluated.reason
    : !subjectMatches ? "SUBJECT_MISMATCH"
    : !scopeMatches ? "RENDER_SCOPE_MISMATCH"
    : !receiptMatches ? "RECEIPT_MISMATCH"
    : !receiptBindsScope ? "SCOPED_RECEIPT_INTEGRITY_MISMATCH"
    : !policyMatches ? "POLICY_VERSION_MISMATCH"
    : evaluated.reason;

  return { allowed, reason, evaluated };
}
