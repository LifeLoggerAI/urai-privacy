
import { firestore } from 'firebase-admin';
import { DataClass, Sensitivity, LineageRecord } from '../../lib/privacySchema';

interface LineagePayload {
  userId: string;
  sourceRecordIds: string[];
  derivedRecordIds: string[];
  transformation: string;
  modelVersion?: string;
  explanation: string;
}

/**
 * Creates a new data lineage record to track the relationship between source and derived data.
 * @param db The Firestore database instance.
 * @param payload The details of the lineage to record.
 * @returns The ID of the newly created lineage record.
 */
export const createLineageRecord = async (db: firestore.Firestore, payload: LineagePayload): Promise<string> => {
  try {
    const now = firestore.Timestamp.now();

    const lineageEntry: Omit<LineageRecord, 'payload'> & { payload: Omit<LineagePayload, 'userId'> } = {
      userId: payload.userId,
      dataClass: DataClass.LINEAGE_RECORD,
      sensitivity: Sensitivity.MEDIUM,
      createdAt: now,
      updatedAt: now,
      source: 'gateway.createLineageRecord',
      retentionUntil: firestore.Timestamp.fromMillis(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10), // 10-year retention for lineage
      consentCategory: 'n/a', // Lineage is an operational record, not directly tied to a user-facing consent category
      payload: {
        sourceRecordIds: payload.sourceRecordIds,
        derivedRecordIds: payload.derivedRecordIds,
        transformation: payload.transformation,
        modelVersion: payload.modelVersion,
        explanation: payload.explanation,
      },
    };

    const docRef = await db.collection('data_lineage').add(lineageEntry);
    return docRef.id;

  } catch (error) {
    console.error(`FATAL: Failed to create lineage record for user ${payload.userId}`, error);
    // This is a critical failure. In a real system, it should trigger an alert
    // and potentially halt the data processing pipeline to prevent untracked data creation.
    throw new Error('Failed to create lineage record.');
  }
};

/**
 * Retrieves all lineage records for a given user.
 * @param db The Firestore database instance.
 * @param userId The ID of the user to retrieve lineage records for.
 * @returns A promise that resolves to an array of lineage records.
 */
export const getLineageRecords = async (db: firestore.Firestore, userId: string): Promise<LineageRecord[]> => {
  const snapshot = await db.collection('data_lineage').where('userId', '==', userId).get();
  return snapshot.docs.map(doc => doc.data() as LineageRecord);
};
