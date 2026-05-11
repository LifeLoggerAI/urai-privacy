"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { auth, db, firebaseApp, firestore, functions, storage } from "./firebase";

type AuthContextValue = {
  user: any;
  loading: boolean;
  app: typeof firebaseApp;
  firebaseApp: typeof firebaseApp;
  auth: typeof auth;
  db: typeof db;
  firestore: typeof firestore;
  functions: typeof functions;
  storage: typeof storage;
  login: (email?: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const fallbackAuthContext: AuthContextValue = {
  user: null,
  loading: false,
  app: firebaseApp,
  firebaseApp,
  auth,
  db,
  firestore,
  functions,
  storage,
  login: async () => {},
  logout: async () => {}
};

const AuthContext = createContext<AuthContextValue>(fallbackAuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthContext.Provider value={fallbackAuthContext}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext) ?? fallbackAuthContext;
}

export default AuthProvider;
