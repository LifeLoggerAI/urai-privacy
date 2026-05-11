
import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { logAuditEvent } from './index';

const db = admin.firestore();

// Define retention periods in days
const RETENTION_POLICY = {
    audit_logs: 365 * 2, // Retain audit logs for 2 years
    data_exports: 7,     // Retain data export records for 7 days
};

/**
 * A scheduled function that runs periodically to enforce data retention policies.
 * It queries specified collections for documents older than their retention period and deletes them.
 */
export const enforceDataRetention = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
    console.log('Starting data retention enforcement job.');
    const now = admin.firestore.Timestamp.now();
    let totalDeleted = 0;

    for (const [collection, days] of Object.entries(RETENTION_POLICY)) {
        const retentionPeriodMs = days * 24 * 60 * 60 * 1000;
        const cutoff = admin.firestore.Timestamp.fromMillis(now.toMillis() - retentionPeriodMs);

        // Assuming documents have a 'createdAt' or 'timestamp' field
        // Note: Firestore requires a composite index for this type of query if the collection is large.
        const oldDocsQuery = db.collection(collection).where('timestamp', '<', cutoff);
        
        try {
            const snapshot = await oldDocsQuery.get();
            if (snapshot.empty) {
                console.log(`No documents to delete in '${collection}'.`);
                continue;
            }

            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
            totalDeleted += snapshot.size;
            console.log(`Successfully deleted ${snapshot.size} documents from '${collection}'.`);

        } catch (error) {
            console.error(`Error enforcing retention policy for '${collection}':`, error);
            // Log this failure to a dedicated admin/ops log if necessary
        }
    }

    if (totalDeleted > 0) {
        // Use a system-level UID or a dedicated service account UID for this audit event
        await logAuditEvent('system', 'data_retention_policy_enforced', { deletedCount: totalDeleted });
    }

    console.log('Data retention enforcement job finished.');
    return null;
});
