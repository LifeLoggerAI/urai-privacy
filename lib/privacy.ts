
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase'; // Assumes you have a firebase initialization file

const dataExport = httpsCallable(functions, 'dataExport');
const secureDelete = httpsCallable(functions, 'secureDelete');
const recordConsent = httpsCallable(functions, 'recordConsent');

/**
 * A client-side helper to request a data export.
 */
export const requestDataExport = async () => {
  try {
    const result = await dataExport();
    console.log('Data export requested', result.data);
    return result.data;
  } catch (error) {
    console.error('Error requesting data export:', error);
    throw error;
  }
};

/**
 * A client-side helper to request data deletion.
 */
export const requestDataDeletion = async () => {
  try {
    const result = await secureDelete();
    console.log('Data deletion requested', result.data);
    return result.data;
  } catch (error) {
    console.error('Error requesting data deletion:', error);
    throw error;
  }
};

/**
 * A client-side helper to record user consent.
 * @param consentType The type of consent to record (e.g., 'privacy_policy', 'analytics').
 * @param version The version of the consent being acted upon (e.g., 'v1').
 * @param granted The status of the consent.
 */
export const updateUserConsent = async (consentType: string, version: string, granted: boolean) => {
  try {
    const result = await recordConsent({ consentType, version, granted });
    console.log('Consent updated', result.data);
    return result.data;
  } catch (error) {
    console.error('Error updating consent:', error);
    throw error;
  }
};
