import { randomUUID } from 'node:crypto';
import { FieldValue, Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';
import {
  buildJobsRevocationEventV2,
  sendJobsRevocationEvent,
  type JobsRevocationTransport,
} from './consent-revocation-jobs-contract';

/**
 * Prepared, NOT DEPLOYED, Privacy -> Jobs outbox delivery implementation.
 * No timer, callable, scheduler, or functions-entry export is installed here.
 * A reviewed system-only wrapper must obtain the dedicated secret from the
 * deployment's secret manager, verify runtime IAM, and explicitly call this.
 * Never let a client request or a general environment flag activate delivery.
 */
const DESTINATION = 'urai-jobs';
const ENDPOINT_HOST = 'us-central1-urai-jobs.cloudfunctions.net';
const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 12;
const MAX_BATCH = 20;
const MIN_RETRY_MS = 30_000;
const MAX_RETRY_MS = 3_600_000;
const STATES = ['pending', 'retry', 'leased'] as const;

type State = (typeof STATES)[number];
type DeliverySummary = Readonly<{
  scanned: number;
  applied: number;
  retry: number;
  needsReview: number;
  skipped: number;
}>;

type DispatchDependencies = Readonly<{
  db?: Firestore;
  now?: () => number;
  batchLimit?: number;
}>;

function validTransport(config: JobsRevocationTransport): void {
  if (!config || typeof config.endpoint !== 'string' ||
      config.expectedHost !== ENDPOINT_HOST ||
      typeof config.bearerToken !== 'string' ||
      config.bearerToken.length < 32 || config.bearerToken.length > 4096 ||
      /[\r\n]/.test(config.bearerToken)) {
    throw new Error('PRIVACY_JOBS_DISPATCHER_AUTHORITY_UNAVAILABLE');
  }
  try {
    const uri = new URL(config.endpoint);
    if (uri.protocol !== 'https:' || uri.hostname !== ENDPOINT_HOST ||
        uri.pathname !== '/ingestConsentRevocation' || uri.port ||
        uri.username || uri.password || uri.search || uri.hash) {
      throw new Error('invalid endpoint');
    }
  } catch {
    throw new Error('PRIVACY_JOBS_DISPATCHER_AUTHORITY_UNAVAILABLE');
  }
}

function due(value: unknown, now: number): boolean {
  return value instanceof Timestamp && value.toMillis() <= now;
}

function attemptsOf(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0 &&
    (value as number) <= MAX_ATTEMPTS ? value as number : null;
}

/** A lease must have an owner, and a non-leased obligation must not still
 * carry a stale owner token. Quarantine contradictions instead of stealing
 * a possibly active worker's request or overwriting its completion receipt.
 */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validLeaseMetadata(state: State, token: unknown): boolean {
  if (state === 'leased') return typeof token === 'string' && UUID_V4.test(token);
  return token === undefined;
}

/** Source-created records begin pending with zero attempts. Once leased, the
 * attempt counter is incremented transactionally and can never revert to zero.
 * Inconsistent state history must not be treated as a fresh permission to send. */
function validStateAttemptHistory(state: State, attempts: number): boolean {
  return state === 'pending' ? attempts === 0 : attempts >= 1;
}

function backoffMs(attempt: number): number {
  return Math.min(MAX_RETRY_MS, MIN_RETRY_MS * 2 ** Math.min(attempt - 1, 8));
}

/** Bind the remote delivery to the canonical consent document examined in the
 * same Firestore transaction. A regrant, delete/recreate, or newer revocation
 * during network transit requires reconciliation instead of false completion.
 * Firestore updateTime prevents an ABA change from looking like the original.
 */
function consentAuthorityStamp(snapshot: {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
  updateTime?: Timestamp;
}, event: { ownerUid: string; purpose: string; sourceReceiptHash: string }): string | null {
  if (!snapshot.exists) return 'missing'; // Deleted consent still requires downstream cleanup.
  const current = snapshot.data() ?? {};
  const revision = snapshot.updateTime;
  if (!(revision instanceof Timestamp) || !Number.isSafeInteger(revision.seconds) ||
      revision.seconds <= 0 || !Number.isSafeInteger(revision.nanoseconds) ||
      revision.nanoseconds < 0 || revision.nanoseconds > 999999999 ||
      current.uid !== event.ownerUid || current.purpose !== event.purpose ||
      current.receiptHash !== event.sourceReceiptHash ||
      !['revoked', 'denied', 'expired'].includes(String(current.status))) return null;
  return JSON.stringify({revision: [revision.seconds, revision.nanoseconds], uid: current.uid,
    purpose: current.purpose, status: current.status, receiptHash: current.receiptHash});
}

/**
 * Performs one bounded scan of due events using an exact composite index.
 * The Firestore document is the durable source of truth; remote sends are
 * always outside transactions. Jobs must independently enforce its own
 * idempotency and consent blocks, since a crash can cause at-least-once send.
 *
 * This is a library function, not an activated Cloud Scheduler endpoint.
 */
export async function dispatchPendingJobsRevocations(
  transport: JobsRevocationTransport,
  dependencies: DispatchDependencies = {},
): Promise<DeliverySummary> {
  validTransport(transport); // Fail before any Firestore lease if auth is unavailable.
  const db = dependencies.db ?? getFirestore();
  const now = dependencies.now ?? Date.now;
  const at = now();
  const limit = dependencies.batchLimit ?? MAX_BATCH;
  if (!Number.isSafeInteger(at) || at <= 0 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BATCH) {
    throw new Error('PRIVACY_JOBS_DISPATCHER_INVALID_BOUNDS');
  }
  const records = await db.collection('consentRevocationOutbox')
    .where('jobsDeliveryConsumerId', '==', DESTINATION)
    .where('jobsDeliveryState', 'in', STATES)
    .where('jobsNextAttemptAt', '<=', Timestamp.fromMillis(at))
    .orderBy('jobsNextAttemptAt', 'asc')
    .limit(limit)
    .get();
  let applied = 0;
  let retry = 0;
  let needsReview = 0;
  let skipped = 0;

  for (const item of records.docs) {
    const token = randomUUID();
    const result = await db.runTransaction(async (transaction) => {
      const live = await transaction.get(item.ref);
      if (!live.exists) return { status: 'skip' as const };
      const data = live.data() ?? {};
      const state = data.jobsDeliveryState as State;
      if (data.jobsDeliveryConsumerId !== DESTINATION || !STATES.includes(state) ||
          !due(data.jobsNextAttemptAt, at)) return { status: 'skip' as const };

      if (!validLeaseMetadata(state, data.jobsLeaseToken)) {
        transaction.update(item.ref, {
          jobsDeliveryState: 'needs-review',
          jobsDeliveryLastCode: 'invalid_lease_metadata',
          jobsLeaseToken: FieldValue.delete(),
          jobsNextAttemptAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'review' as const };
      }

      const attempts = attemptsOf(data.jobsDeliveryAttempts);
      if (attempts === null || attempts >= MAX_ATTEMPTS) {
        transaction.update(item.ref, {
          jobsDeliveryState: 'needs-review',
          jobsDeliveryLastCode: 'invalid_attempt_budget',
          jobsLeaseToken: FieldValue.delete(),
          jobsNextAttemptAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'review' as const };
      }
      if (!validStateAttemptHistory(state, attempts)) {
        transaction.update(item.ref, {
          jobsDeliveryState: 'needs-review',
          jobsDeliveryLastCode: 'invalid_state_attempt_history',
          jobsLeaseToken: FieldValue.delete(),
          jobsNextAttemptAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'review' as const };
      }
      let event;
      try {
        event = buildJobsRevocationEventV2(item.id, data);
      } catch {
        // Corrupted event identity must never be delivered or marked applied.
        transaction.update(item.ref, {
          jobsDeliveryState: 'needs-review',
          jobsDeliveryLastCode: 'invalid_outbox_identity',
          jobsLeaseToken: FieldValue.delete(),
          jobsNextAttemptAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'review' as const };
      }
      const consentRef = db.collection('consentRecords').doc(data.consentRecordId);
      const canonical = await transaction.get(consentRef);
      const authorityStamp = consentAuthorityStamp(canonical, event);
      if (authorityStamp === null) {
        transaction.update(item.ref, {
          jobsDeliveryState: 'needs-review',
          jobsDeliveryLastCode: 'current_consent_unreconciled',
          jobsLeaseToken: FieldValue.delete(),
          jobsNextAttemptAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { status: 'review' as const };
      }
      transaction.update(item.ref, {
        jobsDeliveryState: 'leased',
        jobsLeaseToken: token,
        jobsDeliveryAttempts: attempts + 1,
        jobsNextAttemptAt: Timestamp.fromMillis(at + LEASE_MS),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'claimed' as const, event, attempt: attempts + 1, authorityStamp };
    });

    if (result.status === 'skip') { skipped++; continue; }
    if (result.status === 'review') { needsReview++; continue; }

    // A verified Jobs ack is the ONLY event that may transition this outbox
    // record to 'applied'. A network timeout after remote receipt is retryable.
    let confirmedHash: string | null = null;
    try {
      const ack = await sendJobsRevocationEvent(result.event, transport);
      if (ack.eventId !== item.id || ack.consumerId !== DESTINATION ||
          !/^[0-9a-f]{64}$/.test(ack.acknowledgementHash)) {
        throw new Error('ack identity mismatch');
      }
      confirmedHash = ack.acknowledgementHash;
    } catch {
      // Do not persist raw provider errors or private object references.
    }

    const final = await db.runTransaction(async (transaction) => {
      const latest = await transaction.get(item.ref);
      const state = latest.data() ?? {};
      if (!latest.exists || state.jobsDeliveryState !== 'leased' ||
          state.jobsLeaseToken !== token ||
          state.jobsDeliveryAttempts !== result.attempt) return 'lost-lease' as const;
      // The lease alone is not proof that the original publisher event remains
      // unchanged. Revalidate immutable source fields inside finalization,
      // BEFORE reading a possibly altered consentRecordId or accepting an ACK.
      let samePublisherEvent = state.jobsDeliveryConsumerId === DESTINATION;
      try {
        samePublisherEvent = samePublisherEvent &&
          JSON.stringify(buildJobsRevocationEventV2(item.id, state)) === JSON.stringify(result.event);
      } catch {
        samePublisherEvent = false;
      }
      if (!samePublisherEvent) {
        transaction.update(item.ref, {
          jobsDeliveryState: 'needs-review',
          jobsDeliveryLastCode: 'outbox_identity_changed_during_delivery',
          jobsLeaseToken: FieldValue.delete(),
          jobsNextAttemptAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return 'needs-review' as const;
      }
      const canonical = await transaction.get(db.collection('consentRecords').doc(state.consentRecordId));
      if (consentAuthorityStamp(canonical, result.event) !== result.authorityStamp) {
        transaction.update(item.ref, {
          jobsDeliveryState: 'needs-review',
          jobsDeliveryLastCode: 'consent_changed_during_delivery',
          jobsLeaseToken: FieldValue.delete(),
          jobsNextAttemptAt: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return 'needs-review' as const;
      }
      if (confirmedHash !== null) {
        transaction.update(item.ref, {
          jobsDeliveryState: 'applied',
          jobsDeliveryAckHash: confirmedHash,
          jobsDeliveredAt: FieldValue.serverTimestamp(),
          jobsLeaseToken: FieldValue.delete(),
          jobsNextAttemptAt: FieldValue.delete(),
          jobsDeliveryLastCode: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        return 'applied' as const;
      }
      const terminal = result.attempt >= MAX_ATTEMPTS;
      transaction.update(item.ref, {
        jobsDeliveryState: terminal ? 'needs-review' : 'retry',
        jobsDeliveryLastCode: 'delivery_unconfirmed',
        jobsLeaseToken: FieldValue.delete(),
        jobsNextAttemptAt: terminal ? FieldValue.delete()
          : Timestamp.fromMillis(at + backoffMs(result.attempt)),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return terminal ? 'needs-review' as const : 'retry' as const;
    });
    if (final === 'applied') applied++;
    else if (final === 'retry') retry++;
    else if (final === 'needs-review') needsReview++;
    else skipped++; // Another worker owns the active lease; never overwrite it.
  }
  return { scanned: records.docs.length, applied, retry, needsReview, skipped };
}
