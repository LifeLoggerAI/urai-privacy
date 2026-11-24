'use strict';
// R1515: isolated positive export execution with emulator-issued admin claims.
// Never run with hosted credentials or outside the disposable emulator project.
// This is *not* workload identity / external IAM approval.
const assert=require('node:assert/strict');
const {randomBytes,createHash}=require('node:crypto');
const {initializeApp,deleteApp}=require('firebase/app');
const {getAuth:clientAuth,connectAuthEmulator,createUserWithEmailAndPassword,signInWithEmailAndPassword,getIdToken}=require('firebase/auth');
const {getFunctions,connectFunctionsEmulator,httpsCallable}=require('firebase/functions');
const {initializeApp:adminApp,deleteApp:deleteAdminApp}=require('firebase-admin/app');
const {getAuth:adminAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const {getStorage}=require('firebase-admin/storage');
const {signedExportObjectGeneration}=require('../../functions/lib/export-lifecycle-contract.js');

const project='urai-privacy-r1512-disposable';
assert.equal(process.env.GCLOUD_PROJECT,project);
for(const name of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','RUNPOD_API_KEY','VERCEL_TOKEN'])assert.ok(!process.env[name],name);
for(const [name,value] of [['FIREBASE_AUTH_EMULATOR_HOST','127.0.0.1:29099'],['FIRESTORE_EMULATOR_HOST','127.0.0.1:28080'],['FIREBASE_STORAGE_EMULATOR_HOST','127.0.0.1:29199']])assert.equal(process.env[name],value);
const prefix='r1515_'+randomBytes(6).toString('hex');
const clients=[],checks=[];
const deadline=setTimeout(()=>{console.error('R1515_TIMEOUT');process.exit(2)},135000);
deadline.unref();
function client(label){
 const app=initializeApp({apiKey:'disposable-emulator-only',projectId:project,appId:'1:123:web:emulator'},prefix+label);
 clients.push(app);
 const auth=clientAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:29099',{disableWarnings:true});
 const functions=getFunctions(app,'us-central1');connectFunctionsEmulator(functions,'127.0.0.1',25001);
 return {auth,functions};
}
const call=async(who,name,data={})=>(await httpsCallable(who.functions,name,{timeout:90000})(data)).data;
(async()=>{
 const admin=adminApp({projectId:project,storageBucket:project+'.appspot.com'},prefix+'adminsdk');
 try{
  const db=getFirestore(admin),auth=adminAuth(admin),bucket=getStorage(admin).bucket();
  const owner=client('owner'),stranger=client('stranger'),operator=client('operator');
  const [a,b,o]=await Promise.all([owner,stranger,operator].map((who,i)=>createUserWithEmailAndPassword(who.auth,prefix+i+'@example.test','DisposableOnly123!')));
  assert.notEqual(a.user.uid,b.user.uid);
  checks.push('three-distinct-emulator-identities');
  await auth.setCustomUserClaims(o.user.uid,{admin:true});
  // Force reauthentication so actual Firebase client presents emulator-issued admin claim.
  await signInWithEmailAndPassword(operator.auth,prefix+'2@example.test','DisposableOnly123!');
  await getIdToken(operator.auth.currentUser,true);
  assert.equal((await operator.auth.currentUser.getIdTokenResult(true)).claims.admin,true);
  checks.push('emulator-admin-claim-bound-to-separate-operator');
  const record=db.collection('users').doc(a.user.uid);
  await record.set({uid:a.user.uid,displayName:'Disposable synthetic export owner',secretToken:'SYNTHETIC_MUST_NOT_EXPORT',memo:'R1515_SYNTHETIC_EXPORT_FIXTURE'});
  checks.push('seed-disposable-user-record');
  const currentC7 = status => call(owner, 'setCanonicalConsent', {purpose:'data.export',status,surface:'privacy-center-export',jurisdiction:'test'});
  await assert.rejects(call(owner,'createExportRequest'), error => error.code === 'functions/failed-precondition');
  const firstGrant = await currentC7('granted');
  const retired = await call(owner, 'createExportRequest');
  await currentC7('revoked');
  await assert.rejects(call(operator, 'processExportRequest',{jobId:retired.exportJobId}), error => error.code === 'functions/failed-precondition');
  const replacement = await currentC7('granted');
  assert.notEqual(replacement.receiptHash, firstGrant.receiptHash);
  await assert.rejects(call(operator, 'processExportRequest',{jobId:retired.exportJobId}), error => error.code === 'functions/failed-precondition');
  checks.push('absent-revoked-and-replaced-canonical-C7-cannot-produce-an-export');
  const request=await call(owner,'createExportRequest');
  assert.equal(request.status,'pending');
  checks.push('owner-request-pending');
  await assert.rejects(call(owner,'processExportRequest',{jobId:request.exportJobId}));
  checks.push('owner-admin-processing-denied');
  const processed=await call(operator,'processExportRequest',{jobId:request.exportJobId});
  assert.equal(processed.status,'completed');
  checks.push('separate-emulator-admin-processed-export');
  const job=(await db.collection('exportJobs').doc(request.exportJobId).get()).data();
  assert.equal(job.uid,a.user.uid);assert.equal(job.status,'completed');assert.equal(job.complete,true);
  assert.ok(job.exportPackagePath);assert.ok(job.exportManifestPath);
  const canonicalRequest=(await db.collection('privacyRequests').doc(request.requestId).get()).data();
  assert.equal(canonicalRequest.consentReceiptHash,replacement.receiptHash);
  assert.equal(job.consentReceiptHash,replacement.receiptHash);
  assert.equal(job.exportConsentExpiresAt,canonicalRequest.exportConsentExpiresAt);
  assert.equal(job.exportConsentExpiresAt,replacement.expiresAt);
  checks.push('completed-request-and-job-bind-the-exact-canonical-owner-grant-and-expiry');
  checks.push('completed-job-owner-and-paths');
  const [exportBytes,manifestBytes]=await Promise.all([
   bucket.file(job.exportPackagePath).download().then(x=>x[0]),
   bucket.file(job.exportManifestPath).download().then(x=>x[0])
  ]);
  const exported=JSON.parse(exportBytes.toString('utf8')),manifest=JSON.parse(manifestBytes.toString('utf8'));
  assert.equal(exported.uid,a.user.uid);
  assert.equal(exported.data.users[0].memo,'R1515_SYNTHETIC_EXPORT_FIXTURE');
  assert.ok(!JSON.stringify(exported).includes('SYNTHETIC_MUST_NOT_EXPORT'));
  assert.equal(createHash('sha256').update(exportBytes).digest('hex'),job.exportSha256);
  assert.equal(createHash('sha256').update(manifestBytes).digest('hex'),job.manifestSha256);
  checks.push('storage-export-manifest-hashes-and-redaction');
  const [exportMetadata,manifestMetadata]=await Promise.all([
    bucket.file(job.exportPackagePath).getMetadata().then(x=>x[0]),
    bucket.file(job.exportManifestPath).getMetadata().then(x=>x[0])
  ]);
  const exportGeneration=signedExportObjectGeneration(job,'export',exportMetadata);
  const manifestGeneration=signedExportObjectGeneration(job,'manifest',manifestMetadata);
  assert.match(exportGeneration,/^[1-9][0-9]*$/);
  assert.match(manifestGeneration,/^[1-9][0-9]*$/);
  checks.push('storage-generation-metadata-matches-committed-package-hashes');
  assert.equal(signedExportObjectGeneration(job,'export',{
    ...exportMetadata,metadata:{sha256:'0'.repeat(64)}
  }),null);
  assert.equal(signedExportObjectGeneration(job,'manifest',{
    ...manifestMetadata,generation:'0'
  }),null);
  checks.push('storage-mutated-digest-and-generation-fail-closed');
  await assert.rejects(call(stranger,'getExportDownloadUrl',{jobId:request.exportJobId,file:'export'}));
  checks.push('completed-export-foreign-download-denied');
  // Signing belongs to independently controlled hosted identity; never touch
  // metadata-server credentials from an emulator worker. Actual package bytes,
  // manifest, SHA256 and foreign denial were verified above.
  const staleBearer=await getIdToken(owner.auth.currentUser,true);
  await new Promise(resolve=>setTimeout(resolve,1650));
  await auth.revokeRefreshTokens(a.user.uid);
  await assert.rejects(auth.verifyIdToken(staleBearer,true));
  const revokedResponse=await fetch('http://127.0.0.1:25001/'+project+'/us-central1/getExportDownloadUrl',{
    method:'POST',headers:{authorization:'Bearer '+staleBearer,'content-type':'application/json'},
    body:JSON.stringify({data:{jobId:request.exportJobId,file:'export'}})
  });
  const revokedResult=await revokedResponse.json();
  // Callable middleware can reject the revoked ID before the handler runs.
  const denial = {401:'UNAUTHENTICATED', 403:'PERMISSION_DENIED'}[revokedResponse.status];
  assert.ok(denial, 'Revoked original bearer must be rejected');
  assert.equal(revokedResult.error?.status, denial);
  assert.equal(revokedResult.result, undefined);
  assert.ok(!JSON.stringify(revokedResult).includes('storage.googleapis.com'));
  checks.push('revoked-original-owner-bearer-is-denied-before-signing');
  const ownerUrl='not-attempted-no-trusted-signer';
  checks.push('signed-url-issuance-intentionally-held');
  assert.ok(checks.length>=9);
  console.log('R1683_NATIVE_EXPORT_REVOCATION_RESULT '+JSON.stringify({checksPassed:checks.length,checks,source:process.env.URAI_EXACT_SHA,ownerUrl,bytes:exportBytes.length,manifestBytes:manifestBytes.length,hostedSignerVerified:false,productionWrites:false,iamApproved:false,destructiveDeletionExecuted:false}));
 } finally {await deleteAdminApp(admin)}
})().catch(e=>{console.error('R1515_FAIL',e.stack||e);process.exitCode=1}).finally(async()=>{await Promise.all(clients.map(deleteApp));clearTimeout(deadline)});
