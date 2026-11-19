import { createHash } from "node:crypto";
import { FieldValue, getFirestore, type Timestamp } from "firebase-admin/firestore";
import { defineSecret } from "firebase-functions/params";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { z } from "zod";

const jobsBearer = defineSecret("URAI_JOBS_PRIVACY_EVENT_TOKEN");
const hex = z.string().regex(/^[0-9a-f]{64}$/);
const schema = z.object({
  schemaVersion: z.literal("consent.revoked.v1"),
  eventId: hex,
  consentRecordId: z.string().min(1).max(160),
  uid: z.string().min(1).max(160),
  purpose: z.string().min(1).max(160),
  consentTier: z.string().min(1).max(160),
  policyVersion: z.string().min(1).max(80),
  sourceReceiptHash: hex,
  priorGrantReceiptHash: hex.nullable(),
  priorGrantEvidenceState: z.enum(["present","missing_or_invalid","not_applicable"]),
  integrityHash: hex,
}).passthrough();

function sha(v: unknown): string {
  return createHash("sha256").update(JSON.stringify(v)).digest("hex");
}
function ackHash(eventId: string, uid: string, purpose: string, version: string, receipt: string): string {
  return createHash("sha256").update([eventId,uid,purpose,version,receipt,"blocked"].join("\n")).digest("hex");
}

export function projectRevocationToJobs(source: unknown, expectedId: string, revokedAt: string) {
  const v = schema.parse(source);
  const eventId = sha({
    schemaVersion:v.schemaVersion, recordId:v.consentRecordId,
    uid:v.uid, purpose:v.purpose, consentTier:v.consentTier,
    policyVersion:v.policyVersion, receiptHash:v.sourceReceiptHash,
  });
  const integrity = sha({
    eventId,recordId:v.consentRecordId,uid:v.uid,purpose:v.purpose,
    priorGrantReceiptHash:v.priorGrantReceiptHash,
    priorGrantEvidenceState:v.priorGrantEvidenceState,
  });
  const evidenceValid = v.priorGrantEvidenceState === "present"
    ? v.priorGrantReceiptHash !== null : v.priorGrantReceiptHash === null;
  if (!evidenceValid || eventId !== expectedId || eventId !== v.eventId
      || v.integrityHash !== integrity || !Number.isFinite(Date.parse(revokedAt))) {
    throw new Error("canonical-outbox-invalid");
  }
  return {
    type:"consent.revoked.v2" as const, schemaVersion:v.schemaVersion,
    eventId,consentRecordId:v.consentRecordId,uid:v.uid,purpose:v.purpose,
    consentTier:v.consentTier,policyVersion:v.policyVersion,
    sourceReceiptHash:v.sourceReceiptHash,priorGrantReceiptHash:v.priorGrantReceiptHash,
    priorGrantEvidenceState:v.priorGrantEvidenceState,integrityHash:integrity,
    correlationId:eventId,revokedAt,
  };
}

function jobsUrl(): string {
  const raw=process.env.URAI_JOBS_REVOCATION_URL || "";
  if (!raw) throw new Error("jobs-revocation-url-unconfigured");
  const url=new URL(raw);
  const emulator=Boolean(process.env.FIRESTORE_EMULATOR_HOST)
    && url.hostname==="127.0.0.1" && url.protocol==="http:";
  if ((!emulator && url.protocol!=="https:")
      || url.username || url.password || url.search || url.hash
      || !url.pathname.endsWith("/ingestConsentRevocation")) throw new Error("jobs-url-invalid");
  return url.toString();
}
function token(): string {
  let t="";
  try { t=jobsBearer.value() || ""; } catch { /* emulator fallback */ }
  t ||= process.env.URAI_JOBS_PRIVACY_EVENT_TOKEN || "";
  if (!t) throw new Error("jobs-revocation-token-missing");
  return t;
}
function verifyReceipt(body: unknown, v: ReturnType<typeof projectRevocationToJobs>): string {
  if (!body || typeof body!=="object") throw new Error("jobs-ack-invalid");
  const response=body as Record<string,unknown>;
  const ack=response.acknowledgement;
  if (response.ok!==true || !ack || typeof ack!=="object") throw new Error("jobs-ack-invalid");
  const a=ack as Record<string,unknown>;
  const expected=ackHash(v.eventId,v.uid,v.purpose,v.policyVersion,v.sourceReceiptHash);
  if (a.consumerId!=="urai-jobs" || a.eventId!==v.eventId || a.ownerUid!==v.uid
      || a.purpose!==v.purpose || a.policyVersion!==v.policyVersion
      || a.schemaVersion!==v.type || a.correlationId!==v.eventId
      || a.sourceReceiptHash!==v.sourceReceiptHash || a.status!=="blocked"
      || a.integrityHash!==expected || !a.derivativeInvalidation) throw new Error("jobs-ack-integrity-invalid");
  return expected;
}

/** At-least-once transport receipt. NOT the authenticated consumer ACK. */
export const dispatchConsentRevocationToJobs = onDocumentCreated({
  document:"consentRevocationOutbox/{eventId}",
  region:"us-central1",retry:true,secrets:[jobsBearer],
},async event => {
  if (!event.data) return;
  const id=event.params.eventId;
  const initial=event.data.data();
  const db=getFirestore(), ref=db.collection("consentRevocationOutbox").doc(id);
  if ((await ref.get()).data()?.jobsTransportStatus==="delivered") return;
  let projected: ReturnType<typeof projectRevocationToJobs>;
  let timestamp: string;
  try {
    const createdAt=initial.createdAt as Timestamp | undefined;
    if (!createdAt || typeof createdAt.toDate!=="function") throw new Error("outbox-createdAt-invalid");
    timestamp=createdAt.toDate().toISOString();
    projected=projectRevocationToJobs(initial,id,timestamp);
  } catch {
    // Invalid canonical events are quarantined; never sent or auto-repaired.
    // A separately reviewed immutable reconciliation is required.
    await ref.set({
      jobsTransportStatus:"quarantined",
      jobsTransportReason:"invalid-canonical-outbox",
      jobsTransportUpdatedAt:FieldValue.serverTimestamp(),
    },{merge:true});
    return;
  }
  try {
    const reply=await fetch(jobsUrl(),{
      method:"POST",redirect:"error",
      headers:{"authorization":"Bearer "+token(),"content-type":"application/json"},
      body:JSON.stringify(projected),
      signal:AbortSignal.timeout(15000),
    });
    if (!reply.ok) throw new Error("jobs-delivery-http-"+reply.status);
    const integrity=verifyReceipt(await reply.json(),projected);
    await db.runTransaction(async tx => {
      const now=await tx.get(ref);
      if (!now.exists) throw new Error("outbox-missing");
      const current=now.data() || {};
      projectRevocationToJobs(current,id,timestamp);
      if (current.jobsTransportStatus==="delivered") {
        if (current.jobsTransportReceiptHash!==integrity) throw new Error("immutable-jobs-receipt-conflict");
        return;
      }
      tx.update(ref,{
        jobsTransportStatus:"delivered",jobsTransportReceiptHash:integrity,
        jobsTransportAttempts:FieldValue.increment(1),
        jobsTransportUpdatedAt:FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    await ref.set({
      jobsTransportStatus:"retry_pending",
      jobsTransportAttempts:FieldValue.increment(1),
      jobsTransportUpdatedAt:FieldValue.serverTimestamp(),
    },{merge:true});
    throw error;
  }
});

