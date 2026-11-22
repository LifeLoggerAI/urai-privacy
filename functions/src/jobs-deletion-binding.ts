import { createHash } from 'node:crypto';
import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';

const Input=z.object({
  centralRequestId:z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  jobsRequestId:z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const sourceProject=()=>process.env.URAI_JOBS_DELETION_SOURCE_PROJECT || '';

function sourceFirestore() {
  const project=sourceProject();
  const privacy=process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT ||
    (getApps().length ? getApp().options.projectId : '') || '';
  if (!/^[a-z][a-z0-9-]{5,79}$/.test(project) || !privacy || project===privacy)
    throw new HttpsError('failed-precondition','Approved independent Jobs source is required.');
  if (process.env.FIRESTORE_EMULATOR_HOST &&
    (process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8080' ||
     process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9099' ||
     privacy!=='urai-privacy-r1512-disposable' || project!=='urai-jobs-r1624-disposable'))
    throw new HttpsError('failed-precondition','Unapproved Jobs test source.');
  const name='urai-jobs-deletion-origin-readonly';
  const app=getApps().find(a=>a.name===name) || initializeApp({projectId:project},name);
  return getFirestore(app);
}

/** Only an authenticated canonical Privacy administrator may authorize the
 * immutable Jobs participant-to-central deletion link. The Jobs request must
 * be an independently read, owner-matched, approved, unexecuted DELETE.
 */
export const authorizeJobsDeletionBinding=onCall(async request=>{
  if (!request.auth?.uid || request.auth.token.admin!==true)
    throw new HttpsError('permission-denied','Canonical Privacy administrator required.');
  const parsed=Input.safeParse(request.data);
  if (!parsed.success) throw new HttpsError('invalid-argument','Invalid deletion binding.');
  const {centralRequestId,jobsRequestId}=parsed.data;
  const db=getFirestore();
  const source=sourceFirestore();
  const central=db.collection('deletionRequests').doc(centralRequestId);
  const binding=central.collection('participantBindings').doc('urai-jobs');
  const jobRef=source.collection('dataRightsRequests').doc(jobsRequestId);
  const submittedRef=jobRef.collection('audit').doc('submitted');
  const [centralSnap,jobSnap,submittedSnap]=await Promise.all([central.get(),jobRef.get(),submittedRef.get()]);
  if (!centralSnap.exists || !jobSnap.exists)
    throw new HttpsError('not-found','Canonical or Jobs deletion request unavailable.');
  const owner=centralSnap.data()?.uid;
  const job=jobSnap.data()||{};
  const submission=submittedSnap.data()||{};
  if (typeof owner!=='string' || !owner.trim() ||
      centralSnap.data()?.scope!=='account' || !centralSnap.data()?.createdAt ||
      !submittedSnap.exists || submission.event!=='DATA_RIGHTS_REQUEST_SUBMITTED' ||
      submission.actorUid!==owner || submission.status!=='PENDING' ||
      !submission.createdAt || job.requestId!==jobsRequestId || !job.createdAt ||
      centralSnap.data()?.status!=='processing' ||
      centralSnap.data()?.deletionCompletionVerified===true ||
      job.ownerUid!==owner || job.requestType!=='DELETE' ||
      job.status!=='APPROVED' ||
      job.executionState!=='PENDING' ||
      job.executionReceiptPath)
    throw new HttpsError('failed-precondition','Jobs request is not matching and unexecuted.');
  const result=await db.runTransaction(async tx=>{
    const [current,prior]=await Promise.all([tx.get(central),tx.get(binding)]);
    const row=current.data()||{};
    if (!current.exists || row.uid!==owner || row.status!=='processing' ||
        row.deletionCompletionVerified===true)
      throw new HttpsError('failed-precondition','Canonical deletion authority changed.');
    if (prior.exists) {
      const saved=prior.data()||{};
      if (saved.jobsRequestId!==jobsRequestId || saved.ownerHash!==hash(owner) ||
          saved.sourceProject!==sourceProject() ||
          saved.state!=='authorized-pending-verification')
        throw new HttpsError('already-exists','Conflicting immutable Jobs deletion binding.');
      return true;
    }
    tx.create(binding,{
      schemaVersion:'urai-privacy-jobs-deletion-binding-v1',
      centralRequestId,jobsRequestId,ownerHash:hash(owner),
      sourceProject:sourceProject(),state:'authorized-pending-verification',
      authorizedBy:request.auth?.uid,
      globalDeletionComplete:false,
      createdAt:FieldValue.serverTimestamp(),
    });
    return false;
  });
  return {authorized:true,idempotent:result,centralRequestId,jobsRequestId,
    state:'authorized-pending-verification',globalDeletionComplete:false};
});
