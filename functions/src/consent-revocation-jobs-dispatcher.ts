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

function backoffMs(attempt: number): number {
  return Math.min(MAX_RETRY_MS, MIN_RETRY_MS * 2 ** Math.min(attempt - 1, 8));
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
      transaction.update(item.ref, {
        jobsDeliveryState: 'leased',
        jobsLeaseToken: token,
        jobsDeliveryAttempts: attempts + 1,
        jobsNextAttemptAt: Timestamp.fromMillis(at + LEASE_MS),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { status: 'claimed' as const, event, attempt: attempts + 1 };
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
