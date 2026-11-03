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
vm.runInNewContext(compiled.outputText, {exports, require, Buffer, Date, Number, Error, RegExp, Object, Array, String, URL, AbortSignal, TextDecoder, fetch});
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
const endpoint='https://us-central1-urai-jobs.cloudfunctions.net/ingestConsentRevocation';
const host='us-central1-urai-jobs.cloudfunctions.net';
const transport=(overrides={})=>({
 endpoint,expectedHost:host,bearerToken:'x'.repeat(64),
 request:async(_url, options)=>({ok:true,status:200,headers:{get:(name)=>name==='content-type'?'application/json':null},text:async()=>JSON.stringify(ack())}),
 ...overrides,
});
test('transport requires pinned HTTPS endpoint and verifies returned Jobs ack',async()=>{
 let sent;
 const result=await send(event,transport({request:async(url,options)=>{sent={url,options};return {ok:true,status:200,headers:{get:(name)=>name==='content-type'?'application/json':null},text:async()=>JSON.stringify(ack())}}}));
 assert.equal(sent.url,endpoint);assert.equal(sent.options.method,'POST');assert.equal(sent.options.redirect,'error');
 assert.equal(JSON.parse(sent.options.body).eventId,event.eventId);
 assert.equal(result.consumerId,'urai-jobs');assert.match(result.acknowledgementHash,/^[a-f0-9]{64}$/);
});
for(const [name,changes] of [
 ['plain HTTP endpoint',{endpoint:'http://us-central1-urai-jobs.cloudfunctions.net/ingestConsentRevocation'}],
 ['wrong host',{expectedHost:'evil.run.app'}],
 ['loopback',{endpoint:'https://127.0.0.1/ingestConsentRevocation',expectedHost:'127.0.0.1'}],
 ['user info',{endpoint:'https://user:pw@us-central1-urai-jobs.cloudfunctions.net/ingestConsentRevocation'}],
 ['query parameters',{endpoint:endpoint+'?redirect=https://evil.run.app'}],
 ['other path',{endpoint:'https://us-central1-urai-jobs.cloudfunctions.net/unrelated'}],
 ['missing bearer',{bearerToken:''}],
 ['header injection',{bearerToken:'a'.repeat(32)+'\nX: bad'}],
]) test(`transport rejects ${name} without network call`,async()=>{
 let calls=0;await assert.rejects(send(event,transport({...changes,request:async()=>{calls++;throw new Error('unexpected request')}})));assert.equal(calls,0);
});
for(const [name,response] of [
 ['HTTP failure',()=>({ok:false,status:500,headers:{get:(name)=>name==='content-type'?'application/json':null},text:async()=>JSON.stringify(ack())})],
 ['text response',()=>({ok:true,status:200,headers:{get:(name)=>name==='content-type'?'text/plain':null},text:async()=>JSON.stringify(ack())})],
 ['malformed JSON',()=>({ok:true,status:200,headers:{get:(name)=>name==='content-type'?'application/json':null},text:async()=>'{bad'})],
 ['tampered acknowledgement',()=>({ok:true,status:200,headers:{get:(name)=>name==='content-type'?'application/json':null},text:async()=>JSON.stringify({...ack(),acknowledgement:{...ack().acknowledgement,ownerUid:'other'}})})],
 ['oversized body',()=>({ok:true,status:200,headers:{get:(name)=>name==='content-type'?'application/json':null},text:async()=> ' '.repeat(18000)})],
]) test(`transport rejects ${name}`,async()=>await assert.rejects(send(event,transport({request:async()=>response()}))));

test('Jobs retry acknowledgement hash is stable across different valid cleanup summaries', async()=>{
 const render={type:'consent.revoked.v2',eventId:'a'.repeat(64),ownerUid:'owner-1',purpose:'life-movie.render',
  policyVersion:'1.1.0',correlationId:'revocation:'+'a'.repeat(64),revokedAt:'2026-11-03T04:00:00.000Z',sourceReceiptHash:'b'.repeat(64)};
 const resp=(deleted)=>({ok:true, acknowledgement:{consumerId:'urai-jobs',eventType:render.type,eventId:render.eventId,
  ownerUid:render.ownerUid,purpose:render.purpose,policyVersion:render.policyVersion,
  correlationId:render.correlationId,revokedAt:render.revokedAt,sourceReceiptHash:render.sourceReceiptHash,
  status:'blocked',integrityHash:ackHash(render),derivativeInvalidation:{purpose:render.purpose,
   jobsScanned:2,jobsInvalidated:1,plansInvalidated:1,storageObjectsDeleted:deleted}}});
 const invoke=(deleted)=>send(render,transport({request:async()=>({ok:true,status:200,
  headers:{get:(name)=>name==='content-type'?'application/json':null},text:async()=>JSON.stringify(resp(deleted))})}));
 const first=await invoke(2);const retry=await invoke(0);
 assert.equal(first.eventId,retry.eventId);
 assert.equal(first.acknowledgementHash,retry.acknowledgementHash,
  'canonical revocation acknowledgement must not incorporate mutable cleanup counts');
 assert.equal(first.acknowledgementHash,ackHash(render));
});


