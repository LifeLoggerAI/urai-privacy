'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http');
const {createHash,randomBytes}=require('node:crypto'),{createRequire}=require('node:module');
const root=path.resolve(process.env.URAI_PRIVACY_RUNTIME_ROOT||path.join(__dirname,'..')),sourceRequire=createRequire(path.join(root,'functions/package.json'));
for(const k of ['FIRESTORE_EMULATOR_HOST','FIREBASE_AUTH_EMULATOR_HOST','FIREBASE_STORAGE_EMULATOR_HOST'])assert.match(process.env[k]||'',/^127\.0\.0\.1:\d+$/);
const project=process.env.GCLOUD_PROJECT;assert.equal(project,'demo-urai-privacy-execution');process.env.FIREBASE_CONFIG=JSON.stringify({projectId:project,storageBucket:project+'.appspot.com'});process.env.FUNCTIONS_EMULATOR='true';
const functions=require(path.join(root,'functions/lib/functions-entry.js'));
const {getAuth}=sourceRequire('firebase-admin/auth'),{getFirestore}=sourceRequire('firebase-admin/firestore'),{getStorage}=sourceRequire('firebase-admin/storage'),express=sourceRequire('express');
const auth=getAuth(),db=getFirestore(),bucket=getStorage().bucket(),results=[];
async function caseRun(name,fn){try{results.push({name,result:'PASS',detail:await fn()});}catch(e){results.push({name,result:'FAIL',message:e.message,code:e.code||null});}}
async function actor(tag,admin=false){
 const uid='synthetic-'+tag+'-'+randomBytes(4).toString('hex'),password=randomBytes(18).toString('hex');const user=await auth.createUser({uid,email:uid+'@example.invalid',password});if(admin)await auth.setCustomUserClaims(uid,{admin:true});
 const response=await fetch('http://'+process.env.FIREBASE_AUTH_EMULATOR_HOST+'/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic-only',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:user.email,password,returnSecureToken:true})});assert.equal(response.status,200);const {idToken}=await response.json(),token=await auth.verifyIdToken(idToken,true);await db.doc('users/'+uid).set({uid,displayName:'Fictional source fixture'});return {uid,idToken,token};
}
function request(actor,data){return {auth:{uid:actor.uid,token:actor.token},data,rawRequest:{aborted:false,get:name=>name.toLowerCase()==='authorization'?'Bearer '+actor.idToken:name.toLowerCase()==='host'?'127.0.0.1:19001':undefined}};}
async function granted(owner){return functions.setCanonicalConsent.run(request(owner,{purpose:'data.export',status:'granted',expiresAt:new Date(Date.now()+3600000).toISOString(),surface:'isolated-emulator-proof'}));}
async function prepared(owner,admin){await granted(owner);const created=await functions.createExportRequest.run(request(owner,{})),jobId=created.exportJobId;assert.ok(jobId);await functions.processExportRequest.run(request(admin,{jobId}));return {jobId};}
async function url(owner,jobId){return functions.getExportDownloadUrl.run(request(owner,{jobId}));}
const app=express();app.use((req,res)=>functions.downloadExportPackage(req,res));const server=http.createServer(app);
async function main(){
 await new Promise((resolve,reject)=>server.listen(19001,'127.0.0.1',resolve).once('error',reject));
 await caseRun('large actual SDK export contains all 1001 owner rows and excludes foreign rows',async()=>{
  const owner=await actor('large'),admin=await actor('large-admin',true),other=await actor('foreign');
  for(let start=0;start<1001;start+=400){const batch=db.batch();for(let i=start;i<Math.min(1001,start+400);i++)batch.set(db.doc('dataAccessEvents/'+owner.uid+'-'+String(i).padStart(4,'0')),{uid:owner.uid,event:'fictional-'+i,payload:'x'.repeat(800)});await batch.commit();}
  await db.doc('dataAccessEvents/'+other.uid).set({uid:other.uid,event:'foreign-keep'});const {jobId}=await prepared(owner,admin),descriptor=await url(owner,jobId),delivered=await fetch(descriptor.url,{headers:{authorization:'Bearer '+owner.idToken}});assert.equal(delivered.status,200);assert.equal(delivered.headers.get('cache-control'),'private, no-store');const bytes=Buffer.from(await delivered.arrayBuffer()),exported=JSON.parse(bytes);assert.equal(exported.data.dataAccessEvents.length,1001);assert.ok(exported.data.dataAccessEvents.every(r=>r.uid===owner.uid));const job=(await db.doc('exportJobs/'+jobId).get()).data();assert.equal(createHash('sha256').update(bytes).digest('hex'),job.exportSha256);assert.equal((await fetch(descriptor.url,{headers:{authorization:'Bearer '+other.idToken}})).status,403);await functions.setCanonicalConsent.run(request(owner,{purpose:'data.export',status:'revoked',surface:'isolated-emulator-proof'}));assert.equal((await fetch(descriptor.url,{headers:{authorization:'Bearer '+owner.idToken}})).status,409);return {records:1001,bytes:bytes.length,sha256:job.exportSha256,foreignStatus:403,withdrawnStatus:409,cloud:false};
 });
 await caseRun('removed current admin claims refuse actual private HTTP bytes despite an older signed token',async()=>{
  const owner=await actor('http-owner'),admin=await actor('http-admin',true),{jobId}=await prepared(owner,admin),descriptor=await url(admin,jobId);await auth.setCustomUserClaims(admin.uid,{});const old=await auth.verifyIdToken(admin.idToken,true);assert.equal(old.admin,true);assert.deepEqual((await auth.getUser(admin.uid)).customClaims,{});const reply=await fetch(descriptor.url,{headers:{authorization:'Bearer '+admin.idToken}});assert.equal(reply.status,403,'removed current admin role must stop actual bytes');return {status:reply.status};
 });
 await caseRun('disabled authentic owner cannot mint an export descriptor from cached callable auth',async()=>{
  const owner=await actor('descriptor-owner'),admin=await actor('descriptor-admin',true),{jobId}=await prepared(owner,admin);await auth.updateUser(owner.uid,{disabled:true});await assert.rejects(url(owner,jobId),e=>['unauthenticated','permission-denied'].includes(e.code));return {descriptorIssued:false};
 });
 await caseRun('removed authentic admin cannot process export with cached callable claims',async()=>{
  const owner=await actor('process-owner'),admin=await actor('process-admin',true);await granted(owner);const {exportJobId:jobId}=await functions.createExportRequest.run(request(owner,{}));await auth.setCustomUserClaims(admin.uid,{});await assert.rejects(functions.processExportRequest.run(request(admin,{jobId})),e=>['unauthenticated','permission-denied'].includes(e.code));const job=(await db.doc('exportJobs/'+jobId).get()).data();assert.notEqual(job.status,'completed');return {published:false};
 });
 await caseRun('actual consent withdrawal during source page prevents any new artifact write',async()=>{
  const owner=await actor('page-owner'),admin=await actor('page-admin',true);await granted(owner);const {exportJobId:jobId}=await functions.createExportRequest.run(request(owner,{}));await db.doc('dataAccessEvents/'+owner.uid).set({uid:owner.uid,event:'fictional-page'});const {Query}=sourceRequire('@google-cloud/firestore'),{File}=sourceRequire('@google-cloud/storage'),original=Query.prototype.get,originalSave=File.prototype.save;let revoked=false,writes=0;
  Query.prototype.get=async function(...args){const page=await original.apply(this,args);if(!revoked&&page.docs.some(d=>d.ref.path==='dataAccessEvents/'+owner.uid)){revoked=true;await functions.setCanonicalConsent.run(request(owner,{purpose:'data.export',status:'revoked',surface:'isolated-emulator-proof'}));}return page;};File.prototype.save=async function(...args){if(this.name.startsWith('exports/'+owner.uid+'/'))writes++;return originalSave.apply(this,args);};
  try{await assert.rejects(functions.processExportRequest.run(request(admin,{jobId})));assert.ok(revoked);assert.equal(writes,0,'source authority loss must be checked before private artifact Storage writes');return {writes,revoked};}finally{Query.prototype.get=original;File.prototype.save=originalSave;}
 });
 console.log(JSON.stringify({schema:'urai-loaded-privacy-sdk-emulator-proof-v1',source:process.env.URAI_PRIVACY_SOURCE_SHA,node:process.version,transport:'actual SDK onCall.run with independently verified real emulator auth; actual SDK onRequest Express HTTP',synthetic:true,mirroredSDK:false,cloud:false,functionsEmulatorWorker:false,results},null,2));process.exitCode=results.some(r=>r.result==='FAIL')?1:0;
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await new Promise(resolve=>server.close(resolve));await db.terminate();});
