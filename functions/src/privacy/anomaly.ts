import * as admin from 'firebase-admin';
import { PolicyViolation } from './types';

const db = admin.firestore();

/**
 * Creates a record of a policy violation. This is a lean, internal-only function.
 * It is designed to be called by other server-side logic when a violation is detected.
 */
export async function recordPolicyViolation(
    userId: string | null,
    violationType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    source: string, // e.g., the function name where the violation was detected
    details: any,
    autoActionTaken: string = 'logged'
): Promise<void> {
    const violation: PolicyViolation = {
        userId,
        violationType,
        severity,
        source,
        details,
        autoActionTaken,
        createdAt: admin.firestore.Timestamp.now(),
    };
    try {
        const docRef = await db.collection('policy_violations').add(violation);
        console.error(`Policy violation recorded: ${docRef.id}`);
    } catch (error) {
        console.error('CRITICAL: Failed to record policy violation:', error, violation);
    }
}
