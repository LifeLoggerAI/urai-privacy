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

const project='urai-privacy-r1512-disposable';
assert.equal(process.env.GCLOUD_PROJECT,project);
for(const name of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','RUNPOD_API_KEY','VERCEL_TOKEN'])assert.ok(!process.env[name],name);
for(const [name,value] of [['FIREBASE_AUTH_EMULATOR_HOST','127.0.0.1:19099'],['FIRESTORE_EMULATOR_HOST','127.0.0.1:18080'],['FIREBASE_STORAGE_EMULATOR_HOST','127.0.0.1:19199']])assert.equal(process.env[name],value);
const prefix='r1604_'+randomBytes(6).toString('hex');
const clients=[],checks=[];
const deadline=setTimeout(()=>{console.error('R1515_TIMEOUT');process.exit(2)},135000);
deadline.unref();
function client(label){
 const app=initializeApp({apiKey:'disposable-emulator-only',projectId:project,appId:'1:123:web:emulator'},prefix+label);
 clients.push(app);
 const auth=clientAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:19099',{disableWarnings:true});
 const functions=getFunctions(app,'us-central1');connectFunctionsEmulator(functions,'127.0.0.1',15001);
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
  checks.push('completed-job-owner-and-paths');
  const phantomDeletion=(await db.collection('privacyDeletionTombstones').doc(a.user.uid).get());
  assert.equal(phantomDeletion.exists,false,'Export completion must not manufacture a deletion tombstone');
  checks.push('completed-export-leaves-no-owner-deletion-marker');
  const phantomAccount=(await db.collection('accountDeletionFences').doc(a.user.uid).get());
  assert.equal(phantomAccount.exists,false,'Export completion must not manufacture an account deletion fence');
  checks.push('completed-export-leaves-no-account-fence');
  const leaseSnapshot=(await db.collection('exportProcessingLeases').doc(a.user.uid).get());
  assert.ok(leaseSnapshot.exists,'Export must use a dedicated non-deletion lease');
  assert.equal(leaseSnapshot.data().exportProcessingJobId,undefined);
  assert.equal(leaseSnapshot.data().exportProcessingLeaseExpiresAt,undefined);
  checks.push('dedicated-export-lease-released-after-publication');
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
  await assert.rejects(call(stranger,'getExportDownloadUrl',{jobId:request.exportJobId,file:'export'}));
  checks.push('completed-export-foreign-download-denied');
  // Completed package must never issue a fresh URL after account deletion,
  // including when the marker payload is malformed or deceptively inactive.
  const ownerUid=a.user.uid;
  await db.collection('accountDeletionFences').doc(ownerUid).set({active:false,fixture:'r1604-synthetic'});
  for (const who of [owner,operator]) {
    await assert.rejects(call(who,'getExportDownloadUrl',{jobId:request.exportJobId,file:'export'}), e =>
      /failed-precondition/.test(String(e.code)) && /Owner deletion fence is present/.test(String(e.message)));
    checks.push(who===owner?'owner-deletion-fence-denies-completed-export':'admin-deletion-fence-denies-completed-export');
  }
  await db.collection('accountDeletionFences').doc(ownerUid).delete();
  await db.collection('privacyDeletionTombstones').doc(ownerUid).set({active:false,fixture:'r1604-synthetic'});
  await assert.rejects(call(owner,'getExportDownloadUrl',{jobId:request.exportJobId,file:'manifest'}), e =>
    /failed-precondition/.test(String(e.code)) && /Owner deletion fence is present/.test(String(e.message)));
  checks.push('inactive-tombstone-denies-manifest-url');
  await db.collection('privacyDeletionTombstones').doc(ownerUid).delete();
  // Even a previously valid admin claim cannot download for a disabled owner.
  await auth.updateUser(ownerUid,{disabled:true});
  await assert.rejects(call(operator,'getExportDownloadUrl',{jobId:request.exportJobId,file:'export'}),e=>
    /failed-precondition/.test(String(e.code)) && /Export owner account is disabled/.test(String(e.message)));
  checks.push('disabled-owner-denies-admin-download');
  // Signing belongs to independently controlled hosted identity; never touch
  // metadata-server credentials from an emulator worker. Actual package bytes,
  // manifest, SHA256 and foreign denial were verified above.
  const ownerUrl='not-attempted-no-trusted-signer';
  checks.push('signed-url-issuance-intentionally-held');
  assert.ok(checks.length>=9);
  console.log('R1606_EXPORT_LEASE_ISOLATION_EMULATOR_PASS '+JSON.stringify({checksPassed:checks.length,checks,source:process.env.URAI_EXACT_SHA,ownerUrl,bytes:exportBytes.length,manifestBytes:manifestBytes.length,hostedSignerVerified:false,productionWrites:false,iamApproved:false,destructiveDeletionExecuted:false}));
 } finally {await deleteAdminApp(admin)}
})().catch(e=>{console.error('R1515_FAIL',e.stack||e);process.exitCode=1}).finally(async()=>{await Promise.all(clients.map(deleteApp));clearTimeout(deadline)});
