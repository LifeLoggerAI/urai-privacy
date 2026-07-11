import { createHash, randomUUID } from "node:crypto";
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

function isUnverifiedCompletedState(state: Record<string, unknown>): boolean {
  return state.status === "completed" &&
    state.deletionCompletionVerificationRequired === true &&
    state.deletionCompletionVerified !== true;
}

function sha256(value: unknown): string {
  return createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
}

function completionResidualSummary(residuals: DeletionCompletionResiduals) {
  return {
    firestoreCounts: Object.fromEntries(
      Object.entries(residuals.firestoreTargets).map(([name, ids]) => [name, ids.length])
    ),
    storageObjectCount: residuals.storageObjects.length,
    authUserExists: residuals.authUserExists,
    legalHold: residuals.legalHold,
    totalResidualTargets: residuals.totalResidualTargets
  };
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
  actorUid: string;
  targetUid: string;
  residuals: DeletionCompletionResiduals;
  verified: boolean;
  reason?: string;
}): Promise<string> {
  const ref = db.collection("deletionRequests").doc(args.requestId);
  const auditRef = db.collection("auditLogs").doc();
  const residualSummary = completionResidualSummary(args.residuals);
  const action = args.verified
    ? "deletion_completion_verified"
    : "deletion_completion_reopened";
  const auditEvent = {
    actorUid: args.actorUid,
    actorRole: "admin",
    action,
    targetUid: args.targetUid,
    requestId: args.requestId,
    source: "system",
    metadata: {
      verified: args.verified,
      reason: args.reason ?? null,
      residualSummary
    }
  };

  await db.runTransaction(async (tx: Transaction) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Deletion request disappeared during completion verification.");
    }
    tx.update(ref, {
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
      deletionCompletionVerificationAuditId: auditRef.id,
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(auditRef, {
      ...auditEvent,
      timestamp: FieldValue.serverTimestamp(),
      integrityHash: sha256({ ...auditEvent, id: auditRef.id })
    });
  });

  return auditRef.id;
}

async function writeCompletionVerificationFailure(args: {
  requestId: string;
  actorUid: string;
  targetUid: string;
  errorMessage: string;
}): Promise<string> {
  const ref = db.collection("deletionRequests").doc(args.requestId);
  const auditRef = db.collection("auditLogs").doc();
  const auditEvent = {
    actorUid: args.actorUid,
    actorRole: "admin",
    action: "deletion_completion_verification_failed",
    targetUid: args.targetUid,
    requestId: args.requestId,
    source: "system",
    metadata: { error: args.errorMessage }
  };

  await db.runTransaction(async (tx: Transaction) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Deletion request disappeared during completion verification failure handling.");
    }
    tx.update(ref, {
      status: "processing",
      destructiveDeletionBlocked: true,
      destructiveDeletionReady: false,
      destructiveDeletionReason: "Deletion completion residual scan failed and must be retried.",
      deletionExecutionState: "verification_required",
      deletionCompletionVerificationRequired: true,
      deletionCompletionVerified: false,
      deletionCompletionVerificationReason: args.errorMessage,
      deletionCompletionVerificationAuditId: auditRef.id,
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.set(auditRef, {
      ...auditEvent,
      timestamp: FieldValue.serverTimestamp(),
      integrityHash: sha256({ ...auditEvent, id: auditRef.id })
    });
  });

  return auditRef.id;
}

async function verifyCompletedDeletion(
  requestId: string,
  actorUid: string
): Promise<void> {
  const ref = db.collection("deletionRequests").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Deletion request not found during completion verification.");
  const uid = String(snapshot.data()?.uid ?? "");
  if (!uid) throw new HttpsError("failed-precondition", "Deletion request is missing uid during completion verification.");

  let residuals: DeletionCompletionResiduals;
  try {
    residuals = await collectDeletionCompletionResiduals(uid);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown";
    const auditId = await writeCompletionVerificationFailure({
      requestId,
      actorUid,
      targetUid: uid,
      errorMessage
    });
    throw new HttpsError(
      "internal",
      "Deletion completed its mutation phase but residual verification failed.",
      { auditId }
    );
  }

  const blocked = deletionCompletionBlockReason(residuals);
  if (blocked) {
    const auditId = await writeCompletionVerification({
      requestId,
      actorUid,
      targetUid: uid,
      residuals,
      verified: false,
      reason: blocked.message
    });
    throw new HttpsError(blocked.code, blocked.message, { auditId });
  }

  await writeCompletionVerification({
    requestId,
    actorUid,
    targetUid: uid,
    residuals,
    verified: true
  });
}

async function withDeletionMutationLease<T>(args: {
  request: DeletionCallableRequest;
  operation: DeletionMutationOperation;
  run: () => Promise<T>;
  verifyAfterRun?: (context: { adminUid: string; requestId: string }) => Promise<void>;
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
    const state = snapshot.data() ?? {};
    const blocked = deletionMutationBlockReason(state, nowMillis);
    if (blocked) throw new HttpsError(blocked.code, blocked.message);

    const unverifiedCompletion = isUnverifiedCompletedState(state);
    if (unverifiedCompletion && args.operation === "execute") {
      throw new HttpsError(
        "failed-precondition",
        "The prior deletion completion was not verified. Run a new dry run before another destructive execution."
      );
    }

    tx.update(ref, {
      ...lease,
      ...(unverifiedCompletion
        ? {
            status: "processing",
            destructiveDeletionBlocked: true,
            destructiveDeletionReady: false,
            destructiveDeletionReason: "Prior deletion completion was not verified. Recovery requires a new plan.",
            deletionExecutionState: "verification_required"
          }
        : {}),
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
    if (args.verifyAfterRun) await args.verifyAfterRun({ adminUid, requestId });
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
    verifyAfterRun: operation === "execute"
      ? ({ adminUid }) => verifyCompletedDeletion(requestId, adminUid)
      : undefined
  });
});