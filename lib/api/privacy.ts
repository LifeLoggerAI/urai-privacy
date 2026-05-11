
import { functions } from "@/firebase/firebase";
import { httpsCallable } from "firebase/functions";

// This file defines the public API for other URAI services to interact with the URAI-PRIVACY system.
// All data access and consent checks should be routed through these functions.

/**
 * Checks if a user has granted a specific consent.
 * @param uid The user's ID.
 * @param consentType The type of consent to check (e.g., 'marketing_emails').
 * @returns A promise that resolves to true if the consent is granted, false otherwise.
 */
export const hasConsent = async (uid: string, consentType: string): Promise<boolean> => {
    const checkConsent = httpsCallable(functions, 'checkConsent');
    const result = await checkConsent({ uid, consentType });
    return (result.data as { hasConsent: boolean }).hasConsent;
};

/**
 * Checks if a user has a specific data permission.
 * @param uid The user's ID.
 * @param resource The resource the permission is for (e.g., 'profile').
 * @param permission The permission level (e.g., 'read', 'write').
 * @returns A promise that resolves to true if the permission is granted, false otherwise.
 */
export const hasPermission = async (uid: string, resource: string, permission: string): Promise<boolean> => {
    const checkPermission = httpsCallable(functions, 'checkPermission');
    const result = await checkPermission({ uid, resource, permission });
    return (result.data as { hasPermission: boolean }).hasPermission;
};

/**
 * Logs a privacy-related event for a user.
 * This should be called by other services whenever a user's data is accessed or processed.
 * @param uid The user's ID.
 * @param eventType The type of event (e.g., 'data_accessed', 'profile_updated').
 * @param eventData Additional data about the event.
 */
export const logPrivacyEvent = async (uid: string, eventType: string, eventData: Record<string, any>): Promise<void> => {
    const logEvent = httpsCallable(functions, 'logAuditEvent'); // Leverages the existing audit log
    await logEvent({ uid, eventType, eventData });
};
