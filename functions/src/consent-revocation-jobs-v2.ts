import { createHash } from "node:crypto";

export type CanonicalJobsV2Revocation = Readonly<{
  type: "consent.revoked.v2";
  eventId: string;
  ownerUid: string;
  purpose: string;
  policyVersion: string;
  sourceReceiptHash: string;
  correlationId: string;
  revokedAt: string;
}>;

type TransportHashFields = {
  eventId: string;
  recordId: string;
  uid: string;
  purpose: string;
  policyVersion: string;
  sourceReceiptHash: string;
  revokedAt: string;
};

const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const isHex64 = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

/**
 * A separate v2 dispatch-evidence digest keeps the original v1 outbox hash
 * unchanged for historical receipts. Neither SHA-256 value is a signature
 * or substitutes for trusted IAM, event custody, or consumer ACKs.
 */
export function revocationTransportHash(input: TransportHashFields): string {
  return digest({
    eventId: input.eventId,
    recordId: input.recordId,
    uid: input.uid,
    purpose: input.purpose,
    policyVersion: input.policyVersion,
    sourceReceiptHash: input.sourceReceiptHash,
    revokedAt: input.revokedAt
  });
}

function isCanonicalEventTime(value: unknown): value is string {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(value)) return false;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return false;
  // Reject invalid calendar rollover rather than accepting Date.parse normalization.
  return new Date(millis).toISOString().slice(0, 19) === value.slice(0, 19);
}

/**
 * Source-bound, pure, READ-ONLY projection of Privacy's canonical outbox into
 * the existing Jobs #501 v2 admission contract.
 *
 * THIS IS NOT A DISPATCHER. Missing event-time provenance or any corrupt
 * immutable receipt fails closed. A successful projection is NOT delivery,
 * provider-side blocking, physical deletion, or cloud IAM acceptance.
 */
export function projectCanonicalJobsV2Revocation(outbox: unknown): CanonicalJobsV2Revocation | null {
  if (!outbox || typeof outbox !== "object" || Array.isArray(outbox)) return null;
  const row = outbox as Record<string, unknown>;
  if (row.schemaVersion !== "consent.revoked.v1" ||
      !isHex64(row.eventId) ||
      typeof row.consentRecordId !== "string" || !row.consentRecordId ||
      typeof row.uid !== "string" || !row.uid || row.uid.length > 160 ||
      row.uid !== row.uid.trim() || /[\r\n]/.test(row.uid) ||
      typeof row.purpose !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(row.purpose) ||
      typeof row.consentTier !== "string" || !row.consentTier ||
      typeof row.policyVersion !== "string" || !row.policyVersion ||
      row.policyVersion.length > 80 || row.policyVersion !== row.policyVersion.trim() ||
      /[\r\n]/.test(row.policyVersion) ||
      !isHex64(row.sourceReceiptHash) || !isHex64(row.integrityHash) ||
      !isHex64(row.revocationTransportHash) || !isCanonicalEventTime(row.revokedAt)) return null;

  const prior = row.priorGrantReceiptHash;
  const priorState = row.priorGrantEvidenceState;
  if (priorState === "present" ? !isHex64(prior) :
      (priorState === "not_applicable" || priorState === "missing_or_invalid") ? prior !== null :
      true) return null;

  const eventId = digest({
    schemaVersion: "consent.revoked.v1",
    recordId: row.consentRecordId,
    uid: row.uid,
    purpose: row.purpose,
    consentTier: row.consentTier,
    policyVersion: row.policyVersion,
    receiptHash: row.sourceReceiptHash
  });
  if (eventId !== row.eventId) return null;
  const integrityHash = digest({
    eventId,
    recordId: row.consentRecordId,
    uid: row.uid,
    purpose: row.purpose,
    priorGrantReceiptHash: prior,
    priorGrantEvidenceState: priorState
  });
  if (integrityHash !== row.integrityHash) return null;

  const transport = revocationTransportHash({
    eventId,
    recordId: row.consentRecordId,
    uid: row.uid,
    purpose: row.purpose,
    policyVersion: row.policyVersion,
    sourceReceiptHash: row.sourceReceiptHash,
    revokedAt: row.revokedAt
  });
  if (transport !== row.revocationTransportHash) return null;

  return Object.freeze({
    type: "consent.revoked.v2",
    eventId,
    ownerUid: row.uid,
    purpose: row.purpose,
    policyVersion: row.policyVersion,
    sourceReceiptHash: row.sourceReceiptHash,
    correlationId: `revocation:${eventId}`,
    revokedAt: row.revokedAt
  });
}
