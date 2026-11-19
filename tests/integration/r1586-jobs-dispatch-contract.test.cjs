const test = require("node:test");
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { createRequire } = require("node:module");
const { resolve } = require("node:path");
const functionsRequire = createRequire(resolve(__dirname, "../../functions/package.json"));
const { initializeApp } = functionsRequire("firebase-admin/app");
initializeApp({projectId:"urai-r1586-dispatch-synthetic"});
const { projectJobsRevocation, verifyJobsReceipt, validJobsPrivacyAck } =
  require("../../functions/lib/jobs-revocation-dispatch.js");
const hash = (x) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
function row() {
  const r={schemaVersion:"consent.revoked.v1",consentRecordId:"record-one",
    uid:"synthetic-owner",purpose:"life-movie.render",consentTier:"private",
    policyVersion:"v2",sourceReceiptHash:"a".repeat(64),
    priorGrantReceiptHash:"b".repeat(64),priorGrantEvidenceState:"present",
    createdAt:{toDate:()=>new Date("2026-11-19T19:00:00.000Z")}};
  r.eventId=hash({schemaVersion:r.schemaVersion,recordId:r.consentRecordId,
    uid:r.uid,purpose:r.purpose,consentTier:r.consentTier,
    policyVersion:r.policyVersion,receiptHash:r.sourceReceiptHash});
  r.integrityHash=hash({eventId:r.eventId,recordId:r.consentRecordId,
    uid:r.uid,purpose:r.purpose,priorGrantReceiptHash:r.priorGrantReceiptHash,
    priorGrantEvidenceState:r.priorGrantEvidenceState});
  return r;
}
function jobAck(e) {
  const integrityHash=createHash("sha256").update([
    e.eventId,e.uid,e.purpose,e.policyVersion,e.sourceReceiptHash,"blocked"
  ].join("\n")).digest("hex");
  return {ok:true,acknowledgement:{consumerId:"urai-jobs",eventId:e.eventId,
    ownerUid:e.uid,purpose:e.purpose,policyVersion:e.policyVersion,
    decisionReceiptId:e.sourceReceiptHash,sourceReceiptHash:e.sourceReceiptHash,
    priorGrantReceiptHash:e.priorGrantReceiptHash,
    priorGrantEvidenceState:e.priorGrantEvidenceState,
    correlationId:e.correlationId,schemaVersion:e.type,status:"blocked",
    integrityHash,derivativeInvalidation:{purpose:e.purpose,jobsScanned:1,
      jobsInvalidated:1,plansInvalidated:0,storageObjectsDeleted:0}}};
}
test("canonical Privacy prior-grant event maps to Jobs v2 without weakened data",()=>{
  const x=projectJobsRevocation(row());
  assert.equal(x.type,"consent.revoked.v2");
  assert.equal(x.revokedAt,"2026-11-19T19:00:00.000Z");
  assert.equal(x.priorGrantReceiptHash,"b".repeat(64));
  assert.equal(x.correlationId,x.eventId);
});
test("successful Jobs response only counts as delivery receipt, not Privacy ACK",()=>{
  const e=projectJobsRevocation(row());
  assert.match(verifyJobsReceipt(jobAck(e),e),/^[a-f0-9]{64}$/);
});
for(const [what,modify] of [
  ["event id",(x)=>x.eventId="c".repeat(64)],
  ["integrity hash",(x)=>x.integrityHash="c".repeat(64)],
  ["subject",(x)=>x.uid="stranger"],
  ["source receipt",(x)=>x.sourceReceiptHash="d".repeat(64)],
  ["prior grant receipt",(x)=>x.priorGrantReceiptHash="c".repeat(64)],
  ["prior grant state",(x)=>x.priorGrantEvidenceState="missing_or_invalid"],
  ["missing timestamp",(x)=>delete x.createdAt],
  ["missing prior-grant state",(x)=>delete x.priorGrantEvidenceState],
]) test("reject corrupted Privacy outbox: "+what,()=>{
  const x=row();modify(x);assert.throws(()=>projectJobsRevocation(x));
});
for(const [what,modify] of [
  ["wrong consumer",(x)=>x.consumerId="fake-analytics"],
  ["wrong owner",(x)=>x.ownerUid="other"],
  ["wrong event",(x)=>x.eventId="c".repeat(64)],
  ["wrong integrity",(x)=>x.integrityHash="c".repeat(64)],
  ["wrong source receipt",(x)=>x.sourceReceiptHash="c".repeat(64)],
  ["missing derivative invalidation",(x)=>delete x.derivativeInvalidation],
  ["negative deletion count",(x)=>x.derivativeInvalidation.storageObjectsDeleted=-1],
  ["wrong purpose",(x)=>x.derivativeInvalidation.purpose="other"]
]) test("reject fake Jobs response: "+what,()=>{
  const e=projectJobsRevocation(row());const b=jobAck(e);
  modify(b.acknowledgement);assert.throws(()=>verifyJobsReceipt(b,e));
});
test("negative response without acknowledgement denied",()=>{
  const e=projectJobsRevocation(row());
  assert.throws(()=>verifyJobsReceipt({ok:false},e));
});
test("Privacy projection parses under exact Jobs receiver schema",async(t)=>{
  if (!process.env.URAI_JOBS_RECEIVER_MODULE) {
    t.skip("No exact Jobs candidate module pinned for cross-repo acceptance");
    return;
  }
  const path=require("node:url").pathToFileURL(process.env.URAI_JOBS_RECEIVER_MODULE);
  const consumer=await import(path.href);
  const event=projectJobsRevocation(row());
  assert.equal(consumer.NativeConsentRevokedEventSchema.safeParse(event).success,true);
  assert.equal(consumer.verifyNativeLineage(event),true);
});

