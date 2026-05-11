
import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { logAuditEvent } from './audit';

export const requiredConsentCategories = {
  'audio/transcription': { enabled: false, tier: 'basic', version: 1.0 },
  'GPS/location': { enabled: false, tier: 'basic', version: 1.0 },
  'social graph/relationship data': { enabled: false, tier: 'basic', version: 1.0 },
  'mood/emotional data': { enabled: false, tier: 'advanced', version: 1.0 },
  'health/wellness signals': { enabled: false, tier: 'advanced', version: 1.0 },
  'anonymized data licensing': { enabled: false, tier: 'optional', version: 1.0 },
  'product analytics': { enabled: false, tier: 'optional', version: 1.0 },
  'AI insight generation': { enabled: false, tier: 'optional', version: 1.0 },
};

export const getConsentProfile = async (userId) => {
  if (!userId) return null;
  const docRef = doc(db, 'consent_profiles', userId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    // Ensure all required categories are present in the profile
    const data = docSnap.data();
    const categories = { ...requiredConsentCategories, ...data.categories };
    return { ...data, categories };
  } else {
    // If profile doesn't exist, return a default one but don't create it here
    return {
      categories: requiredConsentCategories,
      history: [],
      policyAcknowledgement: null,
    };
  }
};

export const updateConsent = async (userId, category, enabled) => {
  if (!userId) throw new Error('User ID is required');

  const docRef = doc(db, 'consent_profiles', userId);
  const consentProfile = await getConsentProfile(userId);
  const currentCategoryState = consentProfile.categories[category] || requiredConsentCategories[category];

  const updatedCategory = {
    ...currentCategoryState,
    enabled,
    revokedAt: enabled ? null : new Date(),
  };

  const historyEntry = {
    category,
    action: enabled ? 'granted' : 'revoked',
    timestamp: new Date(),
    version: currentCategoryState.version,
  };

  await setDoc(docRef, {
    categories: {
      ...consentProfile.categories,
      [category]: updatedCategory,
    },
    history: arrayUnion(historyEntry),
    lastUpdated: new Date(),
  }, { merge: true });

  await logAuditEvent('consent_change', {
    category,
    enabled,
  });

  // Return the full updated categories object for the UI
  const newProfile = await getConsentProfile(userId);
  return newProfile.categories;
};

export const acknowledgePolicy = async (userId, policyVersion) => {
  if (!userId) throw new Error('User ID is required');
  const docRef = doc(db, 'consent_profiles', userId);
  
  const policyAcknowledgement = {
    version: policyVersion,
    timestamp: new Date(),
  };

  await setDoc(docRef, {
    policyAcknowledgement,
    lastUpdated: new Date()
  }, { merge: true });

  await logAuditEvent('policy_acknowledgement', {
    policyVersion,
  });

  return policyAcknowledgement;
};
