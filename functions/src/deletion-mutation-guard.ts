import { randomUUID } from "node:crypto";
import { FieldValue, getFirestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import {
  executeDeletionRequest as unguardedExecuteDeletionRequest,
  processDeletionRequest as unguardedProcessDeletionRequest
} from "./index";
import {
  buildDeletionMutationLeasePatch,
  deletionMutationBlockReason
} from "./deletion-mutation-policy";

const db = getFirestore();
const DELETION_MUTATION_LEASE_MS = 16 * 60 * 1000;

type DeletionMutationOperation = "process" | "dryRun" | "execute";

type DeletionCallableRequest = CallableRequest<Record<string, unknown>>;

function requireAdminUid(request: DeletionCallableRequest): string {
  const uid = request.auth?.uid;
  const token = request.auth?.token;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  if (token?.admin !== true && token?.role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
  return uid;
}

function requestIdFrom(request: DeletionCallableRequest): string {
  const requestId = request.data?.requestId;
  if (typeof requestId !== "string" || !requestId.trim()) {
    throw new HttpsError("invalid-argument", "requestId is required.");
  }
  return requestId;
}

async function releaseDeletionMutationLease(requestId: string, token: string): Promise<void> {
  const ref = db.collection("deletionRequests").doc(requestId);
  await db.runTransaction(async (tx: Transaction) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return;
    if (snapshot.data()?.deletionMutationLeaseToken !== token) return;
    tx.update(ref, {
      deletionMutationLeaseToken: FieldValue.delete(),
      deletionMutationLeaseUntil: FieldValue.delete(),
      deletionMutationLeaseOperation: FieldValue.delete(),
      deletionMutationLeaseBy: FieldValue.delete(),
      deletionMutationLeaseStartedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
}

async function withDeletionMutationLease<T>(args: {
  request: DeletionCallableRequest;
  operation: DeletionMutationOperation;
  run: () => Promise<T>;
}): Promise<T> {
  const adminUid = requireAdminUid(args.request);
  const requestId = requestIdFrom(args.request);
  const ref = db.collection("deletionRequests").doc(requestId);
  const token = randomUUID();
  const nowMillis = Date.now();
  const lease = buildDeletionMutationLeasePatch({
    token,
    actorUid: adminUid,
    operation: args.operation,
    nowMillis,
    leaseDurationMs: DELETION_MUTATION_LEASE_MS
  });

  await db.runTransaction(async (tx: Transaction) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new HttpsError("not-found", "Deletion request not found.");
    const blocked = deletionMutationBlockReason(snapshot.data() ?? {}, nowMillis);
    if (blocked) throw new HttpsError(blocked.code, blocked.message);
    tx.update(ref, {
      ...lease,
      deletionMutationLeaseStartedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  try {
    return await args.run();
  } finally {
    try {
      await releaseDeletionMutationLease(requestId, token);
    } catch (error) {
      console.error("Failed to release deletion mutation lease", {
        requestId,
        operation: args.operation,
        error: error instanceof Error ? error.message : "unknown"
      });
    }
  }
}

export const processDeletionRequest = onCall(async (request) =>
  withDeletionMutationLease({
    request,
    operation: "process",
    run: () => unguardedProcessDeletionRequest.run(request)
  })
);

export const executeDeletionRequest = onCall(async (request) => {
  const operation: DeletionMutationOperation = request.data?.mode === "execute" ? "execute" : "dryRun";
  return withDeletionMutationLease({
    request,
    operation,
    run: () => unguardedExecuteDeletionRequest.run(request)
  });
});
