"use client";

import { httpsCallable } from "firebase/functions";
import { collection, limit, onSnapshot, orderBy, query, where, type DocumentData } from "firebase/firestore";
import { db, functions } from "../../firebase/firebase";

export type CallableResult = Record<string, unknown>;

const USER_SCOPED_COLLECTIONS = new Set(["privacyRequests", "exportJobs", "deletionRequests", "consentRecords", "dataAccessEvents"]);
const ADMIN_COLLECTIONS = new Set(["privacyRequests", "exportJobs", "deletionRequests", "consentRecords", "consentEvents", "auditLogs", "adminActions", "dataAccessEvents", "retentionPolicies", "policyVersions", "users", "legalHoldRecords"]);

function requireFunctions() {
  if (!functions) throw new Error("FIREBASE_FUNCTIONS_NOT_CONFIGURED");
  return functions;
}

function requireDb() {
  if (!db) throw new Error("FIRESTORE_NOT_CONFIGURED");
  return db;
}

function requireAllowedCollection(collectionName: string, allowed: Set<string>) {
  if (!allowed.has(collectionName)) {
    throw new Error(`UNSUPPORTED_PRIVACY_COLLECTION:${collectionName}`);
  }
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

export function getExportDownloadUrl(payload: { jobId: string; file?: "export" | "manifest" }) {
  return callPrivacyFunction("getExportDownloadUrl", payload);
}

export function executeDeletionRequest(payload: { requestId: string; mode?: "dryRun" | "execute"; expectedPlanHash?: string }) {
  return callPrivacyFunction("executeDeletionRequest", payload);
}

export function subscribeUserCollection(collectionName: string, uid: string, callback: (rows: Array<DocumentData & { id: string }>) => void) {
  requireAllowedCollection(collectionName, USER_SCOPED_COLLECTIONS);
  const q = query(collection(requireDb(), collectionName), where("uid", "==", uid), limit(50));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
}

export function subscribeUserAuditLogs(uid: string, callback: (rows: Array<DocumentData & { id: string }>) => void) {
  const q = query(collection(requireDb(), "auditLogs"), where("targetUid", "==", uid), orderBy("timestamp", "desc"), limit(50));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
}

export function subscribeAdminCollection(collectionName: string, callback: (rows: Array<DocumentData & { id: string }>) => void) {
  requireAllowedCollection(collectionName, ADMIN_COLLECTIONS);
  const q = query(collection(requireDb(), collectionName), limit(100));
  return onSnapshot(q, (snapshot) => callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))));
}