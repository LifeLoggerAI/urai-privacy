
import * as functions from 'firebase-functions';
import { firestore } from 'firebase-admin';
import { DataClass, Sensitivity } from '../../lib/privacySchema';

const db = firestore();

/**
 * A Firestore trigger that listens to the audit_logs collection and creates a policy violation record
 * for certain types of failures.
 */
export const detectPolicyViolations = functions.firestore.document('audit_logs/{logId}').onCreate(async (snap, context) => {
    const logEntry = snap.data();
    const { payload } = logEntry;

    // We are only interested in failed events for creating violation records.
    if (payload.status !== 'failure') {
        return;
    }

    let violationReason: string | null = null;

    // Check for specific failure reasons that constitute a policy violation.
    if (payload.reason && payload.reason.includes('Consent not given')) {
        violationReason = 'ACCESS_DENIED_NO_CONSENT';
    } else if (payload.reason && payload.reason.includes('Ownership mismatch')) {
        violationReason = 'CROSS_USER_ACCESS_ATTEMPT';
    } else if (payload.action === 'secureRead' || payload.action === 'secureWrite') {
        // Catch-all for other significant permission failures in the gateway.
        violationReason = 'GATEWAY_OPERATION_FAILURE';
    }

    if (violationReason) {
        const violationRecord = {
            userId: logEntry.userId,
            dataClass: DataClass.AUDIT_EVENT, // A policy violation is a type of audit event
            sensitivity: Sensitivity.CRITICAL,
            createdAt: firestore.Timestamp.now(),
            updatedAt: firestore.Timestamp.now(),
            source: `audit_logs/${snap.id}`,
            retentionUntil: firestore.Timestamp.fromMillis(Date.now() + 1000 * 60 * 60 * 24 * 365 * 10), // 10-year retention for violations
            consentCategory: 'n/a',
            payload: {
                violation: violationReason,
                originalLog: logEntry,
                status: 'new', // For triage by an admin
            },
        };

        try {
            await db.collection('policy_violations').add(violationRecord);
        } catch (error) {
            console.error(`FATAL: Failed to create policy violation record for audit log ${snap.id}`, error);
            // This is a critical failure and should trigger an alert.
        }
    }
});
