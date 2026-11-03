import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const dispatcherSource = readFileSync(new URL('../functions/src/consent-revocation-jobs-dispatcher.ts', import.meta.url), 'utf8');
const contractSource = readFileSync(new URL('../functions/src/consent-revocation-jobs-contract.ts', import.meta.url), 'utf8');
const transpile = s => ts.transpileModule(s, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
const compiled = transpile(dispatcherSource), c = transpile(contractSource);
assert.equal(compiled.diagnostics?.length, 0);
assert.equal(c.diagnostics?.length, 0);
const contract = {};
vm.runInNewContext(c.outputText, { exports: contract, require, Buffer, Date, Object, Array, Number, String, Error, RegExp, URL, AbortSignal, fetch });
const NOW = Date.parse('2026-11-03T06:00:00.000Z');
const DELETE = Symbol('field-delete');
class Timestamp {
  constructor(ms) { this.ms = ms; this.seconds = Math.floor(ms/1000); this.nanoseconds = (ms%1000)*1000000; }
  toMillis() { return this.ms; }
  toDate() { return new Date(this.ms); }
  static fromMillis(ms) { return new Timestamp(ms); }
}
const FieldValue = { delete: () => DELETE, serverTimestamp: () => Timestamp.fromMillis(NOW) };
const sha = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const identity = { consentRecordId: 'owner-1_memory_storage', uid: 'owner-1', purpose: 'memory.storage', consentTier: 'C1', policyVersion: '1.0.0', sourceReceiptHash: 'a'.repeat(64) };
const eventId = sha({schemaVersion:'consent.revoked.v1',recordId:identity.consentRecordId,uid:identity.uid,purpose:identity.purpose,consentTier:identity.consentTier,policyVersion:identity.policyVersion,receiptHash:identity.sourceReceiptHash});
const VALID_LEASE = '123e4567-e89b-42d3-a456-426614174000';
const transport = {endpoint:'https://us-central1-urai-jobs.cloudfunctions.net/ingestConsentRevocation',expectedHost:'us-central1-urai-jobs.cloudfunctions.net',bearerToken:'x'.repeat(64)};
const defer = () => { let resolve, reject; const promise = new Promise((r,j) => { resolve=r; reject=j; }); return {promise, resolve, reject}; };
function fixture({deliveryState='pending', attempt=0, token, due=NOW, sender}={}) {
  let clock = NOW, calls=0, tokenSeq=0;
  let handler = sender || (async (event)=>({eventId:event.eventId,consumerId:'urai-jobs',acknowledgementHash:'f'.repeat(64)}));
  const row = { ...identity, schemaVersion:'consent.revoked.v1',eventId, integrityHash:sha({eventId,recordId:identity.consentRecordId,uid:identity.uid,purpose:identity.purpose}),status:'pending',
    jobsDeliveryConsumerId:'urai-jobs',jobsDeliveryState:deliveryState,jobsDeliveryAttempts:attempt,jobsNextAttemptAt:Timestamp.fromMillis(due),createdAt:Timestamp.fromMillis(NOW),
    ...(token===undefined?{}:{jobsLeaseToken:token}) };
  const ref={id:eventId,kind:'outbox'};
  const consent={uid:identity.uid,purpose:identity.purpose,status:'revoked',receiptHash:identity.sourceReceiptHash};
  let tail=Promise.resolve();
  const db={collection(name) {
    if(name==='consentRecords')return {doc:id=>({id,kind:'consent'})};
    assert.equal(name,'consentRevocationOutbox');
    const q={where(){return q;},orderBy(){return q;},limit(){return q;},async get(){
      const included=['pending','retry','leased'].includes(row.jobsDeliveryState) &&
        row.jobsNextAttemptAt instanceof Timestamp && row.jobsNextAttemptAt.toMillis()<=clock;
      return {docs: included?[{id:eventId,ref}]:[]};
    }};
    return q;
  },async runTransaction(callback) {
    const prior=tail; let release; tail=new Promise(r=>release=r);
    await prior;
    try {
      const writes=[];
      const tx={async get(r){return r.kind==='consent'
        ? {exists:true,data:()=>({...consent}),updateTime:Timestamp.fromMillis(NOW-1000)}
        : {exists:true,id:eventId,data:()=>({...row})};},
        update(r,changes){assert.equal(r.kind,'outbox');writes.push(changes);}};
      const out=await callback(tx);
      for(const changes of writes)for(const [key,value] of Object.entries(changes)) {
        if(value===DELETE)delete row[key];else row[key]=value;
      }
      return out;
    } finally { release(); }
  }};
  const exports={};
  const wrappedRequire=name=>{
    if(name==='node:crypto')return {randomUUID:()=>`00000000-0000-4000-8000-${(++tokenSeq).toString(16).padStart(12,'0')}`};
    if(name==='firebase-admin/firestore')return {FieldValue,Timestamp,getFirestore:()=>db};
    if(name==='./consent-revocation-jobs-contract')return {
      buildJobsRevocationEventV2:contract.buildJobsRevocationEventV2,
      sendJobsRevocationEvent: async (event) => {calls++;return handler(event);}
    };
    throw Error('Unexpected import '+name);
  };
  vm.runInNewContext(compiled.outputText, {exports,require:wrappedRequire,URL,Date,Number,String,Array,Object,Error,Promise,RegExp});
  return {row, run:()=>exports.dispatchPendingJobsRevocations(transport,{db,now:()=>clock}),advance:ms=>{clock+=ms;},setSender:x=>{handler=x;},get sends(){return calls;}};
}
test('unexpired valid lease is not stolen',async()=>{
  const h=fixture({deliveryState:'leased',attempt:1,token:VALID_LEASE,due:NOW+60000});
  const r=await h.run();assert.equal(r.scanned,0);assert.equal(h.sends,0);
  assert.equal(h.row.jobsLeaseToken,VALID_LEASE);
});
test('expired valid lease is recovered with a fresh token and second attempt',async()=>{
  const h=fixture({deliveryState:'leased',attempt:1,token:VALID_LEASE,due:NOW-1});
  const r=await h.run();assert.equal(r.applied,1);assert.equal(h.row.jobsDeliveryAttempts,2);
  assert.equal(h.sends,1);assert.equal('jobsLeaseToken' in h.row,false);
});
test('expired leased state missing its original token cannot silently claim authority',async()=>{
  const h=fixture({deliveryState:'leased',attempt:1,due:NOW-1});
  const r=await h.run();assert.equal(h.sends,0);
  assert.equal(r.needsReview,1);assert.equal(h.row.jobsDeliveryState,'needs-review');
});
test('expired leased state with malformed prior token cannot silently claim authority',async()=>{
  const h=fixture({deliveryState:'leased',attempt:1,token:42,due:NOW-1});
  const r=await h.run();assert.equal(h.sends,0);
  assert.equal(r.needsReview,1);assert.equal(h.row.jobsDeliveryState,'needs-review');
});
for(const state of ['pending','retry'])test(`${state} carrying a stale lease token must be quarantined`,async()=>{
  const h=fixture({deliveryState:state,attempt:1,token:'unexplained-owner'});
  const r=await h.run();assert.equal(h.sends,0);
  assert.equal(r.needsReview,1);assert.equal(h.row.jobsDeliveryState,'needs-review');
});
test('competing dispatchers may read same due event, but only one claims while lease is current',async()=>{
  const gate=defer();const h=fixture({sender:async event=>{await gate.promise;return {eventId:event.eventId,consumerId:'urai-jobs',acknowledgementHash:'f'.repeat(64)};}});
  const first=h.run(),second=h.run();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.sends,1);
  gate.resolve();const [a,b]=await Promise.all([first,second]);
  assert.equal(a.applied+b.applied,1);
  assert.equal(h.row.jobsDeliveryAttempts,1);
  assert.equal(h.sends,1);
});
test('stale worker cannot overwrite second worker after lease expiry and replay success',async()=>{
  const gate=defer();let sends=0;
  const h=fixture({sender:async event=>{sends++;if(sends===1)await gate.promise;return {eventId:event.eventId,consumerId:'urai-jobs',acknowledgementHash:'f'.repeat(64)};}});
  const first=h.run();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.sends,1);
  h.advance(60001);
  const second=await h.run();assert.equal(second.applied,1);assert.equal(h.row.jobsDeliveryAttempts,2);
  gate.resolve();const stale=await first;assert.equal(stale.applied,0);assert.equal(stale.skipped,1);
  assert.equal(h.row.jobsDeliveryState,'applied');assert.equal(h.row.jobsDeliveryAttempts,2);
});
test('failed send schedules durable retry and will not dispatch before due',async()=>{
  const h=fixture({sender:async()=>{throw Error('secret provider error');}});
  const first=await h.run();assert.equal(first.retry,1);assert.equal(h.row.jobsDeliveryAttempts,1);
  assert.equal(h.row.jobsNextAttemptAt.toMillis(),NOW+30000);
  const early=await h.run();assert.equal(early.scanned,0);assert.equal(h.sends,1);
  h.advance(30000);h.setSender(async event=>({eventId:event.eventId,consumerId:'urai-jobs',acknowledgementHash:'f'.repeat(64)}));
  const recovered=await h.run();assert.equal(recovered.applied,1);assert.equal(h.sends,2);
  assert.equal(h.row.jobsDeliveryAttempts,2);
});
test('last permitted delivery attempt fails closed and does not attempt again',async()=>{
  const h=fixture({deliveryState:'retry',attempt:11,sender:async()=>{throw Error('unavailable');}});
  const r=await h.run();assert.equal(r.needsReview,1);assert.equal(h.sends,1);
  assert.equal(h.row.jobsDeliveryAttempts,12);assert.equal(h.row.jobsDeliveryState,'needs-review');
  const again=await h.run();assert.equal(again.scanned,0);assert.equal(h.sends,1);
});

