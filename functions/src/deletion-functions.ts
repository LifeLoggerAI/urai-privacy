import { createHash } from "node:crypto";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  deletionExecutionBlockers,
  deletionManifestHash
} from "./deletion-contract";
import { inventoryDeletionSubject } from "./deletion-inventory";

const app = getApps().length ? getApp() : initializeApp();
const db = getFirestore(app);

const processSchema = z.object({
  requestId: z.string().trim().min(1).max(160),
  status: z.enum(["approved", "processing", "rejected", "failed"]).default("processing")
});
const executeSchema = z.object({
  requestId: z.string().trim().min(1).max(160),
  mode: z.enum(["dryRun", "execute"]).default("dryRun"),
  expectedPlanHash: z.string().trim().min(16).optional()
});

type RequestAuth = { uid?: string; token?: Record<string, unknown> };

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function requireAdmin(auth?: RequestAuth) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  if (!(auth.token?.admin === true || auth.token?.role === "admin")) {
    throw new HttpsError("permission-denied", "Administrative access is required.");
  }
  return auth.uid;
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value ?? {});
  if (!result.success) {
    throw new HttpsError(
      "invalid-argument",
      result.error.issues.map((issue) => issue.message).join("; ")
    );
  }
  return result.data;
}

async function loadRequest(requestId: string) {
  const ref = db.collection("deletionRequests").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Deletion request not found.");
  const data = snapshot.data() ?? {};
  const uid = typeof data.uid === "string" ? data.uid : "";
  if (!uid) throw new HttpsError("failed-precondition", "Deletion request has no subject.");
  return { ref, data, uid };
}

async function audit(args: {
  actorUid: string;
  action: string;
  requestId: string;
  targetUid: string;
  metadata: Record<string, unknown>;
}) {
  const ref = db.collection("auditLogs").doc();
  await ref.set({
    actorUid: args.actorUid,
    actorRole: "admin",
    action: args.action,
    requestId: args.requestId,
    targetUid: args.targetUid,
    source: "function",
    metadata: args.metadata,
    timestamp: FieldValue.serverTimestamp(),
    integrityHash: digest({ auditId: ref.id, ...args })
  });
  return ref.id;
}

async function prepare(requestId: string, uid: string) {
  const result = await inventoryDeletionSubject(uid, requestId);
  const planHash = deletionManifestHash(result.manifest);
  const blockers = deletionExecutionBlockers(result.manifest);
  return { ...result, planHash, blockers };
}

export const processDeletionRequest = onCall(async (request) => {
  const adminUid = requireAdmin(request.auth);
  const { requestId, status } = parse(processSchema, request.data);
  const current = await loadRequest(requestId);

  if (status === "rejected" || status === "failed") {
    await current.ref.update({
      status,
      orchestrationState: status,
      updatedAt: FieldValue.serverTimestamp()
    });
    return { requestId, status, orchestrationState: status };
  }

  const prepared = await prepare(requestId, current.uid);
  const orchestrationState = prepared.blockers.length > 0 ? "blocked" : "prepared";
  await current.ref.update({
    status: "processing",
    orchestrationState,
    orchestrationVersion: prepared.manifest.version,
    deletionManifest: prepared.manifest,
    deletionInventory: prepared.inventory,
    planHash: prepared.planHash,
    blockers: prepared.blockers,
    destructiveDeletionReady: prepared.blockers.length === 0,
    destructiveDeletionBlocked: prepared.blockers.length > 0,
    updatedAt: FieldValue.serverTimestamp()
  });
  const auditId = await audit({
    actorUid: adminUid,
    action: "deletion_manifest_prepared",
    requestId,
    targetUid: current.uid,
    metadata: { planHash: prepared.planHash, blockers: prepared.blockers }
  });

  return {
    requestId,
    status: "processing",
    orchestrationState,
    plan: prepared.manifest,
    planHash: prepared.planHash,
    blockers: prepared.blockers,
    destructiveDeletionReady: prepared.blockers.length === 0,
    auditId
  };
});

export const executeDeletionRequest = onCall(async (request) => {
  const adminUid = requireAdmin(request.auth);
  const { requestId, mode, expectedPlanHash } = parse(executeSchema, request.data);
  const current = await loadRequest(requestId);
  const prepared = await prepare(requestId, current.uid);
  const orchestrationState = prepared.blockers.length > 0 ? "blocked" : "prepared";

  await current.ref.update({
    status: "processing",
    orchestrationState,
    orchestrationVersion: prepared.manifest.version,
    deletionManifest: prepared.manifest,
    deletionInventory: prepared.inventory,
    planHash: prepared.planHash,
    blockers: prepared.blockers,
    destructiveDeletionReady: false,
    destructiveDeletionBlocked: true,
    dryRunAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });

  const auditId = await audit({
    actorUid: adminUid,
    action: mode === "dryRun" ? "deletion_dry_run" : "deletion_execution_blocked",
    requestId,
    targetUid: current.uid,
    metadata: { planHash: prepared.planHash, blockers: prepared.blockers, mode }
  });

  if (mode === "dryRun") {
    return {
      requestId,
      status: "processing",
      orchestrationState,
      mode,
      plan: prepared.manifest,
      planHash: prepared.planHash,
      blockers: prepared.blockers,
      destructiveDeletionReady: false,
      auditId
    };
  }

  if (!expectedPlanHash || expectedPlanHash !== prepared.planHash) {
    throw new HttpsError(
      "failed-precondition",
      "A current matching dry-run plan hash is required.",
      { auditId, planHash: prepared.planHash }
    );
  }

  throw new HttpsError(
    "failed-precondition",
    "Deletion execution is blocked until every adapter and verification gate is certified.",
    { auditId, blockers: prepared.blockers, planHash: prepared.planHash }
  );
});
