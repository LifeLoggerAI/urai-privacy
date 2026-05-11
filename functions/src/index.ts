import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
admin.initializeApp();

import { getLineageRecords } from './privacy/lineage';

// Core Privacy Gateway & Consent
export { secureWrite, secureRead } from './privacy/gateway';
export { updateConsentProfile } from './privacy/consent';

// Lineage (Explainability)
export { getInsightExplanation } from './privacy/lineage';

// Data Portability (Export)
export { requestDataExport } from './privacy/export';

// Data Deletion
export { requestDeletion, processDeletionRequest } from './privacy/deletion';

// Monetization
export { generateMonetizationUnit } from './privacy/monetization';

export { logAuditEvent } from './privacy/audit';

export const getLineage = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
  }

  const userId = context.auth.uid;
  
  try {
    const records = await getLineageRecords(admin.firestore(), userId);
    return records;
  } catch (error) {
    console.error(`Error fetching lineage records for user ${userId}`, error);
    throw new functions.https.HttpsError('internal', 'Failed to retrieve lineage records.');
  }
});

// Note: Anomaly detection is handled internally by calling recordPolicyViolation from other functions.
// There is no standalone trigger to export for this module.
