/*
URAI - Scheduled Intelligence: Weekly Reflection
Automation Integrator

This Cloud Function runs on a schedule (e.g., every Sunday evening) to build
a user'''s weekly reflection. It scans recent derived signals and synthesizes
them into a high-level summary, which is then persisted as a narrator_output.

NON-NEGOTIABLE RULES:
- The function must be idempotent and handle its own scheduling triggers.
- It reads from derived_signals, NOT raw user event collections.
- The output must be a safe, structured narrator_output document.
*/

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Assumes Firebase Admin SDK is initialized elsewhere
// admin.initializeApp();

// Mock for scanning signals and writing output
const firestoreDb = {
    collection: (name) => ({
        where: (field, op, value) => ({
            get: () => Promise.resolve({ docs: [{ id: 'mockSignalDoc', data: () => ({ avg_stress: 0.4, avg_clarity: 0.8 }) }] })
        }),
        add: (data) => Promise.resolve({ id: `no_${new Date().getTime()}` })
    })
}

/**
 * Scheduled function that builds a weekly reflection for all active users.
 */
export const weeklyReflectionBuild = functions.pubsub.schedule('every sunday 20:00').onRun(async (context) => {
    console.log('Weekly Reflection Build: Starting job.');

    // In a real implementation, you would get a list of all active user IDs.
    const userIds = ['user_123', 'user_456']; // Placeholder

    for (const userId of userIds) {
        try {
            console.log(`Processing weekly reflection for user: ${userId}`);

            // 1. Scan recent derived signals for the past 7 days.
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            // This is a simplified query. A real one would be more robust.
            const signalsSnapshot = await firestoreDb
                .collection(`users/${userId}/derived_signals`)
                .where('timestamp', '>=', sevenDaysAgo)
                .get();

            if (signalsSnapshot.docs.length === 0) {
                console.log(`No recent signals found for user ${userId}. Skipping.`);
                continue;
            }

            // 2. Synthesize the signals into a narrative summary.
            // This logic would be much more sophisticated in a real scenario, likely involving an LLM.
            const signalsData = signalsSnapshot.docs.map(doc => doc.data());
            const avgStress = signalsData.reduce((acc, s) => acc + (s.avg_stress || 0), 0) / signalsData.length;
            const avgClarity = signalsData.reduce((acc, s) => acc + (s.avg_clarity || 0), 0) / signalsData.length;

            const summary = `This week, your average stress was ${avgStress.toFixed(2)} and your clarity was ${avgClarity.toFixed(2)}. You'''re making steady progress.`;

            // 3. Write the summary to the user'''s safe narrator_output collection.
            const narratorOutput = {
                type: 'WEEKLY_REFLECTION',
                userId,
                title: 'Your Weekly Reflection',
                summary,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                is_read: false,
            };

            const docRef = await firestoreDb
                .collection(`users/${userId}/narrator_outputs`)
                .add(narratorOutput);

            console.log(`Successfully created reflection ${docRef.id} for user ${userId}`);

        } catch (error) {
            console.error(`Failed to process weekly reflection for user ${userId}:`, error);
            // Continue to the next user even if one fails.
        }
    }

    console.log('Weekly Reflection Build: Job finished.');
    return null;
});
