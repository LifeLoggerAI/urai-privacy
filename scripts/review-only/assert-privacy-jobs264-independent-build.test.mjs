import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EXACT_JOBS_SHA,EXACT_JOBS_TREE,PINNED_BLOBS} from './assert-privacy-jobs264-checkout.mjs';
import {
 R580_REVIEWED_JOBS264_MANIFEST_SHA256,
 R580_REVIEWED_JOBS264_TREE_SHA256,
 R580_REVIEWED_JOBS264_FILE_COUNT,
 R580_REVIEWED_JOBS264_TREE_BYTES,
 assertR583ReviewedPrivacyJobs264IndependentBuild
} from './assert-privacy-jobs264-independent-build.mjs';
const makeGit=(root)=>(command,args)=>{
 assert.equal(command,'git');assert.deepEqual(args.slice(0,2),['-C',root]);
 const k=args.slice(2).join(' ');
 const vals={'rev-parse --show-toplevel':root,'rev-parse --abbrev-ref HEAD':'HEAD',
 'rev-parse HEAD':EXACT_JOBS_SHA,'rev-parse HEAD^{tree}':EXACT_JOBS_TREE,
 'status --porcelain=v1 --untracked-files=no':''};
 for(const [path,sha] of Object.entries(PINNED_BLOBS))vals['hash-object -- '+path]=sha;
 if(!Object.hasOwn(vals,k))throw Error('UNEXPECTED_GIT '+k);
 return vals[k]+'\n';
};
test('R583 independent two-host Jobs264 artifact fingerprints are immutable and separate from R575 schema',()=>{
 assert.equal(R580_REVIEWED_JOBS264_MANIFEST_SHA256,'82cb12511af2e1d800819e2ed73222cefabee43798d4ff3d60277f65656f4ba0');
 assert.equal(R580_REVIEWED_JOBS264_TREE_SHA256,'c7280667ade99c531a275b22cdd21fa39c058c18599e3137de35025825e36278');
 assert.equal(R580_REVIEWED_JOBS264_FILE_COUNT,70);
 assert.equal(R580_REVIEWED_JOBS264_TREE_BYTES,455148);
 assert.equal(Object.keys(PINNED_BLOBS).length,10);
});
test('R583 no fabricated digest can be promoted through independent review gate',()=>{
 const root=mkdtempSync(join(tmpdir(),'urai-r583-dual-'));
 try{
 const a={directory:root,declaredSha:EXACT_JOBS_SHA,generatedManifest:JSON.stringify({treeSha256:R580_REVIEWED_JOBS264_TREE_SHA256,treeCount:70,treeBytes:455148,files:[]}),expectedGeneratedDigest:'0'.repeat(64)};
 assert.throws(()=>assertR583ReviewedPrivacyJobs264IndependentBuild(a,makeGit(root)),/JOBS264_INDEPENDENT_BUILD_DIGEST_MISMATCH/);
 assert.throws(()=>assertR583ReviewedPrivacyJobs264IndependentBuild({...a,expectedGeneratedDigest:R580_REVIEWED_JOBS264_MANIFEST_SHA256},makeGit(root)),/ARTIFACT_MANIFEST/);
 assert.throws(()=>assertR583ReviewedPrivacyJobs264IndependentBuild({...a,declaredSha:'b7a498e543160e64748a0679469a1fc1550acb3b'},makeGit(root)),/R581_JOBS264_SHA_NOT_REVIEWED/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
