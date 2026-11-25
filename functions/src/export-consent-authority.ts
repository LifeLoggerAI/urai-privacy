import { HttpsError } from "firebase-functions/v2/https";
import { evaluateConsentDecision } from "./consent-decision";
import { timestampMillis } from "./export-lifecycle-contract";

/** Only a grant read by the server from the owner's canonical C7 document can
 * bind an export. Caller payloads and deletion tombstones do not issue grants. */
export function requireExportConsent(
  uid: string,
  record: Record<string, unknown> | undefined,
  ...boundRecords: Record<string, unknown>[]
) {
  const receipt = record?.receiptHash;
  const expires = timestampMillis(record?.expiresAt);
  const current = evaluateConsentDecision({ subjectUid: uid, purpose: "data.export", record });
  if (!current.allowed || typeof receipt !== "string" || !/^[0-9a-f]{64}$/.test(receipt) ||
      expires === null || boundRecords.some(bound => bound.consentReceiptHash !== receipt ||
        timestampMillis(bound.exportConsentExpiresAt) !== expires)) {
    throw new HttpsError("failed-precondition", "Grant data export consent and create a new request for this grant.");
  }
  return { consentReceiptHash: receipt, exportConsentExpiresAt: new Date(expires).toISOString() };
}
