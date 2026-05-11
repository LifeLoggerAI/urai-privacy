
import * as functions from 'firebase-functions';
import { firestore, auth, storage } from 'firebase-admin';
import { logAuditEvent } from './audit';

const db = firestore();
const adminAuth = auth();
const bucket = storage().bucket();

/**
 * A callable function for users to request the deletion of their account and all associated data.
 */
export const requestDeletion = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    await logAuditEvent(db, { actor: 'unauthenticated', action: 'requestDeletion', target: 'deletion_requests', status: 'failure', reason: 'Authentication required' });
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to request deletion.');
  }

  const requestId = db.collection('deletion_requests').doc().id;

  const requestRecord = {
    userId: uid,
    status: 'pending',
    createdAt: firestore.Timestamp.now(),
  };

  try {
    await db.collection('deletion_requests').doc(requestId).set(requestRecord);
    await logAuditEvent(db, { actor: uid, action: 'requestDeletion', target: `deletion_requests/${requestId}`, status: 'success' });
    return { success: true, requestId };
  } catch (error) {
    await logAuditEvent(db, { actor: uid, action: 'requestDeletion', target: `deletion_requests`, status: 'failure', reason: error.message });
    throw new functions.https.HttpsError('internal', 'Failed to create deletion request.');
  }
});

/**
 * A Firestore trigger that processes a data deletion request when it's created.
 */
export const processDeletionRequest = functions.firestore.document('deletion_requests/{requestId}').onCreate(async (snap, context) => {
  const request = snap.data();
  const requestId = snap.id;
  const userId = request.userId;

  // 1. Mark request as 'processing'
  await snap.ref.update({ status: 'processing' });
  await logAuditEvent(db, { userId, actor: 'system', action: 'processDeletionRequest', target: `deletion_requests/${requestId}`, status: 'success', reason: 'Started processing deletion' });

  try {
    // 2. Delete Firestore data
    // In a real app, you would have a list of collections to delete from.
    // For this example, we will just delete the user's consent profile.
    await db.collection('consent_profiles').doc(userId).delete();

    // 3. Delete Storage data (e.g., exports)
    const [files] = await bucket.getFiles({ prefix: `exports/${userId}/` });
    await Promise.all(files.map(file => file.delete()));

    // 4. Delete Firebase Auth user (FINAL STEP)
    await adminAuth.deleteUser(userId);

    // 5. Mark request as 'completed'
    await snap.ref.update({ status: 'completed' });
    await logAuditEvent(db, { userId, actor: 'system', action: 'processDeletionRequest', target: `deletion_requests/${requestId}`, status: 'success', reason: 'Deletion completed successfully' });

  } catch (error) {
    console.error(`Failed to process deletion request ${requestId} for user ${userId}:`, error);
    await snap.ref.update({ status: 'failed', error: error.message });
    await logAuditEvent(db, { userId, actor: 'system', action: 'processDeletionRequest', target: `deletion_requests/${requestId}`, status: 'failure', reason: error.message });
  }
});
