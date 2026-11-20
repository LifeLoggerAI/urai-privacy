'use strict';
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {initializeApp,deleteApp}=require(require.resolve('firebase-admin/app',{paths:[require('node:path').join(__dirname,'../../functions')]}));
const {getAuth}=require(require.resolve('firebase-admin/auth',{paths:[require('node:path').join(__dirname,'../../functions')]}));
const {getFirestore}=require(require.resolve('firebase-admin/firestore',{paths:[require('node:path').join(__dirname,'../../functions')]}));
const {collectDeletionCompletionResiduals,deletionCompletionBlockReason}=require('../../functions/lib/deletion-completion-verifier.js');
const project='urai-privacy-r1512-disposable';
assert.equal(process.env.GCLOUD_PROJECT,project);
for(const name of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','RUNPOD_API_KEY','VERCEL_TOKEN'])assert.ok(!process.env[name],name);
for(const [name,value] of [['FIREBASE_AUTH_EMULATOR_HOST','127.0.0.1:19099'],['FIRESTORE_EMULATOR_HOST','127.0.0.1:18080'],['FIREBASE_STORAGE_EMULATOR_HOST','127.0.0.1:19199']])assert.equal(process.env[name],value);
const app=initializeApp({projectId:project,storageBucket:project+'.appspot.com'});
(async()=>{
 const uid='r1616-completion-'+randomBytes(7).toString('hex');
 const db=getFirestore(app),auth=getAuth(app),checks=[];
 try{
  let result=await collectDeletionCompletionResiduals(uid);
  assert.equal(result.totalResidualTargets,0);checks.push('empty-owner-zero-residual');
  await db.collection('exportProcessingLeases').doc(uid).set({uid,exportProcessingJobId:'stale-r1616',exportProcessingLeaseExpiresAt:new Date(1)});
  result=await collectDeletionCompletionResiduals(uid);
  assert.deepEqual(result.firestoreTargets.exportProcessingLeases,[uid]);
  assert.equal(result.totalResidualTargets,1);checks.push('stale-lease-counted-in-final-scan');
  assert.equal(deletionCompletionBlockReason(result)?.code,'failed-precondition');
  checks.push('stale-lease-blocks-final-completion');
  await auth.createUser({uid});
  result=await collectDeletionCompletionResiduals(uid);
  assert.equal(result.totalResidualTargets,2);checks.push('lease-and-auth-both-counted');
  await auth.deleteUser(uid);
  await db.collection('exportProcessingLeases').doc(uid).delete();
  result=await collectDeletionCompletionResiduals(uid);
  assert.equal(result.totalResidualTargets,0);
  assert.equal(deletionCompletionBlockReason(result),null);
  checks.push('clean-owner-no-residual-block');
  console.log('R1616_DELETION_COMPLETION_REGISTRY_NATIVE_PASS '+JSON.stringify({checksPassed:checks.length,checks,productionWrites:false,globalDeletionCertified:false}));
 }finally{
  await db.collection('exportProcessingLeases').doc(uid).delete();
  try{await auth.deleteUser(uid)}catch(e){if(e.code!=='auth/user-not-found')throw e;}
 }
})().catch(e=>{console.error('R1616_NATIVE_FAIL',e.stack||e);process.exitCode=1}).finally(async()=>await deleteApp(app));
