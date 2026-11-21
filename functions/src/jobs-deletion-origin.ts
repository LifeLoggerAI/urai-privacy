import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { jobsDeleteEvidenceHash, verifyJobsDeleteEvidence, type JobsDeleteEvidence } from './jobs-deletion-evidence';

const PROJECT = /^[a-z][a-z0-9-]{5,79}$/;
const ORIGIN_PATH = /^dataRightsRequests\/[A-Za-z0-9._:-]{8,160}\/audit\/execution-[a-f0-9]{24}$/;
const TERMINAL = 'PROTECTED_STAGING_JOBS_SCOPE_APPLIED_CENTRAL_PRIVACY_REQUIRED';

/** Separate read-only Jobs source project; a caller's receipt is not proof. */
export async function verifyJobsDeletionOrigin(
  ownerUid: string, jobsRequestId: string, submitted: JobsDeleteEvidence
): Promise<{ sourceProject: string; sourceReceiptPath: string; sourceEvidenceHash: string } | null> {
  const project = process.env.URAI_JOBS_DELETION_SOURCE_PROJECT || '';
  const privacyProject = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT ||
    (getApps().length ? getApp().options.projectId : '') || '';
  if (!PROJECT.test(project) || !privacyProject || project === privacyProject) return null;
  const emulator = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (emulator && (emulator !== '127.0.0.1:8080' ||
      privacyProject !== 'urai-privacy-r1512-disposable' ||
      project !== 'urai-jobs-r1624-disposable' ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099')) return null;
  try {
    const name = 'urai-jobs-deletion-origin-readonly';
    const app = getApps().find(x => x.name === name) ?? initializeApp({projectId: project},name);
    const db = getFirestore(app);
    const ref = db.collection('dataRightsRequests').doc(jobsRequestId);
    const snap = await ref.get();
    if (!snap.exists) return null;
    const row = snap.data() ?? {};
    const path = row.executionReceiptPath;
    if (row.ownerUid !== ownerUid || row.requestType !== 'DELETE' ||
        row.status !== 'IN_REVIEW' || row.executionState !== TERMINAL ||
        typeof path !== 'string' || !ORIGIN_PATH.test(path) ||
        !path.startsWith(ref.path + '/audit/')) return null;
    const record = await db.doc(path).get();
    if (!record.exists) return null;
    const verified = verifyJobsDeleteEvidence(record.data(),ownerUid,jobsRequestId);
    if (!verified) return null;
    const sourceHash = jobsDeleteEvidenceHash(verified);
    if (sourceHash !== jobsDeleteEvidenceHash(submitted)) return null;
    return {sourceProject:project,sourceReceiptPath:path,sourceEvidenceHash:sourceHash};
  } catch { return null; }
}
