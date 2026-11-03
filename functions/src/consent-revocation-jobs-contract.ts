import { createHash, timingSafeEqual } from 'node:crypto';

/** The independent Privacy outbox v1 and Jobs consumer v2 schemas.
 * This module performs deterministic transformation and acknowledgement
 * verification, but does NOT send a provider request or certify delivery. */
export type JobsRevocationEventV2 = Readonly<{
  type: 'consent.revoked.v2';
  eventId: string;
  ownerUid: string;
  purpose: string;
  policyVersion: string;
  correlationId: string;
  revokedAt: string;
  sourceReceiptHash: string;
}>;

const HEX64 = /^[0-9a-f]{64}$/;
const IDENT = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const RECORD_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,399}$/;
function hash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PRIVACY_JOBS_REVOCATION_INVALID_OBJECT');
  return value as Record<string, unknown>;
}
function field(value: unknown, name: string, pattern: RegExp): string {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`PRIVACY_JOBS_REVOCATION_INVALID_${name}`);
  return value;
}
function isoDate(value: unknown): string {
  try {
    // Firestore Admin Timestamp, never a client-supplied value.
    if (!value || typeof value !== 'object' || typeof (value as { toDate?: unknown }).toDate !== 'function') {
      throw new Error('timestamp');
    }
    const raw = (value as { toDate: () => Date }).toDate();
    if (!(raw instanceof Date) || !Number.isFinite(raw.getTime())) throw new Error('timestamp');
    return raw.toISOString();
  } catch {
    throw new Error('PRIVACY_JOBS_REVOCATION_NO_SERVER_TIMESTAMP');
  }
}

/** Fail closed if the v1 source is missing, forged, truncated or modified.
 * The eventId and integrityHash are bound to the original publisher's exact
 * canonical digest structure, not supplied as unchecked transport authority. */
export function buildJobsRevocationEventV2(outboxId: string, input: unknown): JobsRevocationEventV2 {
  const data = object(input);
  if (data.schemaVersion !== 'consent.revoked.v1' || data.status !== 'pending') {
    throw new Error('PRIVACY_JOBS_REVOCATION_NOT_PENDING_V1');
  }
  const eventId = field(data.eventId, 'EVENT_ID', HEX64);
  if (outboxId !== eventId) throw new Error('PRIVACY_JOBS_REVOCATION_ID_MISMATCH');
  const ownerUid = field(data.uid, 'OWNER', IDENT);
  const purpose = field(data.purpose, 'PURPOSE', IDENT);
  const consentTier = field(data.consentTier, 'TIER', /^C[1-9][0-9]*$/);
  const policyVersion = field(data.policyVersion, 'POLICY_VERSION', /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/);
  const sourceReceiptHash = field(data.sourceReceiptHash, 'SOURCE_HASH', HEX64);
  const recordId = field(data.consentRecordId, 'RECORD_ID', RECORD_ID);
  if (recordId !== `${ownerUid}_${purpose.replace(/[^a-zA-Z0-9_-]/g, '_')}`) {
    throw new Error('PRIVACY_JOBS_REVOCATION_RECORD_SCOPE_MISMATCH');
  }
  const expectedId = hash({
    schemaVersion: 'consent.revoked.v1', recordId, uid: ownerUid,
    purpose, consentTier, policyVersion, receiptHash: sourceReceiptHash,
  });
  if (expectedId !== eventId || data.integrityHash !== hash({ eventId, recordId, uid: ownerUid, purpose })) {
    throw new Error('PRIVACY_JOBS_REVOCATION_PUBLISHER_INTEGRITY_MISMATCH');
  }
  const revokedAt = isoDate(data.createdAt);
  return {
    type: 'consent.revoked.v2', eventId, ownerUid, purpose, policyVersion,
    correlationId: `revocation:${eventId}`, revokedAt, sourceReceiptHash,
  };
}

/** Same key order and digest as urai-jobs canonicalSourceRevocationAckHash
 * pinned to Jobs PR #234. Not a signature; caller MUST also verify the HTTPS
 * endpoint and secret-bound consumer identity before trusting its response. */
export function jobsRevocationAckHash(event: JobsRevocationEventV2): string {
  return hash({
    type: 'consent.revoked.v2', eventId: event.eventId,
    ownerUid: event.ownerUid, purpose: event.purpose,
    policyVersion: event.policyVersion, sourceReceiptHash: event.sourceReceiptHash,
    correlationId: event.correlationId, revokedAt: event.revokedAt, status: 'blocked',
  });
}
export function verifyJobsRevocationResponse(event: JobsRevocationEventV2, value: unknown): boolean {
  try {
    const response = object(value);
    if (response.ok !== true) return false;
    const ack = object(response.acknowledgement);
    if (ack.consumerId !== 'urai-jobs' || ack.eventType !== event.type ||
        ack.eventId !== event.eventId || ack.ownerUid !== event.ownerUid ||
        ack.purpose !== event.purpose || ack.policyVersion !== event.policyVersion ||
        ack.sourceReceiptHash !== event.sourceReceiptHash ||
        ack.correlationId !== event.correlationId || ack.revokedAt !== event.revokedAt ||
        ack.status !== 'blocked' || typeof ack.integrityHash !== 'string' ||
        !HEX64.test(ack.integrityHash)) return false;
    const expected = Buffer.from(jobsRevocationAckHash(event), 'hex');
    const actual = Buffer.from(ack.integrityHash, 'hex');
    if (!timingSafeEqual(expected, actual)) return false;
    const summary = object(ack.derivativeInvalidation);
    if (summary.purpose !== event.purpose) return false;
    for (const key of ['jobsScanned', 'jobsInvalidated', 'plansInvalidated', 'storageObjectsDeleted']) {
      if (!Number.isSafeInteger(summary[key]) || (summary[key] as number) < 0) return false;
    }
    if ((summary.jobsInvalidated as number) > (summary.jobsScanned as number)) return false;
    return true;
  } catch { return false; }
}
