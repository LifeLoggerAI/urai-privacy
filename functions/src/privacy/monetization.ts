
import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';
import { CollectionMap, DataClass, Sensitivity, AnonymizedUnit, MonetizationUnit } from '../../lib/privacySchema';
import { logAuditEvent } from './audit';
import { checkConsent } from './consent';

const db = firestore();

/**
 * A (mock) anonymization function. In a real system, this would be a sophisticated,
 * cryptographically-sound process.
 * @param data The data to be anonymized.
 * @returns Anonymized data.
 */
const anoymize = (data: any) => {
    // IMPORTANT: This is a placeholder. Real anonymization is extremely complex.
    // This should be replaced with a robust technique like k-anonymity, differential privacy, etc.
    const anonData = { ...data };
    delete anonData.userId;
    delete anonData.personalIdentifier;
    anonData.pseudoId = `anon_${Math.random().toString(36).substring(2, 15)}`;
    return anonData;
}

/**
 * Creates an anonymized data unit from a raw signal, if consent for anonymization is present.
 */
export const anonymizeData = functions.firestore.document('raw_signals/{signalId}').onCreate(async (snap, context) => {
    const signal = snap.data();
    const { userId } = signal;

    // 1. Check for anonymization consent
    const hasConsent = await checkConsent(db, userId, 'anonymization');
    if (!hasConsent) {
        await logAuditEvent(db, { userId, actor: 'system', action: 'anonymizeData', target: `raw_signals/${snap.id}`, status: 'failure', reason: 'Consent for anonymization not given' });
        return; // Halt processing
    }

    // 2. Anonymize the data
    const anonymizedPayload = anoymize(signal.payload);

    // 3. Create the anonymized unit record
    const anonymizedUnit: AnonymizedUnit = {
        userId: userId, // Keep the userId for ownership, but the payload is anonymized
        dataClass: DataClass.ANONYMIZED_UNIT,
        sensitivity: Sensitivity.LOW,
        createdAt: firestore.Timestamp.now(),
        updatedAt: firestore.Timestamp.now(),
        source: `raw_signals/${snap.id}`,
        retentionUntil: firestore.Timestamp.fromMillis(Date.now() + 1000 * 60 * 60 * 24 * 365 * 1), // 1 year retention for anonymized data
        consentCategory: 'anonymization',
        payload: anonymizedPayload,
        sourceRecordId: snap.id,
        anonymizationMethod: 'mock_anonymization_v1'
    };

    try {
        await db.collection('anonymized_data_pool').add(anonymizedUnit);
        await logAuditEvent(db, { userId, actor: 'system', action: 'anonymizeData', target: `raw_signals/${snap.id}`, status: 'success', reason: 'Created anonymized unit' });
    } catch (error) {
        await logAuditEvent(db, { userId, actor: 'system', action: 'anonymizeData', target: `raw_signals/${snap.id}`, status: 'failure', reason: error.message });
    }
});

/**
 * Creates a monetization unit from an anonymized record, if monetization consent is present.
 */
export const createMonetizationUnit = functions.https.onCall(async (data, context) => {
    const { anonymizedUnitId } = data;
    const actor = context.auth?.uid; // Should be a trusted system process, but check for auth

    if (!actor) {
        throw new functions.https.HttpsError('unauthenticated', 'This function can only be called by authenticated systems.');
    }

    const anonDocRef = db.collection('anonymized_data_pool').doc(anonymizedUnitId);
    const anonDoc = await anonDocRef.get();

    if (!anonDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Anonymized unit not found.');
    }

    const anonymizedUnit = anonDoc.data() as AnonymizedUnit;
    const { userId } = anonymizedUnit;

    // 1. Check for monetization consent
    const hasConsent = await checkConsent(db, userId, 'monetization');
    if (!hasConsent) {
        await logAuditEvent(db, { userId, actor, action: 'createMonetizationUnit', target: `anonymized_data_pool/${anonymizedUnitId}`, status: 'failure', reason: 'Consent for monetization not given' });
        throw new functions.https.HttpsError('permission-denied', 'Monetization consent not granted by the user.');
    }

    // 2. Create the monetization unit
    const monetizationUnit: MonetizationUnit = {
        userId: userId, // Retain userId for revenue sharing or other user-centric logic
        dataClass: DataClass.MONETIZATION_UNIT,
        sensitivity: Sensitivity.MEDIUM,
        createdAt: firestore.Timestamp.now(),
        updatedAt: firestore.Timestamp.now(),
        source: `anonymized_data_pool/${anonymizedUnitId}`,
        retentionUntil: firestore.Timestamp.fromMillis(Date.now() + 1000 * 60 * 60 * 24 * 365 * 5), // 5-year retention for monetization units
        consentCategory: 'monetization',
        payload: anonymizedUnit.payload, // The payload is already anonymized
        sourceAnonymizedUnitId: anonymizedUnitId
    };

    try {
        const docRef = await db.collection('monetization_units').add(monetizationUnit);
        await logAuditEvent(db, { userId, actor, action: 'createMonetizationUnit', target: `monetization_units/${docRef.id}`, status: 'success' });
        return { success: true, monetizationUnitId: docRef.id };
    } catch (error) {
        await logAuditEvent(db, { userId, actor, action: 'createMonetizationUnit', target: 'monetization_units', status: 'failure', reason: error.message });
        throw new functions.https.HttpsError('internal', 'Could not create monetization unit.');
    }
});
