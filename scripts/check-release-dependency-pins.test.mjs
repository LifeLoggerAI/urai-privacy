import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reviewReleaseDependencyPins } from './check-release-dependency-pins.mjs';

function fixture(mutate = () => {}) {
  const root = mkdtempSync(join(tmpdir(), 'urai-r709-lock-'));
  const entries = {
    root: { next: '16.4.5', zod: '^4.6.6' },
    functions: { zod: '^4.6.6' },
  };
  const lock = {
    root: { lockfileVersion: 3, packages: { '': {dependencies:{...entries.root}}, 'node_modules/next':{version:'16.4.5'},'node_modules/zod':{version:'4.6.6'} } },
    functions: { lockfileVersion: 3, packages: { '': {dependencies:{...entries.functions}},'node_modules/zod':{version:'4.6.6'} } },
  };
  mutate(entries, lock);
  mkdirSync(join(root, 'functions'));
  for (const scope of ['root', 'functions']) {
    const target = scope === 'root' ? root : join(root, 'functions');
    writeFileSync(join(target, 'package.json'), JSON.stringify({dependencies:entries[scope]}));
    writeFileSync(join(target, 'package-lock.json'), JSON.stringify(lock[scope]));
  }
  return {root, run:()=>reviewReleaseDependencyPins(root), close:()=>rmSync(root,{recursive:true,force:true})};
}
function withFixture(mutate, callback) {
  const f = fixture(mutate);
  try { callback(f.run()); } finally { f.close(); }
}

test('R709: accepts patched exact root and Functions lockfiles',()=>
  withFixture(()=>{}, result=>assert.equal(result.pass,true, result.failures.join('\n'))));
test('R709: refuses critical pre-patch Next.js 16.3.6',()=>
  withFixture((_d,l)=>{l.root.packages['node_modules/next'].version='16.3.6';}, result=>{
    assert.equal(result.pass,false);
    assert.ok(result.failures.some(x=>x.includes('next 16.3.6')));
  }));
test('R709: refuses first patched Next.js 16.4.1 without November update',()=>
  withFixture((_d,l)=>{l.root.packages['node_modules/next'].version='16.4.1';}, result=>assert.equal(result.pass,false)));
test('R709: rejects vulnerable root Zod 3.25.76',()=>
  withFixture((_d,l)=>{l.root.packages['node_modules/zod'].version='3.25.76';}, result=>assert.equal(result.pass,false)));
test('R709: rejects vulnerable Functions Zod 3.25.76',()=>
  withFixture((_d,l)=>{l.functions.packages['node_modules/zod'].version='3.25.76';}, result=>assert.equal(result.pass,false)));
test('R709: rejects nested vulnerable Zod even with patched direct dependency',()=>
  withFixture((_d,l)=>{l.root.packages['node_modules/example/node_modules/zod']={version:'3.25.76'};}, result=>{
    assert.equal(result.pass,false);
    assert.ok(result.failures.some(x=>x.includes('nested node_modules/example/node_modules/zod')));
  }));
test('R709: rejects nested vulnerable Next.js even when root Next.js is patched',()=>
  withFixture((_d,l)=>{l.root.packages['node_modules/example/node_modules/next']={version:'16.3.6'};}, result=>assert.equal(result.pass,false)));
test('R709: rejects manifest and lockfile dependency divergence',()=>
  withFixture((d,_l)=>{d.root.next='16.4.6';}, result=>assert.equal(result.pass,false)));
test('R709: rejects missing lockfile root metadata',()=>
  withFixture((_d,l)=>{delete l.functions.packages[''];}, result=>assert.equal(result.pass,false)));
test('R709: rejects prerelease and unparseable versions',()=>
  withFixture((_d,l)=>{l.root.packages['node_modules/next'].version='16.5.0-canary.1';}, result=>assert.equal(result.pass,false)));
test('R709: rejects Zod 4.6.5 just before patched floor',()=>
  withFixture((_d,l)=>{l.root.packages['node_modules/zod'].version='4.6.5';}, result=>assert.equal(result.pass,false)));
