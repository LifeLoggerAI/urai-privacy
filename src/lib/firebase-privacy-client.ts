"use client";

import { httpsCallable } from "firebase/functions";
import { collection, limit, onSnapshot, orderBy, query, where, type DocumentData } from "firebase/firestore";
import { db, functions } from "../../firebase/firebase";

export type CallableResult = Record<string, unknown>;

function requireFunctions() {
  if (!functions) throw new Error("FIREBASE_FUNCTIONS_NOT_CONFIGURED");
  return functions;
}

function requireDb() {
  if (!db) throw new Error("FIRESTORE_NOT_CONFIGURED");
  return db;
}

export async function callPrivacyFunction<T extends CallableResult = CallableResult>(name: string, payload?: Record<string, unknown>) {
  const callable = httpsCallable<Record<string, unknown> | undefined, T>(requireFunctions(), name);
  const result = await callable(payload);
  return result.data;
}

export function createExportRequest() {
  return callPrivacyFunction("createExportRequest");
}

export function createDeletionRequest(reason: string) {
  return callPrivacyFunction("createDeletionRequest", { reason });
}

export function updateConsentPreference(payload: { purpose: string; consentTier: string; status: "granted" | "denied" | "revoked" }) {
  return callPrivacyFunction("updateConsent", payload);
}

export function subscribeUserCollection(collectionName: string, uid: string, callback: (rows: Array<DocumentData & { id: string }>) => void) {
  const q = query(collection(requireDb(), collectionName), where("uid", "==", uid), limit(50));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
}

export function subscribeUserAuditLogs(uid: string, callback: (rows: Array<DocumentData & { id: string }>) => void) {
  const q = query(collection(requireDb(), "auditLogs"), where("targetUid", "==", uid), orderBy("timestamp", "desc"), limit(50));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
}

export function subscribeAdminCollection(collectionName: string, callback: (rows: Array<DocumentData & { id: string }>) => void) {
  const q = query(collection(requireDb(), collectionName), limit(100));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
}