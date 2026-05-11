/*
URAI - Scheduled Intelligence: Anomaly Alert
Automation Integrator

This Cloud Function runs on a frequent schedule (e.g., every 15 minutes) to
scan for anomalies in user data, such as high stress signals, policy violations,
or significant negative sentiment (shadow signals).

NON-NEGOTIABLE RULES:
- The function must be idempotent.
- It scans specific, targeted collections (`policy_violations`, `derived_signals`).
- Its output must be a safe `narrator_output` or a structured `alert` record.
*/

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Assumes Firebase Admin SDK is initialized elsewhere
// admin.initializeApp();

// Mock for scanning signals and writing output
const firestoreDb = {
    collectionGroup: (name) => ({
        where: (field, op, value) => ({
            get: () => Promise.resolve({ docs: [
                { id: 'mockViolation', ref: { parent: { parent: { id: 'user_abc' } } } },
                { id: 'mockStressSignal', ref: { parent: { parent: { id: 'user_def' } } } }
            ] })
        })
    }),
    collection: (name) => ({
        add: (data) => Promise.resolve({ id: `alert_${new Date().getTime()}` })
    })
};

/**
 * Scheduled function that scans for and flags data anomalies.
 */
export const anomalyAlertBuild = functions.pubsub.schedule('every 15 minutes').onRun(async (context) => {
    console.log('Anomaly Alert Build: Starting job.');

    const now = new Date();
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    try {
        // 1. Scan for recent policy violations across all users.
        const violationsSnapshot = await firestoreDb
            .collectionGroup('policy_violations')
            .where('timestamp', '>=', fifteenMinutesAgo)
            .get();

        const userIdsToAlert = new Set<string>();

        violationsSnapshot.docs.forEach(doc => {
            // Extract the userId from the document path: users/{userId}/policy_violations/{docId}
            const userId = doc.ref.parent.parent.id;
            userIdsToAlert.add(userId);
            console.log(`Anomaly: Policy violation found for user ${userId}`);
        });

        // 2. Scan for high stress/shadow derived signals.
        const highStressSnapshot = await firestoreDb
            .collectionGroup('derived_signals')
            .where('stress_level', '>', 0.9) // Example threshold
            .where('timestamp', '>=', fifteenMinutesAgo)
            .get();

        highStressSnapshot.docs.forEach(doc => {
            const userId = doc.ref.parent.parent.id;
            if (!userIdsToAlert.has(userId)) {
                userIdsToAlert.add(userId);
                console.log(`Anomaly: High stress signal detected for user ${userId}`);
            }
        });

        // 3. For each affected user, create a safe alert record.
        for (const userId of userIdsToAlert) {
            const alertRecord = {
                type: 'ANOMALY_DETECTED',
                userId,
                severity: 'high', // Could be determined by more complex logic
                summary: 'Our system detected a potential issue that may require attention.',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                is_acknowledged: false,
            };

            // Write to a top-level `alerts` collection for admin/system review.
            const docRef = await firestoreDb.collection('alerts').add(alertRecord);
            console.log(`Created alert ${docRef.id} for user ${userId}`);

            // Optionally, create a gentle, safe narrator_output for the user.
            // This would be less alarming than a direct "alert".
            const narratorOutput = {
                type: 'NUDGE_CHECK_IN',
                userId,
                title: 'A Moment to Check In',
                summary: 'Just a gentle reminder to take a moment for yourself. How are you feeling?',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
            };
            await firestoreDb.collection(`users/${userId}/narrator_outputs`).add(narratorOutput);
        }

    } catch (error) {
        console.error('Error during anomaly alert build:', error);
    }

    console.log('Anomaly Alert Build: Job finished.');
    return null;
});
