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
