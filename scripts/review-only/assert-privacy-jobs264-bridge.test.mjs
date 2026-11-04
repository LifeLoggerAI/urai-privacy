import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {EXACT_JOBS_SHA,EXACT_JOBS_TREE,PINNED_BLOBS,assertPrivacyJobs264Checkout} from './assert-privacy-jobs264-checkout.mjs';
import {R575_REVIEWED_JOBS264_TREE_SHA256,R575_REVIEWED_JOBS264_MANIFEST_SHA256,R575_REVIEWED_JOBS264_FILE_COUNT,assertR575ReviewedPrivacyJobs264BuildBridge} from './assert-privacy-jobs264-build-bridge.mjs';
const temp=()=>mkdtempSync(join(tmpdir(),'urai-r575-review-'));
const git=(root,overrides={})=>(command,args)=>{
 assert.equal(command,'git');
 assert.equal(args[0],'-C');assert.equal(args[1],root);
 const k=args.slice(2).join(' '),all={
 'rev-parse --show-toplevel':root,
 'rev-parse --abbrev-ref HEAD':'HEAD',
 'rev-parse HEAD':EXACT_JOBS_SHA,
 'rev-parse HEAD^{tree}':EXACT_JOBS_TREE,
 'status --porcelain=v1 --untracked-files=no':'',
 };
 for(const [path,sha] of Object.entries(PINNED_BLOBS))all['hash-object -- '+path]=sha;
 if(!Object.hasOwn({...all,...overrides},k))throw Error('UNEXPECTED_GIT '+k);
 return {...all,...overrides}[k]+'\n';
};
test('R575: Jobs264 source and two-host build anchors immutable',()=>{
 assert.equal(EXACT_JOBS_SHA,'e2a700bd186c4dcff47c6da763e647992145d8b0');
 assert.equal(EXACT_JOBS_TREE,'9ca86b4a60ef2969203819a52ff9f827ac710d59');
 assert.equal(R575_REVIEWED_JOBS264_TREE_SHA256,'c7280667ade99c531a275b22cdd21fa39c058c18599e3137de35025825e36278');
 assert.equal(R575_REVIEWED_JOBS264_MANIFEST_SHA256,'423d58cb656b7545c1951a8338e5f6bce3bb53eccabec3879374970bdbc02049');
 assert.equal(R575_REVIEWED_JOBS264_FILE_COUNT,70);
 assert.equal(PINNED_BLOBS['workers/studio-worker/private-output-write-authority.js'],'ea6b25f3949ec2c17f65a9da68fa9cf937e86e76');
 assert.equal(PINNED_BLOBS['scripts/review-only/life-movie-writer-fence-model.mjs'],'8e7e74b7f1dbe28b59b7f707a71e1f6b0d787933');
});
test('R575: known clean detached checkout accepts all source blobs',()=>{
 const root=temp();try{assert.equal(assertPrivacyJobs264Checkout({directory:root,declaredSha:EXACT_JOBS_SHA},git(root)),true);}finally{rmSync(root,{recursive:true,force:true});}
});
test('R575: stale commit, dirty checkout, wrong tree, attached branch and hard-off drift fail closed',()=>{
 const root=temp();try{
  const o={directory:root,declaredSha:EXACT_JOBS_SHA};
  assert.throws(()=>assertPrivacyJobs264Checkout({...o,declaredSha:'b7a498e543160e64748a0679469a1fc1550acb3b'},git(root)),/JOBS_DECLARED_SHA_MISMATCH/);
  assert.throws(()=>assertPrivacyJobs264Checkout(o,git(root,{'status --porcelain=v1 --untracked-files=no':' M package.json'})),/JOBS_TRACKED_WORKTREE_DIRTY/);
  assert.throws(()=>assertPrivacyJobs264Checkout(o,git(root,{'rev-parse HEAD^{tree}':'a'.repeat(40)})),/JOBS_ACTUAL_TREE_MISMATCH/);
  assert.throws(()=>assertPrivacyJobs264Checkout(o,git(root,{'rev-parse --abbrev-ref HEAD':'main'})),/JOBS_CHECKOUT_NOT_DETACHED/);
  assert.throws(()=>assertPrivacyJobs264Checkout(o,git(root,{'hash-object -- workers/studio-worker/private-output-write-authority.js':'b'.repeat(40)})),/JOBS_SOURCE_BLOB_MISMATCH/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('R575: forged caller manifest or arbitrary expected digest cannot pass review acceptance',()=>{
 const root=temp();try{
 const o={directory:root,declaredSha:EXACT_JOBS_SHA,generatedManifest:JSON.stringify({schemaVersion:'urai-jobs261-generated-tree-review-v2',treeSha256:R575_REVIEWED_JOBS264_TREE_SHA256,treeCount:70,files:[]}),expectedGeneratedDigest:'a'.repeat(64)};
 assert.throws(()=>assertR575ReviewedPrivacyJobs264BuildBridge(o,git(root)),/JOBS_INDEPENDENT_BUILD_DIGEST_MISMATCH/);
 assert.throws(()=>assertR575ReviewedPrivacyJobs264BuildBridge({...o,expectedGeneratedDigest:R575_REVIEWED_JOBS264_MANIFEST_SHA256},git(root)),/ARTIFACT_MANIFEST/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('R575: new emulator fixture source-binds Jobs264 before private module imports',()=>{
 const file=join(dirname(fileURLToPath(import.meta.url)),'../../tests/integration/life-movie-jobs264-rights-bridge.emulator.mjs');
 const s=readFileSync(file,'utf8');
 assert.match(s,/const EXACT_JOBS_SOURCE = "e2a700bd186c4dcff47c6da763e647992145d8b0"/);
 assert.match(s,/assertR575ReviewedPrivacyJobs264BuildBridge/);
 assert.match(s,/R558_JOBS_COMPILED_ARTIFACT_PARITY_PASS/);
 assert.match(s,/R454_REVIEW_ONLY_FIRESTORE_PASS/);
 assert.match(s,/productionAuthorized:false|productionAuthorized: false/);
 assert.doesNotMatch(s,/firebase deploy|gcloud .*deploy|gsutil iam/);
});
