export type ConsentRecordSnapshot = Record<string, unknown> | null;

export function selectConsentRevocationSource(
  before: ConsentRecordSnapshot,
  after: ConsentRecordSnapshot
): Record<string, unknown> | null {
  const revokesExistingGrant =
    before?.status === "granted" &&
    after?.status !== "granted";

  if (!after && !revokesExistingGrant) return null;
  if (after && after.status !== "revoked" && !revokesExistingGrant) return null;
  if (after && before?.status === after.status && before?.receiptHash === after.receiptHash) return null;

  return after ?? before;
}