test('expired leased state with a non-UUID owner token must quarantine',async()=>{
  const h=fixture({deliveryState:'leased',attempt:1,token:'lease-previous',due:NOW-1});
  const r=await h.run();assert.equal(h.sends,0);assert.equal(r.needsReview,1);
  assert.equal(h.row.jobsDeliveryLastCode,'invalid_lease_metadata');
});
test('leased state with zero attempts has impossible ownership history',async()=>{
  const h=fixture({deliveryState:'leased',attempt:0,token:VALID_LEASE,due:NOW-1});
  const r=await h.run();assert.equal(h.sends,0);assert.equal(r.needsReview,1);
  assert.equal(h.row.jobsDeliveryLastCode,'invalid_state_attempt_history');
});
test('pending state cannot have previously attempted delivery',async()=>{
  const h=fixture({deliveryState:'pending',attempt:3});
  const r=await h.run();assert.equal(h.sends,0);assert.equal(r.needsReview,1);
  assert.equal(h.row.jobsDeliveryLastCode,'invalid_state_attempt_history');
});
test('retry state must represent at least one previous delivery',async()=>{
  const h=fixture({deliveryState:'retry',attempt:0});
  const r=await h.run();assert.equal(h.sends,0);assert.equal(r.needsReview,1);
  assert.equal(h.row.jobsDeliveryLastCode,'invalid_state_attempt_history');
});
