export type ConsentRecordSnapshot = Record<string, unknown> | null;

const RECEIPT_HASH = /^[0-9a-f]{64}$/;
const hasOwn = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

/** Require a complete source identity so malformed replacement records cannot
 * suppress revocation of a previously valid owner/purpose grant. */
function validSourceIdentity(record: ConsentRecordSnapshot): record is Record<string, unknown> {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  for (const field of ["uid", "purpose", "consentTier", "policyVersion"]) {
    if (!hasOwn(record, field) || typeof record[field] !== "string" || !(record[field] as string).trim()) return false;
  }
  return hasOwn(record, "receiptHash") &&
    typeof record.receiptHash === "string" && RECEIPT_HASH.test(record.receiptHash);
}

function sameAuthority(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  return left.uid === right.uid && left.purpose === right.purpose &&
    left.consentTier === right.consentTier && left.policyVersion === right.policyVersion;
}

export function selectConsentRevocationSource(
  before: ConsentRecordSnapshot,
  after: ConsentRecordSnapshot
): Record<string, unknown> | null {
  if (before?.status === "granted") {
    // A genuine same-subject renewed grant does not revoke the prior grant.
    if (validSourceIdentity(before) && validSourceIdentity(after) &&
      sameAuthority(before, after) && after.status === "granted") return null;

    // A valid denial/revocation can carry its own fresh receipt. Otherwise
    // use the last known valid grant to notify downstream consumers; passing
    // a malformed successor to the publisher would fail before outbox write.
    if (validSourceIdentity(before) && validSourceIdentity(after) &&
      sameAuthority(before, after) && after.status !== "granted") return after;
    return validSourceIdentity(before) ? before : (after ?? before);
  }

  if (!after || after.status !== "revoked") return null;
  if (before?.status === after.status && before?.receiptHash === after.receiptHash) return null;
  return after;
}
