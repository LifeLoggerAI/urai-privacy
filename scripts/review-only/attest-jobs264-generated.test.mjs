import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  JOBS264_EMULATOR_IMPORTS, captureJobs264GeneratedManifest,
  assertJobs264GeneratedManifest,
} from './attest-jobs264-generated.mjs';

function fixture(run) {
  const root=mkdtempSync(join(tmpdir(),'urai-r580-jobs264-manifest-'));
  const lib=join(root,'functions','lib');
  try {
    for(const file of JOBS264_EMULATOR_IMPORTS){
      const dest=join(lib,file);
      mkdirSync(dirname(dest),{recursive:true});
      writeFileSync(dest,'exports.proof = '+JSON.stringify(file)+';\n');
    }
    return run({root,lib});
  } finally {rmSync(root,{recursive:true,force:true});}
}
const digest=text=>createHash('sha256').update(text).digest('hex');

test('R580 requires four distinct original compiled contract modules',()=>{
  assert.equal(JOBS264_EMULATOR_IMPORTS.length,4);
  assert.equal(new Set(JOBS264_EMULATOR_IMPORTS).size,4);
});
test('R580 synthetic manifest can be verified against unchanged source and fixed digest',()=>fixture(({root})=>{
  const original=captureJobs264GeneratedManifest(root),meta=JSON.parse(original.manifest);
  assert.equal(original.digest.length,64);
  assert.equal(meta.schemaVersion,'urai-jobs264-generated-tree-review-v2');
  assert.equal(meta.treeCount,4);
  assert.equal(meta.files.length,4);
  assert.equal(assertJobs264GeneratedManifest({directory:root,manifest:original.manifest,digest:original.digest}),true);
}));
test('R580 forged digest and mutated compiled import fail closed',()=>fixture(({root,lib})=>{
  const first=captureJobs264GeneratedManifest(root);
  assert.throws(()=>assertJobs264GeneratedManifest({directory:root,manifest:first.manifest,digest:'0'.repeat(64)}),/ARTIFACT_MANIFEST_DIGEST_MISMATCH/);
  writeFileSync(join(lib,JOBS264_EMULATOR_IMPORTS[0]),'exports.proof = "changed";\n');
  assert.throws(()=>assertJobs264GeneratedManifest({directory:root,manifest:first.manifest,digest:first.digest}),/JOBS_COMPILED_ARTIFACT_DRIFT/);
}));
test('R580 old schema and absent independent digest are rejected',()=>fixture(({root})=>{
  const first=captureJobs264GeneratedManifest(root);
  assert.throws(()=>assertJobs264GeneratedManifest({directory:root,manifest:first.manifest,digest:undefined}),/ARTIFACT_EXPECTED_DIGEST_REQUIRED/);
  const old=JSON.stringify({...JSON.parse(first.manifest),schemaVersion:'urai-jobs261-generated-tree-review-v2'});
  assert.throws(()=>assertJobs264GeneratedManifest({directory:root,manifest:old,digest:digest(old)}),/ARTIFACT_MANIFEST_VERSION_MISMATCH/);
}));
test('R580 non-disposable root and missing compiled import are rejected',()=>fixture(({root,lib})=>{
  assert.throws(()=>captureJobs264GeneratedManifest('/'),/ARTIFACT_DISPOSABLE_ROOT_REQUIRED/);
  writeFileSync(join(lib,JOBS264_EMULATOR_IMPORTS[0]),'');
  assert.throws(()=>captureJobs264GeneratedManifest(root),/ARTIFACT_IMPORT_NOT_FOUND/);
}));
