import { createHash } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

const db = getFirestore();
const REVOCATION_SCHEMA_VERSION = "consent.revoked.v1";

const acknowledgementSchema = z.object({
  eventId: z.string().regex(/^[0-9a-f]{64}$/),
  consumerId: z.string().trim().min(2).max(120).regex(/^[a-zA-Z0-9._-]+$/),
  status: z.enum(["applied", "rejected"]),
  correlationId: z.string().trim().min(8).max(160),
  detailHash: z.string().regex(/^[0-9a-f]{64}$/)
});

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function boundConsumerAuthority(request: { auth?: { uid?: string; token?: Record<string, unknown> } }) {
  const actorUid = request.auth?.uid;
  if (!actorUid) throw new HttpsError("unauthenticated", "Authentication is required.");

  const token = request.auth?.token;
  const system = token?.system === true || token?.role === "system";
  const consumerId = typeof token?.consumerId === "string" ? token.consumerId.trim() : "";
  if (!system || !/^[a-zA-Z0-9._-]{2,120}$/.test(consumerId)) {
    throw new HttpsError("permission-denied", "A consumer-bound trusted system authority is required.");
  }

  return { actorUid, consumerId };
}

export const publishConsentRevocation = onDocumentWritten("consentRecords/{recordId}", async (event) => {
  const before = event.data?.before.exists ? event.data.before.data() : null;
  const after = event.data?.after.exists ? event.data.after.data() : null;
  const revokesExistingGrant =
    before?.status === "granted" &&
    after !== null &&
    after.status !== "granted";
  if (!after || (after.status !== "revoked" && !revokesExistingGrant)) return;
  if (before?.status === after.status && before?.receiptHash === after.receiptHash) return;

  const uid = typeof after.uid === "string" ? after.uid : "";
  const purpose = typeof after.purpose === "string" ? after.purpose : "";
  const consentTier = typeof after.consentTier === "string" ? after.consentTier : "";
  const policyVersion = typeof after.policyVersion === "string" ? after.policyVersion : "";
  const receiptHash = typeof after.receiptHash === "string" ? after.receiptHash : "";
  if (!uid || !purpose || !consentTier || !policyVersion || !/^[0-9a-f]{64}$/.test(receiptHash)) {
    throw new Error("Cannot publish consent revocation from an invalid canonical consent record.");
  }

  const recordId = event.params.recordId;
  const eventId = digest({
    schemaVersion: REVOCATION_SCHEMA_VERSION,
    recordId,
    uid,
    purpose,
    consentTier,
    policyVersion,
    receiptHash
  });
  const outboxRef = db.collection("consentRevocationOutbox").doc(eventId);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(outboxRef);
    if (existing.exists) return;
    transaction.create(outboxRef, {
      schemaVersion: REVOCATION_SCHEMA_VERSION,
      eventId,
      consentRecordId: recordId,
      uid,
      purpose,
      consentTier,
      policyVersion,
      sourceReceiptHash: receiptHash,
      status: "pending",
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      integrityHash: digest({ eventId, recordId, uid, purpose })
    });
  });
});

export const acknowledgeConsentRevocation = onCall(async (request) => {
  const authority = boundConsumerAuthority(request);
  const parsed = acknowledgementSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join("; "));
  if (parsed.data.consumerId !== authority.consumerId) {
    throw new HttpsError("permission-denied", "The acknowledgement consumerId must match the trusted token consumerId.");
  }

  const outboxRef = db.collection("consentRevocationOutbox").doc(parsed.data.eventId);
  const ackRef = outboxRef.collection("acknowledgements").doc(authority.consumerId);
  const auditRef = db.collection("auditLogs").doc();

  const result = await db.runTransaction(async (transaction) => {
    const outbox = await transaction.get(outboxRef);
    const existingAck = await transaction.get(ackRef);

    if (!outbox.exists) throw new HttpsError("not-found", "Revocation event was not found.");
    const outboxData = outbox.data() ?? {};
    if (outboxData.eventId !== parsed.data.eventId || outboxData.schemaVersion !== REVOCATION_SCHEMA_VERSION) {
      throw new HttpsError("failed-precondition", "Revocation event integrity metadata is invalid.");
    }

    if (existingAck.exists) {
      const existing = existingAck.data() ?? {};
      const same =
        existing.consumerId === authority.consumerId &&
        existing.status === parsed.data.status &&
        existing.correlationId === parsed.data.correlationId &&
        existing.detailHash === parsed.data.detailHash &&
        existing.actorUid === authority.actorUid;
      if (!same) {
        throw new HttpsError("already-exists", "A different immutable acknowledgement already exists for this consumer.");
      }
      return { idempotent: true, auditId: null as string | null };
    }

    const acknowledgement = {
      consumerId: authority.consumerId,
      status: parsed.data.status,
      correlationId: parsed.data.correlationId,
      detailHash: parsed.data.detailHash,
      actorUid: authority.actorUid,
      actorRole: "system",
      acknowledgedAt: FieldValue.serverTimestamp(),
      integrityHash: digest({ ...parsed.data, actorUid: authority.actorUid, tokenConsumerId: authority.consumerId })
    };

    transaction.create(ackRef, acknowledgement);
    transaction.update(outboxRef, {
      updatedAt: FieldValue.serverTimestamp(),
      lastAcknowledgedConsumer: authority.consumerId,
      lastAcknowledgementStatus: parsed.data.status
    });
    transaction.create(auditRef, {
      actorUid: authority.actorUid,
      actorRole: "system",
      action: "consent_revocation_acknowledged",
      targetUid: outboxData.uid ?? null,
      source: "function",
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        eventId: parsed.data.eventId,
        consumerId: authority.consumerId,
        status: parsed.data.status,
        correlationId: parsed.data.correlationId
      },
      integrityHash: digest({ auditId: auditRef.id, ...parsed.data, actorUid: authority.actorUid, tokenConsumerId: authority.consumerId })
    });

    return { idempotent: false, auditId: auditRef.id as string | null };
  });

  return {
    eventId: parsed.data.eventId,
    consumerId: authority.consumerId,
    status: parsed.data.status,
    auditId: result.auditId,
    idempotent: result.idempotent
  };
});
