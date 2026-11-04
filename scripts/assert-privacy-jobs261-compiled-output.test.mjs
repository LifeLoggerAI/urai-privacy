import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { assertPrivacyJobs261CompiledOutput } from './review-only/assert-privacy-jobs261-compiled-output.mjs';

const dir = mkdtempSync(join(tmpdir(), 'urai-r558-compiled-'));
const main = join(dir, 'functions/lib/functions');
const files = Object.freeze({
  'jobs/studioLifeMovieContract.js': 'exports.studio=1;',
  'privacy/lifeMovieFirebaseOwnerState.js': 'exports.owner=1;',
  'privacy/lifeMovieFirebaseSourceRightsAdapter.js': 'exports.rights=1;',
  'privacy/lifeMovieDerivativeRevocation.js': 'exports.revoke=1;',
});
const write = (root, filename, contents) => {
  const target = join(root, filename);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
};
const reset = (input = files) => {
  rmSync(main, { recursive: true, force: true });
  for (const [p, contents] of Object.entries(input)) write(main, p, contents);
};
const compile = (input = files) => ({outputDir}) => {
  for (const [p, contents] of Object.entries(input)) write(outputDir, p, contents);
};
const run = (fn = compile()) => assertPrivacyJobs261CompiledOutput({directory:dir}, {compile:fn});

test('R558: freshly compiled output equals the four original imported modules', () => {
  reset(); const proof = run();
  assert.equal(proof.reviewOnly, true);
  assert.equal(proof.productionAuthorized, false);
  assert.equal(proof.javascriptFileCount, 4);
  assert.match(proof.emittedFileDigestSha256, /^[a-f0-9]{64}$/);
});
test('R558: an ignored, stale compiled source-rights module is denied', () => {
  reset({...files, 'privacy/lifeMovieFirebaseSourceRightsAdapter.js': 'exports.rights=STALE;'});
  assert.throws(() => run(), /JOBS_COMPILED_JAVASCRIPT_BYTES_MISMATCH/);
});
test('R558: tampered consent revocation output is denied even with unchanged source checkout', () => {
  reset({...files, 'privacy/lifeMovieDerivativeRevocation.js': 'exports.revoke=false;'});
  assert.throws(() => run(), /JOBS_COMPILED_JAVASCRIPT_BYTES_MISMATCH/);
});
test('R558: missing imported compiled JavaScript is denied', () => {
  const mutated={...files};delete mutated['privacy/lifeMovieFirebaseOwnerState.js'];
  reset(mutated);
  assert.throws(() => run(), /JOBS_REQUIRED_COMPILED_MODULE_MISSING/);
});
test('R558: extra stale ignored module is denied', () => {
  reset({...files, 'privacy/oldPrivilegedWriter.js': 'exports.write=true;'});
  assert.throws(() => run(), /JOBS_COMPILED_JAVASCRIPT_FILESET_MISMATCH/);
});
test('R558: compiler failure prevents importing any Jobs compiled output', () => {
  reset(); assert.throws(() => run(() => {throw Error('synthetic tsc failure');}), /synthetic tsc failure/);
});
test('R558: symlinked compiled module is denied', () => {
  reset();
  const location=join(main,'privacy/lifeMovieDerivativeRevocation.js');
  rmSync(location);
  symlinkSync(join(main,'privacy/lifeMovieFirebaseOwnerState.js'),location);
  assert.throws(() => run(), /JOBS_COMPILED_SYMLINK_NOT_ALLOWED/);
});
test('R558: entire ignored compiled-output root cannot be redirected by symlink', () => {
  reset();
  const relocated = join(dir, 'relocated-output');
  mkdirSync(relocated, { recursive: true });
  rmSync(main, { recursive: true, force: true });
  symlinkSync(relocated, main);
  assert.throws(() => run(), /JOBS_COMPILED_OUTPUT_ROOT_SYMLINK_NOT_ALLOWED/);
});
test('R558: non-disposable checkout path fails closed', () => {
  assert.throws(() => assertPrivacyJobs261CompiledOutput({directory:'/'}), /JOBS_COMPILED_DISPOSABLE_CHECKOUT_REQUIRED/);
});
test.after(() => rmSync(dir, { recursive: true, force: true }));
