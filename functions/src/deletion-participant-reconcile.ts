import { randomUUID } from 'node:crypto';
import { FieldValue, getFirestore, type Firestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { DELETION_ADAPTERS } from './deletion-contract';
import { readJobsDeletionOrigin } from './jobs-deletion-origin';
import { terminalDigest, terminalOwnerHash } from './deletion-terminal-contract';

const requestId = z.string().regex(/^[A-Za-z0-9._:-]{8,160}$/);
const input = z.object({ centralRequestId: requestId }).strict();
function authority(row: Record<string, any>, owner?: string) {
  if (row.scope !== 'account' || row.status !== 'processing' || !row.createdAt ||
      row.deletionCompletionVerified === true || typeof row.uid !== 'string' || !row.uid ||
      (owner && row.uid !== owner)) throw new HttpsError('failed-precondition', 'Pending canonical account deletion required.');
}

/** Durable verification only: no destructive effects or terminal promotion. */
export async function reconcileDeletionParticipantSources(db: Firestore, centralRequestId: string) {
  if (!requestId.safeParse(centralRequestId).success) throw new HttpsError('invalid-argument', 'Invalid request.');
  const central = db.doc(`deletionRequests/${centralRequestId}`);
  const progress = central.collection('participantVerification').doc('urai-jobs');
  const bindingRef = central.collection('participantBindings').doc('urai-jobs');
  const evidenceRef = central.collection('participantEvidence').doc('urai-jobs');
  const token = randomUUID();
  const claim = await db.runTransaction(async tx => {
    const [snap, binding, evidence, prior] = await Promise.all([tx.get(central),tx.get(bindingRef),tx.get(evidenceRef),tx.get(progress)]);
    const row = snap.data() || {}; authority(row);
    const old = prior.data() || {};
    if (old.leaseUntilMillis > Date.now()) throw new HttpsError('aborted', 'Participant readback already running.');
    const attempts = Number.isSafeInteger(old.attempts) && old.attempts >= 0 ? old.attempts + 1 : 1;
    tx.set(progress, { state: 'verifying', token, leaseUntilMillis: Date.now() + 60000, attempts,
      globalDeletionComplete: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { owner: row.uid as string, binding: binding.data() || null, evidence: evidence.data() || null };
  });
  let state = 'pending', reason = 'AUTHORIZED_BINDING_AND_PARTICIPANT_EVIDENCE_REQUIRED', sourceHash: string | null = null;
  try {
    const b = claim.binding, e = claim.evidence;
    if (b && e) {
      if (b.schemaVersion !== 'urai-privacy-jobs-deletion-binding-v1' || b.centralRequestId !== centralRequestId ||
          b.ownerHash !== terminalOwnerHash(claim.owner) || b.state !== 'authorized-pending-verification' ||
          b.globalDeletionComplete !== false || e.globalDeletionComplete !== false ||
          e.centralRequestId !== centralRequestId || e.jobsRequestId !== b.jobsRequestId ||
          e.ownerHash !== b.ownerHash || e.sourceProject !== b.sourceProject ||
          e.acknowledgmentState !== 'evidence-received-verification-pending') throw new Error('BINDING_MISMATCH');
      const origin = await readJobsDeletionOrigin(claim.owner, b.jobsRequestId);
      if (!origin || origin.sourceProject !== b.sourceProject || origin.sourceReceiptPath !== e.sourceReceiptPath ||
          origin.sourceEvidenceHash !== e.evidenceHash) throw new Error('SOURCE_READBACK_MISMATCH');
      state = 'source-partial-verified'; reason = 'JOBS_OWNED_AND_CROSS_SYSTEM_DOMAINS_UNRESOLVED';
      sourceHash = origin.sourceEvidenceHash;
    }
  } catch { state = 'retry_wait'; reason = 'SOURCE_UNAVAILABLE_OR_MISMATCHED'; }
  await db.runTransaction(async tx => {
    const [snap, current, binding, evidence] = await Promise.all([tx.get(central),tx.get(progress),tx.get(bindingRef),tx.get(evidenceRef)]);
    authority(snap.data() || {}, claim.owner);
    const row = current.data() || {};
    if (row.token !== token || row.leaseUntilMillis <= Date.now()) throw new HttpsError('aborted', 'Readback lease lost.');
    if (terminalDigest(binding.data() || null) !== terminalDigest(claim.binding) ||
        terminalDigest(evidence.data() || null) !== terminalDigest(claim.evidence))
      throw new HttpsError('aborted', 'Participant authority changed.');
    tx.set(progress, { state, reason, sourceHash, leaseUntilMillis: 0, token: FieldValue.delete(),
      globalDeletionComplete: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { globalDeletionComplete: false, participants: DELETION_ADAPTERS.filter(a => a.status === 'pending').map(a =>
    a.id === 'urai-jobs' ? { participantId: a.id, state, reason } :
      { participantId: a.id, state: 'pending', reason: 'TERMINAL_SOURCE_ADAPTER_NOT_IMPLEMENTED' }) };
}

export const reconcileDeletionParticipants = onCall(async request => {
  if (!request.auth?.uid || request.auth.token.admin !== true) throw new HttpsError('permission-denied', 'Administrator required.');
  const parsed = input.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument', 'Canonical request required.');
  return reconcileDeletionParticipantSources(getFirestore(), parsed.data.centralRequestId);
});
