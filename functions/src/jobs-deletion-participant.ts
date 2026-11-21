import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { isTrustedJobsConsentCaller, isTrustedActiveJobsConsentCaller } from './life-movie-jobs-identity';
import { jobsDeleteEvidenceHash, verifyJobsDeleteEvidence } from './jobs-deletion-evidence';

const inputSchema = z.object({
  centralRequestId: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  jobsRequestId: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  receipt: z.record(z.string(), z.unknown()),
}).strict();

/**
 * Stores an authenticated Jobs-scoped receipt as immutable participant evidence.
 * This endpoint NEVER sets adapter='active', deletion='completed', or global
 * completion=true. Independent Jobs backend verification and all other adapters
 * remain mandatory before an ecosystem completion decision.
 */
export const recordJobsDeletionParticipantEvidence = onCall(async request => {
  const parsed = inputSchema.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument','Invalid Jobs deletion receipt envelope.');
  const pinnedUid = process.env.URAI_JOBS_PRIVACY_DELETION_SERVICE_UID;
  const activeService = await isTrustedActiveJobsConsentCaller(
    request.auth, pinnedUid, request.rawRequest.headers.authorization,
    (token, revoked) => getAuth().verifyIdToken(token, revoked)
  );
  // The disposable Firebase Auth emulator signs test ID tokens without the
  // production JWT signature segment. Accept that format ONLY on the exact
  // isolated loopback project, still requiring Firebase Admin checkRevoked,
  // a pinned service UID and independently verified custom-provider claims.
  let disposableService = false;
  if (!activeService &&
      process.env.GCLOUD_PROJECT === 'urai-privacy-r1512-disposable' &&
      process.env.FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099' &&
      process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080' &&
      isTrustedJobsConsentCaller(request.auth, pinnedUid)) {
    const bearer = request.rawRequest.headers.authorization;
    const match = typeof bearer === 'string' ?
      /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.)$/.exec(bearer) : null;
    if (match) {
      try {
        const verified = await getAuth().verifyIdToken(match[1], true);
        disposableService = isTrustedJobsConsentCaller(
          {uid:verified.uid,token:verified},pinnedUid
        );
      } catch { disposableService = false; }
    }
  }
  if (!activeService && !disposableService)
    throw new HttpsError('permission-denied','Current Jobs service identity is required.');

  const db = getFirestore();
  const requestRef = db.collection('deletionRequests').doc(parsed.data.centralRequestId);
  const evidenceRef = requestRef.collection('participantEvidence').doc('urai-jobs');
  const result = await db.runTransaction(async tx => {
    const [subject, prior] = await Promise.all([tx.get(requestRef), tx.get(evidenceRef)]);
    if (!subject.exists) throw new HttpsError('not-found','Canonical deletion request not found.');
    const row = subject.data() ?? {};
    if (row.status !== 'processing' || typeof row.uid !== 'string' ||
        row.deletionCompletionVerified === true) {
      throw new HttpsError('failed-precondition','Canonical deletion is not pending verification.');
    }
    const receipt = verifyJobsDeleteEvidence(parsed.data.receipt,row.uid,parsed.data.jobsRequestId);
    if (!receipt) throw new HttpsError('failed-precondition','Jobs deletion evidence is not bound to current owner and request.');
    const hash = jobsDeleteEvidenceHash(receipt);
    if (prior.exists) {
      if (prior.data()?.evidenceHash !== hash ||
          prior.data()?.jobsRequestId !== parsed.data.jobsRequestId ||
          prior.data()?.centralRequestId !== parsed.data.centralRequestId ||
          prior.data()?.serviceUid !== request.auth?.uid) {
        throw new HttpsError('already-exists','Conflicting immutable Jobs participant evidence.');
      }
      return { idempotent:true, hash };
    }
    tx.create(evidenceRef, {
      schemaVersion:'urai-jobs-privacy-participant-evidence-v1',
      centralRequestId:parsed.data.centralRequestId,
      jobsRequestId:parsed.data.jobsRequestId,
      ownerHash:receipt.ownerHash,
      evidenceHash:hash,
      jobsResultDigest:receipt.resultDigest,
      serviceUid:request.auth?.uid,
      sourceState:receipt.terminalState,
      acknowledgmentState:'evidence-received-verification-pending',
      globalDeletionComplete:false,
      createdAt:FieldValue.serverTimestamp(),
    });
    return { idempotent:false, hash };
  });
  return { accepted:true, idempotent:result.idempotent,
    evidenceHash:result.hash, participant:'urai-jobs',
    acknowledgmentState:'evidence-received-verification-pending',
    globalDeletionComplete:false };
});
