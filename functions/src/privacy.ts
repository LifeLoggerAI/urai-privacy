
import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import { logAuditEvent } from './index';

const db = admin.firestore();

/**
 * A generic function to update a user's consent status for a specific consent type.
 * This is designed to be called by other specific consent functions.
 * @param uid The user's ID.
 * @param consentType The type of consent (e.g., 'marketing', 'analytics').
 * @param status The new status ('granted' or 'revoked').
 * @param version The version of the policy or terms they are consenting to.
 */
async function updateConsent(uid: string, consentType: string, status: 'granted' | 'revoked', version: string) {
    if (!consentType || !version) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with a consentType and version.');
    }

    const consentRef = db.collection('consents').doc(`${uid}_${consentType}`);
    const consentData = {
        uid,
        consentType,
        status,
        version,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await consentRef.set(consentData, { merge: true });
    await logAuditEvent(uid, `consent_${status}`, { consentType, version });

    return { success: true, message: `Consent for '${consentType}' has been ${status}.` };
}

/**
 * Callable function for a user to grant consent.
 */
export const recordConsent = functions.https.onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to record consent.");
    }
    const { consentType, version } = request.data;
    return await updateConsent(uid, consentType, 'granted', version);
});

/**
 * Callable function for a user to revoke consent.
 */
export const revokeConsent = functions.https.onCall(async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new functions.https.HttpsError("unauthenticated", "You must be logged in to revoke consent.");
    }
    const { consentType } = request.data;
    // When revoking, we can assume the latest version is being revoked against.
    return await updateConsent(uid, consentType, 'revoked', 'latest');
});
