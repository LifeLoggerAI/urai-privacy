import { createHash, randomUUID } from "node:crypto";
import { FieldValue, Timestamp, getFirestore, type Transaction } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall, type CallableRequest } from "firebase-functions/v2/https";
import {
  executeDeletionRequest as unguardedExecuteDeletionRequest,
  processDeletionRequest as unguardedProcessDeletionRequest
} from "./index";
import {
  deletionCompletionAuthorityBlockReason,
  isUnverifiedDeletionCompletionState,
  type DeletionCompletionAuthorityState
} from "./deletion-completion-authority";
import {
  collectDeletionCompletionResiduals,
  deletionCompletionBlockReason,
  type DeletionCompletionResiduals
} from "./deletion-completion-verifier";
import {
  buildDeletionMutationLeasePatch,
  deletionMutationBlockReason,
  deletionPlanningFenceBlockReason
} from "./deletion-mutation-policy";

const db = getFirestore();
const DELETION_MUTATION_LEASE_MS = 16 * 60 * 1000;
const DELETION_CALLABLE_OPTIONS = {
  timeoutSeconds: 14 * 60,
  memory: "1GiB" as const
};

const COMPLETION_VERIFIER_REQUIRED_MESSAGE =
  "Deletion completion verifier is required before destructive execution may become final.";
const TERMINAL_DELETION_STATUSES = new Set(["completed", "rejected", "failed"]);

type DeletionMutationOperation = "process" | "dryRun" | "execute";
type DeletionCallableRequest = CallableRequest<Record<string, unknown>>;

type CompletionAuthority = {
  actorUid: string;
  targetUid: string;
  leaseToken: string;
};

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

function requireCompletionAuthority(
  state: DeletionCompletionAuthorityState,
  authority: CompletionAuthority
): void {
  const blocked = deletionCompletionAuthorityBlockReason(state, {
    actorUid: authority.actorUid,
    targetUid: authority.targetUid,
    leaseToken: authority.leaseToken,
    nowMillis: Date.now()
  });
  if (blocked) throw new HttpsError(blocked.code, blocked.message);
}

