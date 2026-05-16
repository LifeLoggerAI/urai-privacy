import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFunctions, type Functions } from "firebase/functions";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const requiredConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

export const firebaseConfigStatus = {
  hasApiKey: Boolean(requiredConfig.apiKey),
  hasAuthDomain: Boolean(requiredConfig.authDomain),
  hasProjectId: Boolean(requiredConfig.projectId),
  hasStorageBucket: Boolean(requiredConfig.storageBucket),
  hasMessagingSenderId: Boolean(requiredConfig.messagingSenderId),
  hasAppId: Boolean(requiredConfig.appId)
};

export function isFirebaseConfigured() {
  return Object.values(firebaseConfigStatus).every(Boolean);
}

function requiredValue(value: string | undefined, key: string) {
  if (!value) throw new Error(`Missing Firebase configuration: ${key}`);
  return value;
}

function createFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  return getApps().length ? getApps()[0] : initializeApp({
    apiKey: requiredValue(requiredConfig.apiKey, "NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: requiredValue(requiredConfig.authDomain, "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: requiredValue(requiredConfig.projectId, "NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: requiredValue(requiredConfig.storageBucket, "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: requiredValue(requiredConfig.messagingSenderId, "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: requiredValue(requiredConfig.appId, "NEXT_PUBLIC_FIREBASE_APP_ID")
  });
}

export const firebaseApp: FirebaseApp | null = createFirebaseApp();
export const app = firebaseApp;
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
export const firestore = db;
export const functions: Functions | null = firebaseApp ? getFunctions(firebaseApp) : null;
export const storage: FirebaseStorage | null = firebaseApp ? getStorage(firebaseApp) : null;

export default firebaseApp;