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
  user: null,
  loading: false,
  login: async () => {},
  logout: async () => {}
};

const FirebaseContext = createContext(firebaseContextValue);

export function FirebaseProvider({ children }: { children: ReactNode }) {
  return <FirebaseContext.Provider value={firebaseContextValue}>{children}</FirebaseContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return <FirebaseProvider>{children}</FirebaseProvider>;
}

export function useFirebase() {
  return useContext(FirebaseContext) ?? firebaseContextValue;
}

export function useAuth() {
  return useFirebase();
}

export default Providers;
