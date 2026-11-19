'use strict';
// R1586 review-only: synthetic dual-project native emulator contract, no production access.
// Run only with pinned Privacy #328 and Jobs #501; this is NOT a dispatcher.
const assert = require('node:assert/strict');
const {createHash, randomBytes} = require('node:crypto');
const {initializeApp,deleteApp} = require('firebase/app');
const {getAuth,connectAuthEmulator,createUserWithEmailAndPassword} = require('firebase/auth');
const {getFunctions,connectFunctionsEmulator,httpsCallable} = require('firebase/functions');
const {initializeApp: adminApp,deleteApp: deleteAdminApp} = require('firebase-admin/app');
const {getAuth: adminAuth} = require('firebase-admin/auth');
const {getFirestore} = require('firebase-admin/firestore');
const {projectCanonicalJobsV2Revocation} = require('../../functions/lib/consent-revocation-jobs-v2.js');
const P='urai-privacy-r1512-disposable', J='demo-urai-jobs';
const PSHA='28e369cee5963340bb985a329a969659c0753e85';
const JSHA='501520051909534ccf004e03152431392392e1ab';
const token='r1586-disposable-test-only-bearer';
const sha=x=>createHash('sha256').update(x).digest('hex');
const hash=x=>sha(JSON.stringify(x));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const passes=[]; const apps=[]; let admin;
function pass(k){passes.push(k); console.log('R1586_PASS '+k)}
function safe(){
 for(const [k,v] of Object.entries({
  URAI_PRIVACY_EXACT_SHA:PSHA, URAI_JOBS_EXACT_SHA:JSHA, GCLOUD_PROJECT:P,
  FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:9099',
  FIRESTORE_EMULATOR_HOST:'127.0.0.1:8080',
  FIREBASE_STORAGE_EMULATOR_HOST:'127.0.0.1:9199',
  URAI_R1586_JOBS_FUNCTIONS_ORIGIN:'http://127.0.0.1:5101',
  URAI_R1586_JOBS_FIRESTORE_ORIGIN:'http://127.0.0.1:8180'
 })) assert.equal(process.env[k],v,k);
 for(const k of ['GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_OAUTH_ACCESS_TOKEN','GOOGLE_CLOUD_ACCESS_TOKEN','CLOUDSDK_AUTH_ACCESS_TOKEN','FIREBASE_TOKEN','FIREBASE_CLI_TOKEN','GITHUB_TOKEN','GH_TOKEN','RUNPOD_API_KEY','NODE_OPTIONS']) assert.equal(process.env[k]||'','',k);
 if(process.env.FIREBASE_CONFIG) assert.equal(JSON.parse(process.env.FIREBASE_CONFIG).projectId,P);
 pass('exact_pins_disposable_two_project_loopback_and_no_cloud_credentials');
}
function client(label,nonce){
 const app=initializeApp({apiKey:'r1586-emulator-only',projectId:P,appId:'1:1586:web:only',authDomain:P+'.firebaseapp.com'},label+'-'+nonce);
 apps.push(app);
 const auth=getAuth(app); connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
 const functions=getFunctions(app,'us-central1'); connectFunctionsEmulator(functions,'127.0.0.1',5001);
 return {auth,functions};
}
async function call(who,name,data){return (await httpsCallable(who.functions,name,{timeout:25000})(data)).data}
async function waitFor(ref){
 for(let i=0;i<100;i++){let s=await ref.get();if(s.exists&&s.data().status==='pending')return s.data();await sleep(200)}
 throw Error('Privacy canonical outbox absent');
}
async function post(event,bearer=token){
 const r=await fetch(process.env.URAI_R1586_JOBS_FUNCTIONS_ORIGIN+'/'+J+'/us-central1/ingestConsentRevocation',{
  method:'POST',headers:{authorization:'Bearer '+bearer,'content-type':'application/json'},
  body:JSON.stringify(event),signal:AbortSignal.timeout(20000)});
 return {status:r.status,body:await r.json()};
}
async function jobDoc(collection,id){
 const u=process.env.URAI_R1586_JOBS_FIRESTORE_ORIGIN+'/v1/projects/'+J+'/databases/(default)/documents/'+collection+'/'+id;
 const r=await fetch(u,{signal:AbortSignal.timeout(10000)});
 if(r.status===404)return null;
 assert.equal(r.status,200);return (await r.json()).fields;
}
async function main(){
 safe();const suffix=randomBytes(5).toString('hex');
 const owner=client('owner',suffix),jobs=client('jobs',suffix),stranger=client('stranger',suffix);
 admin=adminApp({projectId:P},'r1586-admin-'+suffix);
 const auth=adminAuth(admin),db=getFirestore(admin);
 const users=await Promise.all([owner,jobs,stranger].map((x,i)=>createUserWithEmailAndPassword(x.auth,
  'r1586-'+suffix+'-'+i+'@example.test','SyntheticR1586Only1234!')));
 const uid=users[0].user.uid,jobsUid=users[1].user.uid;
 await auth.setCustomUserClaims(jobsUid,{system:true,consumerId:'urai-jobs'});
 await jobs.auth.currentUser.getIdToken(true);pass('native_owner_and_jobs_consumer_bound_identity');
 const grant=await call(owner,'setCanonicalConsent',{purpose:'memory.storage',status:'granted',surface:'r1586-test'});
 assert.equal(grant.status,'granted');
 const revoke=await call(owner,'setCanonicalConsent',{purpose:'memory.storage',status:'revoked',surface:'r1586-test'});
 assert.equal(revoke.status,'revoked');
 const record=(await db.collection('consentRecords').doc(grant.consentId).get()).data();
 const eventId=hash({schemaVersion:'consent.revoked.v1',recordId:grant.consentId,uid,
  purpose:record.purpose,consentTier:record.consentTier,policyVersion:record.policyVersion,receiptHash:record.receiptHash});
 const ref=db.collection('consentRevocationOutbox').doc(eventId),outbox=await waitFor(ref);
 assert.equal(outbox.sourceReceiptHash,revoke.receiptHash);assert.equal(outbox.priorGrantReceiptHash,grant.receiptHash);
 const event=projectCanonicalJobsV2Revocation(outbox);
 assert.ok(event);assert.equal(event.eventId,eventId);assert.equal(event.ownerUid,uid);
 pass('real_privacy_trigger_publishes_projectable_canonical_event');
 assert.equal(await jobDoc('jobConsentEventReceipts',sha(eventId)),null);
 assert.equal((await post(event,'incorrect-r1586-token')).status,401);
 assert.equal(await jobDoc('jobConsentEventReceipts',sha(eventId)),null);
 pass('real_jobs_handler_rejects_unauthorized_sender_without_mutation');
 assert.equal((await post({...event,sourceReceiptHash:'invalid'})).status,400);
 pass('real_jobs_handler_rejects_malformed_source_receipt');
 const delivered=await post(event);assert.equal(delivered.status,200);
 assert.equal(delivered.body.ok,true);
 const ack=delivered.body.acknowledgement;
 const expectedHash=hash({type:'consent.revoked.v2',eventId,ownerUid:uid,purpose:event.purpose,
  policyVersion:event.policyVersion,sourceReceiptHash:event.sourceReceiptHash,
  correlationId:event.correlationId,revokedAt:event.revokedAt,status:'blocked'});
 for(const [k,v] of Object.entries({consumerId:'urai-jobs',eventType:'consent.revoked.v2',
  eventId,ownerUid:uid,purpose:event.purpose,policyVersion:event.policyVersion,
  sourceReceiptHash:event.sourceReceiptHash,correlationId:event.correlationId,
  revokedAt:event.revokedAt,status:'blocked',integrityHash:expectedHash,
  privateOutputDeletionAcknowledged:false,storageWriteFenceVerified:false,
  derivativeInvalidationStatus:'STORAGE_WRITE_FENCE_UNVERIFIED'})) assert.equal(ack[k],v,k);
 const receipt=await jobDoc('jobConsentEventReceipts',sha(eventId));
 assert.equal(receipt?.integrityHash?.stringValue,expectedHash);
 const block=await jobDoc('jobConsentBlocks',sha(uid+'\n'+event.purpose));
 assert.equal(block?.active?.booleanValue,true);assert.equal(block?.ownerUid?.stringValue,uid);
 assert.equal(block?.eventId?.stringValue,eventId);
 pass('real_jobs_handler_commits_block_and_receipt_but_not_deletion');
 const repeated=await post(event);assert.equal(repeated.status,200);
 assert.equal(repeated.body.acknowledgement.integrityHash,expectedHash);
 pass('jobs_exact_replay_idempotent');
 assert.equal((await post({...event,sourceReceiptHash:'a'.repeat(64)})).status,409);
 pass('jobs_same_event_conflicting_receipt_rejected');
 const detailHash=hash({scope:'JOBS_CONSENT_BLOCK_ONLY_NOT_PRIVATE_DELETION',
  eventId,jobsReceiptHash:expectedHash,privateOutputDeletionAcknowledged:false,storageWriteFenceVerified:false});
 const payload={eventId,consumerId:'urai-jobs',status:'applied',correlationId:event.correlationId,detailHash};
 await assert.rejects(()=>call(stranger,'acknowledgeConsentRevocation',payload),e=>e.code==='functions/permission-denied');
 const result=await call(jobs,'acknowledgeConsentRevocation',payload);
 assert.equal(result.idempotent,false);assert.equal(result.status,'applied');
 const privAck=(await ref.collection('acknowledgements').doc('urai-jobs').get()).data();
 assert.equal(privAck.detailHash,detailHash);assert.equal(privAck.actorUid,jobsUid);
 assert.equal((await call(jobs,'acknowledgeConsentRevocation',payload)).idempotent,true);
 await assert.rejects(()=>call(jobs,'acknowledgeConsentRevocation',{...payload,detailHash:'f'.repeat(64)}),e=>e.code==='functions/already-exists');
 pass('real_privacy_callable_ack_authenticated_and_immutable');
 console.log('R1586_RESULT '+JSON.stringify({checks:passes.length,privacySha:PSHA,jobsSha:JSHA,
  actualJobsHandler:true,actualPrivacyAck:true,syntheticOnly:true,privateDeletionCertified:false,
  cloudIamCertified:false,productionReady:false}));
}
const timer=setTimeout(()=>{console.error('R1586_TIMEOUT');process.exit(90)},170000);timer.unref();
main().catch(e=>{console.error('R1586_FAIL',e.name,e.message);process.exitCode=1}).finally(async()=>{
 clearTimeout(timer);await Promise.allSettled(apps.map(deleteApp));if(admin)await deleteAdminApp(admin);
});
