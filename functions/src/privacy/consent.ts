
import { firestore } from 'firebase-admin';
import * as functions from 'firebase-functions';
import { logAuditEvent } from './audit';

const db = firestore();

export const checkConsent = async (db: firestore.Firestore, userId: string, category: string): Promise<boolean> => {
    try {
        const consentRef = db.collection('consent_profiles').doc(userId);
        const consentDoc = await consentRef.get();

        if (!consentDoc.exists) {
            return false;
        }

        const consent = consentDoc.data();
        if (!consent || !consent.categories || !consent.categories[category]) {
            return false;
        }

        const categoryConsent = consent.categories[category];

        if (!categoryConsent.enabled) {
            return false;
        }

        return true;

    } catch (error) {
        console.error(`Error checking consent for user ${userId}, category ${category}:`, error);
        return false;
    }
};

export const updateConsentProfile = functions.https.onCall(async (data, context) => {
    const { category, enabled } = data;
    const uid = context.auth?.uid;

    if (!uid) {
        await logAuditEvent(db, { actor: 'unauthenticated', action: 'updateConsent', target: category, status: 'failure', reason: 'Authentication required' });
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to perform this action.');
    }

    const consentRef = db.collection('consent_profiles').doc(uid);

    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(consentRef);
            if (!doc.exists) {
                // Create the document if it doesn't exist
                const newProfile = {
                    categories: {
                        [category]: {
                            enabled,
                            revokedAt: enabled ? null : new Date(),
                        }
                    },
                    history: [
                        {
                            category,
                            action: enabled ? 'granted' : 'revoked',
                            timestamp: new Date(),
                            version: 1.0, // Assuming initial version 1.0
                        },
                    ],
                    lastUpdated: new Date(),
                };
                transaction.set(consentRef, newProfile);
            } else {
                const profile = doc.data();
                const updatedCategories = {
                    ...profile.categories,
                    [category]: {
                        ...profile.categories[category],
                        enabled,
                        revokedAt: enabled ? null : new Date(),
                    },
                };
                const historyEntry = {
                    category,
                    action: enabled ? 'granted' : 'revoked',
                    timestamp: new Date(),
                    version: profile.categories[category]?.version || 1.0,
                };
                transaction.update(consentRef, {
                    categories: updatedCategories,
                    history: firestore.FieldValue.arrayUnion(historyEntry),
                    lastUpdated: new Date(),
                });
            }
        });

        await logAuditEvent(db, { actor: uid, action: 'updateConsent', target: category, status: 'success', details: { enabled } });
        return { success: true };
    } catch (error) {
        await logAuditEvent(db, { actor: uid, action: 'updateConsent', target: category, status: 'failure', reason: error.message });
        throw new functions.https.HttpsError('internal', 'Could not update consent profile.');
    }
});
