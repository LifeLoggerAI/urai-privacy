"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { auth, db, firebaseApp, firestore, functions, storage } from "../firebase/firebase";

const firebaseContextValue = {
  app: firebaseApp,
  firebaseApp,
  auth,
  db,
  firestore,
  functions,
  storage,
  user: null
};

const FirebaseContext = createContext(firebaseContextValue);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  return <FirebaseContext.Provider value={firebaseContextValue}>{children}</FirebaseContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return <FirebaseProvider>{children}</FirebaseProvider>;
}

export function useFirebase() {
  return useContext(FirebaseContext);
}

export default Providers;