test('never buffers advertised oversized Jobs ack',async()=>{
 let bodyReads=0;
 const fakeResponse={ok:true,status:200,headers:{get:(key)=>key==='content-type'?'application/json':key==='content-length'?'65536':null},
  text:async()=>{bodyReads++;return JSON.stringify(ack())}};
 await assert.rejects(send(event,transport({request:async()=>fakeResponse})),/PRIVACY_JOBS_ACK_OVERSIZE/);
 assert.equal(bodyReads,0,'must reject declared oversized body before reading');
});

test('bounds chunked Jobs ack streaming without draining the entire response',async()=>{
 let pulls=0;let legacyTextCalls=0;
 const body=new ReadableStream({pull(controller){pulls++;if(pulls<100){controller.enqueue(Buffer.alloc(1024,65));}else{controller.close();}}});
 const fakeResponse={ok:true,status:200,headers:{get:(key)=>key==='content-type'?'application/json':null},body,
  text:async()=>{legacyTextCalls++;return 'A'.repeat(1024*100)}};
 await assert.rejects(send(event,transport({request:async()=>fakeResponse})),/PRIVACY_JOBS_ACK_OVERSIZE/);
 assert.equal(legacyTextCalls,0,'a real stream must be consumed with a bounded reader');
 assert.ok(pulls<25,`stream over-consumed: ${pulls} KB`);
});

test('rejects malformed UTF-8 in a valid-looking Jobs acknowledgement',async()=>{
 // The original Buffer.toString() silently accepted this as a valid ack
 // with an ignored replacement-character property. The wire bytes are bad.
 const encoded=Buffer.concat([
  Buffer.from(JSON.stringify(ack()).slice(0,-1)+',\"ignored\":\"'),
  Buffer.from([0xff]),Buffer.from('\"}')
 ]);
 const body=new ReadableStream({start(controller){controller.enqueue(encoded);controller.close();}});
 const response={ok:true,status:200,headers:{get:(key)=>key==='content-type'?'application/json':null},body,
  text:async()=>{throw new Error('unbounded read was not expected')}};
 await assert.rejects(send(event,transport({request:async()=>response})),/PRIVACY_JOBS_ACK_INVALID_UTF8/);
});

test('accepts valid multibyte JSON split across acknowledgement chunks',async()=>{
 const leading=Buffer.from(JSON.stringify(ack()).slice(0,-1)+',\"ignored\":\"');
 const body=new ReadableStream({start(controller){
  controller.enqueue(leading);
  controller.enqueue(Buffer.from([0xf0,0x9f]));
  controller.enqueue(Buffer.from([0x98,0x80]));
  controller.enqueue(Buffer.from('\"}'));controller.close();
 }});
 const response={ok:true,status:200,headers:{get:(key)=>key==='content-type'?'application/json':null},body,
  text:async()=>{throw new Error('unbounded read was not expected')}};
 assert.equal((await send(event,transport({request:async()=>response}))).consumerId,'urai-jobs');
});

test('preserves existing JSON BOM rejection for streamed acknowledgements',async()=>{
 const body=new ReadableStream({start(controller){controller.enqueue(Buffer.concat([
  Buffer.from([0xef,0xbb,0xbf]),Buffer.from(JSON.stringify(ack()))
 ]));controller.close();}});
 const response={ok:true,status:200,headers:{get:(key)=>key==='content-type'?'application/json':null},body,
  text:async()=>{throw new Error('unbounded read was not expected')}};
 await assert.rejects(send(event,transport({request:async()=>response})),/PRIVACY_JOBS_ACK_INVALID_JSON/);
});

test('reads and verifies a normal chunked Jobs acknowledgement',async()=>{
 let legacyTextCalls=0;
 const body=new ReadableStream({start(controller){controller.enqueue(Buffer.from(JSON.stringify(ack())));controller.close();}});
 const fakeResponse={ok:true,status:200,headers:{get:(key)=>key==='content-type'?'application/json':null},body,
  text:async()=>{legacyTextCalls++;throw new Error('unexpected unbounded text read')}};
 const result=await send(event,transport({request:async()=>fakeResponse}));
 assert.equal(legacyTextCalls,0);assert.equal(result.consumerId,'urai-jobs');
});


test('rejects a matching foreign Cloud Functions host before sending bearer credentials', async () => {
 let calls = 0;
 const foreign = 'unrelated.us-central1.cloudfunctions.net';
 await assert.rejects(send(event, transport({
  endpoint: `https://${foreign}/ingestConsentRevocation`, expectedHost: foreign,
  request: async () => { calls++; return { ok: true, status: 200, headers: { get: k => k === 'content-type' ? 'application/json' : null }, text: async () => JSON.stringify(ack()) }; },
 })), /PRIVACY_JOBS_ENDPOINT_NOT_PINNED/);
 assert.equal(calls, 0);
});

test('rejects a matching foreign Cloud Run host before sending bearer credentials', async () => {
 let calls = 0;
 const foreign = 'unrelated-123-uc.a.run.app';
 await assert.rejects(send(event, transport({
  endpoint: `https://${foreign}/ingestConsentRevocation`, expectedHost: foreign,
  request: async () => { calls++; return { ok: true, status: 200, headers: { get: k => k === 'content-type' ? 'application/json' : null }, text: async () => JSON.stringify(ack()) }; },
 })), /PRIVACY_JOBS_ENDPOINT_NOT_PINNED/);
 assert.equal(calls, 0);
});