async function releaseDeletionMutationLease(
  requestId: string,
  token: string,
  targetUid: string
): Promise<void> {
  const ref = db.collection("deletionRequests").doc(requestId);
  const tombstoneRef = db.collection("privacyDeletionTombstones").doc(targetUid);
  await db.runTransaction(async (tx: Transaction) => {
    const [snapshot, tombstone] = await Promise.all([
      tx.get(ref),
      tx.get(tombstoneRef)
    ]);
    if (snapshot.exists && snapshot.data()?.deletionMutationLeaseToken === token) {
      tx.update(ref, {
        deletionMutationLeaseToken: FieldValue.delete(),
        deletionMutationLeaseUntil: FieldValue.delete(),
        deletionMutationLeaseOperation: FieldValue.delete(),
        deletionMutationLeaseBy: FieldValue.delete(),
        deletionMutationLeaseStartedAt: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
    if (tombstone.exists && tombstone.data()?.deletionPlanningLeaseToken === token) {
      tx.update(tombstoneRef, {
        deletionPlanningLeaseToken: FieldValue.delete(),
        deletionPlanningLeaseUntil: FieldValue.delete(),
        deletionPlanningLeaseRequestId: FieldValue.delete(),
        deletionPlanningLeaseOperation: FieldValue.delete(),
        deletionPlanningLeaseBy: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  });
}

async function writeCompletionVerification(args: {
  requestId: string;
  actorUid: string;
  targetUid: string;
  leaseToken: string;
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
    requireCompletionAuthority(snapshot.data() ?? {}, args);
    const now = new Date();
    const tombstoneRef = db.collection("privacyDeletionTombstones").doc(args.targetUid);
    tx.update(ref, {
      ...(args.verified
        ? {
            status: "completed",
            destructiveDeletionBlocked: false,
            destructiveDeletionReady: false,
            destructiveDeletionReason: FieldValue.delete(),
            deletionExecutionState: "completed",
            destructiveDeletionCompletedAt: Timestamp.fromDate(now),
            deletionCompletionVerificationRequired: false,
            deletionCompletionVerified: true,
            deletionCompletionVerificationStatus: "verified",
            deletionCompletionVerifiedAt: Timestamp.fromDate(now),
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
            deletionCompletionVerificationStatus: "failed",
            deletionCompletionVerificationReason: args.reason ?? "Deletion completion verification failed.",
            destructiveDeletionCompletedAt: FieldValue.delete()
          }),
      deletionCompletionResidualSummary: residualSummary,
      deletionCompletionVerificationAuditId: auditRef.id,
      updatedAt: Timestamp.fromDate(now)
    });
    tx.set(auditRef, {
      ...auditEvent,
      timestamp: Timestamp.fromDate(now),
      integrityHash: sha256({ ...auditEvent, id: auditRef.id })
    });
    tx.set(tombstoneRef, {
      uid: args.targetUid,
      requestId: args.requestId,
      active: true,
      status: args.verified ? "completed" : "verification_required",
      updatedAt: Timestamp.fromDate(now)
    }, { merge: true });
  });

  return auditRef.id;
}

async function writeCompletionVerificationFailure(args: {
  requestId: string;
  actorUid: string;
  targetUid: string;
  leaseToken: string;
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
    requireCompletionAuthority(snapshot.data() ?? {}, args);
    tx.update(ref, {
      status: "processing",
      destructiveDeletionBlocked: true,
      destructiveDeletionReady: false,
      destructiveDeletionReason: "Deletion completion residual scan failed and must be retried.",
      deletionExecutionState: "verification_required",
      deletionCompletionVerificationRequired: true,
      deletionCompletionVerified: false,
      deletionCompletionVerificationStatus: "failed",
      deletionCompletionVerificationReason: args.errorMessage,
      destructiveDeletionCompletedAt: FieldValue.delete(),
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

async function removeDeletionPlanArtifacts(uid: string): Promise<void> {
  const prefix = `privacy-deletion-plans/${createHash("sha256").update(uid).digest("hex")}/`;
  const [files] = await getStorage().bucket().getFiles({ prefix });
  await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));
}

async function verifyCompletedDeletion(
  requestId: string,
  actorUid: string,
  leaseToken: string
): Promise<void> {
  const ref = db.collection("deletionRequests").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Deletion request not found during completion verification.");
  const uid = String(snapshot.data()?.uid ?? "");
  if (!uid) throw new HttpsError("failed-precondition", "Deletion request is missing uid during completion verification.");
  const authority = { actorUid, targetUid: uid, leaseToken };
  requireCompletionAuthority(snapshot.data() ?? {}, authority);

  let residuals: DeletionCompletionResiduals;
  try {
    await removeDeletionPlanArtifacts(uid);
    residuals = await collectDeletionCompletionResiduals(uid);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "unknown";
    const auditId = await writeCompletionVerificationFailure({
      requestId,
      ...authority,
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
      ...authority,
      residuals,
      verified: false,
      reason: blocked.message
    });
    throw new HttpsError(blocked.code, blocked.message, { auditId });
  }

  await writeCompletionVerification({
    requestId,
    ...authority,
    residuals,
    verified: true
  });
}

async function withDeletionMutationLease<T>(args: {
  request: DeletionCallableRequest;
  operation: DeletionMutationOperation;
  run: () => Promise<T>;
  verifyAfterRun?: (context: {
    adminUid: string;
    requestId: string;
    leaseToken: string;
  }) => Promise<void>;
}): Promise<T> {
  const adminUid = requireAdminUid(args.request);
  const requestId = requestIdFrom(args.request);
  const ref = db.collection("deletionRequests").doc(requestId);
  const token = randomUUID();
  const nowMillis = Date.now();
  let targetUid = "";
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
    targetUid = String(state.uid ?? "");
    if (!targetUid) throw new HttpsError("failed-precondition", "Deletion request is missing its subject uid.");
    const status = String(state.status ?? "").trim().toLowerCase();
    if (TERMINAL_DELETION_STATUSES.has(status)) {
      throw new HttpsError("failed-precondition", `Deletion request is terminal (${status}) and cannot be mutated.`);
    }
    const blocked = deletionMutationBlockReason(state, nowMillis);
    if (blocked) throw new HttpsError(blocked.code, blocked.message);

    const tombstoneRef = db.collection("privacyDeletionTombstones").doc(targetUid);
    const tombstone = await tx.get(tombstoneRef);
    if (args.operation !== "execute") {
      const planningBlocked = deletionPlanningFenceBlockReason(tombstone.data() ?? {}, nowMillis, requestId);
      if (planningBlocked) throw new HttpsError(planningBlocked.code, planningBlocked.message);
    }

    const unverifiedCompletion = isUnverifiedDeletionCompletionState(state);
    if (unverifiedCompletion && args.operation === "execute") {
      throw new HttpsError(
        "failed-precondition",
        `${COMPLETION_VERIFIER_REQUIRED_MESSAGE} The prior deletion mutation was not verified; run a new dry run before another destructive execution.`
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
            deletionExecutionState: "verification_required",
            destructiveDeletionCompletedAt: FieldValue.delete()
          }
        : {}),
      deletionMutationLeaseStartedAt: FieldValue.serverTimestamp(),
      ...(args.operation === "execute"
        ? {
            deletionCompletionVerificationRequired: true,
            deletionCompletionVerified: false,
            deletionCompletionVerificationStatus: "pending",
            deletionCompletionVerificationReason: FieldValue.delete(),
            destructiveDeletionCompletedAt: FieldValue.delete()
          }
        : {}),
      updatedAt: FieldValue.serverTimestamp()
    });
    if (args.operation !== "execute") {
      tx.set(tombstoneRef, {
        uid: targetUid,
        deletionPlanningLeaseToken: token,
        deletionPlanningLeaseUntil: lease.deletionMutationLeaseUntil,
        deletionPlanningLeaseRequestId: requestId,
        deletionPlanningLeaseOperation: args.operation,
        deletionPlanningLeaseBy: adminUid,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  try {
    const result = await args.run();
    if (args.verifyAfterRun) {
      await args.verifyAfterRun({ adminUid, requestId, leaseToken: token });
    }
    return result;
  } finally {
    try {
      if (targetUid) await releaseDeletionMutationLease(requestId, token, targetUid);
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
      ? ({ adminUid, leaseToken }) => verifyCompletedDeletion(requestId, adminUid, leaseToken)
      : undefined
  });
});