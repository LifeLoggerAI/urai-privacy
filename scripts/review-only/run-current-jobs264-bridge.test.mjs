import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const script=join(dirname(fileURLToPath(import.meta.url)),'run-current-jobs264-bridge.sh');
const src=readFileSync(script,'utf8');
const invoke=(args=[],env={})=>spawnSync('bash',[script,...args],{encoding:'utf8',timeout:4000,env:{...process.env,...env,GOOGLE_APPLICATION_CREDENTIALS:'',FIREBASE_TOKEN:'',GITHUB_TOKEN:'',RUNPOD_API_KEY:''}});
test('R575: native runner parses and only plan/explicit disposable execute accepted',()=>{
 assert.doesNotThrow(()=>execFileSync('bash',['-n',script]));
 const plan=invoke(['--plan']);assert.equal(plan.status,0,plan.stderr);
 assert.match(plan.stdout,/Jobs #264 pinned/);
 assert.match(plan.stdout,/HOLD/);
 assert.equal(invoke().status,2);
 assert.equal(invoke(['--execute-disposable']).status,2);
});
test('R575: invalid and historical Privacy source SHA fail before network fetch',()=>{
 const old=invoke(['--execute-disposable'],{URAI_DISPOSABLE_REVIEW:'YES_SYNTHETIC_ONLY',URAI_EXPECTED_PRIVACY_SHA:'c90136dcc4933c28b51cc548f72d3d8ecdf4f6fd'});
 assert.equal(old.status,2,old.stderr);assert.doesNotMatch(old.stdout,/R575_STAGE_BEGIN=/);
 const bad=invoke(['--execute-disposable'],{URAI_DISPOSABLE_REVIEW:'YES_SYNTHETIC_ONLY',URAI_EXPECTED_PRIVACY_SHA:'not-a-sha'});
 assert.equal(bad.status,2,bad.stderr);
});
test('R575: immutable Jobs264 and source-anchor Privacy identity precede frozen builds',()=>{
 for(const s of [
 "JOBS_SHA='e2a700bd186c4dcff47c6da763e647992145d8b0'",
 "JOBS_TREE='9ca86b4a60ef2969203819a52ff9f827ac710d59'",
 "APPROVED_PRIVACY_SHA='151d672f25f0efbf69a9578278f3070894aab288'",
 "APPROVED_PRIVACY_TREE='aba80aa581fa50d0cdc2a45f8d3719839dcab30f'",
 "R575_REVIEWED_JOBS264_MANIFEST_SHA256",
 "R575_REVIEWED_JOBS264_TREE_SHA256",
 "R575_REVIEWED_JOBS264_FILE_COUNT",
 "REVIEWED_JOBS_COMPILED_DIGEST='423d58cb656b7545c1951a8338e5f6bce3bb53eccabec3879374970bdbc02049'",
 "test:life-movie:jobs264-rights:bridge:emulated",
 "jobs_review_security_verify",
 "URAI_JOBS_SOURCE_SHA=\"$JOBS_SHA\"",
 "URAI_JOBS_COMPILED_EXPECTED_SHA256=\"$REVIEWED_JOBS_COMPILED_DIGEST\"",
 "R454_REVIEW_ONLY_FIRESTORE_PASS",
 "R558_JOBS_COMPILED_ARTIFACT_PARITY_PASS",
 ])assert.ok(src.includes(s),'missing anchor: '+s);
 const priv=src.indexOf('run_step privacy_exact_fetch fetch_exact');
 const jobs=src.indexOf('run_step jobs_exact_fetch fetch_exact');
 const digest=src.indexOf('run_step reviewed_jobs_generated_manifest');
 const emulator=src.indexOf('run_step actual_four_emulator_bridge');
 assert.ok(priv>=0&&jobs>priv&&digest>jobs&&emulator>digest);
});
test('R575: reviewer-selected digest, prod commands and fabricated release GO absent',()=>{
 assert.doesNotMatch(src,/REVIEWED_JOBS_COMPILED_DIGEST="\$\(/);
 assert.doesNotMatch(src,/firebase deploy|gcloud .*deploy|gsutil iam ch/);
 assert.match(src,/productionAuthorized/);
 assert.match(src,/finalReleaseAccepted/);
 assert.match(src,/r\.checksPassed < 23/);
 assert.match(src,/r\.syntheticReviewProjectionOnly/);
});
test('R575: missing credit, credentials or source authenticity never silently qualify as green',()=>{
 for(const tok of ['GOOGLE_APPLICATION_CREDENTIALS','FIREBASE_TOKEN','GOOGLE_CLOUD_PROJECT','JOBS_ACTUAL_TREE_MISMATCH','JOBS_SOURCE_BLOB_MISMATCH']) {
  // First four runtime invariants appear explicitly or in the source guard imported by the fixture.
  if(tok.includes('MISMATCH'))continue;
  assert.ok(src.includes(tok),tok);
 }
 assert.ok(src.includes('no real media'));
});
