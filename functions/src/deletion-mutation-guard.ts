import { randomUUID } from "node:crypto";
import { FieldValue, getFirestore, type Transaction } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import {
  executeDeletionRequest as unguardedExecuteDeletionRequest,
  processDeletionRequest as unguardedProcessDeletionRequest
} from "./index";
import {
  collectDeletionCompletionResiduals,
  deletionCompletionBlockReason,
  type DeletionCompletionResiduals
} from "./deletion-completion-verifier";
import {
  buildDeletionMutationLeasePatch,
  deletionMutationBlockReason
} from "./deletion-mutation-policy";

const db = getFirestore();
const DELETION_MUTATION_LEASE_MS = 16 * 60 * 1000;
const DELETION_CALLABLE_OPTIONS = {
  timeoutSeconds: 14 * 60,
  memory: "1GiB" as const
};

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

async function writeCompletionVerification(args: {
  requestId: string;
  residuals: DeletionCompletionResiduals;
  verified: boolean;
  reason?: string;
}): Promise<void> {
  const ref = db.collection("deletionRequests").doc(args.requestId);
  const residualSummary = {
    firestoreCounts: Object.fromEntries(
      Object.entries(args.residuals.firestoreTargets).map(([name, ids]) => [name, ids.length])
    ),
    storageObjectCount: args.residuals.storageObjects.length,
    authUserExists: args.residuals.authUserExists,
    legalHold: args.residuals.legalHold,
    totalResidualTargets: args.residuals.totalResidualTargets
  };
  await ref.update({
    ...(args.verified
      ? {
          deletionCompletionVerificationRequired: false,
          deletionCompletionVerified: true,
          deletionCompletionVerifiedAt: FieldValue.serverTimestamp(),
          deletionCompletionVerificationReason: FieldValue.delete()
        }
      : {
          status: "processing",
          destructiveDeletionBlocked: true,
          destructiveDeletionReady: false,
          destructiveDeletionReason: args.reason ?? "Deletion completion verification failed.",
          deletionExecutionState: "verification_required",
          deletionCompletionVerificationRequired: true,
          deletionCompletionVerified: false,
          deletionCompletionVerificationReason: args.reason ?? "Deletion completion verification failed."
        }),
    deletionCompletionResidualSummary: residualSummary,
    updatedAt: FieldValue.serverTimestamp()
  });
}

async function verifyCompletedDeletion(requestId: string): Promise<void> {
  const ref = db.collection("deletionRequests").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Deletion request not found during completion verification.");
  const uid = String(snapshot.data()?.uid ?? "");
  if (!uid) throw new HttpsError("failed-precondition", "Deletion request is missing uid during completion verification.");

  let residuals: DeletionCompletionResiduals;
  try {
    residuals = await collectDeletionCompletionResiduals(uid);
  } catch (error) {
    await ref.update({
      status: "processing",
      destructiveDeletionBlocked: true,
      destructiveDeletionReady: false,
      destructiveDeletionReason: "Deletion completion residual scan failed and must be retried.",
      deletionExecutionState: "verification_required",
      deletionCompletionVerificationRequired: true,
      deletionCompletionVerified: false,
      deletionCompletionVerificationReason: error instanceof Error ? error.message : "unknown",
      updatedAt: FieldValue.serverTimestamp()
    });
    throw new HttpsError("internal", "Deletion completed its mutation phase but residual verification failed.");
  }

  const blocked = deletionCompletionBlockReason(residuals);
  if (blocked) {
    await writeCompletionVerification({
      requestId,
      residuals,
      verified: false,
      reason: blocked.message
    });
    throw new HttpsError(blocked.code, blocked.message);
  }

  await writeCompletionVerification({ requestId, residuals, verified: true });
}

async function withDeletionMutationLease<T>(args: {
  request: DeletionCallableRequest;
  operation: DeletionMutationOperation;
  run: () => Promise<T>;
  verifyAfterRun?: () => Promise<void>;
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
      ...(args.operation === "execute"
        ? {
            deletionCompletionVerificationRequired: true,
            deletionCompletionVerified: false,
            deletionCompletionVerificationReason: FieldValue.delete()
          }
        : {}),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  try {
    const result = await args.run();
    if (args.verifyAfterRun) await args.verifyAfterRun();
    return result;
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

export const processDeletionRequest = onCall(DELETION_CALLABLE_OPTIONS, async (request) =>
  withDeletionMutationLease({
    request,
    operation: "process",
    run: () => unguardedProcessDeletionRequest.run(request)
  })
);

export const executeDeletionRequest = onCall(DELETION_CALLABLE_OPTIONS, async (request) => {
  const operation: DeletionMutationOperation = request.data?.mode === "execute" ? "execute" : "dryRun";
  const requestId = requestIdFrom(request);
  return withDeletionMutationLease({
    request,
    operation,
    run: () => unguardedExecuteDeletionRequest.run(request),
    verifyAfterRun: operation === "execute" ? () => verifyCompletedDeletion(requestId) : undefined
  });
});
