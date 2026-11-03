import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = fs.readFileSync(new URL('../functions/src/consent-revocation-jobs-contract.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, reportDiagnostics: true });
assert.equal(compiled.diagnostics?.length, 0, 'TS transpile diagnostics');
const exports = {};
vm.runInNewContext(compiled.outputText, {exports, require, Buffer, Date, Number, Error, RegExp, Object, Array, String, URL, AbortSignal, fetch});
const { buildJobsRevocationEventV2: build, jobsRevocationAckHash: ackHash, verifyJobsRevocationResponse: verify } = exports;
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const make = (changes={}) => {
 const data = {schemaVersion:'consent.revoked.v1',consentRecordId:'owner-1_memory_storage',uid:'owner-1',purpose:'memory.storage',consentTier:'C1',policyVersion:'1.0.0',sourceReceiptHash:'a'.repeat(64),status:'pending',attempts:0,
   createdAt:{toDate:()=>new Date('2026-11-03T04:00:00.000Z')},...changes};
 const recordId=data.consentRecordId,uid=data.uid,purpose=data.purpose,consentTier=data.consentTier,policyVersion=data.policyVersion,receiptHash=data.sourceReceiptHash;
 const eventId = sha({schemaVersion:'consent.revoked.v1',recordId,uid,purpose,consentTier,policyVersion,receiptHash});
 return {id:eventId,record:{...data,eventId,integrityHash:sha({eventId,recordId,uid,purpose})}};
};
const valid = make();
const event = build(valid.id,valid.record);
const ack = () => ({ ok:true, acknowledgement:{ consumerId:'urai-jobs', eventType:'consent.revoked.v2',eventId:event.eventId,ownerUid:event.ownerUid,
 purpose:event.purpose,policyVersion:event.policyVersion,sourceReceiptHash:event.sourceReceiptHash,correlationId:event.correlationId,revokedAt:event.revokedAt,
 status:'blocked',integrityHash:ackHash(event),derivativeInvalidation:{purpose:event.purpose,jobsScanned:0,jobsInvalidated:0,plansInvalidated:0,storageObjectsDeleted:0} } });

test('maps exact publisher v1 record to Jobs v2 with stable deterministic timestamp',()=>{
 assert.equal(event.type,'consent.revoked.v2'); assert.equal(event.correlationId,`revocation:${valid.id}`);
 assert.equal(event.revokedAt,'2026-11-03T04:00:00.000Z'); assert.equal(event.sourceReceiptHash,'a'.repeat(64));
 assert.equal(build(valid.id,valid.record).revokedAt,event.revokedAt);
});
test('valid committed Jobs ack with derivative invalidation qualifies as transport ack',()=>{assert.equal(verify(event,ack()),true)});
for(const [name, mutate] of [
 ['wrong Firestore document id', x=>{x.id='b'.repeat(64)}],
 ['wrong publisher event digest', x=>{x.record.eventId='b'.repeat(64);x.id=x.record.eventId}],
 ['wrong publisher integrity', x=>{x.record.integrityHash='f'.repeat(64)}],
 ['unverified ownership',x=>{x.record.uid='other'}],
 ['wrong source record scope',x=>{x.record.consentRecordId='owner-2_memory_storage'}],
 ['missing server timestamp',x=>{x.record.createdAt=null}],
 ['fake timestamp string',x=>{x.record.createdAt='2026-11-03T04:00:00Z'}],
 ['old schema',x=>{x.record.schemaVersion='consent.revoked.v2'}],
 ['already marked delivered',x=>{x.record.status='delivered'}],
 ['noncanonical receipt',x=>{x.record.sourceReceiptHash='not-a-hash'}],
 ['wrong tier',x=>{x.record.consentTier='bad'}],
]) test(`rejects ${name}`,()=>{let x={id:valid.id,record:{...valid.record}};mutate(x);assert.throws(()=>build(x.id,x.record))});
for(const [name, mutate] of [
 ['provider denied',x=>{x.ok=false}],
 ['missing ack',x=>{delete x.acknowledgement}],
 ['forged event id',x=>{x.acknowledgement.eventId='b'.repeat(64)}],
 ['forged owner',x=>{x.acknowledgement.ownerUid='victim'}],
 ['forged consumer',x=>{x.acknowledgement.consumerId='other'}],
 ['wrong status',x=>{x.acknowledgement.status='applied'}],
 ['missing cleanup summary',x=>{delete x.acknowledgement.derivativeInvalidation}],
 ['fake successful cleanup',x=>{x.acknowledgement.derivativeInvalidation.storageObjectsDeleted=-1}],
 ['impossible counts',x=>{x.acknowledgement.derivativeInvalidation.jobsInvalidated=7}],
 ['non-render purpose claims worker cleanup',x=>{x.acknowledgement.derivativeInvalidation.jobsScanned=1}],
 ['altered digest',x=>{x.acknowledgement.integrityHash='b'.repeat(64)}],
 ['replay timestamp',x=>{x.acknowledgement.revokedAt='2025-01-01T00:00:00.000Z'}],
 ['missing source receipt',x=>{delete x.acknowledgement.sourceReceiptHash}],
]) test(`rejects ${name} acknowledgement`,()=>{const x=ack();mutate(x);assert.equal(verify(event,x),false)});

const { sendJobsRevocationEvent: send } = exports;
const endpoint='https://urai-jobs.us-central1.cloudfunctions.net/ingestConsentRevocation';
const host='urai-jobs.us-central1.cloudfunctions.net';
const transport=(overrides={})=>({
 endpoint,expectedHost:host,bearerToken:'x'.repeat(64),
 request:async(_url, options)=>({ok:true,status:200,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(ack())}),
 ...overrides,
});
test('transport requires pinned HTTPS endpoint and verifies returned Jobs ack',async()=>{
 let sent;
 const result=await send(event,transport({request:async(url,options)=>{sent={url,options};return {ok:true,status:200,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(ack())}}}));
 assert.equal(sent.url,endpoint);assert.equal(sent.options.method,'POST');assert.equal(sent.options.redirect,'error');
 assert.equal(JSON.parse(sent.options.body).eventId,event.eventId);
 assert.equal(result.consumerId,'urai-jobs');assert.match(result.acknowledgementHash,/^[a-f0-9]{64}$/);
});
for(const [name,changes] of [
 ['plain HTTP endpoint',{endpoint:'http://urai-jobs.us-central1.cloudfunctions.net/ingestConsentRevocation'}],
 ['wrong host',{expectedHost:'evil.run.app'}],
 ['loopback',{endpoint:'https://127.0.0.1/ingestConsentRevocation',expectedHost:'127.0.0.1'}],
 ['user info',{endpoint:'https://user:pw@urai-jobs.us-central1.cloudfunctions.net/ingestConsentRevocation'}],
 ['query parameters',{endpoint:endpoint+'?redirect=https://evil.run.app'}],
 ['other path',{endpoint:'https://urai-jobs.us-central1.cloudfunctions.net/unrelated'}],
 ['missing bearer',{bearerToken:''}],
 ['header injection',{bearerToken:'a'.repeat(32)+'\nX: bad'}],
]) test(`transport rejects ${name} without network call`,async()=>{
 let calls=0;await assert.rejects(send(event,transport({...changes,request:async()=>{calls++;throw new Error('unexpected request')}})));assert.equal(calls,0);
});
for(const [name,response] of [
 ['HTTP failure',()=>({ok:false,status:500,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(ack())})],
 ['text response',()=>({ok:true,status:200,headers:{get:()=> 'text/plain'},text:async()=>JSON.stringify(ack())})],
 ['malformed JSON',()=>({ok:true,status:200,headers:{get:()=> 'application/json'},text:async()=>'{bad'})],
 ['tampered acknowledgement',()=>({ok:true,status:200,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify({...ack(),acknowledgement:{...ack().acknowledgement,ownerUid:'other'}})})],
 ['oversized body',()=>({ok:true,status:200,headers:{get:()=> 'application/json'},text:async()=> ' '.repeat(18000)})],
]) test(`transport rejects ${name}`,async()=>await assert.rejects(send(event,transport({request:async()=>response()}))));
