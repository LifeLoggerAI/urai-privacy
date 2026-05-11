import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const logAuditEvent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const { action, details } = data;
  const userId = context.auth.uid;

  try {
    await admin.firestore().collection('audit_logs').add({
      userId,
      action,
      details,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      source: 'server',
    });
    return { success: true };
  } catch (error) {
    console.error('Error logging audit event:', error);
    throw new functions.https.HttpsError('internal', 'Failed to log audit event');
  }
});
