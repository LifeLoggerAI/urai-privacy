import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  deletionCompletionStatus,
  deletionPlanHash,
  normalizeRequiredDownstreamSystems,
  PRIMARY_DELETION_ADAPTERS,
  type DeletionPlanInput
} from "./deletion-contract";

if (getApps().length === 0) initializeApp();

const db = getFirestore();
const bucket = getStorage().bucket();
const auth = getAuth();

const runtimeEnv = String(process.env.URAI_ENV || process.env.NODE_ENV || "local").toLowerCase();
const productionRuntime = ["prod", "production", "staging"].includes(runtimeEnv);
const requiredDownstreamSystems = normalizeRequiredDownstreamSystems(
  process.env.URAI_PRIVACY_REQUIRED_DOWNSTREAM_DELETION_ACKS,
  productionRuntime
);

const executeSchema = z.object({
  requestId: z.string().min(1),
  mode: z.enum(["dryRun", "execute"]).default("dryRun"),
  expectedPlanHash: z.string().length(64).optional()
});

const FIRESTORE_DELETE_COLLECTIONS = [
  "privacyRequests",
  "exportJobs",
  "consentRecords",
  "consentEvents",
  "dataAccessEvents"
] as const;
const RETAINED_COLLECTIONS = [
  "auditLogs",
  "adminActions",
  "deletionRequests",
  "deletionExecutions",
  "deletionReceipts",
  "policyVersions",
  "retentionPolicies",
  "legalHoldRecords"
] as const;
const STORAGE_PREFIX_TEMPLATES = [
  "exports/{uid}/",
  "users/{uid}/",
  "uploads/{uid}/",
  "artifacts/{uid}/"
] as const;
const DELETE_BATCH_LIMIT = 450;

type CallableRequest = { auth?: { uid?: string; token?: Record<string, unknown> }; data?: unknown };

type AdapterReceipt = {
  adapterId: string;
  status: "verified" | "failed";
  deletedCount: number;
  verifiedAt?: string;
  error?: string;
};

function requireAdmin(request: CallableRequest): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  const token = request.auth?.token;
  if (token?.admin !== true && token?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
  return uid;
}

async function writeAudit(args: {
  actorUid: string;
  action: string;
  targetUid: string;
  requestId: string;
  metadata?: Record<string, unknown>;
}) {
  const ref = db.collection("auditLogs").doc();
  await ref.set({
    actorUid: args.actorUid,
    actorRole: "admin",
    action: args.action,
    targetUid: args.targetUid,
    requestId: args.requestId,
    source: "function",
    metadata: args.metadata ?? {},
    timestamp: FieldValue.serverTimestamp()
  });
  return ref.id;
}

async function countUidCollection(collectionName: string, uid: string): Promise<number> {
  return (await db.collection(collectionName).where("uid", "==", uid).get()).size;
}

async function hasLegalHold(uid: string): Promise<boolean> {
  const [userDoc, holdSnap] = await Promise.all([
    db.collection("users").doc(uid).get(),
    db.collection("legalHoldRecords").where("uid", "==", uid).where("status", "==", "active").limit(1).get()
  ]);
  return (userDoc.exists && userDoc.data()?.legalHold === true) || !holdSnap.empty;
}

async function authAccountExists(uid: string): Promise<boolean> {
  try {
    await auth.getUser(uid);
    return true;
  } catch (error) {
    if ((error as { code?: string })?.code === "auth/user-not-found") return false;
    throw error;
  }
}

function storagePrefixes(uid: string): string[] {
  return STORAGE_PREFIX_TEMPLATES.map((template) => template.replace("{uid}", uid));
}

async function countStoragePrefix(prefix: string): Promise<number> {
  const [files] = await bucket.getFiles({ prefix, autoPaginate: false, maxResults: 1000 });
  return files.length;
}

async function buildPlan(uid: string, requestId: string): Promise<DeletionPlanInput & {
  retainedCollections: readonly string[];
  primaryAdapters: readonly string[];
  generatedAt: string;
}> {
  const firestoreCounts: Record<string, number> = {
    users: (await db.collection("users").doc(uid).get()).exists ? 1 : 0
  };
  for (const collectionName of FIRESTORE_DELETE_COLLECTIONS) {
    firestoreCounts[collectionName] = await countUidCollection(collectionName, uid);
  }

  const storageCounts: Record<string, number> = {};
  for (const prefix of storagePrefixes(uid)) {
    storageCounts[prefix] = await countStoragePrefix(prefix);
  }

  return {
    uid,
    requestId,
    legalHold: await hasLegalHold(uid),
    firestoreCounts,
    storageCounts,
    authAccountExists: await authAccountExists(uid),
    requiredDownstreamSystems,
    retainedCollections: RETAINED_COLLECTIONS,
    primaryAdapters: PRIMARY_DELETION_ADAPTERS,
    generatedAt: new Date().toISOString()
  };
}

