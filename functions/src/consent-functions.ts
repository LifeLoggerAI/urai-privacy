import { createHash } from "node:crypto";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";
import {
  CONSENT_POLICY_VERSION,
  consentPurposeRegistry,
  consentTiers,
  evaluateConsentDecision,
  getConsentPurpose,
  type ConsentRecordSnapshot
} from "./consent-policy";

const app = getApps().length ? getApp() : initializeApp();
const db = getFirestore(app);

const consentStatuses = ["granted", "denied", "revoked"] as const;
const purposeName = z.string().trim().min(2).max(120).regex(/^[a-zA-Z0-9_.:-]+$/);
const serviceName = z.string().trim().min(2).max(120).regex(/^[a-zA-Z0-9_.:-]+$/);

const updateConsentSchema = z.object({
  purpose: purposeName,
  consentTier: z.enum(consentTiers),
  status: z.enum(consentStatuses)
});

const evaluateConsentSchema = z.object({
  purpose: purposeName,
  requestedTier: z.enum(consentTiers),
  service: serviceName,
  action: serviceName,
  subjectUid: z.string().trim().min(1).max(160).optional(),
  contextId: z.string().trim().min(1).max(500).optional()
});

type RequestAuth = { uid?: string; token?: Record<string, unknown> };
type ActorRole = "user" | "admin" | "system";

function sha256(value: unknown) {
  return createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
}

function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data ?? {});
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      parsed.error.issues.map((issue) => issue.message).join("; ")
    );
  }
  return parsed.data;
}

function authenticatedUid(auth?: RequestAuth) {
  const uid = auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  return uid;
}

function actorRole(auth?: RequestAuth): ActorRole {
  if (auth?.token?.system === true || auth?.token?.role === "system") return "system";
  if (auth?.token?.admin === true || auth?.token?.role === "admin") return "admin";
  return "user";
}

function targetUidForEvaluation(auth: RequestAuth | undefined, requestedUid?: string) {
  const actorUid = authenticatedUid(auth);
  const role = actorRole(auth);
  const subjectUid = requestedUid ?? actorUid;
  if (role === "user" && subjectUid !== actorUid) {
    throw new HttpsError("permission-denied", "Users may evaluate only their own consent.");
  }
  return { actorUid, role, subjectUid };
}

