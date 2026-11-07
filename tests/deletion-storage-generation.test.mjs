import test from 'node:test';
import assert from 'node:assert/strict';
import {
  approvedStorageGeneration,
  storageGenerationSubsetApproved
} from '../functions/src/deletion-storage-generation.ts';
const owner = 'owner-a';
const path = 'exports/owner-a/job-a/attempt-a/export.json';
const second = 'exports/owner-a/job-a/attempt-a/manifest.json';
const make = (files = [path], generations = ['900719925474099300001']) => ({
  storageObjects: files,
  storageObjectGenerations: Object.fromEntries(files.map((name, i) => [name, generations[i]]))
});
test('exact same approved generation survives without numeric precision loss', () => {
  const approved = make();
  assert.equal(approvedStorageGeneration(owner, path, approved, make()), '900719925474099300001');
  assert.equal(storageGenerationSubsetApproved(owner, approved, make()), true);
});
test('stale approved generation denies same-name replacement', () => {
  assert.equal(approvedStorageGeneration(owner, path, make(), make([path], ['900719925474099300002'])), null);
  assert.equal(storageGenerationSubsetApproved(owner, make(), make([path], ['900719925474099300002'])), false);
});
test('late new object cannot enter approved deletion plan', () => {
  assert.equal(storageGenerationSubsetApproved(owner, make(), make([path, second], ['900719925474099300001','7'])), false);
});
test('partial deletion may omit approved objects', () => {
  const approved = make([path, second], ['3','4']);
  assert.equal(storageGenerationSubsetApproved(owner, approved, make([second], ['4'])), true);
  assert.equal(storageGenerationSubsetApproved(owner, approved, make([], [])), true);
});
test('foreign owner and path traversal fail closed', () => {
  assert.equal(approvedStorageGeneration('owner-b', path, make(), make()), null);
  const traversal = 'exports/owner-a/../owner-b/job/export.json';
  const foreign = 'exports/owner-b/job/export.json';
  assert.equal(approvedStorageGeneration(owner, traversal, make([traversal],['1']), make([traversal],['1'])), null);
  assert.equal(approvedStorageGeneration(owner, foreign, make([foreign],['1']), make([foreign],['1'])), null);
});
test('missing, malformed and inherited generation values deny', () => {
  const approved = make([path], ['123']);
  const bad = [{}, {[path]: ''}, {[path]: 'abc'}, {[path]: -1}, Object.create({[path]: '123'})];
  for (const values of bad) {
    assert.equal(approvedStorageGeneration(owner, path, approved, {
      storageObjects: [path], storageObjectGenerations: values
    }), null);
  }
});
test('generation is rechecked against current plan, not only approved path list', () => {
  assert.equal(approvedStorageGeneration(owner, path,
    {storageObjects:[path], storageObjectGenerations:{}}, make()), null);
});
test('duplicate plan object names fail closed', () => {
  assert.equal(storageGenerationSubsetApproved(owner, make([path,path], ['1','1']), make([path],['1'])), false);
  assert.equal(storageGenerationSubsetApproved(owner, make(), make([path,path],['1','1'])), false);
});
test('same object name changed after admission would fail a provider generation precondition', async () => {
  const approved=make([path],['44']);
  const current=make([path],['44']);
  const signed=approvedStorageGeneration(owner,path,approved,current);
  assert.equal(signed,'44');
  const providerState={generation:'45'}; // an attacker/retry replaced the object after plan check
  const fakeDelete=async ({ifGenerationMatch})=>{
    if(ifGenerationMatch!==providerState.generation){const e=new Error('precondition failed');e.code=412;throw e;}
  };
  await assert.rejects(fakeDelete({ifGenerationMatch:signed}),{code:412});
});
