export type ConsentRecordSnapshot = Record<string, unknown> | null;

export function selectConsentRevocationSource(
  before: ConsentRecordSnapshot,
  after: ConsentRecordSnapshot
): Record<string, unknown> | null {
  const revokesExistingGrant =
    before?.status === "granted" &&
    after?.status !== "granted";

  // A replacement record must never redirect revocation of an existing grant
  // to another subject, purpose, tier or policy identity. Even if the new
  // record is also "granted", the previous grant must be invalidated first.
  // The new grant's admission is a separate canonical authorization decision.
  const replacesGrantIdentity =
    before?.status === "granted" &&
    after != null &&
    (before.uid !== after.uid ||
      before.purpose !== after.purpose ||
      before.consentTier !== after.consentTier ||
      before.policyVersion !== after.policyVersion);
  if (replacesGrantIdentity) return before;

  if (!after && !revokesExistingGrant) return null;
  if (after && after.status !== "revoked" && !revokesExistingGrant) return null;
  if (after && before?.status === after.status && before?.receiptHash === after.receiptHash) return null;

  return after ?? before;
}

/**
 * Carry the receipt of the previously granted consent separately from
 * sourceReceiptHash, which may be the later denial/revocation receipt.
 *
 * "present" validates the digest's format ONLY, not its signature,
 * provenance, live canonical authority, or any downstream purge.
 */
export function priorGrantReceiptEvidence(before: ConsentRecordSnapshot): {
  priorGrantReceiptHash: string | null;
  priorGrantEvidenceState: "present" | "missing_or_invalid" | "not_applicable";
} {
  if (before?.status !== "granted") {
    return { priorGrantReceiptHash: null, priorGrantEvidenceState: "not_applicable" };
  }
  const hash = before.receiptHash;
  if (typeof hash !== "string" || !/^[0-9a-f]{64}$/.test(hash)) {
    return { priorGrantReceiptHash: null, priorGrantEvidenceState: "missing_or_invalid" };
  }
  return { priorGrantReceiptHash: hash, priorGrantEvidenceState: "present" };
}

/**
 * Checks whether an already persisted v1 outbox represents the exact same
 * immutable revocation facts as a retry. Mutable delivery status/attempts and
 * acknowledgement bookkeeping are deliberately excluded.
 *
 * Old v1 outboxes may lack the R19 prior-grant evidence. Report that as
 * legacy_missing_lineage, NOT an identical replay and NOT inferred proof.
 * This function does not migrate legacy events or cryptographically attest data.
 */
export type RevocationReplayVerdict = "identical" | "legacy_missing_lineage" | "conflicting";
const REPLAY_BASE_FIELDS = [
  "schemaVersion", "eventId", "consentRecordId", "uid", "purpose",
  "consentTier", "policyVersion", "sourceReceiptHash"
] as const;
const REPLAY_PRIOR_FIELDS = ["priorGrantReceiptHash", "priorGrantEvidenceState"] as const;

export function classifyRevocationOutboxReplay(
  existing: Record<string, unknown> | null | undefined,
  expected: Record<string, unknown>
): RevocationReplayVerdict {
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) return "conflicting";
  const own = (row: Record<string, unknown>, name: string) =>
    Object.prototype.hasOwnProperty.call(row, name);

  for (const key of REPLAY_BASE_FIELDS) {
    if (!own(existing, key) || !own(expected, key) || existing[key] !== expected[key]) return "conflicting";
  }

  // A missing pair is a legacy event requiring explicit reconciliation, not
  // a silent success. A partially present pair is corrupt/conflicting data.
  const missingPrior = REPLAY_PRIOR_FIELDS.filter((key) => !own(existing, key));
  if (missingPrior.length === REPLAY_PRIOR_FIELDS.length) return "legacy_missing_lineage";
  if (missingPrior.length !== 0) return "conflicting";

  for (const key of [...REPLAY_PRIOR_FIELDS, "integrityHash"] as const) {
    if (!own(existing, key) || !own(expected, key) || existing[key] !== expected[key]) return "conflicting";
  }
  return "identical";
}
