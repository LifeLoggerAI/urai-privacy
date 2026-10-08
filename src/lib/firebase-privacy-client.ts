"use client";

import { httpsCallable } from "firebase/functions";
import type { User } from "firebase/auth";
import { collection, limit, onSnapshot, orderBy, query, where, type DocumentData, type Query } from "firebase/firestore";
import { auth, db, firebaseApp, functions } from "../../firebase/firebase";
import { fetchAuthorizedExport } from "./export-download-client";

export type CallableResult = Record<string, unknown>;

const USER_SCOPED_COLLECTIONS = new Set(["privacyRequests", "exportJobs", "deletionRequests", "consentRecords", "dataAccessEvents"]);
const ADMIN_COLLECTIONS = new Set([
  "privacyRequests",
  "exportJobs",
  "deletionRequests",
  "consentRecords",
  "consentEvents",
  "consentRevocationOutbox",
  "auditLogs",
  "adminActions",
  "dataAccessEvents",
  "retentionPolicies",
  "policyVersions",
  "users",
  "legalHoldRecords"
]);

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

function requireCurrentSession(expected?: User) {
  const current = auth?.currentUser;
  if (!current || (expected && current !== expected)) {
    throw new Error("The authenticated privacy session changed. Sign in and try again.");
  }
  return current;
}

function subscribeCurrentSession(
  q: Query<DocumentData>,
  user: User,
  callback: (rows: Array<DocumentData & { id: string }>) => void
) {
  let active = true;
  const unsubscribe = onSnapshot(q, (snapshot) => {
    if (!active || auth?.currentUser !== user) return;
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  });
  return () => { active = false; unsubscribe(); };
}

export async function callPrivacyFunction<T extends CallableResult = CallableResult>(name: string, payload?: Record<string, unknown>) {
  const user = requireCurrentSession();
  const callable = httpsCallable<Record<string, unknown> | undefined, T>(requireFunctions(), name);
  const result = await callable(payload);
  requireCurrentSession(user);
  return result.data;
}

export function createExportRequest() {
  return callPrivacyFunction("createExportRequest");
}

export function createDeletionRequest(reason: string) {
  return callPrivacyFunction("createDeletionRequest", { reason });
}

export function updateConsentPreference(payload: {
  purpose: string;
  status: "granted" | "denied" | "revoked";
  surface: string;
  jurisdiction: string;
  expiresAt?: string;
}) {
  return callPrivacyFunction("setCanonicalConsent", payload);
}

export function evaluateConsentPreference(payload: { purpose: string; correlationId: string; targetUid?: string }) {
  return callPrivacyFunction("evaluateCanonicalConsent", payload);
}

export function getExportDownloadUrl(payload: { jobId: string; file?: "export" | "manifest" }) {
  return callPrivacyFunction("getExportDownloadUrl", payload);
}

export async function downloadExportPackage(payload: { jobId: string; file?: "export" | "manifest" }) {
  const user = requireCurrentSession();
  const projectId = firebaseApp?.options.projectId;
  if (!projectId) throw new Error("Current authentication is required for export downloads.");
  const result = await getExportDownloadUrl(payload);
  requireCurrentSession(user);
  if (typeof result.url !== "string" || result.requiresAuthorization !== true) {
    throw new Error("An authenticated export download was not returned.");
  }
  const contents = await fetchAuthorizedExport({
    url: result.url, projectId, getIdToken: async () => {
      requireCurrentSession(user);
      const token = await user.getIdToken(true);
      requireCurrentSession(user);
      return token;
    }
  });
  requireCurrentSession(user);
  const localUrl = URL.createObjectURL(contents);
  try {
    const link = document.createElement("a");
    link.href = localUrl;
    link.download = `urai-${payload.file ?? "export"}.json`;
    link.rel = "noopener noreferrer";
    document.body.append(link);
    link.click();
    link.remove();
  } finally { setTimeout(() => URL.revokeObjectURL(localUrl), 1000); }
  return result;
}

export function executeDeletionRequest(payload: { requestId: string; mode?: "dryRun" | "execute"; expectedPlanHash?: string }) {
  return callPrivacyFunction("executeDeletionRequest", payload);
}

export function subscribeUserCollection(collectionName: string, uid: string, callback: (rows: Array<DocumentData & { id: string }>) => void) {
  requireAllowedCollection(collectionName, USER_SCOPED_COLLECTIONS);
  const user = requireCurrentSession();
  if (user.uid !== uid) throw new Error("The privacy subscription owner must match the current authenticated session.");
  const q = query(collection(requireDb(), collectionName), where("uid", "==", uid), limit(50));
  return subscribeCurrentSession(q, user, callback);
}

export function subscribeUserAuditLogs(uid: string, callback: (rows: Array<DocumentData & { id: string }>) => void) {
  const user = requireCurrentSession();
  if (user.uid !== uid) throw new Error("The privacy subscription owner must match the current authenticated session.");
  const q = query(collection(requireDb(), "auditLogs"), where("targetUid", "==", uid), orderBy("timestamp", "desc"), limit(50));
  return subscribeCurrentSession(q, user, callback);
}

export function subscribeAdminCollection(collectionName: string, callback: (rows: Array<DocumentData & { id: string }>) => void) {
  requireAllowedCollection(collectionName, ADMIN_COLLECTIONS);
  const user = requireCurrentSession();
  const q = query(collection(requireDb(), collectionName), limit(100));
  return subscribeCurrentSession(q, user, callback);
}
