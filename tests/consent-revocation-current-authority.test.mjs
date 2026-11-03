import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=readFileSync(new URL('../functions/src/consent-revocation-jobs-dispatcher.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(compiled.diagnostics?.length,0);
const NOW=Date.parse('2026-11-03T06:00:00.000Z');
const DELETE=Symbol('delete');
class Timestamp {constructor(ms,ns=0){this.ms=ms;this.seconds=Math.floor(ms/1000);this.nanoseconds=(ms%1000)*1000000+ns;} toMillis(){return this.ms;} toDate(){return new Date(this.ms);} static fromMillis(ms){return new Timestamp(ms);}}
const FieldValue={delete:()=>DELETE,serverTimestamp:()=>Timestamp.fromMillis(NOW)};
const sha=(x)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const identity={consentRecordId:'owner-1_memory_storage',uid:'owner-1',purpose:'memory.storage',consentTier:'C1',policyVersion:'1.0.0',sourceReceiptHash:'a'.repeat(64)};
const eventId=sha({schemaVersion:'consent.revoked.v1',recordId:identity.consentRecordId,uid:identity.uid,purpose:identity.purpose,consentTier:identity.consentTier,policyVersion:identity.policyVersion,receiptHash:identity.sourceReceiptHash});
const defaultConsent={uid:identity.uid,purpose:identity.purpose,status:'revoked',receiptHash:identity.sourceReceiptHash};
const mkRef=(id)=>({id});
const validTransport={endpoint:'https://us-central1-urai-jobs.cloudfunctions.net/ingestConsentRevocation', expectedHost:'us-central1-urai-jobs.cloudfunctions.net',bearerToken:'x'.repeat(64)};
function fixture({current=defaultConsent,revision=NOW-1000,during=null,sameMillisecond=false}={}){
 let consent=current===null?null:{...current};let consentRevision=revision;let consentRevisionNanos=0;let sent=0;let mutations=0;
 const row={...identity,eventId,integrityHash:sha({eventId,recordId:identity.consentRecordId,uid:identity.uid,purpose:identity.purpose}),schemaVersion:'consent.revoked.v1',status:'pending',jobsDeliveryConsumerId:'urai-jobs',jobsDeliveryState:'pending',jobsDeliveryAttempts:0,createdAt:Timestamp.fromMillis(NOW),jobsNextAttemptAt:Timestamp.fromMillis(NOW)};
 const ref=mkRef(eventId);
 function consentSnapshot(){return consent?{exists:true,data:()=>({...consent}),updateTime:new Timestamp(consentRevision,consentRevisionNanos)}:{exists:false,data:()=>undefined,updateTime:undefined};}
 function snapshot(r){return r.id===eventId?{exists:true,id:r.id,data:()=>({...row}),updateTime:Timestamp.fromMillis(1)}:consentSnapshot();}
 const db={
  collection(name){if(name==='consentRecords')return {doc:(id)=>mkRef(id)};assert.equal(name,'consentRevocationOutbox');const q={where(){return q},orderBy(){return q},limit(){return q},async get(){return {docs:[{id:eventId,ref}]}}};return q;},
  async runTransaction(fn){const pending=[];const transaction={get:async r=>snapshot(r),update(r,patch){pending.push({r,patch})}};const result=await fn(transaction);for(const {r,patch} of pending){assert.equal(r.id,eventId);mutations++;for(const [key,val] of Object.entries(patch)){if(val===DELETE)delete row[key];else row[key]=val;}}return result;},
 };
 const wrappedRequire=(name)=>{if(name==='node:crypto')return {randomUUID};if(name==='firebase-admin/firestore')return {FieldValue,Timestamp,getFirestore:()=>db};if(name==='./consent-revocation-jobs-contract')return {
   buildJobsRevocationEventV2:(id,data)=>{if(id!==eventId||data.eventId!==id||data.status!=='pending'||data.integrityHash!==row.integrityHash)throw Error('BAD_IDENTITY');return {eventId:id,ownerUid:identity.uid,purpose:identity.purpose,sourceReceiptHash:identity.sourceReceiptHash};},
   sendJobsRevocationEvent:async(event)=>{sent++;if(during){consent={...during};if(sameMillisecond)consentRevisionNanos+=1;else consentRevision+=1;}return {eventId:event.eventId,consumerId:'urai-jobs',acknowledgementHash:'b'.repeat(64)}}
  };throw Error('unexpected dependency '+name);};
 const exported={};vm.runInNewContext(compiled.outputText,{exports:exported,require:wrappedRequire,URL,Number,Date,Object,Array,String,Error,Promise,RegExp});
 return {run:()=>exported.dispatchPendingJobsRevocations(validTransport,{db,now:()=>NOW}),row,get sent(){return sent},get mutations(){return mutations},setConsent(next){consent=next===null?null:{...next};consentRevision+=1;}};
}
test('existing revoked consent remains eligible for correctly bound delivery',async()=>{const h=fixture();const r=await h.run();assert.equal(r.applied,1);assert.equal(h.sent,1);assert.equal(h.row.jobsDeliveryState,'applied')});
test('deleted consent record is permitted to finish outstanding revocation',async()=>{const h=fixture({current:null});const r=await h.run();assert.equal(r.applied,1);assert.equal(h.sent,1)});
test('an already renewed grant must be quarantined BEFORE Jobs receives old event',async()=>{const h=fixture({current:{...defaultConsent,status:'granted',receiptHash:'c'.repeat(64)}});const r=await h.run();assert.equal(h.sent,0,'old event must not be dispatched against new consent');assert.equal(r.needsReview,1);assert.equal(h.row.jobsDeliveryState,'needs-review')});
test('regrant while remote request is in flight cannot be recorded as applied',async()=>{const h=fixture({during:{...defaultConsent,status:'granted',receiptHash:'d'.repeat(64)}});const r=await h.run();assert.equal(h.sent,1);assert.equal(r.applied,0,'a valid old ack cannot be completion after a new grant');assert.equal(r.needsReview,1);assert.equal(h.row.jobsDeliveryState,'needs-review')});
test('replacement consent owner must be quarantined before dispatch',async()=>{const h=fixture({current:{...defaultConsent,uid:'another-owner'}});const r=await h.run();assert.equal(h.sent,0);assert.equal(r.needsReview,1);assert.equal(h.row.jobsDeliveryState,'needs-review')});
test('ABA-style consent revision changes during transit must not count as completion',async()=>{const h=fixture({during:{...defaultConsent}});const r=await h.run();assert.equal(h.sent,1);assert.equal(r.applied,0);assert.equal(h.row.jobsDeliveryState,'needs-review')});

test('newer revoked receipt cannot be superseded by an older queued revocation', async()=>{const h=fixture({current:{...defaultConsent,receiptHash:'e'.repeat(64)}});const result=await h.run();assert.equal(result.needsReview,1);assert.equal(h.sent,0);assert.equal(h.row.jobsDeliveryState,'needs-review')});
test('same-millisecond Firestore updateTime nanosecond change must quarantine result',async()=>{const h=fixture({during:{...defaultConsent},sameMillisecond:true});const result=await h.run();assert.equal(result.applied,0);assert.equal(result.needsReview,1)});
