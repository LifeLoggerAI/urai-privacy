import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertJobs272ReviewSource, JOBS264_BASE_SHA, JOBS272_REVIEW_SHA,
  JOBS272_REVIEW_TREE, JOBS272_EXPECTED_COMMITS,
  UNCHANGED_PRODUCTION_BLOBS, REVIEW_DIFF_BLOBS,
} from './assert-privacy-jobs272-source-lineage.mjs';

const paths = Object.keys(REVIEW_DIFF_BLOBS).sort();
function fixture(mutator = () => {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'urai-r647-jobs272-')));
  const state = {
    sha: JOBS272_REVIEW_SHA,
    tree: JOBS272_REVIEW_TREE,
    status: '',
    detached: true,
    ancestor: true,
    count: String(JOBS272_EXPECTED_COMMITS),
    diff: [...paths],
    blobs: { ...UNCHANGED_PRODUCTION_BLOBS, ...REVIEW_DIFF_BLOBS },
  };
  mutator(state);
  const git = (cmd, args) => {
    assert.equal(cmd, 'git');
    assert.deepEqual(args.slice(0,2), ['-C', root]);
    const call = args.slice(2);
    switch (call.join(' ')) {
      case 'rev-parse --show-toplevel': return root+'\n';
      case 'rev-parse --abbrev-ref HEAD': return (state.detached ? 'HEAD' : 'main')+'\n';
      case 'rev-parse HEAD': return state.sha+'\n';
      case 'rev-parse HEAD^{tree}': return state.tree+'\n';
      case 'status --porcelain=v1 --untracked-files=no': return state.status;
      case `merge-base --is-ancestor ${JOBS264_BASE_SHA} ${JOBS272_REVIEW_SHA}`:
        if (!state.ancestor) throw Error('ancestor not found');
        return '';
      case `rev-list --count ${JOBS264_BASE_SHA}..${JOBS272_REVIEW_SHA}`: return state.count+'\n';
      case `diff --name-only ${JOBS264_BASE_SHA} ${JOBS272_REVIEW_SHA} --`: return state.diff.join('\n')+'\n';
      default:
        if (call[0]==='hash-object' && call[1]==='--') return (state.blobs[call[2]] ?? '')+'\n';
        throw Error('UNKNOWN_GIT_INVOCATION:'+call.join(' '));
    }
  };
  return {root,state,git,verify:(sha=JOBS272_REVIEW_SHA)=>assertJobs272ReviewSource({directory:root,declaredSha:sha},git),close:()=>rmSync(root,{recursive:true,force:true})};
}
function reject(name,mutate,error) {
  test(name,()=>{const f=fixture(mutate);try{assert.throws(()=>f.verify(),error);}finally{f.close();}});
}

test('R647 reviews exactly the existing Jobs264->Jobs272 identity, 9 changes and 17 source blobs',()=>{
  assert.equal(JOBS264_BASE_SHA,'e2a700bd186c4dcff47c6da763e647992145d8b0');
  assert.equal(JOBS272_REVIEW_SHA,'ee548bc15d059ec98f2d8bddb004f5ec0df0a5b8');
  assert.equal(JOBS272_REVIEW_TREE,'74c0c8ca5d3ce19827ed5c563ae83faabc4c900e');
  assert.equal(JOBS272_EXPECTED_COMMITS,9);
  assert.equal(Object.keys(UNCHANGED_PRODUCTION_BLOBS).length,8);
  assert.equal(Object.keys(REVIEW_DIFF_BLOBS).length,9);
  assert.ok(!paths.some(path=>path.startsWith('workers/') || path.startsWith('functions/')));
});
test('R647 accepts only independently pinned source lineage, without promoting prior compiled proof',()=>{
  const f=fixture();try{
    const decision=f.verify();
    assert.equal(decision.sourceLineageVerified,true);
    assert.equal(decision.unchangedProductionSourcesVerified,true);
    for (const key of ['generatedModulesVerified','privacyFourEmulatorsVerified','liveEffectiveStorageIamVerified','deletionAckPermitted','productionAuthorized','releaseGo']) {
      assert.equal(decision[key],false,key);
    }
    assert.ok(Object.isFrozen(decision));
  }finally{f.close();}
});
reject('R647 rejects an unreviewed head SHA',s=>{s.sha=JOBS264_BASE_SHA;},/JOBS272_ACTUAL_HEAD_MISMATCH/);
reject('R647 rejects a mismatched Git tree',s=>{s.tree='0'.repeat(40);},/JOBS272_TREE_MISMATCH/);
reject('R647 rejects an attached mutable branch',s=>{s.detached=false;},/JOBS272_CHECKOUT_NOT_DETACHED/);
reject('R647 rejects modified tracked checkout',s=>{s.status=' M package-lock.json\n';},/JOBS272_TRACKED_SOURCE_DIRTY/);
reject('R647 rejects an unproven Jobs264 ancestor',s=>{s.ancestor=false;},/JOBS272_ANCESTRY_NOT_VERIFIED/);
reject('R647 rejects an unexpected commit count',s=>{s.count='8';},/JOBS272_UNEXPECTED_HISTORY/);
reject('R647 rejects extra runtime files in upstream diff',s=>{s.diff.push('workers/studio-worker/index.js');},/JOBS272_UNREVIEWED_PATH_CHANGE/);
reject('R647 rejects missing reviewed changes',s=>{s.diff.pop();},/JOBS272_UNREVIEWED_PATH_CHANGE/);
reject('R647 rejects a changed private worker authorization module',s=>{s.blobs['workers/studio-worker/private-output-write-authority.js']='0'.repeat(40);},/JOBS272_BLOB_MISMATCH/);
reject('R647 rejects a changed derivative revocation module',s=>{s.blobs['functions/src/privacy/lifeMovieDerivativeRevocation.ts']='0'.repeat(40);},/JOBS272_BLOB_MISMATCH/);
reject('R647 rejects altered writer-fence model source',s=>{s.blobs['scripts/review-only/life-movie-writer-fence-model.mjs']='0'.repeat(40);},/JOBS272_BLOB_MISMATCH/);
reject('R647 rejects drifted frozen lockfile',s=>{s.blobs['package-lock.json']='0'.repeat(40);},/JOBS272_BLOB_MISMATCH/);
reject('R647 rejects changed Jobs review-only IAM evidence collector',s=>{s.blobs['scripts/review-only/capture-studio-storage-iam-evidence.mjs']='0'.repeat(40);},/JOBS272_BLOB_MISMATCH/);

test('R647 refuses a caller-declared old Jobs #264 SHA',()=>{
  const f=fixture();try{assert.throws(()=>f.verify(JOBS264_BASE_SHA),/JOBS272_DECLARED_SHA_NOT_REVIEWED/);}finally{f.close();}
});
test('R647 all 17 anchored blob checks fail closed individually',()=>{
  const anchored={...UNCHANGED_PRODUCTION_BLOBS,...REVIEW_DIFF_BLOBS};
  for(const path of Object.keys(anchored)){
    const f=fixture(s=>{s.blobs[path]='f'.repeat(40);});
    try{assert.throws(()=>f.verify(),/JOBS272_BLOB_MISMATCH/);}finally{f.close();}
  }
});