async function deleteUidCollection(collectionName: string, uid: string): Promise<number> {
  let deleted = 0;
  while (true) {
    const snap = await db.collection(collectionName).where("uid", "==", uid).limit(DELETE_BATCH_LIMIT).get();
    if (snap.empty) return deleted;
    const batch = db.batch();
    for (const doc of snap.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snap.size;
    if (snap.size < DELETE_BATCH_LIMIT) return deleted;
  }
}

async function executeFirestoreAdapter(uid: string): Promise<AdapterReceipt> {
  let deletedCount = 0;
  for (const collectionName of FIRESTORE_DELETE_COLLECTIONS) {
    deletedCount += await deleteUidCollection(collectionName, uid);
  }
  const userRef = db.collection("users").doc(uid);
  if ((await userRef.get()).exists) {
    await userRef.delete();
    deletedCount += 1;
  }

  const remaining: Record<string, number> = {
    users: (await userRef.get()).exists ? 1 : 0
  };
  for (const collectionName of FIRESTORE_DELETE_COLLECTIONS) {
    remaining[collectionName] = await countUidCollection(collectionName, uid);
  }
  if (Object.values(remaining).some((count) => count !== 0)) {
    throw new Error(`Firestore verification failed: ${JSON.stringify(remaining)}`);
  }

  return {
    adapterId: "firestore-primary",
    status: "verified",
    deletedCount,
    verifiedAt: new Date().toISOString()
  };
}

async function executeStorageAdapter(uid: string): Promise<AdapterReceipt> {
  let deletedCount = 0;
  for (const prefix of storagePrefixes(uid)) {
    deletedCount += await countStoragePrefix(prefix);
    await bucket.deleteFiles({ prefix, force: true });
  }

  const remaining: Record<string, number> = {};
  for (const prefix of storagePrefixes(uid)) {
    remaining[prefix] = await countStoragePrefix(prefix);
  }
  if (Object.values(remaining).some((count) => count !== 0)) {
    throw new Error(`Storage verification failed: ${JSON.stringify(remaining)}`);
  }

  return {
    adapterId: "storage-user-prefixes",
    status: "verified",
    deletedCount,
    verifiedAt: new Date().toISOString()
  };
}

async function executeAuthAdapter(uid: string): Promise<AdapterReceipt> {
  let deletedCount = 0;
  if (await authAccountExists(uid)) {
    await auth.revokeRefreshTokens(uid);
    await auth.deleteUser(uid);
    deletedCount = 1;
  }
  if (await authAccountExists(uid)) {
    throw new Error("Firebase Auth verification failed: user still exists.");
  }
  return {
    adapterId: "firebase-auth",
    status: "verified",
    deletedCount,
    verifiedAt: new Date().toISOString()
  };
}

async function updateAdapterReceipt(executionRef: FirebaseFirestore.DocumentReference, receipt: AdapterReceipt) {
  await executionRef.set({
    adapters: {
      [receipt.adapterId]: receipt
    },
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

export const executeDeletionRequestV2 = onCall(async (request) => {
  const adminUid = requireAdmin(request as CallableRequest);
  const parsed = executeSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  const { requestId, mode, expectedPlanHash } = parsed.data;
  const requestRef = db.collection("deletionRequests").doc(requestId);
  const executionRef = db.collection("deletionExecutions").doc(requestId);
  const deletionSnap = await requestRef.get();
  if (!deletionSnap.exists) throw new HttpsError("not-found", "Deletion request not found.");
  const deletion = deletionSnap.data() ?? {};
  const uid = String(deletion.uid ?? "");
  if (!uid) throw new HttpsError("failed-precondition", "Deletion request is missing uid.");

  const existingExecution = await executionRef.get();
  if (deletion.status === "completed" && existingExecution.data()?.status === "completed") {
    return {
      requestId,
      status: "completed",
      alreadyCompleted: true,
      receiptId: existingExecution.data()?.receiptId ?? null
    };
  }
  if (existingExecution.data()?.status === "processing") {
    throw new HttpsError("aborted", "Deletion execution is already in progress.");
  }

  const plan = await buildPlan(uid, requestId);
  const planHash = deletionPlanHash(plan);
  if (plan.legalHold) {
    await requestRef.set({
      status: "failed",
      destructiveDeletionBlocked: true,
      destructiveDeletionReason: "Active legal hold blocks destructive deletion.",
      deletionPlan: plan,
      planHash,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    const auditId = await writeAudit({
      actorUid: adminUid,
      action: "deletion_orchestration_blocked_legal_hold",
      targetUid: uid,
      requestId,
      metadata: { planHash }
    });
    return { requestId, status: "failed", mode, plan, planHash, auditId };
  }

  if (mode === "dryRun") {
    await executionRef.set({
      requestId,
      uid,
      status: "planned",
      mode,
      plan,
      planHash,
      requiredDownstreamSystems,
      primaryAdapters: PRIMARY_DELETION_ADAPTERS,
      createdAt: existingExecution.exists ? existingExecution.data()?.createdAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await requestRef.set({
      status: "processing",
      deletionPlan: plan,
      planHash,
      destructiveDeletionReady: true,
      destructiveDeletionBlocked: false,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    const auditId = await writeAudit({
      actorUid: adminUid,
      action: "deletion_orchestration_dry_run",
      targetUid: uid,
      requestId,
      metadata: { planHash, requiredDownstreamSystems }
    });
    return { requestId, status: "processing", mode, plan, planHash, auditId };
  }

  if (!expectedPlanHash || expectedPlanHash !== planHash) {
    const auditId = await writeAudit({
      actorUid: adminUid,
      action: "deletion_orchestration_blocked_plan_mismatch",
      targetUid: uid,
      requestId,
      metadata: { expectedPlanHash: expectedPlanHash ?? null, currentPlanHash: planHash }
    });
    throw new HttpsError("failed-precondition", "A current dry-run plan hash is required before deletion.", { auditId, currentPlanHash: planHash });
  }

  const executionToken = randomUUID();
  await db.runTransaction(async (tx) => {
    const current = await tx.get(executionRef);
    if (current.data()?.status === "processing") {
      throw new HttpsError("aborted", "Deletion execution is already in progress.");
    }
    tx.set(executionRef, {
      requestId,
      uid,
      status: "processing",
      executionToken,
      plan,
      planHash,
      requiredDownstreamSystems,
      primaryAdapters: PRIMARY_DELETION_ADAPTERS,
      attemptCount: FieldValue.increment(1),
      startedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(requestRef, {
      status: "processing",
      destructiveDeletionBlocked: false,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  const receipts: AdapterReceipt[] = [];
  try {
    for (const adapter of [executeStorageAdapter, executeFirestoreAdapter, executeAuthAdapter]) {
      const receipt = await adapter(uid);
      receipts.push(receipt);
      await updateAdapterReceipt(executionRef, receipt);
    }

    const primaryStoresVerified = receipts.length === PRIMARY_DELETION_ADAPTERS.length && receipts.every((receipt) => receipt.status === "verified");
    const downstreamPending = [...requiredDownstreamSystems];
    const status = deletionCompletionStatus({ primaryStoresVerified, downstreamPending });

    if (status !== "completed") {
      await executionRef.set({
        status,
        primaryStoresVerified,
        downstreamPending,
        completedPrimaryStoresAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      await requestRef.set({
        status: "processing",
        primaryStoresVerified,
        downstreamPending,
        destructiveDeletionBlocked: true,
        destructiveDeletionReason: "Primary stores are verified, but required downstream deletion acknowledgements are still pending.",
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
      const auditId = await writeAudit({
        actorUid: adminUid,
        action: "deletion_primary_stores_verified_downstream_pending",
        targetUid: uid,
        requestId,
        metadata: { planHash, downstreamPending, receipts }
      });
      return {
        requestId,
        status,
        primaryStoresVerified,
        downstreamPending,
        receipts,
        auditId,
        userVisibleReceiptIssued: false
      };
    }

    const receiptRef = db.collection("deletionReceipts").doc();
    await receiptRef.set({
      requestId,
      uid,
      status: "completed",
      planHash,
      adapters: receipts,
      requiredDownstreamSystems,
      downstreamAcknowledgements: [],
      issuedAt: FieldValue.serverTimestamp()
    });
    await executionRef.set({
      status: "completed",
      primaryStoresVerified: true,
      downstreamPending: [],
      receiptId: receiptRef.id,
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await requestRef.set({
      status: "completed",
      primaryStoresVerified: true,
      downstreamPending: [],
      receiptId: receiptRef.id,
      destructiveDeletionBlocked: false,
      destructiveDeletionCompletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    const auditId = await writeAudit({
      actorUid: adminUid,
      action: "deletion_orchestration_completed",
      targetUid: uid,
      requestId,
      metadata: { planHash, receiptId: receiptRef.id, receipts }
    });
    return {
      requestId,
      status: "completed",
      receiptId: receiptRef.id,
      receipts,
      auditId,
      userVisibleReceiptIssued: true
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await executionRef.set({
      status: "failed",
      error: message,
      failedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await requestRef.set({
      status: "failed",
      destructiveDeletionBlocked: true,
      destructiveDeletionReason: message,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    const auditId = await writeAudit({
      actorUid: adminUid,
      action: "deletion_orchestration_failed",
      targetUid: uid,
      requestId,
      metadata: { planHash, error: message, receipts }
    });
    throw new HttpsError("internal", "Deletion orchestration failed.", { auditId });
  }
});
