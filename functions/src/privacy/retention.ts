
import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';
import { CollectionMap, DataClass, Sensitivity } from '../../lib/privacySchema';

const db = firestore();

/**
 * A scheduled function that runs periodically to delete records that have passed their retention date.
 */
export const cleanupExpiredRecords = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    const now = firestore.Timestamp.now();
    const jobRef = db.collection('retention_jobs').doc();

    // 1. Log the start of the retention job
    await jobRef.set({
        dataClass: DataClass.RETENTION_JOB,
        sensitivity: Sensitivity.MEDIUM,
        createdAt: now,
        updatedAt: now,
        source: 'cleanupExpiredRecords',
        retentionUntil: firestore.Timestamp.fromMillis(now.toMillis() + 1000 * 60 * 60 * 24 * 365), // Keep job logs for 1 year
        payload: {
            status: 'running',
            startTime: now,
            deletedRecordCount: 0,
            errors: [],
        },
    });

    let totalDeletedCount = 0;
    const errors: string[] = [];

    // 2. Iterate through all governed collections
    for (const collectionName in CollectionMap) {
        if (CollectionMap.hasOwnProperty(collectionName)) {
            try {
                const query = db.collection(collectionName).where('retentionUntil', '<', now);
                const snapshot = await query.get();
                
                if (!snapshot.empty) {
                    const batch = db.batch();
                    snapshot.docs.forEach(doc => {
                        batch.delete(doc.ref);
                    });
                    await batch.commit();
                    totalDeletedCount += snapshot.size;
                }

            } catch (error) {
                console.error(`Error cleaning up collection ${collectionName}:`, error);
                errors.push(`Collection ${collectionName}: ${error.message}`);
            }
        }
    }

    // 3. Log the completion of the job
    const finalStatus = errors.length > 0 ? 'completed_with_errors' : 'completed';
    await jobRef.update({
        'payload.status': finalStatus,
        'payload.endTime': firestore.Timestamp.now(),
        'payload.deletedRecordCount': totalDeletedCount,
        'payload.errors': errors,
        updatedAt: firestore.Timestamp.now(),
    });

    console.log(`Retention job completed. Deleted ${totalDeletedCount} records.`);
});
