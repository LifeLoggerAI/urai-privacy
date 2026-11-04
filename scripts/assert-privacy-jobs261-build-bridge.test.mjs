import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { EXACT_JOBS_SHA, EXACT_JOBS_TREE, PINNED_BLOBS } from './review-only/assert-privacy-jobs261-checkout.mjs';
import { JOBS261_EMULATOR_IMPORTS, captureJobs261GeneratedManifest } from './review-only/attest-jobs261-generated.mjs';
import { assertPrivacyJobs261BuildBridge } from './review-only/assert-privacy-jobs261-build-bridge.mjs';

const root = mkdtempSync(join(tmpdir(), 'urai-r561-bridge-'));
for (const [i, relative] of JOBS261_EMULATOR_IMPORTS.entries()) {
  const file = join(root, 'functions/lib', relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `exports.ordinal = ${i};\n`);
}
const captured = captureJobs261GeneratedManifest(root);
const valid = Object.freeze({
  directory: root,
  declaredSha: EXACT_JOBS_SHA,
  generatedManifest: captured.manifest,
  expectedGeneratedDigest: captured.digest,
});
function gitMock(mutate = ({ output }) => output) {
  return (cmd, args) => {
    assert.equal(cmd, 'git');
    assert.deepEqual(args.slice(0, 2), ['-C', root]);
    const [action, ref, path] = args.slice(2);
    const output = action === 'rev-parse' ?
      (ref === '--show-toplevel' ? root :
        ref === '--abbrev-ref' && path === 'HEAD' ? 'HEAD' :
        ref === 'HEAD' ? EXACT_JOBS_SHA :
        ref === 'HEAD^{tree}' ? EXACT_JOBS_TREE : undefined) :
      action === 'hash-object' && ref === '--' ? PINNED_BLOBS[path] :
      action === 'status' ? '' : undefined;
    const mutated = mutate({ action, ref, path, output });
    return (mutated ?? '') + '\n';
  };
}
const check = (options = {}, mock = gitMock()) =>
  assertPrivacyJobs261BuildBridge({ ...valid, ...options }, mock);

test('R561: pinned checkout and four compiled imports both verified before use', () => {
  assert.equal(check(), true);
});
test('R561: no externally supplied digest is a hard stop', () => {
  assert.throws(() => check({ expectedGeneratedDigest: undefined }), /JOBS_GENERATED_BUILD_DIGEST_REQUIRED/);
  assert.throws(() => check({ generatedManifest: undefined }), /JOBS_GENERATED_BUILD_RECEIPT_REQUIRED/);
});
test('R561: source SHA mismatch denies before artifact verification', () => {
  assert.throws(() => check({ declaredSha: '0'.repeat(40) }), /JOBS_DECLARED_SHA_MISMATCH/);
});
test('R561: checked-out dirty tracked worktree denies despite green compiled digest', () => {
  const dirty = gitMock(({ action, output }) => action === 'status' ? ' M unrelated.ts' : output);
  assert.throws(() => check({}, dirty), /JOBS_TRACKED_WORKTREE_DIRTY/);
});
test('R561: wrong checkout tree is rejected', () => {
  const altered = gitMock(({ action, ref, output }) => action === 'rev-parse' && ref === 'HEAD^{tree}' ? '0'.repeat(40) : output);
  assert.throws(() => check({}, altered), /JOBS_ACTUAL_TREE_MISMATCH/);
});
test('R561: altered expected digest cannot be self-certified by source checkout', () => {
  assert.throws(() => check({ expectedGeneratedDigest: '0'.repeat(64) }), /ARTIFACT_MANIFEST_DIGEST_MISMATCH/);
});
test('R561: manifest with another module path rejected even with recalculated digest', () => {
  const altered = JSON.parse(captured.manifest);
  altered.files[0].path = 'functions/jobs/substitute.js';
  const forged = JSON.stringify(altered);
  const digest = createHash('sha256').update(forged).digest('hex');
  assert.throws(() => check({ generatedManifest: forged, expectedGeneratedDigest: digest }), /JOBS_COMPILED_ARTIFACT_DRIFT/);
});
test('R561: post-build generated JS tampering denies despite intact Git tree', () => {
  const file = join(root, 'functions/lib', JOBS261_EMULATOR_IMPORTS[1]);
  appendFileSync(file, '// tampered\n');
  assert.throws(() => check(), /JOBS_COMPILED_ARTIFACT_DRIFT/);
});
test.after(() => rmSync(root, { recursive: true, force: true }));
