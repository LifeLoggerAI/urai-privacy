
import * as functions from 'firebase-functions';
import { firestore, storage } from 'firebase-admin';
import { logAuditEvent } from './audit';

const db = firestore();
const bucket = storage().bucket(); // Default bucket

/**
 * A callable function for users to request an export of their data.
 * This function creates a record in `export_requests` which triggers the export process.
 */
export const requestDataExport = functions.https.onCall(async (data, context) => {
  const uid = context.auth?.uid;
  if (!uid) {
    await logAuditEvent(db, { actor: 'unauthenticated', action: 'requestDataExport', target: 'export_requests', status: 'failure', reason: 'Authentication required' });
    throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to request a data export.');
  }

  const requestId = db.collection('export_requests').doc().id;

  const requestRecord = {
    userId: uid,
    status: 'pending',
    createdAt: firestore.Timestamp.now(),
  };

  try {
    await db.collection('export_requests').doc(requestId).set(requestRecord);
    await logAuditEvent(db, { actor: uid, action: 'requestDataExport', target: `export_requests/${requestId}`, status: 'success' });
    return { success: true, requestId };
  } catch (error) {
    await logAuditEvent(db, { actor: uid, action: 'requestDataExport', target: `export_requests`, status: 'failure', reason: error.message });
    throw new functions.https.HttpsError('internal', 'Failed to create data export request.');
  }
});

/**
 * A Firestore trigger that processes a data export request when it's created.
 */
export const processExportRequest = functions.firestore.document('export_requests/{requestId}').onCreate(async (snap, context) => {
  const request = snap.data();
  const requestId = snap.id;
  const userId = request.userId;

  // 1. Mark request as 'processing'
  await snap.ref.update({ status: 'processing' });
  await logAuditEvent(db, { userId, actor: 'system', action: 'processExportRequest', target: `export_requests/${requestId}`, status: 'success', reason: 'Started processing' });

  const exportData = {};

  try {
    // 2. Gather data from all relevant collections
    // In a real app, you would have a list of collections to export.
    // For this example, we will just export the user's consent profile.
    const consentDoc = await db.collection('consent_profiles').doc(userId).get();
    if (consentDoc.exists) {
      exportData['consent_profile'] = consentDoc.data();
    }

    // 3. Write data to a file in Cloud Storage
    const fileName = `exports/${userId}/${requestId}.json`;
    const file = bucket.file(fileName);
    await file.save(JSON.stringify(exportData, null, 2), { contentType: 'application/json' });

    // 4. Generate a signed URL for download
    const signedUrl = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7-day expiry
    });

    // 5. Update the request with the download URL and mark as 'completed'
    await snap.ref.update({
      status: 'complete',
      downloadUrl: signedUrl[0],
    });

    await logAuditEvent(db, { userId, actor: 'system', action: 'processExportRequest', target: `export_requests/${requestId}`, status: 'success', reason: 'Export completed successfully' });

  } catch (error) {
    // If anything fails, mark the request as 'failed' and log the error.
    console.error(`Failed to process export request ${requestId} for user ${userId}:`, error);
    await snap.ref.update({ status: 'failed', error: error.message });
    await logAuditEvent(db, { userId, actor: 'system', action: 'processExportRequest', target: `export_requests/${requestId}`, status: 'failure', reason: error.message });
  }
});
