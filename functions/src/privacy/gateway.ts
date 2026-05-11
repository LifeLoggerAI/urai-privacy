import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';
import { CollectionMap, DataClass, Sensitivity } from '../../lib/privacySchema';
import { checkConsent } from './consent';
import { logAuditEvent, logAccessEvent } from './audit';
import { createLineageRecord } from './lineage';

const db = firestore();

// The core secure write gateway
export const secureWrite = functions.https.onCall(async (data, context) => {
    const { collection, record } = data;
    const uid = context.auth?.uid;

    // 1. Authentication & Authorization
    if (!uid) {
        await logAuditEvent(db, { actor: 'unauthenticated', action: 'secureWrite', target: collection, status: 'failure', reason: 'Authentication required' });
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to perform this action.');
    }

    if (uid !== record.userId) {
        await logAuditEvent(db, { actor: uid, action: 'secureWrite', target: `${collection}/${record.userId}`, status: 'failure', reason: 'Ownership mismatch' });
        throw new functions.https.HttpsError('permission-denied', 'You can only write to your own records.');
    }

    // 2. Validation & Classification
    const mapping = CollectionMap[collection];
    if (!mapping) {
        await logAuditEvent(db, { actor: uid, action: 'secureWrite', target: collection, status: 'failure', reason: 'Invalid collection' });
        throw new functions.https.HttpsError('invalid-argument', 'Invalid target collection.');
    }

    // 3. Consent Enforcement
    const consentCategory = mapping.consentCategory || collection;
    const hasConsent = await checkConsent(db, uid, consentCategory);
    if (!hasConsent) {
        await logAuditEvent(db, { actor: uid, action: 'secureWrite', target: collection, status: 'failure', reason: `Consent not given for ${consentCategory}` });
        throw new functions.https.HttpsError('permission-denied', `Required consent not granted for category: ${consentCategory}`);
    }

    // 4. Data Enrichment & Metadata Injection
    const now = firestore.Timestamp.now();
    const retentionHours = 24 * 365 * 5; // Default 5 years, should be policy-driven
    const retentionUntil = firestore.Timestamp.fromMillis(now.toMillis() + retentionHours * 60 * 60 * 1000);

    const fullRecord = {
        ...record,
        userId: uid,
        dataClass: mapping.dataClass,
        sensitivity: mapping.sensitivity,
        createdAt: now,
        updatedAt: now,
        source: 'secureWrite',
        retentionUntil,
        consentCategory,
    };

    // 5. Lineage Creation (if applicable)
    if (record.sourceRecordIds && record.sourceRecordIds.length > 0) {
        const lineageId = await createLineageRecord(db, {
            userId: uid,
            sourceRecordIds: record.sourceRecordIds,
            derivedRecordIds: [], // Will be updated after this write
            transformation: 'secureWrite derivation',
            explanation: `Record in ${collection} created from ${record.sourceRecordIds.join(', ')}`,
        });
        fullRecord.lineageId = lineageId;
    }

    // 6. Database Write
    try {
        const writeResult = await db.collection(collection).add(fullRecord);
        const docId = writeResult.id;

        // Update lineage with the new ID
        if (fullRecord.lineageId) {
            await db.collection('data_lineage').doc(fullRecord.lineageId).update({ derivedRecordIds: firestore.FieldValue.arrayUnion(docId) });
        }

        await logAuditEvent(db, { actor: uid, action: 'secureWrite', target: `${collection}/${docId}`, status: 'success' });
        return { success: true, id: docId };

    } catch (error) {
        await logAuditEvent(db, { actor: uid, action: 'secureWrite', target: collection, status: 'failure', reason: error.message });
        throw new functions.https.HttpsError('internal', 'Could not write record.');
    }
});

// Secure Read (example for a single document)
export const secureRead = functions.https.onCall(async (data, context) => {
    const { collection, id } = data;
    const uid = context.auth?.uid;

    if (!uid) {
        await logAccessEvent(db, { actor: 'unauthenticated', action: 'secureRead', target: `${collection}/${id}`, status: 'failure', reason: 'Authentication required' });
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in.');
    }

    const docRef = db.collection(collection).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
        await logAccessEvent(db, { actor: uid, action: 'secureRead', target: `${collection}/${id}`, status: 'failure', reason: 'Not found' });
        throw new functions.https.HttpsError('not-found', 'Document not found.');
    }

    const record = doc.data();
    if (record.userId !== uid) {
        await logAccessEvent(db, { actor: uid, action: 'secureRead', target: `${collection}/${id}`, status: 'failure', reason: 'Permission denied' });
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to read this record.');
    }

    await logAccessEvent(db, { actor: uid, action: 'secureRead', target: `${collection}/${id}`, status: 'success' });
    return record;
});
