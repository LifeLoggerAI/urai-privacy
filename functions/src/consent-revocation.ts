import { createHash } from "node:crypto";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { z } from "zod";

const db = getFirestore();
const REVOCATION_SCHEMA_VERSION = "consent.revoked.v1";

const acknowledgementSchema = z.object({
  eventId: z.string().trim().min(16).max(128),
  consumerId: z.string().trim().min(2).max(120).regex(/^[a-zA-Z0-9._-]+$/),
  status: z.enum(["applied", "rejected"]),
  correlationId: z.string().trim().min(8).max(160),
  detailHash: z.string().trim().min(16).max(128)
});

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function privileged(token?: Record<string, unknown>) {
  return token?.admin === true || token?.system === true || token?.role === "admin" || token?.role === "system";
}

export const publishConsentRevocation = onDocumentWritten("consentRecords/{recordId}", async (event) => {
  const before = event.data?.before.exists ? event.data.before.data() : null;
  const after = event.data?.after.exists ? event.data.after.data() : null;
  if (!after || after.status !== "revoked") return;
  if (before?.status === "revoked" && before?.receiptHash === after.receiptHash) return;

  const recordId = event.params.recordId;
  const eventId = digest({
    schemaVersion: REVOCATION_SCHEMA_VERSION,
    recordId,
    uid: after.uid,
    purpose: after.purpose,
    consentTier: after.consentTier,
    policyVersion: after.policyVersion,
    receiptHash: after.receiptHash
  });
  const outboxRef = db.collection("consentRevocationOutbox").doc(eventId);

  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(outboxRef);
    if (existing.exists) return;
    transaction.create(outboxRef, {
      schemaVersion: REVOCATION_SCHEMA_VERSION,
      eventId,
      consentRecordId: recordId,
      uid: after.uid,
      purpose: after.purpose,
      consentTier: after.consentTier,
      policyVersion: after.policyVersion,
      sourceReceiptHash: after.receiptHash,
      status: "pending",
      attempts: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      integrityHash: digest({ eventId, recordId, uid: after.uid, purpose: after.purpose })
    });
  });
});

export const acknowledgeConsentRevocation = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Authentication is required.");
  if (!privileged(request.auth.token)) throw new HttpsError("permission-denied", "Trusted system or administrator authority is required.");

  const parsed = acknowledgementSchema.safeParse(request.data ?? {});
  if (!parsed.success) throw new HttpsError("invalid-argument", parsed.error.issues.map((issue) => issue.message).join("; "));

  const outboxRef = db.collection("consentRevocationOutbox").doc(parsed.data.eventId);
  const ackRef = outboxRef.collection("acknowledgements").doc(parsed.data.consumerId);
  const auditRef = db.collection("auditLogs").doc();

  await db.runTransaction(async (transaction) => {
    const outbox = await transaction.get(outboxRef);
    if (!outbox.exists) throw new HttpsError("not-found", "Revocation event was not found.");
    const acknowledgement = {
      consumerId: parsed.data.consumerId,
      status: parsed.data.status,
      correlationId: parsed.data.correlationId,
      detailHash: parsed.data.detailHash,
      actorUid: request.auth?.uid,
      acknowledgedAt: FieldValue.serverTimestamp(),
      integrityHash: digest({ ...parsed.data, actorUid: request.auth?.uid })
    };
    transaction.set(ackRef, acknowledgement, { merge: false });
    transaction.set(outboxRef, {
      updatedAt: FieldValue.serverTimestamp(),
      lastAcknowledgedConsumer: parsed.data.consumerId,
      lastAcknowledgementStatus: parsed.data.status
    }, { merge: true });
    transaction.set(auditRef, {
      actorUid: request.auth?.uid,
      actorRole: request.auth?.token?.role ?? "system",
      action: "consent_revocation_acknowledged",
      targetUid: outbox.data()?.uid ?? null,
      source: "function",
      timestamp: FieldValue.serverTimestamp(),
      metadata: { eventId: parsed.data.eventId, consumerId: parsed.data.consumerId, status: parsed.data.status, correlationId: parsed.data.correlationId },
      integrityHash: digest({ auditId: auditRef.id, ...parsed.data })
    });
  });

  return { eventId: parsed.data.eventId, consumerId: parsed.data.consumerId, status: parsed.data.status, auditId: auditRef.id };
});