function recordId(uid: string, purpose: string) {
  return `${uid}_${purpose.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function timestampIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  return null;
}

async function writeAudit(args: {
  actorUid: string;
  actorRole: ActorRole;
  action: string;
  targetUid: string;
  metadata: Record<string, unknown>;
}) {
  const ref = db.collection("auditLogs").doc();
  const payload = {
    ...args,
    source: "function",
    timestamp: FieldValue.serverTimestamp(),
    integrityHash: sha256({ ...args, auditId: ref.id })
  };
  await ref.set(payload);
  return ref.id;
}

export const getConsentPurposeRegistry = onCall(async (request) => {
  authenticatedUid(request.auth);
  return {
    policyVersion: CONSENT_POLICY_VERSION,
    purposes: consentPurposeRegistry
  };
});

export const updateConsent = onCall(async (request) => {
  const uid = authenticatedUid(request.auth);
  const { purpose, consentTier, status } = parseOrThrow(updateConsentSchema, request.data);
  const registered = getConsentPurpose(purpose);
  if (!registered) {
    throw new HttpsError("invalid-argument", "Consent purpose is not registered.");
  }
  if (registered.consentTier !== consentTier) {
    throw new HttpsError(
      "invalid-argument",
      `Consent tier for ${purpose} must be ${registered.consentTier}.`
    );
  }

  const now = new Date();
  const expiresAt =
    status === "granted"
      ? new Date(now.getTime() + registered.grantDurationDays * 24 * 60 * 60 * 1000)
      : null;
  const receiptForHash = {
    uid,
    purpose,
    consentTier,
    status,
    policyVersion: CONSENT_POLICY_VERSION,
    updatedAt: now.toISOString(),
    expiresAt: expiresAt?.toISOString() ?? null
  };
  const receiptHash = sha256(receiptForHash);
  const consentRecordId = recordId(uid, purpose);
  const recordRef = db.collection("consentRecords").doc(consentRecordId);
  const eventRef = db.collection("consentEvents").doc();

  await db.runTransaction(async (transaction) => {
    transaction.set(recordRef, {
      uid,
      purpose,
      purposeLabel: registered.label,
      consentTier,
      status,
      policyVersion: CONSENT_POLICY_VERSION,
      updatedAt: Timestamp.fromDate(now),
      expiresAt: expiresAt ? Timestamp.fromDate(expiresAt) : null,
      grantedAt: status === "granted" ? Timestamp.fromDate(now) : null,
      deniedAt: status === "denied" ? Timestamp.fromDate(now) : null,
      revokedAt: status === "revoked" ? Timestamp.fromDate(now) : null,
      receiptHash
    });
    transaction.set(eventRef, {
      ...receiptForHash,
      actorUid: uid,
      consentRecordId,
      createdAt: Timestamp.fromDate(now),
      receiptHash: sha256({ ...receiptForHash, eventId: eventRef.id })
    });
  });

  const auditId = await writeAudit({
    actorUid: uid,
    actorRole: "user",
    action: "consent_updated_v1",
    targetUid: uid,
    metadata: {
      purpose,
      consentTier,
      status,
      consentRecordId,
      consentEventId: eventRef.id,
      policyVersion: CONSENT_POLICY_VERSION,
      expiresAt: expiresAt?.toISOString() ?? null
    }
  });

  return {
    consentId: consentRecordId,
    consentEventId: eventRef.id,
    status,
    consentTier,
    policyVersion: CONSENT_POLICY_VERSION,
    expiresAt: expiresAt?.toISOString() ?? null,
    receiptHash,
    auditId
  };
});

export const evaluateConsent = onCall(async (request) => {
  const { purpose, requestedTier, service, action, subjectUid: requestedUid, contextId } =
    parseOrThrow(evaluateConsentSchema, request.data);
  const { actorUid, role, subjectUid } = targetUidForEvaluation(request.auth, requestedUid);
  const registered = getConsentPurpose(purpose);
  const consentRecordId = recordId(subjectUid, purpose);
  const snapshot = await db.collection("consentRecords").doc(consentRecordId).get();
  const data = snapshot.exists ? snapshot.data() ?? {} : null;
  const record: ConsentRecordSnapshot | null = data
    ? {
        uid: typeof data.uid === "string" ? data.uid : undefined,
        purpose: typeof data.purpose === "string" ? data.purpose : undefined,
        consentTier: typeof data.consentTier === "string" ? data.consentTier : undefined,
        status: typeof data.status === "string" ? data.status : undefined,
        policyVersion: typeof data.policyVersion === "string" ? data.policyVersion : undefined,
        expiresAt: timestampIso(data.expiresAt),
        receiptHash: typeof data.receiptHash === "string" ? data.receiptHash : null
      }
    : null;
  const evaluatedAt = new Date().toISOString();
  const decision = evaluateConsentDecision({
    subjectUid,
    purpose,
    requestedTier,
    record,
    evaluatedAt
  });
  const contextHash = contextId ? sha256(contextId) : null;
  const decisionRef = db.collection("consentDecisions").doc();
  const decisionPayload = {
    uid: subjectUid,
    actorUid,
    actorRole: role,
    service,
    action,
    purpose,
    requestedTier,
    requiredTier: registered?.consentTier ?? null,
    allowed: decision.allowed,
    reason: decision.reason,
    policyVersion: decision.policyVersion,
    consentRecordId,
    receiptHash: record?.receiptHash ?? null,
    expiresAt: record?.expiresAt ? Timestamp.fromDate(new Date(record.expiresAt)) : null,
    contextHash,
    evaluatedAt: Timestamp.fromDate(new Date(evaluatedAt)),
    integrityHash: sha256({
      decisionId: decisionRef.id,
      subjectUid,
      actorUid,
      service,
      action,
      purpose,
      requestedTier,
      allowed: decision.allowed,
      reason: decision.reason,
      policyVersion: decision.policyVersion,
      receiptHash: record?.receiptHash ?? null,
      contextHash,
      evaluatedAt
    })
  };
  await decisionRef.set(decisionPayload);
  const auditId = await writeAudit({
    actorUid,
    actorRole: role,
    action: decision.allowed ? "consent_decision_allowed" : "consent_decision_denied",
    targetUid: subjectUid,
    metadata: {
      decisionId: decisionRef.id,
      service,
      action,
      purpose,
      requestedTier,
      allowed: decision.allowed,
      reason: decision.reason,
      policyVersion: decision.policyVersion,
      contextHash
    }
  });

  return {
    decisionId: decisionRef.id,
    allowed: decision.allowed,
    reason: decision.reason,
    policyVersion: decision.policyVersion,
    purpose,
    requestedTier,
    requiredTier: decision.requiredTier,
    expiresAt: decision.expiresAt,
    receiptHash: record?.receiptHash ?? null,
    auditId
  };
});
