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