function verifiedAckFixture() {
  const event=projectJobsRevocation(row());
  const receipt=verifyJobsReceipt(jobAck(event),event);
  const outbox={...row(),status:"delivered_pending_ack",jobsReceiptHash:receipt};
  const actorUid="synthetic-jobs-system-consumer";
  const ack={consumerId:"urai-jobs",status:"applied",actorUid,actorRole:"system",
    correlationId:outbox.eventId,detailHash:receipt};
  ack.integrityHash=hash({eventId:outbox.eventId,consumerId:"urai-jobs",status:"applied",
    correlationId:outbox.eventId,detailHash:receipt,actorUid,tokenConsumerId:"urai-jobs"});
  return {outbox,ack};
}
test("valid Jobs consumer-bound Privacy ACK can finalize delivery",()=>{
  const {outbox,ack}=verifiedAckFixture();
  assert.equal(validJobsPrivacyAck(ack,outbox),true);
});
for(const [label,mutate] of [
 ["wrong consumer",(ack)=>ack.consumerId="urai-analytics"],
 ["wrong actor role",(ack)=>ack.actorRole="user"],
 ["mismatched status",(ack)=>ack.status="rejected"],
 ["changed correlation",(ack)=>ack.correlationId="other-event"],
 ["changed delivery receipt",(ack)=>ack.detailHash="e".repeat(64)],
 ["forged integrity hash",(ack)=>ack.integrityHash="e".repeat(64)],
 ["different actor",(ack)=>ack.actorUid="stranger"],
]) test("reject noncanonical Privacy ACK: "+label,()=>{
  const {outbox,ack}=verifiedAckFixture();
  mutate(ack);assert.equal(validJobsPrivacyAck(ack,outbox),false);
});
test("cannot finalize delivery without trusted Jobs receipt",()=>{
  const {outbox,ack}=verifiedAckFixture();
  outbox.jobsReceiptHash="";assert.equal(validJobsPrivacyAck(ack,outbox),false);
});
test("cannot acknowledge event not in delivered_pending_ack",()=>{
  const {outbox,ack}=verifiedAckFixture();
  outbox.status="pending";assert.equal(validJobsPrivacyAck(ack,outbox),false);
});

